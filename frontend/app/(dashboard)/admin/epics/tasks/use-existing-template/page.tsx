"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button, Checkbox, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { getMasterDataFromCache } from "@/app/lib/api";
import { getPriorityOptions, getStatusOptions, onMasterDataChange } from "@/app/lib/masterData";
import { getRoleBase } from "@/app/lib/paths";

interface PredefinedTaskRow {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  dueDate: string;
  estimatedHours: number;
  priority: string;
  status: string;
}

export default function UseExistingTaskTemplatePage() {
  const router = useRouter();
  const pathname = usePathname();
  const roleBase = getRoleBase(pathname || "");

  const [rows, setRows] = useState<PredefinedTaskRow[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<React.Key[]>([]);
  const [priorityOptions, setPriorityOptions] = useState(getPriorityOptions());
  const [statusOptions, setStatusOptions] = useState(getStatusOptions());
  const [loading, setLoading] = useState(false);

  const priorityMap = useMemo(
    () =>
      priorityOptions.reduce<Record<string, string>>((acc, cur) => {
        acc[String(cur.value)] = cur.label as string;
        return acc;
      }, {}),
    [priorityOptions]
  );

  const statusMap = useMemo(
    () =>
      statusOptions.reduce<Record<string, string>>((acc, cur) => {
        acc[String(cur.value)] = cur.label as string;
        return acc;
      }, {}),
    [statusOptions]
  );

  useEffect(() => {
    const load = () => {
      setPriorityOptions(getPriorityOptions());
      setStatusOptions(getStatusOptions());

      const md = getMasterDataFromCache<any>();
      const masterTasks = md?.data?.predefined_tasks || [];

      const mapped: PredefinedTaskRow[] = masterTasks.map((t: any) => ({
        id: String(t.id),
        title: t.task_title || "",
        description: t.task_description || "",
        startDate: t.start_date ? dayjs(t.start_date).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
        dueDate: t.due_date
          ? dayjs(t.due_date).format("YYYY-MM-DD")
          : dayjs(t.start_date || new Date()).add(1, "day").format("YYYY-MM-DD"),
        estimatedHours: Number(t.estimated_hours || 0),
        priority: t.default_priority_code ? String(t.default_priority_code) : "",
        status: t.default_status_code ? String(t.default_status_code) : "",
      }));

      setRows(mapped);
    };

    const off = onMasterDataChange(load);
    load();
    return off;
  }, []);

  const handleCancel = () => {
    router.push(`${roleBase}/epics/create-new`);
  };

  const handleAddSelected = () => {
    if (!selectedRowIds.length) {
      router.push(`${roleBase}/epics/create-new`);
      return;
    }
    setLoading(true);
    try {
      const storageKey = "epicDraftTasks";
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
      const existing = raw ? (JSON.parse(raw) as any[]) : [];

      const selected = rows.filter((r) => selectedRowIds.includes(r.id));
      const mapped = selected.map((t) => ({
        id: `task-${Date.now()}-${t.id}`,
        title: t.title,
        team: "",
        assignee: "",
        startDate: t.startDate,
        dueDate: t.dueDate,
        priority: t.priority,
        status: t.status,
        estimatedHours: Number(t.estimatedHours || 0),
      }));

      const next = [...existing, ...mapped];
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      }

      router.push(`${roleBase}/epics/create-new`);
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<PredefinedTaskRow> = [
    {
      title: "Task Title",
      dataIndex: "title",
      key: "title",
      render: (val: string) => <span className="text-xs font-medium text-gray-900">{val}</span>,
    },
    {
      title: "Start Date",
      dataIndex: "startDate",
      key: "startDate",
      width: 120,
      render: (val: string) => (
        <span className="text-xs text-gray-600">{dayjs(val).format("DD/MM/YYYY")}</span>
      ),
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      width: 120,
      render: (val: string) => (
        <span className="text-xs text-gray-600">{dayjs(val).format("DD/MM/YYYY")}</span>
      ),
    },
    {
      title: "Estimated Hrs",
      dataIndex: "estimatedHours",
      key: "estimatedHours",
      width: 110,
      render: (val: number) => <span className="text-xs text-gray-700">{val || "-"}</span>,
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      width: 120,
      render: (val: string) => {
        const label = priorityMap[val] || val || "-";
        const color =
          label === "High" ? "red" : label === "Medium" ? "orange" : label === "Low" ? "green" : "blue";
        return (
          <Tag color={color} className="text-[10px] rounded-full px-2">
            {label}
          </Tag>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (val: string) => {
        const label = statusMap[val] || val || "-";
        const lower = label.toLowerCase();
        const color = lower.includes("done") || lower.includes("completed")
          ? "green"
          : lower.includes("progress")
          ? "blue"
          : lower.includes("hold") || lower.includes("blocked")
          ? "red"
          : "default";
        return (
          <Tag color={color} className="text-[10px] rounded-full px-2">
            {label}
          </Tag>
        );
      },
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex items-center gap-2 mb-4">
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={handleCancel}
            className="p-0"
          />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Add Tasks from Templates</h1>
            <p className="text-xs text-gray-500 mt-1">
              Select one or more predefined tasks to add into your new epic.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <Table
            rowSelection={{
              selectedRowKeys: selectedRowIds,
              onChange: setSelectedRowIds,
              selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT],
            }}
            columns={columns}
            dataSource={rows}
            rowKey="id"
            pagination={false}
            size="small"
            className="text-xs"
          />

          {rows.length === 0 && (
            <div className="text-center py-6 text-xs text-gray-500">
              No predefined tasks available. Please configure templates in master data.
            </div>
          )}

          <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-600">
              <Checkbox
                indeterminate={
                  selectedRowIds.length > 0 && selectedRowIds.length < rows.length
                }
                checked={rows.length > 0 && selectedRowIds.length === rows.length}
                onChange={(e) =>
                  setSelectedRowIds(e.target.checked ? rows.map((r) => r.id) : [])
                }
              >
                Select all
              </Checkbox>
              <span className="ml-3">
                {selectedRowIds.length} selected
              </span>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCancel} disabled={loading} className="px-5 rounded-md">
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={handleAddSelected}
                loading={loading}
                className="px-6 rounded-md bg-blue-600 hover:bg-blue-700"
                disabled={rows.length === 0}
              >
                {loading ? "Adding..." : "Add Selected to Epic"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


