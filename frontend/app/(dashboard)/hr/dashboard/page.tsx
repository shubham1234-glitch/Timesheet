"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, Row, Col, Statistic, Tag, Select, Spin } from "antd";
import TimesheetDashboard from "@/app/components/TimesheetDashboard";
import { Pie, Bar } from "react-chartjs-2";
import { 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  WarningOutlined, 
  UserOutlined,
  FileTextOutlined,
  TeamOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import { getAllEmployeeOptions, onMasterDataChange } from "@/app/lib/masterData";
import { getPersonalizedGreeting } from "@/app/lib/greeting";
import { getUserFromStorage } from "@/app/lib/auth/storage";
import { pieChartOptions, barChartOptions } from "@/app/lib/chartConfig";

// My Dashboard Component (same as employee dashboard)
export function MyDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [greeting, setGreeting] = useState<string>("My Dashboard");
  
  useEffect(() => {
    const user = getUserFromStorage();
    const personalizedGreeting = getPersonalizedGreeting(user?.userName);
    setGreeting(personalizedGreeting);
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { apiRequest } = await import("@/app/lib/api");
        
        interface DashboardApiResponse {
          success_flag: boolean;
          message: string;
          status_code: number;
          status_message: string;
          data: {
            user_code: string;
            user_name: string;
            total_hours_worked: number;
            avg_hours_per_day: number;
            total_tasks: number;
            completed_tasks: number;
            to_do_tasks: number;
            in_progress_tasks: number;
            on_hold_tasks: number;
            hours_by_project: Array<{
              epic_id: number;
              epic_title: string;
              total_hours: number;
            }>;
            daily_work_hours: Array<{
              day: string;
              day_of_week: number;
              hours: number;
            }>;
            approval_stats: {
              approved: number;
              pending: number;
              rejected: number;
              approval_rate: number;
            };
            leave_registry: {
              total: number;
              taken: number;
              remaining: number;
            };
          };
        }

        const response = await apiRequest<DashboardApiResponse>("get_dashboard_data", "GET");
        
        if (response?.success_flag && response.data) {
          const data = response.data;
          
          // Map API response to TimesheetDashboard props format
          const mappedData = {
    overview: { 
              totalHoursWorked: data.total_hours_worked || 0,
              averageHoursPerDay: data.avg_hours_per_day || 0,
              totalTasks: data.total_tasks || 0,
              tasksBreakdown: {
                completed: data.completed_tasks || 0,
                toDo: data.to_do_tasks || 0,
                inProgress: data.in_progress_tasks || 0,
                onHold: data.on_hold_tasks || 0,
              },
            },
            hoursByProject: (data.hours_by_project || []).map((item) => ({
              project: item.epic_title || "Unknown",
              hours: item.total_hours || 0,
            })),
            dailyHours: (data.daily_work_hours || [])
              .filter((item) => item.hours > 0) // Only show days with hours
              .map((item) => ({
                date: item.day || "N/A",
                hours: item.hours || 0,
              })),
            approval: {
              approved: data.approval_stats?.approved || 0,
              pending: data.approval_stats?.pending || 0,
              rejected: data.approval_stats?.rejected || 0,
            },
            // Leave Registry - Commented out per requirement
            // leaveSummary: {
            //   total: data.leave_registry?.total || 0,
            //   taken: data.leave_registry?.taken || 0,
            //   remaining: data.leave_registry?.remaining || 0,
            // },
          };
          
          setDashboardData(mappedData);
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

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '0.75rem' }}>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3">
          <h1 className="text-lg font-bold text-gray-900">{greeting}</h1>
          <p className="text-xs text-gray-600 mt-0.5">Track your productivity and work progress</p>
        </div>
        <div className="flex items-center justify-center py-8">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '0.75rem' }}>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3">
          <h1 className="text-lg font-bold text-gray-900">{greeting}</h1>
          <p className="text-xs text-gray-600 mt-0.5">Track your productivity and work progress</p>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded">
          <p className="text-xs">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '0.75rem' }}>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3">
        <h1 className="text-base font-bold text-gray-900">{greeting}</h1>
        <p className="text-[10px] text-gray-600 mt-0.5">Track your productivity and work progress</p>
      </div>
      {dashboardData && <TimesheetDashboard {...dashboardData} />}
    </div>
  );
}

// Team Dashboard Component - Shows data for selected team member
interface TimesheetEntry {
  id: string;
  employee: string;
  date: string;
  type: "timesheet" | "leave";
  status: "Pending" | "Approved" | "Rejected";
  hours?: number;
  leaveType?: string;
  fromDate?: string;
  toDate?: string;
  task?: string;
  mode?: string;
}

interface LeaveStatus {
  employee: string;
  totalLeaves: number;
  leavesTaken: number;
  leavesRemaining: number;
}

interface TeamTask {
  id: string;
  taskName: string;
  assignee: string;
  dueDate: string;
  status: "To Do" | "In Progress" | "Completed";
  priority: "High" | "Medium" | "Low";
}

