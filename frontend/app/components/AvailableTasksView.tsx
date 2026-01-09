"use client";

import { useEffect, useMemo, useState } from "react";
import { DatePicker, Input, Select, Table, Tag } from "antd";
import Image from "next/image";
import dayjs, { Dayjs } from "dayjs";
import { apiRequest, getMasterDataFromCache } from "@/app/lib/api";
import { getProductOptions, getStatusOptions, getPriorityOptions } from "@/app/lib/masterData";
import { getRoleBase, buildRoleHref } from "@/app/lib/paths";
import { usePathname, useRouter } from "next/navigation";

type AvailableTask = {
  key: string;
  taskId: string;
  title: string;
  product: string;
  assignee: string;
  priority: "High" | "Medium" | "Low";
  status: "To Do" | "In Progress" | "Done" | "On Hold" | "Blocked";
  startDate: string; // DD/MM/YYYY
  dueDate: string; // DD/MM/YYYY
};

const formatTaskId = (taskId: string): string => {
  if (!taskId) return "";
  return `TA-${taskId}`;
};

interface AvailableTasksViewProps {
  title?: string;
  description?: string;
}

export default function AvailableTasksView({
  title = "Available Tasks",
  description = "View tasks that are currently open and can be picked up.",
}: AvailableTasksViewProps) {
  const pathname = usePathname();
  const router = useRouter();
  const roleBase = getRoleBase(pathname || "");

  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState<Dayjs | null>(null);
  const [toDate, setToDate] = useState<Dayjs | null>(null);
  const [product, setProduct] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [priority, setPriority] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<AvailableTask[]>([]);
  const [productOptions, setProductOptions] = useState(getProductOptions());
  const [statusOptions] = useState(getStatusOptions());
  const [priorityOptions] = useState(getPriorityOptions());

  // Resolve current user's team_code using master data
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // 1) Get current user
        const { getUserFromStorage } = await import("@/app/lib/auth/storage");
        const user = getUserFromStorage();
        const userCode = String(user?.userCode || "").trim();

        // 2) Get team_code from employees master data
        const md = getMasterDataFromCache<any>();
        const employees = md?.data?.employees || [];
        const me = employees.find((e: any) => String(e.user_code) === userCode);
        const teamCode = me?.team_code;

        if (!teamCode) {
          console.warn("No team_code found for current user; available tasks will be empty.");
          setTasks([]);
          return;
        }

        // 3) Call backend available-tasks API
        const resp: any = await apiRequest(
          `get_tasks/available?team_code=${encodeURIComponent(teamCode)}`,
          "GET"
        );

        const apiTasks = resp?.data?.tasks || [];

        const mapped: AvailableTask[] = apiTasks.map((t: any, idx: number) => {
          const taskId = String(t.task_id || "");
          const titleVal = String(t.task_title || "");
          const productName =
            (t.product_name as string) || (t.product_code as string) || "";
          const assigneeName = String(t.task_assignee_name || "-") || "-";

          const statusVal: AvailableTask["status"] = (() => {
            const s = String(t.status || t.task_status_description || "").toLowerCase();
            if (s.includes("progress")) return "In Progress";
            if (s.includes("done") || s.includes("closed") || s.includes("complete"))
              return "Done";
            if (s.includes("hold")) return "On Hold";
            if (s.includes("block")) return "Blocked";
            return "To Do";
          })();

          const priorityVal: AvailableTask["priority"] = (() => {
            const p = String(t.priority || t.task_priority_description || "").toLowerCase();
            if (p.includes("high")) return "High";
            if (p.includes("medium")) return "Medium";
            return "Low";
          })();

          const startDateRaw = t.task_start_date || t.start_date;
          const dueDateRaw = t.task_due_date || t.due_date;

          return {
            key: taskId || String(idx),
            taskId,
            title: titleVal,
            product: productName,
            assignee: assigneeName || "-",
            priority: priorityVal,
            status: statusVal,
            startDate: startDateRaw ? dayjs(startDateRaw).format("DD/MM/YYYY") : "",
            dueDate: dueDateRaw ? dayjs(dueDateRaw).format("DD/MM/YYYY") : "",
          };
        });

        setTasks(mapped);
        setProductOptions(getProductOptions());
      } catch (err) {
        console.error("Failed to load available tasks:", err);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (product && t.product !== product) return false;
      if (status && t.status !== status) return false;
      if (priority && t.priority !== priority) return false;

      if (fromDate) {
        const start = dayjs(t.startDate, "DD/MM/YYYY");
        if (!start.isSame(fromDate, "day")) return false;
      }
      if (toDate) {
        const due = dayjs(t.dueDate, "DD/MM/YYYY");
        if (!due.isSame(toDate, "day")) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          t.title.toLowerCase().includes(q) ||
          t.product.toLowerCase().includes(q) ||
          formatTaskId(t.taskId).toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [tasks, product, status, priority, fromDate, toDate, searchQuery]);

  const columns = [
    {
      title: "Task",
      dataIndex: "taskId",
      key: "taskId",
      render: (taskId: string, record: AvailableTask) => {
        const href = buildRoleHref(roleBase, `/tasks/${taskId}`);
        return (
          <div className="text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <Image src="/icons/jira-task.svg" alt="Task" width={16} height={16} />
              <a
                href={href}
                className="text-blue-600 font-medium hover:text-blue-800 hover:underline text-xs"
                onClick={(e) => {
                  e.preventDefault();
                  router.push(href);
                }}
              >
                {formatTaskId(taskId)}
              </a>
            </div>
            <div className="text-xs text-gray-600">{record.title}</div>
          </div>
        );
      },
    },
    {
      title: "Product",
      dataIndex: "product",
      key: "product",
      render: (prod: string) => <span className="text-xs">{prod}</span>,
    },
    {
      title: "Assignee",
      dataIndex: "assignee",
      key: "assignee",
      render: (assignee: string) => (
        <span className="text-xs">{assignee === "-" ? "Unassigned" : assignee}</span>
      ),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (priority: AvailableTask["priority"]) => (
        <Tag
          color={priority === "High" ? "red" : priority === "Medium" ? "gold" : "green"}
          className="rounded-full text-xs"
        >
          {priority}
        </Tag>
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
      render: (date: string) => <span className="text-xs">{date}</span>,
    },
  ];

  return (
    <div className="px-3 py-1 text-xs">
      <div className="mb-3">
        <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
        <p className="text-xs text-gray-600">{description}</p>
      </div>

      {/* Filters */}
      <div className="bg-white p-2 mb-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
          />
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            placeholder="Start Date"
            format="DD/MM/YYYY"
            className="w-full"
            size="small"
          />
          <DatePicker
            value={toDate}
            onChange={setToDate}
            placeholder="Due Date"
            format="DD/MM/YYYY"
            className="w-full"
            size="small"
          />
          <Select
            value={product}
            onChange={setProduct}
            allowClear
            placeholder="Product"
            size="small"
            options={productOptions}
          />
          <Select
            value={status}
            onChange={setStatus}
            allowClear
            placeholder="Status"
            size="small"
            options={statusOptions.map((s) => ({
              value: s.label as string,
              label: s.label as string,
            }))}
          />
          <Select
            value={priority}
            onChange={setPriority}
            allowClear
            placeholder="Priority"
            size="small"
            options={priorityOptions.map((p) => ({
              value: p.label as string,
              label: p.label as string,
            }))}
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table
            columns={columns}
            dataSource={filteredTasks}
            rowKey="key"
            size="small"
            pagination={false}
            loading={loading}
            className="text-xs"
          />
        </div>
      </div>
    </div>
  );
}


