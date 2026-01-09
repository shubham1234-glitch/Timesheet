# routes/use_existing_epic.py

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
import json
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

# Status Code Enum - Valid values for epics
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

@router.post("/api/v1/timesheet/use_existing_epic")
async def use_existing_epic(
    predefined_epic_id: int = Form(..., description="ID of the predefined epic template to use"),
    epic_title: Optional[str] = Form(None, description="Epic title (overrides template default)"),
    epic_description: Optional[str] = Form(None, description="Epic description (overrides template default)"),
    product_code: Optional[str] = Form(None, description="Product code (overrides template default)"),
    company_code: Optional[str] = Form(None, description="Company/client code (overrides template default)"),
    contact_person_code: Optional[str] = Form(None, description="Contact person code (overrides template default)"),
    priority_code: Optional[int] = Form(None, description="Priority code (overrides template default)"),
    start_date: str = Form(..., description="Epic start date in DD-MM-YYYY or YYYY-MM-DD format"),
    due_date: Optional[str] = Form(None, description="Epic due date in DD-MM-YYYY or YYYY-MM-DD format (optional - will be calculated from duration if not provided)"),
    estimated_hours: Optional[float] = Form(None, description="Estimated hours (overrides template default)"),
    max_hours: Optional[float] = Form(None, description="Max hours (overrides template default)"),
    is_billable: Optional[bool] = Form(None, description="Billable status (overrides template default)"),
    predefined_task_ids: str = Form(..., description="JSON array of predefined task IDs to add to the epic. Example: [1, 2, 3]. If a task ID doesn't exist, provide task details in 'new_tasks' parameter to create it on the fly."),
    new_tasks: Optional[str] = Form(None, description="JSON object mapping task ID to new task details. Use when predefined_task_id doesn't exist. Required field: task_title. Optional fields: team_code, assignee (user_code), due_date. Example: {'4': {'task_title': 'New Task Title', 'team_code': 'T01', 'assignee': 'E00196', 'due_date': '2025-12-15'}}"),
    task_teams: Optional[str] = Form(None, description="JSON string mapping predefined_task_id to team_code. Example: {'1': 'T01', '2': 'T02'}. Key is predefined_task.id, value is team_code."),
    task_assignees: Optional[str] = Form(None, description="JSON string mapping predefined_task_id to assignee user_code. Example: {'1': 'E00196', '2': 'E00229'}. Key is predefined_task.id, value is user_code. Use null or empty string for unassigned tasks."),
    task_type_codes: Optional[str] = Form(None, description="JSON string mapping predefined_task_id to task_type_code (TT001-TT012). Example: {'1': 'TT002', '2': 'TT003'}. Key is predefined_task.id, value is task_type_code enum value."),
    attachments: List[UploadFile] = File(default=[], description="File attachments for the epic"),
    current_user: dict = Depends(verify_token),
):
    """
    Create an epic from a predefined epic template
    This will:
    1. Fetch the predefined epic template
    2. Create an actual epic using template defaults (can be overridden)
    3. Create tasks from predefined tasks (predefined_task_ids is required)
    4. Calculate task dates based on epic start date
    Note: predefined_task_ids is required - provide a JSON array of predefined task IDs to add to the epic
    """
    logger.info(f"[INFO] Starting epic creation from predefined template {predefined_epic_id}, user: {current_user['user_code']}")
    
    conn = None
    cursor = None

    try:
        logger.info(f"[INFO] Establishing database connection for epic creation from template")
        conn = connect_to_psql(host, port, username, password, database_name, schema_name)
        cursor = conn.cursor()
        logger.info(f"[INFO] Database connection established successfully")

        # Step 1: Fetch predefined epic template
        cursor.execute("""
            SELECT 
                id, title, description,
                contact_person_code,
                priority_code, estimated_hours, max_hours,
                is_billable, is_active
            FROM sts_ts.predefined_epics
            WHERE id = %s AND is_active = true
        """, (predefined_epic_id,))
        
        template_result = cursor.fetchone()
        if not template_result:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND,
                detail=f"Predefined epic with ID {predefined_epic_id} does not exist or is not active"
            )
        
        # Extract template data
        (template_id, template_title, template_desc,
         template_contact_person_code,
         template_priority_code, template_estimated_hours, template_max_hours,
         template_is_billable, template_is_active) = template_result

        # Step 2: Use provided values or fall back to template defaults
        final_epic_title = epic_title.strip() if epic_title and epic_title.strip() else template_title
        final_epic_description = epic_description.strip() if epic_description and epic_description.strip() else template_desc
        final_product_code = product_code.strip() if product_code and product_code.strip() else None
        final_company_code = company_code.strip() if company_code and company_code.strip() else None
        final_contact_person_code = contact_person_code.strip() if contact_person_code and contact_person_code.strip() else template_contact_person_code
        final_priority_code = priority_code if priority_code is not None else template_priority_code
        final_estimated_hours = estimated_hours if estimated_hours is not None else float(template_estimated_hours)
        final_max_hours = max_hours if max_hours is not None else float(template_max_hours)
        final_is_billable = is_billable if is_billable is not None else template_is_billable

        # Step 3: Parse and validate dates
        try:
            epic_start_date = parse_date(start_date)
        except ValueError as e:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Invalid start_date format: {str(e)}. Please use DD-MM-YYYY or YYYY-MM-DD format"
            )

        if due_date:
            try:
                epic_due_date = parse_date(due_date)
            except ValueError as e:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Invalid due_date format: {str(e)}. Please use DD-MM-YYYY or YYYY-MM-DD format"
                )
        else:
            # due_date is required when creating epic from predefined template
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                detail="due_date is required when creating epic from predefined template"
                )

        if epic_due_date < epic_start_date:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="Due date cannot be before start date"
            )

        # Step 4: Validate required fields
        if not final_product_code:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="Product code is required (either provide in request or set in predefined epic template)"
            )

        # Step 5: Validate product exists
        cursor.execute("SELECT product_code FROM sts_new.product_master WHERE product_code = %s", (final_product_code,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Product with code {final_product_code} does not exist"
            )

        # Step 6: Validate company_code exists (if provided)
        if final_company_code:
            cursor.execute("SELECT company_code FROM sts_new.company_master WHERE company_code = %s AND is_inactive = false", (final_company_code,))
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Company with code {final_company_code} does not exist or is inactive"
                )

        # Step 7: Validate contact_person_code exists and belongs to company (if provided)
        if final_contact_person_code:
            cursor.execute(
                "SELECT contact_person_code, company_code FROM sts_new.contact_master WHERE contact_person_code = %s AND is_inactive = false",
                (final_contact_person_code,)
            )
            contact_result = cursor.fetchone()
            if not contact_result:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Contact person with code {final_contact_person_code} does not exist or is inactive"
                )
            
            contact_company_code = contact_result[1]
            
            # Always validate: if both company_code and contact_person_code are provided, they must match
            if final_company_code:
                if contact_company_code != final_company_code:
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail=f"Contact person {final_contact_person_code} belongs to company {contact_company_code}, but epic is assigned to company {final_company_code}"
                    )
                logger.info(f"[INFO] Contact person {final_contact_person_code} validation passed - belongs to company {final_company_code}")
            else:
                # If company_code is not provided but contact_person_code is, auto-set company_code from contact
                final_company_code = contact_company_code
                logger.info(f"[INFO] Auto-set company_code to {final_company_code} from contact_person_code {final_contact_person_code}")

        # Step 8: Validate priority_code exists
        cursor.execute("SELECT priority_code FROM sts_new.tkt_priority_master WHERE priority_code = %s", (final_priority_code,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Priority code {final_priority_code} does not exist"
            )

        # Step 9: Determine reporter (same logic as create_epic.py)
        user_code = current_user['user_code']
        cursor.execute("""
            SELECT um.designation_name, um.team_code
            FROM sts_new.user_master um
            WHERE um.user_code = %s
        """, (user_code,))
        user_result = cursor.fetchone()
        
        if not user_result:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"User {user_code} does not exist"
            )
        
        designation_name = user_result[0]
        team_code = user_result[1]
        
        # Check if creator is an admin
        from config import load_config
        config_data = load_config()
        admin_designations = config_data.get('admin_designations', [])
        designation_normalized = designation_name.lower().strip() if designation_name else ""
        allowed_admin_designations = [d.lower().strip() for d in admin_designations]
        creator_is_admin = designation_normalized in allowed_admin_designations
        
        if creator_is_admin:
            reporter = user_code
            logger.info(f"[INFO] Creator {user_code} is an admin, setting reporter to created_by: {reporter}")
        else:
            # Regular employee: use team lead
            cursor.execute("""
                SELECT tm.team_lead
                FROM sts_new.user_master um
                LEFT JOIN sts_new.team_master tm ON um.team_code = tm.team_code
                WHERE um.user_code = %s
            """, (user_code,))
            team_result = cursor.fetchone()
            
            if not team_result or not team_result[0]:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"User {user_code} is not associated with any team or team lead is not configured. Cannot determine reporter."
                )
            reporter = team_result[0]
            logger.info(f"[INFO] Creator {user_code} is a regular employee, setting reporter to team lead: {reporter}")

        # Step 10: Check if epic already exists (same predefined_epic_id, company) and update, otherwise create new
        # We check by predefined_epic_id + company_code (NOT product_code) to allow product changes to update existing epic
        # This allows updating the epic when any column changes (title, product, dates, hours, etc.)
        current_time = get_current_time_ist()
        created_by = user_code
        status_code_str = "STS001"  # Default: Not Yet Started

        # Check if epic with same predefined_epic_id and company_code already exists (most recent one)
        # This ensures we update the correct epic when using the same template for the same company, even if product changes
        cursor.execute("""
            SELECT id FROM sts_ts.epics
            WHERE predefined_epic_id = %s
            AND (company_code = %s OR (company_code IS NULL AND %s IS NULL))
            ORDER BY created_at DESC
            LIMIT 1
        """, (predefined_epic_id, final_company_code, final_company_code))
        
        existing_epic = cursor.fetchone()
        
        if existing_epic:
            # Update existing epic instead of creating new one (including title, product, dates, hours, etc. if they changed)
            new_epic_id = existing_epic[0]
            logger.info(f"[INFO] Epic with same predefined_epic_id and company_code already exists with ID: {new_epic_id}, updating instead of creating new")
            
            # Step 10.1: Update the epics table (current state) - update ALL columns when any change is made
            # Note: closed_on, cancelled_by, cancelled_at, cancellation_reason are not updated here as they are
            # typically set by status update operations, not during epic template updates
            update_query = """
                UPDATE sts_ts.epics SET
                    epic_title = %s,
                    epic_description = %s,
                    product_code = %s,
                    company_code = %s,
                    contact_person_code = %s,
                    reporter = %s,
                    predefined_epic_id = %s,
                    status_code = %s,
                    priority_code = %s,
                    start_date = %s,
                    due_date = %s,
                    estimated_hours = %s,
                    max_hours = %s,
                    is_billable = %s,
                    updated_by = %s,
                    updated_at = %s
                WHERE id = %s
            """
            
            cursor.execute(update_query, (
                final_epic_title, final_epic_description, final_product_code, final_company_code, final_contact_person_code,
                reporter, predefined_epic_id, status_code_str, final_priority_code,
                epic_start_date, epic_due_date, final_estimated_hours, final_max_hours, final_is_billable,
                created_by, current_time, new_epic_id
            ))
            logger.info(f"[INFO] Epic updated successfully with ID: {new_epic_id}")
            
            # Step 10.2: Insert history entry into epic_hist (when updating)
            epic_hist_insert_query = """
                INSERT INTO sts_ts.epic_hist (
                    epic_code, status_code, product_code, priority_code, start_date, due_date,
                    estimated_hours, max_hours, reporter, created_by, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                ) RETURNING id
            """
            
            cursor.execute(epic_hist_insert_query, (
                new_epic_id, status_code_str, final_product_code, final_priority_code,
                epic_start_date, epic_due_date, final_estimated_hours, final_max_hours,
                reporter, created_by, current_time
            ))
            logger.info(f"[INFO] Epic history entry created for update")
        else:
            # Create new epic
            epic_insert_query = """
                INSERT INTO sts_ts.epics (
                epic_title, epic_description, product_code, company_code, contact_person_code,
                reporter, status_code, priority_code, start_date, due_date,
                    estimated_hours, max_hours, is_billable, predefined_epic_id, created_by, created_at
            ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) RETURNING id
        """
            
            cursor.execute(epic_insert_query, (
                final_epic_title, final_epic_description, final_product_code, final_company_code, final_contact_person_code,
                reporter, status_code_str, final_priority_code, epic_start_date, epic_due_date,
                final_estimated_hours, final_max_hours, final_is_billable, predefined_epic_id, created_by, current_time
            ))
            
            epic_result = cursor.fetchone()
            new_epic_id = epic_result[0]
            logger.info(f"[INFO] Epic created successfully with ID: {new_epic_id}")

            # Step 10.3: Insert initial history entry into epic_hist (on creation)
            epic_hist_insert_query = """
                INSERT INTO sts_ts.epic_hist (
                    epic_code, status_code, product_code, priority_code, start_date, due_date,
                    estimated_hours, max_hours, reporter, created_by, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                ) RETURNING id
            """
            
            cursor.execute(epic_hist_insert_query, (
                new_epic_id, status_code_str, final_product_code, final_priority_code,
                epic_start_date, epic_due_date, final_estimated_hours, final_max_hours,
                reporter, created_by, current_time
            ))
            logger.info(f"[INFO] Initial epic history entry created successfully")

        # Step 10.1: Fetch epic creation date for task date validation
        cursor.execute("SELECT created_at::DATE FROM sts_ts.epics WHERE id = %s", (new_epic_id,))
        epic_created_date_result = cursor.fetchone()
        epic_created_date = epic_created_date_result[0] if epic_created_date_result else epic_start_date
        logger.info(f"[INFO] Epic creation date: {epic_created_date}")

        # Step 12: Fetch predefined tasks (required when using predefined epic)
        predefined_tasks = []
        if not predefined_task_ids or not predefined_task_ids.strip():
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="predefined_task_ids is required when creating epic from predefined template. Provide a JSON array of predefined task IDs. Example: [1, 2, 3]"
            )
        
        try:
            predefined_task_ids_list = json.loads(predefined_task_ids)
            if not isinstance(predefined_task_ids_list, list):
                raise ValueError("predefined_task_ids must be a JSON array")
            if len(predefined_task_ids_list) == 0:
                raise ValueError("predefined_task_ids array cannot be empty. Provide at least one predefined task ID.")
            
            placeholders = ','.join(['%s'] * len(predefined_task_ids_list))
            cursor.execute(f"""
            SELECT 
                    id, task_title, task_description,
                    status_code, priority_code, work_mode,
                    estimated_hours, max_hours, is_billable, team_code
                FROM sts_ts.predefined_tasks
                WHERE id IN ({placeholders})
            ORDER BY id ASC
            """, tuple(predefined_task_ids_list))
            predefined_tasks = cursor.fetchall()
            
            # Step 12.0.5: Parse new_tasks parameter if provided
            new_tasks_dict = {}
            if new_tasks and new_tasks.strip():
                try:
                    new_tasks_dict = json.loads(new_tasks)
                    if not isinstance(new_tasks_dict, dict):
                        raise ValueError("new_tasks must be a JSON object")
                    logger.info(f"[INFO] Parsed new_tasks: {new_tasks_dict}")
                except (json.JSONDecodeError, ValueError) as e:
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail=f"Invalid JSON format for new_tasks: {str(e)}. Expected format: {{'4': {{'task_title': '...', 'priority_code': 2, ...}}}}"
                    )
            
            # Step 12.0.6: Handle missing predefined tasks - create them on the fly if details provided
            found_ids = [pt[0] for pt in predefined_tasks]
            missing_ids = [tid for tid in predefined_task_ids_list if tid not in found_ids]
            
            # Mapping from original ID (from predefined_task_ids_list) to actual predefined_task.id
            # This is needed when new tasks are created and get auto-generated IDs
            id_mapping = {tid: tid for tid in predefined_task_ids_list}  # Initialize with same IDs
            
            if missing_ids:
                logger.info(f"[INFO] Missing predefined task IDs: {missing_ids}. Checking if new_tasks provided to create them on the fly.")
                
                # Create missing predefined tasks if details are provided
                for missing_id in missing_ids:
                    missing_id_str = str(missing_id)
                    if missing_id_str in new_tasks_dict:
                        task_data = new_tasks_dict[missing_id_str]
                        logger.info(f"[INFO] Creating new predefined task for ID {missing_id} with provided details")
                        
                        # Create predefined task with simplified fields
                        try:
                            # Validate required field
                            if 'task_title' not in task_data or not task_data['task_title']:
                                raise HTTPException(
                                    status_code=HTTPStatus.BAD_REQUEST,
                                    detail=f"task_title is required in new_tasks for task ID {missing_id}"
                                )
                            
                            # Use defaults for predefined task fields
                            task_title = str(task_data['task_title']).strip()
                            task_description = None  # Default: no description
                            status_code_str = 'STS001'  # Default: Not Yet Started
                            task_priority_code = final_priority_code  # Use epic's priority_code
                            work_mode_str = 'REMOTE'  # Default work mode
                            task_estimated_hours = 8.0  # Default estimated hours
                            task_max_hours = 10.0  # Default max hours
                            is_billable = True  # Default: billable
                            
                            # Validate and set team_code if provided
                            task_team_code = None
                            if 'team_code' in task_data and task_data['team_code']:
                                task_team_code = str(task_data['team_code']).strip()
                                cursor.execute("SELECT team_code FROM sts_new.team_master WHERE team_code = %s AND is_active = true", (task_team_code,))
                                if not cursor.fetchone():
                                    raise HTTPException(
                                        status_code=HTTPStatus.BAD_REQUEST,
                                        detail=f"Team code {task_team_code} does not exist or is inactive for task ID {missing_id}"
                                    )
                            
                            # Validate and set assignee if provided (store for later use when creating actual task)
                            task_assignee = None
                            if 'assignee' in task_data and task_data['assignee']:
                                task_assignee = str(task_data['assignee']).strip()
                                cursor.execute("SELECT user_code FROM sts_new.user_master WHERE user_code = %s", (task_assignee,))
                                if not cursor.fetchone():
                                    raise HTTPException(
                                        status_code=HTTPStatus.BAD_REQUEST,
                                        detail=f"Assignee user code {task_assignee} does not exist for task ID {missing_id}"
                                    )
                            
                            # Parse due_date if provided
                            task_due_date = None
                            if 'due_date' in task_data and task_data['due_date']:
                                try:
                                    task_due_date = parse_date(task_data['due_date'])
                                except ValueError as e:
                                    raise HTTPException(
                                        status_code=HTTPStatus.BAD_REQUEST,
                                        detail=f"Invalid due_date format for task ID {missing_id}: {str(e)}"
                                    )
                            
                            # Insert new predefined task with defaults
                            # Note: predefined_tasks table does not have start_date or due_date columns
                            task_insert_query = """
                                INSERT INTO sts_ts.predefined_tasks (
                                    task_title, task_description, status_code, priority_code, work_mode,
                                    team_code,
                                    estimated_hours, max_hours, is_billable,
                                    created_by, created_at, updated_by, updated_at
                                ) VALUES (
                                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                                ) RETURNING id, task_title
                            """
                            
                            cursor.execute(task_insert_query, (
                                task_title,
                                task_description,
                                status_code_str,
                                task_priority_code,
                                work_mode_str,
                                task_team_code,
                                task_estimated_hours,
                                task_max_hours,
                                is_billable,
                                created_by,
                                current_time,
                                created_by,
                                current_time
                            ))
                            
                            new_predefined_task_result = cursor.fetchone()
                            new_predefined_task_id = new_predefined_task_result[0]
                            new_predefined_task_title = new_predefined_task_result[1]
                            
                            logger.info(f"[INFO] Created new predefined task with ID: {new_predefined_task_id}, title: {new_predefined_task_title}")
                            
                            # Store assignee for this new task (will be used when creating actual task)
                            # Assignee is optional - can be omitted if only team is assigned
                            if task_assignee:
                                # Initialize task_assignees_dict_raw if it doesn't exist
                                if not task_assignees_dict_raw:
                                    task_assignees_dict_raw = {}
                                # Store using the newly created predefined_task_id
                                task_assignees_dict_raw[str(new_predefined_task_id)] = task_assignee
                                logger.info(f"[INFO] Stored assignee {task_assignee} for newly created predefined task ID {new_predefined_task_id}")
                            else:
                                logger.info(f"[INFO] No assignee provided for newly created predefined task ID {new_predefined_task_id}. Task will be created without assignee (only team if provided).")
                            
                            # Update the mapping: original missing_id -> newly created ID
                            id_mapping[missing_id] = new_predefined_task_id
                            
                            # Update predefined_task_ids_list to use the new ID
                            idx = predefined_task_ids_list.index(missing_id)
                            predefined_task_ids_list[idx] = new_predefined_task_id
                            
                        except HTTPException:
                            raise
                        except Exception as e:
                            logger.error(f"[ERROR] Failed to create predefined task for ID {missing_id}: {str(e)}")
                            raise HTTPException(
                                status_code=HTTPStatus.BAD_REQUEST,
                                detail=f"Failed to create predefined task for ID {missing_id}: {str(e)}"
                            )
                    else:
                        # Missing ID and no details provided in new_tasks
                        raise HTTPException(
                            status_code=HTTPStatus.BAD_REQUEST,
                            detail=f"Predefined task ID {missing_id} does not exist. Please provide task details in 'new_tasks' parameter to create it on the fly. Example: new_tasks={{'{missing_id}': {{'task_title': 'Task Title', 'team_code': 'T01', 'assignee': 'E00196', 'due_date': '2025-12-15'}}}}"
                        )
                
                # Re-fetch predefined tasks after creating new ones (using updated IDs)
                placeholders = ','.join(['%s'] * len(predefined_task_ids_list))
                cursor.execute(f"""
                    SELECT 
                        id, task_title, task_description,
                        status_code, priority_code, work_mode,
                        estimated_hours, max_hours, is_billable, team_code
                    FROM sts_ts.predefined_tasks
                    WHERE id IN ({placeholders})
                    ORDER BY id ASC
                """, tuple(predefined_task_ids_list))
                predefined_tasks = cursor.fetchall()
                logger.info(f"[INFO] Re-fetched predefined tasks after creating new ones. Found {len(predefined_tasks)} tasks. ID mapping: {id_mapping}")
            
            if len(predefined_tasks) == 0:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"No predefined tasks found with the provided IDs: {predefined_task_ids_list}"
                )
            
            logger.info(f"[INFO] Found {len(predefined_tasks)} predefined tasks to create")
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Invalid JSON format for predefined_task_ids: {str(e)}. Expected format: [1, 2, 3]"
            )

        # Step 12.1: Parse task team, assignee, and task_type_code assignments if provided
        # Note: Keys in these dictionaries use original IDs from user request
        # We need to translate them to actual predefined_task IDs using id_mapping
        task_teams_dict_raw = {}
        task_assignees_dict_raw = {}
        task_type_codes_dict_raw = {}
        
        logger.info(f"[INFO] Raw task_teams parameter (type: {type(task_teams)}): {task_teams}")
        logger.info(f"[INFO] Raw task_assignees parameter (type: {type(task_assignees)}): {task_assignees}")
        logger.info(f"[INFO] Raw task_type_codes parameter (type: {type(task_type_codes)}): {task_type_codes}")
        logger.info(f"[INFO] Raw task_assignees repr: {repr(task_assignees)}")
        
        if task_teams and task_teams.strip():
            try:
                task_teams_dict_raw = json.loads(task_teams)
                logger.info(f"[INFO] Parsed task teams (raw): {task_teams_dict_raw}")
            except json.JSONDecodeError as e:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Invalid JSON format for task_teams: {str(e)}. Expected format: {{'predefined_task_id': 'team_code'}}"
                )
        
        if task_assignees and task_assignees.strip():
            try:
                task_assignees_dict_raw = json.loads(task_assignees)
                logger.info(f"[INFO] Parsed task assignees (raw): {task_assignees_dict_raw}")
            except json.JSONDecodeError as e:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Invalid JSON format for task_assignees: {str(e)}. Expected format: {{'predefined_task_id': 'user_code'}}"
                )
        else:
            logger.info(f"[INFO] No task_assignees provided or empty. Tasks will be created without assignees (assignee will be NULL).")
        
        if task_type_codes and task_type_codes.strip():
            try:
                task_type_codes_dict_raw = json.loads(task_type_codes)
                logger.info(f"[INFO] Parsed task type codes (raw): {task_type_codes_dict_raw}")
            except json.JSONDecodeError as e:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Invalid JSON format for task_type_codes: {str(e)}. Expected format: {{'predefined_task_id': 'task_type_code'}}"
                )
        
        # Translate keys from original IDs to actual predefined_task IDs
        task_teams_dict = {}
        task_assignees_dict = {}
        task_type_codes_dict = {}
        
        for original_id, actual_id in id_mapping.items():
            original_id_str = str(original_id)
            actual_id_str = str(actual_id)
            
            if original_id_str in task_teams_dict_raw:
                task_teams_dict[actual_id_str] = task_teams_dict_raw[original_id_str]
            
            if original_id_str in task_assignees_dict_raw:
                task_assignees_dict[actual_id_str] = task_assignees_dict_raw[original_id_str]
            
            if original_id_str in task_type_codes_dict_raw:
                task_type_codes_dict[actual_id_str] = task_type_codes_dict_raw[original_id_str]
        
        logger.info(f"[INFO] Translated task teams: {task_teams_dict}")
        logger.info(f"[INFO] Translated task assignees: {task_assignees_dict}")
        logger.info(f"[INFO] Translated task type codes: {task_type_codes_dict}")
        
        if task_type_codes and task_type_codes.strip():
            try:
                task_type_codes_dict = json.loads(task_type_codes)
                logger.info(f"[INFO] Parsed task type codes: {task_type_codes_dict}")
            except json.JSONDecodeError as e:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Invalid JSON format for task_type_codes: {str(e)}. Expected format: {{'predefined_task_id': 'TT001'}}"
                )

        # Step 13: Create tasks from predefined tasks
        created_tasks = []
        
        for pt in predefined_tasks:
            (pt_id, pt_title, pt_description, pt_status, pt_priority, 
             pt_work_mode, 
             pt_estimated_hours, pt_max_hours, pt_is_billable, pt_team_code) = pt
            # Predefined tasks don't have start_date or due_date - they will be set from epic dates
            pt_start_date = None
            pt_due_date = None

            # When creating tasks from predefined epic, use epic's start_date
            # However, if task status is "In Progress" (STS007), set start_date to today
            # For due_date: use task's due_date if provided, otherwise use epic's due_date
            current_time = get_current_time_ist()
            if pt_status == 'STS007':
                # If status is In Progress, use today's date as start_date
                task_start_date = current_time.date()
                logger.info(f"[INFO] Task '{pt_title}' has In Progress status, setting start_date to {task_start_date}")
            else:
                task_start_date = epic_start_date
            task_due_date = pt_due_date if pt_due_date is not None else epic_due_date
            
            # Validate task dates are within epic date range
            # Task start_date must be >= epic start_date
            # Exception: If status is In Progress, allow today's date even if before epic start_date
            if task_start_date < epic_start_date and pt_status != 'STS007':
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Task start date ({task_start_date}) cannot be before the epic start date ({epic_start_date})"
                )
            
            # Task due_date must be <= epic due_date
            if task_due_date > epic_due_date:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Task due date ({task_due_date}) cannot be after the epic due date ({epic_due_date})"
                )
            
            # Task start_date must be <= task due_date
            if task_start_date > task_due_date:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Task start date ({task_start_date}) cannot be after the task due date ({task_due_date})"
                )
            
            logger.info(f"[INFO] Task '{pt_title}' will use start_date={task_start_date}, due_date={task_due_date} (from predefined task: {pt_due_date}, epic: {epic_due_date})")

            # Validate work_mode is one of the allowed values (REMOTE, ON_SITE, OFFICE) or NULL
            if pt_work_mode is not None:
                allowed_work_modes = ['REMOTE', 'ON_SITE', 'OFFICE']
                if pt_work_mode not in allowed_work_modes:
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail=f"Invalid work_mode '{pt_work_mode}' for predefined task {pt_id}. Allowed values: REMOTE, ON_SITE, OFFICE, or NULL"
                    )

            # Step 13.1: Get team and assignee from task assignments
            # Start with predefined task's team_code if available
            final_team_code = pt_team_code if pt_team_code else None
            final_assignee = None
            
            logger.info(f"[INFO] Processing task '{pt_title}' (predefined_task_id: {pt_id})")
            
            # Check if there's an assignee override for this predefined task FIRST
            # If assignee is provided, we'll ALWAYS use their team code from user_master
            # First check with string key
            assignee_key_found = False
            if str(pt_id) in task_assignees_dict:
                assignee_key_found = True
                assignee_override = task_assignees_dict[str(pt_id)]
                logger.info(f"[INFO] Found assignee override for predefined_task_id {pt_id} (as string): {assignee_override}")
            elif pt_id in task_assignees_dict:
                # Also check with integer key (in case JSON parser converts to int)
                assignee_key_found = True
                assignee_override = task_assignees_dict[pt_id]
                logger.info(f"[INFO] Found assignee override for predefined_task_id {pt_id} (as integer): {assignee_override}")
            
            if assignee_key_found:
                # Handle None, empty string, or 'NULL' string values
                if assignee_override is None:
                    final_assignee = None
                    logger.info(f"[INFO] Assignee override is None for task '{pt_title}' (predefined_task_id: {pt_id}), assignee will be NULL")
                elif isinstance(assignee_override, str) and (not assignee_override.strip() or assignee_override.strip().upper() == 'NULL'):
                    final_assignee = None
                    logger.info(f"[INFO] Assignee override is empty/NULL string for task '{pt_title}' (predefined_task_id: {pt_id}), assignee will be NULL")
                else:
                    # We have a valid assignee value
                    final_assignee = str(assignee_override).strip()
                    logger.info(f"[INFO] Using provided assignee: {final_assignee} for task '{pt_title}' (predefined_task_id: {pt_id})")
                    
                    # Validate assignee exists in user_master (NOT contact_master)
                    cursor.execute("SELECT user_code, team_code FROM sts_new.user_master WHERE user_code = %s AND is_inactive = false", (final_assignee,))
                    assignee_result = cursor.fetchone()
                    if not assignee_result:
                        logger.error(f"[ERROR] Assignee {final_assignee} does not exist in user_master or is inactive. This might be a contact person code. Assignee will be NULL.")
                        final_assignee = None
                    else:
                        # ALWAYS use assignee's team code from user_master (overrides any provided team_code)
                        assignee_team = assignee_result[1]
                        final_team_code = assignee_team
                        logger.info(f"[INFO] Using assignee {final_assignee}'s team code from user_master: {final_team_code}")
                        logger.info(f"[INFO] Successfully assigned task '{pt_title}' (predefined_task_id: {pt_id}) to user {final_assignee}")
            else:
                logger.info(f"[INFO] No assignee override found for predefined_task_id {pt_id} in task_assignees_dict. Available keys: {list(task_assignees_dict.keys()) if task_assignees_dict else 'None'}")
                
            # If no assignee provided, check if there's a team override (but don't auto-assign team lead)
            if not final_assignee:
                # Check if there's a team override for this predefined task
                if str(pt_id) in task_teams_dict:
                    team_override = task_teams_dict[str(pt_id)]
                    if team_override and str(team_override).strip():
                        final_team_code = str(team_override).strip()
                        # Validate team exists
                        cursor.execute("SELECT team_code FROM sts_new.team_master WHERE team_code = %s AND is_active = true", (final_team_code,))
                        if not cursor.fetchone():
                            logger.warning(f"[WARNING] Team {final_team_code} does not exist or is inactive, setting to NULL")
                            final_team_code = None
                        else:
                            logger.info(f"[INFO] Setting team for task {pt_title} (predefined_task_id: {pt_id}) to {final_team_code}")
                
                # Note: We do NOT automatically assign team lead - assignee remains NULL if not explicitly provided
                if not final_team_code:
                    logger.info(f"[INFO] Task '{pt_title}' has no assignee and no team. Creating task without assignee and team.")
                else:
                    logger.info(f"[INFO] Task '{pt_title}' has team {final_team_code} but no assignee. Creating task without assignee (assignee will be NULL).")
            
            # Step 13.1.5: ALWAYS use assignee's team code from user_master (overrides any provided team_code)
            if final_assignee:
                cursor.execute("SELECT team_code FROM sts_new.user_master WHERE user_code = %s", (final_assignee,))
                assignee_team_result = cursor.fetchone()
                if assignee_team_result:
                    final_team_code = assignee_team_result[0]
                    logger.info(f"[INFO] Using assignee {final_assignee}'s team code from user_master for task '{pt_title}': {final_team_code}")
                else:
                    logger.warning(f"[WARNING] Could not find team code for assignee {final_assignee} in user_master, keeping existing final_team_code: {final_team_code}")
            
            # Step 13.1.6: Get task_type_code from task_type_codes_dict if provided
            final_task_type_code = None
            if task_type_codes_dict:
                # Check if there's a task_type_code override for this predefined task
                if str(pt_id) in task_type_codes_dict:
                    task_type_code_override = task_type_codes_dict[str(pt_id)]
                    if task_type_code_override and str(task_type_code_override).strip():
                        task_type_code_str = str(task_type_code_override).strip().upper()
                        # Validate task_type_code is one of the allowed enum values
                        try:
                            task_type_code_enum = TaskTypeCode(task_type_code_str)
                            final_task_type_code = task_type_code_enum.value
                            logger.info(f"[INFO] Using task_type_code {final_task_type_code} for task '{pt_title}' (predefined_task_id: {pt_id})")
                        except ValueError:
                            raise HTTPException(
                                status_code=HTTPStatus.BAD_REQUEST,
                                detail=f"Task type code '{task_type_code_str}' is not allowed for predefined_task_id {pt_id}. Allowed values are: TT001 (Accounts), TT002 (Development), TT003 (Quality Assurance), TT004 (User Acceptance Testing), TT005 (PROD Move), TT006 (Documentation), TT007 (Design), TT008 (Code Review), TT009 (Meeting), TT010 (Training), TT011 (Implementation), TT012 (Support)"
                            )
                        # Validate task_type_code exists in database
                        cursor.execute("SELECT type_code FROM sts_ts.task_type_master WHERE type_code = %s AND is_active = true", (final_task_type_code,))
                        if not cursor.fetchone():
                            raise HTTPException(
                                status_code=HTTPStatus.BAD_REQUEST,
                                detail=f"Task type code {final_task_type_code} does not exist or is not active"
                            )
                elif pt_id in task_type_codes_dict:
                    # Also check with integer key (in case JSON parser converts to int)
                    task_type_code_override = task_type_codes_dict[pt_id]
                    if task_type_code_override and str(task_type_code_override).strip():
                        task_type_code_str = str(task_type_code_override).strip().upper()
                        try:
                            task_type_code_enum = TaskTypeCode(task_type_code_str)
                            final_task_type_code = task_type_code_enum.value
                            logger.info(f"[INFO] Using task_type_code {final_task_type_code} for task '{pt_title}' (predefined_task_id: {pt_id})")
                        except ValueError:
                            raise HTTPException(
                                status_code=HTTPStatus.BAD_REQUEST,
                                detail=f"Task type code '{task_type_code_str}' is not allowed for predefined_task_id {pt_id}. Allowed values are: TT001-TT012"
                            )
                        cursor.execute("SELECT type_code FROM sts_ts.task_type_master WHERE type_code = %s AND is_active = true", (final_task_type_code,))
                        if not cursor.fetchone():
                            raise HTTPException(
                                status_code=HTTPStatus.BAD_REQUEST,
                                detail=f"Task type code {final_task_type_code} does not exist or is not active"
                            )
            
            # Step 13.2: Check if task already exists (same predefined_task_id + epic_code) and update, otherwise create new
            cursor.execute("""
                SELECT id FROM sts_ts.tasks
                WHERE predefined_task_id = %s
                AND epic_code = %s
                ORDER BY created_at DESC
                LIMIT 1
            """, (pt_id, new_epic_id))
            
            existing_task = cursor.fetchone()
            
            if existing_task:
                # Update existing task instead of creating new one
                new_task_id = existing_task[0]
                logger.info(f"[INFO] Task with same predefined_task_id {pt_id} and epic_code {new_epic_id} already exists with ID: {new_task_id}, updating instead of creating new")
                
                # If status is changing to "In Progress" (STS007), ensure start_date is set to today
                # Note: task_start_date was already set above based on status
                update_start_date = task_start_date
                if pt_status == 'STS007':
                    # If status is In Progress, use today's date as start_date
                    update_start_date = current_time.date()
                    logger.info(f"[INFO] Updating task '{pt_title}' to In Progress status, setting start_date to {update_start_date}")
                
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
                        predefined_task_id = %s,
                        updated_by = %s,
                        updated_at = %s
                    WHERE id = %s
                """
                
                cursor.execute(task_update_query, (
                    pt_title, pt_description, final_assignee, created_by, final_team_code,
                    pt_status, pt_priority, final_task_type_code, pt_work_mode,
                    update_start_date, update_start_date, task_due_date,
                    float(pt_estimated_hours), float(pt_max_hours), pt_is_billable,
                    final_product_code, pt_id, created_by, current_time, new_task_id
                ))
                logger.info(f"[INFO] Task '{pt_title}' updated successfully with ID: {new_task_id}")
                
                # Add updated task to created_tasks list so it appears in response
                created_tasks.append({
                    "id": new_task_id,
                    "task_title": pt_title,
                    "assignee": final_assignee,
                    "start_date": task_start_date.isoformat(),
                    "due_date": task_due_date.isoformat(),
                    "action": "updated"  # Indicate this was an update, not a new creation
                })
                
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
                    new_task_id, pt_status, pt_priority, final_task_type_code,
                    final_product_code, final_team_code, final_assignee, created_by,
                    pt_work_mode, task_start_date, task_start_date, task_due_date,
                    float(pt_estimated_hours), float(pt_max_hours), created_by, current_time
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
                    pt_title, pt_description, new_epic_id, final_assignee,
                    created_by,  # reporter = created_by for tasks
                    final_team_code, pt_status, pt_priority, final_task_type_code, pt_work_mode,
                    task_start_date,  # assigned_on = start_date
                    task_start_date, task_due_date,
                    float(pt_estimated_hours), float(pt_max_hours), pt_is_billable,
                    final_product_code, pt_id, created_by, current_time
                ))
                
                task_result = cursor.fetchone()
                new_task_id = task_result[0]
                logger.info(f"[INFO] Task '{pt_title}' created successfully with ID: {new_task_id}")
                
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
                    new_task_id, pt_status, pt_priority, final_task_type_code,
                    final_product_code, final_team_code, final_assignee, created_by,
                    pt_work_mode, task_start_date, task_start_date, task_due_date,
                    float(pt_estimated_hours), float(pt_max_hours), created_by, current_time
                ))
                logger.info(f"[INFO] Initial task history entry created successfully")
            
            created_tasks.append({
                "id": new_task_id,
                "task_title": pt_title,
                "assignee": final_assignee,
                "start_date": task_start_date.isoformat(),
                "due_date": task_due_date.isoformat(),
                    "action": "created"  # Indicate this was a new creation
            })
            
            # Note: usage_count column has been removed from predefined_tasks table

        # Step 14: Handle epic attachments (similar to create_epic.py)
        epic_attachments = []
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
                            'EPIC', %s, %s, %s, %s, %s, %s, 'EPIC_ATTACHMENT', %s, %s
                        ) RETURNING id
                    """
                    
                    cursor.execute(attachment_insert_query, (
                        new_epic_id, attachment.filename, file_path, file_url,
                        attachment.content_type or "application/octet-stream",
                        file_size_str, created_by, current_time
                    ))
                    
                    attachment_result = cursor.fetchone()
                    attachment_id = attachment_result[0]
                    
                    epic_attachments.append({
                        "id": attachment_id,
                        "file_name": attachment.filename,
                        "file_path": file_path,
                        "file_url": file_url,
                        "file_type": attachment.content_type,
                        "file_size": file_size_str,
                    })
                    logger.info(f"[INFO] Attachment '{attachment.filename}' saved successfully for epic {new_epic_id}")
                except Exception as e:
                    logger.error(f"[ERROR] Error saving attachment {attachment.filename}: {str(e)}")
                    # Continue with other attachments even if one fails

        # Note: usage_count column has been removed from predefined_epics table

        # Commit all changes
        conn.commit()
        logger.info(f"[INFO] Epic and tasks created successfully from predefined template {predefined_epic_id}")

        # Step 16: Fetch created epic data for response
        cursor.execute("""
            SELECT 
                e.id, e.epic_title, e.epic_description,
                e.product_code, pm.product_name,
                e.company_code, cm.company_name,
                e.contact_person_code, cpm.full_name AS contact_person_name,
                e.reporter, um_reporter.user_name AS reporter_name,
                e.status_code, sm.status_desc,
                e.priority_code, pr.priority_desc,
                e.start_date, e.due_date, e.closed_on,
                e.estimated_hours, e.max_hours, e.is_billable,
                e.created_by, e.created_at, e.updated_by, e.updated_at
            FROM sts_ts.epics e
            LEFT JOIN sts_new.product_master pm ON e.product_code = pm.product_code
            LEFT JOIN sts_new.company_master cm ON e.company_code = cm.company_code
            LEFT JOIN sts_new.contact_master cpm ON e.contact_person_code = cpm.contact_person_code
            LEFT JOIN sts_new.user_master um_reporter ON e.reporter = um_reporter.user_code
            LEFT JOIN sts_new.status_master sm ON e.status_code = sm.status_code
            LEFT JOIN sts_new.tkt_priority_master pr ON e.priority_code = pr.priority_code
            WHERE e.id = %s
        """, (new_epic_id,))
        
        epic_data = cursor.fetchone()
        
        if not epic_data:
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created epic data"
            )

        # Build response
        response_data = {
            "id": epic_data[0],
            "epic_title": epic_data[1],
            "epic_description": epic_data[2],
            "product_code": epic_data[3],
            "product_name": epic_data[4],
            "company_code": epic_data[5],
            "company_name": epic_data[6],
            "contact_person_code": epic_data[7],
            "contact_person_name": epic_data[8],
            "reporter": epic_data[9],
            "reporter_name": epic_data[10],
            "status_code": epic_data[11],
            "status_description": epic_data[12],
            "priority_code": epic_data[13],
            "priority_description": epic_data[14],
            "start_date": epic_data[15].isoformat() if epic_data[15] else None,
            "due_date": epic_data[16].isoformat() if epic_data[16] else None,
            "closed_on": epic_data[17].isoformat() if epic_data[17] else None,
            "estimated_hours": float(epic_data[18]) if epic_data[18] else None,
            "max_hours": float(epic_data[19]) if epic_data[19] else None,
            "is_billable": epic_data[20],
            "created_by": epic_data[21],
            "created_at": epic_data[22].isoformat() if epic_data[22] else None,
            "updated_by": epic_data[23],
            "updated_at": epic_data[24].isoformat() if epic_data[24] else None,
            "tasks": created_tasks,
            "attachments": epic_attachments,
            "tasks_count": len(created_tasks),
            "tasks_created": len([t for t in created_tasks if t.get("action") == "created"]),
            "tasks_updated": len([t for t in created_tasks if t.get("action") == "updated"]),
        }

        logger.info(f"[INFO] Epic creation from predefined template completed successfully")
        
        # Build appropriate message based on what was done
        tasks_created_count = len([t for t in created_tasks if t.get("action") == "created"])
        tasks_updated_count = len([t for t in created_tasks if t.get("action") == "updated"])
        
        if existing_epic:
            if tasks_created_count > 0 and tasks_updated_count > 0:
                message = f"Epic updated from predefined template '{template_title}'. {tasks_created_count} new task(s) created, {tasks_updated_count} existing task(s) updated."
            elif tasks_created_count > 0:
                message = f"Epic updated from predefined template '{template_title}'. {tasks_created_count} new task(s) added."
            elif tasks_updated_count > 0:
                message = f"Epic updated from predefined template '{template_title}'. {tasks_updated_count} existing task(s) updated."
            else:
                message = f"Epic updated from predefined template '{template_title}'."
        else:
            message = f"Epic created successfully from predefined template '{template_title}' with {len(created_tasks)} task(s)."
        
        return {
            "success": True,
            "status_code": HTTPStatus.OK,
            "status_message": "OK",
            "message": message,
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
            logger.info(f"[INFO] Database connection closed for epic creation from template")

