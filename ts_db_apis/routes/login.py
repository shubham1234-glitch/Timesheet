# routes/login.py

import sys
import os
sys.path.append('E:\projects\sts_prod_developement')

from http import HTTPStatus
import psycopg2
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from auth.jwt_handler import create_access_token
from utils.connect_to_psql import connect_to_psql
from config import load_config
from helper_functions import verify_hash_pw, get_current_time_ist

from utils.logger import get_logger


config = load_config()
log_dir = config.get('log_dir')
log_file_name = config.get('log_file_name')

host = config.get('host')
port = config.get('port')
username = config.get('username')
password = config.get('password')
database_name = config.get('database_name')
schema_name = config.get('schema_name')

router = APIRouter()

# Initialize logger for this module
logger = get_logger(log_file_name, log_dir=log_dir)

class LoginSchema(BaseModel):
    user_code: str
    password: str

@router.post("/api/v1/timesheet/Login")
def login(RequestBody: LoginSchema):
    logger.info(f"[INFO] Starting login process for user_code: {RequestBody.user_code}")
    
    conn = None
    cursor = None

    try:
        logger.info(f"[INFO] Establishing database connection for login")
        conn = connect_to_psql(host, port, username, password, database_name, schema_name)
        cursor = conn.cursor()
        logger.info(f"[INFO] Database connection established successfully")


        logger.info(f"[INFO] Executing user authentication query for user_code: {RequestBody.user_code}")
        cursor.execute(
            
            """SELECT 
                user_code,
                user_name,
                password,
                user_type_code,
                user_type_description,
                designation_name,
                team_code,
                team_name,
                team_department,
                team_lead,
                reporter,
                company_code,
                contact_num,
                email_id
            FROM 
                sts_ts.view_login
            WHERE UPPER(user_code) = UPPER(%s)""",

            (RequestBody.user_code,)
        )
        result = cursor.fetchone()
        logger.info(f"[INFO] Authentication query executed successfully for user_code: {RequestBody.user_code}")

        if not result:
            logger.warning(f"[WARNING] Authentication failed for user_code: {RequestBody.user_code} - user not found")
            raise HTTPException(
                status_code=HTTPStatus.UNAUTHORIZED,
                detail="Authentication failed: Incorrect username or password."
            )

        # Extract user data
        user_code = result[0]
        emp_name = result[1]
        stored_password_hash = result[2]
        user_type_code = result[3]
        user_type_description = result[4]
        designation_name = result[5]
        team_code = result[6]
        team_name = result[7]
        team_department = result[8]
        team_lead = result[9]
        reporter = result[10]
        company_code = result[11]
        contact_num = result[12]
        email_id = result[13]
        
        # Check if current user is a reporter (super approver) (their user_code matches any team's reporter)
        logger.info(f"[INFO] Checking if user {user_code} is a reporter (super approver)")
        cursor.execute(
            """SELECT COUNT(*) 
               FROM sts_new.team_master 
               WHERE reporter = %s""",
            (user_code,)
        )
        is_super_approver_result = cursor.fetchone()
        is_super_approver = is_super_approver_result[0] > 0 if is_super_approver_result else False
        logger.info(f"[INFO] User {user_code} is_super_approver: {is_super_approver}")
        
        # Check if user is an admin (team lead or has admin designation)
        allowed_admin_designations = config.get('admin_designations', [])
        designation_normalized = designation_name.strip().lower() if designation_name else ""
        is_admin = (team_lead == user_code) or (designation_normalized in allowed_admin_designations)
        logger.info(f"[INFO] User {user_code} is_admin: {is_admin} (team_lead={team_lead}, user_code={user_code}, designation={designation_name}, normalized={designation_normalized})")
        
        # If user is a reporter (super approver), set reporter to their own user_code
        # Otherwise, use the reporter from their team (if any)
        if is_super_approver:
            effective_reporter = user_code
            logger.info(f"[INFO] User {user_code} is a reporter (super approver), setting reporter to their own code: {effective_reporter}")
        else:
            effective_reporter = reporter
            logger.info(f"[INFO] User {user_code} is not a reporter (super approver), using team's reporter: {effective_reporter}")
        
        # Unified reporter field:
        # For employees: reporter = their team_lead (who they report to)
        # For admins: reporter = team_master.reporter (E00002 - Sridhar, who they report to)
        # For super admins (super approvers): reporter = None (they don't report to anyone)
        if is_super_approver:
            # Super admin doesn't report to anyone
            unified_reporter = None
            logger.info(f"[INFO] User {user_code} is super approver, no reporter (they don't report to anyone)")
        elif is_admin:
            # Admin reports to the team's reporter (super admin)
            unified_reporter = effective_reporter
            logger.info(f"[INFO] User {user_code} is admin, reporter (who they report to): {unified_reporter}")
        else:
            # Employee reports to their team lead
            unified_reporter = team_lead
            logger.info(f"[INFO] User {user_code} is employee, reporter (team lead): {unified_reporter}")

        # Verify password using Argon2
        if not verify_hash_pw(stored_password_hash, RequestBody.password):
            logger.warning(f"[WARNING] Password verification failed for user_code: {user_code}")
            raise HTTPException(
                status_code=HTTPStatus.UNAUTHORIZED,
                detail="Authentication failed: Incorrect username or password."
            )
        
        logger.info(f"[INFO] Password verification successful for user_code: {user_code}")

        logger.info(f"[INFO] Authentication successful for user_code: {user_code}, type: {user_type_description}")

        # Update user_last_login timestamp
        logger.info(f"[INFO] Updating last login timestamp for user_code: {user_code}")
        current_time_ist = get_current_time_ist()
        cursor.execute(
            "UPDATE sts_new.user_master SET user_last_login = %s WHERE user_code = %s",
            (current_time_ist, user_code)
        )
        conn.commit()
        logger.info(f"[INFO] Last login timestamp updated successfully for user_code: {user_code}")

        # Check if user is a client (multiple variations)
        is_client = user_type_code.upper() in ["C", "CLIENT"]
        
        token_payload = {
            "user_code": user_code,
            "role": user_type_description,
            "company_code": company_code if is_client else None,
        }
        logger.info(f"[INFO] Creating access token for user_code: {user_code}")
        token = create_access_token(token_payload)
        logger.info(f"[INFO] Access token created successfully for user_code: {user_code}")

        logger.info(f"[INFO] Login process completed successfully for user_code: {user_code}")
        return {
            "success": True,
            "status_code": HTTPStatus.OK.value,
            "status_message": HTTPStatus.OK.phrase,
            "message": "Login successful",
            "access_token": token,
            "token_type": "bearer",
            "user_info": {
                "user_code": user_code,
                "user_type": user_type_description.lower() if user_type_description else None,
                "user_type_code": user_type_code.lower() if user_type_code else None,
                "emp_name": emp_name,
                "designation_name": designation_name.lower() if designation_name else None,
                "team_code": team_code if team_code else None,
                "team_name": team_name.lower() if team_name else None,
                "team_department": team_department.lower() if team_department else None,
                # Unified reporter field:
                # For employees: reporter = their team_lead (who they report to)
                # For admins: reporter = team_master.reporter (E00002 - Sridhar, who they report to)
                "reporter": unified_reporter if unified_reporter else None,
                "is_super_approver": is_super_approver,
                "contact_num": contact_num.lower() if contact_num else None,
                "email_id": email_id.lower() if email_id else None
            }
        }

    except psycopg2.IntegrityError as inte_error:
        logger.error(f"[ERROR] Database integrity error during login for user_code: {RequestBody.user_code}, error: {str(inte_error)}")
        return {
            "status": "error",
            "status_code": HTTPStatus.BAD_REQUEST.value,
            "status_message": "Integrity Error",
            "message": "Database constraint issue.",
            "error": str(inte_error)
        }

    except psycopg2.OperationalError as op_error:
        logger.error(f"[ERROR] Database operational error during login for user_code: {RequestBody.user_code}, error: {str(op_error)}")
        return {
            "status": "error",
            "status_code": HTTPStatus.SERVICE_UNAVAILABLE.value,
            "status_message": "DB Connection Error",
            "message": "Unable to connect to database.",
            "error": str(op_error)
        }

    except psycopg2.ProgrammingError as program_error:
        logger.error(f"[ERROR] Database programming error during login for user_code: {RequestBody.user_code}, error: {str(program_error)}")
        if conn:
            logger.info(f"[INFO] Rolling back transaction due to programming error")
            conn.rollback()
        return {
            "status": "error",
            "status_code": HTTPStatus.INTERNAL_SERVER_ERROR.value,
            "status_message": "Programming Error",
            "message": "SQL error or mismatch.",
            "error": str(program_error)
        }

    except HTTPException as http_err:
        if http_err.status_code == HTTPStatus.UNAUTHORIZED:
            logger.warning(f"[WARNING] Unauthorized login attempt for user_code: {RequestBody.user_code}")
            return {
                "status": "error",
                "status_code": http_err.status_code,
                "status_message": "Unauthorized",
                "message": "Login failed. Invalid credentials.",
                "error": str(http_err.detail)
            }
        logger.error(f"[ERROR] HTTP Exception during login for user_code: {RequestBody.user_code}, status_code: {http_err.status_code}, detail: {http_err.detail}")
        raise http_err

    except Exception as other_errors:
        logger.error(f"[ERROR] Unexpected error during login for user_code: {RequestBody.user_code}, error: {str(other_errors)}")
        return {
            "status": "error",
            "status_code": HTTPStatus.INTERNAL_SERVER_ERROR.value,
            "status_message": "Unexpected Error",
            "message": "Something went wrong.",
            "error": str(other_errors)
        }

    finally:
        if cursor:
            cursor.close()
            logger.info(f"[INFO] Database cursor closed")
        if conn:
            conn.close()
            logger.info(f"[INFO] Database connection closed")
