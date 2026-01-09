# routes/update_task_status.py

import sys
import os
sys.path.append('E:\projects\sts_prod_developement')

from fastapi import APIRouter, HTTPException, Form, Depends, Request
from auth.jwt_handler import verify_token
from http import HTTPStatus
from helper_functions import get_current_time_ist, parse_date
from typing import Optional
import psycopg2
from utils.connect_to_psql import connect_to_psql
from config import load_config
from utils.logger import get_logger
import traceback
from enum import Enum

config = load_config()
log_dir = config.get('log_dir')
log_file_name = config.get('log_file_name')

host = config.get('host')
port = config.get('port')
username = config.get('username')
password = config.get('password')
database_name = config.get('database_name')
schema_name = config.get('primary_schema')

router = APIRouter()

# Initialize logger for this module
logger = get_logger(log_file_name, log_dir=log_dir)

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

@router.put("/api/v1/timesheet/update_task/{task_id}")
async def update_task(
    task_id: int,
    status_code: Optional[StatusCode] = Form(None, description="New status code for the task (STS001, STS007, STS002, STS010)"),
    status_reason: str = Form(default="", description="Optional reason for the status change"),
    task_title: Optional[str] = Form(None, description="Title of the task"),
    task_description: Optional[str] = Form(None, description="Description of the task"),
    epic_code: Optional[int] = Form(None, description="Epic ID this task belongs to (changing this will change the product)"),
    start_date: Optional[str] = Form(None, description="Start date in DD-MM-YYYY or YYYY-MM-DD format"),
    due_date: Optional[str] = Form(None, description="Due date in DD-MM-YYYY or YYYY-MM-DD format"),
    closed_on: Optional[str] = Form(None, description="Closed on date (completion date) in DD-MM-YYYY or YYYY-MM-DD format"),
    priority_code: Optional[int] = Form(None, description="Priority level of the task"),
    task_type_code: Optional[TaskTypeCode] = Form(None, description="Task type code (TT001-TT012) - optional"),
    assignee: Optional[str] = Form(None, description="User code of the person assigned to the task"),
    reporter: Optional[str] = Form(None, description="User code of the person reporting the task"),
    assigned_team_code: Optional[str] = Form(None, description="Team code for the assigned team"),
    estimated_hours: Optional[float] = Form(None, description="Estimated hours for the task"),
    max_hours: Optional[float] = Form(None, description="Maximum hours allowed for the task"),
    is_billable: Optional[bool] = Form(None, description="Whether the task is billable"),
    work_mode: Optional[str] = Form(None, description="Work mode: REMOTE, ON_SITE, or OFFICE"),
    current_user: dict = Depends(verify_token),
):
    """
    Update task fields (status, dates, hours, priority, assignee, reporter, etc.) and create a history entry
    Updates both the tasks table and inserts a snapshot into task_hist
    At least one field must be provided for update
    All parameters are optional except task_id - you can update any combination of fields
    """
    logger.info(f"[INFO] Starting task update for task_id: {task_id}, user: {current_user['user_code']}")
    
    conn = None
    cursor = None

    try:
        logger.info(f"[INFO] Establishing database connection for task status update")
        conn = connect_to_psql(host, port, username, password, database_name, schema_name)
        cursor = conn.cursor()
        logger.info(f"[INFO] Database connection established successfully")

        # Step 1: Validate and fetch current task data
        cursor.execute("""
            SELECT 
                t.id, t.status_code, t.priority_code, t.task_type_code, t.assignee, t.reporter, t.assigned_team_code,
                t.assigned_on, t.start_date, t.due_date, t.closed_on,
                t.estimated_hours, t.max_hours, t.cancelled_by, t.cancelled_at, t.cancellation_reason,
                t.epic_code, t.work_mode
            FROM sts_ts.tasks t
            WHERE t.id = %s
        """, (task_id,))
        
        task_result = cursor.fetchone()
        if not task_result:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND,
                detail=f"Task with ID {task_id} does not exist"
            )
        
        # Extract current task data
        (current_id, current_status, current_priority_code, current_task_type_code, current_assignee, current_reporter, current_assigned_team_code,
         assigned_on, current_start_date, current_due_date, current_closed_on,
         current_estimated_hours, current_max_hours, cancelled_by, cancelled_at, cancellation_reason,
         current_epic_code, current_work_mode) = task_result

        # Step 2: Check if at least one field is being updated
        # Helper function to check if a value is actually provided (not None, not empty, not "string")
        def is_valid_field(value):
            if value is None:
                return False
            if isinstance(value, str):
                stripped = value.strip()
                return stripped and stripped.lower() != "string"
            return True
        
        # Helper function to check if a field was provided in the request (even if empty)
        def is_field_provided(value):
            return value is not None
        
        # Get epic_code parameter (from form) separately to avoid confusion
        epic_code_param = epic_code  # Parameter from form
        epic_code = current_epic_code  # Use current epic_code from task for rest of function
        
        # Check if at least one field is provided (even if empty, it means the field was sent in the request)
        if not any([
            status_code is not None,  # Check if status_code enum is provided
            is_field_provided(task_title),  # Check if provided (even if empty string)
            is_field_provided(task_description),  # Check if provided (even if empty string)
            epic_code_param is not None and epic_code_param > 0,  # Allow epic_code updates (epic_code_param > 0 to ignore 0 as placeholder)
            is_field_provided(start_date),  # Check if provided (even if empty string)
            is_field_provided(due_date),  # Check if provided (even if empty string)
            is_field_provided(closed_on),  # Check if provided (even if empty string)
            priority_code is not None and priority_code != 0,  # Ignore 0 as placeholder
            task_type_code is not None,
            is_field_provided(assignee),  # Check if provided (even if empty string)
            is_field_provided(reporter),  # Check if provided (even if empty string)
            is_field_provided(assigned_team_code),  # Check if provided (even if empty string)
            estimated_hours is not None,
            max_hours is not None,
            is_billable is not None,
            is_field_provided(work_mode)  # Check if provided (even if empty string)
        ]):
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="At least one field must be provided for update (status_code, task_title, description, epic_code, start_date, due_date, closed_on, priority_code, task_type_code, assignee, reporter, assigned_team_code, estimated_hours, max_hours, is_billable, work_mode)"
            )

        # Step 3: Get previous status description
        previous_status_desc = None
        if current_status:
            cursor.execute("""
                SELECT status_desc FROM sts_new.status_master 
                WHERE status_code = %s
            """, (current_status,))
            prev_status_result = cursor.fetchone()
            if prev_status_result:
                previous_status_desc = prev_status_result[0]

        # Step 4: Validate new status code if provided (only check if it exists in status_master)
        new_status_code = None
        status_desc = None
        if status_code:
            # Convert enum to string value
            if isinstance(status_code, StatusCode):
                status_code_str = status_code.value
            else:
                status_code_str = str(status_code).upper()
            
            # Validate status_code is one of the allowed enum values
            try:
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
            """, (status_code_str,))
            status_result = cursor.fetchone()
            if not status_result:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Status code '{status_code_str}' does not exist in status_master"
                )
            new_status_code = status_code_str
            status_desc = status_result[0]

        # Step 5: Validate dates if provided (skip if empty string or placeholder)
        new_start_date = current_start_date
        new_due_date = current_due_date
        new_closed_on = current_closed_on
        
        if start_date and start_date.strip() and start_date.lower() != "string":
            try:
                new_start_date = parse_date(start_date)
            except ValueError as e:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Start date error: {str(e)}"
                )
        
        if due_date and due_date.strip() and due_date.lower() != "string":
            try:
                new_due_date = parse_date(due_date)
            except ValueError as e:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Due date error: {str(e)}"
                )
        
        if closed_on and closed_on.strip() and closed_on.lower() != "string":
            try:
                new_closed_on = parse_date(closed_on)
            except ValueError as e:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Closed on date error: {str(e)}"
                )

        # Step 6: Validate assignee if provided (skip if empty string or placeholder)
        new_assignee = current_assignee
        if assignee and assignee.strip() and assignee.lower() != "string":
            cursor.execute("SELECT user_code FROM sts_new.user_master WHERE user_code = %s", (assignee,))
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Assignee with code {assignee} does not exist"
                )
            new_assignee = assignee

        # Step 7: Validate reporter if provided (skip if empty string or placeholder)
        new_reporter = current_reporter
        if reporter and reporter.strip() and reporter.lower() != "string":
            cursor.execute("SELECT user_code FROM sts_new.user_master WHERE user_code = %s", (reporter,))
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Reporter with code {reporter} does not exist"
                )
            new_reporter = reporter

        # Step 8: Validate priority_code if provided (skip if 0 or invalid)
        new_priority_code = current_priority_code
        if priority_code is not None and priority_code != 0:
            cursor.execute("SELECT priority_code FROM sts_new.tkt_priority_master WHERE priority_code = %s", (priority_code,))
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Priority code {priority_code} does not exist"
                )
            new_priority_code = priority_code

        # Step 8.0.5: Validate and convert task_type_code if provided
        new_task_type_code = current_task_type_code
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
            new_task_type_code = task_type_code_str

        # Step 8.1: Validate estimated_hours if provided
        new_estimated_hours = current_estimated_hours
        if estimated_hours is not None:
            if estimated_hours < 0:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Estimated hours cannot be negative"
                )
            new_estimated_hours = estimated_hours

        # Step 8.3: Validate max_hours if provided
        new_max_hours = current_max_hours
        if max_hours is not None:
            if max_hours < 0:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Max hours cannot be negative"
                )
            if estimated_hours is not None and max_hours < new_estimated_hours:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Max hours cannot be less than estimated hours"
                )
            new_max_hours = max_hours

        # Step 8.4: Validate work_mode if provided
        new_work_mode = current_work_mode  # Initialize with current value from database
        if is_valid_field(work_mode):
            # Validate work_mode is one of the allowed values (REMOTE, ON_SITE, OFFICE)
            allowed_work_modes = ['REMOTE', 'ON_SITE', 'OFFICE']
            work_mode_str = work_mode.strip()
            if work_mode_str not in allowed_work_modes:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Invalid work_mode '{work_mode_str}'. Allowed values: REMOTE, ON_SITE, OFFICE"
                )
            new_work_mode = work_mode_str

        # Step 8.5: Validate epic_code if provided and fetch epic dates
        new_epic_code = current_epic_code  # Default to current epic_code
        epic_start_date = None
        epic_due_date = None
        epic_closed_on = None
        epic_created_date = None
        
        # Fetch epic dates - use new epic if epic_code_param is being updated, otherwise use current epic
        if epic_code_param is not None and epic_code_param > 0:
            # Epic is being updated - fetch new epic dates
            cursor.execute("""
                SELECT e.id, e.start_date, e.due_date, e.closed_on, e.created_at::DATE, e.product_code
                FROM sts_ts.epics e
                WHERE e.id = %s
            """, (epic_code_param,))
            epic_result = cursor.fetchone()
            if not epic_result:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Epic with ID {epic_code_param} does not exist"
                )
            new_epic_code, epic_start_date, epic_due_date, epic_closed_on, epic_created_date, epic_product_code = epic_result
            logger.info(f"[INFO] Epic code will be updated from {current_epic_code} to {new_epic_code}, product_code: {epic_product_code}")
        else:
            # Epic is not being updated - fetch current epic dates for validation
            if current_epic_code:
                cursor.execute("""
                    SELECT e.start_date, e.due_date, e.closed_on, e.created_at::DATE, e.product_code
                    FROM sts_ts.epics e
                    WHERE e.id = %s
                """, (current_epic_code,))
                epic_result = cursor.fetchone()
                if epic_result:
                    epic_start_date, epic_due_date, epic_closed_on, epic_created_date, epic_product_code = epic_result
                    # Ensure due_date is not accidentally set to start_date
                    if epic_due_date == epic_start_date and epic_due_date is not None:
                        logger.warning(f"[WARNING] Epic {current_epic_code} has due_date equal to start_date ({epic_due_date}). This might indicate a data issue.")

        # Step 9: Validate current user exists
        cursor.execute("SELECT user_code FROM sts_new.user_master WHERE user_code = %s", (current_user['user_code'],))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"User with code {current_user['user_code']} does not exist"
            )

        # Step 10: Prepare update data
        current_time = get_current_time_ist()
        updated_by = current_user['user_code']
        
        # If status is "In Progress" (STS007), set start_date to current date if not already set
        # If start_date is not provided in the request and task is moving to In Progress, set it to today
        if new_status_code == 'STS007':
            # Check if start_date was provided in the request
            start_date_provided = start_date and start_date.strip() and start_date.lower() != "string"
            if not start_date_provided:
                # No start_date provided in request - set to today when moving to In Progress
                # This will update even if task already has a start_date (user wants current date when moving to In Progress)
                new_start_date = current_time.date()
                logger.info(f"[INFO] Setting start_date to {new_start_date} for task {task_id} moved to In Progress (no start_date provided in request)")
            elif current_start_date is None:
                # Start_date was provided in request and task didn't have one - use the provided date
                logger.info(f"[INFO] Using provided start_date {new_start_date} for task {task_id} moved to In Progress")
        
        # If status is "Completed" (STS002), automatically set closed_on to current date
        if new_status_code == 'STS002':
            new_closed_on = current_time.date()
            logger.info(f"[INFO] Automatically setting closed_on to {new_closed_on} for completed task {task_id}")
        
        # Step 10.1: Validate task dates against epic dates (if epic dates are available)
        # Log epic dates for debugging
        epic_code_for_log = new_epic_code if (epic_code_param is not None and epic_code_param > 0) else current_epic_code
        if epic_code_for_log:
            logger.info(f"[INFO] Epic {epic_code_for_log} dates - start_date: {epic_start_date}, due_date: {epic_due_date}, closed_on: {epic_closed_on}")
        
        if epic_start_date and epic_created_date:
            # Task dates cannot be before epic creation date
            if new_start_date and new_start_date < epic_created_date:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Task start date ({new_start_date}) cannot be before the epic creation date ({epic_created_date}). Tasks can only be created for dates on or after the epic was created."
                )
            
            if new_due_date and new_due_date < epic_created_date:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Task due date ({new_due_date}) cannot be before the epic creation date ({epic_created_date}). Tasks can only be created for dates on or after the epic was created."
                )
            
            # Task start_date must be >= epic start_date
            if new_start_date and new_start_date < epic_start_date:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Task start date ({new_start_date}) cannot be before the epic start date ({epic_start_date})."
                )
            
            # Task due_date must be <= epic due_date (or closed_on if epic is completed)
            # Only validate if epic has a valid due_date or closed_on (not None, and not equal to start_date)
            if new_due_date:
                if epic_closed_on is not None:
                    # Epic is completed - use closed_on as end date
                    epic_end_date = epic_closed_on
                    if new_due_date > epic_end_date:
                        raise HTTPException(
                            status_code=HTTPStatus.BAD_REQUEST,
                            detail=f"Task due date ({new_due_date}) cannot be after the epic closed date ({epic_end_date})."
                        )
                elif epic_due_date is not None and epic_due_date != epic_start_date:
                    # Epic has a valid due_date (not None and not equal to start_date) - use it as end date
                    epic_end_date = epic_due_date
                    if new_due_date > epic_end_date:
                        raise HTTPException(
                            status_code=HTTPStatus.BAD_REQUEST,
                            detail=f"Task due date ({new_due_date}) cannot be after the epic due date ({epic_end_date})."
                        )
                else:
                    # Epic has no due_date, or due_date equals start_date (treat as no due_date)
                    # Log warning but allow the task due_date
                    if epic_due_date == epic_start_date:
                        logger.warning(f"[WARNING] Epic {epic_code_for_log} has due_date equal to start_date ({epic_start_date}). Treating as no due_date. Task due_date {new_due_date} will be allowed.")
                    else:
                        logger.warning(f"[WARNING] Epic {epic_code_for_log} has no due_date or closed_on. Task due_date {new_due_date} will be allowed without epic date validation.")
            
            # Task start_date must be <= task due_date
            if new_start_date and new_due_date and new_start_date > new_due_date:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Task start date ({new_start_date}) cannot be after the task due date ({new_due_date})."
                )

        # If status is "Cancelled/Blocked" (STS010), automatically set cancelled fields
        # If status changes away from STS010, clear cancelled fields
        # Note: cancellation_reason is stored in status_reason field, not a separate column
        new_cancelled_by = cancelled_by
        new_cancelled_at = cancelled_at
        if new_status_code == 'STS010':
            new_cancelled_by = updated_by
            new_cancelled_at = current_time.date()
            logger.info(f"[INFO] Setting cancelled fields for task {task_id}: cancelled_by={new_cancelled_by}, cancelled_at={new_cancelled_at}, reason in status_reason")
        elif current_status == 'STS010' and new_status_code and new_status_code != 'STS010':
            # Status is changing away from cancelled, clear cancelled fields
            new_cancelled_by = None
            new_cancelled_at = None
            logger.info(f"[INFO] Clearing cancelled fields for task {task_id} as status changes from STS010 to {new_status_code}")

        # Use new values or keep current values
        final_status_code = new_status_code if new_status_code else current_status

        # Step 11: Build dynamic UPDATE query
        update_fields = []
        update_params = []
        
        if new_status_code:
            update_fields.append("status_code = %s")
            update_params.append(new_status_code)
        
        if is_valid_field(task_title):
            update_fields.append("task_title = %s")
            update_params.append(task_title.strip())
        
        # Allow description to be updated even if empty (to clear it)
        if task_description is not None:
            update_fields.append("description = %s")
            update_params.append(task_description.strip() if task_description else None)
        
        if epic_code_param is not None and epic_code_param > 0:
            update_fields.append("epic_code = %s")
            update_params.append(new_epic_code)
            # Also update product_code when epic_code changes
            if epic_product_code:
                update_fields.append("product_code = %s")
                update_params.append(epic_product_code)
        
        # Update start_date if:
        # 1. start_date was explicitly provided in the request, OR
        # 2. Status is changing to In Progress (STS007) - this will include auto-set start_date
        if (start_date and start_date.strip() and start_date.lower() != "string") or (new_status_code == 'STS007'):
            update_fields.append("start_date = %s")
            update_params.append(new_start_date)
        
        if due_date and due_date.strip() and due_date.lower() != "string":
            update_fields.append("due_date = %s")
            update_params.append(new_due_date)
        
        # Always update closed_on when status is changed to Completed, or if user explicitly provided it
        if new_status_code == 'STS002' or (closed_on and closed_on.strip() and closed_on.lower() != "string"):
            update_fields.append("closed_on = %s")
            update_params.append(new_closed_on)
        
        if priority_code is not None and priority_code != 0:  # Ignore 0 as placeholder
            update_fields.append("priority_code = %s")
            update_params.append(new_priority_code)
        
        if task_type_code is not None:
            update_fields.append("task_type_code = %s")
            update_params.append(new_task_type_code)
        
        # Get assignee's team code when assignee changes
        new_assigned_team_code = current_assigned_team_code
        
        # Check if assignee is being explicitly cleared (empty string or None)
        assignee_being_cleared = False
        # Check if assignee field was provided (even if empty) - this means user wants to clear it
        # FastAPI Form fields: None = not provided, "" = provided but empty
        if assignee is not None:  # Field was provided (even if empty string)
            if not assignee or not str(assignee).strip() or str(assignee).lower() == "string":
                # Assignee is being explicitly cleared
                assignee_being_cleared = True
                if "assignee = %s" not in update_fields:
                    update_fields.append("assignee = %s")
                    update_params.append(None)
                new_assignee = None
                # Also clear assigned_on when assignee is cleared
                if "assigned_on = %s" not in update_fields:
                    update_fields.append("assigned_on = %s")
                    update_params.append(None)
        
        if assignee and assignee.strip() and assignee.lower() != "string" and not assignee_being_cleared:
            # Validate that assignee belongs to the task's assigned team
            # Get the team code that will be used for this task (either explicitly provided or from current task)
            task_team_code = None
            if assigned_team_code and assigned_team_code.strip() and assigned_team_code.lower() != "string":
                task_team_code = assigned_team_code.strip()
            else:
                task_team_code = current_assigned_team_code
            
            # Get assignee's team code
            cursor.execute("SELECT team_code FROM sts_new.user_master WHERE user_code = %s AND is_inactive = false", (new_assignee,))
            assignee_team_result = cursor.fetchone()
            if not assignee_team_result:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Assignee with code {new_assignee} does not exist or is inactive"
                )
            
            assignee_team_code = assignee_team_result[0]
            
            # Validate assignee belongs to the task's team
            if task_team_code and assignee_team_code != task_team_code:
                # Get team name for better error message
                cursor.execute("SELECT team_name FROM sts_new.team_master WHERE team_code = %s", (task_team_code,))
                task_team_result = cursor.fetchone()
                task_team_name = task_team_result[0] if task_team_result else task_team_code
                
                cursor.execute("SELECT team_name FROM sts_new.team_master WHERE team_code = %s", (assignee_team_code,))
                assignee_team_result_name = cursor.fetchone()
                assignee_team_name = assignee_team_result_name[0] if assignee_team_result_name else assignee_team_code
                
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Assignee {new_assignee} belongs to team '{assignee_team_name}' ({assignee_team_code}), but the task is assigned to team '{task_team_name}' ({task_team_code}). Assignee must belong to the task's assigned team."
                )
            
            update_fields.append("assignee = %s")
            update_params.append(new_assignee)
            # Update assigned_team_code when assignee changes (only if not explicitly provided)
            if not assigned_team_code or not assigned_team_code.strip():
                new_assigned_team_code = assignee_team_code
                update_fields.append("assigned_team_code = %s")
                update_params.append(new_assigned_team_code)
        
        # Update assigned_team_code if explicitly provided
        if assigned_team_code and assigned_team_code.strip() and assigned_team_code.lower() != "string":
            # Validate team code exists
            cursor.execute("SELECT team_code FROM sts_new.team_master WHERE team_code = %s AND is_active = true", (assigned_team_code.strip(),))
            team_result = cursor.fetchone()
            if team_result:
                new_assigned_team_code = assigned_team_code.strip()
                
                # If team is being changed, ALWAYS clear the assignee to NULL
                # Exception: If assignee is also being updated in the same request AND belongs to the new team, keep it
                # Handle None values in comparison - treat None and empty string as equivalent
                current_team_for_comparison = str(current_assigned_team_code).strip() if current_assigned_team_code else ""
                new_team_for_comparison = str(new_assigned_team_code).strip() if new_assigned_team_code else ""
                
                if new_team_for_comparison != current_team_for_comparison:
                    # Team is changing - ALWAYS clear assignee to NULL unless a valid assignee for new team is provided
                    logger.info(f"[INFO] Team changed from '{current_assigned_team_code}' to '{new_assigned_team_code}'. Setting assignee to NULL.")
                    
                    # Check if assignee is also being updated in this request (and it's not empty/cleared)
                    # Note: assignee_being_cleared might already be True from the assignee clearing section above
                    assignee_being_updated = assignee and assignee.strip() and assignee.lower() != "string" and not assignee_being_cleared
                    
                    logger.info(f"[DEBUG] Team change logic - assignee_being_cleared: {assignee_being_cleared}, assignee_being_updated: {assignee_being_updated}, assignee param: {assignee}")
                    
                    if assignee_being_updated:
                        # Assignee is being updated - validate that new assignee belongs to new team
                        cursor.execute("SELECT team_code FROM sts_new.user_master WHERE user_code = %s AND is_inactive = false", (new_assignee,))
                        new_assignee_team_result = cursor.fetchone()
                        if not new_assignee_team_result:
                            raise HTTPException(
                                status_code=HTTPStatus.BAD_REQUEST,
                                detail=f"Assignee {new_assignee} does not exist or is inactive"
                            )
                        
                        new_assignee_team_code = new_assignee_team_result[0]
                        if new_assignee_team_code != new_assigned_team_code:
                            # New assignee doesn't belong to new team - raise error
                            cursor.execute("SELECT team_name FROM sts_new.team_master WHERE team_code = %s", (new_assigned_team_code,))
                            task_team_result = cursor.fetchone()
                            task_team_name = task_team_result[0] if task_team_result else new_assigned_team_code
                            
                            cursor.execute("SELECT team_name FROM sts_new.team_master WHERE team_code = %s", (new_assignee_team_code,))
                            assignee_team_result_name = cursor.fetchone()
                            assignee_team_name = assignee_team_result_name[0] if assignee_team_result_name else new_assignee_team_code
                            
                            raise HTTPException(
                                status_code=HTTPStatus.BAD_REQUEST,
                                detail=f"Assignee {new_assignee} belongs to team '{assignee_team_name}' ({new_assignee_team_code}), but task is being assigned to team '{task_team_name}' ({new_assigned_team_code}). Assignee must belong to the selected team."
                            )
                        # If assignee belongs to new team, keep it (it will be set in the assignee update section above)
                        logger.info(f"[INFO] Assignee {new_assignee} belongs to new team {new_assigned_team_code}, keeping it.")
                    else:
                        # Assignee is NOT being updated (or is being cleared) - set it to NULL since team changed
                        logger.info(f"[INFO] Team changed, setting assignee to NULL (assignee not being updated or is being cleared).")
                        # Remove any existing assignee update from update_fields
                        if "assignee = %s" in update_fields:
                            idx = update_fields.index("assignee = %s")
                            old_param = update_params.pop(idx)
                            update_fields.pop(idx)
                            logger.info(f"[INFO] Removed existing assignee update (old param: {old_param})")
                        # Add assignee clearing (set to NULL)
                        update_fields.append("assignee = %s")
                        update_params.append(None)
                        new_assignee = None
                        assignee_being_cleared = True  # Mark as cleared
                        logger.info(f"[INFO] Added assignee = NULL to update_fields. Current update_fields: {update_fields}")
                        # Also clear assigned_on when assignee is cleared
                        if "assigned_on = %s" not in update_fields:
                            update_fields.append("assigned_on = %s")
                            update_params.append(None)
                            logger.info(f"[INFO] Added assigned_on = NULL to update_fields")
                
                # Check if already in update_fields (from assignee update above)
                if "assigned_team_code = %s" not in update_fields:
                    # Always add to update_fields if explicitly provided and valid
                    update_fields.append("assigned_team_code = %s")
                    update_params.append(new_assigned_team_code)
                else:
                    # Replace the existing value
                    idx = update_fields.index("assigned_team_code = %s")
                    update_params[idx] = new_assigned_team_code
            else:
                logger.warning(f"[WARNING] Invalid team_code provided: {assigned_team_code}, skipping team update")
                # If invalid team code provided, raise an error instead of silently skipping
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Invalid team_code provided: {assigned_team_code}. Team does not exist or is not active."
                )
        
        if reporter and reporter.strip() and reporter.lower() != "string":
            update_fields.append("reporter = %s")
            update_params.append(new_reporter)
        
        if estimated_hours is not None:
            update_fields.append("estimated_hours = %s")
            update_params.append(new_estimated_hours)
        
        if max_hours is not None:
            update_fields.append("max_hours = %s")
            update_params.append(new_max_hours)
        
        if is_billable is not None:
            update_fields.append("is_billable = %s")
            update_params.append(is_billable)
        
        if is_valid_field(work_mode):
            update_fields.append("work_mode = %s")
            update_params.append(new_work_mode)
        
        # If status is "Cancelled/Blocked" (STS010), update cancelled fields
        # If status changes away from STS010, clear cancelled fields (set to NULL)
        # Note: cancellation_reason is stored in tasks.cancellation_reason (for master table only)
        # In task_hist, we use status_reason instead
        if new_status_code == 'STS010':
            update_fields.append("cancelled_by = %s")
            update_params.append(new_cancelled_by)
            update_fields.append("cancelled_at = %s")
            update_params.append(new_cancelled_at)
            update_fields.append("cancellation_reason = %s")
            update_params.append(status_reason if status_reason else None)  # Store in tasks for backward compatibility
        elif current_status == 'STS010' and new_status_code and new_status_code != 'STS010':
            # Status is changing away from cancelled, clear cancelled fields
            update_fields.append("cancelled_by = %s")
            update_params.append(None)
            update_fields.append("cancelled_at = %s")
            update_params.append(None)
            update_fields.append("cancellation_reason = %s")
            update_params.append(None)
        
        # Always update audit fields
        update_fields.append("updated_by = %s")
        update_params.append(updated_by)
        update_fields.append("updated_at = %s")
        update_params.append(current_time)
        
        # Add WHERE clause parameter
        update_params.append(task_id)
        
        update_query = f"""
            UPDATE sts_ts.tasks
            SET {', '.join(update_fields)}
            WHERE id = %s
            RETURNING id
        """
        
        # Debug logging for assignee clearing
        if "assignee = %s" in update_fields:
            assignee_idx = update_fields.index("assignee = %s")
            assignee_param = update_params[assignee_idx] if assignee_idx < len(update_params) else "OUT_OF_RANGE"
            logger.info(f"[DEBUG] UPDATE query includes assignee = %s at index {assignee_idx}, param value: {assignee_param} (type: {type(assignee_param)})")
            logger.info(f"[DEBUG] Full UPDATE query: {update_query}")
            logger.info(f"[DEBUG] Update params (before WHERE): {update_params[:-1]}")
        
        cursor.execute(update_query, tuple(update_params))
        
        update_result = cursor.fetchone()
        if not update_result:
            raise Exception("Failed to update task - no ID returned")
        
        # Verify assignee was set correctly (especially when clearing to NULL)
        if "assignee = %s" in update_fields:
            assignee_idx = update_fields.index("assignee = %s")
            assignee_param = update_params[assignee_idx] if assignee_idx < len(update_params) else None
            if assignee_param is None:
                # Verify assignee is actually NULL in database
                cursor.execute("SELECT assignee FROM sts_ts.tasks WHERE id = %s", (task_id,))
                verify_result = cursor.fetchone()
                if verify_result:
                    db_assignee = verify_result[0]
                    if db_assignee is not None:
                        logger.warning(f"[WARNING] Assignee should be NULL but database shows: {db_assignee}")
                    else:
                        logger.info(f"[INFO] Verified: assignee is correctly set to NULL in database")
        
        logger.info(f"[INFO] Successfully updated task {task_id}")

        # Step 11.1: Get assignee's team code and epic's product_code for task history
        # IMPORTANT: Use new_assigned_team_code if it was explicitly set (team was updated)
        # Otherwise, use current_assigned_team_code, or fall back to assignee's team if assignee exists
        assignee_team_code = new_assigned_team_code if new_assigned_team_code else current_assigned_team_code
        final_assignee_for_hist = new_assignee if new_assignee else current_assignee
        
        # Only fall back to assignee's team if:
        # 1. There's an assignee, AND
        # 2. We don't have an explicit team code (neither new nor current)
        if final_assignee_for_hist and not assignee_team_code:
            cursor.execute("SELECT team_code FROM sts_new.user_master WHERE user_code = %s", (final_assignee_for_hist,))
            assignee_team_result = cursor.fetchone()
            if assignee_team_result:
                assignee_team_code = assignee_team_result[0]
                logger.info(f"[INFO] Assignee {final_assignee_for_hist} belongs to team {assignee_team_code}")
        
        # Log the final team code that will be saved to task_hist
        logger.info(f"[INFO] Team code for task_hist: {assignee_team_code} (new_assigned_team_code: {new_assigned_team_code}, current_assigned_team_code: {current_assigned_team_code})")
        
        # Get product_code from epic (use new epic if changed, otherwise current)
        final_epic_code_for_hist = new_epic_code if epic_code_param is not None and epic_code_param > 0 else current_epic_code
        final_product_code = epic_product_code
        if not final_product_code and final_epic_code_for_hist:
            cursor.execute("SELECT product_code FROM sts_ts.epics WHERE id = %s", (final_epic_code_for_hist,))
            product_result = cursor.fetchone()
            if product_result:
                final_product_code = product_result[0]

        # Step 12: Insert status history entry with full snapshot
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
        
        # Get cancelled_by, cancelled_at for history
        # If final status is STS010, use the cancelled values we set (or fetch if already set in DB)
        # If status is changing away from STS010, use None
        # Otherwise, use current values from task
        if final_status_code == 'STS010':
            # Status is STS010 - use the cancelled values we set, or fetch from DB if we didn't set them
            if new_cancelled_by is not None and new_cancelled_by != cancelled_by:
                # We just set these values in this transaction
                cancelled_by_hist = new_cancelled_by
                cancelled_at_hist = new_cancelled_at
            else:
                # Status is already STS010 and we're not changing it, use current values
                cancelled_by_hist = cancelled_by
                cancelled_at_hist = cancelled_at
        else:
            # Status is not STS010 - cancelled fields should be None
            cancelled_by_hist = None
            cancelled_at_hist = None
        
        # Ensure task_type_code is preserved in history - use last known value if current is NULL
        final_task_type_code_for_hist = new_task_type_code
        if not final_task_type_code_for_hist:
            # If we don't have a task_type_code, try to get it from the most recent history entry
            cursor.execute("""
                SELECT task_type_code 
                FROM sts_ts.task_hist 
                WHERE task_code = %s AND task_type_code IS NOT NULL 
                ORDER BY created_at DESC, id DESC 
                LIMIT 1
            """, (task_id,))
            hist_task_type_result = cursor.fetchone()
            if hist_task_type_result and hist_task_type_result[0]:
                final_task_type_code_for_hist = hist_task_type_result[0]
                logger.info(f"[INFO] Preserving task_type_code {final_task_type_code_for_hist} from history for task {task_id} in task_hist")
        
        cursor.execute(status_hist_query, (
            task_id,  # task_code (references tasks.id)
            final_status_code,  # Use final status code
            new_priority_code,  # Use updated priority
            final_task_type_code_for_hist,  # Use updated task_type_code, current, or last known from history
            status_reason if status_reason else None,  # status_reason (used for cancellation reason when status is STS010)
            final_product_code,  # product_code (from epic)
            assignee_team_code,  # assigned_team_code (from assignee's team)
            new_assignee if assignee_being_cleared or new_assignee is not None else current_assignee,  # Use updated assignee (even if None/cleared) or current
            new_reporter if new_reporter else current_reporter,  # Use updated reporter or current
            new_work_mode,  # Use updated work_mode if provided, otherwise current value
            assigned_on,
            new_start_date,  # Use updated start_date
            new_due_date,  # Use updated due_date
            new_closed_on,  # Use updated closed_on
            new_estimated_hours,  # Use updated estimated_hours if provided, otherwise current value
            new_max_hours,  # Use updated max_hours if provided, otherwise current value
            cancelled_by_hist,
            cancelled_at_hist,
            updated_by,  # created_by (user who made the change)
            current_time
        ))
        
        hist_result = cursor.fetchone()
        if not hist_result:
            raise Exception("Failed to insert status history entry - no ID returned")
        status_hist_id = hist_result[0]
        logger.info(f"[INFO] Successfully created status history entry with id: {status_hist_id}")

        # Step 13: Commit transaction
        conn.commit()
        logger.info(f"[INFO] Successfully updated task status for task_id: {task_id}")

        # Build response with updated fields
        final_epic_code = new_epic_code if (epic_code_param is not None and epic_code_param > 0) else current_epic_code
        
        response_data = {
            "task_id": task_id,
            "updated_by": updated_by,
            "updated_at": current_time.isoformat(),
            "status_history_id": status_hist_id,
            "epic_id": final_epic_code
        }
        
        if status_code:
            response_data["previous_status"] = current_status
            response_data["previous_status_description"] = previous_status_desc
            response_data["new_status"] = final_status_code
            response_data["status_description"] = status_desc
            response_data["status_reason"] = status_reason if status_reason else None
        
        if start_date or due_date or closed_on or (new_status_code == 'STS007' and new_start_date != current_start_date) or (new_status_code == 'STS002' and new_closed_on != current_closed_on):
            response_data["dates"] = {
                "start_date": new_start_date.isoformat() if new_start_date else None,
                "due_date": new_due_date.isoformat() if new_due_date else None,
                "closed_on": new_closed_on.isoformat() if new_closed_on else None
            }
        
        if priority_code is not None:
            response_data["priority_code"] = new_priority_code
        
        # Include assignee in response if it was updated (even if cleared to None)
        if is_field_provided(assignee) or assignee_being_cleared:
            response_data["assignee"] = new_assignee
            response_data["task_assignee"] = new_assignee  # Also include for compatibility
            response_data["task_assignee_name"] = None  # Will be null if cleared
        
        if reporter:
            response_data["reporter"] = new_reporter
        
        if is_valid_field(task_title):
            response_data["task_title"] = task_title.strip()
        
        if task_description is not None:
            response_data["description"] = task_description.strip() if task_description else None
        
        if is_valid_field(work_mode):
            response_data["work_mode"] = new_work_mode
        
        if estimated_hours is not None:
            response_data["estimated_hours"] = float(new_estimated_hours)
        
        if max_hours is not None:
            response_data["max_hours"] = float(new_max_hours)
        
        if is_billable is not None:
            response_data["is_billable"] = is_billable
        
        # Include team information in response if it was updated
        if is_field_provided(assigned_team_code):
            response_data["assigned_team_code"] = new_assigned_team_code
            response_data["task_assigned_team_code"] = new_assigned_team_code  # Also include for compatibility
            
            # Fetch team name for the response
            if new_assigned_team_code:
                cursor.execute("SELECT team_name FROM sts_new.team_master WHERE team_code = %s", (new_assigned_team_code,))
                team_name_result = cursor.fetchone()
                if team_name_result:
                    response_data["assigned_team_name"] = team_name_result[0]
                    response_data["task_assigned_team_name"] = team_name_result[0]  # Also include for compatibility
                else:
                    response_data["assigned_team_name"] = None
                    response_data["task_assigned_team_name"] = None
            else:
                response_data["assigned_team_name"] = None
                response_data["task_assigned_team_name"] = None

        return {
            "Status_Flag": True,
            "Status_Description": "Task updated successfully",
            "Status_Code": HTTPStatus.OK.value,
            "Status_Message": HTTPStatus.OK.phrase,
            "Response_Data": response_data
        }

    except psycopg2.IntegrityError as e:
        error_msg = str(e)
        logger.error(f"[ERROR] Database integrity error: {error_msg}")
        logger.error(f"[ERROR] Full traceback: {traceback.format_exc()}")
        if conn:
            conn.rollback()
        
        # Provide more specific error messages for common integrity violations
        if "work_mode" in error_msg.lower() or "chk_tasks_work_mode" in error_msg.lower():
            detail = f"Invalid work_mode value. Allowed values: REMOTE, ON_SITE, OFFICE. Error: {error_msg}"
        elif "foreign key" in error_msg.lower():
            detail = f"Foreign key constraint violation. Please check that all referenced values exist in their respective master tables. Error: {error_msg}"
        elif "not null" in error_msg.lower():
            detail = f"Required field is missing. Please ensure all required fields are provided. Error: {error_msg}"
        else:
            detail = f"Data integrity violation: {error_msg}"
        
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=detail
        )
    except psycopg2.OperationalError as e:
        logger.error(f"[ERROR] Database connection error: {str(e)}")
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Database connection failed"
        )
    except psycopg2.ProgrammingError as e:
        error_msg = str(e)
        logger.error(f"[ERROR] Database query error: {error_msg}")
        logger.error(f"[ERROR] Full traceback: {traceback.format_exc()}")
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail=f"Database query failed: {error_msg}"
        )
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
        logger.info(f"[INFO] Database connection closed for task status update")

