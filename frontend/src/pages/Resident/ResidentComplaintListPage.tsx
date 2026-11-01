import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '@components/Common/Card';
import Button from '@components/Common/Button';
import {
  FileText,
  RefreshCw,
  Clock,
  MapPin,
  Tag,
  Calendar,
  AlertCircle,
  Plus,
  ArrowRight
} from 'lucide-react';
import { useGetComplaintsQuery } from '@/features/complaint/complaint.api';
import { useReopenComplaintMutation } from '@/features/sla/sla.api';
import { ROUTES } from '@/constants';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  submitted: { label: 'Waiting for Team', bg: 'bg-amber-50 border-amber-200/80', text: 'text-amber-800', dot: 'bg-amber-500' },
  pending: { label: 'Waiting for Team', bg: 'bg-amber-50 border-amber-200/80', text: 'text-amber-800', dot: 'bg-amber-500' },
  pending_assignment: { label: 'Waiting for Team', bg: 'bg-amber-50 border-amber-200/80', text: 'text-amber-800', dot: 'bg-amber-500' },
  assigned: { label: 'Assigned', bg: 'bg-blue-50 border-blue-200/80', text: 'text-blue-800', dot: 'bg-blue-500' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-50 border-blue-200/80', text: 'text-blue-800', dot: 'bg-blue-500' },
  'in-progress': { label: 'In Progress', bg: 'bg-blue-50 border-blue-200/80', text: 'text-blue-800', dot: 'bg-blue-500' },
  resolved: { label: 'Resolved', bg: 'bg-emerald-50 border-emerald-200/80', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  completed: { label: 'Resolved', bg: 'bg-emerald-50 border-emerald-200/80', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  closed: { label: 'Closed', bg: 'bg-slate-100 border-slate-200', text: 'text-slate-700', dot: 'bg-slate-400' },
  rejected: { label: 'Declined', bg: 'bg-rose-50 border-rose-200/80', text: 'text-rose-800', dot: 'bg-rose-500' },
  cancelled: { label: 'Cancelled', bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400' },
  reopened: { label: 'Reopened', bg: 'bg-purple-50 border-purple-200/80', text: 'text-purple-800', dot: 'bg-purple-500' },
};

const PRIORITY_CONFIG: Record<string, { label: string; text: string; bg: string }> = {
  low: { label: 'Low', text: 'text-slate-600', bg: 'bg-slate-100' },
  medium: { label: 'Medium', text: 'text-blue-700', bg: 'bg-blue-50' },
  high: { label: 'High', text: 'text-amber-700', bg: 'bg-amber-50' },
  critical: { label: 'Urgent', text: 'text-rose-700', bg: 'bg-rose-50' },
};

const getProgressInfo = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'resolved' || s === 'completed' || s === 'closed') {
    return { stepIndex: 3, percentage: 100 };
  }
  if (s === 'in_progress' || s === 'in-progress' || s === 'under_verification') {
    return { stepIndex: 2, percentage: 75 };
  }
  if (s === 'assigned') {
    return { stepIndex: 1, percentage: 50 };
  }
  return { stepIndex: 0, percentage: 25 };
};

const ResidentComplaintListPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: complaintsData, isLoading, refetch } = useGetComplaintsQuery();
  const [reopenComplaint, { isLoading: reopening }] = useReopenComplaintMutation();

  const [showReopenModal, setShowReopenModal] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState('');
  const [reopenReason, setReopenReason] = useState('');

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason.trim()) {
      toast.error('Please specify why the resolution was unsatisfactory');
      return;
    }
    try {
      await reopenComplaint({
        id: selectedComplaintId,
        reopenReason,
      }).unwrap();
      toast.success('Complaint reopened and escalated to supervisor');
      setShowReopenModal(false);
      setReopenReason('');
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to reopen complaint');
    }
  };

  const complaints = complaintsData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header section with modern clean styling */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">My Complaints</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Check the status and updates on issues you've reported.
          </p>
        </div>
        <Link
          to={ROUTES.RESIDENT_SUBMIT_COMPLAINT}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Submit a Complaint</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-500 font-medium">Loading your complaints...</p>
        </div>
      ) : complaints.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No complaints registered</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            You currently have no complaints on record. Whenever you notice a facility issue, you can report it easily.
          </p>
          <Link
            to={ROUTES.RESIDENT_SUBMIT_COMPLAINT}
            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Submit Your First Complaint</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {complaints.map((c: any) => {
            const rawStatus = (c.status || '').toLowerCase();
            const statusInfo = STATUS_CONFIG[rawStatus] || {
              label: c.status ? c.status.replace(/_/g, ' ') : 'Pending Review',
              bg: 'bg-slate-50 border-slate-200',
              text: 'text-slate-700',
              dot: 'bg-slate-400'
            };

            const rawPriority = (c.priority || 'medium').toLowerCase();
            const priorityInfo = PRIORITY_CONFIG[rawPriority] || {
              label: c.priority || 'Medium',
              text: 'text-slate-700',
              bg: 'bg-slate-50'
            };

            // Human-friendly location formatting (never show raw coordinates on card)
            const complaintLocation = typeof c.location === 'object' && c.location !== null
              ? c.location.address || (c.location.lat && c.location.lng ? 'Pinned GPS Location' : c.location.type === 'home' ? 'Home Location' : 'Society Area')
              : (typeof c.location === 'string' && c.location.toLowerCase().includes('lat')) ? 'Pinned GPS Location' : c.location || 'Society Area';

            const complaintCategory = typeof c.category === 'object' && c.category !== null
              ? (c.category as any).name || 'General'
              : c.category || 'General';

            const isResolvedOrCompleted = rawStatus === 'resolved' || rawStatus === 'completed';

            // Check if title and description are redundant/identical
            const titleClean = (c.title || '').trim().toLowerCase();
            const descClean = (c.description || '').trim().toLowerCase();
            const isRedundant = titleClean && descClean && (descClean.startsWith(titleClean) || titleClean.startsWith(descClean));

            const targetUrl = ROUTES.RESIDENT_COMPLAINT_DETAIL.replace(':id', c._id || c.id);

            return (
              <div
                key={c._id || c.id}
                onClick={() => navigate(targetUrl)}
                className="bg-white border border-slate-200/90 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 rounded-2xl p-5 sm:p-6 shadow-xs transition-all duration-200 flex flex-col gap-4 cursor-pointer group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2.5 flex-1 min-w-0">
                    {/* Top line: Status & Priority */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.bg} ${statusInfo.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></span>
                        {statusInfo.label}
                      </span>

                      <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold ${priorityInfo.bg} ${priorityInfo.text}`}>
                        {priorityInfo.label}
                      </span>
                    </div>

                    {/* Title & Description with duplicate text eliminated */}
                    <div>
                      <h3 className="font-bold text-slate-900 text-base tracking-tight group-hover:text-blue-600 transition-colors">
                        {c.title}
                      </h3>
                      {!isRedundant && c.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                          {c.description}
                        </p>
                      )}
                    </div>

                    {/* Metadata Chips: Location, Category, Formatted Date */}
                    <div className="flex flex-wrap items-center gap-y-1.5 gap-x-5 text-xs text-slate-500 pt-0.5">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-none" />
                        <span className="font-medium text-slate-700">{complaintLocation}</span>
                      </span>

                      <span className="inline-flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-slate-400 flex-none" />
                        <span className="font-medium text-slate-700">{complaintCategory}</span>
                      </span>

                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 flex-none" />
                        <span className="font-medium text-slate-700">
                          {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Right Column: ID Pill Badge + Action Buttons in a crisp vertical line */}
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 self-stretch md:self-auto flex-none pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    {c.complaintId && (
                      <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100/90 px-2.5 py-1 rounded-md border border-slate-200/70 shadow-2xs">
                        #{c.complaintId}
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-blue-600 bg-blue-50/60 group-hover:bg-blue-600 group-hover:text-white rounded-xl transition-all border border-blue-100 shadow-2xs"
                      >
                        <span>View Details</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>

                      {isResolvedOrCompleted && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedComplaintId(c._id || c.id);
                            setShowReopenModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100/80 rounded-xl border border-amber-200/80 transition-colors"
                        >
                          <RefreshCw className="w-3 h-3 text-amber-600" />
                          <span>Reopen</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Horizontal Progress Bar & Step Highlighting */}
                {(() => {
                  const { stepIndex: currentStageIndex, percentage: progressPercentage } = getProgressInfo(c.status);
                  const isResolvedState = ['resolved', 'completed', 'closed'].includes(rawStatus);

                  return (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="overflow-hidden h-1.5 flex rounded-full bg-slate-100 mb-2">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            isResolvedState ? 'bg-emerald-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${progressPercentage}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[11px] font-medium text-slate-400">
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
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* REOPEN MODAL */}
      {showReopenModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-base font-bold text-slate-900">Request Reopening</h3>
              <p className="text-xs text-slate-500 mt-1">
                Please explain why the resolution was not satisfactory. Our supervisory team will review your request.
              </p>
            </div>
            <form onSubmit={handleReopenSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Reason for Reopening
                </label>
                <textarea
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
                  rows={4}
                  placeholder="e.g. Issue recurred after 2 hours; wiring was left uncovered..."
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reopening}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {reopening ? 'Submitting...' : 'Reopen Complaint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResidentComplaintListPage;
