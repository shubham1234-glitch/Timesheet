"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Drawer, Tabs, Tag, Select, Spin, Button, Radio, DatePicker, Modal } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import EnterTimesheetTab from "../../employee/timesheet/EnterTimesheetTab";
import ApplyLeaveTab from "../../employee/timesheet/ApplyLeaveTab";
import { apiRequest } from "@/app/lib/api";

interface TimeEntry {
  id: string;
  title: string;
  hours?: number;
  mode?: string;
  type: "timesheet" | "leave";
  status: "Draft" | "Pending" | "Approved" | "Rejected";
  leaveType?: string;
  fromDate?: string;
  toDate?: string;
  rejectionReason?: string;
  // Additional fields from API
  entryDate?: string;
  rawData?: any; // Store full API response for view mode
}

interface TimesheetApiResponse {
  success_flag: boolean;
  data: {
    entries: Array<{
      timesheet_entry_id: number;
      entry_date: string;
      approval_status: string;
      actual_hours_worked: number;
      total_hours: number;
      work_location_name: string;
      task_title: string;
      epic_title: string;
      task_type_name: string;
      description: string;
      [key: string]: any;
    }>;
    pagination: {
      total_count: number;
      limit: number;
      offset: number;
      has_more: boolean;
    };
  };
  message: string;
  status_code: number;
  status_message: string;
}

interface LeaveApiResponse {
  success_flag: boolean;
  data: {
    entries: Array<{
      leave_application_id: number;
      leave_type_code: string;
      leave_type_name: string;
      from_date: string;
      to_date: string;
      approval_status: string;
      reason?: string;
      [key: string]: any;
    }>;
    pagination: {
      total_count: number;
      limit: number;
      offset: number;
      has_more: boolean;
    };
  };
  message: string;
  status_code: number;
  status_message: string;
}

