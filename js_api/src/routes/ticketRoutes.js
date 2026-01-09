import express from "express";
import {
  fetchTicketsForTimesheet,
  fetchTicketById,
} from "../controllers/ticketController.js";

const router = express.Router();

// Get tickets for timesheet entry (with optional filters)
// Query params: assignee, ticket_status, ticket_priority_code, company_code, product_code, category_code, is_billable, is_closed, limit, offset
router.get("/get_tickets", fetchTicketsForTimesheet);

// Get single ticket by ticket_code
router.get("/get_ticket/:ticket_code", fetchTicketById);

export default router;

