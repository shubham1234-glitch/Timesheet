"use client";

import { Drawer } from "antd";
import UseExistingTaskContent from "@/app/(dashboard)/admin/epics/[id]/components/UseExistingTaskContent";

interface UseExistingTaskDrawerProps {
  open: boolean;
  onClose: () => void;
  epicId?: string; // Optional - if not provided, task will be created without epic
  onCreated?: () => void;
}

export default function UseExistingTaskDrawer({ 
  open, 
  onClose, 
  epicId, 
  onCreated 
}: UseExistingTaskDrawerProps) {
  const handleCreated = () => {
    if (onCreated) {
      onCreated();
    }
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Drawer
      title="Create Task from Template"
      placement="right"
      onClose={handleCancel}
      open={open}
      width={800}
      className="use-existing-task-drawer"
    >
      <UseExistingTaskContent
        epicId={epicId}
        onCreated={handleCreated}
        onCancel={handleCancel}
      />
    </Drawer>
  );
}

