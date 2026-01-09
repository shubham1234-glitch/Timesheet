import { pool } from "../config/db.js";

/**
 * Get all active predefined epics with their tasks
 * Returns data formatted for dropdown selection
 */
export const getPredefinedEpics = async (filters = {}) => {
  try {
    const whereConditions = ["is_active = true"];
    const params = [];

    // Optional filters
    const { product_code, company_code } = filters;

    if (product_code) {
      whereConditions.push(`default_product_code = $${params.length + 1}`);
      params.push(product_code);
    }
    if (company_code) {
      whereConditions.push(`default_company_code = $${params.length + 1}`);
      params.push(company_code);
    }

    // Build WHERE clause
    const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

    const query = `
      SELECT 
        predefined_epic_id AS id,
        predefined_epic_name AS template_name,
        predefined_epic_description AS description,
        epic_title,
        epic_description,
        default_product_code AS product_code,
        default_product_name AS product_name,
        default_product_version AS product_version,
        default_product_description AS product_description,
        default_company_code AS company_code,
        default_company_name AS company_name,
        default_contact_person_code AS contact_person_code,
        default_contact_person_name AS contact_person_name,
        default_contact_person_email AS contact_person_email,
        default_contact_person_phone AS contact_person_phone,
        default_priority_code AS priority_code,
        default_priority_description AS priority_description,
        default_estimated_hours AS estimated_hours,
        default_max_hours AS max_hours,
        default_is_billable AS is_billable,
        is_active,
        usage_count,
        default_epic_duration_days AS epic_duration_days,
        predefined_task_count AS task_count,
        total_predefined_task_estimated_hours AS total_task_estimated_hours,
        total_predefined_task_max_hours AS total_task_max_hours,
        predefined_tasks AS tasks,
        predefined_epic_created_by AS epic_created_by,
        predefined_epic_created_at AS epic_created_at,
        predefined_epic_updated_by AS epic_updated_by,
        predefined_epic_updated_at AS epic_updated_at,
        predefined_epic_created_by_name AS epic_created_by_name,
        predefined_epic_updated_by_name AS epic_updated_by_name
      FROM sts_ts.view_predefined_epics_tasks
      ${whereClause}
      ORDER BY predefined_epic_name ASC;
    `;

    const result = await pool.query(query, params);
    const rows = result?.rows || [];

    if (!rows.length) {
      return { predefinedEpics: [] };
    }

    // Transform database rows to frontend format
    const predefinedEpics = rows.map((row) => {
      // Parse tasks JSON array (from view_predefined_epics_tasks)
      let tasks = [];
      try {
        if (row.tasks) {
          if (typeof row.tasks === 'string') {
            tasks = JSON.parse(row.tasks);
          } else {
            tasks = row.tasks;
          }
        }
      } catch (error) {
        console.error("Error parsing tasks JSON:", error.message);
        tasks = [];
      }

      // Transform tasks to frontend format
      const transformedTasks = tasks.map((task) => {
        // Handle date conversion safely
        let startDate = '';
        let dueDate = '';

        if (task.start_date) {
          try {
            const date = new Date(task.start_date);
            if (!isNaN(date.getTime())) {
              startDate = date.toISOString().split('T')[0];
            }
          } catch (e) {
            console.error("Error parsing start_date:", e.message);
          }
        }

        if (task.due_date) {
          try {
            const date = new Date(task.due_date);
            if (!isNaN(date.getTime())) {
              dueDate = date.toISOString().split('T')[0];
            }
          } catch (e) {
            console.error("Error parsing due_date:", e.message);
          }
        }

        return {
          id: String(task.id || ''),
          title: task.task_title || '',
          description: task.task_description || '',
          estimatedHours: Number(task.estimated_hours || 0),
          startDate,
          dueDate,
          priority: task.default_priority_code ? String(task.default_priority_code) : '2',
          type: task.default_task_type_code || '',
          team: task.assigned_team_name || task.assigned_team_code || '',
          assignee: '',
          status: task.default_status_code || '',
          isBillable: task.is_billable ?? true,
          selected: true,
        };
      });

      return {
        id: String(row.id),
        name: row.template_name || '',
        description: row.description || '',
        startDate: '', // Will be set by user during instantiation
        dueDate: '', // Will be set by user during instantiation
        priority: row.priority_code ? String(row.priority_code) : '',
        product: row.product_code || '',
        client: row.company_code || '',
        contactPerson: row.contact_person_code || '',
        estimatedHours: Number(row.estimated_hours || 0),
        maxHours: Number(row.max_hours || 0),
        isBillable: row.is_billable ?? true,
        tasks: transformedTasks,
        // Additional metadata that might be useful
        epicTitle: row.epic_title || '',
        epicDescription: row.epic_description || '',
        defaultProductName: row.product_name || '',
        defaultCompanyName: row.company_name || '',
        defaultContactPersonName: row.contact_person_name || '',
        defaultPriorityDescription: row.priority_description || '',
        predefinedTaskCount: Number(row.task_count || 0),
        totalTaskEstimatedHours: Number(row.total_task_estimated_hours || 0),
        totalTaskMaxHours: Number(row.total_task_max_hours || 0),
        defaultEpicDurationDays: row.epic_duration_days || null,
        usageCount: Number(row.usage_count || 0),
      };
    });

    return {
      predefinedEpics,
      total_count: predefinedEpics.length,
    };
  } catch (error) {
    console.error("❌ getPredefinedEpics error:", error.message);
    return { predefinedEpics: [], total_count: 0, error: error.message };
  }
};

