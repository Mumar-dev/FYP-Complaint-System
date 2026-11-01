import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  CheckCircle,
  Check,
  FileText,
  X,
  Phone,
  UserRound,
  Flag,
  Upload,
  Image as ImageIcon,
  Loader2,
  Send,
  Calendar,
  MapPin,
  Camera,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '@components/Common';
import { ROUTES } from '@constants/index';
import {
  useGetComplaintDetailsQuery,
  useUpdateComplaintStatusMutation,
  useSubmitResolutionEvidenceMutation,
  useGetComplaintEvidenceQuery,
} from '@/features/complaint/complaint.api';
import ComplaintTimeline from '../../components/complaints/ComplaintTimeline';
import ComplaintFeedbackCard from '../../components/complaints/ComplaintFeedbackCard';
import { useAuth } from '@hooks/useAuth';
import { getSLAStatus } from '@/utils/sla';
import { showSuccess, showError } from '@/utils/toast';

const StaffComplaintDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Status Action States
  const [targetStatus, setTargetStatus] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const {
    data: detailsData,
    isLoading: isDetailsLoading,
    isError: isDetailsError,
    refetch,
  } = useGetComplaintDetailsQuery(id as string, { skip: !id });

  const { data: evidenceData } = useGetComplaintEvidenceQuery(id as string, { skip: !id });

  const [updateStatus, { isLoading: isUpdatingStatus }] = useUpdateComplaintStatusMutation();
  const [submitEvidence, { isLoading: isSubmittingEvidence }] = useSubmitResolutionEvidenceMutation();

  const complaint: any = detailsData?.data;

  const isSubmitting = isUpdatingStatus || isSubmittingEvidence;

  const getPriorityConfig = (priority: string = '') => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return {
          badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: <Flag className="w-4 h-4 text-rose-600 fill-rose-100" />,
          label: 'CRITICAL',
        };
      case 'high':
        return {
          badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: <Flag className="w-4 h-4 text-amber-600 fill-amber-100" />,
          label: 'HIGH',
        };
      case 'medium':
        return {
          badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: <Flag className="w-4 h-4 text-blue-600 fill-blue-100" />,
          label: 'MEDIUM',
        };
      case 'low':
      default:
        return {
          badgeBg: 'bg-slate-50 text-slate-700 border-slate-200',
          icon: <Flag className="w-4 h-4 text-slate-500 fill-slate-100" />,
          label: 'LOW',
        };
    }
  };

  const priorityConfig = getPriorityConfig(complaint?.priority);

  const getSLAConfig = (c: any) => {
    if (!c?.slaDeadline) return null;
    const status = getSLAStatus(c);
    if (status.type === 'neutral') return null;
    if (status.type === 'danger')
      return { label: 'OVERDUE', badgeBg: 'bg-red-50 text-red-700 border-red-200' };
    if (status.type === 'warning')
      return { label: 'DUE SOON', badgeBg: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'ON TRACK', badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  };

  const slaConfig = getSLAConfig(complaint);

  const assignedStaff = complaint?.assignedStaffId;
  const assignedStaffId =
    typeof assignedStaff === 'string' ? assignedStaff : (assignedStaff as any)?._id;
  const isAssignedStaff =
    user?.role === 'staff' &&
    (assignedStaffId === user?._id || complaint?.primaryStaffId?._id === user?._id);

  const getTimelineStepStatus = (stepId: number, currentStatus: string) => {
    const raw = (currentStatus || 'submitted').toLowerCase();
    let stepRank = 1;
    if (['assigned'].includes(raw)) stepRank = 2;
    else if (['in_progress', 'in-progress', 'under_verification'].includes(raw)) stepRank = 3;
    else if (['resolved', 'closed', 'completed'].includes(raw)) stepRank = 4;

    if (stepRank > stepId) return 'completed';
    if (stepRank === stepId) return 'current';
    return 'pending';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files).slice(0, 5);
      setSelectedFiles((prev) => [...prev, ...filesArray].slice(0, 5));
      setValidationError(null);

      const newPreviews = filesArray.map((file) => URL.createObjectURL(file));
      setFilePreviews((prev) => [...prev, ...newPreviews].slice(0, 5));
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleActionSubmit = async (selectedTargetStatus?: string) => {
    const finalStatus = selectedTargetStatus || targetStatus;
    if (!finalStatus) {
      setValidationError('Please select an action or target status.');
      return;
    }

    if (finalStatus === 'under_verification' || finalStatus === 'resolved') {
      if (selectedFiles.length === 0) {
        setValidationError('Please upload a photo showing the completed work.');
        return;
      }
      if (!notes.trim()) {
        setValidationError('Please describe the work completed in the notes field.');
        return;
      }

      setValidationError(null);
      try {
        const formData = new FormData();
        selectedFiles.forEach((file) => formData.append('images', file));
        formData.append('notes', notes.trim());

        await submitEvidence({
          complaintId: complaint._id,
          formData,
        }).unwrap();

        showSuccess('Resolution evidence submitted for verification.');
        setSelectedFiles([]);
        setFilePreviews([]);
        setNotes('');
        setTargetStatus('');
        refetch();
      } catch (err: any) {
        showError(err?.data?.message || err?.message || 'Failed to submit evidence');
      }
    } else {
      setValidationError(null);
      try {
        await updateStatus({
          id: complaint._id,
          status: finalStatus as any,
          notes: notes.trim() || undefined,
        }).unwrap();

        showSuccess(`Status updated to ${finalStatus.replace(/_/g, ' ')}`);
        setNotes('');
        setTargetStatus('');
        refetch();
      } catch (err: any) {
        showError(err?.data?.message || err?.message || 'Failed to update status');
      }
    }
  };

  if (isDetailsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <div className="w-10 h-10 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
        <p className="text-slate-500 font-semibold tracking-wider text-xs uppercase">
          Loading Details...
        </p>
      </div>
    );
  }

  if (isDetailsError || !complaint) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] p-8">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
        <h3 className="text-xl font-bold text-slate-800 mb-2">Complaint not found</h3>
        <p className="text-sm text-slate-500 mb-6">Unable to retrieve the requested record.</p>
        <button
          onClick={() => navigate(ROUTES.STAFF_ASSIGNED_COMPLAINTS)}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition shadow-sm"
        >
          Back to Assigned Complaints
        </button>
      </div>
    );
  }

  const isAssigned = complaint.status === 'assigned';
  const isInProgress = complaint.status === 'in_progress';
  const isUnderVerification = complaint.status === 'under_verification';
  const isResolvedOrClosed = ['resolved', 'closed', 'completed'].includes(
    complaint.status?.toLowerCase()
  );

  // Find supervisor adjustment feedback if returned back to in_progress
  const latestRejectedEvidence = (evidenceData?.data || []).find((ev: any) => ev.status === 'rejected' && ev.rejectionReason);
  const adjustmentRemarks =
    complaint?.adjustmentFeedback?.remarks ||
    latestRejectedEvidence?.rejectionReason;
  const adjustmentDate =
    complaint?.adjustmentFeedback?.requestedAt ||
    latestRejectedEvidence?.verifiedAt ||
    latestRejectedEvidence?.updatedAt;

  const showAdjustmentBanner = Boolean(isInProgress && adjustmentRemarks);

  // Active resolution evidence (either populated on complaint or from evidence query)
  const resolutionEvidence = complaint?.resolutionEvidence || (evidenceData?.data && evidenceData.data.length > 0 ? evidenceData.data[0] : null);
  // Render all accumulated photos from complaint.resolutionPhotos, resolutionEvidence, or all evidence history
  const evidencePhotos: string[] = Array.from(new Set([
    ...(complaint?.resolutionPhotos || []),
    ...(resolutionEvidence?.images || []),
    ...((evidenceData?.data || []).flatMap((e: any) => e.images || []))
  ]));
  const evidenceNote = resolutionEvidence?.notes || complaint?.resolutionRemarks;
  const hasResolutionProof = Boolean(
    evidenceNote ||
    evidencePhotos.length > 0 ||
    complaint?.status === 'under_verification' ||
    complaint?.status === 'resolved'
  );

  const submittedByName =
    typeof resolutionEvidence?.submittedBy === 'object'
      ? resolutionEvidence.submittedBy?.profile?.fullName || resolutionEvidence.submittedBy?.name || resolutionEvidence.submittedBy?.email
      : complaint?.primaryStaffId?.profile?.fullName || complaint?.assignedStaffId?.profile?.fullName || 'Staff Member';

  const submittedAtDate = resolutionEvidence?.createdAt || complaint?.underVerificationAt || complaint?.resolvedAt;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pt-2 sm:pt-4 pb-12 animate-in fade-in duration-300">
      {/* Visual Header */}
      <div className="flex items-center justify-between pb-1 pl-1 sm:pl-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(ROUTES.STAFF_ASSIGNED_COMPLAINTS)}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Back to complaints"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <span>Complaint Details</span>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-bold border shadow-xs ${
                  isResolvedOrClosed
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                {complaint.status?.replace(/_/g, ' ')}
              </span>
              {showAdjustmentBanner && (
                <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
                  Needs Adjustment
                </span>
              )}
            </h1>
          </div>
        </div>
      </div>

      {/* Prominent Amber Callout Banner for Adjustments Requested by Department Head */}
      {showAdjustmentBanner && (
        <div className="bg-amber-50 border-2 border-amber-300/80 rounded-2xl p-5 shadow-sm flex items-start gap-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h3 className="text-sm font-bold text-amber-950 tracking-tight">
                Adjustments Requested by Department Head
              </h3>
              {adjustmentDate && (
                <span className="text-[11px] text-amber-800/80 font-medium">
                  {new Date(adjustmentDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-amber-900 bg-white/70 p-3 rounded-xl border border-amber-200/70 font-medium leading-relaxed">
              "{adjustmentRemarks}"
            </p>
            <p className="text-[11px] text-amber-800/90 mt-2 font-medium">
              Please review the feedback above, complete the necessary adjustments on-site, and re-upload resolution proof below to re-submit for verification.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN (70%) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Title & Meta Card */}
          <Card className="p-6 sm:p-7 border border-slate-200/90 shadow-sm rounded-2xl bg-white">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 leading-tight">
              {complaint.title || 'Untitled Report'}
            </h2>
            <div className="text-slate-500 text-xs sm:text-sm font-medium flex flex-wrap items-center gap-2 mb-6">
              <span className="font-semibold text-slate-700">
                Ticket ID:{' '}
                <span className="font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  #
                  {complaint.complaintId ||
                    complaint._id?.substring(complaint._id.length - 6).toUpperCase()}
                </span>
              </span>
              <span className="opacity-40 text-slate-300">•</span>
              <span>
                Submitted on{' '}
                {new Date(complaint.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Category
                </p>
                <p className="font-semibold text-slate-800 text-sm">
                  {complaint.category || 'General Issue'}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Department
                </p>
                <p className="font-semibold text-slate-800 text-sm truncate">
                  {complaint.departmentId?.name || 'Department'}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Reported At
                </p>
                <p className="font-semibold text-slate-800 text-sm">
                  {new Date(complaint.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </Card>

          {/* Details & Resident Photos */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Description & Evidence
            </h3>
            <Card className="p-6 sm:p-7 border border-slate-200/90 shadow-sm rounded-2xl bg-white space-y-6">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Resident Description
                </p>
                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  {complaint.description || 'No description provided.'}
                </p>
              </div>

              {/* Resident Uploaded Photos */}
              {complaint.images && complaint.images.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Attached Photos ({complaint.images.length})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {complaint.images.map((imgUrl: string, idx: number) => (
                      <div
                        key={idx}
                        onClick={() => setPreviewImage(imgUrl)}
                        className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer shadow-xs hover:shadow-md transition-all"
                      >
                        <img
                          src={imgUrl}
                          alt={`Evidence ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Location details */}
              {(complaint.address || complaint.landmark) && (
                <div className="pt-2 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-600">
                  <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800">Location: </span>
                    {complaint.address || ''} {complaint.landmark ? `(Landmark: ${complaint.landmark})` : ''}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Dedicated Staff Resolution Proof & Notes Section */}
          {hasResolutionProof && (evidenceNote || evidencePhotos.length > 0) && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2 ml-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Staff Resolution Proof & Notes</span>
              </h3>
              <Card className="p-6 sm:p-7 border border-slate-200/90 shadow-sm rounded-2xl bg-white space-y-4">
                {/* Staff Submitted Comment & Metadata */}
                {evidenceNote && (
                  <div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-700 leading-relaxed font-medium">
                      "{evidenceNote}"
                    </div>
                    {submittedAtDate && (
                      <p className="text-[11px] text-slate-400 mt-2 font-medium">
                        Submitted by <span className="font-semibold text-slate-700">{submittedByName}</span> ·{' '}
                        {new Date(submittedAtDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}{' '}
                        at{' '}
                        {new Date(submittedAtDate).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                )}

                {/* Uploaded Staff Proof Photos */}
                {evidencePhotos.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-semibold text-slate-600 mb-2.5 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-slate-500" />
                      <span>Resolution Photos ({evidencePhotos.length})</span>
                      <span className="text-[11px] text-slate-400 font-normal ml-1">— Click to enlarge</span>
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {evidencePhotos.map((imgUrl: string, idx: number) => (
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
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Resident Reviews & Feedback (Read-Only) */}
          <ComplaintFeedbackCard
            feedback={{
              rating: complaint.rating,
              feedbackComment: complaint.feedbackComment,
              feedbackSubmittedAt: complaint.feedbackSubmittedAt,
              feedbackSubmitted: complaint.feedbackSubmitted,
            }}
            isResolved={isResolvedOrClosed}
            readOnly={true}
          />

          {/* Action Execution Panel for Staff */}
          {isAssignedStaff && !isResolvedOrClosed && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                Staff Actions
              </h3>
              <Card className="p-6 border border-slate-200/90 shadow-sm rounded-2xl bg-white space-y-5">
                {isAssigned && (
                  <div>
                    <p className="text-xs text-slate-600 mb-3">
                      This complaint has been assigned to you. Click below to begin work on it.
                    </p>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleActionSubmit('in_progress')}
                      className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all inline-flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      <span>Start Work (Move to In Progress)</span>
                    </button>
                  </div>
                )}

                {isInProgress && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Update Status
                      </label>
                      <select
                        value={targetStatus || 'under_verification'}
                        onChange={(e) => setTargetStatus(e.target.value)}
                        className="w-full sm:w-64 h-10 bg-white border border-slate-200 rounded-xl px-3.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                      >
                        <option value="under_verification">Under Verification (Work Complete)</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>

                    {/* Photo Upload dropzone */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Upload Proof Photo <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleFileChange}
                          className="hidden"
                          id="staff-detail-evidence-upload"
                        />
                        <label
                          htmlFor="staff-detail-evidence-upload"
                          className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                        >
                          <Upload className="w-6 h-6 text-slate-400" />
                          <span className="text-xs font-semibold text-blue-600">
                            Click to upload photos
                          </span>
                          <span className="text-[11px] text-slate-400">
                            PNG, JPG or JPEG up to 5 photos showing completed fix
                          </span>
                        </label>
                      </div>

                      {/* Photo Previews */}
                      {filePreviews.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                          {filePreviews.map((preview, i) => (
                            <div
                              key={i}
                              className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group bg-slate-100"
                            >
                              <img
                                src={preview}
                                alt={`Preview ${i + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(i)}
                                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white shadow-sm transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Resolution Notes <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={notes}
                        onChange={(e) => {
                          setNotes(e.target.value);
                          setValidationError(null);
                        }}
                        placeholder="Describe the steps taken to fix the issue..."
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 placeholder:text-slate-400"
                      />
                    </div>

                    {validationError && (
                      <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200/60 rounded-xl px-3 py-2">
                        {validationError}
                      </p>
                    )}

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleActionSubmit(targetStatus || 'under_verification')}
                      className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all inline-flex items-center gap-1.5"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Submit Resolution Evidence</span>
                    </button>
                  </div>
                )}

                {isUnderVerification && (
                  <div className="bg-indigo-50 border border-indigo-200/80 rounded-xl p-4 text-indigo-900 text-xs">
                    <p className="font-semibold">Work is currently Under Verification.</p>
                    <p className="mt-1 text-indigo-700">
                      Your supervisor has received the resolution proof and will approve or request adjustments.
                    </p>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (30%) */}
        <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-4 lg:self-start">
          {/* Priority Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs transition-all">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Priority
            </p>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${priorityConfig.badgeBg}`}
              >
                {priorityConfig.icon}
                <span>{priorityConfig.label}</span>
              </span>
            </div>
          </div>

          {/* Expected Fix By (SLA) */}
          {slaConfig && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs transition-all space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Expected Fix By
              </p>
              <p className="text-sm font-bold text-slate-800">
                {new Date(complaint.slaDeadline as string).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <div>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide border shadow-2xs ${slaConfig.badgeBg}`}
                >
                  {slaConfig.label}
                </span>
              </div>
            </div>
          )}

          {/* Resident Details Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs transition-all space-y-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Reported By
            </p>
            {complaint.residentId ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                    <UserRound className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">
                      {complaint.residentId.profile?.fullName || 'Resident'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{complaint.residentId.email}</p>
                  </div>
                </div>
                {complaint.residentId.profile?.phone && (
                  <a
                    href={`tel:${complaint.residentId.profile.phone}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 pt-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{complaint.residentId.profile.phone}</span>
                  </a>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Resident information not available</p>
            )}
          </div>

          {/* Clean STATUS TRACKER Pipeline */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
              Status Tracker
            </h3>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <div className="space-y-5 relative before:absolute before:inset-0 before:ml-[1.15rem] before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-100">
                {[
                  { id: 1, title: 'Complaint Submitted', desc: 'Complaint received.' },
                  { id: 2, title: 'Assigned', desc: 'Assigned to staff.' },
                  { id: 3, title: 'In Progress / Verification', desc: 'Fix in progress.' },
                  { id: 4, title: 'Resolved', desc: 'Verified and completed.' },
                ].map((step) => {
                  const stepState = getTimelineStepStatus(step.id, complaint.status);
                  const isStepDone = stepState === 'completed';
                  const isStepCurrent = stepState === 'current';

                  return (
                    <div key={step.id} className="relative flex gap-4 items-start">
                      <div className="shrink-0 relative z-10 w-9 h-9 rounded-full flex items-center justify-center border-2 bg-white shadow-2xs transition-all">
                        {isStepDone && (
                          <div className="w-full h-full bg-blue-600 rounded-full flex items-center justify-center text-white">
                            <Check className="w-4 h-4 stroke-[3]" />
                          </div>
                        )}
                        {isStepCurrent && (
                          <div className="w-full h-full bg-blue-50 border-2 border-blue-600 rounded-full flex items-center justify-center">
                            <span className="w-2.5 h-2.5 bg-blue-600 rounded-full"></span>
                          </div>
                        )}
                        {!isStepDone && !isStepCurrent && (
                          <div className="w-full h-full bg-slate-50 border-2 border-slate-200 rounded-full flex items-center justify-center text-[11px] font-bold text-slate-400">
                            {step.id}
                          </div>
                        )}
                      </div>
                      <div
                        className={`pt-1 transition-opacity ${
                          stepState === 'pending' ? 'opacity-40' : 'opacity-100'
                        }`}
                      >
                        <h4
                          className={`text-xs sm:text-sm font-bold ${
                            stepState === 'pending' ? 'text-slate-400' : 'text-slate-900'
                          } tracking-tight`}
                        >
                          {step.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Updates Log */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
              Activity History
            </h3>
            <ComplaintTimeline complaintId={complaint._id} />
          </div>
        </div>
      </div>

      {/* Dynamic Image Overlay Modal */}
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
              alt="Expanded preview"
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

export default StaffComplaintDetailPage;
