# routes/use_existing_task.py

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
from typing import List, Optional, Dict
import uuid
import traceback
from datetime import datetime, timedelta
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

# Status Code Enum - Valid values for tasks
class StatusCode(str, Enum):
    NOT_YET_STARTED = "STS001"  # To Do / Not Yet Started
    IN_PROGRESS = "STS007"      # In Progress
    COMPLETED = "STS002"        # Completed
    CANCELLED = "STS010"        # Cancelled

# Work Mode Enum - Valid values (CHECK constraint: REMOTE, ON_SITE, OFFICE)
class WorkMode(str, Enum):
    REMOTE = "REMOTE"
    ON_SITE = "ON_SITE"
    OFFICE = "OFFICE"

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

@router.post("/api/v1/timesheet/use_existing_task")
async def use_existing_task(
    predefined_task_id: int = Form(..., description="ID of the predefined task template to use"),
    epic_code: int = Form(..., description="Epic ID to add the task to (must be an actual epic, not predefined)"),
    task_title: Optional[str] = Form(None, description="Task title (overrides template default)"),
    task_description: Optional[str] = Form(None, description="Task description (overrides template default)"),
    assignee: Optional[str] = Form(None, description="User code of assignee (overrides template team assignment)"),
    assigned_team_code: Optional[str] = Form(None, description="Team code (overrides template default)"),
    status_code: Optional[StatusCode] = Form(None, description="Status code (overrides template default)"),
    priority_code: Optional[int] = Form(None, description="Priority code (overrides template default)"),
    task_type_code: Optional[TaskTypeCode] = Form(None, description="Task type code (TT001-TT012) - optional"),
    work_mode: Optional[WorkMode] = Form(None, description="Work mode (overrides template default)"),
    start_date: Optional[str] = Form(None, description="Start date in DD-MM-YYYY or YYYY-MM-DD format (optional - will use template date or epic start)"),
    due_date: Optional[str] = Form(None, description="Due date in DD-MM-YYYY or YYYY-MM-DD format (optional - will use template date or epic due)"),
    estimated_hours: Optional[float] = Form(None, description="Estimated hours (overrides template default)"),
    max_hours: Optional[float] = Form(None, description="Max hours (overrides template default)"),
    is_billable: Optional[bool] = Form(None, description="Billable status (overrides template default)"),
    attachments: List[UploadFile] = File(default=[], description="File attachments for the task"),
    current_user: dict = Depends(verify_token),
):
    """
    Create an actual task from a predefined task template
    This will:
    1. Fetch the predefined task template
    2. Create an actual task using template defaults (can be overridden)
    3. Calculate task dates based on epic dates if not provided
    4. Assign task to user or team lead
    """
    logger.info(f"[INFO] Starting task creation from predefined template {predefined_task_id}, epic: {epic_code}, user: {current_user['user_code']}")
    
    conn = None
    cursor = None

    try:
        logger.info(f"[INFO] Establishing database connection for task creation from template")
        conn = connect_to_psql(host, port, username, password, database_name, schema_name)
        cursor = conn.cursor()
        logger.info(f"[INFO] Database connection established successfully")

        # Step 1: Validate epic exists and is an actual epic (not predefined)
        cursor.execute("""
            SELECT id, epic_title, start_date, due_date, closed_on, status_code, product_code
            FROM sts_ts.epics
            WHERE id = %s
        """, (epic_code,))
        
        epic_result = cursor.fetchone()
        if not epic_result:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND,
                detail=f"Epic with ID {epic_code} does not exist"
            )
        
        epic_title, epic_start_date, epic_due_date, epic_closed_on, epic_status_code, epic_product_code = epic_result[1], epic_result[2], epic_result[3], epic_result[4], epic_result[5], epic_result[6]
        logger.info(f"[INFO] Epic found: {epic_title}, Start: {epic_start_date}, Due: {epic_due_date}, Product: {epic_product_code}")

        # Step 2: Fetch predefined task template
        # Note: predefined_tasks table does not have start_date or due_date columns
        cursor.execute("""
            SELECT 
                id, task_title, task_description,
                status_code, priority_code,
                work_mode,
                estimated_hours, max_hours, is_billable, team_code
            FROM sts_ts.predefined_tasks
            WHERE id = %s
        """, (predefined_task_id,))
        
        template_result = cursor.fetchone()
        if not template_result:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND,
                detail=f"Predefined task with ID {predefined_task_id} does not exist"
            )
        
        # Extract template data
        (pt_id, pt_title, pt_description, pt_status, 
         pt_priority, pt_work_mode,
         pt_estimated_hours, pt_max_hours, pt_is_billable, pt_team_code) = template_result
        # Predefined tasks don't have start_date or due_date - they will be set from epic dates
        pt_start_date = None
        pt_due_date = None

        # Step 3: Use provided values or fall back to template defaults
        final_task_title = task_title.strip() if task_title and task_title.strip() else pt_title
        final_task_description = task_description.strip() if task_description and task_description.strip() else pt_description
        # Start with predefined task's team_code if available
        final_team_code = assigned_team_code.strip() if assigned_team_code and assigned_team_code.strip() else (pt_team_code if pt_team_code else None)
        final_status_code = status_code.value if status_code else pt_status
        final_priority_code = priority_code if priority_code is not None else pt_priority
        # Convert task_type_code enum to string if provided
        if task_type_code:
            if isinstance(task_type_code, TaskTypeCode):
                final_task_type_code = task_type_code.value
            else:
                final_task_type_code = str(task_type_code).upper()
        else:
            final_task_type_code = None
        final_work_mode = work_mode.value if work_mode else pt_work_mode
        final_estimated_hours = estimated_hours if estimated_hours is not None else float(pt_estimated_hours)
        final_max_hours = max_hours if max_hours is not None else float(pt_max_hours)
        final_is_billable = is_billable if is_billable is not None else pt_is_billable

        # Step 4: Validate work_mode is one of the allowed values (REMOTE, ON_SITE, OFFICE)
        allowed_work_modes = ['REMOTE', 'ON_SITE', 'OFFICE']
        if final_work_mode not in allowed_work_modes:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Invalid work_mode '{final_work_mode}'. Allowed values: REMOTE, ON_SITE, OFFICE"
            )

        # Step 7: Validate priority_code exists
        cursor.execute("SELECT priority_code FROM sts_new.tkt_priority_master WHERE priority_code = %s", (final_priority_code,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Priority code {final_priority_code} does not exist"
            )

        # Step 8: Validate status_code exists
        cursor.execute("SELECT status_code FROM sts_new.status_master WHERE status_code = %s", (final_status_code,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Status code {final_status_code} does not exist"
            )

        # Step 8.1: Validate task_type_code exists if provided
        if final_task_type_code:
            # Validate task_type_code is one of the allowed enum values
            try:
                task_type_code_enum = TaskTypeCode(final_task_type_code)
                final_task_type_code = task_type_code_enum.value
            except ValueError:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Task type code '{final_task_type_code}' is not allowed. Allowed values are: TT001 (Accounts), TT002 (Development), TT003 (Quality Assurance), TT004 (User Acceptance Testing), TT005 (PROD Move), TT006 (Documentation), TT007 (Design), TT008 (Code Review), TT009 (Meeting), TT010 (Training), TT011 (Implementation), TT012 (Support)"
                )
            
            cursor.execute("SELECT type_code FROM sts_ts.task_type_master WHERE type_code = %s AND is_active = true", (final_task_type_code,))
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Task type code {final_task_type_code} does not exist or is not active"
                )

        # Step 9: Parse and validate dates
        # Get epic creation date for validation
        cursor.execute("SELECT created_at::DATE FROM sts_ts.epics WHERE id = %s", (epic_code,))
        epic_created_date_result = cursor.fetchone()
        epic_created_date = epic_created_date_result[0] if epic_created_date_result else epic_start_date

        # Calculate task dates
        current_time = get_current_time_ist()
        if start_date:
            try:
                task_start_date = parse_date(start_date)
            except ValueError as e:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Invalid start_date format: {str(e)}. Please use DD-MM-YYYY or YYYY-MM-DD format"
                )
        elif pt_start_date:
            # Use predefined task start date, adjusted to epic timeline
            # Since tasks are independent, we'll use the task's start date relative to epic start
            task_start_date = pt_start_date
        else:
            # Use epic start date as fallback
            task_start_date = epic_start_date
        
        # Step 9.5: If status is "In Progress" (STS007) and start_date is not provided, set it to today
        if final_status_code == 'STS007' and not start_date:
            task_start_date = current_time.date()
            logger.info(f"[INFO] Auto-setting start_date to {task_start_date} for task created with In Progress status")

        if due_date:
            try:
                task_due_date = parse_date(due_date)
            except ValueError as e:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Invalid due_date format: {str(e)}. Please use DD-MM-YYYY or YYYY-MM-DD format"
                )
        elif pt_due_date:
            # Use predefined task due date, adjusted to epic timeline
            if pt_start_date:
                # Preserve duration from predefined task
                task_duration = (pt_due_date - pt_start_date).days
                task_due_date = task_start_date + timedelta(days=task_duration)
            else:
                task_due_date = pt_due_date
        else:
            # Use epic due date as fallback
            task_due_date = epic_due_date

        # Validate task dates
        # Task dates cannot be before epic creation date
        if task_start_date < epic_created_date:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Task start date ({task_start_date}) cannot be before the epic creation date ({epic_created_date})"
            )
        
        if task_due_date < epic_created_date:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Task due date ({task_due_date}) cannot be before the epic creation date ({epic_created_date})"
            )

        # Task start_date must be >= epic start_date
        if task_start_date < epic_start_date:
            task_start_date = epic_start_date
            logger.info(f"[INFO] Adjusted task start date to epic start date: {epic_start_date}")

        # Task due_date must be <= epic due_date (or closed_on if epic is closed)
        # Only validate/adjust if epic has a due_date or closed_on
        if epic_due_date or epic_closed_on:
            epic_end_date = epic_closed_on if epic_closed_on else epic_due_date
            if epic_end_date and task_due_date > epic_end_date:
                task_due_date = epic_end_date
                logger.info(f"[INFO] Adjusted task due date to epic end date: {epic_end_date}")

        # Task start_date must be <= task due_date
        if task_due_date < task_start_date:
            task_due_date = task_start_date
            logger.info(f"[INFO] Adjusted task due date to match start date: {task_start_date}")

        # Step 10: Determine assignee
        final_assignee = None
        
        logger.info(f"[INFO] Raw assignee parameter: {assignee}")
        logger.info(f"[INFO] Raw assigned_team_code parameter: {assigned_team_code}")
        
        if assignee and assignee.strip():
            final_assignee = assignee.strip()
            logger.info(f"[INFO] Using provided assignee: {final_assignee}")
            
            # Validate assignee exists in user_master (NOT contact_master)
            cursor.execute("SELECT user_code, team_code FROM sts_new.user_master WHERE user_code = %s AND is_inactive = false", (final_assignee,))
            assignee_result = cursor.fetchone()
            if not assignee_result:
                logger.error(f"[ERROR] Assignee {final_assignee} does not exist in user_master or is inactive. This might be a contact person code.")
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Assignee {final_assignee} does not exist in user_master or is inactive. Please provide a valid user code (not a contact person code)."
                )
            assignee_team = assignee_result[1]
            if final_team_code and assignee_team != final_team_code:
                # Get team names for better error message
                cursor.execute("SELECT team_name FROM sts_new.team_master WHERE team_code = %s", (final_team_code,))
                task_team_result = cursor.fetchone()
                task_team_name = task_team_result[0] if task_team_result else final_team_code
                
                cursor.execute("SELECT team_name FROM sts_new.team_master WHERE team_code = %s", (assignee_team,))
                assignee_team_result_name = cursor.fetchone()
                assignee_team_name = assignee_team_result_name[0] if assignee_team_result_name else assignee_team
                
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Assignee {final_assignee} belongs to team '{assignee_team_name}' ({assignee_team}), but the task is assigned to team '{task_team_name}' ({final_team_code}). Assignee must belong to the task's assigned team."
                )
            logger.info(f"[INFO] Successfully assigned task to user {final_assignee}")
        else:
            # No assignee provided - allow NULL assignee
            logger.info(f"[INFO] No assignee provided. Task will be created without assignee (assignee will be NULL).")
            final_assignee = None

        # Step 11: Determine reporter (same logic as create_task.py)
        user_code = current_user['user_code']
        reporter = user_code  # Default: creator is reporter
        logger.info(f"[INFO] Setting reporter to task creator: {reporter}")

        # Step 12: Prepare for task creation/update
        # Note: current_time was already set in Step 9.5 if status was In Progress
        if 'current_time' not in locals():
            current_time = get_current_time_ist()
        created_by = user_code

        # Step 12.1: ALWAYS use assignee's team code from user_master
        if final_assignee:
            cursor.execute("SELECT team_code FROM sts_new.user_master WHERE user_code = %s", (final_assignee,))
            assignee_team_result = cursor.fetchone()
            if assignee_team_result:
                final_team_code = assignee_team_result[0]
                logger.info(f"[INFO] Using assignee {final_assignee}'s team code from user_master: {final_team_code}")
            else:
                logger.warning(f"[WARNING] Could not find team code for assignee {final_assignee} in user_master; assigned_team_code will be NULL")

        # Step 12.2: Check if task already exists (same predefined_task_id + epic_code) and update, otherwise create new
        cursor.execute("""
            SELECT id FROM sts_ts.tasks
            WHERE predefined_task_id = %s
            AND epic_code = %s
            ORDER BY created_at DESC
            LIMIT 1
        """, (predefined_task_id, epic_code))
        
        existing_task = cursor.fetchone()
        
        if existing_task:
            # Update existing task instead of creating new one
            new_task_id = existing_task[0]
            logger.info(f"[INFO] Task with same predefined_task_id {predefined_task_id} and epic_code {epic_code} already exists with ID: {new_task_id}, updating instead of creating new")
            
            # If status is changing to "In Progress" (STS007), ensure start_date is set to today
            update_start_date = task_start_date
            if final_status_code == 'STS007' and not start_date:
                # If status is In Progress and no start_date was provided, use today's date
                update_start_date = current_time.date()
                logger.info(f"[INFO] Updating task to In Progress status, setting start_date to {update_start_date}")
            
            # Update the tasks table (current state) - update ALL columns when any change is made
            task_update_query = """
                UPDATE sts_ts.tasks SET
                    task_title = %s,
                    description = %s,
                    assignee = %s,
                    reporter = %s,
                    assigned_team_code = %s,
                    status_code = %s,
                    priority_code = %s,
                    task_type_code = %s,
                    work_mode = %s,
                    assigned_on = %s,
                    start_date = %s,
                    due_date = %s,
                    estimated_hours = %s,
                    max_hours = %s,
                    is_billable = %s,
                    product_code = %s,
                    team_code = %s,
                    predefined_task_id = %s,
                    updated_by = %s,
                    updated_at = %s
                WHERE id = %s
            """
            
            cursor.execute(task_update_query, (
                final_task_title, final_task_description, final_assignee, reporter, final_team_code,
                final_status_code, final_priority_code, final_task_type_code, final_work_mode,
                update_start_date, update_start_date, task_due_date,
                final_estimated_hours, final_max_hours, final_is_billable,
                epic_product_code, final_team_code, predefined_task_id, created_by, current_time, new_task_id
            ))
            logger.info(f"[INFO] Task updated successfully with ID: {new_task_id}")
            
            # Create task history entry for update
            task_hist_insert_query = """
                INSERT INTO sts_ts.task_hist (
                    task_code, status_code, priority_code, task_type_code,
                    product_code, assigned_team_code, assignee, reporter,
                    work_mode, assigned_on, start_date, due_date,
                    estimated_hours, max_hours, created_by, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                ) RETURNING id
            """
            
            cursor.execute(task_hist_insert_query, (
                new_task_id, final_status_code, final_priority_code, final_task_type_code,
                epic_product_code, final_team_code, final_assignee, reporter,
                final_work_mode, update_start_date, update_start_date, task_due_date,
                final_estimated_hours, final_max_hours, created_by, current_time
            ))
            logger.info(f"[INFO] Task history entry created for update")
        else:
            # Create new task
            task_insert_query = """
                INSERT INTO sts_ts.tasks (
                    task_title, description, epic_code, assignee,
                    reporter, assigned_team_code, status_code, priority_code, task_type_code, work_mode,
                    assigned_on, start_date, due_date, estimated_hours, max_hours, is_billable,
                    product_code, predefined_task_id, created_by, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                ) RETURNING id
            """
            
            cursor.execute(task_insert_query, (
                final_task_title, final_task_description, epic_code, final_assignee,
                reporter, final_team_code, final_status_code, final_priority_code, final_task_type_code, final_work_mode,
                task_start_date,  # assigned_on = start_date
                task_start_date, task_due_date,
                final_estimated_hours, final_max_hours, final_is_billable,
                epic_product_code, predefined_task_id, created_by, current_time
            ))
            
            task_result = cursor.fetchone()
            new_task_id = task_result[0]
            logger.info(f"[INFO] Task created successfully with ID: {new_task_id}")

            # Create initial task history entry
            task_hist_insert_query = """
                INSERT INTO sts_ts.task_hist (
                    task_code, status_code, priority_code, task_type_code,
                    product_code, assigned_team_code, assignee, reporter,
                    work_mode, assigned_on, start_date, due_date,
                    estimated_hours, max_hours, created_by, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                ) RETURNING id
            """
            
            cursor.execute(task_hist_insert_query, (
                new_task_id, final_status_code, final_priority_code, final_task_type_code,
                epic_product_code, final_team_code, final_assignee, reporter,
                final_work_mode, task_start_date, task_start_date, task_due_date,
                final_estimated_hours, final_max_hours, created_by, current_time
            ))
            logger.info(f"[INFO] Initial task history entry created successfully")

        # Step 14: Handle task attachments
        task_attachments = []
        if attachments:
            for attachment in attachments:
                try:
                    # Generate unique filename
                    file_extension = os.path.splitext(attachment.filename)[1] if attachment.filename else ""
                    unique_filename = f"{uuid.uuid4()}{file_extension}"
                    file_path = os.path.join(upload_dir, unique_filename)
                    
                    # Save file
                    os.makedirs(upload_dir, exist_ok=True)
                    with open(file_path, "wb") as f:
                        content = await attachment.read()
                        f.write(content)
                    
                    # Generate public URL
                    file_url = f"{base_url}/files/{unique_filename}" if base_url else None
                    
                    # Get file size
                    file_size = len(content)
                    file_size_str = format_file_size(file_size)
                    
                    # Insert attachment record
                    attachment_insert_query = """
                        INSERT INTO sts_ts.attachments (
                            parent_type, parent_code, file_name, file_path, file_url,
                            file_type, file_size, purpose, created_by, created_at
                        ) VALUES (
                            'TASK', %s, %s, %s, %s, %s, %s, 'TASK_ATTACHMENT', %s, %s
                        ) RETURNING id
                    """
                    
                    cursor.execute(attachment_insert_query, (
                        new_task_id, attachment.filename, file_path, file_url,
                        attachment.content_type or "application/octet-stream",
                        file_size_str, created_by, current_time
                    ))
                    
                    attachment_result = cursor.fetchone()
                    attachment_id = attachment_result[0]
                    
                    task_attachments.append({
                        "id": attachment_id,
                        "file_name": attachment.filename,
                        "file_path": file_path,
                        "file_url": file_url,
                        "file_type": attachment.content_type,
                        "file_size": file_size_str,
                    })
                    logger.info(f"[INFO] Attachment '{attachment.filename}' saved successfully for task {new_task_id}")
                except Exception as e:
                    logger.error(f"[ERROR] Error saving attachment {attachment.filename}: {str(e)}")
                    # Continue with other attachments even if one fails

        # Commit all changes
        conn.commit()
        logger.info(f"[INFO] Task created successfully from predefined template {predefined_task_id}")

        # Step 15: Fetch created task data for response
        cursor.execute("""
            SELECT 
                t.id, t.task_title, t.description, t.epic_code,
                t.assignee, um_assignee.user_name AS assignee_name,
                t.reporter, um_reporter.user_name AS reporter_name,
                t.status_code, sm.status_desc,
                t.priority_code, pr.priority_desc,
                t.work_mode,
                t.assigned_on, t.start_date, t.due_date, t.closed_on,
                t.estimated_hours, t.max_hours, t.is_billable,
                t.created_by, t.created_at, t.updated_by, t.updated_at,
                tm.team_name AS assigned_team_name
            FROM sts_ts.tasks t
            LEFT JOIN sts_new.user_master um_assignee ON t.assignee = um_assignee.user_code
            LEFT JOIN sts_new.user_master um_reporter ON t.reporter = um_reporter.user_code
            LEFT JOIN sts_new.status_master sm ON t.status_code = sm.status_code
            LEFT JOIN sts_new.tkt_priority_master pr ON t.priority_code = pr.priority_code
            LEFT JOIN sts_new.user_master um_assignee_team ON t.assignee = um_assignee_team.user_code
            LEFT JOIN sts_new.team_master tm ON um_assignee_team.team_code = tm.team_code
            WHERE t.id = %s
        """, (new_task_id,))
        
        task_data = cursor.fetchone()
        
        if not task_data:
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created task data"
            )

        # Build response
        response_data = {
            "id": task_data[0],
            "task_title": task_data[1],
            "task_description": task_data[2],
            "epic_code": task_data[3],
            "assignee": task_data[4],
            "assignee_name": task_data[5],
            "reporter": task_data[6],
            "reporter_name": task_data[7],
            "status_code": task_data[8],
            "status_description": task_data[9],
            "priority_code": task_data[10],
            "priority_description": task_data[11],
            "work_mode": task_data[12],
            "assigned_on": task_data[13].isoformat() if task_data[13] else None,
            "start_date": task_data[14].isoformat() if task_data[14] else None,
            "due_date": task_data[15].isoformat() if task_data[15] else None,
            "closed_on": task_data[16].isoformat() if task_data[16] else None,
            "estimated_hours": float(task_data[17]) if task_data[17] else None,
            "max_hours": float(task_data[18]) if task_data[18] else None,
            "is_billable": task_data[19],
            "created_by": task_data[20],
            "created_at": task_data[21].isoformat() if task_data[21] else None,
            "updated_by": task_data[22],
            "updated_at": task_data[23].isoformat() if task_data[23] else None,
            "assigned_team_code": final_team_code,
            "assigned_team_name": task_data[24],
            "attachments": task_attachments,
        }

        # Note: usage_count column has been removed from predefined_tasks table

        # Commit all changes
        conn.commit()
        logger.info(f"[INFO] Task creation from predefined template completed successfully")
        
        return {
            "success": True,
            "status_code": HTTPStatus.OK,
            "status_message": "OK",
            "message": f"Task created successfully from predefined template '{pt_title}'",
            "data": response_data
        }

    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except psycopg2.IntegrityError as e:
        if conn:
            conn.rollback()
        error_msg = str(e)
        logger.error(f"[ERROR] Database integrity error: {error_msg}")
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=f"Data integrity violation: {error_msg}"
        )
    except Exception as e:
        if conn:
            conn.rollback()
        error_msg = str(e)
        logger.error(f"[ERROR] Unexpected error: {error_msg}")
        logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {error_msg}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
            logger.info(f"[INFO] Database connection closed for task creation from template")

