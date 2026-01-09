# routes/delete_task.py

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

@router.delete("/api/v1/timesheet/delete_task/{epic_id}/{task_id}")
async def delete_task(
    epic_id: int,
    task_id: int,
    current_user: dict = Depends(verify_token),
):
    """
    Delete a task and its history (epic is NOT deleted)
    Requires both epic_id and task_id to identify which task to delete
    - Only the task is deleted (not the epic)
    - Timesheet entries are preserved - their task_code will be set to NULL
    - Task comments, attachments, and history are deleted
    """
    logger.info(f"[INFO] Starting task deletion for epic_id: {epic_id}, task_id: {task_id}, user: {current_user['user_code']}")
    
    conn = None
    cursor = None

    try:
        logger.info(f"[INFO] Establishing database connection for task deletion")
        conn = connect_to_psql(host, port, username, password, database_name, schema_name)
        cursor = conn.cursor()
        logger.info(f"[INFO] Database connection established successfully")

        # Step 1: Check if epic is predefined or actual
        cursor.execute("""
            SELECT id FROM sts_ts.predefined_epics WHERE id = %s
        """, (epic_id,))
        is_predefined_epic = cursor.fetchone() is not None
        
        if is_predefined_epic:
            # Handle predefined task deletion (predefined tasks are now independent, no epic connection)
            cursor.execute("""
                SELECT id, task_title
                FROM sts_ts.predefined_tasks
                WHERE id = %s
            """, (task_id,))
            
            task_result = cursor.fetchone()
            if not task_result:
                raise HTTPException(
                    status_code=HTTPStatus.NOT_FOUND,
                    detail=f"Predefined task with ID {task_id} does not exist"
                )
            
            task_title = task_result[1]
            logger.info(f"[INFO] Predefined task found: {task_title}")
            
            # Delete predefined task (no timesheet entries, comments, or attachments for predefined tasks)
            cursor.execute("""
                DELETE FROM sts_ts.predefined_tasks 
                WHERE id = %s
            """, (task_id,))
            
            deleted_rows = cursor.rowcount
            if deleted_rows == 0:
                raise HTTPException(
                    status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                    detail="Failed to delete predefined task - no rows affected"
                )
            
            # Commit changes
            conn.commit()
            logger.info(f"[INFO] Predefined task {task_id} deleted successfully")
            
            return {
                "success": True,
                "status_code": HTTPStatus.OK,
                "status_message": "OK",
                "message": f"Predefined task '{task_title}' (ID: {task_id}) deleted successfully",
                "data": {
                    "epic_id": epic_id,
                    "task_id": task_id,
                    "task_title": task_title,
                    "is_predefined": True,
                    "deleted_items": {
                        "task": "predefined_tasks"
                    }
                }
            }
        else:
            # Handle actual task deletion (existing logic)
            cursor.execute("""
                SELECT id, task_title, epic_code, status_code
                FROM sts_ts.tasks
                WHERE id = %s AND epic_code = %s
            """, (task_id, epic_id))
            
            task_result = cursor.fetchone()
            if not task_result:
                raise HTTPException(
                    status_code=HTTPStatus.NOT_FOUND,
                    detail=f"Task with ID {task_id} does not exist or does not belong to epic {epic_id}"
                )
            
            task_title, task_epic_code, status_code = task_result[1], task_result[2], task_result[3]
            logger.info(f"[INFO] Task found: {task_title}, Epic: {task_epic_code}, Status: {status_code}")
            
            # Verify epic_id matches
            if task_epic_code != epic_id:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Task {task_id} belongs to epic {task_epic_code}, not epic {epic_id}"
                )

            # Step 2: Check for timesheet entries and set task_code to NULL to preserve them
        cursor.execute("""
            SELECT COUNT(*) 
            FROM sts_ts.timesheet_entry 
            WHERE task_code = %s
        """, (task_id,))
        
        timesheet_count = cursor.fetchone()[0]
        
        if timesheet_count > 0:
            logger.info(f"[INFO] Task {task_id} has {timesheet_count} timesheet entry/entries. Setting task_code to NULL to preserve them.")
            cursor.execute("""
                UPDATE sts_ts.timesheet_entry 
                SET task_code = NULL, updated_by = %s, updated_at = NOW()
                WHERE task_code = %s
            """, (current_user['user_code'], task_id))
            logger.info(f"[INFO] Updated {timesheet_count} timesheet entries - task_code set to NULL")

            # Step 3: Check for comments
        cursor.execute("""
            SELECT COUNT(*) 
            FROM sts_ts.comments 
            WHERE parent_type = 'TASK' AND parent_code = %s
        """, (task_id,))
        
        comment_count = cursor.fetchone()[0]
        if comment_count > 0:
            logger.info(f"[INFO] Task {task_id} has {comment_count} comment(s). Will be deleted.")

            # Step 4: Check for attachments
        cursor.execute("""
            SELECT COUNT(*) 
            FROM sts_ts.attachments 
            WHERE parent_type = 'TASK' AND parent_code = %s
        """, (task_id,))
        
        attachment_count = cursor.fetchone()[0]
        if attachment_count > 0:
            logger.info(f"[INFO] Task {task_id} has {attachment_count} attachment(s). Will be deleted.")

            # Step 5: Delete in order (respecting foreign key constraints)
            # Note: Timesheet entries are preserved (task_code already set to NULL above)
            
            # Delete comments
        if comment_count > 0:
            cursor.execute("""
                DELETE FROM sts_ts.comments 
                WHERE parent_type = 'TASK' AND parent_code = %s
            """, (task_id,))
            logger.info(f"[INFO] Deleted {comment_count} comments for task {task_id}")

        # Delete attachments (file records - actual files may remain on disk)
        if attachment_count > 0:
            cursor.execute("""
                DELETE FROM sts_ts.attachments 
                WHERE parent_type = 'TASK' AND parent_code = %s
            """, (task_id,))
            logger.info(f"[INFO] Deleted {attachment_count} attachment records for task {task_id}")

            # Delete task history
            cursor.execute("""
                DELETE FROM sts_ts.task_hist 
                WHERE task_code = %s
            """, (task_id,))
            logger.info(f"[INFO] Deleted task history for task {task_id}")

            # Delete the task itself
            cursor.execute("""
                DELETE FROM sts_ts.tasks 
                WHERE id = %s
            """, (task_id,))
            
            deleted_rows = cursor.rowcount
            if deleted_rows == 0:
                raise HTTPException(
                    status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                    detail="Failed to delete task - no rows affected"
                )

            # Commit all changes
            conn.commit()
            logger.info(f"[INFO] Task {task_id} deleted successfully")

            return {
                "success": True,
                "status_code": HTTPStatus.OK,
                "status_message": "OK",
                "message": f"Task '{task_title}' (ID: {task_id}) deleted successfully",
                "data": {
                    "epic_id": epic_id,
                    "task_id": task_id,
                    "task_title": task_title,
                    "is_predefined": False,
                    "deleted_items": {
                        "timesheet_entries": 0,
                        "timesheet_entries_preserved": timesheet_count,
                        "comments": comment_count,
                        "attachments": attachment_count,
                        "task_history": "all"
                    }
                }
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
            detail=f"Cannot delete task due to database constraints: {error_msg}"
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
            logger.info(f"[INFO] Database connection closed for task deletion")

