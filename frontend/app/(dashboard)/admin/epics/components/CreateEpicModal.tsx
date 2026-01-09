"use client";

import { Modal, Select, Input, InputNumber, DatePicker, Upload } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { toast } from "react-hot-toast";
import React, { useEffect, useState, useMemo } from "react";
import { CalendarOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { apiRequest } from "@/app/lib/api";
import { getProductOptions, getPriorityOptions, getClientOptions, getContactPersonOptions, onMasterDataChange } from "@/app/lib/masterData";

interface CreateEpicModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  onCreated?: () => void;
}

const labelCls = "block text-[13px] font-medium text-gray-700 mb-1";
const required = <span className="text-red-500"> *</span>;

// Helper function to add working days (Monday-Friday), skipping weekends
const addWorkingDays = (startDate: dayjs.Dayjs, workingDays: number): dayjs.Dayjs => {
  let currentDate = startDate.clone();
  let daysAdded = 0;
  const daysToAdd = Math.ceil(workingDays);
  
  // Start date is day 1, so we need to add (workingDays - 1) more days
  while (daysAdded < daysToAdd - 1) {
    currentDate = currentDate.add(1, 'day');
    const dayOfWeek = currentDate.day(); // 0 = Sunday, 6 = Saturday
    // Only count Monday-Friday (1-5) as working days
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }
  
  // If the final date falls on a weekend, move to next Monday
  const finalDayOfWeek = currentDate.day();
  if (finalDayOfWeek === 0) { // Sunday
    currentDate = currentDate.add(1, 'day'); // Move to Monday
  } else if (finalDayOfWeek === 6) { // Saturday
    currentDate = currentDate.add(2, 'day'); // Move to Monday
  }
  
  return currentDate;
};

