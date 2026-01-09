import express from "express";
import { fetchTeamDashboardData } from "../controllers/teamDashboardController.js";

const router = express.Router();

// Get team dashboard data for a specific team member
// Query parameter: user_code (the team member's user code)
router.get("/get_team_dashboard_data", fetchTeamDashboardData);

export default router;

