"use client";

import { useState, useEffect, useCallback } from "react";
import { Select, Table, Tag, Spin } from "antd";
import { exportLeaveCsv } from "@/app/lib/exporters/leave";
import { getAllEmployeeOptions, onMasterDataChange } from "@/app/lib/masterData";
import { apiRequest } from "@/app/lib/api";
import dayjs from "dayjs";

type LeaveStatus = "Pending" | "Approved" | "Rejected";

interface LeaveRow {
  key: string;
  fromDate: string; // DD-MM-YYYY
  toDate: string;   // DD-MM-YYYY
  type: string;
  days: number;
  status: LeaveStatus;
  reason: string;
  approver?: string;
}

interface LeaveApiResponse {
  success_flag: boolean;
  message: string;
  status_code: number;
  status_message: string;
  data: {
    entries: Array<{
      leave_application_id: number;
      from_date: string;
      to_date: string;
      duration_days: number;
      leave_type_name: string;
      approval_status: string;
      reason: string;
      approved_by_name?: string;
      rejected_by_name?: string;
    }>;
    pagination?: {
      total_count: number;
      limit: number;
      offset: number;
      has_more: boolean;
    };
  };
}

export default function HRLeaveRegistryPage() {
  const [member, setMember] = useState<string | undefined>(undefined);
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [data, setData] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load employee options from master data
  useEffect(() => {
    const updateOptions = () => setEmployeeOptions(getAllEmployeeOptions());
    updateOptions();
    const cleanup = onMasterDataChange(updateOptions);
    return cleanup;
  }, []);

  // Map API status to LeaveStatus
  const mapStatus = (apiStatus: string): LeaveStatus => {
    const upper = String(apiStatus || "").toUpperCase();
    if (upper === "APPROVED") return "Approved";
    if (upper === "REJECTED") return "Rejected";
    return "Pending";
  };

  // Fetch leave data for selected employee
  const fetchLeaveData = useCallback(async (userCode: string) => {
    if (!userCode) {
      setData([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const endpoint = "get_leave_applications";
      const response = await apiRequest<LeaveApiResponse>(
        endpoint,
        "GET",
        undefined,
        undefined,
        { "x-user-code": userCode }
      );

      if (response?.success_flag && Array.isArray(response.data?.entries)) {
        const mapped: LeaveRow[] = response.data.entries.map((entry) => ({
          key: String(entry.leave_application_id),
          fromDate: entry.from_date ? dayjs(entry.from_date).format("DD-MM-YYYY") : "",
          toDate: entry.to_date ? dayjs(entry.to_date).format("DD-MM-YYYY") : "",
          type: entry.leave_type_name || "Leave",
          days: entry.duration_days || 0,
          status: mapStatus(entry.approval_status),
          reason: entry.reason || "",
          approver: entry.approved_by_name || entry.rejected_by_name || undefined,
        }));
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (err: any) {
      console.error("Error fetching leave data:", err);
      setError(err?.message || "Failed to fetch leave data");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch data when member changes
  useEffect(() => {
    if (member) {
      fetchLeaveData(member);
    } else {
      setData([]);
    }
  }, [member, fetchLeaveData]);

  const columns = [
    { title: "From Date", dataIndex: "fromDate", key: "fromDate", render: (d: string) => <span className="text-xs">{d}</span> },
    { title: "To Date", dataIndex: "toDate", key: "toDate", render: (d: string) => <span className="text-xs">{d}</span> },
    { title: "Type", dataIndex: "type", key: "type", render: (t: string) => <span className="text-xs">{t}</span> },
    { title: "Days", dataIndex: "days", key: "days", render: (n: number) => <span className="text-xs">{n}</span> },
    { title: "Status", dataIndex: "status", key: "status", render: (s: LeaveStatus) => {
        const color = s === "Approved" ? "green" : s === "Rejected" ? "red" : "orange";
        return <Tag color={color} className="text-xs rounded-full">{s}</Tag>;
      }
    },
    { title: "Reason", dataIndex: "reason", key: "reason", render: (r: string) => <span className="text-xs text-gray-700">{r}</span> },
    { title: "Approver", dataIndex: "approver", key: "approver", render: (a?: string) => <span className="text-xs">{a || "-"}</span> },
  ];

  const handleExport = () => {
    if (!member) return;
    const employeeName = employeeOptions.find(opt => opt.value === member)?.label || member;
    exportLeaveCsv(`${employeeName}-leave-registry`, data as any);
  };

  return (
    <div className="p-3 text-xs">
      <div className="bg-white p-2 mb-3 rounded">
        <div className="flex items-center gap-2">
          <label className="text-[12px] text-gray-700">Team Member</label>
          <Select
            value={member}
            onChange={setMember}
            placeholder="Select employee"
            className="w-56"
            size="small"
            allowClear
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
            }
            options={employeeOptions}
            notFoundContent={employeeOptions.length === 0 ? "Loading employees..." : "No employees found"}
          />
          <button
            onClick={handleExport}
            disabled={!member || data.length === 0 || loading}
            className={`ml-auto px-3 py-1 rounded text-[11px] transition-colors ${member && data.length && !loading ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-3 text-xs">
          {error}
        </div>
      )}

      {member ? (
        <div key={member} className="bg-white rounded-lg overflow-hidden tab-switch-anim">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spin size="small" />
              <span className="ml-2 text-xs text-gray-600">Loading leave data...</span>
            </div>
          ) : data.length > 0 ? (
            <Table
              columns={columns}
              dataSource={data}
              pagination={{ pageSize: 8, showSizeChanger: false }}
              size="small"
              className="text-xs tasks-table"
            />
          ) : (
            <div className="text-sm text-gray-600 p-4 text-center">
              No leave applications found for this employee.
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-gray-600">Please select a team member to view leave registry.</div>
      )}
    </div>
  );
}
