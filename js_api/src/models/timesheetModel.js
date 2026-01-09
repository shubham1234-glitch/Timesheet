import { pool } from "../config/db.js";

/**
 * Get timesheet entries for a user with optional filters
 */
export const getTimesheetEntries = async (userCode, filters = {}, limit = 100, offset = 0) => {
  try {
    const whereConditions = [`user_code = $${1}`];
    const params = [userCode];

    const {
      entry_date_from,
      entry_date_to,
      approval_status,
      epic_code,
      task_code,
      task_type_code,
      work_location, // matches column name in sts_ts.view_timesheet_entry
    } = filters;

    if (entry_date_from) {
      whereConditions.push(`entry_date >= $${params.length + 1}`);
      params.push(entry_date_from);
    }
    if (entry_date_to) {
      whereConditions.push(`entry_date <= $${params.length + 1}`);
      params.push(entry_date_to);
    }
    if (approval_status) {
      whereConditions.push(`approval_status = $${params.length + 1}`);
      params.push(approval_status);
    }
    if (epic_code) {
      whereConditions.push(`epic_code = $${params.length + 1}`);
      params.push(epic_code);
    }
    if (task_code) {
      whereConditions.push(`task_code = $${params.length + 1}`);
      params.push(task_code);
    }
    if (task_type_code) {
      whereConditions.push(`task_type_code = $${params.length + 1}`);
      params.push(task_type_code);
    }
    if (work_location) {
      // Column renamed from work_location_code -> work_location in the view
      whereConditions.push(`work_location = $${params.length + 1}`);
      params.push(work_location);
    }

    const whereClause = whereConditions.length
      ? `WHERE ${whereConditions.join(" AND ")}`
      : "";

    const query = `
      SELECT *
      FROM sts_ts.view_timesheet_entry
      ${whereClause}
      ORDER BY entry_date DESC, timesheet_entry_id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    const rows = result?.rows || [];

    // Parse attachments JSON if it's a string
    const processedRows = rows.map(row => {
      // Normalize attachments
      if (row.attachments && typeof row.attachments === 'string') {
        try {
          row.attachments = JSON.parse(row.attachments);
        } catch (e) {
          console.warn('Failed to parse attachments JSON:', e);
          row.attachments = [];
        }
      } else if (!row.attachments) {
        row.attachments = [];
      }

      // Normalize overdue status from view_timesheet_entry
      // The view exposes this as task_is_overdue; ensure it's always a strict boolean.
      row.task_is_overdue = !!row.task_is_overdue;

      return row;
    });

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*)
      FROM sts_ts.view_timesheet_entry
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const total_count = parseInt(countResult.rows[0].count, 10) || 0;

    return {
      entries: processedRows,
      total_count,
    };
  } catch (error) {
    console.error("❌ getTimesheetEntries error:", error.message);
    throw error;
  }
};

/**
 * Get single timesheet entry by ID
 */
export const getTimesheetEntryById = async (entryId, userCode) => {
  try {
    const query = `
      SELECT *
      FROM sts_ts.view_timesheet_entry
      WHERE timesheet_entry_id = $1 AND user_code = $2;
    `;

    const result = await pool.query(query, [entryId, userCode]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    // Parse attachments JSON if it's a string
    if (row.attachments && typeof row.attachments === 'string') {
      try {
        row.attachments = JSON.parse(row.attachments);
      } catch (e) {
        console.warn('Failed to parse attachments JSON:', e);
        row.attachments = [];
      }
    } else if (!row.attachments) {
      row.attachments = [];
    }

    // Normalize overdue status from view_timesheet_entry
    row.task_is_overdue = !!row.task_is_overdue;

    return row;
  } catch (error) {
    console.error("❌ getTimesheetEntryById error:", error.message);
    throw error;
  }
};

