"use client";

import { Drawer, Input, Button } from "antd";
import { toast } from "react-hot-toast";
import React, { useEffect, useState } from "react";
import { apiRequest } from "@/app/lib/api";

interface CreateSubtaskDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  taskId: number; // Parent Task ID (required)
  onCreated?: () => void; // Callback to refresh lists after successful creation
}

const labelCls = "block text-[13px] font-medium text-gray-700 mb-1";
const required = <span className="text-red-500"> *</span>;

const CreateSubtaskDrawer: React.FC<CreateSubtaskDrawerProps> = ({
  open,
  onClose,
  title = "Create Subtask",
  taskId,
  onCreated,
}) => {
  const [subtaskTitle, setSubtaskTitle] = useState<string>("");
  const [subtaskDesc, setSubtaskDesc] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset form fields when drawer opens
      setSubtaskTitle("");
      setSubtaskDesc("");
    }
  }, [open]);

  const handleCreate = async () => {
    // Validate required fields
    const missing: string[] = [];
    if (!subtaskTitle.trim()) missing.push("Subtask Title");
    if (!taskId || isNaN(Number(taskId))) missing.push("Task ID");
    
    if (missing.length) {
      toast.error(`Please fill required: ${missing.join(", ")}`);
      return;
    }
    
    setLoading(true);
    try {
      const form = new FormData();
      
      // Required fields
      form.append("subtask_title", subtaskTitle.trim());
      form.append("task_id", String(taskId));

      // Optional description
      if (subtaskDesc.trim()) {
        form.append("subtask_desc", subtaskDesc.trim());
      }

      await apiRequest("create_subtask", "POST", form);
      toast.success("Subtask created successfully");

      try {
        onCreated && onCreated();
      } catch {}

      // Reset form fields
      setSubtaskTitle("");
      setSubtaskDesc("");
      onClose();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to create subtask";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      title={title}
      placement="right"
      width={480}
      open={open}
      onClose={onClose}
      styles={{ body: { paddingTop: 0 } }}
    >
      <div className="text-[13px] space-y-5">
        {/* Subtask Title */}
        <div>
          <label className={labelCls}>Subtask Title{required}</label>
          <Input
            placeholder="Enter subtask title"
            size="small"
            value={subtaskTitle}
            onChange={(e) => setSubtaskTitle(e.target.value)}
          />
        </div>

        {/* Description */}
        <div>
          <label className={labelCls}>Description</label>
          <Input.TextArea
            placeholder="Detailed description of the subtask"
            rows={4}
            className="text-[13px]"
            value={subtaskDesc}
            onChange={(e) => setSubtaskDesc(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <Button size="small" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={handleCreate}
            loading={loading}
          >
            Create Subtask
          </Button>
        </div>
      </div>
    </Drawer>
  );
};

export default CreateSubtaskDrawer;