const CreateEpicModal: React.FC<CreateEpicModalProps> = ({ open, onClose, title = "Create New Epic", onCreated }) => {
  const [epicTitle, setEpicTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(null);
  const [dueDate, setDueDate] = useState<dayjs.Dayjs | null>(null);
  const [product, setProduct] = useState<string>("");
  const [client, setClient] = useState<string>("");
  const [contactPerson, setContactPerson] = useState<string>("");
  const [estimatedHours, setEstimatedHours] = useState<number | null>(null);
  const [isBillable, setIsBillable] = useState<boolean>(false);
  
  // Calculate estimated days from estimated hours (8 hours = 1 working day)
  const estimatedDays = useMemo(() => {
    if (estimatedHours == null || estimatedHours <= 0) return null;
    return Math.ceil(estimatedHours / 8 * 100) / 100; // Round to 2 decimal places
  }, [estimatedHours]);
  
  // Auto-calculate due date from start date and estimated days (working days only)
  useEffect(() => {
    if (startDate && estimatedDays != null && estimatedDays > 0) {
      const calculatedDueDate = addWorkingDays(startDate, estimatedDays);
      setDueDate(calculatedDueDate);
    }
  }, [startDate, estimatedDays]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadList, setUploadList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [reporterName, setReporterName] = useState<string>("");

  const handleNumberKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    const allowed = ["Backspace", "Tab", "Delete", "ArrowLeft", "ArrowRight", "Home", "End"]; 
    const isNumber = /[0-9]/.test(e.key);
    const isDot = e.key === "."; 
    if (allowed.includes(e.key)) return; 
    if (isNumber) return; 
    if (isDot) {
      const input = e.currentTarget as HTMLInputElement; 
      if (input.value.includes(".")) {
        e.preventDefault();
      }
      return; 
    } 
    e.preventDefault();
  };

  useEffect(() => {
    const loadReporterName = async () => {
      try {
        const { getUserFromStorage } = await import("../../../../lib/auth/storage");
        const user = getUserFromStorage();
        if (user?.userName) setReporterName(user.userName);
      } catch {}
    };
    if (open) {
      loadReporterName();
      // Reset form fields when modal opens
      setEpicTitle("");
      setDescription("");
      setPriority("");
      setStartDate(null);
      setDueDate(null);
      setProduct("");
      setClient("");
      setContactPerson("");
      setEstimatedHours(null);
      setIsBillable(false);
      setFiles([]);
      setUploadList([]);
    }
  }, [open]);

  const [productOptions, setProductOptions] = useState(getProductOptions());
  const [priorityOptions, setPriorityOptions] = useState(getPriorityOptions());
  const [clientOptions, setClientOptions] = useState(getClientOptions());
  const [contactPersonOptions, setContactPersonOptions] = useState(getContactPersonOptions());

  // Update options when master data changes
  useEffect(() => {
    const update = () => {
      setProductOptions(getProductOptions());
      setPriorityOptions(getPriorityOptions());
      setClientOptions(getClientOptions());
      // Update contact person options based on selected client
      const newContactOptions = getContactPersonOptions(client || undefined);
      setContactPersonOptions(newContactOptions);
      
      // Clear contact person when client changes or if current selection is invalid
      if (client) {
        setContactPerson((prev) => {
          const isValid = newContactOptions.some(cp => cp.value === prev);
          return isValid ? prev : "";
        });
      } else {
        setContactPerson("");
      }
    };
    const unsub = onMasterDataChange(update);
    update();
    return unsub;
  }, [client]);

  const handleCreate = async () => {
    const missing: string[] = [];
    if (!epicTitle.trim()) missing.push("Epic Title");
    if (!description.trim()) missing.push("Description");
    if (!product) missing.push("Product");
    if (!priority) missing.push("Priority");
    if (!startDate) missing.push("Start Date");
    if (!dueDate) missing.push("Due Date");
    if (estimatedHours == null) missing.push("Estimated Hours");
    if (!client) missing.push("Client");
    if (!contactPerson) missing.push("Contact Person");

    if (missing.length) {
      if (missing.length === 8) {
        toast.error("Please fill all the required fields");
        return;
      }
      missing.forEach((m, i) => setTimeout(() => toast.error(`${m} is required`), i * 120));
      return;
    }

    if (startDate && startDate.isBefore(dayjs(), 'day')) {
      toast.error("Start date cannot be before today");
      return;
    }

    if (dueDate && startDate && dueDate.isBefore(startDate, 'day')) {
      toast.error("Due date cannot be before start date");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("epic_title", epicTitle);
      form.append("epic_description", description);
      form.append("product_code", product);
      form.append("priority_code", String(priority));
      form.append("start_date", dayjs(startDate).format("DD-MM-YYYY"));
      form.append("due_date", dayjs(dueDate).format("DD-MM-YYYY"));
      form.append("estimated_hours", String(estimatedHours));
      if (estimatedDays != null) {
        form.append("estimated_days", String(estimatedDays));
      }
      form.append("is_billable", String(isBillable));
      form.append("company_code", client);
      form.append("contact_person_code", contactPerson);
      if (files.length) {
        for (const f of files) {
          form.append("attachments", f);
        }
      }
      try {
        const { getUserFromStorage } = await import("../../../../lib/auth/storage");
        const user = getUserFromStorage();
        if (user?.userCode) form.append("reporter", String(user.userCode).trim().toUpperCase());
      } catch {}

      await apiRequest("create_epic", "POST", form);
      toast.success("Epic created successfully");
      // Notify parent to refresh list
      if (onCreated) {
        try {
          onCreated();
        } catch {
          // Ignore errors
        }
      }
      // Reset form
      setEpicTitle("");
      setDescription("");
      setPriority("");
      setStartDate(null);
      setDueDate(null);
      setProduct("");
      setClient("");
      setContactPerson("");
      setEstimatedHours(null);
      setIsBillable(false);
      setFiles([]);
      setUploadList([]);
      onClose();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to create epic";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Simple custom toggle switch (not from antd)
  const ToggleSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`}
        />
      </button>
    );
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      width={800}
      footer={null}
      className="create-epic-modal"
      styles={{ body: { paddingTop: 0 } }}
    >
      <div className="text-[13px] max-h-[70vh] overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
          {/* Epic Title */}
          <div className="md:col-span-2">
            <label className={labelCls}>Epic Title{required}</label>
            <Input
              placeholder="Enter epic title"
              size="small"
              value={epicTitle}
              onChange={(e) => setEpicTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className={labelCls}>Description{required}</label>
            <Input.TextArea
              placeholder="Describe the epic..."
              rows={4}
              className="text-[13px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Priority */}
          <div>
            <label className={labelCls}>Priority{required}</label>
            <Select
              placeholder="Select priority"
              size="small"
              className="w-full"
              value={priority || undefined}
              onChange={setPriority}
              options={priorityOptions}
            />
          </div>

          {/* Product */}
          <div>
            <label className={labelCls}>Product{required}</label>
            <Select
              placeholder="Select product"
              size="small"
              className="w-full"
              value={product || undefined}
              onChange={setProduct}
              options={productOptions}
            />
          </div>

          {/* Client */}
          <div>
            <label className={labelCls}>Client{required}</label>
            <Select
              showSearch
              placeholder="Select client"
              size="small"
              className="w-full"
              value={client || undefined}
              onChange={setClient}
              options={clientOptions}
              filterOption={(input, option) => 
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>

          {/* Contact Person */}
          <div>
            <label className={labelCls}>Contact Person{required}</label>
            <Select
              showSearch
              placeholder={client ? "Select contact person" : "Select client first"}
              size="small"
              className="w-full"
              value={contactPerson || undefined}
              onChange={setContactPerson}
              options={contactPersonOptions}
              disabled={!client}
              filterOption={(input, option) => 
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>

          {/* Start Date */}
          <div>
            <label className={labelCls}>Start Date{required}</label>
            <DatePicker
              placeholder="Select start date"
              size="small"
              className="w-full"
              format="DD-MM-YYYY"
              value={startDate}
              onChange={setStartDate}
              suffixIcon={<CalendarOutlined className="text-gray-400" />}
              disabledDate={(current) => {
                // Cannot select dates before today
                if (current && current < dayjs().startOf('day')) return true;
                if (dueDate) return current && current > dueDate.endOf('day');
                return false;
              }}
            />
          </div>

          {/* Due Date */}
          <div>
            <label className={labelCls}>Due Date{required}</label>
            <DatePicker
              placeholder="Select due date"
              size="small"
              className="w-full"
              format="DD-MM-YYYY"
              value={dueDate}
              onChange={setDueDate}
              suffixIcon={<CalendarOutlined className="text-gray-400" />}
              disabledDate={(current) => {
                if (startDate) return current && current < startDate.startOf('day');
                return false;
              }}
            />
            {startDate && estimatedDays != null && estimatedDays > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                Auto-calculated from start date ({startDate.format('DD-MM-YYYY')}) + {estimatedDays} working days (skips weekends)
              </div>
            )}
          </div>

          {/* Estimated Hours */}
          <div>
            <label className={labelCls}>Estimated Hours{required}</label>
            <InputNumber
              placeholder="0"
              size="small"
              min={0}
              step={0.5}
              className="w-full"
              value={estimatedHours ?? undefined}
              onChange={(v) => {
                const n = Number(v);
                setEstimatedHours(Number.isFinite(n) ? n : 0);
              }}
              onKeyDown={handleNumberKeyDown}
            />
          </div>

          {/* Estimated Days (calculated from estimated hours) */}
          <div>
            <label className={labelCls}>Estimated Days</label>
            <InputNumber
              placeholder="0"
              size="small"
              className="w-full"
              addonAfter={<CalendarOutlined className="text-gray-400" />}
              value={estimatedDays ?? undefined}
              precision={2}
              disabled
              style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
            />
            <div className="text-xs text-gray-500 mt-1">
              {estimatedDays != null 
                ? `Based on ${estimatedHours} hours (8 hours = 1 working day)`
                : 'Enter estimated hours to calculate days'}
            </div>
          </div>

          {/* Reporter and Billable (same row) */}
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Reporter{required}</label>
              <Input value={reporterName} placeholder="Reporter" size="small" disabled />
            </div>
            <div className="flex items-end">
              <div>
                <label className={labelCls}>Billable</label>
                <div className="flex items-center gap-3">
                  <ToggleSwitch checked={isBillable} onChange={setIsBillable} />
                  <span className="text-xs text-gray-600">Is billable</span>
                </div>
              </div>
            </div>
          </div>

          {/* Attachments */}
          <div className="md:col-span-2">
            <label className={labelCls}>Attachments</label>
            <div className="border border-dashed rounded p-3 bg-gray-50">
              <Upload.Dragger
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt"
                beforeUpload={(file) => {
                  setFiles((prev) => [...prev, file as File]);
                  const fileWithUid = file as File & { uid?: string };
                  setUploadList((prev) => [
                    ...prev,
                    { uid: fileWithUid.uid || `${Date.now()}-${file.name}`, name: file.name, size: file.size, type: file.type, status: 'done' as const, originFileObj: file },
                  ]);
                  return false;
                }}
                onRemove={(file) => {
                  setUploadList((prev) => prev.filter((f) => f.uid !== file.uid));
                  setFiles((prev) => prev.filter((f) => f.name !== file.name || f.size !== (file.size || 0)));
                }}
                fileList={uploadList}
                height={120}
                showUploadList={{ showRemoveIcon: true }}
              >
                <div className="text-center text-xs text-gray-600">
                  <p>Drag and drop files here or click to browse</p>
                  <p className="mt-1 text-[11px] text-gray-500">Supported: pdf, images, docs, sheets, txt</p>
                </div>
              </Upload.Dragger>
              {uploadList.length > 0 && (
                <div className="mt-2 flex items-center justify-between text-[11px] text-gray-600">
                  <span>{uploadList.length} file(s) selected</span>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => { setUploadList([]); setFiles([]); }}
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating..." : "Create Epic"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CreateEpicModal;

