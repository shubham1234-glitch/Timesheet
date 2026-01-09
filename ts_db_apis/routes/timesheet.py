# routes/timesheet.py

import sys
sys.path.append('E:\projects\sts_prod_developement')

from fastapi import APIRouter, HTTPException, Form, UploadFile, File, Depends
from auth.jwt_handler import verify_token
from http import HTTPStatus
from helper_functions import get_current_time_ist, format_file_size, parse_date
import psycopg2
from utils.connect_to_psql import connect_to_psql
from config import load_config
from utils.logger import get_logger
import os
import uuid
from typing import List, Optional
from enum import Enum
import traceback

config = load_config()
log_dir = config.get('log_dir')
log_file_name = config.get('log_file_name')
upload_dir = config.get('upload_dir', 'uploads')
base_url = config.get('base_url')
allowed_admin_designations = config.get('admin_designations', [])

host = config.get('host')
port = config.get('port')
username = config.get('username')
password = config.get('password')
database_name = config.get('database_name')
schema_name = config.get('primary_schema')

router = APIRouter()

# Initialize logger for this module
logger = get_logger(log_file_name, log_dir=log_dir)

# Work Location Enum - Valid values (CHECK constraint: REMOTE, ON_SITE, OFFICE)
class WorkLocationCode(str, Enum):
    REMOTE = "REMOTE"
    ON_SITE = "ON_SITE"
    OFFICE = "OFFICE"

