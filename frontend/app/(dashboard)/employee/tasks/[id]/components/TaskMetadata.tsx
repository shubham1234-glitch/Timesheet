import React, { useMemo, useState, useEffect, useRef } from 'react';
import { DatePicker, Input, Tag, Select, message, InputNumber, Modal, Button } from 'antd';
import { CalendarOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { TaskData } from '../types';
import { usePathname } from 'next/navigation';
import { getStatusOptions, getPriorityOptions, getTaskTypeOptions, getProductOptions, getWorkLocationOptions, onMasterDataChange } from '@/app/lib/masterData';
import { getStatusTextColor, statusTagColor, getStatusDisplayLabel, getPriorityTextColor, priorityTagColor } from '@/app/lib/uiMaps';
import { getMasterDataFromCache } from '@/app/lib/api';
import { toast } from 'react-hot-toast';

interface TaskMetadataProps {
  taskData: TaskData;
  onTaskDataChange: (field: keyof TaskData, value: TaskData[keyof TaskData]) => void;
  isReadOnly?: boolean;
  onStatusChange?: (newStatus: string, reason?: string) => void;
  startDateRef?: React.RefObject<HTMLDivElement>;
  highlightStartDate?: boolean;
}

const TaskMetadata: React.FC<TaskMetadataProps> = ({
  taskData,
  onTaskDataChange,
  isReadOnly = false,
  onStatusChange,
  startDateRef,
  highlightStartDate = false,
}) => {
  const pathname = usePathname();
  const isAdmin = pathname.includes('/admin/');

  const handleInputChange = (field: keyof TaskData, value: TaskData[keyof TaskData]) => {
    onTaskDataChange(field, value);
  };

  // Store previous team to detect changes
  const prevTeamRef = useRef<string | undefined>(taskData.team);

  // Clear assignee if team changes and current assignee is not in the new team
  useEffect(() => {
    // Only process if team actually changed (not on initial mount)
    if (prevTeamRef.current !== undefined && prevTeamRef.current !== taskData.team) {
      if (taskData.team && taskData.assignee) {
        const md = getMasterDataFromCache<any>();
        const employees = md?.data?.employees || [];
        const teams = md?.data?.teams || [];
        
        // Find the team code from team name
        const selectedTeam = teams.find((t: any) => 
          String(t.team_name || '').trim() === String(taskData.team).trim() ||
          String(t.team_code || '').trim() === String(taskData.team).trim()
        );
        
        const teamCode = selectedTeam?.team_code;
        
        if (teamCode) {
          // Check if current assignee is in the selected team
          const assigneeEmployee = employees.find((e: any) => 
            String(e.user_name || '').trim() === String(taskData.assignee).trim()
          );
          
          if (assigneeEmployee && String(assigneeEmployee.team_code || '').trim() !== String(teamCode).trim()) {
            // Assignee is not in the selected team, clear it
            handleInputChange('assignee', '');
          }
        }
      } else if (!taskData.team && taskData.assignee) {
        // If team is cleared, also clear assignee
        handleInputChange('assignee', '');
      }
    }
    
    // Update previous team reference
    prevTeamRef.current = taskData.team;
  }, [taskData.team]); // Only run when team changes


  const getStatusColorStyle = (status: string) => ({ color: undefined as string | undefined, className: getStatusTextColor(status) });

  const statusOptions = useMemo(() => {
    // Normalize and deduplicate by label (e.g., avoid duplicate "To Do")
    const normalized = getStatusOptions().map(o => {
      const label = getStatusDisplayLabel(o.label);
      return {
        value: label,
        code: o.value,
        label: (
          <span className={getStatusTextColor(label)}>{label}</span>
        )
      } as any;
    });
    const seen = new Set<string>();
    let options = normalized.filter(opt => {
      const key = String(opt.value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    // Keep "To Do" and "Blocked" status for all roles - removed filters
    return options;
  }, [isAdmin, taskData.status]);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [unsavedEstimatedHours, setUnsavedEstimatedHours] = useState<number | null>(null);
  const [isSavingEstimatedHours, setIsSavingEstimatedHours] = useState(false);

  // Sync unsaved value with taskData when it changes from outside
  useEffect(() => {
    setUnsavedEstimatedHours(null); // Reset when taskData changes externally
  }, [taskData.estimatedHours]);

  const handleSaveEstimatedHours = async () => {
    if (unsavedEstimatedHours === null) return;
    
    setIsSavingEstimatedHours(true);
    try {
      handleInputChange('estimatedHours', unsavedEstimatedHours);
      setUnsavedEstimatedHours(null);
      message.success('Estimated hours saved');
    } catch (error) {
      message.error('Failed to save estimated hours');
    } finally {
      setIsSavingEstimatedHours(false);
    }
  };

  const handleConfirmReason = () => {
    const needsReason = (pendingStatus || '').toLowerCase().includes('hold') || (pendingStatus || '').toLowerCase().includes('blocked') || (pendingStatus || '').toLowerCase().includes('cancel');
    if (needsReason && !cancelReason.trim()) {
      message.warning('Please provide a reason.');
      return;
    }
    if (onStatusChange && pendingStatus) {
      onStatusChange(pendingStatus, cancelReason.trim());
    } else if (pendingStatus) {
      handleInputChange('status', pendingStatus);
    }
    setCancelModalOpen(false);
    setPendingStatus(null);
    setCancelReason("");
  };

  const triggerStatusChange = (nextStatus: string) => {
    const s = nextStatus.toLowerCase();
    if (s.includes('blocked') || s.includes('cancel') || s.includes('hold')) {
      setPendingStatus(nextStatus);
      setCancelReason("");
      setCancelModalOpen(true);
      return;
    }
    if (onStatusChange) {
      onStatusChange(nextStatus);
    } else {
      handleInputChange('status', nextStatus);
    }
  };

  const [priorityOptions, setPriorityOptions] = useState(getPriorityOptions());
  const [taskTypeOptions, setTaskTypeOptions] = useState(getTaskTypeOptions());
  const [productOptions, setProductOptions] = useState(getProductOptions());
  const [workLocationOptions, setWorkLocationOptions] = useState(getWorkLocationOptions());

  // Filter assignee options based on selected team
  const assigneeOptions = useMemo(() => {
    try {
      const md = getMasterDataFromCache<any>();
      const employees = md?.data?.employees || [];
      const teams = md?.data?.teams || [];
      
      // If team is selected, filter employees by that team
      if (taskData.team && taskData.team.trim()) {
        // Find the team code from team name
        const selectedTeam = teams.find((t: any) => 
          String(t.team_name || '').trim() === String(taskData.team).trim() ||
          String(t.team_code || '').trim() === String(taskData.team).trim()
        );
        
        const teamCode = selectedTeam?.team_code;
        
        if (teamCode) {
          // Filter employees by team_code
          return employees
            .filter((e: any) => e?.user_code && e?.user_name && String(e.team_code || '').trim() === String(teamCode).trim())
            .map((e: any) => ({ 
              value: String(e.user_name), 
              label: String(e.user_name) 
            }));
        }
      }
      
      // If no team selected, return empty array
      return [];
    } catch {
      return [];
    }
  }, [taskData.team]);

  // Reporter options - show all employees (not filtered by team)
  const reporterOptions = useMemo(() => {
    try {
      const md = getMasterDataFromCache<any>();
      const employees = md?.data?.employees || [];
      return employees
        .filter((e: any) => e?.user_code && e?.user_name)
        .map((e: any) => ({ 
          value: String(e.user_name), 
          label: String(e.user_name) 
        }));
    } catch {
      return [];
    }
  }, []);

  const handleStartDateChange = (date: dayjs.Dayjs | null) => {
    const selected = date ? date : null;
    const due = taskData.dueDate ? dayjs(taskData.dueDate, 'YYYY-MM-DD') : null;
    if (selected && due && selected.isAfter(due, 'day')) {
      message.warning('Start date cannot be after due date');
      return;
    }
    handleInputChange('startDate', selected ? selected.format('YYYY-MM-DD') : '');
  };

  const disabledStartDate = (current: dayjs.Dayjs) => {
    const due = taskData.dueDate ? dayjs(taskData.dueDate, 'YYYY-MM-DD') : null;
    return due ? current && current.isAfter(due, 'day') : false;
  };

  const handleActualHoursChange = (value: string) => {
    const num = parseInt(value) || 0;
    const max = taskData.estimatedHours ?? 0;
    if (num > max) {
      message.warning('Actual hours cannot be more than estimated hours');
      handleInputChange('actualHours', max);
      return;
    }
    handleInputChange('actualHours', num);
  };

  // All fields are editable for all roles

  return (
    <>
    <div className="bg-white shadow-lg rounded-xl p-3 sm:p-4 space-y-4">
      <h3 className="text-[10px] font-semibold text-gray-800 mb-3">Task Details</h3>
      <div className="space-y-4">
        {/* Status */}
        <div>
          <label className="block text-[9px] font-medium text-gray-700 mb-1">Status</label>
          {isReadOnly ? (
            <Tag color={statusTagColor(taskData.status)} className="rounded-full text-xs">
              {getStatusDisplayLabel(taskData.status)}
            </Tag>
          ) : (
            <Select
              value={taskData.status}
              onChange={(v) => triggerStatusChange(v)}
              size="small"
              className="w-full"
              disabled={isReadOnly}
              options={statusOptions.map(o => ({
                value: o.value,
                label: o.label,
              }))}
              optionLabelProp="label"
            />
          )}
        </div>

        {/* Priority */}
        <div>
          <label className="block text-[10px] font-medium text-gray-700 mb-1">Priority</label>
          {isReadOnly ? (
            <Tag color={priorityTagColor(taskData.priority)} className="text-[10px]">
              {priorityOptions.find(opt => opt.label === taskData.priority || opt.value === taskData.priority)?.label || taskData.priority}
            </Tag>
          ) : (
            <Select
              value={taskData.priority}
              onChange={(value) => handleInputChange('priority', value)}
              size="small"
              className="w-full"
              disabled={isReadOnly}
              options={priorityOptions.map(o => ({ value: o.label, label: (<span className={getPriorityTextColor(o.label)}>{o.label}</span>) }))}
            />
          )}
        </div>

        {/* Type */}
        <div>
          <label className="block text-[10px] font-medium text-gray-700 mb-1">Type</label>
          {isReadOnly ? (
            <span className="text-[9px] text-gray-800">
              {taskTypeOptions.find(opt => opt.label === taskData.type || opt.value === taskData.type)?.label || taskData.type || '-'}
            </span>
          ) : (
            <Select
              value={taskData.type || undefined}
              onChange={(value) => handleInputChange('type', value || '')}
              size="small"
              className="w-full"
              disabled={isReadOnly}
              options={taskTypeOptions.map(o => ({
                value: o.label,
                label: o.label,
              }))}
              placeholder="Select task type"
              allowClear
            />
          )}
        </div>

        {/* Team */}
        <div>
          <label className="block text-[10px] font-medium text-gray-700 mb-1">Team</label>
          {isReadOnly ? (
            <span className="text-[9px] text-gray-800">{taskData.team || '-'}</span>
          ) : (
            <Select
              value={taskData.team}
              onChange={(value) => {
                // When team changes, check if current assignee belongs to new team
                // If not, clear assignee immediately
                if (value && taskData.assignee) {
                  const md = getMasterDataFromCache<any>();
                  const employees = md?.data?.employees || [];
                  const teams = md?.data?.teams || [];
                  
                  // Find the new team code
                  const newTeam = teams.find((t: any) => 
                    String(t.team_name || '').trim() === String(value).trim() ||
                    String(t.team_code || '').trim() === String(value).trim()
                  );
                  
                  const newTeamCode = newTeam?.team_code;
                  
                  if (newTeamCode) {
                    // Find current assignee
                    const assigneeEmployee = employees.find((e: any) => 
                      String(e.user_name || '').trim() === String(taskData.assignee).trim()
                    );
                    
                    if (assigneeEmployee) {
                      const assigneeTeamCode = String(assigneeEmployee.team_code || '').trim();
                      
                      if (assigneeTeamCode !== String(newTeamCode).trim()) {
                        // Assignee doesn't belong to new team - clear it immediately
                        handleInputChange('assignee', '');
                      }
                    }
                  }
                } else if (!value && taskData.assignee) {
                  // Team is cleared - also clear assignee
                  handleInputChange('assignee', '');
                }
                
                // Update team
                handleInputChange('team', value);
              }}
              size="small"
              className="w-full"
              disabled={isReadOnly}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={(() => {
                try {
                  const md = getMasterDataFromCache<any>();
                  const masterTeams = md?.data?.teams || [];
                  if (masterTeams.length > 0) {
                    return masterTeams
                      .filter((t: any) => t?.is_active !== false)
                      .map((t: any) => ({
                        value: String(t.team_name || t.team_code || ''),
                        label: String(t.team_name || t.team_code || ''),
                      }))
                      .sort((a: any, b: any) => a.label.localeCompare(b.label));
                  }
                  // Fallback to empty array
                  return [];
                } catch {
                  return [];
                }
              })()}
              placeholder="Select team"
              allowClear
            />
          )}
        </div>

        {/* Assignee */}
        <div>
          <label className="block text-[10px] font-medium text-gray-700 mb-1">Assignee</label>
          {isReadOnly ? (
            <span className="text-[9px] text-gray-800">{taskData.assignee}</span>
          ) : (
            <Select
              value={taskData.assignee || undefined}
              onChange={(value) => {
                // Validate that selected assignee belongs to the selected team
                if (value && taskData.team) {
                  const md = getMasterDataFromCache<any>();
                  const employees = md?.data?.employees || [];
                  const teams = md?.data?.teams || [];
                  
                  // Find the selected team code
                  const selectedTeam = teams.find((t: any) => 
                    String(t.team_name || '').trim() === String(taskData.team).trim() ||
                    String(t.team_code || '').trim() === String(taskData.team).trim()
                  );
                  
                  const teamCode = selectedTeam?.team_code;
                  
                  if (teamCode) {
                    // Find the selected assignee
                    const selectedAssignee = employees.find((e: any) => 
                      String(e.user_name || '').trim() === String(value).trim()
                    );
                    
                    if (selectedAssignee) {
                      const assigneeTeamCode = String(selectedAssignee.team_code || '').trim();
                      const newTeamCode = String(teamCode || '').trim();
                      
                      if (assigneeTeamCode !== newTeamCode) {
                        // Assignee doesn't belong to selected team - show error and don't update
                        const assigneeTeamName = teams.find((t: any) => 
                          String(t.team_code || '').trim() === assigneeTeamCode
                        )?.team_name || assigneeTeamCode;
                        
                        const selectedTeamName = String(selectedTeam.team_name || teamCode);
                        
                        toast.error(
                          `Assignee belongs to team "${assigneeTeamName}", but task is assigned to team "${selectedTeamName}". Please select an assignee from the task's team.`,
                          { duration: 5000 }
                        );
                        return; // Don't update assignee
                      }
                    }
                  }
                }
                
                // If validation passes, update the assignee
                handleInputChange('assignee', value);
              }}
              size="small"
              className="w-full"
              disabled={isReadOnly || !taskData.team}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={assigneeOptions}
              placeholder={taskData.team ? "Select assignee" : "Select team first"}
              notFoundContent={taskData.team ? "No team members found" : "Please select a team first"}
            />
          )}
        </div>

        {/* Reporter */}
        <div>
          <label className="block text-[10px] font-medium text-gray-700 mb-1">Reporter</label>
          {isReadOnly ? (
            <span className="text-[9px] text-gray-800">{taskData.reporter}</span>
          ) : (
            <Select
              value={taskData.reporter}
              onChange={(value) => handleInputChange('reporter', value)}
              size="small"
              className="w-full"
              disabled={isReadOnly}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={reporterOptions}
              placeholder="Select reporter"
            />
          )}
        </div>

        {/* Product */}
        <div>
          <label className="block text-[10px] font-medium text-gray-700 mb-1">Product</label>
          <div className="border border-gray-300 rounded px-2 py-1.5 min-h-[24px] flex items-center">
            <span className="text-[9px] text-gray-800">{taskData.product || '-'}</span>
          </div>
        </div>

        {/* Work Mode */}
        <div>
          <label className="block text-[10px] font-medium text-gray-700 mb-1">Work Mode</label>
          {isReadOnly || isAdmin ? (
            <div className="border border-gray-300 rounded px-2 py-1.5 min-h-[24px] flex items-center">
              <span className="text-[9px] text-gray-800">
                {taskData.workMode 
                  ? (workLocationOptions.find(opt => opt.value === taskData.workMode)?.label || taskData.workMode)
                  : '-'}
              </span>
            </div>
          ) : (
            <Select
              value={taskData.workMode || undefined}
              onChange={(value) => handleInputChange('workMode', value || '')}
              placeholder="Select work mode"
              size="small"
              className="w-full"
              allowClear
              options={workLocationOptions}
              disabled={isReadOnly || isAdmin}
            />
          )}
        </div>

        {/* Start Date (cannot be > Due Date) */}
        <div 
          ref={startDateRef}
          className={highlightStartDate ? 'animate-pulse bg-yellow-50 rounded-md p-2 -m-2 transition-all duration-300' : ''}
        >
          <label className="block text-[10px] font-medium text-gray-700 mb-1">Start Date</label>
          {isReadOnly ? (
            <span className="text-[9px] text-gray-800">{taskData.startDate ? dayjs(taskData.startDate, 'YYYY-MM-DD').format('DD-MM-YYYY') : '-'}</span>
          ) : (
            <DatePicker
              value={taskData.startDate ? dayjs(taskData.startDate, 'YYYY-MM-DD') : null}
              onChange={(date) => handleInputChange("startDate", date?.format('YYYY-MM-DD') || '')}
              format="DD-MM-YYYY"
              disabledDate={(current) => {
                const due = taskData.dueDate ? dayjs(taskData.dueDate, 'YYYY-MM-DD') : null;
                return due ? current && current.isAfter(due, 'day') : false;
              }}
              size="small"
              className="w-full"
              suffixIcon={<CalendarOutlined className="text-gray-400" />}
              disabled={isReadOnly}
            />
          )}
        </div>

        {/* Due Date */}
        <div>
          <label className="block text-[10px] font-medium text-gray-700 mb-1">Due Date</label>
          {isReadOnly ? (
            <span className="text-[9px] text-gray-800">{taskData.dueDate ? dayjs(taskData.dueDate, 'YYYY-MM-DD').format('DD-MM-YYYY') : '-'}</span>
          ) : (
            <DatePicker
              value={taskData.dueDate ? dayjs(taskData.dueDate, 'YYYY-MM-DD') : null}
              onChange={(date) => handleInputChange('dueDate', date ? date.format('YYYY-MM-DD') : '')}
              format="DD-MM-YYYY"
              size="small"
              className="w-full"
              suffixIcon={<CalendarOutlined className="text-gray-400" />}
              disabledDate={(current) => {
                if (taskData.startDate) return current && current < dayjs(taskData.startDate, 'YYYY-MM-DD').startOf('day');
                return false;
              }}
              disabled={isReadOnly}
            />
          )}
        </div>

        {/* Estimated Hours */}
        <div>
          <label className="block text-[10px] font-medium text-gray-700 mb-1">Estimated Hours</label>
          {isReadOnly ? (
            <span className="text-[9px] text-gray-800">{taskData.estimatedHours}</span>
          ) : (
            <div className="flex gap-1 items-center">
              <InputNumber
                value={unsavedEstimatedHours !== null ? unsavedEstimatedHours : taskData.estimatedHours}
                onChange={(value: number | null) => setUnsavedEstimatedHours(value ?? 0)}
                min={0}
                step={0.5}
                size="small"
                className="flex-1"
                disabled={isReadOnly || isSavingEstimatedHours}
              />
              {unsavedEstimatedHours !== null && 
               Math.abs((unsavedEstimatedHours ?? 0) - (Number(taskData.estimatedHours) || 0)) > 0.01 && (
                <Button
                  type="primary"
                  size="small"
                  icon={<SaveOutlined />}
                  onClick={handleSaveEstimatedHours}
                  loading={isSavingEstimatedHours}
                  className="shrink-0"
                  style={{ fontSize: '10px', height: '24px', padding: '0 8px' }}
                >
                  Save
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Actual Hours removed per requirement */}

        {/* Epic (if task belongs to an epic) */}
        {taskData.epicKey && (
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-1">Epic</label>
            <a
              href={typeof window !== 'undefined' ? `${'/' + window.location.pathname.split('/')[1]}/epics/${taskData.epicId}` : `/admin/epics/${taskData.epicId}`}
              className="text-blue-600 hover:text-blue-800 hover:underline text-xs"
            >
              {taskData.epicKey}
            </a>
          </div>
        )}
      </div>
    </div>
    <Modal
      title={
        (pendingStatus || '').toLowerCase().includes('hold')
          ? 'Reason for On Hold'
          : 'Reason for cancellation/blocked'
      }
      open={cancelModalOpen}
      onCancel={() => { setCancelModalOpen(false); setPendingStatus(null); }}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 text-xs hover:bg-gray-50"
            onClick={() => { setCancelModalOpen(false); setPendingStatus(null); }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
            onClick={handleConfirmReason}
          >
            Save
          </button>
        </div>
      }
    >
      <p className="text-xs text-gray-600 mb-2">
        {(pendingStatus || '').toLowerCase().includes('hold')
          ? 'Please provide a reason for setting this task to On Hold.'
          : 'Please provide a reason for setting this task to Blocked/Cancelled.'}
      </p>
      <Input.TextArea
        value={cancelReason}
        onChange={(e) => setCancelReason(e.target.value)}
        placeholder="Enter reason"
        rows={4}
      />
    </Modal>
    </>
  );
};

export default TaskMetadata;
