"use client";

import { useState, useEffect } from "react";
import { Table, Tag, Spin, message } from "antd";
import { apiRequest } from "@/app/lib/api";
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

export default function HrOutdoorThingsPage() {
  const [data, setData] = useState<OutdoorRow[]>([]);
  const [fetching, setFetching] = useState(true);

  const fetchActivities = async () => {
    try {
      setFetching(true);
      // HR can see all activities or filter by their team if needed
      const queryParams = new URLSearchParams();
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
      message.error('Failed to load activities');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Activities</h1>
        <p className="text-sm text-gray-600">
          This section shows HR-related outdoor activities and visits for your team.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">Outdoor Activities</h2>
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
    </div>
  );
}
