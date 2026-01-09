"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button, DatePicker, Input, InputNumber, Select } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { getAllEmployeeOptions, getPriorityOptions, getStatusOptions, onMasterDataChange } from "@/app/lib/masterData";
import { getMasterDataFromCache } from "@/app/lib/api";
import { getRoleBase } from "@/app/lib/paths";

interface DraftTaskFormState {
  title: string;
  team?: string;
  assignee?: string;
  startDate: Dayjs | null;
  dueDate: Dayjs | null;
  priority: string;
  status: string;
  estimatedHours: number | null;
}

const labelCls = "block text-xs font-semibold text-gray-700 mb-1.5";
const required = <span className="text-red-500 ml-1">*</span>;

export default function CreateNewTaskTemplatePage() {
  const router = useRouter();
  const pathname = usePathname();
  const roleBase = getRoleBase(pathname || "");

  const [form, setForm] = useState<DraftTaskFormState>({
    title: "",
    team: undefined,
    assignee: undefined,
    startDate: dayjs(),
    dueDate: dayjs().add(1, "day"),
    priority: "",
    status: "",
    estimatedHours: null,
  });

  const [teamOptions, setTeamOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [employeeOptions, setEmployeeOptions] = useState(getAllEmployeeOptions());
  const [priorityOptions, setPriorityOptions] = useState(getPriorityOptions());
  const [statusOptions, setStatusOptions] = useState(getStatusOptions());
  const [creating, setCreating] = useState(false);

  // Build team options from employees + keep master data in sync
  useEffect(() => {
    const buildTeamOptions = () => {
      try {
        const md = getMasterDataFromCache<any>();
        const employees = md?.data?.employees || [];
        const teams = new Set<string>();
        employees.forEach((emp: any) => {
          if (emp?.team_name) {
            teams.add(emp.team_name);
          }
        });
        const list = Array.from(teams)
          .map((team) => ({ value: team, label: team }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setTeamOptions(list);
      } catch {
        // ignore – fall back to empty list
      }
    };

    const update = () => {
      setEmployeeOptions(getAllEmployeeOptions());
      setPriorityOptions(getPriorityOptions());
      setStatusOptions(getStatusOptions());
      buildTeamOptions();
    };

    const off = onMasterDataChange(update);
    update();
    return off;
  }, []);

  const handleChange = <K extends keyof DraftTaskFormState>(field: K, value: DraftTaskFormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!form.title.trim()) {
      // Minimal validation – we rely on epic form for stricter checks later
      return;
    }

    setCreating(true);
    try {
      const storageKey = "epicDraftTasks";
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
      const existing = raw ? (JSON.parse(raw) as any[]) : [];

      const payload = {
        id: `task-${Date.now()}`,
        title: form.title.trim(),
        team: form.team || "",
        assignee: form.assignee || "",
        startDate: (form.startDate || dayjs()).format("YYYY-MM-DD"),
        dueDate: (form.dueDate || form.startDate || dayjs()).format("YYYY-MM-DD"),
        priority: form.priority || (priorityOptions[0]?.value as string) || "",
        status: form.status || (statusOptions[0]?.value as string) || "",
        estimatedHours: Number(form.estimatedHours || 0),
      };

      const next = [...existing, payload];
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      }

      router.push(`${roleBase}/epics/create-new`);
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    router.push(`${roleBase}/epics/create-new`);
  };

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex items-center gap-2 mb-4">
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={handleCancel}
            className="p-0"
          />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Create Task for New Epic</h1>
            <p className="text-xs text-gray-500 mt-1">
              This task will be added to your epic draft when you return.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
            <div className="md:col-span-2">
              <label className={labelCls}>
                Task Title{required}
              </label>
              <Input
                placeholder="Enter task title"
                size="middle"
                value={form.title}
                onChange={(e) => handleChange("title", e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Team</label>
              <Select
                placeholder="Select team"
                size="middle"
                className="w-full"
                value={form.team}
                options={teamOptions}
                onChange={(val) => handleChange("team", val)}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
              />
            </div>

            <div>
              <label className={labelCls}>Assignee</label>
              <Select
                placeholder="Unassigned"
                size="middle"
                className="w-full"
                value={form.assignee}
                options={employeeOptions}
                onChange={(val) => handleChange("assignee", val)}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
              />
            </div>

            <div>
              <label className={labelCls}>Start Date</label>
              <DatePicker
                size="middle"
                className="w-full"
                format="DD-MM-YYYY"
                value={form.startDate}
                onChange={(val) => handleChange("startDate", val)}
              />
            </div>

            <div>
              <label className={labelCls}>Due Date</label>
              <DatePicker
                size="middle"
                className="w-full"
                format="DD-MM-YYYY"
                value={form.dueDate}
                onChange={(val) => handleChange("dueDate", val)}
              />
            </div>

            <div>
              <label className={labelCls}>Priority</label>
              <Select
                placeholder="Select priority"
                size="middle"
                className="w-full"
                value={form.priority || undefined}
                options={priorityOptions}
                onChange={(val) => handleChange("priority", val)}
              />
            </div>

            <div>
              <label className={labelCls}>Status</label>
              <Select
                placeholder="Select status"
                size="middle"
                className="w-full"
                value={form.status || undefined}
                options={statusOptions}
                onChange={(val) => handleChange("status", val)}
              />
            </div>

            <div>
              <label className={labelCls}>Estimated Hours</label>
              <InputNumber
                size="middle"
                min={0}
                step={0.5}
                className="w-full"
                value={form.estimatedHours ?? undefined}
                onChange={(v) => handleChange("estimatedHours", Number(v) || null)}
                onKeyDown={handleNumberKeyDown}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
            <Button onClick={handleCancel} disabled={creating} className="px-5 rounded-md">
              Cancel
            </Button>
            <Button
              type="primary"
              onClick={handleSave}
              loading={creating}
              className="px-6 rounded-md bg-blue-600 hover:bg-blue-700"
            >
              {creating ? "Adding..." : "Add Task to Epic"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


