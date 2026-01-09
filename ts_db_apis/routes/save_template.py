# routes/save_template.py

import sys
import os
sys.path.append('E:\projects\sts_prod_developement')

from fastapi import APIRouter, HTTPException, Form, Depends
from auth.jwt_handler import verify_token
from http import HTTPStatus
from helper_functions import get_current_time_ist, parse_date
import psycopg2
from utils.connect_to_psql import connect_to_psql
from config import load_config
from utils.logger import get_logger
from typing import Optional
import traceback
import json
from datetime import datetime
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

# Template Type Enum
class TemplateType(str, Enum):
    EPIC = "EPIC"
    TASK = "TASK"

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

@router.post("/api/v1/timesheet/save_template")
async def save_template(
    # Template type and identification
    template_type: TemplateType = Form(..., description="Type of template: EPIC or TASK"),
    template_id: Optional[int] = Form(None, description="Template ID to update (if provided, updates existing; otherwise creates new)"),
    
    # Epic template fields (required only if template_type = EPIC)
    epic_title: Optional[str] = Form(None, description="Epic template title (required for EPIC type, must be unique)"),
    epic_description: Optional[str] = Form(None, description="Epic template description (for EPIC type)"),
    contact_person_code: Optional[str] = Form(None, description="Contact person code (optional, for EPIC type)"),
    priority_code: Optional[int] = Form(None, description="Priority code (required for EPIC type)"),
    estimated_hours: Optional[float] = Form(None, description="Estimated hours (required for EPIC type)"),
    max_hours: Optional[float] = Form(None, description="Max hours (required for EPIC type)"),
    is_billable: Optional[bool] = Form(True, description="Is billable (default: True, for EPIC type)"),
    is_active: Optional[bool] = Form(True, description="Is active (default: True, for EPIC type)"),
    
    # Task template fields (required only if template_type = TASK)
    task_title: Optional[str] = Form(None, description="Task template title (required for TASK type)"),
    task_description: Optional[str] = Form(None, description="Task template description (for TASK type)"),
    task_status_code: Optional[StatusCode] = Form(StatusCode.NOT_YET_STARTED, description="Task status code (for TASK type, default: STS001)"),
    task_priority_code: Optional[int] = Form(None, description="Task priority code (required for TASK type)"),
    task_type_code: Optional[str] = Form(None, description="Task type code (optional, for TASK type, e.g., TT001-TT012)"),
    work_mode: Optional[WorkMode] = Form(None, description="Work mode: REMOTE, ON_SITE, or OFFICE (required for TASK type)"),
    team_code: Optional[str] = Form(None, description="Team code (optional, for TASK type)"),
    task_estimated_hours: Optional[float] = Form(None, description="Task estimated hours (required for TASK type, must be > 0)"),
    task_max_hours: Optional[float] = Form(None, description="Task max hours (required for TASK type, must be > 0)"),
    task_is_billable: Optional[bool] = Form(True, description="Task is billable (default: True, for TASK type)"),
    
    # Tasks for epic template (required only if template_type = EPIC)
    # JSON array of tasks to create or link
    # Each task can have: task_title, task_description, status_code, priority_code, work_mode, 
    # team_code, estimated_hours, max_hours, is_billable, predefined_task_id
    # If predefined_task_id is provided, links existing task. Otherwise creates new task.
    tasks: Optional[str] = Form(None, description="JSON array of tasks (for EPIC type only). Example: [{'task_title': 'Task 1', 'priority_code': 2, 'work_mode': 'REMOTE', 'max_hours': 15}, {'predefined_task_id': 1}]"),
    
    current_user: dict = Depends(verify_token),
):
    """
    Save or update a predefined template (Epic or Task).
    
    For EPIC templates:
    - Provide epic fields (epic_title, priority_code, estimated_hours, max_hours are required)
    - Optionally provide tasks array to create/link tasks
    
    For TASK templates:
    - Provide task fields (task_title, task_priority_code, work_mode, task_max_hours are required)
    - No tasks array needed (standalone task template)
    
    Returns the saved template with details.
    """
    logger.info(f"[INFO] Starting template save/update, type: {template_type}, template_id: {template_id}, user: {current_user['user_code']}")
    
    conn = None
    cursor = None

    try:
        logger.info(f"[INFO] Establishing database connection for template save/update")
        conn = connect_to_psql(host, port, username, password, database_name, schema_name)
        cursor = conn.cursor()
        logger.info(f"[INFO] Database connection established successfully")

        user_code = current_user['user_code']
        current_time = get_current_time_ist()

        if template_type == TemplateType.EPIC:
            # ============================================
            # HANDLE EPIC TEMPLATE
            # ============================================
            logger.info(f"[INFO] Processing EPIC template")
            
            # Validate required epic fields
            if not epic_title or not epic_title.strip():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="epic_title is required for EPIC template type"
                )
            
            if priority_code is None:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="priority_code is required for EPIC template type"
                )
            
            if estimated_hours is None:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="estimated_hours is required for EPIC template type"
                )
            
            if max_hours is None:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="max_hours is required for EPIC template type"
                )
            
            if estimated_hours <= 0:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Estimated hours must be greater than 0"
                )
            
            if max_hours <= 0:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Max hours must be greater than 0"
                )
            
            if max_hours < estimated_hours:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Max hours cannot be less than estimated hours"
                )
            
            # Validate priority_code exists
            cursor.execute("SELECT priority_code FROM sts_new.tkt_priority_master WHERE priority_code = %s", (priority_code,))
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Priority code {priority_code} does not exist"
                )
            
            # Validate contact_person_code if provided
            if contact_person_code and contact_person_code.strip():
                cursor.execute(
                    "SELECT contact_person_code FROM sts_new.contact_master WHERE contact_person_code = %s AND is_inactive = false",
                    (contact_person_code.strip(),)
                )
                if not cursor.fetchone():
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail=f"Contact person with code {contact_person_code} does not exist or is inactive"
                    )
            
            # Check if updating or creating epic template
            if template_id:
                # Update existing epic template
                logger.info(f"[INFO] Updating existing epic template with ID: {template_id}")
                
                cursor.execute("SELECT id, title FROM sts_ts.predefined_epics WHERE id = %s", (template_id,))
                existing_template = cursor.fetchone()
                if not existing_template:
                    raise HTTPException(
                        status_code=HTTPStatus.NOT_FOUND,
                        detail=f"Epic template with ID {template_id} does not exist"
                    )
                
                existing_title = existing_template[1]
                
                # Check title uniqueness (only if title is being changed)
                if epic_title.strip() != existing_title:
                    cursor.execute("SELECT id FROM sts_ts.predefined_epics WHERE title = %s AND id != %s", (epic_title.strip(), template_id))
                    if cursor.fetchone():
                        raise HTTPException(
                            status_code=HTTPStatus.BAD_REQUEST,
                            detail=f"Epic template with title '{epic_title.strip()}' already exists. Title must be unique."
                        )
                
                # Update epic template
                update_query = """
                    UPDATE sts_ts.predefined_epics SET
                        title = %s,
                        description = %s,
                        contact_person_code = %s,
                        priority_code = %s,
                        estimated_hours = %s,
                        max_hours = %s,
                        is_billable = %s,
                        is_active = %s,
                        updated_by = %s,
                        updated_at = %s
                    WHERE id = %s
                    RETURNING id
                """
                
                cursor.execute(update_query, (
                    epic_title.strip(),
                    epic_description.strip() if epic_description else None,
                    contact_person_code.strip() if contact_person_code else None,
                    priority_code,
                    estimated_hours,
                    max_hours,
                    is_billable if is_billable is not None else True,
                    is_active if is_active is not None else True,
                    user_code,
                    current_time,
                    template_id
                ))
                
                result = cursor.fetchone()
                if not result:
                    raise HTTPException(
                        status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                        detail="Failed to update epic template"
                    )
                
                saved_template_id = result[0]
                logger.info(f"[INFO] Epic template updated successfully with ID: {saved_template_id}")
                
            else:
                # Create new epic template
                logger.info(f"[INFO] Creating new epic template")
                
                # Check title uniqueness
                cursor.execute("SELECT id FROM sts_ts.predefined_epics WHERE title = %s", (epic_title.strip(),))
                if cursor.fetchone():
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail=f"Epic template with title '{epic_title.strip()}' already exists. Title must be unique."
                    )
                
                # Insert new epic template
                insert_query = """
                    INSERT INTO sts_ts.predefined_epics (
                        title, description, contact_person_code, priority_code,
                        estimated_hours, max_hours, is_billable, is_active,
                        created_by, created_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    ) RETURNING id
                """
                
                cursor.execute(insert_query, (
                    epic_title.strip(),
                    epic_description.strip() if epic_description else None,
                    contact_person_code.strip() if contact_person_code else None,
                    priority_code,
                    estimated_hours,
                    max_hours,
                    is_billable if is_billable is not None else True,
                    is_active if is_active is not None else True,
                    user_code,
                    current_time
                ))
                
                result = cursor.fetchone()
                if not result:
                    raise HTTPException(
                        status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                        detail="Failed to create epic template"
                    )
                
                saved_template_id = result[0]
                logger.info(f"[INFO] Epic template created successfully with ID: {saved_template_id}")
            
            # Handle tasks for epic template if provided
            created_tasks = []
            linked_tasks = []
            
            if tasks and tasks.strip():
                try:
                    tasks_list = json.loads(tasks)
                    if not isinstance(tasks_list, list):
                        raise ValueError("tasks must be a JSON array")
                    
                    logger.info(f"[INFO] Processing {len(tasks_list)} tasks for epic template")
                    
                    for task_data in tasks_list:
                        if not isinstance(task_data, dict):
                            raise ValueError("Each task must be a JSON object")
                        
                        # Track task ID for linking to epic
                        task_id_to_link = None
                        task_title_to_link = None
                        
                        # Check if linking existing task or creating new
                        if 'predefined_task_id' in task_data and task_data['predefined_task_id']:
                            # Link existing task
                            existing_task_id = int(task_data['predefined_task_id'])
                            
                            cursor.execute("SELECT id, task_title FROM sts_ts.predefined_tasks WHERE id = %s", (existing_task_id,))
                            existing_task = cursor.fetchone()
                            if not existing_task:
                                raise HTTPException(
                                    status_code=HTTPStatus.BAD_REQUEST,
                                    detail=f"Predefined task with ID {existing_task_id} does not exist"
                                )
                            
                            task_id_to_link = existing_task_id
                            task_title_to_link = existing_task[1]
                            
                            linked_tasks.append({
                                "id": existing_task_id,
                                "task_title": existing_task[1]
                            })
                            logger.info(f"[INFO] Linked existing predefined task ID: {existing_task_id}")
                        
                        else:
                            # Create new task or link to existing if duplicate title found
                            task_result = _create_predefined_task(cursor, task_data, user_code, current_time)
                            task_id_to_link = task_result[0]
                            task_title_to_link = task_result[1]
                            is_new = task_result[2]
                            
                            if is_new:
                                # Newly created task
                                created_tasks.append({
                                    "id": task_id_to_link,
                                    "task_title": task_title_to_link
                                })
                                logger.info(f"[INFO] Created new predefined task ID: {task_id_to_link}, title: {task_title_to_link}")
                            else:
                                # Existing task that was linked (duplicate title found)
                                linked_tasks.append({
                                    "id": task_id_to_link,
                                    "task_title": task_title_to_link
                                })
                                logger.info(f"[INFO] Linked to existing predefined task ID: {task_id_to_link}, title: {task_title_to_link} (duplicate title detected)")
                        
                        # Link task to epic template by updating predefined_epic_id
                        if task_id_to_link:
                            # Check if task already belongs to this epic (prevent duplicates)
                            cursor.execute("""
                                SELECT predefined_epic_id FROM sts_ts.predefined_tasks 
                                WHERE id = %s
                            """, (task_id_to_link,))
                            
                            task_result = cursor.fetchone()
                            current_epic_id = task_result[0] if task_result else None
                            
                            if current_epic_id != saved_template_id:
                                # Update predefined_epic_id to link task to epic template
                                cursor.execute("""
                                    UPDATE sts_ts.predefined_tasks 
                                    SET predefined_epic_id = %s,
                                        updated_by = %s,
                                        updated_at = %s
                                    WHERE id = %s
                                """, (saved_template_id, user_code, current_time, task_id_to_link))
                                logger.info(f"[INFO] Linked task {task_id_to_link} to epic template {saved_template_id}")
                            else:
                                logger.info(f"[INFO] Task {task_id_to_link} already linked to epic template {saved_template_id}, skipping")
                
                except json.JSONDecodeError as e:
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail=f"Invalid JSON format for tasks: {str(e)}"
                    )
                except ValueError as e:
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail=str(e)
                    )
            
            # Fetch saved epic template
            cursor.execute("""
                SELECT 
                    pe.id, pe.title, pe.description,
                    pe.contact_person_code, cpm.full_name AS contact_person_name,
                    pe.priority_code, pr.priority_desc AS priority_description,
                    pe.estimated_hours, pe.max_hours, pe.is_billable, pe.is_active,
                    pe.created_by, um_created.user_name AS created_by_name, pe.created_at,
                    pe.updated_by, um_updated.user_name AS updated_by_name, pe.updated_at
                FROM sts_ts.predefined_epics pe
                LEFT JOIN sts_new.contact_master cpm ON pe.contact_person_code = cpm.contact_person_code
                LEFT JOIN sts_new.tkt_priority_master pr ON pe.priority_code = pr.priority_code
                LEFT JOIN sts_new.user_master um_created ON pe.created_by = um_created.user_code
                LEFT JOIN sts_new.user_master um_updated ON pe.updated_by = um_updated.user_code
                WHERE pe.id = %s
            """, (saved_template_id,))
            
            template_data = cursor.fetchone()
            
            if not template_data:
                raise HTTPException(
                    status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                    detail="Failed to retrieve saved template data"
                )
            
            # Build epic template response
            response_data = {
                "template_type": "EPIC",
                "id": template_data[0],
                "title": template_data[1],
                "description": template_data[2],
                "contact_person_code": template_data[3],
                "contact_person_name": template_data[4],
                "priority_code": template_data[5],
                "priority_description": template_data[6],
                "estimated_hours": float(template_data[7]) if template_data[7] else None,
                "max_hours": float(template_data[8]) if template_data[8] else None,
                "is_billable": template_data[9],
                "is_active": template_data[10],
                "created_by": template_data[11],
                "created_by_name": template_data[12],
                "created_at": template_data[13].isoformat() if template_data[13] else None,
                "updated_by": template_data[14],
                "updated_by_name": template_data[15],
                "updated_at": template_data[16].isoformat() if template_data[16] else None,
                "created_tasks": created_tasks,
                "linked_tasks": linked_tasks,
                "total_tasks": len(created_tasks) + len(linked_tasks)
            }
            
        else:
            # ============================================
            # HANDLE TASK TEMPLATE
            # ============================================
            logger.info(f"[INFO] Processing TASK template")
            
            # Validate required task fields
            if not task_title or not task_title.strip():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="task_title is required for TASK template type"
                )
            
            if task_priority_code is None:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="task_priority_code is required for TASK template type"
                )
            
            if work_mode is None:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="work_mode is required for TASK template type"
                )
            
            if task_estimated_hours is None:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="task_estimated_hours is required for TASK template type"
                )
            
            if task_max_hours is None:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="task_max_hours is required for TASK template type"
                )
            
            # Validate hours
            if task_estimated_hours <= 0:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Task estimated_hours must be greater than 0"
                )
            
            if task_max_hours <= 0:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Task max_hours must be greater than 0"
                )
            
            if task_estimated_hours > task_max_hours:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Task estimated_hours cannot be greater than max_hours"
                )
            
            # Validate work_mode
            work_mode_str = work_mode.value if isinstance(work_mode, WorkMode) else str(work_mode).strip().upper()
            if work_mode_str not in ['REMOTE', 'ON_SITE', 'OFFICE']:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Invalid work_mode '{work_mode_str}'. Allowed values: REMOTE, ON_SITE, OFFICE"
                )
            
            # Validate status_code
            status_code_str = task_status_code.value if isinstance(task_status_code, StatusCode) else str(task_status_code).strip().upper()
            if status_code_str not in ['STS001', 'STS007', 'STS002', 'STS010']:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Invalid status_code '{status_code_str}'. Allowed values: STS001, STS007, STS002, STS010"
                )
            
            # Validate priority_code
            cursor.execute("SELECT priority_code FROM sts_new.tkt_priority_master WHERE priority_code = %s", (task_priority_code,))
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Priority code {task_priority_code} does not exist"
                )
            
            # Validate team_code if provided
            task_team_code = None
            if team_code and team_code.strip():
                task_team_code = team_code.strip()
                cursor.execute("SELECT team_code FROM sts_new.team_master WHERE team_code = %s AND is_active = true", (task_team_code,))
                if not cursor.fetchone():
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail=f"Team code {task_team_code} does not exist or is inactive"
                    )
            
            # Validate task_type_code if provided
            task_type_code_val = None
            if task_type_code and task_type_code.strip():
                task_type_code_str = str(task_type_code).strip().upper()
                cursor.execute("SELECT type_code FROM sts_ts.task_type_master WHERE type_code = %s AND is_active = true", (task_type_code_str,))
                if not cursor.fetchone():
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail=f"Task type code {task_type_code_str} does not exist or is not active"
                    )
                task_type_code_val = task_type_code_str
            
            # Validate hours
            if task_max_hours <= 0:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Task max_hours must be greater than 0"
                )
            
            # Check if updating or creating task template
            if template_id:
                # Update existing task template
                logger.info(f"[INFO] Updating existing task template with ID: {template_id}")
                
                cursor.execute("SELECT id FROM sts_ts.predefined_tasks WHERE id = %s", (template_id,))
                if not cursor.fetchone():
                    raise HTTPException(
                        status_code=HTTPStatus.NOT_FOUND,
                        detail=f"Task template with ID {template_id} does not exist"
                    )
                
                # Update task template
                update_query = """
                    UPDATE sts_ts.predefined_tasks SET
                        task_title = %s,
                        task_description = %s,
                        status_code = %s,
                        priority_code = %s,
                        task_type_code = %s,
                        work_mode = %s,
                        team_code = %s,
                        estimated_hours = %s,
                        max_hours = %s,
                        is_billable = %s,
                        updated_by = %s,
                        updated_at = %s
                    WHERE id = %s
                    RETURNING id
                """
                
                cursor.execute(update_query, (
                    task_title.strip(),
                    task_description.strip() if task_description else None,
                    status_code_str,
                    task_priority_code,
                    task_type_code_val,  # task_type_code (nullable)
                    work_mode_str,
                    task_team_code,
                    task_estimated_hours,
                    task_max_hours,
                    task_is_billable if task_is_billable is not None else True,
                    user_code,
                    current_time,
                    template_id
                ))
                
                result = cursor.fetchone()
                if not result:
                    raise HTTPException(
                        status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                        detail="Failed to update task template"
                    )
                
                saved_template_id = result[0]
                logger.info(f"[INFO] Task template updated successfully with ID: {saved_template_id}")
                
            else:
                # Create new task template
                logger.info(f"[INFO] Creating new task template")
                
                # Insert new task template
                insert_query = """
                    INSERT INTO sts_ts.predefined_tasks (
                        task_title, task_description, status_code, priority_code, task_type_code, work_mode,
                        team_code,
                        estimated_hours, max_hours, is_billable,
                        created_by, created_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    ) RETURNING id
                """
                
                cursor.execute(insert_query, (
                    task_title.strip(),
                    task_description.strip() if task_description else None,
                    status_code_str,
                    task_priority_code,
                    task_type_code_val,  # task_type_code (nullable)
                    work_mode_str,
                    task_team_code,
                    task_estimated_hours,  # Use provided estimated_hours (validated to be > 0)
                    task_max_hours,
                    task_is_billable if task_is_billable is not None else True,
                    user_code,
                    current_time
                ))
                
                result = cursor.fetchone()
                if not result:
                    raise HTTPException(
                        status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                        detail="Failed to create task template"
                    )
                
                saved_template_id = result[0]
                logger.info(f"[INFO] Task template created successfully with ID: {saved_template_id}")
            
            # Fetch saved task template
            cursor.execute("""
                SELECT 
                    pt.id, pt.task_title, pt.task_description,
                    pt.status_code, sm.status_desc AS status_description,
                    pt.priority_code, pr.priority_desc AS priority_description,
                    pt.work_mode, pt.team_code, tm.team_name AS team_name,
                    pt.max_hours, pt.is_billable,
                    pt.created_by, um_created.user_name AS created_by_name, pt.created_at,
                    pt.updated_by, um_updated.user_name AS updated_by_name, pt.updated_at
                FROM sts_ts.predefined_tasks pt
                LEFT JOIN sts_new.status_master sm ON pt.status_code = sm.status_code
                LEFT JOIN sts_new.tkt_priority_master pr ON pt.priority_code = pr.priority_code
                LEFT JOIN sts_new.team_master tm ON pt.team_code = tm.team_code
                LEFT JOIN sts_new.user_master um_created ON pt.created_by = um_created.user_code
                LEFT JOIN sts_new.user_master um_updated ON pt.updated_by = um_updated.user_code
                WHERE pt.id = %s
            """, (saved_template_id,))
            
            template_data = cursor.fetchone()
            
            if not template_data:
                raise HTTPException(
                    status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                    detail="Failed to retrieve saved template data"
                )
            
            # Build task template response
            response_data = {
                "template_type": "TASK",
                "id": template_data[0],
                "task_title": template_data[1],
                "task_description": template_data[2],
                "status_code": template_data[3],
                "status_description": template_data[4],
                "priority_code": template_data[5],
                "priority_description": template_data[6],
                "work_mode": template_data[7],
                "team_code": template_data[8],
                "team_name": template_data[9],
                "max_hours": float(template_data[10]) if template_data[10] else None,
                "is_billable": template_data[11],
                "created_by": template_data[12],
                "created_by_name": template_data[13],
                "created_at": template_data[14].isoformat() if template_data[14] else None,
                "updated_by": template_data[15],
                "updated_by_name": template_data[16],
                "updated_at": template_data[17].isoformat() if template_data[17] else None
            }

        # Step 6: Commit transaction
        conn.commit()
        logger.info(f"[INFO] Template saved successfully with ID: {saved_template_id}")

        logger.info(f"[INFO] Template save/update completed successfully")
        
        return {
            "success": True,
            "status_code": HTTPStatus.OK,
            "status_message": "OK",
            "message": f"{template_type.value} template {'updated' if template_id else 'created'} successfully",
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
            logger.info(f"[INFO] Database connection closed for template save/update")


def _create_predefined_task(cursor, task_data, user_code, current_time):
    """
    Helper function to create a predefined task from task data dictionary.
    Checks if a task with the same title already exists (case-insensitive).
    Returns (task_id, task_title, is_new) tuple where is_new is True if created, False if existing.
    """
    # Required fields validation
    if 'task_title' not in task_data or not task_data['task_title']:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail="task_title is required when creating a new predefined task"
        )
    
    if 'priority_code' not in task_data:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail="priority_code is required when creating a new predefined task"
        )
    
    if 'work_mode' not in task_data:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail="work_mode is required when creating a new predefined task"
        )
    
    if 'max_hours' not in task_data:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail="max_hours is required when creating a new predefined task"
        )
    
    # Validate work_mode
    work_mode_str = str(task_data['work_mode']).strip().upper()
    if work_mode_str not in ['REMOTE', 'ON_SITE', 'OFFICE']:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=f"Invalid work_mode '{work_mode_str}'. Allowed values: REMOTE, ON_SITE, OFFICE"
        )
    
    # Validate status_code if provided
    status_code_str = 'STS001'  # Default
    if 'status_code' in task_data and task_data['status_code']:
        status_code_str = str(task_data['status_code']).strip().upper()
        if status_code_str not in ['STS001', 'STS007', 'STS002', 'STS010']:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Invalid status_code '{status_code_str}'. Allowed values: STS001, STS007, STS002, STS010"
            )
    
    # Validate priority_code
    task_priority_code = int(task_data['priority_code'])
    cursor.execute("SELECT priority_code FROM sts_new.tkt_priority_master WHERE priority_code = %s", (task_priority_code,))
    if not cursor.fetchone():
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=f"Priority code {task_priority_code} does not exist"
        )
    
    # Validate team_code if provided
    task_team_code = None
    if 'team_code' in task_data and task_data['team_code']:
        task_team_code = str(task_data['team_code']).strip()
        cursor.execute("SELECT team_code FROM sts_new.team_master WHERE team_code = %s AND is_active = true", (task_team_code,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Team code {task_team_code} does not exist or is inactive"
            )
    
    # Validate task_type_code if provided
    task_type_code = None
    if 'task_type_code' in task_data and task_data['task_type_code']:
        task_type_code_str = str(task_data['task_type_code']).strip().upper()
        cursor.execute("SELECT type_code FROM sts_ts.task_type_master WHERE type_code = %s AND is_active = true", (task_type_code_str,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Task type code {task_type_code_str} does not exist or is not active"
            )
        task_type_code = task_type_code_str
    
    # Validate hours
    task_estimated_hours = float(task_data.get('estimated_hours', 0))
    task_max_hours = float(task_data['max_hours'])
    
    if task_estimated_hours <= 0:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail="Task estimated_hours must be greater than 0"
        )
    
    if task_max_hours <= 0:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail="Task max_hours must be greater than 0"
        )
    
    if task_estimated_hours > task_max_hours:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail="Task estimated_hours cannot be greater than max_hours"
        )
    
    # Check if a task with the same title already exists (case-insensitive)
    task_title_trimmed = str(task_data['task_title']).strip()
    cursor.execute("""
        SELECT id, task_title 
        FROM sts_ts.predefined_tasks 
        WHERE LOWER(TRIM(task_title)) = LOWER(TRIM(%s))
        LIMIT 1
    """, (task_title_trimmed,))
    
    existing_task = cursor.fetchone()
    
    if existing_task:
        # Task with same title already exists, return existing task ID
        logger.info(f"[INFO] Task with title '{task_title_trimmed}' already exists with ID {existing_task[0]}. Linking to existing task instead of creating duplicate.")
        return (existing_task[0], existing_task[1], False)  # False = not new, existing task
    
    # No existing task found, create new predefined task
    task_insert_query = """
        INSERT INTO sts_ts.predefined_tasks (
            task_title, task_description, status_code, priority_code, task_type_code, work_mode,
            team_code,
            estimated_hours, max_hours, is_billable,
            created_by, created_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        ) RETURNING id, task_title
    """
    
    cursor.execute(task_insert_query, (
        task_title_trimmed,
        task_data.get('task_description', '').strip() if task_data.get('task_description') else None,
        status_code_str,
        task_priority_code,
        task_type_code,  # task_type_code (nullable)
        work_mode_str,
        task_team_code,
        task_estimated_hours,  # Use provided estimated_hours (validated to be > 0)
        task_max_hours,
        task_data.get('is_billable', True) if 'is_billable' in task_data else True,
        user_code,
        current_time
    ))
    
    new_task = cursor.fetchone()
    return (new_task[0], new_task[1], True)  # True = new task created

