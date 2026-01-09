"use client";

import { useEffect, useState } from "react";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { Epic, Task, EpicAttachment } from "@/app/types/EpicTypes";
import type { EpicApiResponse, EpicApiData, TaskApiData, AttachmentApiData } from "@/app/types/api";
import EpicLeftPanel from "./components/EpicLeftPanel";
import EpicRightPanel from "./components/EpicRightPanel";
import { apiRequest, getMasterDataFromCache } from "@/app/lib/api";
import { getPriorityOptions, getStatusOptions } from "@/app/lib/masterData";
import { toast } from "react-hot-toast";
import { getUserFromStorage } from "@/app/lib/auth/storage";
import type { Comment } from "@/app/components/shared/CommentsTab";
import dayjs from "dayjs";
import TaskOptionModal from "../components/TaskOptionModal";

function mapStatus(code?: string, description?: string): Epic["status"] {
  const label = (description || '').toString();
  if (label) {
    const lower = label.toLowerCase();
    if (lower.includes('progress')) return 'In Progress';
    if (lower.includes('on hold') || lower.includes('hold')) return 'On Hold';
    if (lower.includes('cancel')) return 'Blocked';
    if (lower.includes('closed') || lower.includes('done') || lower.includes('completed')) return 'Done';
    return 'To Do';
  }
  const options = getStatusOptions();
  const found = options.find(o => o.value === code);
  const norm = (found?.label || '').toLowerCase();
  if (norm.includes('progress')) return 'In Progress';
  if (norm.includes('on hold') || norm.includes('hold')) return 'On Hold';
  if (norm.includes('cancel')) return 'Blocked';
  if (norm.includes('closed') || norm.includes('done') || norm.includes('completed')) return 'Done';
  return 'To Do';
}

function mapPriority(code?: number | string, description?: string): Epic["priority"] {
  if (description) return description as Epic["priority"];
  const val = typeof code === 'number' ? String(code) : code;
  const opts = getPriorityOptions();
  const f = opts.find(o => o.value === val);
  return (f?.label || 'Low') as Epic["priority"];
}

