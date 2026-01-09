// Extracted SVG icons to prevent recreation on every render
import React from 'react';

const iconClass = "w-4 h-4 text-gray-500";

export const DashboardIcon = React.memo(() => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12h7V3H3v9zM14 21h7v-9h-7v9zM14 3v6h7V3h-7zM3 21h7v-6H3v6z"/>
  </svg>
));

export const TimesheetIcon = React.memo(() => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2v3M16 2v3M3 9h18M5 5h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>
  </svg>
));

export const TeamTimesheetIcon = React.memo(() => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
));

export const TasksIcon = React.memo(() => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11h11M9 7h11M9 15h11M5 7h.01M5 11h.01M5 15h.01"/>
  </svg>
));

export const EpicsIcon = React.memo(() => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7l9-4 9 4-9 4-9-4z"/>
    <path d="M3 17l9 4 9-4"/>
    <path d="M3 12l9 4 9-4"/>
  </svg>
));

export const PerformanceIcon = React.memo(() => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18"/>
    <path d="M7 13l3 3 7-7"/>
  </svg>
));

export const LeaveRegistryIcon = React.memo(() => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <path d="M14 2v6h6"/>
  </svg>
));

export const DefaultIcon = React.memo(() => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
));

const iconMap: Record<string, React.ComponentType> = {
  "Dashboard": DashboardIcon,
  "Timesheet": TimesheetIcon,
  "Team Timesheet": TeamTimesheetIcon,
  "Tasks": TasksIcon,
  "Available Tasks": TasksIcon,
  "Epics": EpicsIcon,
  "Performance": PerformanceIcon,
  "Leave Registry": LeaveRegistryIcon,
};

export const getSidebarIcon = (label: string): React.ComponentType => {
  return iconMap[label] || DefaultIcon;
};

