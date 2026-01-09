"use client";

import { useState, useEffect } from "react";
import { Table, Tag, Modal, Form, Input, Select, Upload, Switch, Spin } from "antd";
import { apiRequest } from "@/app/lib/api";
import { getProductOptions } from "@/app/lib/masterData";
import { getUserFromStorage } from "@/app/lib/auth/storage";

type ActivityApiResponse = {
  activity_id: number;
  activity_title: string;
  activity_description: string | null;
  product_code: string;
  product_name: string;
  is_billable: boolean;
  attachments: Array<{
    id: number;
    file_name: string;
    file_path: string;
    file_url: string;
    file_type: string;
    file_size: string;
    purpose: string;
    created_by: string;
    created_at: string;
  }>;
  attachments_count: number;
  created_by: string;
  created_at: string;
  [key: string]: any;
};

type OutdoorRow = {
  id: number;
  title: string;
  description: string;
  product: string;
  attachments: { name: string; url: string }[];
  isBillable: boolean;
};

const columns = [
  {
    title: "ID",
    dataIndex: "id",
    key: "id",
    render: (id: number) => (
      <span className="text-xs text-gray-800">{`OT-${id}`}</span>
    ),
  },
  { title: "Title", dataIndex: "title", key: "title", render: (v: string) => <span className="text-xs">{v}</span> },
  { title: "Description", dataIndex: "description", key: "description", render: (v: string) => <span className="text-xs text-gray-700">{v}</span> },
  { title: "Product", dataIndex: "product", key: "product", render: (v: string) => <span className="text-xs">{v}</span> },
  {
    title: "Attachments",
    dataIndex: "attachments",
    key: "attachments",
    render: (files: { name: string; url: string }[]) =>
      Array.isArray(files) && files.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {files.map((f) => (
            <a
              key={f.name}
              href={f.url}
              className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline"
            >
              {f.name}
            </a>
          ))}
        </div>
      ) : (
        <span className="text-xs text-gray-400">-</span>
      ),
  },
  {
    title: "Is Billable",
    dataIndex: "isBillable",
    key: "isBillable",
    render: (b: boolean) => (
      <Tag color={b ? "green" : "red"} className="text-xs rounded-full">
        {b ? "Yes" : "No"}
      </Tag>
    ),
  },
];

export default function AdminOutdoorThingsPage() {
  const [data, setData] = useState<OutdoorRow[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchActivities = async () => {
    try {
      setFetching(true);
      const user = getUserFromStorage();
      const filters: Record<string, string> = {};
      
      // Optionally filter by created_by if needed
      // if (user?.userCode) {
      //   filters.created_by = user.userCode;
      // }

      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const endpoint = `get_outdoor_activities${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiRequest<{
        success_flag: boolean;
        data: ActivityApiResponse[];
        total_count: number;
      }>(endpoint, 'GET');

      if (response.success_flag && Array.isArray(response.data)) {
        const mappedData: OutdoorRow[] = response.data.map((activity) => ({
          id: activity.activity_id,
          title: activity.activity_title,
          description: activity.activity_description || '',
          product: activity.product_name || activity.product_code,
          attachments: Array.isArray(activity.attachments)
            ? activity.attachments.map((att) => ({
                name: att.file_name,
                url: att.file_url || '#',
              }))
            : [],
          isBillable: activity.is_billable,
        }));
        setData(mappedData);
      }
    } catch (error: any) {
      console.error('Error fetching activities:', error);
      showToast('Failed to load activities', 'error');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const handleAddActivity = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Prepare FormData for the API request
      const formData = new FormData();
      
      // Required fields
      formData.append('title', values.title);
      
      // Optional fields
      if (values.product) {
        formData.append('product_code', values.product); // product is already product_code from Select
      }
      if (values.description) {
        formData.append('description', values.description);
      }
      
      formData.append('is_billable', values.isBillable ? 'true' : 'false');

      // Handle attachments - append files to FormData
      const attachmentsList = values.attachments || [];
      if (Array.isArray(attachmentsList) && attachmentsList.length > 0) {
        attachmentsList.forEach((file: any) => {
          const fileObj = file.originFileObj || file;
          if (fileObj instanceof File) {
            formData.append('attachments', fileObj);
          }
        });
      }

      // Call the create_activity API
      const response = await apiRequest<{ 
        Status_Flag: boolean; 
        Status_Description: string; 
        Status_Code: number;
        Status_Message: string;
        Response_Data?: any;
      }>(
        'create_activity',
        'POST',
        formData
      );

      if (response.Status_Flag) {
        // Close modal and reset form immediately
        setIsModalOpen(false);
        form.resetFields();
        setLoading(false);
        
        // Show success message
        showToast(response.Status_Description || 'Activity created successfully', 'success');
        
        // Refresh activities list (don't await to avoid blocking)
        fetchActivities().catch((err) => {
          console.error('Error refreshing activities:', err);
          showToast('Activity created but failed to refresh list', 'error');
        });
      } else {
        showToast(response.Status_Description || 'Failed to create activity', 'error');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Error creating activity:', error);
      const errorMessage = error?.message || error?.detail || 'Failed to create activity';
      showToast(errorMessage, 'error');
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-md shadow-lg transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-white hover:text-gray-200"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-xl font-semibold mb-1">Activities</h1>
        <p className="text-sm text-gray-600">
          This section shows outdoor activities and visits planned and tracked for your team.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">Outdoor Activities</h2>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <span className="text-xs leading-none">+</span>
            <span>Add Activity</span>
          </button>
        </div>
        <Spin spinning={fetching}>
          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            size="small"
            pagination={false}
            className="text-xs"
          />
        </Spin>
      </div>

      <Modal
        title="Add Activity"
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        destroyOnHidden
        afterClose={() => {
          form.resetFields();
        }}
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item
            label="Title"
            name="title"
            rules={[{ required: true, message: "Please enter a title" }]}
          >
            <Input placeholder="Enter activity title" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} placeholder="Enter description" />
          </Form.Item>

          <Form.Item
            label="Product"
            name="product"
          >
            <Select
              placeholder="Select product"
              options={getProductOptions()}
              allowClear
            />
          </Form.Item>

          <Form.Item
            label="Attachments"
            name="attachments"
            valuePropName="fileList"
            getValueFromEvent={(e) => e?.fileList}
          >
            <Upload beforeUpload={() => false} multiple>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
              >
                Upload
              </button>
            </Upload>
          </Form.Item>

          <Form.Item
            label="Is Billable"
            name="isBillable"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch size="small" />
          </Form.Item>

          <Form.Item>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  form.resetFields();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddActivity}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
