import express from "express";
import { fetchLeaveApplications } from "../controllers/leaveController.js";

const router = express.Router();

// Get leave applications for logged-in user (with optional filters)
router.get("/get_leave_applications", fetchLeaveApplications);

export default router;


