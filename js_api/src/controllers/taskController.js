import { getTasks, getTaskById, getSubtaskById, deleteTask, assignTaskToSelf } from "../models/taskModel.js";

export const fetchTasks = async (req, res) => {
  try {
    const filters = req.query;
    const limit = parseInt(filters.limit) || 100;
    const offset = parseInt(filters.offset) || 0;

    const result = await getTasks(filters, limit, offset);

    res.status(200).json({
      success_flag: true,
      data: {
        tasks: result.tasks,
        pagination: {
          total_count: result.total_count,
          limit,
          offset,
          has_more: offset + result.tasks.length < result.total_count,
        },
      },
      message: `Retrieved ${result.tasks.length} tasks successfully`,
      status_code: 200,
      status_message: "OK",
    });
  } catch (err) {
    console.error("Error fetching tasks:", err);
    res.status(500).json({
      success_flag: false,
      message: "Database query failed",
      error: err.message,
      status_code: 500,
      status_message: "Internal Server Error",
    });
  }
};

/**
 * Get "available" tasks for a team:
 * - Task is assigned to a team (task_team_code)
 * - Task is NOT assigned to any individual user (task_assignee is null/empty)
 * The frontend should resolve the current user's team_code (from master data)
 * and pass it as ?team_code=T01.
 */
export const fetchAvailableTasks = async (req, res) => {
  try {
    const { team_code, limit, offset, ...rest } = req.query;

    if (!team_code) {
      return res.status(400).json({
        success_flag: false,
        message: "team_code query parameter is required",
        status_code: 400,
        status_message: "Bad Request",
      });
    }

    const parsedLimit = parseInt(String(limit), 10) || 100;
    const parsedOffset = parseInt(String(offset), 10) || 0;

    const filters = {
      ...rest,
      team_code_for_available: team_code,
    };

    const result = await getTasks(filters, parsedLimit, parsedOffset);

    return res.status(200).json({
      success_flag: true,
      data: {
        tasks: result.tasks,
        pagination: {
          total_count: result.total_count,
          limit: parsedLimit,
          offset: parsedOffset,
          has_more: parsedOffset + result.tasks.length < result.total_count,
        },
      },
      message: `Retrieved ${result.tasks.length} available task(s) successfully`,
      status_code: 200,
      status_message: "OK",
    });
  } catch (err) {
    console.error("Error fetching available tasks:", err);
    return res.status(500).json({
      success_flag: false,
      message: "Database query failed",
      error: err.message,
      status_code: 500,
      status_message: "Internal Server Error",
    });
  }
};

export const fetchTaskById = async (req, res) => {
  try {
    const { task_id } = req.params;
    const task = await getTaskById(task_id);

    if (!task) {
      return res.status(404).json({
        success_flag: false,
        message: `Task with ID ${task_id} not found`,
        status_code: 404,
        status_message: "Not Found",
      });
    }

    res.status(200).json({
      success_flag: true,
      data: task,
      message: "Task details retrieved successfully",
      status_code: 200,
      status_message: "OK",
    });
  } catch (err) {
    res.status(500).json({
      success_flag: false,
      message: "Database query failed",
      error: err.message,
      status_code: 500,
      status_message: "Internal Server Error",
    });
  }
};

export const fetchMyTasks = async (req, res) => {
  try {
    // for now we'll mock the current user
    const current_user = "USR001"; // replace with JWT in next step
    const filters = { ...req.query, task_assignee: current_user };

    const result = await getTasks(filters);

    res.status(200).json({
      success_flag: true,
      data: result.tasks,
      message: "Retrieved tasks assigned to you successfully",
      status_code: 200,
      status_message: "OK",
    });
  } catch (err) {
    res.status(500).json({
      success_flag: false,
      message: "Database query failed",
      error: err.message,
      status_code: 500,
      status_message: "Internal Server Error",
    });
  }
};

