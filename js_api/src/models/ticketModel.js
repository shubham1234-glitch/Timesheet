import { pool } from "../config/db.js";

/**
 * Get tickets for timesheet entry with optional filters
 * @param {Object} filters - Filter options (assignee, status, priority, etc.)
 * @param {number|null} limit - Maximum number of results (null = no limit, returns all)
 * @param {number} offset - Number of results to skip
 * @returns {Promise<Object>} Object with tickets array and total_count
 */
export const getTicketsForTimesheet = async (filters = {}, limit = null, offset = 0) => {
  try {
    const whereConditions = [];
    const params = [];

    const {
      assignee, // Filter by ticket assignee (user_code) - alias for user_code
      user_code, // Filter by user_code (same as assignee)
      ticket_status,
      ticket_priority_code,
      company_code,
      product_code,
      category_code,
      is_billable,
      is_closed, // Filter for closed tickets (closed_on IS NOT NULL)
    } = filters;

    // Filter by assignee or user_code (for showing tickets assigned to current user)
    // Both are the same field, but we support both for flexibility
    if (assignee || user_code) {
      const filterValue = assignee || user_code;
      whereConditions.push(`user_code = $${params.length + 1}`);
      params.push(filterValue);
    }

    // Filter by ticket status
    if (ticket_status) {
      whereConditions.push(`ticket_status = $${params.length + 1}`);
      params.push(ticket_status);
    }

    // Filter by priority
    if (ticket_priority_code) {
      whereConditions.push(`ticket_priority_code = $${params.length + 1}`);
      params.push(ticket_priority_code);
    }

    // Filter by company
    if (company_code) {
      whereConditions.push(`company_code = $${params.length + 1}`);
      params.push(company_code);
    }

    // Filter by product
    if (product_code) {
      whereConditions.push(`product_code = $${params.length + 1}`);
      params.push(product_code);
    }

    // Filter by category/type
    if (category_code) {
      whereConditions.push(`category_code = $${params.length + 1}`);
      params.push(category_code);
    }

    // Filter by billable flag
    if (is_billable !== undefined) {
      whereConditions.push(`is_billable = $${params.length + 1}`);
      params.push(is_billable);
    }

    // Filter by closed status (only apply if explicitly set to true/false)
    // If not provided, show both open and closed tickets
    if (is_closed !== undefined && is_closed !== null) {
      if (is_closed === true || is_closed === 'true' || is_closed === '1') {
        whereConditions.push(`closed_on IS NOT NULL`);
      } else if (is_closed === false || is_closed === 'false' || is_closed === '0') {
        whereConditions.push(`closed_on IS NULL`);
      }
      // If is_closed is any other value, don't apply filter (show all)
    }

    // Build WHERE clause
    const whereClause = whereConditions.length
      ? `WHERE ${whereConditions.join(" AND ")}`
      : "";

    // Build query with optional LIMIT
    let limitClause = '';
    if (limit && limit > 0) {
      limitClause = `LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
    } else {
      // If no limit, still support offset for consistency
      if (offset > 0) {
        limitClause = `OFFSET $${params.length + 1}`;
        params.push(offset);
      }
    }

    const query = `
      SELECT 
        ticket_code,
        ticket_title,
        ticket_description,
        ticket_status,
        ticket_status_code,
        ticket_priority,
        ticket_priority_code,
        ticket_assignee,
        user_code,
        ticket_assignee_name,
        company_code,
        company_name,
        product_code,
        product_name,
        contact_person_code,
        contact_person_name,
        category_code,
        ticket_type,
        ticket_created_at,
        ticket_assigned_on,
        start_date,
        due_date,
        resolved_on,
        closed_on,
        is_billable
      FROM sts_ts.view_tickets_for_timesheet
      ${whereClause}
      ORDER BY ticket_created_at DESC
      ${limitClause};
    `;

    // Debug logging
    console.log(`?? Query: ${query}`);
    console.log(`?? Params:`, params);
    
    const result = await pool.query(query, params);
    const rows = result?.rows || [];
    
    console.log(`?? Query returned ${rows.length} rows`);

    // Get total count for pagination
    // Remove limit and offset params from count query
    const countParams = limit && limit > 0 
      ? params.slice(0, -2) // Remove limit and offset
      : (offset > 0 ? params.slice(0, -1) : params); // Remove only offset if present
    
    const countQuery = `
      SELECT COUNT(*)
      FROM sts_ts.view_tickets_for_timesheet
      ${whereClause}
    `;
    
    console.log(`?? Count Query: ${countQuery}`);
    console.log(`?? Count Params:`, countParams);
    
    const countResult = await pool.query(countQuery, countParams);
    const total_count = parseInt(countResult.rows[0].count, 10) || 0;
    
    console.log(`?? Total count: ${total_count}`);

    return {
      tickets: rows,
      total_count,
    };
  } catch (error) {
    console.error("? getTicketsForTimesheet error:", error.message);
    throw error;
  }
};

/**
 * Get single ticket by ticket_code
 * @param {number} ticketCode - Ticket code
 * @returns {Promise<Object|null>} Ticket object or null if not found
 */
export const getTicketById = async (ticketCode) => {
  try {
    const query = `
      SELECT 
        ticket_code,
        ticket_title,
        ticket_description,
        ticket_status,
        ticket_status_code,
        ticket_priority,
        ticket_priority_code,
        ticket_assignee,
        user_code,
        ticket_assignee_name,
        company_code,
        company_name,
        product_code,
        product_name,
        contact_person_code,
        contact_person_name,
        category_code,
        ticket_type,
        ticket_created_at,
        ticket_assigned_on,
        start_date,
        due_date,
        resolved_on,
        closed_on,
        is_billable
      FROM sts_ts.view_tickets_for_timesheet
      WHERE ticket_code = $1;
    `;

    const result = await pool.query(query, [ticketCode]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error("? getTicketById error:", error.message);
    throw error;
  }
};

