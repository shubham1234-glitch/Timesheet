"use client";
import { useState, useEffect } from "react";
import { Form, Select, DatePicker, Input, Upload, Button, Row, Col } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { getLeaveTypeOptions, onMasterDataChange } from "@/app/lib/masterData";
import { apiRequest } from "@/app/lib/api";
import { toast } from "react-hot-toast";

interface ApplyLeaveTabProps {
  onClose: () => void;
  mode?: "create" | "view";
  entryData?: any;
  onApprove?: () => void;
  onReject?: () => void;
  hideActionButtons?: boolean;
  onSuccess?: () => void;
  initialDate?: dayjs.Dayjs | null;
}

export default function ApplyLeaveTab({ 
  onClose, 
  mode = "create",
  entryData,
  onApprove,
  onReject,
  hideActionButtons = false,
  onSuccess,
  initialDate
}: ApplyLeaveTabProps) {
  const [form] = Form.useForm();
  const [fromDate, setFromDate] = useState<dayjs.Dayjs | null>(null);
  const [leaveTypeOptions, setLeaveTypeOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // Watch form values for fromDate and toDate to disable button for past dates
  const fromDateValue = Form.useWatch('fromDate', form);
  const toDateValue = Form.useWatch('toDate', form);

  useEffect(() => {
    const update = () => setLeaveTypeOptions(getLeaveTypeOptions());
    const unsub = onMasterDataChange(update);
    update();
    return unsub;
  }, []);

  useEffect(() => {
    if (mode === "view" && entryData) {
      // Handle both direct properties and API response structure
      const from = entryData.from_date ? dayjs(entryData.from_date) : (entryData.fromDate ? dayjs(entryData.fromDate) : null);
      const to = entryData.to_date ? dayjs(entryData.to_date) : (entryData.toDate ? dayjs(entryData.toDate) : null);
      setFromDate(from);
      form.setFieldsValue({
        leaveType: entryData.leave_type_code || entryData.leaveType || "",
        fromDate: from,
        toDate: to,
        description: entryData.reason || entryData.description || "",
        attachments: entryData.attachments || [],
      });
    } else if (mode === "create") {
      // In create mode, check if we're editing a draft (entryData exists)
      if (entryData) {
        // Handle both direct properties and API response structure for draft entries
        const apiData = entryData?.rawData || entryData || {};
        const from = apiData.from_date ? dayjs(apiData.from_date) : (apiData.fromDate ? dayjs(apiData.fromDate) : null);
        const to = apiData.to_date ? dayjs(apiData.to_date) : (apiData.toDate ? dayjs(apiData.toDate) : null);
        
        // Only set dates if they're valid and not in the past
        const today = dayjs().startOf('day');
        const fromValid = from && from.isValid() && !from.startOf('day').isBefore(today);
        const toValid = to && to.isValid() && !to.startOf('day').isBefore(today);
        
        if (fromValid) {
          setFromDate(from);
        }
        
        form.setFieldsValue({
          leaveType: apiData.leave_type_code || apiData.leaveType || "",
          fromDate: fromValid ? from : null,
          toDate: toValid ? to : null,
          description: apiData.reason || apiData.description || "",
          attachments: apiData.attachments || [],
        });
      } else if (initialDate) {
        // Pre-fill fromDate with initialDate if provided (e.g., from day card selection)
        // Only set if it's a valid date and NOT in the past (leave cannot be applied for past dates)
        const today = dayjs().startOf('day');
        const isPastDate = initialDate.startOf('day') < today;
        
        // Only set if it's a valid date and not in the past
        if (initialDate && initialDate.isValid() && !isPastDate) {
          setFromDate(initialDate);
          form.setFieldsValue({
            fromDate: initialDate,
            toDate: null,
          });
        }
      }
    }
  }, [mode, entryData, form, initialDate]);

  const handleSubmit = async (values: any, isDraft: boolean = false) => {
    try {
      setSubmitting(true);
      
      // Strict validation: Leave cannot be applied for past dates
      const today = dayjs().startOf('day');
      const fromDate = values?.fromDate ? dayjs(values.fromDate).startOf('day') : null;
      const toDate = values?.toDate ? dayjs(values.toDate).startOf('day') : null;
      
      if (fromDate && fromDate < today) {
        toast.error("Leave cannot be applied for past dates. Please select today or a future date.");
        setSubmitting(false);
        return;
      }
      
      if (toDate && toDate < today) {
        toast.error("Leave cannot be applied for past dates. Please select today or a future date.");
        setSubmitting(false);
        return;
      }
      
      // Build multipart form data
      const formData = new FormData();

      // Check if this is an update to an existing draft entry
      const rawData = entryData?.rawData || entryData || {};
      const existingEntryId = rawData.leave_application_id || rawData.id;
      
      // If updating an existing draft entry, include the entry ID
      if (existingEntryId && entryData) {
        formData.append("leave_application_id", String(existingEntryId));
      }

      const leaveTypeCode = String(values?.leaveType || "").trim();
      const from = fromDate ? fromDate.format("YYYY-MM-DD") : "";
      const to = toDate ? toDate.format("YYYY-MM-DD") : "";
      const reason = String(values?.description || "").trim();

      formData.append("leave_type_code", leaveTypeCode);
      formData.append("from_date", from);
      formData.append("to_date", to);
      formData.append("reason", reason);
      
      // Add approval status
      if (isDraft) {
        formData.append("approval_status", "DRAFT");
      } else {
        // When submitting (not draft), set status to PENDING
        formData.append("approval_status", "PENDING");
      }

      // Attach files if present
      const files: any[] = Array.isArray(values?.attachments) ? values.attachments : [];
      for (const file of files) {
        const blob: File | undefined = (file as any)?.originFileObj;
        if (blob) {
          formData.append("attachments", blob, (blob as any)?.name || "attachment");
        }
      }

      // Call backend API
      const resp = await apiRequest<any>("apply_leave", "POST", formData);

      // Handle potential API error payloads
      if (resp?.success_flag === false || resp?.error) {
        const errMsg = resp?.message || resp?.error || resp?.detail || "Failed to apply leave";
        toast.error(errMsg, { duration: 4000, position: "top-right" });
        return;
      }

      toast.success(isDraft ? "Leave saved as draft" : "Leave applied successfully", { duration: 3000, position: "top-right" });
      // Call onSuccess callback to refresh leave entries
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (e: any) {
      const errMsg = e?.message || e?.detail || "Failed to apply leave. Please try again.";
      toast.error(errMsg, { duration: 4000, position: "top-right" });
    } finally {
      setSubmitting(false);
    }
  };

  // View mode - display data directly without form
  if (mode === "view") {
    const rawData = entryData?.rawData || entryData || {};
    const leaveType = rawData?.leave_type_name || rawData?.leave_type_code || entryData?.leaveType || "";
    const fromDate = rawData?.from_date ? dayjs(rawData.from_date) : (entryData?.from_date ? dayjs(entryData.from_date) : (entryData?.fromDate ? dayjs(entryData.fromDate) : null));
    const toDate = rawData?.to_date ? dayjs(rawData.to_date) : (entryData?.to_date ? dayjs(entryData.to_date) : (entryData?.toDate ? dayjs(entryData.toDate) : null));
    const description = rawData?.reason || rawData?.leave_reason || rawData?.description || entryData?.reason || entryData?.description || "";
    const status = rawData?.approval_status || entryData?.approval_status || entryData?.status || "";
    const rejectionReason = rawData?.rejection_reason || entryData?.rejection_reason || "";

    // Calculate number of days
    const daysCount = fromDate && toDate ? toDate.diff(fromDate, 'day') + 1 : 0;

    return (
      <div className="font-poppins">
        <div className="space-y-6">
          {/* Leave Type */}
          <div className="border-b border-gray-200 pb-5">
            <div className="flex items-start gap-6">
              <div className="w-36 flex-shrink-0">
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Leave Type</label>
              </div>
              <div className="flex-1">
                <div className="text-base font-semibold text-gray-900">
                  {leaveType || <span className="text-gray-400 font-normal">-</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div className="border-b border-gray-200 pb-5">
            <div className="flex items-start gap-6">
              <div className="w-36 flex-shrink-0">
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Date Range</label>
              </div>
              <div className="flex-1">
                <div className="flex flex-col gap-2">
                  <div className="text-base font-semibold text-gray-900">
                    {fromDate ? fromDate.format("DD-MM-YYYY") : <span className="text-gray-400 font-normal">-</span>}
                    {fromDate && toDate && (
                      <span className="mx-2 text-gray-400 font-normal">to</span>
                    )}
                    {toDate ? toDate.format("DD-MM-YYYY") : (fromDate ? <span className="text-gray-400 font-normal">-</span> : null)}
                  </div>
                  {daysCount > 0 && (
                    <div className="text-sm text-gray-600 font-medium">
                      {daysCount} {daysCount === 1 ? 'day' : 'days'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          {status && (
            <div className="border-b border-gray-200 pb-5">
              <div className="flex items-start gap-6">
                <div className="w-36 flex-shrink-0">
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Status</label>
                </div>
                <div className="flex-1">
                  <div className={`text-base font-semibold ${
                    status.toUpperCase() === 'APPROVED' ? 'text-green-600' :
                    status.toUpperCase() === 'REJECTED' ? 'text-red-600' :
                    'text-blue-600'
                  }`}>
                    {status}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {description && (
            <div className="border-b border-gray-200 pb-5">
              <div className="flex items-start gap-6">
                <div className="w-36 flex-shrink-0">
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Reason</label>
                </div>
                <div className="flex-1">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{description}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rejection Reason */}
          {rejectionReason && String(rejectionReason).trim() && (
            <div className="border-b border-gray-200 pb-5">
              <div className="flex items-start gap-6">
                <div className="w-36 flex-shrink-0">
                  <label className="block text-xs font-medium text-red-600 uppercase tracking-wide mb-1">Rejection Reason</label>
                </div>
                <div className="flex-1">
                  <div className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-4">
                    <p className="text-sm text-red-700 leading-relaxed whitespace-pre-wrap">{String(rejectionReason).trim()}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Attachments */}
          {entryData?.attachments && Array.isArray(entryData.attachments) && entryData.attachments.length > 0 && (
            <div className="border-b border-gray-200 pb-5">
              <div className="flex items-start gap-6">
                <div className="w-36 flex-shrink-0">
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Attachments</label>
                </div>
                <div className="flex-1">
                  <div className="space-y-2">
                    {entryData.attachments.map((file: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-2">
                          <UploadOutlined className="text-gray-400" />
                          <span className="text-sm text-gray-700">{file.file_name || file.name || "Attachment"}</span>
                          {file.file_size && (
                            <span className="text-xs text-gray-500">
                              ({typeof file.file_size === 'number' 
                                ? `${(file.file_size / 1024).toFixed(2)} KB` 
                                : file.file_size})
                            </span>
                          )}
                        </div>
                        {(file.file_url || file.file_path) && (
                          <a 
                            href={file.file_url || file.file_path} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Form
      form={form}
      onFinish={handleSubmit}
      layout="vertical"
        initialValues={{
        leaveType: entryData?.leaveType || "",
        fromDate: entryData?.fromDate ? dayjs(entryData.fromDate) : (initialDate && initialDate.startOf('day') >= dayjs().startOf('day') ? initialDate : null),
        toDate: entryData?.toDate ? dayjs(entryData.toDate) : null,
        description: entryData?.description || "",
      }}
      className="font-poppins"
    >
      {/* Leave Type */}
      <Form.Item
        label={<span>Type <span style={{ color: 'red' }}>*</span></span>}
        name="leaveType"
        rules={[{ required: true, message: 'Please select leave type!' }]}
        required={false}
      >
        <Select 
          placeholder="Select leave type" 
          disabled={false}
          options={leaveTypeOptions}
          showSearch
          filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
        />
      </Form.Item>

      {/* From Date and To Date Row */}
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label={<span>From Date <span style={{ color: 'red' }}>*</span></span>}
            name="fromDate"
            rules={[{ required: true, message: 'Please select from date!' }]}
            required={false}
          >
            <DatePicker
              className="w-full"
              placeholder="Select start date"
              format="DD-MM-YYYY"
              onChange={(date) => setFromDate(date)}
              disabled={false}
              disabledDate={(current) => {
                // From date cannot be in the past - only today and future dates allowed for leave applications
                if (!current) return false;
                const today = dayjs().startOf('day');
                // Strictly disable all past dates (before today)
                return current < today;
              }}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label={<span>To Date <span style={{ color: 'red' }}>*</span></span>}
            name="toDate"
            rules={[{ required: true, message: 'Please select to date!' }]}
            required={false}
          >
            <DatePicker
              className="w-full"
              placeholder="Select end date"
              format="DD-MM-YYYY"
              disabled={false}
              disabledDate={(current) => {
                // To date cannot be in the past - only today and future dates allowed for leave applications
                // Also cannot be before from date (if selected)
                if (!current) return false;
                const today = dayjs().startOf('day');
                // Strictly disable all past dates (before today)
                if (current < today) return true;
                // Cannot be before from date
                if (fromDate) return current < fromDate.startOf('day');
                return false;
              }}
            />
          </Form.Item>
        </Col>
      </Row>

      {/* Description */}
      <Form.Item
        label={<span>Description <span style={{ color: 'red' }}>*</span></span>}
        name="description"
        rules={[{ required: true, message: 'Please enter description!' }]}
        required={false}
      >
        <Input.TextArea
          rows={3}
          placeholder="Enter reason for leave"
          disabled={false}
        />
      </Form.Item>

      {/* Rejection Reason - Show only if entry is rejected and reason exists */}
      {entryData && (() => {
        // Check status from multiple possible fields (handle both rawData and direct properties)
        const rawData = entryData.rawData || entryData;
        const status = 
          rawData.approval_status || 
          rawData.status || 
          rawData.status_code ||
          entryData.approval_status || 
          entryData.status || 
          entryData.status_code || 
          "";
        const statusUpper = String(status).toUpperCase();
        const isRejected = statusUpper === "REJECTED" || status === "Rejected";
        
        // Check rejection reason from multiple possible fields and locations
        const rejectionReason = 
          rawData.rejection_reason || 
          rawData.rejectionReason || 
          entryData.rejection_reason || 
          entryData.rejectionReason || 
          "";
        
        if (isRejected && rejectionReason && String(rejectionReason).trim()) {
          return (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
              <div className="flex items-start gap-2">
                <svg 
                  className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-800 mb-1">
                    Rejection Reason
                  </h4>
                  <p className="text-sm text-red-700 whitespace-pre-wrap">
                    {String(rejectionReason).trim()}
                  </p>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Attachments */}
      <Form.Item
        label="Attachments"
        name="attachments"
        valuePropName="fileList"
        getValueFromEvent={(e) => {
          if (Array.isArray(e)) {
            return e;
          }
          return e?.fileList;
        }}
      >
        {entryData?.attachments && Array.isArray(entryData.attachments) && entryData.attachments.length > 0 ? (
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="space-y-2">
              {entryData.attachments.map((file: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100">
                  <div className="flex items-center gap-2">
                    <UploadOutlined className="text-gray-400" />
                    <span className="text-sm text-gray-700">{file.file_name || file.name}</span>
                    {file.file_size && (
                      <span className="text-xs text-gray-500">
                        ({typeof file.file_size === 'number' 
                          ? `${(file.file_size / 1024).toFixed(2)} KB` 
                          : file.file_size})
                      </span>
                    )}
                  </div>
                  {(file.file_url || file.file_path) && (
                    <a 
                      href={file.file_url || file.file_path} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Upload
            beforeUpload={() => false}
            multiple
            disabled={false}
          >
            <Button icon={<UploadOutlined />} disabled={false}>Click to upload files</Button>
          </Upload>
        )}
      </Form.Item>

      {/* Apply Button or Approve/Reject Buttons */}
      {!hideActionButtons && (
        <Form.Item className="mb-0">
          {(onApprove || onReject) ? (
            <div className="flex gap-2 justify-end">
              {onReject && (
                <Button danger onClick={onReject}>
                  Reject
                </Button>
              )}
              {onApprove && (
                <Button type="primary" onClick={onApprove} className="bg-green-600 hover:bg-green-700">
                  Approve
                </Button>
              )}
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              {(() => {
                // Check if fromDate or toDate is in the past
                const today = dayjs().startOf('day');
                const isFromDatePast = fromDateValue && dayjs(fromDateValue).startOf('day') < today;
                const isToDatePast = toDateValue && dayjs(toDateValue).startOf('day') < today;
                const isDisabled = submitting || isFromDatePast || isToDatePast;
                
                return (
                  <>
                    <Button 
                      onClick={() => {
                        form.validateFields().then((values) => {
                          handleSubmit(values, true);
                        }).catch(() => {
                          // Validation failed, but still allow saving as draft
                          const currentValues = form.getFieldsValue();
                          handleSubmit(currentValues, true);
                        });
                      }}
                      loading={submitting}
                      disabled={submitting}
                      className="bg-gray-600 hover:bg-gray-700"
                    >
                      Save as Draft
                    </Button>
                    <Button 
                      type="primary" 
                      htmlType="submit" 
                      loading={submitting} 
                      disabled={isDisabled}
                      title={isFromDatePast || isToDatePast ? "Cannot apply leave for previous dates" : ""}
                    >
                      Apply
                    </Button>
                  </>
                );
              })()}
            </div>
          )}
        </Form.Item>
      )}
    </Form>
  );
}