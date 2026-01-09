"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Drawer, Select, Tag, Radio, DatePicker, Modal } from "antd";
import dayjs from "dayjs";
import { toast } from "react-hot-toast";
import EnterTimesheetTab from "../../employee/timesheet/EnterTimesheetTab";
import ApplyLeaveTab from "../../employee/timesheet/ApplyLeaveTab";
import { getAllEmployeeOptions } from "@/app/lib/masterData";
import { apiRequest } from "@/app/lib/api";
import { exportTeamTimesheetToExcel, exportTeamTimesheetToPDF } from "@/app/lib/exporters/teamTimesheet";
import { isSuperApprover } from "@/app/lib/auth/client";

interface TimesheetEntry {
  id: string;
  employee: string;
  date: string;
  type: "timesheet" | "leave";
  status: "Draft" | "Pending" | "Approved" | "Rejected";
  submittedAt: string;
  rejectionReason?: string;
  // Timesheet fields
  task?: string;
  subtask?: string;
  hours?: number;
  mode?: string;
  description?: string;
  // Leave fields
  leaveType?: string;
  fromDate?: string;
  toDate?: string;
  // Store full API response for view mode
  rawData?: any;
}

export default function SuperAdminTeamTimesheetPage() {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimesheetEntry | null>(null);
  const [allEntriesModalVisible, setAllEntriesModalVisible] = useState(false);
  const [selectedDayEntries, setSelectedDayEntries] = useState<{ date: dayjs.Dayjs; entries: TimesheetEntry[] } | null>(null);
  const [teamMember, setTeamMember] = useState<string>(""); // stores user_code
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  // New filter states
  const [filterMode, setFilterMode] = useState<"week" | "month">("week");
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs | null>(dayjs());
  const [selectedWeek, setSelectedWeek] = useState<number>(1); // 1-4 weeks in a month
  
  // Rejection modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  // Check if user is super approver
  const canApprove = isSuperApprover();

  // API-driven data
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);

  // Get weeks in a month (1-4 or 5)
  const getWeeksInMonth = (month: dayjs.Dayjs) => {
    const startOfMonth = month.startOf('month');
    const endOfMonth = month.endOf('month');
    const firstMonday = startOfMonth.day() === 0 ? startOfMonth.add(1, 'day') : startOfMonth.day() === 1 ? startOfMonth : startOfMonth.add(8 - startOfMonth.day(), 'day');
    const weeks: Array<{ week: number; start: dayjs.Dayjs; end: dayjs.Dayjs }> = [];
    let currentWeekStart = firstMonday;
    let weekNum = 1;
    
    while (currentWeekStart.isBefore(endOfMonth) || currentWeekStart.isSame(endOfMonth, 'month')) {
      const weekEnd = currentWeekStart.add(6, 'days');
      if (currentWeekStart.isSame(month, 'month') || weekEnd.isSame(month, 'month')) {
        weeks.push({
          week: weekNum,
          start: currentWeekStart,
          end: weekEnd,
        });
        weekNum++;
      }
      currentWeekStart = currentWeekStart.add(7, 'days');
      if (weekNum > 5) break; // Safety limit
    }
    
    return weeks;
  };

  // Get week dates based on filter mode
  const getWeekDates = () => {
    let startOfWeek: dayjs.Dayjs;
    let endOfWeek: dayjs.Dayjs;
    
    if (filterMode === "month" && selectedMonth) {
      const weeks = getWeeksInMonth(selectedMonth);
      const selectedWeekData = weeks[selectedWeek - 1];
      if (selectedWeekData) {
        startOfWeek = selectedWeekData.start;
        endOfWeek = selectedWeekData.end;
      } else {
        startOfWeek = selectedMonth.startOf('month').startOf('week').add(1, 'day');
        endOfWeek = startOfWeek.add(6, 'days');
      }
    } else {
      const base = dayjs().add(weekOffset * 7, 'day');
      startOfWeek = base.startOf('week').add(1, 'day');
      endOfWeek = startOfWeek.add(6, 'days');
    }
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = startOfWeek.add(i, 'days');
      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      days.push({
        key: dayNames[i],
        label: dayNames[i].charAt(0).toUpperCase() + dayNames[i].slice(1),
        date: date,
        dateStr: date.format('DD-MM-YYYY'),
      });
    }
    return days;
  };

  const filteredEntries = entries.filter((entry) => {
    if (statusFilter !== "all" && entry.status !== statusFilter) return false;
    
    return true;
  });

  // Group entries by day of week (for weekly view)
  const entriesByDay = useMemo(() => {
    const grouped: Record<string, TimesheetEntry[]> = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };

    filteredEntries.forEach((entry) => {
      const dayOfWeek = dayjs(entry.date).format("dddd").toLowerCase();
      const dayKey = dayOfWeek as keyof typeof grouped;
      if (dayKey in grouped) {
        grouped[dayKey].push(entry);
      }
    });

    return grouped;
  }, [filteredEntries]);

  // Group entries by date (for calendar view)
  const entriesByDate = useMemo(() => {
    const grouped: Record<string, TimesheetEntry[]> = {};
    filteredEntries.forEach((entry) => {
      const dateKey = dayjs(entry.date).format('YYYY-MM-DD');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(entry);
    });
    return grouped;
  }, [filteredEntries]);

  // Get calendar days for month view
  const getCalendarDays = useMemo(() => {
    if (filterMode !== "month" || !selectedMonth) return [];
    
    const month = selectedMonth;
    const startOfMonth = month.startOf('month');
    const endOfMonth = month.endOf('month');
    const startOfCalendar = startOfMonth.startOf('week'); // Start from Sunday
    const endOfCalendar = endOfMonth.endOf('week'); // End on Saturday
    
    const days: Array<{
      date: dayjs.Dayjs;
      dateStr: string;
      isCurrentMonth: boolean;
      dayNumber: number;
      dayName: string;
    }> = [];
    
    let current = startOfCalendar;
    while (current.isBefore(endOfCalendar) || current.isSame(endOfCalendar, 'day')) {
      days.push({
        date: current,
        dateStr: current.format('YYYY-MM-DD'),
        isCurrentMonth: current.isSame(month, 'month'),
        dayNumber: current.date(),
        dayName: current.format('ddd'),
      });
      current = current.add(1, 'day');
    }
    
    return days;
  }, [filterMode, selectedMonth]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Draft": return "blue";
      case "Pending": return "orange";
      case "Approved": return "green";
      case "Rejected": return "red";
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

  const getColorClass = (status: string, type: string) => {
    if (status === "Draft") return "border-l-4 border-blue-500 bg-blue-50/30";
    if (status === "Pending") return "border-l-4 border-orange-500 bg-orange-50/30";
    if (status === "Approved") return "border-l-4 border-green-500 bg-green-50/30";
    if (status === "Rejected") return "border-l-4 border-red-500 bg-red-50/30";
    if (type === "timesheet") return "border-l-4 border-blue-500 bg-blue-50/30";
    return "border-l-4 border-purple-500 bg-purple-50/30";
  };

  // Helper function for calendar entry styling based on status and type
  const getCalendarEntryClass = (status: string, type: string) => {
    const baseClass = "text-[9px] p-1 rounded cursor-pointer hover:opacity-80 transition-opacity truncate border-l-2";
    if (status === "Approved") {
      return type === "timesheet" 
        ? `${baseClass} border-l-green-500 bg-green-50 text-green-800`
        : `${baseClass} border-l-green-500 bg-green-50 text-green-800`;
    }
    if (status === "Rejected") {
      return type === "timesheet"
        ? `${baseClass} border-l-red-500 bg-red-50 text-red-800`
        : `${baseClass} border-l-red-500 bg-red-50 text-red-800`;
    }
    if (status === "Pending") {
      return type === "timesheet"
        ? `${baseClass} border-l-orange-500 bg-orange-50 text-orange-800`
        : `${baseClass} border-l-orange-500 bg-orange-50 text-orange-800`;
    }
    // Draft status (should not appear in admin view, but keeping for consistency)
    if (type === "timesheet") {
      return `${baseClass} border-l-blue-500 bg-blue-100 text-blue-700 border-dashed`;
    }
    return `${baseClass} border-l-purple-500 bg-purple-100 text-purple-700 border-dashed`;
  };

  // Helper function for modal entry card styling based on status
  const getModalEntryCardClass = (status: string) => {
    if (status === "Approved") {
      return "p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md bg-green-50 border-green-300 hover:border-green-400";
    }
    if (status === "Rejected") {
      return "p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md bg-red-50 border-red-300 hover:border-red-400";
    }
    if (status === "Pending") {
      return "p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md bg-orange-50 border-orange-300 hover:border-orange-400";
    }
    // Draft status (should not appear in admin view, but keeping for consistency)
    return "p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md bg-blue-50 border-blue-200 hover:border-blue-300 border-dashed";
  };

  // Helper function for modal status badge styling
  const getModalStatusBadgeClass = (status: string) => {
    if (status === "Approved") {
      return "px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 border border-green-300";
    }
    if (status === "Rejected") {
      return "px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800 border border-red-300";
    }
    if (status === "Pending") {
      return "px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-800 border border-orange-300";
    }
    // Draft status (should not appear in admin view, but keeping for consistency)
    return "px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300 border-dashed";
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
      case "Pending":
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10" stroke="#f97316" strokeWidth="2"/>
            <path d="M12 6v6l4 2" stroke="#f97316" strokeWidth="2"/>
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

  const handleViewEntry = (entry: TimesheetEntry) => {
    setSelectedEntry(entry);
    setDrawerVisible(true);
  };

  const handleApprove = async (entryId: string) => {
    setSubmittingAction(true);
    try {
      // Build payload based on entry type
      const formData = new URLSearchParams();

      if (selectedEntry?.type === 'leave') {
        // Leave approval
        const leaveId =
          (selectedEntry.rawData && selectedEntry.rawData.leave_application_id) ||
          parseInt(String(entryId).split('-')[0], 10);
        formData.append('leave_id', String(leaveId));
        formData.append('action', 'APPROVE');
        const response = await apiRequest<any>('approve_leave/', 'POST', formData);
        if (response?.success_flag !== false) {
          toast.success(response?.message || 'Leave application approved successfully!', {
            duration: 4000,
            position: 'top-right',
            style: { background: '#10b981', color: '#fff' },
          });
          setDrawerVisible(false);
          setSelectedEntry(null);
          setTimeout(() => { fetchTeamMemberTimesheet(); }, 300);
        } else {
          const errorMsg = response?.message || response?.error || 'Failed to approve leave application';
          toast.error(errorMsg, { duration: 4000, position: 'top-right' });
        }
      } else {
        // Timesheet approval
        formData.append('entry_id', String(parseInt(entryId, 10)));
        formData.append('action', 'APPROVE');
        const response = await apiRequest<any>('approve_timesheet/', 'POST', formData);
        if (response?.success_flag !== false) {
          toast.success(response?.message || 'Timesheet entry approved successfully!', {
            duration: 4000,
            position: 'top-right',
            style: { background: '#10b981', color: '#fff' },
          });
          setDrawerVisible(false);
          setSelectedEntry(null);
          setTimeout(() => { fetchTeamMemberTimesheet(); }, 300);
        } else {
          const errorMsg = response?.message || response?.error || 'Failed to approve timesheet entry';
          toast.error(errorMsg, { duration: 4000, position: 'top-right' });
        }
      }
    } catch (error: any) {
      console.error('Error approving entry:', error);
      const errorMessage = error.message || error.detail || 'Failed to approve entry. Please try again.';
      toast.error(errorMessage, { duration: 4000, position: 'top-right' });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReject = () => {
    // Show rejection modal
    setRejectModalVisible(true);
    setRejectionReason("");
  };

  const handleRejectSubmit = async () => {
    if (!selectedEntry || !rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection', {
          duration: 4000,
          position: 'top-right',
        });
      return;
    }

    setSubmittingAction(true);
    try {
      // URL-encoded submission
      const formData = new URLSearchParams();

      if (selectedEntry.type === 'leave') {
        const leaveId =
          (selectedEntry.rawData && selectedEntry.rawData.leave_application_id) ||
          parseInt(String(selectedEntry.id).split('-')[0], 10);
        formData.append('leave_id', String(leaveId));
        formData.append('action', 'REJECT');
        formData.append('rejection_reason', rejectionReason.trim());
        const response = await apiRequest<any>('approve_leave/', 'POST', formData);
        if (response?.success_flag !== false) {
          toast.success(response?.message || 'Leave application rejected successfully!', {
            duration: 4000,
            position: 'top-right',
            style: { background: '#ef4444', color: '#fff' },
          });
          setRejectModalVisible(false);
          setRejectionReason("");
          setDrawerVisible(false);
          setSelectedEntry(null);
          setTimeout(() => { fetchTeamMemberTimesheet(); }, 300);
        } else {
          const errorMsg = response?.message || response?.error || 'Failed to reject leave application';
          toast.error(errorMsg, { duration: 4000, position: 'top-right' });
        }
      } else {
        // Timesheet rejection
        formData.append('entry_id', String(parseInt(selectedEntry.id, 10)));
        formData.append('action', 'REJECT');
        formData.append('rejection_reason', rejectionReason.trim());
        const response = await apiRequest<any>('approve_timesheet/', 'POST', formData);
        if (response?.success_flag !== false) {
          toast.success(response?.message || 'Timesheet entry rejected successfully!', {
            duration: 4000,
            position: 'top-right',
            style: { background: '#ef4444', color: '#fff' },
          });
          setRejectModalVisible(false);
          setRejectionReason("");
          setDrawerVisible(false);
          setSelectedEntry(null);
          setTimeout(() => { fetchTeamMemberTimesheet(); }, 300);
        } else {
          const errorMsg = response?.message || response?.error || 'Failed to reject timesheet entry';
          toast.error(errorMsg, { duration: 4000, position: 'top-right' });
        }
      }
    } catch (error: any) {
      console.error('Error rejecting entry:', error);
      const errorMessage = error.message || error.detail || 'Failed to reject entry. Please try again.';
      toast.error(errorMessage, {
        duration: 4000,
        position: 'top-right',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const days = getWeekDates();

  // Get all employees from master data (for super admin)
  const teamMemberOptions = useMemo(() => {
    return getAllEmployeeOptions();
  }, []);

  const canShowGrid = teamMember;

  // Fetch entries for selected team member (selected week)
  const fetchTeamMemberTimesheet = useCallback(async () => {
    if (!teamMember) { setEntries([]); return; }
    setLoading(true);
    try {
      // Build date range based on filter mode
      let startDate: dayjs.Dayjs;
      let endDate: dayjs.Dayjs;
      
      if (filterMode === "month" && selectedMonth) {
        // Fetch entire month's data for calendar view
        startDate = selectedMonth.startOf('month');
        endDate = selectedMonth.endOf('month');
      } else {
        // Week mode - fetch selected week
        const base = dayjs().add(weekOffset * 7, 'day');
        startDate = base.startOf('week').add(1, 'day'); // Monday
        endDate = startDate.add(6, 'days'); // Sunday
      }

      // Status mapper - exclude DRAFT entries from admin view
      const statusMap: Record<string, "Draft" | "Pending" | "Approved" | "Rejected"> = {
        DRAFT: "Draft",
        PENDING: "Pending",
        APPROVED: "Approved",
        REJECTED: "Rejected",
      };

      // Fetch both timesheet and leave entries
      const allEntries: TimesheetEntry[] = [];

      // Fetch timesheet entries
      const timesheetParams = new URLSearchParams();
      timesheetParams.append('entry_date_from', startDate.format('YYYY-MM-DD'));
      timesheetParams.append('entry_date_to', endDate.format('YYYY-MM-DD'));
      const timesheetEndpoint = `get_timesheet_entries?${timesheetParams.toString()}`;
      const timesheetResp = await apiRequest<any>(timesheetEndpoint, 'GET', undefined, undefined, { 'x-user-code': teamMember });
      const timesheetEntries: any[] = Array.isArray(timesheetResp?.data?.entries) ? timesheetResp.data.entries : [];
      const mappedTimesheet: TimesheetEntry[] = timesheetEntries
        .filter((e) => {
          // Filter out DRAFT entries - they should not be visible to admin
          const status = String(e.approval_status || '').toUpperCase();
          return status !== 'DRAFT';
        })
        .map((e) => {
          // Determine if this is a ticket entry (has ticket_code but no task_code or activity_code)
          const isTicketEntry = e.ticket_code && (!e.task_code || e.task_code === 0) && (!e.activity_code || e.activity_code === 0);
          // Determine if this is an activity entry (has activity_code but no task_code)
          const isActivityEntry = e.activity_code && (!e.task_code || e.task_code === 0) && !isTicketEntry;
          
          // Get task/ticket/activity title: prefer activity_title for activity entries, then ticket_title for ticket entries, then task_title, then epic_title
          const taskTitle = isActivityEntry 
            ? (e.activity_title || "Untitled Activity")
            : isTicketEntry
            ? (e.ticket_title || "Untitled Ticket")
            : (e.task_title || e.epic_title || "Untitled Task");
          
          return {
            id: String(e.timesheet_entry_id),
            employee: e.user_name || e.user_code || "",
            date: e.entry_date,
            type: "timesheet",
            status: statusMap[String(e.approval_status || '').toUpperCase()] || "Pending",
            submittedAt: e.timesheet_created_at,
            task: taskTitle,
            hours: typeof e.total_hours === 'string' ? parseFloat(e.total_hours) : (e.total_hours || (typeof e.actual_hours_worked === 'string' ? parseFloat(e.actual_hours_worked) : (e.actual_hours_worked || 0))),
            mode: e.work_location_name || e.work_location_code || "",
            description: e.description || "",
            rejectionReason: e.rejection_reason || e.latest_rejection_reason || "",
            rawData: e,
          };
        });
      allEntries.push(...mappedTimesheet);

      // Fetch leave applications
      const leaveParams = new URLSearchParams();
      leaveParams.append('from_date_from', startDate.format('YYYY-MM-DD'));
      leaveParams.append('to_date_to', endDate.format('YYYY-MM-DD'));
      const leaveEndpoint = `get_leave_applications?${leaveParams.toString()}`;
      const leaveResp = await apiRequest<any>(leaveEndpoint, 'GET', undefined, undefined, { 'x-user-code': teamMember });
      const leaveEntries: any[] = Array.isArray(leaveResp?.data?.entries) ? leaveResp.data.entries : [];
      // Expand leave across date range
      const mappedLeave: TimesheetEntry[] = leaveEntries
        .filter((e) => {
          // Filter out DRAFT entries - they should not be visible to admin
          const status = String(e.approval_status || '').toUpperCase();
          return status !== 'DRAFT';
        })
        .flatMap((e) => {
          const from = e.from_date ? dayjs(e.from_date) : null;
          const to = e.to_date ? dayjs(e.to_date) : null;
          if (!from || !to) return [];
          const diff = to.diff(from, 'day');
          const perDay: TimesheetEntry[] = [];
          for (let i = 0; i <= diff; i++) {
            const d = from.add(i, 'day');
            perDay.push({
              id: String(e.leave_application_id) + '-' + d.format('YYYYMMDD'),
              employee: e.applicant_name || e.user_name || e.user_code || "",
              date: d.toISOString(),
              type: "leave",
              status: statusMap[String(e.approval_status || '').toUpperCase()] || "Pending",
              submittedAt: e.leave_created_at || e.created_at,
              leaveType: e.leave_type_name || e.leave_type_code,
              fromDate: e.from_date,
              toDate: e.to_date,
              description: e.reason || e.leave_reason || "",
              rejectionReason: e.rejection_reason || "",
              rawData: e,
            });
          }
          return perDay;
        });
      allEntries.push(...mappedLeave);

      setEntries(allEntries);
    } catch (err) {
      console.error('Failed to fetch team member timesheet:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [teamMember, weekOffset, filterMode, selectedMonth, selectedWeek]);

  // Trigger fetch when team member or view changes
  useEffect(() => {
    fetchTeamMemberTimesheet();
  }, [fetchTeamMemberTimesheet]);

  return (
    <div className="p-2 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        {/* Selection Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-wrap">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-xs sm:text-sm text-gray-600 font-medium">Select Team Member:</label>
            <Select
              value={teamMember}
              onChange={setTeamMember}
              placeholder="Select team member"
              className="w-full sm:w-48"
              size="small"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={teamMemberOptions}
              notFoundContent={teamMemberOptions.length === 0 ? "No team members found" : "No matches"}
            />
          </div>

          {canShowGrid && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-xs sm:text-sm text-gray-600 font-medium">Status:</label>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  className="w-full sm:w-32"
                  size="small"
                  options={[
                    { value: "all", label: "All" },
                    { value: "Pending", label: "Pending" },
                    { value: "Approved", label: "Approved" },
                    { value: "Rejected", label: "Rejected" },
                  ]}
                />
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  onClick={() => {
                    const teamMemberName = teamMemberOptions.find(opt => opt.value === teamMember)?.label || teamMember;
                    const filename = `team-timesheet-${teamMemberName}-${dayjs().format('YYYY-MM-DD')}`;
                    exportTeamTimesheetToPDF(filename, entries, teamMemberName);
                  }}
                  disabled={entries.length === 0}
                  className="flex items-center justify-center p-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-400"
                  title="Download as PDF"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <polyline points="10 9 9 9 8 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  onClick={() => {
                    const teamMemberName = teamMemberOptions.find(opt => opt.value === teamMember)?.label || teamMember;
                    const filename = `team-timesheet-${teamMemberName}-${dayjs().format('YYYY-MM-DD')}`;
                    exportTeamTimesheetToExcel(filename, entries, teamMemberName);
                  }}
                  disabled={entries.length === 0}
                  className="flex items-center justify-center p-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-400"
                  title="Download as Excel"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.3"/>
                    <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" strokeWidth="1" opacity="0.3"/>
                    <line x1="15" y1="3" x2="15" y2="21" stroke="currentColor" strokeWidth="1" opacity="0.3"/>
                    <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1" opacity="0.3"/>
                    <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="1" opacity="0.3"/>
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Filter Mode Toggle and Controls */}
        {canShowGrid && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <label className="text-xs sm:text-sm text-gray-600 font-medium">Filter Mode:</label>
              <Radio.Group
                value={filterMode}
                onChange={(e) => {
                  setFilterMode(e.target.value);
                  if (e.target.value === "month" && !selectedMonth) {
                    setSelectedMonth(dayjs());
                  }
                }}
                size="small"
                options={[
                  { label: "Week", value: "week" },
                  { label: "Month", value: "month" },
                ]}
              />
            </div>

            {filterMode === "week" ? (
              /* Week navigator */
              <div className="flex items-center gap-2 sm:ml-auto">
                <button
                  onClick={() => setWeekOffset(v => v - 1)}
                  className="px-3 py-1 bg-white border border-gray-300 rounded text-xs hover:bg-gray-50"
                  title="Previous Week"
                >
                  ← Previous
                </button>
                <div className="text-xs text-gray-700">
                  {(() => {
                    const base = dayjs().add(weekOffset * 7, 'day');
                    const start = base.startOf('week').add(1, 'day');
                    const end = start.add(6, 'days');
                    return `${start.format('DD MMM')} - ${end.format('DD MMM YYYY')}`;
                  })()}
                </div>
                <button
                  onClick={() => setWeekOffset(v => v + 1)}
                  className="px-3 py-1 bg-white border border-gray-300 rounded text-xs hover:bg-gray-50"
                  title="Next Week"
                >
                  Next →
                </button>
              </div>
            ) : (
              /* Month selector (week selector hidden in month mode since we show full calendar) */
              <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs sm:text-sm text-gray-600 font-medium">Month:</label>
                  <DatePicker
                    picker="month"
                    value={selectedMonth}
                    onChange={(date) => {
                      setSelectedMonth(date);
                      setSelectedWeek(1); // Reset to first week when month changes
                    }}
                    format="MMM YYYY"
                    size="small"
                    className="w-32"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Empty State or Grid/Calendar */}
      {!canShowGrid ? (
        <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-center max-w-md">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select Team Member</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please select a team member to view their timesheet entries and leave applications.
            </p>
          </div>
        </div>
      ) : filterMode === "month" ? (
        /* Calendar View for Month Mode */
        <div className="overflow-x-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            {/* Calendar Header */}
            <div className="grid grid-cols-7 gap-px border-b border-gray-200 bg-gray-200">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="bg-gray-50 p-2 text-center">
                  <div className="text-xs font-semibold text-gray-700">{day}</div>
                </div>
              ))}
            </div>
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-px bg-gray-200">
              {getCalendarDays.map((calDay) => {
                const dayEntries = entriesByDate[calDay.dateStr] || [];
                const totalHours = dayEntries
                  .filter(e => e.type === "timesheet" && e.status === "Approved")
                  .reduce((sum, e) => sum + (e.hours || 0), 0);
                const isToday = calDay.date.isSame(dayjs(), 'day');

                return (
                  <div
                    key={calDay.dateStr}
                    className={`bg-white min-h-[120px] sm:min-h-[150px] p-2 ${!calDay.isCurrentMonth ? 'opacity-40' : ''} ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    {/* Day Number */}
                    <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600' : calDay.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                      {calDay.dayNumber}
                    </div>
                    {/* Total Hours */}
                    {loading ? (
                      <div className="text-[9px] text-gray-400">...</div>
                    ) : totalHours > 0 ? (
                      <div className="text-[9px] text-gray-600 mb-1">
                        {totalHours}h
                      </div>
                    ) : null}
                    {/* Entries */}
                    <div className="space-y-1">
                      {dayEntries.slice(0, 2).map((entry) => (
                        <div
                          key={entry.id}
                          onClick={() => handleViewEntry(entry)}
                          className={getCalendarEntryClass(entry.status, entry.type)}
                          title={`${entry.type === "timesheet" ? entry.task : entry.leaveType} - ${entry.status}`}
                        >
                          <div className="flex items-center gap-1">
                            <span className="flex-shrink-0">{getStatusIcon(entry.status)}</span>
                            <span className="truncate">
                              {entry.type === "timesheet" ? "TS" : "L"}: {entry.type === "timesheet" ? (entry.task || '').substring(0, 12) : (entry.leaveType || '').substring(0, 12)}
                            </span>
                          </div>
                        </div>
                      ))}
                      {dayEntries.length > 2 && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDayEntries({ date: calDay.date, entries: dayEntries });
                            setAllEntriesModalVisible(true);
                          }}
                          className="text-[9px] text-blue-600 text-center font-medium cursor-pointer hover:text-blue-700 hover:underline transition-colors py-0.5 px-1 rounded bg-blue-50 hover:bg-blue-100"
                          title={`Click to view all ${dayEntries.length} entries`}
                        >
                          +{dayEntries.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Weekly Grid View for Week Mode */
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-2 sm:gap-4 min-w-[700px]">
            {days.map((day) => {
              const dayEntries = entriesByDay[day.key] || [];
              const totalHours = dayEntries
                .filter(e => e.type === "timesheet" && e.status === "Approved")
                .reduce((sum, e) => sum + (e.hours || 0), 0);
              const isToday = day.date.isSame(dayjs(), 'day');

              return (
                <div key={day.key} className={`border rounded-lg min-w-[100px] max-w-full overflow-hidden ${isToday ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-200'}`}>
                  {/* Day Header */}
                  <div className={`p-2 sm:p-3 border-b ${isToday ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className={`text-xs sm:text-sm font-medium truncate ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>{day.label}</div>
                    {loading ? (
                      <div className="text-[10px] text-gray-500 mt-0.5">Loading...</div>
                    ) : (
                    <div className="flex items-center gap-1 mt-1">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                        <circle cx="12" cy="12" r="10" stroke="#6b7280" strokeWidth="2"/>
                        <path d="M12 6v6l4 2" stroke="#6b7280" strokeWidth="2"/>
                      </svg>
                      <span className="text-xs text-gray-600 truncate">
                        {totalHours > 0 ? `${totalHours}h` : "Total Hours"}
                      </span>
                    </div>
                    )}
                  </div>

                  {/* Day Content */}
                  <div className="p-2 sm:p-3 min-h-[200px] sm:min-h-[300px] space-y-2">
                    {dayEntries.map((entry) => (
                      <div
                        key={entry.id}
                        onClick={() => handleViewEntry(entry)}
                        className={`group relative bg-white border border-gray-200 rounded-lg p-2.5 sm:p-3 cursor-pointer hover:shadow-lg hover:border-gray-300 transition-all duration-200 overflow-hidden ${getColorClass(entry.status, entry.type)}`}
                      >
                        {/* Status indicator dot */}
                        <div className="absolute top-2 right-2 opacity-60 group-hover:opacity-100 transition-opacity">
                          {getStatusIcon(entry.status)}
                        </div>
                        
                        {/* Main content */}
                        <div className="pr-6">
                          <div className="flex items-start justify-between gap-2 mb-2 min-w-0">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs sm:text-sm font-semibold text-gray-900 truncate leading-tight">
                                {entry.type === "timesheet" ? entry.task : entry.leaveType}
                              </h4>
                            </div>
                          </div>
                          
                          {/* Employee name */}
                          <div className="text-xs text-gray-600 truncate mb-2">{entry.employee}</div>
                          
                          {/* Tags row */}
                          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium ${
                              entry.type === "timesheet" 
                                ? "bg-blue-100 text-blue-700" 
                                : "bg-purple-100 text-purple-700"
                            }`}>
                              {entry.type === "timesheet" ? "TS" : "L"}
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium ${
                              entry.status === "Approved" 
                                ? "bg-green-100 text-green-700"
                                : entry.status === "Rejected"
                                ? "bg-red-100 text-red-700"
                                : entry.status === "Pending"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-gray-100 text-gray-700"
                            }`}>
                              {entry.status}
                            </span>
                          </div>
                          
                          {/* Details row */}
                          {entry.type === "timesheet" && (
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
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Drawer for viewing/approving entries */}
      <Drawer
        title={selectedEntry ? `Review ${selectedEntry.type === "timesheet" ? "Timesheet" : "Leave"} Entry - ${selectedEntry.employee}` : "Review Entry"}
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
        footer={
          canApprove && (selectedEntry?.status === "Pending" || selectedEntry?.status === "Draft") ? (
            <div className="flex gap-2 justify-end p-4">
              <button
                onClick={handleReject}
                disabled={submittingAction}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submittingAction ? 'Processing...' : 'Reject'}
              </button>
              <button
                onClick={() => handleApprove(selectedEntry.id)}
                disabled={submittingAction}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submittingAction ? 'Processing...' : 'Approve'}
              </button>
            </div>
          ) : null
        }
      >
        {selectedEntry && (
          selectedEntry.type === "timesheet" ? (
            <EnterTimesheetTab
              onClose={() => {}}
              mode="view"
              entryData={selectedEntry.rawData || selectedEntry}
              onApprove={canApprove ? () => handleApprove(selectedEntry.id) : undefined}
              onReject={canApprove ? handleReject : undefined}
              hideActionButtons={true}
            />
          ) : (
            <ApplyLeaveTab
              onClose={() => {}}
              mode="view"
              entryData={selectedEntry.rawData || selectedEntry}
              onApprove={canApprove ? () => handleApprove(selectedEntry.id) : undefined}
              onReject={canApprove ? handleReject : undefined}
              hideActionButtons={true}
            />
          )
        )}
      </Drawer>

      {/* Rejection Reason Modal */}
      {rejectModalVisible && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-md"
          onClick={(e) => {
            // Close modal when clicking on backdrop
            if (e.target === e.currentTarget && !submittingAction) {
              setRejectModalVisible(false);
              setRejectionReason("");
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <h3 className="text-lg font-semibold text-gray-900">Reject {selectedEntry?.type === "timesheet" ? "Timesheet Entry" : "Leave Application"}</h3>
              <button
                onClick={() => {
                  if (!submittingAction) {
                    setRejectModalVisible(false);
                    setRejectionReason("");
                  }
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submittingAction}
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={`Please provide a reason for rejecting this ${selectedEntry?.type === "timesheet" ? "timesheet entry" : "leave application"}...`}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none transition-all"
                disabled={submittingAction}
                autoFocus
              />
              {!rejectionReason.trim() && (
                <p className="text-xs text-gray-500 mt-2">This field is required to reject the {selectedEntry?.type === "timesheet" ? "timesheet entry" : "leave application"}.</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => {
                  if (!submittingAction) {
                    setRejectModalVisible(false);
                    setRejectionReason("");
                  }
                }}
                disabled={submittingAction}
                className="px-5 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={submittingAction || !rejectionReason.trim()}
                className="px-5 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
              >
                {submittingAction ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal to show all entries for a day */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-600">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
              <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/>
              <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/>
              <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span className="font-semibold">
              All Entries - {selectedDayEntries?.date.format("DD MMMM YYYY")}
            </span>
          </div>
        }
        open={allEntriesModalVisible}
        onCancel={() => setAllEntriesModalVisible(false)}
        footer={null}
        width={600}
        className="all-entries-modal"
      >
        <div className="max-h-[60vh] overflow-y-auto">
          {selectedDayEntries && selectedDayEntries.entries.length > 0 ? (
            <div className="space-y-3 mt-4">
              {selectedDayEntries.entries.map((entry, index) => (
                <div
                  key={entry.id || index}
                  onClick={() => {
                    setSelectedEntry(entry);
                    setAllEntriesModalVisible(false);
                    setDrawerVisible(true);
                  }}
                  className={getModalEntryCardClass(entry.status)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                          entry.type === "timesheet" 
                            ? "bg-blue-200 text-blue-800"
                            : "bg-purple-200 text-purple-800"
                        }`}>
                          {entry.type === "timesheet" ? "TS" : "L"}
                        </span>
                        <span className={`${getModalStatusBadgeClass(entry.status)} flex items-center gap-1`}>
                          <span className="flex-shrink-0">{getStatusIcon(entry.status)}</span>
                          <span>{entry.status}</span>
                        </span>
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-1 truncate">
                        {entry.type === "timesheet" ? entry.task : entry.leaveType}
                      </h4>
                      {entry.type === "timesheet" && entry.hours && (
                        <p className="text-sm text-gray-600 mb-1">
                          <span className="font-medium">{entry.hours}h</span>
                          {entry.mode && <span className="ml-2 text-gray-500">• {entry.mode}</span>}
                        </p>
                      )}
                      {entry.type === "leave" && entry.fromDate && entry.toDate && (
                        <p className="text-sm text-gray-600 mb-1">
                          <span className="font-medium">
                            {dayjs(entry.fromDate).format("DD MMM")} - {dayjs(entry.toDate).format("DD MMM")}
                          </span>
                        </p>
                      )}
                      {entry.employee && (
                        <p className="text-xs text-gray-500">
                          Employee: {entry.employee}
                        </p>
                      )}
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-400 flex-shrink-0 mt-1">
                      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No entries found for this day.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

