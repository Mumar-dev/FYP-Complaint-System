import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Search, 
  X, 
  Download, 
  Calendar,
  Layers,
  Building2,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import { axiosInstance } from '../../services/customBaseQuery';
import { getSocket } from '../../services/socket.service';
import { format } from 'date-fns';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts';

interface DepartmentItem {
  _id: string;
  name: string;
  code?: string;
  isActive?: boolean;
  approvalStatus?: string;
}

interface DepartmentStats {
  _id: string;
  name: string;
  code?: string;
  totalComplaints: number;
  activeComplaints: number;
  resolvedComplaints: number;
  pendingComplaints: number;
  slaBreached: number;
  complianceRate: number;
  resolutionRate: number;
}

interface AnalyticsOverview {
  total: number;
  active: number;
  resolved: number;
  pending: number;
  resolutionRate: number;
  avgResolutionHours: number;
  slaCompliancePercentage: number;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444', // red-500
  high: '#f97316',     // orange-500
  medium: '#3b82f6',   // blue-500
  low: '#64748b'       // slate-500
};

const SuperAdminAnalyticsPage: React.FC = () => {
  const [departmentsList, setDepartmentsList] = useState<DepartmentItem[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  
  // Filter states
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [filterType, setFilterType] = useState<'All Time' | '30D' | '7D' | 'Custom'>('All Time');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [overview, setOverview] = useState<AnalyticsOverview>({
    total: 0,
    active: 0,
    resolved: 0,
    pending: 0,
    resolutionRate: 0,
    avgResolutionHours: 0,
    slaCompliancePercentage: 100
  });

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);

      const params: Record<string, any> = {};
      if (selectedDeptId !== 'all') {
        params.departmentId = selectedDeptId;
      }
      if (filterType === 'All Time') {
        params.range = 'All Time';
      } else if (filterType === '30D') {
        params.range = '30D';
      } else if (filterType === '7D') {
        params.range = '7D';
      } else if (filterType === 'Custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const [deptsRes, complaintsRes, overviewRes] = await Promise.allSettled([
        axiosInstance.get('/departments'),
        axiosInstance.get('/complaints'),
        axiosInstance.get('/dashboard/overview', { params })
      ]);

      const rawDepts: DepartmentItem[] = deptsRes.status === 'fulfilled' ? (deptsRes.value.data?.data || []) : [];
      const allComplaints: any[] = complaintsRes.status === 'fulfilled' ? (complaintsRes.value.data?.data || []) : [];
      const overviewData = overviewRes.status === 'fulfilled' ? (overviewRes.value.data?.data || {}) : {};

      // Filter only active & approved departments for dropdown selector
      const approvedDepts = rawDepts.filter(
        (d) => (d.approvalStatus === 'approved' || !d.approvalStatus) && d.isActive !== false
      );
      setDepartmentsList(approvedDepts);
      setComplaints(allComplaints);

      // Status accounting (reflecting departmentId and date filters)
      const totalCount = overviewData.totalComplaints ?? allComplaints.length;
      const totalResolved = overviewData.statusBreakdown
        ? ((overviewData.statusBreakdown.resolved || 0) + (overviewData.statusBreakdown.closed || 0))
        : allComplaints.filter((c: any) => ['resolved', 'closed'].includes(c.status)).length;
      const totalActive = overviewData.statusBreakdown
        ? ((overviewData.statusBreakdown.assigned || 0) + (overviewData.statusBreakdown.inProgress || 0) + (overviewData.statusBreakdown.underVerification || 0))
        : allComplaints.filter((c: any) => ['assigned', 'in_progress', 'under_verification'].includes(c.status)).length;
      const totalPending = overviewData.statusBreakdown
        ? ((overviewData.statusBreakdown.pending || 0))
        : allComplaints.filter((c: any) => ['pending', 'pending_assignment', 'submitted'].includes(c.status)).length;

      const resolutionRate = totalCount > 0 ? Math.round((totalResolved / totalCount) * 100) : 0;

      setOverview({
        total: totalCount,
        active: totalActive,
        resolved: totalResolved,
        pending: totalPending,
        resolutionRate,
        avgResolutionHours: overviewData.avgResolutionHours || 0,
        slaCompliancePercentage: overviewData.slaCompliancePercentage ?? 100
      });
    } catch (error) {
      console.error('[SuperAdmin Analytics] Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDeptId, filterType, startDate, endDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Real-time socket subscriptions for automatic updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleRealtimeUpdate = () => {
      fetchAnalytics();
    };

    socket.on('analytics_update', handleRealtimeUpdate);
    socket.on('notification', handleRealtimeUpdate);
    socket.on('complaint_created', handleRealtimeUpdate);
    socket.on('complaint_updated', handleRealtimeUpdate);
    socket.on('complaint_status_changed', handleRealtimeUpdate);
    socket.on('department_approved', handleRealtimeUpdate);

    return () => {
      socket.off('analytics_update', handleRealtimeUpdate);
      socket.off('notification', handleRealtimeUpdate);
      socket.off('complaint_created', handleRealtimeUpdate);
      socket.off('complaint_updated', handleRealtimeUpdate);
      socket.off('complaint_status_changed', handleRealtimeUpdate);
      socket.off('department_approved', handleRealtimeUpdate);
    };
  }, [fetchAnalytics]);

  // Date filtering logic applied across all departments (used for Department Performance table metrics)
  const dateFilteredComplaints = useMemo(() => {
    if (filterType === 'All Time') return complaints;

    const now = new Date();
    let startThreshold: Date | null = null;
    let endThreshold: Date | null = null;

    if (filterType === '7D') {
      startThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (filterType === '30D') {
      startThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (filterType === 'Custom' && startDate) {
      startThreshold = new Date(startDate);
      if (endDate) {
        endThreshold = new Date(endDate);
        endThreshold.setHours(23, 59, 59, 999);
      }
    }

    return complaints.filter((c) => {
      const created = new Date(c.createdAt);
      if (startThreshold && created < startThreshold) return false;
      if (endThreshold && created > endThreshold) return false;
      return true;
    });
  }, [complaints, filterType, startDate, endDate]);

  // Compute department performance statistics with safe department ID matching
  // Always includes ALL departments, filtered only by the active date range
  const departmentStats = useMemo(() => {
    return departmentsList.map((dept) => {
      const deptIdStr = String(dept._id);
      const deptComplaints = dateFilteredComplaints.filter((c: any) => {
        const compDeptId = c.departmentId
          ? (typeof c.departmentId === 'object' && c.departmentId._id ? String(c.departmentId._id) : String(c.departmentId))
          : null;
        return compDeptId === deptIdStr;
      });

      const total = deptComplaints.length;
      const resolved = deptComplaints.filter((c: any) => ['resolved', 'closed'].includes(c.status)).length;
      const active = deptComplaints.filter((c: any) => ['assigned', 'in_progress', 'under_verification'].includes(c.status)).length;
      const pending = deptComplaints.filter((c: any) => ['pending', 'pending_assignment', 'submitted'].includes(c.status)).length;

      // SLA breaches
      const now = new Date();
      const breached = deptComplaints.filter((c: any) => {
        if (c.slaBreached === true) return true;
        if (c.slaDeadline && !['resolved', 'closed'].includes(c.status) && new Date(c.slaDeadline) < now) return true;
        if (c.slaDeadline && c.resolvedAt && new Date(c.resolvedAt) > new Date(c.slaDeadline)) return true;
        return false;
      }).length;

      const onTimeResolved = deptComplaints.filter((c: any) => {
        if (!['resolved', 'closed'].includes(c.status)) return false;
        if (c.slaDeadline && c.resolvedAt && new Date(c.resolvedAt) <= new Date(c.slaDeadline)) return true;
        return c.slaBreached === false;
      }).length;

      const compliance = resolved > 0
        ? Math.round((onTimeResolved / resolved) * 100)
        : (total > 0 ? Math.max(0, Math.round(((total - breached) / total) * 100)) : 100);

      const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

      return {
        _id: deptIdStr,
        name: dept.name,
        code: dept.code,
        totalComplaints: total,
        activeComplaints: active,
        resolvedComplaints: resolved,
        pendingComplaints: pending,
        slaBreached: breached,
        complianceRate: compliance,
        resolutionRate
      };
    });
  }, [departmentsList, dateFilteredComplaints]);

  // Date and per-department filtering logic applied to visual charts and top KPIs
  const chartFilteredComplaints = useMemo(() => {
    if (selectedDeptId === 'all') return dateFilteredComplaints;
    return dateFilteredComplaints.filter((c) => {
      const compDeptId = c.departmentId
        ? (typeof c.departmentId === 'object' && c.departmentId._id ? String(c.departmentId._id) : String(c.departmentId))
        : null;
      return compDeptId === selectedDeptId;
    });
  }, [dateFilteredComplaints, selectedDeptId]);

  // Priority distribution for visual chart
  const priorityDistribution = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    chartFilteredComplaints.forEach((c) => {
      const p = (c.priority || 'medium').toLowerCase();
      if (counts[p] !== undefined) counts[p]++;
      else counts.medium++;
    });

    return [
      { name: 'Critical', value: counts.critical, color: PRIORITY_COLORS.critical },
      { name: 'High', value: counts.high, color: PRIORITY_COLORS.high },
      { name: 'Medium', value: counts.medium, color: PRIORITY_COLORS.medium },
      { name: 'Low', value: counts.low, color: PRIORITY_COLORS.low }
    ].filter((item) => item.value > 0);
  }, [chartFilteredComplaints]);

  // Scalable Department Workload Bar Chart Data (including SLA Breached series)
  const departmentVolumeData = useMemo(() => {
    let sourceDepts = departmentStats;
    if (selectedDeptId !== 'all') {
      sourceDepts = departmentStats.filter((d) => d._id === selectedDeptId);
    }

    return sourceDepts
      .filter((d) => d.totalComplaints > 0 || selectedDeptId !== 'all')
      .map((d) => ({
        name: d.name.length > 14 ? `${d.name.slice(0, 12)}…` : d.name,
        fullName: d.name,
        Resolved: d.resolvedComplaints,
        Active: d.activeComplaints,
        Pending: d.pendingComplaints,
        'SLA Breached': d.slaBreached
      }));
  }, [departmentStats, selectedDeptId]);

  // Calculate dynamic minimum width to prevent chart compression as departments grow
  const chartDynamicMinWidth = useMemo(() => {
    return Math.max(520, departmentVolumeData.length * 105);
  }, [departmentVolumeData.length]);

  // Client-side search filtering for Department Performance table
  // Decoupled from selectedDeptId: always includes ALL departments, filtered only by search input
  const filteredTableDepartments = useMemo(() => {
    let list = departmentStats;
    if (!tableSearchTerm.trim()) return list;
    const term = tableSearchTerm.toLowerCase();
    return list.filter(
      (d) =>
        d.name.toLowerCase().includes(term) ||
        (d.code && d.code.toLowerCase().includes(term))
    );
  }, [departmentStats, tableSearchTerm]);

  // CSV Export handler
  const handleExportCSV = () => {
    const headers = [
      'Department Name',
      'Code',
      'Total Complaints',
      'Active / In Progress',
      'Resolved',
      'Pending',
      'SLA Breached',
      'SLA Compliance (%)',
      'Resolution Rate (%)'
    ];

    const rows = filteredTableDepartments.map((d) => [
      `"${d.name}"`,
      `"${d.code || ''}"`,
      d.totalComplaints,
      d.activeComplaints,
      d.resolvedComplaints,
      d.pendingComplaints,
      d.slaBreached,
      `${d.complianceRate}%`,
      `${d.resolutionRate}%`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `department-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Page Header & Single Horizontal Toolbar ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Department Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            System-wide complaint distribution, SLA compliance, and cross-department benchmarks
          </p>
        </div>

        {/* Top-Right Horizontal Toolbar */}
        <div className="flex items-center gap-2 shrink-0 flex-nowrap overflow-x-auto pb-1 lg:pb-0">
          {/* Quick Date Range Pill Group */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold shadow-2xs shrink-0">
            {(['All Time', '30D', '7D', 'Custom'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  filterType === type
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchAnalytics}
            title="Refresh Data"
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors shadow-2xs shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker (conditionally shown when filterType === 'Custom') */}
      {filterType === 'Custom' && (
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex flex-wrap items-center gap-3 text-xs shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-700">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 underline ml-auto"
            >
              Clear Dates
            </button>
          )}
        </div>
      )}

      {/* ── 4 Crisp White KPI Cards (No truncated subtext, clean spacing) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Complaints */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between">
            <div className="min-w-0 pr-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                TOTAL COMPLAINTS
              </p>
              <p className="text-3xl font-black text-slate-900 tracking-tight mt-2 tabular-nums">
                {loading ? '...' : overview.total.toLocaleString()}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Active / In Progress */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between">
            <div className="min-w-0 pr-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                ACTIVE / IN PROGRESS
              </p>
              <p className="text-3xl font-black text-slate-900 tracking-tight mt-2 tabular-nums">
                {loading ? '...' : overview.active.toLocaleString()}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Resolved */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between">
            <div className="min-w-0 pr-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                RESOLVED
              </p>
              <p className="text-3xl font-black text-slate-900 tracking-tight mt-2 tabular-nums">
                {loading ? '...' : overview.resolved.toLocaleString()}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Resolution Rate */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between">
            <div className="min-w-0 pr-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                RESOLUTION RATE
              </p>
              <p className="text-3xl font-black text-slate-900 tracking-tight mt-2 tabular-nums">
                {loading ? '...' : `${overview.resolutionRate}%`}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Visual Charts Section with Dynamic Department Dropdown Selector ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Complaint Workload Distribution (Horizontal Scroll & Scaling) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Department Workload Distribution</h2>
              <p className="text-xs text-slate-500 mt-0.5">Complaints distributed by department and operational status</p>
            </div>

            {/* Dynamic Department Selector Dropdown */}
            <div className="relative inline-flex items-center shrink-0">
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 pl-3 pr-8 py-1.5 focus:bg-white focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs transition-all"
              >
                <option value="all">All Departments</option>
                {departmentsList.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} {d.code ? `(${d.code})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Horizontally Scrollable Bar Chart Container */}
          <div className="overflow-x-auto pb-2">
            <div style={{ minWidth: `${chartDynamicMinWidth}px`, height: '270px' }}>
              {departmentVolumeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentVolumeData} margin={{ top: 15, right: 15, left: -15, bottom: 35 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 11, fill: '#64748b' }} 
                      interval={0} 
                      angle={-20} 
                      textAnchor="end"
                      height={40}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="Resolved" fill="#10b981" maxBarSize={42} radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="Active" fill="#3b82f6" maxBarSize={42} radius={[0, 0, 0, 0]} stackId="a" />
                    <Bar dataKey="Pending" fill="#f59e0b" maxBarSize={42} radius={[0, 0, 0, 0]} stackId="a" />
                    <Bar dataKey="SLA Breached" fill="#ef4444" maxBarSize={42} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-400">
                  No complaint volume recorded for the selected department/filter
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Priority Distribution Donut */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Priority Distribution</h2>
            <p className="text-xs text-slate-500 mt-0.5">System-wide urgency and triage severity</p>
          </div>

          <div className="h-48 w-full my-2">
            {priorityDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityDistribution}
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {priorityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                No priority data recorded
              </div>
            )}
          </div>

          {/* Priority Legend */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
            {priorityDistribution.map((p) => (
              <div key={p.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  {p.name}
                </span>
                <span className="font-semibold text-slate-900 tabular-nums">{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Polished Department Performance Table ── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Table Header with Search & Export CSV */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Department Performance</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparative breakdown of workload, SLA compliance, and throughput
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Compact Search Bar */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search departments..."
                value={tableSearchTerm}
                onChange={(e) => setTableSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800"
              />
              {tableSearchTerm && (
                <button
                  type="button"
                  onClick={() => setTableSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        {/* Locked Height Table Body with Sticky Header & Polished Badges */}
        <div className="max-h-[360px] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Department</th>
                <th className="py-3 px-3 text-center font-semibold">Total</th>
                <th className="py-3 px-3 text-center font-semibold">Active</th>
                <th className="py-3 px-3 text-center font-semibold">Resolved</th>
                <th className="py-3 px-3 text-center font-semibold">Pending</th>
                <th className="py-3 px-3 text-center font-semibold">SLA Breached</th>
                <th className="py-3 px-4 text-center font-semibold min-w-[130px]">Resolution Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading department performance...
                  </td>
                </tr>
              ) : filteredTableDepartments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    {tableSearchTerm ? 'No matching departments found.' : 'No department data available.'}
                  </td>
                </tr>
              ) : (
                filteredTableDepartments.map((dept) => (
                  <tr key={dept._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{dept.name}</span>
                        {dept.code && (
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 uppercase">
                            {dept.code}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center font-semibold text-slate-900 tabular-nums">
                      {dept.totalComplaints}
                    </td>
                    <td className="py-3.5 px-3 text-center tabular-nums">
                      {dept.activeComplaints > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                          {dept.activeComplaints}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center tabular-nums">
                      {dept.resolvedComplaints > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                          {dept.resolvedComplaints}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center tabular-nums">
                      {dept.pendingComplaints > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                          {dept.pendingComplaints}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center tabular-nums">
                      {dept.slaBreached > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600">
                          {dept.slaBreached}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all"
                            style={{ width: `${dept.resolutionRate}%` }}
                          />
                        </div>
                        <span className="font-semibold text-slate-800 w-9 text-right tabular-nums">
                          {dept.resolutionRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminAnalyticsPage;
