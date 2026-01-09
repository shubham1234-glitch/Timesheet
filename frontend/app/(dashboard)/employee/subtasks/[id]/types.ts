export interface SubtaskData {
  subtaskId: string;
  title: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  status: "To Do" | "In Progress" | "Done" | "Blocked" | "On Hold";
  team?: string;
  assignee: string;
  workMode?: string; // Work mode/location (e.g., "Remote", "Office", "Client Site")
  startDate: string;
  dueDate: string;
  closedDate?: string;
  estimatedHours: number;
  estimatedDays: number;
  isBillable: boolean;
  attachments: string[];
  parentTaskId?: string; // Parent Task ID this subtask belongs to
  parentTaskTitle?: string; // Parent Task title for display
  parentEpicId?: string; // Parent Epic ID
  parentEpicTitle?: string; // Parent Epic title for display
  statusReason?: string; // Reason for On Hold or Blocked status
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  timestamp: Date;
}

