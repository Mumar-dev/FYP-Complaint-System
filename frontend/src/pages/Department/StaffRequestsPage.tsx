import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCheck,
  Clock,
  Calendar,
  Check,
  X,
  Search,
  Filter,
  AlertCircle,
  Clock3,
  CalendarDays,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  Shield,
  Eye,
  Camera,
  Image as ImageIcon,
  ChevronRight,
  Award,
} from 'lucide-react';
import {
  useGetAttendanceCorrectionsQuery,
  useReviewAttendanceCorrectionMutation,
  useGetAllLeaveRequestsQuery,
  useReviewLeaveRequestMutation,
  useGetAllPromotionRequestsQuery,
  useReviewPromotionMutation,
} from '../../features/hr/hr.api';
import {
  useGetPendingResolutionVerificationsQuery,
  useReviewResolutionEvidenceMutation,
} from '../../features/complaint/complaint.api';
import { ROUTES } from '@/constants';
import { showSuccess, showError } from '@/utils/toast';

interface UnifiedRequest {
  id: string;
  type: 'MISSING_PUNCH' | 'LEAVE_REQUEST';
  employeeName: string;
  employeeEmail?: string;
  employeeDesignation?: string;
  createdAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  details: {
    title: string;
    description?: string;
    dateOrRange: string;
    requestedTime?: string;
    reason?: string;
  };
  raw: any;
}

