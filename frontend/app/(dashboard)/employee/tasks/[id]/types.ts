export interface SubTask {
  key: string;
  id: string;
  title: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  assignee: string;
  status: "To Do" | "In Progress" | "Done" | "Blocked" | "On Hold";
  dueDate?: string;
}

export interface TaskData {
  taskId: string;
  title: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  type: string; // Task type can be any string from master data (e.g., "Bug", "Feature", "Task", "Design", etc.)
  status: "To Do" | "In Progress" | "Done" | "Blocked" | "On Hold";
  team?: string;
  assignee: string;
  reporter: string;
  product?: string; // Product code or name
  workMode?: string; // Work mode/location (e.g., "Remote", "Office", "Client Site")
  startDate: string;
  dueDate: string;
  submissionDate?: string;
  estimatedHours: number;
  actualHours: number;
  attachments: string[];
  epicId?: string; // Epic ID this task belongs to
  epicKey?: string; // Epic key (e.g., "EPIC-001") for display
  statusReason?: string; // Reason for On Hold or Blocked status
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  timestamp: Date;
}
