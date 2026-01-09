// API Response types

export interface EpicApiResponse {
  success_flag: boolean;
  message: string;
  status_code: number;
  status_message: string;
  data: {
    epic?: EpicApiData;
    epics?: EpicApiData[];
  };
}

export interface EpicApiData {
  epic_id?: number;
  id?: number;
  epic_title?: string;
  title?: string;
  epic_description?: string;
  description?: string;
  product_code?: string;
  product_name?: string;
  product_version?: string | null;
  product?: {
    product_code?: string;
    product_name?: string;
  };
  epic_status_code?: string;
  status_code?: string;
  epic_status_description?: string;
  status_description?: string;
  status?: string | {
    status_code?: string;
    status_description?: string;
  };
  epic_priority_code?: number;
  priority_code?: number;
  epic_priority_description?: string;
  priority_description?: string;
  priority?: string | {
    priority_code?: number;
    priority_description?: string;
  };
  estimated_hours?: number;
  max_hours?: number;
  is_billable?: boolean;
  epic_start_date?: string;
  start_date?: string;
  epic_due_date?: string;
  due_date?: string;
  timeline?: {
    start_date?: string;
    due_date?: string;
  };
  budget?: {
    estimated_hours?: number;
  };
  epic_reporter?: string;
  epic_reporter_name?: string;
  task_count?: number;
  tasks?: TaskApiData[];
  attachments?: AttachmentApiData[];
  attachments_count?: number | string;
  progress?: number;
  actual_hours?: number;
  [key: string]: unknown;
}

export interface TaskApiData {
  task_id?: number;
  task_title?: string;
  task_description?: string;
  task_status_code?: string;
  task_status_description?: string;
  status_description?: string;
  task_priority_code?: number;
  task_priority_description?: string;
  priority_description?: string;
  task_type_code?: string;
  task_type_name?: string;
  work_mode?: string;
  task_assignee?: string;
  task_assignee_name?: string;
  assignee?: string;
  assignee_name?: string;
  task_reporter?: string;
  task_reporter_name?: string;
  reporter?: string;
  reporter_name?: string;
  task_start_date?: string;
  start_date?: string;
  task_due_date?: string;
  due_date?: string;
  task_estimated_hours?: number;
  estimated_hours?: number;
  task_max_hours?: number;
  max_hours?: number;
  product_code?: string;
  product_name?: string;
  [key: string]: unknown;
}

export interface AttachmentApiData {
  id: number;
  file_name: string;
  file_path: string;
  file_url?: string;
  file_type: string;
  file_size: string;
  purpose: string;
  created_by: string;
  created_at: string;
}

export interface TaskDetailsApiResponse {
  success_flag: boolean;
  message: string;
  status_code: number;
  status_message: string;
  data: TaskDetailsApiData;
}

export interface TaskDetailsApiData {
  task_id?: number;
  task_title?: string;
  task_description?: string;
  description?: string;
  epic_id?: number;
  epic_title?: string;
  product_code?: string;
  product_name?: string;
  task_status_code?: string;
  task_status_description?: string;
  status_description?: string;
  status?: string | { status_code?: string; status_description?: string };
  task_priority_code?: number;
  task_priority_description?: string;
  priority_description?: string;
  priority?: string;
  task_type_code?: string;
  task_type_name?: string;
  task_type_description?: string;
  task_assignee?: string;
  task_assignee_name?: string;
  assignee_name?: string;
  assignee?: string;
  task_reporter?: string;
  task_reporter_name?: string;
  reporter_name?: string;
  reporter?: string;
  task_start_date?: string;
  start_date?: string;
  task_due_date?: string;
  due_date?: string;
  task_closed_on?: string;
  closed_on?: string;
  task_estimated_hours?: number;
  estimated_hours?: number;
  task_actual_hours_worked?: number;
  actual_hours_worked?: number;
  task_max_hours?: number;
  max_hours?: number;
  budget?: {
    estimated_hours?: number;
    actual_hours_worked?: number;
  };
  attachments?: AttachmentApiData[];
  attachments_count?: number | string;
  [key: string]: unknown;
}

