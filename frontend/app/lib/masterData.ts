import { getMasterDataFromCache } from "@/app/lib/api";
import { getStatusTextColor, getStatusDisplayLabel } from "./uiMaps";

// Shapes based on provided API response
export type MasterApiResponse = {
  success: boolean;
  message: string;
  status_code: number;
  status_message: string;
  data: {
    task_statuses: { id: number; status_code: string; status_desc: string; sort_order?: number }[];
    task_types: { id: number; type_code: string; type_name: string; type_description?: string }[];
    priorities: { priority_code: number; priority_desc: string; sort_order?: number }[];
    approval_statuses: { id: number; status_code: string; status_desc: string; sort_order?: number }[];
    products: { product_code: string; product_name: string; version?: string | null; product_desc?: string | null }[];
    employees: { 
      user_code?: string; 
      user_name?: string;
      team_code?: string;
      team_name?: string;
      [key: string]: unknown;
    }[];
    teams?: {
      team_code: string;
      team_name: string;
      team_description?: string;
      team_lead?: string;
      reporter?: string;
      department?: string;
      is_active?: boolean;
      [key: string]: unknown;
    }[];
    companies?: { company_code: string; company_name: string; branch?: string; [key: string]: unknown }[];
    contact_persons?: { contact_person_code?: string; full_name?: string; contact_person_name?: string; company_code?: string; [key: string]: unknown }[];
    work_locations?: { work_location_code: string; work_location_name: string; work_location_description?: string; is_active?: boolean }[];
    activities?: { id: number; activity_title: string; activity_description?: string; [key: string]: unknown }[];
    epics?: { id: number; epic_title: string; [key: string]: unknown }[];
    leave_types?: { leave_type_code: string; leave_type_name: string; leave_type_description?: string; is_active?: boolean }[];
    predefined_epics?: { 
      id: number; 
      predefined_epic_name: string; 
      description?: string;
      epic_title?: string;
      epic_description?: string;
      default_product_code?: string;
      default_company_code?: string;
      default_contact_person_code?: string;
      default_priority_code?: number;
      default_estimated_hours?: number;
      default_max_hours?: number;
      default_is_billable?: boolean;
      default_epic_duration_days?: number;
      is_active?: boolean;
      usage_count?: number;
      [key: string]: unknown;
    }[];
    predefined_tasks?: {
      id: number;
      task_title: string;
      task_description?: string;
      predefined_epic_id?: number;
      default_status_code?: string;
      default_priority_code?: number;
      default_work_mode?: string;
      default_task_type_code?: string;
      estimated_hours?: number;
      max_hours?: number;
      is_billable?: boolean;
      start_date?: string | null;
      due_date?: string | null;
      closed_on?: string | null;
      usage_count?: number;
      [key: string]: unknown;
    }[];
  };
};

export type Option = { value: string; label: string };

function safeData(): MasterApiResponse["data"] | null {
  const cached = getMasterDataFromCache<any>();
  if (cached && typeof cached === "object") {
    // Handle both response structures: { data: {...} } or direct data object
    if ("data" in cached && cached.data && typeof cached.data === "object") {
      return cached.data as MasterApiResponse["data"];
    }
    // If cached is already the data object (legacy format)
    if ("task_types" in cached || "task_statuses" in cached) {
      return cached as MasterApiResponse["data"];
    }
  }
  return null;
}

export function getProductOptions(): Option[] {
  const d = safeData();
  if (!d) return [];
  return d.products.map(p => ({ value: p.product_code, label: p.product_name }));
}

export function getStatusOptions(): Option[] {
  const d = safeData();
  if (!d) return [];
  return [...d.task_statuses]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(s => {
      const raw = (s.status_desc || '').trim();
      const label = getStatusDisplayLabel(raw);
      return { value: s.status_code, label };
    });
}

export function getPriorityOptions(): Option[] {
  const d = safeData();
  if (!d) return [];
  return [...d.priorities]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(p => ({ value: String(p.priority_code), label: p.priority_desc }));
}

export function getTaskTypeOptions(): Option[] {
  const d = safeData();
  if (!d) return [];
  // Check if task_types exists and is an array
  if (!d.task_types || !Array.isArray(d.task_types)) return [];
  return d.task_types
    .filter(t => t && t.type_code && t.type_name) // Filter out invalid entries
    .map(t => ({ value: t.type_code, label: t.type_name }));
}

