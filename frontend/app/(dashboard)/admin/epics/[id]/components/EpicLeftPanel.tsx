import React from 'react';
import { Epic, Task } from "@/app/types/EpicTypes";
import EpicInfo from './EpicInfo';
import EpicTasksTable from './EpicTasksTable';
import EpicTabsSection from './EpicTabsSection';
import AttachmentsSection from '../../../../employee/tasks/[id]/components/AttachmentsSection';
import SimpleGanttChart from '../../components/SimpleGanttChart';
import type { Comment } from '@/app/components/shared/CommentsTab';

interface EpicLeftPanelProps {
  epicData: Epic;
  onEpicDataChange: (field: keyof Epic, value: Epic[keyof Epic]) => void;
  uploadedFiles: File[];
  onFileUpload: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  onSaveAttachments?: () => void;
  tasks: Task[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  commentText: string;
  onCommentTextChange: (text: string) => void;
  onPostComment: () => void;
  comments: Comment[];
  challenges?: Comment[]; // Separate challenges list
  isReadOnly?: boolean;
  statusReason?: string;
  statusReasonsHistory?: Array<{ status_code?: string; status_reason?: string; created_at?: string; created_by?: string }>;
  onCreateTaskClick?: () => void;
  onPostChallenge?: () => void; // Handler for posting challenges
}

const EpicLeftPanel: React.FC<EpicLeftPanelProps> = ({
  epicData,
  onEpicDataChange,
  uploadedFiles,
  onFileUpload,
  onFileRemove,
  onSaveAttachments,
  tasks,
  activeTab,
  onTabChange,
  commentText,
  onCommentTextChange,
  onPostComment,
  comments,
  challenges = [],
  isReadOnly = false,
  statusReason,
  statusReasonsHistory = [],
  onCreateTaskClick,
  onPostChallenge,
}) => {
  return (
    <div className="w-full lg:w-[70%] bg-white shadow-lg rounded-xl p-2 sm:p-4 text-[9px] relative">
      <EpicInfo epicData={epicData} onEpicDataChange={onEpicDataChange} isReadOnly={isReadOnly} onCreateTaskClick={onCreateTaskClick} />
      
      <AttachmentsSection
        uploadedFiles={uploadedFiles}
        onFileUpload={onFileUpload}
        onFileRemove={onFileRemove}
        onSave={onSaveAttachments}
        existingAttachments={epicData.attachments}
        isReadOnly={isReadOnly}
      />
      
      <EpicTasksTable
        tasks={tasks}
        isReadOnly={isReadOnly}
      />

      {/* Gantt chart - same style as Use Existing Epic template (hours-based) */}
      {tasks && tasks.length > 0 && (
        <div className="mt-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Timeline View</h3>
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <SimpleGanttChart
              tasks={tasks.map((t) => ({
                id: t.taskId,
                title: t.title,
                startDate: t.startDate,
                dueDate: t.dueDate,
                estimatedHours: t.estimatedHours || 0,
                priority: t.priority,
              }))}
            />
          </div>
        </div>
      )}
      
      <EpicTabsSection
        activeTab={activeTab}
        onTabChange={onTabChange}
        commentText={commentText}
        onCommentTextChange={onCommentTextChange}
        onPostComment={onPostComment}
        comments={comments}
        challenges={challenges}
        isReadOnly={isReadOnly}
        status={epicData.status}
        statusReason={statusReason || (epicData as any).statusReason}
        statusReasonsHistory={statusReasonsHistory}
        onPostChallenge={onPostChallenge}
      />
    </div>
  );
};

export default EpicLeftPanel;

