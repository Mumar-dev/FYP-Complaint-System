import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Building2, 
  AlertCircle, 
  CheckCircle2, 
  ArrowUpRight, 
  BarChart3, 
  History, 
  Award, 
  FileText,
  Activity,
  ChevronRight,
  Clock,
  Check
} from 'lucide-react';
import { ROUTES } from '@constants/index';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../../services/customBaseQuery';
import { formatDistanceToNow, format } from 'date-fns';

interface DepartmentItem {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  approvalStatus?: string;
  createdBy?: {
    profile?: {
      fullName?: string;
    };
    email?: string;
  };
  createdAt?: string;
}

interface DashboardStats {
  totalUsers: number;
  totalComplaints: number;
  activeDepartments: number;
  resolvedComplaints: number;
  pendingComplaints: number;
  pendingDepartments: number;
  slaBreachedCount: number;
  slaCompliancePercentage: number;
}

interface RecentActivity {
  _id: string;
  action: string;
  entityType?: string;
  userRole?: string;
  userId?: {
    profile?: {
      fullName?: string;
    };
    email?: string;
    role?: string;
  };
  details?: any;
  createdAt: string;
}

const SuperAdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalComplaints: 0,
    activeDepartments: 0,
    resolvedComplaints: 0,
    pendingComplaints: 0,
    pendingDepartments: 0,
    slaBreachedCount: 0,
    slaCompliancePercentage: 100,
  });

  const [pendingDepartmentList, setPendingDepartmentList] = useState<DepartmentItem[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        const [overviewRes, deptsRes, auditRes] = await Promise.allSettled([
          axiosInstance.get('/dashboard/overview'),
          axiosInstance.get('/departments'),
          axiosInstance.get('/dashboard/audit-logs?limit=6')
        ]);

        let totalUsers = 0;
        let totalComplaints = 0;
        let activeDepartments = 0;
        let resolvedComplaints = 0;
        let pendingComplaints = 0;
        let pendingDepartments = 0;
        let slaBreachedCount = 0;
        let slaCompliancePercentage = 100;

        // 1. Dashboard Overview
        if (overviewRes.status === 'fulfilled') {
          const resPayload = overviewRes.value.data;
          const d = resPayload?.data || resPayload || {};
          totalUsers = Number(d.totalUsers) || 0;
          totalComplaints = Number(d.totalComplaints) || 0;
          activeDepartments = Number(d.activeDepartments) || 0;
          resolvedComplaints = (Number(d.statusBreakdown?.resolved) || 0) + (Number(d.statusBreakdown?.closed) || 0);
          pendingComplaints = (Number(d.statusBreakdown?.pending) || 0) + (Number(d.statusBreakdown?.assigned) || 0) + (Number(d.statusBreakdown?.inProgress) || 0);
          pendingDepartments = Number(d.pendingDepartments) || 0;
          slaBreachedCount = Number(d.slaBreachedComplaints) || 0;
          slaCompliancePercentage = d.slaCompliancePercentage ?? 100;
        }

        // 2. Departments fallback & pending list
        if (deptsRes.status === 'fulfilled') {
          const resPayload = deptsRes.value.data;
          const allDepts: DepartmentItem[] = Array.isArray(resPayload?.data) ? resPayload.data : Array.isArray(resPayload) ? resPayload : [];
          const activeDepts = allDepts.filter((dept) => (dept as any).isActive === true && dept.approvalStatus === 'approved');
          const pendingDepts = allDepts.filter((dept) => dept.approvalStatus === 'pending');
          if (activeDepartments === 0) activeDepartments = activeDepts.length;
          pendingDepartments = pendingDepts.length;
          setPendingDepartmentList(pendingDepts.slice(0, 5));
        }

        // 3. Recent Audit & System Activities
        if (auditRes.status === 'fulfilled') {
          const resPayload = auditRes.value.data;
          const rawLogs = resPayload?.data?.logs || resPayload?.data || resPayload?.logs || [];
          const logs = Array.isArray(rawLogs) ? rawLogs : [];
          setRecentActivities(logs.slice(0, 5));
        }

        setStats({
          totalUsers,
          totalComplaints,
          activeDepartments,
          resolvedComplaints,
          pendingComplaints,
          pendingDepartments,
          slaBreachedCount,
          slaCompliancePercentage,
        });
      } catch (error) {
        console.error('[SuperAdminDashboard] Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const kpis = [
    {
      label: 'TOTAL USERS',
      value: stats.totalUsers,
      icon: Users,
    },
    {
      label: 'TOTAL COMPLAINTS',
      value: stats.totalComplaints,
      icon: AlertCircle,
    },
    {
      label: 'ACTIVE DEPARTMENTS',
      value: stats.activeDepartments,
      icon: Building2,
    },
    {
      label: 'RESOLVED',
      value: stats.resolvedComplaints,
      icon: CheckCircle2,
    },
  ];

  const quickLinks = [
    {
      title: 'Department Analytics',
      description: 'System SLAs, volume metrics, and department benchmarks',
      icon: BarChart3,
      path: ROUTES.SUPERADMIN_ANALYTICS,
    },
    {
      title: 'System Audit Logs',
      description: 'Immutable record of security, role changes, and actions',
      icon: History,
      path: ROUTES.SUPERADMIN_AUDIT_LOGS,
    },
    {
      title: 'Admin Performance',
      description: 'Approval velocity, efficiency, and task throughput',
      icon: Award,
      path: ROUTES.SUPERADMIN_ADMIN_PERFORMANCE,
    },
    {
      title: 'System Reports',
      description: 'Generate comprehensive operational and audit reports',
      icon: FileText,
      path: ROUTES.SUPERADMIN_REPORTS,
    },
  ];

  const formatActivityAction = (action: string) => {
    let text = action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    
    // Ensure SLA acronym is capitalized
    text = text.replace(/\bSla\b/g, 'SLA');
    return text;
  };

  const getActivityDotClass = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('BREACH')) return 'bg-rose-500';
    if (act.includes('WARNING') || act.includes('THRESHOLD') || act.includes('PENDING')) return 'bg-amber-500';
    if (act.includes('APPROVED') || act.includes('RESOLVED')) return 'bg-emerald-500';
    return 'bg-blue-600';
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          System overview, operational metrics, and executive oversight
        </p>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div 
              key={idx} 
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
                    {kpi.label}
                  </p>
                  <p className="text-3xl font-black text-slate-900 tracking-tight mt-2 tabular-nums">
                    {loading ? '...' : kpi.value.toLocaleString()}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 shrink-0 ml-2">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Overview Section (2-Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Pending Department Approvals Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Building2 className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Department Approvals</h2>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  stats.pendingDepartments > 0 
                    ? 'bg-blue-50 text-blue-600 font-bold' 
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {stats.pendingDepartments} pending
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate(ROUTES.SUPERADMIN_REQUESTS)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition cursor-pointer"
              >
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* List of Pending Requests or Clean Balanced Empty State */}
            {stats.pendingDepartments > 0 && pendingDepartmentList.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {pendingDepartmentList.map((dept) => {
                  const requester = dept.createdBy?.profile?.fullName || dept.createdBy?.email || 'Administrator';
                  return (
                    <div key={dept._id} className="py-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-slate-50 text-slate-600 mt-0.5 shrink-0 border border-slate-200/60">
                          <Building2 className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-800 truncate">{dept.name}</h3>
                            {dept.code && (
                              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                {dept.code}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            Requested by <span className="font-medium text-slate-700">{requester}</span>
                            {dept.createdAt ? ` • ${formatDistanceToNow(new Date(dept.createdAt), { addSuffix: true })}` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(ROUTES.SUPERADMIN_REQUESTS)}
                        className="bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-200 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0 cursor-pointer"
                      >
                        Review
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <Check className="w-6 h-6 stroke-[2.5]" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">All caught up</h3>
                <p className="text-xs text-slate-500 max-w-xs mt-1 mb-4 leading-relaxed">
                  No pending department creation requests to review. All operational departments are up to date.
                </p>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.SUPERADMIN_REQUESTS)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 rounded-lg shadow-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Review Approvals
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recent System Activity / Audit Feed */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-slate-700" />
                <h2 className="text-base font-bold text-slate-900">Recent System Activity</h2>
              </div>
              <button
                onClick={() => navigate(ROUTES.SUPERADMIN_AUDIT_LOGS)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
              >
                View all logs <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {recentActivities.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No recent activity logged.
                </div>
              ) : (
                recentActivities.map((act) => {
                  const actorName = act.userId?.profile?.fullName || act.userId?.email || act.userRole || 'System';
                  const dotColor = getActivityDotClass(act.action);
                  return (
                    <div key={act._id} className="py-3 flex items-start justify-between gap-3 text-xs">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full ${dotColor} mt-1 shrink-0`} />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">
                            {formatActivityAction(act.action)}
                          </p>
                          <p className="text-slate-500 text-[11px] mt-0.5 truncate">
                            By <span className="font-medium text-slate-700">{actorName}</span>
                            {act.entityType ? ` • ${act.entityType}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className="text-slate-400 text-[11px] whitespace-nowrap shrink-0">
                        {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Administrative Links (Management Modules) */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Management Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((ql, idx) => {
            const Icon = ql.icon;
            return (
              <div
                key={idx}
                onClick={() => navigate(ql.path)}
                className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md hover:border-blue-200 hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {ql.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                    {ql.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboardPage;
