export type Priority = "High" | "Medium" | "Low";
export type Status = "In Progress" | "Completed" | "Pending" | "Overdue" | "To Do";
export type Approval = "Pending" | "Approved" | "Rejected";
export type LeaveStatus = "Pending" | "Approved" | "Rejected";

export interface Task {
  key: string;
  taskId: string;
  taskName: string;
  product: string;
  client?: string;
  assignee: string;
  priority: Priority;
  startDate: string; // DD/MM/YYYY
  dueDate: string;   // DD/MM/YYYY
  submitDate: string;// DD/MM/YYYY
  status: Status;
  approval: Approval;
  delayDays?: number;
  epicId?: string; // Epic ID this task belongs to
  epicKey?: string; // Epic key (e.g., "EPIC-001") for display
}

export interface SubTask {
  key: string;
  id: string;
  title: string;
  description: string;
  priority: Priority;
  assignee: string;
  status: Exclude<Status, "Pending" | "Overdue">; // To Do | In Progress | Completed
}

export interface TaskData {
  taskId: string;
  title: string;
  description: string;
  priority: Priority;
  type: "Bug" | "Feature" | "Task";
  status: Exclude<Status, "Pending" | "Overdue">; // To Do | In Progress | Completed
  assignee: string;
  reporter: string;
  startDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD
  submissionDate?: string; // YYYY-MM-DD
  estimatedHours: number;
  actualHours: number;
  subTasks: number;
  attachments: string[];
  approval?: Approval;
}

export interface LeaveRow {
  key: string;
  fromDate: string; // DD-MM-YYYY
  toDate: string;   // DD-MM-YYYY
  type: "Casual" | "Sick" | "Earned" | "Unpaid";
  days: number;
  status: LeaveStatus;
  reason: string;
  approver?: string;
}


