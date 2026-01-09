import React, { useMemo } from 'react';
import { TaskData } from '../types';
import TaskMetadata from './TaskMetadata';
import { getUserFromStorage } from '@/app/lib/auth/storage';
import { getMasterDataFromCache } from '@/app/lib/api';

interface RightPanelProps {
  taskData: TaskData;
  onTaskDataChange: (field: keyof TaskData, value: TaskData[keyof TaskData]) => void;
  isReadOnly?: boolean;
  onStatusChange?: (newStatus: string, reason?: string) => void;
  onAssignToSelf?: () => void;
  startDateRef?: React.RefObject<HTMLDivElement>;
  highlightStartDate?: boolean;
}

const RightPanel: React.FC<RightPanelProps> = ({
  taskData,
  onTaskDataChange,
  isReadOnly = false,
  onStatusChange,
  onAssignToSelf,
  startDateRef,
  highlightStartDate = false,
}) => {
  // Check if logged-in user belongs to the task's team
  const canAssignToSelf = useMemo(() => {
    if (!taskData.team || !onAssignToSelf) return false;
    
    const user = getUserFromStorage();
    if (!user?.userCode) return false;
    
    const md = getMasterDataFromCache<any>();
    const employees = md?.data?.employees || [];
    const teams = md?.data?.teams || [];
    
    // Find the task's team code
    const taskTeam = teams.find((t: any) => 
      String(t.team_name || '').trim() === String(taskData.team).trim() ||
      String(t.team_code || '').trim() === String(taskData.team).trim()
    );
    
    if (!taskTeam?.team_code) return false;
    
    // Find the logged-in user's employee record
    const currentUserEmployee = employees.find((e: any) => 
      String(e.user_code || '').trim().toLowerCase() === String(user.userCode || '').trim().toLowerCase()
    );
    
    if (!currentUserEmployee) return false;
    
    // Check if user's team matches task's team
    const userTeamCode = String(currentUserEmployee.team_code || '').trim();
    const taskTeamCode = String(taskTeam.team_code || '').trim();
    
    return userTeamCode === taskTeamCode;
  }, [taskData.team, taskData.assignee]);

  return (
    <div className="w-full lg:w-[30%] flex flex-col gap-3 lg:sticky lg:top-2 self-start">
      <TaskMetadata 
        taskData={taskData} 
        onTaskDataChange={onTaskDataChange} 
        isReadOnly={isReadOnly} 
        onStatusChange={onStatusChange}
        startDateRef={startDateRef}
        highlightStartDate={highlightStartDate}
      />
      {!isReadOnly && onAssignToSelf && !taskData.assignee && canAssignToSelf && (
        <button
          type="button"
          onClick={onAssignToSelf}
          className="mt-1 inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Assign to self
        </button>
      )}
    </div>
  );
};

export default RightPanel;
