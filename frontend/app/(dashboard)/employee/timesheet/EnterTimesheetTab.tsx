"use client";
import { useState, useEffect } from "react";
import { Form, Input, Select, InputNumber, Upload, Button, Row, Col, DatePicker, Radio, Switch } from "antd";
import { UploadOutlined, CalendarOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { toast } from "react-hot-toast";
import { useRouter, usePathname } from "next/navigation";
import { apiRequest } from "@/app/lib/api";
import { getTaskTypeOptions, getWorkLocationOptions, getEpicOptions, getProductOptions, getActivityOptions } from "@/app/lib/masterData";
import { getRoleBase, buildRoleHref } from "@/app/lib/paths";
import type { TaskApiData } from "@/app/types/api";

interface EnterTimesheetTabProps {
  onClose: () => void;
  mode?: "create" | "view";
  entryData?: any;
  onApprove?: () => void;
  onReject?: () => void;
  hideActionButtons?: boolean;
  initialDate?: dayjs.Dayjs | null;
  onSuccess?: () => void;
}

export default function EnterTimesheetTab({ 
  onClose, 
  mode = "create",
  entryData,
  onApprove,
  onReject,
  hideActionButtons = false,
  initialDate,
  onSuccess
}: EnterTimesheetTabProps) {
  const router = useRouter();
  const pathname = usePathname();
  const roleBase = getRoleBase(pathname || '');
  const [form] = Form.useForm();
  const [epics] = useState<{ value: string; label: string }[]>(getEpicOptions());
  const [tasks, setTasks] = useState<{ value: number; label: string }[]>([]);
  const [tasksData, setTasksData] = useState<Map<number, TaskApiData>>(new Map());
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [selectedEpic, setSelectedEpic] = useState<string | null>(null);
  const [tickets, setTickets] = useState<{ value: number; label: string }[]>([]);
  const [ticketsData, setTicketsData] = useState<Map<number, any>>(new Map());
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedWorkLocation, setSelectedWorkLocation] = useState<string>("");
  // entryType controls which layout / payload we use:
  // - 'timesheet' and 'stsTickets' use the regular timesheet flow
  // - 'outdoor' uses the simplified outdoor activities flow
  const [entryType, setEntryType] = useState<'timesheet' | 'outdoor' | 'stsTickets'>('timesheet');
  
  // Watch work location value from form
  const workLocationValue = Form.useWatch('workLocation', form);
  // Watch hours to derive overtime info in the UI
  const hoursValue = Form.useWatch('hours', form);
  // Watch entry date to disable submit for future dates
  const entryDateValue = Form.useWatch('entryDate', form);
  const [formData, setFormData] = useState({
    entryDate: dayjs(),
    epic: "",
    task: "",
    taskType: "",
    hours: 0.5,
    workLocation: "",
    travelTime: 0,
    waitingTime: 0,
    description: "",
    attachments: [] as any[],
  });

  // Fetch tickets when entryType is 'stsTickets'
  useEffect(() => {
    const fetchTickets = async () => {
      if (entryType !== 'stsTickets') {
        setTickets([]);
        setTicketsData(new Map());
        return;
      }

      setLoadingTickets(true);
      try {
        // Get logged-in user code
        let loggedInUserCode: string | null = null;
        if (typeof window !== 'undefined') {
          try {
            const raw = window.localStorage.getItem('user');
            if (raw) {
              const parsed = JSON.parse(raw) as { userCode?: string };
              loggedInUserCode = parsed?.userCode || null;
            }
          } catch {
            // ignore
          }
        }

        // Build query params
        // Note: API automatically filters by logged-in user (from x-user-code header)
        const params: Record<string, string> = {};
        // Don't set limit - let API return all tickets (no limit)
        // params.limit = '100'; // Removed to get all tickets
        params.offset = '0';
        // Show all tickets (both open and closed) - removed is_closed filter
        // params.is_closed = 'false'; // Removed to show all tickets

        const qs = new URLSearchParams(params).toString();
        const endpoint = `get_tickets?${qs}`;
        const resp = await apiRequest<{ success_flag: boolean; data: { tickets: any[] } }>(endpoint, 'GET');
        const items: any[] = Array.isArray(resp?.data?.tickets) ? resp.data.tickets : [];
        
        // If viewing or editing a ticket entry (including drafts), add it to the list even if it's closed (so it displays correctly)
        if ((mode === "view" || mode === "create") && entryData) {
          const apiData = entryData?.rawData || entryData || {};
          const isTicketEntry = apiData.ticket_code && (!apiData.task_code || apiData.task_code === 0) && (!apiData.activity_code || apiData.activity_code === 0);
          
          if (isTicketEntry && apiData.ticket_code) {
            // Check if ticket is already in the list
            const ticketExists = items.some(t => t.ticket_code === apiData.ticket_code);
            if (!ticketExists) {
              // Add the ticket from entry data to the list
              // Use correct field names from view_timesheet_entry: ticket_company_name, ticket_product_name, ticket_is_billable
              items.unshift({
                ticket_code: apiData.ticket_code,
                ticket_title: apiData.ticket_title || `Ticket ${apiData.ticket_code}`,
                ticket_description: apiData.ticket_description || "",
                ticket_status: apiData.ticket_status || apiData.ticket_status_description || "",
                ticket_priority: apiData.ticket_priority || apiData.ticket_priority_description || "",
                company_name: apiData.ticket_company_name || apiData.company_name || "",
                product_name: apiData.ticket_product_name || apiData.product_name || "",
                is_billable: apiData.ticket_is_billable !== undefined ? apiData.ticket_is_billable : (apiData.is_billable || false),
              });
            }
          }
        }
        
        const ticketOptions = items.map((ticket) => ({
          value: ticket.ticket_code || 0,
          label: ticket.ticket_title 
            ? `${ticket.ticket_title} - ${ticket.ticket_code || ''}`
            : `Ticket ${ticket.ticket_code || ''}`,
        }));
        setTickets(ticketOptions);
        
        // Store full ticket data in a Map for quick lookup
        const ticketDataMap = new Map<number, any>();
        items.forEach((ticket) => {
          if (ticket.ticket_code) {
            ticketDataMap.set(ticket.ticket_code, ticket);
          }
        });
        setTicketsData(ticketDataMap);
      } catch (error) {
        console.error("Failed to fetch tickets:", error);
        setTickets([]);
        toast.error("Failed to load tickets. Please try again.");
      } finally {
        setLoadingTickets(false);
      }
    };

    fetchTickets();
  }, [entryType, mode, entryData]);

  // Fetch tasks when epic is selected
  useEffect(() => {
    const fetchTasks = async (epicId: string) => {
      setLoadingTasks(true);
      setTasks([]);
      try {
        // Get logged-in user code
        let loggedInUserCode: string | null = null;
        if (typeof window !== 'undefined') {
          try {
            const raw = window.localStorage.getItem('user');
            if (raw) {
              const parsed = JSON.parse(raw) as { userCode?: string };
              loggedInUserCode = parsed?.userCode || null;
            }
          } catch {
            // ignore
          }
        }

        const params: Record<string, string> = {};
        params.epic_code = epicId;
        params.limit = '100';
        params.offset = '0';
        const qs = new URLSearchParams(params).toString();
        const endpoint = `get_tasks?${qs}`;
        const resp = await apiRequest<{ success_flag: boolean; data: { tasks: TaskApiData[] } }>(endpoint, 'GET');
        const items: TaskApiData[] = Array.isArray(resp?.data?.tasks) ? resp.data.tasks : [];
        
        // Filter tasks to only show those assigned to the logged-in user
        const filteredItems = loggedInUserCode
          ? items.filter((task) => {
              const assignee = task.task_assignee || task.assignee;
              return assignee && String(assignee).toLowerCase() === String(loggedInUserCode).toLowerCase();
            })
          : items; // If no user code found, show all tasks (fallback)
        
        const taskOptions = filteredItems.map((task) => ({
          value: task.task_id || 0,
          label: task.task_title || `Task ${task.task_id || ''}`,
        }));
        setTasks(taskOptions);
        
        // Store full task data in a Map for quick lookup
        const taskDataMap = new Map<number, TaskApiData>();
        filteredItems.forEach((task) => {
          if (task.task_id) {
            taskDataMap.set(task.task_id, task);
          }
        });
        setTasksData(taskDataMap);
        
        // If we're editing a draft and have a task_title but no task_code, find it now
        if (mode === "create" && entryData) {
          const apiData = entryData?.rawData || entryData || {};
          if (apiData.task_title && !apiData.task_code && !apiData.task) {
            const foundTask = taskOptions.find(opt => opt.label === apiData.task_title);
            if (foundTask) {
              form.setFieldsValue({ task: foundTask.value });
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch tasks:", error);
        setTasks([]);
      } finally {
        setLoadingTasks(false);
      }
    };

    if (selectedEpic) {
      fetchTasks(selectedEpic);
    } else {
      setTasks([]);
      setTasksData(new Map());
    }
  }, [selectedEpic, mode, entryData, form]);

  // Handle epic change
  const handleEpicChange = (epicId: string | null) => {
    setSelectedEpic(epicId);
    // Clear task selection when epic changes
    form.setFieldsValue({ task: undefined, taskType: undefined, workLocation: undefined });
    setTasksData(new Map());
  };

  // Handle task change - auto-populate taskType and workLocation
  const handleTaskChange = (taskId: number) => {
    // Check if this is a ticket (for STS Tickets entry type)
    if (entryType === 'stsTickets') {
      const ticket = ticketsData.get(taskId);
      if (ticket) {
        // For tickets, default task type to "Support" (TT012) if available
        const taskTypeOptions = getTaskTypeOptions();
        const supportTaskType = taskTypeOptions.find(opt => 
          opt.value === 'TT012' || opt.label?.toLowerCase().includes('support')
        );
        if (supportTaskType) {
          form.setFieldsValue({ taskType: supportTaskType.value });
        }
        // Default work location to "Office" for tickets
        const workLocationOptions = getWorkLocationOptions();
        const officeLocation = workLocationOptions.find(opt => 
          opt.value === 'OFFICE' || opt.label?.toLowerCase().includes('office')
        );
        if (officeLocation && !form.getFieldValue('workLocation')) {
          form.setFieldsValue({ workLocation: officeLocation.value });
          setSelectedWorkLocation(officeLocation.value);
        }
      }
      return;
    }

    // Regular task handling
    const task = tasksData.get(taskId);
    if (task) {
      // Auto-populate task type if available
      if (task.task_type_code) {
        form.setFieldsValue({ taskType: task.task_type_code });
      }
      
      // Auto-populate work location (mode) if available
      if (task.work_mode) {
        form.setFieldsValue({ workLocation: task.work_mode });
        setSelectedWorkLocation(task.work_mode);
      }
    }
  };

  // Handle work location change
  const handleWorkLocationChange = (value: string) => {
    setSelectedWorkLocation(value);
    // Clear travel and waiting time if not client site
    const workLocationOptions = getWorkLocationOptions();
    const selectedLocation = workLocationOptions.find(opt => opt.value === value);
    const isClientSite = selectedLocation?.label?.toLowerCase().includes('client site') || false;
    
    if (!isClientSite) {
      form.setFieldsValue({ travelTime: 0, waitingTime: 0 });
    }
  };

  // Sanitize numeric input value
  const sanitizeNumericValue = (value: number | null | undefined): number => {
    if (value === null || value === undefined || isNaN(value)) {
      return 0;
    }
    // Ensure value is within valid range
    if (value < 0) return 0;
    if (value > 24) return 24;
    return value;
  };

  // Check if current work location is client site
  const isClientSite = () => {
    const workLoc = workLocationValue || selectedWorkLocation;
    if (!workLoc) return false;
    const workLocationOptions = getWorkLocationOptions();
    const selectedLocation = workLocationOptions.find(
      opt => opt.value === workLoc || opt.label === workLoc
    );
    return selectedLocation?.label?.toLowerCase().includes('client site') || false;
  };
  
  // Update selectedWorkLocation when form value changes
  useEffect(() => {
    if (workLocationValue && workLocationValue !== selectedWorkLocation) {
      setSelectedWorkLocation(workLocationValue);
    }
  }, [workLocationValue, selectedWorkLocation]);

  useEffect(() => {
    if (mode === "view" && entryData) {
      // Handle full API response structure
      const apiData = entryData;
      
      // Check if this is a ticket entry (has ticket_code but no task_code or activity_code)
      const isTicketEntry = apiData.ticket_code && (!apiData.task_code || apiData.task_code === 0) && (!apiData.activity_code || apiData.activity_code === 0);
      // Check if this is an activity entry (has activity_code but no task_code)
      const isActivityEntry = apiData.activity_code && (!apiData.task_code || apiData.task_code === 0) && !isTicketEntry;
      
      if (isTicketEntry) {
        setEntryType('stsTickets');
        
        // Immediately add the ticket to the tickets list so it displays correctly in the dropdown
        if (apiData.ticket_code) {
          const ticketCode = Number(apiData.ticket_code);
          const ticketTitle = apiData.ticket_title || `Ticket ${apiData.ticket_code}`;
          
          // Check if ticket is already in the list
          setTickets(prev => {
            const exists = prev.some(t => t.value === ticketCode);
            if (!exists) {
              return [{
                value: ticketCode,
                label: ticketTitle ? `${ticketTitle} - ${ticketCode}` : `Ticket ${ticketCode}`,
              }, ...prev];
            }
            return prev;
          });
          
          // Add to ticketsData map
          // Use correct field names from view_timesheet_entry: ticket_company_name, ticket_product_name, ticket_is_billable
          setTicketsData(prev => {
            if (!prev.has(ticketCode)) {
              const newMap = new Map(prev);
              newMap.set(ticketCode, {
                ticket_code: ticketCode,
                ticket_title: ticketTitle,
                ticket_description: apiData.ticket_description || "",
                ticket_status: apiData.ticket_status || apiData.ticket_status_description || "",
                ticket_priority: apiData.ticket_priority || apiData.ticket_priority_description || "",
                company_name: apiData.ticket_company_name || apiData.company_name || "",
                product_name: apiData.ticket_product_name || apiData.product_name || "",
                is_billable: apiData.ticket_is_billable !== undefined ? apiData.ticket_is_billable : (apiData.is_billable || false),
              });
              return newMap;
            }
            return prev;
          });
        }
      } else if (isActivityEntry) {
        setEntryType('outdoor');
      }
      
      // Get activity title for activity entries
      let activityTitle = "";
      if (isActivityEntry) {
        if (apiData.activity_code) {
          const activityOptions = getActivityOptions();
          const foundActivity = activityOptions.find(opt => opt.value === String(apiData.activity_code));
          activityTitle = foundActivity?.label || apiData.activity_title || "";
        }
      }
      
      // For activity entries, use activity_description; for regular entries, use description
      const descriptionValue = isActivityEntry 
        ? (apiData.activity_description || apiData.description || "")
        : (apiData.description || "");
      
      form.setFieldsValue({
        entryType: isTicketEntry ? 'stsTickets' : (isActivityEntry ? 'outdoor' : 'timesheet'), // Set entry type in form
        entryDate: apiData.entry_date ? dayjs(apiData.entry_date) : (apiData.entryDate ? dayjs(apiData.entryDate) : dayjs()),
        // Prefer human-readable titles/names in view mode
        epic: apiData.epic_title || apiData.epic || apiData.epic_code || "",
        // For tickets, use ticket_code as the value (dropdown uses code as value, title as label)
        // Convert to number to match dropdown option values
        // For tasks, prefer task_title for display but will need to find the code
        task: isTicketEntry 
          ? (apiData.ticket_code ? Number(apiData.ticket_code) : "")
          : (apiData.task_title || apiData.task || apiData.task_code || ""),
        taskType: apiData.task_type_name || apiData.taskType || apiData.task_type_code || "",
        hours: parseFloat(apiData.actual_hours_worked) || apiData.hours || 0.5,
        workLocation: isTicketEntry 
          ? (apiData.work_location || apiData.work_location_name || apiData.workLocation || apiData.mode || apiData.work_location_code || "OFFICE")
          : (apiData.work_location || apiData.work_location_name || apiData.workLocation || apiData.mode || apiData.work_location_code || ""),
        travelTime: apiData.travel_time !== undefined && apiData.travel_time !== null
          ? (typeof apiData.travel_time === 'number' ? apiData.travel_time : parseFloat(apiData.travel_time) || 0)
          : (apiData.travelTime !== undefined && apiData.travelTime !== null
            ? (typeof apiData.travelTime === 'number' ? apiData.travelTime : parseFloat(apiData.travelTime) || 0)
            : 0),
        waitingTime: apiData.waiting_time !== undefined && apiData.waiting_time !== null
          ? (typeof apiData.waiting_time === 'number' ? apiData.waiting_time : parseFloat(apiData.waiting_time) || 0)
          : (apiData.waitingTime !== undefined && apiData.waitingTime !== null
            ? (typeof apiData.waitingTime === 'number' ? apiData.waitingTime : parseFloat(apiData.waitingTime) || 0)
            : 0),
        description: descriptionValue,
        attachments: apiData.attachments || [],
        title: activityTitle || "",
      });
      if (apiData.epic_code || apiData.epic) {
        setSelectedEpic(String(apiData.epic_code || apiData.epic));
      }
      // Set work location for conditional rendering
      // Check both work_location (new format) and work_location_code (old format) for backward compatibility
      const workLoc = apiData.work_location || apiData.work_location_name || apiData.workLocation || apiData.mode || apiData.work_location_code || "";
      if (workLoc) {
        // Find the code from the name or use the code directly
        const workLocationOptions = getWorkLocationOptions();
        const foundLocation = workLocationOptions.find(
          opt => opt.label === workLoc || opt.value === workLoc
        );
        setSelectedWorkLocation(foundLocation?.value || workLoc);
      }
    } else if (mode === "create") {
      // In create mode (including editing drafts), use CODES not labels
      const apiData = entryData?.rawData || entryData || {};
      
      // Get epic code - prefer code, fallback to finding code from name
      // epic_code should be the epic ID (number)
      let epicCode = apiData.epic_code || apiData.epic;
      if (!epicCode && apiData.epic_title) {
        const epicOptions = getEpicOptions();
        const foundEpic = epicOptions.find(opt => opt.label === apiData.epic_title);
        epicCode = foundEpic?.value;
      }
      // Ensure epicCode is a string (epic options use String(epic.id))
      if (epicCode) {
        epicCode = String(epicCode);
      }
      
      // Get task code - prefer code, fallback to finding code from name
      // Note: If we only have task_title, we'll set it after tasks are fetched in the tasks useEffect
      let taskCode = apiData.task_code || apiData.task;
      
      // Get task type code - prefer code, fallback to finding code from name
      let taskTypeCode = apiData.task_type_code || apiData.taskType;
      if (!taskTypeCode && apiData.task_type_name) {
        const taskTypeOptions = getTaskTypeOptions();
        const foundTaskType = taskTypeOptions.find(opt => opt.label === apiData.task_type_name);
        taskTypeCode = foundTaskType?.value;
      }
      
      // Get work location code - prefer code, fallback to finding code from name
      // Check both work_location (new format) and work_location_code (old format) for backward compatibility
      let workLocationCode = apiData.work_location || apiData.work_location_code || apiData.mode;
      if (!workLocationCode && (apiData.work_location_name || apiData.workLocation)) {
        const workLocationOptions = getWorkLocationOptions();
        const foundLocation = workLocationOptions.find(
          opt => opt.label === (apiData.work_location_name || apiData.workLocation)
        );
        workLocationCode = foundLocation?.value;
      }
      
      // Check if this is a ticket entry (has ticket_code but no task_code or activity_code)
      const isTicketEntry = apiData.ticket_code && (!apiData.task_code || apiData.task_code === 0 || apiData.task_code === null) && (!apiData.activity_code || apiData.activity_code === 0 || apiData.activity_code === null);
      // Check if this is an activity entry (has activity_code but no task_code)
      const isActivityEntry = apiData.activity_code && (!apiData.task_code || apiData.task_code === 0 || apiData.task_code === null) && !isTicketEntry;
      
      if (isTicketEntry) {
        setEntryType('stsTickets');
        
        // Immediately add the ticket to the tickets list so it displays correctly in the dropdown
        if (apiData.ticket_code) {
          const ticketCode = Number(apiData.ticket_code);
          const ticketTitle = apiData.ticket_title || `Ticket ${apiData.ticket_code}`;
          
          // Check if ticket is already in the list
          setTickets(prev => {
            const exists = prev.some(t => t.value === ticketCode);
            if (!exists) {
              return [{
                value: ticketCode,
                label: ticketTitle ? `${ticketTitle} - ${ticketCode}` : `Ticket ${ticketCode}`,
              }, ...prev];
            }
            return prev;
          });
          
          // Add to ticketsData map
          // Use correct field names from view_timesheet_entry: ticket_company_name, ticket_product_name, ticket_is_billable
          setTicketsData(prev => {
            if (!prev.has(ticketCode)) {
              const newMap = new Map(prev);
              newMap.set(ticketCode, {
                ticket_code: ticketCode,
                ticket_title: ticketTitle,
                ticket_description: apiData.ticket_description || "",
                ticket_status: apiData.ticket_status || apiData.ticket_status_description || "",
                ticket_priority: apiData.ticket_priority || apiData.ticket_priority_description || "",
                company_name: apiData.ticket_company_name || apiData.company_name || "",
                product_name: apiData.ticket_product_name || apiData.product_name || "",
                is_billable: apiData.ticket_is_billable !== undefined ? apiData.ticket_is_billable : (apiData.is_billable || false),
              });
              return newMap;
            }
            return prev;
          });
        }
      } else if (isActivityEntry) {
        setEntryType('outdoor');
      }
      
      // Get ticket code for ticket entries
      let ticketCode = "";
      if (isTicketEntry) {
        ticketCode = String(apiData.ticket_code || "");
      }
      
      // Get activity code/title for activity entries
      let activityCode = "";
      if (isActivityEntry) {
        activityCode = String(apiData.activity_code || "");
        // If we have activity_title but not activity_code, try to find it from master data
        if (!activityCode && apiData.activity_title) {
          const activityOptions = getActivityOptions();
          const foundActivity = activityOptions.find(opt => opt.label === apiData.activity_title);
          activityCode = foundActivity?.value || "";
        }
      }
      
      // For activity entries, use activity_description; for regular entries, use description
      const descriptionValue = isActivityEntry 
        ? (apiData.activity_description || apiData.description || "")
        : (apiData.description || "");
      
      // For ticket entries, default task type to Support if not provided
      if (isTicketEntry && !taskTypeCode) {
        taskTypeCode = 'TT012';
      }
      
      form.setFieldsValue({
        entryType: isTicketEntry ? 'stsTickets' : (isActivityEntry ? 'outdoor' : 'timesheet'), // Set entry type in form
        entryDate: apiData.entry_date ? dayjs(apiData.entry_date) : (apiData.entryDate ? dayjs(apiData.entryDate) : (initialDate || dayjs())),
        epic: epicCode || "",
        task: isTicketEntry 
          ? (apiData.ticket_code ? Number(apiData.ticket_code) : "") 
          : (taskCode || ""),
        taskType: taskTypeCode || "",
        hours: parseFloat(apiData.actual_hours_worked) || apiData.hours || 0.5,
        workLocation: isTicketEntry 
          ? (workLocationCode || "OFFICE")
          : (workLocationCode || ""),
        travelTime: apiData.travel_time !== undefined && apiData.travel_time !== null
          ? (typeof apiData.travel_time === 'number' ? apiData.travel_time : parseFloat(apiData.travel_time) || 0)
          : (apiData.travelTime !== undefined && apiData.travelTime !== null
            ? (typeof apiData.travelTime === 'number' ? apiData.travelTime : parseFloat(apiData.travelTime) || 0)
            : 0),
        waitingTime: apiData.waiting_time !== undefined && apiData.waiting_time !== null
          ? (typeof apiData.waiting_time === 'number' ? apiData.waiting_time : parseFloat(apiData.waiting_time) || 0)
          : (apiData.waitingTime !== undefined && apiData.waitingTime !== null
            ? (typeof apiData.waitingTime === 'number' ? apiData.waitingTime : parseFloat(apiData.waitingTime) || 0)
            : 0),
        description: descriptionValue,
        attachments: apiData.attachments || [],
        title: activityCode || "",
      });
      
      if (epicCode) {
        setSelectedEpic(String(epicCode));
      }
      
      if (workLocationCode) {
        setSelectedWorkLocation(workLocationCode);
      }
    }
  }, [mode, entryData, form, initialDate]);

  const handleSubmit = async (values: any, isDraft: boolean = false) => {
    if (mode === "view") {
      return;
    }

    setSubmitting(true);
    try {
      // If outdoor activities entry type, use simplified payload
      if (entryType === 'outdoor') {
        const formData = new FormData();
        
        // Check if this is an update to an existing entry (draft or pending)
        const rawData = entryData?.rawData || entryData || {};
        const existingEntryId = rawData.timesheet_entry_id || rawData.id;
        
        // If updating an existing entry, include the entry ID
        if (existingEntryId && entryData) {
          formData.append('timesheet_entry_id', String(existingEntryId));
        }
        
        // Entry date - from form
        const entryDate = values.entryDate ? dayjs(values.entryDate).format('DD-MM-YYYY') : dayjs().format('DD-MM-YYYY');
        formData.append('entry_date', entryDate);
        
        // Activity code and title - from form (get both code and label from the selected option)
        if (!values.title) {
          throw new Error('Please select an activity.');
        }
        const activityOptions = getActivityOptions();
        const selectedActivity = activityOptions.find(opt => opt.value === String(values.title));
        const activityCode = selectedActivity?.value || String(values.title);
        const activityTitle = selectedActivity?.label || String(values.title);
        
        // Validate activity code is a valid number
        const activityCodeNum = typeof activityCode === 'number' ? activityCode : Number(activityCode);
        if (isNaN(activityCodeNum)) {
          throw new Error('Invalid activity code. Please select a valid activity.');
        }
        
        formData.append('activity_code', String(activityCodeNum));
        formData.append('activity_title', activityTitle);
        
        // Activity description - from form
        formData.append('activity_description', values.description || '');
        
        // Hours worked - from form
        formData.append('actual_hours_worked', String(values.hours || 0));
        
        // Travel time and waiting time - from form (default to 0 if not provided)
        const travelTime = values.travelTime !== undefined && values.travelTime !== null ? values.travelTime : 0;
        const waitingTime = values.waitingTime !== undefined && values.waitingTime !== null ? values.waitingTime : 0;
        formData.append('travel_time', String(travelTime));
        formData.append('waiting_time', String(waitingTime));
        
        // Add approval status based on draft/submit
        if (isDraft) {
          formData.append('approval_status', 'DRAFT');
        } else {
          formData.append('approval_status', 'SUBMITTED');
        }
        
        // Handle file attachments - only if present in form
        if (values.attachments && Array.isArray(values.attachments) && values.attachments.length > 0) {
          values.attachments.forEach((file: any) => {
            if (file.originFileObj) {
              formData.append('attachments', file.originFileObj);
            } else if (file instanceof File) {
              formData.append('attachments', file);
            }
          });
        }

        // If saving as draft, call enter_timesheet API
        if (isDraft) {
          const response = await apiRequest<any>('enter_timesheet/', 'POST', formData);

          // Check response for success
          const hasExplicitError = 
            (response && typeof response === 'object' && 'success_flag' in response && response.success_flag === false) ||
            (response && typeof response === 'object' && 'error' in response && response.error);

          if (hasExplicitError) {
            const errorMsg = (response && typeof response === 'object' && 'message' in response) 
              ? response.message 
              : (response && typeof response === 'object' && 'error' in response)
              ? response.error
              : 'Failed to save timesheet entry as draft';
            toast.error(errorMsg);
            setSubmitting(false);
            return;
          }

          // Success
          toast.success('Timesheet entry saved as draft!');
          if (onSuccess) {
            onSuccess();
          }
          onClose();
          setSubmitting(false);
          return;
        } else {
          // If submitting (not draft), we need entry_id
          // If it's a new entry, first create it, then submit
          // If it's an existing entry, submit directly with entry_id
          let entryIdToSubmit = existingEntryId;
          
          if (!entryIdToSubmit) {
            // New entry - first create it
            const createResponse = await apiRequest<any>('enter_timesheet/', 'POST', formData);
            
            // Check response for success
            const hasExplicitError = 
              (createResponse && typeof createResponse === 'object' && 'success_flag' in createResponse && createResponse.success_flag === false) ||
              (createResponse && typeof createResponse === 'object' && 'error' in createResponse && createResponse.error);

            if (hasExplicitError) {
              const errorMsg = (createResponse && typeof createResponse === 'object' && 'message' in createResponse) 
                ? createResponse.message 
                : (createResponse && typeof createResponse === 'object' && 'error' in createResponse)
                ? createResponse.error
                : 'Failed to create timesheet entry';
              toast.error(errorMsg);
              setSubmitting(false);
              return;
            }

            // Get the entry ID from the response
            entryIdToSubmit = createResponse?.data?.timesheet_entry_id || createResponse?.data?.id || createResponse?.timesheet_entry_id || createResponse?.id;
            
            if (!entryIdToSubmit) {
              toast.error('Failed to get entry ID after creating timesheet entry');
              setSubmitting(false);
              return;
            }
          }
          
          // Now submit with entry_id
          const submitForm = new FormData();
          submitForm.append('entry_id', String(entryIdToSubmit));
          const response = await apiRequest<any>('submit_timesheet', 'POST', submitForm);

          // Check response for success
          const hasExplicitError = 
            (response && typeof response === 'object' && 'success_flag' in response && response.success_flag === false) ||
            (response && typeof response === 'object' && 'error' in response && response.error);

          if (hasExplicitError) {
            const errorMsg = (response && typeof response === 'object' && 'message' in response) 
              ? response.message 
              : (response && typeof response === 'object' && 'error' in response)
              ? response.error
              : 'Failed to submit timesheet entry';
            toast.error(errorMsg);
            setSubmitting(false);
            return;
          }

          // Success
          toast.success('Timesheet entry submitted successfully!');
          if (onSuccess) {
            onSuccess();
          }
          onClose();
          setSubmitting(false);
          return;
        }
      }

      // STS Tickets entry type
      if (entryType === 'stsTickets') {
        const formData = new FormData();
        
        // Check if this is an update to an existing entry (draft or pending)
        const rawData = entryData?.rawData || entryData || {};
        const existingEntryId = rawData.timesheet_entry_id || rawData.id;
        
        // If updating an existing entry, include the entry ID
        if (existingEntryId && entryData) {
          formData.append('timesheet_entry_id', String(existingEntryId));
        }
        
        // Entry date - from form
        const entryDate = values.entryDate ? dayjs(values.entryDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
        formData.append('entry_date', entryDate);
        
        // Ticket code - from form
        const ticketCode = values.task ? (typeof values.task === 'number' ? values.task : Number(values.task)) : null;
        if (!ticketCode || isNaN(ticketCode)) {
          throw new Error('Invalid ticket code. Please select a valid ticket.');
        }
        formData.append('ticket_code', String(ticketCode));
        
        // Task type code - defaults to Support (TT012) if not provided
        const taskTypeCode = values.taskType || 'TT012';
        formData.append('task_type_code', String(taskTypeCode));
        
        // Hours worked - from form
        formData.append('actual_hours_worked', String(values.hours || 0));
        
        // Travel time and waiting time - from form (default to 0 if not provided)
        const travelTime = values.travelTime !== undefined && values.travelTime !== null ? values.travelTime : 0;
        const waitingTime = values.waitingTime !== undefined && values.waitingTime !== null ? values.waitingTime : 0;
        formData.append('travel_time', String(travelTime));
        formData.append('waiting_time', String(waitingTime));
        
        // Calculate total hours
        const totalHours = (values.hours || 0) + travelTime + waitingTime;
        formData.append('total_hours', String(totalHours));
        
        // Work location - optional for tickets
        if (values.workLocation) {
          formData.append('work_location', String(values.workLocation));
        }
        
        // Description - optional for tickets
        formData.append('description', values.description || '');
        
        // Handle file attachments
        if (values.attachments && Array.isArray(values.attachments) && values.attachments.length > 0) {
          values.attachments.forEach((file: any) => {
            if (file.originFileObj) {
              formData.append('attachments', file.originFileObj);
            } else if (file instanceof File) {
              formData.append('attachments', file);
            }
          });
        }

        // If saving as draft, call enter_timesheet API
        if (isDraft) {
          const response = await apiRequest<any>('enter_timesheet/', 'POST', formData);

          // Check response for success
          const hasExplicitError = 
            (response && typeof response === 'object' && 'success_flag' in response && response.success_flag === false) ||
            (response && typeof response === 'object' && 'error' in response && response.error);

          if (hasExplicitError) {
            const errorMsg = (response && typeof response === 'object' && 'message' in response) 
              ? response.message 
              : (response && typeof response === 'object' && 'error' in response)
              ? response.error
              : 'Failed to save timesheet entry as draft';
            toast.error(errorMsg);
            setSubmitting(false);
            return;
          }

          // Success
          toast.success('Timesheet entry saved as draft!');
          if (onSuccess) {
            onSuccess();
          }
          onClose();
          setSubmitting(false);
          return;
        } else {
          // If submitting (not draft), we need entry_id
          // If it's a new entry, first create it, then submit
          // If it's an existing entry, submit directly with entry_id
          let entryIdToSubmit = existingEntryId;
          
          if (!entryIdToSubmit) {
            // New entry - first create it
            const createResponse = await apiRequest<any>('enter_timesheet/', 'POST', formData);
            
            // Check response for success
            const hasExplicitError = 
              (createResponse && typeof createResponse === 'object' && 'success_flag' in createResponse && createResponse.success_flag === false) ||
              (createResponse && typeof createResponse === 'object' && 'error' in createResponse && createResponse.error);

            if (hasExplicitError) {
              const errorMsg = (createResponse && typeof createResponse === 'object' && 'message' in createResponse) 
                ? createResponse.message 
                : (createResponse && typeof createResponse === 'object' && 'error' in createResponse)
                ? createResponse.error
                : 'Failed to create timesheet entry';
              toast.error(errorMsg);
              setSubmitting(false);
              return;
            }

            // Get the entry ID from the response
            entryIdToSubmit = createResponse?.data?.timesheet_entry_id || createResponse?.data?.id || createResponse?.timesheet_entry_id || createResponse?.id;
            
            if (!entryIdToSubmit) {
              toast.error('Failed to get entry ID after creating timesheet entry');
              setSubmitting(false);
              return;
            }
          }
          
          // Now submit with entry_id
          const submitForm = new FormData();
          submitForm.append('entry_id', String(entryIdToSubmit));
          const response = await apiRequest<any>('submit_timesheet', 'POST', submitForm);

          // Check response for success
          const hasExplicitError = 
            (response && typeof response === 'object' && 'success_flag' in response && response.success_flag === false) ||
            (response && typeof response === 'object' && 'error' in response && response.error);

          if (hasExplicitError) {
            const errorMsg = (response && typeof response === 'object' && 'message' in response) 
              ? response.message 
              : (response && typeof response === 'object' && 'error' in response)
              ? response.error
              : 'Failed to submit timesheet entry';
            toast.error(errorMsg);
            setSubmitting(false);
            return;
          }

          // Success
          toast.success('Timesheet entry submitted successfully!');
          if (onSuccess) {
            onSuccess();
          }
          onClose();
          setSubmitting(false);
          return;
        }
      }

      // Regular timesheet entry (existing logic)
      // Prepare FormData for multipart/form-data
      const formData = new FormData();

      // Check if this is an update to an existing entry (draft or pending)
      const rawData = entryData?.rawData || entryData || {};
      const existingEntryId = rawData.timesheet_entry_id || rawData.id;
      
      // If updating an existing entry, include the entry ID
      if (existingEntryId && entryData) {
        formData.append('timesheet_entry_id', String(existingEntryId));
      }

      // Required fields
      const entryDate = values.entryDate ? dayjs(values.entryDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
      formData.append('entry_date', entryDate);
      
      // Convert epic_code - ensure it's a valid number
      const epicCode = values.epic ? (typeof values.epic === 'number' ? values.epic : Number(values.epic)) : null;
      if (!epicCode || isNaN(epicCode)) {
        throw new Error('Invalid epic code. Please select a valid epic.');
      }
      formData.append('epic_code', String(epicCode));
      
      // Convert task_code - ensure it's a valid number
      const taskCode = values.task ? (typeof values.task === 'number' ? values.task : Number(values.task)) : null;
      if (!taskCode || isNaN(taskCode)) {
        throw new Error('Invalid task code. Please select a valid task.');
      }
      formData.append('task_code', String(taskCode));
      
      // task_type_code should already be a code (e.g., 'TT001')
      if (!values.taskType) {
        throw new Error('Invalid task type code. Please select a valid task type.');
      }
      formData.append('task_type_code', String(values.taskType));
      
      formData.append('actual_hours_worked', String(values.hours || 0));
      
      // Add approval status
      if (isDraft) {
        formData.append('approval_status', 'DRAFT');
      } else {
        // When submitting (not draft), set status to PENDING
        formData.append('approval_status', 'PENDING');
      }

      // Optional fields
      if (values.travelTime !== undefined && values.travelTime !== null) {
        formData.append('travel_time', String(values.travelTime || 0));
      }
      if (values.waitingTime !== undefined && values.waitingTime !== null) {
        formData.append('waiting_time', String(values.waitingTime || 0));
      }
      
      // Calculate total hours
      const totalHours = (values.hours || 0) + (values.travelTime || 0) + (values.waitingTime || 0);
      formData.append('total_hours', String(totalHours));

      // work_location should be the work location code (e.g., 'REMOTE', 'ON_SITE', 'OFFICE')
      if (values.workLocation) {
        formData.append('work_location', String(values.workLocation));
      }

      formData.append('description', values.description || '');

      // Handle file attachments
      if (values.attachments && Array.isArray(values.attachments) && values.attachments.length > 0) {
        values.attachments.forEach((file: any) => {
          if (file.originFileObj) {
            formData.append('attachments', file.originFileObj);
          } else if (file instanceof File) {
            formData.append('attachments', file);
          }
        });
      }

      // Call enter_timesheet API (create/update entry)
      // Add trailing slash to avoid 307 redirect
      const response = await apiRequest<any>(
        'enter_timesheet/',
        'POST',
        formData
      );

      console.log('enter_timesheet response:', response);

      // If we got here without an exception, the HTTP request was successful (200-299 status)
      // Since the data is being stored successfully, we'll treat any successful HTTP response as success
      // unless there's an explicit error in the response body
      const hasExplicitError = 
        (response && typeof response === 'object' && (
          response.error || 
          response.success_flag === false || 
          response.success === false ||
          (response.status_code && response.status_code >= 400)
        ));

      // Default to success if no explicit error
      if (!hasExplicitError) {
        // Determine entry_id for submit_timesheet
        let entryId: number | null = null;

        if (existingEntryId) {
          entryId = Number(existingEntryId);
        } else if (response) {
          // Try several common shapes: response.data.timesheet_entry_id, response.timesheet_entry_id, response.data.entry_id, etc.
          const data = (response as any).data || response;
          entryId =
            Number((data && (data.timesheet_entry_id ?? data.entry_id ?? data.id)) ?? NaN);
          if (isNaN(entryId)) {
            entryId = null;
          }
        }

        // If this is a real submit (not draft) and we have an entryId, call submit_timesheet
        if (!isDraft && entryId) {
          try {
            const submitForm = new FormData();
            submitForm.append('entry_id', String(entryId));
            const submitResp = await apiRequest<any>('submit_timesheet', 'POST', submitForm);
            console.log('submit_timesheet response:', submitResp);
          } catch (submitError) {
            console.error('Error calling submit_timesheet:', submitError);
            // We still show a generic success toast below for the save itself
          }
        }

        toast.success(
          response?.message ||
            (isDraft ? 'Timesheet entry saved as draft!' : 'Timesheet entry submitted successfully!'),
          {
            duration: 4000,
            position: 'top-right',
            style: {
              background: '#10b981',
              color: '#fff',
            },
          }
        );
        form.resetFields();
        setSelectedEpic(null);
        setTasks([]);
        // Call GET API to refresh timesheet list in real-time
        // Small delay to ensure database has been updated
        setTimeout(() => {
          onSuccess?.();
        }, 300);
        onClose();
      } else {
        // Only show error if there's an explicit error indicator in the response
        const errorMsg = response?.message || response?.error || response?.detail || 'Failed to submit timesheet entry';
        toast.error(errorMsg, {
          duration: 4000,
          position: 'top-right',
        });
      }
    } catch (error: any) {
      console.error('Error submitting timesheet:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        detail: error.detail,
        fullError: error
      });
      
      // If status is 200-299, treat as success (redirect might have succeeded)
      if (error.status && error.status >= 200 && error.status < 300) {
        toast.success(isDraft ? 'Timesheet entry saved as draft!' : 'Timesheet entry submitted successfully!', {
          duration: 4000,
          position: 'top-right',
          style: {
            background: '#10b981',
            color: '#fff',
          },
        });
        form.resetFields();
        setSelectedEpic(null);
        setTasks([]);
        // Call GET API to refresh timesheet list in real-time
        // Small delay to ensure database has been updated
        setTimeout(() => {
          onSuccess?.();
        }, 300);
        onClose();
      } else {
        const errorMessage = error.message || error.detail || 'Failed to submit timesheet entry. Please try again.';
        toast.error(errorMessage, {
          duration: 4000,
          position: 'top-right',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // View mode - display data directly without form
  if (mode === "view") {
    const rawData = entryData?.rawData || entryData || {};
    
    // Check if this is a ticket entry
    const isTicketEntry = rawData?.ticket_code && (!rawData?.task_code || rawData?.task_code === 0) && (!rawData?.activity_code || rawData?.activity_code === 0);
    
    const epicId = rawData?.epic_id || rawData?.epic_code || entryData?.epic_id || entryData?.epic_code || "";
    const taskId = rawData?.task_id || rawData?.task_code || entryData?.task_id || entryData?.task_code || "";
    const epicTitle = rawData?.epic_title || rawData?.epic || entryData?.epic_title || entryData?.epic || "";
    const taskTitle = rawData?.task_title || rawData?.task || entryData?.task_title || entryData?.task || "";
    
    // Ticket details
    const ticketCode = rawData?.ticket_code || entryData?.ticket_code || "";
    const ticketTitle = rawData?.ticket_title || entryData?.ticket_title || "";
    const ticketStatus = rawData?.ticket_status || entryData?.ticket_status || "";
    const ticketPriority = rawData?.ticket_priority || entryData?.ticket_priority || "";
    // Use correct field names from view_timesheet_entry: ticket_company_name, ticket_product_name
    const ticketCompany = rawData?.ticket_company_name || entryData?.ticket_company_name || rawData?.company_name || entryData?.company_name || "";
    const ticketProduct = rawData?.ticket_product_name || entryData?.ticket_product_name || rawData?.product_name || entryData?.product_name || "";
    const ticketDescription = rawData?.ticket_description || entryData?.ticket_description || "";
    const entryDate = rawData?.entry_date
      ? dayjs(rawData.entry_date)
      : (entryData?.entry_date
        ? dayjs(entryData.entry_date)
        : (entryData?.entryDate ? dayjs(entryData.entryDate) : null));
    const hours =
      parseFloat(rawData?.actual_hours_worked) ||
      parseFloat(rawData?.total_hours) ||
      parseFloat(rawData?.hours) ||
      parseFloat(entryData?.actual_hours_worked) ||
      parseFloat(entryData?.hours) ||
      0;
    const workLocation =
      rawData?.work_location ||
      rawData?.work_location_name ||
      rawData?.work_location_code ||
      rawData?.mode ||
      entryData?.work_location ||
      entryData?.work_location_name ||
      entryData?.workLocation ||
      entryData?.mode ||
      entryData?.work_location_code ||
      "";

    // Resolve task type display name: prefer task_type_name from API, then map code via master data
    const taskTypeCode =
      rawData?.task_type_code ||
      entryData?.task_type_code ||
      entryData?.taskType ||
      "";
    let taskType =
      rawData?.task_type_name ||
      entryData?.task_type_name ||
      "";
    if (!taskType && taskTypeCode) {
      try {
        const typeOptions = getTaskTypeOptions();
        const found = typeOptions.find(opt => String(opt.value) === String(taskTypeCode));
        if (found?.label) {
          taskType = String(found.label);
        } else {
          taskType = String(taskTypeCode);
        }
      } catch {
        taskType = String(taskTypeCode);
      }
    }

    const travelTime = parseFloat(rawData?.travel_time) || parseFloat(entryData?.travel_time) || parseFloat(entryData?.travelTime) || 0;
    const waitingTime = parseFloat(rawData?.waiting_time) || parseFloat(entryData?.waiting_time) || parseFloat(entryData?.waitingTime) || 0;
    const description = rawData?.description || entryData?.description || "";

    // Rejection reason (for rejected timesheet entries)
    const approvalStatusRaw =
      rawData.latest_approval_status ||
      rawData.approval_status ||
      rawData.status ||
      rawData.status_code ||
      entryData?.latest_approval_status ||
      entryData?.approval_status ||
      entryData?.status ||
      entryData?.status_code ||
      "";
    const approvalStatusUpper = String(approvalStatusRaw).toUpperCase();
    const isRejected =
      approvalStatusUpper === "REJECTED";
    const rejectionReason =
      rawData.rejection_reason ||
      rawData.latest_rejection_reason ||
      rawData.status_reason ||
      entryData?.rejection_reason ||
      entryData?.rejectionReason ||
      "";

    return (
      <div className="font-poppins">
        <div className="space-y-6">
          {/* Entry Date */}
          <div className="border-b border-gray-200 pb-5">
            <div className="flex items-start gap-6">
              <div className="w-36 flex-shrink-0">
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Entry Date</label>
              </div>
              <div className="flex-1">
                <div className="text-base font-semibold text-gray-900">
                  {entryDate ? entryDate.format("DD-MM-YYYY") : <span className="text-gray-400 font-normal">-</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Epic - only show for non-ticket entries */}
          {!isTicketEntry && (
            <div className="border-b border-gray-200 pb-5">
              <div className="flex items-start gap-6">
                <div className="w-36 flex-shrink-0">
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Epic</label>
                </div>
                <div className="flex-1">
                  {epicId && epicTitle ? (
                    <a
                      href={buildRoleHref(roleBase, `/epics/${epicId}`)}
                      onClick={(e) => {
                        e.preventDefault();
                        router.push(buildRoleHref(roleBase, `/epics/${epicId}`));
                      }}
                      className="inline-flex items-center gap-2 text-base font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <span>{epicTitle}</span>
                    </a>
                  ) : (
                    <div className="text-base font-semibold text-gray-900">{epicTitle || <span className="text-gray-400 font-normal">-</span>}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Task - only show for non-ticket entries */}
          {!isTicketEntry && (
            <div className="border-b border-gray-200 pb-5">
              <div className="flex items-start gap-6">
                <div className="w-36 flex-shrink-0">
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Task</label>
                </div>
                <div className="flex-1">
                  {taskId && taskTitle ? (
                    <a
                      href={buildRoleHref(roleBase, `/tasks/${taskId}`)}
                      onClick={(e) => {
                        e.preventDefault();
                        router.push(buildRoleHref(roleBase, `/tasks/${taskId}`));
                      }}
                      className="inline-flex items-center gap-2 text-base font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <span>{taskTitle}</span>
                    </a>
                  ) : (
                    <div className="text-base font-semibold text-gray-900">{taskTitle || <span className="text-gray-400 font-normal">-</span>}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Ticket - only show for ticket entries */}
          {isTicketEntry && (
            <>
              <div className="border-b border-gray-200 pb-5">
                <div className="flex items-start gap-6">
                  <div className="w-36 flex-shrink-0">
                    <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Ticket</label>
                  </div>
                  <div className="flex-1">
                    {ticketCode && ticketTitle ? (
                      <div className="inline-flex items-center gap-2 text-base font-semibold text-gray-900">
                        <span>{ticketTitle}</span>
                        <span className="text-gray-500 font-normal">({ticketCode})</span>
                      </div>
                    ) : ticketCode ? (
                      <div className="text-base font-semibold text-gray-900">Ticket {ticketCode}</div>
                    ) : (
                      <div className="text-base font-semibold text-gray-900"><span className="text-gray-400 font-normal">-</span></div>
                    )}
                  </div>
                </div>
              </div>

              {/* Ticket Status and Priority */}
              {(ticketStatus || ticketPriority) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {ticketStatus && (
                    <div className="border-b border-gray-200 pb-5">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Ticket Status</label>
                        <div className="text-base font-semibold text-gray-900">{ticketStatus}</div>
                      </div>
                    </div>
                  )}
                  {ticketPriority && (
                    <div className="border-b border-gray-200 pb-5">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Priority</label>
                        <div className="text-base font-semibold text-gray-900">{ticketPriority}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Ticket Company and Product */}
              {(ticketCompany || ticketProduct) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {ticketCompany && (
                    <div className="border-b border-gray-200 pb-5">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Company</label>
                        <div className="text-base font-semibold text-gray-900">{ticketCompany}</div>
                      </div>
                    </div>
                  )}
                  {ticketProduct && (
                    <div className="border-b border-gray-200 pb-5">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Product</label>
                        <div className="text-base font-semibold text-gray-900">{ticketProduct}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Ticket Description */}
              {ticketDescription && (
                <div className="border-b border-gray-200 pb-5">
                  <div className="flex items-start gap-6">
                    <div className="w-36 flex-shrink-0">
                      <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Ticket Description</label>
                    </div>
                    <div className="flex-1">
                      <div className="text-base text-gray-900 whitespace-pre-wrap">{ticketDescription}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Task Type */}
          {taskType && (
            <div className="border-b border-gray-200 pb-5">
              <div className="flex items-start gap-6">
                <div className="w-36 flex-shrink-0">
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Task Type</label>
                </div>
                <div className="flex-1">
                  <div className="text-base font-semibold text-gray-900">
                    {taskType}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hours and Work Location Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="border-b border-gray-200 pb-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Hours</label>
                <div className="text-lg font-semibold text-gray-900">{hours}h</div>
                {hours > 8 && (
                  <div className="text-[10px] text-orange-600 font-medium">
                    Overtime: {(hours - 8).toFixed(1)}h (total {hours.toFixed(1)}h)
                  </div>
                )}
              </div>
            </div>
            {workLocation && (
              <div className="border-b border-gray-200 pb-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Work Location</label>
                  <div className="text-base font-semibold text-gray-900">
                    {workLocation}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Travel Time and Waiting Time */}
          {(travelTime > 0 || waitingTime > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {travelTime > 0 && (
                <div className="border-b border-gray-200 pb-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Travel Time</label>
                    <div className="text-base font-semibold text-gray-900">{travelTime}h</div>
                  </div>
                </div>
              )}
              {waitingTime > 0 && (
                <div className="border-b border-gray-200 pb-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Waiting Time</label>
                    <div className="text-base font-semibold text-gray-900">{waitingTime}h</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {description && (
            <div className="border-b border-gray-200 pb-5">
              <div className="flex items-start gap-6">
                <div className="w-36 flex-shrink-0">
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Description</label>
                </div>
                <div className="flex-1">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{description}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rejection Reason (for rejected entries) */}
          {isRejected && rejectionReason && String(rejectionReason).trim() && (
            <div className="border-b border-gray-200 pb-5">
              <div className="flex items-start gap-6">
                <div className="w-36 flex-shrink-0">
                  <label className="block text-xs font-medium text-red-700 uppercase tracking-wide mb-1">
                    Rejection Reason
                  </label>
                </div>
                <div className="flex-1">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-700 leading-relaxed whitespace-pre-wrap">
                      {String(rejectionReason).trim()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Form
      form={form}
      onFinish={handleSubmit}
      layout="vertical"
      initialValues={{
        entryType: (entryData?.activity_code && (!entryData?.task_code || entryData?.task_code === 0 || entryData?.task_code === null)) ? 'outdoor' : 'timesheet',
        entryDate: entryData?.entry_date ? dayjs(entryData.entry_date) : (entryData?.entryDate ? dayjs(entryData.entryDate) : (initialDate || dayjs())),
        // Use codes for form values (will be set properly in useEffect)
        epic: "",
        task: "",
        taskType: "",
        hours: parseFloat(entryData?.actual_hours_worked) || entryData?.hours || 0.5,
        workLocation: "",
        travelTime: entryData?.travel_time !== undefined && entryData?.travel_time !== null 
          ? (typeof entryData.travel_time === 'number' ? entryData.travel_time : parseFloat(entryData.travel_time) || 0)
          : (entryData?.travelTime !== undefined && entryData?.travelTime !== null 
            ? (typeof entryData.travelTime === 'number' ? entryData.travelTime : parseFloat(entryData.travelTime) || 0)
            : 0),
        waitingTime: entryData?.waiting_time !== undefined && entryData?.waiting_time !== null
          ? (typeof entryData.waiting_time === 'number' ? entryData.waiting_time : parseFloat(entryData.waiting_time) || 0)
          : (entryData?.waitingTime !== undefined && entryData?.waitingTime !== null
            ? (typeof entryData.waitingTime === 'number' ? entryData.waitingTime : parseFloat(entryData.waitingTime) || 0)
            : 0),
        description: (entryData?.activity_code && (!entryData?.task_code || entryData?.task_code === 0 || entryData?.task_code === null)) 
          ? (entryData?.activity_description || entryData?.description || "")
          : (entryData?.description || ""),
        title: "",
      }}
      className="font-poppins"
    >
      {/* Entry Type Selection */}
      <Row gutter={16}>
        <Col xs={24} sm={24} md={24} lg={24} xl={24}>
          <Form.Item
            label={<span>Entry Type <span style={{ color: 'red' }}>*</span></span>}
            name="entryType"
            initialValue="timesheet"
            rules={[{ required: true, message: 'Please select entry type!' }]}
            required={false}
          >
            <Radio.Group 
              value={entryType} 
              onChange={(e) => {
                const nextType = e.target.value;
                setEntryType(nextType);
                form.resetFields(['epic', 'task', 'taskType', 'hours', 'workLocation', 'travelTime', 'waitingTime', 'description', 'attachments', 'title']);

                // For STS Tickets, default Task Type to "Support" (TT012) and work location to "Office"
                if (nextType === 'stsTickets') {
                  const taskTypeOptions = getTaskTypeOptions();
                  const supportType = taskTypeOptions.find(
                    (opt) => opt.value === 'TT012' || String(opt.label).toLowerCase() === 'support'
                  );
                  if (supportType) {
                    form.setFieldsValue({ taskType: supportType.value });
                  }
                  
                  // Default work location to "Office" for tickets
                  const workLocationOptions = getWorkLocationOptions();
                  const officeLocation = workLocationOptions.find(opt => 
                    opt.value === 'OFFICE' || opt.label?.toLowerCase().includes('office')
                  );
                  if (officeLocation) {
                    form.setFieldsValue({ workLocation: officeLocation.value });
                    setSelectedWorkLocation(officeLocation.value);
                  }
                }
              }}
            >
              {/* 'timesheet' = Epics (regular epic/task timesheet entries) */}
              <Radio value="timesheet">Epics</Radio>
              {/* 'stsTickets' = STS-specific ticket timesheet entries (shares regular timesheet flow) */}
              <Radio value="stsTickets">STS Tickets</Radio>
              {/* 'outdoor' = generic activities (was Outdoor Activities) */}
              <Radio value="outdoor">Activities</Radio>
            </Radio.Group>
          </Form.Item>
        </Col>
      </Row>

      {/* Regular timesheet layout is used for both 'timesheet' and 'stsTickets' */}
      {entryType === 'timesheet' || entryType === 'stsTickets' ? (
        <>
          {/* Entry Date Row */}
          <Row gutter={16}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Item
                label={<span>Entry Date <span style={{ color: 'red' }}>*</span></span>}
                name="entryDate"
                rules={[{ required: true, message: 'Please select entry date!' }]}
                required={false}
              >
                <DatePicker
                  placeholder="Select entry date"
                  format="DD-MM-YYYY"
                  style={{ width: '100%' }}
                  disabled={false}
                  suffixIcon={<CalendarOutlined className="text-gray-400" />}
                  disabledDate={(current) => {
                    if (!current) return false;
                    const today = dayjs().endOf('day');
                    const sevenDaysAgo = dayjs().subtract(7, 'days').startOf('day');
                    // Can only select today and past 7 days (past week - 8 days total)
                    // Disable future dates and dates older than 7 days ago
                    return current > today || current < sevenDaysAgo;
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

      {/* Epic / Task selection */}
      {entryType === 'stsTickets' ? (
        // STS Tickets: single Tickets dropdown (no separate epic + task)
        <Row gutter={16}>
          <Col xs={24} sm={24} md={24} lg={24} xl={24}>
            <Form.Item
              label={<span>Tickets <span style={{ color: 'red' }}>*</span></span>}
              name="task"
              rules={[{ required: true, message: 'Please select a ticket!' }]}
              required={false}
            >
              <Select 
                placeholder="Select Ticket" 
                disabled={loadingTickets}
                loading={loadingTickets}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={tickets}
                notFoundContent={loadingTickets ? "Loading..." : "No tickets found"}
                onChange={handleTaskChange}
              />
            </Form.Item>
          </Col>
        </Row>
      ) : (
        <>
          {/* Epic Row - Full Width */}
          <Row gutter={16}>
            <Col xs={24} sm={24} md={24} lg={24} xl={24}>
              <Form.Item
                label={<span>Epic <span style={{ color: 'red' }}>*</span></span>}
                name="epic"
                rules={[{ required: true, message: 'Please select an epic!' }]}
                required={false}
              >
                <Select 
                    placeholder="Select Epic" 
                    disabled={false}
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={epics}
                    onChange={(value) => handleEpicChange(value)}
                  />
              </Form.Item>
            </Col>
          </Row>

          {/* Task Row - Full Width */}
          <Row gutter={16}>
            <Col xs={24} sm={24} md={24} lg={24} xl={24}>
              <Form.Item
                label={<span>Task <span style={{ color: 'red' }}>*</span></span>}
                name="task"
                rules={[{ required: true, message: 'Please select a task!' }]}
                required={false}
                dependencies={['epic']}
              >
                <Select 
                    placeholder={selectedEpic ? "Select Task" : "Select Epic first"} 
                    disabled={!selectedEpic || loadingTasks}
                    loading={loadingTasks}
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={tasks}
                    notFoundContent={selectedEpic ? (loadingTasks ? "Loading..." : "No tasks found") : "Please select an epic first"}
                    onChange={handleTaskChange}
                  />
              </Form.Item>
            </Col>
          </Row>
        </>
      )}

      {/* Task Type Row */}
      <Row gutter={16}>
        <Col xs={24} sm={24} md={12} lg={12} xl={12}>
          <Form.Item
            label={<span>Task Type <span style={{ color: 'red' }}>*</span></span>}
            name="taskType"
            rules={[{ required: true, message: 'Please select a task type!' }]}
            required={false}
          >
            <Select 
                placeholder="Select Task Type" 
                disabled={false}
                options={getTaskTypeOptions()}
              />
          </Form.Item>
        </Col>
      </Row>

      {/* Hours and Mode Row */}
      <Row gutter={16}>
        <Col xs={24} sm={24} md={12} lg={12} xl={12}>
          <Form.Item
            label={<span>Hours <span style={{ color: 'red' }}>*</span></span>}
            name="hours"
            rules={[{ required: true, message: 'Please enter hours!' }]}
            required={false}
          >
            <InputNumber
              min={0}
              max={24}
              step={0.5}
              style={{ width: '100%' }}
              placeholder="Enter hours"
              disabled={false}
              controls={true}
              stringMode={false}
              parser={(value) => {
                // Remove any non-numeric characters except decimal point
                if (!value) return 0;
                const cleaned = String(value).replace(/[^\d.]/g, '');
                // Prevent multiple decimal points
                const parts = cleaned.split('.');
                const finalValue = parts.length > 2 
                  ? parts[0] + '.' + parts.slice(1).join('')
                  : cleaned;
                const numValue = parseFloat(finalValue);
                return isNaN(numValue) ? 0 : numValue;
              }}
              onChange={(value) => {
                const sanitized = sanitizeNumericValue(value as number);
                if (value !== sanitized) {
                  form.setFieldsValue({ hours: sanitized });
                }
              }}
              onKeyDown={(e) => {
                // Allow: numbers (0-9), decimal point, backspace, delete, tab, escape, enter, arrow keys, home, end
                const allowedKeys = [
                  'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
                  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                  'Home', 'End'
                ];
                
                // Allow control keys (Ctrl+A, Ctrl+C, Ctrl+V, etc.)
                if (e.ctrlKey || e.metaKey) {
                  return;
                }
                
                // Allow if it's an allowed key
                if (allowedKeys.includes(e.key)) {
                  return;
                }
                
                // Allow numbers
                if (e.key >= '0' && e.key <= '9') {
                  return;
                }
                
                // Allow single decimal point (only if one doesn't already exist)
                if (e.key === '.' || e.key === 'Period') {
                  const input = e.currentTarget as HTMLInputElement;
                  const inputElement = input.querySelector('input');
                  if (inputElement && !inputElement.value.includes('.')) {
                    return;
                  }
                }
                
                // Prevent all other keys
                e.preventDefault();
              }}
              onPaste={(e) => {
                // Prevent paste and manually handle it
                e.preventDefault();
                const pastedText = e.clipboardData.getData('text');
                // Extract only numbers and decimal point
                const cleaned = pastedText.replace(/[^\d.]/g, '');
                if (cleaned) {
                  // Prevent multiple decimal points
                  const parts = cleaned.split('.');
                  const finalValue = parts.length > 2 
                    ? parts[0] + '.' + parts.slice(1).join('')
                    : cleaned;
                  const numValue = parseFloat(finalValue);
                  if (!isNaN(numValue) && numValue >= 0 && numValue <= 24) {
                    form.setFieldsValue({ hours: numValue });
                  }
                }
              }}
            />
          </Form.Item>
          {/* Overtime hint */}
          {typeof hoursValue === 'number' && hoursValue > 8 && (
            <div className="text-xs text-orange-600 mt-[-8px] mb-2">
              Overtime: {(hoursValue - 8).toFixed(1)}h (total {hoursValue.toFixed(1)}h)
            </div>
          )}
        </Col>
        <Col xs={24} sm={24} md={12} lg={12} xl={12}>
          <Form.Item
            label={<span>Mode <span style={{ color: 'red' }}>*</span></span>}
            name="workLocation"
            rules={[{ required: true, message: 'Please select work location!' }]}
            required={false}
          >
            <Select 
                placeholder="Select work location"
                disabled={false}
                options={getWorkLocationOptions()}
                onChange={handleWorkLocationChange}
              />
          </Form.Item>
        </Col>
      </Row>

      {/* Travel Time and Waiting Time Row - Only show when mode is client site and not in Activities tab */}
      {String(entryType) !== 'outdoor' && isClientSite() && (
        <Row gutter={16}>
          <Col xs={24} sm={24} md={12} lg={12} xl={12}>
            <Form.Item
              label="Travel Time"
              name="travelTime"
            >
              <InputNumber
                min={0}
                max={24}
                step={0.5}
                style={{ width: '100%' }}
                placeholder="Enter travel time (optional)"
                disabled={false}
                controls={true}
                stringMode={false}
                parser={(value) => {
                  // Remove any non-numeric characters except decimal point
                  if (!value) return 0;
                  const cleaned = String(value).replace(/[^\d.]/g, '');
                  // Prevent multiple decimal points
                  const parts = cleaned.split('.');
                  const finalValue = parts.length > 2 
                    ? parts[0] + '.' + parts.slice(1).join('')
                    : cleaned;
                  const numValue = parseFloat(finalValue);
                  return isNaN(numValue) ? 0 : numValue;
                }}
                onChange={(value) => {
                  const sanitized = sanitizeNumericValue(value as number);
                  if (value !== sanitized) {
                    form.setFieldsValue({ travelTime: sanitized });
                  }
                }}
                onKeyDown={(e) => {
                  // Allow: numbers (0-9), decimal point, backspace, delete, tab, escape, enter, arrow keys, home, end
                  const allowedKeys = [
                    'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
                    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                    'Home', 'End'
                  ];
                  
                  // Allow control keys (Ctrl+A, Ctrl+C, Ctrl+V, etc.)
                  if (e.ctrlKey || e.metaKey) {
                    return;
                  }
                  
                  // Allow if it's an allowed key
                  if (allowedKeys.includes(e.key)) {
                    return;
                  }
                  
                  // Allow numbers
                  if (e.key >= '0' && e.key <= '9') {
                    return;
                  }
                  
                  // Allow single decimal point (only if one doesn't already exist)
                  if (e.key === '.' || e.key === 'Period') {
                    const input = e.currentTarget as HTMLInputElement;
                    const inputElement = input.querySelector('input');
                    if (inputElement && !inputElement.value.includes('.')) {
                      return;
                    }
                  }
                  
                  // Prevent all other keys
                  e.preventDefault();
                }}
                onPaste={(e) => {
                  // Prevent paste and manually handle it
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  // Extract only numbers and decimal point
                  const cleaned = pastedText.replace(/[^\d.]/g, '');
                  if (cleaned) {
                    // Prevent multiple decimal points
                    const parts = cleaned.split('.');
                    const finalValue = parts.length > 2 
                      ? parts[0] + '.' + parts.slice(1).join('')
                      : cleaned;
                    const numValue = parseFloat(finalValue);
                    if (!isNaN(numValue) && numValue >= 0 && numValue <= 24) {
                      form.setFieldsValue({ travelTime: numValue });
                    }
                  }
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={24} md={12} lg={12} xl={12}>
            <Form.Item
              label="Waiting Time"
              name="waitingTime"
            >
              <InputNumber
                min={0}
                max={24}
                step={0.5}
                style={{ width: '100%' }}
                placeholder="Enter waiting time (optional)"
                disabled={false}
                controls={true}
                stringMode={false}
                parser={(value) => {
                  // Remove any non-numeric characters except decimal point
                  if (!value) return 0;
                  const cleaned = String(value).replace(/[^\d.]/g, '');
                  // Prevent multiple decimal points
                  const parts = cleaned.split('.');
                  const finalValue = parts.length > 2 
                    ? parts[0] + '.' + parts.slice(1).join('')
                    : cleaned;
                  const numValue = parseFloat(finalValue);
                  return isNaN(numValue) ? 0 : numValue;
                }}
                onChange={(value) => {
                  const sanitized = sanitizeNumericValue(value as number);
                  if (value !== sanitized) {
                    form.setFieldsValue({ waitingTime: sanitized });
                  }
                }}
                onKeyDown={(e) => {
                  // Allow: numbers (0-9), decimal point, backspace, delete, tab, escape, enter, arrow keys, home, end
                  const allowedKeys = [
                    'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
                    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                    'Home', 'End'
                  ];
                  
                  // Allow control keys (Ctrl+A, Ctrl+C, Ctrl+V, etc.)
                  if (e.ctrlKey || e.metaKey) {
                    return;
                  }
                  
                  // Allow if it's an allowed key
                  if (allowedKeys.includes(e.key)) {
                    return;
                  }
                  
                  // Allow numbers
                  if (e.key >= '0' && e.key <= '9') {
                    return;
                  }
                  
                  // Allow single decimal point (only if one doesn't already exist)
                  if (e.key === '.' || e.key === 'Period') {
                    const input = e.currentTarget as HTMLInputElement;
                    const inputElement = input.querySelector('input');
                    if (inputElement && !inputElement.value.includes('.')) {
                      return;
                    }
                  }
                  
                  // Prevent all other keys
                  e.preventDefault();
                }}
                onPaste={(e) => {
                  // Prevent paste and manually handle it
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  // Extract only numbers and decimal point
                  const cleaned = pastedText.replace(/[^\d.]/g, '');
                  if (cleaned) {
                    // Prevent multiple decimal points
                    const parts = cleaned.split('.');
                    const finalValue = parts.length > 2 
                      ? parts[0] + '.' + parts.slice(1).join('')
                      : cleaned;
                    const numValue = parseFloat(finalValue);
                    if (!isNaN(numValue) && numValue >= 0 && numValue <= 24) {
                      form.setFieldsValue({ waitingTime: numValue });
                    }
                  }
                }}
              />
            </Form.Item>
          </Col>
        </Row>
      )}

      {/* Description */}
      <Form.Item
        label={<span>Description <span style={{ color: 'red' }}>*</span></span>}
        name="description"
        rules={[{ required: true, message: 'Please enter description!' }]}
        required={false}
      >
        <Input.TextArea
          rows={3}
          placeholder="Description"
          disabled={false}
        />
      </Form.Item>

      {/* Rejection Reason - Show only if entry is rejected and reason exists */}
      {entryData && (() => {
        // Check status from multiple possible fields
        const status = entryData.approval_status || entryData.status || entryData.status_code || "";
        const isRejected = status.toUpperCase() === "REJECTED" || status === "Rejected";
        
        // Check rejection reason from multiple possible fields and locations
        const rawData = entryData.rawData || entryData;
        const rejectionReason = 
          rawData.rejection_reason || 
          rawData.rejectionReason || 
          entryData.rejection_reason || 
          entryData.rejectionReason || 
          "";
        
        if (isRejected && rejectionReason && rejectionReason.trim()) {
          return (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
              <div className="flex items-start gap-2">
                <svg 
                  className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-800 mb-1">
                    Rejection Reason
                  </h4>
                  <p className="text-sm text-red-700 whitespace-pre-wrap">
                    {rejectionReason.trim()}
                  </p>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Attachments */}
      {entryData?.attachments && Array.isArray(entryData.attachments) && entryData.attachments.length > 0 ? (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Attachments</label>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="space-y-2">
              {entryData.attachments.map((file: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100">
                  <div className="flex items-center gap-2">
                    <UploadOutlined className="text-gray-400" />
                    <span className="text-sm text-gray-700">{file.file_name || file.name}</span>
                    {file.file_size && (
                      <span className="text-xs text-gray-500">
                        ({typeof file.file_size === 'number' 
                          ? `${(file.file_size / 1024).toFixed(2)} KB` 
                          : file.file_size})
                      </span>
                    )}
                  </div>
                  {(file.file_url || file.file_path) && (
                    <a 
                      href={file.file_url || file.file_path} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <Form.Item
          label="Attachments"
          name="attachments"
          valuePropName="fileList"
          className="w-full"
          getValueFromEvent={(e) => {
            if (Array.isArray(e)) {
              return e;
            }
            return e?.fileList;
          }}
        >
          <Upload
            beforeUpload={() => false}
            multiple
            disabled={false}
            listType="text"
            className="w-full"
            style={{ width: '100%' }}
          >
            <div className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-300 disabled:hover:bg-transparent"
                 style={{ width: '100%', pointerEvents: "auto" }}>
              <div className="flex flex-col items-center justify-center gap-2">
                <UploadOutlined className="text-2xl text-gray-400" />
                <div className="text-sm text-gray-600 text-center">
                  <span className="text-blue-600 font-medium">Click to upload</span> or drag and drop
                </div>
                <div className="text-xs text-gray-500">Supports multiple files</div>
              </div>
            </div>
          </Upload>
        </Form.Item>
      )}
        </>
      ) : (
        <>
          {/* Outdoor Activities Form Fields */}
          {/* Entry Date Row */}
          <Row gutter={16}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Item
                label={<span>Entry Date <span style={{ color: 'red' }}>*</span></span>}
                name="entryDate"
                rules={[{ required: true, message: 'Please select entry date!' }]}
                required={false}
              >
                <DatePicker
                  placeholder="Select entry date"
                  format="DD-MM-YYYY"
                  style={{ width: '100%' }}
                  disabled={false}
                  suffixIcon={<CalendarOutlined className="text-gray-400" />}
                  disabledDate={(current) => {
                    if (!current) return false;
                    const today = dayjs().endOf('day');
                    const sevenDaysAgo = dayjs().subtract(7, 'days').startOf('day');
                    // Can only select today and past 7 days (past week - 8 days total)
                    // Disable future dates and dates older than 7 days ago
                    return current > today || current < sevenDaysAgo;
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Item
                label={<span>Hours Worked <span style={{ color: 'red' }}>*</span></span>}
                name="hours"
                rules={[
                  { required: true, message: 'Please enter hours worked!' },
                  { type: 'number', min: 0.5, max: 24, message: 'Hours must be between 0.5 and 24!' }
                ]}
                required={false}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0.5}
                  max={24}
                  step={0.5}
                  precision={1}
                  placeholder="Enter hours"
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Activity Title Row */}
          <Row gutter={16}>
            <Col xs={24} sm={24} md={24} lg={24} xl={24}>
              <Form.Item
                label={<span>Activity Title <span style={{ color: 'red' }}>*</span></span>}
                name="title"
                rules={[{ required: true, message: 'Please select an activity!' }]}
                required={false}
              >
                <Select
                  placeholder="Select activity"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={getActivityOptions()}
                />
              </Form.Item>
            </Col>
          </Row>


          {/* Description Row */}
          <Row gutter={16}>
            <Col xs={24} sm={24} md={24} lg={24} xl={24}>
              <Form.Item
                label="Description"
                name="description"
              >
                <Input.TextArea rows={3} placeholder="Enter description" />
              </Form.Item>
            </Col>
          </Row>

          {/* Attachments Row */}
          <Row gutter={16}>
            <Col xs={24} sm={24} md={24} lg={24} xl={24}>
              <Form.Item
                label="Attachments"
                name="attachments"
                valuePropName="fileList"
                getValueFromEvent={(e) => e?.fileList}
              >
                <Upload beforeUpload={() => false} multiple>
                  <Button icon={<UploadOutlined />}>Upload Files</Button>
                </Upload>
              </Form.Item>
            </Col>
          </Row>
        </>
      )}

      {/* (Removed additional read-only detail sections per requirement) */}

      {/* Submit Button or Approve/Reject Buttons */}
      {!hideActionButtons && (
        <Form.Item className="mb-0">
          {(onApprove || onReject) ? (
            <div className="flex gap-2 justify-end">
              {onReject && (
                <Button danger onClick={onReject}>
                  Reject
                </Button>
              )}
              {onApprove && (
                <Button type="primary" onClick={onApprove} className="bg-green-600 hover:bg-green-700">
                  Approve
                </Button>
              )}
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              {(() => {
                // Check if entry date is in the future
                const isFutureDate = entryDateValue && dayjs(entryDateValue).isAfter(dayjs().endOf('day'), 'day');
                const isDisabled = submitting || isFutureDate;
                
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        // Regular timesheet & STS tickets share the same validation rules
                        if (entryType === 'timesheet' || entryType === 'stsTickets') {
                          form.validateFields().then((values) => {
                            handleSubmit(values, true);
                          }).catch(() => {
                            // Validation failed, but still allow saving as draft
                            const currentValues = form.getFieldsValue();
                            handleSubmit(currentValues, true);
                          });
                        } else {
                          // For outdoor activities, validate required fields before saving as draft
                          form.validateFields(['entryDate', 'title', 'hours']).then((values) => {
                            handleSubmit(values, true);
                          }).catch(() => {
                            // Validation failed, but still allow saving as draft with current values
                            const currentValues = form.getFieldsValue();
                            handleSubmit(currentValues, true);
                          });
                        }
                      }}
                      disabled={submitting}
                      className="px-6 py-2 bg-gray-600 text-white rounded-md font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </span>
                      ) : (
                        "Save as Draft"
                      )}
                    </button>
                    <button
                      type="submit"
                      // Regular timesheet & STS tickets use the same disable rules as timesheet
                      disabled={entryType === 'timesheet' || entryType === 'stsTickets' ? isDisabled : submitting}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title={(entryType === 'timesheet' || entryType === 'stsTickets') && isFutureDate ? "Cannot submit timesheet for future dates. Use Apply Leave tab for future dates." : ""}
                    >
                      {submitting ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Submitting...
                        </span>
                      ) : (
                        "Submit"
                      )}
                    </button>
                  </>
                );
              })()}
            </div>
          )}
        </Form.Item>
      )}
    </Form>
  );
}