# Approval Action Enum
class ApprovalAction(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"

# Task Type Code Enum - Valid values from task_type_master
class TaskTypeCode(str, Enum):
    ACCOUNTS = "TT001"              # Accounts
    DEVELOPMENT = "TT002"           # Development
    QUALITY_ASSURANCE = "TT003"     # Quality Assurance
    USER_ACCEPTANCE_TESTING = "TT004"  # User Acceptance Testing
    PROD_MOVE = "TT005"             # PROD Move
    DOCUMENTATION = "TT006"         # Documentation
    DESIGN = "TT007"                # Design
    CODE_REVIEW = "TT008"           # Code Review
    MEETING = "TT009"               # Meeting
    TRAINING = "TT010"              # Training
    IMPLEMENTATION = "TT011"        # Implementation
    SUPPORT = "TT012"               # Support

@router.post("/api/v1/timesheet/enter_timesheet/")
async def enter_timesheet(
    entry_date: Optional[str] = Form(None, description="Entry date in DD-MM-YYYY or YYYY-MM-DD format"),
    epic_code: Optional[int] = Form(None, description="Epic ID that the task belongs to (required if task_code is provided)"),
    task_code: Optional[int] = Form(None, description="Task ID being worked on (mutually exclusive with activity_code and ticket_code)"),
    activity_code: Optional[int] = Form(None, description="Activity ID being worked on (mutually exclusive with task_code and ticket_code)"),
    ticket_code: Optional[int] = Form(None, description="Ticket ID being worked on (mutually exclusive with task_code and activity_code)"),
    actual_hours_worked: Optional[float] = Form(None, description="Hours worked on the task/activity/ticket"),
    travel_time: Optional[float] = Form(0, description="Travel time in hours"),
    waiting_time: Optional[float] = Form(0, description="Waiting time in hours"),
    total_hours: Optional[float] = Form(None, description="Total hours (calculated: actual_hours_worked + travel_time + waiting_time). If not provided, will be calculated automatically."),
    work_location: Optional[WorkLocationCode] = Form(None, description="Work location code. Valid values: REMOTE, ON_SITE, OFFICE"),
    task_type_code: Optional[TaskTypeCode] = Form(None, description="Task type code (TT001-TT012) - optional. If not provided and task_code is provided, will use task's task_type_code. For tickets, defaults to TT012 (Support) if not provided."),
    description: Optional[str] = Form(None, description="Description of work performed"),
    attachments: List[UploadFile] = File(default=[], description="File attachments for the timesheet entry"),
    current_user: dict = Depends(verify_token),
):
    """
    Create a new timesheet entry as DRAFT (allows partial data)
    All fields are optional - user can save partial data and complete later
    
    Either task_code OR activity_code OR ticket_code must be provided (mutually exclusive):
    - If task_code: epic_code will be auto-fetched from task (or can be provided to validate)
    - If activity_code: epic_code will be NULL (activities don't belong to epics)
    - If ticket_code: epic_code will be NULL (tickets don't belong to epics), task_type_code defaults to TT012 (Support)
    """
    logger.info(f"[INFO] Starting timesheet entry creation for user_code: {current_user['user_code']}, task_code: {task_code}, activity_code: {activity_code}, ticket_code: {ticket_code}")
    
    conn = None
    cursor = None

    try:
        # Step 1: Establish database connection
        logger.info(f"[INFO] Establishing database connection for timesheet entry creation")
        conn = connect_to_psql(host, port, username, password, database_name, schema_name)
        cursor = conn.cursor()
        logger.info(f"[INFO] Database connection established successfully")

        # Step 2: Validate and process optional fields (only if provided)
        # For DRAFT entries, all fields are optional - user can save partial data
        
        # Parse entry_date if provided
        entry_date_obj = None
        if entry_date:
            try:
                from datetime import date, timedelta
                entry_date_obj = parse_date(entry_date)
                # Validate entry_date is not in the future
                today = date.today()
                if entry_date_obj > today:
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail="Timesheet entry cannot be created for future dates"
                    )
                # Validate entry_date is within the past 1 week (7 days)
                one_week_ago = today - timedelta(days=7)
                if entry_date_obj < one_week_ago:
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail="Timesheet entry can only be created for dates within the past 1 week (7 days)"
                    )
            except ValueError as e:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Invalid date format: {str(e)}. Please use DD-MM-YYYY or YYYY-MM-DD format"
                )
        
        # Step 2.1: Validate that exactly one of task_code, activity_code, or ticket_code is provided (mutually exclusive)
        # For DRAFT, all can be NULL (partial entry)
        provided_codes = [code for code in [task_code, activity_code, ticket_code] if code is not None]
        if len(provided_codes) > 1:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="Cannot provide multiple parent codes. Please provide exactly one of: task_code, activity_code, or ticket_code (mutually exclusive)."
            )
        
        # Validate task_code and epic_code if provided
        task_epic_code = None
        task_task_type_code = None
        if task_code:
            cursor.execute("SELECT id, epic_code, task_type_code FROM sts_ts.tasks WHERE id = %s", (task_code,))
            task_result = cursor.fetchone()
            if not task_result:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Task with ID {task_code} does not exist"
                )
            task_epic_code = task_result[1]  # Get epic_code from the task
            task_task_type_code = task_result[2]  # Get task_type_code from the task
            
            # If epic_code is provided, validate it matches task's epic_code
            if epic_code and epic_code != task_epic_code:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Epic code {epic_code} does not match the task's epic code {task_epic_code}"
                )
            # Use task's epic_code if epic_code not provided
            if not epic_code:
                epic_code = task_epic_code
        
        # Validate epic_code exists if provided (only for task entries)
        if epic_code:
            cursor.execute("SELECT id FROM sts_ts.epics WHERE id = %s", (epic_code,))
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Epic with ID {epic_code} does not exist"
                )
        
        # Validate activity_code if provided
        if activity_code:
            cursor.execute("SELECT id, product_code FROM sts_ts.activities WHERE id = %s", (activity_code,))
            activity_result = cursor.fetchone()
            if not activity_result:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Activity with ID {activity_code} does not exist"
                )
            # For activities, ensure all task-related fields are NULL
            if epic_code:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="epic_code cannot be provided when activity_code is provided. Activities do not belong to epics."
                )
            if task_code:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="task_code cannot be provided when activity_code is provided. Activities are independent of tasks."
                )
            if ticket_code:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="ticket_code cannot be provided when activity_code is provided. Activities are independent of tickets."
                )
            # Explicitly set all task-related fields to NULL for activity entries
            epic_code = None
            task_code = None  # Ensure task_code is NULL for activity entries
            ticket_code = None  # Ensure ticket_code is NULL for activity entries
            logger.info(f"[INFO] Activity {activity_code} validated, task_code, epic_code, ticket_code, and task_type_code will be NULL")
        
        # Validate ticket_code if provided
        if ticket_code:
            cursor.execute("SELECT ticket_code FROM sts_new.ticket_master WHERE ticket_code = %s", (ticket_code,))
            ticket_result = cursor.fetchone()
            if not ticket_result:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Ticket with ID {ticket_code} does not exist"
                )
            # For tickets, ensure all task/epic-related fields are NULL
            if epic_code:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="epic_code cannot be provided when ticket_code is provided. Tickets do not belong to epics."
                )
            if task_code:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="task_code cannot be provided when ticket_code is provided. Tickets are independent of tasks."
                )
            if activity_code:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="activity_code cannot be provided when ticket_code is provided. Tickets are independent of activities."
                )
            # Explicitly set all task/epic-related fields to NULL for ticket entries
            epic_code = None
            task_code = None  # Ensure task_code is NULL for ticket entries
            activity_code = None  # Ensure activity_code is NULL for ticket entries
            logger.info(f"[INFO] Ticket {ticket_code} validated, task_code, epic_code, and activity_code will be NULL")

        # Validate work_location if provided (CHECK constraint: REMOTE, ON_SITE, OFFICE)
        work_location_str = None
        if work_location:
            work_location_str = work_location.value if isinstance(work_location, WorkLocationCode) else str(work_location)
            # Validate against CHECK constraint values
            valid_work_locations = ['REMOTE', 'ON_SITE', 'OFFICE']
            if work_location_str not in valid_work_locations:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Work location code '{work_location_str}' is invalid. Must be one of: {', '.join(valid_work_locations)}"
                )

        # Validate and set task_type_code
        # For activity entries, task_type_code should always be NULL
        # For ticket entries, task_type_code defaults to TT012 (Support) if not provided
        final_task_type_code = None
        if activity_code:
            # Activities don't have task types, so task_type_code must be NULL
            if task_type_code is not None:
                logger.info(f"[INFO] task_type_code provided for activity entry - will be set to NULL (activities don't use task types)")
            final_task_type_code = None
        elif ticket_code:
            # For tickets, default to Support (TT012) if task_type_code not provided
            if task_type_code is not None:
                # Convert enum to string value
                if isinstance(task_type_code, TaskTypeCode):
                    task_type_code_str = task_type_code.value
                else:
                    task_type_code_str = str(task_type_code).upper()
                # Validate task_type_code is one of the allowed enum values
                try:
                    task_type_code_enum = TaskTypeCode(task_type_code_str)
                    task_type_code_str = task_type_code_enum.value
                except ValueError:
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail=f"Task type code '{task_type_code_str}' is not allowed. Allowed values are: TT001 (Accounts), TT002 (Development), TT003 (Quality Assurance), TT004 (User Acceptance Testing), TT005 (PROD Move), TT006 (Documentation), TT007 (Design), TT008 (Code Review), TT009 (Meeting), TT010 (Training), TT011 (Implementation), TT012 (Support)"
                    )
                
                cursor.execute("SELECT type_code FROM sts_ts.task_type_master WHERE type_code = %s AND is_active = true", (task_type_code_str,))
                if not cursor.fetchone():
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail=f"Task type code {task_type_code_str} does not exist or is not active"
                    )
                final_task_type_code = task_type_code_str
            else:
                # Default to Support (TT012) for tickets
                final_task_type_code = 'TT012'
                logger.info(f"[INFO] Using default task_type_code TT012 (Support) for ticket {ticket_code}")
        elif task_type_code is not None:
            # Convert enum to string value
            if isinstance(task_type_code, TaskTypeCode):
                task_type_code_str = task_type_code.value
            else:
                task_type_code_str = str(task_type_code).upper()
            # Validate task_type_code is one of the allowed enum values
            try:
                task_type_code_enum = TaskTypeCode(task_type_code_str)
                task_type_code_str = task_type_code_enum.value
            except ValueError:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Task type code '{task_type_code_str}' is not allowed. Allowed values are: TT001 (Accounts), TT002 (Development), TT003 (Quality Assurance), TT004 (User Acceptance Testing), TT005 (PROD Move), TT006 (Documentation), TT007 (Design), TT008 (Code Review), TT009 (Meeting), TT010 (Training), TT011 (Implementation), TT012 (Support)"
                )
            
            cursor.execute("SELECT type_code FROM sts_ts.task_type_master WHERE type_code = %s AND is_active = true", (task_type_code_str,))
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Task type code {task_type_code_str} does not exist or is not active"
                )
            final_task_type_code = task_type_code_str
        elif task_code and task_task_type_code:
            # Use task's task_type_code if not provided
            final_task_type_code = task_task_type_code
            logger.info(f"[INFO] Using task's task_type_code: {final_task_type_code}")

        # Process hours (all optional for DRAFT)
        actual_hours_worked_val = actual_hours_worked if actual_hours_worked is not None else 0
        travel_time_val = travel_time if travel_time is not None else 0
        waiting_time_val = waiting_time if waiting_time is not None else 0
        
        # Calculate total_hours if not provided
        if total_hours is None:
            total_hours = actual_hours_worked_val + travel_time_val + waiting_time_val
        else:
            # Validate that provided total_hours matches calculated value (if hours are provided)
            if actual_hours_worked_val > 0 or travel_time_val > 0 or waiting_time_val > 0:
                calculated_total = actual_hours_worked_val + travel_time_val + waiting_time_val
                if abs(total_hours - calculated_total) > 0.01:  # Allow small floating point differences
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail=f"Total hours ({total_hours}) does not match calculated value ({calculated_total}). Total hours should be actual_hours_worked + travel_time + waiting_time"
                    )
        
        # Validate total_hours doesn't exceed 24 if provided
        if total_hours and total_hours > 24:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="Total time cannot exceed 24 hours"
            )

        # Step 3: Insert timesheet entry (all fields optional for DRAFT)
        current_time = get_current_time_ist()
        created_by = current_user['user_code']
        
        insert_query = """
            INSERT INTO sts_ts.timesheet_entry (
                entry_date, user_code, task_code, epic_code, activity_code, ticket_code,
                actual_hours_worked, travel_time, waiting_time, total_hours,
                work_location, task_type_code, description, approval_status, created_by, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'DRAFT', %s, %s
            ) RETURNING id
        """
        
        cursor.execute(insert_query, (
            entry_date_obj, current_user['user_code'], task_code, epic_code, activity_code, ticket_code,
            actual_hours_worked_val, travel_time_val, waiting_time_val, total_hours,
            work_location_str, final_task_type_code, description, created_by, current_time
        ))
        
        result = cursor.fetchone()
        entry_id = result[0]
        
        # Step 7.1: Insert initial approval history entry into sts_ts.timesheet_approval_hist table
        logger.info(f"[INFO] Creating initial approval history entry for timesheet entry_id: {entry_id}")
        hist_insert_query = """
            INSERT INTO sts_ts.timesheet_approval_hist (
                entry_id, approval_status, status_reason,
                entry_user_code, entry_date,
                task_code, epic_code, activity_code, ticket_code,
                actual_hours_worked, travel_time, waiting_time, total_hours,
                submitted_by, submitted_at,
                approved_by, approved_at, rejected_by, rejected_at,
                created_by, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) RETURNING id
        """
        
        cursor.execute(hist_insert_query, (
            entry_id,  # entry_id
            'DRAFT',  # approval_status
            None,  # status_reason (no reason for initial DRAFT status)
            current_user['user_code'],  # entry_user_code
            entry_date_obj,  # entry_date (can be NULL for DRAFT)
            task_code,  # task_code (snapshot)
            epic_code,  # epic_code (snapshot)
            activity_code,  # activity_code (snapshot)
            ticket_code,  # ticket_code (snapshot)
            actual_hours_worked_val,  # actual_hours_worked (can be 0 for DRAFT)
            travel_time_val,  # travel_time
            waiting_time_val,  # waiting_time
            total_hours,  # total_hours
            None,  # submitted_by
            None,  # submitted_at
            None,  # approved_by
            None,  # approved_at
            None,  # rejected_by
            None,  # rejected_at
            created_by,  # created_by
            current_time  # created_at
        ))
        
        hist_result = cursor.fetchone()
        if not hist_result:
            raise Exception("Failed to insert timesheet approval history entry - no ID returned")
        hist_id = hist_result[0]
        logger.info(f"[INFO] Successfully created initial approval history entry with id: {hist_id}")
        
        # Step 8: Handle file attachments if provided
        attachment_data = []
        if attachments and len(attachments) > 0:
            logger.info(f"[INFO] Processing {len(attachments)} file attachments")
            
            # Create upload directory if it doesn't exist
            if not os.path.exists(upload_dir):
                logger.info(f"[INFO] Creating upload directory: {upload_dir}")
                os.makedirs(upload_dir, exist_ok=True)
                # Set proper permissions for web server access
                os.chmod(upload_dir, 0o755)
                logger.info(f"[INFO] Upload directory created successfully with permissions")

            # Ensure base_url ends with a trailing slash for correct URL join
            normalized_base_url = base_url if base_url.endswith('/') else (base_url + '/')

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
                        logger.info(f"[INFO] File saved to disk: {file_path}, size: {file_size} bytes")
                        
                        # Set proper file permissions for web server access
                        os.chmod(file_path, 0o644)
                                
                        # Extract file information to insert into database
                        file_name = attachment.filename
                        file_type = os.path.splitext(attachment.filename)[1].lower().lstrip('.')
                        file_size_bytes = file_size
                        file_size_display = format_file_size(file_size_bytes)
                                                
                        # Insert attachment record into database (using entry_id instead of entry_code)
                        attachment_query = """
                            INSERT INTO sts_ts.attachments (
                                parent_type, parent_code, file_path, file_url, file_name, file_type, file_size, purpose, created_by, created_at
                            ) VALUES (
                                'TIMESHEET_ENTRY', %s, %s, %s, %s, %s, %s, %s, %s, %s
                            ) RETURNING id
                        """
                        
                        cursor.execute(attachment_query, (
                            entry_id, file_path, file_url, file_name, file_type, file_size_display, "TIMESHEET ATTACHMENT", 
                            current_user['user_code'], current_time
                        ))
                        
                        attachment_id = cursor.fetchone()[0]
                        attachment_data.append({
                            "id": attachment_id,
                            "original_filename": attachment.filename,
                            "file_path": file_path,
                            "file_url": file_url,
                            "purpose": "TIMESHEET ATTACHMENT",
                            "file_size_bytes": file_size_bytes,
                            "file_size_display": file_size_display
                        })
                        
                        logger.info(f"[INFO] Successfully saved attachment: {attachment.filename}")
                        
                    except Exception as e:
                        logger.error(f"[ERROR] Failed to save attachment {attachment.filename}: {str(e)}")
                        # Continue with other attachments even if one fails
                        continue

        # Step 9: Commit transaction
        conn.commit()
        logger.info(f"[INFO] Successfully created timesheet entry with ID: {entry_id}")
        
        return {
            "Status_Flag": True,
            "Status_Description": "Timesheet entry created successfully",
            "Status_Code": HTTPStatus.CREATED.value,
            "Status_Message": HTTPStatus.CREATED.phrase,
            "Response_Data": {
                "id": entry_id,
                "entry_date": str(entry_date_obj) if entry_date_obj else None,
                "user_code": current_user['user_code'],
                "task_code": task_code,
                "epic_code": epic_code,
                "activity_code": activity_code,
                "ticket_code": ticket_code,
                "actual_hours_worked": actual_hours_worked_val,
                "travel_time": travel_time_val,
                "waiting_time": waiting_time_val,
                "total_hours": total_hours,
                "work_location": work_location_str if work_location_str else None,
                "task_type_code": final_task_type_code,
                "description": description,
                "approval_status": "DRAFT",
                "attachments": attachment_data
            }
        }

    except psycopg2.IntegrityError as e:
        logger.error(f"[ERROR] Database integrity error: {str(e)}")
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=f"Data integrity violation: {str(e)}"
        )
    except psycopg2.OperationalError as e:
        logger.error(f"[ERROR] Database connection error: {str(e)}")
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Database connection failed"
        )
    except psycopg2.ProgrammingError as e:
        logger.error(f"[ERROR] Database query error: {str(e)}")
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail=f"Database query failed: {str(e)}"
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
            detail="An unexpected error occurred"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info(f"[INFO] Database connection closed for timesheet entry creation")

