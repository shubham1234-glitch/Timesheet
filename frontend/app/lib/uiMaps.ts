"use client";

import React from "react";
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from "@ant-design/icons";
import { Approval, Status } from "@/app/types/domain";

// Map various backend labels to canonical UI labels
export type DisplayStatus = "To Do" | "In Progress" | "Done" | "Blocked" | "On Hold";

export function getStatusDisplayLabel(raw: string): DisplayStatus {
  const s = (raw || '').toLowerCase();
  // Check for already-normalized labels first
  if (s === 'blocked') return 'Blocked';
  if (s === 'to do' || s === 'todo') return 'To Do';
  if (s === 'in progress' || s === 'progress') return 'In Progress';
  if (s === 'on hold') return 'On Hold';
  if (s === 'done' || s === 'closed' || s === 'completed') return 'Done';
  // Then check for raw backend labels
  if (s.includes('not yet started')) return 'To Do';
  if (s.includes('in progress') || s.includes('progress')) return 'In Progress';
  if (s.includes('on hold')) return 'On Hold';
  if (s.includes('cancelled') || s.includes('canceled')) return 'Blocked'; // rename
  if (s.includes('closed') || s.includes('done') || s.includes('completed')) return 'Done'; // rename
  return 'To Do';
}

// Tailwind text color class for dropdown labels
export function getStatusTextColor(label: string): string {
  const l = getStatusDisplayLabel(label);
  switch (l) {
    case 'To Do': return 'text-gray-700'; // grey/black
    case 'In Progress': return 'text-yellow-600';
    case 'On Hold': return 'text-orange-600';
    case 'Blocked': return 'text-red-600';
    case 'Done': return 'text-green-600';
    default: return 'text-gray-700';
  }
}

// AntD Tag color name or Tailwind bg proxy if needed by consumers
export const statusTagColor = (status: string | Status) => {
  const l = getStatusDisplayLabel(String(status));
  switch (l) {
    case 'To Do': return 'default'; // grey
    case 'In Progress': return 'gold'; // yellow-ish in antd
    case 'On Hold': return 'orange';
    case 'Blocked': return 'red';
    case 'Done': return 'green';
    default: return 'default';
  }
};

export const approvalHighlight = (approval: Approval) => {
  switch (approval) {
    case "Pending": return "bg-orange-100 text-orange-800 px-2 py-1 rounded font-medium";
    case "Approved": return "bg-green-100 text-green-800 px-2 py-1 rounded font-medium";
    case "Rejected": return "bg-red-100 text-red-800 px-2 py-1 rounded font-medium";
    default: return "";
  }
};

// Priority helpers (High=red, Medium=yellow, Low=green)
export function getPriorityTextColor(label: string): string {
  const s = (label || '').toLowerCase();
  if (s.includes('high')) return 'text-red-600';
  if (s.includes('medium')) return 'text-yellow-600';
  return 'text-green-600';
}

export function priorityTagColor(priority: string): string {
  const s = (priority || '').toLowerCase();
  if (s.includes('high')) return 'red';
  if (s.includes('medium')) return 'gold';
  return 'green';
}

// Priority icon component
export function getPriorityIcon(priority: string): React.ReactNode {
  const s = (priority || '').toLowerCase();
  if (s.includes('high')) return React.createElement(ArrowUpOutlined, { style: { color: '#ef4444' } }); // red-500
  if (s.includes('medium')) return React.createElement(MinusOutlined, { style: { color: '#eab308' } }); // yellow-500
  if (s.includes('low')) return React.createElement(ArrowDownOutlined, { style: { color: '#22c55e' } }); // green-500
  return React.createElement(MinusOutlined, { style: { color: '#6b7280' } }); // gray-500
}


