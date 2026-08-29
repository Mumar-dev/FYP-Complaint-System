import React, { useEffect, useState, useMemo } from 'react';
import { useGetAnalyticsQuery } from '@/features/admin/admin.api';
import { 
  Loader2, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Zap, 
  ShieldCheck, 
  Building2,
  Users,
  Search,
  X
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [filterType, setFilterType] = useState<'7D' | '30D' | '90D' | 'All Time' | 'Custom'>('All Time');
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');

  // Custom date range state
  const defaultPast = new Date();
  defaultPast.setDate(defaultPast.getDate() - 30);
  const [startDate, setStartDate] = useState<string>(defaultPast.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Construct query parameters based on active filter
  const params = useMemo(() => {
    if (filterType === 'All Time') {
      return { startDate: 'all', endDate: 'all' };
    }
    if (filterType === 'Custom') {
      return { startDate, endDate };
    }
    const now = new Date();
    const past = new Date();
    const days = filterType === '7D' ? 7 : filterType === '30D' ? 30 : 90;
    past.setDate(now.getDate() - days);
    return {
      startDate: past.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    };
  }, [filterType, startDate, endDate]);

  const { data, isLoading, isError } = useGetAnalyticsQuery(params);

  useEffect(() => {
    if (data) {
      console.log('[AdminAnalytics Debug] Full API Response:', data);
    }
  }, [data]);

  const { overview = {}, slaMetrics = {}, departments = [], staff = [] } = data?.data || {};

  // Client-side search filters - strictly called at top before any returns
  const filteredDepartments = useMemo(() => {
    const deptList: any[] = departments ?? [];
    if (!departmentSearch.trim()) return deptList;
    const query = departmentSearch.trim().toLowerCase();
    return deptList.filter((d: any) => 
      (d.departmentName || '').toLowerCase().includes(query)
    );
  }, [departments, departmentSearch]);

  const filteredStaff = useMemo(() => {
    const staffList: any[] = staff ?? [];
    if (!staffSearch.trim()) return staffList;
    const query = staffSearch.trim().toLowerCase();
    return staffList.filter((s: any) => 
      (s.staffName || '').toLowerCase().includes(query) ||
      (s.email || '').toLowerCase().includes(query)
    );
  }, [staff, staffSearch]);

  const handleFilterClick = (type: '7D' | '30D' | '90D' | 'All Time' | 'Custom') => {
    setFilterType(type);
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError || !data?.success) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-red-50 rounded-2xl border border-red-200 p-6">
        <AlertTriangle className="w-10 h-10 text-red-500 mb-2" />
        <p className="font-semibold text-red-800">Failed to load Dashboard data</p>
        <p className="text-sm text-red-600 mt-1">Please try refreshing the page or check your connection.</p>
      </div>
    );
  }

  // Compute total SLA Breached (Resolved + Pending)
  const totalBreaches = (slaMetrics.slaBreachedResolved || 0) + (slaMetrics.slaBreachedPending || 0);

  // Responsive 3x2 KPI cards with simple, clear wording
  const kpis = [
    { 
      title: 'Total Complaints', 
      value: overview.totalComplaints || 0, 
      icon: TrendingUp, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50 border border-blue-100/80' 
    },
    { 
      title: 'Resolved', 
      value: overview.resolvedComplaints || 0, 
      icon: CheckCircle2, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50 border border-emerald-100/80' 
    },
    { 
      title: 'In Progress / Pending', 
      value: overview.pendingComplaints || 0, 
      icon: Clock, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50 border border-amber-100/80' 
    },
    { 
      title: 'Overdue (SLA Breached)', 
      value: totalBreaches, 
      icon: AlertTriangle, 
      color: 'text-rose-600', 
      bg: 'bg-rose-50 border border-rose-100/80' 
    },
    { 
      title: 'Avg. Resolution Time', 
      value: `${overview.avgResolutionTimeHours || 0} hrs`, 
      icon: Zap, 
      color: 'text-indigo-600', 
      bg: 'bg-indigo-50 border border-indigo-100/80' 
    },
    { 
      title: 'On-Time Rate', 
      value: `${slaMetrics.slaComplianceRate || 0}%`, 
      icon: ShieldCheck, 
      color: (slaMetrics.slaComplianceRate || 0) >= 80 ? 'text-emerald-600' : 'text-rose-600', 
      bg: (slaMetrics.slaComplianceRate || 0) >= 80 
        ? 'bg-emerald-50 border border-emerald-100/80' 
        : 'bg-rose-50 border border-rose-100/80' 
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Summary of all complaints, department progress, and staff performance.
          </p>
        </div>

        {/* Date Filter Segmented Pill & Centered Custom Range */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="inline-flex items-center gap-1 bg-white border border-slate-200/80 rounded-xl p-1 shadow-sm">
            {(['7D', '30D', '90D', 'All Time', 'Custom'] as const).map((type) => {
              const active = filterType === type;
              return (
                <button
                  key={type}
                  onClick={() => handleFilterClick(type)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>

          {/* Centered Sleek Custom Date Picker */}
          {filterType === 'Custom' && (
            <div className="bg-white border border-slate-200/80 rounded-xl px-3 py-1.5 shadow-sm inline-flex items-center gap-2.5 text-sm">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent font-medium text-slate-800 text-xs outline-none cursor-pointer"
              />
              <span className="text-slate-400 font-semibold text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent font-medium text-slate-800 text-xs outline-none cursor-pointer"
              />
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards (3x2 Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi, idx) => (
          <div
            key={idx}
            className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-medium text-slate-500 tracking-tight">{kpi.title}</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{kpi.value}</h3>
            </div>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${kpi.bg}`}>
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Tables Stacked Vertically (Full Width, one above the other) */}
      <div className="space-y-6">
        {/* Top Card: Department Performance (Full Width) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 md:p-7 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Department Performance</h2>
                <p className="text-xs text-slate-500 mt-0.5">Summary of complaints, overdue tickets, and on-time completion by department</p>
              </div>
            </div>

            {/* Department Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search departments..."
                value={departmentSearch}
                onChange={(e) => setDepartmentSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors placeholder:text-slate-400"
              />
              {departmentSearch && (
                <button
                  type="button"
                  onClick={() => setDepartmentSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-5">
            {departments.length === 0 ? (
              <div className="py-12 text-center text-xs font-medium text-slate-400">
                No department data found for this time period.
              </div>
            ) : filteredDepartments.length === 0 ? (
              <div className="py-12 text-center text-xs font-medium text-slate-400">
                No matching departments found.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[320px] overflow-y-auto rounded-xl border border-slate-100">
                <table className="w-full text-left text-sm border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold text-xs tracking-wide">
                      <th className="px-6 py-3.5 bg-slate-50">Department Name</th>
                      <th className="px-6 py-3.5 text-center bg-slate-50">Total Complaints</th>
                      <th className="px-6 py-3.5 text-center bg-slate-50">Overdue (Breached)</th>
                      <th className="px-6 py-3.5 text-center bg-slate-50">Avg. Time</th>
                      <th className="px-6 py-3.5 text-right bg-slate-50">On-Time Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDepartments.map((dept: any, i: number) => {
                      const hasComplaints = (dept.totalComplaints || 0) > 0;
                      const rate = dept.complianceRate;
                      return (
                        <tr key={dept._id || i} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-4 font-semibold text-slate-800 whitespace-nowrap">
                            {dept.departmentName || 'General'}
                          </td>
                          <td className="px-6 py-4 text-center text-slate-600 font-medium tabular-nums">
                            {dept.totalComplaints || 0}
                          </td>
                          <td className="px-6 py-4 text-center font-medium tabular-nums">
                            {(dept.slaBreached || 0) > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
                                {dept.slaBreached}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center text-slate-600 tabular-nums">
                            {dept.avgResolutionTimeHours ? `${dept.avgResolutionTimeHours} hrs` : '—'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {!hasComplaints || rate === null || rate === undefined ? (
                              <span className="text-slate-400 font-medium text-xs">
                                —
                              </span>
                            ) : (
                              <span
                                className={`inline-block px-3 py-1 rounded-full font-bold text-xs tabular-nums ${
                                  rate >= 80
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                                    : rate >= 60
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200/70'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200/70'
                                }`}
                              >
                                {rate}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Card: Staff Performance (Full Width) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 md:p-7 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Staff Performance</h2>
                <p className="text-xs text-slate-500 mt-0.5">Assigned complaints, overdue tickets, and resolution speed per staff member</p>
              </div>
            </div>

            {/* Staff Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search staff..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors placeholder:text-slate-400"
              />
              {staffSearch && (
                <button
                  type="button"
                  onClick={() => setStaffSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-5">
            {staff.length === 0 ? (
              <div className="py-12 text-center text-xs font-medium text-slate-400">
                No staff performance data found for this time period.
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="py-12 text-center text-xs font-medium text-slate-400">
                No matching staff found.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[320px] overflow-y-auto rounded-xl border border-slate-100">
                <table className="w-full text-left text-sm border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold text-xs tracking-wide">
                      <th className="px-6 py-3.5 bg-slate-50">Staff Member</th>
                      <th className="px-6 py-3.5 text-center bg-slate-50">Assigned Complaints</th>
                      <th className="px-6 py-3.5 text-center bg-slate-50">Overdue (Breached)</th>
                      <th className="px-6 py-3.5 text-center bg-slate-50">Avg. Time</th>
                      <th className="px-6 py-3.5 text-right bg-slate-50">On-Time Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStaff.map((usr: any, i: number) => {
                      const hasAssigned = (usr.assignedCount || 0) > 0;
                      const rate = usr.complianceRate;
                      return (
                        <tr key={usr._id || i} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-4 font-semibold text-slate-800 whitespace-nowrap">
                            {usr.staffName || 'Staff Member'}
                          </td>
                          <td className="px-6 py-4 text-center text-slate-600 font-medium tabular-nums">
                            {usr.assignedCount || 0}
                          </td>
                          <td className="px-6 py-4 text-center font-medium tabular-nums">
                            {(usr.slaBreaches || 0) > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
                                {usr.slaBreaches}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center text-slate-600 tabular-nums">
                            {usr.avgResolutionTimeHours ? `${usr.avgResolutionTimeHours} hrs` : '—'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {!hasAssigned || rate === null || rate === undefined ? (
                              <span className="text-slate-400 font-medium text-xs">
                                —
                              </span>
                            ) : (
                              <span
                                className={`inline-block px-3 py-1 rounded-full font-bold text-xs tabular-nums ${
                                  rate >= 80
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                                    : rate >= 60
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200/70'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200/70'
                                }`}
                              >
                                {rate}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
