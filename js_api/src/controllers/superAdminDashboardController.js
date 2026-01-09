import { getSuperAdminDashboardData } from "../models/superAdminDashboardModel.js";

/**
 * Fetch super admin dashboard data
 * Supports optional product_code query parameter
 */
export const fetchSuperAdminDashboardData = async (req, res) => {
  try {
    const productCode = req.query.product_code || null;
    
    console.log(`📊 Fetching super admin dashboard data${productCode ? ` for product: ${productCode}` : ' (all products)'}`);
    
    const dashboardData = await getSuperAdminDashboardData(productCode);
    
    // Return 200 with success_flag: true even when no data found, but with null data
    // This allows frontend to show a friendly "no data" message instead of an error
    if (!dashboardData) {
      console.log(`ℹ️ No dashboard data found${productCode ? ` for product: ${productCode}` : ''}`);
      return res.status(200).json({
        success_flag: true,
        data: null,
        message: productCode 
          ? `No dashboard data available for product ${productCode}`
          : "No dashboard data found",
        status_code: 200,
        status_message: "OK",
      });
    }
    
    console.log(`✅ Super admin dashboard data retrieved successfully${productCode ? ` for product: ${productCode}` : ''}`);

    res.status(200).json({
      success_flag: true,
      data: dashboardData,
      message: productCode
        ? `Dashboard data retrieved successfully for product ${productCode}`
        : "Dashboard data retrieved successfully for all products",
      status_code: 200,
      status_message: "OK",
    });
  } catch (error) {
    console.error("❌ fetchSuperAdminDashboardData controller error:", error.message);
    res.status(500).json({
      success_flag: false,
      message: "Database query failed",
      error: error.message,
      status_code: 500,
      status_message: "Internal Server Error",
    });
  }
};