export default function EpicDetailsPage() {
  const pathname = usePathname();
  // Management (mgmt) role should see epic details as read-only
  const user = getUserFromStorage();
  const rawRole = (user?.rawRole || "").toLowerCase();
  const userCode = (user?.userCode || "").toLowerCase();
  const isMgmt = rawRole === "mgmt" || rawRole === "management" || userCode === "mgmt";
  const isReadOnly = isMgmt;

  const params = useParams<{ id: string }>();
  const epicIdParam = (params?.id || '').toString();
  const [epicData, setEpicData] = useState<Epic | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState<boolean>(false);

  // Reusable function to fetch epic data
  const fetchEpic = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError("");
    try {
      const endpoint = `get_epics/${encodeURIComponent(epicIdParam)}`;
      const resp = await apiRequest<EpicApiResponse>(endpoint, 'GET');
      const it: EpicApiData = resp?.data?.epic || resp?.data || (resp as unknown as EpicApiData);
      const epicId = String(it?.epic_id ?? it?.id ?? epicIdParam);
      const title = it?.epic_title ?? '';
      const description = it?.epic_description ?? '';
      const statusCode = typeof it?.status === 'object' && it?.status !== null ? it.status.status_code : (typeof it?.status === 'string' ? it.status : it?.epic_status_code);
      const statusDesc = typeof it?.status === 'object' && it?.status !== null ? it.status.status_description : (it?.epic_status_description ?? '');
      const status = mapStatus(statusCode, statusDesc);
      const priorityCode = typeof it?.priority === 'object' && it?.priority !== null ? it.priority.priority_code : (typeof it?.priority === 'string' ? undefined : it?.epic_priority_code);
      const priorityDesc = typeof it?.priority === 'object' && it?.priority !== null ? it.priority.priority_description : (it?.epic_priority_description ?? '');
      const priority = mapPriority(priorityCode, priorityDesc);
      const product = (it?.product && typeof it.product === 'object' && 'product_code' in it.product ? it.product.product_code : '') || it?.product_code || it?.product_name || '';
      const startDate = (it?.epic_start_date ?? (it?.timeline && typeof it.timeline === 'object' && 'start_date' in it.timeline ? it.timeline.start_date : undefined) ?? it?.start_date ?? '').toString().slice(0, 10);
      const dueDate = (it?.epic_due_date ?? (it?.timeline && typeof it.timeline === 'object' && 'due_date' in it.timeline ? it.timeline.due_date : undefined) ?? it?.due_date ?? '').toString().slice(0, 10);
      const estimatedHours = Number((it?.budget && typeof it.budget === 'object' && 'estimated_hours' in it.budget ? it.budget.estimated_hours : undefined) ?? it?.estimated_hours ?? 0);
      const actualHours = Number(it?.actual_hours ?? 0);
      // Map tasks from API if present
      const rawTasks: TaskApiData[] = Array.isArray(it?.tasks) ? it.tasks : [];
      const tasksMapped = rawTasks.map((t: TaskApiData) => {
        const taskId = String(t?.task_id ?? '');
        const title = t?.task_title ?? '';
        const description = t?.task_description ?? t?.description ?? '';
        // Check both the pre-mapped status field and task_status_description
        const preMappedStatus = typeof t?.status === 'string' ? t.status : '';
        const statusDesc = String(t?.task_status_description || t?.status_description || '').toLowerCase();
        const statusLower = preMappedStatus ? preMappedStatus.toLowerCase() : statusDesc;
        let status: Task['status'] = 'To Do';
        if (statusLower.includes('on hold') || statusLower.includes('hold')) {
          status = 'On Hold';
        } else if (statusLower.includes('progress')) {
          status = 'In Progress';
        } else if (statusLower.includes('completed') || statusLower.includes('done') || statusLower.includes('closed')) {
          status = 'Done';
        } else if (statusLower.includes('cancel') || statusLower.includes('blocked')) {
          status = 'Blocked';
        }
        const priorityDesc = (t?.task_priority_description || t?.priority_description || '').toString();
        const priority: Task['priority'] = (priorityDesc === 'High' || priorityDesc === 'Medium' || priorityDesc === 'Low')
          ? priorityDesc
          : 'Low';
        const assignee = t?.task_assignee_name || t?.task_assignee || t?.assignee_name || t?.assignee || '';
        const reporter = t?.task_reporter_name || t?.task_reporter || t?.reporter_name || t?.reporter || '';
        const start = (t?.task_start_date ?? t?.start_date ?? '').toString().slice(0, 10);
        const due = (t?.task_due_date ?? t?.due_date ?? '').toString().slice(0, 10);
        const estimated = Number(t?.task_estimated_hours ?? t?.estimated_hours ?? 0);
        const actual = Number(t?.task_actual_hours_worked ?? t?.actual_hours_worked ?? 0);
        const productCodeOrName = (it?.product && typeof it.product === 'object' && 'product_code' in it.product ? it.product.product_code : '') || (it?.product && typeof it.product === 'object' && 'product_name' in it.product ? it.product.product_name : '') || it?.product_code || it?.product_name || '';
        const taskType: Task['taskType'] = 'Task';
        return {
          taskId,
          key: taskId ? `TA-${taskId}` : title,
          title,
          description,
          status,
          priority,
          assignee: String(assignee),
          reporter: String(reporter),
          epicId: epicId,
          startDate: start,
          dueDate: due,
          estimatedHours: estimated,
          actualHours: actual,
          product: String(productCodeOrName),
          taskType,
          attachments: [],
        } as unknown as Task;
      });

      // Sort tasks by taskId in ascending order (1, 2, 3...)
      const sortedTasksMapped = tasksMapped.sort((a, b) => {
        const aId = parseInt(a.taskId || '0', 10) || 0;
        const bId = parseInt(b.taskId || '0', 10) || 0;
        return aId - bId;
      });

      // Map attachments from API response
      const attachments: EpicAttachment[] = Array.isArray(it?.attachments)
        ? it.attachments.map((att: AttachmentApiData) => ({
          id: att.id,
          file_name: att.file_name || '',
          file_path: att.file_path || '',
          file_url: att.file_url || '', // Include file_url from API
          file_type: att.file_type || '',
          file_size: att.file_size || '',
          purpose: att.purpose || '',
          created_by: att.created_by || '',
          created_at: att.created_at || '',
        }))
        : [];

      // Extract status_reason from API response
      const statusReason = String((it as any)?.epic_status_reason ?? (it as any)?.status_reason ?? '');

      // Extract epic_all_status_reasons from API response
      let epicStatusReasonsHistory: Array<{ status_code?: string; status_reason?: string; created_at?: string; created_by?: string }> = [];
      try {
        const allReasonsRaw = (it as any)?.epic_all_status_reasons;
        if (Array.isArray(allReasonsRaw)) {
          epicStatusReasonsHistory = allReasonsRaw.map((r: any) => ({
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
              epicStatusReasonsHistory = parsed.map((r: any) => ({
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

      // Extract client and contact person information from API response
      // The API returns: epic_company_code, epic_company_name, epic_contact_person_code, epic_contact_person_name
      const companyCode = String(it?.epic_company_code ?? it?.company_code ?? '');
      const companyName = String(it?.epic_company_name ?? it?.company_name ?? '');
      const contactPersonCode = String(it?.epic_contact_person_code ?? it?.contact_person_code ?? '');
      const contactPersonName = String(it?.epic_contact_person_name ?? it?.contact_person_name ?? '');

      // Extract is_billable from API response - check multiple possible field names
      const isBillableRaw = it?.is_billable
        ?? it?.epic_is_billable
        ?? (it as any)?.billable
        ?? (it as any)?.epic_billable
        ?? false;
      // Handle both boolean and string values ("true"/"false")
      const isBillable = typeof isBillableRaw === 'boolean'
        ? isBillableRaw
        : (typeof isBillableRaw === 'string'
          ? (isBillableRaw.toLowerCase() === 'true' || isBillableRaw === '1')
          : Boolean(isBillableRaw));

      const mapped: Epic = {
        epicId,
        key: epicId ? `EPIC-${epicId}` : String(title),
        title: String(title),
        description: String(description),
        status,
        priority,
        reporter: String(it?.epic_reporter_name ?? it?.epic_reporter ?? it?.epic_created_by_name ?? it?.created_by_name ?? it?.created_by ?? ''),
        startDate,
        dueDate,
        product,
        estimatedHours,
        actualHours,
        progress: Number(it?.progress ?? 0),
        tasks: sortedTasksMapped,
        attachments,
        attachments_count: typeof it?.attachments_count === 'number' ? it.attachments_count : (typeof it?.attachments_count === 'string' ? Number(it.attachments_count) : attachments.length),
        statusReason,
        isBillable: isBillable,
        // Add client details from API response
        clientCode: companyCode || undefined,
        clientName: companyName || undefined,
        contactPersonCode: contactPersonCode || undefined,
        contactPersonName: contactPersonName || undefined,
        // Also store raw API fields for direct access
        epic_company_code: companyCode || undefined,
        epic_company_name: companyName || undefined,
        epic_contact_person_code: contactPersonCode || undefined,
        epic_contact_person_name: contactPersonName || undefined,
      } as Epic & {
        statusReason?: string;
        clientCode?: string;
        clientName?: string;
        contactPersonCode?: string;
        contactPersonName?: string;
        epic_company_code?: string;
        epic_company_name?: string;
        epic_contact_person_code?: string;
        epic_contact_person_name?: string;
      };
      setEpicData(mapped);
      setStatusReasonsHistory(epicStatusReasonsHistory);

      // Fetch comments for this epic (non-blocking for UI)
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
        const commentsResp = await apiRequest<CommentApiResponse>(`get_comments?parent_type=EPIC&parent_code=${encodeURIComponent(String(epicIdParam))}`, 'GET');
        const commentItems = Array.isArray(commentsResp?.data) ? commentsResp.data : [];
        const mappedComments: Comment[] = commentItems.map((c) => ({
          text: c.text || c.comment_text || '',
          author: c.author_name || c.commented_by_name || c.author_code || c.commented_by || 'User',
          date: c.commented_at ? new Date(c.commented_at).toLocaleDateString() : new Date().toLocaleDateString(),
        }));
        setComments(mappedComments);
      } catch {
        // ignore
      }

      // Fetch challenges for this epic (non-blocking for UI)
      try {
        interface ChallengeApiResponse {
          success_flag: boolean;
          data: Array<{
            challenge_title?: string;
            challenge_description?: string;
            title?: string;
            description?: string;
            created_by_name?: string;
            created_by?: string;
            created_at?: string;
          }>;
        }
        const challengesResp = await apiRequest<ChallengeApiResponse>(`get_challenges?parent_type=EPIC&parent_code=${encodeURIComponent(String(epicIdParam))}`, 'GET');
        const challengeItems = Array.isArray(challengesResp?.data) ? challengesResp.data : [];
        const mappedChallenges: Comment[] = challengeItems.map((c) => ({
          text: c.challenge_description || c.description || c.challenge_title || c.title || '',
          author: c.created_by_name || c.created_by || 'User',
          date: c.created_at ? new Date(c.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
        }));
        setChallenges(mappedChallenges);
      } catch {
        // ignore
      }
    } catch (e) {
      setError("Failed to load epic details");
      setEpicData(null);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (epicIdParam) fetchEpic();
  }, [epicIdParam]);
  
  // Check for tab query parameter
  const searchParams = useSearchParams();
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['activity', 'comments', 'challenges', 'reason'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  
  const [activeTab, setActiveTab] = useState("activity");
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [challenges, setChallenges] = useState<Comment[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [statusReasonsHistory, setStatusReasonsHistory] = useState<Array<{ status_code?: string; status_reason?: string; created_at?: string; created_by?: string }>>([]);

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

  const handleEpicDataChange = (field: keyof Epic, value: Epic[keyof Epic]) => {
    // Store original value for comparison
    const originalValue = epicData?.[field];

    // Update local state immediately for responsiveness
    setEpicData(prev => {
      if (!prev) return prev;
      const next = { ...prev } as Epic;
      switch (field) {
        case 'status': {
          // value is status_code from Select; map to label for display
          const opt = getStatusOptions().find(o => o.value === String(value));
          next.status = opt?.label ? (opt.label === 'Not yet started' ? 'To Do' : (opt.label as Epic['status'])) : next.status;
          break;
        }
        case 'priority': {
          const opt = getPriorityOptions().find(o => o.value === String(value));
          next.priority = (opt?.label as Epic['priority']) || next.priority;
          break;
        }
        case 'product':
          next.product = String(value || '');
          break;
        case 'startDate':
        case 'dueDate':
          next[field] = String(value || '');
          break;
        case 'estimatedHours':
        case 'actualHours':
          if (field === 'estimatedHours' || field === 'actualHours') {
            next[field] = Number(value || 0) as number;
          }
          break;
        default:
          (next as unknown as Record<string, unknown>)[field as string] = value;
      }
      return next;
    });

    // Fire-and-forget API update to backend
    (async () => {
      try {
        const form = new FormData();
        let hasChanges = false;

        switch (field) {
          case 'status':
            if (String(value) !== String(originalValue)) {
              form.append('status_code', String(value));
              hasChanges = true;
            }
            break;
          case 'priority':
            if (String(value) !== String(originalValue)) {
              form.append('priority_code', String(value));
              hasChanges = true;
            }
            break;
          case 'product':
            if (String(value) !== String(originalValue)) {
              form.append('product_code', String(value));
              hasChanges = true;
            }
            break;
          case 'startDate':
            if (String(value || '') !== String(originalValue || '')) {
              form.append('start_date', String(value));
              hasChanges = true;
            }
            break;
          case 'dueDate':
            if (String(value || '') !== String(originalValue || '')) {
              form.append('due_date', String(value));
              hasChanges = true;
            }
            break;
          case 'estimatedHours':
            if (Number(value || 0) !== Number(originalValue || 0)) {
              form.append('estimated_hours', String(value));
              hasChanges = true;
            }
            break;
          case 'actualHours':
            if (Number(value || 0) !== Number(originalValue || 0)) {
              form.append('actual_hours', String(value));
              hasChanges = true;
            }
            break;
          case 'isBillable':
            if (Boolean(value) !== Boolean(originalValue)) {
              form.append('is_billable', String(Boolean(value)));
              hasChanges = true;
            }
            break;
          case 'title': {
            const newTitle = String(value || '').trim();
            const originalTitle = String(originalValue || '').trim();
            if (newTitle !== originalTitle && newTitle) {
              form.append('epic_title', newTitle);
              hasChanges = true;
            }
            break;
          }
          case 'description': {
            const newDescription = String(value || '').trim();
            const originalDescription = String(originalValue || '').trim();
            if (newDescription !== originalDescription) {
              form.append('epic_description', newDescription);
              hasChanges = true;
            }
            break;
          }
          case 'reporter': {
            const newReporter = String(value || '').trim();
            const originalReporter = String(originalValue || '').trim();
            if (newReporter !== originalReporter) {
              const userCode = getUserCodeFromName(newReporter);
              if (userCode) {
                form.append('reporter', userCode);
                hasChanges = true;
              } else {
                // If not found by name, try sending as-is (might be a code)
                form.append('reporter', newReporter);
                hasChanges = true;
              }
            }
            break;
          }
          default:
            return; // unsupported field for update
        }

        // Only call API if there are actual changes
        if (!hasChanges) {
          return;
        }
        await apiRequest(`update_epic/${encodeURIComponent(epicIdParam)}`, 'PUT', form);
        const nice = (
          field === 'status' ? 'Status' :
            field === 'priority' ? 'Priority' :
              field === 'product' ? 'Product' :
                field === 'startDate' ? 'Start date' :
                  field === 'dueDate' ? 'Due date' :
                    field === 'estimatedHours' ? 'Estimated hours' :
                      field === 'isBillable' ? 'Is billable' :
                        field === 'actualHours' ? 'Actual hours' :
                          field === 'title' ? 'Title' :
                            field === 'description' ? 'Description' :
                              field === 'reporter' ? 'Reporter' :
                                'Epic'
        );
        toast.success(`${nice} updated`);

        // Refetch epic data to ensure UI is in sync with server
        await fetchEpic(false);
      } catch (e) {
        toast.error('Failed to update epic');
      }
    })();
  };

  const handleFileUpload = (files: File[]) => {
    // Just store the files, don't upload yet
    setUploadedFiles(files);
  };

  const handleSaveAttachments = async () => {
    if (!epicIdParam || uploadedFiles.length === 0) return;

    try {
      const form = new FormData();
      form.append('parent_type', 'EPIC');
      form.append('parent_code', String(epicIdParam));
      for (const f of uploadedFiles) form.append('attachments', f);

      await apiRequest<{ success_flag: boolean; message: string }>('add_attachments', 'POST', form);
      toast.success('Attachments uploaded successfully');

      // Clear uploaded files
      setUploadedFiles([]);

      // Refresh epic details to get updated attachments
      const resp = await apiRequest<EpicApiResponse>(`get_epics/${encodeURIComponent(epicIdParam)}`, 'GET');
      const it: EpicApiData = resp?.data?.epic || resp?.data || (resp as unknown as EpicApiData);

      // Re-run essential mapping for attachments only
      const attachments: EpicAttachment[] = Array.isArray(it?.attachments)
        ? it.attachments.map((att: AttachmentApiData) => ({
          id: att.id,
          file_name: att.file_name || '',
          file_path: att.file_path || '',
          file_url: att.file_url || '',
          file_type: att.file_type || '',
          file_size: att.file_size || '',
          purpose: att.purpose || '',
          created_by: att.created_by || '',
          created_at: att.created_at || '',
        }))
        : [];
      const attachmentsCount = typeof it?.attachments_count === 'number' ? it.attachments_count : (typeof it?.attachments_count === 'string' ? Number(it.attachments_count) : attachments.length);
      setEpicData(prev => prev ? { ...prev, attachments, attachments_count: attachmentsCount } : prev);
    } catch (e: unknown) {
      console.error('Failed to upload attachments:', e);
      // Extract error message from API response
      const errorMessage = (e instanceof Error ? e.message : (typeof e === 'object' && e !== null && 'detail' in e ? String((e as { detail?: string }).detail) : undefined)) || 'Failed to upload attachments';
      toast.error(errorMessage);
    }
  };

  const handleFileRemove = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
  };

  const handlePostComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    try {
      const params = new URLSearchParams();
      params.set('parent_type', 'EPIC');
      params.set('parent_code', String(epicIdParam));
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
    } catch (e: unknown) {
      const errorMessage = (e instanceof Error ? e.message : 'Failed to post comment');
      toast.error(errorMessage);
    }
  };

  const handlePostChallenge = async () => {
    const text = commentText.trim();
    if (!text) return;
    try {
      const form = new FormData();
      form.append('parent_type', 'EPIC');
      form.append('parent_code', String(epicIdParam));
      
      // Use first line (or first 100 chars) as title, full text as description
      const lines = text.split('\n');
      const challengeTitle = lines[0]?.trim().substring(0, 100) || text.substring(0, 100);
      const challengeDescription = text;
      
      form.append('challenge_title', challengeTitle);
      form.append('challenge_description', challengeDescription);
      
      await apiRequest<{ success_flag: boolean; message: string }>('create_challenge', 'POST', form);

      // Refresh challenges from API
      try {
        interface ChallengeApiResponse {
          success_flag: boolean;
          data: Array<{
            challenge_title?: string;
            challenge_description?: string;
            title?: string;
            description?: string;
            created_by_name?: string;
            created_by?: string;
            created_at?: string;
          }>;
        }
        const challengesResp = await apiRequest<ChallengeApiResponse>(`get_challenges?parent_type=EPIC&parent_code=${encodeURIComponent(String(epicIdParam))}`, 'GET');
        const challengeItems = Array.isArray(challengesResp?.data) ? challengesResp.data : [];
        const mappedChallenges: Comment[] = challengeItems.map((c) => ({
          text: c.challenge_description || c.description || c.challenge_title || c.title || '',
          author: c.created_by_name || c.created_by || 'User',
          date: c.created_at ? new Date(c.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
        }));
        setChallenges(mappedChallenges);
      } catch {
        // ignore refresh error
      }

      setCommentText("");
      toast.success('Challenge added');
    } catch (e: unknown) {
      const errorMessage = (e instanceof Error ? e.message : 'Failed to add challenge');
      toast.error(errorMessage);
    }
  };

  return (
    <div className="p-2 sm:p-4 min-h-screen">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-[10px] text-gray-600">Loading epic details...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <p className="text-[10px] text-red-600">{error}</p>
          </div>
        </div>
      ) : !epicData ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <p className="text-[10px] text-gray-600">Epic not found.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4">
          <EpicLeftPanel
            epicData={epicData}
            onEpicDataChange={handleEpicDataChange}
            uploadedFiles={uploadedFiles}
            onFileUpload={handleFileUpload}
            onFileRemove={handleFileRemove}
            onSaveAttachments={handleSaveAttachments}
            tasks={epicData.tasks}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            commentText={commentText}
            onCommentTextChange={setCommentText}
            onPostComment={handlePostComment}
            onPostChallenge={handlePostChallenge}
            comments={comments}
            challenges={challenges}
            isReadOnly={isReadOnly}
            statusReason={(epicData as any).statusReason}
            statusReasonsHistory={statusReasonsHistory}
            onCreateTaskClick={() => setCreateTaskModalOpen(true)}
          />
          <EpicRightPanel
            epicData={epicData}
            onEpicDataChange={handleEpicDataChange}
            onStatusChange={async (newStatus, reason) => {
              try {
                // Enforce reason for Blocked/Cancelled/On Hold
                const ls = String(newStatus || '').toLowerCase();
                if ((ls.includes('blocked') || ls.includes('cancel') || ls.includes('hold')) && !String(reason || '').trim()) {
                  toast.error('Please provide a reason for this status.');
                  return;
                }
                const form = new FormData();
                const opt = getStatusOptions().find(o => String(o.label).toLowerCase() === String(newStatus).toLowerCase());
                if (opt) form.append('status_code', opt.value);
                if (reason) form.append('status_reason', reason);

                // Backend handles auto start date when moving to In Progress

                await apiRequest(`update_epic/${encodeURIComponent(epicIdParam)}`, 'PUT', form);
                toast.success('Status updated');
                
                // Refetch epic to get updated data including start_date (if status changed to In Progress)
                // This will update all fields including startDate, status, and status reasons history
                await fetchEpic(false);
              } catch (e) {
                toast.error('Failed to update epic');
              }
            }}
            isReadOnly={isReadOnly}
          />
        </div>
      )}
      <TaskOptionModal
        open={createTaskModalOpen}
        onClose={() => setCreateTaskModalOpen(false)}
        epicId={epicIdParam}
        onCreated={async () => {
          // Refresh epic data to show the newly created task
          await fetchEpic(false);
        }}
      />
    </div>
  );
}

