"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { DatePicker, Select, Table, Tag, Input } from "antd";
import Image from "next/image";
import { getProductOptions, getStatusOptions, getPriorityOptions, onMasterDataChange } from "@/app/lib/masterData";
import { statusTagColor, getStatusTextColor, getPriorityTextColor, priorityTagColor, getStatusDisplayLabel } from "@/app/lib/uiMaps";
import { CalendarOutlined, ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { apiRequest } from "@/app/lib/api";

interface SubTask {
  key: string;
  id: string;
  title: string;
  assignee: string;
  priority: "High" | "Medium" | "Low";
  status: "To Do" | "In Progress" | "Done";
  dueDate: string;
}

interface Task {
  key: string;
  taskId: string;
  taskName: string;
  product: string;
  client?: string;
  assignee: string;
  priority: "High" | "Medium" | "Low";
  startDate: string;
  dueDate: string;
  submitDate: string;
  status: "In Progress" | "Done" | "Pending" | "Overdue" | "To Do";
  approval: "Pending" | "Approved" | "Rejected";
  delayDays?: number;
  epicId?: string;
  epicKey?: string;
}

// ---------- Pure helpers (no hooks) ----------
const formatTaskId = (taskId: string): string => {
  if (!taskId) return '';
  // Remove any existing prefix patterns (TA-, TASK-, TSK-)
  const cleanId = taskId.replace(/^(TA-|TASK-|TSK-)/i, '');
  // Add TA- prefix
  return `TA-${cleanId}`;
};

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case "High": return <ArrowUpOutlined style={{ color: '#ef4444' }} />; // tailwind red-500
    case "Medium": return <MinusOutlined style={{ color: '#eab308' }} />; // tailwind yellow-500
    case "Low": return <ArrowDownOutlined style={{ color: '#22c55e' }} />; // tailwind green-500
    default: return <MinusOutlined style={{ color: '#6b7280' }} />; // gray-500
  }
};

const getStatusColor = (status: string) => statusTagColor(status);


