# routes/leave_application.py

import sys
sys.path.append('E:\projects\sts_prod_developement')

from fastapi import APIRouter, HTTPException, Form, UploadFile, File, Depends
from auth.jwt_handler import verify_token
from http import HTTPStatus
from helper_functions import get_current_time_ist, parse_date, format_file_size
import psycopg2
from utils.connect_to_psql import connect_to_psql
from config import load_config
from utils.logger import get_logger
from typing import Optional, List
from enum import Enum
from datetime import date, timedelta
import traceback
import os
import uuid

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

allowed_admin_designations = config.get('admin_designations', [])

router = APIRouter()

# Initialize logger for this module
logger = get_logger(log_file_name, log_dir=log_dir)

# Approval Action Enum
class ApprovalAction(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"

@router.post("/api/v1/timesheet/apply_leave/")
async def apply_leave(
    leave_type_code: str = Form(..., description="Leave type code (e.g., LT001, LT002)"),
    from_date: str = Form(..., description="Start date in DD-MM-YYYY or YYYY-MM-DD format"),
    to_date: str = Form(..., description="End date in DD-MM-YYYY or YYYY-MM-DD format"),
    reason: str = Form(..., description="Reason for leave"),
    attachments: List[UploadFile] = File(default=[], description="Optional file attachments for the leave application"),
    leave_application_id: Optional[int] = Form(None, description="Leave application ID to update (if provided, updates existing draft)"),
    approval_status: Optional[str] = Form("PENDING", description="Approval status: DRAFT or PENDING (default: PENDING)"),
    current_user: dict = Depends(verify_token),
):
    """
    Apply for leave
    """
    logger.info(f"[INFO] Starting leave application for user_code: {current_user['user_code']}, leave_type_code: {leave_type_code}")
    
    conn = None
    cursor = None

    try:
        conn = connect_to_psql(host, port, username, password, database_name, schema_name)
        cursor = conn.cursor()
        logger.info(f"[INFO] Database connection established successfully")

        user_code = current_user['user_code']
        current_time = get_current_time_ist()

        # Step 1: Validate user exists
        cursor.execute("SELECT user_code FROM sts_new.user_master WHERE user_code = %s AND is_inactive = false", (user_code,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"User with code {user_code} does not exist or is inactive"
            )

        # Step 2: Validate leave type exists and is active
        cursor.execute("""
            SELECT leave_type_code, leave_type_name 
            FROM sts_ts.leave_type_master 
            WHERE leave_type_code = %s AND is_active = true
        """, (leave_type_code,))
        leave_type_result = cursor.fetchone()
        if not leave_type_result:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Leave type '{leave_type_code}' does not exist or is not active"
            )

        # Step 3: Parse and validate dates
        try:
            from_date_parsed = parse_date(from_date)
            to_date_parsed = parse_date(to_date)
        except ValueError as e:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Date parsing error: {str(e)}"
            )

        # Validate date logic
        if from_date_parsed > to_date_parsed:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="From date cannot be after to date"
            )

        # Validate dates are not in the past (allow today)
        today = date.today()
        if from_date_parsed < today:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="Leave cannot be applied for past dates"
            )

        # Step 4: Calculate duration
        duration_days = (to_date_parsed - from_date_parsed).days + 1  # Inclusive of both dates
        
        # For Permission (2 hours) and Half Day Leave, adjust duration
        duration_hours = None
        if leave_type_code == 'LT005':  # Permission (2 Hours)
            # For permission, from_date and to_date must be the same day
            if from_date_parsed != to_date_parsed:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Permission (2 hours) can only be applied for a single day. from_date and to_date must be the same."
                )
            duration_days = 0.25  # 2 hours = 0.25 days (assuming 8 hours working day)
            duration_hours = 2.0
        elif leave_type_code == 'LT006':  # Half Day Leave
            # For half day, from_date and to_date must be the same day
            if from_date_parsed != to_date_parsed:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Half day leave can only be applied for a single day. from_date and to_date must be the same."
                )
            duration_days = 0.5  # Half day = 0.5 days
            duration_hours = 4.0  # Half day = 4 hours (assuming 8 hours working day)
        else:
            # For full day leaves, ensure it's at least 1 day
            if duration_days < 1:
                duration_days = 1.0

        # Step 5: Validate reason is not empty
        reason = reason.strip()
        if not reason:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="Reason for leave cannot be empty"
            )

        # Step 5.5: Validate approval_status
        # Map PENDING to SUBMITTED for database (frontend uses PENDING, database uses SUBMITTED)
        approval_status_upper = approval_status.upper().strip() if approval_status else "SUBMITTED"
        if approval_status_upper == 'PENDING':
            approval_status_upper = 'SUBMITTED'
        if approval_status_upper not in ['DRAFT', 'SUBMITTED']:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Invalid approval_status '{approval_status}'. Allowed values: DRAFT, PENDING"
            )

        # Step 6: Check if updating existing draft or creating new
        if leave_application_id:
            # Update existing leave application (draft)
            logger.info(f"[INFO] Updating existing leave application with ID: {leave_application_id}")
            
            # Verify the leave application exists and belongs to the user
            cursor.execute("""
                SELECT id, user_code, approval_status 
                FROM sts_ts.leave_application 
                WHERE id = %s AND user_code = %s
            """, (leave_application_id, user_code))
            existing_leave = cursor.fetchone()
            
            if not existing_leave:
                raise HTTPException(
                    status_code=HTTPStatus.NOT_FOUND,
                    detail=f"Leave application with ID {leave_application_id} not found or does not belong to you"
                )
            
            existing_status = existing_leave[2]
            # Only allow updating DRAFT entries
            if existing_status != 'DRAFT':
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Cannot update leave application with status '{existing_status}'. Only DRAFT entries can be updated."
                )
            
            # Update leave application
            update_query = """
                UPDATE sts_ts.leave_application SET
                    leave_type_code = %s,
                    from_date = %s,
                    to_date = %s,
                    duration_days = %s,
                    duration_hours = %s,
                    reason = %s,
                    approval_status = %s,
                    updated_by = %s,
                    updated_at = %s
                WHERE id = %s
                RETURNING id, user_code, leave_type_code, from_date, to_date,
                    duration_days, duration_hours, reason, approval_status, created_at
            """
            
            cursor.execute(update_query, (
                leave_type_code, from_date_parsed, to_date_parsed,
                duration_days, duration_hours, reason,
                approval_status_upper, user_code, current_time, leave_application_id
            ))
            
            result = cursor.fetchone()
            if not result:
                raise Exception("Failed to update leave application - no ID returned")
            
            leave_id = result[0]
            logger.info(f"[INFO] Successfully updated leave application with ID: {leave_id}")
        else:
            # Insert new leave application
            insert_query = """
                INSERT INTO sts_ts.leave_application (
                    user_code, leave_type_code, from_date, to_date,
                    duration_days, duration_hours, reason,
                    approval_status, created_by, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                ) RETURNING id, user_code, leave_type_code, from_date, to_date,
                    duration_days, duration_hours, reason, approval_status, created_at
            """
            
            cursor.execute(insert_query, (
                user_code, leave_type_code, from_date_parsed, to_date_parsed,
                duration_days, duration_hours, reason,
                approval_status_upper, user_code, current_time
            ))

            result = cursor.fetchone()
            if not result:
                raise Exception("Failed to insert leave application - no ID returned")

            leave_id = result[0]
            logger.info(f"[INFO] Successfully created leave application with ID: {leave_id}")

        # Step 7: Handle file attachments if provided
        attachment_data = []
        if attachments and len(attachments) > 0:
            logger.info(f"[INFO] Processing {len(attachments)} file attachments for leave application {leave_id}")
            
            # Create upload directory if it doesn't exist
            if not os.path.exists(upload_dir):
                logger.info(f"[INFO] Creating upload directory: {upload_dir}")
                os.makedirs(upload_dir, exist_ok=True)
                # Set proper permissions for web server access
                os.chmod(upload_dir, 0o755)
                logger.info(f"[INFO] Upload directory created successfully with permissions")

            # Ensure base_url ends with a trailing slash for correct URL join
            normalized_base_url = base_url if base_url.endswith('/') else (base_url + '/')

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
                                
                        # Extract file information to insert into database
                        file_name = attachment.filename
                        file_type = os.path.splitext(attachment.filename)[1].lower().lstrip('.')
                        file_size_bytes = file_size
                        file_size_display = format_file_size(file_size_bytes)
                                                        
                        # Insert attachment record into database
                        attachment_query = """
                            INSERT INTO sts_ts.attachments (
                                parent_type, parent_code, file_path, file_url, file_name, file_type, file_size, purpose, created_by, created_at
                            ) VALUES (
                                'LEAVE_APPLICATION', %s, %s, %s, %s, %s, %s, %s, %s, %s
                            ) RETURNING id
                        """
                        
                        cursor.execute(attachment_query, (
                            leave_id, file_path, file_url, file_name, file_type, file_size_display, "LEAVE APPLICATION ATTACHMENT", 
                            user_code, current_time
                        ))
                        
                        attachment_id = cursor.fetchone()[0]
                        attachment_data.append({
                            "id": attachment_id,
                            "original_filename": attachment.filename,
                            "file_path": file_path,
                            "file_url": file_url,
                            "purpose": "LEAVE APPLICATION ATTACHMENT",
                            "file_size_bytes": file_size_bytes,
                            "file_size_display": file_size_display
                        })
                        
                        logger.info(f"[INFO] Successfully saved attachment: {attachment.filename}")
                        
                    except HTTPException:
                        # Re-raise HTTP exceptions
                        raise
                    except Exception as e:
                        logger.error(f"[ERROR] Failed to save attachment {attachment.filename}: {str(e)}")
                        logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
                        # Continue with other attachments even if one fails
                        continue

        # Step 8: Commit transaction
        conn.commit()

        return {
            "Status_Flag": True,
            "Status_Description": "Leave application submitted successfully",
            "Status_Code": HTTPStatus.CREATED.value,
            "Status_Message": HTTPStatus.CREATED.phrase,
            "Response_Data": {
                "id": result[0],
                "user_code": result[1],
                "leave_type_code": result[2],
                "from_date": str(result[3]),
                "to_date": str(result[4]),
                "duration_days": float(result[5]),
                "duration_hours": float(result[6]) if result[6] else None,
                "reason": result[7],
                "approval_status": result[8],
                "created_at": result[9].isoformat() if result[9] else None,
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
        logger.info(f"[INFO] Database connection closed for leave application")

@router.post("/api/v1/timesheet/approve_leave/")
async def approve_leave(
    leave_id: int = Form(..., description="Leave application ID to approve/reject"),
    action: ApprovalAction = Form(..., description="Action to perform: APPROVE or REJECT"),
    rejection_reason: Optional[str] = Form(None, description="Reason for rejection (required if action is REJECT)"),
    current_user: dict = Depends(verify_token),
):
    """
    Approve or reject a leave application (Admin only)
    """
    logger.info(f"[INFO] Starting leave approval/rejection for leave_id: {leave_id}, action: {action}, by user: {current_user['user_code']}")
    
    conn = None
    cursor = None

    try:
        # Step 1: Validate admin permissions
        user_code = current_user['user_code']
        logger.info(f"[INFO] Validating admin permissions for user: {user_code}")
        
        conn = connect_to_psql(host, port, username, password, database_name, schema_name)
        cursor = conn.cursor()
        
        # Check user designation
        cursor.execute("""
            SELECT designation_name 
            FROM sts_new.user_master 
            WHERE user_code = %s AND is_inactive = false
        """, (user_code,))
        
        user_result = cursor.fetchone()
        if not user_result:
            raise HTTPException(
                status_code=HTTPStatus.FORBIDDEN,
                detail="User not found or inactive"
            )
        
        designation_name = user_result[0]
        if not designation_name:
            raise HTTPException(
                status_code=HTTPStatus.FORBIDDEN,
                detail="User does not have a valid designation. Only admins can approve/reject leave applications."
            )
        
        # Normalize designation_name for comparison (case-insensitive)
        designation_normalized = designation_name.strip().lower()
        
        if designation_normalized not in allowed_admin_designations:
            raise HTTPException(
                status_code=HTTPStatus.FORBIDDEN,
                detail=f"Only admins can approve/reject leave applications. User '{user_code}' with designation '{designation_name}' is not authorized."
            )
        
        logger.info(f"[INFO] User {user_code} with designation '{designation_name}' is authorized to approve/reject leave applications")

        # Step 2: Validate leave application exists
        cursor.execute("""
            SELECT id, user_code, leave_type_code, from_date, to_date, approval_status
            FROM sts_ts.leave_application
            WHERE id = %s
        """, (leave_id,))
        
        leave_result = cursor.fetchone()
        if not leave_result:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND,
                detail=f"Leave application with ID {leave_id} does not exist"
            )
        
        leave_user_code, leave_type_code, leave_from_date, leave_to_date, current_status = leave_result[1], leave_result[2], leave_result[3], leave_result[4], leave_result[5]

        # Step 3: Validate leave application is in SUBMITTED status (can only approve/reject SUBMITTED entries)
        if current_status != 'SUBMITTED':
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Leave application is already {current_status}. Only SUBMITTED applications can be approved/rejected."
            )

        # Step 4: Validate rejection_reason if action is REJECT
        if action == ApprovalAction.REJECT:
            if not rejection_reason or not rejection_reason.strip():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Rejection reason is required when rejecting a leave application"
                )
            rejection_reason = rejection_reason.strip()

        # Step 5: Update leave application
        current_time = get_current_time_ist()
        
        if action == ApprovalAction.APPROVE:
            update_query = """
                UPDATE sts_ts.leave_application
                SET approval_status = 'APPROVED',
                    approved_by = %s,
                    approved_at = %s,
                    updated_by = %s,
                    updated_at = %s
                WHERE id = %s
                RETURNING id, user_code, leave_type_code, from_date, to_date,
                    duration_days, duration_hours, reason, approval_status,
                    approved_by, approved_at, created_at
            """
            cursor.execute(update_query, (user_code, current_time, user_code, current_time, leave_id))
        else:  # REJECT
            update_query = """
                UPDATE sts_ts.leave_application
                SET approval_status = 'REJECTED',
                    rejected_by = %s,
                    rejected_at = %s,
                    rejection_reason = %s,
                    updated_by = %s,
                    updated_at = %s
                WHERE id = %s
                RETURNING id, user_code, leave_type_code, from_date, to_date,
                    duration_days, duration_hours, reason, approval_status,
                    rejected_by, rejected_at, rejection_reason, created_at
            """
            cursor.execute(update_query, (user_code, current_time, rejection_reason, user_code, current_time, leave_id))

        result = cursor.fetchone()
        if not result:
            raise Exception("Failed to update leave application - no ID returned")

        logger.info(f"[INFO] Successfully {action.value.lower()}d leave application {leave_id}")

        # Step 6: Commit transaction
        conn.commit()

        # Build response
        response_data = {
            "id": result[0],
            "user_code": result[1],
            "leave_type_code": result[2],
            "from_date": str(result[3]),
            "to_date": str(result[4]),
            "duration_days": float(result[5]),
            "duration_hours": float(result[6]) if result[6] else None,
            "reason": result[7],
            "approval_status": result[8],
            "created_at": result[-1].isoformat() if result[-1] else None
        }

        if action == ApprovalAction.APPROVE:
            response_data["approved_by"] = result[9]
            response_data["approved_at"] = result[10].isoformat() if result[10] else None
        else:
            response_data["rejected_by"] = result[9]
            response_data["rejected_at"] = result[10].isoformat() if result[10] else None
            response_data["rejection_reason"] = result[11]

        return {
            "Status_Flag": True,
            "Status_Description": f"Leave application {action.value.lower()}d successfully",
            "Status_Code": HTTPStatus.OK.value,
            "Status_Message": HTTPStatus.OK.phrase,
            "Response_Data": response_data
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
        logger.info(f"[INFO] Database connection closed for leave approval")

