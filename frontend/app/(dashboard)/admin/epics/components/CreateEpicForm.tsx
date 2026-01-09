"use client";

import { Select, Input, InputNumber, DatePicker, Upload, Button, Table, AutoComplete, Tag } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { toast } from "react-hot-toast";
import React, { useEffect, useState, useMemo } from "react";
import { CalendarOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { apiRequest, getMasterDataFromCache } from "@/app/lib/api";
import { getProductOptions, getPriorityOptions, getClientOptions, getContactPersonOptions, getAllEmployeeOptions, getStatusOptions, onMasterDataChange, getWorkLocationOptions, getTaskTypeOptions } from "@/app/lib/masterData";
import SimpleGanttChart from "./SimpleGanttChart";
import { useRouter, usePathname } from "next/navigation";
import { getRoleBase, buildRoleHref } from "@/app/lib/paths";

interface CreateEpicFormProps {
  onCreated?: (epicId?: string | number) => void;
  onCancel?: () => void;
}

interface NewEpicTask {
  id: string;
  title: string;
  description?: string;
  team?: string;
  assignee?: string;
  // Optional dependency: if set, this task starts after the dependency task's due date
  dependsOnTaskId?: string;
  startDate: string;
  dueDate: string;
  priority: string;
  status: string;
  workMode?: string;
  isBillable?: boolean;
  taskType?: string;
}

const labelCls = "block text-xs font-semibold text-gray-700 mb-1.5";
const required = <span className="text-red-500 ml-1">*</span>;

// Helper function to add working days (Monday-Friday), skipping weekends
const addWorkingDays = (startDate: dayjs.Dayjs, workingDays: number): dayjs.Dayjs => {
  let currentDate = startDate.clone();
  let daysAdded = 0;
  const daysToAdd = Math.ceil(workingDays);
  
  // Start date is day 1, so we need to add (workingDays - 1) more days
  while (daysAdded < daysToAdd - 1) {
    currentDate = currentDate.add(1, 'day');
    const dayOfWeek = currentDate.day(); // 0 = Sunday, 6 = Saturday
    // Only count Monday-Friday (1-5) as working days
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }
  
  // If the final date falls on a weekend, move to next Monday
  const finalDayOfWeek = currentDate.day();
  if (finalDayOfWeek === 0) { // Sunday
    currentDate = currentDate.add(1, 'day'); // Move to Monday
  } else if (finalDayOfWeek === 6) { // Saturday
    currentDate = currentDate.add(2, 'day'); // Move to Monday
  }
  
  return currentDate;
};

// Helper: get the next working day (Mon–Fri) after a given date
const getNextWorkingDay = (date: dayjs.Dayjs): dayjs.Dayjs => {
  let currentDate = date.add(1, "day");
  const dayOfWeek = currentDate.day();
  if (dayOfWeek === 0) {
    // Sunday -> Monday
    currentDate = currentDate.add(1, "day");
  } else if (dayOfWeek === 6) {
    // Saturday -> Monday
    currentDate = currentDate.add(2, "day");
  }
  return currentDate;
};

export default function CreateEpicForm({ onCreated, onCancel }: CreateEpicFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const roleBase = getRoleBase(pathname || '');
  
  const [epicTitle, setEpicTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(null);
  const [dueDate, setDueDate] = useState<dayjs.Dayjs | null>(null);
  const [product, setProduct] = useState<string>("");
  const [client, setClient] = useState<string>("");
  const [contactPerson, setContactPerson] = useState<string>("");
  const [estimatedHours, setEstimatedHours] = useState<number | null>(null);
  const [isBillable, setIsBillable] = useState<boolean>(false);
  
  // Calculate estimated days from estimated hours (8 hours = 1 working day)
  const estimatedDays = useMemo(() => {
    if (estimatedHours == null || estimatedHours <= 0) return null;
    return Math.ceil(estimatedHours / 8 * 100) / 100; // Round to 2 decimal places
  }, [estimatedHours]);
  
  // Auto-calculate due date from start date and estimated days (working days only)
  useEffect(() => {
    if (startDate && estimatedDays != null && estimatedDays > 0) {
      const calculatedDueDate = addWorkingDays(startDate, estimatedDays);
      setDueDate(calculatedDueDate);
    }
  }, [startDate, estimatedDays]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadList, setUploadList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [reporterName, setReporterName] = useState<string>("");

  // Tasks & timeline state
  const [tasks, setTasks] = useState<NewEpicTask[]>([]);
  const [teamOptions, setTeamOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [employeeOptions, setEmployeeOptions] = useState(getAllEmployeeOptions());
  const [statusOptions, setStatusOptions] = useState(getStatusOptions());
  const [taskTypeOptions, setTaskTypeOptions] = useState(getTaskTypeOptions());
  const [taskTitleOptions, setTaskTitleOptions] = useState<Array<{ value: string }>>([]);
  const [predefinedTitleToTeam, setPredefinedTitleToTeam] = useState<Record<string, string>>({});
  const [predefinedTitleToTaskType, setPredefinedTitleToTaskType] = useState<Record<string, string>>({});
  const [predefinedTitleToEstimatedDays, setPredefinedTitleToEstimatedDays] = useState<Record<string, number>>({});
  const [workLocationOptions, setWorkLocationOptions] = useState(getWorkLocationOptions());
  
  // Validation errors state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleNumberKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    const allowed = ["Backspace", "Tab", "Delete", "ArrowLeft", "ArrowRight", "Home", "End"]; 
    const isNumber = /[0-9]/.test(e.key);
    const isDot = e.key === "."; 
    if (allowed.includes(e.key)) return; 
    if (isNumber) return; 
    if (isDot) {
      const input = e.currentTarget as HTMLInputElement; 
      if (input.value.includes(".")) {
        e.preventDefault();
      }
      return; 
    } 
    e.preventDefault();
  };

  useEffect(() => {
    const loadReporterName = async () => {
      try {
        const { getUserFromStorage } = await import("../../../../lib/auth/storage");
        const user = getUserFromStorage();
        if (user?.userName) setReporterName(user.userName);
      } catch {}
    };
    loadReporterName();
  }, []);

  const [productOptions, setProductOptions] = useState(getProductOptions());
  const [priorityOptions, setPriorityOptions] = useState(getPriorityOptions());
  const [clientOptions, setClientOptions] = useState(getClientOptions());
  const [contactPersonOptions, setContactPersonOptions] = useState(getContactPersonOptions());

  // Update options when master data changes
  useEffect(() => {
    const update = () => {
      setProductOptions(getProductOptions());
      setPriorityOptions(getPriorityOptions());
      setClientOptions(getClientOptions());
      // Update contact person options based on selected client
      const newContactOptions = getContactPersonOptions(client || undefined);
      setContactPersonOptions(newContactOptions);

      // Update team options
      const md = getMasterDataFromCache<any>();
      // Handle both nested (md.data.employees) and direct (md.employees) structures
      const employees = md?.data?.employees || md?.employees || [];
      const teams = new Set<string>();
      employees.forEach((emp: any) => {
        if (emp?.team_name) {
          teams.add(emp.team_name);
        }
      });
      const teamList = Array.from(teams).map(team => ({ value: team, label: team })).sort((a, b) => a.label.localeCompare(b.label));
      setTeamOptions(teamList);

      // Update employee, status, task type, and work location options
      setEmployeeOptions(getAllEmployeeOptions());
      setStatusOptions(getStatusOptions());
      // Always update task type options (even if empty, to trigger re-render)
      const taskTypeOpts = getTaskTypeOptions();
      setTaskTypeOptions(taskTypeOpts);
      setWorkLocationOptions(getWorkLocationOptions());
      
      // Clear contact person when client changes or if current selection is invalid
      if (client) {
        setContactPerson((prev) => {
          const isValid = newContactOptions.some(cp => cp.value === prev);
          return isValid ? prev : "";
        });
      } else {
        setContactPerson("");
      }
    };
    const unsub = onMasterDataChange(update);
    update();
    // Retry once after a short delay to catch cases where master data loads just after mount
    const timeout = setTimeout(update, 1000);
    return () => {
      unsub();
      clearTimeout(timeout);
    };
  }, [client]);

  // Get employees filtered by team name
  const getEmployeesByTeam = (teamName: string | undefined): Array<{ value: string; label: string }> => {
    if (!teamName || !teamName.trim()) {
      // If no team selected, return all employees
      return employeeOptions;
    }
    
    try {
      const md = getMasterDataFromCache<any>();
      const employees = md?.data?.employees || [];
      
      // Filter employees by team name (case-insensitive)
      const teamEmployees = employees
        .filter((emp: any) => {
          const empTeamName = emp?.team_name || '';
          return empTeamName.toLowerCase().trim() === teamName.toLowerCase().trim();
        })
        .map((emp: any) => ({
          value: emp.user_code || emp.userCode || '',
          label: emp.user_name || emp.userName || emp.user_code || emp.userCode || '',
        }))
        .filter((opt: any) => opt.value && opt.label) // Remove empty entries
        .sort((a: any, b: any) => a.label.localeCompare(b.label));
      
      return teamEmployees.length > 0 ? teamEmployees : employeeOptions;
    } catch {
      // Fallback to all employees if master data is not available
      return employeeOptions;
    }
  };

  // Keep task start dates in sync with epic start date
  // Helper: recompute task start/due dates based on dependencies, epic start date, and template estimated days
  const recomputeTaskDates = (inputTasks: NewEpicTask[]): NewEpicTask[] => {
    if (!startDate && !inputTasks.some(t => t.dependsOnTaskId)) {
      return inputTasks;
    }

    const byId = new Map<string, NewEpicTask>();
    inputTasks.forEach((t) => byId.set(t.id, t));

    return inputTasks.map((task) => {
      let baseStart: dayjs.Dayjs | null = null;

      if (task.dependsOnTaskId) {
        const dep = byId.get(task.dependsOnTaskId);
        if (dep?.dueDate) {
          const depDue = dayjs(dep.dueDate, "YYYY-MM-DD");
          if (depDue.isValid()) {
            baseStart = getNextWorkingDay(depDue);
          }
        }
      }

      if (!baseStart && startDate) {
        baseStart = startDate;
      }

      if (!baseStart) {
        return task;
      }

      const startStr = baseStart.format("YYYY-MM-DD");

      // Prefer estimated_days from predefined task template (if available)
      const titleKey = (task.title || "").trim();
      const estimatedDaysForTitle =
        titleKey && predefinedTitleToEstimatedDays[titleKey]
          ? predefinedTitleToEstimatedDays[titleKey]
          : undefined;

      let due: dayjs.Dayjs | null = null;

      if (estimatedDaysForTitle && estimatedDaysForTitle > 0) {
        // Use working days helper to skip weekends, same as epic estimated days
        due = addWorkingDays(baseStart, estimatedDaysForTitle);
      } else {
        // If no template days, respect existing due date when valid, otherwise default to +7 days
        const existingDue = task.dueDate ? dayjs(task.dueDate, "YYYY-MM-DD") : null;
        if (existingDue && existingDue.isValid() && !existingDue.isBefore(baseStart, "day")) {
          due = existingDue;
        } else {
          due = baseStart.add(7, "day");
        }
      }

        return {
        ...task,
        startDate: startStr,
        dueDate: due.format("YYYY-MM-DD"),
      };
    });
  };

  // Recompute task dates when epic start date changes
  useEffect(() => {
    setTasks((prev) => recomputeTaskDates(prev));
  }, [startDate]);

  // Load predefined task titles for title dropdown
  useEffect(() => {
    try {
      const d = getMasterDataFromCache<any>();
      const masterTasks = d?.data?.predefined_tasks || [];

      const titleTeamPairs: Array<{ title: string; teamName: string }> = masterTasks
        .map((t: any) => ({
          title: String(t.task_title || "").trim(),
          teamName: String(t.team_name || "").trim(),
        }))
        .filter((pair: { title: string; teamName: string }) => pair.title.length > 0);

      const uniqueTitles = Array.from(
        new Set<string>(titleTeamPairs.map((pair: { title: string }) => pair.title))
      );
      setTaskTitleOptions(uniqueTitles.map((title: string) => ({ value: title })));

      const titleToTeam: Record<string, string> = {};
      const titleToTaskType: Record<string, string> = {};
      const titleToEstimatedDays: Record<string, number> = {};
      
      masterTasks.forEach((t: any) => {
        const title = String(t.task_title || "").trim();
        if (title) {
          // Map title to team
          if (t.team_name && !titleToTeam[title]) {
            titleToTeam[title] = String(t.team_name).trim();
          }
          // Map title to task type code
          if (t.task_type_code && !titleToTaskType[title]) {
            titleToTaskType[title] = String(t.task_type_code).trim();
          }
          // Map title to estimated_days from predefined task (used for auto due date)
          if (typeof t.estimated_days === "number" && !Number.isNaN(t.estimated_days)) {
            if (!titleToEstimatedDays[title]) {
              titleToEstimatedDays[title] = t.estimated_days;
            }
          }
        }
      });
      
      setPredefinedTitleToTeam(titleToTeam);
      setPredefinedTitleToTaskType(titleToTaskType);
      setPredefinedTitleToEstimatedDays(titleToEstimatedDays);
    } catch {
      // ignore if master data not ready
    }
  }, []);

  // Load any draft tasks that were created on the task-template pages
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storageKey = "epicDraftTasks";
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Array<Partial<NewEpicTask>>;
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      const mapped: NewEpicTask[] = parsed.map((t, index) => ({
        id: t.id || `task-from-template-${Date.now()}-${index}`,
        title: t.title || "",
        description: t.description || "",
        team: t.team || "",
        assignee: t.assignee || "",
        startDate: t.startDate || dayjs().format("YYYY-MM-DD"),
        dueDate:
          t.dueDate ||
          dayjs(t.startDate || new Date())
            .add(1, "day")
            .format("YYYY-MM-DD"),
        priority: t.priority || (priorityOptions[0]?.value as string) || "",
        status: "To Do",
        estimatedHours: 0, // Removed from UI, default to 0
      }));

      setTasks((prev) => [...prev, ...mapped]);
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore parsing errors – they should not break epic creation
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Validation functions
  // isForTemplate: if true, only validate fields required for templates (predefined_epics table)
  // if false, validate all fields required for actual epics (epics table)
  const validateField = (field: string, value: any, isForTemplate: boolean = false): string => {
    switch (field) {
      case 'epicTitle':
        if (!value || !value.trim()) return 'Epic title is required';
        if (value.trim().length < 3) return 'Epic title must be at least 3 characters';
        if (value.trim().length > 200) return 'Epic title must be less than 200 characters';
        return '';
      case 'description':
        // Description is optional for templates, required for actual epics
        if (!isForTemplate) {
          if (!value || !value.trim()) return 'Description is required';
          if (value.trim().length < 10) return 'Description must be at least 10 characters';
          if (value.trim().length > 2000) return 'Description must be less than 2000 characters';
        } else {
          // For templates, only validate length if provided
          if (value && value.trim()) {
            if (value.trim().length < 10) return 'Description must be at least 10 characters';
            if (value.trim().length > 2000) return 'Description must be less than 2000 characters';
          }
        }
        return '';
      case 'priority':
        if (!value) return 'Priority is required';
        return '';
      case 'product':
        // Product is only required for actual epics, not for templates
        if (!isForTemplate && !value) return 'Product is required';
        return '';
      case 'client':
        // Client is only required for actual epics, not for templates
        if (!isForTemplate && !value) return 'Client is required';
        return '';
      case 'contactPerson':
        // Contact person is optional for both templates and epics
        return '';
      case 'startDate':
        // Start date is only required for actual epics, not for templates
        if (!isForTemplate) {
          if (!value) return 'Start date is required';
          if (value.startOf('day').isBefore(dayjs().startOf('day'))) {
            return 'Start date cannot be before today';
          }
          if (dueDate && value.startOf('day').isAfter(dueDate.startOf('day'))) {
            return 'Start date cannot be after due date';
          }
        }
        return '';
      case 'dueDate':
        // Due date is only required for actual epics, not for templates
        if (!isForTemplate) {
          if (!value) return 'Due date is required';
          if (value.startOf('day').isBefore(dayjs().startOf('day'))) {
            return 'Due date cannot be before today';
          }
          if (startDate && value.startOf('day').isBefore(startDate.startOf('day'))) {
            return 'Due date cannot be before start date';
          }
        }
        return '';
      case 'estimatedHours':
        if (value == null || value === '') return 'Estimated hours is required';
        if (value <= 0) return 'Estimated hours must be greater than 0';
        if (value > 10000) return 'Estimated hours must be less than 10000';
        return '';
      default:
        return '';
    }
  };

  const handleFieldChange = (field: string, value: any, setter: (val: any) => void) => {
    setter(value);
    if (touched[field]) {
      // When user is typing, validate as if creating epic (not template)
      // This ensures real-time validation shows what's needed for epic creation
      const error = validateField(field, value, false);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
    // Also validate related fields (only for epic creation, not templates)
    if (field === 'startDate' && touched['dueDate']) {
      const error = validateField('dueDate', dueDate, false);
      setErrors(prev => ({ ...prev, dueDate: error }));
    }
    if (field === 'dueDate' && touched['startDate']) {
      const error = validateField('startDate', startDate, false);
      setErrors(prev => ({ ...prev, startDate: error }));
    }
    if (field === 'client') {
      // Clear contact person when client changes
      setContactPerson("");
      setErrors(prev => ({ ...prev, contactPerson: '' }));
    }
  };

  const handleFieldBlur = (field: string, value: any) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    // For optional fields (product, client, startDate, dueDate), don't validate on blur
    // They are only required when actually creating an epic, not when saving as template
    // Only validate required fields (epicTitle, priority, estimatedHours) on blur
    const fieldsToValidateOnBlur = ['epicTitle', 'description', 'priority', 'estimatedHours'];
    if (fieldsToValidateOnBlur.includes(field)) {
      // Validate as if creating epic (not template) for these core fields
      const error = validateField(field, value, false);
      setErrors(prev => ({ ...prev, [field]: error }));
    } else {
      // For optional fields, clear any existing errors on blur if field is empty
      // This prevents showing "required" errors for fields that are optional for templates
      if (!value) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    }
  };

  const validateAllFields = (isForTemplate: boolean = false): boolean => {
    const newErrors: Record<string, string> = {};
    const fieldsToValidate = [
      { field: 'epicTitle', value: epicTitle },
      { field: 'description', value: description },
      { field: 'priority', value: priority },
      { field: 'product', value: product },
      { field: 'client', value: client },
      { field: 'contactPerson', value: contactPerson },
      { field: 'startDate', value: startDate },
      { field: 'dueDate', value: dueDate },
      { field: 'estimatedHours', value: estimatedHours },
    ];

    fieldsToValidate.forEach(({ field, value }) => {
      const error = validateField(field, value, isForTemplate);
      if (error) {
        newErrors[field] = error;
      }
    });

    setErrors(newErrors);
    setTouched({
      epicTitle: true,
      description: true,
      priority: true,
      product: true,
      client: true,
      contactPerson: true,
      startDate: true,
      dueDate: true,
      estimatedHours: true,
    });

    return Object.keys(newErrors).length === 0;
  };

  const handleAddTask = () => {
    const epicStart = startDate || dayjs();

    // No default dependency - user can set it manually if needed
    const dependsOnTaskId = undefined;

    // Calculate start date: use epic start date (or today as fallback)
    const newStartDate = epicStart;
    
    // Default due date: 7 days from start date
    const newDueDate = newStartDate.add(7, "day");
    
    const newTask: NewEpicTask = {
      id: `task-${Date.now()}`,
      title: "",
      description: "",
      team: "",
      assignee: "",
      dependsOnTaskId,
      startDate: newStartDate.format("YYYY-MM-DD"),
      dueDate: newDueDate.format("YYYY-MM-DD"),
      priority: priority || (priorityOptions[0]?.value as string) || "",
      status: "To Do",
      workMode: "OFFICE",
      isBillable: true,
    };

    setTasks(prev => [...prev, newTask]);
  };

  const handleTaskFieldChange = (taskId: string, field: keyof NewEpicTask, value: any) => {
    setTasks(prev => {
      // First update the specific field
      let updatedTasks = prev.map(t => (t.id === taskId ? { ...t, [field]: value } : t));
                
      // Recompute all task dates based on dependencies and epic start
      updatedTasks = recomputeTaskDates(updatedTasks);
      
      return updatedTasks;
    });
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };
  const handleTaskTitleChange = (taskId: string, value: string) => {
    // Always update the title with the typed/selected value
    handleTaskFieldChange(taskId, "title", value);

    // If the title exactly matches a predefined task, auto-fill the team and task type
    const trimmed = value.trim();
    if (trimmed) {
      if (predefinedTitleToTeam[trimmed]) {
      handleTaskFieldChange(taskId, "team", predefinedTitleToTeam[trimmed]);
      }
      if (predefinedTitleToTaskType[trimmed]) {
        handleTaskFieldChange(taskId, "taskType", predefinedTitleToTaskType[trimmed]);
      }
    }
  };


  const handleCreate = async () => {
    // ============================================
    // API: create_epic
    // Purpose: Create an actual epic (not a template)
    // ============================================
    
    // Validate all fields (isForTemplate = false, so all epic fields are required)
    if (!validateAllFields(false)) {
      toast.error('Please fix all validation errors before submitting');
      return;
    }

    // Additional validation: Estimated hours must be > 0
    if (!estimatedHours || estimatedHours <= 0) {
      toast.error('Estimated hours is required and must be greater than 0');
      setErrors(prev => ({ ...prev, estimatedHours: 'Estimated hours must be greater than 0' }));
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      
      // Required fields for create_epic API
      form.append("epic_title", epicTitle);
      form.append("epic_description", description);
      form.append("product_code", product); // Required for actual epic
      form.append("priority_code", String(priority));
      form.append("start_date", dayjs(startDate).format("DD-MM-YYYY")); // Required for actual epic
      form.append("due_date", dayjs(dueDate).format("DD-MM-YYYY")); // Required for actual epic
      form.append("estimated_hours", String(estimatedHours));
      if (estimatedDays != null) {
        form.append("estimated_days", String(estimatedDays));
      }
      form.append("is_billable", String(isBillable));
      form.append("company_code", client); // Required for actual epic
      form.append("contact_person_code", contactPerson);
      
      // Optional fields for create_epic API
      if (files.length) {
        for (const f of files) {
          form.append("attachments", f);
        }
      }
      try {
        const { getUserFromStorage } = await import("../../../../lib/auth/storage");
        const user = getUserFromStorage();
        if (user?.userCode) form.append("reporter", String(user.userCode).trim().toUpperCase());
      } catch {}

      const response = await apiRequest<any>("create_epic", "POST", form);
      
      // Get epic ID from response - check multiple possible response structures
      const epicId = response?.Response_Data?.id || 
                     response?.data?.id || 
                     response?.Response_Data?.epic_id ||
                     response?.data?.epic_id || 
                     response?.epic_id || 
                     response?.id;
      
      if (!epicId) {
        throw new Error("Epic created but no ID returned from server");
      }
      
      // Create tasks if any exist
      if (tasks && tasks.length > 0) {
        let successCount = 0;
        let errorCount = 0;
        const createdTaskIdMap: Record<string, number> = {};
        
        for (const task of tasks) {
          try {
            const taskForm = new FormData();
            
            // Required fields for create_task API
            taskForm.append("task_title", task.title || "");
            taskForm.append("task_desc", task.description || "");
            taskForm.append("epic_code", String(epicId));
            taskForm.append("priority_code", String(task.priority || priority || 2));

            // Estimated hours/days: derive from task start & due date so they are always > 0
            let taskEstimatedDays = 1;
            let taskEstimatedHours = 8;
            const taskStart = task.startDate ? dayjs(task.startDate, "YYYY-MM-DD") : null;
            const taskDue = task.dueDate ? dayjs(task.dueDate, "YYYY-MM-DD") : null;
            if (taskStart && taskDue && (taskDue.isAfter(taskStart, "day") || taskDue.isSame(taskStart, "day"))) {
              let workingDays = 0;
              let current = taskStart.clone();
              while (current.isBefore(taskDue, "day") || current.isSame(taskDue, "day")) {
                const dow = current.day();
                if (dow !== 0 && dow !== 6) {
                  workingDays += 1;
                }
                current = current.add(1, "day");
              }
              if (workingDays > 0) {
                taskEstimatedDays = workingDays;
                taskEstimatedHours = workingDays * 8;
              }
            }
            taskForm.append("estimated_hours", String(taskEstimatedHours));
            taskForm.append("estimated_days", String(taskEstimatedDays));
            
            // Optional fields
            if (task.team) {
              // Convert team name to team code from master data
              try {
                const md = getMasterDataFromCache<any>();
                const masterTeams = md?.data?.teams || [];
                const teamMatch = masterTeams.find((t: any) => 
                  String(t.team_name || '').trim() === String(task.team).trim() || 
                  String(t.team_code || '').trim() === String(task.team).trim()
                );
                if (teamMatch?.team_code) {
                  taskForm.append("assigned_team_code", String(teamMatch.team_code));
                } else {
                  // If team not found in master data, send as-is (might be team code)
                  taskForm.append("assigned_team_code", String(task.team));
                }
              } catch {
                // If master data not available, send as-is
                taskForm.append("assigned_team_code", String(task.team));
              }
            }
            if (task.assignee) {
              taskForm.append("assignee", task.assignee.trim().toUpperCase());
            }
            if (task.startDate) {
              taskForm.append("start_date", dayjs(task.startDate).format("DD-MM-YYYY"));
            }
            if (task.dueDate) {
              taskForm.append("due_date", dayjs(task.dueDate).format("DD-MM-YYYY"));
            }
            if (task.workMode) {
              taskForm.append("work_mode", task.workMode);
            }
            // Task type is required
            if (!task.taskType || !task.taskType.trim()) {
              toast.error(`Task type is required for task "${task.title || 'Untitled'}"`);
              throw new Error(`Task type is required for task "${task.title || 'Untitled'}"`);
            }
            taskForm.append("task_type_code", task.taskType.trim());
            
            // Set default status
            taskForm.append("status_code", "STS001");

            // Task dependencies: if this task has dependsOnTaskId and that
            // dependency has already been created, pass its database ID.
            const dependsOnId = task.dependsOnTaskId && createdTaskIdMap[task.dependsOnTaskId];
            if (dependsOnId) {
              taskForm.append("depends_on_task_ids", String(dependsOnId));
            } else {
              taskForm.append("depends_on_task_ids", "");
            }
            
            // Add reporter if available
            try {
              const { getUserFromStorage } = await import("../../../../lib/auth/storage");
              const user = getUserFromStorage();
              if (user?.userCode) {
                taskForm.append("reporter", String(user.userCode).trim().toUpperCase());
              }
            } catch {}
            
            const taskResp = await apiRequest<any>("create_task", "POST", taskForm);
            const createdTaskId =
              taskResp?.Response_Data?.id ??
              taskResp?.data?.id ??
              taskResp?.id;
            if (createdTaskId) {
              createdTaskIdMap[task.id] = Number(createdTaskId);
            }
            successCount++;
          } catch (taskError: any) {
            console.error(`Failed to create task "${task.title}":`, taskError);
            errorCount++;
          }
        }
        
        if (errorCount > 0) {
          toast(`Epic created successfully. ${successCount} task(s) created, ${errorCount} task(s) failed.`, {
            icon: '⚠️',
            duration: 5000,
          });
        } else {
          toast.success(`Epic and ${successCount} task(s) created successfully`);
        }
      } else {
        toast.success("Epic created successfully");
      }
      
      // Reset form
      setEpicTitle("");
      setDescription("");
      setPriority("");
      setStartDate(null);
      setDueDate(null);
      setProduct("");
      setClient("");
      setContactPerson("");
      setEstimatedHours(null);
      setIsBillable(false);
      setFiles([]);
      setUploadList([]);
      setTasks([]); // Clear tasks
      
      // Notify parent with epic ID - let parent handle redirect
      if (onCreated) {
        onCreated(epicId);
      } else {
        // If no onCreated callback, handle redirect ourselves
        if (epicId) {
          router.push(buildRoleHref(roleBase, `/epics?expandedEpic=${epicId}`));
        } else {
          router.push(buildRoleHref(roleBase, `/epics`));
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to create epic";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    // ============================================
    // API: save_template
    // Purpose: Save as a template (predefined_epics table)
    // Only validate fields that are NOT NULL in predefined_epics table:
    // - title (NOT NULL)
    // - priority_code (NOT NULL)
    // - estimated_hours (NOT NULL)
    // Optional fields (nullable): description, contact_person_code
    // Fields NOT in predefined_epics: product, client, start_date, due_date, reporter
    // ============================================
    
    // Clear validation errors for fields not required for templates
    // This prevents showing errors for product, client, contactPerson, startDate, dueDate
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.product;
      delete newErrors.client;
      delete newErrors.contactPerson;
      delete newErrors.startDate;
      delete newErrors.dueDate;
      return newErrors;
    });
    
    // Validate required fields for template (only NOT NULL fields)
    if (!epicTitle || !epicTitle.trim()) {
      toast.error("Epic title is required");
      return;
    }
    if (!priority) {
      toast.error("Priority is required");
      return;
    }
    
    // For template, estimated hours can come from epic or tasks
    // Calculate total from tasks if epic hours is 0 or not set
    // For template, estimated hours comes from epic only (tasks no longer have estimated hours)
    const finalEstimatedHours = estimatedHours && estimatedHours > 0 ? estimatedHours : 0;
    
    if (!finalEstimatedHours || finalEstimatedHours <= 0) {
      toast.error("Estimated hours is required and must be greater than 0. Please set estimated hours for the epic or for at least one task.");
      return;
    }
    
    
    // Validate tasks - only check fields that are NOT NULL in predefined_tasks table:
    // - task_title (NOT NULL)
    // - priority_code (NOT NULL)
    // - work_mode (can be NULL, but we require it for consistency)
    // - estimated_hours (NOT NULL, must be > 0 in backend)
    // Optional fields: task_description, team_code, is_billable
    // Fields NOT in predefined_tasks: start_date, due_date, assignee, product_code, task_type_code

    setLoading(true);
    try {
      const form = new FormData();
      
      // Template type
      form.append('template_type', 'EPIC');
      
      // Epic template fields - ONLY fields that exist in predefined_epics table:
      // title, description, contact_person_code, priority_code, estimated_hours, is_billable, is_active
      form.append('epic_title', epicTitle.trim());
      if (description && description.trim()) {
        form.append('epic_description', description.trim());
      }
      if (contactPerson && contactPerson.trim()) {
        form.append('contact_person_code', contactPerson.trim());
      }
      form.append('priority_code', String(priority));
      // Use calculated final values
      form.append('estimated_hours', String(finalEstimatedHours));
      // Calculate estimated_days from estimated_hours (divide by 8)
      const estimatedDays = finalEstimatedHours > 0 ? finalEstimatedHours / 8 : 0;
      form.append('estimated_days', String(estimatedDays));
      form.append('is_billable', String(isBillable));
      form.append('is_active', 'true');
      
      // NOTE: We do NOT send the following fields as they don't exist in predefined_epics:
      // - product_code (not in predefined_epics - set when creating actual epic)
      // - company_code/client (not in predefined_epics - set when creating actual epic)
      // - start_date (not in predefined_epics - set when creating actual epic)
      // - due_date (not in predefined_epics - set when creating actual epic)
      // - reporter (not in predefined_epics - set when creating actual epic)
      // - attachments (not in predefined_epics - attached to actual epic, not template)
      
      // Build tasks array for template - all tasks in CreateEpicForm are new tasks
      // These will be saved to predefined_tasks table
      const tasksArray: any[] = [];
      const md = getMasterDataFromCache<any>();
      const employees = md?.data?.employees || [];
      
      // Helper to get team_code from team name
      const getTeamCodeFromName = (teamName: string): string | null => {
        if (!teamName) return null;
        const emp = employees.find((e: any) => 
          e.team_name && e.team_name.toLowerCase() === teamName.toLowerCase()
        );
        return emp?.team_code || null;
      };
      
      // Compute a reasonable default estimated_hours per task when saving template
      // Backend requires estimated_hours > 0 but we don't collect it per-task in the UI,
      // so we derive a per-task value by distributing epic estimated hours.
      const taskCount = tasks.length || 1;
      const perTaskEstimatedHours =
        finalEstimatedHours && finalEstimatedHours > 0
          ? Math.max(1, Math.round(finalEstimatedHours / taskCount))
          : 8; // default to 1 day (8h) if epic hours are not set
      
      // Process each task for the template
      for (const task of tasks) {
        // Validate required fields (only NOT NULL fields in predefined_tasks table)
        if (!task.title || !task.title.trim()) {
          toast.error(`Task title is required for all tasks.`);
          setLoading(false);
          return;
        }
        
        // priority_code is NOT NULL in predefined_tasks
        const taskPriority = Number(task.priority);
        if (!taskPriority || taskPriority <= 0) {
          toast.error(`Priority is required for task "${task.title}".`);
          setLoading(false);
          return;
        }
        
        // work_mode can be NULL in predefined_tasks, but we'll require it for consistency
        const taskWorkMode = (task.workMode || 'OFFICE').toUpperCase();
        if (!['REMOTE', 'ON_SITE', 'OFFICE'].includes(taskWorkMode)) {
          toast.error(`Invalid work mode for task "${task.title}". Must be REMOTE, ON_SITE, or OFFICE.`);
          setLoading(false);
          return;
        }
        
        // estimated_hours is NOT NULL (can be 0)
        // Task fields - ONLY fields that exist in predefined_tasks table:
        // Required (NOT NULL): task_title, priority_code, estimated_hours, status_code (has default)
        // Optional (nullable): task_description, work_mode, team_code, is_billable (has default)
        // NOTE: start_date and due_date do NOT exist in predefined_tasks table (removed)
        // NOTE: max_hours removed - using estimated_hours only
        // We no longer collect estimated_hours per-task in the UI, but backend requires it.
        // Use the distributed perTaskEstimatedHours so each task has a positive estimate.
        const taskEstimatedHours = perTaskEstimatedHours;
        const taskEstimatedDays = Math.max(1, Math.ceil(taskEstimatedHours / 8)); // At least 1 working day
        
        const taskObj: any = {
          task_title: task.title.trim(),
          priority_code: taskPriority,
          work_mode: taskWorkMode,
          status_code: 'STS001', // Default status: Not Yet Started (NOT NULL with default)
          estimated_hours: taskEstimatedHours,
          estimated_days: taskEstimatedDays,
        };
        
        // Add optional fields if available (these are nullable in predefined_tasks table)
        if (task.description && task.description.trim()) {
          taskObj.task_description = task.description.trim();
        }
        // NOTE: start_date and due_date are NOT in predefined_tasks table, so we don't send them
        if (task.team) {
          const teamCode = getTeamCodeFromName(task.team);
          if (teamCode) {
            taskObj.team_code = teamCode;
          }
        }
        if (task.isBillable !== undefined) {
          taskObj.is_billable = task.isBillable;
        }
        
        // NOTE: We do NOT send the following fields as they don't exist in predefined_tasks:
        // - start_date (removed from predefined_tasks table)
        // - due_date (removed from predefined_tasks table)
        // - assignee (not in predefined_tasks - assignment happens when creating actual tasks)
        // - product_code (not in predefined_tasks)
        // - task_type_code (not in predefined_tasks)
        
        tasksArray.push(taskObj);
      }
      
      // Add tasks as JSON string (will be saved to predefined_tasks table)
      if (tasksArray.length > 0) {
        form.append('tasks', JSON.stringify(tasksArray));
      }
      
      // Call save_template API (NOT create_epic)
      const response = await apiRequest<any>('save_template', 'POST', form);
      
      // Check for success - API returns { success: True, message: "...", data: {...} }
      if (response?.success === true || response?.success_flag === true || response?.Status_Flag === true) {
        const successMessage = response?.message || response?.Status_Description || 'Epic template saved successfully';
        toast.success(successMessage);
        // Stay on the same page after saving template (no redirect)
      } else {
        const errorMsg = response?.message || response?.Status_Description || response?.error || response?.detail || 'Failed to save template';
        toast.error(errorMsg);
      }
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : "Failed to save epic template";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Simple custom toggle switch
  const ToggleSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`}
        />
      </button>
    );
  };

  return (
    <div className="text-sm">
      {/* Basic Information Section */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 pb-1.5 border-b border-gray-200">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
          {/* Epic Title */}
          <div className="md:col-span-2">
            <label className={labelCls}>Epic Title{required}</label>
            <Input
              placeholder="Enter epic title"
              size="middle"
              value={epicTitle}
              onChange={(e) => handleFieldChange('epicTitle', e.target.value, setEpicTitle)}
              onBlur={() => handleFieldBlur('epicTitle', epicTitle)}
              status={errors.epicTitle ? 'error' : ''}
              className="rounded-md"
            />
            {errors.epicTitle && (
              <div className="text-xs text-red-600 mt-1">{errors.epicTitle}</div>
            )}
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className={labelCls}>Description</label>
            <Input.TextArea
              placeholder="Enter a detailed description of the epic"
              rows={3}
              className="text-sm rounded-md"
              value={description}
              onChange={(e) => handleFieldChange('description', e.target.value, setDescription)}
              onBlur={() => handleFieldBlur('description', description)}
              status={errors.description ? 'error' : ''}
            />
            {errors.description && (
              <div className="text-xs text-red-600 mt-1">{errors.description}</div>
            )}
          </div>
        </div>
      </div>

      {/* Time & Resources Section */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 pb-1.5 border-b border-gray-200">Time & Resources</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">

          {/* Estimated Hours */}
          <div>
            <label className={labelCls}>Estimated Hours{required}</label>
            <div className={errors.estimatedHours ? 'estimated-hours-error' : ''}>
              <InputNumber
                size="middle"
                min={0.5}
                step={0.5}
                className="w-full rounded-md"
                value={estimatedHours ?? undefined}
                status={errors.estimatedHours ? 'error' : ''}
              onChange={(v) => {
                const n = Number(v);
                const value = Number.isFinite(n) ? n : null;
                handleFieldChange('estimatedHours', value, setEstimatedHours);
              }}
              onBlur={() => handleFieldBlur('estimatedHours', estimatedHours)}
              onKeyDown={handleNumberKeyDown}
              />
            </div>
            {errors.estimatedHours && (
              <div className="text-xs text-red-600 mt-1">{errors.estimatedHours}</div>
            )}
          </div>

          {/* Estimated Days (calculated from estimated hours) */}
          <div>
            <label className={labelCls}>Estimated Days</label>
            <InputNumber
              placeholder="0"
              size="middle"
              className="w-full rounded-md"
              addonAfter={<CalendarOutlined className="text-gray-400" />}
              value={estimatedDays ?? undefined}
              precision={2}
              disabled
              style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
            />
            <div className="text-xs text-gray-500 mt-1">
              {estimatedDays != null 
                ? `Based on ${estimatedHours} hours (8 hours = 1 working day)`
                : 'Enter estimated hours to calculate days'}
            </div>
          </div>

          {/* Reporter */}
          <div>
            <label className={labelCls}>Reporter</label>
            <Input 
              value={reporterName} 
              placeholder="Reporter" 
              size="middle" 
              disabled 
              className="rounded-md bg-gray-50"
            />
          </div>

          {/* Billable */}
          <div>
            <label className={labelCls}>Billable</label>
            <div className="flex items-center gap-3 pt-1">
              <ToggleSwitch checked={isBillable} onChange={setIsBillable} />
              <span className="text-xs text-gray-600">Is billable</span>
            </div>
          </div>
        </div>
      </div>

      {/* Epic Details Section */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 pb-1.5 border-b border-gray-200">Epic Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">

          {/* Priority */}
          <div>
            <label className={labelCls}>Priority{required}</label>
            <Select
              placeholder="Select priority"
              size="middle"
              className="w-full rounded-md"
              value={priority || undefined}
              onChange={(val) => handleFieldChange('priority', val, setPriority)}
              onBlur={() => handleFieldBlur('priority', priority)}
              status={errors.priority ? 'error' : ''}
              options={priorityOptions}
            />
            {errors.priority && (
              <div className="text-xs text-red-600 mt-1">{errors.priority}</div>
            )}
          </div>

          {/* Product */}
          <div>
            <label className={labelCls}>Product</label>
            <Select
              placeholder="Select product"
              size="middle"
              className="w-full rounded-md"
              value={product || undefined}
              onChange={(val) => handleFieldChange('product', val, setProduct)}
              onBlur={() => handleFieldBlur('product', product)}
              status={errors.product ? 'error' : ''}
              options={productOptions}
            />
            {errors.product && (
              <div className="text-xs text-red-600 mt-1">{errors.product}</div>
            )}
          </div>

          {/* Client */}
          <div>
            <label className={labelCls}>Client</label>
            <Select
              showSearch
              placeholder="Select client"
              size="middle"
              className="w-full rounded-md"
              value={client || undefined}
              onChange={(val) => handleFieldChange('client', val, setClient)}
              onBlur={() => handleFieldBlur('client', client)}
              status={errors.client ? 'error' : ''}
              options={clientOptions}
              filterOption={(input, option) => 
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
            {errors.client && (
              <div className="text-xs text-red-600 mt-1">{errors.client}</div>
            )}
          </div>

          {/* Contact Person */}
          <div>
            <label className={labelCls}>Contact Person</label>
            <Select
              showSearch
              placeholder={client ? "Select contact person" : "Select client first"}
              size="middle"
              className="w-full rounded-md"
              value={contactPerson || undefined}
              onChange={(val) => handleFieldChange('contactPerson', val, setContactPerson)}
              onBlur={() => handleFieldBlur('contactPerson', contactPerson)}
              status={errors.contactPerson ? 'error' : ''}
              options={contactPersonOptions}
              disabled={!client}
              filterOption={(input, option) => 
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
            {errors.contactPerson && (
              <div className="text-xs text-red-600 mt-1">{errors.contactPerson}</div>
            )}
          </div>

          {/* Start Date */}
          <div>
            <label className={labelCls}>Start Date</label>
            <DatePicker
              placeholder="Select start date"
              size="middle"
              className="w-full rounded-md"
              format="DD-MM-YYYY"
              value={startDate}
              onChange={(val) => handleFieldChange('startDate', val, setStartDate)}
              onBlur={() => handleFieldBlur('startDate', startDate)}
              status={errors.startDate ? 'error' : ''}
              suffixIcon={<CalendarOutlined className="text-gray-400" />}
              disabledDate={(current) => {
                if (current && current < dayjs().startOf('day')) return true;
                if (dueDate) return current && current > dueDate.endOf('day');
                return false;
              }}
            />
            {errors.startDate && (
              <div className="text-xs text-red-600 mt-1">{errors.startDate}</div>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label className={labelCls}>Due Date</label>
            <DatePicker
              placeholder="Select due date"
              size="middle"
              className="w-full rounded-md"
              format="DD-MM-YYYY"
              value={dueDate}
              onChange={(val) => handleFieldChange('dueDate', val, setDueDate)}
              onBlur={() => handleFieldBlur('dueDate', dueDate)}
              status={errors.dueDate ? 'error' : ''}
              suffixIcon={<CalendarOutlined className="text-gray-400" />}
              disabledDate={(current) => {
                if (startDate) return current && current < startDate.startOf('day');
                return false;
              }}
            />
            {errors.dueDate && (
              <div className="text-xs text-red-600 mt-1">{errors.dueDate}</div>
            )}
            {!errors.dueDate && startDate && estimatedDays != null && estimatedDays > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                Auto-calculated from start date ({startDate.format('DD-MM-YYYY')}) + {estimatedDays} working days (skips weekends)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Attachments Section */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 pb-1.5 border-b border-gray-200">Attachments</h2>
        <div>
          <label className={labelCls}>Upload Files</label>
          <Upload.Dragger
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt"
            beforeUpload={(file) => {
              setFiles((prev) => [...prev, file as File]);
              const fileWithUid = file as File & { uid?: string };
              setUploadList((prev) => [
                ...prev,
                { uid: fileWithUid.uid || `${Date.now()}-${file.name}`, name: file.name, size: file.size, type: file.type, status: 'done' as const, originFileObj: file },
              ]);
              return false;
            }}
            onRemove={(file) => {
              setUploadList((prev) => prev.filter((f) => f.uid !== file.uid));
              setFiles((prev) => prev.filter((f) => f.name !== file.name || f.size !== (file.size || 0)));
            }}
            fileList={uploadList}
            className="rounded-md"
          >
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 mb-1">Drag and drop files here or click to browse</p>
              <p className="text-xs text-gray-400">Supported: pdf, images, docs, sheets, txt</p>
            </div>
          </Upload.Dragger>
          {uploadList.length > 0 && (
            <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
              <span>{uploadList.length} file(s) selected</span>
              <button
                type="button"
                className="underline hover:text-gray-800"
                onClick={() => { setUploadList([]); setFiles([]); }}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tasks Section */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 pb-1.5 border-b border-gray-200 flex items-center justify-between">
          <span>Tasks</span>
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={handleAddTask}
            className="text-xs"
          >
            Add Task
          </Button>
        </h2>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <Table
            columns={[
              {
                title: "Task ID",
                key: "taskId",
                width: 90,
                render: (_: any, __: NewEpicTask, index: number) => (
                  <span className="text-xs font-medium text-gray-700">{`TA-${index + 1}`}</span>
                ),
              },
              {
                title: (
                  <span>
                    Title <span className="text-red-500">*</span>
                  </span>
                ),
                key: "title",
                width: 200,
                render: (_: any, record: NewEpicTask) => (
                  <AutoComplete
                    value={record.title}
                    options={taskTitleOptions}
                    onChange={(value) => handleTaskTitleChange(record.id, value)}
                    placeholder="Type to search or enter new task title"
                    className="w-full"
                    size="small"
                    filterOption={(inputValue, option) =>
                      (option?.value as string)
                        .toLowerCase()
                        .includes(inputValue.toLowerCase())
                    }
                  />
                ),
              },
              {
                title: (
                  <span>
                    Team <span className="text-red-500">*</span>
                  </span>
                ),
                dataIndex: "team",
                key: "team",
                width: 150,
                render: (team: string, record: NewEpicTask) => (
                  <Select
                    value={team || undefined}
                    onChange={(value) => {
                      // Update team
                      handleTaskFieldChange(record.id, "team", value);
                      
                      // If team changed, check if current assignee is in the new team
                      if (value && record.assignee) {
                        const newTeamEmployees = getEmployeesByTeam(value);
                        const assigneeInNewTeam = newTeamEmployees.find(
                          emp => emp.value === record.assignee || emp.label === record.assignee
                        );
                        
                        // If assignee is not in the new team, clear the assignee
                        if (!assigneeInNewTeam) {
                          setTimeout(() => {
                            handleTaskFieldChange(record.id, "assignee", "");
                          }, 0);
                        }
                      } else if (!value) {
                        // If team is cleared, also clear assignee
                        setTimeout(() => {
                          handleTaskFieldChange(record.id, "assignee", "");
                        }, 0);
                      }
                    }}
                    placeholder="Select team"
                    size="small"
                    className="w-full"
                    options={teamOptions}
                    showSearch
                    allowClear
                    filterOption={(input, option) =>
                      (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                  />
                ),
              },
              {
                title: "Assignee",
                dataIndex: "assignee",
                key: "assignee",
                width: 180,
                render: (assignee: string, record: NewEpicTask) => {
                  // Get filtered employees based on selected team
                  const filteredEmployeeOptions = getEmployeesByTeam(record.team);
                  
                  // Find the value (code) if assignee is stored as name, or use assignee directly if it's a code
                  const assigneeValue = (() => {
                    if (!assignee) return undefined;
                    // First check in filtered options
                    const byName = filteredEmployeeOptions.find(opt => opt.label === assignee);
                    if (byName) return byName.value;
                    const byValue = filteredEmployeeOptions.find(opt => opt.value === assignee);
                    if (byValue) return byValue.value;
                    // If not found in filtered, check all employees (in case team was changed)
                    const byNameAll = employeeOptions.find(opt => opt.label === assignee);
                    if (byNameAll) return byNameAll.value;
                    const byValueAll = employeeOptions.find(opt => opt.value === assignee);
                    if (byValueAll) return byValueAll.value;
                    return assignee;
                  })();
                  
                  return (
                    <Select
                      value={assigneeValue}
                      onChange={(value) => {
                        // Store the employee code (value) for API submission
                        handleTaskFieldChange(record.id, "assignee", value || "");
                      }}
                      placeholder={record.team ? "Select team member" : "Unassigned"}
                      size="small"
                      className="w-full"
                      options={filteredEmployeeOptions}
                      showSearch
                      allowClear
                      notFoundContent={record.team ? "No team members found" : "No employees found"}
                      filterOption={(input, option) =>
                        (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                      }
                    />
                  );
                },
              },
              {
                title: (
                  <span>
                    Task Type <span className="text-red-500">*</span>
                  </span>
                ),
                dataIndex: "taskType",
                key: "taskType",
                width: 150,
                render: (taskType: string, record: NewEpicTask) => {
                  // Always get fresh options from master data
                  const currentTaskTypeOptions = getTaskTypeOptions();
                  // Use fresh options if available, otherwise fall back to state
                  const optionsToUse = currentTaskTypeOptions.length > 0 ? currentTaskTypeOptions : taskTypeOptions;
                  return (
                  <Select
                    value={taskType || undefined}
                    onChange={(value) => handleTaskFieldChange(record.id, "taskType", value || "")}
                    size="small"
                    className="w-full"
                    placeholder="Select task type"
                      options={optionsToUse}
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                      notFoundContent={optionsToUse.length === 0 ? "Loading task types..." : undefined}
                  />
                  );
                },
              },
              {
                title: "Depends On",
                key: "dependsOn",
                width: 180,
                render: (_: any, record: NewEpicTask, index: number) => {
                  // Build options from all other tasks
                  const dependencyOptions = tasks
                    .filter((t) => t.id !== record.id)
                    .map((t, idx) => ({
                      value: t.id,
                      label: `TA-${idx + 1}: ${t.title || "Untitled task"}`,
                    }));

                  return (
                    <Select
                      value={record.dependsOnTaskId || undefined}
                      onChange={(value) =>
                        handleTaskFieldChange(
                          record.id,
                          "dependsOnTaskId",
                          value || undefined
                        )
                      }
                      size="small"
                      className="w-full"
                      placeholder="No dependency"
                      options={dependencyOptions}
                      allowClear
                      disabled={tasks.length <= 1}
                    />
                  );
                },
              },
              {
                title: "Start Date",
                dataIndex: "startDate",
                key: "startDate",
                width: 130,
                render: (date: string, record: NewEpicTask, index: number) => {
                  // Find the dependency task's due date (if any)
                  const dependencyTask = record.dependsOnTaskId
                    ? tasks.find((t) => t.id === record.dependsOnTaskId)
                    : index > 0
                    ? tasks[index - 1]
                    : null;

                  const dependencyDueDate = dependencyTask?.dueDate
                    ? dayjs(dependencyTask.dueDate, "YYYY-MM-DD")
                    : null;
                  
                  return (
                    <DatePicker
                      value={date ? dayjs(date, "YYYY-MM-DD") : null}
                      onChange={(d) =>
                        handleTaskFieldChange(
                          record.id,
                          "startDate",
                          d ? d.format("YYYY-MM-DD") : ""
                        )
                      }
                      format="DD/MM/YYYY"
                      size="small"
                      className="w-full"
                      placeholder="Select"
                      // If there is no dependency and the epic has a start date,
                      // the task start date is locked to the epic start date,
                      // so we disable manual editing in that case.
                      disabled={!record.dependsOnTaskId && !!startDate}
                      disabledDate={(current) => {
                        const today = dayjs().startOf("day");
                        // Disable dates before today
                        if (current && current < today) {
                          return true;
                        }

                        // If there is a dependency, enforce start after its due date (next working day)
                        if (dependencyDueDate && dependencyDueDate.isValid()) {
                          const minDate = getNextWorkingDay(dependencyDueDate).startOf("day");
                          if (current && current < minDate) {
                            return true;
                          }
                        } else if (startDate) {
                          // If no dependency, but epic has a start date, don't allow before epic start
                          if (current && current < startDate.startOf("day")) {
                            return true;
                        }
                        }

                        return false;
                      }}
                    />
                  );
                },
              },
              {
                title: "Due Date",
                dataIndex: "dueDate",
                key: "dueDate",
                width: 130,
                render: (date: string, record: NewEpicTask) => {
                  const taskStartDate = record.startDate 
                    ? dayjs(record.startDate, "YYYY-MM-DD") 
                    : null;
                  
                  return (
                    <DatePicker
                      value={date ? dayjs(date, "YYYY-MM-DD") : null}
                      onChange={(d) =>
                        handleTaskFieldChange(
                          record.id,
                          "dueDate",
                          d ? d.format("YYYY-MM-DD") : ""
                        )
                      }
                      format="DD/MM/YYYY"
                      size="small"
                      className="w-full"
                      placeholder="Select"
                      disabledDate={(current) => {
                        // Disable dates before today
                        if (current && current < dayjs().startOf('day')) {
                          return true;
                        }
                        // Disable dates before task start date
                        if (taskStartDate && taskStartDate.isValid()) {
                          return current && current < taskStartDate.startOf('day');
                        }
                        return false;
                      }}
                    />
                  );
                },
              },
              {
                title: "Priority",
                dataIndex: "priority",
                key: "priority",
                width: 120,
                render: (priority: string, record: NewEpicTask) => {
                  const priorityOption = priorityOptions.find(
                    (opt) => opt.value === priority || opt.label === priority
                  );
                  const currentValue = priorityOption?.value || priority || undefined;
                  const currentLabel = priorityOption?.label || priority || "";

                  // Get priority color
                  const getPriorityColor = (label: string) => {
                    const p = label.toLowerCase();
                    if (p.includes("high")) return "red";
                    if (p.includes("medium")) return "orange";
                    if (p.includes("low")) return "green";
                    return "blue";
                  };

                  return (
                    <Select
                      value={currentValue}
                      onChange={(value) => handleTaskFieldChange(record.id, "priority", value)}
                      size="small"
                      className="w-full"
                      placeholder="Priority"
                      dropdownRender={(menu) => (
                        <div>
                          {menu}
                        </div>
                      )}
                    >
                      {priorityOptions.map(opt => (
                        <Select.Option key={opt.value} value={opt.value}>
                          <Tag 
                            color={getPriorityColor(opt.label)} 
                            className="text-xs"
                          >
                            {opt.label}
                          </Tag>
                        </Select.Option>
                      ))}
                    </Select>
                  );
                },
              },
              {
                title: "Work Mode",
                dataIndex: "workMode",
                key: "workMode",
                width: 130,
                render: (workMode: string, record: NewEpicTask) => (
                  <Select
                    value={workMode || undefined}
                    onChange={(value) => handleTaskFieldChange(record.id, "workMode", value || "OFFICE")}
                    size="small"
                    className="w-full"
                    options={workLocationOptions}
                    placeholder="Select work mode"
                  />
                ),
              },
              {
                title: "Status",
                dataIndex: "status",
                key: "status",
                width: 120,
                render: (status: string, record: NewEpicTask) => {
                  // Status is always "To Do" (STS001) for new tasks, show as key-value in CAPS with border
                  const defaultStatus = statusOptions.find(opt => opt.value === "STS001") || statusOptions[0];
                  const statusValue = status || defaultStatus?.value || "STS001";
                  const statusOption = statusOptions.find(opt => opt.value === statusValue) || defaultStatus;
                  
                  return (
                    <span className="text-xs text-gray-800 border border-gray-300 rounded px-2 py-1 inline-block bg-gray-50">
                      {statusOption.label.toUpperCase()}
                    </span>
                  );
                },
              },
              {
                title: "Actions",
                key: "actions",
                width: 80,
                fixed: "right" as const,
                render: (_: any, record: NewEpicTask) => (
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(record.id)}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded transition-colors"
                    title="Delete task"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                ),
              },
            ]}
            dataSource={tasks}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: "max-content" }}
            className="text-xs"
          />
        </div>
      </div>

      {/* Gantt Chart Section */}
      {tasks.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 pb-1.5 border-b border-gray-200">
            Timeline View (Gantt Chart)
          </h2>
          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <SimpleGanttChart
              tasks={tasks.map((t) => ({
                id: t.id,
                title: t.title || "Untitled task",
                startDate: t.startDate,
                dueDate: t.dueDate,
                estimatedHours: 0, // Removed from UI
                priority: t.priority,
              }))}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
        {onCancel && (
          <Button
            onClick={onCancel}
            disabled={loading}
            size="middle"
            className="px-5 rounded-md"
          >
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSaveAsTemplate}
          disabled={loading}
          size="middle"
          className="px-5 rounded-md border border-gray-300"
        >
          Save as Template
        </Button>
        <Button
          onClick={handleCreate}
          type="primary"
          loading={loading}
          disabled={loading}
          size="middle"
          className="px-6 rounded-md bg-blue-600 hover:bg-blue-700"
        >
          {loading ? "Creating..." : "Create Epic"}
        </Button>
      </div>
    </div>
  );
}