export default function EmployeeTasksPage({
  linkBase = "/employee/tasks",
  extraFilterActions,
  paddingClass = "p-3",
  filterClass = "bg-white p-3 mb-6",
  linkQuery,
  showClientFilter = false,
  showProductFilter = false,
}: {
  linkBase?: string;
  extraFilterActions?: React.ReactNode;
  paddingClass?: string;
  filterClass?: string;
  linkQuery?: string;
  showClientFilter?: boolean;
  showProductFilter?: boolean;
}) {
  const [fromDate, setFromDate] = useState<dayjs.Dayjs | null>(null);
  const [toDate, setToDate] = useState<dayjs.Dayjs | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | undefined>(undefined);
  const [selectedClient, setSelectedClient] = useState<string | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
  const [selectedPriority, setSelectedPriority] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Master data options (fallback to static if cache empty)
  const [productOptions, setProductOptions] = useState(getProductOptions());
  const [statusOptions, setStatusOptions] = useState(getStatusOptions());
  const [priorityOptions, setPriorityOptions] = useState(getPriorityOptions());

  // Refresh options when master data arrives/changes
  useEffect(() => {
    const update = () => {
      setProductOptions(getProductOptions());
      setStatusOptions(getStatusOptions());
      setPriorityOptions(getPriorityOptions());
    };
    const unsub = onMasterDataChange(update);
    // also run once in case localStorage already has data
    update();
    return unsub;
  }, []);

  // Fetch tasks from API with filters
  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      setError("");
      try {
        // Build query parameters
        const params: Record<string, string> = {};
        
        if (selectedStatus) {
          params.task_status_code = selectedStatus;
        }
        if (selectedPriority) {
          // use task priority code to match backend/master data
          params.task_priority_code = selectedPriority;
        }
        if (selectedProduct) {
          params.product_code = selectedProduct;
        }
        if (fromDate) {
          params.start_date_from = dayjs(fromDate).format('YYYY-MM-DD');
        }
        if (toDate) {
          params.due_date_to = dayjs(toDate).format('YYYY-MM-DD');
        }
        
        // Set default limit and offset
        params.limit = '100';
        params.offset = '0';

        // Add current user as assignee for server-side filtering if available
        try {
          const { getUserFromStorage } = await import("@/app/lib/auth/storage");
          const user = getUserFromStorage();
          if (user?.userCode) {
            params.task_assignee = user.userCode;
          }
        } catch {}

        // Build query string - URLSearchParams handles string conversion
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `get_tasks?${queryString}` : `get_tasks`;
        const resp = await apiRequest<any>(endpoint, 'GET');
        const allItems: any[] = Array.isArray(resp?.data?.tasks)
          ? resp.data.tasks
          : [];

        // Filter: only tasks assigned to the logged-in user (by code or name)
        let currentUserCode: string | undefined;
        let currentUserName: string | undefined;
        try {
          const { getUserFromStorage } = await import("@/app/lib/auth/storage");
          const user = getUserFromStorage();
          currentUserCode = user?.userCode;
          currentUserName = user?.userName;
        } catch {}

        const items = allItems
          // drop null-only rows emitted by the API
          .filter((it) => it && it.task_id)
          // keep only tasks for the logged-in user (if available)
          .filter((it) => {
            if (!currentUserCode && !currentUserName) return true;
            const assigneeCode = it?.task_assignee ? String(it.task_assignee) : '';
            const assigneeName = it?.task_assignee_name ? String(it.task_assignee_name) : '';
            return (
              (currentUserCode && assigneeCode && assigneeCode === currentUserCode) ||
              (currentUserName && assigneeName && assigneeName === currentUserName)
            );
          });

        const mappedTasks: Task[] = items.map((item, index) => {
          const taskId = String(item?.task_id);
          const title = item?.task_title ?? '';
          const statusDesc = String(item?.task_status_description || '');
          // Use centralized status mapping function for consistency
          let status: Task['status'] = getStatusDisplayLabel(statusDesc) as Task['status'];
          
          // Handle edge case: if status is not recognized, check for overdue
          if (status === 'To Do' && item?.task_due_date && dayjs(item.task_due_date).isBefore(dayjs(), 'day')) {
            // Keep as 'To Do' but will show as overdue in UI (overdue tag is handled separately)
            status = 'To Do';
          }

        const priorityDesc = String(item?.task_priority_description || 'Low').toLowerCase();
        const priority: Task['priority'] = priorityDesc.includes('high')
          ? 'High'
          : priorityDesc.includes('medium')
            ? 'Medium'
            : 'Low';

          const startDate = item?.task_start_date ? dayjs(item.task_start_date).format('DD/MM/YYYY') : '';
          const dueDate = item?.task_due_date ? dayjs(item.task_due_date).format('DD/MM/YYYY') : '';
          const submitDate = item?.task_closed_on ? dayjs(item.task_closed_on).format('DD/MM/YYYY') : '';

          let delayDays: number | undefined = undefined;
          if (status === 'Overdue' && item?.task_due_date) {
            delayDays = dayjs().diff(dayjs(item.task_due_date), 'day');
          }

          const epicId = item?.task_epic_code ? String(item.task_epic_code) : '';
          const epicKey = epicId ? `EPIC-${epicId}` : '';
          const assignee = item?.task_assignee_name ?? '';
          const product = item?.product_name ?? item?.product_code ?? '';

          return {
            key: taskId,
            taskId,
            taskName: title,
            product,
            epicId: epicId || undefined,
            epicKey: epicKey || undefined,
            client: undefined,
            assignee,
            priority,
            startDate,
            dueDate,
            submitDate,
            status,
            approval: 'Pending',
            delayDays,
          } as Task;
        });

        setTasks(mappedTasks);
      } catch (e) {
        console.error('Failed to fetch tasks:', e);
        setError('Failed to load tasks');
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [selectedStatus, selectedPriority, selectedProduct, fromDate, toDate]);

  // ---------- Derived data ----------
  // Client-side filtering for search, client filter, and date filters
  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    // Apply client filter if needed
    if (showClientFilter && !showProductFilter && selectedClient) {
      filtered = filtered.filter((task) => task.client === selectedClient);
    }

    // Apply due date filter (client-side backup to ensure it works)
    if (toDate) {
      filtered = filtered.filter((task) => {
        if (!task.dueDate) return false;
        // Parse the due date (format: DD/MM/YYYY)
        const taskDueDate = dayjs(task.dueDate, 'DD/MM/YYYY');
        // Filter: show tasks due exactly on the selected date
        return taskDueDate.isSame(toDate, 'day');
      });
    }

    // Apply start date filter (client-side backup to ensure it works)
    if (fromDate) {
      filtered = filtered.filter((task) => {
        if (!task.startDate) return false;
        // Parse the start date (format: DD/MM/YYYY)
        const taskStartDate = dayjs(task.startDate, 'DD/MM/YYYY');
        // Filter: show tasks with start date exactly on the selected date
        return taskStartDate.isSame(fromDate, 'day');
      });
    }

    // Apply search filter
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      // Remove TA-/TASK-/TSK- prefix from query if present for task ID matching
      const cleanQuery = query.replace(/^(ta-|task-|tsk-)/i, '');
      filtered = filtered.filter((task) => {
        // Search in task ID (both formatted and raw), task name, product, epic key, assignee, client, status, priority
        const taskId = (task.taskId || '').toLowerCase();
        const formattedTaskId = formatTaskId(task.taskId || '').toLowerCase();
        const taskName = (task.taskName || '').toLowerCase();
        const product = (task.product || '').toLowerCase();
        const epicKey = (task.epicKey || '').toLowerCase();
        const assignee = (task.assignee || '').toLowerCase();
        const client = (task.client || '').toLowerCase();
        const status = (task.status || '').toLowerCase();
        const priority = (task.priority || '').toLowerCase();

        return (
          taskId.includes(cleanQuery) ||
          formattedTaskId.includes(query) ||
          taskName.includes(query) ||
          product.includes(query) ||
          epicKey.includes(query) ||
          assignee.includes(query) ||
          client.includes(query) ||
          status.includes(query) ||
          priority.includes(query)
        );
      });
    }

    // Sort by taskId in descending order (latest first)
    filtered = [...filtered].sort((a, b) => {
      const aId = parseInt(a.taskId || '0', 10) || 0;
      const bId = parseInt(b.taskId || '0', 10) || 0;
      return bId - aId;
    });

    return filtered;
  }, [tasks, selectedClient, showClientFilter, showProductFilter, searchQuery, toDate, fromDate]);

  // ---------- Handlers ----------
  // No need for handleApplyFilters - filters trigger API calls automatically

  // ---------- Columns (memoized) ----------
  type ColumnType = {
    title: string;
    dataIndex: string;
    key: string;
    render?: (value: unknown, record: Task) => React.ReactNode;
  };
  
  const columns: ColumnType[] = useMemo(() => ([
    {
      title: "Task",
      dataIndex: "taskId",
      key: "taskId",
      render: (taskId: string, record: Task) => (
        <div className="text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <Image src="/icons/jira-task.svg" alt="Task" width={16} height={16} />
            <a 
              href={`${linkBase}/${taskId}${linkQuery ? `?${linkQuery}` : ''}`} 
              className="text-blue-600 font-medium hover:text-blue-800 hover:underline text-xs"
            >
              {formatTaskId(taskId)}
            </a>
          </div>
          <div className="text-xs text-gray-600">{record.taskName}</div>
        </div>
      ),
    },
    {
      title: "Epic",
      dataIndex: "epicKey",
      key: "epicKey",
      render: (epicKey: string | undefined, record: Task) => (
        epicKey ? (
          <a
            href={record.epicId ? `${linkBase.replace(/\/tasks.*/, '')}/epics/${record.epicId}` : `${linkBase.replace(/\/tasks.*/, '')}/epics`}
            className="bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded text-[10px] hover:bg-purple-200 transition-colors"
          >
            {epicKey}
          </a>
        ) : <span className="text-gray-400">-</span>
      ),
    },
    {
      title: "Product",
      dataIndex: "product",
      key: "product",
      render: (product: string) => <span className="text-xs">{product}</span>,
    },
    showClientFilter && !showProductFilter ? {
      title: "Client",
      dataIndex: "client",
      key: "client",
      render: (client: string | undefined) => <span className="text-xs">{client || '-'}</span>,
    } : null,
    {
      title: "Assignee",
      dataIndex: "assignee",
      key: "assignee",
      render: (assignee: string) => <span className="text-xs">{assignee}</span>,
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (priority: string) => (
        <div className="flex items-center gap-2">
          {getPriorityIcon(priority)}
          <Tag color={priorityTagColor(priority)} className="rounded-full text-xs">{priority}</Tag>
        </div>
      ),
    },
    {
      title: "Start Date",
      dataIndex: "startDate",
      key: "startDate",
      render: (date: string) => <span className="text-xs">{date}</span>,
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      render: (date: string, record: Task) => {
        if (!date) {
          return <span className="text-xs text-gray-400">-</span>;
        }
        const dueDateObj = dayjs(date, 'DD/MM/YYYY');
        if (!dueDateObj.isValid()) {
          return <span className="text-xs text-gray-400">-</span>;
        }
        const today = dayjs();
        const isOverdue = record.status !== "Done" && dueDateObj.isBefore(today, 'day');
        return (
          <div className="flex items-center gap-2">
            <span className="text-xs">{date}</span>
            {isOverdue && (
              <Tag color="red" className="rounded-full text-[10px] px-2 py-0">
                Overdue
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={getStatusColor(status)} className="rounded-full text-xs">{status}</Tag>
      ),
    },
  ].filter(Boolean) as ColumnType[]), [linkBase, linkQuery, showClientFilter, showProductFilter]);

  const canShowTable = showProductFilter 
    ? !!selectedProduct 
    : (!showClientFilter || !!selectedClient);

  // Subtask columns for expandable rows
  const subtaskColumns = [
    {
      title: "Subtask ID",
      dataIndex: "id",
      key: "id",
      render: (id: string) => <span className="text-xs text-gray-600">{id}</span>,
    },
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (title: string) => <span className="text-xs">{title}</span>,
    },
    {
      title: "Assignee",
      dataIndex: "assignee",
      key: "assignee",
      render: (assignee: string) => <span className="text-xs">{assignee}</span>,
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (priority: string) => (
        <div className="flex items-center gap-2">
          {getPriorityIcon(priority)}
          <Tag color={priorityTagColor(priority)} className="rounded-full text-xs">{priority}</Tag>
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={getStatusColor(status)} className="rounded-full text-xs">
          {status}
        </Tag>
      ),
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      render: (date: string, record: SubTask) => {
        const dueDateObj = dayjs(date, 'DD/MM/YYYY');
        const today = dayjs();
        const isOverdue = record.status !== "Done" && dueDateObj.isBefore(today, 'day');
        return (
          <div className="flex items-center gap-2">
            <span className="text-xs">{date}</span>
            {isOverdue && (
              <Tag color="red" className="rounded-full text-[10px] px-2 py-0">
                Overdue
              </Tag>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className={`${paddingClass} font-poppins`}>
      {/* Filter Bar */}
      <div className={filterClass}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
            size="small"
            allowClear
          />
          
          <DatePicker
            value={fromDate}
            onChange={(date) => {
              setFromDate(date);
              if (date && toDate && toDate < date) setToDate(null);
            }}
            placeholder="Start Date"
            className="w-full"
            format="DD/MM/YYYY"
            suffixIcon={<CalendarOutlined />}
            size="small"
            style={{ width: '100%' }}
          />
          
          <DatePicker
            value={toDate}
            onChange={setToDate}
            placeholder="Due Date"
            className="w-full"
            format="DD/MM/YYYY"
            suffixIcon={<CalendarOutlined />}
            disabledDate={(current) => {
              if (!fromDate) return false;
              return current && current < fromDate.startOf('day');
            }}
            size="small"
            style={{ width: '100%' }}
          />
          
          {showProductFilter ? (
            <Select
              value={selectedProduct}
              onChange={setSelectedProduct}
              placeholder="Select Product"
              className="w-full"
              size="small"
              notFoundContent="No products found"
              options={productOptions}
              style={{ width: '100%' }}
            />
          ) : (
            <Select
              value={selectedProduct}
              onChange={setSelectedProduct}
              placeholder="Product"
              className="w-full"
              allowClear
              size="small"
              notFoundContent="No products found"
              options={productOptions}
              style={{ width: '100%' }}
            />
          )}

          {showClientFilter && !showProductFilter && (
            <Select
              value={selectedClient}
              onChange={setSelectedClient}
              placeholder="Client"
              className="w-full"
              allowClear
              size="small"
              notFoundContent="No client found"
              style={{ width: '100%' }}
            >
              <Select.Option value="Client X">Client X</Select.Option>
              <Select.Option value="Client Y">Client Y</Select.Option>
              <Select.Option value="Client Z">Client Z</Select.Option>
            </Select>
          )}
          
          <Select
            value={selectedStatus}
            onChange={setSelectedStatus}
            placeholder="Status"
            className="w-full"
            allowClear
            size="small"
            notFoundContent="No status found"
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
            notFoundContent="No priority found"
            options={priorityOptions}
            style={{ width: '100%' }}
          />
        </div>
        {extraFilterActions && (
          <div className="flex items-center gap-2 mt-3">
            {extraFilterActions}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-center max-w-md">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 4.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Loading tasks...</h3>
            <p className="text-sm text-gray-600">Please wait while we fetch your tasks.</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-red-300">
          <div className="text-center max-w-md">
            <svg className="mx-auto h-12 w-12 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading tasks</h3>
            <p className="text-sm text-gray-600">{error}</p>
          </div>
        </div>
      )}

      {/* Empty State or Tasks Table */}
      {!loading && !error && !canShowTable ? (
        <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-center max-w-md">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {showProductFilter ? "Select a Product" : showClientFilter ? "Select a Client" : "No filters selected"}
            </h3>
            <p className="text-sm text-gray-600">
              {showProductFilter 
                ? "Please select a product to view tasks." 
                : showClientFilter 
                ? "Please select a client to view tasks."
                : "Select filters to view tasks."}
            </p>
          </div>
        </div>
      ) : !loading && !error && canShowTable ? (
        <div key={showProductFilter ? selectedProduct : (showClientFilter ? selectedClient : 'all')} className="bg-white border border-gray-200 rounded-lg overflow-hidden tab-switch-anim">
          <div className="overflow-x-auto">
            <Table
              columns={columns}
              dataSource={filteredTasks}
              loading={loading}
              pagination={{
                pageSize: 10,
                showSizeChanger: false,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} tasks`,
              }}
              className="font-poppins text-xs"
              size="small"
              scroll={{ x: 800 }}
              rowKey="key"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}


