"use client";

import React from 'react';
import { Table, Tag } from 'antd';
import { Task, TaskStatus } from "@/app/types/EpicTypes";
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getRoleBase, buildRoleHref } from '@/app/lib/paths';

interface EpicTasksTableProps {
  tasks: Task[];
  isReadOnly?: boolean;
}

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case "High": return <ArrowUpOutlined style={{ color: '#ef4444' }} />; // red-500
    case "Medium": return <MinusOutlined style={{ color: '#eab308' }} />; // yellow-500
    case "Low": return <ArrowDownOutlined style={{ color: '#22c55e' }} />; // green-500
    default: return <MinusOutlined style={{ color: '#6b7280' }} />; // gray-500
  }
};

const formatTaskId = (taskId: string): string => {
  if (!taskId) return '';
  // Remove any existing prefix patterns (TA-, TASK-, TSK-)
  const cleanId = taskId.replace(/^(TA-|TASK-|TSK-)/i, '');
  // Add TA- prefix
  return `TA-${cleanId}`;
};

import { statusTagColor, priorityTagColor } from '@/app/lib/uiMaps';

const EpicTasksTable: React.FC<EpicTasksTableProps> = ({
  tasks,
  isReadOnly = false,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const roleBase = getRoleBase(pathname || '');

  // Sort tasks by taskId in ascending order (1, 2, 3...)
  const sortedTasks = React.useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aId = parseInt(a.taskId || '0', 10) || 0;
      const bId = parseInt(b.taskId || '0', 10) || 0;
      return aId - bId;
    });
  }, [tasks]);

  const columns = [
    {
      title: "Task",
      key: "task",
      render: (_: unknown, record: Task) => (
        <div className="flex items-start gap-2 min-w-[200px] sm:min-w-[250px]">
          <Image src="/icons/jira-task.svg" alt="Task" width={16} height={16} className="flex-shrink-0" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
            <a
              href={buildRoleHref(roleBase, `/tasks/${record.taskId}`)}
              className="text-blue-600 font-medium hover:text-blue-800 hover:underline text-[9px] flex-shrink-0"
              onClick={(e) => {
                e.preventDefault();
                router.push(buildRoleHref(roleBase, `/tasks/${record.taskId}`));
              }}
            >
              {formatTaskId(record.taskId)}
            </a>
            <div className="text-[9px] text-gray-600 truncate">{record.title}</div>
          </div>
        </div>
      ),
    },
    {
      title: "Assignee",
      dataIndex: "assignee",
      key: "assignee",
      render: (assignee: string) => <span className="text-[9px]">{assignee}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: TaskStatus) => (
        <Tag color={statusTagColor(status)} className="rounded-full text-[9px]">{status}</Tag>
      ),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (priority: string) => (
        <div className="flex items-center gap-1">
          {getPriorityIcon(priority)}
          <Tag color={priorityTagColor(priority)} className="rounded-full text-[9px]">{priority}</Tag>
        </div>
      ),
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      render: (date: string) => {
        if (!date) return <span className="text-[9px] whitespace-nowrap text-gray-400">-</span>;
        const dateObj = dayjs(date);
        if (!dateObj.isValid()) return <span className="text-[9px] whitespace-nowrap text-gray-400">-</span>;
        return <span className="text-[9px] whitespace-nowrap">{dateObj.format("DD/MM/YYYY")}</span>;
      },
    },
  ];

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-semibold text-gray-600">Tasks under this Epic</label>
        <span className="text-[9px] text-gray-500">
          {sortedTasks.filter(t => t.status === "Done").length} / {sortedTasks.length} completed
        </span>
      </div>
      {sortedTasks.length > 0 ? (
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <div className="min-w-[600px] sm:min-w-0">
            <Table
              columns={columns}
              dataSource={sortedTasks}
              rowKey="taskId"
              size="small"
              pagination={false}
              className="text-[9px] sticky-header-table"
              scroll={{ x: 'max-content' }}
            />
          </div>
        </div>
      ) : (
        <div className="text-[9px] text-gray-500 text-center py-4 bg-gray-50 rounded">
          No tasks yet. Create tasks under this epic to get started.
        </div>
      )}
    </div>
  );
};

export default EpicTasksTable;

