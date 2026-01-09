"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import LeftPanel from "@/app/(dashboard)/employee/tasks/[id]/components/LeftPanel";
import RightPanel from "@/app/(dashboard)/employee/tasks/[id]/components/RightPanel";
import type { TaskData } from "@/app/(dashboard)/employee/tasks/[id]/types";
import type { Comment } from "@/app/components/shared/CommentsTab";
import type { EpicAttachment } from "@/app/types/EpicTypes";
import { getUserFromStorage } from "@/app/lib/auth/storage";

const baseTask: TaskData = {
  taskId: "TA-1",
  title: "Client onboarding – Portal access setup",
  description:
    "Dummy task for Available Tasks view. This simulates a real task so you can see how the details page looks.",
  priority: "High",
  type: "Task",
  status: "To Do",
  assignee: "Unassigned",
  reporter: "Admin User",
  startDate: "2025-11-28",
  dueDate: "2025-11-30",
  submissionDate: "",
  estimatedHours: 8,
  actualHours: 0,
  attachments: [],
  epicId: "",
  epicKey: "",
};

export default function AdminAvailableTaskDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "1";

  const [taskData, setTaskData] = useState<TaskData>({
    ...baseTask,
    taskId: `TA-${id}`,
  });
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [taskAttachments] = useState<EpicAttachment[]>([]);
  const [activeTab, setActiveTab] = useState("activity");
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);

  const handleTaskDataChange = (
    field: keyof TaskData,
    value: TaskData[keyof TaskData]
  ) => {
    setTaskData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileUpload = (files: File[]) => {
    setUploadedFiles(files);
  };

  const handleFileRemove = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAssignToSelf = () => {
    const user = getUserFromStorage();
    const name = user?.userName || "Current User";
    handleTaskDataChange("assignee", name);
  };

  const handlePostComment = () => {
    const text = commentText.trim();
    if (!text) return;
    const user = getUserFromStorage();
    const userName = user?.userName || "User";
    const currentDate = new Date().toLocaleDateString();
    const newComment: Comment = {
      text,
      author: userName,
      date: currentDate,
    };
    setComments((prev) => [...prev, newComment]);
    setCommentText("");
  };

  return (
    <div className="p-2 sm:p-4 min-h-screen">
      <div className="flex flex-col lg:flex-row gap-4">
        <LeftPanel
          taskData={taskData}
          onTaskDataChange={handleTaskDataChange}
          uploadedFiles={uploadedFiles}
          onFileUpload={handleFileUpload}
          onFileRemove={handleFileRemove}
          onSaveAttachments={undefined}
          existingAttachments={taskAttachments}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          commentText={commentText}
          onCommentTextChange={setCommentText}
          onPostComment={handlePostComment}
          comments={comments}
          isReadOnly={false}
          statusReasonsHistory={[]}
        />
        <RightPanel
          taskData={taskData}
          onTaskDataChange={handleTaskDataChange}
          isReadOnly={false}
          onAssignToSelf={handleAssignToSelf}
        />
      </div>
    </div>
  );
}


