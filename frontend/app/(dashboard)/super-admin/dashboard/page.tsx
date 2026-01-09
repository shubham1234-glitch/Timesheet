"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Tabs } from "antd";
import { Card, Row, Col, Statistic, Select, Spin, Tag } from "antd";
import { Pie, Bar } from "react-chartjs-2";
import { 
  ClockCircleOutlined, 
  WarningOutlined, 
  FileTextOutlined,
  TeamOutlined,
  CheckCircleFilled
} from "@ant-design/icons";
import dayjs from "dayjs";
import { getAllEmployeeOptions, getProductOptions, onMasterDataChange } from "@/app/lib/masterData";
import { apiRequest } from "@/app/lib/api";
import { getUserFromStorage } from "@/app/lib/auth/storage";
import { getPersonalizedGreeting } from "@/app/lib/greeting";
import { AnimatePresence, motion } from "framer-motion";
import { pieChartOptions, barChartOptions } from "@/app/lib/chartConfig";

// Team Dashboard Component
function TeamDashboardView() {
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamDashboardData, setTeamDashboardData] = useState<any>(null);
  const [greeting, setGreeting] = useState<string>("Team Dashboard");

  // Load employee options from master data
  useEffect(() => {
    const updateOptions = () => setEmployeeOptions(getAllEmployeeOptions());
    updateOptions();
    const cleanup = onMasterDataChange(updateOptions);
    return cleanup;
  }, []);

  // Initialize greeting from logged-in user
  useEffect(() => {
    try {
      const user = getUserFromStorage();
      const personalizedGreeting = getPersonalizedGreeting(user?.userName);
      setGreeting(personalizedGreeting);
    } catch {
      setGreeting("Team Dashboard");
    }
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
            <h1 className="text-lg font-bold text-gray-900 mb-0.5">{greeting}</h1>
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
              options={employeeOptions}
              notFoundContent={employeeOptions.length === 0 ? "No employees found" : "No matches"}
              className="employee-selector"
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

// Product Dashboard Component
interface SuperAdminDashboardApiResponse {
  success_flag: boolean;
  data: {
    product_code: string;
    product_name: string;
    overview: {
      total_epics: number;
      active_epics: number;
      completed_epics: number;
      overdue_epics: number;
      completion_rate: number;
      pending_approvals: number;
    };
    status_distribution: {
      in_progress: number;
      on_hold: number;
      done: number;
      closed: number;
      other: number;
      detailed: Array<{
        status_code: string;
        status_description: string;
        count: number;
      }>;
    };
    hours_by_epic: Array<{
      epic_id: number;
      epic_title: string;
      total_hours: number;
    }>;
  } | Array<{
    product_code: string;
    product_name: string;
    overview: {
      total_epics: number;
      active_epics: number;
      completed_epics: number;
      overdue_epics: number;
      completion_rate: number;
      pending_approvals: number;
    };
    status_distribution: {
      in_progress: number;
      on_hold: number;
      done: number;
      closed: number;
      other: number;
      detailed: Array<{
        status_code: string;
        status_description: string;
        count: number;
      }>;
    };
    hours_by_epic: Array<{
      epic_id: number;
      epic_title: string;
      total_hours: number;
    }>;
  }> | null;
  message: string;
  status_code: number;
  status_message: string;
}

function ProductDashboardView() {
  const [productOptions, setProductOptions] = useState(getProductOptions());
  const [selectedProduct, setSelectedProduct] = useState<string | undefined>(
    productOptions.length > 0 ? productOptions[0].value : undefined
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<SuperAdminDashboardApiResponse['data'] | null>(null);
  
  useEffect(() => {
    const update = () => {
      const options = getProductOptions();
      setProductOptions(options);
      if (!selectedProduct && options.length > 0) {
        setSelectedProduct(options[0].value);
      }
    };
    const unsub = onMasterDataChange(update);
    update();
    return unsub;
  }, []);

  const fetchDashboardData = useCallback(async (productCode: string | undefined) => {
    if (!productCode) {
      setDashboardData(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const endpoint = `get_super_admin_dashboard_data?product_code=${encodeURIComponent(productCode)}`;
      const response = await apiRequest<SuperAdminDashboardApiResponse>(endpoint, "GET");

      if (response?.success_flag) {
        if (!response.data) {
          setDashboardData(null);
          setError(null);
          return;
        }
        
        if (Array.isArray(response.data)) {
          const productData = response.data.find(p => p.product_code === productCode);
          if (productData) {
            setDashboardData(productData);
            setError(null);
          } else {
            setDashboardData(null);
            setError(null);
          }
        } else {
          setDashboardData(response.data);
          setError(null);
        }
      } else {
        setError("Failed to fetch dashboard data");
        setDashboardData(null);
      }
    } catch (err: any) {
      console.error("Error fetching super admin dashboard data:", err);
      setError(err?.message || "Failed to load dashboard data");
      setDashboardData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(selectedProduct);
  }, [selectedProduct, fetchDashboardData]);

  const { overview, chartData } = useMemo(() => {
    // Ensure dashboardData is a single object, not an array
    const data = Array.isArray(dashboardData) ? null : dashboardData;
    
    if (!data) {
      return {
        overview: {
          totalEpics: 0,
          activeEpics: 0,
          pendingApprovals: 0,
          overdueCount: 0,
          completionRate: 0,
        },
        chartData: {
          epicStatus: {
            labels: [],
            datasets: [{
              data: [],
              backgroundColor: ["#16a34a", "#3b82f6", "#f59e0b", "#9ca3af", "#6b7280"],
              borderWidth: 0,
            }],
          },
          hoursByEpic: {
            labels: [],
            datasets: [{
              label: "Hours",
              data: [],
              backgroundColor: "#0ea5e9",
              borderRadius: 6,
            }],
          },
        },
      };
    }

    const overview = {
      totalEpics: data.overview.total_epics,
      activeEpics: data.overview.active_epics,
      pendingApprovals: data.overview.pending_approvals,
      overdueCount: data.overview.overdue_epics,
      completionRate: Math.round(data.overview.completion_rate),
    };

    const statusLabels: string[] = [];
    const statusData: number[] = [];
    const statusColors: string[] = [];
    
    data.status_distribution.detailed.forEach((status: { status_code: string; status_description: string; count: number }) => {
      statusLabels.push(status.status_description);
      statusData.push(status.count);
      if (status.status_code === 'STS007') statusColors.push("#3b82f6");
      else if (status.status_code === 'STS005') statusColors.push("#f59e0b");
      else if (status.status_code === 'STS002') statusColors.push("#16a34a");
      else if (status.status_code === 'STS010') statusColors.push("#6b7280");
      else statusColors.push("#9ca3af");
    });

    const epicHoursLabels = data.hours_by_epic.map((epic: { epic_id: number; epic_title: string; total_hours: number }) => {
      const title = epic.epic_title || 'Untitled Epic';
      return title.length > 20 
        ? title.substring(0, 20) + '...' 
        : title;
    });
    const epicHoursData = data.hours_by_epic.map((epic: { epic_id: number; epic_title: string; total_hours: number }) => epic.total_hours);

    const chartData = {
      epicStatus: {
        labels: statusLabels,
        datasets: [{
          data: statusData,
          backgroundColor: statusColors.length > 0 ? statusColors : ["#16a34a", "#3b82f6", "#f59e0b", "#9ca3af", "#6b7280"],
          borderWidth: 0,
        }],
      },
      hoursByEpic: {
        labels: epicHoursLabels,
        datasets: [{
          label: "Hours",
          data: epicHoursData,
          backgroundColor: "#0ea5e9",
          borderRadius: 6,
        }],
      },
    };

    return { overview, chartData };
  }, [dashboardData]);

  // Use shared chart options
  const pieOptions = useMemo(() => pieChartOptions, []);
  const barOptions = useMemo(() => barChartOptions, []);

  return (
    <div className="p-3 sm:p-4 space-y-4" style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif', backgroundColor: '#f8fafc' }}>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-0.5">Product Dashboard</h1>
            <p className="text-xs text-gray-600">Monitor epics, productivity, and team performance</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-700 whitespace-nowrap">Product:</label>
            <Select
              placeholder="Select a product"
              value={selectedProduct}
              onChange={setSelectedProduct}
              options={productOptions}
              size="middle"
              style={{ width: 200 }}
              notFoundContent="No products found"
              className="product-selector"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spin size="large" />
          <span className="ml-3 text-sm text-gray-600">Loading dashboard data...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p className="text-sm font-medium">Error loading dashboard</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      ) : !selectedProduct ? (
        <div className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded">
          <p className="text-sm">Please select a product to view dashboard data.</p>
        </div>
      ) : !dashboardData ? (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-6 py-8 rounded-lg">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-3">
              <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-base font-semibold mb-1">No Data Available</p>
            <p className="text-sm text-blue-700">
              There is no dashboard data available for the selected product at this time.
            </p>
          </div>
        </div>
      ) : (
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedProduct || 'default'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="space-y-4"
        >
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12} lg={6}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <Card 
                    className="shadow-md hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-blue-50 to-blue-100/50 overflow-hidden relative" 
                    styles={{ body: { padding: '16px', position: 'relative', zIndex: 1 } }}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-200/20 rounded-full -mr-12 -mt-12"></div>
                    <div className="flex items-start justify-between mb-3 relative z-10">
                      <div className="p-2 rounded-lg bg-white shadow-sm">
                        <FileTextOutlined style={{ fontSize: '20px', color: '#3b82f6' }} />
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900 mb-0.5">{overview.totalEpics}</div>
                        <Tag color="blue" className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border-0 bg-blue-600 text-white">
                          Total
                        </Tag>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-800 mb-0.5 relative z-10">Total Epics</div>
                    <div className="text-xs text-gray-600 relative z-10">
                      {overview.activeEpics} active epics
                    </div>
                  </Card>
                </motion.div>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <Card 
                    className="shadow-md hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-green-50 to-green-100/50 overflow-hidden relative" 
                    styles={{ body: { padding: '16px', position: 'relative', zIndex: 1 } }}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-200/20 rounded-full -mr-12 -mt-12"></div>
                    <div className="flex items-start justify-between mb-3 relative z-10">
                      <div className="p-2 rounded-lg bg-white shadow-sm">
                        <CheckCircleFilled style={{ fontSize: '20px', color: '#10b981' }} />
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900 mb-0.5">{overview.completionRate}%</div>
                        <Tag color="green" className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border-0 bg-green-600 text-white">
                          Rate
                        </Tag>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-800 mb-0.5 relative z-10">Completion Rate</div>
                    <div className="text-xs text-gray-600 relative z-10">
                      {overview.totalEpics - overview.activeEpics} completed
                    </div>
                  </Card>
                </motion.div>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                >
                  <Card 
                    className={`shadow-md hover:shadow-xl transition-all duration-300 border-0 overflow-hidden relative ${
                      overview.overdueCount > 0 
                        ? 'bg-gradient-to-br from-red-50 to-red-100/50' 
                        : 'bg-gradient-to-br from-green-50 to-green-100/50'
                    }`}
                    styles={{ body: { padding: '16px', position: 'relative', zIndex: 1 } }}
                  >
                    <div className={`absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 ${
                      overview.overdueCount > 0 ? 'bg-red-200/20' : 'bg-green-200/20'
                    }`}></div>
                    <div className="flex items-start justify-between mb-3 relative z-10">
                      <div className={`p-2 rounded-lg bg-white shadow-sm`}>
                        <WarningOutlined style={{ fontSize: '20px', color: overview.overdueCount > 0 ? '#ef4444' : '#10b981' }} />
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900 mb-0.5">{overview.overdueCount}</div>
                        <Tag color={overview.overdueCount > 0 ? "red" : "green"} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border-0 ${
                          overview.overdueCount > 0 ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                        }`}>
                          {overview.overdueCount > 0 ? 'Alert' : 'OK'}
                        </Tag>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-800 mb-0.5 relative z-10">Overdue Epics</div>
                    <div className="text-xs text-gray-600 relative z-10">
                      {overview.overdueCount > 0 ? "Requires attention" : "All on track"}
                    </div>
                  </Card>
                </motion.div>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                >
                  <Card 
                    className={`shadow-md hover:shadow-xl transition-all duration-300 border-0 overflow-hidden relative ${
                      overview.pendingApprovals > 0 
                        ? 'bg-gradient-to-br from-orange-50 to-orange-100/50' 
                        : 'bg-gradient-to-br from-green-50 to-green-100/50'
                    }`}
                    styles={{ body: { padding: '16px', position: 'relative', zIndex: 1 } }}
                  >
                    <div className={`absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 ${
                      overview.pendingApprovals > 0 ? 'bg-orange-200/20' : 'bg-green-200/20'
                    }`}></div>
                    <div className="flex items-start justify-between mb-3 relative z-10">
                      <div className="p-2 rounded-lg bg-white shadow-sm">
                        <TeamOutlined style={{ fontSize: '20px', color: overview.pendingApprovals > 0 ? '#f59e0b' : '#10b981' }} />
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900 mb-0.5">{overview.pendingApprovals}</div>
                        <Tag color={overview.pendingApprovals > 0 ? "orange" : "green"} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border-0 ${
                          overview.pendingApprovals > 0 ? 'bg-orange-600 text-white' : 'bg-green-600 text-white'
                        }`}>
                          Pending
                        </Tag>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-800 mb-0.5 relative z-10">Pending Approvals</div>
                    <div className="text-xs text-gray-600 relative z-10">
                      {overview.pendingApprovals > 0 ? "Action needed" : "Up to date"}
                    </div>
                  </Card>
                </motion.div>
              </Col>
            </Row>

            <Row gutter={[12, 12]}>
              <Col xs={24} lg={12}>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                >
                  <Card
                    className="shadow-md border-0 bg-white"
                    styles={{ 
                      header: { 
                        fontFamily: 'var(--font-poppins), Poppins, sans-serif', 
                        padding: '12px 16px', 
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: '#ffffff',
                        borderRadius: '8px 8px 0 0'
                      },
                      body: { padding: '16px', fontFamily: 'var(--font-poppins), Poppins, sans-serif' } 
                    }}
                  >
                    <div className="text-sm font-semibold text-gray-800 mb-0.5">Epic Status Overview</div>
                    <div className="text-[10px] text-gray-500 mb-3">Distribution of epics by status</div>
                    <div style={{ height: 240 }}>
                      <Pie data={chartData.epicStatus} options={pieOptions} redraw={false} />
                    </div>
                  </Card>
                </motion.div>
              </Col>

              <Col xs={24} lg={12}>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.6 }}
                >
                  <Card
                    className="shadow-md border-0 bg-white"
                    styles={{ 
                      header: { 
                        fontFamily: 'var(--font-poppins), Poppins, sans-serif', 
                        padding: '12px 16px', 
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: '#ffffff',
                        borderRadius: '8px 8px 0 0'
                      },
                      body: { padding: '16px', fontFamily: 'var(--font-poppins), Poppins, sans-serif' } 
                    }}
                  >
                    <div className="text-sm font-semibold text-gray-800 mb-0.5">Hours by Epic</div>
                    <div className="text-[10px] text-gray-500 mb-3">Top epics by total hours worked</div>
                    <div style={{ height: 240 }}>
                      <Bar data={chartData.hoursByEpic} options={barOptions} redraw={false} />
                    </div>
                  </Card>
                </motion.div>
              </Col>
            </Row>
        </motion.div>
      </AnimatePresence>
      )}
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  const tabItems = [
    {
      key: "team",
      label: "Team Dashboard",
      children: <TeamDashboardView />,
    },
    {
      key: "product",
      label: "Product Dashboard",
      children: <ProductDashboardView />,
    },
  ];

  return (
    <div className="p-2 sm:p-4">
      <Tabs items={tabItems} defaultActiveKey="team" />
    </div>
  );
}
