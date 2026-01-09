# routes/create_activity.py

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
from typing import List, Optional
import uuid
import traceback

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

@router.post("/api/v1/timesheet/create_activity")
async def create_activity(
    title: str = Form(..., description="Title of the activity"),
    description: Optional[str] = Form(default="", description="Detailed description of the activity"),
    product_code: str = Form(..., description="Product code this activity belongs to"),
    is_billable: bool = Form(default=True, description="Whether the activity is billable"),
    attachments: List[UploadFile] = File(default=[], description="File attachments for the activity"),
    current_user: dict = Depends(verify_token),
):
    """
    Create a new activity with optional file attachments
    """
    logger.info(f"[INFO] Starting activity creation for title: {title}, product_code: {product_code}, user: {current_user['user_code']}")
    
    conn = None
    cursor = None

    try:

        logger.info(f"[INFO] Establishing database connection for activity creation")
        conn = connect_to_psql(host, port, username, password, database_name, schema_name)
        cursor = conn.cursor()
        logger.info(f"[INFO] Database connection established successfully")       

        # Step 1: Validate product exists
        cursor.execute("SELECT product_code FROM sts_new.product_master WHERE product_code = %s", (product_code,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Product with code {product_code} does not exist"
            )

        # Step 2: Validate created_by user exists
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

        # Step 3: Insert activity into sts_ts.activities table
        current_time = get_current_time_ist()
        created_by = current_user['user_code']
        
        insert_query = """
            INSERT INTO sts_ts.activities (
                activity_title, activity_description, product_code,
                is_billable, created_by, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s
            ) RETURNING id
        """
        
        cursor.execute(insert_query, (
            title, description, product_code,
            is_billable, created_by, current_time
        ))
        
        result = cursor.fetchone()
        if not result:
            raise Exception("Failed to insert activity - no ID returned")
        activity_id = result[0]
        
        logger.info(f"[INFO] Successfully created activity with ID: {activity_id}")
        
        # Step 4: Handle file attachments if provided
        attachment_data = []
        if attachments and len(attachments) > 0:
            logger.info(f"[INFO] Processing {len(attachments)} file attachments")
            
            # Create upload directory if it doesn't exist
            if not os.path.exists(upload_dir):
                logger.info(f"[INFO] Creating upload directory: {upload_dir}")
                os.makedirs(upload_dir, exist_ok=True)
                os.chmod(upload_dir, 0o755)
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
                                'ACTIVITY', %s, %s, %s, %s, %s, %s, %s, %s, %s
                            ) RETURNING id
                        """
                        
                        cursor.execute(attachment_query, (
                            str(activity_id), file_path, file_url, file_name, file_type, file_size_display, "ACTIVITY ATTACHMENT", 
                            current_user['user_code'], current_time
                        ))
                        
                        attachment_id = cursor.fetchone()[0]
                        attachment_data.append({
                            "id": attachment_id,
                            "original_filename": attachment.filename,
                            "file_path": file_path,
                            "file_url": file_url,
                            "purpose": "ACTIVITY ATTACHMENT",
                            "file_size_bytes": file_size_bytes,
                            "file_size_display": file_size_display,
                        })
                        
                        logger.info(f"[INFO] Successfully saved attachment: {attachment.filename}")
                        
                    except Exception as e:
                        logger.error(f"[ERROR] Failed to save attachment {attachment.filename}: {str(e)}")
                        logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
                        # ROLLBACK the entire transaction and return error
                        if conn:
                            conn.rollback()
                        raise HTTPException(
                            status_code=HTTPStatus.BAD_REQUEST,
                            detail=f"Failed to save attachment '{attachment.filename}'. The activity creation has been rolled back. Error: {str(e)}"
                        )

        # Step 5: Commit transaction
        conn.commit()
        logger.info(f"[INFO] Successfully created activity with ID: {activity_id}")
        
        return {
            "Status_Flag": True,
            "Status_Description": "Activity created successfully",
            "Status_Code": HTTPStatus.CREATED.value,
            "Status_Message": HTTPStatus.CREATED.phrase,
            "Response_Data": {
                "id": activity_id,
                "title": title,
                "description": description,
                "product_code": product_code,
                "is_billable": is_billable,
                "attachments": attachment_data
            }
        }

    except psycopg2.IntegrityError as e:
        logger.error(f"[ERROR] Database integrity error: {str(e)}")
        logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=f"Data integrity violation. Please check your input data. Error: {str(e)}"
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
            logger.info(f"[INFO] Database connection closed for activity creation")

