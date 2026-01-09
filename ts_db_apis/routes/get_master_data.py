# routes/get_master_data.py

import sys
sys.path.append('E:\projects\sts_prod_developement')

import asyncio
from http import HTTPStatus
from typing import Dict, List, Any
import psycopg2
from fastapi import APIRouter, Depends
from auth.jwt_handler import verify_token
from utils.connect_to_psql import connect_to_psql
from config import load_config
from utils.logger import get_logger

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

def fetch_task_status_masters() -> List[Dict[str, Any]]:
    """Fetch task/epic status master data - only the allowed statuses for tasks and epics"""
    logger.info(f"[INFO] Starting task status master data retrieval")
    
    conn = connect_to_psql(host, port, username, password, database_name, schema_name)
    cursor = conn.cursor()
    try:
        logger.info(f"[INFO] Executing task status master query")
        # Only fetch status codes allowed for tasks and epics: STS001, STS007, STS002, STS010
        query = """
            SELECT status_code, status_desc 
            FROM sts_new.status_master 
            WHERE status_code IN ('STS001', 'STS007', 'STS002', 'STS010')
            ORDER BY status_code asc
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        statuses = []
        for idx, row in enumerate(rows, start=1):
            statuses.append({
                "id": idx,  # Sequential ID for frontend compatibility
                "status_code": row[0],
                "status_desc": row[1],
            })
        logger.info(f"[INFO] Task status master data retrieved successfully, count: {len(statuses)}")
        return statuses
    except Exception as e:
        logger.error(f"[ERROR] Error in fetch_task_status_masters function, error: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()
        logger.info(f"[INFO] Task status master database connection closed")

def fetch_priority_masters() -> List[Dict[str, Any]]:
    """Fetch task priority master data from main schema"""
    logger.info(f"[INFO] Starting task priority master data retrieval")
    
    conn = connect_to_psql(host, port, username, password, database_name, schema_name)
    cursor = conn.cursor()
    try:
        logger.info(f"[INFO] Executing task priority master query")
        query = """
            SELECT priority_code, priority_desc 
            FROM sts_new.tkt_priority_master 
            ORDER BY priority_code asc
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        priorities = []
        for row in rows:
            priorities.append({
                "priority_code": row[0],
                "priority_desc": row[1],
                "sort_order": row[0]  # Use priority_code as sort_order
            })
        logger.info(f"[INFO] Task priority master data retrieved successfully, count: {len(priorities)}")
        return priorities
    except Exception as e:
        logger.error(f"[ERROR] Error in fetch_task_priority_masters function, error: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()
        logger.info(f"[INFO] Task priority master database connection closed")






def fetch_product_masters() -> List[Dict[str, Any]]:
    """Fetch product master data"""
    logger.info(f"[INFO] Starting product master data retrieval")
    
    conn = connect_to_psql(host, port, username, password, database_name, schema_name)
    cursor = conn.cursor()
    try:
        logger.info(f"[INFO] Executing product master query")
        query = """
            SELECT 
                product_code, 
                product_name,
                version,
                product_desc
            FROM sts_new.product_master 
            ORDER BY product_code asc
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        products = []
        for row in rows:
            products.append({
                "product_code": row[0],
                "product_name": row[1],
                "version": row[2],
                "product_desc": row[3],
            })
        logger.info(f"[INFO] Product master data retrieved successfully, count: {len(products)}")
        return products
    except Exception as e:
        logger.error(f"[ERROR] Error in product_masters function, error: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()
        logger.info(f"[INFO] Product master database connection closed")


def fetch_employee_masters() -> List[Dict[str, Any]]:
    """Fetch active employees for timesheet system"""
    logger.info(f"[INFO] Starting employee master data retrieval for timesheet")
    
    conn = connect_to_psql(host, port, username, password, database_name, schema_name)
    cursor = conn.cursor()
    try:
        logger.info(f"[INFO] Executing employee master query")
        query = """
            SELECT 
                um.user_code, 
                CASE 
                    WHEN um.first_name IS NOT NULL AND um.last_name IS NOT NULL THEN um.first_name || ' ' || um.last_name
                    WHEN um.first_name IS NOT NULL THEN um.first_name
                    WHEN um.last_name IS NOT NULL THEN um.last_name
                    ELSE um.user_name
                END AS full_name,
                um.user_type_code,
                um.user_type_description,
                um.designation_name,
                um.team_code,
                tm.team_name,
                tm.department,
                um.contact_num,
                um.email_id,
                um.user_pfp_path,
                CASE WHEN um.user_code = tm.team_lead THEN TRUE ELSE FALSE END AS is_team_lead,
                -- Unified reporter field:
                -- For employees: reporter = their team_lead (who they report to)
                -- For admins/team leads: reporter = team_master.reporter (E00002 - Sridhar, who they report to)
                CASE 
                    WHEN um.user_code = tm.team_lead THEN tm.reporter
                    ELSE tm.team_lead
                END AS reporter
            FROM sts_new.user_master um
            LEFT JOIN sts_new.team_master tm ON um.team_code = tm.team_code
            WHERE um.is_inactive = false AND um.user_type_code NOT IN ('C', 'CLIENT', 'SA')
            ORDER BY um.user_name ASC;
        """
        cursor.execute(query)
        rows = cursor.fetchall()

        employees = []
        for row in rows:
            employees.append({
                "user_code": row[0],
                "user_name": row[1],
                "user_type_code": row[2] if row[2] else None,
                "user_type_description": row[3] if row[3] else "Unknown",
                "designation_name": row[4] if row[4] else "Employee",
                "team_code": row[5] if row[5] else None,
                "team_name": row[6] if row[6] else None,
                "department": row[7] if row[7] else None,
                "contact_num": row[8] if row[8] else None,
                "email_id": row[9] if row[9] else None,
                "pfp_pic_path": row[10] if row[10] else None,
                "is_team_lead": row[11] if row[11] is not None else False,
                "reporter": row[12] if row[12] else None  # Reporter: team_master.reporter for team leads, team_master.team_lead for employees
            })
        logger.info(f"[INFO] Employee master data retrieved successfully, count: {len(employees)}")
        return employees
    except Exception as e:
        logger.error(f"[ERROR] Error in fetch_employee_masters function, error: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()
        logger.info(f"[INFO] Employee master database connection closed")


def fetch_team_masters() -> List[Dict[str, Any]]:
    """Fetch all active teams from team_master"""
    logger.info(f"[INFO] Starting team master data retrieval")
    
    conn = connect_to_psql(host, port, username, password, database_name, schema_name)
    cursor = conn.cursor()
    try:
        logger.info(f"[INFO] Executing team master query")
        query = """
            SELECT 
                tm.team_code,
                tm.team_name,
                tm.team_description,
                tm.team_lead,
                tm.reporter,
                tm.department,
                tm.is_active,
                tm.created_by,
                tm.created_at,
                tm.updated_by,
                tm.updated_at
            FROM sts_new.team_master tm
            WHERE tm.is_active = true
            ORDER BY tm.team_name ASC;
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        teams = []
        for row in rows:
            teams.append({
                "team_code": row[0],
                "team_name": row[1],
                "team_description": row[2] if row[2] else None,
                "team_lead": row[3] if row[3] else None,
                "reporter": row[4] if row[4] else None,
                "department": row[5] if row[5] else None,
                "is_active": row[6] if row[6] is not None else True,
                "created_by": row[7] if row[7] else None,
                "created_at": str(row[8]) if row[8] else None,
                "updated_by": row[9] if row[9] else None,
                "updated_at": str(row[10]) if row[10] else None,
            })
        
        logger.info(f"[INFO] Team master data retrieved successfully, count: {len(teams)}")
        return teams
    except Exception as e:
        logger.error(f"[ERROR] Error in fetch_team_masters function, error: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()
        logger.info(f"[INFO] Team master database connection closed")


def fetch_epic_masters() -> List[Dict[str, Any]]:
    """Fetch epic master data with tasks"""
    logger.info(f"[INFO] Starting epic master data retrieval")
    
    conn = connect_to_psql(host, port, username, password, database_name, schema_name)
    cursor = conn.cursor()
    try:
        logger.info(f"[INFO] Executing epic master query")
        query = """
            SELECT 
                em.id,
                em.epic_title,
                em.epic_description,
                em.product_code,
                pm.product_name,
                em.company_code,
                cm.company_name,
                em.contact_person_code,
                cpm.full_name AS contact_person_name,
                cpm.email_id AS contact_person_email,
                cpm.contact_num AS contact_person_phone,
                em.reporter,
                em.status_code,
                sm.status_desc,
                em.priority_code,
                em.start_date,
                em.due_date,
                em.closed_on,
                em.estimated_hours,
                em.max_hours,
                em.is_billable,
                em.created_by,
                em.created_at
            FROM sts_ts.epics em
            LEFT JOIN sts_new.product_master pm ON em.product_code = pm.product_code
            LEFT JOIN sts_new.company_master cm ON em.company_code = cm.company_code
            LEFT JOIN sts_new.contact_master cpm ON em.contact_person_code = cpm.contact_person_code
            LEFT JOIN sts_new.status_master sm ON em.status_code = sm.status_code
            ORDER BY em.id DESC;
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        epics = []
        epic_ids = []
        for row in rows:
            epic_id = row[0]
            epic_ids.append(epic_id)
            epics.append({
                "id": epic_id,
                "epic_title": row[1],
                "epic_description": row[2] if row[2] else None,
                "product_code": row[3],
                "product_name": row[4] if row[4] else None,
                "company_code": row[5] if row[5] else None,
                "company_name": row[6] if row[6] else None,
                "contact_person_code": row[7] if row[7] else None,
                "contact_person_name": row[8] if row[8] else None,
                "contact_person_email": row[9] if row[9] else None,
                "contact_person_phone": row[10] if row[10] else None,
                "reporter": row[11] if row[11] else None,
                "status_code": row[12],
                "status_desc": row[13] if row[13] else None,
                "priority_code": row[14],
                "start_date": str(row[15]) if row[15] else None,
                "due_date": str(row[16]) if row[16] else None,
                "closed_on": str(row[17]) if row[17] else None,
                "estimated_hours": float(row[18]) if row[18] else None,
                "max_hours": float(row[19]) if row[19] else None,
                "is_billable": row[20] if row[20] is not None else True,
                "created_by": row[21],
                "created_at": str(row[22]) if row[22] else None,
                "tasks": []  # Initialize tasks array
            })
        
        # Fetch tasks for all epics
        if epic_ids:
            logger.info(f"[INFO] Fetching tasks for {len(epic_ids)} epics")
            tasks_query = """
                SELECT 
                    t.id,
                    t.epic_code,
                    t.task_title,
                    t.description,
                    t.assignee,
                    t.reporter,
                    t.status_code,
                    sm.status_desc,
                    t.priority_code,
                    t.task_type_code,
                    t.work_mode,
                    t.assigned_team_code,
                    t.product_code,
                    t.assigned_on,
                    t.start_date,
                    t.due_date,
                    t.closed_on,
                    t.estimated_hours,
                    t.max_hours,
                    t.is_billable,
                    t.cancelled_by,
                    t.cancelled_at,
                    t.cancellation_reason,
                    t.created_by,
                    t.created_at
                FROM sts_ts.tasks t
                LEFT JOIN sts_new.status_master sm ON t.status_code = sm.status_code
                WHERE t.epic_code = ANY(%s)
                ORDER BY t.id DESC;
            """
            cursor.execute(tasks_query, (epic_ids,))
            task_rows = cursor.fetchall()
            
            # Group tasks by epic_code
            tasks_by_epic = {}
            for task_row in task_rows:
                epic_code = task_row[1]
                if epic_code not in tasks_by_epic:
                    tasks_by_epic[epic_code] = []
                
                tasks_by_epic[epic_code].append({
                    "id": task_row[0],
                    "task_title": task_row[2],
                    "description": task_row[3] if task_row[3] else None,
                    "assignee": task_row[4],
                    "reporter": task_row[5] if task_row[5] else None,
                    "status_code": task_row[6],
                    "status_desc": task_row[7] if task_row[7] else None,
                    "priority_code": task_row[8],
                    "task_type_code": task_row[9] if task_row[9] else None,
                    "work_mode": task_row[10] if task_row[10] else None,
                    "assigned_team_code": task_row[11] if task_row[11] else None,
                    "product_code": task_row[12] if task_row[12] else None,
                    "assigned_on": str(task_row[13]) if task_row[13] else None,
                    "start_date": str(task_row[14]) if task_row[14] else None,
                    "due_date": str(task_row[15]) if task_row[15] else None,
                    "closed_on": str(task_row[16]) if task_row[16] else None,
                    "estimated_hours": float(task_row[17]) if task_row[17] else None,
                    "max_hours": float(task_row[18]) if task_row[18] else None,
                    "is_billable": task_row[19] if task_row[19] is not None else True,
                    "cancelled_by": task_row[20] if task_row[20] else None,
                    "cancelled_at": str(task_row[21]) if task_row[21] else None,
                    "cancellation_reason": task_row[22] if task_row[22] else None,
                    "created_by": task_row[23],
                    "created_at": str(task_row[24]) if task_row[24] else None
                })
            
            # Add tasks to their respective epics
            for epic in epics:
                epic_id = epic["id"]
                if epic_id in tasks_by_epic:
                    epic["tasks"] = tasks_by_epic[epic_id]
                else:
                    epic["tasks"] = []
        
        logger.info(f"[INFO] Epic master data retrieved successfully, count: {len(epics)}")
        return epics
    except Exception as e:
        logger.error(f"[ERROR] Error in fetch_epic_masters function, error: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()
        logger.info(f"[INFO] Epic master database connection closed")


def fetch_company_masters() -> List[Dict[str, Any]]:
    """Fetch company master data for dropdowns"""
    logger.info(f"[INFO] Starting company master data retrieval")
    
    conn = connect_to_psql(host, port, username, password, database_name, schema_name)
    cursor = conn.cursor()
    try:
        logger.info(f"[INFO] Executing company master query")
        query = """
            SELECT 
                company_code,
                company_name,
                branch,
                email_id,
                contact_num,
                address,
                city,
                state,
                zip_code,
                country
            FROM sts_new.company_master 
            WHERE is_inactive = false
            ORDER BY company_name ASC;
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        companies = []
        for row in rows:
            companies.append({
                "company_code": row[0],
                "company_name": row[1],
                "branch": row[2] if row[2] else None,
                "email_id": row[3] if row[3] else None,
                "contact_num": row[4] if row[4] else None,
                "address": row[5] if row[5] else None,
                "city": row[6] if row[6] else None,
                "state": row[7] if row[7] else None,
                "zip_code": row[8] if row[8] else None,
                "country": row[9] if row[9] else None
            })
        logger.info(f"[INFO] Company master data retrieved successfully, count: {len(companies)}")
        return companies
    except Exception as e:
        logger.error(f"[ERROR] Error in fetch_company_masters function, error: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()
        logger.info(f"[INFO] Company master database connection closed")


def fetch_contact_person_masters() -> List[Dict[str, Any]]:
    """Fetch contact person master data for dropdowns"""
    logger.info(f"[INFO] Starting contact person master data retrieval")
    
    conn = connect_to_psql(host, port, username, password, database_name, schema_name)
    cursor = conn.cursor()
    try:
        logger.info(f"[INFO] Executing contact person master query")
        query = """
            SELECT 
                cpm.contact_person_code,
                cpm.full_name,
                cpm.first_name,
                cpm.last_name,
                cpm.email_id,
                cpm.contact_num,
                cpm.company_code,
                cm.company_name,
                cpm.address,
                cpm.city,
                cpm.state,
                cpm.zip_code,
                cpm.branch
            FROM sts_new.contact_master cpm
            LEFT JOIN sts_new.company_master cm ON cpm.company_code = cm.company_code
            WHERE cpm.is_inactive = false
            ORDER BY cpm.full_name ASC;
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        contact_persons = []
        for row in rows:
            contact_persons.append({
                "contact_person_code": row[0],
                "full_name": row[1],
                "first_name": row[2] if row[2] else None,
                "last_name": row[3] if row[3] else None,
                "email_id": row[4] if row[4] else None,
                "contact_num": row[5] if row[5] else None,
                "company_code": row[6] if row[6] else None,
                "company_name": row[7] if row[7] else None,
                "address": row[8] if row[8] else None,
                "city": row[9] if row[9] else None,
                "state": row[10] if row[10] else None,
                "zip_code": row[11] if row[11] else None,
                "branch": row[12] if row[12] else None
            })
        logger.info(f"[INFO] Contact person master data retrieved successfully, count: {len(contact_persons)}")
        return contact_persons
    except Exception as e:
        logger.error(f"[ERROR] Error in fetch_contact_person_masters function, error: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()
        logger.info(f"[INFO] Contact person master database connection closed")

def fetch_work_location_masters() -> List[Dict[str, Any]]:
    """Fetch work location options - values are defined by CHECK constraint (REMOTE, ON_SITE, OFFICE)"""
    logger.info(f"[INFO] Starting work location master data retrieval")
    
    try:
        # Work location values are defined by CHECK constraint, not a master table
        # These values are used for both work_mode (tasks) and work_location (timesheet_entry)
        work_locations = [
            {
                "work_location_code": "REMOTE",
                "work_location_name": "Remote",
                "work_location_description": "Work from home or remote location"
            },
            {
                "work_location_code": "ON_SITE",
                "work_location_name": "On Site",
                "work_location_description": "Work at client site or on-site location"
            },
            {
                "work_location_code": "OFFICE",
                "work_location_name": "Office",
                "work_location_description": "Work at company office"
            }
        ]
        
        logger.info(f"[INFO] Work location master data retrieved successfully, count: {len(work_locations)}")
        return work_locations
    except Exception as e:
        logger.error(f"[ERROR] Error in fetch_work_location_masters function, error: {str(e)}")
        raise


def fetch_leave_type_masters() -> List[Dict[str, Any]]:
    """Fetch active leave type master data"""
    logger.info(f"[INFO] Starting leave type master data retrieval")
    
    conn = connect_to_psql(host, port, username, password, database_name, schema_name)
    cursor = conn.cursor()
    try:
        logger.info(f"[INFO] Executing leave type master query")
        query = """
            SELECT 
                leave_type_code,
                leave_type_name,
                leave_type_description,
                is_active
            FROM sts_ts.leave_type_master
            WHERE is_active = true
            ORDER BY leave_type_code;
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        leave_types = []
        for row in rows:
            leave_types.append({
                "leave_type_code": row[0],
                "leave_type_name": row[1],
                "leave_type_description": row[2] if row[2] else None,
                "is_active": row[3]
            })
        
        logger.info(f"[INFO] Leave type master data retrieved successfully, count: {len(leave_types)}")
        return leave_types
    except Exception as e:
        logger.error(f"[ERROR] Error in fetch_leave_type_masters function, error: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()
        logger.info(f"[INFO] Leave type master database connection closed")


def fetch_reporter_masters() -> List[Dict[str, Any]]:
    """Fetch reporters (team leads and super admins) for timesheet system"""
    logger.info(f"[INFO] Starting reporter master data retrieval for timesheet")
    
    conn = connect_to_psql(host, port, username, password, database_name, schema_name)
    cursor = conn.cursor()
    try:
        logger.info(f"[INFO] Executing reporter master query")
        # Get team leads and super admins (users who are reporter in team_master or have user_type_code = 'SA')
        query = """
            SELECT 
                um.user_code, 
                CASE 
                    WHEN um.first_name IS NOT NULL AND um.last_name IS NOT NULL THEN um.first_name || ' ' || um.last_name
                    WHEN um.first_name IS NOT NULL THEN um.first_name
                    WHEN um.last_name IS NOT NULL THEN um.last_name
                    ELSE um.user_name
                END AS full_name,
                um.user_type_code,
                um.user_type_description,
                um.designation_name,
                um.team_code,
                tm.team_name,
                um.contact_num,
                um.email_id,
                um.user_pfp_path,
                CASE WHEN um.user_code IN (SELECT team_lead FROM sts_new.team_master WHERE team_lead IS NOT NULL) THEN TRUE ELSE FALSE END AS is_team_lead,
                CASE WHEN um.user_type_code = 'SA' OR um.user_code IN (SELECT reporter FROM sts_new.team_master WHERE reporter IS NOT NULL) THEN TRUE ELSE FALSE END AS is_super_admin
            FROM sts_new.user_master um
            LEFT JOIN sts_new.team_master tm ON um.team_code = tm.team_code
            WHERE um.is_inactive = false 
              AND (
                  -- Team leads
                  um.user_code IN (SELECT team_lead FROM sts_new.team_master WHERE team_lead IS NOT NULL AND is_active = true)
                  OR
                  -- Super admins (user_type_code = 'SA' or users who are reporter in team_master)
                  um.user_type_code = 'SA'
                  OR
                  um.user_code IN (SELECT reporter FROM sts_new.team_master WHERE reporter IS NOT NULL AND is_active = true)
              )
            GROUP BY um.user_code, um.first_name, um.last_name, um.user_name, um.user_type_code, 
                     um.user_type_description, um.designation_name, um.team_code, tm.team_name, 
                     um.contact_num, um.email_id, um.user_pfp_path
            ORDER BY full_name ASC;
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        reporters = []
        for row in rows:
            reporters.append({
                "user_code": row[0],
                "user_name": row[1],
                "user_type_code": row[2] if row[2] else None,
                "user_type_description": row[3] if row[3] else "Unknown",
                "designation_name": row[4] if row[4] else None,
                "team_code": row[5] if row[5] else None,
                "team_name": row[6] if row[6] else None,
                "contact_num": row[7] if row[7] else None,
                "email_id": row[8] if row[8] else None,
                "pfp_pic_path": row[9] if row[9] else None,
                "is_team_lead": row[10] if row[10] is not None else False,
                "is_super_admin": row[11] if row[11] is not None else False
            })
        # Sort by user_name for final output
        reporters.sort(key=lambda x: x['user_name'] or '')
        logger.info(f"[INFO] Reporter master data retrieved successfully, count: {len(reporters)}")
        return reporters
    except Exception as e:
        logger.error(f"[ERROR] Error in fetch_reporter_masters function, error: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()
        logger.info(f"[INFO] Reporter master database connection closed")


def fetch_predefined_tasks() -> List[Dict[str, Any]]:
    """Fetch all predefined tasks (independent task templates)"""
    logger.info(f"[INFO] Starting predefined tasks master data retrieval")
    
    conn = connect_to_psql(host, port, username, password, database_name, schema_name)
    cursor = conn.cursor()
    try:
        logger.info(f"[INFO] Executing predefined tasks query")
        query = """
            SELECT 
                pt.id,
                pt.task_title,
                pt.task_description,
                pt.status_code,
                sm.status_desc AS status_description,
                pt.priority_code,
                pr.priority_desc AS priority_description,
                pt.task_type_code,
                ttm.type_name AS task_type_name,
                pt.work_mode,
                pt.team_code,
                tm.team_name AS team_name,
                pt.estimated_hours,
                pt.max_hours,
                pt.is_billable,
                pt.created_by,
                um_created.user_name AS created_by_name,
                pt.created_at,
                pt.updated_by,
                um_updated.user_name AS updated_by_name,
                pt.updated_at
            FROM sts_ts.predefined_tasks pt
            LEFT JOIN sts_new.status_master sm ON pt.status_code = sm.status_code
            LEFT JOIN sts_new.tkt_priority_master pr ON pt.priority_code = pr.priority_code
            LEFT JOIN sts_ts.task_type_master ttm ON pt.task_type_code = ttm.type_code
            LEFT JOIN sts_new.team_master tm ON pt.team_code = tm.team_code
            LEFT JOIN sts_new.user_master um_created ON pt.created_by = um_created.user_code
            LEFT JOIN sts_new.user_master um_updated ON pt.updated_by = um_updated.user_code
            ORDER BY pt.task_title ASC;
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        predefined_tasks = []
        for row in rows:
            predefined_tasks.append({
                "id": row[0],
                "task_title": row[1],
                "task_description": row[2] if row[2] else None,
                "status_code": row[3],
                "status_description": row[4] if row[4] else None,
                "priority_code": row[5],
                "priority_description": row[6] if row[6] else None,
                "task_type_code": row[7] if row[7] else None,
                "task_type_name": row[8] if row[8] else None,
                "work_mode": row[9],
                "team_code": row[10] if row[10] else None,
                "team_name": row[11] if row[11] else None,
                "estimated_hours": float(row[12]) if row[12] else None,
                "max_hours": float(row[13]) if row[13] else None,
                "is_billable": row[14] if row[14] is not None else True,
                "created_by": row[15],
                "created_by_name": row[16] if row[16] else None,
                "created_at": str(row[17]) if row[17] else None,
                "updated_by": row[18] if row[18] else None,
                "updated_by_name": row[19] if row[19] else None,
                "updated_at": str(row[20]) if row[20] else None
            })
        
        logger.info(f"[INFO] Predefined tasks master data retrieved successfully, count: {len(predefined_tasks)}")
        return predefined_tasks
    except Exception as e:
        logger.error(f"[ERROR] Error in fetch_predefined_tasks function, error: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()
        logger.info(f"[INFO] Predefined tasks master database connection closed")


def fetch_task_type_masters() -> List[Dict[str, Any]]:
    """Fetch all active task type master data"""
    logger.info(f"[INFO] Starting task type master data retrieval")
    
    conn = connect_to_psql(host, port, username, password, database_name, schema_name)
    cursor = conn.cursor()
    try:
        logger.info(f"[INFO] Executing task type master query")
        query = """
            SELECT 
                id,
                type_code,
                type_name,
                type_description,
                is_billable,
                is_travel_required,
                is_active
            FROM sts_ts.task_type_master
            WHERE is_active = true
            ORDER BY type_code ASC;
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        task_types = []
        for row in rows:
            task_types.append({
                "id": row[0],
                "type_code": row[1],
                "type_name": row[2],
                "type_description": row[3] if row[3] else None,
                "is_billable": row[4] if row[4] is not None else True,
                "is_travel_required": row[5] if row[5] is not None else False,
                "is_active": row[6] if row[6] is not None else True
            })
        
        logger.info(f"[INFO] Task type master data retrieved successfully, count: {len(task_types)}")
        return task_types
    except Exception as e:
        logger.error(f"[ERROR] Error in fetch_task_type_masters function, error: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()
        logger.info(f"[INFO] Task type master database connection closed")


def fetch_activities_masters() -> List[Dict[str, Any]]:
    """Fetch all activities master data"""
    logger.info(f"[INFO] Starting activities master data retrieval")
    
    conn = connect_to_psql(host, port, username, password, database_name, schema_name)
    cursor = conn.cursor()
    try:
        logger.info(f"[INFO] Executing activities query")
        query = """
            SELECT 
                a.id,
                a.activity_title,
                a.activity_description,
                a.product_code,
                pm.product_name,
                pm.version AS product_version,
                pm.product_desc AS product_description,
                a.is_billable,
                a.created_by,
                um_created.user_name AS created_by_name,
                a.created_at,
                a.updated_by,
                um_updated.user_name AS updated_by_name,
                a.updated_at
            FROM sts_ts.activities a
            LEFT JOIN sts_new.product_master pm ON a.product_code = pm.product_code
            LEFT JOIN sts_new.user_master um_created ON a.created_by = um_created.user_code
            LEFT JOIN sts_new.user_master um_updated ON a.updated_by = um_updated.user_code
            ORDER BY a.id ASC;
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        activities = []
        for row in rows:
            activities.append({
                "id": row[0],
                "activity_title": row[1],
                "activity_description": row[2] if row[2] else None,
                "product_code": row[3],
                "product_name": row[4] if row[4] else None,
                "product_version": row[5] if row[5] else None,
                "product_description": row[6] if row[6] else None,
                "is_billable": row[7] if row[7] is not None else True,
                "created_by": row[8],
                "created_by_name": row[9] if row[9] else None,
                "created_at": str(row[10]) if row[10] else None,
                "updated_by": row[11] if row[11] else None,
                "updated_by_name": row[12] if row[12] else None,
                "updated_at": str(row[13]) if row[13] else None
            })
        
        logger.info(f"[INFO] Activities master data retrieved successfully, count: {len(activities)}")
        return activities
    except Exception as e:
        logger.error(f"[ERROR] Error in fetch_activities_masters function, error: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()
        logger.info(f"[INFO] Activities master database connection closed")


def fetch_predefined_epics() -> List[Dict[str, Any]]:
    """Fetch all predefined epics (epic templates) with their linked tasks from junction table"""
    logger.info(f"[INFO] Starting predefined epics master data retrieval")
    
    conn = connect_to_psql(host, port, username, password, database_name, schema_name)
    cursor = conn.cursor()
    try:
        logger.info(f"[INFO] Executing predefined epics query")
        query = """
            SELECT 
                pe.id,
                pe.title,
                pe.description,
                pe.contact_person_code,
                cpm.full_name AS contact_person_name,
                pe.priority_code,
                pr.priority_desc AS priority_description,
                pe.estimated_hours,
                pe.max_hours,
                pe.is_billable,
                pe.is_active,
                pe.created_by,
                um_created.user_name AS created_by_name,
                pe.created_at,
                pe.updated_by,
                um_updated.user_name AS updated_by_name,
                pe.updated_at
            FROM sts_ts.predefined_epics pe
            LEFT JOIN sts_new.contact_master cpm ON pe.contact_person_code = cpm.contact_person_code
            LEFT JOIN sts_new.tkt_priority_master pr ON pe.priority_code = pr.priority_code
            LEFT JOIN sts_new.user_master um_created ON pe.created_by = um_created.user_code
            LEFT JOIN sts_new.user_master um_updated ON pe.updated_by = um_updated.user_code
            WHERE pe.is_active = true
            ORDER BY pe.title ASC;
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        predefined_epics = []
        for row in rows:
            epic_id = row[0]
            
            # Fetch tasks linked to this epic via predefined_epic_id column
            tasks_query = """
                SELECT 
                    pt.id,
                    pt.task_title,
                    pt.task_description,
                    pt.status_code,
                    sm.status_desc AS status_description,
                    pt.priority_code,
                    pr_task.priority_desc AS priority_description,
                    pt.task_type_code,
                    ttm.type_name AS task_type_name,
                    pt.work_mode,
                    pt.team_code,
                    tm.team_name AS team_name,
                    pt.estimated_hours,
                    pt.max_hours,
                    pt.is_billable
                FROM sts_ts.predefined_tasks pt
                LEFT JOIN sts_new.status_master sm ON pt.status_code = sm.status_code
                LEFT JOIN sts_new.tkt_priority_master pr_task ON pt.priority_code = pr_task.priority_code
                LEFT JOIN sts_ts.task_type_master ttm ON pt.task_type_code = ttm.type_code
                LEFT JOIN sts_new.team_master tm ON pt.team_code = tm.team_code
                WHERE pt.predefined_epic_id = %s
                ORDER BY pt.task_title ASC;
            """
            cursor.execute(tasks_query, (epic_id,))
            task_rows = cursor.fetchall()
            
            tasks = []
            for task_row in task_rows:
                tasks.append({
                    "id": task_row[0],
                    "task_title": task_row[1],
                    "task_description": task_row[2] if task_row[2] else None,
                    "status_code": task_row[3],
                    "status_description": task_row[4] if task_row[4] else None,
                    "priority_code": task_row[5],
                    "priority_description": task_row[6] if task_row[6] else None,
                    "task_type_code": task_row[7] if task_row[7] else None,
                    "task_type_name": task_row[8] if task_row[8] else None,
                    "work_mode": task_row[9],
                    "team_code": task_row[10] if task_row[10] else None,
                    "team_name": task_row[11] if task_row[11] else None,
                    "estimated_hours": float(task_row[12]) if task_row[12] else None,
                    "max_hours": float(task_row[13]) if task_row[13] else None,
                    "is_billable": task_row[14] if task_row[14] is not None else True
                })
            
            predefined_epics.append({
                "id": epic_id,
                "title": row[1],
                "description": row[2] if row[2] else None,
                "contact_person_code": row[3] if row[3] else None,
                "contact_person_name": row[4] if row[4] else None,
                "priority_code": row[5],
                "priority_description": row[6] if row[6] else None,
                "estimated_hours": float(row[7]) if row[7] else None,
                "max_hours": float(row[8]) if row[8] else None,
                "is_billable": row[9] if row[9] is not None else True,
                "is_active": row[10] if row[10] is not None else True,
                "created_by": row[11],
                "created_by_name": row[12] if row[12] else None,
                "created_at": str(row[13]) if row[13] else None,
                "updated_by": row[14] if row[14] else None,
                "updated_by_name": row[15] if row[15] else None,
                "updated_at": str(row[16]) if row[16] else None,
                "tasks": tasks  # Include linked tasks
            })
        
        logger.info(f"[INFO] Predefined epics master data retrieved successfully, count: {len(predefined_epics)}")
        return predefined_epics
    except Exception as e:
        logger.error(f"[ERROR] Error in fetch_predefined_epics function, error: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()
        logger.info(f"[INFO] Predefined epics master database connection closed")


@router.get("/api/v1/timesheet/GetMasterData")
async def get_timesheet_master_data(current_user: dict = Depends(verify_token)):
    """
    Fetch all master data for timesheet system dropdowns in parallel using asyncio.to_thread.
    Returns: task statuses, task types, priorities, products, employees, teams, epics, companies, contact_persons, work_locations, leave_types, reporters, activities, predefined_epics, predefined_tasks
    """
    logger.info(f"[INFO] Starting timesheet master data retrieval process")
    
    try:
        logger.info(f"[INFO] Executing parallel timesheet master data queries")
        # Execute all queries in parallel using asyncio.to_thread
        tasks = [
            asyncio.to_thread(fetch_task_status_masters),
            asyncio.to_thread(fetch_task_type_masters),
            asyncio.to_thread(fetch_priority_masters),
            asyncio.to_thread(fetch_product_masters),
            asyncio.to_thread(fetch_employee_masters),
            asyncio.to_thread(fetch_team_masters),
            asyncio.to_thread(fetch_epic_masters),
            asyncio.to_thread(fetch_company_masters),
            asyncio.to_thread(fetch_contact_person_masters),
            asyncio.to_thread(fetch_work_location_masters),
            asyncio.to_thread(fetch_leave_type_masters),
            asyncio.to_thread(fetch_reporter_masters),
            asyncio.to_thread(fetch_activities_masters),
            asyncio.to_thread(fetch_predefined_epics),
            asyncio.to_thread(fetch_predefined_tasks),
        ]
        
        # Wait for all tasks to complete
        results = await asyncio.gather(*tasks)
        logger.info(f"[INFO] All parallel timesheet queries completed successfully")
        
        task_statuses, task_types, priorities, products, employees, teams, epics, companies, contact_persons, work_locations, leave_types, reporters, activities, predefined_epics, predefined_tasks = results

        # Prepare response
        master_data = {
            "task_statuses": task_statuses,
            "task_types": task_types,
            "priorities": priorities,
            "products": products,
            "employees": employees,
            "teams": teams,
            "epics": epics,
            "companies": companies,
            "contact_persons": contact_persons,
            "work_locations": work_locations,
            "leave_types": leave_types,
            "reporters": reporters,
            "activities": activities,
            "predefined_epics": predefined_epics,
            "predefined_tasks": predefined_tasks,
        }

        counts = {
            "task_statuses": len(task_statuses),
            "task_types": len(task_types),
            "priorities": len(priorities),
            "products": len(products),
            "employees": len(employees),
            "teams": len(teams),
            "epics": len(epics),
            "companies": len(companies),
            "contact_persons": len(contact_persons),
            "work_locations": len(work_locations),
            "leave_types": len(leave_types),
            "reporters": len(reporters),
            "activities": len(activities),
            "predefined_epics": len(predefined_epics),
            "predefined_tasks": len(predefined_tasks),
        }

        logger.info(f"[INFO] Timesheet master data processing completed successfully - task_statuses: {counts['task_statuses']}, task_types: {counts['task_types']}, priorities: {counts['priorities']}, products: {counts['products']}, employees: {counts['employees']}, teams: {counts['teams']}, epics: {counts['epics']}, companies: {counts['companies']}, contact_persons: {counts['contact_persons']}, work_locations: {counts['work_locations']}, leave_types: {counts['leave_types']}, reporters: {counts['reporters']}, activities: {counts['activities']}, predefined_epics: {counts['predefined_epics']}, predefined_tasks: {counts['predefined_tasks']}")

        return {
            "success_flag": True,
            "message": "Timesheet master data fetched successfully",
            "status_code": HTTPStatus.OK.value,
            "status_message": HTTPStatus.OK.phrase,
            "data": master_data,
            "counts": counts
        }

    except psycopg2.OperationalError as op_error:
        logger.error(f"[ERROR] Database operational error in timesheet master data retrieval, error: {str(op_error)}")
        return {
            "success_flag": False,
            "data": None,
            "message": "Could not connect to the database.",
            "error": str(op_error),
            "status_code": HTTPStatus.SERVICE_UNAVAILABLE.value,
            "status_message": "Database Connection Failed"
        }

    except psycopg2.ProgrammingError as pg_error:
        logger.error(f"[ERROR] Database programming error in timesheet master data retrieval, error: {str(pg_error)}")
        return {
            "success_flag": False,
            "data": None,
            "message": "SQL query or schema might be incorrect.",
            "error": str(pg_error),
            "status_code": HTTPStatus.INTERNAL_SERVER_ERROR.value,
            "status_message": "Programming Error"
        }

    except Exception as general_error:
        logger.error(f"[ERROR] Unexpected error in timesheet master data retrieval, error: {str(general_error)}")
        return {
            "success_flag": False,
            "data": None,
            "message": "An unexpected error occurred.",
            "error": str(general_error),
            "status_code": HTTPStatus.INTERNAL_SERVER_ERROR.value,
            "status_message": HTTPStatus.INTERNAL_SERVER_ERROR.phrase
        }
