# routes/create_epic.py

import sys
import os
sys.path.append('E:\projects\sts_prod_developement')

from fastapi import APIRouter, HTTPException, Form, UploadFile, File, Depends
from auth.jwt_handler import verify_token
from http import HTTPStatus
from helper_functions import get_current_time_ist, parse_date, format_file_size
import psycopg2
from utils.connect_to_psql import connect_to_psql
from config import load_config
from utils.logger import get_logger
from typing import List, Optional
import uuid
import traceback
from enum import Enum

config = load_config()
log_dir = config.get('log_dir')
log_file_name = config.get('log_file_name')
upload_dir = config.get('upload_dir')
base_url = config.get('base_url')

host = config.get('host')
port = config.get('port')
username = config.get('username')
password = config.get('password')
database_name = config.get('database_name')
schema_name = config.get('primary_schema')

router = APIRouter()

# Initialize logger for this module
logger = get_logger(log_file_name, log_dir=log_dir)

# Status Code Enum - Valid values for epics
class StatusCode(str, Enum):
    NOT_YET_STARTED = "STS001"  # To Do / Not Yet Started
    IN_PROGRESS = "STS007"      # In Progress
    COMPLETED = "STS002"        # Completed
    CANCELLED = "STS010"        # Cancelled

@router.post("/api/v1/timesheet/create_epic")
async def create_epic(
    epic_title: str = Form(..., description="Title of the epic"),
    epic_description: str = Form(default="", description="Detailed description of the epic"),
    product_code: str = Form(..., description="Product code this epic belongs to"),
    company_code: Optional[str] = Form(default=None, description="Company/client code (optional)"),
    contact_person_code: Optional[str] = Form(default=None, description="Contact person code (optional)"),
    status_code: StatusCode = Form(default=StatusCode.NOT_YET_STARTED, description="Current status of the epic (default: STS001 - Not Yet Started/To Do, must be one of: STS001, STS007, STS002, STS010)"),
    priority_code: int = Form(..., description="Priority level of the epic"),
    start_date: str = Form(..., description="Start date in DD-MM-YYYY or YYYY-MM-DD format"),
    due_date: str = Form(..., description="Due date in DD-MM-YYYY or YYYY-MM-DD format"),
    closed_on: Optional[str] = Form(default=None, description="Closed on date (completion date) in DD-MM-YYYY or YYYY-MM-DD format (optional)"),
    estimated_hours: float = Form(..., description="Estimated hours for the epic"),
    max_hours: float = Form(..., description="Maximum hours allowed for the epic"),
    is_billable: bool = Form(default=True, description="Whether the epic is billable"),
    attachments: List[UploadFile] = File(default=[], description="File attachments for the epic"),
    current_user: dict = Depends(verify_token),
):
    """
    Create a new epic with optional file attachments
    """
    logger.info(f"[INFO] Starting epic creation for epic_title: {epic_title}, product_code: {product_code}, user: {current_user['user_code']}")
    
    conn = None
    cursor = None

    try:

        logger.info(f"[INFO] Establishing database connection for epic creation")
        conn = connect_to_psql(host, port, username, password, database_name, schema_name)
        cursor = conn.cursor()
        logger.info(f"[INFO] Database connection established successfully")       

        # Step 1: Set default status if not provided
        if not status_code:
            status_code = StatusCode.NOT_YET_STARTED  # Default to "Not Yet Started/To Do" like tasks
        
        # Convert enum to string value
        status_code_str = status_code.value if isinstance(status_code, StatusCode) else str(status_code).upper()
        
        # Step 1.1: Validate Status code exists and is allowed for epics
        cursor.execute("SELECT status_desc FROM sts_new.status_master WHERE status_code = %s", (status_code_str,))
        status_result = cursor.fetchone()
        if not status_result:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Status code '{status_code_str}' does not exist in status_master"
            )
        
        # Validate status_code is one of the allowed enum values
        try:
            # If it's already an enum, validate it's a valid StatusCode
            if isinstance(status_code, StatusCode):
                status_code_str = status_code.value
            else:
                # Try to convert string to enum
                status_code_enum = StatusCode(status_code_str)
                status_code_str = status_code_enum.value
        except ValueError:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Status code '{status_code_str}' is not allowed for epics. Allowed values are: STS001 (Not Yet Started), STS007 (In Progress), STS002 (Completed), STS010 (Cancelled)"
            )

        # Step 2: Validate product exists
        cursor.execute("SELECT product_code FROM sts_new.product_master WHERE product_code = %s", (product_code,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Product with code {product_code} does not exist"
            )

        # Step 2.1: Validate company_code exists (if provided)
        if company_code:
            cursor.execute("SELECT company_code FROM sts_new.company_master WHERE company_code = %s AND is_inactive = false", (company_code,))
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Company with code {company_code} does not exist or is inactive"
                )

        # Step 2.2: Validate contact_person_code exists and belongs to company (if provided)
        if contact_person_code:
            cursor.execute(
                "SELECT contact_person_code, company_code FROM sts_new.contact_master WHERE contact_person_code = %s AND is_inactive = false",
                (contact_person_code,)
            )
            contact_result = cursor.fetchone()
            if not contact_result:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Contact person with code {contact_person_code} does not exist or is inactive"
                )
            
            contact_company_code = contact_result[1]
            # If company_code is also provided, validate they match
            if company_code and contact_company_code != company_code:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Contact person {contact_person_code} belongs to company {contact_company_code}, but epic is assigned to company {company_code}"
                )
            
            # If company_code is not provided but contact_person_code is, auto-set company_code from contact
            if not company_code:
                company_code = contact_company_code
                logger.info(f"[INFO] Auto-set company_code to {company_code} from contact_person_code {contact_person_code}")

        # Step 3: Validate priority_code exists
        cursor.execute("SELECT priority_code FROM sts_new.tkt_priority_master WHERE priority_code = %s", (priority_code,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Priority code {priority_code} does not exist"
            )

        # Step 4: Validate created_by user exists and has admin role
        cursor.execute(
            "SELECT user_code, designation_name FROM sts_new.user_master WHERE user_code = %s",
            (current_user['user_code'],)
        )
        user_result = cursor.fetchone()
        if not user_result:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Created by user with code {current_user['user_code']} does not exist"
            )
        
        user_code, designation_name = user_result
        if not designation_name:
            raise HTTPException(
                status_code=HTTPStatus.FORBIDDEN,
                detail="User does not have a valid designation. Only admins can create epics."
            )
        
        # Normalize designation_name for comparison (case-insensitive)
        designation_normalized = designation_name.strip().lower()
        
        # Allowed admin designations from config
        allowed_admin_designations = config.get('admin_designations', [])
        
        if designation_normalized not in allowed_admin_designations:
            raise HTTPException(
                status_code=HTTPStatus.FORBIDDEN,
                detail=f"Only admins can create epics. User '{user_code}' with designation '{designation_name}' is not authorized. Allowed designations: Technical Admin, Technical Support Admin, Functional Admin, Functional Support Admin, Super Admin"
            )
        
        logger.info(f"[INFO] User {user_code} with designation '{designation_name}' is authorized to create epics")
        
        # Step 4.1: Determine reporter based on creator's role
        # If creator is an admin: reporter = created_by (the admin themselves)
        # If creator is a regular employee: reporter = their team lead
        creator_is_admin = designation_normalized in allowed_admin_designations
        
        if creator_is_admin:
            # Admin: reporter = created_by (the admin themselves)
            reporter = user_code
            logger.info(f"[INFO] Creator {user_code} is an admin, setting reporter to created_by: {reporter}")
        else:
            # Regular employee: use team lead
            # Get team information for the creator
            cursor.execute("""
                SELECT tm.team_lead
                FROM sts_new.user_master um
                LEFT JOIN sts_new.team_master tm ON um.team_code = tm.team_code
                WHERE um.user_code = %s
            """, (user_code,))
            team_result = cursor.fetchone()
            
            if not team_result:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"User {user_code} is not associated with any team. Cannot determine reporter."
                )
            
            team_lead = team_result[0]
            
            if not team_lead:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Team lead is not configured for team. Cannot determine reporter for regular employee."
                )
            reporter = team_lead
            logger.info(f"[INFO] Creator {user_code} is a regular employee, setting reporter to team lead: {reporter}")
        
        # Step 5: Parse dates if provided (supports both DD-MM-YYYY and YYYY-MM-DD formats)
        start_date_parsed = None
        due_date_parsed = None
        closed_on_parsed = None
        
        if start_date:
            try:
                start_date_parsed = parse_date(start_date)
            except ValueError as e:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Start date error: {str(e)}"
                )
        
        if due_date:
            try:
                due_date_parsed = parse_date(due_date)
            except ValueError as e:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Due date error: {str(e)}"
                )
        
        if closed_on:
            try:
                closed_on_parsed = parse_date(closed_on)
            except ValueError as e:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Closed on date error: {str(e)}"
                )

        # Step 5.5: If status is "In Progress" (STS007) and start_date is not provided, set it to today
        # Note: start_date is required, but this ensures consistency if somehow it's missing
        current_time = get_current_time_ist()
        if status_code_str == 'STS007' and not start_date_parsed:
            start_date_parsed = current_time.date()
            logger.info(f"[INFO] Auto-setting start_date to {start_date_parsed} for epic created with In Progress status")

        # Validate date logic: start_date <= due_date, closed_on >= start_date if provided
        if start_date_parsed and due_date_parsed and start_date_parsed > due_date_parsed:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="Start date cannot be after due date"
            )
        
        if closed_on_parsed and start_date_parsed and closed_on_parsed < start_date_parsed:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="Closed on date cannot be before start date"
            )

        # Step 6: Insert epic into sts_ts.epics table
        # Note: current_time was already set in Step 5.5 if status was In Progress
        if 'current_time' not in locals():
            current_time = get_current_time_ist()
        created_by = current_user['user_code']
        
        insert_query = """
            INSERT INTO sts_ts.epics (
                epic_title, epic_description, product_code,
                company_code, contact_person_code, reporter,
                status_code, priority_code,
                start_date, due_date, closed_on,
                estimated_hours, max_hours, is_billable,
                created_by, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) RETURNING id
        """
        
        cursor.execute(insert_query, (
            epic_title, epic_description, product_code,
            company_code, contact_person_code, reporter,
            status_code_str, priority_code,
            start_date_parsed, due_date_parsed, closed_on_parsed,
            estimated_hours, max_hours, is_billable,
            created_by, current_time
        ))
        
        result = cursor.fetchone()
        if not result:
            raise Exception("Failed to insert epic - no ID returned")
        epic_id = result[0]
        
        logger.info(f"[INFO] Successfully created epic with ID: {epic_id}")
        
        # Note: No initial history entry created - history entries are only created when epic is updated
        logger.info(f"[INFO] Epic created without initial history entry (history entries are only created on updates)")
        
        
        # Step 8: Handle file attachments if provided
        attachment_data = []
        if attachments and len(attachments) > 0:
            logger.info(f"[INFO] Processing {len(attachments)} file attachments")
            
            # Create upload directory if it doesn't exist
            if not os.path.exists(upload_dir):
                logger.info(f"[INFO] Creating upload directory: {upload_dir}")
                os.makedirs(upload_dir, exist_ok=True)
                os.chmod(upload_dir, 0o755)
                logger.info(f"[INFO] Upload directory created successfully with permissions")
        
            # Ensure base_url ends with a trailing slash for correct URL join
            if base_url.endswith('/'):
                normalized_base_url = base_url
            else:
                normalized_base_url = base_url + '/'

            for attachment in attachments:
                if attachment.filename:  # Check if file was actually uploaded
                    try:
                        # Generate unique filename
                        file_extension = os.path.splitext(attachment.filename)[1]
                        unique_filename = f"{uuid.uuid4()}{file_extension}"
                        file_path = os.path.join(upload_dir, unique_filename).replace('\\', '/')
                        
                        # Create the URL for client access
                        file_url = normalized_base_url + unique_filename
                        logger.info(f"[INFO] Generated unique filename: {unique_filename} for file: {attachment.filename}")

                        # Save file to disk
                        try:
                            with open(file_path, "wb") as buffer:
                                content = await attachment.read()
                                buffer.write(content)
                            logger.info(f"[INFO] File saved to disk: {file_path}, size: {len(content)} bytes")
                        except Exception as e:
                            logger.error(f"[ERROR] Failed to save file {attachment.filename}: {str(e)}")
                            raise HTTPException(
                                status_code=HTTPStatus.BAD_REQUEST,
                                detail=f"Failed to save file '{attachment.filename}'. Error: {str(e)}"
                            )
                        
                        file_size = len(content)
                        
                        # Set proper file permissions for web server access
                        os.chmod(file_path, 0o644)
                        
                        # Extract file information
                        file_name = attachment.filename
                        file_type = os.path.splitext(attachment.filename)[1].lower().lstrip('.')  # Remove the dot
                        file_size_bytes = file_size
                        
                        # Convert bytes to human readable format
                        file_size_display = format_file_size(file_size_bytes)
                        
                        # Insert attachment record into database
                        attachment_query = """
                            INSERT INTO sts_ts.attachments (
                                parent_type, parent_code, file_path, file_url, file_name, file_type, file_size, purpose, created_by, created_at
                            ) VALUES (
                                'EPIC', %s, %s, %s, %s, %s, %s, %s, %s, %s
                            ) RETURNING id
                        """
                        
                        cursor.execute(attachment_query, (
                            str(epic_id), file_path, file_url, file_name, file_type, file_size_display, "EPIC ATTACHMENT", 
                            current_user['user_code'], current_time
                        ))
                        
                        attachment_id = cursor.fetchone()[0]
                        attachment_data.append({
                            "id": attachment_id,
                            "original_filename": attachment.filename,
                            "file_path": file_path,
                            "file_url": file_url,
                            "purpose": "EPIC ATTACHMENT",
                            "file_size_bytes": file_size_bytes,
                            "file_size_display": file_size_display,
                        })
                        
                        logger.info(f"[INFO] Successfully saved attachment: {attachment.filename}")
                        
                    except Exception as e:
                        logger.error(f"[ERROR] Failed to save attachment {attachment.filename}: {str(e)}")
                        logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
                        # ROLLBACK the entire transaction and return error
                        if conn:
                            conn.rollback()
                        raise HTTPException(
                            status_code=HTTPStatus.BAD_REQUEST,
                            detail=f"Failed to save attachment '{attachment.filename}'. The epic creation has been rolled back. Error: {str(e)}"
                        )

        # Step 9: Commit transaction
        conn.commit()
        logger.info(f"[INFO] Successfully created epic with ID: {epic_id}")
        
        return {
            "Status_Flag": True,
            "Status_Description": "Epic created successfully",
            "Status_Code": HTTPStatus.CREATED.value,
            "Status_Message": HTTPStatus.CREATED.phrase,
            "Response_Data": {
                "id": epic_id,
                "epic_title": epic_title,
                "epic_description": epic_description,
                "product_code": product_code,
                "company_code": company_code,
                "contact_person_code": contact_person_code,
                "reporter": reporter,
                "status_code": status_code_str,
                "priority_code": priority_code,
                "start_date": str(start_date_parsed) if start_date_parsed else None,
                "due_date": str(due_date_parsed) if due_date_parsed else None,
                "closed_on": str(closed_on_parsed) if closed_on_parsed else None,
                "estimated_hours": estimated_hours,
                "max_hours": max_hours,
                "is_billable": is_billable,
                "attachments": attachment_data
            }
        }

    except psycopg2.IntegrityError as e:
        logger.error(f"[ERROR] Database integrity error: {str(e)}")
        logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=f"Data integrity violation. Please check your input data. Error: {str(e)}"
        )
    except psycopg2.OperationalError as e:
        logger.error(f"[ERROR] Database connection error: {str(e)}")
        logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Database connection failed"
        )
    except psycopg2.ProgrammingError as e:
        logger.error(f"[ERROR] Database query error: {str(e)}")
        logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail=f"Database query failed. Error: {str(e)}"
        )
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"[ERROR] Unexpected error: {str(e)}")
        logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
            logger.info(f"[INFO] Database cursor closed")
        if conn:
            conn.close()
            logger.info(f"[INFO] Database connection closed for epic creation")

