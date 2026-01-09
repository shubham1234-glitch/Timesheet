// Epic and Task types for JIRA-like structure

export type EpicStatus = "To Do" | "In Progress" | "On Hold" | "Blocked" | "Done";
export type TaskStatus = "To Do" | "In Progress" | "On Hold" | "Blocked" | "Done";

export interface EpicAttachment {
  id: number;
  file_name: string;
  file_path: string;
  file_url?: string; // Downloadable URL for the file
  file_type: string;
  file_size: string;
  purpose: string;
  created_by: string;
  created_at: string;
}

export interface Epic {
  epicId: string;
  key: string; // e.g., "EPIC-001"
  title: string;
  description: string;
  status: EpicStatus;
  priority: "High" | "Medium" | "Low";
  assignee?: string;
  reporter: string;
  startDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  completionDate?: string; // YYYY-MM-DD
  product: string;
  client?: string;
  tasks: Task[]; // Tasks under this epic
  estimatedHours: number;
  actualHours: number;
  progress: number; // 0-100, calculated from tasks
  attachments?: EpicAttachment[];
  attachments_count?: number;
  isBillable?: boolean;
}

export interface Task {
  taskId: string;
  key: string; // e.g., "TASK-001"
  title: string;
  description: string;
  status: TaskStatus;
  priority: "High" | "Medium" | "Low";
  assignee: string;
  reporter: string;
  epicId: string; // Reference to parent epic
  startDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  submissionDate?: string; // YYYY-MM-DD
  estimatedHours: number;
  actualHours: number;
  product: string;
  taskType: "Bug" | "Feature" | "Task";
  attachments: string[];
  subTasks?: SubTask[];
}

export interface SubTask {
  key: string;
  id: string;
  title: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  assignee: string;
  status: "To Do" | "In Progress" | "Completed";
  dueDate?: string;
}

