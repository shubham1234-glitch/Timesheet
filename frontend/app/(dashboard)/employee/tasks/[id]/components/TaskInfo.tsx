"use client";

import React, { useState, useEffect } from 'react';
import { Input } from 'antd';
import { TaskData } from '../types';
import { usePathname } from 'next/navigation';

interface TaskInfoProps {
  taskData: TaskData;
  onTaskDataChange: (field: keyof TaskData, value: TaskData[keyof TaskData]) => void;
  isReadOnly?: boolean;
}

const TaskInfo: React.FC<TaskInfoProps> = ({ taskData, onTaskDataChange, isReadOnly = false }) => {
  const pathname = usePathname();
  const roleBase = pathname?.split('/')?.[1] ? `/${pathname.split('/')[1]}` : '/admin';
  
  // Local state for inputs to avoid API calls on every keystroke
  const [localTitle, setLocalTitle] = useState(taskData.title);
  const [localDescription, setLocalDescription] = useState(taskData.description || "");

  // Sync local state when taskData changes (e.g., after API refetch)
  useEffect(() => {
    setLocalTitle(taskData.title);
    setLocalDescription(taskData.description || "");
  }, [taskData.title, taskData.description]);

  const handleTitleBlur = () => {
    if (localTitle !== taskData.title) {
      onTaskDataChange("title", localTitle);
    }
  };

  const handleDescriptionBlur = () => {
    if (localDescription !== (taskData.description || "")) {
      onTaskDataChange("description", localDescription);
    }
  };

  return (
    <>
      {/* Task ID and Epic ID in same row */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="bg-blue-100 text-blue-700 font-medium px-2 py-1 rounded text-[10px]">
          {taskData.taskId}
        </span>
        {taskData.epicKey ? (
          <a
            href={taskData.epicId ? `${roleBase}/epics/${taskData.epicId}` : `${roleBase}/epics`}
            className="bg-purple-100 text-purple-700 font-medium px-2 py-1 rounded text-[10px] hover:bg-purple-200 transition-colors"
          >
            {taskData.epicKey}
          </a>
        ) : (
          <span className="bg-gray-100 text-gray-600 font-medium px-2 py-1 rounded text-[10px]">
            Epic ID: -
          </span>
        )}
      </div>

      {/* Title */}
      <div className="mb-4">
        {isReadOnly ? (
          <p className="text-[11px] text-gray-800 font-bold">{taskData.title}</p>
        ) : (
          <Input
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Task Title"
            className="w-full text-[11px] font-bold border border-gray-300 rounded-md px-2 py-1 hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            size="small"
          />
        )}
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="text-[11px] font-semibold text-gray-600">Description</label>
        {isReadOnly ? (
          <p className="text-[11px] text-gray-800 mt-1 whitespace-pre-wrap">
            {taskData.description || "No description provided"}
          </p>
        ) : (
          <Input.TextArea
            value={localDescription}
            onChange={(e) => setLocalDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Enter task description"
            rows={6}
            className="mt-1 text-[11px] border border-gray-300 rounded-md px-2 py-1 hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            size="small"
          />
        )}
      </div>
    </>
  );
};

export default TaskInfo;
