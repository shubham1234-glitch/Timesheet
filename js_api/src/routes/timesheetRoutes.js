import express from "express";
import {
  fetchTimesheetEntries,
  fetchTimesheetEntryById,
} from "../controllers/timesheetController.js";

const router = express.Router();

// Get timesheet entries for logged-in user (with optional filters)
router.get("/get_timesheet_entries", fetchTimesheetEntries);

// Get single timesheet entry by ID
router.get("/get_timesheet_entry/:entry_id", fetchTimesheetEntryById);

export default router;

