"use client";

import { useMemo } from "react";
import { exportToCSV } from "@/app/lib/export";
import { Table, Tag, Tooltip } from "antd";

type Task = {
  id: string;
  title: string;
  team: string;
  assignee: string;
  priority: "Low" | "Medium" | "High";
  status: "Open" | "In Progress" | "Review" | "Done";
  createdAt: string; // ISO date
  startedAt?: string; // ISO date
  completedAt?: string; // ISO date
  dueDate?: string; // ISO date
  reopenedCount?: number;
};

type Timesheet = {
  employee: string;
  date: string; // ISO date
  hours: number; // logged hours
  billable: boolean;
  submittedAt?: string;
  approvedAt?: string;
};

type Leave = {
  employee: string;
  type: "Sick" | "Planned" | "Unplanned" | "Casual";
  fromDate: string;
  toDate: string;
  status: "Pending" | "Approved" | "Rejected";
};

// Mock data (replace with real API/data fetching later)
const mockTasks: Task[] = [
  { id: "T-101", title: "Onboarding flow", team: "Core", assignee: "Ava", priority: "High", status: "Done", createdAt: ago(12), startedAt: ago(11), completedAt: ago(4), dueDate: ago(5), reopenedCount: 1 },
  { id: "T-102", title: "Billing bugfix", team: "Payments", assignee: "Liam", priority: "High", status: "In Progress", createdAt: ago(8), startedAt: ago(7), dueDate: inDays(2) },
  { id: "T-103", title: "Marketing site revamp", team: "Web", assignee: "Mia", priority: "Medium", status: "Open", createdAt: ago(3), dueDate: inDays(10) },
  { id: "T-104", title: "SLA monitor", team: "SRE", assignee: "Noah", priority: "High", status: "Review", createdAt: ago(15), startedAt: ago(10), dueDate: ago(1) },
  { id: "T-105", title: "Data export v2", team: "Core", assignee: "Ethan", priority: "Low", status: "Done", createdAt: ago(20), startedAt: ago(18), completedAt: ago(2), dueDate: inDays(1) },
];

const mockTimesheets: Timesheet[] = [
  // simplified last 7 days
  ...[0,1,2,3,4,5,6].map(d => ({ employee: "Ava", date: agoDate(d), hours: d % 6 === 0 ? 0 : 8, billable: true, submittedAt: ago(d - 0.5) })),
  ...[0,1,2,3,4,5,6].map(d => ({ employee: "Liam", date: agoDate(d), hours: 7.5, billable: true, submittedAt: d % 3 === 0 ? undefined : ago(d - 0.3) })),
  ...[0,1,2,3,4,5,6].map(d => ({ employee: "Mia", date: agoDate(d), hours: 6, billable: false, submittedAt: ago(d - 0.2) })),
  ...[0,1,2,3,4,5,6].map(d => ({ employee: "Noah", date: agoDate(d), hours: 8, billable: true, submittedAt: ago(d - 0.4) })),
  ...[0,1,2,3,4,5,6].map(d => ({ employee: "Ethan", date: agoDate(d), hours: 5.5, billable: false, submittedAt: ago(d - 0.1) })),
];

const mockLeave: Leave[] = [
  { employee: "Ava", type: "Planned", fromDate: inDays(14), toDate: inDays(16), status: "Approved" },
  { employee: "Liam", type: "Sick", fromDate: ago(1), toDate: ago(0), status: "Approved" },
];

function daysBetween(a?: string, b?: string) {
  if (!a || !b) return undefined;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24));
}

