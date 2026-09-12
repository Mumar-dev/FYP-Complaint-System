import React, { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Inbox,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { ROUTES } from '../../constants';
import { getSLAStatus } from '@/utils/sla';
import { useGetStaffDashboardQuery } from '../../features/complaint/complaint.api';
import { useAuth } from '@/hooks/useAuth';

const StaffDashboardPage: React.FC = () => {
  const { data: response, isLoading, isError, refetch } = useGetStaffDashboardQuery();
  const { user } = useAuth();
  const navigate = useNavigate();

  const staffName =
    user?.profile?.fullName || (user as any)?.name || user?.email?.split('@')[0] || 'Staff Member';

  const { stats, myComplaints } = response?.data || {};

  // Compute live Overdue / At Risk count accurately from tickets
  const computedOverdueOrAtRiskCount = useMemo(() => {
    if (!myComplaints || !Array.isArray(myComplaints)) return stats?.slaAtRisk || 0;
    const countFromList = myComplaints.filter((c: any) => {
      if (['resolved', 'closed'].includes(c.status)) return false;
      const sla = getSLAStatus(c);
      return sla.type === 'danger' || sla.type === 'warning';
    }).length;

    // Use whichever is larger between server stats and current visible complaints
    return Math.max(countFromList, stats?.slaAtRisk || 0);
  }, [myComplaints, stats?.slaAtRisk]);

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="h-10 w-48 bg-slate-100 animate-pulse rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-2xl" />
          ))}
        </div>
        <div className="h-80 bg-slate-100 animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (isError || !response?.success) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
        <div className="text-rose-600 bg-rose-50 p-6 rounded-2xl text-center max-w-md border border-rose-100 shadow-sm">
          <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-rose-500" />
          <h3 className="text-base font-bold mb-1 text-slate-900">Failed to load dashboard</h3>
          <p className="text-xs text-slate-500 mb-4">There was an error retrieving your assigned tickets.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition font-medium text-xs shadow-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            In Progress
          </span>
        );
      case 'resolved':
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Resolved
          </span>
        );
      case 'assigned':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Assigned
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    const p = (priority || '').toLowerCase();
    switch (p) {
      case 'critical':
      case 'high':
      case 'urgent':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            {p === 'critical' ? 'Critical' : 'High'}
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Medium
          </span>
        );
      case 'low':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Low
          </span>
        );
    }
  };

  const getStaffRankBadge = (rank?: string) => {
    const r = (rank || '').toLowerCase();
    switch (r) {
      case 'supervisor':
        return {
          label: 'Supervisor',
          className: 'bg-purple-50 text-purple-700 border-purple-200/80'
        };
      case 'team_lead':
      case 'lead':
        return {
          label: 'Team Lead',
          className: 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
        };
      case 'senior':
        return {
          label: 'Senior',
          className: 'bg-blue-50 text-blue-700 border-blue-200/80'
        };
      case 'junior':
      default:
        return {
          label: 'Junior',
          className: 'bg-slate-100 text-slate-700 border-slate-200/80'
        };
    }
  };

  const staffRank = user?.rank || response?.data?.staff?.rank || 'junior';
  const rankBadge = getStaffRankBadge(staffRank);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 animate-in fade-in duration-200">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Welcome, {staffName}
            </h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${rankBadge.className}`}
              title={`Staff Rank: ${rankBadge.label}`}
            >
              {rankBadge.label}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Track your assigned complaints and upcoming deadlines.
          </p>
        </div>
      </div>

      {/* ── 4 KPI Cards Row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Assigned to Me */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition-all flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Assigned to Me</span>
            <div className="text-3xl font-bold text-slate-900 tabular-nums mt-1">
              {stats?.totalAssigned || 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">Total active workload</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Inbox className="w-5 h-5" />
          </div>
        </div>

        {/* 2. In Progress */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition-all flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">In Progress</span>
            <div className="text-3xl font-bold text-slate-900 tabular-nums mt-1">
              {stats?.inProgress || 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">Under investigation</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* 3. Resolved Today */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition-all flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Resolved Today</span>
            <div className="text-3xl font-bold text-slate-900 tabular-nums mt-1">
              {stats?.resolvedToday || 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">Closed in past 24h</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* 4. Overdue / At Risk */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition-all flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Overdue / At Risk</span>
            <div className="text-3xl font-bold text-rose-600 tabular-nums mt-1">
              {computedOverdueOrAtRiskCount}
            </div>
            <p className="text-xs text-slate-400 mt-1">Requires immediate attention</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Recent Assignments Table ────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Recent Assignments</h2>
            {myComplaints && myComplaints.length > 0 && (
              <span className="text-xs text-slate-500 bg-slate-100 font-medium px-2 py-0.5 rounded-full">
                {myComplaints.length}
              </span>
            )}
          </div>
          <Link
            to={ROUTES.STAFF_ASSIGNED_COMPLAINTS}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 group transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Table Body */}
        {!myComplaints || myComplaints.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-3">
              <Inbox className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">Your queue is currently empty</p>
            <p className="text-xs text-slate-400 mt-1">New complaint assignments will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Complaint</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Priority</th>
                  <th className="px-6 py-3.5">Due By</th>
                  <th className="px-6 py-3.5 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {myComplaints.map((item: any) => {
                  const sla = getSLAStatus(item);
                  const isBreached = sla.type === 'danger';
                  const isAtRisk = sla.type === 'warning';
                  const complaintCode =
                    item.complaintId ||
                    `#${item._id.substring(item._id.length - 6).toUpperCase()}`;

                  return (
                    <tr
                      key={item._id}
                      onClick={() =>
                        navigate(ROUTES.STAFF_COMPLAINT_DETAIL.replace(':id', item._id))
                      }
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Complaint Title & Code */}
                      <td className="px-6 py-3.5">
                        <div className="min-w-0 max-w-sm">
                          <p className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {item.title || 'Untitled Complaint'}
                          </p>
                          <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/70 inline-block mt-0.5">
                            {complaintCode}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>

                      {/* Priority */}
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        {getPriorityBadge(item.priority)}
                      </td>

                      {/* Due By */}
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-700">
                            {formatDueDate(item.slaDeadline)}
                          </span>
                          {isBreached && (
                            <span className="bg-rose-50 text-rose-700 border border-rose-200/70 rounded-full px-2 py-0.5 text-[11px] font-medium">
                              Overdue
                            </span>
                          )}
                          {isAtRisk && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200/70 rounded-full px-2 py-0.5 text-[11px] font-medium">
                              Due Soon
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Right Chevron Link */}
                      <td className="px-6 py-3.5 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-blue-600 transition-colors">
                          <span className="hidden sm:inline">View</span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </span>
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
  );
};

export default StaffDashboardPage;