@router.post("/api/v1/timesheet/approve_timesheet/")
async def approve_timesheet(
    entry_id: int = Form(..., description="Timesheet entry ID to approve/reject"),
    action: ApprovalAction = Form(..., description="Action to perform: APPROVE or REJECT"),
    rejection_reason: Optional[str] = Form(None, description="Reason for rejection (required if action is REJECT)"),
    current_user: dict = Depends(verify_token),
):
    """
    Approve or reject a timesheet entry (Admin only)
    """
    logger.info(f"[INFO] Starting timesheet approval/rejection for entry_id: {entry_id}, action: {action}, by user: {current_user['user_code']}")
    
    conn = None
    cursor = None

    try:
        # Step 1: Validate approver permissions (Admin, Team Lead, or Super Approver)
        user_code = current_user['user_code']
        logger.info(f"[INFO] Validating approver permissions for user: {user_code}")
        
        conn = connect_to_psql(host, port, username, password, database_name, schema_name)
        cursor = conn.cursor()
        
        # Check user designation and team information
        cursor.execute("""
            SELECT 
                um.designation_name,
                um.team_code,
                tm.team_lead,
                tm.reporter
            FROM sts_new.user_master um
            LEFT JOIN sts_new.team_master tm ON um.team_code = tm.team_code
            WHERE um.user_code = %s AND um.is_inactive = false
        """, (user_code,))
        
        user_result = cursor.fetchone()
        if not user_result:
            raise HTTPException(
                status_code=HTTPStatus.FORBIDDEN,
                detail="User not found or inactive"
            )
        
        designation_name = user_result[0]
        approver_team_code = user_result[1]
        approver_team_lead = user_result[2]
        approver_reporter = user_result[3]
        
        if not designation_name:
            raise HTTPException(
                status_code=HTTPStatus.FORBIDDEN,
                detail="User does not have a valid designation. Only Team Leads, Admins, or Super Approvers can approve/reject timesheets."
            )
        
        # Check if user is admin, team lead, or reporter (super approver)
        designation_normalized = designation_name.strip().lower()
        approver_is_admin = designation_normalized in allowed_admin_designations
        approver_is_reporter = (user_code == approver_reporter)
        
        # Note: Team Lead check will be done later when we know the timesheet owner's team
        
        if not (approver_is_admin or approver_is_reporter):
            # Will check team lead status later based on timesheet owner's team
            logger.info(f"[INFO] User {user_code} is not an admin or reporter (super approver) - will check team lead status later")
        
        logger.info(f"[INFO] User {user_code} validation complete - proceeding with approval/rejection")
        
        # Step 2: Validate rejection_reason if action is REJECT
        if action == ApprovalAction.REJECT:
            if not rejection_reason:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Rejection reason is required when rejecting a timesheet entry. Please provide a rejection_reason."
                )
            # Validate rejection_reason is not empty or just whitespace
            rejection_reason_trimmed = rejection_reason.strip() if rejection_reason else ""
            if not rejection_reason_trimmed:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Rejection reason cannot be empty. Please provide a valid reason for rejection."
                )
            # Store trimmed value for use later
            rejection_reason = rejection_reason_trimmed
        
        # Step 3: Validate timesheet entry exists and get current data
        cursor.execute("""
            SELECT 
                id, user_code, entry_date, approval_status,
                task_code, epic_code, activity_code, ticket_code,
                actual_hours_worked, travel_time, waiting_time, total_hours
            FROM sts_ts.timesheet_entry
            WHERE id = %s
        """, (entry_id,))
        
        entry_result = cursor.fetchone()
        if not entry_result:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND,
                detail=f"Timesheet entry with ID {entry_id} does not exist"
            )
        
        entry_user_code = entry_result[1]
        entry_date = entry_result[2]
        current_status = entry_result[3]
        entry_task_code = entry_result[4]
        entry_epic_code = entry_result[5]
        entry_activity_code = entry_result[6]
        entry_ticket_code = entry_result[7]
        actual_hours_worked = entry_result[8]
        travel_time = entry_result[9]
        waiting_time = entry_result[10]
        total_hours = entry_result[11]
        
        # Step 4: Check hierarchical approval permissions
        # Get timesheet owner's designation and team information
        cursor.execute("""
            SELECT 
                um.designation_name, 
                um.team_code,
                tm.team_lead,
                tm.reporter
            FROM sts_new.user_master um
            LEFT JOIN sts_new.team_master tm ON um.team_code = tm.team_code
            WHERE um.user_code = %s AND um.is_inactive = false
        """, (entry_user_code,))
        
        owner_result = cursor.fetchone()
        if not owner_result:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND,
                detail=f"Timesheet owner '{entry_user_code}' not found or inactive"
            )
        
        owner_designation = owner_result[0]
        owner_team_code = owner_result[1]
        team_lead = owner_result[2]
        reporter_code = owner_result[3]
        
        # Check if timesheet owner is an admin
        owner_is_admin = False
        if owner_designation:
            owner_designation_normalized = owner_designation.strip().lower()
            owner_is_admin = owner_designation_normalized in allowed_admin_designations
        
        # If owner is admin, reporter (super approver) must be configured
        if owner_is_admin and not reporter_code:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Reporter (super approver) is not configured for team '{owner_team_code}'. Please configure reporter in team_master before approving admin timesheets."
            )
        
        # Validate approval permissions based on hierarchy
        approver_is_admin = designation_normalized in allowed_admin_designations
        approver_is_team_lead = (team_lead and user_code == team_lead)
        approver_is_reporter = (reporter_code and user_code == reporter_code)
        
        if owner_is_admin:
            # Admin's timesheet → Only reporter (super approver) can approve
            if not approver_is_reporter:
                raise HTTPException(
                    status_code=HTTPStatus.FORBIDDEN,
                    detail=f"Admin timesheets can only be approved by the reporter (super approver) ({reporter_code}). You ({user_code}) are not authorized to approve this timesheet."
                )
            logger.info(f"[INFO] Admin timesheet - approved by reporter (super approver) {user_code}")
        else:
            # Regular employee's timesheet → Team Lead or Admin can approve
            if not (approver_is_team_lead or approver_is_admin):
                raise HTTPException(
                    status_code=HTTPStatus.FORBIDDEN,
                    detail=f"Regular employee timesheets can only be approved by Team Lead ({team_lead}) or Admins. You ({user_code}) are not authorized to approve this timesheet."
                )
            logger.info(f"[INFO] Regular employee timesheet - approved by {'Team Lead' if approver_is_team_lead else 'Admin'} {user_code}")
        
        # Step 5: Check if admin is trying to approve their own timesheet (only for regular employees)
        is_self_approval = (user_code == entry_user_code)
        if is_self_approval and not owner_is_admin:
            # Regular employees cannot approve their own timesheets
            raise HTTPException(
                status_code=HTTPStatus.FORBIDDEN,
                detail="You cannot approve your own timesheet. Please have your Team Lead or an Admin approve it."
            )
        elif is_self_approval and owner_is_admin:
            # Admins can self-approve only if they are the reporter (super approver)
            if not approver_is_reporter:
                raise HTTPException(
                    status_code=HTTPStatus.FORBIDDEN,
                    detail=f"Admin timesheets can only be approved by the reporter (super approver) ({reporter_code}). Self-approval is not allowed."
                )
            logger.info(f"[INFO] Reporter (super approver) {user_code} is self-approving their own timesheet entry {entry_id}")
        
        # Step 6: Validate entry is in SUBMITTED status (can only approve/reject SUBMITTED entries)
        if current_status != 'SUBMITTED':
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Timesheet entry is already {current_status}. Only SUBMITTED entries can be approved or rejected."
            )
        
        # Step 7: Update timesheet_entry table
        current_time = get_current_time_ist()
        new_status = 'APPROVED' if action == ApprovalAction.APPROVE else 'REJECTED'
        
        if action == ApprovalAction.APPROVE:
            update_query = """
                UPDATE sts_ts.timesheet_entry
                SET 
                    approval_status = %s,
                    approved_by = %s,
                    approved_at = %s,
                    rejected_by = NULL,
                    rejected_at = NULL,
                    rejection_reason = NULL,
                    submitted_by = NULL,
                    submitted_at = NULL,
                    updated_by = %s,
                    updated_at = %s
                WHERE id = %s
                RETURNING id
            """
            cursor.execute(update_query, (
                new_status, user_code, current_time, user_code, current_time, entry_id
            ))
        else:  # REJECT
            update_query = """
                UPDATE sts_ts.timesheet_entry
                SET 
                    approval_status = %s,
                    rejected_by = %s,
                    rejected_at = %s,
                    rejection_reason = %s,
                    approved_by = NULL,
                    approved_at = NULL,
                    submitted_by = NULL,
                    submitted_at = NULL,
                    updated_by = %s,
                    updated_at = %s
                WHERE id = %s
                RETURNING id
            """
            cursor.execute(update_query, (
                new_status, user_code, current_time, rejection_reason, 
                user_code, current_time, entry_id
            ))
        
        updated_entry = cursor.fetchone()
        if not updated_entry:
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to update timesheet entry"
            )
        
        # Step 8: Insert into approval history
        hist_insert_query = """
            INSERT INTO sts_ts.timesheet_approval_hist (
                entry_id, approval_status, status_reason,
                entry_user_code, entry_date,
                task_code, epic_code, activity_code, ticket_code,
                actual_hours_worked, travel_time, waiting_time, total_hours,
                submitted_by, submitted_at,
                approved_by, approved_at, rejected_by, rejected_at,
                created_by, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) RETURNING id
        """
        
        # Get submitted_by and submitted_at from current entry (since it was SUBMITTED)
        cursor.execute("""
            SELECT submitted_by, submitted_at
            FROM sts_ts.timesheet_entry
            WHERE id = %s
        """, (entry_id,))
        submitted_data = cursor.fetchone()
        submitted_by_val = submitted_data[0] if submitted_data else None
        submitted_at_val = submitted_data[1] if submitted_data else None
        
        approved_by_val = user_code if action == ApprovalAction.APPROVE else None
        approved_at_val = current_time if action == ApprovalAction.APPROVE else None
        rejected_by_val = user_code if action == ApprovalAction.REJECT else None
        rejected_at_val = current_time if action == ApprovalAction.REJECT else None
        # Add note in status_reason if self-approval
        # For rejections, status_reason contains the rejection reason
        if action == ApprovalAction.APPROVE and is_self_approval:
            status_reason_val = f"Self-approved by super approver" if owner_is_admin else "Self-approved by admin"
        elif action == ApprovalAction.REJECT:
            status_reason_val = rejection_reason  # Store rejection reason in status_reason
        else:
            status_reason_val = None
        
        cursor.execute(hist_insert_query, (
            entry_id, new_status, status_reason_val,
            entry_user_code, entry_date,
            entry_task_code, entry_epic_code, entry_activity_code, entry_ticket_code,  # Snapshot of parent references
            actual_hours_worked, travel_time, waiting_time, total_hours,
            submitted_by_val, submitted_at_val,
            approved_by_val, approved_at_val, rejected_by_val, rejected_at_val,
            user_code, current_time
        ))
        
        hist_id = cursor.fetchone()[0]
        
        # Step 9: Fetch approver/rejector name for response
        cursor.execute("""
            SELECT user_name 
            FROM sts_new.user_master 
            WHERE user_code = %s
        """, (user_code,))
        
        approver_result = cursor.fetchone()
        approver_name = approver_result[0] if approver_result else None
        
        # Step 10: Commit transaction
        conn.commit()
        approver_role = "super approver" if owner_is_admin else ("team lead" if approver_is_team_lead else "admin")
        logger.info(f"[INFO] Successfully {action.value.lower()}d timesheet entry {entry_id} by {approver_role} {user_code}")
        
        action_message = "approved" if action == ApprovalAction.APPROVE else "rejected"
        
        # Build response data based on action
        response_data = {
            "entry_id": entry_id,
            "approval_status": new_status,
            "action": action.value,
            "history_id": hist_id
        }
        
        if action == ApprovalAction.APPROVE:
            response_data["approved_by"] = user_code
            response_data["approved_by_name"] = approver_name
            response_data["approved_at"] = str(current_time)
            response_data["is_self_approval"] = is_self_approval
            response_data["status_reason"] = status_reason_val  # Include status_reason (e.g., "Self-approved by admin")
        else:
            response_data["rejected_by"] = user_code
            response_data["rejected_by_name"] = approver_name
            response_data["rejected_at"] = str(current_time)
            response_data["rejection_reason"] = rejection_reason  # From timesheet_entry table for backward compatibility
            response_data["status_reason"] = status_reason_val  # Include status_reason (from approval history)
        
        return {
            "Status_Flag": True,
            "Status_Description": f"Timesheet entry {action_message} successfully",
            "Status_Code": HTTPStatus.OK.value,
            "Status_Message": HTTPStatus.OK.phrase,
            "Response_Data": response_data
        }

    except psycopg2.IntegrityError as e:
        logger.error(f"[ERROR] Database integrity error: {str(e)}")
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=f"Data integrity violation: {str(e)}"
        )
    except psycopg2.OperationalError as e:
        logger.error(f"[ERROR] Database connection error: {str(e)}")
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Database connection failed"
        )
    except psycopg2.ProgrammingError as e:
        logger.error(f"[ERROR] Database query error: {str(e)}")
        logger.error(f"[ERROR] Full traceback: {traceback.format_exc()}")
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail=f"Database query failed: {str(e)}"
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
            detail="An unexpected error occurred"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info(f"[INFO] Database connection closed for timesheet approval/rejection")