/**
 * Get single predefined epic by ID
 */
export const getPredefinedEpicById = async (predefined_epic_id) => {
  try {
    const query = `
      SELECT 
        predefined_epic_id AS id,
        predefined_epic_name AS template_name,
        predefined_epic_description AS description,
        epic_title,
        epic_description,
        default_product_code AS product_code,
        default_product_name AS product_name,
        default_product_version AS product_version,
        default_product_description AS product_description,
        default_company_code AS company_code,
        default_company_name AS company_name,
        default_contact_person_code AS contact_person_code,
        default_contact_person_name AS contact_person_name,
        default_contact_person_email AS contact_person_email,
        default_contact_person_phone AS contact_person_phone,
        default_priority_code AS priority_code,
        default_priority_description AS priority_description,
        default_estimated_hours AS estimated_hours,
        default_max_hours AS max_hours,
        default_is_billable AS is_billable,
        is_active,
        usage_count,
        default_epic_duration_days AS epic_duration_days,
        predefined_task_count AS task_count,
        total_predefined_task_estimated_hours AS total_task_estimated_hours,
        total_predefined_task_max_hours AS total_task_max_hours,
        predefined_tasks AS tasks,
        predefined_epic_created_by AS epic_created_by,
        predefined_epic_created_at AS epic_created_at,
        predefined_epic_updated_by AS epic_updated_by,
        predefined_epic_updated_at AS epic_updated_at,
        predefined_epic_created_by_name AS epic_created_by_name,
        predefined_epic_updated_by_name AS epic_updated_by_name
      FROM sts_ts.view_predefined_epics_tasks
      WHERE predefined_epic_id = $1 AND is_active = true;
    `;

    const result = await pool.query(query, [predefined_epic_id]);
    const rows = result?.rows || [];

    if (!rows.length) {
      return null;
    }

    const row = rows[0];

    // Parse tasks JSON array (from view_unified_epic_task)
    let tasks = [];
    try {
      if (row.tasks) {
        if (typeof row.tasks === 'string') {
          tasks = JSON.parse(row.tasks);
        } else {
          tasks = row.tasks;
        }
      }
    } catch (error) {
      console.error("Error parsing tasks JSON:", error.message);
      tasks = [];
    }

    // Transform tasks to frontend format
    const transformedTasks = tasks.map((task) => {
      // Handle date conversion safely
      let startDate = '';
      let dueDate = '';

      if (task.start_date) {
        try {
          const date = new Date(task.start_date);
          if (!isNaN(date.getTime())) {
            startDate = date.toISOString().split('T')[0];
          }
        } catch (e) {
          console.error("Error parsing start_date:", e.message);
        }
      }

      if (task.due_date) {
        try {
          const date = new Date(task.due_date);
          if (!isNaN(date.getTime())) {
            dueDate = date.toISOString().split('T')[0];
          }
        } catch (e) {
          console.error("Error parsing due_date:", e.message);
        }
      }

      return {
        id: String(task.id || ''),
        title: task.task_title || '',
        description: task.task_description || '',
        estimatedHours: Number(task.estimated_hours || 0),
        startDate,
        dueDate,
        priority: task.default_priority_code ? String(task.default_priority_code) : '2',
        type: task.default_task_type_code || '',
        team: task.assigned_team_name || task.assigned_team_code || '',
        assignee: '',
        status: task.default_status_code || '',
        isBillable: task.is_billable ?? true,
        selected: true,
      };
    });

    return {
      id: String(row.id),
      name: row.template_name || '',
      description: row.description || '',
      startDate: '',
      dueDate: '',
      priority: row.priority_code ? String(row.priority_code) : '',
      product: row.product_code || '',
      client: row.company_code || '',
      contactPerson: row.contact_person_code || '',
      estimatedHours: Number(row.estimated_hours || 0),
      maxHours: Number(row.max_hours || 0),
      isBillable: row.is_billable ?? true,
      tasks: transformedTasks,
      epicTitle: row.epic_title || '',
      epicDescription: row.epic_description || '',
      defaultProductName: row.product_name || '',
      defaultCompanyName: row.company_name || '',
      defaultContactPersonName: row.contact_person_name || '',
      defaultPriorityDescription: row.priority_description || '',
      predefinedTaskCount: Number(row.task_count || 0),
      totalTaskEstimatedHours: Number(row.total_task_estimated_hours || 0),
      totalTaskMaxHours: Number(row.total_task_max_hours || 0),
      defaultEpicDurationDays: row.epic_duration_days || null,
      usageCount: Number(row.usage_count || 0),
    };
  } catch (error) {
    console.error("❌ getPredefinedEpicById error:", error.message);
    throw new Error("Database query failed");
  }
};

