"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Select, Card, Tag, Empty } from "antd";
import { UserOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { getAllEmployeeOptions } from "@/app/lib/masterData";
import { apiRequest } from "@/app/lib/api";
import EnterTimesheetTab from "../../employee/timesheet/EnterTimesheetTab";
import ApplyLeaveTab from "../../employee/timesheet/ApplyLeaveTab";
import { Drawer } from "antd";
import { exportTeamTimesheetToExcel } from "@/app/lib/exporters/teamTimesheet";

interface TimeEntry {
  id: string;
  title: string;
  hours?: number;
  mode?: string;
  type: "timesheet" | "leave";
  status: "Draft" | "Approved" | "Rejected";
  leaveType?: string;
  fromDate?: string;
  toDate?: string;
  date: string;
  rawData?: any;
}

interface LeaveStatus {
  totalLeaves: number;
  leavesTaken: number;
  leavesRemaining: number;
  leavesThisYear: Array<{
    type: string;
    fromDate: string;
    toDate: string;
    days: number;
    status: "Draft" | "Approved" | "Rejected";
  }>;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "Draft": return "blue";
    case "Approved": return "green";
    case "Rejected": return "red";
    case "Pending": return "orange";
    default: return "gray";
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case "timesheet": return "blue";
    case "leave": return "purple";
    default: return "gray";
  }
};

