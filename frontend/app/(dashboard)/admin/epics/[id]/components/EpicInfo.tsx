"use client";

import React, { useState, useEffect } from 'react';
import { Input } from 'antd';
import { Epic } from "@/app/types/EpicTypes";
import { getUserFromStorage } from "@/app/lib/auth/storage";

interface EpicInfoProps {
  epicData: Epic;
  onEpicDataChange: (field: keyof Epic, value: Epic[keyof Epic]) => void;
  isReadOnly?: boolean;
  onCreateTaskClick?: () => void;
}

const EpicInfo: React.FC<EpicInfoProps> = ({ epicData, onEpicDataChange, isReadOnly = false, onCreateTaskClick }) => {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  
  // Local state for inputs to avoid API calls on every keystroke
  const [localTitle, setLocalTitle] = useState(epicData.title);
  const [localDescription, setLocalDescription] = useState(epicData.description || "");

  useEffect(() => {
    const user = getUserFromStorage();
    setIsAdmin(user?.role === 'admin');
  }, []);

  // Sync local state when epicData changes (e.g., after API refetch)
  useEffect(() => {
    setLocalTitle(epicData.title);
    setLocalDescription(epicData.description || "");
  }, [epicData.title, epicData.description]);

  const handleTitleBlur = () => {
    if (localTitle !== epicData.title) {
      onEpicDataChange("title", localTitle);
    }
  };

  const handleDescriptionBlur = () => {
    if (localDescription !== (epicData.description || "")) {
      onEpicDataChange("description", localDescription);
    }
  };

  return (
    <>
      {/* Epic ID and Create Task button row */}
      <div className="mb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="bg-blue-100 text-blue-700 font-medium px-2 py-1 rounded text-[10px]">
          {epicData.key}
        </span>
          {onCreateTaskClick && isAdmin && (
            <button
              onClick={onCreateTaskClick}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors flex items-center gap-1.5"
            >
              <span>+</span>
              <span>Create Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Title row */}
      <div className="mb-4">
        {isReadOnly ? (
          <p className="text-[11px] text-gray-800 font-bold">{epicData.title}</p>
        ) : (
          <Input
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Epic Title"
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
            {epicData.description || "No description provided"}
          </p>
        ) : (
          <Input.TextArea
            value={localDescription}
            onChange={(e) => setLocalDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Enter epic description"
            rows={6}
            className="mt-1 text-[11px] border border-gray-300 rounded-md px-2 py-1 hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            size="small"
          />
        )}
      </div>
    </>
  );
};

export default EpicInfo;

