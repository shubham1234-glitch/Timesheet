"use client";
import { useState, useMemo } from "react";
import { DatePicker, Drawer, Tabs, Select } from "antd";
import dayjs from "dayjs";
import { usePathname } from "next/navigation";
import EnterTimesheetTab from "../../employee/timesheet/EnterTimesheetTab";
import ApplyLeaveTab from "../../employee/timesheet/ApplyLeaveTab";

interface TimeEntry {
  id: string;
  title: string;
  hours: string;
  color: "green" | "red" | "blue";
}

export default function TimesheetView({ readOnly = false }: { readOnly?: boolean }) {
  const [fromDate, setFromDate] = useState<dayjs.Dayjs | null>(null);
  const [toDate, setToDate] = useState<dayjs.Dayjs | null>(null);
  const [teamMember, setTeamMember] = useState<string>("all");
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("timesheet");
  const pathname = usePathname();
  const isHR = pathname.includes('/hr/');
  const [entries] = useState<Record<string, TimeEntry[]>>({
    monday: [
      { id: "1", title: "UI Design", hours: "3/12", color: "green" },
      { id: "2", title: "UI Development", hours: "3/10", color: "red" },
    ],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  });

  const days = [
    { key: "monday", label: "Monday", hours: "8 Hours" },
    { key: "tuesday", label: "Tuesday", hours: "Total Hours" },
    { key: "wednesday", label: "Wednesday", hours: "Total Hours" },
    { key: "thursday", label: "Thursday", hours: "Total Hours" },
    { key: "friday", label: "Friday", hours: "Total Hours" },
    { key: "saturday", label: "Saturday", hours: "Total Hours" },
    { key: "sunday", label: "Sunday", hours: "8 Hours" },
  ];

  const getColorClass = (color: string) => {
    switch (color) {
      case "green": return "border-l-4 border-green-500";
      case "red": return "border-l-4 border-red-500";
      case "blue": return "border-l-4 border-blue-500";
      default: return "border-l-4 border-gray-300";
    }
  };

  const canShowGrid = !readOnly || teamMember !== 'all';

  const handleExport = () => {
    if (!canShowGrid) return;
    console.log('Export functionality would be implemented here');
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 flex-wrap relative">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label className="text-xs sm:text-sm text-gray-600">From Date</label>
            <DatePicker
              value={fromDate}
              onChange={setFromDate}
              placeholder="Select from date"
              className="w-full sm:w-40 h-8"
              format="DD-MM-YY"
              size="small"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label className="text-xs sm:text-sm text-gray-600">To Date</label>
            <DatePicker
              value={toDate}
              onChange={setToDate}
              placeholder="Select to date"
              className="w-full sm:w-40 h-8"
              format="DD-MM-YY"
              size="small"
              disabledDate={(current) => {
                if (!fromDate) return false;
                return current && current < fromDate.startOf('day');
              }}
            />
          </div>

          {readOnly && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <label className="text-xs sm:text-sm text-gray-600">Team Member</label>
              <Select
                value={teamMember}
                onChange={setTeamMember}
                className="w-full sm:w-44"
                size="small"
                options={[
                  { value: "all", label: "All Members" },
                  { value: "john", label: "John Doe" },
                  { value: "jane", label: "Jane Smith" },
                  { value: "alex", label: "Alex Johnson" },
                ]}
                getPopupContainer={(trigger) => trigger.parentElement || document.body}
              />
            </div>
          )}

          {isHR && (
            <button
              onClick={handleExport}
              disabled={!canShowGrid}
              className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Export CSV
            </button>
          )}

          <button className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
            Apply
          </button>
        </div>
      </div>

      {/* Weekly Grid */}
      {canShowGrid ? (
        <div key={readOnly ? teamMember : 'self'} className="overflow-x-auto tab-switch-anim">
          <div className="grid grid-cols-7 gap-2 sm:gap-4 min-w-[700px]">
            {days.map((day) => (
              <div key={day.key} className="border border-gray-200 rounded-lg min-w-[100px]">
                {/* Day Header */}
                <div className="p-2 sm:p-3 border-b border-gray-200 bg-gray-50">
                  <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">{day.label}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                      <circle cx="12" cy="12" r="10" stroke="#6b7280" strokeWidth="2"/>
                      <path d="M12 6v6l4 2" stroke="#6b7280" strokeWidth="2"/>
                    </svg>
                    <span className="text-xs text-gray-600 truncate">{day.hours}</span>
                  </div>
                </div>

                {/* Day Content */}
                <div className="p-2 sm:p-3 min-h-[200px] sm:min-h-[300px] space-y-2">
                  {entries[day.key as keyof typeof entries].map((entry) => (
                    <div
                      key={entry.id}
                      className={`bg-white border rounded p-1 sm:p-2 ${getColorClass(entry.color)}`}
                    >
                      <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">{entry.title}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-gray-600">{entry.hours}</span>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                          <circle cx="12" cy="12" r="10" stroke="#6b7280" strokeWidth="2"/>
                          <path d="M12 6v6l4 2" stroke="#6b7280" strokeWidth="2"/>
                        </svg>
                      </div>
                    </div>
                  ))}

                  {/* Add Entry Button (hidden when readOnly) */}
                  {!readOnly && (
                    <button 
                      onClick={() => setDrawerVisible(true)}
                      className="w-full border-2 border-dashed border-gray-300 rounded p-1 sm:p-2 flex items-center justify-center gap-1 sm:gap-2 hover:border-gray-400 hover:bg-gray-50"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                        <path d="M12 5v14M5 12h14" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <span className="text-xs text-gray-600">Add Entry</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-600">Please select a team member to view timesheet.</div>
      )}

      {/* Drawer with Tabs (hidden when readOnly) */}
      {!readOnly && (
        <Drawer
          title="Add Entry"
          placement="right"
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          width={500}
          className="timesheet-drawer"
          styles={{
            body: { paddingTop: 0 }
          }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: "timesheet",
                label: "Enter Timesheet",
                children: <EnterTimesheetTab onClose={() => setDrawerVisible(false)} />,
              },
              {
                key: "leave",
                label: "Apply Leave",
                children: <ApplyLeaveTab onClose={() => setDrawerVisible(false)} />,
              },
            ]}
          />
        </Drawer>
      )}
    </div>
  );
}