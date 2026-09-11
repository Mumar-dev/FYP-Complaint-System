import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  ArrowRight,
  Filter,
  Eye,
  SlidersHorizontal,
  X,
  Send,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import {
  useGetComplaintsQuery,
  useUpdateComplaintStatusMutation,
  useSubmitResolutionEvidenceMutation,
} from '@/features/complaint/complaint.api';
import { ROUTES } from '@/constants';
import { showSuccess, showError } from '@/utils/toast';

export const AssignedComplaintsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedComplaintId, setExpandedComplaintId] = useState<string | null>(null);

  // Status mutation state
  const [newStatusValues, setNewStatusValues] = useState<Record<string, string>>({});
  const [statusNotes, setStatusNotes] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Evidence Photos State
  const [selectedPhotos, setSelectedPhotos] = useState<Record<string, File[]>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<string, string[]>>({});
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({});

  // Redux Queries & Mutations
  const { data: complaintsData, isLoading, isError, error, refetch } = useGetComplaintsQuery();
  const [updateStatus] = useUpdateComplaintStatusMutation();
  const [submitEvidence] = useSubmitResolutionEvidenceMutation();

  const complaints = complaintsData?.data || [];

  // Filter complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((complaint) => {
      const q = searchTerm.toLowerCase().trim();
      const titleMatch = complaint.title?.toLowerCase().includes(q);
      const idMatch =
        (complaint.complaintId && complaint.complaintId.toLowerCase().includes(q)) ||
        (complaint._id && complaint._id.toLowerCase().includes(q));

      const matchesSearch = !q || titleMatch || idMatch;

      const matchesStatus =
        filterStatus === 'all' ||
        complaint.status?.toLowerCase() === filterStatus.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [complaints, searchTerm, filterStatus]);

  // Valid status transitions for a staff member
  const getAvailableNextStatuses = (currentStatus: string) => {
    const s = (currentStatus || '').toLowerCase();
    switch (s) {
      case 'assigned':
        return [
          { value: 'in_progress', label: 'In Progress' },
        ];
      case 'in_progress':
        return [
          { value: 'resolved', label: 'Resolved' },
          { value: 'under_verification', label: 'Under Verification' },
        ];
      case 'under_verification':
        return [
          { value: 'in_progress', label: 'In Progress' },
        ];
      case 'resolved':
      case 'closed':
      default:
        return [];
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'assigned':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Assigned
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            In Progress
          </span>
        );
      case 'under_verification':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            Under Verification
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
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            {status?.replace(/_/g, ' ') || 'Pending'}
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
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            {p === 'critical' ? 'Critical' : 'High'}
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Medium
          </span>
        );
      case 'low':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Low
          </span>
        );
    }
  };

  const handleToggleUpdatePanel = (complaint: any) => {
    if (expandedComplaintId === complaint._id) {
      setExpandedComplaintId(null);
    } else {
      setExpandedComplaintId(complaint._id);
      setInlineErrors((prev) => ({ ...prev, [complaint._id]: '' }));
      // Auto-set the first available next status if not already set
      const nextOptions = getAvailableNextStatuses(complaint.status);
      if (!newStatusValues[complaint._id] && nextOptions.length > 0) {
        setNewStatusValues((prev) => ({
          ...prev,
          [complaint._id]: nextOptions[0].value,
        }));
      }
    }
  };

  const handlePhotoUpload = (complaintId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).slice(0, 5);
      const currentFiles = selectedPhotos[complaintId] || [];
      const combinedFiles = [...currentFiles, ...newFiles].slice(0, 5);

      setSelectedPhotos((prev) => ({
        ...prev,
        [complaintId]: combinedFiles,
      }));

      const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
      const currentPreviews = previewUrls[complaintId] || [];
      setPreviewUrls((prev) => ({
        ...prev,
        [complaintId]: [...currentPreviews, ...newPreviews].slice(0, 5),
      }));

      setInlineErrors((prev) => ({ ...prev, [complaintId]: '' }));
    }
  };

  const handleRemovePhoto = (complaintId: string, index: number) => {
    setSelectedPhotos((prev) => ({
      ...prev,
      [complaintId]: (prev[complaintId] || []).filter((_, i) => i !== index),
    }));

    setPreviewUrls((prev) => {
      const urls = prev[complaintId] || [];
      if (urls[index]) {
        URL.revokeObjectURL(urls[index]);
      }
      return {
        ...prev,
        [complaintId]: urls.filter((_, i) => i !== index),
      };
    });
  };

  const handleSaveStatus = async (complaintId: string) => {
    const targetStatus = newStatusValues[complaintId];
    if (!targetStatus) {
      showError('Please select a valid status.');
      return;
    }

    const requiresPhoto = targetStatus === 'under_verification' || targetStatus === 'resolved';

    if (requiresPhoto) {
      const photos = selectedPhotos[complaintId] || [];
      if (photos.length === 0) {
        setInlineErrors((prev) => ({
          ...prev,
          [complaintId]: 'Please upload a photo showing the completed work.',
        }));
        return;
      }
    }

    setUpdatingId(complaintId);
    setInlineErrors((prev) => ({ ...prev, [complaintId]: '' }));

    try {
      if (requiresPhoto) {
        const formData = new FormData();
        const photos = selectedPhotos[complaintId] || [];
        photos.forEach((file) => formData.append('images', file));
        formData.append('notes', statusNotes[complaintId]?.trim() || 'Work completed.');

        await submitEvidence({
          complaintId,
          formData,
        }).unwrap();

        showSuccess('Resolution evidence submitted for verification');
      } else {
        await updateStatus({
          id: complaintId,
          status: targetStatus as any,
          notes: statusNotes[complaintId]?.trim() || undefined,
          resolutionRemarks: statusNotes[complaintId]?.trim() || undefined,
        }).unwrap();

        showSuccess('Status updated successfully');
      }

      setExpandedComplaintId(null);
      // Clean up files and previews
      setSelectedPhotos((prev) => {
        const copy = { ...prev };
        delete copy[complaintId];
        return copy;
      });
      setPreviewUrls((prev) => {
        const copy = { ...prev };
        delete copy[complaintId];
        return copy;
      });
      refetch();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Failed to update status';
      setInlineErrors((prev) => ({ ...prev, [complaintId]: msg }));
      showError(msg);
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-sm font-medium text-slate-600">Loading your assigned complaints...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
        <h3 className="text-base font-bold text-slate-900 mb-1">Unable to load complaints</h3>
        <p className="text-xs text-slate-500 text-center max-w-md mb-4">
          {((error as any)?.data?.message) || 'Please check your connection and try again.'}
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition shadow-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Assigned Complaints</h1>
        <p className="text-sm text-slate-500 mt-1">
          You have {complaints.length} active complaint{complaints.length === 1 ? '' : 's'} assigned to you.
        </p>
      </div>

      {/* ── Search & Filter Toolbar ────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between items-center">
        {/* Search Bar */}
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by title or complaint ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
          />
        </div>

        {/* Status Filter Dropdown with Custom Chevron */}
        <div className="relative w-full sm:w-52 shrink-0">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-3.5 py-2 pr-10 text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="under_verification">Under Verification</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* ── Complaints Cards Grid ──────────────────────────────────────────── */}
      <div className="space-y-4">
        {filteredComplaints.length > 0 ? (
          filteredComplaints.map((complaint) => {
            const isExpanded = expandedComplaintId === complaint._id;
            const complaintCode =
              complaint.complaintId ||
              `#${complaint._id.substring(complaint._id.length - 6).toUpperCase()}`;

            const isResolvedOrClosed = ['resolved', 'closed'].includes(complaint.status?.toLowerCase());
            const availableNext = getAvailableNextStatuses(complaint.status);
            const canUpdate = availableNext.length > 0;

            // Don't show duplicate description if identical to title
            const showDescription =
              complaint.description &&
              complaint.description.trim().toLowerCase() !== complaint.title?.trim().toLowerCase();

            return (
              <div
                key={complaint._id}
                className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-blue-300 transition-all"
              >
                {/* Top Row: Status, Priority, Monospace ID, Date */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(complaint.status)}
                    {complaint.status === 'in_progress' && Boolean(complaint.adjustmentFeedback?.remarks) && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        <span>Needs Adjustment</span>
                      </span>
                    )}
                    {getPriorityBadge(complaint.priority)}
                    <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/70">
                      {complaintCode}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    {formatDate(complaint.createdAt)}
                  </span>
                </div>

                {/* Title & Description */}
                <div className="mt-2.5">
                  <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                    {complaint.title || 'Untitled Complaint'}
                  </h3>
                  {showDescription && (
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {complaint.description}
                    </p>
                  )}
                </div>

                {/* Bottom Action Row */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(ROUTES.STAFF_COMPLAINT_DETAIL.replace(':id', complaint._id))
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>View Details</span>
                  </button>

                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => handleToggleUpdatePanel(complaint)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                        isExpanded
                          ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200/80'
                          : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 shadow-xs'
                      }`}
                    >
                      {isExpanded ? (
                        <>
                          <X className="w-3.5 h-3.5" />
                          <span>Close</span>
                        </>
                      ) : (
                        <>
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span>Update Status</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* ── Expanded Update Status Panel ──────────────────────────── */}
                {isExpanded && (
                  <div
                    className="mt-4 pt-4 border-t border-slate-100 bg-slate-50/70 -mx-5 -mb-5 px-5 py-4 rounded-b-2xl animate-in fade-in slide-in-from-top-1 duration-150 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {/* Next Status Select */}
                      <div className="relative w-full sm:w-56 shrink-0">
                        <select
                          value={newStatusValues[complaint._id] || availableNext[0]?.value}
                          onChange={(e) => {
                            setNewStatusValues((prev) => ({
                              ...prev,
                              [complaint._id]: e.target.value,
                            }));
                            setInlineErrors((prev) => ({ ...prev, [complaint._id]: '' }));
                          }}
                          className="w-full h-10 appearance-none bg-white border border-slate-200 rounded-xl px-3.5 pr-9 text-xs font-semibold text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors cursor-pointer shadow-xs"
                        >
                          {availableNext.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                      </div>

                      {/* Optional Note / Remarks */}
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          placeholder={
                            (newStatusValues[complaint._id] || availableNext[0]?.value) === 'under_verification' ||
                            (newStatusValues[complaint._id] || availableNext[0]?.value) === 'resolved'
                              ? 'Describe work completed (required)...'
                              : 'Add a progress or resolution note (optional)...'
                          }
                          value={statusNotes[complaint._id] || ''}
                          onChange={(e) => {
                            setStatusNotes((prev) => ({
                              ...prev,
                              [complaint._id]: e.target.value,
                            }));
                            setInlineErrors((prev) => ({ ...prev, [complaint._id]: '' }));
                          }}
                          className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors shadow-xs placeholder:text-slate-400"
                        />
                      </div>

                      {/* Save Status Button */}
                      <button
                        type="button"
                        onClick={() => handleSaveStatus(complaint._id)}
                        disabled={updatingId === complaint._id}
                        className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all inline-flex items-center justify-center gap-1.5 shrink-0"
                      >
                        {updatingId === complaint._id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>Save Status</span>
                      </button>
                    </div>

                    {/* Smoothly Revealed Photo Upload Dropzone when Under Verification or Resolved is selected */}
                    {((newStatusValues[complaint._id] || availableNext[0]?.value) === 'under_verification' ||
                      (newStatusValues[complaint._id] || availableNext[0]?.value) === 'resolved') && (
                      <div className="pt-2 border-t border-slate-200/60 animate-in fade-in duration-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5 text-blue-600" />
                            <span>Upload Proof Photo <span className="text-rose-500">*</span></span>
                          </label>
                          <span className="text-[11px] text-slate-400">
                            {selectedPhotos[complaint._id]?.length || 0}/5 photos selected
                          </span>
                        </div>

                        {/* Dropzone */}
                        <div className="border border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-3 bg-white/90 transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            id={`photo-input-${complaint._id}`}
                            className="hidden"
                            onChange={(e) => handlePhotoUpload(complaint._id, e)}
                          />
                          <label
                            htmlFor={`photo-input-${complaint._id}`}
                            className="cursor-pointer flex items-center justify-center gap-2 text-xs text-slate-600 hover:text-blue-600 py-1"
                          >
                            <ImageIcon className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-blue-600">Click to choose photos</span>
                            <span className="text-slate-400 text-[11px]">(PNG, JPG, max 5 images)</span>
                          </label>
                        </div>

                        {/* Thumbnails Preview */}
                        {previewUrls[complaint._id] && previewUrls[complaint._id].length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {previewUrls[complaint._id].map((url, idx) => (
                              <div
                                key={idx}
                                className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group shadow-xs"
                              >
                                <img
                                  src={url}
                                  alt={`Proof ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemovePhoto(complaint._id, idx)}
                                  className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white transition-colors"
                                  title="Remove photo"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline Validation Message */}
                    {inlineErrors[complaint._id] && (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-medium animate-in fade-in duration-150">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                        <span>{inlineErrors[complaint._id]}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="text-base font-semibold text-slate-900">No complaints found</p>
            <p className="text-xs text-slate-400 mt-1">
              There are no assigned complaints matching your current filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignedComplaintsPage;
