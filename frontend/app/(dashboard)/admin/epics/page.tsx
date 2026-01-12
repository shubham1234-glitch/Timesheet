"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Table, Tag, Select, Input, DatePicker } from "antd";
import Image from "next/image";
import { getRoleBase, buildRoleHref } from "@/app/lib/paths";
import { CalendarOutlined, ArrowUpOutlined, ArrowDownOutlined, MinusOutlined, PlusOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { Epic, Task, SubTask, EpicStatus, TaskStatus } from "@/app/types/EpicTypes";
import type { EpicApiResponse, EpicApiData, TaskApiData } from "@/app/types/api";
import { getProductOptions, getStatusOptions, getPriorityOptions, onMasterDataChange } from "@/app/lib/masterData";
import { statusTagColor, getStatusTextColor, getPriorityTextColor, priorityTagColor } from "@/app/lib/uiMaps";
import EpicOptionModal from "./components/EpicOptionModal";
import TaskOptionModal from "./components/TaskOptionModal";
import CreateTaskDrawer from "@/app/components/CreateTaskDrawer";
import CreateSubtaskDrawer from "@/app/components/CreateSubtaskDrawer";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { apiRequest } from "@/app/lib/api";

// Helper mappers from codes to labels using master options
function mapStatusCodeToLabel(code?: string): EpicStatus {
  const options = getStatusOptions();
  const found = options.find(o => o.value === code);
  const label = found?.label || "To Do";
  // Normalize to EpicStatus union
  if (label.toLowerCase().includes("progress")) return "In Progress";
  if (label.toLowerCase().includes("done") || label.toLowerCase().includes("completed")) return "Done";
  return "To Do";
}

function mapPriorityCodeToLabel(code?: number | string): Epic["priority"] {
  const val = typeof code === 'number' ? String(code) : code;
  const options = getPriorityOptions();
  const found = options.find(o => o.value === val);
  const label = (found?.label || "Low") as Epic["priority"];
  return label;
}

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case "High": return <ArrowUpOutlined style={{ color: '#ef4444' }} />; // red-500
    case "Medium": return <MinusOutlined style={{ color: '#eab308' }} />; // yellow-500
    case "Low": return <ArrowDownOutlined style={{ color: '#22c55e' }} />; // green-500
    default: return <MinusOutlined style={{ color: '#6b7280' }} />; // gray-500
  }
};

const formatTaskId = (taskId: string): string => {
  if (!taskId) return '';
  // Remove any existing prefix patterns (TA-, TASK-, TSK-)
  const cleanId = taskId.replace(/^(TA-|TASK-|TSK-)/i, '');
  // Add TA- prefix
  return `TA-${cleanId}`;
};

const getStatusColor = (status: string) => statusTagColor(status);

