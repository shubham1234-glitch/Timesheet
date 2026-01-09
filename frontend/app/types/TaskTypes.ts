export interface SubTask {
  key: string;
  id: string;
  title: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  assignee: string;
  status: "To Do" | "In Progress" | "Completed";
}

export interface TaskData {
  taskId: string;
  title: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  type: "Bug" | "Feature" | "Task";
  status: "To Do" | "In Progress" | "Completed";
  assignee: string;
  reporter: string;
  startDate: string;
  dueDate: string;
  estimatedHours: number;
  actualHours: number;
  subTasks: number;
  attachments: string[];
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  timestamp: Date;
}
