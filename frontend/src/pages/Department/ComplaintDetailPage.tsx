import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  Clock,
  CheckCircle2,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Users,
  UserCheck,
  UserPlus,
  X,
  Check,
  Search,
  Loader2,
  FileText,
  Shield,
  ArrowLeftRight,
  ChevronDown,
  Camera,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ROUTES } from '@constants/index';
import {
  useGetComplaintDetailsQuery,
  useGetStaffQuery,
  useAssignComplaintMutation,
  useGetComplaintsQuery,
  useRequestComplaintTransferMutation,
  useGetComplaintTransferStatusQuery,
  useGetComplaintEvidenceQuery,
  useReviewResolutionEvidenceMutation,
} from '@/features/complaint/complaint.api';
import { useGetDepartmentsQuery } from '@/features/admin/admin.api';
import { showSuccess, showError } from '@/utils/toast';
import ComplaintFeedbackCard from '../../components/complaints/ComplaintFeedbackCard';

const DepartmentComplaintDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Queries
  const {
    data: detailsData,
    isLoading: isDetailsLoading,
    refetch: refetchDetails,
  } = useGetComplaintDetailsQuery(id as string, { skip: !id });
  const { data: staffMap } = useGetStaffQuery();
  const { data: allComplaintsMap } = useGetComplaintsQuery();
  const { data: departmentsData } = useGetDepartmentsQuery();
  const {
    data: transferStatusData,
    refetch: refetchTransferStatus,
  } = useGetComplaintTransferStatusQuery(id as string, { skip: !id });
  const {
    data: evidenceData,
    refetch: refetchEvidence,
  } = useGetComplaintEvidenceQuery(id as string, { skip: !id });

  const [assignComplaint, { isLoading: isAssigning }] = useAssignComplaintMutation();
  const [requestTransfer, { isLoading: isTransferring }] = useRequestComplaintTransferMutation();
  const [reviewEvidence, { isLoading: isReviewingEvidence }] = useReviewResolutionEvidenceMutation();

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [adjustmentRemarks, setAdjustmentRemarks] = useState('');
  const [showAdjustmentInput, setShowAdjustmentInput] = useState(false);

  const complaint: any = detailsData?.data;
  const staffMembers: any[] = staffMap?.data || [];
  const allComplaints: any[] = allComplaintsMap?.data || [];
  const departments: any[] = departmentsData?.data || [];
  const pendingTransfer = transferStatusData?.data;

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [targetDepartmentId, setTargetDepartmentId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Team Assignment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPrimaryIds, setSelectedPrimaryIds] = useState<string[]>([]);
  const [selectedSecondaryIds, setSelectedSecondaryIds] = useState<string[]>([]);
  const [staffSearchTerm, setStaffSearchTerm] = useState('');

  // Compute active workload count for each staff member
  const staffWorkloadMap = useMemo(() => {
    const counts: Record<string, number> = {};
    allComplaints.forEach((c: any) => {
      if (['assigned', 'in_progress'].includes(c.status)) {
        const pId =
          typeof c.primaryStaffId === 'object'
            ? c.primaryStaffId?._id
            : c.primaryStaffId ||
              (typeof c.assignedStaffId === 'object' ? c.assignedStaffId?._id : c.assignedStaffId);
        if (pId) counts[pId] = (counts[pId] || 0) + 1;

        if (Array.isArray(c.supportingStaffIds)) {
          c.supportingStaffIds.forEach((sup: any) => {
            const sId = typeof sup === 'object' ? sup?._id : sup;
            if (sId) counts[sId] = (counts[sId] || 0) + 1;
          });
        }
      }
    });
    return counts;
  }, [allComplaints]);

  // Initials Helper
  const getStaffInitials = (name: string) => {
    if (!name) return 'S';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Open Modal with Pre-populated Assignments
  const openAssignModal = () => {
    setStaffSearchTerm('');

    const primaryId =
      typeof complaint?.primaryStaffId === 'object'
        ? complaint.primaryStaffId?._id
        : complaint?.primaryStaffId ||
          (typeof complaint?.assignedStaffId === 'object'
            ? complaint.assignedStaffId?._id
            : complaint?.assignedStaffId);

    setSelectedPrimaryIds(primaryId ? [primaryId] : []);

    const secondaryIds: string[] = [];
    if (Array.isArray(complaint?.supportingStaffIds)) {
      complaint.supportingStaffIds.forEach((s: any) => {
        const sid = typeof s === 'object' ? s?._id : s;
        if (sid && sid !== primaryId) {
          secondaryIds.push(sid);
        }
      });
    }
    setSelectedSecondaryIds(secondaryIds);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  // Toggle Primary Staff (Single Selection)
  const togglePrimaryStaff = (staffId: string) => {
    if (selectedPrimaryIds.includes(staffId)) {
      setSelectedPrimaryIds([]);
    } else {
      setSelectedPrimaryIds([staffId]);
      setSelectedSecondaryIds((prev) => prev.filter((id) => id !== staffId));
    }
  };

  // Toggle Supporting Staff (Multi Selection)
  const toggleSecondaryStaff = (staffId: string) => {
    if (selectedSecondaryIds.includes(staffId)) {
      setSelectedSecondaryIds((prev) => prev.filter((id) => id !== staffId));
    } else {
      setSelectedSecondaryIds((prev) => [...prev, staffId]);
      setSelectedPrimaryIds((prev) => prev.filter((id) => id !== staffId));
    }
  };

  // Save Assignment API Call
  const handleSaveAssignment = async () => {
    if (selectedPrimaryIds.length === 0) {
      showError('Please assign at least one Primary staff member.');
      return;
    }

    try {
      await assignComplaint({
        id: complaint._id,
        primaryStaffId: selectedPrimaryIds[0],
        assignedStaffId: selectedPrimaryIds[0],
        supportingStaffIds: selectedSecondaryIds,
      }).unwrap();

      showSuccess('Team assignment updated successfully');
      closeModal();
      refetchDetails();
    } catch (err: any) {
      showError(err?.data?.message || err?.message || 'Failed to save staff assignment');
    }
  };

  // Handle Transfer Request Submit
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDepartmentId) {
      showError('Please select a target department');
      return;
    }
    if (!transferReason.trim()) {
      showError('Please provide a reason for the transfer');
      return;
    }

    try {
      await requestTransfer({
        complaintId: complaint._id,
        targetDepartmentId,
        reason: transferReason.trim(),
      }).unwrap();

      showSuccess('Transfer request submitted to Admin for approval');
      setIsTransferModalOpen(false);
      refetchDetails();
      refetchTransferStatus();
    } catch (err: any) {
      showError(err?.data?.message || err?.message || 'Failed to submit transfer request');
    }
  };

  // Filtered target departments excluding current department
  const currentDeptId =
    typeof complaint?.departmentId === 'object'
      ? complaint.departmentId?._id
      : complaint?.departmentId;

  const availableTargetDepartments = useMemo(() => {
    return departments.filter(
      (dept: any) => dept._id !== currentDeptId && dept.isActive !== false
    );
  }, [departments, currentDeptId]);

  // Filtered staff list for the modal picker (exclude terminated & suspended from assignment)
  const filteredModalStaff = useMemo(() => {
    const assignableStaff = staffMembers.filter((s: any) => {
      const isTerminated = (s.employmentStatus || '').toUpperCase() === 'TERMINATED';
      const isSuspended =
        (s.employmentStatus || '').toUpperCase() === 'SUSPENDED' ||
        (s.accountStatus || '').toLowerCase() === 'suspended';
      return !isTerminated && !isSuspended;
    });
    if (!staffSearchTerm.trim()) return assignableStaff;
    const term = staffSearchTerm.toLowerCase();
    return assignableStaff.filter(
      (s: any) =>
        (s.name && s.name.toLowerCase().includes(term)) ||
        (s.email && s.email.toLowerCase().includes(term)) ||
        (s.profile?.fullName && s.profile.fullName.toLowerCase().includes(term))
    );
  }, [staffMembers, staffSearchTerm]);

  const handleReviewEvidenceAction = async (action: 'approved' | 'rejected') => {
    if (action === 'rejected' && !adjustmentRemarks.trim()) {
      showError('Please provide adjustment remarks to send back to staff.');
      return;
    }

    try {
      await reviewEvidence({
        evidenceId: complaint._id,
        action,
        rejectionReason: adjustmentRemarks.trim() || undefined,
        remarks: adjustmentRemarks.trim() || undefined,
      }).unwrap();

      showSuccess(
        action === 'approved'
          ? 'Complaint marked as Resolved and verified successfully.'
          : 'Complaint returned to In Progress with adjustment instructions.'
      );
      setShowAdjustmentInput(false);
      setAdjustmentRemarks('');
      refetchDetails();
      refetchEvidence();
    } catch (err: any) {
      showError(err?.data?.message || err?.message || 'Failed to process verification');
    }
  };

  const isUnderVerification = complaint?.status === 'under_verification';
  const latestEvidence = evidenceData?.data && evidenceData.data.length > 0 ? evidenceData.data[0] : null;
  const allResolutionPhotos: string[] = Array.from(new Set([
    ...(complaint?.resolutionPhotos || []),
    ...(complaint?.resolutionEvidence?.images || []),
    ...(latestEvidence?.images || []),
    ...((evidenceData?.data || []).flatMap((e: any) => e.images || []))
  ]));

  if (isDetailsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
        <p className="text-slate-500 font-medium text-sm">Loading complaint details...</p>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Complaint not found</h3>
        <p className="text-sm text-slate-500 mb-4">The requested ticket does not exist or was removed.</p>
        <button
          onClick={() => navigate(ROUTES.DEPARTMENT_COMPLAINTS)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Back to Complaints
        </button>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical':
      case 'high':
      case 'urgent':
        return 'bg-rose-50 text-rose-700 border-rose-200/80';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200/80';
      case 'low':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200/80';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'resolved':
      case 'completed':
      case 'closed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
      case 'in_progress':
        return 'bg-blue-50 text-blue-700 border-blue-200/80';
      case 'assigned':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200/80';
      case 'submitted':
      case 'open':
      case 'pending':
      case 'pending_assignment':
        return 'bg-amber-50 text-amber-700 border-amber-200/80';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200/80';
    }
  };

  const getCleanStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending_assignment':
      case 'submitted':
      case 'pending':
        return 'Pending Assignment';
      case 'assigned':
        return 'Assigned';
      case 'in_progress':
        return 'In Progress';
      case 'resolved':
        return 'Resolved';
      case 'closed':
        return 'Closed';
      default:
        return status?.replace(/_/g, ' ') || 'Pending';
    }
  };

  const complaintNumber =
    complaint.complaintId || `#${complaint._id.substring(complaint._id.length - 8).toUpperCase()}`;

  // Resolve Primary Staff
  const primaryStaff =
    complaint.primaryStaffId && typeof complaint.primaryStaffId === 'object'
      ? complaint.primaryStaffId
      : complaint.assignedStaffId && typeof complaint.assignedStaffId === 'object'
      ? complaint.assignedStaffId
      : null;

  const primaryStaffName =
    primaryStaff?.profile?.fullName || primaryStaff?.name || primaryStaff?.email || null;

  // Resolve Supporting Staff
  const supportingStaffList: any[] = Array.isArray(complaint.supportingStaffIds)
    ? complaint.supportingStaffIds
    : [];

  const isCompleted = ['resolved', 'closed', 'completed'].includes(complaint.status?.toLowerCase());

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(ROUTES.DEPARTMENT_COMPLAINTS)}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500 hover:text-slate-800"
            title="Back to Complaints"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/70">
                {complaintNumber}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(
                  complaint.status
                )}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
                {getCleanStatusLabel(complaint.status)}
              </span>
              {/* Priority Badge */}
              <div className="inline-flex items-center gap-1.5 flex-wrap">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize border ${getPriorityColor(
                    complaint.priority
                  )}`}
                >
                  {complaint.priority || 'Medium'} Priority
                </span>
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
              {complaint.title || 'Untitled Complaint'}
            </h1>
          </div>
        </div>

        {/* Header Action Buttons (Assign Team & Transfer) */}
        {!isCompleted && (
          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center shrink-0">
            {pendingTransfer ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold shadow-xs">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span>
                  Transfer Pending Admin Approval → {pendingTransfer.targetDepartmentId?.name || 'Target Department'}
                </span>
              </div>
            ) : (
              <button
                onClick={() => {
                  setTargetDepartmentId('');
                  setTransferReason('');
                  setIsTransferModalOpen(true);
                }}
                className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-2 shadow-xs transition-colors"
              >
                <ArrowLeftRight className="w-4 h-4 text-slate-500" />
                <span>Transfer</span>
              </button>
            )}

            <button
              onClick={openAssignModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Assign Team</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Details (2 Cols) + Sidebar (1 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">

          {/* POSSIBLE DUPLICATE / RELATED TICKETS BANNER */}
          {Array.isArray(complaint.relatedIncidentIds) && complaint.relatedIncidentIds.length > 0 && (
            <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-5 shadow-xs space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Possible Duplicate / Related Tickets ({complaint.relatedIncidentIds.length})</span>
                </div>
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                  Same Location & Department
                </span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                The following active complaints match the location and issue profile of this ticket. Review them to prevent duplicate dispatch:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {complaint.relatedIncidentIds.map((rel: any, idx: number) => {
                  const relId = typeof rel === 'object' ? rel._id : rel;
                  const relTicketId = typeof rel === 'object' && rel.complaintId ? rel.complaintId : `#CMP-${String(relId).slice(-6).toUpperCase()}`;
                  const relTitle = typeof rel === 'object' && rel.title ? rel.title : 'Related Ticket';
                  const relStatus = typeof rel === 'object' && rel.status ? rel.status.replace('_', ' ') : 'Active';

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => navigate(ROUTES.DEPARTMENT_COMPLAINT_DETAIL.replace(':id', relId))}
                      className="p-3 bg-white rounded-xl border border-amber-200/80 hover:border-blue-400 text-left transition-all group flex flex-col justify-between shadow-2xs cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono text-[11px] font-bold text-slate-800 group-hover:text-blue-600">
                          {relTicketId}
                        </span>
                        <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                          {relStatus}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 line-clamp-1 font-medium group-hover:text-blue-700">
                        {relTitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending Verification Card (Shows when complaint is under_verification) */}
          {isUnderVerification && (
            <div className="bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/50 border-2 border-indigo-200 rounded-2xl p-6 shadow-sm space-y-5 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-indigo-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      Pending Your Verification
                    </h2>
                    <p className="text-xs text-slate-500">
                      Staff submitted resolution proof for this complaint. Please verify and approve or request adjustments.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0 self-start sm:self-auto">
                  Action Required
                </span>
              </div>

              {/* Staff Notes */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Staff Resolution Remarks
                </span>
                <p className="text-xs sm:text-sm text-slate-800 bg-white/80 p-3.5 rounded-xl border border-slate-200/80 leading-relaxed font-medium">
                  {latestEvidence?.notes || complaint.resolutionRemarks || 'Work reported completed by staff.'}
                </p>
              </div>

              {/* Resolution Proof Photos */}
              {latestEvidence?.images && latestEvidence.images.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Proof Photos ({latestEvidence.images.length})
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {latestEvidence.images.map((img: string, idx: number) => (
                      <div
                        key={idx}
                        onClick={() => setPreviewImage(img)}
                        className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-white cursor-pointer shadow-xs hover:shadow-md hover:scale-[1.02] transition-all relative group"
                      >
                        <img
                          src={img}
                          alt={`Proof ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                          Click to View
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Adjustment Remarks Input (revealed when requesting adjustments) */}
              {showAdjustmentInput && (
                <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-3 animate-in fade-in duration-150">
                  <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Adjustment Instructions for Staff <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={adjustmentRemarks}
                    onChange={(e) => setAdjustmentRemarks(e.target.value)}
                    placeholder="Specify what work remains incomplete or needs adjustment..."
                    className="w-full p-3 bg-white border border-amber-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 placeholder:text-slate-400"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAdjustmentInput(false)}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isReviewingEvidence}
                      onClick={() => handleReviewEvidenceAction('rejected')}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                    >
                      {isReviewingEvidence && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Send Back (In Progress)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={isReviewingEvidence}
                  onClick={() => handleReviewEvidenceAction('approved')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
                >
                  {isReviewingEvidence ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Approve & Resolve</span>
                </button>

                {!showAdjustmentInput && (
                  <button
                    type="button"
                    onClick={() => setShowAdjustmentInput(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium transition-colors"
                  >
                    <span>Request Adjustments</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Details & Photos Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Details & Description</span>
            </h2>

            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {complaint.description || 'No description provided.'}
            </p>

            {/* Location & Metadata */}
            <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="flex items-start gap-2.5 text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-900 block mb-0.5">Location</span>
                  <span>
                    {complaint.locationText ||
                      (complaint.location
                        ? typeof complaint.location === 'object'
                          ? `${complaint.location.address || 'Pinned GPS'} (${complaint.location.lat || ''}, ${complaint.location.lng || ''})`
                          : complaint.location
                        : 'Not specified')}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-900 block mb-0.5">Submitted On</span>
                  <span>{new Date(complaint.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Attachments / Photos */}
            {complaint.attachedImages && complaint.attachedImages.length > 0 && (
              <div className="mt-6 pt-5 border-t border-slate-100">
                <span className="font-semibold text-slate-900 text-xs block mb-3">
                  Attached Photos ({complaint.attachedImages.length})
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {complaint.attachedImages.map((img: string, idx: number) => (
                    <a
                      key={idx}
                      href={img}
                      target="_blank"
                      rel="noreferrer"
                      className="aspect-square rounded-xl overflow-hidden border border-slate-200/80 bg-slate-50 hover:opacity-90 transition-opacity block group relative"
                    >
                      <img src={img} alt={`Attached ${idx + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Resident Reviews & Feedback (Read-Only) */}
          <ComplaintFeedbackCard
            feedback={{
              rating: complaint.rating,
              feedbackComment: complaint.feedbackComment,
              feedbackSubmittedAt: complaint.feedbackSubmittedAt,
              feedbackSubmitted: complaint.feedbackSubmitted,
            }}
            isResolved={complaint.status === 'resolved' || complaint.status === 'closed'}
            readOnly={true}
          />

          {/* Dedicated Staff Resolution Proof & Notes Section */}
          {((complaint?.resolutionEvidence || latestEvidence) || complaint.status === 'resolved' || complaint.status === 'under_verification') && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Staff Resolution Proof & Notes</span>
              </h2>

              {/* Staff Note */}
              {(complaint?.resolutionEvidence?.notes || latestEvidence?.notes || complaint?.resolutionRemarks) && (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-700 leading-relaxed font-medium">
                  "{complaint?.resolutionEvidence?.notes || latestEvidence?.notes || complaint?.resolutionRemarks}"
                </div>
              )}

              {/* Submission Metadata */}
              {(complaint?.resolutionEvidence?.createdAt || latestEvidence?.createdAt || complaint?.underVerificationAt || complaint?.resolvedAt) && (
                <p className="text-[11px] text-slate-400 font-medium">
                  Submitted by{' '}
                  <span className="font-semibold text-slate-700">
                    {(complaint?.resolutionEvidence?.submittedBy && typeof complaint.resolutionEvidence.submittedBy === 'object'
                      ? complaint.resolutionEvidence.submittedBy?.profile?.fullName || complaint.resolutionEvidence.submittedBy?.name
                      : null) ||
                      (latestEvidence?.submittedBy && typeof latestEvidence.submittedBy === 'object'
                        ? latestEvidence.submittedBy?.profile?.fullName || latestEvidence.submittedBy?.name
                        : null) ||
                      complaint?.primaryStaffId?.profile?.fullName ||
                      'Assigned Staff'}
                  </span>{' '}
                  ·{' '}
                  {new Date(
                    complaint?.resolutionEvidence?.createdAt ||
                      latestEvidence?.createdAt ||
                      complaint?.underVerificationAt ||
                      complaint?.resolvedAt
                  ).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}{' '}
                  at{' '}
                  {new Date(
                    complaint?.resolutionEvidence?.createdAt ||
                      latestEvidence?.createdAt ||
                      complaint?.underVerificationAt ||
                      complaint?.resolvedAt
                  ).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}

              {/* Uploaded Proof Photos */}
              {allResolutionPhotos.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-slate-600 mb-2.5 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      Resolution Proof Photos ({allResolutionPhotos.length})
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal ml-1">— Click to enlarge</span>
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {allResolutionPhotos.map(
                      (imgUrl: string, idx: number) => (
                        <div
                          key={idx}
                          onClick={() => setPreviewImage(imgUrl)}
                          className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer shadow-xs hover:shadow-md hover:scale-[1.02] transition-all"
                        >
                          <img
                            src={imgUrl}
                            alt={`Resolution Proof ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-semibold">
                            View Fullscreen
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Resident Contact Card */}
          {complaint.residentId && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Resident Contact</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5 font-medium">Resident Name</span>
                  <span className="text-slate-900 font-semibold text-sm">
                    {complaint.residentId.profile?.fullName ||
                      complaint.residentId.firstName ||
                      complaint.residentId.email ||
                      'Resident'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5 font-medium">Email Address</span>
                  <span className="text-slate-700 flex items-center gap-1.5 font-medium">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {complaint.residentId.email || 'Not provided'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5 font-medium">Phone Number</span>
                  <span className="text-slate-700 flex items-center gap-1.5 font-medium">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {complaint.residentId.phone || complaint.residentId.profile?.phone || 'Not provided'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Column - Team & Timeline */}
        <div className="space-y-6">
          {/* Assigned Team Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span>Assigned Team</span>
              </h2>
              {!isCompleted && (
                <button
                  onClick={openAssignModal}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Manage
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Primary Staff Member */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                  Primary Responder
                </span>
                {primaryStaffName ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50/50 border border-blue-100/80">
                    <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {getStaffInitials(primaryStaffName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{primaryStaffName}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {primaryStaff?.designation || primaryStaff?.position || primaryStaff?.role || 'Staff Member'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center">
                    <p className="text-xs text-slate-400 font-medium">No primary staff assigned yet</p>
                    {!isCompleted && (
                      <button
                        onClick={openAssignModal}
                        className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        + Assign Primary
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Supporting Staff Members */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                  Supporting Staff ({supportingStaffList.length})
                </span>
                {supportingStaffList.length > 0 ? (
                  <div className="space-y-2">
                    {supportingStaffList.map((sup: any, idx: number) => {
                      const supName = sup.name || sup.profile?.fullName || sup.email || 'Staff';
                      return (
                        <div
                          key={sup._id || idx}
                          className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                        >
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-semibold text-[11px] flex items-center justify-center flex-shrink-0">
                            {getStaffInitials(supName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800 truncate">{supName}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No secondary staff assigned</p>
                )}
              </div>
            </div>
          </div>

          {/* Timeline & SLA Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Timeline</span>
            </h2>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Created At</span>
                <span className="font-medium text-slate-800">{new Date(complaint.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Last Updated</span>
                <span className="font-medium text-slate-800">{new Date(complaint.updatedAt).toLocaleDateString()}</span>
              </div>
              {complaint.slaDeadline && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">SLA Target</span>
                  <span className="font-medium text-rose-600">{new Date(complaint.slaDeadline).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Routing & Priority Breakdown Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600" />
              <span>Routing & Priority</span>
            </h2>

            <div className="space-y-3.5 text-xs">
              {/* System Rule Row */}
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-slate-400 text-[11px] uppercase font-bold tracking-wider">System Rule</span>
                  <span className="font-semibold text-slate-800 truncate" title={complaint.systemSuggestedDepartment || complaint.systemDepartment || 'None'}>
                    {complaint.systemSuggestedDepartment || complaint.systemDepartment || 'None'}
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize border shrink-0 ${getPriorityColor(complaint.systemPriority || complaint.priority || 'medium')}`}>
                  {complaint.systemPriority || complaint.priority || 'Medium'}
                </span>
              </div>

              {/* AI Prediction Row */}
              <div className="flex items-center justify-between py-1">
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-slate-400 text-[11px] uppercase font-bold tracking-wider">AI Prediction</span>
                  <span className="font-semibold text-slate-800 truncate" title={complaint.aiSuggestedDepartment || complaint.aiDepartment || 'Fallback'}>
                    {complaint.aiSuggestedDepartment || complaint.aiDepartment || 'Fallback'}
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize border shrink-0 ${getPriorityColor(complaint.aiPriority || complaint.priority || 'medium')}`}>
                  {complaint.aiPriority || complaint.priority || 'Medium'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Request Transfer Modal ────────────────────────────────────────── */}
      {isTransferModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsTransferModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Transfer Complaint</h3>
                  <p className="text-xs text-slate-500">Send this complaint to Admin for reassignment</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleTransferSubmit}>
              <div className="p-6 space-y-4">
                {/* Target Department Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Target Department <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={targetDepartmentId}
                      onChange={(e) => setTargetDepartmentId(e.target.value)}
                      required
                      className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-xs font-medium text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors cursor-pointer"
                    >
                      <option value="">Select recipient department...</option>
                      {availableTargetDepartments.map((dept: any) => (
                        <option key={dept._id} value={dept._id}>
                          {dept.name} ({dept.code || 'DEPT'})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Reason for Transfer */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Reason for Transfer <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    required
                    placeholder="Explain why this complaint belongs to the other department (e.g., Electrical fault, not plumbing)..."
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors placeholder:text-slate-400"
                  />
                </div>

                {/* Subtle Note */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    This request will be sent to the Admin for approval before the complaint is moved.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  disabled={isTransferring}
                  className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTransferring || !targetDepartmentId || !transferReason.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all inline-flex items-center gap-1.5"
                >
                  {isTransferring && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Multi-Staff Team Assignment Modal ─────────────────────────────── */}
      {isModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px] overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] bg-white border border-slate-200/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header (Fixed) */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                    Team Assignment
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/70">
                    {complaintNumber}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 truncate" title={complaint.title}>
                  {complaint.title || 'Untitled Complaint'}
                </h3>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="px-6 pt-4 pb-3 border-b border-slate-100 shrink-0 space-y-3 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search staff members by name or email..."
                  value={staffSearchTerm}
                  onChange={(e) => setStaffSearchTerm(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200 text-sm font-medium rounded-xl pl-10 pr-3.5 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Selection Summary Pill */}
              <div className="flex items-center justify-between text-xs text-slate-500 px-0.5">
                <div className="flex items-center gap-2">
                  <span>
                    <strong className="text-blue-600 font-semibold">{selectedPrimaryIds.length}</strong> Primary
                  </span>
                  <span>•</span>
                  <span>
                    <strong className="text-slate-800 font-semibold">{selectedSecondaryIds.length}</strong> Supporting
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">1 Primary required</span>
              </div>
            </div>

            {/* Unified Staff List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 px-6 py-2 min-h-0">
              {filteredModalStaff.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No staff members found</p>
                  <p className="text-xs text-slate-400 mt-1">Try refining your search keyword.</p>
                </div>
              ) : (
                filteredModalStaff.map((staff: any) => {
                  const isPrimary = selectedPrimaryIds.includes(staff._id);
                  const isSecondary = selectedSecondaryIds.includes(staff._id);
                  const fullName = staff.name || staff.profile?.fullName || staff.email || 'Staff';
                  const initials = getStaffInitials(fullName);
                  const workload = staffWorkloadMap[staff._id] || 0;

                  return (
                    <div
                      key={staff._id}
                      className="flex items-center justify-between py-3 gap-3"
                    >
                      {/* Left: Staff Avatar & Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center border border-slate-200/70 shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {fullName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {workload} active task{workload === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>

                      {/* Right: Primary and Support Toggle Pill Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => togglePrimaryStaff(staff._id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                            isPrimary
                              ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
                          }`}
                        >
                          Primary
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleSecondaryStaff(staff._id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                            isSecondary
                              ? 'bg-slate-800 border-slate-800 text-white shadow-xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800'
                          }`}
                        >
                          Support
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer (Fixed) */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={closeModal}
                disabled={isAssigning}
                className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAssignment}
                disabled={isAssigning || selectedPrimaryIds.length === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-medium shadow-xs transition-all inline-flex items-center gap-2"
              >
                {isAssigning && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Save Assignment</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Dynamic Image Overlay Modal for Proof Photos */}
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
              alt="Evidence proof preview"
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
    </div>
  );
};

export default DepartmentComplaintDetailPage;