export default function AdminEpicsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Only admin can edit epics, others can only view
  const canEditEpics = pathname.includes('/admin/epics') && !pathname.includes('/super-admin/') && !pathname.includes('/employee/') && !pathname.includes('/hr/');
  
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [refreshNonce, setRefreshNonce] = useState<number>(0);
  const [dueDate, setDueDate] = useState<dayjs.Dayjs | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
  const [selectedPriority, setSelectedPriority] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [createEpicModalOpen, setCreateEpicModalOpen] = useState(false);
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);
  const [selectedEpicId, setSelectedEpicId] = useState<string | null>(null);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [createSubtaskDrawerOpen, setCreateSubtaskDrawerOpen] = useState(false);
  const [selectedTaskIdForSubtask, setSelectedTaskIdForSubtask] = useState<string | null>(null);
  const [challengeCounts, setChallengeCounts] = useState<Record<string, number>>({});

  // Master data options
  const [productOptions, setProductOptions] = useState(getProductOptions());
  const [statusOptions, setStatusOptions] = useState(getStatusOptions());
  const [priorityOptions, setPriorityOptions] = useState(getPriorityOptions());

  useEffect(() => {
    const update = () => {
      setProductOptions(getProductOptions());
      setStatusOptions(getStatusOptions());
      setPriorityOptions(getPriorityOptions());
    };
    const unsub = onMasterDataChange(update);
    update();
    return unsub;
  }, []);

  // Check URL params for epic to expand
  useEffect(() => {
    const expandedEpicId = searchParams?.get('expandedEpic');
    if (expandedEpicId && !loading && epics.length > 0) {
      // Find the epic and expand it
      const epic = epics.find(e => String(e.epicId) === String(expandedEpicId));
      if (epic) {
        setExpandedRowKeys([String(epic.epicId)]);
        // Remove the query param from URL after expanding
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('expandedEpic');
        router.replace(newUrl.pathname + newUrl.search, { scroll: false });
        // Scroll to the expanded epic
        setTimeout(() => {
          const epicRow = document.querySelector(`[data-row-key="${epic.epicId}"]`);
          if (epicRow) {
            epicRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    } else if (expandedEpicId && !loading && epics.length === 0) {
      // If we have the param but no epics loaded, trigger a refresh
      setRefreshNonce((n) => n + 1);
    }
  }, [searchParams, epics, router, loading]);

  // Fetch epics from API
  useEffect(() => {
    const fetchEpics = async () => {
      setLoading(true);
      setError("");
      try {
        const params: Record<string, string> = {};
        if (selectedProduct) params.product_code = selectedProduct;
        if (selectedStatus) params.epic_status_code = selectedStatus;
        if (selectedPriority) params.epic_priority_code = String(selectedPriority);
        if (dueDate) params.due_date_to = dayjs(dueDate).format('YYYY-MM-DD');
        params.limit = '100';
        params.offset = '0';

        const qs = new URLSearchParams(params).toString();
        const endpoint = qs ? `get_epics?${qs}` : `get_epics`;
        const resp = await apiRequest<EpicApiResponse>(endpoint, 'GET');
        const items: EpicApiData[] = Array.isArray(resp?.data?.epics)
          ? resp.data.epics
          : Array.isArray(resp?.data) 
              ? resp.data 
              : [];

        const mapped: Epic[] = items.map((it) => {
          const epicId = String(it.epic_id ?? it.id ?? '');
          const title = it.epic_title ?? it.title ?? '';
          const description = it.epic_description ?? it.description ?? '';
          // Prefer description strings from API directly (use epic_* fields)
          const statusLabel: string = (typeof (it as any).epic_status_description === 'string'
            ? (it as any).epic_status_description
            : '') || (typeof it.status === 'string' ? it.status : '') || '';
          const priorityLabel: string = (typeof it.priority_description === 'string' ? it.priority_description : '') || (typeof it.priority === 'string' ? it.priority : '') || '';
          // Fallback to code-to-label maps if labels absent
          const status: EpicStatus = statusLabel
            ? (statusLabel.toLowerCase().includes('progress')
                ? 'In Progress'
                : statusLabel.toLowerCase().includes('on hold') || statusLabel.toLowerCase().includes('hold')
                  ? 'On Hold'
                  : statusLabel.toLowerCase().includes('cancel')
                    ? 'Blocked'
                    : (statusLabel.toLowerCase().includes('closed') || statusLabel.toLowerCase().includes('done') || statusLabel.toLowerCase().includes('completed'))
                      ? 'Done'
                      : 'To Do')
            : mapStatusCodeToLabel(typeof (it as any).epic_status_code === 'string' ? (it as any).epic_status_code : undefined);
          const priority = (priorityLabel || mapPriorityCodeToLabel(typeof it.priority_code === 'number' || typeof it.priority_code === 'string' ? it.priority_code : undefined)) as Epic['priority'];
          const product = it.product_name ?? it.product_code ?? '';
          const client = it.epic_company_name ?? (it as any).epic_company_code ?? (it as any).client_name ?? (it as any).client_code ?? (it as any).client ?? '';
          // Use epic-level dates if provided by backend
          const startDate = it.epic_start_date ? dayjs(it.epic_start_date).format('YYYY-MM-DD') : '';
          const dueDate = it.epic_due_date ? dayjs(it.epic_due_date).format('YYYY-MM-DD') : '';
          const estimatedHours = Number(it.estimated_hours ?? 0);
          const actualHours = Number(it.actual_hours ?? 0);
          const progress = Number(it.progress ?? 0);
          // Map tasks under epic if present
          const rawTasks: TaskApiData[] = Array.isArray(it.tasks) ? it.tasks : [];
          const tasks = rawTasks.map((t: TaskApiData) => {
            const taskId = String(t?.task_id ?? '');
            const taskTitle = t?.task_title ?? '';
            const taskDesc = t?.task_description ?? '';
            
            // First check if API already provided a mapped status field
            const preMappedStatus = typeof t?.status === 'string' ? t.status : '';
            let taskStatus: TaskStatus;
            if (preMappedStatus) {
              // Use pre-mapped status from API, normalize to TaskStatus
              const lower = preMappedStatus.toLowerCase();
              if (lower.includes('on hold') || lower.includes('hold')) {
                taskStatus = 'On Hold';
              } else if (lower.includes('progress')) {
                taskStatus = 'In Progress';
              } else if (lower.includes('completed') || lower.includes('done') || lower.includes('closed')) {
                taskStatus = 'Done';
              } else if (lower.includes('cancel') || lower.includes('blocked')) {
                taskStatus = 'Blocked';
              } else {
                taskStatus = 'To Do';
              }
            } else {
              // Fallback to mapping from task_status_description
              const statusDesc = String(t?.task_status_description || '').toLowerCase();
              if (statusDesc.includes('on hold') || statusDesc.includes('hold')) {
                taskStatus = 'On Hold';
              } else if (statusDesc.includes('progress')) {
                taskStatus = 'In Progress';
              } else if (statusDesc.includes('completed') || statusDesc.includes('done') || statusDesc.includes('closed')) {
                taskStatus = 'Done';
              } else if (statusDesc.includes('cancel') || statusDesc.includes('blocked')) {
                taskStatus = 'Blocked';
              } else {
                taskStatus = 'To Do';
              }
            }
            const taskPriorityDesc = (t?.task_priority_description || 'Low').toString();
            const taskPriority: Epic['priority'] = (taskPriorityDesc === 'High' || taskPriorityDesc === 'Medium' || taskPriorityDesc === 'Low')
              ? taskPriorityDesc
              : 'Low';
            const assignee = t?.task_assignee_name || '';
            const reporter = t?.task_reporter_name || '';
            const start = t?.task_start_date ? dayjs(t.task_start_date).format('YYYY-MM-DD') : '';
            const due = t?.task_due_date ? dayjs(t.task_due_date).format('YYYY-MM-DD') : '';
            const estimated = Number(t?.task_estimated_hours ?? 0);
            const actual = Number(t?.task_actual_hours_worked ?? 0);
            
            // Parse subtasks from task_subtasks if present
            let subTasks: SubTask[] = [];
            try {
              const taskSubtasksRaw = (t as any)?.task_subtasks;
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

                subTasks = subtasksArray.map((st: any) => {
                  const subtaskId = String(st?.id ?? st?.subtask_id ?? '');
                  const subtaskTitle = String(st?.subtask_title ?? st?.title ?? '');
                  const subtaskDesc = String(st?.subtask_description ?? st?.description ?? st?.subtask_desc ?? '');
                  
                  // Map status - SubTask interface only supports "To Do" | "In Progress" | "Completed"
                  const statusDesc = String(st?.status_description ?? st?.status ?? '');
                  let subtaskStatus: SubTask['status'] = 'To Do';
                  if (statusDesc.toLowerCase().includes('progress')) {
                    subtaskStatus = 'In Progress';
                  } else if (statusDesc.toLowerCase().includes('done') || statusDesc.toLowerCase().includes('completed')) {
                    subtaskStatus = 'Completed';
                  }
                  
                  // Map priority
                  const priorityDesc = String(st?.priority_description ?? st?.priority ?? 'Low').toLowerCase();
                  const subtaskPriority: SubTask['priority'] = priorityDesc.includes('high')
                    ? 'High'
                    : priorityDesc.includes('medium')
                      ? 'Medium'
                      : 'Low';
                  
                  // Map assignee
                  const subtaskAssignee = String(st?.assignee_name ?? st?.assignee ?? '');
                  
                  // Map due date
                  const subtaskDueDate = st?.due_date 
                    ? String(st.due_date).slice(0, 10)
                    : '';

                  return {
                    key: subtaskId,
                    id: `ST-${subtaskId}`,
                    title: subtaskTitle,
                    description: subtaskDesc,
                    priority: subtaskPriority,
                    assignee: subtaskAssignee,
                    status: subtaskStatus,
                    dueDate: subtaskDueDate,
                  } as SubTask;
                });
              }
            } catch (error) {
              console.error('Error parsing task subtasks:', error);
              subTasks = [];
            }
            
            return {
              taskId,
              key: taskId ? formatTaskId(taskId) : taskTitle,
              title: taskTitle,
              description: taskDesc,
              status: taskStatus,
              priority: taskPriority,
              assignee: String(assignee),
              reporter: String(reporter),
              epicId: epicId,
              startDate: start,
              dueDate: due,
              estimatedHours: estimated,
              actualHours: actual,
              product,
              taskType: 'Task',
              attachments: [],
              subTasks,
            } as Task;
          }).sort((a, b) => {
            // Sort tasks by taskId in ascending order: 1, 2, 3, ...
            const aId = parseInt(a.taskId || '0', 10) || 0;
            const bId = parseInt(b.taskId || '0', 10) || 0;
            return aId - bId;
          });

          return {
            epicId,
            key: epicId ? `EPIC-${epicId}` : title,
            title,
            description,
            status,
            priority,
            reporter: it.created_by_name ?? it.created_by ?? '',
            startDate,
            dueDate,
            product,
            client,
            estimatedHours,
            actualHours,
            progress,
            tasks,
          } as Epic;
        });
        setEpics(mapped);
        
        // Fetch challenge counts for all epics in parallel
        const challengeCountPromises = mapped.map(async (epic) => {
          try {
            const challengesResp = await apiRequest<{ success_flag: boolean; data: any[] }>(
              `get_challenges?parent_type=EPIC&parent_code=${encodeURIComponent(String(epic.epicId))}`,
              'GET'
            );
            const count = Array.isArray(challengesResp?.data) ? challengesResp.data.length : 0;
            return { epicId: String(epic.epicId), count };
          } catch {
            return { epicId: String(epic.epicId), count: 0 };
          }
        });
        
        const challengeResults = await Promise.all(challengeCountPromises);
        const countsMap: Record<string, number> = {};
        challengeResults.forEach(({ epicId, count }) => {
          countsMap[epicId] = count;
        });
        setChallengeCounts(countsMap);
      } catch (e) {
        setEpics([]);
        setError('Failed to load epics');
      } finally {
        setLoading(false);
      }
    };
    fetchEpics();
  }, [selectedProduct, selectedStatus, selectedPriority, dueDate, refreshNonce]);

  const filteredEpics = useMemo(() => {
    let filtered = epics;

    // Apply due date filter (client-side backup to ensure it works)
    if (dueDate) {
      filtered = filtered.filter((epic) => {
        if (!epic.dueDate) return false;
        // Parse the due date (format: YYYY-MM-DD)
        const epicDueDate = dayjs(epic.dueDate, 'YYYY-MM-DD');
        // Filter: show epics due exactly on the selected date
        return epicDueDate.isSame(dueDate, 'day');
      });
    }

    // Apply search filter
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((epic) => {
        // Search in epic key, title, description, product, client, status, priority
        const key = (epic.key || '').toLowerCase();
        const title = (epic.title || '').toLowerCase();
        const description = (epic.description || '').toLowerCase();
        const product = (epic.product || '').toLowerCase();
        const client = (epic.client || '').toLowerCase();
        const status = (epic.status || '').toLowerCase();
        const priority = (epic.priority || '').toLowerCase();
        
        return (
          key.includes(query) ||
          title.includes(query) ||
          description.includes(query) ||
          product.includes(query) ||
          client.includes(query) ||
          status.includes(query) ||
          priority.includes(query)
        );
      });
    }

    // Sort by epicId in descending order (latest first)
    filtered = [...filtered].sort((a, b) => {
      const aId = parseInt(a.epicId || '0', 10) || 0;
      const bId = parseInt(b.epicId || '0', 10) || 0;
      return bId - aId;
    });

    return filtered;
  }, [epics, searchQuery, dueDate]);

  const handleCreateTask = (epicId: string) => {
    setSelectedEpicId(epicId);
    setCreateTaskModalOpen(true);
  };


  const roleBase = getRoleBase(pathname || '');
  
  // Subtask columns for expandable rows
  const subtaskColumns = [
    {
      title: "Sub Task",
      key: "subtask",
      render: (_: unknown, record: SubTask) => (
        <div className="flex items-start gap-2 min-w-[200px] sm:min-w-[250px] pl-6">
          <a
            href={`${roleBase}/subtasks/${record.id.replace(/^(ST-|SUBTASK-|SUB-)/i, '')}`}
            className="text-blue-600 font-medium hover:text-blue-800 hover:underline text-xs flex-shrink-0"
            onClick={(e) => {
              e.preventDefault();
              router.push(`${roleBase}/subtasks/${record.id.replace(/^(ST-|SUBTASK-|SUB-)/i, '')}`);
            }}
          >
            {record.id}
          </a>
          <div className="text-xs text-gray-600 truncate">{record.title}</div>
        </div>
      ),
    },
    {
      title: "Assignee",
      dataIndex: "assignee",
      key: "assignee",
      render: (assignee: string) => <span className="text-xs">{assignee || '-'}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <span className={`text-xs ${getStatusTextColor(status)}`}>
          {status}
        </span>
      ),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (priority: string) => (
        <div className="flex items-center gap-1">
          {getPriorityIcon(priority)}
          <span className={`text-xs ${getPriorityTextColor(priority)}`}>{priority}</span>
        </div>
      ),
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      render: (date: string) => {
        if (!date) return <span className="text-xs whitespace-nowrap text-gray-400">-</span>;
        const dateObj = dayjs(date);
        if (!dateObj.isValid()) return <span className="text-xs whitespace-nowrap text-gray-400">-</span>;
        return <span className="text-xs whitespace-nowrap">{dateObj.format("DD/MM/YYYY")}</span>;
      },
    },
  ];
  
  const taskColumns = [
    {
      title: "Task",
      key: "task",
      render: (_: unknown, record: Task) => (
        <div className="flex items-start gap-2 min-w-[200px] sm:min-w-[250px]">
          <Image src="/icons/jira-task.svg" alt="Task" width={16} height={16} className="flex-shrink-0" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
            <a
              href={`${roleBase}/tasks/${record.taskId}`}
              className="text-blue-600 font-medium hover:text-blue-800 hover:underline text-xs flex-shrink-0"
              onClick={(e) => {
                e.preventDefault();
                router.push(`${roleBase}/tasks/${record.taskId}`);
              }}
            >
              {formatTaskId(record.taskId)}
            </a>
            <div className="text-xs text-gray-600 truncate">{record.title}</div>
          </div>
        </div>
      ),
    },
    {
      title: "Assignee",
      dataIndex: "assignee",
      key: "assignee",
      render: (assignee: string) => <span className="text-xs">{assignee}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: TaskStatus) => (
        <Tag color={getStatusColor(status)} className="rounded-full text-xs">
          {status}
        </Tag>
      ),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (priority: string) => (
        <div className="flex items-center gap-1">
          {getPriorityIcon(priority)}
          <Tag color={priorityTagColor(priority)} className="rounded-full text-xs">{priority}</Tag>
        </div>
      ),
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      render: (date: string) => {
        if (!date) return <span className="text-xs whitespace-nowrap text-gray-400">-</span>;
        const dateObj = dayjs(date);
        if (!dateObj.isValid()) return <span className="text-xs whitespace-nowrap text-gray-400">-</span>;
        return <span className="text-xs whitespace-nowrap">{dateObj.format("DD/MM/YYYY")}</span>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      className: canEditEpics ? "" : "hidden",
      render: (_: unknown, record: Task) => (
        canEditEpics ? (
          <button
            onClick={() => {
              setSelectedTaskIdForSubtask(record.taskId);
              setCreateSubtaskDrawerOpen(true);
            }}
            className="text-blue-600 hover:text-blue-800 text-xs underline flex items-center gap-1 whitespace-nowrap"
            type="button"
          >
            <PlusOutlined />
            Add Subtask
          </button>
        ) : null
      ),
    },
  ];

  // Columns for epic table
  const epicColumns = [
    {
      title: "Epic",
      dataIndex: "key",
      key: "key",
      render: (_: string, record: Epic) => {
        const challengeCount = challengeCounts[String(record.epicId)] || 0;
        return (
        <div className="text-xs flex items-start gap-2 min-w-[200px] sm:min-w-[280px]">
            <Image src="/icons/jira-epic.svg" alt="Epic" width={16} height={16} className="flex-shrink-0 mt-0.5" />
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0 flex-1">
            <a
              href={buildRoleHref(roleBase, `/epics/${record.epicId}`)}
              onClick={(e) => { e.preventDefault(); router.push(buildRoleHref(roleBase, `/epics/${record.epicId}`)); }}
              className="text-blue-600 font-medium hover:text-blue-800 hover:underline text-xs flex-shrink-0"
            >
              {record.key}
            </a>
              <div className="text-xs text-gray-600 truncate flex-1">{record.title}</div>
              {challengeCount > 0 && (
                <div 
                  className="flex items-center gap-1.5 flex-shrink-0 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 group hover:bg-red-100 transition-colors cursor-pointer" 
                  title={`${challengeCount} challenge${challengeCount > 1 ? 's' : ''} - Click to view`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(buildRoleHref(roleBase, `/epics/${record.epicId}?tab=challenges`));
                  }}
                >
                  <ExclamationCircleOutlined className="text-red-600 text-xs" />
                  <span className="text-red-600 font-semibold text-[10px] leading-none">{challengeCount}</span>
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: EpicStatus) => (
        <Tag color={getStatusColor(status)} className="rounded-full text-xs">{status}</Tag>
      ),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (priority: string) => (
        <div className="flex items-center gap-1">
          {getPriorityIcon(priority)}
          <Tag color={priorityTagColor(priority)} className="rounded-full text-xs">{priority}</Tag>
        </div>
      ),
    },
    {
      title: "Product",
      dataIndex: "product",
      key: "product",
      render: (product: string) => <span className="text-xs">{product}</span>,
    },
    {
      title: "Client",
      dataIndex: "client",
      key: "client",
      render: (client: string) => <span className="text-xs">{client || '-'}</span>,
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      render: (date: string) => <span className="text-xs whitespace-nowrap">{dayjs(date).format("DD/MM/YYYY")}</span>,
    },
    {
      title: "Actions",
      key: "actions",
      className: canEditEpics ? "" : "hidden",
      render: (_: unknown, record: Epic) => (
        canEditEpics ? (
          <button
            onClick={() => handleCreateTask(record.epicId)}
            className="text-blue-600 hover:text-blue-800 text-xs underline flex items-center gap-1 whitespace-nowrap"
            type="button"
          >
            <PlusOutlined />
            Add Task
          </button>
        ) : null
      ),
    },
  ];

  return (
    <div className="p-3 sm:p-4 md:p-6 text-xs">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-semibold text-gray-800">Epics</h1>
          <p className="text-xs text-gray-600 mt-1">{canEditEpics ? 'Manage epics and their associated tasks' : 'View epics and their associated tasks'}</p>
        </div>
        {canEditEpics && (
          <button
            onClick={() => setCreateEpicModalOpen(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <PlusOutlined />
            Create Epic
          </button>
        )}
      </div>

      {/* Filters - responsive grid layout */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Input
          placeholder="Search epics..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
          size="small"
          allowClear
        />
        <DatePicker
          value={dueDate}
          onChange={setDueDate}
          placeholder="Due Date"
          className="w-full"
          format="DD/MM/YYYY"
          suffixIcon={<CalendarOutlined />}
          size="small"
          style={{ width: '100%' }}
        />
        <Select
          value={selectedProduct}
          onChange={setSelectedProduct}
          placeholder="Product"
          className="w-full"
          allowClear
          size="small"
          options={productOptions}
          style={{ width: '100%' }}
        />
        <Select
          value={selectedStatus}
          onChange={setSelectedStatus}
          placeholder="Status"
          className="w-full"
          allowClear
          size="small"
          options={statusOptions.map(o => ({ value: o.value, label: (<span className={getStatusTextColor(String(o.label))}>{o.label}</span>) }))}
          style={{ width: '100%' }}
        />
        <Select
          value={selectedPriority}
          onChange={setSelectedPriority}
          placeholder="Priority"
          className="w-full"
          allowClear
          size="small"
          options={priorityOptions.map(o => ({ value: o.value, label: (<span className={getPriorityTextColor(String(o.label))}>{o.label}</span>) }))}
          style={{ width: '100%' }}
        />
      </div>

      {/* Epics Table with expandable tasks */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">Loading epics...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      ) : filteredEpics.length > 0 ? (
        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <div className="min-w-[600px] sm:min-w-0">
            <Table
              columns={epicColumns}
              dataSource={filteredEpics}
              rowKey="epicId"
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              expandable={{
                expandedRowRender: (epic: Epic) => (
                  <div className="p-2">
                    {epic.tasks.length > 0 ? (
                      <div className="overflow-x-auto -mx-2">
                        <div className="min-w-[500px]">
                          <Table
                            columns={taskColumns}
                            dataSource={epic.tasks}
                            rowKey="taskId"
                            size="small"
                            pagination={false}
                            className="text-xs sticky-header-table"
                            scroll={{ x: 'max-content' }}
                            expandable={{
                              expandedRowRender: (task: Task) => (
                                <div className="p-2">
                                  {task.subTasks && task.subTasks.length > 0 ? (
                                    <div className="overflow-x-auto -mx-2">
                                      <div className="min-w-[500px]">
                                        <Table
                                          columns={subtaskColumns}
                                          dataSource={task.subTasks}
                                          rowKey="key"
                                          size="small"
                                          pagination={false}
                                          className="text-xs sticky-header-table"
                                          scroll={{ x: 'max-content' }}
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-500 pl-6">No subtasks yet. Add a subtask to get started.</div>
                                  )}
                                </div>
                              ),
                              rowExpandable: (task: Task) => true,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">No tasks yet. Add a task to get started.</div>
                    )}
                  </div>
                ),
                rowExpandable: (epic: Epic) => true,
                expandedRowKeys: expandedRowKeys,
                onExpandedRowsChange: (expandedKeys: readonly React.Key[]) => {
                  setExpandedRowKeys([...expandedKeys]);
                },
              }}
              className="text-xs"
              loading={loading}
            />
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8 text-center">
          <p className="text-xs sm:text-sm text-gray-500">No epics found. Create your first epic to get started.</p>
        </div>
      )}

      {/* Modals and Drawers */}
      <EpicOptionModal
        open={createEpicModalOpen}
        onClose={() => setCreateEpicModalOpen(false)}
        onCreated={() => setRefreshNonce((n) => n + 1)}
      />
      {selectedEpicId && (
        <TaskOptionModal
          open={createTaskModalOpen}
          onClose={() => {
            setCreateTaskModalOpen(false);
            setSelectedEpicId(null);
          }}
          epicId={selectedEpicId}
          onCreated={() => {
            // Refetch epics immediately after a task is created
            setRefreshNonce((n) => n + 1);
          }}
        />
      )}
      {selectedTaskIdForSubtask && (
        <CreateSubtaskDrawer
          title="Create Subtask"
          open={createSubtaskDrawerOpen}
          onClose={() => {
            setCreateSubtaskDrawerOpen(false);
            setSelectedTaskIdForSubtask(null);
          }}
          taskId={Number(selectedTaskIdForSubtask)}
          onCreated={() => {
            setCreateSubtaskDrawerOpen(false);
            setSelectedTaskIdForSubtask(null);
            // Refetch epics to show the new subtask
            setRefreshNonce((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