export function getApprovalOptions(): Option[] {
  const d = safeData();
  if (!d) return [];
  return [...d.approval_statuses]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(a => ({ value: a.status_code, label: a.status_desc }));
}

// Get client/company options from master data
export function getClientOptions(): Option[] {
  const d = safeData();
  if (!d || !d.companies) return [];
  return d.companies
    .filter(c => c?.company_code && c?.company_name)
    .map(c => ({ 
      value: String(c.company_code), 
      label: String(c.company_name)
    }));
}

// Get contact person options from master data, optionally filtered by company_code
export function getContactPersonOptions(companyCode?: string): Option[] {
  const d = safeData();
  if (!d || !d.contact_persons) return [];
  let contacts = d.contact_persons;
  
  // Filter by company_code if provided
  if (companyCode) {
    contacts = contacts.filter(cp => 
      cp?.company_code && String(cp.company_code) === String(companyCode)
    );
  }
  
  return contacts
    .filter(cp => {
      const code = cp?.contact_person_code;
      const name = cp?.full_name || cp?.contact_person_name || cp?.name;
      return code && name;
    })
    .map(cp => {
      const code = String(cp.contact_person_code || '');
      const name = String(cp.full_name || cp.contact_person_name || cp.name || '');
      return { value: code, label: name };
    });
}

// Get work location options from master data
export function getWorkLocationOptions(): Option[] {
  const d = safeData();
  if (!d || !d.work_locations) return [];
  return d.work_locations
    .filter(loc => loc?.is_active !== false && loc?.work_location_code && loc?.work_location_name)
    .map(loc => ({
      value: loc.work_location_code,
      label: loc.work_location_name
    }));
}

// Get epic options from master data
export function getEpicOptions(): Option[] {
  const d = safeData();
  if (!d || !d.epics) return [];
  return d.epics
    .filter(epic => epic?.id && epic?.epic_title)
    .map(epic => ({
      value: String(epic.id),
      label: epic.epic_title
    }));
}

// Get leave type options from master data
export function getLeaveTypeOptions(): Option[] {
  const d = safeData();
  if (!d || !d.leave_types) return [];
  return d.leave_types
    .filter(lt => lt?.is_active !== false && lt?.leave_type_code && lt?.leave_type_name)
    .map(lt => ({
      value: lt.leave_type_code,
      label: lt.leave_type_name
    }));
}

