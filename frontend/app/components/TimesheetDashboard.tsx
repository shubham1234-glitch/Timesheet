"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

type Overview = {
  totalHoursWorked?: number;
  averageHoursPerDay?: number;
  totalTasks?: number;
  tasksBreakdown?: { completed?: number; toDo?: number; inProgress?: number; onHold?: number };
};

type ApprovalSplit = { approved?: number; pending?: number; rejected?: number };

type RecentEntry = {
  date: string;
  project: string;
  hours: number;
  description: string;
  status: string;
};

export type TimesheetDashboardProps = {
  overview?: Overview;
  hoursByProject?: { project: string; hours: number }[];
  dailyHours?: { date: string; hours: number }[];
  approval?: ApprovalSplit;
  leaveSummary?: { total?: number; taken?: number; remaining?: number; upcoming?: number };
  attendanceHeat?: { date: string; intensity: 0 | 1 | 2 | 3 }[]; // 0 none, 3 high
};

const cardCls = "bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 p-3 sm:p-4";
const h2Cls = "text-xs font-semibold mb-1.5 text-gray-800";
const kpiNum = "text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent";

function useCountUp(target: number, durationMs: number = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * t));
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, durationMs]);
  return value;
}

export default function TimesheetDashboard({
  overview,
  hoursByProject,
  dailyHours,
  approval,
  leaveSummary,
  attendanceHeat,
}: TimesheetDashboardProps) {
  const ov = overview || {};
  const hbP = hoursByProject || [];
  const dH = dailyHours || [];
  const appr = approval || {};
  const leave = leaveSummary || {};
  const heat = attendanceHeat || [];

  // Minimal chart placeholders to avoid extra deps
  const maxProj = Math.max(1, ...hbP.map((x) => x.hours));
  const maxDaily = Math.max(1, ...dH.map((x) => x.hours));
  const approved = appr.approved ?? 0;
  const pending = appr.pending ?? 0;
  const rejected = appr.rejected ?? 0;
  const totalDecisions = Math.max(1, approved + pending + rejected);
  const approvedPct = Math.round((approved / totalDecisions) * 100);
  const pendingPct = Math.round((pending / totalDecisions) * 100);
  const rejectedPct = Math.max(0, 100 - approvedPct - pendingPct);
  const approvalSegments = useMemo(() => {
    const segments = [
      { value: approved, color: "#22c55e" },
      { value: pending, color: "#f59e0b" },
      { value: rejected, color: "#ef4444" },
    ];
    const total = segments.reduce((sum, seg) => sum + (seg.value ?? 0), 0);
    if (total <= 0) {
      return [];
    }
    return segments.map((seg) => ({
      ...seg,
      fraction: Math.max(0, Math.min(1, (seg.value ?? 0) / total)),
    }));
  }, [approved, pending, rejected]);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 8 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.4 }} 
          whileHover={{ y: -4, scale: 1.02 }} 
          className={`${cardCls} bg-gradient-to-br from-blue-50 to-blue-100/30 relative overflow-hidden`}
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-200/20 rounded-full -mr-8 -mt-8"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 rounded-lg bg-blue-500/10">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className={h2Cls}>Total Hours Worked</div>
            </div>
            <div className={kpiNum}>{useCountUp(ov.totalHoursWorked ?? 0)}</div>
            <div className="text-[10px] text-gray-600 mt-0.5">Current month</div>
          </div>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 8 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.45, delay: 0.05 }} 
          whileHover={{ y: -4, scale: 1.02 }} 
          className={`${cardCls} bg-gradient-to-br from-green-50 to-green-100/30 relative overflow-hidden`}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-200/20 rounded-full -mr-12 -mt-12"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 rounded-lg bg-green-500/10">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className={h2Cls}>Avg Hours / Day</div>
            </div>
            <div className={kpiNum}>{useCountUp(ov.averageHoursPerDay ?? 0)}</div>
            <div className="text-[10px] text-gray-600 mt-0.5">Daily average</div>
          </div>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 8 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5, delay: 0.1 }} 
          whileHover={{ y: -4, scale: 1.02 }} 
          className={`${cardCls} bg-gradient-to-br from-purple-50 to-purple-100/30 relative group`}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-200/20 rounded-full -mr-12 -mt-12"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1.5 rounded-lg bg-purple-500/10">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className={h2Cls}>Total Tasks</div>
            </div>
            <div className={kpiNum}>{useCountUp(ov.totalTasks ?? 0)}</div>
            <div className="text-[10px] text-gray-600 mt-0.5">All tasks</div>
            
          </div>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 8 }} 
          whileInView={{ opacity: 1, y: 0 }} 
          viewport={{ once: true }} 
          transition={{ duration: 0.45 }} 
          className={`${cardCls} bg-gradient-to-br from-indigo-50 to-indigo-100/30 relative overflow-hidden`}
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-200/20 rounded-full -mr-10 -mt-10"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/10">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className={h2Cls}>Hours by Epics</div>
            </div>
          <div className="space-y-2">
            {hbP.length === 0 ? (
              <div className="text-[10px] text-gray-500">No data</div>
            ) : (
              [...hbP]
                .sort((a, b) => b.hours - a.hours)
                .map((row, idx) => (
                  <div key={row.project} className="text-[10px]">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block px-1.5 py-[1px] rounded-full text-[9px] ${idx === 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{idx === 0 ? 'Top' : idx + 1}</span>
                        <span className="text-gray-700 font-medium">{row.project}</span>
                      </div>
                      <span className="font-semibold">{row.hours}h</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
                      <motion.div
                        className="h-1.5 rounded"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${Math.max(6, (row.hours / maxProj) * 100)}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        style={{
                          background: 'linear-gradient(90deg, #93c5fd 0%, #3b82f6 50%, #2563eb 100%)',
                        }}
                      />
                    </div>
                  </div>
                ))
            )}
          </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 8 }} 
          whileInView={{ opacity: 1, y: 0 }} 
          viewport={{ once: true }} 
          transition={{ duration: 0.45, delay: 0.05 }} 
          className={`${cardCls} bg-gradient-to-br from-teal-50 to-teal-100/30 relative overflow-hidden`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-200/20 rounded-full -mr-16 -mt-16"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="p-1.5 rounded-lg bg-teal-500/10">
                <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <div className={h2Cls}>Daily Work Hours</div>
            </div>
          {dH.length === 0 ? (
            <div className="text-[10px] text-gray-500">No data</div>
          ) : (
            <div className="w-full h-32">
              {/* Simple SVG line chart without external libs */}
              {(() => {
                const padding = { top: 10, right: 12, bottom: 18, left: 24 };
                const width = 600; // logical width (scaled by viewBox)
                const height = 160; // logical height
                const innerW = width - padding.left - padding.right;
                const innerH = height - padding.top - padding.bottom;
                const maxY = Math.max(1, ...dH.map(p => p.hours));
                const stepX = innerW / Math.max(1, dH.length - 1);
                const pts = dH.map((p, i) => {
                  const x = padding.left + i * stepX;
                  const y = padding.top + (1 - (p.hours / maxY)) * innerH;
                  return { x, y };
                });
                const points = pts.map(p => `${p.x},${p.y}`).join(' ');
                const pathD = pts.reduce((acc, p, i) => acc + `${i === 0 ? 'M' : 'L'}${p.x},${p.y} `, '');
                const xLabels = dH.map((p, i) => ({
                  x: padding.left + i * stepX,
                  label: p.date,
                }));
                const yTicks = 4;
                const ticks = Array.from({ length: yTicks + 1 }, (_, i) => {
                  const t = i / yTicks;
                  const value = Math.round((1 - t) * maxY);
                  const y = padding.top + t * innerH;
                  return { y, value };
                });
                return (
                  <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                    {/* Axes */}
                    <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + innerH} stroke="#e5e7eb" />
                    <line x1={padding.left} y1={padding.top + innerH} x2={padding.left + innerW} y2={padding.top + innerH} stroke="#e5e7eb" />
                    {/* Y grid */}
                    {ticks.map((t, i) => (
                      <g key={i}>
                        <line x1={padding.left} y1={t.y} x2={padding.left + innerW} y2={t.y} stroke="#f1f5f9" />
                        <text x={padding.left - 6} y={t.y + 3} fontSize="9" textAnchor="end" fill="#94a3b8">{t.value}</text>
                      </g>
                    ))}
                    {/* Line */}
                    <motion.path
                      d={pathD}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="1.5"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      style={{ filter: 'drop-shadow(0 0 1px rgba(59,130,246,0.3))' }}
                    />
                    {/* Dots */}
                    {pts.map((p, i) => (
                      <motion.circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#3b82f6" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 + i * 0.06, duration: 0.25 }} />
                    ))}
                    {/* X labels */}
                    {xLabels.map((l, i) => (
                      <text key={i} x={l.x} y={padding.top + innerH + 12} fontSize="9" textAnchor="middle" fill="#94a3b8">{l.label}</text>
                    ))}
                  </svg>
                );
              })()}
            </div>
          )}
          </div>
        </motion.div>
      </div>

      {/* Approval */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-3 sm:gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 8 }} 
          whileInView={{ opacity: 1, y: 0 }} 
          viewport={{ once: true }} 
          transition={{ duration: 0.45 }} 
          className={`${cardCls} bg-gradient-to-br from-orange-50 to-orange-100/30 relative overflow-hidden`}
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-orange-200/20 rounded-full -mr-8 -mt-8"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="p-1.5 rounded-lg bg-orange-500/10">
                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className={h2Cls}>Approval Rate</div>
            </div>
            <div className="flex items-center gap-3">
            <div className="relative" style={{ width: 100, height: 100 }}>
              {(() => {
                const size = 100;
                const stroke = 10;
                const r = (size - stroke) / 2;
                const cx = size / 2;
                const cy = size / 2;
                const C = 2 * Math.PI * r;
                const segments = approvalSegments.length
                  ? approvalSegments
                  : [{ color: "#d1d5db", fraction: 1 }];
                let cumulative = 0;
                return (
                  <>
                    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
                      {segments.map((seg, idx) => {
                        const start = cumulative;
                        const remaining = Math.max(0, 1 - start);
                        const rawFrac = Math.min(1, Math.max(0, seg.fraction ?? 0));
                        const frac = idx === segments.length - 1 ? remaining : Math.min(rawFrac, remaining);
                        const safeFrac = Math.max(0, Math.min(1, frac));
                        const length = safeFrac * C;
                        const offset = C * (1 - start);
                        const dashArray = length > 0 ? `${length} ${C - length}` : `0 ${C}`;
                        cumulative += safeFrac;
                        return (
                          <motion.circle
                            key={`${seg.color}-${idx}`}
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={stroke}
                            strokeLinecap="round"
                            strokeDasharray={dashArray}
                            strokeDashoffset={offset}
                            initial={{ strokeDasharray: `0 ${C}`, strokeDashoffset: C }}
                            animate={{ strokeDasharray: dashArray, strokeDashoffset: offset }}
                            transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 * idx }}
                          />
                        );
                      })}
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center">
                        <div className="text-sm font-semibold text-gray-800">{approvedPct}%</div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="text-[10px] text-gray-700 space-y-1.5 mt-2">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-50 border border-green-200">
                <span className="w-2 h-2 rounded-full bg-green-500" /> 
                <span className="font-medium">Approved:</span> 
                <span className="ml-auto font-semibold text-green-700">{approved}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-yellow-50 border border-yellow-200">
                <span className="w-2 h-2 rounded-full bg-yellow-500" /> 
                <span className="font-medium">Pending:</span> 
                <span className="ml-auto font-semibold text-yellow-700">{pending}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-50 border border-red-200">
                <span className="w-2 h-2 rounded-full bg-red-500" /> 
                <span className="font-medium">Rejected:</span> 
                <span className="ml-auto font-semibold text-red-700">{rejected}</span>
              </div>
            </div>
          </div>
          </div>
        </motion.div>

        {/* Leave Registry - Commented out per requirement */}
        {/* <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: 0.05 }} className={cardCls}>
          <div className={h2Cls}>Leave Registry</div>
          {(() => {
            const total = Number(leave.total ?? ((leave.taken ?? 0) + (leave.remaining ?? 0)));
            const taken = Number(leave.taken ?? 0);
            const remaining = Number(leave.remaining ?? Math.max(0, total - taken));
            const pct = total > 0 ? Math.min(100, Math.max(0, (taken / total) * 100)) : 0;
            return (
              <>
                <div className="text-xs text-gray-700 mb-2">Total {total} • Taken {taken} • Remaining {remaining}</div>
                <div className="mb-1 flex items-center gap-2">
                  <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden relative">
                    <motion.div className="h-3 bg-green-400" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
                    <div className="absolute -top-4 text-[10px] text-gray-600" style={{ left: `calc(${pct}% - 4px)` }}>{taken}</div>
                  </div>
                </div>
                <div className="flex justify-between text-[11px] text-gray-500"><span>0</span><span>{total}</span></div>
                <div className="mt-3 space-y-1 text-sm">
                  <div><span className="font-semibold">Total:</span> {total}</div>
                  <div><span className="font-semibold">Leaves Taken:</span> {taken}</div>
                  <div><span className="font-semibold">Remaining:</span> {remaining}</div>
                </div>
              </>
            );
          })()}
        </motion.div> */}
      </div>

      {/* Entries and Insights removed per requirement */}
    </div>
  );
}