export const assignTaskToSelfController = async (req, res) => {
  try {
    const { task_id } = req.params;
    
    if (!task_id) {
      return res.status(400).json({
        success_flag: false,
        message: "Task ID is required",
        status_code: 400,
        status_message: "Bad Request",
      });
    }

    const taskIdNum = parseInt(task_id, 10);
    if (isNaN(taskIdNum)) {
      return res.status(400).json({
        success_flag: false,
        message: "Invalid task ID format",
        status_code: 400,
        status_message: "Bad Request",
      });
    }

    // Get current user from headers (x-user-code) or JWT token
    let current_user = req.headers['x-user-code'];
    
    if (!current_user && req.headers['authorization']) {
      const token = req.headers['authorization'].replace('Bearer ', '');
      // TODO: Decode JWT token to extract user_code when authentication is fully implemented
      // For now, we'll use a placeholder
      console.warn("⚠️ JWT token authentication not fully implemented, using x-user-code header");
    }

    if (!current_user) {
      return res.status(401).json({
        success_flag: false,
        message: "User code is required. Please provide x-user-code header or valid authorization token.",
        status_code: 401,
        status_message: "Unauthorized",
      });
    }

    // Normalize user code (uppercase, trimmed)
    current_user = String(current_user).trim().toUpperCase();

    const result = await assignTaskToSelf(taskIdNum, current_user);

    if (!result.success) {
      return res.status(400).json({
        success_flag: false,
        message: result.message,
        status_code: 400,
        status_message: "Bad Request",
      });
    }

    return res.status(200).json({
      success_flag: true,
      message: result.message,
      status_code: 200,
      status_message: "OK",
    });
  } catch (err) {
    console.error("❌ assignTaskToSelfController error:", err.message);
    return res.status(500).json({
      success_flag: false,
      message: "Unexpected server error",
      error: err.message,
      status_code: 500,
      status_message: "Internal Server Error",
    });
  }
};

/**
 * Fetch single subtask by ID
 */
export const fetchSubtaskById = async (req, res) => {
  try {
    const { subtask_id } = req.params;
    
    if (!subtask_id) {
      return res.status(400).json({
        success_flag: false,
        message: "Subtask ID is required",
        status_code: 400,
        status_message: "Bad Request",
      });
    }
    
    const subtask = await getSubtaskById(subtask_id);

    if (!subtask) {
      return res.status(404).json({
        success_flag: false,
        message: `Subtask with ID ${subtask_id} not found`,
        status_code: 404,
        status_message: "Not Found",
      });
    }

    return res.status(200).json({
      success_flag: true,
      data: subtask,
      message: "Subtask details retrieved successfully",
      status_code: 200,
      status_message: "OK",
    });
  } catch (err) {
    console.error("❌ fetchSubtaskById controller error:", err.message);
    return res.status(500).json({
      success_flag: false,
      message: "Database query failed",
      error: err.message,
      status_code: 500,
      status_message: "Internal Server Error",
    });
  }
};

export const deleteTaskById = async (req, res) => {
  try {
    const { epic_id, task_id } = req.params;
    const force_delete = req.query.force_delete === 'true' || req.query.force_delete === true;

    if (!task_id) {
      return res.status(400).json({
        success_flag: false,
        message: "Task ID is required",
        status_code: 400,
        status_message: "Bad Request",
      });
    }

    const taskIdNum = parseInt(task_id, 10);
    if (isNaN(taskIdNum)) {
      return res.status(400).json({
        success_flag: false,
        message: "Invalid task ID format",
        status_code: 400,
        status_message: "Bad Request",
      });
    }

    // NOTE: epic_id is currently not used in delete logic, but is accepted for API contract consistency
    if (!epic_id) {
      console.warn("⚠️ deleteTaskById called without epic_id in params");
    }

    const result = await deleteTask(taskIdNum, force_delete);

    if (!result.success) {
      return res.status(404).json({
        success_flag: false,
        message: result.message,
        status_code: 404,
        status_message: "Not Found",
      });
    }

    return res.status(200).json({
      success_flag: true,
      message: result.message,
      status_code: 200,
      status_message: "OK",
    });
  } catch (err) {
    console.error("❌ deleteTaskById controller error:", err.message);
    return res.status(500).json({
      success_flag: false,
      message: "Unexpected server error",
      error: err.message,
      status_code: 500,
      status_message: "Internal Server Error",
    });
  }
};
