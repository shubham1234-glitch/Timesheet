"use client";

import React, { useMemo, useState } from 'react';
import { DatePicker, Tag, Select, InputNumber, Switch } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { SubtaskData } from '../types';
import { getStatusOptions, getPriorityOptions, getWorkLocationOptions } from '@/app/lib/masterData';
import { getStatusTextColor, statusTagColor, getStatusDisplayLabel, getPriorityTextColor, priorityTagColor } from '@/app/lib/uiMaps';
import { usePathname } from 'next/navigation';
import { getMasterDataFromCache } from '@/app/lib/api';

interface SubtaskMetadataProps {
  subtaskData: SubtaskData;
  onSubtaskDataChange: (field: keyof SubtaskData, value: SubtaskData[keyof SubtaskData]) => void;
  isReadOnly?: boolean;
  onStatusChange?: (newStatus: SubtaskData['status']) => void;
  onNavigateToParentTask?: () => void;
  onNavigateToParentEpic?: () => void;
}

const SubtaskMetadata: React.FC<SubtaskMetadataProps> = ({
  subtaskData,
  onSubtaskDataChange,
  isReadOnly = false,
  onStatusChange,
  onNavigateToParentTask,
  onNavigateToParentEpic,
}) => {
  const pathname = usePathname();
  const isAdmin = pathname.includes('/admin/');

  const handleInputChange = (field: keyof SubtaskData, value: SubtaskData[keyof SubtaskData]) => {
    onSubtaskDataChange(field, value);
  };

  const statusOptions = useMemo(() => {
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
    return normalized.filter(opt => {
      const key = String(opt.value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [subtaskData.status]);

  const [priorityOptions] = useState(getPriorityOptions());
  const [workLocationOptions] = useState(getWorkLocationOptions());

  // Filter assignee options based on selected team
  const assigneeOptions = useMemo(() => {
    try {
      const md = getMasterDataFromCache<any>();
      const employees = md?.data?.employees || [];
      const teams = md?.data?.teams || [];
      
      // If team is selected, filter employees by that team
      if (subtaskData.team && subtaskData.team.trim()) {
        // Find the team code from team name
        const selectedTeam = teams.find((t: any) => 
          String(t.team_name || '').trim() === String(subtaskData.team).trim() ||
          String(t.team_code || '').trim() === String(subtaskData.team).trim()
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
      
      // If no team selected, show all employees
      return employees
        .filter((e: any) => e?.user_code && e?.user_name)
        .map((e: any) => ({ 
          value: String(e.user_name), 
          label: String(e.user_name) 
        }));
    } catch {
      return [];
    }
  }, [subtaskData.team]);

  const handleStartDateChange = (date: dayjs.Dayjs | null) => {
    const selected = date ? date : null;
    const due = subtaskData.dueDate ? dayjs(subtaskData.dueDate, 'YYYY-MM-DD') : null;
    if (selected && due && selected.isAfter(due, 'day')) {
      return;
    }
    handleInputChange('startDate', selected ? selected.format('YYYY-MM-DD') : '');
  };

  const disabledStartDate = (current: dayjs.Dayjs) => {
    const due = subtaskData.dueDate ? dayjs(subtaskData.dueDate, 'YYYY-MM-DD') : null;
    return due ? current && current.isAfter(due, 'day') : false;
  };

  const disabledDueDate = (current: dayjs.Dayjs) => {
    const start = subtaskData.startDate ? dayjs(subtaskData.startDate, 'YYYY-MM-DD') : null;
    return start ? current && current.isBefore(start, 'day') : false;
  };

  return (
    <div className="bg-white shadow-lg rounded-xl p-3 sm:p-4 space-y-4">
      <h3 className="text-[10px] font-semibold text-gray-800 mb-3">Subtask Details</h3>
      <div className="space-y-4">
        {/* Status */}
        <div>
          <label className="block text-[9px] font-medium text-gray-700 mb-1">Status</label>
          {isReadOnly ? (
            <Tag color={statusTagColor(subtaskData.status)} className="rounded-full text-xs">
              {getStatusDisplayLabel(subtaskData.status)}
            </Tag>
          ) : (
            <Select
              value={subtaskData.status}
              onChange={(v) => onStatusChange && onStatusChange(v as SubtaskData['status'])}
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
            <Tag color={priorityTagColor(subtaskData.priority)} className="text-[10px]">
              {priorityOptions.find(opt => opt.label === subtaskData.priority || opt.value === subtaskData.priority)?.label || subtaskData.priority}
            </Tag>
          ) : (
            <Select
              value={subtaskData.priority}
              onChange={(value) => handleInputChange('priority', value)}
              size="small"
              className="w-full"
              disabled={isReadOnly}
              options={priorityOptions.map(o => ({ value: o.label, label: (<span className={getPriorityTextColor(o.label)}>{o.label}</span>) }))}
            />
          )}
        </div>

        {/* Assignee */}
        <div>
          <label className="block text-[10px] font-medium text-gray-700 mb-1">Assignee</label>
          {isReadOnly ? (
            <span className="text-[9px] text-gray-800">{subtaskData.assignee || '-'}</span>
          ) : (
            <Select
              showSearch
              placeholder="Select assignee"
              size="small"
              className="w-full"
              value={subtaskData.assignee || undefined}
              onChange={(value) => handleInputChange('assignee', value || '')}
              options={assigneeOptions}
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
              allowClear
              disabled={isReadOnly}
            />
          )}
        </div>

        {/* Team */}
        <div>
          <label className="block text-[10px] font-medium text-gray-700 mb-1">Team</label>
          {isReadOnly ? (
            <span className="text-[9px] text-gray-800">{subtaskData.team || '-'}</span>
          ) : (
            <Select
              value={subtaskData.team || undefined}
              onChange={(value) => {
                // If team changes, check if assignee belongs to new team
                if (value && subtaskData.assignee) {
                  try {
                    const md = getMasterDataFromCache<any>();
                    const employees = md?.data?.employees || [];
                    const teams = md?.data?.teams || [];
                    const selectedTeam = teams.find((t: any) => 
                      String(t.team_name || '').trim() === String(value).trim() ||
                      String(t.team_code || '').trim() === String(value).trim()
                    );
                    const teamCode = selectedTeam?.team_code;
                    if (teamCode) {
                      const assigneeEmp = employees.find((e: any) => 
                        String(e.user_name || '').trim() === String(subtaskData.assignee).trim()
                      );
                      if (assigneeEmp && String(assigneeEmp.team_code || '').trim() !== String(teamCode).trim()) {
                        // Assignee doesn't belong to new team - clear it
                        handleInputChange('assignee', '');
                      }
                    }
                  } catch {
                    // Ignore errors
                  }
                } else if (!value && subtaskData.assignee) {
                  // Team is cleared - also clear assignee
                  handleInputChange('assignee', '');
                }
                handleInputChange('team', value || '');
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

        {/* Work Mode */}
        <div>
          <label className="block text-[10px] font-medium text-gray-700 mb-1">Work Mode</label>
          {isReadOnly ? (
            <span className="text-[9px] text-gray-800">{subtaskData.workMode || '-'}</span>
          ) : (
            <Select
              value={subtaskData.workMode}
              onChange={(value) => handleInputChange('workMode', value)}
              size="small"
              className="w-full"
              disabled={isReadOnly}
              options={workLocationOptions}
              allowClear
            />
          )}
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-[10px] font-medium text-gray-700 mb-1">Start Date</label>
          {isReadOnly ? (
            <span className="text-[9px] text-gray-800">
              {subtaskData.startDate ? dayjs(subtaskData.startDate).format('DD-MM-YYYY') : '-'}
            </span>
          ) : (
            <DatePicker
              value={subtaskData.startDate ? dayjs(subtaskData.startDate, 'YYYY-MM-DD') : null}
              onChange={handleStartDateChange}
              size="small"
              className="w-full"
              format="DD-MM-YYYY"
              disabledDate={disabledStartDate}
              suffixIcon={<CalendarOutlined className="text-gray-400" />}
              disabled={isReadOnly}
            />
          )}
        </div>

        {/* Due Date */}
        <div>
          <label className="block text-[10px] font-medium text-gray-700 mb-1">Due Date</label>
          {isReadOnly ? (
            <span className="text-[9px] text-gray-800">
              {subtaskData.dueDate ? dayjs(subtaskData.dueDate).format('DD-MM-YYYY') : '-'}
            </span>
          ) : (
            <DatePicker
              value={subtaskData.dueDate ? dayjs(subtaskData.dueDate, 'YYYY-MM-DD') : null}
              onChange={(date) => handleInputChange('dueDate', date ? date.format('YYYY-MM-DD') : '')}
              size="small"
              className="w-full"
              format="DD-MM-YYYY"
              disabledDate={disabledDueDate}
              suffixIcon={<CalendarOutlined className="text-gray-400" />}
              disabled={isReadOnly}
            />
          )}
        </div>

        {/* Closed Date */}
        {subtaskData.closedDate && (
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-1">Closed Date</label>
            <span className="text-[9px] text-gray-800">
              {dayjs(subtaskData.closedDate).format('DD-MM-YYYY')}
            </span>
          </div>
        )}

        {/* Estimated Hours */}
        <div>
          <label className="block text-[10px] font-medium text-gray-700 mb-1">Estimated Hours</label>
          {isReadOnly ? (
            <span className="text-[9px] text-gray-800">{subtaskData.estimatedHours || 0}</span>
          ) : (
            <InputNumber
              value={subtaskData.estimatedHours}
              onChange={(value) => handleInputChange('estimatedHours', Number(value) || 0)}
              size="small"
              className="w-full"
              min={0}
              step={0.5}
              precision={2}
              disabled={isReadOnly}
            />
          )}
        </div>

        {/* Estimated Days */}
        <div>
          <label className="block text-[10px] font-medium text-gray-700 mb-1">Estimated Days</label>
          <span className="text-[9px] text-gray-800">{subtaskData.estimatedDays || 0}</span>
        </div>

        {/* Is Billable */}
        <div>
          <label className="block text-[10px] font-medium text-gray-700 mb-1">Billable</label>
          {isReadOnly ? (
            <Tag color={subtaskData.isBillable ? 'green' : 'default'} className="text-[9px]">
              {subtaskData.isBillable ? 'Yes' : 'No'}
            </Tag>
          ) : (
            <Switch
              checked={subtaskData.isBillable}
              onChange={(checked) => handleInputChange('isBillable', checked)}
              disabled={isReadOnly}
              size="small"
            />
          )}
        </div>

        {/* Parent Task */}
        {subtaskData.parentTaskTitle && (
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-1">Parent Task</label>
            {onNavigateToParentTask ? (
              <button
                onClick={onNavigateToParentTask}
                className="text-[9px] text-blue-600 hover:text-blue-800 hover:underline"
              >
                {subtaskData.parentTaskTitle}
              </button>
            ) : (
              <span className="text-[9px] text-gray-800">{subtaskData.parentTaskTitle}</span>
            )}
          </div>
        )}

        {/* Parent Epic */}
        {subtaskData.parentEpicTitle && (
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-1">Parent Epic</label>
            {onNavigateToParentEpic ? (
              <button
                onClick={onNavigateToParentEpic}
                className="text-[9px] text-purple-600 hover:text-purple-800 hover:underline"
              >
                {subtaskData.parentEpicTitle}
              </button>
            ) : (
              <span className="text-[9px] text-gray-800">{subtaskData.parentEpicTitle}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubtaskMetadata;

