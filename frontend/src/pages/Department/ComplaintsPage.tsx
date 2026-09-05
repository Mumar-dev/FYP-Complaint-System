import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Loader2,
  AlertCircle,
  Users,
  UserCheck,
  UserPlus,
  X,
  Check,
  ChevronRight,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  useGetComplaintsQuery,
  useGetStaffQuery,
  useAssignComplaintMutation,
} from '@/features/complaint/complaint.api';
import { showSuccess, showError } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@constants/index';

const DepartmentComplaintsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  // Redux Mapping
  const { data: complaintsMap, isLoading, isError, error } = useGetComplaintsQuery();
  const { data: staffMap, isLoading: isStaffLoading } = useGetStaffQuery();
  const [assignComplaint, { isLoading: isAssigning }] = useAssignComplaintMutation();

  // Multi-Staff Assignment Modal State
  const [modalComplaint, setModalComplaint] = useState<any | null>(null);
  const [selectedPrimaryIds, setSelectedPrimaryIds] = useState<string[]>([]);
  const [selectedSecondaryIds, setSelectedSecondaryIds] = useState<string[]>([]);
  const [staffSearchTerm, setStaffSearchTerm] = useState('');

  const complaints = complaintsMap?.data || [];
  const staffMembers = staffMap?.data || [];

  // Filter complaints based on Search, Status, and Priority
  const filteredComplaints = useMemo(() => {
    return complaints.filter((complaint: any) => {
      const q = searchTerm.toLowerCase().trim();
      const titleMatch = complaint.title?.toLowerCase().includes(q);
      const idMatch =
        (complaint.complaintId && complaint.complaintId.toLowerCase().includes(q)) ||
        (complaint._id && complaint._id.toLowerCase().includes(q));
      const textMatches = !q || titleMatch || idMatch;

      const matchStatus = filterStatus === 'all' || complaint.status === filterStatus;
      const matchPriority = filterPriority === 'all' || complaint.priority === filterPriority;

      return textMatches && matchStatus && matchPriority;
    });
  }, [complaints, searchTerm, filterStatus, filterPriority]);

  // Compute active workload count for each staff member
  const staffWorkloadMap = useMemo(() => {
    const counts: Record<string, number> = {};
    complaints.forEach((c: any) => {
      if (['assigned', 'in_progress'].includes(c.status)) {
        // primary
        const pId = typeof c.primaryStaffId === 'object' ? c.primaryStaffId?._id : c.primaryStaffId || (typeof c.assignedStaffId === 'object' ? c.assignedStaffId?._id : c.assignedStaffId);
        if (pId) counts[pId] = (counts[pId] || 0) + 1;

        // supporting
        if (Array.isArray(c.supportingStaffIds)) {
          c.supportingStaffIds.forEach((sup: any) => {
            const sId = typeof sup === 'object' ? sup?._id : sup;
            if (sId) counts[sId] = (counts[sId] || 0) + 1;
          });
        }
      }
    });
    return counts;
  }, [complaints]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'resolved':
      case 'closed':
      case 'completed':
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
        return 'bg-slate-50 text-slate-700 border-slate-200/80';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical':
      case 'urgent':
      case 'high':
        return 'bg-rose-50 text-rose-700 border-rose-200/80';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200/80';
      case 'low':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200/80';
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

  // Open the Assign/Manage Team modal and prefill currently assigned members
  const openAssignModal = (complaint: any) => {
    setModalComplaint(complaint);
    setStaffSearchTerm('');

    // Prepopulate Primary Staff
    const primaryId =
      typeof complaint.primaryStaffId === 'object'
        ? complaint.primaryStaffId?._id
        : complaint.primaryStaffId ||
          (typeof complaint.assignedStaffId === 'object'
            ? complaint.assignedStaffId?._id
            : complaint.assignedStaffId);

    setSelectedPrimaryIds(primaryId ? [primaryId] : []);

    // Prepopulate Supporting Staff
    const supportingIds: string[] = [];
    if (Array.isArray(complaint.supportingStaffIds)) {
      complaint.supportingStaffIds.forEach((item: any) => {
        const id = typeof item === 'object' ? item?._id : item;
        if (id && id !== primaryId) {
          supportingIds.push(id);
        }
      });
    }
    setSelectedSecondaryIds(supportingIds);
  };

  const closeModal = () => {
    setModalComplaint(null);
    setSelectedPrimaryIds([]);
    setSelectedSecondaryIds([]);
    setStaffSearchTerm('');
  };

  // Get staff initials
  const getStaffInitials = (name: string) => {
    if (!name) return 'S';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Toggle Primary Staff selection
  const togglePrimaryStaff = (staffId: string) => {
    setSelectedPrimaryIds((prev) => {
      const exists = prev.includes(staffId);
      if (exists) {
        return prev.filter((id) => id !== staffId);
      }
      // If adding as primary, remove from supporting if present
      setSelectedSecondaryIds((sec) => sec.filter((id) => id !== staffId));
      return [...prev, staffId];
    });
  };

  // Toggle Supporting Staff selection
  const toggleSecondaryStaff = (staffId: string) => {
    setSelectedSecondaryIds((prev) => {
      const exists = prev.includes(staffId);
      if (exists) {
        return prev.filter((id) => id !== staffId);
      }
      // If adding as supporting, remove from primary if present
      setSelectedPrimaryIds((prim) => prim.filter((id) => id !== staffId));
      return [...prev, staffId];
    });
  };

  // Save Assignment
  const handleSaveAssignment = async () => {
    if (!modalComplaint) return;

    if (selectedPrimaryIds.length === 0) {
      showError('Please designate at least one primary staff member.');
      return;
    }

    try {
      const primaryLead = selectedPrimaryIds[0];
      // Additional primary members can be appended to supporting or assigned cleanly
      const combinedSupporting = [
        ...selectedPrimaryIds.slice(1),
        ...selectedSecondaryIds,
      ];

      await assignComplaint({
        id: modalComplaint._id,
        primaryStaffId: primaryLead,
        assignedStaffId: primaryLead,
        supportingStaffIds: combinedSupporting,
        reason: 'Assigned via Department Complaints Overview',
      }).unwrap();

      showSuccess('Team assignment updated successfully');
      closeModal();
    } catch (err: any) {
      showError(err?.data?.message || err?.message || 'Failed to save staff assignment');
    }
  };

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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-slate-500 font-medium text-sm">Loading complaints...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h3 className="text-lg font-bold text-slate-900 mb-1">Failed to load complaints</h3>
        <p className="text-slate-500 text-center max-w-md text-sm">
          {((error as any)?.data?.message) || 'Unable to retrieve complaints. Please try again.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Complaints Management
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review, track, and assign departmental staff to {filteredComplaints.length} complaint
          {filteredComplaints.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* 1. Clean Search and Filter Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search complaints by title or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50/60 border border-slate-200/90 text-slate-800 text-sm font-medium rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-48">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full appearance-none bg-slate-50/60 border border-slate-200/90 text-slate-700 text-sm font-medium rounded-xl px-3.5 py-2.5 pr-8 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="pending_assignment">Pending Assignment</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div className="w-full sm:w-40">
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="w-full appearance-none bg-slate-50/60 border border-slate-200/90 text-slate-700 text-sm font-medium rounded-xl px-3.5 py-2.5 pr-8 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
          >
            <option value="all">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* 2. Complaints List (Balanced Horizontal Cards) */}
      <div className="space-y-4">
        {filteredComplaints.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">No complaints found</h3>
            <p className="text-sm text-slate-500 mt-1">Try adjusting your search terms or filters.</p>
          </div>
        ) : (
          filteredComplaints.map((complaint: any) => {
            const complaintNumber =
              complaint.complaintId ||
              `#${complaint._id.substring(complaint._id.length - 8).toUpperCase()}`;

            // Resolve Primary Staff
            const primary =
              complaint.primaryStaffId && typeof complaint.primaryStaffId === 'object'
                ? complaint.primaryStaffId
                : complaint.assignedStaffId && typeof complaint.assignedStaffId === 'object'
                ? complaint.assignedStaffId
                : null;

            const primaryName = primary?.profile?.fullName || primary?.name || primary?.email;

            // Resolve Supporting Staff
            const supportingList = Array.isArray(complaint.supportingStaffIds)
              ? complaint.supportingStaffIds
              : [];

            const isAssignedOrInProgress =
              Boolean(primaryName) || ['assigned', 'in_progress'].includes(complaint.status);

            return (
              <div
                key={complaint._id}
                className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                {/* Left Side: Main Info & Assigned Team Preview */}
                <div className="flex-1 min-w-0">
                  {/* Top Meta Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {/* Status Badge */}
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
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize border ${getPriorityBadge(
                          complaint.priority
                        )}`}
                      >
                        {complaint.priority || 'Medium'}
                      </span>

                      {/* Display Mismatch Note if AI and System Priorities differ */}
                      {complaint.aiPriority && complaint.systemPriority && complaint.aiPriority.toLowerCase() !== complaint.systemPriority.toLowerCase() && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-medium">
                          <span className="font-bold text-amber-700">AI:</span>
                          <span className="capitalize">{complaint.aiPriority}</span>
                          <span className="text-amber-400">|</span>
                          <span className="font-bold text-amber-700">Rule:</span>
                          <span className="capitalize">{complaint.systemPriority}</span>
                        </div>
                      )}
                    </div>

                    {/* Monospace Complaint ID */}
                    <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200/70">
                      {complaintNumber}
                    </span>

                    {/* Possible Duplicate Badge */}
                    {Array.isArray(complaint.relatedIncidentIds) && complaint.relatedIncidentIds.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        <span>Possible Duplicate ({complaint.relatedIncidentIds.length})</span>
                      </span>
                    )}

                    {/* Date */}
                    <span className="text-xs text-slate-400 font-medium">
                      {complaint.createdAt
                        ? new Date(complaint.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : ''}
                    </span>
                  </div>

                  {/* Complaint Title (Generous room) */}
                  <h3
                    onClick={() =>
                      navigate(ROUTES.DEPARTMENT_COMPLAINT_DETAIL.replace(':id', complaint._id))
                    }
                    className="text-base font-semibold text-slate-900 hover:text-blue-600 transition-colors cursor-pointer truncate max-w-3xl"
                    title={complaint.title}
                  >
                    {complaint.title || 'Untitled Complaint'}
                  </h3>

                  {/* Assigned Team Preview */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-400 mr-1 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      Team:
                    </span>

                    {primaryName ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/70">
                        <UserCheck className="w-3 h-3 text-blue-600" />
                        <span className="font-semibold">{primaryName}</span>
                        <span className="text-[10px] uppercase font-bold text-blue-500 tracking-wider">
                          Lead
                        </span>
                      </span>
                    ) : null}

                    {supportingList.map((sup: any, idx: number) => {
                      const supName =
                        typeof sup === 'object'
                          ? sup.profile?.fullName || sup.name || sup.email
                          : 'Supporting Staff';
                      return (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/70"
                        >
                          <span>{supName}</span>
                        </span>
                      );
                    })}

                    {!primaryName && supportingList.length === 0 && (
                      <span className="text-xs italic text-slate-400">
                        No staff assigned yet
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Side: Action Buttons */}
                <div className="flex items-center gap-2.5 shrink-0 self-end lg:self-center">
                  <button
                    onClick={() => openAssignModal(complaint)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs ${
                      isAssignedOrInProgress
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                    }`}
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{isAssignedOrInProgress ? 'Manage Team' : 'Assign Team'}</span>
                  </button>

                  <button
                    onClick={() =>
                      navigate(ROUTES.DEPARTMENT_COMPLAINT_DETAIL.replace(':id', complaint._id))
                    }
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-colors"
                  >
                    <span>View Details</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Multi-Staff Assign / Manage Team Modal via Portal to document.body */}
      {modalComplaint && createPortal(
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
                    {modalComplaint.complaintId || `#${modalComplaint._id.substring(modalComplaint._id.length - 8).toUpperCase()}`}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 truncate" title={modalComplaint.title}>
                  {modalComplaint.title || 'Untitled Complaint'}
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

            {/* Modal Search & Selection Summary Bar (Fixed) */}
            <div className="px-6 pt-4 pb-3 border-b border-slate-100 shrink-0 space-y-3 bg-white">
              {/* Search Bar */}
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

              {/* Selection Summary or Requirement Hint */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                {selectedPrimaryIds.length > 0 || selectedSecondaryIds.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedPrimaryIds.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Primary ({selectedPrimaryIds.length})</span>
                      </span>
                    )}
                    {selectedSecondaryIds.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/80">
                        <Users className="w-3.5 h-3.5" />
                        <span>Support ({selectedSecondaryIds.length})</span>
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-amber-600 font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Select at least 1 Primary staff member to save.
                  </span>
                )}

                {selectedPrimaryIds.length === 0 && selectedSecondaryIds.length > 0 && (
                  <span className="text-xs text-rose-600 font-medium">
                    At least 1 Primary staff required
                  </span>
                )}
              </div>
            </div>

            {/* Single Unified Scrollable Staff List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 px-6">
              {filteredModalStaff.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  No staff members match "{staffSearchTerm}"
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
                        {/* Primary Button */}
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

                        {/* Support Button */}
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
    </div>
  );
};

export default DepartmentComplaintsPage;
