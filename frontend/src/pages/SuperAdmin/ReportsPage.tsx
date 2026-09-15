import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Building2, 
  Users, 
  Award, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import { axiosInstance } from '../../services/customBaseQuery';
import { format } from 'date-fns';

type ReportType = 'department' | 'staff' | 'admin';

interface DepartmentReport {
  departmentId: string;
  departmentName: string;
  totalComplaints: number;
  activeWorkload: number;
  resolvedCount: number;
  slaBreaches: number;
  complianceRate: number;
}

interface StaffReport {
  staffId: string;
  fullName: string;
  email: string;
  rank: string;
  department: string;
  activeWorkload: number;
  completedCount: number;
  overdueAssignments: number;
}

interface AdminReport {
  _id: string;
  email: string;
  fullName: string;
  accountStatus: string;
  joinedAt: string;
  totalActionsLogged: number;
  userApprovals: number;
  transferReviews: number;
  promotionReviews: number;
  disciplinaryActions: number;
  slaConfigurations: number;
  lastActiveAt: string;
  totalComplaintsSupervised: number;
  resolvedComplaints: number;
  pendingComplaints: number;
  activeWorkload: number;
  overdueComplaints: number;
  averageResolutionHours: number;
  slaComplianceRate: number;
}

const SuperAdminReportsPage: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<ReportType>('department');
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Live data collections
  const [deptData, setDeptData] = useState<DepartmentReport[]>([]);
  const [staffData, setStaffData] = useState<StaffReport[]>([]);
  const [adminData, setAdminData] = useState<AdminReport[]>([]);

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      const [deptRes, staffRes, adminRes] = await Promise.allSettled([
        axiosInstance.get('/dashboard/departments'),
        axiosInstance.get('/dashboard/staff'),
        axiosInstance.get('/dashboard/admin-performance')
      ]);

      if (deptRes.status === 'fulfilled' && deptRes.value.data?.success) {
        setDeptData(deptRes.value.data.data || []);
      }

      if (staffRes.status === 'fulfilled' && staffRes.value.data?.success) {
        setStaffData(staffRes.value.data.data || []);
      }

      if (adminRes.status === 'fulfilled' && adminRes.value.data?.success) {
        const payload = adminRes.value.data.data;
        setAdminData(payload?.admins || []);
      }
    } catch (err) {
      console.error('[SuperAdminReports] Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
  }, []);

  // Filtered views based on search term
  const filteredDeptData = useMemo(() => {
    if (!searchTerm.trim()) return deptData;
    const term = searchTerm.toLowerCase();
    return deptData.filter((d) => d.departmentName.toLowerCase().includes(term));
  }, [deptData, searchTerm]);

  const filteredStaffData = useMemo(() => {
    if (!searchTerm.trim()) return staffData;
    const term = searchTerm.toLowerCase();
    return staffData.filter(
      (s) =>
        s.fullName.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        s.department.toLowerCase().includes(term) ||
        s.rank.toLowerCase().includes(term)
    );
  }, [staffData, searchTerm]);

  const filteredAdminData = useMemo(() => {
    if (!searchTerm.trim()) return adminData;
    const term = searchTerm.toLowerCase();
    return adminData.filter(
      (a) => a.fullName.toLowerCase().includes(term) || a.email.toLowerCase().includes(term)
    );
  }, [adminData, searchTerm]);

  // Real CSV Export Generators
  const handleExportCSV = (type: ReportType = selectedReport) => {
    setIsExporting(true);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      let headers: string[] = [];
      let rows: string[][] = [];
      let filename = `report-${todayStr}.csv`;

      if (type === 'department') {
        filename = `department-performance-report-${todayStr}.csv`;
        headers = [
          'Department ID',
          'Department Name',
          'Total Complaints',
          'Active Workload',
          'Resolved Complaints',
          'SLA Breaches',
          'Compliance Rate (%)'
        ];
        rows = deptData.map((d) => [
          `"${d.departmentId}"`,
          `"${d.departmentName}"`,
          String(d.totalComplaints),
          String(d.activeWorkload),
          String(d.resolvedCount),
          String(d.slaBreaches),
          `${d.complianceRate}%`
        ]);
      } else if (type === 'staff') {
        filename = `staff-workload-productivity-report-${todayStr}.csv`;
        headers = [
          'Staff ID',
          'Full Name',
          'Email Address',
          'Rank',
          'Assigned Department',
          'Active Workload',
          'Completed Tasks',
          'Overdue Assignments'
        ];
        rows = staffData.map((s) => [
          `"${s.staffId}"`,
          `"${s.fullName}"`,
          `"${s.email}"`,
          `"${s.rank}"`,
          `"${s.department}"`,
          String(s.activeWorkload),
          String(s.completedCount),
          String(s.overdueAssignments)
        ]);
      } else if (type === 'admin') {
        filename = `admin-governance-performance-report-${todayStr}.csv`;
        headers = [
          'Admin ID',
          'Full Name',
          'Email Address',
          'Account Status',
          'Total Actions Logged',
          'User Approvals',
          'Transfer Reviews',
          'Promotion Reviews',
          'Disciplinary Actions',
          'SLA Policy Configs',
          'Last Active Date'
        ];
        rows = adminData.map((a) => [
          `"${a._id}"`,
          `"${a.fullName}"`,
          `"${a.email}"`,
          `"${a.accountStatus}"`,
          String(a.totalActionsLogged),
          String(a.userApprovals),
          String(a.transferReviews),
          String(a.promotionReviews),
          String(a.disciplinaryActions),
          String(a.slaConfigurations),
          `"${format(new Date(a.lastActiveAt), 'yyyy-MM-dd HH:mm:ss')}"`
        ]);
      }

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('[ExportCSV Error]:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const reportCards = [
    {
      id: 'department' as ReportType,
      title: 'Department Performance & SLA',
      description: 'Departmental complaint volume, active resolution velocity, SLA breaches, and compliance rates',
      icon: Building2,
      recordsCount: deptData.length,
      primaryMetric: `${deptData.reduce((acc, d) => acc + d.totalComplaints, 0)} Total Complaints`,
      badge: 'Operational SLA'
    },
    {
      id: 'staff' as ReportType,
      title: 'Staff Workload & Productivity',
      description: 'Technician task assignments, completion throughput, overdue tickets, and rank designations',
      icon: Users,
      recordsCount: staffData.length,
      primaryMetric: `${staffData.reduce((acc, s) => acc + s.completedCount, 0)} Tasks Completed`,
      badge: 'Workforce KPI'
    },
    {
      id: 'admin' as ReportType,
      title: 'Admin Governance & Oversight',
      description: 'Administrator audit activities, resident approvals, transfer reviews, and policy overrides',
      icon: Award,
      recordsCount: adminData.length,
      primaryMetric: `${adminData.reduce((acc, a) => acc + a.totalActionsLogged, 0)} Actions Logged`,
      badge: 'Executive Governance'
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time executive reporting, workforce productivity breakdowns, and on-demand CSV data exports
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchReportsData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportCSV(selectedReport)}
            disabled={loading || isExporting}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export Selected CSV</span>
          </button>
        </div>
      </div>

      {/* ── 3 Executive Report Selection Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reportCards.map((card) => {
          const Icon = card.icon;
          const isSelected = selectedReport === card.id;

          return (
            <div
              key={card.id}
              onClick={() => setSelectedReport(card.id)}
              className={`bg-white rounded-xl border p-5 shadow-sm transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/10 shadow-md'
                  : 'border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`p-2.5 rounded-lg shrink-0 ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60">
                    {card.badge}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900">{card.title}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{card.description}</p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Records</p>
                  <p className="text-base font-bold text-slate-900 tabular-nums">
                    {loading ? '...' : card.recordsCount}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Live Benchmark</p>
                  <p className="text-xs font-semibold text-blue-600 tabular-nums">{loading ? '...' : card.primaryMetric}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Live Report Preview & Search Toolbar ── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-semibold text-slate-900">
              {selectedReport === 'department' && 'Department Performance Preview'}
              {selectedReport === 'staff' && 'Staff Productivity & Workload Preview'}
              {selectedReport === 'admin' && 'Admin Governance & Activity Preview'}
            </h2>
            <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full tabular-nums border border-slate-200/60">
              {selectedReport === 'department' && filteredDeptData.length}
              {selectedReport === 'staff' && filteredStaffData.length}
              {selectedReport === 'admin' && filteredAdminData.length} live records
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search live records..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <button
              type="button"
              onClick={() => handleExportCSV(selectedReport)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Download CSV</span>
            </button>
          </div>
        </div>

        {/* ── Dynamic Preview Tables (Sticky Header + Fixed Max-Height) ── */}
        <div className="max-h-[360px] overflow-y-auto">
          {/* 1. Department Preview Table */}
          {selectedReport === 'department' && (
            <table className="w-full text-left text-xs border-collapse table-auto">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Department</th>
                  <th className="py-3 px-4 font-semibold text-center">Total Complaints</th>
                  <th className="py-3 px-4 font-semibold text-center">Active Workload</th>
                  <th className="py-3 px-4 font-semibold text-center">Resolved</th>
                  <th className="py-3 px-4 font-semibold text-center">SLA Breaches</th>
                  <th className="py-3 px-4 font-semibold text-right">Compliance Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                      Loading live department data...
                    </td>
                  </tr>
                ) : filteredDeptData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No departments match your search.
                    </td>
                  </tr>
                ) : (
                  filteredDeptData.map((d) => (
                    <tr key={d.departmentId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">{d.departmentName}</td>
                      <td className="py-3 px-4 text-center tabular-nums text-slate-700 font-medium">
                        {d.totalComplaints}
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-slate-700 font-medium">
                        {d.activeWorkload}
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-emerald-600 font-semibold">
                        {d.resolvedCount}
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-rose-600 font-semibold">
                        {d.slaBreaches}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            d.complianceRate >= 80
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : d.complianceRate >= 50
                              ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                              : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                          }`}
                        >
                          {d.complianceRate}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 2. Staff Preview Table */}
          {selectedReport === 'staff' && (
            <table className="w-full text-left text-xs border-collapse table-auto">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Staff Member</th>
                  <th className="py-3 px-4 font-semibold">Department</th>
                  <th className="py-3 px-4 font-semibold text-center">Rank</th>
                  <th className="py-3 px-4 font-semibold text-center">Active Workload</th>
                  <th className="py-3 px-4 font-semibold text-center">Completed</th>
                  <th className="py-3 px-4 font-semibold text-right">Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                      Loading live staff performance...
                    </td>
                  </tr>
                ) : filteredStaffData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No staff members match your search.
                    </td>
                  </tr>
                ) : (
                  filteredStaffData.map((s) => (
                    <tr key={s.staffId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{s.fullName}</span>
                          <span className="text-[11px] text-slate-400">{s.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{s.department}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200/60">
                          {s.rank}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-slate-700 font-medium">
                        {s.activeWorkload}
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-emerald-600 font-semibold">
                        {s.completedCount}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-rose-600 font-semibold">
                        {s.overdueAssignments}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 3. Admin Preview Table */}
          {selectedReport === 'admin' && (
            <table className="w-full text-left text-xs border-collapse table-auto">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Admin</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-center">Actions Logged</th>
                  <th className="py-3 px-4 font-semibold text-center">Transfers Reviewed</th>
                  <th className="py-3 px-4 font-semibold text-center">Promotions Reviewed</th>
                  <th className="py-3 px-4 font-semibold text-right">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                      Loading live administrator data...
                    </td>
                  </tr>
                ) : filteredAdminData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No administrators match your search.
                    </td>
                  </tr>
                ) : (
                  filteredAdminData.map((a) => (
                    <tr key={a._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{a.fullName}</span>
                          <span className="text-[11px] text-slate-400">{a.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200/60 uppercase">
                          {a.accountStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-slate-900 font-bold">
                        {a.totalActionsLogged}
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-slate-700 font-medium">
                        {a.transferReviews}
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-slate-700 font-medium">
                        {a.promotionReviews}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-600">
                        {format(new Date(a.lastActiveAt), 'MMM dd, yyyy')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminReportsPage;
