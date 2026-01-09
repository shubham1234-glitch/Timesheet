"use client";

import { Modal } from "antd";
import { PlusOutlined, FileTextOutlined } from "@ant-design/icons";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { getRoleBase, buildRoleHref } from "@/app/lib/paths";

interface TaskOptionModalProps {
  open: boolean;
  onClose: () => void;
  epicId: string;
  onCreated?: () => void;
}

export default function TaskOptionModal({ open, onClose, epicId, onCreated }: TaskOptionModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const roleBase = getRoleBase(pathname || '');

  const handleCreateNew = () => {
    onClose();
    router.push(buildRoleHref(roleBase, `/epics/${epicId}/tasks/create-new`));
  };

  const handleUseExisting = () => {
    onClose();
    router.push(buildRoleHref(roleBase, `/epics/${epicId}/tasks/use-existing`));
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <PlusOutlined className="text-blue-600" />
          <span className="font-semibold">Create Task</span>
        </div>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={600}
      className="task-option-modal"
      styles={{ body: { paddingTop: 0 } }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="py-4">
          <p className="text-sm text-gray-600 mb-6 text-center">
            Choose how you want to create your task
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Create New Option */}
            <button
              onClick={handleCreateNew}
              className="group relative p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all duration-200 text-left"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors">
                  <PlusOutlined className="text-2xl text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Create New</h3>
                <p className="text-xs text-gray-600">
                  Start from scratch with a blank task form
                </p>
              </div>
            </button>

            {/* Use Existing Option */}
            <button
              onClick={handleUseExisting}
              className="group relative p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all duration-200 text-left"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-green-200 transition-colors">
                  <FileTextOutlined className="text-2xl text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Use Existing</h3>
                <p className="text-xs text-gray-600">
                  Select from predefined task templates
                </p>
              </div>
            </button>
          </div>
        </div>
      </motion.div>
    </Modal>
  );
}

