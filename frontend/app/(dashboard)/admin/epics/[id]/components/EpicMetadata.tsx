"use client";

import React from 'react';
import { Input, Select, DatePicker, Tag, InputNumber, Modal, message } from 'antd';
import type { SelectProps } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Epic } from "@/app/types/EpicTypes";
import { getStatusOptions, getPriorityOptions, getProductOptions, getAllEmployeeOptions, onMasterDataChange } from '@/app/lib/masterData';
import { getStatusTextColor, statusTagColor, getStatusDisplayLabel, getPriorityTextColor } from '@/app/lib/uiMaps';
import { usePathname } from 'next/navigation';

interface EpicMetadataProps {
  epicData: Epic;
  onEpicDataChange: (field: keyof Epic, value: Epic[keyof Epic]) => void;
  isReadOnly?: boolean;
  onStatusChange?: (newStatus: string, reason?: string) => void;
}

const EpicMetadata: React.FC<EpicMetadataProps> = ({
  epicData,
  onEpicDataChange,
  isReadOnly = false,
  onStatusChange,
}) => {
  const pathname = usePathname();
  const isAdmin = pathname.includes('/admin/');
  const [statusOptions, setStatusOptions] = React.useState(getStatusOptions());
  const [priorityOptions, setPriorityOptions] = React.useState(getPriorityOptions());
  const [productOptions, setProductOptions] = React.useState(getProductOptions());
  const [employeeOptions, setEmployeeOptions] = React.useState(getAllEmployeeOptions());

  React.useEffect(() => {
    const update = () => {
      const base = getStatusOptions();
      // getStatusOptions() already normalizes labels, so we just need to deduplicate
      // Normalize labels again to ensure consistency (handles edge cases)
      const normalized = base.map(o => ({ value: o.value, label: getStatusDisplayLabel(o.label) }));
      const seen = new Set<string>();
      let unique = normalized.filter(o => {
        const k = String(o.label);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      
      // Keep "To Do" and "Blocked" status for all roles - removed filters
      setStatusOptions(unique as any);
      setPriorityOptions(getPriorityOptions());
      setProductOptions(getProductOptions());
      setEmployeeOptions(getAllEmployeeOptions());
    };
    const unsub = onMasterDataChange(update);
    update();
    return unsub;
  }, [isAdmin]);

  const handleInputChange = (field: keyof Epic, value: Epic[keyof Epic]) => {
    onEpicDataChange(field, value);
  };

  const statusTag = (status: string) => (
    <Tag color={statusTagColor(status)} className="rounded-full text-xs">{status}</Tag>
  );

  const [cancelModalOpen, setCancelModalOpen] = React.useState(false);
  const [pendingStatus, setPendingStatus] = React.useState<string | null>(null);
  const [cancelReason, setCancelReason] = React.useState<string>("");

  const triggerStatusChange = (nextCodeOrLabel: string) => {
    // nextCodeOrLabel is status code when selecting; we need label for decision
    const found = statusOptions.find(o => o.value === nextCodeOrLabel);
    const label = (found?.label || '').toString();
    const l = label.toLowerCase();
    if (l.includes('blocked') || l.includes('cancel') || l.includes('hold')) {
      setPendingStatus(nextCodeOrLabel);
      setCancelReason("");
      setCancelModalOpen(true);
      return;
    }
    if (onStatusChange) {
      onStatusChange(label);
    } else {
      onEpicDataChange('status', label as Epic['status']);
    }
  };

  // Map current labels to option values so Selects remain controlled
  const statusCodeValue = React.useMemo(() => {
    const found = statusOptions.find(o => (epicData.status || '').toLowerCase() === String(o.label || '').toLowerCase());
    return found?.value;
  }, [statusOptions, epicData.status]);

  const priorityCodeValue = React.useMemo(() => {
    const found = priorityOptions.find(o => (epicData.priority || '').toLowerCase() === String(o.label || '').toLowerCase());
    return found?.value;
  }, [priorityOptions, epicData.priority]);

  // All fields are editable for all roles

  return (
    <>
    <div className="bg-white shadow-lg rounded-xl p-3 sm:p-4 space-y-4">
      <h3 className="text-[10px] font-semibold text-gray-800 mb-3">Epic Details</h3>
      
      {/* Status */}
      <div>
        <label className="block text-[9px] font-medium text-gray-700 mb-1">Status</label>
        {isReadOnly ? (
          statusTag(epicData.status)
        ) : (
          <Select
            value={statusCodeValue}
            onChange={(value) => triggerStatusChange(String(value))}
            options={statusOptions.map((o) => {
              const label = getStatusDisplayLabel(String(o.label));
              return { 
                value: o.value, 
                label: <span className={getStatusTextColor(label)}>{label}</span> 
              };
            })}
            size="small"
            className="w-full"
            disabled={isReadOnly}
          />
        )}
      </div>

      {/* Priority */}
      <div>
        <label className="block text-[10px] font-medium text-gray-700 mb-1">Priority</label>
        <Select
          value={priorityCodeValue}
          onChange={(value) => handleInputChange("priority", value)}
          options={priorityOptions.map(o => ({ value: o.value, label: (<span className={getPriorityTextColor(String(o.label))}>{o.label}</span>) }))}
          size="small"
          className="w-full"
          disabled={isReadOnly}
        />
      </div>

      {/* Product */}
      <div>
        <label className="block text-[10px] font-medium text-gray-700 mb-1">Product</label>
        <Select
          value={epicData.product}
          onChange={(value) => handleInputChange("product", value)}
          options={productOptions}
          size="small"
          className="w-full [&_.ant-select-selector]:border-gray-300"
          disabled={isReadOnly}
        />
      </div>

      {/* Start Date */}
      <div>
        <label className="block text-[10px] font-medium text-gray-700 mb-1">Start Date</label>
        <DatePicker
          value={epicData.startDate ? dayjs(epicData.startDate, 'YYYY-MM-DD') : null}
          onChange={(date) => handleInputChange("startDate", date ? date.format('YYYY-MM-DD') : '')}
          format="DD-MM-YYYY"
          size="small"
          className="w-full"
          suffixIcon={<CalendarOutlined className="text-gray-400" />}
          disabled={isReadOnly}
        />
      </div>

      {/* Due Date */}
      <div>
        <label className="block text-[10px] font-medium text-gray-700 mb-1">Due Date</label>
        <DatePicker
          value={epicData.dueDate ? dayjs(epicData.dueDate, 'YYYY-MM-DD') : null}
          onChange={(date) => handleInputChange("dueDate", date ? date.format('YYYY-MM-DD') : '')}
          format="DD-MM-YYYY"
          size="small"
          className="w-full"
          suffixIcon={<CalendarOutlined className="text-gray-400" />}
          disabledDate={(current) => {
            if (epicData.startDate) return current && current < dayjs(epicData.startDate, 'YYYY-MM-DD').startOf('day');
            return false;
          }}
            disabled={isReadOnly}
        />
      </div>

      {/* Reporter */}
      <div>
        <label className="block text-[10px] font-medium text-gray-700 mb-1">Reporter</label>
        {isReadOnly ? (
          <div className="text-[9px] text-gray-900 py-1">{epicData.reporter || '-'}</div>
        ) : (
          <Select
            value={(() => {
              // Try to find by name first (if reporter is stored as name)
              const byName = employeeOptions.find(opt => opt.label === epicData.reporter);
              if (byName) return byName.value;
              // Try to find by value (if reporter is stored as code)
              const byValue = employeeOptions.find(opt => opt.value === epicData.reporter);
              if (byValue) return byValue.value;
              // If no match, return the current value (might be a name that's not in the list)
              return epicData.reporter || undefined;
            })()}
            onChange={(value) => {
              // Store the employee name (label) as the reporter
              const selectedEmployee = employeeOptions.find(opt => opt.value === value);
              handleInputChange("reporter", selectedEmployee?.label || value);
            }}
            options={employeeOptions}
            size="small"
            className="w-full"
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            placeholder="Select reporter"
            disabled={isReadOnly}
          />
        )}
      </div>

      {/* Is Billable */}
      <div>
        <label className="block text-[9px] font-medium text-gray-700 mb-1">Is Billable</label>
        {isReadOnly ? (
          <div className="text-[9px] text-gray-900 py-1">
            {epicData.isBillable ? 'Yes' : 'No'}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={epicData.isBillable || false}
              onClick={() => handleInputChange("isBillable", !epicData.isBillable)}
              className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${epicData.isBillable ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${epicData.isBillable ? 'translate-x-4' : 'translate-x-1'}`}
              />
            </button>
            <span className="text-[9px] text-gray-600">
              {epicData.isBillable ? 'Yes' : 'No'}
            </span>
          </div>
        )}
      </div>

      {/* Estimated Hours removed per requirement */}

      {/* Actual Hours removed per requirement */}

      {/* Progress removed as per requirement */}
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
            onClick={() => {
              const needsReason = (pendingStatus || '').toLowerCase().includes('hold') || (pendingStatus || '').toLowerCase().includes('blocked') || (pendingStatus || '').toLowerCase().includes('cancel');
              if (needsReason && !cancelReason.trim()) {
                message.warning('Please provide a reason.');
                return;
              }
              if (onStatusChange && pendingStatus) {
                const label = getStatusDisplayLabel(String(statusOptions.find(o => o.value === pendingStatus)?.label || ''));
                onStatusChange(label, cancelReason.trim());
              } else if (pendingStatus) {
                const foundStatus = statusOptions.find(o => o.value === pendingStatus);
                const statusLabel = foundStatus ? getStatusDisplayLabel(String(foundStatus.label)) : pendingStatus;
                onEpicDataChange('status', statusLabel as Epic['status']);
              }
              setCancelModalOpen(false);
              setPendingStatus(null);
              setCancelReason("");
            }}
          >
            Save
          </button>
        </div>
      }
    >
      <p className="text-xs text-gray-600 mb-2">
        {(pendingStatus || '').toLowerCase().includes('hold')
          ? 'Please provide a reason for setting this epic to On Hold.'
          : 'Please provide a reason for setting this epic to Blocked/Cancelled.'}
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

export default EpicMetadata;

