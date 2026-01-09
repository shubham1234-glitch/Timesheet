import { pool } from "../config/db.js";

/**
 * Get dashboard data for a user from view_my_dashboard
 */
export const getDashboardData = async (userCode) => {
  try {
    const query = `
      SELECT 
        user_code,
        user_name,
        total_hours_worked,
        avg_hours_per_day,
        total_tasks,
        completed_tasks,
        to_do_tasks,
        in_progress_tasks,
        on_hold_tasks,
        hours_by_project,
        daily_work_hours,
        approved_count,
        pending_count,
        rejected_count,
        approval_rate_percentage,
        days_worked_current_month,
        total_timesheet_entries_current_month,
        current_month_start,
        current_month_end,
        current_week_start,
        current_week_end,
        leaves_taken,
        current_year_start,
        current_year_end
      FROM sts_ts.view_my_dashboard
      WHERE user_code = $1;
    `;

    const result = await pool.query(query, [userCode]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    
    // Parse JSON fields if they are strings
    let hoursByProject = [];
    if (row.hours_by_project) {
      try {
        hoursByProject = typeof row.hours_by_project === 'string' 
          ? JSON.parse(row.hours_by_project) 
          : row.hours_by_project;
      } catch (e) {
        console.warn("Failed to parse hours_by_project:", e);
        hoursByProject = [];
      }
    }

    let dailyWorkHours = [];
    if (row.daily_work_hours) {
      try {
        dailyWorkHours = typeof row.daily_work_hours === 'string'
          ? JSON.parse(row.daily_work_hours)
          : row.daily_work_hours;
      } catch (e) {
        console.warn("Failed to parse daily_work_hours:", e);
        dailyWorkHours = [];
      }
    }

    // Calculate total leaves (assuming 12 per year, can be made configurable)
    const totalLeaves = 12;
    const remainingLeaves = Math.max(0, totalLeaves - parseFloat(row.leaves_taken || 0));

    return {
      user_code: row.user_code,
      user_name: row.user_name,
      total_hours_worked: parseFloat(row.total_hours_worked || 0),
      avg_hours_per_day: parseFloat(row.avg_hours_per_day || 0),
      total_tasks: parseInt(row.total_tasks || 0, 10),
      completed_tasks: parseInt(row.completed_tasks || 0, 10),
      to_do_tasks: parseInt(row.to_do_tasks || 0, 10),
      in_progress_tasks: parseInt(row.in_progress_tasks || 0, 10),
      on_hold_tasks: parseInt(row.on_hold_tasks || 0, 10),
      hours_by_project: hoursByProject,
      daily_work_hours: dailyWorkHours,
      approval_stats: {
        approved: parseInt(row.approved_count || 0, 10),
        pending: parseInt(row.pending_count || 0, 10),
        rejected: parseInt(row.rejected_count || 0, 10),
        approval_rate: parseFloat(row.approval_rate_percentage || 0),
      },
      leave_registry: {
        total: totalLeaves,
        taken: parseFloat(row.leaves_taken || 0),
        remaining: remainingLeaves,
      },
      date_ranges: {
        current_month_start: row.current_month_start,
        current_month_end: row.current_month_end,
        current_week_start: row.current_week_start,
        current_week_end: row.current_week_end,
        current_year_start: row.current_year_start,
        current_year_end: row.current_year_end,
      },
      days_worked_current_month: parseInt(row.days_worked_current_month || 0, 10),
      total_timesheet_entries_current_month: parseInt(row.total_timesheet_entries_current_month || 0, 10),
    };
  } catch (error) {
    console.error("❌ getDashboardData error:", error.message);
    throw error;
  }
};

