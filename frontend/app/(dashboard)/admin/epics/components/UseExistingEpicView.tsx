"use client";

import { Modal, Button, Table, Tag, Checkbox } from "antd";
import { ArrowLeftOutlined, CheckOutlined } from "@ant-design/icons";
import { useState, useMemo } from "react";
import dayjs from "dayjs";
import { apiRequest } from "@/app/lib/api";
import { toast } from "react-hot-toast";
import SimpleGanttChart from "./SimpleGanttChart";

interface UseExistingEpicViewProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

interface PredefinedTask {
  id: string;
  title: string;
  description: string;
  estimatedHours: number;
  startDate: string;
  dueDate: string;
  priority: string;
  type: string;
  selected: boolean;
}

interface PredefinedEpic {
  id: string;
  name: string;
  description: string;
  tasks: PredefinedTask[];
}

// Mock predefined epics - in production, this would come from an API
const PREDEFINED_EPICS: PredefinedEpic[] = [
  {
    id: "web-app-template",
    name: "Web Application Development",
    description: "Standard template for web application development with common tasks",
    tasks: [
      {
        id: "task-1",
        title: "Project Setup & Planning",
        description: "Initialize project repository, setup development environment",
        estimatedHours: 8,
        startDate: dayjs().format("YYYY-MM-DD"),
        dueDate: dayjs().add(1, "day").format("YYYY-MM-DD"),
        priority: "High",
        type: "Development",
        selected: true,
      },
      {
        id: "task-2",
        title: "Database Design",
        description: "Design database schema and create ER diagrams",
        estimatedHours: 16,
        startDate: dayjs().add(1, "day").format("YYYY-MM-DD"),
        dueDate: dayjs().add(3, "day").format("YYYY-MM-DD"),
        priority: "High",
        type: "Design",
        selected: true,
      },
      {
        id: "task-3",
        title: "Backend API Development",
        description: "Develop RESTful APIs and business logic",
        estimatedHours: 40,
        startDate: dayjs().add(2, "day").format("YYYY-MM-DD"),
        dueDate: dayjs().add(7, "day").format("YYYY-MM-DD"),
        priority: "High",
        type: "Development",
        selected: true,
      },
      {
        id: "task-4",
        title: "Frontend Development",
        description: "Build user interface components and pages",
        estimatedHours: 48,
        startDate: dayjs().add(4, "day").format("YYYY-MM-DD"),
        dueDate: dayjs().add(10, "day").format("YYYY-MM-DD"),
        priority: "High",
        type: "Development",
        selected: true,
      },
      {
        id: "task-5",
        title: "Testing & QA",
        description: "Perform unit testing, integration testing, and QA",
        estimatedHours: 24,
        startDate: dayjs().add(9, "day").format("YYYY-MM-DD"),
        dueDate: dayjs().add(12, "day").format("YYYY-MM-DD"),
        priority: "Medium",
        type: "Testing",
        selected: true,
      },
      {
        id: "task-6",
        title: "Deployment",
        description: "Deploy application to production environment",
        estimatedHours: 8,
        startDate: dayjs().add(12, "day").format("YYYY-MM-DD"),
        dueDate: dayjs().add(13, "day").format("YYYY-MM-DD"),
        priority: "High",
        type: "Deployment",
        selected: true,
      },
    ],
  },
  {
    id: "mobile-app-template",
    name: "Mobile Application Development",
    description: "Template for mobile app development (iOS/Android)",
    tasks: [
      {
        id: "task-7",
        title: "UI/UX Design",
        description: "Create wireframes and design mockups",
        estimatedHours: 24,
        startDate: dayjs().format("YYYY-MM-DD"),
        dueDate: dayjs().add(3, "day").format("YYYY-MM-DD"),
        priority: "High",
        type: "Design",
        selected: true,
      },
      {
        id: "task-8",
        title: "Backend Integration",
        description: "Integrate mobile app with backend APIs",
        estimatedHours: 32,
        startDate: dayjs().add(2, "day").format("YYYY-MM-DD"),
        dueDate: dayjs().add(6, "day").format("YYYY-MM-DD"),
        priority: "High",
        type: "Development",
        selected: true,
      },
      {
        id: "task-9",
        title: "Mobile App Development",
        description: "Develop native or cross-platform mobile application",
        estimatedHours: 60,
        startDate: dayjs().add(4, "day").format("YYYY-MM-DD"),
        dueDate: dayjs().add(11, "day").format("YYYY-MM-DD"),
        priority: "High",
        type: "Development",
        selected: true,
      },
    ],
  },
];

