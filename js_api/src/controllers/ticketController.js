import { getTicketsForTimesheet, getTicketById } from "../models/ticketModel.js";

/**
 * Fetch tickets for timesheet entry
 * Supports filtering by assignee, status, priority, etc.
 */
export const fetchTicketsForTimesheet = async (req, res) => {
  try {
    // Extract user code from header (required - for filtering by assignee)
    // Headers are case-insensitive, but Express normalizes them to lowercase
    let current_user = req.headers['x-user-code'] || req.headers['X-User-Code'];
    
    // If no user code in header, try to extract from JWT token (future implementation)
    if (!current_user && req.headers['authorization']) {
      const token = req.headers['authorization'].replace('Bearer ', '');
      // TODO: Decode JWT token to extract user_code when authentication is fully implemented
    }
    
    console.log(`?? Fetching tickets for timesheet${current_user ? ` (user: ${current_user})` : ''}`);
    
    const filters = req.query || {};
    
    // Automatically filter by logged-in user's assigned tickets
    // This ensures users only see tickets assigned to them
    // Use user_code filter (same as assignee, but more explicit)
    if (current_user) {
      filters.user_code = current_user;
      // Also support assignee for backward compatibility
      if (!filters.assignee) {
        filters.assignee = current_user;
      }
      console.log(`?? Filtering tickets by user_code: ${current_user}`);
    } else {
      // If no user code, return empty result (security: don't show all tickets)
      console.warn("?? No user code provided - returning empty tickets list");
      return res.status(200).json({
        success_flag: true,
        data: {
          tickets: [],
          pagination: {
            total_count: 0,
            limit: parseInt(req.query.limit, 10) || 100,
            offset: parseInt(req.query.offset, 10) || 0,
            has_more: false,
          },
        },
        message: "No user code provided. Please ensure you are logged in.",
        status_code: 200,
        status_message: "OK",
      });
    }
    
    // If limit is not provided or is 0, return all tickets (no limit)
    const limitParam = req.query.limit ? parseInt(req.query.limit, 10) : null;
    const limit = limitParam && limitParam > 0 ? limitParam : null; // null means no limit
    const offset = parseInt(req.query.offset, 10) || 0;

    const result = await getTicketsForTimesheet(filters, limit, offset);
    
    console.log(`? Found ${result.tickets.length} tickets`);

    res.status(200).json({
      success_flag: true,
      data: {
        tickets: result.tickets,
        pagination: {
          total_count: result.total_count,
          limit: limit || result.total_count, // Show actual limit or total count if no limit
          offset,
          has_more: limit ? (offset + result.tickets.length < result.total_count) : false, // No more if no limit
        },
      },
      message: `Retrieved ${result.tickets.length} tickets successfully`,
      status_code: 200,
      status_message: "OK",
    });
  } catch (error) {
    console.error("? fetchTicketsForTimesheet controller error:", error.message);
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
 * Fetch single ticket by ticket_code
 */
export const fetchTicketById = async (req, res) => {
  try {
    const { ticket_code } = req.params;

    if (!ticket_code) {
      return res.status(400).json({
        success_flag: false,
        message: "Ticket code is required",
        status_code: 400,
        status_message: "Bad Request",
      });
    }

    const ticket = await getTicketById(parseInt(ticket_code, 10));

    if (!ticket) {
      return res.status(404).json({
        success_flag: false,
        message: `Ticket with code ${ticket_code} not found`,
        status_code: 404,
        status_message: "Not Found",
      });
    }

    res.status(200).json({
      success_flag: true,
      data: {
        ticket,
      },
      message: "Ticket retrieved successfully",
      status_code: 200,
      status_message: "OK",
    });
  } catch (error) {
    console.error("? fetchTicketById controller error:", error.message);
    res.status(500).json({
      success_flag: false,
      message: "Database query failed",
      error: error.message,
      status_code: 500,
      status_message: "Internal Server Error",
    });
  }
};

