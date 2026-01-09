# routes/update_epic_status.py

import sys
import os
sys.path.append('E:\projects\sts_prod_developement')

from fastapi import APIRouter, HTTPException, Form, Depends
from auth.jwt_handler import verify_token
from http import HTTPStatus
from helper_functions import get_current_time_ist, parse_date
from typing import Optional
import psycopg2
from utils.connect_to_psql import connect_to_psql
from config import load_config
from utils.logger import get_logger
import traceback
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

# Status Code Enum - Valid values for epics
class StatusCode(str, Enum):
    NOT_YET_STARTED = "STS001"  # To Do / Not Yet Started
    IN_PROGRESS = "STS007"      # In Progress
    COMPLETED = "STS002"        # Completed
    CANCELLED = "STS010"        # Cancelled

@router.put("/api/v1/timesheet/update_epic/{epic_id}")
async def update_epic(
    epic_id: int,
    status_code: Optional[StatusCode] = Form(None, description="New status code for the epic (STS001, STS007, STS002, STS010)"),
    status_reason: str = Form(default="", description="Optional reason for the status change"),
    epic_title: Optional[str] = Form(None, description="Title of the epic"),
    epic_description: Optional[str] = Form(None, description="Description of the epic"),
    product_code: Optional[str] = Form(None, description="Product code this epic belongs to"),
    company_code: Optional[str] = Form(None, description="Company/client code"),
    contact_person_code: Optional[str] = Form(None, description="Contact person code"),
    start_date: Optional[str] = Form(None, description="Start date in DD-MM-YYYY or YYYY-MM-DD format"),
    due_date: Optional[str] = Form(None, description="Due date in DD-MM-YYYY or YYYY-MM-DD format"),
    closed_on: Optional[str] = Form(None, description="Closed on date (completion date) in DD-MM-YYYY or YYYY-MM-DD format"),
    estimated_hours: Optional[float] = Form(None, description="Estimated hours for the epic"),
    max_hours: Optional[float] = Form(None, description="Maximum hours allowed for the epic"),
    priority_code: Optional[int] = Form(None, description="Priority level of the epic"),
    is_billable: Optional[bool] = Form(None, description="Whether the epic is billable"),
    reporter: Optional[str] = Form(None, description="User code of the person reporting the epic"),
    current_user: dict = Depends(verify_token),
):
    """
    Update epic fields (status, dates, hours, priority, etc.) and create a history entry
    Updates both the epics table and inserts a snapshot into epic_hist
    At least one field must be provided for update
    All parameters are optional except epic_id - you can update any combination of fields
    """
    logger.info(f"[INFO] Starting epic update for epic_id: {epic_id}, user: {current_user['user_code']}")
    
    conn = None
    cursor = None

    try:
        logger.info(f"[INFO] Establishing database connection for epic update")
        conn = connect_to_psql(host, port, username, password, database_name, schema_name)
        cursor = conn.cursor()
        logger.info(f"[INFO] Database connection established successfully")

        # Step 1: Validate and fetch current epic data
        cursor.execute("""
            SELECT 
                id, status_code, priority_code, start_date, due_date, closed_on,
                estimated_hours, max_hours, is_billable, product_code,
                epic_title, epic_description, company_code, contact_person_code, reporter
            FROM sts_ts.epics
            WHERE id = %s
        """, (epic_id,))
        
        epic_result = cursor.fetchone()
        if not epic_result:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND,
                detail=f"Epic with ID {epic_id} does not exist"
            )
        
        # Extract current epic data
        (current_id, current_status, current_priority_code, current_start_date, current_due_date, 
         current_closed_on, current_estimated_hours, current_max_hours, current_is_billable, current_product_code,
         current_epic_title, current_epic_description, current_company_code, current_contact_person_code, current_reporter) = epic_result

        # Step 2: Check if at least one field is being updated
        # Helper function to check if a value is actually provided (not None, not empty, not "string")
        def is_valid_field(value):
            if value is None:
                return False
            if isinstance(value, str):
                stripped = value.strip()
                return stripped and stripped.lower() != "string"
            return True
        
        # Helper function to check if a field was provided in the request (even if empty)
        def is_field_provided(value):
            return value is not None
        
        if not any([
            status_code is not None,  # Check if status_code enum is provided
            is_field_provided(epic_title),  # Check if provided (even if empty string)
            is_field_provided(epic_description),  # Check if provided (even if empty string)
            is_field_provided(product_code),  # Check if provided (even if empty string)
            is_field_provided(company_code),  # Check if provided (even if empty string)
            is_field_provided(contact_person_code),  # Check if provided (even if empty string)
            is_field_provided(start_date),  # Check if provided (even if empty string)
            is_field_provided(due_date),  # Check if provided (even if empty string)
            is_field_provided(closed_on),  # Check if provided (even if empty string)
            is_field_provided(reporter),  # Check if provided (even if empty string)
            estimated_hours is not None,
            max_hours is not None,
            priority_code is not None and priority_code != 0,  # Ignore 0 as placeholder
            is_billable is not None
        ]):
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="At least one field must be provided for update (status_code, epic_title, epic_description, product_code, company_code, contact_person_code, start_date, due_date, closed_on, estimated_hours, max_hours, priority_code, is_billable, reporter)"
            )

        # Step 3: Validate new status code if provided (only check if it exists in status_master)
        new_status_code = None
        status_desc = None
        if status_code:
            # Convert enum to string value
            if isinstance(status_code, StatusCode):
                status_code_str = status_code.value
            else:
                status_code_str = str(status_code).upper()
            # Validate status_code is one of the allowed enum values
            try:
                status_code_enum = StatusCode(status_code_str)
                status_code_str = status_code_enum.value
            except ValueError:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Status code '{status_code_str}' is not allowed for epics. Allowed values are: STS001 (Not Yet Started), STS007 (In Progress), STS002 (Completed), STS010 (Cancelled)"
                )
            
            cursor.execute("SELECT status_desc FROM sts_new.status_master WHERE status_code = %s", (status_code_str,))
            status_result = cursor.fetchone()
            if not status_result:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Status code '{status_code_str}' does not exist in status_master"
                )
            new_status_code = status_code_str
            status_desc = status_result[0]

        # Step 4: Validate dates if provided (skip if empty string or placeholder)
        new_start_date = current_start_date
        new_due_date = current_due_date
        new_closed_on = current_closed_on
        
        if start_date and start_date.strip() and start_date.lower() != "string":
            try:
                new_start_date = parse_date(start_date)
            except ValueError as e:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Start date error: {str(e)}"
                )
        
        if due_date and due_date.strip() and due_date.lower() != "string":
            try:
                new_due_date = parse_date(due_date)
            except ValueError as e:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Due date error: {str(e)}"
                )
        
        if closed_on and closed_on.strip() and closed_on.lower() != "string":
            try:
                new_closed_on = parse_date(closed_on)
            except ValueError as e:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Closed on date error: {str(e)}"
                )

        # Step 5: Validate product_code if provided
        new_product_code = current_product_code
        if is_valid_field(product_code):
            cursor.execute("SELECT product_code FROM sts_new.product_master WHERE product_code = %s", (product_code.strip(),))
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Product code {product_code.strip()} does not exist"
                )
            new_product_code = product_code.strip()

        # Step 5.1: Validate company_code if provided
        new_company_code = current_company_code
        if company_code and company_code.strip() and company_code.lower() != "string":
            cursor.execute("SELECT company_code FROM sts_new.company_master WHERE company_code = %s", (company_code,))
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Company code {company_code} does not exist"
                )
            new_company_code = company_code

        # Step 5.2: Validate contact_person_code if provided
        new_contact_person_code = current_contact_person_code
        if contact_person_code and contact_person_code.strip() and contact_person_code.lower() != "string":
            cursor.execute("SELECT contact_person_code FROM sts_new.contact_master WHERE contact_person_code = %s", (contact_person_code,))
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Contact person code {contact_person_code} does not exist"
                )
            new_contact_person_code = contact_person_code

        # Step 5.3: Validate reporter if provided
        new_reporter = current_reporter
        if reporter and reporter.strip() and reporter.lower() != "string":
            cursor.execute("SELECT user_code FROM sts_new.user_master WHERE user_code = %s", (reporter.strip(),))
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Reporter with code {reporter.strip()} does not exist"
                )
            new_reporter = reporter.strip()

        # Step 5.4: Validate priority_code if provided (skip if 0 or invalid)
        new_priority_code = current_priority_code
        if priority_code is not None and priority_code != 0:
            cursor.execute("SELECT priority_code FROM sts_new.tkt_priority_master WHERE priority_code = %s", (priority_code,))
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail=f"Priority code {priority_code} does not exist"
                )
            new_priority_code = priority_code

        # Step 6: Validate current user exists
        cursor.execute("SELECT user_code FROM sts_new.user_master WHERE user_code = %s", (current_user['user_code'],))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"User with code {current_user['user_code']} does not exist"
            )

        # Step 7: Prepare update data
        current_time = get_current_time_ist()
        updated_by = current_user['user_code']
        
        # If status is "In Progress" (STS007), set start_date to current date if not already set
        # If start_date is not provided in the request and epic is moving to In Progress, set it to today
        if new_status_code == 'STS007':
            # Check if start_date was provided in the request
            start_date_provided = start_date and start_date.strip() and start_date.lower() != "string"
            if not start_date_provided:
                # No start_date provided in request - set to today when moving to In Progress
                # This will update even if epic already has a start_date (user wants current date when moving to In Progress)
                new_start_date = current_time.date()
                logger.info(f"[INFO] Setting start_date to {new_start_date} for epic {epic_id} moved to In Progress (no start_date provided in request)")
            elif current_start_date is None:
                # Start_date was provided in request and epic didn't have one - use the provided date
                logger.info(f"[INFO] Using provided start_date {new_start_date} for epic {epic_id} moved to In Progress")
        
        # If status is "Completed" (STS002), automatically set closed_on to current date
        if new_status_code == 'STS002':
            new_closed_on = current_time.date()
            logger.info(f"[INFO] Automatically setting closed_on to {new_closed_on} for completed epic {epic_id}")
        
        # If status is "Cancelled/Blocked" (STS010), automatically set cancelled fields
        # If status changes away from STS010, clear cancelled fields
        # Note: cancellation_reason is stored in status_reason field, not a separate column
        cancelled_by = None
        cancelled_at = None
        if new_status_code == 'STS010':
            cancelled_by = updated_by
            cancelled_at = current_time.date()
            logger.info(f"[INFO] Setting cancelled fields for epic {epic_id}: cancelled_by={cancelled_by}, cancelled_at={cancelled_at}, reason in status_reason")
        elif current_status == 'STS010' and new_status_code and new_status_code != 'STS010':
            # Status is changing away from cancelled, clear cancelled fields
            cancelled_by = None
            cancelled_at = None
            logger.info(f"[INFO] Clearing cancelled fields for epic {epic_id} as status changes from STS010 to {new_status_code}")

        # Use new values or keep current values
        final_status_code = new_status_code if new_status_code else current_status
        final_estimated_hours = estimated_hours if estimated_hours is not None else current_estimated_hours
        final_max_hours = max_hours if max_hours is not None else current_max_hours
        final_is_billable = is_billable if is_billable is not None else current_is_billable
        final_epic_title = epic_title if is_valid_field(epic_title) else current_epic_title
        final_epic_description = epic_description if is_valid_field(epic_description) else current_epic_description

        # Step 8: Build dynamic UPDATE query
        update_fields = []
        update_params = []
        
        if is_valid_field(epic_title):
            update_fields.append("epic_title = %s")
            update_params.append(final_epic_title)
        
        if is_valid_field(epic_description):
            update_fields.append("epic_description = %s")
            update_params.append(final_epic_description)
        
        if is_valid_field(product_code):
            update_fields.append("product_code = %s")
            update_params.append(new_product_code)
        
        if is_valid_field(company_code):
            update_fields.append("company_code = %s")
            update_params.append(new_company_code)
        
        if is_valid_field(contact_person_code):
            update_fields.append("contact_person_code = %s")
            update_params.append(new_contact_person_code)
        
        if is_valid_field(reporter):
            update_fields.append("reporter = %s")
            update_params.append(new_reporter)
        
        if new_status_code:
            update_fields.append("status_code = %s")
            update_params.append(new_status_code)
        
        # Update start_date if:
        # 1. start_date was explicitly provided in the request, OR
        # 2. Status is changing to In Progress (STS007) - this will include auto-set start_date
        if (start_date and start_date.strip() and start_date.lower() != "string") or (new_status_code == 'STS007'):
            update_fields.append("start_date = %s")
            update_params.append(new_start_date)
        
        if due_date and due_date.strip() and due_date.lower() != "string":
            update_fields.append("due_date = %s")
            update_params.append(new_due_date)
        
        # Always update closed_on when status is changed to Completed, or if user explicitly provided it
        if new_status_code == 'STS002' or (closed_on and closed_on.strip() and closed_on.lower() != "string"):
            update_fields.append("closed_on = %s")
            update_params.append(new_closed_on)
        
        if estimated_hours is not None:
            update_fields.append("estimated_hours = %s")
            update_params.append(final_estimated_hours)
        
        if max_hours is not None:
            update_fields.append("max_hours = %s")
            update_params.append(final_max_hours)
        
        if priority_code is not None and priority_code != 0:  # Ignore 0 as placeholder
            update_fields.append("priority_code = %s")
            update_params.append(new_priority_code)
        
        if is_billable is not None:
            update_fields.append("is_billable = %s")
            update_params.append(final_is_billable)
        
        # If status is "Cancelled/Blocked" (STS010), update cancelled fields
        # If status changes away from STS010, clear cancelled fields (set to NULL)
        # Note: cancellation_reason is stored in epics.cancellation_reason (for master table only)
        # In epic_hist, we use status_reason instead
        if new_status_code == 'STS010':
            update_fields.append("cancelled_by = %s")
            update_params.append(cancelled_by)
            update_fields.append("cancelled_at = %s")
            update_params.append(cancelled_at)
            update_fields.append("cancellation_reason = %s")
            update_params.append(status_reason if status_reason else None)  # Store in epics for backward compatibility
        elif current_status == 'STS010' and new_status_code and new_status_code != 'STS010':
            # Status is changing away from cancelled, clear cancelled fields
            update_fields.append("cancelled_by = %s")
            update_params.append(None)
            update_fields.append("cancelled_at = %s")
            update_params.append(None)
            update_fields.append("cancellation_reason = %s")
            update_params.append(None)
        
        # Always update audit fields
        update_fields.append("updated_by = %s")
        update_params.append(updated_by)
        update_fields.append("updated_at = %s")
        update_params.append(current_time)
        
        # Add WHERE clause parameter
        update_params.append(epic_id)
        
        update_query = f"""
            UPDATE sts_ts.epics
            SET {', '.join(update_fields)}
            WHERE id = %s
            RETURNING id
        """
        
        cursor.execute(update_query, tuple(update_params))
        
        update_result = cursor.fetchone()
        if not update_result:
            raise Exception("Failed to update epic - no ID returned")
        
        logger.info(f"[INFO] Successfully updated epic {epic_id}")

        # Step 9: Get reporter for history (use updated reporter if provided, otherwise use current or fetch from team_master)
        # If reporter was updated, use the new reporter
        if is_valid_field(reporter):
            reporter_for_hist = new_reporter
            logger.info(f"[INFO] Using updated reporter {reporter_for_hist} for epic history")
        elif current_reporter:
            reporter_for_hist = current_reporter
            logger.info(f"[INFO] Using current reporter {reporter_for_hist} for epic history")
        else:
            # Get creator's team and fetch reporter from team_master
            cursor.execute("""
                SELECT um.team_code, tm.reporter
                FROM sts_ts.epics e
                JOIN sts_new.user_master um ON e.created_by = um.user_code
                LEFT JOIN sts_new.team_master tm ON um.team_code = tm.team_code
                WHERE e.id = %s
            """, (epic_id,))
            team_reporter_result = cursor.fetchone()
            if team_reporter_result and team_reporter_result[1]:
                reporter_for_hist = team_reporter_result[1]
                logger.info(f"[INFO] Reporter not set in epic, fetched from team_master: {reporter_for_hist}")
            else:
                raise HTTPException(
                    status_code=HTTPStatus.BAD_REQUEST,
                    detail="Reporter is not configured for epic and cannot be determined from team. Please ensure reporter is set in epics or team_master."
                )
        
        # Step 10: Insert status history entry with full snapshot
        status_hist_query = """
            INSERT INTO sts_ts.epic_hist (
                epic_code, status_code, status_reason, user_code, reporter, priority_code, product_code,
                start_date, due_date, closed_on, estimated_hours, max_hours,
                cancelled_by, cancelled_at,
                created_by, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s,
                %s, %s
            ) RETURNING id
        """
        
        # Get cancelled_by, cancelled_at for history
        # If final status is STS010, use the cancelled values we set (or fetch if already set in DB)
        # If status is changing away from STS010, use None
        # Otherwise, fetch from database
        if final_status_code == 'STS010':
            # Status is STS010 - use the cancelled values we set, or fetch from DB if we didn't set them
            if cancelled_by is not None:
                # We just set these values in this transaction
                cancelled_by_hist = cancelled_by
                cancelled_at_hist = cancelled_at
            else:
                # Status is already STS010 and we're not changing it, fetch from DB
                cursor.execute("""
                    SELECT cancelled_by, cancelled_at
                    FROM sts_ts.epics
                    WHERE id = %s
                """, (epic_id,))
                cancelled_data = cursor.fetchone()
                cancelled_by_hist = cancelled_data[0] if cancelled_data else None
                cancelled_at_hist = cancelled_data[1] if cancelled_data else None
        else:
            # Status is not STS010 - cancelled fields should be None
            cancelled_by_hist = None
            cancelled_at_hist = None
        
        cursor.execute(status_hist_query, (
            epic_id,  # epic_code (references epics.id)
            final_status_code,  # Use final status code
            status_reason if status_reason else None,  # status_reason (used for cancellation reason when status is STS010)
            updated_by,  # user_code - user who made the change/update
            reporter_for_hist,  # reporter - use updated reporter if provided, otherwise current or from team_master
            new_priority_code,  # Use updated priority
            new_product_code,  # Use updated product_code
            new_start_date,  # Use updated start_date
            new_due_date,  # Use updated due_date
            new_closed_on,  # Use updated closed_on
            final_estimated_hours,  # Use updated estimated_hours
            final_max_hours,  # Use updated max_hours
            cancelled_by_hist,
            cancelled_at_hist,
            updated_by,  # created_by (user who made the change)
            current_time
        ))
        
        hist_result = cursor.fetchone()
        if not hist_result:
            raise Exception("Failed to insert epic history entry - no ID returned")
        epic_hist_id = hist_result[0]
        logger.info(f"[INFO] Successfully created epic history entry with id: {epic_hist_id}")

        # Step 11: Commit transaction
        conn.commit()
        logger.info(f"[INFO] Successfully updated epic for epic_id: {epic_id}")

        # Build response with updated fields
        response_data = {
            "epic_id": epic_id,
            "updated_by": updated_by,
            "updated_at": current_time.isoformat(),
            "epic_history_id": epic_hist_id
        }
        
        if status_code:
            response_data["previous_status"] = current_status
            response_data["new_status"] = final_status_code
            response_data["status_description"] = status_desc
            response_data["status_reason"] = status_reason if status_reason else None
        
        if start_date or due_date or closed_on or (new_status_code == 'STS007' and new_start_date != current_start_date) or (new_status_code == 'STS002' and new_closed_on != current_closed_on):
            response_data["dates"] = {
                "start_date": new_start_date.isoformat() if new_start_date else None,
                "due_date": new_due_date.isoformat() if new_due_date else None,
                "closed_on": new_closed_on.isoformat() if new_closed_on else None
            }
        
        if estimated_hours is not None:
            response_data["estimated_hours"] = float(final_estimated_hours)
        
        if max_hours is not None:
            response_data["max_hours"] = float(final_max_hours)
        
        if priority_code is not None and priority_code != 0:
            response_data["priority_code"] = new_priority_code
        
        if is_billable is not None:
            response_data["is_billable"] = final_is_billable
        
        if is_valid_field(product_code):
            response_data["product_code"] = new_product_code
            # Fetch product name for response
            cursor.execute("SELECT product_name FROM sts_new.product_master WHERE product_code = %s", (new_product_code,))
            product_result = cursor.fetchone()
            if product_result:
                response_data["product_name"] = product_result[0]

        return {
            "Status_Flag": True,
            "Status_Description": "Epic updated successfully",
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
        logger.error(f"[ERROR] Database query error: {str(e)}")
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Database query failed"
        )
    except HTTPException:
        # Re-raise HTTP exceptions
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
        logger.info(f"[INFO] Database connection closed for epic update")

