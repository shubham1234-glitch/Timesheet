import { pool } from "../config/db.js";
import { config } from "../config/env.js";

/**
 * Get all tasks with optional filters
 */
export const getTasks = async (filters = {}, limit = 100, offset = 0) => {
  const whereConditions = []; // task_id IS NOT NULL is now in the main query
  const params = [];

  const {
    epic_code,
    task_status_code,
    task_priority_code,
    task_assignee,
    task_reporter,
    product_code,
    start_date_from,
    due_date_to,
    is_billable,
    // Optional: when provided, used for "available tasks" (team-level queue)
    team_code_for_available,
  } = filters;

  if (epic_code) {
    whereConditions.push(`v.task_epic_code = $${params.length + 1}`);
    params.push(epic_code);
  }
  if (task_status_code) {
    whereConditions.push(`v.task_status_code = $${params.length + 1}`);
    params.push(task_status_code);
  }
  if (task_priority_code) {
    whereConditions.push(`v.task_priority_code = $${params.length + 1}`);
    params.push(task_priority_code);
  }
  if (task_assignee) {
    whereConditions.push(`v.task_assignee = $${params.length + 1}`);
    params.push(task_assignee);
  }
  if (task_reporter) {
    whereConditions.push(`v.task_reporter = $${params.length + 1}`);
    params.push(task_reporter);
  }
  if (product_code) {
    whereConditions.push(`v.product_code = $${params.length + 1}`);
    params.push(product_code);
  }
  if (start_date_from) {
    whereConditions.push(`DATE(v.task_start_date) >= $${params.length + 1}`);
    params.push(start_date_from);
  }
  if (due_date_to) {
    whereConditions.push(`DATE(v.task_due_date) <= $${params.length + 1}`);
    params.push(due_date_to);
  }
  if (is_billable !== undefined) {
    whereConditions.push(`v.task_is_billable = $${params.length + 1}`);
    params.push(is_billable);
  }

  // Available-tasks filter: tasks assigned to a team but not to a specific user
  if (team_code_for_available) {
    whereConditions.push(`v.task_team_code = $${params.length + 1}`);
    params.push(team_code_for_available);
    // Unassigned to any individual
    whereConditions.push(`(v.task_assignee IS NULL OR v.task_assignee = '')`);
  }

  // Build WHERE clause with base conditions
  const allConditions = ['v.task_id IS NOT NULL', ...whereConditions];
  const whereClause = `WHERE ${allConditions.join(" AND ")}`;

  const query = `
    SELECT 
      v.task_id,
      v.task_title,
      v.task_description,
      v.product_code,
      v.product_name,
      v.task_epic_code,
      v.task_status_code,
      v.task_status_description,
      v.task_status_reason,
      v.task_priority_code,
      v.task_priority_description,
      v.task_type_code,
      v.task_work_mode,
      v.task_assignee,
      v.task_assignee_name,
      v.task_reporter,
      v.task_reporter_name,
      v.task_start_date,
      v.task_due_date,
      v.task_closed_on,
      v.task_estimated_hours,
      v.task_is_billable,
      v.task_created_by,
      v.task_created_by_name,
      v.task_created_at,
      v.task_attachments,
      v.task_attachments_count,
      ttm.type_name AS task_type_name,
      ttm.type_description AS task_type_description
    FROM sts_ts.view_unified_epic_task v
    LEFT JOIN sts_ts.task_type_master ttm
      ON v.task_type_code = ttm.type_code
    ${whereClause}
    ORDER BY task_id DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2};
  `;

  params.push(limit, offset);

  const { rows } = await pool.query(query, params);
  // Enrich with normalized priority field and process attachments
  const tasks = rows.map((r) => {
    const c = Number(r.task_priority_code);
    let priority = undefined;
    if (c === 3) priority = 'High';
    else if (c === 2) priority = 'Medium';
    else if (c === 1) priority = 'Low';
    if (!priority) {
      const desc = String(r.task_priority_description || '').toLowerCase();
      priority = desc.includes('high') ? 'High' : desc.includes('medium') ? 'Medium' : (desc ? 'Low' : undefined);
    }
    const statusDesc = String(r.task_status_description || '').toLowerCase();
    const status = (statusDesc.includes('on hold') || statusDesc.includes('hold'))
      ? 'On Hold'
      : statusDesc.includes('progress')
        ? 'In Progress'
        : (statusDesc.includes('done') || statusDesc.includes('closed') || statusDesc.includes('complete'))
          ? 'Completed'
          : (statusDesc.includes('cancel') || statusDesc.includes('blocked'))
            ? 'Blocked'
            : (statusDesc ? 'To Do' : undefined);
    
    // Process task attachments from view
    let attachments = [];
    try {
      if (r.task_attachments) {
        if (typeof r.task_attachments === 'string') {
          attachments = JSON.parse(r.task_attachments);
        } else {
          attachments = r.task_attachments;
        }
      }
      
      // Construct file_url for each attachment
      attachments = attachments.map((att) => {
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
    } catch (error) {
      console.error("❌ Error processing task attachments:", error.message);
      attachments = [];
    }
    
    // Remove raw JSON columns from response
    const { task_attachments: _, task_attachments_count: __, ...rest } = r;
    
    return { 
      ...rest, 
      work_mode: r.task_work_mode, // Map task_work_mode to work_mode for frontend
      task_type_code: r.task_type_code,
      task_type_name: r.task_type_name,
      task_type_description: r.task_type_description,
      priority, 
      status,
      attachments,
      attachments_count: r.task_attachments_count || attachments.length,
    };
  });
  const countQuery = `
    SELECT COUNT(*) 
    FROM sts_ts.view_unified_epic_task v
    ${whereClause}
  `;
  const countResult = await pool.query(countQuery, params.slice(0, -2));

  return {
    tasks,
    total_count: Number(countResult.rows[0].count),
  };
};

/**
 * Get a single task by ID
 */
export const getTaskById = async (task_id) => {
  const query = `
    SELECT 
      v.*,
      ttm.type_name AS task_type_name,
      ttm.type_description AS task_type_description
    FROM sts_ts.view_unified_epic_task v
    LEFT JOIN sts_ts.task_type_master ttm
      ON v.task_type_code = ttm.type_code
    WHERE v.task_id = $1;
  `;
  const { rows } = await pool.query(query, [task_id]);
  const task = rows[0];
  
  if (!task) {
    return null;
  }
  
  // Process attachments from the view (task_attachments column contains JSON array)
  try {
    // Parse task_attachments JSON array from view
    let attachments = [];
    if (task.task_attachments) {
      if (typeof task.task_attachments === 'string') {
        attachments = JSON.parse(task.task_attachments);
      } else {
        attachments = task.task_attachments;
      }
    }
    
    // Construct file_url for each attachment
    attachments = attachments.map((att) => {
      // Extract filename from file_path (e.g., "/var/www/fileServer/abc123.xlsx" -> "abc123.xlsx")
      const fileNameFromPath = att.file_path ? att.file_path.split('/').pop() : '';
      // Construct file URL using configured file server base URL
      const fileServerBase = config.FILE_SERVER_BASE_URL;
      const fileUrl = fileNameFromPath ? `${fileServerBase}/${fileNameFromPath}` : '';
      
      return {
        ...att,
        file_url: fileUrl,
      };
    });
    
    task.attachments = attachments;
    task.attachments_count = task.task_attachments_count || attachments.length;
    
    // Remove the raw JSON columns from response
    delete task.task_attachments;
    delete task.task_attachments_count;
  } catch (error) {
    console.error("❌ Error processing task attachments:", error.message);
    // Continue without attachments if query fails
    task.attachments = [];
    task.attachments_count = 0;
  }
  
  // Map task_work_mode to work_mode for frontend consistency
  task.work_mode = task.task_work_mode;
  
  return task;
};

/**
 * Assign a task to a user (self)
 * @param {number} task_id - Task ID to assign
 * @param {string} user_code - User code to assign the task to
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const assignTaskToSelf = async (task_id, user_code) => {
  try {
    // First check if task exists
    const checkQuery = `SELECT id, assignee FROM sts_ts.tasks WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [task_id]);
    
    if (checkResult.rows.length === 0) {
      return {
        success: false,
        message: `Task with ID ${task_id} not found`,
      };
    }

    const task = checkResult.rows[0];
    
    // Check if task is already assigned
    if (task.assignee && task.assignee.trim() !== '') {
      return {
        success: false,
        message: `Task ${task_id} is already assigned to ${task.assignee}`,
      };
    }

    // Update the task assignee
    const updateQuery = `
      UPDATE sts_ts.tasks 
      SET assignee = $1, 
          assigned_on = CURRENT_DATE,
          updated_by = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    const result = await pool.query(updateQuery, [user_code, task_id]);

    if (result.rowCount === 0) {
      return {
        success: false,
        message: `Failed to assign task ${task_id}`,
      };
    }

    return {
      success: true,
      message: `Task ${task_id} assigned successfully`,
    };
  } catch (error) {
    console.error("❌ assignTaskToSelf error:", error.message);
    
    // Check if it's a foreign key constraint error (invalid user_code)
    if (error.code === '23503') {
      return {
        success: false,
        message: `Invalid user code: ${user_code}`,
      };
    }
    
    return {
      success: false,
      message: error.message || "Database error occurred",
    };
  }
};

/**
 * Delete a task by ID
 * @param {number} task_id - Task ID to delete
 * @param {boolean} force_delete - Whether to force delete (ignore constraints)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const deleteTask = async (task_id, force_delete = false) => {
  try {
    // First check if task exists
    const checkQuery = `SELECT id FROM sts_ts.tasks WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [task_id]);
    
    if (checkResult.rows.length === 0) {
      return {
        success: false,
        message: `Task with ID ${task_id} not found`,
      };
    }

    // If force_delete is true, we might need to handle cascading deletes
    // For now, we'll just delete the task
    const deleteQuery = `DELETE FROM sts_ts.tasks WHERE id = $1`;
    const result = await pool.query(deleteQuery, [task_id]);

    if (result.rowCount === 0) {
      return {
        success: false,
        message: `Failed to delete task with ID ${task_id}`,
      };
    }

    return {
      success: true,
      message: `Task ${task_id} deleted successfully`,
    };
  } catch (error) {
    console.error("❌ deleteTask error:", error.message);
    
    // Check if it's a foreign key constraint error
    if (error.code === '23503') {
      return {
        success: false,
        message: `Cannot delete task ${task_id}: It has related records. Use force_delete=true to override.`,
      };
    }
    
    return {
      success: false,
      message: error.message || "Database error occurred",
    };
  }
};

/**
 * Get a single subtask by ID
 * Uses the view_unified_epic_task view and extracts the subtask from task_subtasks JSON array
 */
export const getSubtaskById = async (subtask_id) => {
  try {
    // Query the view to get the task that contains this subtask
    // Use PostgreSQL JSON functions to find and extract the subtask
    const query = `
      SELECT 
        v.task_id,
        v.task_title,
        v.task_epic_code,
        v.epic_id,
        v.epic_title,
        elem.subtask
      FROM sts_ts.view_unified_epic_task v,
      LATERAL jsonb_array_elements(v.task_subtasks::jsonb) AS elem(subtask)
      WHERE v.task_subtasks IS NOT NULL
        AND (elem.subtask->>'id')::integer = $1
      LIMIT 1;
    `;
    
    const { rows } = await pool.query(query, [subtask_id]);
    
    if (!rows.length || !rows[0].subtask) {
      return null;
    }
    
    // Extract the subtask from the result
    let subtask;
    try {
      if (typeof rows[0].subtask === 'string') {
        subtask = JSON.parse(rows[0].subtask);
      } else {
        subtask = rows[0].subtask;
      }
    } catch (error) {
      console.error("❌ Error parsing subtask JSON:", error.message);
      return null;
    }
    
    // Get subtask attachments
    let attachments = [];
    try {
      const attachmentsQuery = `
        SELECT 
          id,
          file_name,
          file_path,
          file_url,
          file_type,
          file_size,
          purpose,
          created_by,
          created_at
        FROM sts_ts.attachments
        WHERE parent_type = 'SUBTASK' AND parent_code = $1
        ORDER BY created_at DESC;
      `;
      const attachmentsResult = await pool.query(attachmentsQuery, [subtask_id]);
      attachments = attachmentsResult.rows || [];
      
      // Construct file_url for each attachment
      attachments = attachments.map((att) => {
        const fileNameFromPath = att.file_path ? att.file_path.split('/').pop() : '';
        const fileServerBase = config.FILE_SERVER_BASE_URL;
        const fileUrl = fileNameFromPath ? `${fileServerBase}/${fileNameFromPath}` : '';
        
        return {
          ...att,
          file_url: fileUrl || att.file_url,
        };
      });
    } catch (error) {
      console.error("❌ Error fetching subtask attachments:", error.message);
      attachments = [];
    }
    
    // Build the complete subtask object with parent task and epic info
    const subtaskDetails = {
      ...subtask,
      subtask_id: subtask.id,
      subtask_title: subtask.subtask_title,
      subtask_description: subtask.description,
      parent_task_id: rows[0].task_id,
      parent_task_title: rows[0].task_title,
      parent_epic_id: rows[0].epic_id,
      parent_epic_title: rows[0].epic_title,
      attachments,
      attachments_count: attachments.length,
    };
    
    return subtaskDetails;
  } catch (error) {
    console.error("❌ getSubtaskById error:", error.message);
    throw new Error("Database query failed");
  }
};