function ago(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function inDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function agoDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function pct(n: number, d: number) {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

function tileClass() {
  return "rounded-lg border border-gray-200 bg-white p-4 shadow-sm";
}

function bar(color: string, percent: number) {
  return (
    <div className="h-2 w-full rounded bg-gray-100">
      <div className="h-2 rounded" style={{ width: `${Math.min(100, Math.max(0, percent))}%`, backgroundColor: color }} />
    </div>
  );
}

export default function SuperAdminPerformancePage() {
  const teams = useMemo(() => Array.from(new Set(mockTasks.map(t => t.team))).sort(), []);
  const teamToEmployees = useMemo(() => {
    const map = new Map<string, Set<string>>();
    mockTasks.forEach(t => {
      if (!map.has(t.team)) map.set(t.team, new Set());
      map.get(t.team)!.add(t.assignee);
    });
    return map;
  }, []);

  const { kpis, rows, explanations } = useMemo(() => {
    const now = new Date();

    const tasks = mockTasks;
    const timesheets = mockTimesheets;

    const completed = tasks.filter(t => t.status === "Done" && t.completedAt);
    const onTime = completed.filter(t => t.dueDate && new Date(t.completedAt!) <= new Date(t.dueDate!));
    const avgCycleDays = average(
      completed
        .map(t => daysBetween(t.startedAt ?? t.createdAt, t.completedAt))
        .filter((x): x is number => typeof x === "number")
    );

    const overdueOpen = tasks.filter(t => t.status !== "Done" && t.dueDate && new Date(t.dueDate) < now);

    // Timesheet adherence (submission rate last 7 days), averaged
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });
    const submissionAvg = Math.round(
      average(
        days.map(day => {
          const entries = timesheets.filter(t => t.date === day);
          const submitted = entries.filter(t => !!t.submittedAt).length;
          return pct(submitted, Math.max(1, entries.length));
        })
      )
    );

    const totalHours = timesheets.reduce((s, r) => s + r.hours, 0);
    const billableHours = timesheets.filter(r => r.billable).reduce((s, r) => s + r.hours, 0);
    const utilization = pct(billableHours, Math.max(1, totalHours));

    const kpis = {
      teamsCount: teams.length,
      onTimeRate: pct(onTime.length, Math.max(1, completed.length)),
      overduePercent: pct(overdueOpen.length, Math.max(1, tasks.length)),
      avgCycleDays: isFinite(avgCycleDays) ? Number(avgCycleDays.toFixed(1)) : 0,
      submissionAvg,
      utilization,
    };

    const rows = computeTeamsRows();

    const explanations = {
      teams: "Number of distinct teams with tasks",
      onTime: `${onTime.length}/${completed.length} completed on/before due date`,
      overdue: `${overdueOpen.length}/${tasks.length} open tasks past due`,
      submission: "7-day average of daily (submitted timesheets / total timesheets)",
      utilization: `${billableHours.toFixed(1)}/${totalHours.toFixed(1)} billable hours`,
    } as const;

    return { kpis, rows, explanations };
  }, [teams.length, teamToEmployees]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Teams performance</h1>
      </div>

      {/* Summary tiles (compact) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiTile label="Teams" value={`${kpis.teamsCount}`} accent="#0ea5e9" tooltip={explanations.teams} />
        <KpiTile label="On-time %" value={`${kpis.onTimeRate}%`} accent="#10b981" percent={kpis.onTimeRate} tooltip={explanations.onTime} />
        <KpiTile label="Overdue %" value={`${kpis.overduePercent}%`} accent="#ef4444" percent={kpis.overduePercent} tooltip={explanations.overdue} />
        <KpiTile label="Timesheet %" value={`${kpis.submissionAvg}%`} accent="#f59e0b" percent={kpis.submissionAvg} tooltip={explanations.submission} />
        <KpiTile label="Utilization %" value={`${kpis.utilization}%`} accent="#0ea5e9" percent={kpis.utilization} tooltip={explanations.utilization} />
      </div>

      {/* Charts removed for simplicity */}

      {/* Overdue table removed for simplicity */}

      {/* Teams scorecard */}
      <div className={tileClass()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium">Teams scorecard</div>
          <button
            className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50"
            onClick={() => exportToCSV(
              `teams-scorecard-${new Date().toISOString().slice(0,10)}`,
              [
                { key: "team", header: "Team" },
                { key: "open", header: "Open tasks" },
                { key: "onTime", header: "On-time %" },
                { key: "overdue", header: "Overdue %" },
                { key: "submission", header: "Timesheet %" },
                { key: "util", header: "Utilization %" },
              ] as any,
              rows.map(r => ({ team: r.team, open: r.open, onTime: r.onTime, overdue: r.overdue, submission: r.submission, util: r.util })) as any
            )}
          >
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
        <Table
          size="small"
          className="tasks-table"
          rowKey={(r) => r.team}
          dataSource={rows}
          pagination={{ pageSize: 5, showSizeChanger: false }}
          scroll={{ x: 600 }}
          columns={[
            {
              title: "Team",
              dataIndex: "team",
              key: "team",
              sorter: (a: any, b: any) => a.team.localeCompare(b.team),
              render: (text: string) => <span className="font-medium">{text}</span>,
            },
            {
              title: "Open tasks",
              dataIndex: "open",
              key: "open",
              sorter: (a: any, b: any) => a.open - b.open,
              align: "right" as const,
            },
            {
              title: "On-time %",
              dataIndex: "onTime",
              key: "onTime",
              sorter: (a: any, b: any) => a.onTime - b.onTime,
              align: "right" as const,
              render: (v: number) => <Tag color="green" bordered={false}>{v}%</Tag>,
            },
            {
              title: "Overdue %",
              dataIndex: "overdue",
              key: "overdue",
              sorter: (a: any, b: any) => a.overdue - b.overdue,
              align: "right" as const,
              render: (v: number) => <Tag color="red" bordered={false}>{v}%</Tag>,
            },
            {
              title: "Timesheet %",
              dataIndex: "submission",
              key: "submission",
              sorter: (a: any, b: any) => a.submission - b.submission,
              align: "right" as const,
              render: (v: number) => <Tag color="orange" bordered={false}>{v}%</Tag>,
            },
            {
              title: "Utilization %",
              dataIndex: "util",
              key: "util",
              sorter: (a: any, b: any) => a.util - b.util,
              align: "right" as const,
              render: (v: number) => <Tag color="blue" bordered={false}>{v}%</Tag>,
            },
          ]}
        />
        </div>
      </div>
    </div>
  );
}

function average(nums: number[]) {
  if (!nums.length) return 0;
  const sum = nums.reduce((s, n) => s + n, 0);
  return sum / nums.length;
}

function KpiTile(props: { label: string; value: string; accent: string; percent?: number; tooltip?: string }) {
  const { label, value, accent, percent, tooltip } = props;
  return (
    <div className={tileClass()}>
      <div className="text-xs text-gray-500 flex items-center gap-1">
        <span>{label}</span>
        {tooltip && (
          <Tooltip title={tooltip} placement="top">
            <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 text-[10px] text-gray-500 cursor-help">?</span>
          </Tooltip>
        )}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {typeof percent === "number" && (
        <div className="mt-2">
          {bar(accent, percent)}
        </div>
      )}
    </div>
  );
}

//

type TeamRow = {
  team: string;
  throughput: number;
  onTime: number;
  overdue: number;
  cycle: number;
  submission: number;
  util: number;
  open: number;
};

function computeTeamsRows(): TeamRow[] {
  const teams = Array.from(new Set(mockTasks.map(t => t.team))).sort();
  const teamToEmployees = new Map<string, Set<string>>();
  mockTasks.forEach(t => {
    if (!teamToEmployees.has(t.team)) teamToEmployees.set(t.team, new Set());
    teamToEmployees.get(t.team)!.add(t.assignee);
  });
  const now = new Date();

  const rows: TeamRow[] = teams.map(team => {
    const employees = Array.from(teamToEmployees.get(team) ?? new Set());
    const tasks = mockTasks.filter(t => t.team === team);
    const ts = mockTimesheets.filter(x => employees.includes(x.employee));
    const completed = tasks.filter(t => t.status === "Done" && t.completedAt);
    const openTasks = tasks.filter(t => t.status !== "Done").length;
    const onTime = pct(completed.filter(t => t.dueDate && new Date(t.completedAt!) <= new Date(t.dueDate!)).length, Math.max(1, completed.length));
    const overdue = pct(tasks.filter(t => t.status !== "Done" && t.dueDate && new Date(t.dueDate) < now).length, Math.max(1, tasks.length));
    const avgCycle = average(
      completed
        .map(t => daysBetween(t.startedAt ?? t.createdAt, t.completedAt))
        .filter((x): x is number => typeof x === "number")
    );
    const throughput14 = Array.from({ length: 14 }).reduce<number>((acc, _, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const key = d.toISOString().slice(0, 10);
      return acc + completed.filter(t => t.completedAt!.slice(0, 10) === key).length;
    }, 0);
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });
    const submissionAvg = Math.round(
      average(
        days.map(day => {
          const entries = ts.filter(t => t.date === day);
          const submitted = entries.filter(t => !!t.submittedAt).length;
          return pct(submitted, Math.max(1, entries.length));
        })
      )
    );
    const totalHours = ts.reduce((s, r) => s + r.hours, 0);
    const billableHours = ts.filter(r => r.billable).reduce((s, r) => s + r.hours, 0);
    const util = pct(billableHours, Math.max(1, totalHours));

    return {
      team,
      throughput: throughput14,
      onTime,
      overdue,
      cycle: isFinite(avgCycle) ? Number(avgCycle.toFixed(1)) : 0,
      submission: submissionAvg,
      util,
      open: openTasks,
    };
  });

  // Rank primarily by on-time, then lower overdue, then higher throughput
  rows.sort((a, b) => {
    if (b.onTime !== a.onTime) return b.onTime - a.onTime;
    if (a.overdue !== b.overdue) return a.overdue - b.overdue;
    return b.throughput - a.throughput;
  });

  return rows;
}
