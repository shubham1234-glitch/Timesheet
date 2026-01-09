import React, { useState, useMemo } from 'react';
import { Table } from 'antd';
import { SubTask } from '../types';
import { usePathname } from 'next/navigation';
import CreateSubtaskDrawer from '@/app/components/CreateSubtaskDrawer';

interface SubTasksTableProps {
  subTasks: SubTask[];
  onSubTaskStatusChange: (key: string, status: SubTask["status"]) => void;
  isReadOnly?: boolean;
  parentTaskId?: string; // Parent task ID for creating subtasks
  onSubTaskCreated?: () => void; // Callback when subtask is created
}

const SubTasksTable: React.FC<SubTasksTableProps> = ({
  subTasks,
  onSubTaskStatusChange,
  isReadOnly = false,
  parentTaskId,
  onSubTaskCreated,
}) => {
  const pathname = usePathname();
  const isAdmin = pathname.includes('/admin/');
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Extract role base from pathname
  const roleBase = pathname?.split('/')?.[1] ? `/${pathname.split('/')[1]}` : '/employee';

  const columns = useMemo(() => ([
    {
      title: "Sub Task",
      dataIndex: "id",
      key: "id",
      render: (id: string, record: SubTask) => {
        // Extract numeric ID from subtask ID (remove prefix if present)
        const extractSubtaskId = (subtaskId: string): string => {
          if (!subtaskId) return '';
          return subtaskId.replace(/^(ST-|SUBTASK-|SUB-)/i, '');
        };
        const numericId = extractSubtaskId(id);
        
        return (
          <div className="text-[9px]">
            <button
              onClick={() => router.push(`${roleBase}/subtasks/${numericId}`)}
              className="font-medium text-[9px] text-blue-600 hover:text-blue-800 hover:underline"
            >
              {id}
            </button>
            <div className="text-[9px] text-gray-600">{record.title}</div>
          </div>
        );
      },
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      render: (description: string) => (
        <div className="text-[9px] text-gray-600 max-w-xs">
          {description}
        </div>
      ),
    },
  ]), []);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-semibold text-gray-600">Subtasks under this Task</label>
        {isAdmin && !isReadOnly && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="px-3 py-1 bg-blue-600 text-white rounded text-[9px] hover:bg-blue-700 transition-colors flex items-center gap-1"
            type="button"
          >
            <span>+</span>
            Create Subtask
          </button>
        )}
      </div>
      {subTasks.length > 0 ? (
        <Table
          columns={columns}
          dataSource={subTasks}
          pagination={false}
          size="small"
          className="text-[9px]"
          rowKey="key"
        />
      ) : (
        <div className="text-[9px] text-gray-500 text-center py-4 bg-gray-50 rounded">
          No subtasks yet. {isAdmin && !isReadOnly && 'Click "Create Subtask" above to get started.'}
        </div>
      )}
      {isAdmin && !isReadOnly && parentTaskId && (
        <CreateSubtaskDrawer
          title="Create a new Sub Task"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          taskId={Number(parentTaskId)}
          onCreated={() => {
            setDrawerOpen(false);
            if (onSubTaskCreated) {
              onSubTaskCreated();
            }
          }}
        />
      )}
    </div>
  );
};

export default SubTasksTable;
