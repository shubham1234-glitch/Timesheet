"use client";

import React, { useState, useEffect } from 'react';
import { Input } from 'antd';
import { SubtaskData } from '../types';
import { usePathname } from 'next/navigation';

interface SubtaskInfoProps {
  subtaskData: SubtaskData;
  onSubtaskDataChange: (field: keyof SubtaskData, value: SubtaskData[keyof SubtaskData]) => void;
  isReadOnly?: boolean;
}

const SubtaskInfo: React.FC<SubtaskInfoProps> = ({ subtaskData, onSubtaskDataChange, isReadOnly = false }) => {
  const pathname = usePathname();
  const roleBase = pathname?.split('/')?.[1] ? `/${pathname.split('/')[1]}` : '/employee';
  
  // Local state for inputs to avoid API calls on every keystroke
  const [localTitle, setLocalTitle] = useState(subtaskData.title);
  const [localDescription, setLocalDescription] = useState(subtaskData.description || "");

  // Sync local state when subtaskData changes (e.g., after API refetch)
  useEffect(() => {
    setLocalTitle(subtaskData.title);
    setLocalDescription(subtaskData.description || "");
  }, [subtaskData.title, subtaskData.description]);

  const handleTitleBlur = () => {
    if (localTitle !== subtaskData.title) {
      onSubtaskDataChange("title", localTitle);
    }
  };

  const handleDescriptionBlur = () => {
    if (localDescription !== (subtaskData.description || "")) {
      onSubtaskDataChange("description", localDescription);
    }
  };

  return (
    <>
      {/* Subtask ID and Parent Task/Epic in same row */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="bg-green-100 text-green-700 font-medium px-2 py-1 rounded text-[10px]">
          ST-{subtaskData.subtaskId}
        </span>
        {subtaskData.parentTaskTitle ? (
          <a
            href={subtaskData.parentTaskId ? `${roleBase}/tasks/${subtaskData.parentTaskId}` : `${roleBase}/tasks`}
            className="bg-blue-100 text-blue-700 font-medium px-2 py-1 rounded text-[10px] hover:bg-blue-200 transition-colors"
          >
            Task: {subtaskData.parentTaskTitle}
          </a>
        ) : null}
        {subtaskData.parentEpicTitle ? (
          <a
            href={subtaskData.parentEpicId ? `${roleBase}/epics/${subtaskData.parentEpicId}` : `${roleBase}/epics`}
            className="bg-purple-100 text-purple-700 font-medium px-2 py-1 rounded text-[10px] hover:bg-purple-200 transition-colors"
          >
            Epic: {subtaskData.parentEpicTitle}
          </a>
        ) : null}
      </div>

      {/* Title */}
      <div className="mb-4">
        {isReadOnly ? (
          <p className="text-[11px] text-gray-800 font-bold">{subtaskData.title}</p>
        ) : (
          <Input
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Subtask Title"
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
            {subtaskData.description || "No description provided"}
          </p>
        ) : (
          <Input.TextArea
            value={localDescription}
            onChange={(e) => setLocalDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Enter subtask description"
            rows={6}
            className="mt-1 text-[11px] border border-gray-300 rounded-md px-2 py-1 hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            size="small"
          />
        )}
      </div>
    </>
  );
};

export default SubtaskInfo;

