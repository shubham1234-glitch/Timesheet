import { pool } from "../config/db.js";

/**
 * Get team dashboard data for a user from view_team_dashboard
 */
export const getTeamDashboardData = async (userCode) => {
  try {
    const query = `
      SELECT 
        user_code,
        user_name,
        total_hours_last_7_days,
        pending_timesheet_count,
        pending_leave_count,
        total_pending_approvals,
        total_tasks,
        completed_tasks,
        overdue_tasks,
        leaves_taken,
        timesheet_approved_count,
        timesheet_pending_count,
        timesheet_rejected_count,
        leave_approved_count,
        leave_pending_count,
        leave_rejected_count,
        task_completed_count,
        task_in_progress_count,
        task_to_do_count,
        task_cancelled_count,
        task_overdue_count,
        daily_hours_last_7_days,
        last_7_days_start,
        last_7_days_end,
        current_year_start,
        current_year_end
      FROM sts_ts.view_team_dashboard
      WHERE user_code = $1;
    `;

    const result = await pool.query(query, [userCode]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    
    // Parse JSON fields if they are strings
    let dailyHours = [];
    if (row.daily_hours_last_7_days) {
      try {
        dailyHours = typeof row.daily_hours_last_7_days === 'string'
          ? JSON.parse(row.daily_hours_last_7_days)
          : row.daily_hours_last_7_days;
      } catch (e) {
        console.warn("Failed to parse daily_hours_last_7_days:", e);
        dailyHours = [];
      }
    }

    // Calculate total leaves (assuming 12 per year, can be made configurable)
    const totalLeaves = 12;
    const remainingLeaves = Math.max(0, totalLeaves - parseFloat(row.leaves_taken || 0));

    // Use leave status breakdown from the view (all leaves, not just last 7 days)
    // This matches the pending_approvals.leave count which also uses all leaves
    const leaveStatusBreakdown = {
      approved: parseInt(row.leave_approved_count || 0, 10),
      pending: parseInt(row.leave_pending_count || 0, 10),
      rejected: parseInt(row.leave_rejected_count || 0, 10),
    };

    return {
      user_code: row.user_code,
      user_name: row.user_name,
      total_hours_last_7_days: parseFloat(row.total_hours_last_7_days || 0),
      pending_approvals: {
        timesheet: parseInt(row.pending_timesheet_count || 0, 10),
        leave: parseInt(row.pending_leave_count || 0, 10),
        total: parseInt(row.total_pending_approvals || 0, 10),
      },
      tasks: {
        total: parseInt(row.total_tasks || 0, 10),
        completed: parseInt(row.completed_tasks || 0, 10),
        in_progress: parseInt(row.task_in_progress_count || 0, 10),
        to_do: parseInt(row.task_to_do_count || 0, 10),
        blocked: parseInt(row.task_cancelled_count || 0, 10),
        overdue: parseInt(row.overdue_tasks || 0, 10),
      },
      timesheet_status: {
        approved: parseInt(row.timesheet_approved_count || 0, 10),
        pending: parseInt(row.timesheet_pending_count || 0, 10),
        rejected: parseInt(row.timesheet_rejected_count || 0, 10),
      },
      leave_status: leaveStatusBreakdown,
      leave_registry: {
        total: totalLeaves,
        taken: parseFloat(row.leaves_taken || 0),
        remaining: remainingLeaves,
      },
      daily_hours_last_7_days: dailyHours,
      date_ranges: {
        last_7_days_start: row.last_7_days_start,
        last_7_days_end: row.last_7_days_end,
        current_year_start: row.current_year_start,
        current_year_end: row.current_year_end,
      },
    };
  } catch (error) {
    console.error("❌ getTeamDashboardData error:", error.message);
    throw error;
  }
};