export default function AdminTimesheetPage() {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("timesheet");
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  const [allEntriesModalVisible, setAllEntriesModalVisible] = useState(false);
  const [selectedDayEntries, setSelectedDayEntries] = useState<{ date: dayjs.Dayjs; entries: TimeEntry[] } | null>(null);
  // New filter states
  const [filterMode, setFilterMode] = useState<"week" | "month">("week");
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs | null>(dayjs());
  const [selectedWeek, setSelectedWeek] = useState<number>(1); // 1-4 weeks in a month
  const [entries, setEntries] = useState<Record<string, TimeEntry[]>>({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  });
  const [loading, setLoading] = useState(false);

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

  // Get the selected week's dates (Monday to Sunday)
  const getWeekDates = () => {
    let startOfWeek: dayjs.Dayjs;
    
    if (filterMode === "month" && selectedMonth) {
      const weeks = getWeeksInMonth(selectedMonth);
      const selectedWeekData = weeks[selectedWeek - 1];
      if (selectedWeekData) {
        startOfWeek = selectedWeekData.start;
      } else {
        // Fallback to first week
        startOfWeek = selectedMonth.startOf('month').startOf('week').add(1, 'day');
      }
    } else {
      // Week mode - use weekOffset
      const base = dayjs().add(weekOffset * 7, 'day');
      startOfWeek = base.startOf('week').add(1, 'day'); // Monday
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
        dayNumber: date.date(),
        isPast7Days: (() => {
          const today = dayjs().endOf('day');
          const sevenDaysAgo = dayjs().subtract(7, 'days').startOf('day');
          return !date.isAfter(today, 'day') && !date.isBefore(sevenDaysAgo, 'day');
        })(),
      });
    }
    
    return days;
  };

  const days = getWeekDates();

  // Map API response to TimeEntry format
  const mapApiEntryToTimeEntry = (apiEntry: any): TimeEntry => {
    const entryDate = dayjs(apiEntry.entry_date);
    const statusMap: Record<string, "Draft" | "Pending" | "Approved" | "Rejected"> = {
      DRAFT: "Draft",
      SUBMITTED: "Pending",
      PENDING: "Pending", // Legacy support
      APPROVED: "Approved",
      REJECTED: "Rejected",
    };
    
    // Determine if this is a ticket entry (has ticket_code but no task_code or activity_code)
    const isTicketEntry = apiEntry.ticket_code && (!apiEntry.task_code || apiEntry.task_code === 0) && (!apiEntry.activity_code || apiEntry.activity_code === 0);
    // Determine if this is an activity entry (has activity_code but no task_code)
    const isActivityEntry = apiEntry.activity_code && (!apiEntry.task_code || apiEntry.task_code === 0) && !isTicketEntry;
    
    // Get title: prefer activity_title for activity entries, then ticket_title for ticket entries, then task_title, then epic_title
    const title = isActivityEntry 
      ? (apiEntry.activity_title || "Untitled Activity")
      : isTicketEntry
      ? (apiEntry.ticket_title || "Untitled Ticket")
      : (apiEntry.task_title || apiEntry.epic_title || "Untitled Task");
    
    return {
      id: `timesheet-${apiEntry.timesheet_entry_id}`,
      title: title,
      hours: typeof apiEntry.total_hours === 'string' 
        ? parseFloat(apiEntry.total_hours) 
        : (apiEntry.total_hours || (typeof apiEntry.actual_hours_worked === 'string' 
          ? parseFloat(apiEntry.actual_hours_worked) 
          : (apiEntry.actual_hours_worked || 0))),
      mode: apiEntry.work_location_name || apiEntry.work_location_code || "",
      type: "timesheet",
      status: statusMap[apiEntry.approval_status?.toUpperCase()] || "Draft",
      rejectionReason: apiEntry.rejection_reason || apiEntry.latest_rejection_reason || "",
      entryDate: apiEntry.entry_date,
      rawData: apiEntry,
    };
  };

  // Map leave API response to TimeEntry format (expanded across date range)
  const mapLeaveToTimeEntries = (apiEntry: any): TimeEntry[] => {
    const statusMap: Record<string, "Draft" | "Pending" | "Approved" | "Rejected"> = {
      DRAFT: "Draft",
      SUBMITTED: "Pending",
      PENDING: "Pending", // Legacy support
      APPROVED: "Approved",
      REJECTED: "Rejected",
    };
    const from = apiEntry.from_date ? dayjs(apiEntry.from_date) : null;
    const to = apiEntry.to_date ? dayjs(apiEntry.to_date) : null;
    if (!from || !to) return [];

    const entries: TimeEntry[] = [];
    const daysDiff = to.diff(from, 'day');
    for (let i = 0; i <= daysDiff; i++) {
      const d = from.add(i, 'day');
      entries.push({
        id: `leave-${apiEntry.leave_application_id}-${d.format('YYYYMMDD')}`,
        title: apiEntry.leave_type_name || 'Leave',
        type: "leave",
        status: statusMap[apiEntry.approval_status?.toUpperCase()] || "Draft",
        leaveType: apiEntry.leave_type_name || apiEntry.leave_type_code,
        fromDate: apiEntry.from_date,
        toDate: apiEntry.to_date,
        rejectionReason: apiEntry.rejection_reason || "",
        entryDate: d.toISOString(),
        rawData: apiEntry,
      });
    }
    return entries;
  };

  // Group entries by day of week (for weekly view)
  const groupEntriesByDay = (entriesToGroup: TimeEntry[]): Record<string, TimeEntry[]> => {
    const grouped: Record<string, TimeEntry[]> = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };

    entriesToGroup.forEach((entry) => {
      const entryDate = dayjs(entry.entryDate);
      const dayOfWeek = entryDate.day(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      // Convert to our day keys (Monday = 1, Sunday = 0)
      const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayKey = dayKeys[dayOfWeek] as keyof typeof grouped;
      
      if (dayKey && grouped[dayKey]) {
        grouped[dayKey].push(entry);
      }
    });

    return grouped;
  };

  // Group entries by date (for calendar view)
  const entriesByDate = useMemo(() => {
    const allEntries: TimeEntry[] = Object.values(entries).flat();
    const grouped: Record<string, TimeEntry[]> = {};
    allEntries.forEach((entry) => {
      const dateKey = dayjs(entry.entryDate).format('YYYY-MM-DD');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(entry);
    });
    return grouped;
  }, [entries]);

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

  // Fetch timesheet and leave entries from API and merge
  const fetchTimesheetEntries = useCallback(async () => {
    setLoading(true);
    try {
      let startOfWeek: dayjs.Dayjs;
      let endOfWeek: dayjs.Dayjs;
      
      if (filterMode === "month" && selectedMonth) {
        // Fetch entire month's data for calendar view
        startOfWeek = selectedMonth.startOf('month');
        endOfWeek = selectedMonth.endOf('month');
      } else {
        // Week mode - use weekOffset
        startOfWeek = dayjs().add(weekOffset, 'week').startOf('week').add(1, 'day'); // Monday
        endOfWeek = startOfWeek.add(6, 'days'); // Sunday
      }

      const tsParams = new URLSearchParams();
      tsParams.append('entry_date_from', startOfWeek.format('YYYY-MM-DD'));
      tsParams.append('entry_date_to', endOfWeek.format('YYYY-MM-DD'));

      const lvParams = new URLSearchParams();
      lvParams.append('from_date_from', startOfWeek.format('YYYY-MM-DD'));
      lvParams.append('to_date_to', endOfWeek.format('YYYY-MM-DD'));

      const [tsResp, lvResp] = await Promise.all([
        apiRequest<TimesheetApiResponse>(`get_timesheet_entries?${tsParams.toString()}`, 'GET'),
        apiRequest<LeaveApiResponse>(`get_leave_applications?${lvParams.toString()}`, 'GET'),
      ]);

      // Map responses to unified entries
      const tsEntries: TimeEntry[] = Array.isArray(tsResp?.data?.entries)
        ? tsResp.data.entries.map(mapApiEntryToTimeEntry)
        : [];
      const lvEntries: TimeEntry[] = Array.isArray(lvResp?.data?.entries)
        ? lvResp.data.entries.flatMap(mapLeaveToTimeEntries)
        : [];

      const allEntries = [...tsEntries, ...lvEntries];
      const grouped = groupEntriesByDay(allEntries);
      setEntries(grouped);
    } catch (error) {
      console.error('Error fetching timesheet entries:', error);
      // Keep existing entries on error
    } finally {
      setLoading(false);
    }
  }, [weekOffset, filterMode, selectedMonth, selectedWeek]);

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchTimesheetEntries();
  }, [fetchTimesheetEntries]);

  // Refresh data after successful timesheet entry
  const handleTimesheetSubmitted = useCallback(() => {
    console.log('Refreshing timesheet entries after successful submission...');
    fetchTimesheetEntries();
  }, [fetchTimesheetEntries]);

  // Refresh data after successful leave entry
  const handleLeaveSubmitted = useCallback(() => {
    console.log('Refreshing leave entries after successful submission...');
    fetchTimesheetEntries();
  }, [fetchTimesheetEntries]);

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
    // Status-based colors (consistent for both timesheet and leave)
    if (status === "Draft") return "border-l-4 border-blue-500 bg-blue-50/30";
    if (status === "Pending") return "border-l-4 border-orange-500 bg-orange-50/30";
    if (status === "Approved") return "border-l-4 border-green-500 bg-green-50/30";
    if (status === "Rejected") return "border-l-4 border-red-500 bg-red-50/30";
    // Fallback to type-based colors only if no status
    if (type === "timesheet") return "border-l-4 border-blue-500 bg-blue-50/30";
    return "border-l-4 border-purple-500 bg-purple-50/30";
  };

  // Helper function to get consistent status badge colors (for both timesheet and leave)
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Approved": return "bg-green-100 text-green-700";
      case "Rejected": return "bg-red-100 text-red-700";
      case "Pending": return "bg-orange-100 text-orange-700";
      case "Draft": return "bg-blue-100 text-blue-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  // Helper function to get consistent status border/background colors (for both timesheet and leave)
  const getStatusBorderClass = (status: string) => {
    switch (status) {
      case "Approved": return "bg-green-50 border-green-200 hover:border-green-300";
      case "Rejected": return "bg-red-50 border-red-200 hover:border-red-300";
      case "Pending": return "bg-orange-50 border-orange-200 hover:border-orange-300";
      case "Draft": return "bg-blue-50 border-blue-200 hover:border-blue-300";
      default: return "bg-gray-50 border-gray-200 hover:border-gray-300";
    }
  };

  // Helper function to get consistent status type badge colors (for both timesheet and leave)
  const getStatusTypeBadgeClass = (status: string) => {
    switch (status) {
      case "Approved": return "bg-green-200 text-green-800";
      case "Rejected": return "bg-red-200 text-red-800";
      case "Pending": return "bg-orange-200 text-orange-800";
      case "Draft": return "bg-blue-200 text-blue-800";
      default: return "bg-gray-200 text-gray-800";
    }
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

  const handleEntryClick = (entry: TimeEntry) => {
    setSelectedEntry(entry);
    setActiveTab(entry.type);
    setDrawerVisible(true);
  };

  const handleAddEntry = (date?: dayjs.Dayjs) => {
    setSelectedEntry(null);
    setSelectedDate(date || null);
    // Today defaults to "timesheet", tomorrow and future dates default to "leave"
    const today = dayjs().startOf('day');
    const isFutureDate = date && date.startOf('day').isAfter(today, 'day');
    setActiveTab(isFutureDate ? "leave" : "timesheet");
    setDrawerVisible(true);
  };

  const handleDayCardClick = (dayDate: dayjs.Dayjs) => {
    // Allow adding entries for past 7 days (timesheet) or future dates (leave)
    const today = dayjs().endOf('day');
    const sevenDaysAgo = dayjs().subtract(7, 'days').startOf('day');
    const isPast7Days = !dayDate.isAfter(today, 'day') && !dayDate.isBefore(sevenDaysAgo, 'day');
    const isFutureDate = dayDate.isAfter(today, 'day');
    if (!isPast7Days && !isFutureDate) return;
    handleAddEntry(dayDate);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setSelectedEntry(null);
    setSelectedDate(null);
  };

  return (
    <div className="p-2 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6 space-y-4">
        {/* Filter Mode and Type Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label className="text-xs sm:text-sm text-gray-600">View:</label>
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              className="w-full sm:w-40"
              size="small"
              options={[
                { value: "all", label: "All" },
                { value: "timesheet", label: "Timesheet Entries" },
                { value: "leave", label: "Leave Applications" },
              ]}
            />
          </div>

        </div>

        {/* Filter Mode Toggle and Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs sm:text-sm text-gray-600">Filter Mode:</label>
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
              <Button 
                icon={<LeftOutlined />} 
                onClick={() => setWeekOffset(prev => prev - 1)} 
                size="small" 
              />
              <span className="text-sm font-medium text-gray-700">
                {days[0]?.date.format('DD MMM')} - {days[6]?.date.format('DD MMM YYYY')}
              </span>
              <Button 
                icon={<RightOutlined />} 
                onClick={() => setWeekOffset(prev => prev + 1)} 
                size="small" 
              />
            </div>
          ) : (
            /* Month and Week selector */
            <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs sm:text-sm text-gray-600">Month:</label>
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
      </div>

      {/* Calendar View for Month Mode or Weekly Grid for Week Mode */}
      <div className="overflow-x-auto">
        {loading && (
          <div className="flex justify-center items-center py-8">
            <Spin size="large" />
          </div>
        )}
        {filterMode === "month" ? (
          /* Calendar View for Month Mode */
          <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${loading ? 'opacity-50' : ''}`}>
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
                  .filter(entry => entry.type === "timesheet" && entry.status === "Approved")
                  .reduce((sum, entry) => {
                    const hours = typeof entry.hours === 'string' ? parseFloat(entry.hours) : (entry.hours || 0);
                    return sum + hours;
                  }, 0);
                const isToday = calDay.date.isSame(dayjs(), 'day');
                const today = dayjs().endOf('day');
                const isFuture = calDay.date.isAfter(today, 'day');
                const isPast = calDay.date.isBefore(today.startOf('day'), 'day');
                const isPast7Days = !calDay.date.isAfter(today, 'day') && !calDay.date.isBefore(dayjs().subtract(7, 'days').startOf('day'), 'day');

                return (
                  <div
                    key={calDay.dateStr}
                    className={`bg-white min-h-[120px] sm:min-h-[150px] p-2 ${!calDay.isCurrentMonth ? 'opacity-40' : ''} ${isToday ? 'ring-2 ring-blue-500' : ''} ${(isPast7Days || isFuture) ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                    onClick={() => {
                      if (isPast7Days || isFuture) {
                        handleDayCardClick(calDay.date);
                      }
                    }}
                    title={(isPast7Days || isFuture) ? `Click to add entry for ${calDay.dateStr}` : 'Date is outside the allowed range'}
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
                        {totalHours.toFixed(1)}h
                      </div>
                    ) : null}
                    {/* Entries */}
                    <div className="space-y-1">
                      {dayEntries.slice(0, 2).map((entry) => (
                        <div
                          key={entry.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEntryClick(entry);
                          }}
                          className={`text-[9px] p-1 rounded cursor-pointer hover:opacity-80 transition-opacity truncate ${getStatusBadgeClass(entry.status)}`}
                          title={`${entry.type === "timesheet" ? entry.title : entry.leaveType} - ${entry.status}`}
                        >
                          {entry.type === "timesheet" ? "TS" : "L"}: {entry.type === "timesheet" ? (entry.title || '').substring(0, 15) : (entry.leaveType || '').substring(0, 15)}
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
                    {/* Add Entry Button */}
                    {(() => {
                      const today = dayjs().endOf('day');
                      const sevenDaysAgo = dayjs().subtract(7, 'days').startOf('day');
                      const isPast7Days = !calDay.date.isAfter(today, 'day') && !calDay.date.isBefore(sevenDaysAgo, 'day');
                      const isFutureDate = calDay.date.isAfter(today, 'day');
                      // Enable button for past 7 days (timesheet) or future dates (leave)
                      const isEnabled = isPast7Days || isFutureDate;
                      
                      return (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDayCardClick(calDay.date);
                          }}
                          disabled={!isEnabled}
                          className={`w-full border-2 border-dashed border-gray-300 rounded p-1 mt-1 flex items-center justify-center gap-1 transition-colors text-[9px] ${
                            isEnabled 
                              ? 'hover:border-gray-400 hover:bg-gray-50 cursor-pointer' 
                              : 'opacity-50 cursor-not-allowed'
                          }`}
                          title={
                            isFutureDate 
                              ? `Apply leave for ${calDay.dateStr}` 
                              : isPast7Days 
                                ? `Add entry for ${calDay.dateStr}` 
                                : 'Date is outside the allowed range (past 7 days for timesheet, future dates for leave)'
                          }
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                            <path d="M12 5v14M5 12h14" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                          <span className="text-gray-600">Add</span>
                        </button>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Weekly Grid View for Week Mode */
          <div className={`grid grid-cols-7 gap-2 sm:gap-4 min-w-[700px] ${loading ? 'opacity-50' : ''}`}>
          {days.map((day) => {
            // Filter entries based on date range filter
            const today = dayjs().endOf('day');
            
            let dayEntries = entries[day.key as keyof typeof entries]
              .filter((entry) => {
                // Type filter
                if (typeFilter !== "all" && entry.type !== typeFilter) return false;
                
                return true;
              });
            
            const isToday = day.date.isSame(dayjs(), 'day');
            return (
            <div key={day.key} className={`border rounded-lg min-w-[100px] max-w-full overflow-hidden ${isToday ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-200'}`}>
              {/* Day Header */}
              <div 
                className={`p-2 sm:p-3 border-b ${isToday ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'} ${(() => {
                  const today = dayjs().endOf('day');
                  const sevenDaysAgo = dayjs().subtract(7, 'days').startOf('day');
                  const isPast7Days = !day.date.isAfter(today, 'day') && !day.date.isBefore(sevenDaysAgo, 'day');
                  const isFutureDate = day.date.isAfter(today, 'day');
                  return (isPast7Days || isFutureDate) ? 'cursor-pointer hover:bg-gray-100 transition-colors' : 'opacity-60';
                })()}`}
                onClick={() => {
                  const today = dayjs().endOf('day');
                  const sevenDaysAgo = dayjs().subtract(7, 'days').startOf('day');
                  const isPast7Days = !day.date.isAfter(today, 'day') && !day.date.isBefore(sevenDaysAgo, 'day');
                  const isFutureDate = day.date.isAfter(today, 'day');
                  if (isPast7Days || isFutureDate) {
                    handleDayCardClick(day.date);
                  }
                }}
                title={(() => {
                  const today = dayjs().endOf('day');
                  const sevenDaysAgo = dayjs().subtract(7, 'days').startOf('day');
                  const isPast7Days = !day.date.isAfter(today, 'day') && !day.date.isBefore(sevenDaysAgo, 'day');
                  const isFutureDate = day.date.isAfter(today, 'day');
                  if (isFutureDate) return `Click to apply leave for ${day.dateStr}`;
                  if (isPast7Days) return `Click to add entry for ${day.dateStr}`;
                  return 'Date is outside the allowed range (past 7 days for timesheet, future dates for leave)';
                })()}
              >
                <div className="flex items-center justify-between">
                  <div className={`text-xs sm:text-sm font-medium truncate ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>{day.label}</div>
                  <div className={`text-xs font-semibold ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>{day.dayNumber}</div>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">{day.dateStr}</div>
                <div className="flex items-center gap-1 mt-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                    <circle cx="12" cy="12" r="10" stroke="#6b7280" strokeWidth="2"/>
                    <path d="M12 6v6l4 2" stroke="#6b7280" strokeWidth="2"/>
                  </svg>
                  <span className="text-xs text-gray-600 truncate">
                    {dayEntries
                      .filter(entry => entry.type === "timesheet" && entry.status === "Approved")
                      .reduce((total, entry) => {
                        const hours = typeof entry.hours === 'string' ? parseFloat(entry.hours) : (entry.hours || 0);
                        return total + hours;
                      }, 0)
                      .toFixed(2)}h
                  </span>
                </div>
              </div>

              {/* Day Content */}
              <div className="p-2 sm:p-3 min-h-[200px] sm:min-h-[300px] space-y-2">
                {dayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => handleEntryClick(entry)}
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
                            {entry.type === "timesheet" ? entry.title : entry.leaveType}
                          </h4>
                        </div>
                      </div>
                      
                      {/* Tags row */}
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium ${
                          entry.type === "timesheet" 
                            ? "bg-blue-100 text-blue-700" 
                            : "bg-purple-100 text-purple-700"
                        }`}>
                          {entry.type === "timesheet" ? "TS" : "L"}
                        </span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium ${getStatusBadgeClass(entry.status)}`}>
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
                ))}

                {/* Add Entry Button */}
                {(() => {
                  const today = dayjs().endOf('day');
                  const sevenDaysAgo = dayjs().subtract(7, 'days').startOf('day');
                  const isPast7Days = !day.date.isAfter(today, 'day') && !day.date.isBefore(sevenDaysAgo, 'day');
                  const isFutureDate = day.date.isAfter(today, 'day');
                  // Enable button for past 7 days (timesheet) or future dates (leave)
                  const isEnabled = isPast7Days || isFutureDate;
                  
                  return (
                    <button 
                      onClick={() => handleAddEntry(day.date)}
                      disabled={!isEnabled}
                      className={`w-full border-2 border-dashed border-gray-300 rounded p-1 sm:p-2 flex items-center justify-center gap-1 sm:gap-2 transition-colors ${
                        isEnabled 
                          ? 'hover:border-gray-400 hover:bg-gray-50 cursor-pointer' 
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                      title={
                        isFutureDate 
                          ? `Apply leave for ${day.dateStr}` 
                          : isPast7Days 
                            ? `Add entry for ${day.dateStr}` 
                            : 'Date is outside the allowed range (past 7 days for timesheet, future dates for leave)'
                      }
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                        <path d="M12 5v14M5 12h14" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <span className="text-xs text-gray-600">Add Entry</span>
                    </button>
                  );
                })()}
              </div>
            </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Drawer with Tabs */}
      <Drawer
        title={selectedEntry 
          ? `View ${selectedEntry.type === "timesheet" ? "Timesheet" : "Leave"} Entry` 
          : (selectedDate && selectedDate.isAfter(dayjs().startOf('day'), 'day') 
            ? "Apply Leave" 
            : "Add Entry")}
        placement="right"
        onClose={handleCloseDrawer}
        open={drawerVisible}
        width={500}
        className="timesheet-drawer"
        styles={{
          body: { paddingTop: 0 }
        }}
      >
        {selectedEntry ? (
          selectedEntry.type === "timesheet" ? (
            <EnterTimesheetTab
              onClose={handleCloseDrawer}
              mode={selectedEntry.status === "Draft" ? "create" : "view"}
              entryData={selectedEntry.rawData || {
                task: selectedEntry.title,
                hours: selectedEntry.hours,
                mode: selectedEntry.mode,
                entryDate: selectedEntry.entryDate,
                description: "",
              }}
              hideActionButtons={selectedEntry.status !== "Draft"}
              onSuccess={handleTimesheetSubmitted}
            />
          ) : (
            <ApplyLeaveTab
              onClose={handleCloseDrawer}
              mode={selectedEntry.status === "Draft" ? "create" : "view"}
              entryData={selectedEntry.rawData || {
                leaveType: selectedEntry.leaveType,
                fromDate: selectedEntry.fromDate,
                toDate: selectedEntry.toDate,
                description: (selectedEntry.rawData && (selectedEntry.rawData.reason || selectedEntry.rawData.leave_reason)) || "",
                approval_status: selectedEntry.status,
                rejection_reason: selectedEntry.rejectionReason,
                // Pass attachments if present in API (SQL view returns attachments JSON array)
                attachments: Array.isArray(selectedEntry.rawData?.attachments)
                  ? selectedEntry.rawData.attachments.map((a: any) => ({
                      uid: String(a.id ?? a.file_name ?? Math.random()),
                      name: a.file_name || "attachment",
                      status: "done",
                      url: a.file_url || a.file_path || undefined,
                    }))
                  : [],
              }}
              hideActionButtons={selectedEntry.status !== "Draft"}
              onSuccess={handleLeaveSubmitted}
            />
          )
        ) : (
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: "timesheet",
                label: "Enter Timesheet",
                children: <EnterTimesheetTab onClose={handleCloseDrawer} initialDate={selectedDate} onSuccess={handleTimesheetSubmitted} />,
              },
              {
                key: "leave",
                label: "Apply Leave",
                children: <ApplyLeaveTab onClose={handleCloseDrawer} initialDate={selectedDate} onSuccess={handleLeaveSubmitted} />,
              },
            ]}
          />
        )}
      </Drawer>

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
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${getStatusBorderClass(entry.status)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                          getStatusTypeBadgeClass(entry.status)
                        }`}>
                          {entry.type === "timesheet" ? "TS" : "L"}
                        </span>
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusBadgeClass(entry.status)}`}>
                          {entry.status}
                        </span>
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-1 truncate">
                        {entry.type === "timesheet" ? entry.title : entry.leaveType}
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
                      {entry.entryDate && (
                        <p className="text-xs text-gray-500">
                          Entry Date: {dayjs(entry.entryDate).format("DD MMM YYYY")}
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


