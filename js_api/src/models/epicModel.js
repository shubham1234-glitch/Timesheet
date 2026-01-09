import { pool } from "../config/db.js";
import { config } from "../config/env.js";

/**
 * Get all epics with their related tasks (grouped)
 */
export const getEpics = async (filters = {}, limit = 100, offset = 0) => {
  try {
    const whereConditions = [];
    const params = [];

    const {
      product_code,
      epic_status_code,
      epic_priority_code,
      epic_created_by,
      start_date_from,
      due_date_to,
    } = filters;

    if (product_code) {
      whereConditions.push(`product_code = $${params.length + 1}`);
      params.push(product_code);
    }
    if (epic_status_code) {
      whereConditions.push(`status_code = $${params.length + 1}`);
      params.push(epic_status_code);
    }
    if (epic_priority_code) {
      whereConditions.push(`priority_code = $${params.length + 1}`);
      params.push(epic_priority_code);
    }
    if (epic_created_by) {
      whereConditions.push(`created_by = $${params.length + 1}`);
      params.push(epic_created_by);
    }
    if (start_date_from) {
      whereConditions.push(`DATE(start_date) >= $${params.length + 1}`);
      params.push(start_date_from);
    }
    if (due_date_to) {
      whereConditions.push(`DATE(due_date) <= $${params.length + 1}`);
      params.push(due_date_to);
    }

    // Build WHERE clause with base condition
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : '';

    const query = `
      SELECT 
        v.epic_id,
        v.epic_title,
        v.epic_description,
        v.product_code,
        v.product_name,
        v.product_version,
        v.product_description,
        v.company_code AS epic_company_code,
        v.company_name AS epic_company_name,
        v.contact_person_code AS epic_contact_person_code,
        v.contact_person_name AS epic_contact_person_name,
        v.contact_person_email AS epic_contact_person_email,
        v.contact_person_phone AS epic_contact_person_phone,
        v.status_code AS epic_status_code,
        v.status_description AS epic_status_description,
        v.status_reason AS epic_status_reason,
        v.all_status_reasons AS epic_all_status_reasons,
        v.priority_code AS epic_priority_code,
        v.priority_description AS epic_priority_description,
        v.start_date AS epic_start_date,
        v.due_date AS epic_due_date,
        v.closed_on AS epic_closed_on,
        v.estimated_hours AS epic_estimated_hours,
        v.is_billable AS epic_is_billable,
        v.cancelled_by AS epic_cancelled_by,
        v.cancelled_at AS epic_cancelled_at,
        v.cancellation_reason AS epic_cancellation_reason,
        v.cancelled_by_name AS epic_cancelled_by_name,
        v.reporter AS epic_reporter,
        v.reporter_name AS epic_reporter_name,
        v.epic_created_by,
        v.epic_created_at,
        v.epic_updated_by,
        v.epic_updated_at,
        v.epic_created_by_name,
        v.epic_updated_by_name,
        v.epic_task_count,
        v.total_task_estimated_hours,
        v.epic_attachments,
        v.epic_attachments_count,
        v.task_id,
        v.task_title,
        v.task_description,
        v.task_epic_code,
        v.task_status_code,
        v.task_status_description,
        v.task_status_reason,
        v.task_all_status_reasons,
        v.task_priority_code,
        v.task_priority_description,
        v.task_type_code,
        v.task_work_mode,
        v.task_team_code AS task_assigned_team_code,
        v.task_assigned_team_name,
        v.task_assignee,
        v.task_assignee_name,
        v.task_reporter,
        v.task_reporter_name,
        v.task_assigned_on,
        v.task_start_date,
        v.task_due_date,
        v.task_closed_on,
        v.task_estimated_hours,
        v.task_is_billable,
        v.task_cancelled_by,
        v.task_cancelled_at,
        v.task_cancellation_reason,
        v.task_cancelled_by_name,
        v.task_created_by,
        v.task_created_at,
        v.task_updated_by,
        v.task_updated_at,
        v.task_created_by_name,
        v.task_updated_by_name,
        v.task_attachments,
        v.task_attachments_count,
        v.task_subtasks,
        ttm.type_name AS task_type_name,
        ttm.type_description AS task_type_description
      FROM sts_ts.view_unified_epic_task v
      LEFT JOIN sts_ts.task_type_master ttm
        ON v.task_type_code = ttm.type_code
      ${whereClause}
      ORDER BY epic_id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    const rows = result?.rows || [];

    // ✅ Guard: no rows found
    if (!rows.length) {
      return { epics: [], total_count: 0 };
    }

    // Debug: Log row count and sample data
    console.log(`📊 getEpics: Found ${rows.length} rows from view_unified_epic_task`);
    const rowsWithTasks = rows.filter(r => r.task_id);
    const rowsWithoutTasks = rows.filter(r => !r.task_id);
    console.log(`📊 getEpics: ${rowsWithTasks.length} rows with tasks, ${rowsWithoutTasks.length} rows without tasks`);
    if (rowsWithTasks.length > 0) {
      console.log(`📊 getEpics: Sample task row:`, {
        epic_id: rowsWithTasks[0].epic_id,
        task_id: rowsWithTasks[0].task_id,
        task_title: rowsWithTasks[0].task_title,
        task_epic_code: rowsWithTasks[0].task_epic_code
      });
    }

    // ✅ Group epics and their tasks
    const epicMap = new Map();

    // Shared helper to normalize priority from master codes/descriptions
    const normalizePriority = (code, desc) => {
      const c = Number(code);
      if (c === 3) return 'High';
      if (c === 2) return 'Medium';
      if (c === 1) return 'Low';
      const d = String(desc || '').toLowerCase();
      if (d.includes('high')) return 'High';
      if (d.includes('medium')) return 'Medium';
      if (d) return 'Low';
      return undefined;
    };

    rows.forEach((row) => {
      if (!row.epic_id) return;

      if (!epicMap.has(row.epic_id)) {
        const epicPriority = normalizePriority(row.epic_priority_code, row.epic_priority_description);

        const epicStatusDesc = String(row.epic_status_description || '').toLowerCase();
        const epicStatus = epicStatusDesc.includes('progress')
          ? 'In Progress'
          : (epicStatusDesc.includes('done') || epicStatusDesc.includes('closed') || epicStatusDesc.includes('complete'))
            ? 'Done'
            : epicStatusDesc
              ? 'To Do'
              : undefined;

        epicMap.set(row.epic_id, {
          epic_id: row.epic_id,
          epic_title: row.epic_title,
          epic_description: row.epic_description,
          product_code: row.product_code,
          product_name: row.product_name,
          product_version: row.product_version,
          epic_company_code: row.epic_company_code || null,
          epic_company_name: row.epic_company_name || null,
          epic_contact_person_code: row.epic_contact_person_code || null,
          epic_contact_person_name: row.epic_contact_person_name || null,
          epic_status_code: row.epic_status_code || null,
          epic_status_description: row.epic_status_description || null,
          epic_status_reason: row.epic_status_reason || null,
          status: epicStatus,
          epic_priority_code: row.epic_priority_code || null,
          epic_priority_description: row.epic_priority_description || null,
          priority: epicPriority,
          estimated_hours: Number(row.epic_estimated_hours || 0),
          is_billable: row.epic_is_billable ?? true,
          epic_start_date: row.epic_start_date || null,
          epic_due_date: row.epic_due_date || null,
          task_count: 0,
          tasks: [],
          attachments: [],
          attachments_count: 0,
          epic_attachments: row.epic_attachments, // Store raw JSON from view
          epic_attachments_count: row.epic_attachments_count || 0, // Store count from view
        });
      }

      // ✅ Only push tasks if a task_id exists (task_id can be NULL for epics without tasks)
      if (row.task_id) {
        const taskPriority = normalizePriority(row.task_priority_code, row.task_priority_description);

        const taskStatusDesc = String(row.task_status_description || '').toLowerCase();
        const taskStatus = (taskStatusDesc.includes('on hold') || taskStatusDesc.includes('hold'))
          ? 'On Hold'
          : taskStatusDesc.includes('progress')
            ? 'In Progress'
            : (taskStatusDesc.includes('done') || taskStatusDesc.includes('closed') || taskStatusDesc.includes('complete'))
              ? 'Completed'
              : (taskStatusDesc.includes('cancel') || taskStatusDesc.includes('blocked'))
                ? 'Blocked'
                : taskStatusDesc
                  ? 'To Do'
                  : undefined;

        const task = {
          task_id: row.task_id,
          task_title: row.task_title,
          task_description: row.task_description,
          task_status_code: row.task_status_code,
          task_status_description: row.task_status_description,
          task_status_reason: row.task_status_reason || null,
          status: taskStatus,
          task_priority_code: row.task_priority_code,
          task_priority_description: row.task_priority_description,
          priority: taskPriority,
          task_type_code: row.task_type_code,
          task_type_name: row.task_type_name,
          task_type_description: row.task_type_description,
          task_assignee: row.task_assignee,
          task_assignee_name: row.task_assignee_name,
          task_reporter: row.task_reporter,
          task_reporter_name: row.task_reporter_name,
          task_start_date: row.task_start_date,
          task_due_date: row.task_due_date,
          task_closed_on: row.task_closed_on,
          task_estimated_hours: Number(row.task_estimated_hours || 0),
          task_is_billable: row.task_is_billable ?? true,
          task_subtasks: row.task_subtasks || null,
        };

        const epic = epicMap.get(row.epic_id);
        epic.tasks.push(task);
        epic.task_count = epic.tasks.length;
      }
    });

    const epics = Array.from(epicMap.values());
    const total_count = epics.length;

    // Debug: Log epic and task counts
    console.log(`📊 getEpics: Grouped into ${epics.length} epics`);
    epics.forEach(epic => {
      console.log(`📊 getEpics: Epic ${epic.epic_id} (${epic.epic_title}) has ${epic.tasks.length} tasks`);
    });

    // Process attachments from the view (epic_attachments column contains JSON array)
    epics.forEach((epic) => {
      try {
        // Parse epic_attachments JSON array from view
        let attachments = [];
        if (epic.epic_attachments) {
          if (typeof epic.epic_attachments === 'string') {
            attachments = JSON.parse(epic.epic_attachments);
          } else {
            attachments = epic.epic_attachments;
          }
        }
        
        // Construct file_url for each attachment
        attachments = attachments.map((att) => {
          // Extract filename from file_path (e.g., "/var/www/fileServer/abc123.xlsx" -> "abc123.xlsx")
          const fileNameFromPath = att.file_path ? att.file_path.split('/').pop() : '';
          // Construct file URL using configured file server base URL
          const fileServerBase = config.FILE_SERVER_BASE_URL;
          let fileUrl = '';
          
          if (fileServerBase && fileNameFromPath) {
            // Ensure base URL ends with / and add filename
            const baseUrl = fileServerBase.endsWith('/') ? fileServerBase : `${fileServerBase}/`;
            fileUrl = `${baseUrl}${fileNameFromPath}`;
          } else if (!fileServerBase) {
            console.error('FILE_SERVER_BASE_URL is not configured in environment variables');
          }
          
          return {
            ...att,
            file_url: fileUrl,
          };
        });
        
        epic.attachments = attachments;
        epic.attachments_count = epic.epic_attachments_count || attachments.length;
        
        // Remove the raw JSON columns from response
        delete epic.epic_attachments;
      } catch (error) {
        console.error("❌ Error processing epic attachments:", error.message);
        epic.attachments = [];
        epic.attachments_count = 0;
      }
    });

    return {
      epics,
      total_count,
    };
  } catch (error) {
    console.error("❌ getEpics error:", error.message);
    return { epics: [], total_count: 0, error: error.message }; // ✅ safe return
  }
};

/**
 * Get single epic by ID with all its tasks
 */
export const getEpicById = async (epic_id) => {
  try {
    const query = `
      SELECT 
        v.epic_id,
        v.epic_title,
        v.epic_description,
        v.product_code,
        v.product_name,
        v.product_version,
        v.product_description,
        v.company_code AS epic_company_code,
        v.company_name AS epic_company_name,
        v.contact_person_code AS epic_contact_person_code,
        v.contact_person_name AS epic_contact_person_name,
        v.contact_person_email AS epic_contact_person_email,
        v.contact_person_phone AS epic_contact_person_phone,
        v.status_code AS epic_status_code,
        v.status_description AS epic_status_description,
        v.status_reason AS epic_status_reason,
        v.all_status_reasons AS epic_all_status_reasons,
        v.priority_code AS epic_priority_code,
        v.priority_description AS epic_priority_description,
        v.start_date AS epic_start_date,
        v.due_date AS epic_due_date,
        v.closed_on AS epic_closed_on,
        v.estimated_hours AS epic_estimated_hours,
        v.is_billable AS epic_is_billable,
        v.cancelled_by AS epic_cancelled_by,
        v.cancelled_at AS epic_cancelled_at,
        v.cancellation_reason AS epic_cancellation_reason,
        v.cancelled_by_name AS epic_cancelled_by_name,
        v.reporter AS epic_reporter,
        v.reporter_name AS epic_reporter_name,
        v.epic_created_by,
        v.epic_created_at,
        v.epic_updated_by,
        v.epic_updated_at,
        v.epic_created_by_name,
        v.epic_updated_by_name,
        v.epic_task_count,
        v.total_task_estimated_hours,
        v.epic_attachments,
        v.epic_attachments_count,
        v.task_id,
        v.task_title,
        v.task_description,
        v.task_epic_code,
        v.task_status_code,
        v.task_status_description,
        v.task_status_reason,
        v.task_all_status_reasons,
        v.task_priority_code,
        v.task_priority_description,
        v.task_type_code,
        v.task_work_mode,
        v.task_team_code AS task_assigned_team_code,
        v.task_assigned_team_name,
        v.task_assignee,
        v.task_assignee_name,
        v.task_reporter,
        v.task_reporter_name,
        v.task_assigned_on,
        v.task_start_date,
        v.task_due_date,
        v.task_closed_on,
        v.task_estimated_hours,
        v.task_is_billable,
        v.task_cancelled_by,
        v.task_cancelled_at,
        v.task_cancellation_reason,
        v.task_cancelled_by_name,
        v.task_created_by,
        v.task_created_at,
        v.task_updated_by,
        v.task_updated_at,
        v.task_created_by_name,
        v.task_updated_by_name,
        v.task_attachments,
        v.task_attachments_count,
        v.task_subtasks,
        ttm.type_name AS task_type_name,
        ttm.type_description AS task_type_description
      FROM sts_ts.view_unified_epic_task v
      LEFT JOIN sts_ts.task_type_master ttm
        ON v.task_type_code = ttm.type_code
      WHERE v.epic_id = $1;
    `;

    const result = await pool.query(query, [epic_id]);
    const rows = result?.rows || [];

    if (!rows.length) return null;

    const first = rows[0];
  const normalizePriority = (code, desc) => {
    const c = Number(code);
    if (c === 3) return 'High';
    if (c === 2) return 'Medium';
    if (c === 1) return 'Low';
    const d = String(desc || '').toLowerCase();
    if (d.includes('high')) return 'High';
    if (d.includes('medium')) return 'Medium';
    if (d) return 'Low';
    return undefined;
  };

  const epicPriority = normalizePriority(first.epic_priority_code, first.epic_priority_description);

  const epicStatusDesc = String(first.epic_status_description || '').toLowerCase();
  const epicStatus = epicStatusDesc.includes('progress')
    ? 'In Progress'
    : (epicStatusDesc.includes('done') || epicStatusDesc.includes('closed') || epicStatusDesc.includes('complete'))
      ? 'Done'
      : epicStatusDesc
        ? 'To Do'
        : undefined;

  const epic = {
      epic_id: first.epic_id,
      epic_title: first.epic_title,
      epic_description: first.epic_description,
      product_code: first.product_code,
      product_name: first.product_name,
      product_version: first.product_version,
      epic_company_code: first.epic_company_code || null,
      epic_company_name: first.epic_company_name || null,
      epic_contact_person_code: first.epic_contact_person_code || null,
      epic_contact_person_name: first.epic_contact_person_name || null,
      epic_status_code: first.epic_status_code || null,
      epic_status_description: first.epic_status_description || null,
      epic_status_reason: first.epic_status_reason || null,
      epic_all_status_reasons: first.epic_all_status_reasons || null,
      status: epicStatus,
      epic_priority_code: first.epic_priority_code || null,
      epic_priority_description: first.epic_priority_description || null,
      priority: epicPriority,
      estimated_hours: Number(first.epic_estimated_hours || 0),
      is_billable: first.epic_is_billable ?? true,
      epic_start_date: first.epic_start_date || null,
      epic_due_date: first.epic_due_date || null,
      epic_reporter: first.epic_reporter || null,
      epic_reporter_name: first.epic_reporter_name || null,
      task_count: 0,
      tasks: [],
      attachments: [],
      attachments_count: 0,
    };

    rows.forEach((row) => {
      if (row.task_id) {
        const taskPriority = normalizePriority(row.task_priority_code, row.task_priority_description);

        const taskStatusDesc = String(row.task_status_description || '').toLowerCase();
        const taskStatus = (taskStatusDesc.includes('on hold') || taskStatusDesc.includes('hold'))
          ? 'On Hold'
          : taskStatusDesc.includes('progress')
            ? 'In Progress'
            : (taskStatusDesc.includes('done') || taskStatusDesc.includes('closed') || taskStatusDesc.includes('complete'))
              ? 'Completed'
              : (taskStatusDesc.includes('cancel') || taskStatusDesc.includes('blocked'))
                ? 'Blocked'
                : taskStatusDesc
                  ? 'To Do'
                  : undefined;

        epic.tasks.push({
          task_id: row.task_id,
          task_title: row.task_title,
          task_description: row.task_description,
          task_status_code: row.task_status_code,
          task_status_description: row.task_status_description,
          task_status_reason: row.task_status_reason || null,
          status: taskStatus,
          task_priority_code: row.task_priority_code,
          task_priority_description: row.task_priority_description,
          priority: taskPriority,
          task_type_code: row.task_type_code,
          task_type_name: row.task_type_name,
          task_type_description: row.task_type_description,
          task_assignee: row.task_assignee,
          task_assignee_name: row.task_assignee_name,
          task_reporter: row.task_reporter,
          task_reporter_name: row.task_reporter_name,
          task_start_date: row.task_start_date,
          task_due_date: row.task_due_date,
          task_closed_on: row.task_closed_on,
          task_estimated_hours: Number(row.task_estimated_hours || 0),
          task_is_billable: row.task_is_billable ?? true,
          task_subtasks: row.task_subtasks || null,
        });
      }
    });

    epic.task_count = epic.tasks.length;
    
    // Process attachments from the view (epic_attachments column contains JSON array)
    try {
      // Parse epic_attachments JSON array from view (from first row since all rows have same epic data)
      let attachments = [];
      if (first.epic_attachments) {
        if (typeof first.epic_attachments === 'string') {
          attachments = JSON.parse(first.epic_attachments);
        } else {
          attachments = first.epic_attachments;
        }
      }
      
      // Construct file_url for each attachment
      attachments = attachments.map((att) => {
        // Extract filename from file_path (e.g., "/var/www/fileServer/abc123.xlsx" -> "abc123.xlsx")
        const fileNameFromPath = att.file_path ? att.file_path.split('/').pop() : '';
        // Construct file URL using configured file server base URL
        const fileServerBase = config.FILE_SERVER_BASE_URL;
        // Ensure base URL ends with / and add filename
        const baseUrl = fileServerBase.endsWith('/') ? fileServerBase : `${fileServerBase}/`;
        const fileUrl = fileNameFromPath ? `${baseUrl}${fileNameFromPath}` : '';
        
        return {
          ...att,
          file_url: fileUrl,
        };
      });
      
      epic.attachments = attachments;
      epic.attachments_count = first.epic_attachments_count || attachments.length;
    } catch (error) {
      console.error("❌ Error processing epic attachments:", error.message);
      // Continue without attachments if query fails
      epic.attachments = [];
      epic.attachments_count = 0;
    }
    
    return epic;
  } catch (error) {
    console.error("❌ getEpicById error:", error.message);
    throw new Error("Database query failed");
  }
};
