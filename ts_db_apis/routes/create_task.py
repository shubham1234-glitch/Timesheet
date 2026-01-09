# routes/create_task.py

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
upload_dir = config.get('upload_dir', 'uploads')
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

# Work Mode Enum - Valid values (CHECK constraint: REMOTE, ON_SITE, OFFICE)
class WorkMode(str, Enum):
    REMOTE = "REMOTE"
    ON_SITE = "ON_SITE"
    OFFICE = "OFFICE"

# Status Code Enum - Valid values for tasks
class StatusCode(str, Enum):
    NOT_YET_STARTED = "STS001"  # To Do / Not Yet Started
    IN_PROGRESS = "STS007"      # In Progress
    COMPLETED = "STS002"        # Completed
    CANCELLED = "STS010"        # Cancelled

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


@router.post("/api/v1/timesheet/create_task")
async def create_task(
    task_title: str = Form(...,description="Title of the task"),
    task_desc: Optional[str] = Form(default="", description="Detailed description of the task (optional)"),
    epic_code: int = Form(..., description="Epic ID (integer)"),
    assignee: Optional[str] = Form(None, description="User code of the person assigned to the task (optional)"),
    assigned_team_code: Optional[str] = Form(None, description="Team code for the task (optional - will be derived from assignee if assignee is provided)"),
    reporter: Optional[str] = Form(None, description="User code of the person reporting the task (optional - will be auto-determined if not provided)"),
    status_code: StatusCode = Form(default=StatusCode.NOT_YET_STARTED, description="Current status of the task (default: STS001 - Not Yet Started, valid codes: STS001, STS007, STS002, STS010)"),
    priority_code: int = Form(..., description="Priority level of the task"),
    task_type_code: TaskTypeCode = Form(..., description="Task type code (TT001-TT012) - required"),
    work_mode: Optional[WorkMode] = Form(None, description="Work mode of the task (REMOTE, ON_SITE, OFFICE) - optional"),
    start_date: Optional[str] = Form(None, description="Start date in DD-MM-YYYY or YYYY-MM-DD format (optional)"),
    due_date: Optional[str] = Form(None, description="Due date in DD-MM-YYYY or YYYY-MM-DD format (optional)"),
    estimated_hours: float = Form(..., description="Estimated hours to complete the task"),
    max_hours: Optional[float] = Form(default=None, description="Maximum hours allowed for the task (optional - defaults to estimated_hours if not provided)"),
    attachments: List[UploadFile] = File(default=[], description="File attachments for the task"),
    current_user: dict = Depends(verify_token),
):
    """
    Create a new task with optional file attachments
    """
    logger.info(f"[INFO] Starting task creation for task_title: {task_title}, reporter: {reporter}, user: {current_user['user_code']}")
    
    conn = None
    cursor = None

    try:

        logger.info(f"[INFO] Establishing database connection for task creation")
        conn = connect_to_psql(host, port, username, password, database_name, schema_name)
        cursor = conn.cursor()
        logger.info(f"[INFO] Database connection established successfully")       

        # Step 1: Set default status if not provided
        if not status_code:
            status_code = StatusCode.NOT_YET_STARTED
        
        # Convert enum to string value
        status_code_str = status_code.value if isinstance(status_code, StatusCode) else str(status_code).upper()
        
        # Step 1.1: Validate Status code exists (only allowed statuses for tasks: STS001, STS007, STS002, STS010)
        # Reject "On Hold" (STS005) - use "Cancelled" (STS010) instead
        if status_code_str == 'STS005':
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="Status code 'STS005' (On Hold) is not allowed. Please use 'STS010' (Cancelled) instead."
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
                detail=f"Status code '{status_code_str}' is not allowed for tasks. Allowed values are: STS001 (Not Yet Started), STS007 (In Progress), STS002 (Completed), STS010 (Cancelled)"
            )
        
        cursor.execute("""
            SELECT status_desc FROM sts_new.status_master 
            WHERE status_code = %s 
            AND status_code IN ('STS001', 'STS007', 'STS002', 'STS010')
        """, (status_code_str,))
        status_result = cursor.fetchone()
        if not status_result:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Status code '{status_code_str}' does not exist or is not allowed for tasks. Valid status codes are: STS001 (Not Yet Started), STS007 (In Progress), STS002 (Completed), STS010 (Cancelled)"
            )
        
        # Step 1.2: Validate Work mode is one of the allowed values (REMOTE, ON_SITE, OFFICE) or NULL
        work_mode_str = None
        if work_mode is not None:
            allowed_work_modes = ['REMOTE', 'ON_SITE', 'OFFICE']
            work_mode_str = work_mode.value if isinstance(work_mode, WorkMode) else str(work_mode)
            if work_mode_str not in allowed_work_modes:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Invalid work_mode '{work_mode_str}'. Allowed values: REMOTE, ON_SITE, OFFICE, or NULL"
                )

        # Step 2: Validate epic exists and fetch epic dates
        cursor.execute("""
            SELECT id, start_date, due_date, closed_on, created_at::DATE, product_code
            FROM sts_ts.epics 
            WHERE id = %s
        """, (epic_code,))
        epic_result = cursor.fetchone()
        if not epic_result:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Epic with ID {epic_code} does not exist"
            )
        epic_id, epic_start_date, epic_due_date, epic_closed_on, epic_created_date, epic_product_code = epic_result

        # Step 3: Validate assignee exists (if provided)
        if assignee:
            cursor.execute("SELECT user_code FROM sts_new.user_master WHERE user_code = %s", (assignee,))
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Assignee with code {assignee} does not exist"
                )

        # Step 3.1: Validate and convert task_type_code (required field)
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

        # Step 4: Validate created_by user exists
        user_code = current_user['user_code']
        cursor.execute(
            "SELECT user_code FROM sts_new.user_master WHERE user_code = %s",
            (user_code,)
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Created by user with code {user_code} does not exist"
            )
        
        # Step 5: Set reporter = created_by (the person who creates the task)
        reporter = user_code
        logger.info(f"[INFO] Setting reporter to created_by: {reporter}")
        
        # Step 6: Parse dates if provided (supports both DD-MM-YYYY and YYYY-MM-DD formats)
        start_date_parsed = None
        due_date_parsed = None
        
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
        
        # Step 6.0.5: If status is "In Progress" (STS007) and start_date is not provided, set it to today
        current_time = get_current_time_ist()
        if status_code_str == 'STS007' and not start_date_parsed:
            start_date_parsed = current_time.date()
            logger.info(f"[INFO] Auto-setting start_date to {start_date_parsed} for task created with In Progress status")
        
        # Step 6.1: Validate task dates against epic dates
        # Task dates cannot be before epic creation date
        if start_date_parsed and start_date_parsed < epic_created_date:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Task start date ({start_date_parsed}) cannot be before the epic creation date ({epic_created_date}). Tasks can only be created for dates on or after the epic was created."
            )
        
        if due_date_parsed and due_date_parsed < epic_created_date:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Task due date ({due_date_parsed}) cannot be before the epic creation date ({epic_created_date}). Tasks can only be created for dates on or after the epic was created."
            )
        
        # Task start_date must be >= epic start_date
        if start_date_parsed and start_date_parsed < epic_start_date:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Task start date ({start_date_parsed}) cannot be before the epic start date ({epic_start_date})."
            )
        
        # Task due_date must be <= epic due_date (or closed_on if epic is completed)
        # Only validate if epic has a due_date or closed_on
        if epic_due_date or epic_closed_on:
            epic_end_date = epic_closed_on if epic_closed_on else epic_due_date
            if due_date_parsed and epic_end_date and due_date_parsed > epic_end_date:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Task due date ({due_date_parsed}) cannot be after the epic end date ({epic_end_date})."
                )
        
        # Task start_date must be <= task due_date
        if start_date_parsed and due_date_parsed and start_date_parsed > due_date_parsed:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Task start date ({start_date_parsed}) cannot be after the task due date ({due_date_parsed})."
            )
        

        # Step 7: Get assignee's team code
        # Priority: 1) If assignee provided, use assignee's team from user_master (overrides assigned_team_code)
        #           2) If no assignee but assigned_team_code provided, use assigned_team_code
        #           3) Otherwise, NULL
        final_assigned_team_code = None
        
        if assignee:
            # If assignee is provided, ALWAYS use assignee's team code from user_master (overrides any provided assigned_team_code)
            cursor.execute("SELECT team_code FROM sts_new.user_master WHERE user_code = %s", (assignee,))
            assignee_team_result = cursor.fetchone()
            if assignee_team_result:
                final_assigned_team_code = assignee_team_result[0]
                logger.info(f"[INFO] Using assignee {assignee}'s team code from user_master: {final_assigned_team_code}")
            else:
                logger.warning(f"[WARNING] Could not find team code for assignee {assignee} in user_master, assigned_team_code will be NULL")
        elif assigned_team_code:
            # If no assignee but assigned_team_code is provided, validate and use it
            assigned_team_code_clean = assigned_team_code.strip() if assigned_team_code else None
            if assigned_team_code_clean:
                # Validate team exists and is active
                cursor.execute("SELECT team_code FROM sts_new.team_master WHERE team_code = %s AND is_active = true", (assigned_team_code_clean,))
                team_result = cursor.fetchone()
                if team_result:
                    final_assigned_team_code = assigned_team_code_clean
                    logger.info(f"[INFO] Using provided assigned_team_code: {final_assigned_team_code}")
                else:
                    logger.warning(f"[WARNING] Provided assigned_team_code {assigned_team_code_clean} does not exist or is inactive, assigned_team_code will be NULL")
            else:
                logger.info(f"[INFO] assigned_team_code provided but empty, assigned_team_code will be NULL")
        else:
            logger.info(f"[INFO] No assignee and no assigned_team_code provided, assigned_team_code will be NULL")

        # Step 8: Insert task into sts_ts.tasks table
        # Note: current_time was already set in Step 6.0.5 if status was In Progress
        if 'current_time' not in locals():
            current_time = get_current_time_ist()
        created_by = current_user['user_code']  # Using the created by user code as the creator
        
        insert_query = """
            INSERT INTO sts_ts.tasks (
                task_title, description, epic_code, assignee, reporter, assigned_team_code,
                status_code, priority_code, task_type_code, work_mode,
                assigned_on, start_date, due_date, estimated_hours, max_hours,
                product_code, created_by, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) RETURNING id
        """
        
        # Handle task_desc - use empty string if None or not provided
        task_description = task_desc if task_desc else ""
        
        # If max_hours is not provided, default to estimated_hours
        final_max_hours = max_hours if max_hours is not None else estimated_hours
        
        cursor.execute(insert_query, (
            task_title, task_description, epic_code, assignee, reporter, final_assigned_team_code,
            status_code_str, priority_code, final_task_type_code, work_mode_str,
            current_time.date() if assignee else None, start_date_parsed, due_date_parsed, estimated_hours, final_max_hours,
            epic_product_code, created_by, current_time
        ))
        
        result = cursor.fetchone()
        id = result[0]

        # Step 9: Insert initial status history entry into sts_ts.task_hist table
        logger.info(f"[INFO] Creating initial status history entry for task_id: {id}")
        status_hist_query = """
            INSERT INTO sts_ts.task_hist (
                task_code, status_code, priority_code, task_type_code, status_reason, 
                product_code, assigned_team_code, assignee, reporter,
                work_mode, assigned_on, start_date, due_date, closed_on,
                estimated_hours, max_hours,
                cancelled_by, cancelled_at,
                created_by, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, %s
            ) RETURNING id
        """
        
        # Insert initial status history with full snapshot of task state
        cursor.execute(status_hist_query, (
            id,  # task_code (references tasks.id)
            status_code_str,
            priority_code,
            final_task_type_code,  # task_type_code
            None,  # status_reason (cancellation_reason uses status_reason when status is STS010)
            epic_product_code,  # product_code (from epic)
            final_assigned_team_code,  # assigned_team_code (from assignee's team or provided)
            assignee,
            reporter,
            work_mode_str,  # work_mode
            current_time.date() if assignee else None,  # assigned_on (only set if assignee is provided)
            start_date_parsed,
            due_date_parsed,
            None,  # closed_on
            estimated_hours,
            final_max_hours,
            None,  # cancelled_by
            None,  # cancelled_at
            created_by,
            current_time
        ))
        
        result = cursor.fetchone()
        if not result:
            raise Exception("Failed to insert status history entry - no ID returned")
        status_hist_seq = result[0]
        logger.info(f"[INFO] Successfully created status history entry with seq: {status_hist_seq}")
        
        
        # Step 9: Handle file attachments if provided
        attachment_data = []
        if attachments and len(attachments) > 0:
            logger.info(f"[INFO] Processing {len(attachments)} file attachments")
            
            
            # Create upload directory if it doesn't exist
            if not os.path.exists(upload_dir):
                logger.info(f"[INFO] Creating upload directory: {upload_dir}")
                os.makedirs(upload_dir, exist_ok=True)

                # Set proper permissions for web server access
                os.chmod(upload_dir, 0o755)  # Sets directory permissions to rwxr-xr-x (owner can read/write/execute, group and others can read/execute)
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
                        logger.info(f"[INFO] File saved to disk: {file_path}, size: {file_size} bytes")
                        
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
                                'TASK', %s, %s, %s, %s, %s, %s, %s, %s, %s
                            ) RETURNING id
                        """
                        
                        cursor.execute(attachment_query, (
                            str(id), file_path, file_url, file_name, file_type, file_size_display, "TASK ATTACHMENT", 
                            current_user['user_code'], current_time
                        ))
                        
                        attachment_id = cursor.fetchone()[0]
                        attachment_data.append({
                            "id": attachment_id,
                            "original_filename": attachment.filename,
                            "file_path": file_path,
                            "file_url": file_url,
                            "purpose": "TASK ATTACHMENT",
                            "file_size_bytes": file_size_bytes,
                            "file_size_display": file_size_display,
                        })
                        
                        logger.info(f"[INFO] Successfully saved attachment: {attachment.filename}")
                        
                    except Exception as e:
                        logger.error(f"[ERROR] Failed to save attachment {attachment.filename}: {str(e)}")
                        # ROLLBACK the entire transaction and return error
                        if conn:
                            conn.rollback()
                        raise HTTPException(
                            status_code=HTTPStatus.BAD_REQUEST,
                            detail=f"Failed to save attachment '{attachment.filename}'. The task creation has been rolled back. Error: {str(e)}"
                        )

        # Step 10: Commit transaction
        conn.commit()
        logger.info(f"[INFO] Successfully created task with ID: {id}")
        
        # Fetch team name if assigned_team_code exists
        assigned_team_name = None
        if final_assigned_team_code:
            cursor.execute("SELECT team_name FROM sts_new.team_master WHERE team_code = %s", (final_assigned_team_code,))
            team_name_result = cursor.fetchone()
            if team_name_result:
                assigned_team_name = team_name_result[0]
        
        return {
            "Status_Flag": True,
            "Status_Description": "Task created successfully",
            "Status_Code": HTTPStatus.CREATED.value,
            "Status_Message": HTTPStatus.CREATED.phrase,
            "Response_Data": {
                "id": id,
                "task_title": task_title,
                "task_description": task_desc,
                "epic_id": epic_code,
                "assignee": assignee,
                "assigned_team_code": final_assigned_team_code,
                "assigned_team_name": assigned_team_name,
                "reporter": reporter,
                "status_code": status_code_str,
                "priority_code": priority_code,
                "work_mode": work_mode,
                "start_date": start_date_parsed,
                "due_date": due_date_parsed,
                "estimated_hours": estimated_hours,
                "max_hours": final_max_hours,
                "attachments": attachment_data,
                "status_history": {
                    "id": status_hist_seq,
                    "status_code": status_code_str
                }
            }
        }

    except psycopg2.IntegrityError as e:
        logger.error(f"[ERROR] Database integrity error: {str(e)}")
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail="Data integrity violation. Please check your input data."
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
            detail="Database query failed"
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
        if conn:
            conn.close()
        logger.info(f"[INFO] Database connection closed for task creation")