function TeamDashboard() {
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [teamMemberOptions, setTeamMemberOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamDashboardData, setTeamDashboardData] = useState<any>(null);

  // Load employee options from master data (all employees for HR)
  useEffect(() => {
    const updateOptions = () => setTeamMemberOptions(getAllEmployeeOptions());
    updateOptions();
    const cleanup = onMasterDataChange(updateOptions);
    return cleanup;
  }, []);

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
        const { apiRequest } = await import("@/app/lib/api");
        
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
          setError("Failed to fetch team dashboard data");
        }
      } catch (err: any) {
        console.error("Error fetching team dashboard data:", err);
        setError(err?.message || "Failed to load team dashboard data");
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
      overdueTasks: teamDashboardData.tasks?.overdue || 0,
      leaveUtilization: teamDashboardData.leave_registry?.total 
        ? Math.round((teamDashboardData.leave_registry.taken / teamDashboardData.leave_registry.total) * 100)
        : 0,
    };
  }, [selectedMember, teamDashboardData]);

  // Get member data for compatibility
  const memberData = useMemo(() => {
    if (!teamDashboardData) {
      return {
        timesheets: [],
        leaves: [],
        tasks: [],
        leaveStatus: null,
      };
    }

    return {
      timesheets: [],
      leaves: [],
      tasks: [],
      leaveStatus: teamDashboardData.leave_registry ? {
        employee: teamDashboardData.user_name,
        totalLeaves: teamDashboardData.leave_registry.total,
        leavesTaken: teamDashboardData.leave_registry.taken,
        leavesRemaining: teamDashboardData.leave_registry.remaining,
      } : null,
    };
  }, [teamDashboardData]);

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
    
    // Chart.js doesn't render slices with 0 values, so we use a very small value (0.01) 
    // to ensure "To Do" appears in the chart when it's 0, but the tooltip will show the actual value
    return {
      labels: ["Completed", "In Progress", "To Do"],
      datasets: [{
        data: [
          completedTasks || 0.01, 
          tasksInProgress || 0.01, 
          tasksToDo || 0.01
        ],
        backgroundColor: ["#10b981", "#3b82f6", "#6b7280"],
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

  // Use shared chart options with custom tooltip callback
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
            const actualValue = value < 0.1 ? 0 : Math.round(value);
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
            <h1 className="text-lg font-bold text-gray-900 mb-0.5">Team Dashboard</h1>
            <p className="text-[10px] text-gray-600">Monitor team member performance and activity</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-700 whitespace-nowrap">Select Employee:</label>
            <Select
              value={selectedMember}
              onChange={setSelectedMember}
              placeholder="Choose an employee"
              style={{ width: 240, minWidth: 180 }}
              size="middle"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
              options={teamMemberOptions}
              notFoundContent={teamMemberOptions.length === 0 ? "No employees found" : "No matches"}
              className="team-member-selector"
            />
          </div>
        </div>
      </div>

      {!selectedMember ? (
        <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="text-center max-w-md px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 mb-4">
              <TeamOutlined style={{ fontSize: '32px', color: '#3b82f6' }} />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1.5">Select an Employee</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Choose an employee from the dropdown above to view their detailed dashboard metrics, task progress, and timesheet information.
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

            {/* Leave Balance Card - Commented out */}
            {/* <Col xs={24} sm={12} lg={8} xl={4}>
              <Card 
                className="h-full border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-emerald-50 to-teal-100" 
                styles={{ body: { padding: '16px' } }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <CheckCircleOutlined className="text-emerald-600 text-lg" />
                  </div>
                </div>
                <Statistic
                  title={<span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Leave Balance</span>}
                  value={memberData.leaveStatus?.leavesRemaining || 0}
                  valueStyle={{ color: '#059669', fontFamily: 'var(--font-poppins), Poppins, sans-serif', fontSize: '20px', fontWeight: 'bold' }}
                />
                <div className="text-[10px] text-gray-600 mt-1.5 font-medium">
                  {memberData.leaveStatus?.leavesTaken || 0}/{memberData.leaveStatus?.totalLeaves || 0} used
                </div>
              </Card>
            </Col> */}

            {/* Leave Usage metric card - Commented out */}
            {/* <Col xs={24} sm={12} lg={8} xl={4}>
              <Card 
                className={`h-full border-0 shadow-md hover:shadow-lg transition-all duration-300 ${
                  metrics.leaveUtilization > 75 ? 'bg-gradient-to-br from-red-50 to-rose-100' : 
                  metrics.leaveUtilization > 50 ? 'bg-gradient-to-br from-amber-50 to-orange-100' : 
                  'bg-gradient-to-br from-green-50 to-emerald-100'
                }`}
                styles={{ body: { padding: '16px' } }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${
                    metrics.leaveUtilization > 75 ? 'bg-red-500/10' : 
                    metrics.leaveUtilization > 50 ? 'bg-amber-500/10' : 
                    'bg-green-500/10'
                  }`}>
                    <UserOutlined className={
                      metrics.leaveUtilization > 75 ? 'text-red-600' : 
                      metrics.leaveUtilization > 50 ? 'text-amber-600' : 
                      'text-green-600'
                    } style={{ fontSize: '18px' }} />
                  </div>
                </div>
                <Statistic
                  title={<span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Leave Usage</span>}
                  value={metrics.leaveUtilization}
                  suffix="%"
                  valueStyle={{ 
                    color: metrics.leaveUtilization > 75 ? '#dc2626' : metrics.leaveUtilization > 50 ? '#d97706' : '#059669',
                    fontFamily: 'var(--font-poppins), Poppins, sans-serif', 
                    fontSize: '20px', 
                    fontWeight: 'bold' 
                  }}
                />
                <div className="text-[10px] text-gray-600 mt-1.5 font-medium">
                  {metrics.leaveUtilization > 75 ? 'High usage' : metrics.leaveUtilization > 50 ? 'Moderate' : 'Low usage'}
                </div>
              </Card>
            </Col> */}
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

export default function HRDashboardPage() {
  return (
    <div className="p-2 sm:p-4">
      <TeamDashboard />
    </div>
  );
}
