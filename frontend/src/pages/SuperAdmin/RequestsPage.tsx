import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Clock, 
  CheckCircle2, 
  Timer, 
  AlertTriangle,
  Tag
} from 'lucide-react';
import { axiosInstance } from '../../services/customBaseQuery';
import { showSuccess, showError } from '@/utils/toast';

interface DepartmentRequest {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  slaTargetHours?: number;
  keywords?: string[];
  positions?: string[];
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  createdBy?: {
    profile?: {
      fullName?: string;
    };
    email?: string;
  };
  createdAt?: string;
}

const SuperAdminRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<DepartmentRequest[]>([]);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/departments');
      const allDepts = res.data?.data || [];
      
      const pendingDepts = allDepts.filter((d: any) => d.approvalStatus === 'pending');
      const activeDepts = allDepts.filter((d: any) => d.approvalStatus === 'approved' && d.isActive === true);
      
      setRequests(pendingDepts);
      setActiveCount(activeDepts.length);
    } catch (error) {
      console.error('Error fetching departments:', error);
      showError('Failed to load department requests.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (deptId: string) => {
    try {
      setIsSubmitting(true);
      await axiosInstance.put(`/departments/${deptId}`, { approvalStatus: 'approved' });
      setRequests(prev => prev.filter(r => r._id !== deptId));
      setActiveCount(prev => prev + 1);
      showSuccess('Department approved successfully.');
    } catch (error: any) {
      console.error('Error approving department:', error);
      showError(error.response?.data?.message || 'Failed to approve department');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (deptId: string) => {
    if (!rejectReason.trim()) {
      showError('Please provide a reason for rejection');
      return;
    }

    try {
      setIsSubmitting(true);
      await axiosInstance.put(`/departments/${deptId}`, {
        approvalStatus: 'rejected',
        rejectionReason: rejectReason.trim()
      });
      setRequests(prev => prev.filter(r => r._id !== deptId));
      setSelectedId(null);
      setRejectReason('');
      showSuccess('Department request rejected.');
    } catch (error: any) {
      console.error('Error rejecting department:', error);
      showError(error.response?.data?.message || 'Failed to reject department');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Department Approvals</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review and approve new department creation requests from administrators
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Pending Approvals */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                Pending Approvals
              </p>
              <p className="text-3xl font-black text-slate-900 tracking-tight mt-2 tabular-nums">
                {loading ? '...' : requests.length}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Active Departments */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                Active Departments
              </p>
              <p className="text-3xl font-black text-slate-900 tracking-tight mt-2 tabular-nums">
                {loading ? '...' : activeCount}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Requests Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Pending Queue ({requests.length})
          </h2>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200/80 py-16 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-500">Loading department requests...</p>
          </div>
        ) : requests.length > 0 ? (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request._id}
                className="bg-white rounded-xl border border-slate-200/80 hover:border-slate-300 p-6 shadow-sm transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  {/* Left Column: Details */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900">
                        {request.name}
                      </h3>
                      {request.code && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {request.code}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3 h-3" />
                        Pending Approval
                      </span>
                    </div>

                    {request.description ? (
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {request.description}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No description provided.</p>
                    )}

                    {/* Metadata items */}
                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 flex-wrap">
                      {request.slaTargetHours !== undefined && (
                        <div className="flex items-center gap-1.5 font-medium text-slate-700">
                          <Timer className="w-3.5 h-3.5 text-slate-400" />
                          <span>SLA Target: <strong>{request.slaTargetHours} hrs</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Keywords / Categories */}
                    {request.keywords && request.keywords.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {request.keywords.map((keyword, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full font-medium"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex items-center gap-2.5 shrink-0 self-start">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleApprove(request._id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        setSelectedId(selectedId === request._id ? null : request._id);
                        setRejectReason('');
                      }}
                      className="bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 hover:border-red-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {/* Inline Rejection Drawer */}
                {selectedId === request._id && (
                  <div className="mt-5 pt-5 border-t border-slate-100 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span>Specify Rejection Reason (sent to submitting administrator)</span>
                    </div>
                    <textarea
                      placeholder="e.g., Duplicate scope with Facilities department; please consolidate responsibilities..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(null);
                          setRejectReason('');
                        }}
                        className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSubmitting || !rejectReason.trim()}
                        onClick={() => handleReject(request._id)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="bg-white rounded-xl border border-slate-200/80 py-14 px-6 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              No pending requests
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              All department creation requests submitted by administrators have been reviewed and approved.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminRequestsPage;
