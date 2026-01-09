import { getTeamDashboardData } from "../models/teamDashboardModel.js";

/**
 * Fetch team dashboard data for a specific team member
 */
export const fetchTeamDashboardData = async (req, res) => {
  try {
    // Extract user code from query parameter (the team member to view)
    const { user_code } = req.query;
    
    // Validate user code is provided
    if (!user_code) {
      return res.status(400).json({
        success_flag: false,
        message: "User code is required. Please provide user_code as a query parameter.",
        status_code: 400,
        status_message: "Bad Request",
      });
    }
    
    console.log(`📊 Fetching team dashboard data for user: ${user_code}`);
    
    const dashboardData = await getTeamDashboardData(user_code);
    
    if (!dashboardData) {
      return res.status(404).json({
        success_flag: false,
        message: `Team dashboard data not found for user ${user_code}`,
        status_code: 404,
        status_message: "Not Found",
      });
    }
    
    console.log(`✅ Team dashboard data retrieved successfully for user ${user_code}`);

    res.status(200).json({
      success_flag: true,
      data: dashboardData,
      message: "Team dashboard data retrieved successfully",
      status_code: 200,
      status_message: "OK",
    });
  } catch (error) {
    console.error("❌ fetchTeamDashboardData controller error:", error.message);
    res.status(500).json({
      success_flag: false,
      message: "Database query failed",
      error: error.message,
      status_code: 500,
      status_message: "Internal Server Error",
    });
  }
};

