"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { TaskData, SubTask } from "./types";
import { EpicAttachment } from "@/app/types/EpicTypes";
import type { TaskDetailsApiResponse, TaskDetailsApiData, AttachmentApiData } from "@/app/types/api";
import LeftPanel from "./components/LeftPanel";
import RightPanel from "./components/RightPanel";
import { apiRequest } from "@/app/lib/api";
import { getStatusOptions, getPriorityOptions, getProductOptions, getTaskTypeOptions } from "@/app/lib/masterData";
import { getStatusDisplayLabel } from "@/app/lib/uiMaps";
import { getMasterDataFromCache } from "@/app/lib/api";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";
import { getUserFromStorage } from "@/app/lib/auth/storage";
import type { Comment } from "@/app/components/shared/CommentsTab";

export default function TaskDetailsPage() {
  const params = useParams<{ id: string }>();
  const taskIdParam = params?.id || '';

  // Extract numeric ID from task ID (remove TA- prefix if present)
  const extractTaskId = (id: string): string => {
    if (!id) return '';
    // Remove TA-, TASK-, TSK- prefixes
    return id.replace(/^(TA-|TASK-|TSK-)/i, '');
  };

  const [taskAttachments, setTaskAttachments] = useState<EpicAttachment[]>([]); // Store full attachment objects
  const [taskData, setTaskData] = useState<TaskData>({
    taskId: "",
    title: "",
    description: "",
    priority: "Low",
    type: "Task",
    status: "To Do",
    team: "",
    assignee: "",
    reporter: "",
    startDate: "",
    dueDate: "",
    submissionDate: "",
    estimatedHours: 0,
    actualHours: 0,
    attachments: [],
    epicId: "",
    epicKey: "",
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [activeTab, setActiveTab] = useState("activity");
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [statusReasonsHistory, setStatusReasonsHistory] = useState<any[]>([]);
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  // Management (mgmt) role should see task details as read-only
  const user = getUserFromStorage();
  const rawRole = (user?.rawRole || "").toLowerCase();
  const userCode = (user?.userCode || "").toLowerCase();
  const isMgmt = rawRole === "mgmt" || rawRole === "management" || userCode === "mgmt";
  const isReadOnly = isMgmt;

  // Store original task data and API response for comparison
  const originalTaskDataRef = useRef<TaskData | null>(null);
  const originalApiDataRef = useRef<any>(null);
  const originalAssigneeCodeRef = useRef<string | null>(null);
  const originalReporterCodeRef = useRef<string | null>(null);
  const startDateRef = useRef<HTMLDivElement>(null);
  const [highlightStartDate, setHighlightStartDate] = useState(false);

  // Fetch task details from API
  useEffect(() => {
    const fetchTaskDetails = async () => {
      if (!taskIdParam) {
        setError("Task ID is required");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const numericTaskId = extractTaskId(taskIdParam);
        const endpoint = `get_task/${numericTaskId}`;
        const resp = await apiRequest<TaskDetailsApiResponse>(endpoint, 'GET');

        // API response structure: resp.data contains the task object
        const item: TaskDetailsApiData = resp?.data || (resp as unknown as TaskDetailsApiData);

        // Map API response to TaskData - extract from flat structure (API returns flat fields)
        const taskId = String(item?.task_id ?? numericTaskId);
        const title = item?.task_title ?? '';
        const description = item?.task_description ?? item?.description ?? '';

        // Map status - API has task_status_description directly
        // Use centralized status mapping function for consistency across the app
        const statusDescValue = typeof item?.status === 'object' && item?.status !== null ? item.status.status_description : (typeof item?.status === 'string' ? item.status : undefined);
        const statusDesc = String(item?.task_status_description || statusDescValue || item?.status_description || '');
        const status: TaskData['status'] = getStatusDisplayLabel(statusDesc) as TaskData['status'];

        // Map priority - API has task_priority_description directly
        const priorityObj = item?.priority && typeof item.priority === 'object' && item.priority !== null && 'priority_description' in item.priority ? item.priority as { priority_description?: string } : null;
        const priorityDescValue = priorityObj?.priority_description ?? (typeof item?.priority === 'string' ? item.priority : undefined);
        const priorityDesc = String(item?.task_priority_description || priorityDescValue || item?.priority_description || 'Low').toLowerCase();
        const priority: TaskData['priority'] = priorityDesc.includes('high')
          ? 'High'
          : priorityDesc.includes('medium')
            ? 'Medium'
            : 'Low';

        // Map task type - API has task_type_name directly, use it as-is
        const taskTypeObj = item?.task_type && typeof item.task_type === 'object' ? item.task_type : {};
        const type: TaskData['type'] = String(item?.task_type_name || (taskTypeObj && 'task_type_name' in taskTypeObj ? taskTypeObj.task_type_name : undefined) || (taskTypeObj && 'task_type_description' in taskTypeObj ? taskTypeObj.task_type_description : undefined) || '');

        // Map assignment - API has task_assignee_name and task_reporter_name directly
        const assignmentObj = item?.assignment && typeof item.assignment === 'object' ? item.assignment : {};
        const assignee = (item?.task_assignee_name || item?.task_assignee) ? (item?.task_assignee_name ?? (assignmentObj && 'assignee_name' in assignmentObj ? assignmentObj.assignee_name : undefined) ?? item?.assignee_name ?? item?.assignee ?? '') : '';
        const reporter = item?.task_reporter_name ?? (assignmentObj && 'reporter_name' in assignmentObj ? assignmentObj.reporter_name : undefined) ?? item?.reporter_name ?? item?.reporter ?? item?.task_created_by_name ?? item?.created_by_name ?? '';

        // Map timeline - API has task_start_date, task_due_date, task_closed_on directly
        const timelineObj = item?.timeline && typeof item.timeline === 'object' ? item.timeline : {};
        const startDate = item?.task_start_date
          ? String(item.task_start_date).slice(0, 10)
          : (timelineObj && 'start_date' in timelineObj && timelineObj.start_date ? String(timelineObj.start_date).slice(0, 10) : '');
        const dueDate = item?.task_due_date
          ? String(item.task_due_date).slice(0, 10)
          : (timelineObj && 'due_date' in timelineObj && timelineObj.due_date ? String(timelineObj.due_date).slice(0, 10) : '');
        const submissionDate = item?.task_closed_on
          ? String(item.task_closed_on).slice(0, 10)
          : (timelineObj && 'closed_on' in timelineObj && timelineObj.closed_on ? String(timelineObj.closed_on).slice(0, 10) : '');

        // Map budget - API has task_estimated_hours, task_actual_hours_worked directly
        const estimatedHours = Number(item?.task_estimated_hours ?? item?.budget?.estimated_hours ?? item?.estimated_hours ?? 0);
        const actualHours = Number(item?.task_actual_hours_worked ?? item?.budget?.actual_hours_worked ?? item?.actual_hours ?? item?.actual_hours_worked ?? 0);

        // Map attachments from API response - API returns full attachment objects
        const attachmentsFromApi: EpicAttachment[] = Array.isArray(item?.attachments)
          ? item.attachments.map((a: AttachmentApiData) => ({
            id: a.id || 0,
            file_name: a.file_name || '',
            file_path: a.file_path || '',
            file_url: a.file_url || '',
            file_type: a.file_type || '',
            file_size: a.file_size || '',
            purpose: a.purpose || '',
            created_by: a.created_by || '',
            created_at: a.created_at || '',
          }))
          : [];
        // Keep attachments as string array for backward compatibility (for TaskData type)
        const attachments = attachmentsFromApi.map(a => a.file_name);

        // Epic information - API has epic_id, epic_title directly
        const epicObj = item?.epic && typeof item.epic === 'object' ? item.epic : {};
        const epicId = String(item?.epic_id ?? (epicObj && 'epic_id' in epicObj ? epicObj.epic_id : undefined) ?? item?.task_epic_code ?? '');
        const epicKey = epicId ? `EPIC-${epicId}` : '';
        const epicTitle = item?.epic_title ?? (epicObj && 'epic_title' in epicObj ? epicObj.epic_title : undefined) ?? '';

        // Product information - API has product_code, product_name directly
        const productObj = item?.product && typeof item.product === 'object' ? item.product : {};
        const product = item?.product_name ?? item?.product_code ?? (productObj && 'product_name' in productObj ? productObj.product_name : undefined) ?? (productObj && 'product_code' in productObj ? productObj.product_code : undefined) ?? '';

        // Extract work_mode from API response
        const workMode = String((item as any)?.task_work_mode ?? (item as any)?.work_mode ?? '');

        // Extract team from API response - prefer team_name over team_code
        const team = String((item as any)?.task_assigned_team_name ?? (item as any)?.task_team_code ?? (item as any)?.assigned_team_name ?? (item as any)?.team_code ?? '');
        console.log('[DEBUG] Initial team from get_task:', {
          task_assigned_team_name: (item as any)?.task_assigned_team_name,
          task_team_code: (item as any)?.task_team_code,
          assigned_team_name: (item as any)?.assigned_team_name,
          team_code: (item as any)?.team_code,
          finalTeam: team
        });

        // Extract status_reason from API response
        const statusReason = String((item as any)?.task_status_reason ?? (item as any)?.status_reason ?? '');

        // Extract task_all_status_reasons from API response
        let taskStatusReasonsHistory: Array<{ status_code?: string; status_reason?: string; created_at?: string; created_by?: string }> = [];
        try {
          const allReasonsRaw = (item as any)?.task_all_status_reasons;
          if (Array.isArray(allReasonsRaw)) {
            taskStatusReasonsHistory = allReasonsRaw.map((r: any) => ({
              status_code: r.status_code || '',
              status_reason: r.status_reason || '',
              created_at: r.created_at || '',
              created_by: r.created_by_name || r.created_by || '',
            }));
          } else if (typeof allReasonsRaw === 'string') {
            // If it's a JSON string, parse it
            try {
              const parsed = JSON.parse(allReasonsRaw);
              if (Array.isArray(parsed)) {
                taskStatusReasonsHistory = parsed.map((r: any) => ({
                  status_code: r.status_code || '',
                  status_reason: r.status_reason || '',
                  created_at: r.created_at || '',
                  created_by: r.created_by_name || r.created_by || '',
                }));
              }
            } catch {
              // Ignore parse errors
            }
          }
        } catch {
          // Ignore errors
        }

        // Extract and parse task_subtasks from API response
        let parsedSubTasks: SubTask[] = [];
        try {
          const taskSubtasksRaw = (item as any)?.task_subtasks;
          if (taskSubtasksRaw) {
            let subtasksArray: any[] = [];
            if (typeof taskSubtasksRaw === 'string') {
              try {
                subtasksArray = JSON.parse(taskSubtasksRaw);
              } catch {
                // If parsing fails, try to parse as JSONB string
                subtasksArray = [];
              }
            } else if (Array.isArray(taskSubtasksRaw)) {
              subtasksArray = taskSubtasksRaw;
            }

            // Map subtasks to SubTask interface
            parsedSubTasks = subtasksArray.map((st: any) => {
              const subtaskId = String(st?.id ?? st?.subtask_id ?? '');
              const subtaskTitle = String(st?.subtask_title ?? st?.title ?? '');
              const subtaskDesc = String(st?.subtask_description ?? st?.description ?? st?.subtask_desc ?? '');
              
              // Map status
              const statusDesc = String(st?.status_description ?? st?.status ?? '');
              const status: SubTask['status'] = getStatusDisplayLabel(statusDesc) as SubTask['status'] || 'To Do';
              
              // Map priority
              const priorityDesc = String(st?.priority_description ?? st?.priority ?? 'Low').toLowerCase();
              const priority: SubTask['priority'] = priorityDesc.includes('high')
                ? 'High'
                : priorityDesc.includes('medium')
                  ? 'Medium'
                  : 'Low';
              
              // Map assignee
              const assignee = String(st?.assignee_name ?? st?.assignee ?? '');
              
              // Map due date
              const dueDate = st?.due_date 
                ? String(st.due_date).slice(0, 10)
                : undefined;

              return {
                key: subtaskId,
                id: `ST-${subtaskId}`,
                title: subtaskTitle,
                description: subtaskDesc,
                priority,
                assignee,
                status,
                dueDate,
              };
            });
          }
        } catch (error) {
          console.error('Error parsing task subtasks:', error);
          parsedSubTasks = [];
        }

        const mappedTaskData: TaskData = {
          taskId: `TA-${taskId}`,
          title: String(title),
          description: String(description),
          priority,
          type,
          status,
          team: team || undefined,
          assignee: String(assignee),
          reporter: String(reporter),
          product: String(product) || undefined,
          workMode: workMode || undefined,
          startDate,
          dueDate,
          submissionDate,
          estimatedHours,
          actualHours,
          attachments,
          epicId: epicId || undefined,
          epicKey: epicKey || undefined,
          statusReason: statusReason || undefined,
        };

        setTaskData(mappedTaskData);
        setStatusReasonsHistory(taskStatusReasonsHistory);
        setSubTasks(parsedSubTasks);

        // Fetch comments for this task (non-blocking)
        try {
          interface CommentApiResponse {
            success_flag: boolean;
            data: Array<{
              comment_text?: string;
              text?: string;
              commented_by_name?: string;
              author_name?: string;
              commented_by?: string;
              author_code?: string;
              commented_at?: string;
            }>;
          }
          const commentsResp = await apiRequest<CommentApiResponse>(`get_comments?parent_type=TASK&parent_code=${encodeURIComponent(String(numericTaskId))}`, 'GET');
          const commentItems = Array.isArray(commentsResp?.data) ? commentsResp.data : [];
          const mappedComments: Comment[] = commentItems.map((c) => ({
            text: c.text || c.comment_text || '',
            author: c.author_name || c.commented_by_name || c.author_code || c.commented_by || 'User',
            date: c.commented_at ? new Date(c.commented_at).toLocaleDateString() : new Date().toLocaleDateString(),
          }));
          setComments(mappedComments);
        } catch (_) {
          // ignore
        }
        setTaskAttachments(attachmentsFromApi); // Store full attachment objects
        // Store original data for comparison
        originalTaskDataRef.current = { ...mappedTaskData };
        originalApiDataRef.current = item;
        // Store original user codes for assignee and reporter
        const assignmentObjForCodes = item?.assignment && typeof item.assignment === 'object' && 'assignee' in item.assignment ? item.assignment as { assignee?: string; reporter?: string } : null;
        originalAssigneeCodeRef.current = item?.task_assignee ?? assignmentObjForCodes?.assignee ?? item?.assignee ?? null;
        originalReporterCodeRef.current = item?.task_reporter ?? assignmentObjForCodes?.reporter ?? item?.reporter ?? null;
      } catch (e) {
        console.error('Failed to fetch task details:', e);
        setError('Failed to load task details');
      } finally {
        setLoading(false);
      }
    };

    fetchTaskDetails();
  }, [taskIdParam]);

  // Helper function to get user code from name
  const getUserCodeFromName = (name: string): string | null => {
    if (!name) return null;
    interface MasterDataCache {
      data?: {
        employees?: Array<{ user_name?: string; user_code?: string }>;
      };
    }
    const md = getMasterDataFromCache<MasterDataCache>();
    const employees = md?.data?.employees || [];
    const employee = employees.find((e) => e?.user_name === name);
    return employee?.user_code || null;
  };

  // Helper function to format date for API (DD-MM-YYYY or YYYY-MM-DD)
  const formatDateForApi = (date: string): string => {
    if (!date) return '';
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    // If in DD/MM/YYYY format, convert to YYYY-MM-DD
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
      const [day, month, year] = date.split('/');
      return `${year}-${month}-${day}`;
    }
    // Try to parse with dayjs and return in YYYY-MM-DD format
    const parsed = dayjs(date);
    if (parsed.isValid()) {
      return parsed.format('YYYY-MM-DD');
    }
    return date;
  };

  // Update task via API
  const updateTask = async (field: keyof TaskData, newValue: TaskData[keyof TaskData], originalValue: TaskData[keyof TaskData]) => {
    if (isReadOnly) return;
    const numericTaskId = extractTaskId(taskIdParam);
    if (!numericTaskId || !originalApiDataRef.current) return;

    try {
      const form = new URLSearchParams();
      let hasChanges = false;
      let isMovingToInProgress = false;

      // Map field changes to API parameters
      switch (field) {
        case 'status': {
          const statusOptions = getStatusOptions();
          const statusOption = statusOptions.find(opt => {
            const label = opt.label.toLowerCase();
            const newStatus = String(newValue).toLowerCase();
            return label === newStatus ||
              (newStatus === 'to do' && label.includes('not yet started'));
          });
          if (statusOption && String(newValue) !== String(originalValue)) {
            form.append('status_code', String(statusOption.value));
            hasChanges = true;

            // If moving to In Progress, backend will automatically set start_date to today if not provided
            // We don't need to send it from frontend unless user explicitly changed the date
            // Store that we're changing to In Progress to trigger scroll/blink after update
            isMovingToInProgress = statusOption.value === 'STS007' || 
              String(newValue).toLowerCase().includes('in progress');

          }
          break;
        }
        case 'priority': {
          const priorityOptions = getPriorityOptions();
          const priorityOption = priorityOptions.find(opt =>
            opt.label.toLowerCase() === String(newValue).toLowerCase()
          );
          if (priorityOption && String(newValue) !== String(originalValue)) {
            form.append('priority_code', String(priorityOption.value));
            hasChanges = true;
          }
          break;
        }
        case 'type': {
          const taskTypeOptions = getTaskTypeOptions();
          const taskTypeOption = taskTypeOptions.find(opt =>
            opt.label.toLowerCase() === String(newValue).toLowerCase()
          );
          if (taskTypeOption && String(newValue) !== String(originalValue)) {
            form.append('task_type_code', String(taskTypeOption.value));
            hasChanges = true;
          }
          break;
        }
        case 'startDate': {
          const newDate = formatDateForApi(String(newValue || ''));
          const originalDate = formatDateForApi(String(originalValue || ''));
          if (newDate !== originalDate && newDate) {
            form.append('start_date', String(newDate));
            hasChanges = true;
          }
          break;
        }
        case 'dueDate': {
          const newDate = formatDateForApi(String(newValue || ''));
          const originalDate = formatDateForApi(String(originalValue || ''));
          if (newDate !== originalDate && newDate) {
            form.append('due_date', String(newDate));
            hasChanges = true;
          }
          break;
        }
        case 'submissionDate': {
          const newDate = formatDateForApi(String(newValue || ''));
          const originalDate = formatDateForApi(String(originalValue || ''));
          if (newDate !== originalDate) {
            if (newDate) {
              form.append('closed_on', String(newDate));
            } else {
              form.append('closed_on', '');
            }
            hasChanges = true;
          }
          break;
        }
        case 'actualHours': {
          const newHours = Number(newValue || 0);
          const originalHours = Number(originalValue || 0);
          if (newHours !== originalHours) {
            form.append('actual_hours_worked', String(newHours));
            hasChanges = true;
          }
          break;
        }
        case 'estimatedHours': {
          const newHours = Number(newValue || 0);
          const originalHours = Number(originalValue || 0);
          if (newHours !== originalHours) {
            form.append('estimated_hours', String(newHours));
            hasChanges = true;
          }
          break;
        }
        case 'assignee': {
          const newAssignee = String(newValue || '');
          const originalAssignee = String(originalValue || '');
          if (newAssignee !== originalAssignee) {
            const userCode = getUserCodeFromName(newAssignee);
            if (userCode && userCode !== originalAssigneeCodeRef.current) {
              form.append('assignee', String(userCode));
              hasChanges = true;
              originalAssigneeCodeRef.current = userCode;
            }
          }
          break;
        }
        case 'reporter': {
          const newReporter = String(newValue || '');
          const originalReporter = String(originalValue || '');
          if (newReporter !== originalReporter) {
            const userCode = getUserCodeFromName(newReporter);
            if (userCode && userCode !== originalReporterCodeRef.current) {
              form.append('reporter', String(userCode));
              hasChanges = true;
              originalReporterCodeRef.current = userCode;
            }
          }
          break;
        }
        case 'product': {
          const newProduct = String(newValue || '');
          const originalProduct = String(originalValue || '');
          if (newProduct !== originalProduct) {
            // Product can be product name or product code, find the code from options
            const productOptions = getProductOptions();
            const productOption = productOptions.find(opt =>
              opt.label === newProduct || opt.value === newProduct
            );
            if (productOption) {
              form.append('product_code', String(productOption.value));
              hasChanges = true;
            }
          }
          break;
        }
        case 'title': {
          const newTitle = String(newValue || '').trim();
          const originalTitle = String(originalValue || '').trim();
          if (newTitle !== originalTitle && newTitle) {
            form.append('task_title', String(newTitle));
            hasChanges = true;
          }
          break;
        }
        case 'description': {
          const newDescription = String(newValue || '').trim();
          const originalDescription = String(originalValue || '').trim();
          if (newDescription !== originalDescription) {
            form.append('task_description', String(newDescription));
            hasChanges = true;
          }
          break;
        }
        case 'workMode': {
          const newWorkMode = String(newValue || '').trim();
          const originalWorkMode = String(originalValue || '').trim();
          if (newWorkMode !== originalWorkMode) {
            form.append('work_mode', newWorkMode || '');
            hasChanges = true;
          }
          break;
        }
        case 'team': {
          const newTeam = String(newValue || '').trim();
          const originalTeam = String(originalValue || '').trim();
          console.log('[DEBUG] Team update - newTeam:', newTeam, 'originalTeam:', originalTeam);
          if (newTeam !== originalTeam) {
            // Map team name to team code from master data
            try {
              const md = getMasterDataFromCache<any>();
              const masterTeams = md?.data?.teams || [];
              const employees = md?.data?.employees || [];
              const teamMatch = masterTeams.find((t: any) => 
                String(t.team_name || '').trim() === newTeam || 
                String(t.team_code || '').trim() === newTeam
              );
              console.log('[DEBUG] Team match found:', teamMatch);
              if (teamMatch?.team_code) {
                const teamCode = String(teamMatch.team_code);
                console.log('[DEBUG] Appending assigned_team_code:', teamCode);
                form.append('assigned_team_code', teamCode);
                hasChanges = true;
                
                // ALWAYS clear assignee when team changes - send empty assignee to backend
                // Backend will set assignee to NULL in database
                // Use originalTaskDataRef to get the current assignee from database, not stale state
                const currentAssignee = String(originalTaskDataRef.current?.assignee || taskData.assignee || '').trim();
                // Always send empty assignee when team changes - backend will set it to NULL
                form.append('assignee', '');
                hasChanges = true;
                // Also update the local state immediately
                setTaskData(prev => ({ ...prev, assignee: '' }));
                // Update the original ref as well
                if (originalTaskDataRef.current) {
                  originalTaskDataRef.current.assignee = '';
                }
              } else if (newTeam) {
                // If team not found in master data, send as-is (might be team code)
                console.log('[DEBUG] Team not found in master data, sending as-is:', newTeam);
                form.append('assigned_team_code', newTeam);
                hasChanges = true;
              }
            } catch (error) {
              // If master data not available, send as-is
              console.error('[DEBUG] Error getting master data:', error);
              if (newTeam) {
                console.log('[DEBUG] Sending team as-is (fallback):', newTeam);
                form.append('assigned_team_code', newTeam);
                hasChanges = true;
              }
            }
          } else {
            console.log('[DEBUG] Team values are the same, skipping update');
          }
          break;
        }
      }

      // Only call API if there are actual changes
      if (hasChanges) {
        const endpoint = `update_task/${numericTaskId}`;
        const response = await apiRequest<any>(endpoint, 'PUT', form);

        // Check for API error response
        if (response?.success_flag === false || response?.error) {
          const errorMsg = response?.message || response?.error || response?.detail || 'Failed to update task';
          toast.error(errorMsg, {
            duration: 4000,
            position: 'top-right',
          });
          // Revert the optimistic update
          if (originalTaskDataRef.current) {
            setTaskData({ ...originalTaskDataRef.current });
          }
          return;
        }

        const fieldName = field === 'startDate' ? 'Start date' :
          field === 'dueDate' ? 'Due date' :
            field === 'submissionDate' ? 'Submission date' :
              field === 'actualHours' ? 'Actual hours' :
                field === 'estimatedHours' ? 'Estimated hours' :
                  field === 'product' ? 'Product' :
                    field === 'type' ? 'Task type' :
                      field === 'title' ? 'Title' :
                        field === 'description' ? 'Description' :
                          field === 'workMode' ? 'Work mode' :
                            field.charAt(0).toUpperCase() + field.slice(1);
        toast.success(`${fieldName} updated successfully`);

        // Refetch latest task details from server to keep UI in sync
        try {
          const resp = await apiRequest<TaskDetailsApiResponse>(`get_task/${encodeURIComponent(numericTaskId)}`, 'GET');
          const item: TaskDetailsApiData = resp?.data || (resp as unknown as TaskDetailsApiData);

          // Preserve attachments array with file_url
          const attachmentsFromApi: EpicAttachment[] = Array.isArray(item?.attachments)
            ? item.attachments.map((a: AttachmentApiData) => ({
              id: a.id || 0,
              file_name: a.file_name || '',
              file_path: a.file_path || '',
              file_url: a.file_url || '',
              file_type: a.file_type || '',
              file_size: a.file_size || '',
              purpose: a.purpose || '',
              created_by: a.created_by || '',
              created_at: a.created_at || '',
            }))
            : [];

          setTaskAttachments(attachmentsFromApi);

          // Capture status reasons history if provided by API (task_all_status_reasons)
          try {
            const histRaw = (item as any)?.task_all_status_reasons;
            if (histRaw) {
              const parsed = Array.isArray(histRaw) ? histRaw : JSON.parse(histRaw);
              if (Array.isArray(parsed)) setStatusReasonsHistory(parsed);
            } else {
              setStatusReasonsHistory([]);
            }
          } catch { setStatusReasonsHistory([]); }

          const statusDesc = String(item?.task_status_description || item?.status_description || item?.status || '');
          // Use centralized status mapping function for consistency
          const mappedStatus: TaskData['status'] = getStatusDisplayLabel(statusDesc) as TaskData['status'];

          const priorityDesc = String(item?.task_priority_description || item?.priority_description || item?.priority || 'Low').toLowerCase();
          const mappedPriority: TaskData['priority'] = priorityDesc.includes('high') ? 'High' : priorityDesc.includes('medium') ? 'Medium' : 'Low';

          // Map product from API response
          const productObj = item?.product && typeof item.product === 'object' ? item.product : {};
          const product = String(item?.product_name ?? (productObj && 'product_name' in productObj ? (productObj as { product_name?: string }).product_name : undefined) ?? item?.product_code ?? (productObj && 'product_code' in productObj ? (productObj as { product_code?: string }).product_code : undefined) ?? '');

          // Extract work_mode from API response
          const refreshedWorkMode = String((item as any)?.task_work_mode ?? (item as any)?.work_mode ?? '');

          // Extract team from API response - prefer team_name over team_code
          const refreshedTeam = String((item as any)?.task_assigned_team_name ?? (item as any)?.task_team_code ?? (item as any)?.assigned_team_name ?? (item as any)?.team_code ?? '');
          console.log('[DEBUG] Team from get_task response:', {
            task_assigned_team_name: (item as any)?.task_assigned_team_name,
            task_team_code: (item as any)?.task_team_code,
            assigned_team_name: (item as any)?.assigned_team_name,
            team_code: (item as any)?.team_code,
            refreshedTeam: refreshedTeam
          });

          // Extract status_reason from API response
          const refreshedStatusReason = String((item as any)?.task_status_reason ?? (item as any)?.status_reason ?? '');

          // Capture status reasons history if provided by API (task_all_status_reasons)
          try {
            const histRaw = (item as any)?.task_all_status_reasons;
            if (histRaw) {
              const parsed = Array.isArray(histRaw) ? histRaw : JSON.parse(histRaw);
              if (Array.isArray(parsed)) setStatusReasonsHistory(parsed);
            } else {
              setStatusReasonsHistory([]);
            }
          } catch { setStatusReasonsHistory([]); }

          const refreshed: TaskData = {
            taskId: `TA-${String(item?.task_id || numericTaskId)}`,
            title: item?.task_title || '',
            description: item?.task_description || '',
            priority: mappedPriority,
            type: item?.task_type_name || '',
            status: mappedStatus,
            team: refreshedTeam || undefined,
            assignee: (item?.task_assignee_name || item?.task_assignee || null) ? (item?.task_assignee_name || item?.task_assignee || '') : '',
            reporter: item?.task_reporter_name || item?.task_reporter || '',
            product,
            workMode: refreshedWorkMode || undefined,
            startDate: item?.task_start_date ? dayjs(item.task_start_date).format('YYYY-MM-DD') : '',
            dueDate: item?.task_due_date ? dayjs(item.task_due_date).format('YYYY-MM-DD') : '',
            submissionDate: item?.task_closed_on && typeof item.task_closed_on === 'string' ? dayjs(item.task_closed_on).format('YYYY-MM-DD') : '',
            estimatedHours: Number(item?.task_estimated_hours ?? item?.estimated_hours ?? 0),
            actualHours: Number(item?.task_actual_hours_worked ?? item?.actual_hours_worked ?? 0),
            attachments: attachmentsFromApi.map(a => a.file_name),
            epicId: item?.task_epic_code ? String(item.task_epic_code) : '',
            epicKey: item?.task_epic_code ? `EPIC-${String(item.task_epic_code)}` : '',
            statusReason: refreshedStatusReason || undefined,
          };

          // Store previous start date before updating
          const previousStartDate = originalTaskDataRef.current?.startDate || '';
          
          setTaskData(refreshed);
          originalTaskDataRef.current = refreshed;
          originalApiDataRef.current = item;

          // If we moved to In Progress and start date was auto-set to today, scroll and blink
          if (isMovingToInProgress && refreshed.startDate) {
            const today = dayjs().format('YYYY-MM-DD');
            
            // Check if start date was auto-set to today (was empty or different before)
            if (refreshed.startDate === today && previousStartDate !== today) {
              // Scroll to start date field after a short delay
              setTimeout(() => {
                if (startDateRef.current) {
                  startDateRef.current.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                  });
                  
                  // Trigger blink animation
                  setHighlightStartDate(true);
                  
                  // Remove highlight after animation completes (3 seconds)
                  setTimeout(() => {
                    setHighlightStartDate(false);
                  }, 3000);
                }
              }, 300);
            }
          }
        } catch {
          // Non-blocking: keep optimistic UI if refetch fails
        }
      }
    } catch (e: any) {
      console.error('Failed to update task:', e);
      const errorMessage = e?.message || e?.detail || e?.error || 'Failed to update task. Please try again.';
      toast.error(errorMessage, {
        duration: 4000,
        position: 'top-right',
      });
      // Revert the optimistic update on error
      if (originalTaskDataRef.current) {
        setTaskData({ ...originalTaskDataRef.current });
      }
    }
  };

  // Direct status change with optional cancellation reason
  const handleStatusChangeDirect = async (newStatus: string, reason?: string) => {
    if (isReadOnly) return;
    const numericTaskId = extractTaskId(taskIdParam);
    if (!numericTaskId) return;
    try {
      // Enforce reason for Blocked/Cancelled/On Hold
      const ls = newStatus.toLowerCase();
      if ((ls.includes('blocked') || ls.includes('cancel') || ls.includes('hold')) && !String(reason || '').trim()) {
        toast.error('Please provide a reason for this status.');
        return;
      }
      const form = new URLSearchParams();
      const statusOptions = getStatusOptions();
      const statusOption = statusOptions.find(opt => {
        const label = opt.label.toLowerCase();
        const ns = newStatus.toLowerCase();
        return label === ns || (ns === 'to do' && label.includes('not yet started'));
      });
      if (statusOption) form.append('status_code', String(statusOption.value));

      // Backend handles auto start date when moving to In Progress
      if (reason) form.append('status_reason', String(reason));

      // Check if moving to In Progress
      const isMovingToInProgress = statusOption?.value === 'STS007' || 
        newStatus.toLowerCase().includes('in progress');
      const previousStartDate = originalTaskDataRef.current?.startDate || '';

      const response = await apiRequest<any>(`update_task/${numericTaskId}`, 'PUT', form);

      // Check for API error response
      if (response?.success_flag === false || response?.error) {
        const errorMsg = response?.message || response?.error || response?.detail || 'Failed to update status';
        toast.error(errorMsg, {
          duration: 4000,
          position: 'top-right',
        });
        return;
      }

      toast.success('Status updated');

      // Refetch latest task
      const resp = await apiRequest<TaskDetailsApiResponse>(`get_task/${encodeURIComponent(numericTaskId)}`, 'GET');
      const item: TaskDetailsApiData = resp?.data || (resp as unknown as TaskDetailsApiData);

      // Capture status reasons history if provided by API (task_all_status_reasons)
      try {
        const histRaw = (item as any)?.task_all_status_reasons;
        if (histRaw) {
          const parsed = Array.isArray(histRaw) ? histRaw : JSON.parse(histRaw);
          if (Array.isArray(parsed)) setStatusReasonsHistory(parsed);
        } else {
          setStatusReasonsHistory([]);
        }
      } catch { setStatusReasonsHistory([]); }
      const statusDesc = String(item?.task_status_description || item?.status_description || item?.status || '');
      // Use centralized status mapping function for consistency
      const mappedStatus: TaskData['status'] = getStatusDisplayLabel(statusDesc) as TaskData['status'];
      const priorityDesc = String(item?.task_priority_description || item?.priority_description || item?.priority || 'Low').toLowerCase();
      const mappedPriority: TaskData['priority'] = priorityDesc.includes('high') ? 'High' : priorityDesc.includes('medium') ? 'Medium' : 'Low';
      const attachmentsFromApi: EpicAttachment[] = Array.isArray(item?.attachments)
        ? item.attachments.map((a: AttachmentApiData) => ({
          id: a.id || 0,
          file_name: a.file_name || '',
          file_path: a.file_path || '',
          file_url: a.file_url || '',
          file_type: a.file_type || '',
          file_size: a.file_size || '',
          purpose: a.purpose || '',
          created_by: a.created_by || '',
          created_at: a.created_at || '',
        }))
        : [];
      setTaskAttachments(attachmentsFromApi);

      // Map product from API response
      const productObj = item?.product && typeof item.product === 'object' ? item.product : {};
      const product = String(item?.product_name ?? (productObj && 'product_name' in productObj ? (productObj as { product_name?: string }).product_name : undefined) ?? item?.product_code ?? (productObj && 'product_code' in productObj ? (productObj as { product_code?: string }).product_code : undefined) ?? '');

      // Extract work_mode from API response
      const refreshedWorkMode = String((item as any)?.task_work_mode ?? (item as any)?.work_mode ?? '');

      // Extract team from API response - prefer team_name over team_code
      const refreshedTeam = String((item as any)?.task_assigned_team_name ?? (item as any)?.task_team_code ?? (item as any)?.assigned_team_name ?? (item as any)?.team_code ?? '');

      // Extract status_reason from API response
      const refreshedStatusReason = String((item as any)?.task_status_reason ?? (item as any)?.status_reason ?? '');

      const refreshed: TaskData = {
        taskId: `TA-${String(item?.task_id || numericTaskId)}`,
        title: item?.task_title || '',
        description: item?.task_description || '',
        priority: mappedPriority,
        type: item?.task_type_name || 'Task',
        status: mappedStatus,
        team: refreshedTeam || undefined,
        assignee: (item?.task_assignee_name || item?.task_assignee) ? (item?.task_assignee_name || item?.task_assignee || '') : '',
        reporter: item?.task_reporter_name || item?.task_reporter || '',
        product,
        workMode: refreshedWorkMode || undefined,
        startDate: item?.task_start_date ? dayjs(item.task_start_date).format('YYYY-MM-DD') : '',
        dueDate: item?.task_due_date ? dayjs(item.task_due_date).format('YYYY-MM-DD') : '',
        submissionDate: item?.task_closed_on ? dayjs(item.task_closed_on).format('YYYY-MM-DD') : '',
        estimatedHours: Number(item?.task_estimated_hours ?? item?.estimated_hours ?? 0),
        actualHours: Number(item?.task_actual_hours_worked ?? item?.actual_hours_worked ?? 0),
        attachments: attachmentsFromApi.map(a => a.file_name),
        epicId: item?.task_epic_code ? String(item.task_epic_code) : '',
        epicKey: item?.task_epic_code ? `EPIC-${String(item.task_epic_code)}` : '',
        statusReason: refreshedStatusReason || undefined,
      };
      
      // Store previous start date before updating
      const prevStartDate = originalTaskDataRef.current?.startDate || '';
      
      setTaskData(refreshed);
      originalTaskDataRef.current = refreshed;
      originalApiDataRef.current = item;

      // If we moved to In Progress and start date was auto-set to today, scroll and blink
      if (isMovingToInProgress && refreshed.startDate) {
        const today = dayjs().format('YYYY-MM-DD');
        
        // Check if start date was auto-set to today (was empty or different before)
        if (refreshed.startDate === today && prevStartDate !== today) {
          // Scroll to start date field after a short delay
          setTimeout(() => {
            if (startDateRef.current) {
              startDateRef.current.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
              });
              
              // Trigger blink animation
              setHighlightStartDate(true);
              
              // Remove highlight after animation completes (3 seconds)
              setTimeout(() => {
                setHighlightStartDate(false);
              }, 3000);
            }
          }, 300);
        }
      }
    } catch (e: any) {
      console.error('Failed to update status with reason', e);
      const errorMessage = e?.message || e?.detail || e?.error || 'Failed to update status. Please try again.';
      toast.error(errorMessage, {
        duration: 4000,
        position: 'top-right',
      });
    }
  };

  const handleTaskDataChange = (field: keyof TaskData, value: TaskData[keyof TaskData]) => {
    if (isReadOnly) return;
    const originalValue = originalTaskDataRef.current?.[field];

    console.log('[DEBUG] handleTaskDataChange - field:', field, 'value:', value, 'originalValue:', originalValue);

    // Update local state immediately
    setTaskData(prev => ({
      ...prev,
      [field]: value
    }));

    // Update via API if value changed
    // Allow update if: (1) originalValue exists and is different, OR (2) originalValue is undefined but new value exists
    const hasValue = value !== undefined && value !== null && String(value).trim() !== '';
    const valuesDiffer = originalValue !== undefined && originalValue !== value;
    const shouldUpdate = valuesDiffer || (originalValue === undefined && hasValue);
    
    if (shouldUpdate) {
      console.log('[DEBUG] Values are different or setting new value, calling updateTask');
      updateTask(field, value, originalValue || '');
    } else {
      console.log('[DEBUG] Values are same or no value to set, skipping updateTask');
    }
  };

  const handleFileUpload = (files: File[]) => {
    // Just store the files, don't upload yet
    setUploadedFiles(files);
    handleTaskDataChange("attachments", files.map(f => f.name));
  };

  const handleSaveAttachments = async () => {
    if (isReadOnly || !taskIdParam || uploadedFiles.length === 0) return;

    try {
      const numericTaskId = extractTaskId(taskIdParam);
      const form = new FormData();
      form.append('parent_type', 'TASK');
      form.append('parent_code', String(numericTaskId));
      for (const f of uploadedFiles) form.append('attachments', f);

      await apiRequest<{ success_flag: boolean; message: string }>('add_attachments', 'POST', form);
      toast.success('Attachments uploaded successfully');

      setUploadedFiles([]);

      // Refresh task details to get updated attachments
      const resp = await apiRequest<TaskDetailsApiResponse>(`get_task/${encodeURIComponent(numericTaskId)}`, 'GET');
      const item: TaskDetailsApiData = resp?.data || (resp as unknown as TaskDetailsApiData);

      // Map attachments from API response
      const attachmentsFromApi: EpicAttachment[] = Array.isArray(item?.attachments)
        ? item.attachments.map((a: AttachmentApiData) => ({
          id: a.id || 0,
          file_name: a.file_name || '',
          file_path: a.file_path || '',
          file_url: a.file_url || '',
          file_type: a.file_type || '',
          file_size: a.file_size || '',
          purpose: a.purpose || '',
          created_by: a.created_by || '',
          created_at: a.created_at || '',
        }))
        : [];

      setTaskAttachments(attachmentsFromApi);
      const refreshedAttachments = attachmentsFromApi.map(a => a.file_name);
      handleTaskDataChange('attachments', refreshedAttachments);
    } catch (e: any) {
      console.error('Failed to upload attachments:', e);
      // Extract error message from API response
      const errorMessage = e?.message || e?.detail || 'Failed to upload attachments';
      toast.error(errorMessage);
    }
  };

  const handleFileRemove = (index: number) => {
    if (isReadOnly) return;
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    handleTaskDataChange("attachments", newFiles.map(f => f.name));
  };

  const handlePostComment = async () => {
    if (isReadOnly) return;
    const text = commentText.trim();
    if (!text) return;
    try {
      const numericTaskId = extractTaskId(taskIdParam);
      const params = new URLSearchParams();
      params.set('parent_type', 'TASK');
      params.set('parent_code', String(numericTaskId));
      params.set('comment_text', text);
      await apiRequest<{ success_flag: boolean; message: string }>('add_comment', 'POST', params);

      // Get current user info
      const user = getUserFromStorage();
      const userName = user?.userName || 'User';
      const currentDate = new Date().toLocaleDateString();

      // Add comment with user info
      const newComment: Comment = {
        text,
        author: userName,
        date: currentDate,
      };
      setComments(prev => [...prev, newComment]);
      setCommentText("");
      toast.success('Comment posted');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to post comment');
    }
  };

  const handleAssignToSelf = async () => {
    if (isReadOnly) return;
    const numericTaskId = extractTaskId(taskIdParam);
    if (!numericTaskId) return;

    try {
      // Call assign_task_to_self API - backend will resolve current user from auth
      const resp = await apiRequest<any>(`assign_task_to_self/${encodeURIComponent(numericTaskId)}`, 'POST');

      if (resp?.success_flag === false || resp?.error) {
        const errorMsg = resp?.message || resp?.error || 'Failed to assign task to self';
        toast.error(errorMsg);
        return;
      }

      // Optimistically update assignee in UI using current user name
      const user = getUserFromStorage();
      const userName = user?.userName;
      if (userName) {
        handleTaskDataChange("assignee", userName);
      }

      toast.success(resp?.message || 'Task assigned to you');
    } catch (e: any) {
      const errorMsg = e?.message || e?.detail || 'Failed to assign task to self';
      toast.error(errorMsg);
    }
  };

  if (loading) {
    return (
      <div className="p-2 sm:p-4 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-[10px] text-gray-600">Loading task details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-2 sm:p-4 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[10px] text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 min-h-screen">
      <div className="flex flex-col lg:flex-row gap-4">
        <LeftPanel
          taskData={taskData}
          onTaskDataChange={handleTaskDataChange}
          uploadedFiles={uploadedFiles}
          onFileUpload={handleFileUpload}
          onFileRemove={handleFileRemove}
          onSaveAttachments={handleSaveAttachments}
          existingAttachments={taskAttachments}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          commentText={commentText}
          onCommentTextChange={setCommentText}
          onPostComment={handlePostComment}
          comments={comments}
          isReadOnly={isReadOnly}
          statusReasonsHistory={statusReasonsHistory}
          taskId={taskData.taskId}
          subTasks={subTasks}
          onSubTaskCreated={() => {
            // Refetch task details to get updated subtasks
            const numericTaskId = extractTaskId(taskIdParam);
            const endpoint = `get_task/${numericTaskId}`;
            apiRequest<TaskDetailsApiResponse>(endpoint, 'GET')
              .then((resp) => {
                const item: TaskDetailsApiData = resp?.data || (resp as unknown as TaskDetailsApiData);
                // Parse subtasks again
                let parsedSubTasks: SubTask[] = [];
                try {
                  const taskSubtasksRaw = (item as any)?.task_subtasks;
                  if (taskSubtasksRaw) {
                    let subtasksArray: any[] = [];
                    if (typeof taskSubtasksRaw === 'string') {
                      try {
                        subtasksArray = JSON.parse(taskSubtasksRaw);
                      } catch {
                        subtasksArray = [];
                      }
                    } else if (Array.isArray(taskSubtasksRaw)) {
                      subtasksArray = taskSubtasksRaw;
                    }

                    parsedSubTasks = subtasksArray.map((st: any) => {
                      const subtaskId = String(st?.id ?? st?.subtask_id ?? '');
                      const subtaskTitle = String(st?.subtask_title ?? st?.title ?? '');
                      const subtaskDesc = String(st?.subtask_description ?? st?.description ?? st?.subtask_desc ?? '');
                      const statusDesc = String(st?.status_description ?? st?.status ?? '');
                      const status: SubTask['status'] = getStatusDisplayLabel(statusDesc) as SubTask['status'] || 'To Do';
                      const priorityDesc = String(st?.priority_description ?? st?.priority ?? 'Low').toLowerCase();
                      const priority: SubTask['priority'] = priorityDesc.includes('high')
                        ? 'High'
                        : priorityDesc.includes('medium')
                          ? 'Medium'
                          : 'Low';
                      const assignee = String(st?.assignee_name ?? st?.assignee ?? '');
                      const dueDate = st?.due_date ? String(st.due_date).slice(0, 10) : undefined;

                      return {
                        key: subtaskId,
                        id: `ST-${subtaskId}`,
                        title: subtaskTitle,
                        description: subtaskDesc,
                        priority,
                        assignee,
                        status,
                        dueDate,
                      };
                    });
                  }
                } catch (error) {
                  console.error('Error parsing task subtasks:', error);
                }
                setSubTasks(parsedSubTasks);
              })
              .catch((err) => {
                console.error('Failed to refresh subtasks:', err);
              });
          }}
        />
        <RightPanel
          taskData={taskData}
          onTaskDataChange={handleTaskDataChange}
          onStatusChange={handleStatusChangeDirect}
          isReadOnly={isReadOnly}
          onAssignToSelf={handleAssignToSelf}
          startDateRef={startDateRef}
          highlightStartDate={highlightStartDate}
        />
      </div>
    </div>
  );
}