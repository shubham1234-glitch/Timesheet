import { getTimesheetEntries, getTimesheetEntryById } from "../models/timesheetModel.js";

/**
 * Fetch timesheet entries for the logged-in user
 */
export const fetchTimesheetEntries = async (req, res) => {
  try {
    // Extract user code from header
    let current_user = req.headers['x-user-code'];
    
    // If no user code in header, try to extract from JWT token (future implementation)
    if (!current_user && req.headers['authorization']) {
      const token = req.headers['authorization'].replace('Bearer ', '');
      // TODO: Decode JWT token to extract user_code when authentication is fully implemented
      // For now, fallback to error if no user code provided
    }
    
    // Validate user code is provided
    if (!current_user) {
      return res.status(400).json({
        success_flag: false,
        message: "User code is required. Please ensure you are logged in.",
        status_code: 400,
        status_message: "Bad Request",
      });
    }
    
    console.log(`📋 Fetching timesheet entries for user: ${current_user}`);
    
    const filters = req.query || {};
    const limit = parseInt(req.query.limit, 10) || 100;
    const offset = parseInt(req.query.offset, 10) || 0;

    const result = await getTimesheetEntries(current_user, filters, limit, offset);
    
    console.log(`✅ Found ${result.entries.length} timesheet entries for user ${current_user}`);

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
      message: `Retrieved ${result.entries.length} timesheet entries successfully`,
      status_code: 200,
      status_message: "OK",
    });
  } catch (error) {
    console.error("❌ fetchTimesheetEntries controller error:", error.message);
    res.status(500).json({
      success_flag: false,
      message: "Database query failed",
      error: error.message,
      status_code: 500,
      status_message: "Internal Server Error",
    });
  }
};

/**
 * Fetch single timesheet entry by ID
 */
export const fetchTimesheetEntryById = async (req, res) => {
  try {
    // Extract user code from header
    let current_user = req.headers['x-user-code'];
    
    // If no user code in header, try to extract from JWT token (future implementation)
    if (!current_user && req.headers['authorization']) {
      const token = req.headers['authorization'].replace('Bearer ', '');
      // TODO: Decode JWT token to extract user_code when authentication is fully implemented
      // For now, fallback to error if no user code provided
    }
    
    // Validate user code is provided
    if (!current_user) {
      return res.status(400).json({
        success_flag: false,
        message: "User code is required. Please ensure you are logged in.",
        status_code: 400,
        status_message: "Bad Request",
      });
    }
    
    const { entry_id } = req.params;

    const entry = await getTimesheetEntryById(entry_id, current_user);

    if (!entry) {
      return res.status(404).json({
        success_flag: false,
        message: `Timesheet entry with ID ${entry_id} not found`,
        status_code: 404,
        status_message: "Not Found",
      });
    }

    res.status(200).json({
      success_flag: true,
      data: entry,
      message: "Timesheet entry retrieved successfully",
      status_code: 200,
      status_message: "OK",
    });
  } catch (error) {
    console.error("❌ fetchTimesheetEntryById controller error:", error.message);
    res.status(500).json({
      success_flag: false,
      message: "Database query failed",
      error: error.message,
      status_code: 500,
      status_message: "Internal Server Error",
    });
  }
};

