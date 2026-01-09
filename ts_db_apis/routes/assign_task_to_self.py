# routes/assign_task_to_self.py

import sys
import os
sys.path.append('E:\projects\sts_prod_developement')

from fastapi import APIRouter, HTTPException, Depends
from auth.jwt_handler import verify_token
from http import HTTPStatus
from helper_functions import get_current_time_ist
import psycopg2
from utils.connect_to_psql import connect_to_psql
from config import load_config
from utils.logger import get_logger
import traceback

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

@router.post("/api/v1/timesheet/assign_task_to_self/{task_id}")
async def assign_task_to_self(
    task_id: int,
    current_user: dict = Depends(verify_token),
):
    """
    Assign a task to the current user (self-assignment)
    Updates the task's assignee, assigned_team_code, team_code, and assigned_on fields
    Also creates a history entry in task_hist
    """
    logger.info(f"[INFO] Starting task self-assignment for task_id: {task_id}, user: {current_user['user_code']}")
    
    conn = None
    cursor = None

    try:
        logger.info(f"[INFO] Establishing database connection for task self-assignment")
        conn = connect_to_psql(host, port, username, password, database_name, schema_name)
        cursor = conn.cursor()
        logger.info(f"[INFO] Database connection established successfully")

        user_code = current_user['user_code']
        
        # Step 1: Validate task exists
        cursor.execute("""
            SELECT 
                id, assignee, assigned_team_code, team_code, product_code, status_code
            FROM sts_ts.tasks 
            WHERE id = %s
        """, (task_id,))
        
        task_result = cursor.fetchone()
        if not task_result:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND,
                detail=f"Task with ID {task_id} does not exist"
            )
        
        task_id_db, current_assignee, current_assigned_team_code, current_team_code, product_code, status_code = task_result
        
        # Step 2: Validate user exists and get their team code
        cursor.execute("""
            SELECT user_code, team_code 
            FROM sts_new.user_master 
            WHERE user_code = %s AND is_inactive = false
        """, (user_code,))
        
        user_result = cursor.fetchone()
        if not user_result:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"User with code {user_code} does not exist or is inactive"
            )
        
        user_code_db, user_team_code = user_result
        
        # Step 3: Check if task is already assigned to this user
        if current_assignee == user_code:
            logger.info(f"[INFO] Task {task_id} is already assigned to user {user_code}")
            return {
                "Status_Flag": True,
                "Status_Description": "Task is already assigned to you",
                "Status_Code": HTTPStatus.OK.value,
                "Status_Message": HTTPStatus.OK.phrase,
                "Response_Data": {
                    "task_id": task_id,
                    "assignee": user_code,
                    "assigned_team_code": user_team_code,
                    "team_code": user_team_code,
                    "message": "Task is already assigned to you"
                }
            }
        
        # Step 4: Update task with new assignee
        current_time = get_current_time_ist()
        
        update_query = """
            UPDATE sts_ts.tasks 
            SET 
                assignee = %s,
                assigned_team_code = %s,
                team_code = %s,
                assigned_on = %s,
                updated_by = %s,
                updated_at = %s
            WHERE id = %s
            RETURNING id, assignee, assigned_team_code, team_code, assigned_on
        """
        
        cursor.execute(update_query, (
            user_code,
            user_team_code,
            user_team_code,
            current_time.date(),
            user_code,
            current_time,
            task_id
        ))
        
        updated_task = cursor.fetchone()
        if not updated_task:
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to update task assignment"
            )
        
        # Step 5: Get current task data for history entry (after update)
        cursor.execute("""
            SELECT 
                id, status_code, priority_code, task_type_code,
                product_code, team_code, assigned_team_code, assignee, reporter,
                work_mode, assigned_on, start_date, due_date, closed_on,
                estimated_hours, max_hours,
                cancelled_by, cancelled_at
            FROM sts_ts.tasks
            WHERE id = %s
        """, (task_id,))
        
        task_data = cursor.fetchone()
        if not task_data:
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve task data for history entry"
            )
        
        # Step 6: Insert history entry
        hist_insert_query = """
            INSERT INTO sts_ts.task_hist (
                task_code, status_code, priority_code, task_type_code, status_reason,
                product_code, team_code, assigned_team_code, assignee, reporter,
                work_mode, assigned_on, start_date, due_date, closed_on,
                estimated_hours, max_hours,
                cancelled_by, cancelled_at,
                created_by, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) RETURNING id
        """
        
        cursor.execute(hist_insert_query, (
            task_data[0],  # task_code (id from tasks table)
            task_data[1],  # status_code
            task_data[2],  # priority_code
            task_data[3],  # task_type_code
            None,  # status_reason (not stored in tasks table, only in task_hist)
            task_data[4],  # product_code
            task_data[5],  # team_code
            task_data[6],  # assigned_team_code
            task_data[7],  # assignee
            task_data[8],  # reporter
            task_data[9],  # work_mode
            task_data[10],  # assigned_on
            task_data[11],  # start_date
            task_data[12],  # due_date
            task_data[13],  # closed_on
            task_data[14],  # estimated_hours
            task_data[15],  # max_hours
            task_data[16],  # cancelled_by
            task_data[17],  # cancelled_at
            user_code,  # created_by
            current_time  # created_at
        ))
        
        hist_result = cursor.fetchone()
        if not hist_result:
            logger.warning(f"[WARNING] Failed to create history entry for task {task_id}, but task was updated")
        
        # Step 7: Commit transaction
        conn.commit()
        logger.info(f"[INFO] Successfully assigned task {task_id} to user {user_code}")
        
        return {
            "Status_Flag": True,
            "Status_Description": "Task assigned to you successfully",
            "Status_Code": HTTPStatus.OK.value,
            "Status_Message": HTTPStatus.OK.phrase,
            "Response_Data": {
                "task_id": task_id,
                "assignee": user_code,
                "assigned_team_code": user_team_code,
                "team_code": user_team_code,
                "assigned_on": str(current_time.date()),
                "history_entry_id": hist_result[0] if hist_result else None
            }
        }

    except psycopg2.IntegrityError as e:
        logger.error(f"[ERROR] Database integrity error: {str(e)}")
        logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=f"Data integrity violation. Error: {str(e)}"
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
            logger.info(f"[INFO] Database connection closed for task self-assignment")

