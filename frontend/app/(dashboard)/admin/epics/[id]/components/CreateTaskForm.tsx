"use client";

import { Select, Input, InputNumber, DatePicker, Upload, Button } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { toast } from "react-hot-toast";
import React, { useEffect, useState, useMemo } from "react";
import { ClockCircleOutlined, CalendarOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { apiRequest, getMasterDataFromCache } from "@/app/lib/api";
import { getPriorityOptions, getTaskTypeOptions, getWorkLocationOptions, onMasterDataChange } from "@/app/lib/masterData";
import { useRouter, usePathname } from "next/navigation";
import { getRoleBase, buildRoleHref } from "@/app/lib/paths";

interface CreateTaskFormProps {
  epicId?: string; // Optional - if not provided, task will be created without epic
  onCreated?: () => void;
  onCancel?: () => void;
  hideCreateButton?: boolean; // Optional - if true, hides the "Create Task" button
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

const CreateTaskForm: React.FC<CreateTaskFormProps> = ({ epicId, onCreated, onCancel, hideCreateButton }) => {
  const router = useRouter();
  const pathname = usePathname();
  const roleBase = getRoleBase(pathname || '');
  
  const [taskTitle, setTaskTitle] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(null);
  const [dueDate, setDueDate] = useState<dayjs.Dayjs | null>(null);
  const [description, setDescription] = useState<string>("");
  const [assignee, setAssignee] = useState<string>("");
  const [team, setTeam] = useState<string>("");
  const [taskType, setTaskType] = useState<string>("");
  const [workMode, setWorkMode] = useState<string>("OFFICE");
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

  useEffect(() => {
    const loadReporterName = async () => {
      try {
        const { getUserFromStorage } = await import("@/app/lib/auth/storage");
        const user = getUserFromStorage();
        if (user?.userName) setReporterName(user.userName);
      } catch { }
    };
    loadReporterName();
    // Reset form fields when component mounts
    setTaskTitle("");
    setPriority("");
    setStartDate(null);
    setDueDate(null);
    setDescription("");
    setAssignee("");
    setTeam("");
    setTaskType("");
    setWorkMode("OFFICE");
    setEstHours(null);
    setFiles([]);
    setUploadList([]);
  }, []);

  // Build assignee options and team options
  useEffect(() => {
    const buildOptions = async () => {
      const md = getMasterDataFromCache<import("@/app/lib/masterData").MasterApiResponse>();
      const employees = md?.data?.employees || [];
      let userCode = '';
      let teamName = '';
      try {
        const { getUserFromStorage } = await import("@/app/lib/auth/storage");
        const user = getUserFromStorage();
        if (user) {
          userCode = String(user.userCode || '');
          teamName = String(user.teamName || '');
        }
      } catch {
        // Ignore errors
      }
      
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

      // Show all employees in assignee dropdown (no team filtering)
      const filtered = employees;

      const opts = filtered
        .filter((e) => e?.user_code && e?.user_name)
        .map((e) => ({ value: String(e.user_code), label: String(e.user_name) }));
      setAssigneeOptions(opts);
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

  // Validation functions
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
        // Optional - no validation needed
        return '';
      case 'dueDate':
        // Due date is optional, but if provided, validate it
        if (value) {
          if (value.startOf('day').isBefore(dayjs().startOf('day'))) {
            return 'Due date cannot be before today';
          }
          if (startDate && value.startOf('day').isBefore(startDate.startOf('day'))) {
            return 'Due date cannot be before start date';
          }
        }
        return '';
      case 'startDate':
        if (value && value.startOf('day').isBefore(dayjs().startOf('day'))) {
          return 'Start date cannot be before today';
        }
        if (value && dueDate && value.startOf('day').isAfter(dueDate.startOf('day'))) {
          return 'Start date cannot be after due date';
        }
        return '';
      case 'estHours':
        if (value == null || value === '') return 'Estimated hours is required';
        if (value <= 0) return 'Estimated hours must be greater than 0';
        if (value > 1000) return 'Estimated hours must be less than 1000';
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
      const error = validateField('dueDate', dueDate);
      setErrors(prev => ({ ...prev, dueDate: error }));
    }
    if (field === 'dueDate' && touched['startDate']) {
      const error = validateField('startDate', startDate);
      setErrors(prev => ({ ...prev, startDate: error }));
    }
  };

  const handleFieldBlur = (field: string, value: any) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const validateAllFields = (): boolean => {
    const newErrors: Record<string, string> = {};
    const fieldsToValidate = [
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

  const handleCreate = async () => {
    // Validate all fields
    if (!validateAllFields()) {
      toast.error('Please fix all validation errors before submitting');
      return;
    }

    // Backend requires estimated_days > 0 (derived from hours)
    if (estimatedDays == null || estimatedDays <= 0) {
      toast.error("Estimated days is required and must be greater than 0. Please enter estimated hours > 0.");
      return;
    }

    // epic_code is required when epicId is provided
    if (epicId && !epicId.trim()) {
      toast.error("Epic ID is required to create a task");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();

      // Required fields
      form.append("task_title", taskTitle.trim());
      if (description && description.trim()) {
        form.append("task_desc", description.trim());
      }
      
      // epic_code is required when creating from epic page
      if (epicId) {
        form.append("epic_code", String(epicId));
      }
      
      // Assignee is optional
      if (assignee && assignee.trim()) {
        form.append("assignee", assignee.trim().toUpperCase());
      }
      
      // Get assigned_team_code: prioritize from assignee, fallback to selected team
      let teamCodeToSend: string | null = null;
      if (assignee && assignee.trim()) {
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
        teamCodeToSend = String(team).trim();
      }
      // Send assigned_team_code if we have one
      if (teamCodeToSend) {
        form.append("assigned_team_code", teamCodeToSend);
      }
      
      form.append("priority_code", String(priority));
      form.append("task_type_code", taskType);
      
      // work_mode is optional
      if (workMode) {
        form.append("work_mode", workMode);
      }
      
      // Dates are optional - use YYYY-MM-DD format (API accepts both DD-MM-YYYY and YYYY-MM-DD)
      if (startDate) {
        form.append("start_date", startDate.format("YYYY-MM-DD"));
      }
      if (dueDate) {
        form.append("due_date", dueDate.format("YYYY-MM-DD"));
      }
      
      form.append("estimated_hours", String(estHours));
      // Required estimated_days: already validated to be > 0
      form.append("estimated_days", String(estimatedDays));

      // Reporter is optional - will be auto-determined if not provided
      try {
        const { getUserFromStorage } = await import("@/app/lib/auth/storage");
        const user = getUserFromStorage();
        if (user?.userCode) {
          form.append("reporter", String(user.userCode).trim().toUpperCase());
        }
      } catch { }

      // status_code is optional (defaults to STS001), but we'll set it explicitly
      form.append("status_code", "STS001");

      // Task dependencies: none from this single-task form (can be wired later)
      form.append("depends_on_task_ids", "");

      // attachments are optional
      if (files.length > 0) {
        files.forEach((f) => {
          form.append("attachments", f);
        });
      }

      await apiRequest("create_task", "POST", form);
      toast.success("Task created successfully");
      // Redirect to epics page with the epic expanded (if epicId provided) or tasks page
      if (onCreated) {
        onCreated();
      } else {
        // If no onCreated callback, redirect directly
        if (epicId) {
          router.push(buildRoleHref(roleBase, `/epics?expandedEpic=${epicId}`));
        } else {
          router.push(buildRoleHref(roleBase, `/tasks`));
        }
      }
      // Reset form fields
      setTaskTitle("");
      setPriority("");
      setStartDate(null);
      setDueDate(null);
      setDescription("");
      setAssignee("");
      setTaskType("");
      setWorkMode("");
      setEstHours(null);
      setFiles([]);
      setUploadList([]);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to create task";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    // Validate required fields for template
    if (!taskTitle || !taskTitle.trim()) {
      toast.error("Task title is required");
      return;
    }
    if (!priority) {
      toast.error("Priority is required");
      return;
    }
    if (!workMode) {
      toast.error("Work mode is required");
      return;
    }
    if (!estHours || estHours <= 0) {
      toast.error("Estimated hours is required and must be greater than 0");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();

      // Template type
      form.append('template_type', 'TASK');

      // Task fields
      form.append('task_title', taskTitle.trim());
      form.append('task_description', description || '');
      form.append('task_status_code', 'STS001'); // Default status
      form.append('task_priority_code', String(priority));
      // Task type code (optional)
      if (taskType) {
        form.append('task_type_code', taskType);
      }

      // Estimated hours
      form.append('task_estimated_hours', String(estHours));
      // Calculate estimated_days from estimated_hours (divide by 8)
      const taskEstimatedDays = estHours > 0 ? estHours / 8 : 1; // At least 1 day if hours is 0
      form.append('task_estimated_days', String(taskEstimatedDays));

      // Get work_mode code from workMode (could be code or label)
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
        // If we can't resolve, use the value as is
      }
      form.append('work_mode', workModeCode);

      // Get team_code: prioritize from assignee, fallback to selected team
      // The team state should already contain team_code (not team name) since the dropdown uses team_code as value
      let teamCodeToSend: string | null = null;
      if (assignee) {
        try {
          const md = getMasterDataFromCache<any>();
          const employees = md?.data?.employees || [];
          const emp = employees.find((e: any) =>
            String(e.user_code).toUpperCase() === String(assignee).toUpperCase()
          );
          if (emp?.team_code) {
            teamCodeToSend = String(emp.team_code);
          }
        } catch {
          // Ignore if we can't get team code
        }
      }
      // If no team_code from assignee, use selected team (should already be team_code)
      if (!teamCodeToSend && team) {
        teamCodeToSend = String(team).trim();
      }
      // Send team_code if we have one (only send if it's a valid team code format)
      if (teamCodeToSend && teamCodeToSend.length > 0) {
        form.append('team_code', teamCodeToSend);
      }

      // Dates
      if (startDate) {
        form.append('start_date', dayjs(startDate).format('DD-MM-YYYY'));
      }
      if (dueDate) {
        form.append('due_date', dayjs(dueDate).format('DD-MM-YYYY'));
      }

      // task_estimated_hours and task_estimated_days already added above
      form.append('task_is_billable', 'true'); // Default to true

      const response = await apiRequest<any>('save_template', 'POST', form);

      if (response?.success || response?.success_flag || response?.Status_Flag) {
        toast.success(response?.message || response?.Status_Description || 'Task template saved successfully');
        // Stay on the same page after saving template (no redirect)
      } else {
        const errorMsg = response?.message || response?.Status_Description || response?.error || 'Failed to save template';
        toast.error(errorMsg);
      }
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : "Failed to save task template";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-sm">
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
              onBlur={() => handleFieldBlur('taskTitle', taskTitle)}
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
              onBlur={() => handleFieldBlur('estHours', estHours)}
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
              onBlur={() => handleFieldBlur('priority', priority)}
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
              onBlur={() => handleFieldBlur('taskType', taskType)}
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
              onBlur={() => handleFieldBlur('startDate', startDate)}
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
              onBlur={() => handleFieldBlur('dueDate', dueDate)}
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
              onBlur={() => handleFieldBlur('team', team)}
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
              onBlur={() => handleFieldBlur('assignee', assignee)}
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
              onBlur={() => handleFieldBlur('workMode', workMode)}
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
        {/* Show "Create Task" button only when epicId is provided and hideCreateButton is not true */}
        {epicId && !hideCreateButton && (
          <Button
            onClick={handleCreate}
            type="primary"
            loading={loading}
            disabled={loading}
            size="middle"
            className="px-6 rounded-md bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Creating...' : 'Create Task'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default CreateTaskForm;

