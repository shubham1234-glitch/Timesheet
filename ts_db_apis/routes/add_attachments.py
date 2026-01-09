# routes/add_task_attachments.py

import sys
import os
sys.path.append('E:\projects\sts_prod_developement')

from fastapi import APIRouter, HTTPException, Form, UploadFile, File, Depends
from auth.jwt_handler import verify_token
from http import HTTPStatus
from helper_functions import get_current_time_ist, format_file_size
import psycopg2
from utils.connect_to_psql import connect_to_psql
from config import load_config
from utils.logger import get_logger
from typing import List
import uuid
import traceback

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

@router.post("/api/v1/timesheet/add_attachments")
async def add_task_attachments(
    current_user: dict = Depends(verify_token), 
    parent_type: str = Form(..., description="Type of parent entity (TASK, EPIC, TIMESHEET_ENTRY, LEAVE_APPLICATION)"),
    parent_code: str = Form(..., description="Code/ID of the parent entity (task_id, epic_id, entry_id, leave_application_id)"),
    attachments: List[UploadFile] = File(..., description="File attachments to add"),
):
    """
    Add file attachments to an existing task, epic, timesheet entry, or leave application
    """
    logger.info(f"[INFO] Starting attachment addition for parent_type: {parent_type}, parent_code: {parent_code}, user: {current_user['user_code']}")
    
    conn = None
    cursor = None

    try:
        # Step 1: Establish database connection
        logger.info(f"[INFO] Establishing database connection for attachment addition")
        conn = connect_to_psql(host, port, username, password, database_name, schema_name)
        cursor = conn.cursor()
        logger.info(f"[INFO] Database connection established successfully")        


        # Step 2: Validate input data
        if len(attachments) > 20:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="Maximum 20 file attachments allowed per request"
            )

        # Validate parent_type
        valid_parent_types = ['TASK', 'EPIC', 'TIMESHEET_ENTRY', 'LEAVE_APPLICATION']
        parent_type = parent_type.upper().strip()
        if parent_type not in valid_parent_types:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Invalid parent_type '{parent_type}'. Must be one of: {', '.join(valid_parent_types)}"
            )

        # Step 3: Validate user exists
        cursor.execute("SELECT user_code FROM sts_new.user_master WHERE user_code = %s", (current_user['user_code'],))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"User with code '{current_user['user_code']}' does not exist"
            )

        # Step 4: Validate parent entity exists based on parent_type and get integer ID
        parent_id = None
        if parent_type == 'TASK':
            # parent_code should be the id (integer) of the task
            # The tasks table uses 'id' as the primary key
            try:
                task_id = int(parent_code)
            except ValueError:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Task ID must be an integer. Received: '{parent_code}'"
                )
            cursor.execute("""
                SELECT id 
                FROM sts_ts.tasks 
                WHERE id = %s
            """, (task_id,))
            parent_result = cursor.fetchone()
            if not parent_result:
                raise HTTPException(
                    status_code=HTTPStatus.NOT_FOUND,
                    detail=f"Task with id '{task_id}' does not exist"
                )
            parent_id = parent_result[0]
            logger.info(f"[INFO] Found task: (ID: {parent_id})")
            
        elif parent_type == 'EPIC':
            # parent_code should be epic id (integer)
            try:
                epic_id = int(parent_code)
            except ValueError:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Epic ID must be an integer. Received: '{parent_code}'"
                )
            cursor.execute("""
                SELECT id 
                FROM sts_ts.epics 
                WHERE id = %s
            """, (epic_id,))
            parent_result = cursor.fetchone()
            if not parent_result:
                raise HTTPException(
                    status_code=HTTPStatus.NOT_FOUND,
                    detail=f"Epic with id '{epic_id}' does not exist"
                )
            parent_id = epic_id
            logger.info(f"[INFO] Found epic: (ID: {parent_id})")
            
        elif parent_type == 'TIMESHEET_ENTRY':
            # parent_code should be the id (integer) of the timesheet entry
            # The table uses 'id' as the primary key, not 'entry_id'
            try:
                entry_id = int(parent_code)
            except ValueError:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Timesheet entry ID must be an integer. Received: '{parent_code}'"
                )
            cursor.execute("""
                SELECT id 
                FROM sts_ts.timesheet_entry 
                WHERE id = %s
            """, (entry_id,))
            parent_result = cursor.fetchone()
            if not parent_result:
                raise HTTPException(
                    status_code=HTTPStatus.NOT_FOUND,
                    detail=f"Timesheet entry with id '{entry_id}' does not exist"
                )
            parent_id = parent_result[0]
            logger.info(f"[INFO] Found timesheet entry: (ID: {parent_id})")
            
        elif parent_type == 'LEAVE_APPLICATION':
            # parent_code should be the id (integer) of the leave application
            try:
                leave_id = int(parent_code)
            except ValueError:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Leave application ID must be an integer. Received: '{parent_code}'"
                )
            cursor.execute("""
                SELECT id 
                FROM sts_ts.leave_application 
                WHERE id = %s
            """, (leave_id,))
            parent_result = cursor.fetchone()
            if not parent_result:
                raise HTTPException(
                    status_code=HTTPStatus.NOT_FOUND,
                    detail=f"Leave application with id '{leave_id}' does not exist"
                )
            parent_id = parent_result[0]
            logger.info(f"[INFO] Found leave application: (ID: {parent_id})")
        else:
            # This should never happen due to validation above, but adding for safety
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Unsupported parent_type: '{parent_type}'"
            )

        # Step 5: Validate file attachments
        total_file_size = 0
        validated_attachments = []
        
        for attachment in attachments:
            if attachment.filename:
                # Check file extension
                allowed_extensions = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.xls', '.xlsx', '.zip', '.rar']
                file_ext = os.path.splitext(attachment.filename)[1].lower()
                if file_ext not in allowed_extensions:
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail=f"File type {file_ext} is not allowed for file '{attachment.filename}'. Allowed types: {', '.join(allowed_extensions)}"
                    )
                
                # Check for potentially malicious filenames
                dangerous_patterns = ['..', '/', '\\', '<', '>', ':', '"', '|', '?', '*']
                if any(pattern in attachment.filename for pattern in dangerous_patterns):
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail=f"File name '{attachment.filename}' contains invalid characters"
                    )
                
                validated_attachments.append(attachment)

        # Step 6: Process file attachments
        attachment_data = []
        current_time = get_current_time_ist()
        
        if not os.path.exists(upload_dir):
            logger.info(f"[INFO] Creating upload directory: {upload_dir}")
            os.makedirs(upload_dir, exist_ok=True)
            # Set proper permissions for web server access
            os.chmod(upload_dir, 0o755)
            logger.info(f"[INFO] Upload directory created successfully with permissions")

        
        # Ensure base_url ends with a trailing slash for correct URL join
        normalized_base_url = base_url if base_url.endswith('/') else (base_url + '/')

        for attachment in validated_attachments:
            try:
                # Generate unique filename with parent type and id
                file_extension = os.path.splitext(attachment.filename)[1]
                parent_type_lower = parent_type.lower()
                unique_filename = f"{parent_type_lower}_{parent_id}_{uuid.uuid4()}{file_extension}"
                file_path = os.path.join(upload_dir, unique_filename).replace('\\', '/')
                

                # Create the URL for client access
                file_url = normalized_base_url + unique_filename
                logger.info(f"[INFO] Generated unique filename: {unique_filename} for file: {attachment.filename}")

                # Save file to disk
                try:
                    with open(file_path, "wb") as buffer:
                        content = await attachment.read()
                        buffer.write(content)
                except Exception as e:
                    logger.error(f"[ERROR] Failed to save file {attachment.filename}: {str(e)}")
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail=f"Failed to save file '{attachment.filename}'. Error: {str(e)}"
                    )
                
                # Check file size after reading (10MB limit per file)
                file_size = len(content)
                if file_size > 10 * 1024 * 1024:
                    # Delete the file if it exceeds size limit
                    try:
                        os.remove(file_path)
                    except:
                        pass
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail=f"File '{attachment.filename}' is too large. Maximum size is 10MB"
                    )
                
                # Check total file size (50MB limit for all files)
                total_file_size += file_size
                if total_file_size > 50 * 1024 * 1024:
                    # Delete the current file if total exceeds limit
                    try:
                        os.remove(file_path)
                    except:
                        pass
                    raise HTTPException(
                        status_code=HTTPStatus.BAD_REQUEST,
                        detail="Total file size cannot exceed 50MB"
                    )
                
                logger.info(f"[INFO] File saved to disk: {file_path}, size: {file_size} bytes")
                
                # Set proper file permissions for web server access
                os.chmod(file_path, 0o644)
                
                # Extract file information to insert into database
                file_name = attachment.filename
                file_type = os.path.splitext(attachment.filename)[1].lower().lstrip('.')
                file_size_bytes = len(content)
                file_size_display = format_file_size(file_size_bytes)
                
                # Determine purpose based on parent_type
                purpose_map = {
                    'TASK': 'TASK ATTACHMENT',
                    'EPIC': 'EPIC ATTACHMENT',
                    'TIMESHEET_ENTRY': 'TIMESHEET ATTACHMENT',
                    'LEAVE_APPLICATION': 'LEAVE APPLICATION ATTACHMENT'
                }
                purpose = purpose_map.get(parent_type, 'ATTACHMENT')
                
                # Insert attachment record into database
                attachment_query = """
                    INSERT INTO sts_ts.attachments (
                        parent_type, parent_code, file_path, file_url, file_name, file_type, file_size, purpose, created_by, created_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    ) RETURNING id
                """
                cursor.execute(attachment_query, (
                    parent_type, parent_id, file_path, file_url, file_name, file_type, file_size_display, purpose,
                    current_user['user_code'], current_time
                ))
                
                attachment_id = cursor.fetchone()[0]
                attachment_data.append({
                    "id": attachment_id,
                    "file_name": file_name,
                    "file_type": file_type,
                    "file_size_bytes": file_size_bytes,
                    "file_size_display": file_size_display,
                    "file_path": file_path,
                    "file_url": file_url,
                    "purpose": purpose,
                    "parent_type": parent_type,
                    "parent_id": parent_id,
                    "parent_code": parent_code,
                    "original_filename": attachment.filename
                })
                
                logger.info(f"[INFO] Successfully saved attachment: {attachment.filename}")
                
            except Exception as e:
                logger.error(f"[ERROR] Failed to save attachment {attachment.filename}: {str(e)}")
                # ROLLBACK the entire transaction and return error
                if conn:
                    conn.rollback()
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Failed to save attachment '{attachment.filename}'. The attachment addition has been rolled back. Error: {str(e)}"
                )

        # Step 7: Commit transaction
        conn.commit()
        logger.info(f"[INFO] Successfully added {len(attachment_data)} attachments to {parent_type}: {parent_id} (provided: {parent_code})")
        
        return {
            "Status_Flag": True,
            "Status_Description": "Attachments added successfully",
            "Status_Code": HTTPStatus.OK.value,
            "Status_Message": HTTPStatus.OK.phrase,
            "Response_Data": {
                "parent_type": parent_type,
                "parent_id": parent_id,
                "parent_code": parent_code,
                "attachments_added": len(attachment_data),
                "total_file_size_display": format_file_size(total_file_size),
                "attachments": attachment_data
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
        error_message = str(e)
        logger.error(f"[ERROR] Database query error: {error_message}")
        logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail=f"Database query error: {error_message}"
        )
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"[ERROR] Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info(f"[INFO] Database connection closed for attachment addition")
