import { pool } from "../config/db.js";

/**
 * Get super admin dashboard data from view_super_admin_dashboard
 * @param {string} productCode - Optional product code to filter by
 * @returns {Promise<Object|null>} Dashboard data or null if not found
 */
export const getSuperAdminDashboardData = async (productCode = null) => {
  try {
    let query = `
      SELECT
        product_code,
        product_name,
        total_epics,
        active_epics,
        completed_epics,
        overdue_epics,
        completion_rate_percentage,
        status_in_progress_count,
        status_done_count,
        status_closed_count,
        status_other_count,
        pending_approvals,
        top_5_epics_by_hours,
        epic_status_distribution
      FROM sts_ts.view_super_admin_dashboard
    `;
    
    const params = [];
    
    if (productCode) {
      query += ` WHERE product_code = $1`;
      params.push(productCode);
    }
    
    query += ` ORDER BY product_name;`;

    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return null;
    }

    // If productCode is provided, return single product data
    // Otherwise, return all products
    if (productCode && result.rows.length === 1) {
      const row = result.rows[0];
      return parseDashboardRow(row);
    } else if (!productCode) {
      // Return array of all products
      return result.rows.map(row => parseDashboardRow(row));
    }
    
    return null;
  } catch (error) {
    console.error("❌ getSuperAdminDashboardData error:", error.message);
    throw error;
  }
};

/**
 * Parse a single dashboard row and handle JSON fields
 * @param {Object} row - Database row
 * @returns {Object} Parsed dashboard data
 */
function parseDashboardRow(row) {
  // Parse JSON fields if they are strings
  let top5EpicsByHours = [];
  if (row.top_5_epics_by_hours) {
    try {
      top5EpicsByHours = typeof row.top_5_epics_by_hours === 'string'
        ? JSON.parse(row.top_5_epics_by_hours)
        : row.top_5_epics_by_hours;
    } catch (e) {
      console.warn("Failed to parse top_5_epics_by_hours:", e);
      top5EpicsByHours = [];
    }
  }

  let epicStatusDistribution = [];
  if (row.epic_status_distribution) {
    try {
      epicStatusDistribution = typeof row.epic_status_distribution === 'string'
        ? JSON.parse(row.epic_status_distribution)
        : row.epic_status_distribution;
    } catch (e) {
      console.warn("Failed to parse epic_status_distribution:", e);
      epicStatusDistribution = [];
    }
  }

  return {
    product_code: row.product_code,
    product_name: row.product_name,
    overview: {
      total_epics: parseInt(row.total_epics || 0, 10),
      active_epics: parseInt(row.active_epics || 0, 10),
      completed_epics: parseInt(row.completed_epics || 0, 10),
      overdue_epics: parseInt(row.overdue_epics || 0, 10),
      completion_rate: parseFloat(row.completion_rate_percentage || 0),
      pending_approvals: parseInt(row.pending_approvals || 0, 10),
    },
    status_distribution: {
      in_progress: parseInt(row.status_in_progress_count || 0, 10),
      on_hold: 0, // Not available in view, set to 0
      done: parseInt(row.status_done_count || 0, 10),
      closed: parseInt(row.status_closed_count || 0, 10),
      other: parseInt(row.status_other_count || 0, 10),
      detailed: epicStatusDistribution,
    },
    hours_by_epic: top5EpicsByHours.map(epic => ({
      epic_id: epic.epic_id,
      epic_title: epic.epic_title,
      total_hours: parseFloat(epic.total_hours || 0),
    })),
  };
}

