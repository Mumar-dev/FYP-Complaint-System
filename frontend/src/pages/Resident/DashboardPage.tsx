import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useGetComplaintsQuery } from '../../features/complaint/complaint.api';
import { ROUTES } from '../../constants';
import { Plus, Clock, CheckCircle2, AlertTriangle, ArrowUpRight, FileText } from 'lucide-react';

const STATUS_STAGES = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' }
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  submitted: { label: 'Awaiting Assignment', bg: 'bg-amber-50 border-amber-200/60', text: 'text-amber-800', dot: 'bg-amber-500' },
  pending: { label: 'Awaiting Assignment', bg: 'bg-amber-50 border-amber-200/60', text: 'text-amber-800', dot: 'bg-amber-500' },
  pending_assignment: { label: 'Awaiting Assignment', bg: 'bg-amber-50 border-amber-200/60', text: 'text-amber-800', dot: 'bg-amber-500' },
  assigned: { label: 'Assigned', bg: 'bg-blue-50 border-blue-200/60', text: 'text-blue-800', dot: 'bg-blue-500' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-50 border-blue-200/60', text: 'text-blue-800', dot: 'bg-blue-500' },
  'in-progress': { label: 'In Progress', bg: 'bg-blue-50 border-blue-200/60', text: 'text-blue-800', dot: 'bg-blue-500' },
  resolved: { label: 'Resolved', bg: 'bg-emerald-50 border-emerald-200/60', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  completed: { label: 'Resolved', bg: 'bg-emerald-50 border-emerald-200/60', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  closed: { label: 'Closed', bg: 'bg-gray-100 border-gray-200', text: 'text-gray-700', dot: 'bg-gray-400' },
  rejected: { label: 'Declined', bg: 'bg-rose-50 border-rose-200/60', text: 'text-rose-800', dot: 'bg-rose-500' },
  cancelled: { label: 'Cancelled', bg: 'bg-gray-100 border-gray-200', text: 'text-gray-600', dot: 'bg-gray-400' },
  reopened: { label: 'Reopened', bg: 'bg-purple-50 border-purple-200/60', text: 'text-purple-800', dot: 'bg-purple-500' },
};

const PRIORITY_CONFIG: Record<string, { label: string; text: string; bg: string }> = {
  low: { label: 'Low', text: 'text-gray-600', bg: 'bg-gray-100' },
  medium: { label: 'Medium', text: 'text-blue-700', bg: 'bg-blue-50' },
  high: { label: 'High', text: 'text-amber-700', bg: 'bg-amber-50' },
  critical: { label: 'Urgent', text: 'text-rose-700', bg: 'bg-rose-50' },
};

const DashboardPage: React.FC = () => {
  const { data: response, isLoading, isError, refetch } = useGetComplaintsQuery();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-gray-200/70 animate-pulse rounded-xl w-64"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-white border border-gray-100 animate-pulse rounded-2xl"></div>
          ))}
        </div>
        <div className="h-64 bg-white border border-gray-100 animate-pulse rounded-2xl"></div>
      </div>
    );
  }

  if (isError || !response?.success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[360px] p-8 text-center bg-white border border-gray-100 rounded-2xl shadow-xs">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1">Unable to Load Dashboard</h3>
        <p className="text-sm text-gray-500 mb-4 max-w-sm">We ran into an issue retrieving your latest complaint records. Please try again.</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold text-xs shadow-xs"
        >
          Try Again
        </button>
      </div>
    );
  }

  const complaints = response.data || [];

  // Compute Stats
  const stats = complaints.reduce(
    (acc: any, curr: any) => {
      acc.total += 1;
      const rawStatus = (curr.status || '').toLowerCase();
      const isActive = ['pending', 'pending_assignment', 'submitted', 'assigned', 'in_progress', 'in-progress'].includes(rawStatus);
      if (isActive) acc.active += 1;
      if (rawStatus === 'resolved' || rawStatus === 'completed' || rawStatus === 'closed') acc.resolved += 1;
      if (curr.slaBreached) acc.slaBreached += 1;
      return acc;
    },
    { total: 0, active: 0, resolved: 0, slaBreached: 0 }
  );

  const getSLAStatus = (complaint: any) => {
    const rawStatus = (complaint.status || '').toLowerCase();
    if (rawStatus === 'resolved' || rawStatus === 'completed' || rawStatus === 'closed') {
      return { label: 'Completed', color: 'text-gray-600', bg: 'bg-gray-100' };
    }
    
    if (complaint.slaBreached) {
      return { label: 'Overdue', color: 'text-rose-700', bg: 'bg-rose-50 border border-rose-200/60' };
    }

    if (!complaint.slaDeadline) {
      return { label: 'Standard', color: 'text-gray-600', bg: 'bg-gray-50' };
    }

    const now = new Date();
    const deadline = new Date(complaint.slaDeadline);
    const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursLeft <= 2 && hoursLeft > 0) {
      return { label: 'Due Soon', color: 'text-amber-700', bg: 'bg-amber-50 border border-amber-200/60' };
    }

    return { label: 'On Schedule', color: 'text-emerald-700', bg: 'bg-emerald-50' };
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const getProgressInfo = (status: string) => {
    const s = (status || '').toLowerCase();
    // Progress calculation based on requirements:
    // submitted -> 25% (step index 0)
    // assigned -> 50% (step index 1)
    // in_progress / under_verification -> 75% (step index 2)
    // resolved / closed / completed -> 100% (step index 3)
    if (s === 'resolved' || s === 'completed' || s === 'closed') {
      return { stepIndex: 3, percentage: 100 };
    }
    if (s === 'in_progress' || s === 'in-progress' || s === 'under_verification') {
      return { stepIndex: 2, percentage: 75 };
    }
    if (s === 'assigned') {
      return { stepIndex: 1, percentage: 50 };
    }
    // Default: submitted, pending, pending_assignment
    return { stepIndex: 0, percentage: 25 };
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Resident Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back. Monitor your active service requests and community issues.
          </p>
        </div>
        <Link
          to={ROUTES.RESIDENT_SUBMIT_COMPLAINT}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs hover:shadow-sm transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Submit a Complaint</span>
        </Link>
      </div>

      {/* Top Clean Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-gray-500 mb-1">Total Requests</p>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">{stats.total}</p>
        </div>
        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-blue-600 mb-1">In Progress</p>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">{stats.active}</p>
        </div>
        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-emerald-600 mb-1">Resolved</p>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">{stats.resolved}</p>
        </div>
        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-amber-600 mb-1">Pending Assignment</p>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">
            {complaints.filter((c: any) => ['submitted', 'pending', 'pending_assignment'].includes((c.status || '').toLowerCase())).length}
          </p>
        </div>
      </div>

      {/* Recent Complaints Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 tracking-tight">Recent Complaints</h2>
          {complaints.length > 0 && (
            <Link
              to={ROUTES.RESIDENT_MY_COMPLAINTS}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            >
              <span>View Full History</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
        
        {complaints.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-xs">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900">No requests submitted yet</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              If you have any facility issues like plumbing, electrical, or maintenance, lodge a request and our team will assist you.
            </p>
            <Link
              to={ROUTES.RESIDENT_SUBMIT_COMPLAINT}
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Submit a Complaint</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3.5">
            {complaints.slice(0, 5).map((complaint: any) => {
              const rawStatus = (complaint.status || '').toLowerCase();
              const statusInfo = STATUS_CONFIG[rawStatus] || {
                label: complaint.status ? complaint.status.replace(/_/g, ' ') : 'Pending',
                bg: 'bg-gray-50 border-gray-200',
                text: 'text-gray-700',
                dot: 'bg-gray-400'
              };

              const rawPriority = (complaint.priority || 'medium').toLowerCase();
              const priorityInfo = PRIORITY_CONFIG[rawPriority] || {
                label: complaint.priority || 'Medium',
                text: 'text-gray-700',
                bg: 'bg-gray-50'
              };

              const sla = getSLAStatus(complaint);
              const { stepIndex: currentStageIndex, percentage: progressPercentage } = getProgressInfo(complaint.status);
              const isResolvedState = ['resolved', 'completed', 'closed'].includes(rawStatus);

              return (
                <div 
                  key={complaint._id}
                  onClick={() => navigate(ROUTES.RESIDENT_COMPLAINT_DETAIL.replace(':id', complaint._id))}
                  className="bg-white border border-gray-200/80 hover:border-blue-200/80 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.bg} ${statusInfo.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></span>
                          {statusInfo.label}
                        </span>

                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${priorityInfo.bg} ${priorityInfo.text}`}>
                          {priorityInfo.label} Priority
                        </span>

                        {complaint.complaintId && (
                          <span className="text-[11px] font-mono font-medium text-gray-400">
                            #{complaint.complaintId}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-base text-gray-900 tracking-tight pt-1">
                        {complaint.title}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {complaint.description}
                      </p>
                    </div>

                    <div className="text-left sm:text-right flex sm:flex-col items-center sm:items-end justify-between gap-1 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                      <span className="text-xs text-gray-400 font-medium">Submitted {formatDate(complaint.createdAt)}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${sla.bg} ${sla.color}`}>
                        {sla.label}
                      </span>
                    </div>
                  </div>

                  {/* Minimal Subtle Step Tracker */}
                  <div className="pt-2 border-t border-gray-100">
                    <div className="overflow-hidden h-1.5 flex rounded-full bg-gray-100 mb-2">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          isResolvedState ? 'bg-emerald-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${progressPercentage}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[11px] font-medium text-gray-400">
                      <span className={currentStageIndex >= 0 ? (isResolvedState ? 'text-emerald-600 font-semibold' : 'text-blue-600 font-semibold') : ''}>
                        Submitted
                      </span>
                      <span className={currentStageIndex >= 1 ? (isResolvedState ? 'text-emerald-600 font-semibold' : 'text-blue-600 font-semibold') : ''}>
                        Assigned
                      </span>
                      <span className={currentStageIndex >= 2 ? (isResolvedState ? 'text-emerald-600 font-semibold' : 'text-blue-600 font-semibold') : ''}>
                        In Progress
                      </span>
                      <span className={currentStageIndex >= 3 ? 'text-emerald-600 font-semibold' : ''}>
                        Resolved
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
