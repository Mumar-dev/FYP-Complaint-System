import React, { useState, useMemo } from 'react';
import {
  ArrowRightLeft,
  Check,
  X,
  Search,
  Filter,
  AlertCircle,
  FileText,
  Clock,
  ArrowRight,
  Shield,
  Loader2,
  Building2,
  CheckCircle2,
  XCircle,
  User,
  Users
} from 'lucide-react';
import {
  useGetComplaintTransferRequestsQuery,
  useApproveComplaintTransferMutation,
  useRejectComplaintTransferMutation,
} from '@/features/complaint/complaint.api';
import {
  useGetEmployeeTransfersQuery,
  useReviewTransferMutation
} from '@/features/hr/hr.api';
import UserAvatar from '@/components/Common/UserAvatar';
import { showSuccess, showError } from '@/utils/toast';

export const AdminTransferRequestsPage: React.FC = () => {
  // Main Tab: 'complaints' vs 'staff'
  const [mainTab, setMainTab] = useState<'complaints' | 'staff'>('complaints');

  const [activeStatusTab, setActiveStatusTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');

  // Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState<any | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [rejectType, setRejectType] = useState<'complaint' | 'staff'>('complaint');

  // Queries & Mutations: Complaints
  const {
    data: transferData,
    isLoading: isLoadingComplaints,
    refetch: refetchComplaints,
  } = useGetComplaintTransferRequestsQuery();

  const [approveTransfer, { isLoading: isApprovingComplaint }] = useApproveComplaintTransferMutation();
  const [rejectTransfer, { isLoading: isRejectingComplaint }] = useRejectComplaintTransferMutation();

  // Queries & Mutations: Staff Transfers
  const {
    data: staffTransferData,
    isLoading: isLoadingStaffTransfers,
    refetch: refetchStaffTransfers
  } = useGetEmployeeTransfersQuery();

  const [reviewStaffTransfer, { isLoading: isReviewingStaffTransfer }] = useReviewTransferMutation();

  const complaintRequests: any[] = transferData?.data || [];
  const staffRequests: any[] = staffTransferData?.data || [];

  // Summary counts for badges
  const complaintPendingCount = useMemo(
    () => complaintRequests.filter((r) => r.status?.toLowerCase() === 'pending').length,
    [complaintRequests]
  );

  const staffPendingCount = useMemo(
    () =>
      staffRequests.filter((r) =>
        ['PENDING', 'REQUESTED', 'UNDER_REVIEW'].includes(r.status?.toUpperCase())
      ).length,
    [staffRequests]
  );

  // Active list depending on mainTab
  const currentRawList = mainTab === 'complaints' ? complaintRequests : staffRequests;

  // Counts for current subtabs
  const counts = useMemo(() => {
    if (mainTab === 'complaints') {
      return {
        ALL: complaintRequests.length,
        PENDING: complaintRequests.filter((r) => r.status?.toLowerCase() === 'pending').length,
        APPROVED: complaintRequests.filter((r) => r.status?.toLowerCase() === 'approved').length,
        REJECTED: complaintRequests.filter((r) => r.status?.toLowerCase() === 'rejected').length,
      };
    } else {
      return {
        ALL: staffRequests.length,
        PENDING: staffRequests.filter((r) =>
          ['PENDING', 'REQUESTED', 'UNDER_REVIEW'].includes(r.status?.toUpperCase())
        ).length,
        APPROVED: staffRequests.filter((r) => r.status?.toUpperCase() === 'APPROVED').length,
        REJECTED: staffRequests.filter((r) => r.status?.toUpperCase() === 'REJECTED').length,
      };
    }
  }, [mainTab, complaintRequests, staffRequests]);

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return currentRawList.filter((req) => {
      const normalizedStatus = req.status?.toUpperCase();
      const isPending = ['PENDING', 'REQUESTED', 'UNDER_REVIEW'].includes(normalizedStatus);

      let matchesTab = true;
      if (activeStatusTab === 'PENDING') matchesTab = isPending;
      else if (activeStatusTab === 'APPROVED') matchesTab = normalizedStatus === 'APPROVED';
      else if (activeStatusTab === 'REJECTED') matchesTab = normalizedStatus === 'REJECTED';

      const q = searchTerm.toLowerCase().trim();
      if (!q) return matchesTab;

      if (mainTab === 'complaints') {
        const complaintIdMatch =
          req.complaintId?.complaintId?.toLowerCase().includes(q) ||
          req.complaintId?._id?.toLowerCase().includes(q);
        const titleMatch = req.complaintId?.title?.toLowerCase().includes(q);
        const reasonMatch = req.reason?.toLowerCase().includes(q);
        const fromDeptMatch = req.fromDepartmentId?.name?.toLowerCase().includes(q);
        const toDeptMatch = req.targetDepartmentId?.name?.toLowerCase().includes(q);
        const requesterMatch =
          req.requestedBy?.profile?.fullName?.toLowerCase().includes(q) ||
          req.requestedBy?.email?.toLowerCase().includes(q);

        return (
          matchesTab &&
          (complaintIdMatch || titleMatch || reasonMatch || fromDeptMatch || toDeptMatch || requesterMatch)
        );
      } else {
        const staffNameMatch = req.employeeId?.profile?.fullName?.toLowerCase().includes(q);
        const staffEmailMatch = req.employeeId?.email?.toLowerCase().includes(q);
        const reasonMatch = req.reason?.toLowerCase().includes(q);
        const fromDeptMatch = req.currentDepartmentId?.name?.toLowerCase().includes(q);
        const toDeptMatch = req.targetDepartmentId?.name?.toLowerCase().includes(q);
        const requesterMatch =
          req.requestedBy?.profile?.fullName?.toLowerCase().includes(q) ||
          req.requestedBy?.email?.toLowerCase().includes(q);

        return (
          matchesTab &&
          (staffNameMatch || staffEmailMatch || reasonMatch || fromDeptMatch || toDeptMatch || requesterMatch)
        );
      }
    });
  }, [currentRawList, activeStatusTab, searchTerm, mainTab]);

  // Handle Approve Complaint
  const handleApproveComplaint = async (req: any) => {
    try {
      await approveTransfer({ id: req._id }).unwrap();
      showSuccess('Complaint transfer approved and reassigned successfully.');
      refetchComplaints();
    } catch (err: any) {
      showError(err?.data?.message || err?.message || 'Failed to approve complaint transfer.');
    }
  };

  // Handle Approve Staff Transfer
  const handleApproveStaff = async (req: any) => {
    try {
      await reviewStaffTransfer({ id: req._id, action: 'APPROVED' }).unwrap();
      showSuccess('Staff transfer approved. Department assignment updated.');
      refetchStaffTransfers();
    } catch (err: any) {
      showError(err?.data?.message || err?.message || 'Failed to approve staff transfer.');
    }
  };

  // Open Rejection Modal
  const openRejectModal = (req: any, type: 'complaint' | 'staff') => {
    setRequestToReject(req);
    setRejectType(type);
    setRejectRemarks('');
    setRejectModalOpen(true);
  };

  // Confirm Rejection
  const handleConfirmReject = async () => {
    if (!requestToReject) return;
    try {
      if (rejectType === 'complaint') {
        await rejectTransfer({
          id: requestToReject._id,
          reviewRemarks: rejectRemarks.trim() || undefined,
        }).unwrap();
        showSuccess('Complaint transfer request rejected.');
        refetchComplaints();
      } else {
        await reviewStaffTransfer({
          id: requestToReject._id,
          action: 'REJECTED',
          rejectionReason: rejectRemarks.trim() || undefined,
        }).unwrap();
        showSuccess('Staff transfer request rejected.');
        refetchStaffTransfers();
      }
      setRejectModalOpen(false);
      setRequestToReject(null);
    } catch (err: any) {
      showError(err?.data?.message || err?.message || 'Failed to reject transfer.');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Transfer Requests</h1>
            {(complaintPendingCount + staffPendingCount > 0) && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                {complaintPendingCount + staffPendingCount} pending total
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Review and approve cross-department transfers for complaints and staff members
          </p>
        </div>
      </div>

      {/* ── Category Switcher: Complaint Transfers vs Staff Transfers ────────── */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => {
            setMainTab('complaints');
            setActiveStatusTab('PENDING');
          }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            mainTab === 'complaints'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Complaint Transfers</span>
          {complaintPendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
              {complaintPendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setMainTab('staff');
            setActiveStatusTab('PENDING');
          }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            mainTab === 'staff'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Transfers</span>
          {staffPendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
              {staffPendingCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Tabs & Search Bar Card ─────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((tab) => {
            const count = counts[tab];
            const isActive = activeStatusTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveStatusTab(tab)}
                className={`
                  px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 cursor-pointer
                  ${isActive
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }
                `}
              >
                <span>
                  {tab === 'ALL'
                    ? 'All'
                    : tab.charAt(0) + tab.slice(1).toLowerCase()}
                </span>
                <span
                  className={`
                    px-1.5 py-0.2 rounded-full text-[10px] font-bold
                    ${isActive
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-slate-200/80 text-slate-600'
                    }
                  `}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={mainTab === 'complaints' ? 'Search complaints, depts...' : 'Search staff, depts, reason...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* ── Main List Container ────────────────────────────────────────────── */}
      {(mainTab === 'complaints' ? isLoadingComplaints : isLoadingStaffTransfers) ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading transfer requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-sm">
          <ArrowRightLeft className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No transfer requests found</h3>
          <p className="text-xs text-slate-400 mt-1">
            {searchTerm
              ? 'Try modifying your search keywords or clearing filters.'
              : `There are no ${activeStatusTab.toLowerCase()} ${mainTab === 'complaints' ? 'complaint' : 'staff'} transfer requests.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => {
            const rawStatus = req.status?.toUpperCase();
            const isPending = ['PENDING', 'REQUESTED', 'UNDER_REVIEW'].includes(rawStatus);
            const isApproved = rawStatus === 'APPROVED';
            const isRejected = rawStatus === 'REJECTED';

            if (mainTab === 'complaints') {
              // Complaint Card Display
              return (
                <div
                  key={req._id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                        {req.complaintId?.complaintId || 'COMPLAINT'}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 truncate max-w-md">
                        {req.complaintId?.title || 'Complaint Transfer'}
                      </h3>
                    </div>

                    <div>
                      {isPending && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          Pending Review
                        </span>
                      )}
                      {isApproved && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Approved
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          Rejected
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">From Department</span>
                        <span className="font-semibold text-slate-800">{req.fromDepartmentId?.name || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">To Department</span>
                        <span className="font-semibold text-blue-700 flex items-center gap-1">
                          <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                          {req.targetDepartmentId?.name || '—'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Requested By</span>
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            name={req.requestedBy?.profile?.fullName || req.requestedBy?.email || 'Dept Head'}
                            src={req.requestedBy?.profile?.profileImage || req.requestedBy?.profile?.avatar}
                            size="xs"
                            className="w-5 h-5 text-[9px]"
                          />
                          <span className="font-semibold text-slate-800">
                            {req.requestedBy?.profile?.fullName || req.requestedBy?.email || 'Dept Head'}
                          </span>
                        </div>
                      </div>
                      <p className="text-slate-600 line-clamp-2 mt-1">
                        <strong className="text-slate-700">Reason:</strong> {req.reason}
                      </p>
                    </div>
                  </div>

                  {isPending && (
                    <div className="flex items-center justify-end gap-2.5 pt-1">
                      <button
                        onClick={() => openRejectModal(req, 'complaint')}
                        disabled={isRejectingComplaint}
                        className="px-3.5 py-1.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApproveComplaint(req)}
                        disabled={isApprovingComplaint}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {isApprovingComplaint ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Approve Transfer</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            } else {
              // Staff Transfer Card Display
              const staffMember = req.employeeId;
              const staffName = staffMember?.profile?.fullName || staffMember?.email || 'Staff Member';

              return (
                <div
                  key={req._id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={staffName}
                        src={staffMember?.profile?.profileImage || staffMember?.profile?.avatar}
                        size="sm"
                        className="w-9 h-9 text-xs"
                      />
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{staffName}</h3>
                        <p className="text-xs text-slate-400">{staffMember?.email || '—'}</p>
                      </div>
                    </div>

                    <div>
                      {isPending && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          Pending Review
                        </span>
                      )}
                      {isApproved && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Approved
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          Rejected
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">From Department</span>
                        <span className="font-semibold text-slate-800">{req.currentDepartmentId?.name || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Target Department</span>
                        <span className="font-semibold text-blue-700 flex items-center gap-1">
                          <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                          {req.targetDepartmentId?.name || '—'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Requested By</span>
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            name={req.requestedBy?.profile?.fullName || req.requestedBy?.email || 'Dept Head'}
                            src={req.requestedBy?.profile?.profileImage || req.requestedBy?.profile?.avatar}
                            size="xs"
                            className="w-5 h-5 text-[9px]"
                          />
                          <span className="font-semibold text-slate-800">
                            {req.requestedBy?.profile?.fullName || req.requestedBy?.email || 'Dept Head'}
                          </span>
                        </div>
                      </div>
                      <p className="text-slate-600 line-clamp-2 mt-1">
                        <strong className="text-slate-700">Reason:</strong> {req.reason}
                      </p>
                    </div>
                  </div>

                  {isPending && (
                    <div className="flex items-center justify-end gap-2.5 pt-1">
                      <button
                        onClick={() => openRejectModal(req, 'staff')}
                        disabled={isReviewingStaffTransfer}
                        className="px-3.5 py-1.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApproveStaff(req)}
                        disabled={isReviewingStaffTransfer}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {isReviewingStaffTransfer ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Approve Transfer</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            }
          })}
        </div>
      )}

      {/* ── Rejection Remarks Modal ────────────────────────────────────────── */}
      {rejectModalOpen && requestToReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="p-2 bg-rose-50 rounded-xl">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Reject {rejectType === 'complaint' ? 'Complaint' : 'Staff'} Transfer
                  </h3>
                  <p className="text-xs text-slate-500">The request will be declined with remarks</p>
                </div>
              </div>
              <button
                onClick={() => setRejectModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                You are rejecting the transfer to{' '}
                <strong className="text-slate-800">{requestToReject.targetDepartmentId?.name}</strong>.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Rejection Remarks / Reason (Optional)
                </label>
                <textarea
                  rows={3}
                  value={rejectRemarks}
                  onChange={(e) => setRejectRemarks(e.target.value)}
                  placeholder="e.g. Current department has acute staffing shortage..."
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTransferRequestsPage;
