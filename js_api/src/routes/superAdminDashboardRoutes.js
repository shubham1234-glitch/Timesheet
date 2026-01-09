import express from "express";
import { fetchSuperAdminDashboardData } from "../controllers/superAdminDashboardController.js";

const router = express.Router();

// Get super admin dashboard data (optional product_code query parameter)
router.get("/get_super_admin_dashboard_data", fetchSuperAdminDashboardData);

export default router;

