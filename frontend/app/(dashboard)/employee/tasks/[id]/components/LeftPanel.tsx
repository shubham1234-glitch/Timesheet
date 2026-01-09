import React, { useState, useEffect } from 'react';
import { TaskData, SubTask } from '../types';
import TaskInfo from './TaskInfo';
import TabsSection from './TabsSection';
import AttachmentsSection from './AttachmentsSection';
import SubTasksTable from './SubTasksTable';

import { EpicAttachment } from "@/app/types/EpicTypes";

interface LeftPanelProps {
  taskData: TaskData;
  onTaskDataChange: (field: keyof TaskData, value: TaskData[keyof TaskData]) => void;
  uploadedFiles: File[];
  onFileUpload: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  onSaveAttachments?: () => void;
  existingAttachments?: EpicAttachment[]; // Attachments from API
  activeTab: string;
  onTabChange: (tab: string) => void;
  commentText: string;
  onCommentTextChange: (text: string) => void;
  onPostComment: () => void;
  comments: Comment[];
  isReadOnly?: boolean;
  statusReasonsHistory?: Array<{ status_code?: string; status_reason?: string; created_at?: string; created_by?: string }>;
  taskId?: string;
  subTasks?: SubTask[]; // Subtasks from parent component
  onSubTaskCreated?: () => void; // Callback when subtask is created
}

const LeftPanel: React.FC<LeftPanelProps> = ({
  taskData,
  onTaskDataChange,
  uploadedFiles,
  onFileUpload,
  onFileRemove,
  onSaveAttachments,
  existingAttachments = [],
  activeTab,
  onTabChange,
  commentText,
  onCommentTextChange,
  onPostComment,
  comments,
  isReadOnly = false,
  statusReasonsHistory = [],
  taskId,
  subTasks = [],
  onSubTaskCreated,
}) => {
  const handleSubTaskStatusChange = (key: string, newStatus: SubTask["status"]) => {
    // Update subtask status via API
    // TODO: Implement API call to update subtask status
    console.log('Subtask status change:', key, newStatus);
  };

  // Extract numeric task ID from taskId (remove TA- prefix if present)
  const extractTaskId = (id: string): string => {
    if (!id) return '';
    return id.replace(/^(TA-|TASK-|TSK-)/i, '');
  };

  const handleSubTaskCreated = () => {
    // Call parent callback to refresh subtasks
    if (onSubTaskCreated) {
      onSubTaskCreated();
    }
  };

  return (
    <div className="w-full lg:w-[70%] bg-white shadow-lg rounded-xl p-2 sm:p-4 text-xs relative">
      <TaskInfo taskData={taskData} onTaskDataChange={onTaskDataChange} isReadOnly={isReadOnly} />
      
      <AttachmentsSection
        uploadedFiles={uploadedFiles}
        onFileUpload={onFileUpload}
        onFileRemove={onFileRemove}
        onSave={onSaveAttachments}
        existingAttachments={existingAttachments}
        isReadOnly={isReadOnly}
      />
      
      {/* Subtasks Table - displayed directly below attachments */}
      <SubTasksTable
        subTasks={subTasks}
        onSubTaskStatusChange={handleSubTaskStatusChange}
        isReadOnly={isReadOnly}
        parentTaskId={taskId ? extractTaskId(taskId) : undefined}
        onSubTaskCreated={handleSubTaskCreated}
      />
      
      <TabsSection
        activeTab={activeTab}
        onTabChange={onTabChange}
        commentText={commentText}
        onCommentTextChange={onCommentTextChange}
        onPostComment={onPostComment}
        comments={comments}
        isReadOnly={isReadOnly}
        status={taskData.status}
        statusReason={taskData.statusReason}
        statusReasonsHistory={statusReasonsHistory}
        taskId={taskData.taskId}
      />
    </div>
  );
};

export default LeftPanel;
