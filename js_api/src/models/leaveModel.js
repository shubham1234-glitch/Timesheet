import { pool } from "../config/db.js";

/**
 * Get leave applications for a user with optional filters
 */
export const getLeaveApplications = async (userCode, filters = {}, limit = 100, offset = 0) => {
  try {
    const whereConditions = [`user_code = $${1}`];
    const params = [userCode];

    const {
      from_date_from,
      from_date_to,
      to_date_from,
      to_date_to,
      approval_status,
      leave_type_code,
    } = filters;

    if (from_date_from) {
      whereConditions.push(`from_date >= $${params.length + 1}`);
      params.push(from_date_from);
    }
    if (from_date_to) {
      whereConditions.push(`from_date <= $${params.length + 1}`);
      params.push(from_date_to);
    }
    if (to_date_from) {
      whereConditions.push(`to_date >= $${params.length + 1}`);
      params.push(to_date_from);
    }
    if (to_date_to) {
      whereConditions.push(`to_date <= $${params.length + 1}`);
      params.push(to_date_to);
    }
    if (approval_status) {
      whereConditions.push(`approval_status = $${params.length + 1}`);
      params.push(approval_status);
    }
    if (leave_type_code) {
      whereConditions.push(`leave_type_code = $${params.length + 1}`);
      params.push(leave_type_code);
    }

    const whereClause = whereConditions.length
      ? `WHERE ${whereConditions.join(" AND ")}`
      : "";

    const query = `
      SELECT *
      FROM sts_ts.view_leave_application
      ${whereClause}
      ORDER BY from_date DESC, leave_application_id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    const rows = result?.rows || [];

    // Parse attachments JSON if it's a string
    const processedRows = rows.map(row => {
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
      return row;
    });

    // Get total count for pagination (same WHERE but without LIMIT/OFFSET)
    const countQuery = `
      SELECT COUNT(*)
      FROM sts_ts.view_leave_application
      ${whereClause};
    `;
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const total_count = parseInt(countResult.rows[0].count, 10) || 0;

    return {
      entries: processedRows,
      total_count,
    };
  } catch (error) {
    console.error("❌ getLeaveApplications error:", error.message);
    throw error;
  }
};