@router.post("/api/v1/timesheet/submit_timesheet/")
async def submit_timesheet(
    entry_id: int = Form(..., description="Timesheet entry ID to submit"),
    current_user: dict = Depends(verify_token),
):
    """
    Submit a timesheet entry (DRAFT → SUBMITTED)
    Only the user who created the timesheet entry can submit it
    """
    logger.info(f"[INFO] Starting timesheet submission for entry_id: {entry_id}, by user: {current_user['user_code']}")
    
    conn = None
    cursor = None

    try:
        # Step 1: Establish database connection
        logger.info(f"[INFO] Establishing database connection for timesheet submission")
        conn = connect_to_psql(host, port, username, password, database_name, schema_name)
        cursor = conn.cursor()
        logger.info(f"[INFO] Database connection established successfully")

        # Step 2: Validate timesheet entry exists and get current data
        cursor.execute("""
            SELECT 
                id, user_code, entry_date, approval_status,
                task_code, epic_code, activity_code, ticket_code,
                actual_hours_worked, travel_time, waiting_time, total_hours
            FROM sts_ts.timesheet_entry
            WHERE id = %s
        """, (entry_id,))
        
        entry_result = cursor.fetchone()
        if not entry_result:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND,
                detail=f"Timesheet entry with ID {entry_id} does not exist"
            )
        
        entry_user_code = entry_result[1]
        entry_date = entry_result[2]
        current_status = entry_result[3]
        entry_task_code = entry_result[4]
        entry_epic_code = entry_result[5]
        entry_activity_code = entry_result[6]
        entry_ticket_code = entry_result[7]
        actual_hours_worked = entry_result[8]
        travel_time = entry_result[9]
        waiting_time = entry_result[10]
        total_hours = entry_result[11]
        
        # Step 3: Validate that the current user is the owner of the timesheet entry
        user_code = current_user['user_code']
        if user_code != entry_user_code:
            raise HTTPException(
                status_code=HTTPStatus.FORBIDDEN,
                detail=f"Only the owner of the timesheet entry can submit it. Entry belongs to {entry_user_code}, but you are {user_code}."
            )
        
        # Step 4: Validate entry is in DRAFT status (can only submit DRAFT entries)
        if current_status != 'DRAFT':
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Timesheet entry is already {current_status}. Only DRAFT entries can be submitted."
            )
        
        # Step 5: Validate all required fields are present before submission
        # Required fields for submission: entry_date, (task_code OR activity_code OR ticket_code), 
        # actual_hours_worked, description
        # For task entries: epic_code and work_location are required
        # For activity entries: epic_code should be NULL, work_location is optional (can be NULL), task_type_code should be NULL
        # For ticket entries: epic_code should be NULL, work_location is optional, task_type_code defaults to TT012 (Support)
        cursor.execute("""
            SELECT 
                entry_date, task_code, epic_code, activity_code, ticket_code,
                actual_hours_worked, work_location, description, task_type_code
            FROM sts_ts.timesheet_entry
            WHERE id = %s
        """, (entry_id,))
        
        validation_result = cursor.fetchone()
        if not validation_result:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND,
                detail=f"Timesheet entry with ID {entry_id} does not exist"
            )
        
        val_entry_date, val_task_code, val_epic_code, val_activity_code, val_ticket_code, \
        val_actual_hours, val_work_location, val_description, val_task_type_code = validation_result
        
        missing_fields = []
        if not val_entry_date:
            missing_fields.append("entry_date")
        
        # Validate that exactly one of task_code, activity_code, or ticket_code is provided
        provided_codes = [code for code in [val_task_code, val_activity_code, val_ticket_code] if code is not None]
        if len(provided_codes) == 0:
            missing_fields.append("task_code OR activity_code OR ticket_code (exactly one required)")
        elif len(provided_codes) > 1:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="Timesheet entry cannot have multiple parent codes (task_code, activity_code, ticket_code). Please fix the entry before submission."
            )
        elif val_task_code:
            # Task entry: epic_code and work_location are required
            if not val_epic_code:
                missing_fields.append("epic_code (required when task_code is provided)")
            if not val_work_location:
                missing_fields.append("work_location (required for task entries)")
        elif val_activity_code:
            # Activity entry: epic_code should be NULL, task_type_code should be NULL, work_location is optional, description is optional
            if val_epic_code:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Timesheet entry with activity_code cannot have epic_code. Please fix the entry before submission."
                )
            if val_task_type_code:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Timesheet entry with activity_code cannot have task_type_code. Activities don't use task types. Please fix the entry before submission."
                )
            # work_location and description are optional for activities (can be NULL)
        elif val_ticket_code:
            # Ticket entry: epic_code should be NULL, work_location is optional, task_type_code defaults to TT012 (Support)
            if val_epic_code:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Timesheet entry with ticket_code cannot have epic_code. Tickets don't belong to epics. Please fix the entry before submission."
                )
            # work_location and description are optional for tickets (can be NULL)
        
        if not val_actual_hours or val_actual_hours <= 0:
            missing_fields.append("actual_hours_worked (must be > 0)")
        
        # Description is required for task entries, optional for activity and ticket entries
        if val_task_code:
            if not val_description or not val_description.strip():
                missing_fields.append("description (required for task entries)")
        # For activity and ticket entries, description is optional (not checked)
        
        if missing_fields:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Cannot submit timesheet entry. Missing required fields: {', '.join(missing_fields)}. Please complete all required fields before submitting."
            )
        
        # Step 6: Update timesheet_entry table (DRAFT → SUBMITTED)
        current_time = get_current_time_ist()
        
        update_query = """
            UPDATE sts_ts.timesheet_entry
            SET 
                approval_status = 'SUBMITTED',
                submitted_by = %s,
                submitted_at = %s,
                updated_by = %s,
                updated_at = %s
            WHERE id = %s
            RETURNING id
        """
        cursor.execute(update_query, (
            user_code, current_time, user_code, current_time, entry_id
        ))
        
        updated_entry = cursor.fetchone()
        if not updated_entry:
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to update timesheet entry"
            )
        
        # Step 7: Insert into approval history
        hist_insert_query = """
            INSERT INTO sts_ts.timesheet_approval_hist (
                entry_id, approval_status, status_reason,
                entry_user_code, entry_date,
                task_code, epic_code, activity_code, ticket_code,
                actual_hours_worked, travel_time, waiting_time, total_hours,
                submitted_by, submitted_at,
                approved_by, approved_at, rejected_by, rejected_at,
                created_by, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) RETURNING id
        """
        
        cursor.execute(hist_insert_query, (
            entry_id, 'SUBMITTED', None,  # status_reason (no reason for submission)
            entry_user_code, entry_date,
            entry_task_code, entry_epic_code, entry_activity_code, entry_ticket_code,  # Snapshot of parent references
            actual_hours_worked, travel_time, waiting_time, total_hours,
            user_code, current_time,  # submitted_by, submitted_at
            None, None,  # approved_by, approved_at
            None, None,  # rejected_by, rejected_at
            user_code, current_time  # created_by, created_at
        ))
        
        hist_id = cursor.fetchone()[0]
        
        # Step 8: Commit transaction
        conn.commit()
        logger.info(f"[INFO] Successfully submitted timesheet entry {entry_id} by user {user_code}")
        
        # Build response data
        response_data = {
            "entry_id": entry_id,
            "approval_status": "SUBMITTED",
            "submitted_by": user_code,
            "submitted_at": str(current_time),
            "history_id": hist_id
        }
        
        return {
            "Status_Flag": True,
            "Status_Description": "Timesheet entry submitted successfully",
            "Status_Code": HTTPStatus.OK.value,
            "Status_Message": HTTPStatus.OK.phrase,
            "Response_Data": response_data
        }

    except HTTPException:
        # Re-raise HTTP exceptions
        if conn:
            conn.rollback()
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
        if conn:
            conn.close()
        logger.info(f"[INFO] Database connection closed for timesheet submission")

