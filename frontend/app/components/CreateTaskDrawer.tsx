"use client";

import { Drawer, Select, Input, InputNumber, DatePicker, Upload } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { toast } from "react-hot-toast";
import React, { useEffect, useState, useMemo } from "react";
import { ClockCircleOutlined, CalendarOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { apiRequest, getMasterDataFromCache } from "@/app/lib/api";
import { getPriorityOptions, getTaskTypeOptions, getWorkLocationOptions, onMasterDataChange } from "@/app/lib/masterData";

interface CreateTaskDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  epicId?: string; // Optional epic ID if task is being created under an epic
  onCreated?: () => void; // Callback to refresh lists after successful creation
}

const labelCls = "block text-[13px] font-medium text-gray-700 mb-1";
const required = <span className="text-red-500"> *</span>;

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

const CreateTaskDrawer: React.FC<CreateTaskDrawerProps> = ({ open, onClose, title = "Create Task", epicId, onCreated }) => {
  const [taskTitle, setTaskTitle] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(null);
  const [dueDate, setDueDate] = useState<dayjs.Dayjs | null>(null);
  const [description, setDescription] = useState<string>("");
  const [assignee, setAssignee] = useState<string>("");
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
  const [files, setFiles] = useState<File[]>([]);
  const [uploadList, setUploadList] = useState<UploadFile[]>([]);

  useEffect(() => {
    const loadReporterName = async () => {
      try {
        const { getUserFromStorage } = await import("../lib/auth/storage");
        const user = getUserFromStorage();
        if (user?.userName) setReporterName(user.userName);
      } catch {}
    };
    if (open) {
      loadReporterName();
      // Reset form fields when drawer opens
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
    }
  }, [open]);

  // Build assignee options: if logged-in user is a team lead, show only their team members; otherwise show all
  useEffect(() => {
    const buildOptions = async () => {
      const md = getMasterDataFromCache<import("@/app/lib/masterData").MasterApiResponse>();
      const employees = md?.data?.employees || [];
      let userCode = '';
      let teamName = '';
      try {
        const { getUserFromStorage } = await import("../lib/auth/storage");
        const user = getUserFromStorage();
        if (user) {
          userCode = String(user.userCode || '');
          teamName = String(user.teamName || '');
        }
      } catch {
        // Ignore errors
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
    return () => { try { off?.(); } catch {} };
  }, [open]);

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

  const handleCreate = async () => {
    // Validate required fields and relationships
    const missing: string[] = [];
    if (!taskTitle) missing.push("Task Title");
    if (!description) missing.push("Description");
    // product not required by API
    if (!assignee) missing.push("Assignee");
    if (!priority) missing.push("Priority");
    if (!taskType) missing.push("Task Type");
    if (!workMode) missing.push("Work Mode");
    // Start Date is optional; it will be set automatically when status becomes In Progress
    if (!dueDate) missing.push("Due Date");
    if (estHours == null || estHours <= 0) missing.push("Estimated Hours");
    if (missing.length) {
      toast.error(`Please fill required: ${missing.join(', ')}`);
      return;
    }
    // Start date cannot be in the past
    if (startDate && startDate.startOf('day').isBefore(dayjs().startOf('day'))) {
      toast.error("Start date cannot be before today");
      return;
    }
    // Due date cannot be before start date (when start date provided), and cannot be in the past
    if (dueDate) {
      if (dueDate.startOf('day').isBefore(dayjs().startOf('day'))) {
        toast.error("Due date cannot be before today");
        return;
      }
      if (startDate && dueDate.startOf('day').isBefore(startDate.startOf('day'))) {
        toast.error("Due date cannot be before start date");
        return;
      }
    }
    // Estimated days (derived from hours) must be > 0 because backend requires it
    if (estimatedDays == null || estimatedDays <= 0) {
      toast.error("Estimated days is required and must be greater than 0. Please enter estimated hours > 0.");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      
      // Required fields
      form.append("task_title", taskTitle);
      form.append("task_desc", description);
      if (epicId) {
        form.append("epic_code", String(epicId));
      }
      form.append("assignee", assignee.trim().toUpperCase());
      form.append("priority_code", String(priority));
      form.append("task_type_code", taskType);
      form.append("work_mode", workMode);
      form.append("due_date", dayjs(dueDate).format("DD-MM-YYYY"));
      form.append("estimated_hours", String(estHours));
      // Required estimated_days: already validated to be > 0
      form.append("estimated_days", String(estimatedDays));
      
      // Optional fields
      try {
        const { getUserFromStorage } = await import("../lib/auth/storage");
        const user = getUserFromStorage();
        if (user?.userCode) {
          form.append("reporter", String(user.userCode).trim().toUpperCase());
        }
      } catch {}
      
      // status_code is optional (defaults to STS001), but we'll set it explicitly
      form.append("status_code", "STS001");
      
      // start_date is optional
      if (startDate) {
        form.append("start_date", dayjs(startDate).format("DD-MM-YYYY"));
      }

      // Task dependencies: none from this UI (can be wired later)
      form.append("depends_on_task_ids", "");
      
      // attachments are optional
      if (files.length) {
        for (const f of files) {
          form.append("attachments", f);
        }
      }

      await apiRequest("create_task", "POST", form);
      toast.success("Task created successfully");
      try { onCreated && onCreated(); } catch {}
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
      onClose();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to create task";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      title={title}
      placement="right"
      width={600}
      open={open}
      onClose={onClose}
      styles={{ body: { paddingTop: 0 } }}
    >
      <div className="text-[13px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
          {/* Task Title */}
          <div className="md:col-span-2">
            <label className={labelCls}>Task Title{required}</label>
            <Input
              placeholder="Enter title"
              size="small"
              value={taskTitle}
              onChange={(e)=>setTaskTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className={labelCls}>Description{required}</label>
            <Input.TextArea
              placeholder="Description"
              rows={4}
              className="text-[13px]"
              value={description}
              onChange={(e)=>setDescription(e.target.value)}
            />
          </div>

          {/* Priority */}
          <div>
            <label className={labelCls}>Priority{required}</label>
            <Select
              placeholder="Select priority"
              size="small"
              className="w-full"
              value={priority || undefined}
              onChange={setPriority}
              options={getPriorityOptions()}
            />
          </div>

          {/* Start Date (optional) */}
          <div>
            <label className={labelCls}>Start Date</label>
            <DatePicker
              placeholder="Select start date"
              size="small"
              className="w-full"
              format="DD-MM-YYYY"
              value={startDate}
              onChange={setStartDate}
              disabledDate={(current) => {
                const today = dayjs().startOf('day');
                return current && current < today;
              }}
              suffixIcon={<CalendarOutlined className="text-gray-400" />}
            />
          </div>

          {/* Due Date */}
          <div>
            <label className={labelCls}>Due Date{required}</label>
            <DatePicker
              placeholder="Select due date"
              size="small"
              className="w-full"
              format="DD-MM-YYYY"
              value={dueDate}
              onChange={setDueDate}
              disabledDate={(current) => {
                const today = dayjs().startOf('day');
                if (startDate) {
                  return current && current < dayjs(startDate).startOf('day');
                }
                return current && current < today;
              }}
              suffixIcon={<CalendarOutlined className="text-gray-400" />}
            />
            {startDate && estimatedDays != null && estimatedDays > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                Auto-calculated from start date ({startDate.format('DD-MM-YYYY')}) + {estimatedDays} working days (skips weekends)
              </div>
            )}
          </div>

          {/* Assignee */}
          <div>
            <label className={labelCls}>Assignee{required}</label>
            <Select
              showSearch
              placeholder="Select assignee"
              size="small"
              className="w-full"
              value={assignee || undefined}
              onChange={(v)=> setAssignee(String(v))}
              options={assigneeOptions}
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            />
          </div>

          {/* Task Type */}
          <div>
            <label className={labelCls}>Task Type{required}</label>
            <Select
              placeholder="Select type"
              size="small"
              className="w-full"
              value={taskType || undefined}
              onChange={setTaskType}
              options={getTaskTypeOptions()}
            />
          </div>

          {/* Work Mode */}
          <div>
            <label className={labelCls}>Work Mode{required}</label>
            <Select
              placeholder="Select work mode"
              size="small"
              className="w-full"
              value={workMode || undefined}
              onChange={setWorkMode}
              options={getWorkLocationOptions()}
            />
          </div>

          {/* Estimated Hours */}
          <div>
            <label className={labelCls}>Estimated Hours{required}</label>
            <InputNumber
              placeholder="0.5"
              size="small"
              min={0.5}
              step={0.5}
              stringMode
              className="w-full"
              addonAfter={<ClockCircleOutlined className="text-gray-400" />}
              value={estHours ?? undefined}
              precision={2}
              onChange={(v)=>{
                const n = Number(v);
                setEstHours(Number.isFinite(n) ? n : null);
              }}
              onKeyDown={handleNumberKeyDown}
            />
          </div>

          {/* Estimated Days (calculated from estimated hours) */}
          <div>
            <label className={labelCls}>Estimated Days</label>
            <InputNumber
              placeholder="0"
              size="small"
              className="w-full"
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
            <Input value={reporterName} placeholder="Reporter" size="small" disabled />
          </div>

          {/* Attachments */}
          <div className="md:col-span-2">
            <label className={labelCls}>Attachments</label>
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
              height={100}
            >
              <div className="text-center text-xs text-gray-600">
                <p>Drag and drop files here or click to browse</p>
              </div>
            </Upload.Dragger>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end pt-6">
          <button onClick={handleCreate} disabled={loading} className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50">{loading? 'Creating...' : 'Create Task'}</button>
        </div>
      </div>
    </Drawer>
  );
};

export default CreateTaskDrawer;