// Get activity options from master data
export function getActivityOptions(): Option[] {
  const d = safeData();
  if (!d || !d.activities) return [];
  return d.activities
    .filter(act => act?.id && act?.activity_title)
    .map(act => ({
      value: String(act.id),
      label: act.activity_title
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Get all employees from master data (for HR and Super Admin)
export function getAllEmployeeOptions(): Option[] {
  const d = safeData();
  if (!d || !d.employees) return [];
  
  return d.employees
    .filter((emp: any) => {
      // Only include employees with valid user_code and user_name
      return emp?.user_code && emp?.user_name;
    })
    .map((emp: any) => ({
      value: emp.user_code,
      label: emp.user_name
    }))
    .sort((a, b) => a.label.localeCompare(b.label)); // Sort alphabetically by name
}

// Get team members filtered by logged-in admin's team
export function getTeamMemberOptions(): Option[] {
  const d = safeData();
  if (!d || !d.employees) return [];
  
  // Get logged-in user's information
  let adminUserCode: string | null = null;
  let adminTeamCode: string | null = null;
  let adminTeamName: string | null = null;
  
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw) as { 
          teamCode?: string; 
          teamName?: string;
          userCode?: string;
        };
        adminUserCode = parsed?.userCode || null;
        adminTeamCode = parsed?.teamCode || null;
        adminTeamName = parsed?.teamName || null;
      }
    } catch {
      // ignore
    }
  }
  
  // If no user code found, return empty array
  if (!adminUserCode) {
    return [];
  }
  
  // First, try to find the admin's own record to get their team_code
  const adminRecord = d.employees.find((emp: any) => 
    emp?.user_code && String(emp.user_code).toLowerCase() === String(adminUserCode).toLowerCase()
  );
  
  // Use team_code from admin's record if available, otherwise use from localStorage
  const targetTeamCode = (adminRecord as any)?.team_code || adminTeamCode;
  const targetTeamName = (adminRecord as any)?.team_name || adminTeamName;
  
  // If no team info found, return empty array
  if (!targetTeamCode && !targetTeamName) {
    return [];
  }
  
  // Filter employees by team_code (preferred) or team_name (fallback), case-insensitive
  // Exclude admins and team leads from the dropdown
  return d.employees
    .filter((emp: any) => {
      if (!emp?.user_code || !emp?.user_name) return false;
      
      // Exclude admins: user_type_code = "E" and designation_name contains "admin"
      const userTypeCode = String(emp.user_type_code || '').trim().toUpperCase();
      const designationName = String(emp.designation_name || '').trim().toLowerCase();
      
      if (userTypeCode === 'E' && designationName.includes('admin')) {
        return false; // Exclude admins
      }
      
      // Exclude super admins: user_type_code = "SA"
      if (userTypeCode === 'SA') {
        return false; // Exclude super admins
      }
      
      // Exclude team leads: check if designation contains "team lead"
      // This is more specific than just "lead" to avoid excluding other roles
      if (designationName.includes('team lead')) {
        return false; // Exclude team leads
      }
      
      // Match by team_code if available (preferred)
      if (targetTeamCode && emp.team_code) {
        return String(emp.team_code).toLowerCase() === String(targetTeamCode).toLowerCase();
      }
      
      // Match by team_name if available (fallback, case-insensitive)
      if (targetTeamName && emp.team_name) {
        return String(emp.team_name).toLowerCase() === String(targetTeamName).toLowerCase();
      }
      
      return false;
    })
    .map((emp: any) => ({
      value: emp.user_code,
      label: emp.user_name
    }))
    .sort((a, b) => a.label.localeCompare(b.label)); // Sort alphabetically by name
}

// Get predefined epic options from master data
export function getPredefinedEpicOptions(): Option[] {
  const d = safeData();
  if (!d || !d.predefined_epics) return [];
  return d.predefined_epics
    .filter(epic => epic?.is_active !== false && epic?.id && (epic?.predefined_epic_name || epic?.title))
    .map(epic => ({
      value: String(epic.id),
      label: String(epic.predefined_epic_name || epic.title || ""),
    } as Option))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Get predefined task options from master data
export function getPredefinedTaskOptions(): Option[] {
  const d = safeData();
  if (!d || !d.predefined_tasks) return [];
  return d.predefined_tasks
    .filter(task => task?.id && task?.task_title)
    .map(task => ({
      value: String(task.id),
      label: task.task_title
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Get full predefined epic data by ID from master data, including associated tasks
export function getPredefinedEpicById(id: string | number): (MasterApiResponse["data"]["predefined_epics"] extends (infer T)[] ? T : never & { tasks: MasterApiResponse["data"]["predefined_tasks"] extends (infer U)[] ? U[] : never }) | null {
  const d = safeData();
  if (!d || !d.predefined_epics) return null;
  const epic = d.predefined_epics.find(e => String(e.id) === String(id));
  if (!epic) return null;
  
  // Get associated tasks
  const tasks = d.predefined_tasks?.filter(t => 
    t.predefined_epic_id && String(t.predefined_epic_id) === String(id)
  ) || [];
  
  return { ...epic, tasks } as any;
}

// Get full predefined task data by ID from master data
export function getPredefinedTaskById(id: string | number): (MasterApiResponse["data"]["predefined_tasks"] extends (infer T)[] ? T : never) | null {
  const d = safeData();
  if (!d || !d.predefined_tasks) return null;
  const task = d.predefined_tasks.find(t => String(t.id) === String(id));
  return (task || null) as any;
}

// Subscribe to master data updates from cache (same tab and cross-tab)
export function onMasterDataChange(handler: () => void) {
  if (typeof window === 'undefined') return () => {};
  const storageHandler = (e: StorageEvent) => {
    if (e.key === 'masterData') handler();
  };
  const customHandler = () => handler();
  window.addEventListener('storage', storageHandler);
  window.addEventListener('masterDataUpdated', customHandler as EventListener);
  return () => {
    window.removeEventListener('storage', storageHandler);
    window.removeEventListener('masterDataUpdated', customHandler as EventListener);
  };
}


