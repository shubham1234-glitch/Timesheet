import { getLeaveApplications } from "../models/leaveModel.js";

/**
 * Fetch leave applications for the logged-in user
 */
export const fetchLeaveApplications = async (req, res) => {
  try {
    // Extract user code from header
    let current_user = req.headers['x-user-code'];

    // Validate user code is provided
    if (!current_user) {
      return res.status(400).json({
        success_flag: false,
        message: "User code is required. Please ensure you are logged in.",
        status_code: 400,
        status_message: "Bad Request",
      });
    }

    const filters = req.query || {};
    const limit = parseInt(req.query.limit, 10) || 100;
    const offset = parseInt(req.query.offset, 10) || 0;

    const result = await getLeaveApplications(current_user, filters, limit, offset);

    res.status(200).json({
      success_flag: true,
      data: {
        entries: result.entries,
        pagination: {
          total_count: result.total_count,
          limit,
          offset,
          has_more: offset + result.entries.length < result.total_count,
        },
      },
      message: `Retrieved ${result.entries.length} leave applications successfully`,
      status_code: 200,
      status_message: "OK",
    });
  } catch (error) {
    console.error("❌ fetchLeaveApplications controller error:", error.message);
    res.status(500).json({
      success_flag: false,
      message: "Database query failed",
      error: error.message,
      status_code: 500,
      status_message: "Internal Server Error",
    });
  }
};


