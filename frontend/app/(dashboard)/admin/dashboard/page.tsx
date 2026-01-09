"use client";

import { useState, useMemo, useEffect } from "react";
import { Tabs } from "antd";
import { Card, Row, Col, Statistic, Select, Spin } from "antd";
import { Pie, Bar } from "react-chartjs-2";
import { 
  ClockCircleOutlined, 
  WarningOutlined, 
  FileTextOutlined,
  TeamOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import { getTeamMemberOptions, onMasterDataChange } from "@/app/lib/masterData";
import { apiRequest } from "@/app/lib/api";
import { getUserFromStorage } from "@/app/lib/auth/storage";
import { pieChartOptions, barChartOptions } from "@/app/lib/chartConfig";
import { getPersonalizedGreeting } from "@/app/lib/greeting";

// Shared Dashboard Component - can be used for both "My Dashboard" and "Team Dashboard"
function DashboardView({ initialUserCode, showSelector = false, selectorLabel = "Select Team Member:", title = "Team Dashboard", subtitle = "Monitor team member performance and activity" }: {
  initialUserCode: string;
  showSelector?: boolean;
  selectorLabel?: string;
  title?: string;
  subtitle?: string;
}) {
  const [selectedMember, setSelectedMember] = useState<string>(initialUserCode || "");
  const [teamMemberOptions, setTeamMemberOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamDashboardData, setTeamDashboardData] = useState<any>(null);
  const [greeting, setGreeting] = useState<string>(title);

  // Initialize selected member from prop
  useEffect(() => {
    if (initialUserCode && !selectedMember) {
      setSelectedMember(initialUserCode);
    }
    // Personalized greeting for the logged-in admin
    try {
      const user = getUserFromStorage();
      const personalizedGreeting = getPersonalizedGreeting(user?.userName);
      setGreeting(personalizedGreeting);
    } catch {
      setGreeting(title);
    }
  }, [initialUserCode, selectedMember]);

  // Load team member options from master data (only if selector is shown)
  useEffect(() => {
    if (!showSelector) return;
    const updateOptions = () => setTeamMemberOptions(getTeamMemberOptions());
    updateOptions();
    const cleanup = onMasterDataChange(updateOptions);
    return cleanup;
  }, [showSelector]);

  // Fetch team dashboard data when member is selected
  useEffect(() => {
    const fetchTeamDashboardData = async () => {
      if (!selectedMember) {
        setTeamDashboardData(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        interface TeamDashboardApiResponse {
          success_flag: boolean;
          message: string;
          status_code: number;
          status_message: string;
          data: {
            user_code: string;
            user_name: string;
            total_hours_last_7_days: number;
            pending_approvals: {
              timesheet: number;
              leave: number;
              total: number;
            };
            tasks: {
              total: number;
              completed: number;
              in_progress: number;
              to_do: number;
              blocked: number;
              overdue: number;
            };
            timesheet_status: {
              approved: number;
              pending: number;
              rejected: number;
            };
            leave_registry: {
              total: number;
              taken: number;
              remaining: number;
            };
            daily_hours_last_7_days: Array<{
              date: string;
              entry_date: string;
              hours: number;
            }>;
          };
        }

        const endpoint = `get_team_dashboard_data?user_code=${encodeURIComponent(selectedMember)}`;
        const response = await apiRequest<TeamDashboardApiResponse>(endpoint, "GET");
        
        if (response?.success_flag && response.data) {
          setTeamDashboardData(response.data);
        } else {
          setError("Failed to fetch dashboard data");
        }
      } catch (err: any) {
        console.error("Error fetching dashboard data:", err);
        setError(err?.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchTeamDashboardData();
  }, [selectedMember]);

  // Calculate metrics from API data
  const metrics = useMemo(() => {
    if (!selectedMember || !teamDashboardData) {
      return null;
    }

    return {
      approvedTimesheets: teamDashboardData.timesheet_status?.approved || 0,
      pendingTimesheets: teamDashboardData.timesheet_status?.pending || 0,
      rejectedTimesheets: teamDashboardData.timesheet_status?.rejected || 0,
      pendingLeaves: teamDashboardData.pending_approvals?.leave || 0,
      approvedLeaves: teamDashboardData.leave_status?.approved || 0,
      totalHours: teamDashboardData.total_hours_last_7_days || 0,
      completedTasks: teamDashboardData.tasks?.completed || 0,
      tasksInProgress: teamDashboardData.tasks?.in_progress || 0,
      tasksToDo: teamDashboardData.tasks?.to_do || 0,
      tasksBlocked: teamDashboardData.tasks?.blocked || 0,
      overdueTasks: teamDashboardData.tasks?.overdue || 0,
      leaveUtilization: teamDashboardData.leave_registry?.total 
        ? Math.round((teamDashboardData.leave_registry.taken / teamDashboardData.leave_registry.total) * 100)
        : 0,
    };
  }, [selectedMember, teamDashboardData]);

  // Chart data - Timesheet Status (showing both timesheet and leave)
  const timesheetStatusChart = useMemo(() => {
    if (!metrics || !teamDashboardData) return null;
    
    const timesheetApproved = teamDashboardData.timesheet_status?.approved || 0;
    const timesheetPending = teamDashboardData.timesheet_status?.pending || 0;
    const timesheetRejected = teamDashboardData.timesheet_status?.rejected || 0;
    const leaveApproved = teamDashboardData.leave_status?.approved || 0;
    const leavePending = teamDashboardData.leave_status?.pending || 0;
    const leaveRejected = teamDashboardData.leave_status?.rejected || 0;
    
    return {
      labels: [
        "TS Approved", "TS Pending", "TS Rejected",
        "Leave Approved", "Leave Pending", "Leave Rejected"
      ],
      datasets: [{
        data: [
          timesheetApproved, timesheetPending, timesheetRejected,
          leaveApproved, leavePending, leaveRejected
        ],
        backgroundColor: [
          "#10b981", "#f59e0b", "#ef4444", // Timesheet colors
          "#3b82f6", "#fbbf24", "#f43f5e"  // Leave colors (distinct colors)
        ],
        borderWidth: 2,
        borderColor: '#ffffff',
      }],
    };
  }, [metrics, teamDashboardData]);

  // Chart data - Task Status (excluding overdue - overdue is a condition, not a status)
  // Note: Overdue tasks are already counted in their status categories (In Progress, To Do, etc.)
  const taskStatusChart = useMemo(() => {
    if (!metrics) return null;
    
    const completedTasks = metrics.completedTasks || 0;
    const tasksInProgress = metrics.tasksInProgress || 0;
    const tasksToDo = metrics.tasksToDo || 0;
    const tasksBlocked = metrics.tasksBlocked || 0;
    
    // Chart.js doesn't render slices with 0 values, so we use a very small value (0.01) 
    // to ensure slices appear in the chart when they're 0, but the tooltip will show the actual value
    return {
      labels: ["Completed", "In Progress", "To Do", "Blocked"],
      datasets: [{
        data: [
          completedTasks || 0.01, 
          tasksInProgress || 0.01, 
          tasksToDo || 0.01,
          tasksBlocked || 0.01
        ],
        backgroundColor: ["#10b981", "#3b82f6", "#6b7280", "#ef4444"],
        borderWidth: 2,
        borderColor: '#ffffff',
      }],
    };
  }, [metrics]);

  // Daily hours (last 7 days) from API
  const dailyHoursChart = useMemo(() => {
    if (!teamDashboardData?.daily_hours_last_7_days) return null;
    
    const dailyHoursData = teamDashboardData.daily_hours_last_7_days || [];
    
    return {
      labels: dailyHoursData.map((item: any) => item.date || dayjs(item.entry_date).format("DD/MM")),
      datasets: [{
        label: "Hours",
        data: dailyHoursData.map((item: any) => item.hours || 0),
        backgroundColor: "#0ea5e9",
        borderRadius: 4,
      }],
    };
  }, [teamDashboardData]);

  // Use shared chart options with custom tooltip callback for pie charts
  const pieOptions = useMemo(() => ({
    ...pieChartOptions,
    plugins: {
      ...pieChartOptions.plugins,
      tooltip: {
        ...pieChartOptions.plugins.tooltip,
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed || 0;
            // If value is very small (< 0.1), it's a placeholder for 0, so show 0
            const actualValue = value < 0.1 ? 0 : Math.round(value);
            // Calculate total from actual values (treating < 0.1 as 0)
            const dataArray = context.dataset.data as number[];
            const total = dataArray.reduce((sum: number, val: number) => {
              return sum + (val < 0.1 ? 0 : val);
            }, 0);
            const percentage = total > 0 ? ((actualValue / total) * 100).toFixed(1) : '0';
            return `${label}: ${actualValue} (${percentage}%)`;
          }
        },
      },
    },
  }), []);

  return (
    <div className="space-y-3" style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', padding: '0.75rem' }}>
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900 mb-0.5">{greeting}</h1>
            <p className="text-[10px] text-gray-600">{subtitle}</p>
          </div>
          {showSelector && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-700 whitespace-nowrap">{selectorLabel}</label>
              <Select
                value={selectedMember}
                onChange={setSelectedMember}
                placeholder="Choose a team member"
                style={{ width: 240, minWidth: 180 }}
                size="middle"
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
                options={teamMemberOptions}
                notFoundContent={teamMemberOptions.length === 0 ? "No team members found" : "No matches"}
                className="team-member-selector"
              />
            </div>
          )}
        </div>
      </div>

      {!selectedMember ? (
        <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="text-center max-w-md px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 mb-4">
              <TeamOutlined style={{ fontSize: '32px', color: '#3b82f6' }} />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1.5">
              {showSelector ? "Select a Team Member" : "Loading Dashboard"}
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              {showSelector 
                ? "Choose a team member from the dropdown above to view their detailed dashboard metrics, task progress, and timesheet information."
                : "Please wait while we load your dashboard data..."}
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <Spin size="large" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-3 py-2 rounded-lg shadow-sm">
          <div className="flex items-center gap-2">
            <WarningOutlined className="text-sm" />
            <p className="text-xs font-medium">{error}</p>
          </div>
        </div>
      ) : metrics && teamDashboardData ? (
        <div className="space-y-3">
          {/* Key Metrics Cards */}
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12} lg={6} xl={6}>
              <Card 
                className="h-full border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-blue-50 to-blue-100" 
                styles={{ body: { padding: '16px' } }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <ClockCircleOutlined className="text-blue-600 text-lg" />
                  </div>
                  <div className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">Last 7 days</div>
                </div>
                <Statistic
                  title={<span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Total Hours</span>}
                  value={metrics.totalHours}
                  valueStyle={{ color: '#1e40af', fontFamily: 'var(--font-poppins), Poppins, sans-serif', fontSize: '20px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6} xl={6}>
              <Card 
                className="h-full border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-amber-50 to-orange-100" 
                styles={{ body: { padding: '16px' } }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <WarningOutlined className="text-amber-600 text-lg" />
                  </div>
                  {(metrics.pendingTimesheets + metrics.pendingLeaves) > 0 && (
                    <div className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">Action Required</div>
                  )}
                </div>
                <Statistic
                  title={<span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Pending Approvals</span>}
                  value={metrics.pendingTimesheets + metrics.pendingLeaves}
                  valueStyle={{ color: '#d97706', fontFamily: 'var(--font-poppins), Poppins, sans-serif', fontSize: '20px', fontWeight: 'bold' }}
                />
                <div className="text-[10px] text-gray-600 mt-1.5 font-medium">
                  {metrics.pendingTimesheets} TS, {metrics.pendingLeaves} Leave
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6} xl={6}>
              <Card 
                className="h-full border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-cyan-50 to-sky-100" 
                styles={{ body: { padding: '16px' } }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-cyan-500/10">
                    <FileTextOutlined className="text-cyan-600 text-lg" />
                  </div>
                  <div className="text-[10px] font-semibold text-cyan-700 bg-cyan-100 px-1.5 py-0.5 rounded-full">
                    {metrics.completedTasks}/{teamDashboardData.tasks?.total || 0} done
                  </div>
                </div>
                <Statistic
                  title={<span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Total Tasks</span>}
                  value={teamDashboardData.tasks?.total || 0}
                  valueStyle={{ color: '#0891b2', fontFamily: 'var(--font-poppins), Poppins, sans-serif', fontSize: '20px', fontWeight: 'bold' }}
                />
                <div className="text-[10px] text-gray-600 mt-1.5 font-medium">
                  {metrics.completedTasks} completed
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6} xl={6}>
              <Card 
                className={`h-full border-0 shadow-md hover:shadow-lg transition-all duration-300 ${metrics.overdueTasks > 0 ? 'bg-gradient-to-br from-red-50 to-rose-100' : 'bg-gradient-to-br from-green-50 to-emerald-100'}`}
                styles={{ body: { padding: '16px' } }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${metrics.overdueTasks > 0 ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                    <WarningOutlined className={`${metrics.overdueTasks > 0 ? 'text-red-600' : 'text-green-600'} text-lg`} />
                  </div>
                  {metrics.overdueTasks > 0 && (
                    <div className="text-[10px] font-semibold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">Urgent</div>
                  )}
                </div>
                <Statistic
                  title={<span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Overdue Tasks</span>}
                  value={metrics.overdueTasks}
                  valueStyle={{ 
                    color: metrics.overdueTasks > 0 ? '#dc2626' : '#059669', 
                    fontFamily: 'var(--font-poppins), Poppins, sans-serif', 
                    fontSize: '20px', 
                    fontWeight: 'bold' 
                  }}
                />
                <div className="text-[10px] text-gray-600 mt-1.5 font-medium">
                  {metrics.overdueTasks > 0 ? 'Action required' : 'All on track'}
                </div>
              </Card>
            </Col>
          </Row>

          {/* Charts Row */}
          <Row gutter={[12, 12]}>
            {timesheetStatusChart && (
              <Col xs={24} sm={12} lg={8}>
                <Card
                  title={
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                      <span className="text-sm font-bold text-gray-900">Timesheet Status</span>
                    </div>
                  }
                  className="shadow-md hover:shadow-lg transition-all duration-300 border-0 bg-white"
                  styles={{ 
                    header: { 
                      fontFamily: 'var(--font-poppins), Poppins, sans-serif', 
                      padding: '12px 16px', 
                      borderBottom: '2px solid #e5e7eb',
                      backgroundColor: '#f9fafb'
                    },
                    body: { padding: '16px', fontFamily: 'var(--font-poppins), Poppins, sans-serif' } 
                  }}
                >
                  <div style={{ height: 220, width: '100%', position: 'relative' }}>
                    <Pie data={timesheetStatusChart} options={pieOptions} redraw={false} />
                  </div>
                </Card>
              </Col>
            )}

            {taskStatusChart && (
              <Col xs={24} sm={12} lg={8}>
                <Card
                  title={
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 bg-cyan-500 rounded-full"></div>
                      <span className="text-sm font-bold text-gray-900">Task Status</span>
                    </div>
                  }
                  className="shadow-md hover:shadow-lg transition-all duration-300 border-0 bg-white"
                  styles={{ 
                    header: { 
                      fontFamily: 'var(--font-poppins), Poppins, sans-serif', 
                      padding: '12px 16px', 
                      borderBottom: '2px solid #e5e7eb',
                      backgroundColor: '#f9fafb'
                    },
                    body: { padding: '16px', fontFamily: 'var(--font-poppins), Poppins, sans-serif' } 
                  }}
                >
                  <div style={{ height: 220, width: '100%', position: 'relative' }}>
                    <Pie data={taskStatusChart} options={pieOptions} redraw={false} />
                  </div>
                </Card>
              </Col>
            )}

            {dailyHoursChart && (
              <Col xs={24} sm={12} lg={8}>
                <Card
                  title={
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 bg-teal-500 rounded-full"></div>
                      <span className="text-sm font-bold text-gray-900">Daily Hours (Last 7 Days)</span>
                    </div>
                  }
                  className="shadow-md hover:shadow-lg transition-all duration-300 border-0 bg-white"
                  styles={{ 
                    header: { 
                      fontFamily: 'var(--font-poppins), Poppins, sans-serif', 
                      padding: '12px 16px', 
                      borderBottom: '2px solid #e5e7eb',
                      backgroundColor: '#f9fafb'
                    },
                    body: { padding: '16px', fontFamily: 'var(--font-poppins), Poppins, sans-serif' } 
                  }}
                >
                  <div style={{ height: 220 }}>
                    <Bar data={dailyHoursChart} options={barChartOptions} redraw={false} />
                  </div>
                </Card>
              </Col>
            )}
          </Row>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminDashboardPage() {
  const user = getUserFromStorage();
  const adminUserCode = user?.userCode || "";

  const tabItems = [
    {
      key: "my",
      label: "My Dashboard",
      children: <DashboardView 
        initialUserCode={adminUserCode} 
        showSelector={false} 
        title="My Dashboard"
        subtitle="Track your productivity and work progress"
      />,
    },
    {
      key: "team",
      label: "Team Dashboard",
      children: <DashboardView 
        initialUserCode="" 
        showSelector={true} 
        selectorLabel="Select Team Member:"
        title="Team Dashboard"
        subtitle="Monitor team member performance and activity"
      />,
    },
  ];

  return (
    <div className="p-2 sm:p-4">
      <Tabs items={tabItems} defaultActiveKey="my" />
    </div>
  );
}