export default function HRTeamMemberTimesheetPage() {
  const [selectedEmployee, setSelectedEmployee] = useState<string | undefined>(undefined);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);

  // Get all employees from master data
  const employeeOptions = useMemo(() => {
    return getAllEmployeeOptions();
  }, []);

  const employeeName = employeeOptions.find(emp => emp.value === selectedEmployee)?.label || "";

  // Get last 7 days for entries display
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  // Fetch timesheet and leave entries for selected employee (last 7 days)
  const fetchEmployeeTimesheet = useCallback(async () => {
    if (!selectedEmployee) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const today = dayjs();
      const startDate = today.subtract(6, 'days'); // Last 7 days
      const endDate = today;

      // Map API response to TimeEntry[]
      const statusMap: Record<string, "Draft" | "Approved" | "Rejected"> = {
        DRAFT: "Draft",
        APPROVED: "Approved",
        REJECTED: "Rejected",
      };

      const allEntries: TimeEntry[] = [];

      // Fetch timesheet entries
      const timesheetParams = new URLSearchParams();
      timesheetParams.append('entry_date_from', startDate.format('YYYY-MM-DD'));
      timesheetParams.append('entry_date_to', endDate.format('YYYY-MM-DD'));
      const timesheetEndpoint = `get_timesheet_entries?${timesheetParams.toString()}`;
      const timesheetResp = await apiRequest<any>(timesheetEndpoint, 'GET', undefined, undefined, { 'x-user-code': selectedEmployee });
      const timesheetEntries: any[] = Array.isArray(timesheetResp?.data?.entries) ? timesheetResp.data.entries : [];
      const mappedTimesheet: TimeEntry[] = timesheetEntries.map((e) => {
        const entryDate = e.entry_date ? dayjs(e.entry_date).format('YYYY-MM-DD') : '';
        const rawStatus = String(e.latest_approval_status || e.approval_status || '').toUpperCase();
        
        // Determine if this is a ticket entry (has ticket_code but no task_code or activity_code)
        const isTicketEntry = e.ticket_code && (!e.task_code || e.task_code === 0) && (!e.activity_code || e.activity_code === 0);
        // Determine if this is an activity entry (has activity_code but no task_code)
        const isActivityEntry = e.activity_code && (!e.task_code || e.task_code === 0) && !isTicketEntry;
        
        // Get title: prefer activity_title for activity entries, then ticket_title for ticket entries, then task_title, then epic_title
        const title = isActivityEntry 
          ? (e.activity_title || "Untitled Activity")
          : isTicketEntry
          ? (e.ticket_title || "Untitled Ticket")
          : (e.task_title || e.epic_title || "Untitled Task");
        
        return {
          id: String(e.timesheet_entry_id),
          title: title,
          hours: typeof e.total_hours === 'string' ? parseFloat(e.total_hours) : (e.total_hours || (typeof e.actual_hours_worked === 'string' ? parseFloat(e.actual_hours_worked) : (e.actual_hours_worked || 0))),
          mode: e.work_location_name || e.work_location_code || "",
          type: "timesheet",
          status: statusMap[rawStatus] || "Draft",
          date: entryDate,
          rawData: e,
        };
      });
      allEntries.push(...mappedTimesheet);

      // Fetch leave applications
      const leaveParams = new URLSearchParams();
      leaveParams.append('from_date_from', startDate.format('YYYY-MM-DD'));
      leaveParams.append('to_date_to', endDate.format('YYYY-MM-DD'));
      const leaveEndpoint = `get_leave_applications?${leaveParams.toString()}`;
      const leaveResp = await apiRequest<any>(leaveEndpoint, 'GET', undefined, undefined, { 'x-user-code': selectedEmployee });
      const leaveEntries: any[] = Array.isArray(leaveResp?.data?.entries) ? leaveResp.data.entries : [];
      const mappedLeave: TimeEntry[] = leaveEntries.flatMap((e) => {
        const from = e.from_date ? dayjs(e.from_date) : null;
        const to = e.to_date ? dayjs(e.to_date) : null;
        if (!from || !to) return [];
        const diff = to.diff(from, 'day');
        const perDay: TimeEntry[] = [];
        for (let i = 0; i <= diff; i++) {
          const d = from.add(i, 'day');
          const entryDate = d.format('YYYY-MM-DD');
          // Only include if within last 7 days
          if (d.isAfter(startDate.subtract(1, 'day')) && d.isBefore(endDate.add(1, 'day'))) {
            perDay.push({
              id: String(e.leave_application_id) + '-' + d.format('YYYYMMDD'),
              title: e.leave_type_name || e.leave_type_code || "Leave",
              type: "leave",
              status: statusMap[String(e.approval_status || '').toUpperCase()] || "Draft",
              leaveType: e.leave_type_name || e.leave_type_code,
              fromDate: e.from_date,
              toDate: e.to_date,
              date: entryDate,
              rawData: e,
            });
          }
        }
        return perDay;
      });
      allEntries.push(...mappedLeave);

      setEntries(allEntries);
    } catch (err) {
      console.error('Failed to fetch employee timesheet:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [selectedEmployee]);

  // Trigger fetch when employee changes
  useEffect(() => {
    fetchEmployeeTimesheet();
  }, [fetchEmployeeTimesheet]);

  const entriesByDay = useMemo(() => {
    const grouped: Record<string, TimeEntry[]> = {};
    last7Days.forEach(day => {
      grouped[day] = entries.filter(entry => entry.date === day);
    });
    return grouped;
  }, [entries, last7Days]);

  // Leave status - fetch from backend leave applications
  const [leaveStatus, setLeaveStatus] = useState<LeaveStatus>({
    totalLeaves: 15,
    leavesTaken: 0,
    leavesRemaining: 15,
    leavesThisYear: [],
  });

  const fetchLeaveStatus = useCallback(async () => {
    if (!selectedEmployee) {
      setLeaveStatus({
        totalLeaves: 15,
        leavesTaken: 0,
        leavesRemaining: 15,
        leavesThisYear: [],
      });
      return;
    }
    try {
      const startOfYear = dayjs().startOf('year').format('YYYY-MM-DD');
      const endOfYear = dayjs().endOf('year').format('YYYY-MM-DD');
      const params = new URLSearchParams();
      params.append('from_date_from', startOfYear);
      params.append('to_date_to', endOfYear);
      params.append('approval_status', 'APPROVED');

      const endpoint = `get_leave_applications?${params.toString()}`;
      const resp = await apiRequest<any>(endpoint, 'GET', undefined, undefined, { 'x-user-code': selectedEmployee });
      const apiEntries: any[] = Array.isArray(resp?.data?.entries) ? resp.data.entries : [];

      // Sum days across approved leaves in the current year
      let daysTaken = 0;
      const history: LeaveStatus['leavesThisYear'] = [];
      apiEntries.forEach((e) => {
        const from = e.from_date ? dayjs(e.from_date) : null;
        const to = e.to_date ? dayjs(e.to_date) : null;
        if (!from || !to) return;
        const days = Math.max(1, to.diff(from, 'day') + 1);
        daysTaken += days;
        history.push({
          type: e.leave_type_name || e.leave_type_code || 'Leave',
          fromDate: e.from_date,
          toDate: e.to_date,
          days,
          status: 'Approved',
        });
      });

      const totalLeaves = 15; // annual allocation (can be moved to master data later)
      const remaining = Math.max(0, totalLeaves - daysTaken);

      setLeaveStatus({
        totalLeaves,
        leavesTaken: daysTaken,
        leavesRemaining: remaining,
        leavesThisYear: history,
      });
    } catch {
      // Keep previous values on error
    }
  }, [selectedEmployee]);

  useEffect(() => {
    fetchLeaveStatus();
  }, [fetchLeaveStatus]);

  const handleViewEntry = (entry: TimeEntry) => {
    setSelectedEntry(entry);
    setDrawerVisible(true);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6" style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Employee Selector - Enhanced UI */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 bg-blue-50 rounded-lg">
              <UserOutlined style={{ fontSize: '20px', color: '#3b82f6' }} />
            </div>
            <div className="flex-1">
              <label className="text-sm font-semibold text-gray-700 block mb-1">Select Team Member</label>
              <Select
                placeholder="Choose a team member to view their timesheet"
                value={selectedEmployee}
                onChange={setSelectedEmployee}
                options={employeeOptions}
                size="large"
                className="w-full sm:w-80"
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                notFoundContent={employeeOptions.length === 0 ? "No employees found" : "No matches"}
              />
            </div>
          </div>
        </div>
      </div>

      {!selectedEmployee && (
        <Card 
          className="shadow-sm border border-gray-200 bg-white" 
          styles={{ 
            body: { 
              padding: '60px 40px', 
              textAlign: 'center',
              backgroundColor: '#ffffff'
            } 
          }}
        >
          <Empty
            description={
              <div>
                <p className="text-gray-700 font-medium mb-2 text-base">No team member selected</p>
                <p className="text-sm text-gray-500">Please select a team member from the dropdown above to view their timesheet entries.</p>
              </div>
            }
          />
        </Card>
      )}

      {selectedEmployee && (
        <div className="space-y-4">
          {/* Timesheet Entries - Last 7 Days - Enhanced UI */}
          <Card
            title={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                  <span className="text-lg font-semibold text-gray-800">Timesheet & Leave Entries (Last 7 Days)</span>
                  <span className="text-sm font-medium text-gray-500">- {employeeName}</span>
                </div>
                {entries.length > 0 && (
                  <button
                    onClick={() => {
                      const filename = `team-member-timesheet-${employeeName}-${dayjs().format('YYYY-MM-DD')}`;
                      exportTeamTimesheetToExcel(filename, entries, employeeName);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium shadow-sm"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Download Excel
                  </button>
                )}
              </div>
            }
            className="shadow-md border border-gray-200 bg-white hover:shadow-lg transition-shadow duration-300"
            styles={{ 
              header: { 
                fontFamily: 'var(--font-poppins), Poppins, sans-serif', 
                padding: '20px 24px', 
                borderBottom: '2px solid #e5e7eb',
                backgroundColor: '#f9fafb'
              },
              body: { padding: '24px', fontFamily: 'var(--font-poppins), Poppins, sans-serif', backgroundColor: '#ffffff' } 
            }}
          >
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-gray-500 mt-4">Loading timesheet entries...</p>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-3 sm:gap-4 min-w-[700px] overflow-x-auto pb-2">
                {last7Days.map((day) => {
                  const dayEntries = entriesByDay[day] || [];
                  const dayLabel = dayjs(day).format("ddd, D MMM");
                  const isToday = dayjs(day).isSame(dayjs(), 'day');

                  return (
                    <div key={day} className={`border rounded-lg min-w-[100px] transition-all duration-200 ${isToday ? 'border-blue-400 shadow-md bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
                      {/* Day Header - Enhanced */}
                      <div className={`p-3 border-b ${isToday ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className={`text-xs font-semibold ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>{dayLabel}</div>
                      </div>

                      {/* Day Content - Enhanced */}
                      <div className="p-2.5 sm:p-3 min-h-[180px] space-y-2.5">
                        {dayEntries.length === 0 ? (
                          <div className="text-xs text-gray-400 text-center py-6 flex flex-col items-center justify-center">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-30 mb-2">
                              <circle cx="12" cy="12" r="10" stroke="#9ca3af" strokeWidth="2"/>
                              <path d="M12 6v6l4 2" stroke="#9ca3af" strokeWidth="2"/>
                            </svg>
                            <span>No entries</span>
                          </div>
                        ) : (
                          dayEntries.map((entry) => {
                            const getColorClass = (status: string, type: string) => {
                              if (status === "Draft") return "border-l-4 border-blue-500 bg-blue-50/30";
                              if (status === "Approved") return "border-l-4 border-green-500 bg-green-50/30";
                              if (status === "Rejected") return "border-l-4 border-red-500 bg-red-50/30";
                              if (type === "timesheet") return "border-l-4 border-blue-500 bg-blue-50/30";
                              return "border-l-4 border-purple-500 bg-purple-50/30";
                            };

                            const getStatusIcon = (status: string) => {
                              switch (status) {
                                case "Approved":
                                  return (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                                      <path d="M20 6L9 17l-5-5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  );
                                case "Rejected":
                                  return (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                                      <path d="M18 6L6 18M6 6l12 12" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  );
                                default:
                                  return (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                                      <circle cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="2"/>
                                      <path d="M12 6v6l4 2" stroke="#3b82f6" strokeWidth="2"/>
                                    </svg>
                                  );
                              }
                            };

                            return (
                              <div
                                key={entry.id}
                                onClick={() => handleViewEntry(entry)}
                                className={`group relative bg-white border rounded-lg p-3 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 overflow-hidden ${getColorClass(entry.status, entry.type)}`}
                              >
                                {/* Status indicator dot */}
                                <div className="absolute top-2 right-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                  {getStatusIcon(entry.status)}
                                </div>
                                
                                {/* Main content */}
                                <div className="pr-6">
                                  <div className="flex items-start justify-between gap-2 mb-2 min-w-0">
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-xs font-semibold text-gray-900 truncate leading-tight">
                                        {entry.type === "timesheet" ? entry.title : entry.leaveType}
                                      </h4>
                                    </div>
                                  </div>
                                  
                                  {/* Tags row */}
                                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                      entry.type === "timesheet" 
                                        ? "bg-blue-100 text-blue-700" 
                                        : "bg-purple-100 text-purple-700"
                                    }`}>
                                      {entry.type === "timesheet" ? "TS" : "L"}
                                    </span>
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                      entry.status === "Approved" 
                                        ? "bg-green-100 text-green-700"
                                        : entry.status === "Rejected"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-gray-100 text-gray-700"
                                    }`}>
                                      {entry.status}
                                    </span>
                                  </div>
                                  
                                  {/* Details row */}
                                  {entry.type === "timesheet" && entry.hours !== undefined && (
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                      <div className="flex items-center gap-1">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-400">
                                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                                          <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2"/>
                                        </svg>
                                        <span className="font-medium">{entry.hours}h</span>
                                      </div>
                                      {entry.mode && (
                                        <>
                                          <span className="text-gray-300">|</span>
                                          <div className="flex items-center gap-1">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-400">
                                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="2"/>
                                              <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2"/>
                                            </svg>
                                            <span>{entry.mode}</span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}
                                  {entry.type === "leave" && entry.fromDate && entry.toDate && (
                                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-400">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                                        <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/>
                                        <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/>
                                        <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
                                      </svg>
                                      <span>{dayjs(entry.fromDate).format("DD MMM")} - {dayjs(entry.toDate).format("DD MMM")}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Leave Status Summary (moved below) - Commented out for Super Admin */}
          {/* <Card
            title={<span className="text-base font-semibold text-gray-800">Leave Status - {employeeName}</span>}
            className="shadow-sm border border-gray-200"
            styles={{ 
              header: { 
                fontFamily: 'var(--font-poppins), Poppins, sans-serif', 
                padding: '16px 20px', 
                borderBottom: '1px solid #e5e7eb'
              },
              body: { padding: '20px', fontFamily: 'var(--font-poppins), Poppins, sans-serif' } 
            }}
          >
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-semibold text-blue-600">{leaveStatus.totalLeaves}</div>
                <div className="text-sm text-gray-600 mt-1">Total Leaves</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-semibold text-green-600">{leaveStatus.leavesTaken}</div>
                <div className="text-sm text-gray-600 mt-1">Leaves Taken</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-semibold text-orange-600">{leaveStatus.leavesRemaining}</div>
                <div className="text-sm text-gray-600 mt-1">Leaves Remaining</div>
              </div>
            </div>

            {leaveStatus.leavesThisYear.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Leave History (This Year)</div>
                <div className="space-y-2">
                  {leaveStatus.leavesThisYear.map((leave, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{leave.type}</div>
                        <div className="text-xs text-gray-600">
                          {dayjs(leave.fromDate).format("DD/MM/YYYY")} - {dayjs(leave.toDate).format("DD/MM/YYYY")} ({leave.days} day{leave.days > 1 ? 's' : ''})
                        </div>
                      </div>
                      <Tag color={getStatusColor(leave.status)} className="text-xs">
                        {leave.status}
                      </Tag>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card> */}
        </div>
      )}

      {/* Drawer for viewing entries (view-only) */}
      <Drawer
        title={selectedEntry ? `View ${selectedEntry.type === "timesheet" ? "Timesheet" : "Leave"} Entry - ${employeeName}` : "View Entry"}
        placement="right"
        onClose={() => {
          setDrawerVisible(false);
          setSelectedEntry(null);
        }}
        open={drawerVisible}
        width={500}
        className="timesheet-drawer"
        styles={{
          body: { paddingTop: 0 }
        }}
      >
        {selectedEntry && (
          selectedEntry.type === "timesheet" ? (
            <EnterTimesheetTab
              onClose={() => {}}
              mode="view"
              entryData={selectedEntry.rawData || selectedEntry}
              hideActionButtons={true}
            />
          ) : (
            <ApplyLeaveTab
              onClose={() => {}}
              mode="view"
              entryData={selectedEntry.rawData || selectedEntry}
              hideActionButtons={true}
            />
          )
        )}
      </Drawer>
    </div>
  );
}
