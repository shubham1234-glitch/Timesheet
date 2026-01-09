# routes/create_comment.py

import sys
import os
sys.path.append('E:\projects\sts_prod_developement')

from fastapi import APIRouter, HTTPException, Form, Depends
from auth.jwt_handler import verify_token
from http import HTTPStatus
import psycopg2
from utils.connect_to_psql import connect_to_psql
from config import load_config
from utils.logger import get_logger
from helper_functions import get_current_time_ist
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

@router.post("/api/v1/timesheet/add_comment")
async def add_comment(
    parent_type: str = Form(..., description="Type of parent entity: TASK, EPIC, or TIMESHEET_ENTRY"),
    parent_code: int = Form(..., description="ID of the parent entity (task_id, epic_id, or entry_id)"),
    comment_text: str = Form(..., description="The comment text"),
    current_user: dict = Depends(verify_token)
):
    """
    Create a comment for a task, epic, or timesheet entry
    """
    logger.info(f"[INFO] Adding comment for parent_type: {parent_type}, parent_code: {parent_code}, user: {current_user['user_code']}")
    
    conn = None
    cursor = None
    
    try:
        # Validate parent_type
        parent_type_upper = parent_type.strip().upper()
        if parent_type_upper not in ['TASK', 'EPIC', 'TIMESHEET_ENTRY']:
            logger.error(f"[ERROR] Invalid parent_type: {parent_type}")
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Invalid parent_type: {parent_type}. Must be one of: TASK, EPIC, TIMESHEET_ENTRY"
            )
        
        # Validate comment_text
        comment_text = comment_text.strip()
        if not comment_text:
            logger.error(f"[ERROR] Comment text cannot be empty")
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="Comment text cannot be empty"
            )
        
        conn = connect_to_psql(host, port, username, password, database_name, schema_name)
        cursor = conn.cursor()
        logger.info(f"[INFO] Database connection established successfully")
        
        # Validate parent entity exists
        logger.info(f"[INFO] Validating parent entity existence: {parent_type_upper} with code: {parent_code}")
        
        if parent_type_upper == 'TASK':
            cursor.execute("SELECT id FROM sts_ts.tasks WHERE id = %s", (parent_code,))
            parent_exists = cursor.fetchone()
            if not parent_exists:
                logger.error(f"[ERROR] Task not found with id: {parent_code}")
                raise HTTPException(
                    status_code=HTTPStatus.NOT_FOUND,
                    detail=f"Task with id {parent_code} not found"
                )
        elif parent_type_upper == 'EPIC':
            cursor.execute("SELECT id FROM sts_ts.epics WHERE id = %s", (parent_code,))
            parent_exists = cursor.fetchone()
            if not parent_exists:
                logger.error(f"[ERROR] Epic not found with id: {parent_code}")
                raise HTTPException(
                    status_code=HTTPStatus.NOT_FOUND,
                    detail=f"Epic with id {parent_code} not found"
                )
        elif parent_type_upper == 'TIMESHEET_ENTRY':
            cursor.execute("SELECT id FROM sts_ts.timesheet_entry WHERE id = %s", (parent_code,))
            parent_exists = cursor.fetchone()
            if not parent_exists:
                logger.error(f"[ERROR] Timesheet entry not found with id: {parent_code}")
                raise HTTPException(
                    status_code=HTTPStatus.NOT_FOUND,
                    detail=f"Timesheet entry with id {parent_code} not found"
                )
        
        logger.info(f"[INFO] Parent entity validation successful: {parent_type_upper} with code: {parent_code}")
        
        # Validate commented_by user exists
        commented_by = current_user['user_code']
        logger.info(f"[INFO] Validating commented_by user: {commented_by}")
        cursor.execute("SELECT user_code FROM sts_new.user_master WHERE user_code = %s", (commented_by,))
        if not cursor.fetchone():
            logger.error(f"[ERROR] User not found in user_master with user_code: {commented_by}")
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"User with code {commented_by} does not exist"
            )
        logger.info(f"[INFO] User validation successful for user_code: {commented_by}")
        
        # Insert comment
        logger.info(f"[INFO] Inserting comment record for {parent_type_upper} with code: {parent_code}")
        insert_query = """
            INSERT INTO sts_ts.comments (
                parent_type, parent_code, comment_text, commented_by, commented_at
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, parent_type, parent_code, comment_text, commented_by, commented_at
        """
        
        logger.info(f"[INFO] Executing INSERT query with params: parent_type={parent_type_upper}, parent_code={parent_code}, commented_by={commented_by}")
        cursor.execute(insert_query, (
            parent_type_upper,
            parent_code,
            comment_text,
            commented_by,
            get_current_time_ist()
        ))
        
        result = cursor.fetchone()
        if not result:
            logger.error(f"[ERROR] INSERT query did not return a result")
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to insert comment - no result returned"
            )
        logger.info(f"[INFO] Comment record inserted successfully, id: {result[0]}")
        
        logger.info(f"[INFO] Committing transaction for comment creation")
        conn.commit()
        logger.info(f"[INFO] Transaction committed successfully for comment creation")
        
        logger.info(f"[INFO] Comment creation completed successfully for {parent_type_upper} with code: {parent_code}, comment_id: {result[0]}")
        return {
            "success": True,
            "message": "Comment created successfully",
            "status_code": HTTPStatus.CREATED.value,
            "status_message": HTTPStatus.CREATED.phrase,
            "data": {
                "id": result[0],
                "parent_type": result[1],
                "parent_code": result[2],
                "comment_text": result[3],
                "commented_by": result[4],
                "commented_at": result[5].isoformat() if result[5] else None
            }
        }
        
    except HTTPException as http_err:
        logger.error(f"[ERROR] HTTP Exception in comment creation for {parent_type} with code: {parent_code}, status_code: {http_err.status_code}, detail: {http_err.detail}")
        if conn:
            logger.info(f"[INFO] Rolling back transaction due to HTTP exception")
            conn.rollback()
        raise http_err
        
    except psycopg2.IntegrityError as inte_error:
        logger.error(f"[ERROR] Integrity error in comment creation: {str(inte_error)}")
        if conn:
            logger.info(f"[INFO] Rolling back transaction due to integrity error")
            conn.rollback()
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=f"Database integrity error: {str(inte_error)}"
        )
        
    except psycopg2.ProgrammingError as prog_error:
        logger.error(f"[ERROR] Database programming error in comment creation: {str(prog_error)}")
        logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
        if conn:
            logger.info(f"[INFO] Rolling back transaction due to programming error")
            conn.rollback()
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail=f"Database query error: {str(prog_error)}. Please check table/column names and SQL syntax."
        )
    except psycopg2.OperationalError as op_error:
        logger.error(f"[ERROR] Database operational error in comment creation: {str(op_error)}")
        logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
        if conn:
            logger.info(f"[INFO] Rolling back transaction due to operational error")
            conn.rollback()
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail=f"Database connection error: {str(op_error)}"
        )
    except psycopg2.Error as db_error:
        logger.error(f"[ERROR] Database error in comment creation: {str(db_error)}")
        logger.error(f"[ERROR] Error type: {type(db_error).__name__}")
        logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
        if conn:
            logger.info(f"[INFO] Rolling back transaction due to database error")
            conn.rollback()
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(db_error)}"
        )
        
    except Exception as e:
        logger.error(f"[ERROR] Unexpected error in comment creation: {str(e)}")
        logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
        if conn:
            logger.info(f"[INFO] Rolling back transaction due to unexpected error")
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