export default function UseExistingEpicView({ open, onClose, onCreated }: UseExistingEpicViewProps) {
  const [selectedEpic, setSelectedEpic] = useState<PredefinedEpic | null>(PREDEFINED_EPICS[0]);
  const [tasks, setTasks] = useState<PredefinedTask[]>(
    PREDEFINED_EPICS[0]?.tasks.map(t => ({ ...t, selected: true })) || []
  );
  const [loading, setLoading] = useState(false);

  const handleEpicSelect = (epic: PredefinedEpic) => {
    setSelectedEpic(epic);
    setTasks(epic.tasks.map(t => ({ ...t, selected: true })));
  };

  const handleTaskToggle = (taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, selected: !t.selected } : t
    ));
  };

  const handleSelectAll = (checked: boolean) => {
    setTasks(prev => prev.map(t => ({ ...t, selected: checked })));
  };

  const selectedTasks = useMemo(() => tasks.filter(t => t.selected), [tasks]);

  const handleCreateEpic = async () => {
    if (!selectedEpic) {
      toast.error("Please select an epic template");
      return;
    }

    if (selectedTasks.length === 0) {
      toast.error("Please select at least one task");
      return;
    }

    setLoading(true);
    try {
      // Calculate epic dates from selected tasks
      const taskDates = selectedTasks.map(t => ({
        start: dayjs(t.startDate),
        end: dayjs(t.dueDate),
      }));
      
      // Find min and max dates manually (dayjs doesn't have min/max functions)
      let epicStartDate = taskDates[0]?.start || dayjs();
      let epicDueDate = taskDates[0]?.end || dayjs().add(14, "day");
      for (const dateRange of taskDates) {
        if (dateRange.start.isBefore(epicStartDate)) {
          epicStartDate = dateRange.start;
        }
        if (dateRange.end.isAfter(epicDueDate)) {
          epicDueDate = dateRange.end;
        }
      }
      const totalEstimatedHours = selectedTasks.reduce((sum, t) => sum + t.estimatedHours, 0);
      // Calculate estimated_days from estimated_hours (8 hours = 1 working day)
      const estimatedDays = totalEstimatedHours / 8;

      // Create the epic first
      const form = new FormData();
      form.append("epic_title", selectedEpic.name);
      form.append("epic_description", selectedEpic.description);
      form.append("start_date", epicStartDate.format("DD-MM-YYYY"));
      form.append("due_date", epicDueDate.format("DD-MM-YYYY"));
      form.append("estimated_hours", String(totalEstimatedHours));
      form.append("estimated_days", String(estimatedDays));
      form.append("is_billable", "false");
      
      // Get default values (you may want to make these configurable)
      const { getProductOptions, getPriorityOptions, getClientOptions, getContactPersonOptions } = await import("@/app/lib/masterData");
      const products = getProductOptions();
      const priorities = getPriorityOptions();
      const clients = getClientOptions();
      
      if (products.length > 0) form.append("product_code", products[0].value);
      if (priorities.length > 0) form.append("priority_code", String(priorities[0].value));
      if (clients.length > 0) {
        form.append("company_code", clients[0].value);
        const contacts = getContactPersonOptions(clients[0].value);
        if (contacts.length > 0) form.append("contact_person_code", contacts[0].value);
      }

      try {
        const { getUserFromStorage } = await import("../../../../lib/auth/storage");
        const user = getUserFromStorage();
        if (user?.userCode) form.append("reporter", String(user.userCode).trim().toUpperCase());
      } catch {}

      // Response can be either { data: { epic_id } } or flat { epic_id }
      const epicResponse = await apiRequest<any>("create_epic", "POST", form);
      const epicId = epicResponse?.data?.epic_id ?? epicResponse?.epic_id;

      if (!epicId) {
        throw new Error("Failed to get epic ID from response");
      }

      // Create tasks
      for (const task of selectedTasks) {
        const taskForm = new FormData();
        // Note: backend expects 'epic_code' for create_task
        taskForm.append("epic_code", String(epicId));
        taskForm.append("task_title", task.title);
        taskForm.append("task_desc", task.description);
        taskForm.append("start_date", dayjs(task.startDate).format("DD-MM-YYYY"));
        taskForm.append("due_date", dayjs(task.dueDate).format("DD-MM-YYYY"));
        taskForm.append("estimated_hours", String(task.estimatedHours));
        const taskEstimatedDays = task.estimatedHours > 0 ? task.estimatedHours / 8 : 0;
        taskForm.append("estimated_days", String(taskEstimatedDays));
        taskForm.append("task_type_code", task.type);
        taskForm.append("priority_code", task.priority === "High" ? "1" : task.priority === "Medium" ? "2" : "3");
        // No dependencies wired from this simple template view yet
        taskForm.append("depends_on_task_ids", "");
        
        try {
          const { getUserFromStorage } = await import("../../../../lib/auth/storage");
          const user = getUserFromStorage();
          if (user?.userCode) taskForm.append("reporter", String(user.userCode).trim().toUpperCase());
        } catch {}

        await apiRequest("create_task", "POST", taskForm);
      }

      toast.success(`Epic created successfully with ${selectedTasks.length} task(s)`);
      if (onCreated) {
        onCreated();
      }
      onClose();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to create epic";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const taskColumns = [
    {
      title: (
        <Checkbox
          checked={tasks.length > 0 && tasks.every(t => t.selected)}
          indeterminate={tasks.some(t => t.selected) && !tasks.every(t => t.selected)}
          onChange={(e) => handleSelectAll(e.target.checked)}
        />
      ),
      key: "select",
      width: 50,
      render: (_: any, record: PredefinedTask) => (
        <Checkbox
          checked={record.selected}
          onChange={() => handleTaskToggle(record.id)}
        />
      ),
    },
    {
      title: "Task Title",
      dataIndex: "title",
      key: "title",
      render: (text: string) => <span className="text-xs font-medium">{text}</span>,
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      render: (text: string) => <span className="text-xs text-gray-600">{text}</span>,
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (type: string) => (
        <Tag color="blue" className="text-xs">{type}</Tag>
      ),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (priority: string) => {
        const color = priority === "High" ? "red" : priority === "Medium" ? "orange" : "green";
        return <Tag color={color} className="text-xs">{priority}</Tag>;
      },
    },
    {
      title: "Hours",
      dataIndex: "estimatedHours",
      key: "estimatedHours",
      render: (hours: number) => <span className="text-xs">{hours}h</span>,
    },
    {
      title: "Start Date",
      dataIndex: "startDate",
      key: "startDate",
      render: (date: string) => (
        <span className="text-xs whitespace-nowrap">{dayjs(date).format("DD/MM/YYYY")}</span>
      ),
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      render: (date: string) => (
        <span className="text-xs whitespace-nowrap">{dayjs(date).format("DD/MM/YYYY")}</span>
      ),
    },
  ];

  if (!open) return null;

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            size="small"
            onClick={onClose}
            className="p-0"
          />
          <span className="font-semibold">Use Existing Epic Template</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={1200}
      className="use-existing-epic-modal"
      styles={{ body: { padding: 0 } }}
    >
      <div className="p-6">
        {/* Epic Template Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Epic Template
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PREDEFINED_EPICS.map((epic) => (
              <button
                key={epic.id}
                onClick={() => handleEpicSelect(epic)}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  selectedEpic?.id === epic.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm text-gray-900 mb-1">{epic.name}</h3>
                    <p className="text-xs text-gray-600">{epic.description}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {epic.tasks.length} task(s) included
                    </p>
                  </div>
                  {selectedEpic?.id === epic.id && (
                    <CheckOutlined className="text-blue-600 text-lg" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Tasks Table */}
        {selectedEpic && (
          <>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Tasks ({selectedTasks.length} of {tasks.length} selected)
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <Table
                  columns={taskColumns}
                  dataSource={tasks}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  scroll={{ x: 'max-content' }}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Gantt Chart */}
            {selectedTasks.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Timeline View</h3>
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <SimpleGanttChart tasks={selectedTasks} />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={handleCreateEpic}
                loading={loading}
                disabled={selectedTasks.length === 0}
                icon={<CheckOutlined />}
              >
                Create Epic with {selectedTasks.length} Task(s)
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

