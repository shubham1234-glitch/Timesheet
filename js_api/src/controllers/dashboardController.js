import { getDashboardData } from "../models/dashboardModel.js";

/**
 * Fetch dashboard data for the logged-in user
 */
export const fetchDashboardData = async (req, res) => {
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
    
    console.log(`📊 Fetching dashboard data for user: ${current_user}`);
    
    const dashboardData = await getDashboardData(current_user);
    
    if (!dashboardData) {
      return res.status(404).json({
        success_flag: false,
        message: `Dashboard data not found for user ${current_user}`,
        status_code: 404,
        status_message: "Not Found",
      });
    }
    
    console.log(`✅ Dashboard data retrieved successfully for user ${current_user}`);

    res.status(200).json({
      success_flag: true,
      data: dashboardData,
      message: "Dashboard data retrieved successfully",
      status_code: 200,
      status_message: "OK",
    });
  } catch (error) {
    console.error("❌ fetchDashboardData controller error:", error.message);
    res.status(500).json({
      success_flag: false,
      message: "Database query failed",
      error: error.message,
      status_code: 500,
      status_message: "Internal Server Error",
    });
  }
};

