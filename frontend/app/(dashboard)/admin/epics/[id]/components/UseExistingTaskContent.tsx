"use client";

import { Select, Input, InputNumber, DatePicker, Upload, Button } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { toast } from "react-hot-toast";
import React, { useEffect, useState, useMemo } from "react";
import { ClockCircleOutlined, CalendarOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { apiRequest, getMasterDataFromCache } from "@/app/lib/api";
import { getPriorityOptions, getTaskTypeOptions, getWorkLocationOptions, onMasterDataChange, getAllEmployeeOptions } from "@/app/lib/masterData";

interface UseExistingTaskContentProps {
  epicId?: string; // Optional - if not provided, task will be created without epic
  onCreated?: () => void;
  onCancel?: () => void;
}

interface PredefinedTaskTemplate {
  id: string;              // UI identifier (unique per template-task)
  predefinedTaskId: number; // Actual predefined_task.id to send to API
  name: string;            // Display name in dropdown
  description: string;
  priority: string;
  taskType: string;
  workMode: string;
  teamCode?: string;       // Team code from template
  estimatedHours: number;
  startDate?: string;
  dueDate?: string;
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

const UseExistingTaskContent: React.FC<UseExistingTaskContentProps> = ({ epicId, onCreated, onCancel }) => {
  // When epicId is provided, this flow is used to create a task under an epic from a template.
  // When epicId is undefined (accessed from /admin/tasks/use-existing), we are updating the task template.
  const isCreateMode = !!epicId;
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<PredefinedTaskTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [taskTitle, setTaskTitle] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(null);
  const [dueDate, setDueDate] = useState<dayjs.Dayjs | null>(null);
  const [description, setDescription] = useState<string>("");
  const [assignee, setAssignee] = useState<string>("");
  const [team, setTeam] = useState<string>("");
  const [taskType, setTaskType] = useState<string>("");
  const [workMode, setWorkMode] = useState<string>("");
  const [estHours, setEstHours] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Calculate estimated days from estimated hours (8 hours = 1 working day)
  const estimatedDays = useMemo(() => {
    if (estHours == null || estHours <= 0) return null;
    return Math.ceil(estHours / 8 * 100) / 100; // Round to 2 decimal places
  }, [estHours]);
  
  // Auto-calculate due date from start date and estimated days (working days only)
  useEffect(() => {
    if (startDate && estimatedDays != null && estimatedDays > 0) {
      const calculatedDueDate = addWorkingDays(startDate, estimatedDays);
      setDueDate(calculatedDueDate);
    }
  }, [startDate, estimatedDays]);
  const [reporterName, setReporterName] = useState<string>("");
  const [assigneeOptions, setAssigneeOptions] = useState<{ value: string; label: string }[]>([]);
  const [teamOptions, setTeamOptions] = useState<{ value: string; label: string }[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadList, setUploadList] = useState<UploadFile[]>([]);

  // Validation errors state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Get selected template
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || null;

  useEffect(() => {
    const loadReporterName = async () => {
      try {
        const { getUserFromStorage } = await import("@/app/lib/auth/storage");
        const user = getUserFromStorage();
        if (user?.userName) setReporterName(user.userName);
      } catch { }
    };
    loadReporterName();
  }, []);

  // Load predefined task templates from master data
  useEffect(() => {
    const loadTemplates = () => {
      setLoadingTemplates(true);
      try {
        const d = getMasterDataFromCache<any>();
        const masterEpics = d?.data?.predefined_epics || [];
        const masterTasks = d?.data?.predefined_tasks || [];

        const allTemplates: PredefinedTaskTemplate[] = [];

        // Get tasks from predefined epics (if tasks have predefined_epic_id)
        masterEpics.forEach((epic: any) => {
          const epicName = epic?.predefined_epic_name || epic?.epic_title || "";
          const epicDesc = epic?.description || epic?.epic_description || "";

          // Find tasks linked to this epic
          const epicTasks = masterTasks.filter((task: any) =>
            task?.predefined_epic_id && String(task.predefined_epic_id) === String(epic.id)
          );

          epicTasks.forEach((task: any) => {
            const predefinedTaskId = Number(task?.id || 0);
            if (!predefinedTaskId) return;

            allTemplates.push({
              id: `${epic.id || epicName}-${predefinedTaskId}`,
              predefinedTaskId,
              name: `${epicName || "Template"} - ${task.task_title || ""}`.trim(),
              description: task.task_description || epicDesc || "",
              // Use priority_code (from API) instead of default_priority_code
              priority: task.priority_code ? String(task.priority_code) : (task.default_priority_code ? String(task.default_priority_code) : ""),
              // Use task_type_code (from API) instead of default_task_type_code
              taskType: task.task_type_code || task.default_task_type_code || "",
              workMode: task.work_mode || task.default_work_mode || "",
              teamCode: task.team_code || undefined,
              estimatedHours: Number(task.estimated_hours || 0),
              startDate: task.start_date ? new Date(task.start_date).toISOString().split('T')[0] : undefined,
              dueDate: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : undefined,
            });
          });
        });

        // Also add standalone predefined tasks (if any don't have predefined_epic_id)
        masterTasks.forEach((task: any) => {
          if (!task?.predefined_epic_id && task?.id) {
            allTemplates.push({
              id: `standalone-${task.id}`,
              predefinedTaskId: Number(task.id),
              name: task.task_title || "",
              description: task.task_description || "",
              // Use priority_code (from API) instead of default_priority_code
              priority: task.priority_code ? String(task.priority_code) : (task.default_priority_code ? String(task.default_priority_code) : ""),
              // Use task_type_code (from API) instead of default_task_type_code
              taskType: task.task_type_code || task.default_task_type_code || "",
              workMode: task.work_mode || task.default_work_mode || "",
              teamCode: task.team_code || undefined,
              estimatedHours: Number(task.estimated_hours || 0),
              startDate: task.start_date ? new Date(task.start_date).toISOString().split('T')[0] : undefined,
              dueDate: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : undefined,
            });
          }
        });

        setTemplates(allTemplates);
      } catch (error) {
        console.error("Error loading predefined task templates:", error);
        toast.error("Failed to load task templates");
      } finally {
        setLoadingTemplates(false);
      }
    };

    loadTemplates();

    // Subscribe to master data changes
    const unsubscribe = onMasterDataChange(loadTemplates);
    return unsubscribe;
  }, []);

  // Build assignee options
  useEffect(() => {
    const buildOptions = async () => {
      const md = getMasterDataFromCache<import("@/app/lib/masterData").MasterApiResponse>();
      const employees = md?.data?.employees || [];
      const opts = employees
        .filter((e) => e?.user_code && e?.user_name)
        .map((e) => ({ value: String(e.user_code), label: String(e.user_name) }));
      setAssigneeOptions(opts);
      
      // Build team options from team_master (preferred) or fallback to employees
      const teamsFromMaster = md?.data?.teams || [];
      if (teamsFromMaster && teamsFromMaster.length > 0) {
        // Use teams from team_master - use team_code as value, team_name as label
        const teamList = teamsFromMaster
          .filter((team: any) => team?.is_active !== false)
          .map((team: any) => ({
            value: team.team_code || '',
            label: team.team_name || team.team_code || '',
          }))
          .filter((opt: any) => opt.value && opt.label)
          .sort((a: any, b: any) => a.label.localeCompare(b.label));
        setTeamOptions(teamList);
      } else {
        // Fallback: Build team options from employees
        const teams = new Set<string>();
        employees.forEach((emp: any) => {
          if (emp?.team_code) {
            teams.add(emp.team_code);
          }
        });
        const teamList = Array.from(teams)
          .map(teamCode => {
            // Try to find team name from employees
            const empWithTeam = employees.find((e: any) => e.team_code === teamCode);
            return {
              value: teamCode, // Use team_code as value
              label: empWithTeam?.team_name || teamCode // Use team_name as label
            };
          })
          .sort((a, b) => a.label.localeCompare(b.label));
        setTeamOptions(teamList);
      }
    };

    buildOptions();
    const off = onMasterDataChange(() => { buildOptions(); });
    return () => { try { off?.(); } catch { } };
  }, []);

  // Filter assignee options based on selected team
  const filteredAssigneeOptions = useMemo(() => {
    if (!team) {
      return assigneeOptions;
    }
    try {
      const md = getMasterDataFromCache<any>();
      const employees = md?.data?.employees || [];
      return assigneeOptions.filter(opt => {
        const emp = employees.find((e: any) =>
          String(e.user_code).toUpperCase() === String(opt.value).toUpperCase()
        );
        return emp?.team_code === team;
      });
    } catch {
      return assigneeOptions;
    }
  }, [team, assigneeOptions]);

  // Update form fields when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      setTaskTitle(selectedTemplate.name);
      setDescription(selectedTemplate.description);
      setPriority(selectedTemplate.priority);
      setTaskType(selectedTemplate.taskType);
      setWorkMode(selectedTemplate.workMode || "OFFICE");
      // Set team from template - ensure we use team_code (value) not team_name
      // The teamOptions use team_code as value, so this should match correctly
      if (selectedTemplate.teamCode) {
        // Verify the team code exists in teamOptions
        const teamExists = teamOptions.some(opt => opt.value === selectedTemplate.teamCode);
        if (teamExists) {
          setTeam(selectedTemplate.teamCode);
        } else {
          // If team code doesn't exist in options yet, set it anyway (options might load later)
          setTeam(selectedTemplate.teamCode);
        }
      } else {
        setTeam("");
      }
      setAssignee(""); // Reset assignee when template changes
      setEstHours(selectedTemplate.estimatedHours);
      if (selectedTemplate.startDate) {
        setStartDate(dayjs(selectedTemplate.startDate));
      }
      if (selectedTemplate.dueDate) {
        setDueDate(dayjs(selectedTemplate.dueDate));
      }
    }
  }, [selectedTemplate, teamOptions]);

  // Ref to hold latest values for validation to avoid stale state in callbacks
  const latestValues = React.useRef({
    selectedTemplateId,
    taskTitle,
    description,
    priority,
    taskType,
    workMode,
    assignee,
    dueDate,
    startDate,
    estHours,
  });

  useEffect(() => {
    latestValues.current = {
      selectedTemplateId,
      taskTitle,
      description,
      priority,
      taskType,
      workMode,
      assignee,
      dueDate,
      startDate,
      estHours,
    };
  }, [selectedTemplateId, taskTitle, description, priority, taskType, workMode, assignee, dueDate, startDate, estHours]);

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

  // Validation functions (same as CreateTaskForm)
  const validateField = (field: string, value: any): string => {
    switch (field) {
      case 'taskTitle':
        if (!value || !value.trim()) return 'Task title is required';
        if (value.trim().length < 3) return 'Task title must be at least 3 characters';
        if (value.trim().length > 200) return 'Task title must be less than 200 characters';
        return '';
      case 'description':
        if (!value || !value.trim()) return 'Description is required';
        if (value.trim().length < 10) return 'Description must be at least 10 characters';
        if (value.trim().length > 2000) return 'Description must be less than 2000 characters';
        return '';
      case 'priority':
        if (!value) return 'Priority is required';
        return '';
      case 'taskType':
        if (!value) return 'Task type is required';
        return '';
      case 'workMode':
        // Optional
        return '';
      case 'assignee':
        // Optional
        return '';
      case 'dueDate':
        // Optional field - only validate if provided
        if (!value) return '';
        if (value.startOf('day').isBefore(dayjs().startOf('day'))) {
          return 'Due date cannot be before today';
        }
        if (latestValues.current.startDate && value.startOf('day').isBefore(latestValues.current.startDate.startOf('day'))) {
          return 'Due date cannot be before start date';
        }
        return '';
      case 'startDate':
        if (value && value.startOf('day').isBefore(dayjs().startOf('day'))) {
          return 'Start date cannot be before today';
        }
        if (value && latestValues.current.dueDate && value.startOf('day').isAfter(latestValues.current.dueDate.startOf('day'))) {
          return 'Start date cannot be after due date';
        }
        return '';
      case 'estHours':
        if (value == null || value === '') return 'Estimated hours is required';
        if (value <= 0) return 'Estimated hours must be greater than 0';
        if (value > 1000) return 'Estimated hours must be less than 1000';
        return '';
      case 'selectedTemplateId':
        if (!value) return 'Template selection is required';
        return '';
      default:
        return '';
    }
  };

  const handleFieldChange = (field: string, value: any, setter: (val: any) => void) => {
    setter(value);
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
    // Also validate related fields
    if (field === 'startDate' && touched['dueDate']) {
      const error = validateField('dueDate', latestValues.current.dueDate);
      setErrors(prev => ({ ...prev, dueDate: error }));
    }
    if (field === 'dueDate' && touched['startDate']) {
      const error = validateField('startDate', latestValues.current.startDate);
      setErrors(prev => ({ ...prev, startDate: error }));
    }
  };

  const handleFieldBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    // Use latest value from ref to avoid stale closure issues
    const value = (latestValues.current as any)[field];
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const validateAllFields = (): boolean => {
    const newErrors: Record<string, string> = {};
    const fieldsToValidate = [
      { field: 'selectedTemplateId', value: selectedTemplateId },
      { field: 'taskTitle', value: taskTitle },
      { field: 'description', value: description },
      { field: 'priority', value: priority },
      { field: 'taskType', value: taskType },
      { field: 'workMode', value: workMode },
      { field: 'assignee', value: assignee },
      { field: 'dueDate', value: dueDate },
      { field: 'startDate', value: startDate },
      { field: 'estHours', value: estHours },
    ];

    fieldsToValidate.forEach(({ field, value }) => {
      const error = validateField(field, value);
      if (error) {
        newErrors[field] = error;
      }
    });

    setErrors(newErrors);
    setTouched({
      selectedTemplateId: true,
      taskTitle: true,
      description: true,
      priority: true,
      taskType: true,
      workMode: true,
      assignee: true,
      dueDate: true,
      startDate: true,
      estHours: true,
    });

    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async () => {
    // Ensure a template is selected
    if (!selectedTemplate) {
      toast.error("Please select a task template");
      return;
    }

    // Validate all fields
    if (!validateAllFields()) {
      toast.error('Please fix all validation errors before submitting');
      return;
    }

    setLoading(true);
    try {
      // If epicId is provided, we're creating a task under an epic - use use_existing_task API
      if (isCreateMode && epicId) {
        // Use FormData for multipart/form-data (supports file attachments)
        const formData = new FormData();
        
        // Required fields
        formData.append('predefined_task_id', String(selectedTemplate.predefinedTaskId));
        formData.append('epic_code', String(epicId));
        
        // Optional fields that override template defaults
        if (taskTitle) {
          formData.append('task_title', taskTitle);
        }
        if (description) {
          formData.append('task_description', description);
        }
        if (assignee) {
          formData.append('assignee', assignee);
        }
        
        // Get team_code: prioritize from assignee, fallback to selected team
        let teamCodeToSend: string | null = null;
        if (assignee) {
          try {
            const md = getMasterDataFromCache<import("@/app/lib/masterData").MasterApiResponse>();
            const employees = md?.data?.employees || [];
            const assigneeCode = assignee.trim().toUpperCase();
            const emp = employees.find((e: any) => String(e.user_code).toUpperCase() === assigneeCode);
            if (emp?.team_code) {
              teamCodeToSend = String(emp.team_code);
            }
          } catch {
            // Ignore failures
          }
        }
        if (!teamCodeToSend && team) {
          teamCodeToSend = String(team);
        }
        if (teamCodeToSend) {
          formData.append('assigned_team_code', teamCodeToSend);
        }
        
        if (priority) {
          formData.append('priority_code', String(priority));
        }
        if (taskType) {
          formData.append('task_type_code', String(taskType));
        }
        if (workMode) {
          // Ensure we always send a valid work mode code
          let workModeCode = workMode;
          try {
            const locations = getWorkLocationOptions();
            const matched = locations.find(
              (loc) =>
                String(loc.value).toUpperCase() === String(workMode).toUpperCase() ||
                String(loc.label).toLowerCase() === String(workMode).toLowerCase()
            );
            if (matched) {
              workModeCode = String(matched.value);
            }
          } catch {
            // If we can't resolve, fall back to sending whatever is in workMode
          }
          formData.append('work_mode', workModeCode);
        }
        if (startDate) {
          formData.append('start_date', startDate.format('YYYY-MM-DD'));
        }
        if (dueDate) {
          formData.append('due_date', dueDate.format('YYYY-MM-DD'));
        }
        if (estHours != null && estHours > 0) {
          formData.append('estimated_hours', String(estHours));
        }
        if (estimatedDays != null && estimatedDays > 0) {
          formData.append('estimated_days', String(estimatedDays));
        }
        
        // Handle file attachments
        if (files && files.length > 0) {
          files.forEach((file) => {
            formData.append('attachments', file);
          });
        }
        
        // Call use_existing_task API
        const response: any = await apiRequest('use_existing_task', 'POST', formData);
        toast.success(response?.message || response?.Status_Description || "Task created successfully");
        try { onCreated && onCreated(); } catch { }
      } else {
        // If epicId is not provided, we're updating the task template - use update_predefined_task API
        // Use URLSearchParams for application/x-www-form-urlencoded
        const params = new URLSearchParams();

        // Required fields for update_predefined_task
        if (taskTitle) {
          params.append("task_title", taskTitle);
        }
        if (description) {
          params.append("task_description", description);
        }
        if (priority) {
          params.append("priority_code", String(priority));
        }
        // Task type (optional)
        if (taskType) {
          params.append("task_type_code", String(taskType));
        }
        if (workMode) {
          // Ensure we always send a valid work mode code
          let workModeCode = workMode;
          try {
            const locations = getWorkLocationOptions();
            const matched = locations.find(
              (loc) =>
                String(loc.value).toUpperCase() === String(workMode).toUpperCase() ||
                String(loc.label).toLowerCase() === String(workMode).toLowerCase()
            );
            if (matched) {
              workModeCode = String(matched.value);
            }
          } catch {
            // If we can't resolve, fall back to sending whatever is in workMode
          }
          params.append("work_mode", workModeCode);
        }

        // Get team_code: prioritize from assignee, fallback to selected team
        let teamCodeToSend: string | null = null;
        if (assignee) {
          // Try to derive team_code from master data for the selected assignee
          try {
            const md = getMasterDataFromCache<import("@/app/lib/masterData").MasterApiResponse>();
            const employees = md?.data?.employees || [];
            const assigneeCode = assignee.trim().toUpperCase();
            const emp = employees.find((e: any) => String(e.user_code).toUpperCase() === assigneeCode);
            if (emp?.team_code) {
              teamCodeToSend = String(emp.team_code);
            }
          } catch {
            // Ignore failures
          }
        }
        // If no team_code from assignee, use selected team
        if (!teamCodeToSend && team) {
          teamCodeToSend = String(team);
        }
        // Send team_code if we have one
        if (teamCodeToSend) {
          params.append("team_code", teamCodeToSend);
        }

        // Estimated hours and days
        if (estHours != null && estHours > 0) {
          params.append("estimated_hours", String(estHours));
        }
        if (estimatedDays != null && estimatedDays > 0) {
          params.append("estimated_days", String(estimatedDays));
        }

        // Get predefined_epic_id from the selected template if available
        // We need to check if the template is linked to an epic
        let predefinedEpicId: number | null = null;
        try {
          const md = getMasterDataFromCache<any>();
          const masterTasks = md?.data?.predefined_tasks || [];
          const taskData = masterTasks.find((t: any) => Number(t.id) === selectedTemplate.predefinedTaskId);
          if (taskData?.predefined_epic_id) {
            predefinedEpicId = Number(taskData.predefined_epic_id);
          }
        } catch {
          // Ignore if we can't find it
        }
        // Only append predefined_epic_id if we have a value
        // If omitted, the backend will keep the existing value
        // To unlink, we would need to send null, but since URLSearchParams doesn't support null,
        // we'll omit it and let the backend handle it
        if (predefinedEpicId !== null) {
          params.append("predefined_epic_id", String(predefinedEpicId));
        }

        // Note: status_code and is_billable are not in the form, so we'll skip them
        // They can be added later if needed

        // Call update_predefined_task API
        const predefinedTaskId = selectedTemplate.predefinedTaskId;
        const endpoint = `update_predefined_task/${predefinedTaskId}`;
        const response: any = await apiRequest(endpoint, "PUT", params);
        toast.success(response?.message || response?.Status_Description || "Task template updated successfully");
        try { onCreated && onCreated(); } catch { }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : (isCreateMode ? "Failed to create task" : "Failed to update task template");
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsTemplate = () => {
    console.log("Save task as template (stub)", {
      epicId,
      selectedTemplateId,
      taskTitle,
      description,
      priority,
      taskType,
      workMode,
      estHours,
      startDate: startDate?.format("YYYY-MM-DD"),
      dueDate: dueDate?.format("YYYY-MM-DD"),
    });
    toast.success("Task configuration saved as template (stub - no backend yet)");
  };

  const templateOptions = templates.map(template => ({
    value: template.id,
    label: template.name,
  }));

  return (
    <div className="text-sm">
      {/* Template Selection */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 pb-1.5 border-b border-gray-200">Select Template</h2>
        <div className="mb-4">
          <label className={labelCls}>Predefined Task Template{required}</label>
          <Select
            placeholder={loadingTemplates ? "Loading templates..." : "Select a task template"}
            className="w-full rounded-md"
            size="middle"
            value={selectedTemplateId || undefined}
            onChange={(val) => handleFieldChange('selectedTemplateId', val, setSelectedTemplateId)}
            onBlur={() => handleFieldBlur('selectedTemplateId')}
            status={errors.selectedTemplateId ? 'error' : ''}
            options={templateOptions}
            loading={loadingTemplates}
            showSearch
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
          />
          {errors.selectedTemplateId && (
            <div className="text-xs text-red-600 mt-1">{errors.selectedTemplateId}</div>
          )}
          {selectedTemplate && !errors.selectedTemplateId && (
            <p className="text-xs text-gray-500 mt-1.5">{selectedTemplate.description}</p>
          )}
        </div>
      </div>

      {/* Form Fields - Only shown when template is selected */}
      {selectedTemplate && (
        <>
          {/* Basic Information Section */}
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 pb-1.5 border-b border-gray-200">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
              {/* Task Title */}
              <div className="md:col-span-2">
                <label className={labelCls}>Task Title{required}</label>
                <Input
                  placeholder="Enter task title"
                  size="middle"
                  value={taskTitle}
                  onChange={(e) => handleFieldChange('taskTitle', e.target.value, setTaskTitle)}
                  onBlur={() => handleFieldBlur('taskTitle')}
                  status={errors.taskTitle ? 'error' : ''}
                  className="rounded-md"
                />
                {errors.taskTitle && (
                  <div className="text-xs text-red-600 mt-1">{errors.taskTitle}</div>
                )}
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className={labelCls}>Description{required}</label>
                <Input.TextArea
                  placeholder="Enter a detailed description of the task"
                  rows={3}
                  className="text-sm rounded-md"
                  value={description}
                  onChange={(e) => handleFieldChange('description', e.target.value, setDescription)}
                  onBlur={() => handleFieldBlur('description')}
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
                <InputNumber
                  size="middle"
                  min={0}
                  step={0.5}
                  stringMode
                  className="w-full rounded-md"
                  addonAfter={<ClockCircleOutlined className="text-gray-400" />}
                  value={estHours ?? undefined}
                  precision={2}
                  status={errors.estHours ? 'error' : ''}
                  onChange={(v) => {
                    const n = Number(v);
                    const value = Number.isFinite(n) ? n : null;
                    handleFieldChange('estHours', value, setEstHours);
                  }}
                  onBlur={() => handleFieldBlur('estHours')}
                  onFocus={() => setEstHours(null)}
                  onKeyDown={handleNumberKeyDown}
                />
                {errors.estHours && (
                  <div className="text-xs text-red-600 mt-1">{errors.estHours}</div>
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
                    ? `Based on ${estHours} hours (8 hours = 1 working day)`
                    : 'Enter estimated hours to calculate days'}
                </div>
              </div>

              {/* Reporter */}
              <div>
                <label className={labelCls}>Reporter{required}</label>
                <Input
                  value={reporterName}
                  placeholder="Reporter"
                  size="middle"
                  disabled
                  className="rounded-md bg-gray-50"
                />
              </div>
            </div>
          </div>

          {/* Task Details Section */}
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 pb-1.5 border-b border-gray-200">Task Details</h2>
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
                  onBlur={() => handleFieldBlur('priority')}
                  status={errors.priority ? 'error' : ''}
                  options={getPriorityOptions()}
                />
                {errors.priority && (
                  <div className="text-xs text-red-600 mt-1">{errors.priority}</div>
                )}
              </div>

              {/* Task Type */}
              <div>
                <label className={labelCls}>Task Type{required}</label>
                <Select
                  placeholder="Select task type"
                  size="middle"
                  className="w-full rounded-md"
                  value={taskType || undefined}
                  onChange={(val) => handleFieldChange('taskType', val, setTaskType)}
                  onBlur={() => handleFieldBlur('taskType')}
                  status={errors.taskType ? 'error' : ''}
                  options={getTaskTypeOptions()}
                />
                {errors.taskType && (
                  <div className="text-xs text-red-600 mt-1">{errors.taskType}</div>
                )}
              </div>

              {/* Start Date (optional) */}
              <div>
                <label className={labelCls}>Start Date</label>
                <DatePicker
                  placeholder="Select start date"
                  size="middle"
                  className="w-full rounded-md"
                  format="DD-MM-YYYY"
                  value={startDate}
                  onChange={(val) => handleFieldChange('startDate', val, setStartDate)}
                  onBlur={() => handleFieldBlur('startDate')}
                  status={errors.startDate ? 'error' : ''}
                  disabledDate={(current) => {
                    const today = dayjs().startOf('day');
                    return current && current < today;
                  }}
                  suffixIcon={<CalendarOutlined className="text-gray-400" />}
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
                  onBlur={() => handleFieldBlur('dueDate')}
                  status={errors.dueDate ? 'error' : ''}
                  disabledDate={(current) => {
                    const today = dayjs().startOf('day');
                    if (startDate) {
                      return current && current < dayjs(startDate).startOf('day');
                    }
                    return current && current < today;
                  }}
                  suffixIcon={<CalendarOutlined className="text-gray-400" />}
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

              {/* Team */}
              <div>
                <label className={labelCls}>Team</label>
                <Select
                  showSearch
                  placeholder="Select team"
                  size="middle"
                  className="w-full rounded-md"
                  value={team || undefined}
                  onChange={(v) => {
                    handleFieldChange('team', String(v), setTeam);
                    // Clear assignee when team changes to ensure assignee is from selected team
                    if (v) {
                      setAssignee("");
                    }
                  }}
                  onBlur={() => handleFieldBlur('team')}
                  status={errors.team ? 'error' : ''}
                  options={teamOptions}
                  filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                  allowClear
                />
                {errors.team && (
                  <div className="text-xs text-red-600 mt-1">{errors.team}</div>
                )}
              </div>

              {/* Assignee */}
              <div>
                <label className={labelCls}>Assignee</label>
                <Select
                  showSearch
                  placeholder={team ? "Select team member" : "Select team first"}
                  size="middle"
                  className="w-full rounded-md"
                  value={assignee || undefined}
                  onChange={(v) => {
                    handleFieldChange('assignee', String(v), setAssignee);
                    // Auto-populate team from assignee if available
                    if (v) {
                      try {
                        const md = getMasterDataFromCache<any>();
                        const employees = md?.data?.employees || [];
                        const emp = employees.find((e: any) =>
                          String(e.user_code).toUpperCase() === String(v).toUpperCase()
                        );
                        if (emp?.team_code) {
                          setTeam(String(emp.team_code));
                        }
                      } catch {
                        // Ignore if we can't get team code
                      }
                    }
                  }}
                  onBlur={() => handleFieldBlur('assignee')}
                  status={errors.assignee ? 'error' : ''}
                  options={filteredAssigneeOptions}
                  filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                  allowClear
                  disabled={!team}
                />
                {errors.assignee && (
                  <div className="text-xs text-red-600 mt-1">{errors.assignee}</div>
                )}
              </div>

              {/* Work Mode */}
              <div>
                <label className={labelCls}>Work Mode</label>
                <Select
                  placeholder="Select work mode"
                  size="middle"
                  className="w-full rounded-md"
                  value={workMode || undefined}
                  onChange={(val) => handleFieldChange('workMode', val, setWorkMode)}
                  onBlur={() => handleFieldBlur('workMode')}
                  status={errors.workMode ? 'error' : ''}
                  options={getWorkLocationOptions()}
                />
                {errors.workMode && (
                  <div className="text-xs text-red-600 mt-1">{errors.workMode}</div>
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
                  <p className="text-xs text-gray-400">Support for multiple file uploads</p>
                </div>
              </Upload.Dragger>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-top border-gray-200">
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
              onClick={handleUpdate}
              type="primary"
              loading={loading}
              disabled={loading}
              size="middle"
              className="px-6 rounded-md bg-blue-600 hover:bg-blue-700"
            >
              {loading
                ? isCreateMode
                  ? "Creating..."
                  : "Updating..."
                : isCreateMode
                ? "Create Task"
                : "Update Task"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default UseExistingTaskContent;

