"use client";

import { useState } from "react";
import { PlusOutlined } from "@ant-design/icons";
import TasksView from "@/app/components/TasksView";
import TaskOptionModalForTasks from "@/app/components/TaskOptionModalForTasks";

export default function AdminTasksPage() {
  const [taskOptionModalOpen, setTaskOptionModalOpen] = useState(false);

  return (
    <div className="px-3 py-1 text-xs">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">My Tasks</h1>
          <p className="text-xs text-gray-600">View and manage your assigned tasks</p>
        </div>
        <button
          onClick={() => setTaskOptionModalOpen(true)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <PlusOutlined />
          Create Task
        </button>
      </div>
      <TasksView paddingClass="p-1" filterClass="bg-white p-2 mb-3 text-xs" linkBase="/admin/tasks" />
      
      {/* Task Option Modal */}
      <TaskOptionModalForTasks
        open={taskOptionModalOpen}
        onClose={() => setTaskOptionModalOpen(false)}
      />
    </div>
  );
}