export const DepartmentStaffRequestsPage: React.FC = () => {
  const navigate = useNavigate();

  // Top Category Tabs: Resolution Verifications vs. Attendance & Leave Requests vs. Promotion Requests
  const [activeCategoryTab, setActiveCategoryTab] = useState<'VERIFICATIONS' | 'ATTENDANCE_LEAVE' | 'PROMOTIONS'>('VERIFICATIONS');

  // Sub-tabs for Attendance & Leave
  const [activeStatusTab, setActiveStatusTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [selectedType, setSelectedType] = useState<'ALL' | 'MISSING_PUNCH' | 'LEAVE_REQUEST'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Rejection modal state for attendance/leaves
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState<UnifiedRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Verification Adjustments Modal State
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [verificationToAdjust, setVerificationToAdjust] = useState<any | null>(null);
  const [adjustmentRemarks, setAdjustmentRemarks] = useState('');

  // Proof Image Preview Modal State
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Promotion Requests Review State
  const [rejectPromoModal, setRejectPromoModal] = useState<{ open: boolean; request: any | null; reason: string }>({
    open: false,
    request: null,
    reason: '',
  });
  const [forwardPromoModal, setForwardPromoModal] = useState<{ open: boolean; request: any | null; remarks: string }>({
    open: false,
    request: null,
    remarks: '',
  });

  // Queries
  const {
    data: verificationsData,
    isLoading: loadingVerifications,
    refetch: refetchVerifications,
  } = useGetPendingResolutionVerificationsQuery();

  const {
    data: correctionsData,
    isLoading: loadingCorrections,
    refetch: refetchCorrections,
  } = useGetAttendanceCorrectionsQuery();

  const {
    data: leavesData,
    isLoading: loadingLeaves,
    refetch: refetchLeaves,
  } = useGetAllLeaveRequestsQuery();

  const {
    data: promoData,
    isLoading: loadingPromos,
    refetch: refetchPromos,
  } = useGetAllPromotionRequestsQuery();

  const [reviewCorrection] = useReviewAttendanceCorrectionMutation();
  const [reviewLeave] = useReviewLeaveRequestMutation();
  const [reviewEvidence, { isLoading: isReviewingEvidence }] = useReviewResolutionEvidenceMutation();
  const [reviewPromotion, { isLoading: isReviewingPromo }] = useReviewPromotionMutation();

  const promoList = promoData?.data || [];

  const pendingVerifications = verificationsData?.data || [];

  // Normalize attendance corrections & leave requests into UnifiedRequest array
  const unifiedRequests = useMemo<UnifiedRequest[]>(() => {
    const list: UnifiedRequest[] = [];

    // Missing Punch / Attendance Corrections
    const corrections = correctionsData?.data || [];
    corrections.forEach((c: any) => {
      const emp = c.employeeId || c.employee || {};
      const statusMap: Record<string, 'PENDING' | 'APPROVED' | 'REJECTED'> = {
        pending: 'PENDING',
        approved: 'APPROVED',
        rejected: 'REJECTED',
      };

      const dateStr = c.attendanceId?.date || c.attendance?.date
        ? new Date(c.attendanceId?.date || c.attendance?.date).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Date not specified';

      const formatTime = (t?: string) => {
        if (!t) return '--';
        try {
          const d = new Date(t);
          return isNaN(d.getTime())
            ? t
            : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch {
          return t;
        }
      };

      list.push({
        id: c._id,
        type: 'MISSING_PUNCH',
        employeeName: emp.profile?.fullName || emp.name || emp.email || 'Staff Member',
        employeeEmail: emp.email,
        employeeDesignation: emp.designation || emp.role,
        createdAt: c.createdAt,
        status: statusMap[c.status?.toLowerCase()] || 'PENDING',
        details: {
          title: 'Missing Punch Correction',
          dateOrRange: dateStr,
          requestedTime: `In: ${formatTime(c.requestedCheckInTime || c.correctedCheckIn)} | Out: ${formatTime(c.requestedCheckOutTime || c.correctedCheckOut)}`,
          reason: c.reason,
        },
        raw: c,
      });
    });

    // Leave Requests
    const leaves = leavesData?.data || [];
    leaves.forEach((l: any) => {
      const emp = l.employeeId || l.employee || {};
      const startDate = l.startDate
        ? new Date(l.startDate).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : '';
      const endDate = l.endDate
        ? new Date(l.endDate).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : '';

      const statusMap: Record<string, 'PENDING' | 'APPROVED' | 'REJECTED'> = {
        pending: 'PENDING',
        submitted: 'PENDING',
        approved: 'APPROVED',
        rejected: 'REJECTED',
        cancelled: 'REJECTED',
      };

      list.push({
        id: l._id,
        type: 'LEAVE_REQUEST',
        employeeName: emp.profile?.fullName || emp.name || emp.email || 'Staff Member',
        employeeEmail: emp.email,
        employeeDesignation: emp.designation || emp.role,
        createdAt: l.createdAt,
        status: statusMap[l.status?.toLowerCase()] || 'PENDING',
        details: {
          title: `${l.leaveTypeId?.name || l.leaveType?.name || 'Leave'} Request`,
          description: `${l.totalDays || l.daysCount || 1} day(s)`,
          dateOrRange: startDate === endDate ? startDate : `${startDate} - ${endDate}`,
          reason: l.reason,
        },
        raw: l,
      });
    });

    // Sort descending by creation date
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }, [correctionsData, leavesData]);

  // Tab counts for attendance & leave
  const counts = useMemo(() => {
    return {
      ALL: unifiedRequests.length,
      PENDING: unifiedRequests.filter((r) => r.status === 'PENDING').length,
      APPROVED: unifiedRequests.filter((r) => r.status === 'APPROVED').length,
      REJECTED: unifiedRequests.filter((r) => r.status === 'REJECTED').length,
    };
  }, [unifiedRequests]);

  // Filtered requests for attendance & leave
  const filteredRequests = useMemo(() => {
    return unifiedRequests.filter((req) => {
      const matchesTab = activeStatusTab === 'ALL' || req.status === activeStatusTab;
      const matchesType = selectedType === 'ALL' || req.type === selectedType;
      const matchesSearch =
        req.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.employeeEmail && req.employeeEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (req.details.reason && req.details.reason.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesTab && matchesType && matchesSearch;
    });
  }, [unifiedRequests, activeStatusTab, selectedType, searchTerm]);

  // Filtered verifications
  const filteredVerifications = useMemo(() => {
    if (!searchTerm.trim()) return pendingVerifications;
    const q = searchTerm.toLowerCase();
    return pendingVerifications.filter((v: any) => {
      const titleMatch = v.title?.toLowerCase().includes(q);
      const codeMatch = v.complaintId?.toLowerCase().includes(q);
      const staffName =
        v.primaryStaffId?.profile?.fullName ||
        v.assignedStaffId?.profile?.fullName ||
        v.primaryStaffId?.email ||
        '';
      const staffMatch = staffName.toLowerCase().includes(q);
      return titleMatch || codeMatch || staffMatch;
    });
  }, [pendingVerifications, searchTerm]);

  // ── Handlers for Resolution Verifications ─────────────────────────────────
  const handleApproveVerification = async (complaintId: string) => {
    try {
      setActionLoading(true);
      await reviewEvidence({
        evidenceId: complaintId,
        action: 'approved',
      }).unwrap();

      showSuccess('Resolution approved! The complaint has been marked as Resolved.');
      refetchVerifications();
    } catch (err: any) {
      showError(err?.data?.message || err?.message || 'Failed to approve verification');
    } finally {
      setActionLoading(false);
    }
  };

  const openAdjustVerificationModal = (verification: any) => {
    setVerificationToAdjust(verification);
    setAdjustmentRemarks('');
    setAdjustmentModalOpen(true);
  };

  const handleConfirmAdjustVerification = async () => {
    if (!verificationToAdjust) return;
    if (!adjustmentRemarks.trim()) {
      showError('Please provide adjustment instructions for the staff member.');
      return;
    }

    try {
      setActionLoading(true);
      await reviewEvidence({
        evidenceId: verificationToAdjust._id,
        action: 'rejected',
        rejectionReason: adjustmentRemarks.trim(),
        remarks: adjustmentRemarks.trim(),
      }).unwrap();

      showSuccess('Adjustments requested. Complaint sent back to In Progress.');
      setAdjustmentModalOpen(false);
      setVerificationToAdjust(null);
      refetchVerifications();
    } catch (err: any) {
      showError(err?.data?.message || err?.message || 'Failed to request adjustments');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Handlers for Attendance / Leave ───────────────────────────────────────
  const handleApprove = async (request: UnifiedRequest) => {
    try {
      setActionLoading(true);
      if (request.type === 'MISSING_PUNCH') {
        await reviewCorrection({
          id: request.id,
          action: 'approved',
        }).unwrap();
        refetchCorrections();
      } else {
        await reviewLeave({
          id: request.id,
          action: 'APPROVED',
        }).unwrap();
        refetchLeaves();
      }
      showSuccess('Request approved successfully');
    } catch (err: any) {
      showError(err?.data?.message || 'Failed to approve request. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectModal = (request: UnifiedRequest) => {
    setRequestToReject(request);
    setRejectionReason('');
    setRejectionModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!requestToReject) return;
    if (!rejectionReason.trim()) {
      showError('Please provide a rejection reason.');
      return;
    }
    try {
      setActionLoading(true);
      if (requestToReject.type === 'MISSING_PUNCH') {
        await reviewCorrection({
          id: requestToReject.id,
          action: 'rejected',
          reviewRemarks: rejectionReason.trim(),
        }).unwrap();
        refetchCorrections();
      } else {
        await reviewLeave({
          id: requestToReject.id,
          action: 'REJECTED',
          rejectionReason: rejectionReason.trim(),
        }).unwrap();
        refetchLeaves();
      }
      showSuccess('Request rejected');
      setRejectionModalOpen(false);
      setRequestToReject(null);
    } catch (err: any) {
      showError(err?.data?.message || 'Failed to reject request. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'ST';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff Requests</h1>
            {pendingVerifications.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                {pendingVerifications.length} Verifications
              </span>
            )}
            {counts.PENDING > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                {counts.PENDING} Attendance/Leaves
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Review resolution proofs submitted by staff, attendance corrections, and leave requests
          </p>
        </div>
      </div>

      {/* ── Top Three Primary Category Tabs ──────────────────────────────────── */}
      <div className="flex border-b border-slate-200 space-x-8">
        <button
          type="button"
          onClick={() => setActiveCategoryTab('VERIFICATIONS')}
          className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
            activeCategoryTab === 'VERIFICATIONS'
              ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Resolution Verifications</span>
          {pendingVerifications.length > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeCategoryTab === 'VERIFICATIONS'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {pendingVerifications.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveCategoryTab('ATTENDANCE_LEAVE')}
          className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
            activeCategoryTab === 'ATTENDANCE_LEAVE'
              ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Attendance & Leave Requests</span>
          {counts.PENDING > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeCategoryTab === 'ATTENDANCE_LEAVE'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {counts.PENDING}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveCategoryTab('PROMOTIONS')}
          className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
            activeCategoryTab === 'PROMOTIONS'
              ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Promotion Requests</span>
          {promoList.filter((p: any) => ['PENDING_DEPT_HEAD', 'SUBMITTED', 'UNDER_REVIEW'].includes(p.status)).length > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeCategoryTab === 'PROMOTIONS'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {promoList.filter((p: any) => ['PENDING_DEPT_HEAD', 'SUBMITTED', 'UNDER_REVIEW'].includes(p.status)).length}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB 1: RESOLUTION VERIFICATIONS ───────────────────────────────── */}
      {activeCategoryTab === 'VERIFICATIONS' && (
        <div className="space-y-4">
          {/* Search Bar for Verifications */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by complaint title, ID, or staff name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
              />
            </div>
            <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">
              {filteredVerifications.length} complaint{filteredVerifications.length === 1 ? '' : 's'} awaiting your verification
            </span>
          </div>

          {loadingVerifications ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-sm">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">Loading pending verifications...</p>
            </div>
          ) : filteredVerifications.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-base font-semibold text-slate-900">All caught up!</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                There are currently no complaints awaiting resolution verification from your staff.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredVerifications.map((item: any) => {
                const assignedStaff = item.primaryStaffId || item.assignedStaffId;
                const staffName =
                  assignedStaff?.profile?.fullName || assignedStaff?.name || assignedStaff?.email || 'Staff';
                const complaintCode = item.complaintId || `#${item._id.slice(-6).toUpperCase()}`;
                const evidence = item.latestEvidence;
                const proofImages = evidence?.images || [];

                return (
                  <div
                    key={item._id}
                    className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm hover:border-indigo-300 transition-all space-y-4"
                  >
                    {/* Top Row: IDs, Dates, Staff */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Under Verification
                        </span>
                        <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {complaintCode}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">
                        Submitted: {new Date(item.updatedAt || item.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Complaint Title & Assigned Staff */}
                    <div>
                      <h3 className="text-base font-bold text-slate-900 tracking-tight">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <span>Completed by:</span>
                        <span className="font-semibold text-slate-800">{staffName}</span>
                      </div>
                    </div>

                    {/* Staff Resolution Remarks */}
                    <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Staff Resolution Notes
                      </p>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                        {evidence?.notes || item.resolutionRemarks || 'Work reported completed by staff.'}
                      </p>
                    </div>

                    {/* Proof Photos Gallery */}
                    {proofImages.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Resolution Proof Photos ({proofImages.length}) — Click to enlarge
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {proofImages.map((img: string, idx: number) => (
                            <div
                              key={idx}
                              onClick={() => setPreviewImage(img)}
                              className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer shadow-xs hover:shadow-md hover:scale-105 transition-all relative group"
                            >
                              <img
                                src={img}
                                alt={`Proof ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                                View
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(ROUTES.DEPARTMENT_COMPLAINT_DETAIL.replace(':id', item._id))
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>View Complaint Details</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => openAdjustVerificationModal(item)}
                          className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50/70 hover:bg-amber-100 text-amber-900 text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          Request Adjustments
                        </button>

                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleApproveVerification(item._id)}
                          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                        >
                          {actionLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>Approve & Resolve</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: ATTENDANCE & LEAVE REQUESTS ──────────────────────────────── */}
      {activeCategoryTab === 'ATTENDANCE_LEAVE' && (
        <div className="space-y-4">
          {/* Sub-Filters Card */}
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
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{tab === 'ALL' ? 'All Requests' : tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                        isActive
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-slate-200/70 text-slate-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Type selector & Search Input */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 justify-end">
              <div className="relative min-w-[160px]">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as any)}
                  className="w-full appearance-none bg-white border border-slate-300 rounded-xl px-3 py-2 pr-8 text-xs font-medium text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs"
                >
                  <option value="ALL">All Types</option>
                  <option value="MISSING_PUNCH">Missing Punch</option>
                  <option value="LEAVE_REQUEST">Leave Requests</option>
                </select>
                <Filter className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search staff or reason..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* List Content */}
          {loadingCorrections || loadingLeaves ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-sm">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">Loading requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <FileCheck className="w-6 h-6" />
              </div>
              <p className="text-base font-semibold text-slate-900">No requests found</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No staff attendance or leave requests match your selected filters.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((req) => {
                const isPending = req.status === 'PENDING';
                const isApproved = req.status === 'APPROVED';
                const isRejected = req.status === 'REJECTED';

                return (
                  <div
                    key={req.id}
                    className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-100">
                        {getInitials(req.employeeName)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {req.employeeName}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              req.type === 'MISSING_PUNCH'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}
                          >
                            {req.type === 'MISSING_PUNCH' ? 'Missing Punch' : 'Leave'}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 mt-1">
                          {req.details.title}
                          {req.details.description ? ` (${req.details.description})` : ''}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{req.details.dateOrRange}</p>
                        {req.details.requestedTime && (
                          <p className="text-xs text-slate-500 font-mono mt-0.5">
                            {req.details.requestedTime}
                          </p>
                        )}
                        {req.details.reason && (
                          <p className="text-xs text-slate-600 italic mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100 inline-block">
                            "{req.details.reason}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions or Status Pill */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      {isPending ? (
                        <>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => openRejectModal(req)}
                            className="px-3.5 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleApprove(req)}
                            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                        </>
                      ) : isApproved ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3.5 h-3.5" />
                          Rejected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: PROMOTION REQUESTS ──────────────────────────────────── */}
      {activeCategoryTab === 'PROMOTIONS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Department Promotion Requests</h2>
              <p className="text-xs text-slate-500">
                Review promotion cases submitted by department staff and forward endorsed candidates to Administration.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded-lg text-slate-600">
              Total: {promoList.length}
            </span>
          </div>

          {loadingPromos ? (
            <div className="p-12 text-center text-slate-400 bg-white border border-slate-200/80 rounded-2xl">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-sm font-medium">Loading promotion requests...</p>
            </div>
          ) : promoList.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white border border-slate-200/80 rounded-2xl">
              <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No promotion requests</p>
              <p className="text-xs text-slate-400 mt-0.5">Staff promotion applications in your department will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {promoList.map((req: any) => {
                const emp = req.employeeId || {};
                const empName = emp.profile?.fullName || emp.email || 'Staff Member';
                const empAvatar = emp.profile?.profileImage || emp.profile?.avatar;
                const currentRank = req.currentRank || emp.rank || 'junior';
                const requestedRank = req.requestedRank || req.requestedDesignation || 'standard';
                const isPending = ['PENDING_DEPT_HEAD', 'SUBMITTED', 'UNDER_REVIEW'].includes(req.status);
                const isForwarded = req.status === 'PENDING_ADMIN';
                const isApproved = req.status === 'APPROVED';
                const isRejected = req.status === 'REJECTED';
                const perf = req.performanceSnapshot || { totalAssigned: 0, completed: 0, pending: 0, efficiencyRate: 0 };

                return (
                  <div
                    key={req._id}
                    className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-2xs space-y-4 hover:border-slate-300 transition-all"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Staff & Rank info */}
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
                          {empAvatar ? (
                            <img src={empAvatar} alt={empName} className="w-full h-full object-cover" />
                          ) : (
                            getInitials(empName)
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900">{empName}</h3>
                            <span className="text-xs text-slate-400">({emp.email})</span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                isApproved
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : isRejected
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : isForwarded
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {isForwarded ? 'Forwarded to Admin' : isPending ? 'Pending Dept Head' : req.status}
                            </span>
                          </div>

                          {/* Progression Pill */}
                          <div className="flex items-center gap-2 mt-1.5 text-xs">
                            <span className="text-slate-500 font-medium">Rank Progression:</span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold capitalize">
                              {currentRank}
                            </span>
                            <span className="text-blue-600 font-bold">&rarr;</span>
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold capitalize">
                              {requestedRank}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Dept Head Action Controls */}
                      {isPending ? (
                        <div className="flex items-center gap-2 shrink-0 self-start lg:self-auto">
                          <button
                            type="button"
                            disabled={isReviewingPromo}
                            onClick={() => setRejectPromoModal({ open: true, request: req, reason: '' })}
                            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            disabled={isReviewingPromo}
                            onClick={() => setForwardPromoModal({ open: true, request: req, remarks: '' })}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <span>Forward to Admin</span>
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">
                          {isForwarded && <span className="text-purple-600 font-semibold">Under Admin Review</span>}
                          {isApproved && <span className="text-emerald-600 font-semibold">Promoted by Admin</span>}
                          {isRejected && <span className="text-rose-600 font-semibold">Rejected</span>}
                        </div>
                      )}
                    </div>

                    {/* Performance Snapshot */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl text-center text-xs">
                      <div>
                        <span className="text-slate-500 block">Total Assigned</span>
                        <strong className="text-slate-800 text-sm font-bold">{perf.totalAssigned}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Completed</span>
                        <strong className="text-emerald-600 text-sm font-bold">{perf.completed}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">In Progress</span>
                        <strong className="text-amber-600 text-sm font-bold">{perf.pending}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Efficiency</span>
                        <strong className="text-purple-600 text-sm font-bold">{perf.efficiencyRate}%</strong>
                      </div>
                    </div>

                    {/* Applicant Justification & Remarks */}
                    <div className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="font-semibold text-slate-700">Staff Justification:</span>
                        <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-slate-700 italic">"{req.justification}"</p>
                      {req.deptHeadRemarks && (
                        <p className="text-blue-700 pt-1 border-t border-blue-100 mt-1">
                          <strong>Dept Head Remarks:</strong> {req.deptHeadRemarks}
                        </p>
                      )}
                      {req.rejectionReason && (
                        <p className="text-rose-700 pt-1 border-t border-rose-100 mt-1">
                          <strong>Rejection Reason:</strong> {req.rejectionReason}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Adjustments Modal for Verifications ────────────────────────────── */}
      {adjustmentModalOpen && verificationToAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Request Proof Adjustments</h3>
              <button
                onClick={() => setAdjustmentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                You are requesting adjustments for{' '}
                <span className="font-semibold text-slate-800">
                  {verificationToAdjust.title}
                </span>
                . The ticket will return to <span className="font-semibold text-amber-600">In Progress</span> and notify the assigned staff member.
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Adjustment Instructions <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={adjustmentRemarks}
                  onChange={(e) => setAdjustmentRemarks(e.target.value)}
                  placeholder="Specify what work remains incomplete or needs adjustment..."
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setAdjustmentModalOpen(false)}
                disabled={actionLoading}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAdjustVerification}
                disabled={actionLoading || !adjustmentRemarks.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm & Send Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rejection Modal for Attendance/Leave ───────────────────────────── */}
      {rejectionModalOpen && requestToReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Confirm Rejection</h3>
              <button
                onClick={() => setRejectionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                You are rejecting the{' '}
                <span className="font-semibold text-slate-800">
                  {requestToReject.type === 'MISSING_PUNCH' ? 'Missing Punch' : 'Leave'}
                </span>{' '}
                request submitted by{' '}
                <span className="font-semibold text-slate-800">
                  {requestToReject.employeeName}
                </span>
                .
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Rejection Reason (Optional)
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g., Working hours could not be verified or conflicting schedule..."
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setRejectionModalOpen(false)}
                disabled={actionLoading}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Proof Image Preview Modal ─────────────────────────────────────── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl w-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage}
              alt="Resolution proof enlarged"
              className="w-auto h-auto max-h-[85vh] max-w-full rounded-2xl shadow-2xl border border-white/10"
            />
            <button
              title="Close"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-4 -right-4 w-10 h-10 bg-white text-slate-800 rounded-full shadow-lg flex items-center justify-center hover:bg-slate-100 transition-all font-bold"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: REJECT PROMOTION REQUEST (DEPT HEAD) ────────────────── */}
      {rejectPromoModal.open && rejectPromoModal.request && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Reject Promotion Request</h3>
              <button
                onClick={() => setRejectPromoModal({ open: false, request: null, reason: '' })}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Provide a mandatory justification for rejecting{' '}
              <strong className="text-slate-900">
                {rejectPromoModal.request.employeeId?.profile?.fullName || rejectPromoModal.request.employeeId?.email}
              </strong>
              's promotion request.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectPromoModal.reason}
                onChange={(e) => setRejectPromoModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Explain why promotion criteria or targets were not met..."
                className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-red-500"
                required
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectPromoModal({ open: false, request: null, reason: '' })}
                disabled={isReviewingPromo}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isReviewingPromo || !rejectPromoModal.reason.trim()}
                onClick={async () => {
                  try {
                    await reviewPromotion({
                      id: rejectPromoModal.request._id,
                      action: 'REJECTED',
                      rejectionReason: rejectPromoModal.reason.trim()
                    }).unwrap();
                    showSuccess('Promotion request rejected');
                    setRejectPromoModal({ open: false, request: null, reason: '' });
                    refetchPromos();
                  } catch (err: any) {
                    showError(err?.data?.message || 'Failed to reject promotion request');
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isReviewingPromo && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: FORWARD PROMOTION REQUEST TO ADMIN (DEPT HEAD) ────────── */}
      {forwardPromoModal.open && forwardPromoModal.request && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Forward to Administration</h3>
              <button
                onClick={() => setForwardPromoModal({ open: false, request: null, remarks: '' })}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-xs space-y-1">
              <p className="text-blue-900 font-semibold">
                Candidate: {forwardPromoModal.request.employeeId?.profile?.fullName || forwardPromoModal.request.employeeId?.email}
              </p>
              <p className="text-blue-700">
                Progression: <span className="capitalize font-bold">{forwardPromoModal.request.currentRank || 'junior'}</span> &rarr; <span className="capitalize font-bold">{forwardPromoModal.request.requestedRank || forwardPromoModal.request.requestedDesignation}</span>
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Department Head Endorsement Remarks (Optional)
              </label>
              <textarea
                rows={3}
                value={forwardPromoModal.remarks}
                onChange={(e) => setForwardPromoModal(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Add your endorsement notes for the executive committee / administration..."
                className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setForwardPromoModal({ open: false, request: null, remarks: '' })}
                disabled={isReviewingPromo}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isReviewingPromo}
                onClick={async () => {
                  try {
                    await reviewPromotion({
                      id: forwardPromoModal.request._id,
                      action: 'FORWARD' as any,
                      reviewRemarks: forwardPromoModal.remarks.trim() || undefined
                    }).unwrap();
                    showSuccess('Promotion request forwarded to Administration');
                    setForwardPromoModal({ open: false, request: null, remarks: '' });
                    refetchPromos();
                  } catch (err: any) {
                    showError(err?.data?.message || 'Failed to forward promotion request');
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isReviewingPromo && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Forward to Admin</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentStaffRequestsPage;
