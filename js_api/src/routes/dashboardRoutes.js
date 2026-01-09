import express from "express";
import { fetchDashboardData } from "../controllers/dashboardController.js";

const router = express.Router();

// Get dashboard data for logged-in user
router.get("/get_dashboard_data", fetchDashboardData);

export default router;

