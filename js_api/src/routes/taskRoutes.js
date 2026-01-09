import express from "express";
import {
  fetchTasks,
  fetchTaskById,
  fetchSubtaskById,
  fetchMyTasks,
  fetchAvailableTasks,
  deleteTaskById,
  assignTaskToSelfController,
} from "../controllers/taskController.js";

const router = express.Router();

// Get all tasks (with filters)
router.get("/get_tasks", fetchTasks);

// Get "available" tasks for a team (assigned to team, unassigned to individual)
router.get("/get_tasks/available", fetchAvailableTasks);

// Get single task by ID
router.get("/get_task/:task_id", fetchTaskById);

// Get single subtask by ID
router.get("/get_subtask/:subtask_id", fetchSubtaskById);

// Get tasks assigned to logged-in user (for now no JWT, just mock)
router.get("/get_tasks/my_tasks", fetchMyTasks);

// Delete task by ID under a specific epic
router.delete("/delete_task/:epic_id/:task_id", deleteTaskById);

// Assign task to self
router.post("/assign_task_to_self/:task_id", assignTaskToSelfController);

export default router;
