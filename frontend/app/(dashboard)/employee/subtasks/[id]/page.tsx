"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { SubtaskData } from "./types";
import { EpicAttachment } from "@/app/types/EpicTypes";
import type { AttachmentApiData } from "@/app/types/api";
import { apiRequest, getMasterDataFromCache } from "@/app/lib/api";
import { getStatusOptions, getPriorityOptions, getWorkLocationOptions } from "@/app/lib/masterData";
import { getStatusDisplayLabel } from "@/app/lib/uiMaps";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";
import { getUserFromStorage } from "@/app/lib/auth/storage";
import type { Comment } from "@/app/components/shared/CommentsTab";
import SubtaskInfo from "./components/SubtaskInfo";
import SubtaskMetadata from "./components/SubtaskMetadata";
import AttachmentsSection from "../../tasks/[id]/components/AttachmentsSection";
import TabsSection from "../../tasks/[id]/components/TabsSection";

export default function SubtaskDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const subtaskIdParam = params?.id || '';

  // Extract numeric ID from subtask ID (remove prefix if present)
  const extractSubtaskId = (id: string): string => {
    if (!id) return '';
    // Remove ST-, SUBTASK-, SUB- prefixes
    return id.replace(/^(ST-|SUBTASK-|SUB-)/i, '');
  };

  const [subtaskAttachments, setSubtaskAttachments] = useState<EpicAttachment[]>([]);
  const [subtaskData, setSubtaskData] = useState<SubtaskData>({
    subtaskId: "",
    title: "",
    description: "",
    priority: "Low",
    status: "To Do",
    team: "",
    assignee: "",
    workMode: "",
    startDate: "",
    dueDate: "",
    closedDate: "",
    estimatedHours: 0,
    estimatedDays: 0,
    isBillable: true,
    attachments: [],
    parentTaskId: "",
    parentTaskTitle: "",
    parentEpicId: "",
    parentEpicTitle: "",
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [activeTab, setActiveTab] = useState("activity");
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [statusReasonsHistory, setStatusReasonsHistory] = useState<any[]>([]);
  
  // Management (mgmt) role should see subtask details as read-only
  const user = getUserFromStorage();
  const rawRole = (user?.rawRole || "").toLowerCase();
  const userCode = (user?.userCode || "").toLowerCase();
  const isMgmt = rawRole === "mgmt" || rawRole === "management" || userCode === "mgmt";
  const isReadOnly = isMgmt;

  // Store original subtask data for comparison
  const originalSubtaskDataRef = useRef<SubtaskData | null>(null);
  const originalApiDataRef = useRef<any>(null);
  const originalAssigneeCodeRef = useRef<string | null>(null);

  // Fetch subtask details from API
  useEffect(() => {
    const fetchSubtaskDetails = async () => {
      if (!subtaskIdParam) {
        setError("Subtask ID is required");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const numericSubtaskId = extractSubtaskId(subtaskIdParam);
        const endpoint = `get_subtask/${numericSubtaskId}`;
        const resp = await apiRequest<any>(endpoint, 'GET');

        // API response structure: resp.data contains the subtask object
        const item = resp?.data || resp;

        if (!item) {
          setError("Subtask not found");
          setLoading(false);
          return;
        }

        // Map API response to SubtaskData
        const subtaskId = String(item?.subtask_id ?? item?.id ?? numericSubtaskId);
        const title = item?.subtask_title ?? '';
        const description = item?.subtask_description ?? item?.description ?? '';

        // Map status
        const statusDesc = String(item?.status_description || item?.status || '');
        const status: SubtaskData['status'] = getStatusDisplayLabel(statusDesc) as SubtaskData['status'];

        // Map priority
        const priorityDesc = String(item?.priority_description || item?.priority || 'Low').toLowerCase();
        const priority: SubtaskData['priority'] = priorityDesc.includes('high')
          ? 'High'
          : priorityDesc.includes('medium')
            ? 'Medium'
            : 'Low';

        // Map assignment
        const assignee = item?.assignee_name ?? item?.assignee ?? '';
        const team = item?.assigned_team_name ?? item?.assigned_team_code ?? '';

        // Map timeline
        const startDate = item?.start_date
          ? String(item.start_date).slice(0, 10)
          : '';
        const dueDate = item?.due_date
          ? String(item.due_date).slice(0, 10)
          : '';
        const closedDate = item?.closed_on
          ? String(item.closed_on).slice(0, 10)
          : '';

        // Map budget
        const estimatedHours = Number(item?.estimated_hours ?? 0);
        const estimatedDays = Number(item?.estimated_days ?? 0);
        const isBillable = item?.is_billable ?? true;

        // Map work mode
        const workMode = item?.work_mode ?? '';

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

        // Map subtask data
        const mappedSubtaskData: SubtaskData = {
          subtaskId,
          title,
          description,
          priority,
          status,
          team,
          assignee,
          workMode,
          startDate,
          dueDate,
          closedDate,
          estimatedHours,
          estimatedDays,
          isBillable,
          attachments: attachmentsFromApi.map(a => a.file_name),
          parentTaskId: String(item?.parent_task_id ?? ''),
          parentTaskTitle: item?.parent_task_title ?? '',
          parentEpicId: String(item?.parent_epic_id ?? ''),
          parentEpicTitle: item?.parent_epic_title ?? '',
          statusReason: item?.status_reason ?? '',
        };

        setSubtaskData(mappedSubtaskData);
        originalSubtaskDataRef.current = { ...mappedSubtaskData };
        originalApiDataRef.current = item;
        setSubtaskAttachments(attachmentsFromApi);

        // Fetch comments
        try {
          interface CommentApiResponse {
            data?: Array<{
              text?: string;
              comment_text?: string;
              author_name?: string;
              commented_by_name?: string;
              author_code?: string;
              commented_by?: string;
              commented_at?: string;
            }>;
          }
          const commentsResp = await apiRequest<CommentApiResponse>(`get_comments?parent_type=SUBTASK&parent_code=${encodeURIComponent(String(numericSubtaskId))}`, 'GET');
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

        // Fetch status reasons history if available
        if (item?.all_status_reasons && Array.isArray(item.all_status_reasons)) {
          setStatusReasonsHistory(item.all_status_reasons);
        }
      } catch (e) {
        console.error('Failed to fetch subtask details:', e);
        setError('Failed to load subtask details');
      } finally {
        setLoading(false);
      }
    };

    fetchSubtaskDetails();
  }, [subtaskIdParam]);

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

  // Update subtask via API
  const updateSubtask = async (field: keyof SubtaskData, newValue: SubtaskData[keyof SubtaskData], originalValue: SubtaskData[keyof SubtaskData]) => {
    if (isReadOnly) return;
    const numericSubtaskId = extractSubtaskId(subtaskIdParam);
    if (!numericSubtaskId || !originalApiDataRef.current) return;

    try {
      const form = new URLSearchParams();
      let hasChanges = false;

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
        case 'startDate': {
          const newDate = formatDateForApi(String(newValue || ''));
          const originalDate = formatDateForApi(String(originalValue || ''));
          if (newDate !== originalDate) {
            if (newDate) {
              form.append('start_date', String(newDate));
            } else {
              form.append('start_date', '');
            }
            hasChanges = true;
          }
          break;
        }
        case 'dueDate': {
          const newDate = formatDateForApi(String(newValue || ''));
          const originalDate = formatDateForApi(String(originalValue || ''));
          if (newDate !== originalDate) {
            if (newDate) {
              form.append('due_date', String(newDate));
            } else {
              form.append('due_date', '');
            }
            hasChanges = true;
          }
          break;
        }
        case 'closedDate': {
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
        case 'estimatedHours': {
          const newHours = Number(newValue || 0);
          const originalHours = Number(originalValue || 0);
          if (newHours !== originalHours) {
            form.append('estimated_hours', String(newHours));
            hasChanges = true;
          }
          break;
        }
        case 'estimatedDays': {
          const newDays = Number(newValue || 0);
          const originalDays = Number(originalValue || 0);
          if (newDays !== originalDays) {
            form.append('estimated_days', String(newDays));
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
            } else if (!newAssignee) {
              // Clear assignee
              form.append('assignee', '');
              hasChanges = true;
              originalAssigneeCodeRef.current = null;
            }
          }
          break;
        }
        case 'team': {
          const newTeam = String(newValue || '').trim();
          const originalTeam = String(originalValue || '').trim();
          if (newTeam !== originalTeam) {
            // Map team name to team code from master data
            try {
              const md = getMasterDataFromCache<any>();
              const masterTeams = md?.data?.teams || [];
              const teamMatch = masterTeams.find((t: any) => 
                String(t.team_name || '').trim() === newTeam || 
                String(t.team_code || '').trim() === newTeam
              );
              if (teamMatch?.team_code) {
                const teamCode = String(teamMatch.team_code);
                form.append('assigned_team_code', teamCode);
                hasChanges = true;
              } else if (!newTeam) {
                // Clear team
                form.append('assigned_team_code', '');
                hasChanges = true;
              }
            } catch (e) {
              console.error('Error mapping team:', e);
            }
          }
          break;
        }
        case 'workMode': {
          const newWorkMode = String(newValue || '').trim();
          const originalWorkMode = String(originalValue || '').trim();
          if (newWorkMode !== originalWorkMode) {
            // Get work mode code from options
            const workLocationOptions = getWorkLocationOptions();
            const workModeOption = workLocationOptions.find(opt =>
              opt.label === newWorkMode || opt.value === newWorkMode
            );
            if (workModeOption) {
              form.append('work_mode', String(workModeOption.value));
            } else if (!newWorkMode) {
              form.append('work_mode', '');
            } else {
              form.append('work_mode', newWorkMode);
            }
            hasChanges = true;
          }
          break;
        }
        case 'isBillable': {
          const newBillable = Boolean(newValue);
          const originalBillable = Boolean(originalValue);
          if (newBillable !== originalBillable) {
            form.append('is_billable', String(newBillable));
            hasChanges = true;
          }
          break;
        }
        case 'title': {
          const newTitle = String(newValue || '').trim();
          const originalTitle = String(originalValue || '').trim();
          if (newTitle !== originalTitle && newTitle) {
            form.append('subtask_title', String(newTitle));
            hasChanges = true;
          }
          break;
        }
        case 'description': {
          const newDescription = String(newValue || '').trim();
          const originalDescription = String(originalValue || '').trim();
          if (newDescription !== originalDescription) {
            form.append('subtask_description', String(newDescription));
            hasChanges = true;
          }
          break;
        }
      }

      // Only call API if there are actual changes
      if (hasChanges) {
        const endpoint = `update_subtask/${numericSubtaskId}`;
        const response = await apiRequest<any>(endpoint, 'PUT', form);

        // Check for API error response
        if (response?.success_flag === false || response?.error) {
          const errorMsg = response?.message || response?.error || response?.detail || 'Failed to update subtask';
          toast.error(errorMsg, {
            duration: 4000,
            position: 'top-right',
          });
          // Revert the optimistic update
          if (originalSubtaskDataRef.current) {
            setSubtaskData({ ...originalSubtaskDataRef.current });
          }
          return;
        }

        const fieldName = field === 'startDate' ? 'Start date' :
          field === 'dueDate' ? 'Due date' :
            field === 'closedDate' ? 'Closed date' :
              field === 'estimatedHours' ? 'Estimated hours' :
                field === 'estimatedDays' ? 'Estimated days' :
                  field === 'title' ? 'Title' :
                    field === 'description' ? 'Description' :
                      field === 'workMode' ? 'Work mode' :
                        field.charAt(0).toUpperCase() + field.slice(1);
        toast.success(`${fieldName} updated successfully`);

        // Refetch latest subtask details from server to keep UI in sync
        try {
          const resp = await apiRequest<any>(`get_subtask/${numericSubtaskId}`, 'GET');
          const item = resp?.data || resp;

          // Map API response to SubtaskData
          const subtaskId = String(item?.subtask_id ?? item?.id ?? numericSubtaskId);
          const title = item?.subtask_title ?? '';
          const description = item?.subtask_description ?? item?.description ?? '';

          // Map status
          const statusDesc = String(item?.status_description || item?.status || '');
          const status: SubtaskData['status'] = getStatusDisplayLabel(statusDesc) as SubtaskData['status'];

          // Map priority
          const priorityDesc = String(item?.priority_description || item?.priority || 'Low').toLowerCase();
          const priority: SubtaskData['priority'] = priorityDesc.includes('high')
            ? 'High'
            : priorityDesc.includes('medium')
              ? 'Medium'
              : 'Low';

          // Map assignment
          const assignee = item?.assignee_name ?? item?.assignee ?? '';
          const team = item?.assigned_team_name ?? item?.assigned_team_code ?? '';

          // Map timeline
          const startDate = item?.start_date
            ? String(item.start_date).slice(0, 10)
            : '';
          const dueDate = item?.due_date
            ? String(item.due_date).slice(0, 10)
            : '';
          const closedDate = item?.closed_on
            ? String(item.closed_on).slice(0, 10)
            : '';

          // Map budget
          const estimatedHours = Number(item?.estimated_hours ?? 0);
          const estimatedDays = Number(item?.estimated_days ?? 0);
          const isBillable = item?.is_billable ?? true;

          // Map work mode
          const workMode = item?.work_mode ?? '';

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

          const refreshed: SubtaskData = {
            subtaskId,
            title,
            description,
            priority,
            status,
            team,
            assignee,
            workMode,
            startDate,
            dueDate,
            closedDate,
            estimatedHours,
            estimatedDays,
            isBillable,
            attachments: attachmentsFromApi.map(a => a.file_name),
            parentTaskId: String(item?.parent_task_id ?? ''),
            parentTaskTitle: item?.parent_task_title ?? '',
            parentEpicId: String(item?.parent_epic_id ?? ''),
            parentEpicTitle: item?.parent_epic_title ?? '',
            statusReason: item?.status_reason ?? '',
          };

          setSubtaskData(refreshed);
          originalSubtaskDataRef.current = refreshed;
          originalApiDataRef.current = item;
          setSubtaskAttachments(attachmentsFromApi);
        } catch {
          // Non-blocking: keep optimistic UI if refetch fails
        }
      }
    } catch (e: any) {
      console.error('Failed to update subtask:', e);
      const errorMessage = e?.message || e?.detail || e?.error || 'Failed to update subtask. Please try again.';
      toast.error(errorMessage, {
        duration: 4000,
        position: 'top-right',
      });
      // Revert the optimistic update on error
      if (originalSubtaskDataRef.current) {
        setSubtaskData({ ...originalSubtaskDataRef.current });
      }
    }
  };

  const handleSubtaskDataChange = (field: keyof SubtaskData, value: SubtaskData[keyof SubtaskData]) => {
    // Optimistically update UI
    setSubtaskData(prev => ({ ...prev, [field]: value }));
    
    // Get original value for comparison
    const originalValue = originalSubtaskDataRef.current?.[field];
    
    // Call update API
    updateSubtask(field, value, originalValue);
  };

  const handleFileUpload = (files: File[]) => {
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const handleFileRemove = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveAttachments = async () => {
    if (uploadedFiles.length === 0) {
      toast.error("No files to upload");
      return;
    }

    try {
      const form = new FormData();
      form.append("parent_type", "SUBTASK");
      form.append("parent_code", subtaskData.subtaskId);
      
      uploadedFiles.forEach((file) => {
        form.append("attachments", file);
      });

      await apiRequest("create_attachment", "POST", form);
      toast.success("Attachments uploaded successfully");
      setUploadedFiles([]);
      
      // Refresh subtask details to get updated attachments
      const numericSubtaskId = extractSubtaskId(subtaskIdParam);
      const endpoint = `get_subtask/${numericSubtaskId}`;
      const resp = await apiRequest<any>(endpoint, 'GET');
      const item = resp?.data || resp;
      
      if (item?.attachments) {
        const attachmentsFromApi: EpicAttachment[] = Array.isArray(item.attachments)
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
        setSubtaskAttachments(attachmentsFromApi);
        setSubtaskData(prev => ({
          ...prev,
          attachments: attachmentsFromApi.map(a => a.file_name),
        }));
      }
    } catch (e: any) {
      const errorMsg = e?.message || 'Failed to upload attachments';
      toast.error(errorMsg);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    try {
      const form = new FormData();
      form.append("parent_type", "SUBTASK");
      form.append("parent_code", subtaskData.subtaskId);
      form.append("comment_text", commentText);

      await apiRequest("create_comment", "POST", form);
      toast.success("Comment posted successfully");
      setCommentText("");

      // Refresh comments
      const numericSubtaskId = extractSubtaskId(subtaskIdParam);
      const commentsResp = await apiRequest<any>(`get_comments?parent_type=SUBTASK&parent_code=${encodeURIComponent(String(numericSubtaskId))}`, 'GET');
      const commentItems = Array.isArray(commentsResp?.data) ? commentsResp.data : [];
      const mappedComments: Comment[] = commentItems.map((c: any) => ({
        text: c.text || c.comment_text || '',
        author: c.author_name || c.commented_by_name || c.author_code || c.commented_by || 'User',
        date: c.commented_at ? new Date(c.commented_at).toLocaleDateString() : new Date().toLocaleDateString(),
      }));
      setComments(mappedComments);
    } catch (e: any) {
      const errorMsg = e?.message || 'Failed to post comment';
      toast.error(errorMsg);
    }
  };

  const handlePostChallenge = async () => {
    if (!commentText.trim()) {
      toast.error("Please enter a challenge description");
      return;
    }

    try {
      const numericSubtaskId = extractSubtaskId(subtaskIdParam);
      const form = new FormData();
      form.append("parent_type", "SUBTASK");
      form.append("parent_code", String(numericSubtaskId));
      
      // Use first line (or first 100 chars) as title, full text as description
      const lines = commentText.split('\n');
      const challengeTitle = lines[0]?.trim().substring(0, 100) || commentText.substring(0, 100);
      const challengeDescription = commentText;
      
      form.append("challenge_title", challengeTitle);
      form.append("challenge_description", challengeDescription);

      await apiRequest("create_challenge", "POST", form);
      toast.success("Challenge added successfully");
      setCommentText("");

      // Refresh comments (challenges are displayed in the same list)
      const commentsResp = await apiRequest<any>(`get_comments?parent_type=SUBTASK&parent_code=${encodeURIComponent(String(numericSubtaskId))}`, 'GET');
      const commentItems = Array.isArray(commentsResp?.data) ? commentsResp.data : [];
      const mappedComments: Comment[] = commentItems.map((c: any) => ({
        text: c.text || c.comment_text || '',
        author: c.author_name || c.commented_by_name || c.author_code || c.commented_by || 'User',
        date: c.commented_at ? new Date(c.commented_at).toLocaleDateString() : new Date().toLocaleDateString(),
      }));
      setComments(mappedComments);
    } catch (e: any) {
      const errorMsg = e?.message || 'Failed to add challenge';
      toast.error(errorMsg);
    }
  };

  const handleStatusChange = async (newStatus: SubtaskData['status']) => {
    if (isReadOnly) return;
    const originalValue = originalSubtaskDataRef.current?.status;
    handleSubtaskDataChange("status", newStatus);
  };

  const handleNavigateToParentTask = () => {
    if (subtaskData.parentTaskId) {
      router.push(`/employee/tasks/${subtaskData.parentTaskId}`);
    }
  };

  const handleNavigateToParentEpic = () => {
    if (subtaskData.parentEpicId) {
      router.push(`/employee/epics/${subtaskData.parentEpicId}`);
    }
  };

  if (loading) {
    return (
      <div className="p-2 sm:p-4 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-[10px] text-gray-600">Loading subtask details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-2 sm:p-4 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[10px] text-red-600">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 min-h-screen">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left Panel */}
        <div className="w-full lg:w-[70%] bg-white shadow-lg rounded-xl p-2 sm:p-4 text-xs">
          <SubtaskInfo
            subtaskData={subtaskData}
            onSubtaskDataChange={handleSubtaskDataChange}
            isReadOnly={isReadOnly}
          />
          
          <AttachmentsSection
            uploadedFiles={uploadedFiles}
            onFileUpload={handleFileUpload}
            onFileRemove={handleFileRemove}
            onSave={handleSaveAttachments}
            existingAttachments={subtaskAttachments}
            isReadOnly={isReadOnly}
          />
          
          <TabsSection
            activeTab={activeTab}
            onTabChange={setActiveTab}
            commentText={commentText}
            onCommentTextChange={setCommentText}
            onPostComment={handlePostComment}
            onPostChallenge={handlePostChallenge}
            comments={comments}
            isReadOnly={isReadOnly}
            status={subtaskData.status}
            statusReason={subtaskData.statusReason}
            statusReasonsHistory={statusReasonsHistory}
            taskId={subtaskData.subtaskId}
          />
        </div>

        {/* Right Panel */}
        <div className="w-full lg:w-[30%] bg-white shadow-lg rounded-xl p-2 sm:p-4 text-xs">
          <SubtaskMetadata
            subtaskData={subtaskData}
            onSubtaskDataChange={handleSubtaskDataChange}
            onStatusChange={handleStatusChange}
            isReadOnly={isReadOnly}
            onNavigateToParentTask={handleNavigateToParentTask}
            onNavigateToParentEpic={handleNavigateToParentEpic}
          />
        </div>
      </div>
    </div>
  );
}

