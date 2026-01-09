"use client";

import React, { useMemo } from "react";
import dayjs from "dayjs";

interface Task {
  id: string;
  title: string;
  startDate: string;
  dueDate: string;
  estimatedHours: number;
  priority?: string;
}

interface SimpleGanttChartProps {
  tasks: Task[];
}

export default function SimpleGanttChart({ tasks }: SimpleGanttChartProps) {
  const chartData = useMemo(() => {
    if (!tasks.length) return null;

    const parsed = tasks
      .map((t) => {
        const start = dayjs(t.startDate);
        const end = dayjs(t.dueDate || t.startDate);
        return start.isValid() && end.isValid()
          ? { ...t, start, end }
          : null;
      })
      .filter(Boolean) as (Task & { start: dayjs.Dayjs; end: dayjs.Dayjs })[];

    if (!parsed.length) return null;

    let minStart = parsed[0].start.startOf('day');
    let maxEnd = parsed[0].end.endOf('day');
    parsed.forEach((t) => {
      if (t.start.isBefore(minStart)) minStart = t.start.startOf('day');
      if (t.end.isAfter(maxEnd)) maxEnd = t.end.endOf('day');
    });

    // Extend range by 7 days on each side for better visibility
    minStart = minStart.subtract(7, 'day');
    maxEnd = maxEnd.add(7, 'day');

    const totalDays = Math.max(maxEnd.diff(minStart, "day") + 1, 1);
    const today = dayjs().startOf('day');
    const todayOffset = today.diff(minStart, "day");

    // Group dates by month for better organization
    const dateGroups: Array<{ date: dayjs.Dayjs; isWeekend: boolean; label: string; monthLabel?: string; showLabel: boolean; dayOfWeek: string }> = [];
    const monthRanges: Array<{ month: string; startIdx: number; endIdx: number }> = [];
    let currentMonth = '';
    let monthStartIdx = 0;
    
    // Determine interval based on total days
    const dayInterval = totalDays > 90 ? 7 : totalDays > 60 ? 5 : totalDays > 30 ? 3 : totalDays > 14 ? 2 : 1;
    
    for (let i = 0; i < totalDays; i++) {
      const date = minStart.add(i, "day");
      const isWeekend = date.day() === 0 || date.day() === 6;
      const monthLabel = date.format("MMM YYYY");
      const showMonthLabel = monthLabel !== currentMonth;
      
      if (showMonthLabel) {
        if (currentMonth && monthStartIdx < i) {
          monthRanges.push({ month: currentMonth, startIdx: monthStartIdx, endIdx: i - 1 });
        }
        currentMonth = monthLabel;
        monthStartIdx = i;
      }
      
      // Show label for: first/last day, first of month, or at interval
      const showLabel = i === 0 || 
                       i === totalDays - 1 || 
                       date.date() === 1 ||
                       (i % dayInterval === 0 && !isWeekend);
      
      dateGroups.push({
        date,
        isWeekend,
        label: date.format("DD"),
        monthLabel: showMonthLabel ? monthLabel : undefined,
        showLabel,
        dayOfWeek: date.format("ddd"),
      });
    }
    
    // Add last month range
    if (currentMonth && monthStartIdx < totalDays) {
      monthRanges.push({ month: currentMonth, startIdx: monthStartIdx, endIdx: totalDays - 1 });
    }

    const taskRows = parsed.map((t) => {
      const offset = Math.max(t.start.diff(minStart, "day"), 0);
      const length = Math.max(t.end.diff(t.start, "day") + 1, 1);
      const leftPercentage = (offset / totalDays) * 100;
      const widthPercentage = (length / totalDays) * 100;
      const isOverdue = t.end.isBefore(today, 'day');
      // Check if task is active (today is between start and end, inclusive)
      const isActive = !t.start.isAfter(today, 'day') && !t.end.isBefore(today, 'day');
      return {
        ...t,
        offset,
        length,
        leftPercentage,
        widthPercentage,
        isOverdue,
        isActive,
      };
    });

    return { dateGroups, taskRows, totalDays, todayOffset, minStart, maxEnd, monthRanges };
  }, [tasks]);

  if (!chartData) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No tasks selected for timeline view
      </div>
    );
  }

  const getPriorityColor = (priority?: string) => {
    if (!priority) return "bg-blue-500";
    const num = Number(priority);
    if (!isNaN(num)) {
      if (num === 3) return "bg-red-500";
      if (num === 2) return "bg-orange-500";
      if (num === 1) return "bg-green-500";
    }
    const p = priority.toLowerCase();
    if (p.includes("high")) return "bg-red-500";
    if (p.includes("medium")) return "bg-orange-500";
    if (p.includes("low")) return "bg-green-500";
    return "bg-blue-500";
  };

  // Calculate minimum day width for better readability
  const minDayWidth = 28;
  const totalWidth = Math.max(chartData.totalDays * minDayWidth, 1200);
  const dayWidth = 100 / chartData.totalDays;
  const dayWidthPx = totalWidth / chartData.totalDays;

  return (
    <div className="w-full overflow-x-auto bg-white border border-gray-200 rounded-lg">
      {/* Month Headers - Jira style with start/due date lines */}
      <div className="relative border-b-2 border-gray-300 bg-gray-50" style={{ minWidth: `${totalWidth}px` }}>
        <div className="flex">
          <div className="w-48 flex-shrink-0 border-r border-gray-300 bg-gray-50 px-3 py-2 flex items-center">
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Task</span>
          </div>
          <div className="flex-1 relative" style={{ width: `${totalWidth}px`, minHeight: '50px', paddingTop: '32px' }}>
            {chartData.monthRanges.map((range) => {
              const startPx = (range.startIdx * dayWidthPx);
              const widthPx = ((range.endIdx - range.startIdx + 1) * dayWidthPx);
              
              return (
                <div
                  key={`month-${range.startIdx}`}
                  className="absolute border-r border-gray-300 bg-gray-50 px-3 flex items-center"
                  style={{
                    left: `${startPx}px`,
                    width: `${widthPx}px`,
                    top: '32px',
                    bottom: '0',
                  }}
                >
                  <span className="text-xs font-semibold text-gray-800">{range.month}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Task Rows - Jira style */}
      <div className="space-y-0" style={{ minWidth: `${totalWidth}px` }}>
        {chartData.taskRows.map((task) => (
          <div 
            key={task.id} 
            className={`relative h-10 flex items-center border-b border-gray-200 hover:bg-gray-50/50 transition-colors ${
              task.isOverdue ? 'bg-red-50/20' : 'bg-white'
            }`}
          >
            <div className="w-48 flex-shrink-0 border-r border-gray-300 px-3 py-2 bg-white">
              <div className="flex items-center gap-1.5">
                <div 
                  className={`text-[11px] font-medium truncate ${
                    task.isOverdue ? 'text-red-700' : 'text-gray-900'
                  }`} 
                  title={task.title}
                >
                  {task.title}
                </div>
              </div>
            </div>

            <div className="flex-1 relative h-full bg-white" style={{ width: `${totalWidth}px` }}>
              {/* Weekend background */}
              {chartData.dateGroups.map((group, idx) => (
                group.isWeekend && (
                  <div
                    key={`weekend-${idx}`}
                    className="absolute top-0 bottom-0 bg-gray-50/30"
                    style={{
                      left: `${idx * dayWidthPx}px`,
                      width: `${dayWidthPx}px`,
                    }}
                  />
                )
              ))}
              
              {/* Task bar - Jira style */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 h-6 rounded ${
                  task.isOverdue 
                    ? 'bg-red-600 border border-red-700' 
                    : getPriorityColor(task.priority)
                } ${task.isActive ? 'ring-2 ring-blue-400 ring-offset-0' : ''} hover:opacity-95 hover:shadow-md transition-all cursor-pointer`}
                style={{
                  left: `${task.offset * dayWidthPx}px`,
                  width: `${task.length * dayWidthPx}px`,
                  minWidth: "8px",
                }}
                title={`${task.title}\n${dayjs(task.start).format("DD MMM YYYY")} - ${dayjs(task.end).format("DD MMM YYYY")}\n${task.isOverdue ? 'OVERDUE' : task.isActive ? 'IN PROGRESS' : ''}`}
              >
                {/* Subtle gradient for depth */}
                <div className="absolute inset-0 rounded bg-gradient-to-b from-white/10 to-transparent"></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 px-2 pb-2 flex items-center gap-4 text-[10px] flex-wrap border-t border-gray-200 pt-2">
        <span className="text-gray-600 font-semibold">Priority:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-red-500 rounded-sm" />
          <span>High</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-orange-500 rounded-sm" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-green-500 rounded-sm" />
          <span>Low</span>
        </div>
        {chartData.taskRows.some(t => t.isOverdue) && (
          <>
            <span className="text-gray-600 font-semibold ml-2">Status:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-red-600 border border-red-800 rounded-sm" />
              <span className="text-red-700">Overdue</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
