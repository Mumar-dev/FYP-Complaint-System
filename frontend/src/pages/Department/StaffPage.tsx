import React, { useState, useEffect } from 'react';
import { Search, Trash2, Edit2, X, Loader, TrendingUp, AlertCircle, User, Plus, MoreVertical, FileText, Calendar, CheckCircle2, Clock, Eye, EyeOff, Info, UserPlus, ChevronDown, ArrowLeftRight, Loader2 } from 'lucide-react';
import { Button, Card, InputField, StatusBadge, UserAvatar } from '@components/Common';
import { useAuth } from '@hooks/useAuth';
import axios from 'axios';
import { showSuccess, showError } from '@/utils/toast';
import { useRequestTransferMutation, useGetEmployeeTransfersQuery } from '@/features/hr/hr.api';

interface StaffMember {
  _id: string;
  profile: {
    fullName: string;
    avatar?: string;
    profileImage?: string;
    position?: string;
  };
  email: string;
  phone?: string;
  role: string;
  rank?: string;
  departmentId: string;
  createdAt: string;
  employmentStatus?: string;
  accountStatus?: string;
  stats?: {
    total?: number;
    assigned?: number;
    inProgress?: number;
    pending?: number;
    done?: number;
    assignedCount?: number;
    resolvedCount?: number;
    slaBreaches?: number;
    complianceRate?: number;
    efficiencyScore?: number;
  };
}

interface ComplaintStats {
  total: number;
  assigned: number;
  completed: number;
  pending: number;
  inProgress: number;
  efficiencyScore?: number;
}

const DepartmentStaffPage: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [complaintStats, setComplaintStats] = useState<Record<string, ComplaintStats>>({});
  const [departmentPositions, setDepartmentPositions] = useState<string[]>([]);
  
  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssignStaffModal, setShowAssignStaffModal] = useState(false);
  const [unassignedStaffList, setUnassignedStaffList] = useState<any[]>([]);
  const [unassignedLoading, setUnassignedLoading] = useState(false);
  const [unassignedSearch, setUnassignedSearch] = useState('');
  const [selectedUnassignedId, setSelectedUnassignedId] = useState<string>('');
  const [assigningStaff, setAssigningStaff] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAllStaffReportModal, setShowAllStaffReportModal] = useState(false);
  const [showStaffActionMenu, setShowStaffActionMenu] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetDeptId, setTransferTargetDeptId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [allDepartments, setAllDepartments] = useState<any[]>([]);

  const [requestTransferMutation, { isLoading: isSubmittingTransfer }] = useRequestTransferMutation();
  const { data: transferRequestsData, refetch: refetchTransfers } = useGetEmployeeTransfersQuery();
  const transferRequests = transferRequestsData?.data || [];
  
  // Selected staff for modals
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
  });
  const [addStaffForm, setAddStaffForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    cnic: '',
    password: '',
    post: '',
    rank: 'junior',
  });
  const [reportForm, setReportForm] = useState({
    startDate: '',
    endDate: '',
  });

  // Fetch staff
  useEffect(() => {
    fetchStaff();
  }, [user?.departmentId]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user?.departmentId) {
        setError('No department assigned');
        setLoading(false);
        return;
      }

      // Fetch department details for positions
      const deptRes = await axios.get(
        `http://localhost:5000/api/departments/${user.departmentId}`,
        { withCredentials: true }
      );
      setDepartmentPositions(deptRes.data.data?.positions || []);

      // Fetch all departments for transfer modal
      const allDeptsRes = await axios.get(
        `http://localhost:5000/api/departments`,
        { withCredentials: true }
      );
      setAllDepartments(allDeptsRes.data.data || []);

      const res = await axios.get(
        `http://localhost:5000/api/departments/${user.departmentId}/staff?role=staff`,
        { withCredentials: true }
      );

      const rawStaff = res.data.data || [];
      // Defensively exclude department head or current user
      const regularStaffOnly = rawStaff.filter(
        (member: StaffMember) => member.role !== 'department_head' && member._id !== user._id
      );

      setStaff(regularStaffOnly);

      // Fetch complaint stats for each staff
      const statsMap: Record<string, ComplaintStats> = {};
      const complaintsRes = await axios.get(
        'http://localhost:5000/api/complaints',
        { withCredentials: true }
      );

      const allComplaints = complaintsRes.data.data || [];
      regularStaffOnly.forEach((member: StaffMember) => {
        // Pre-populate from backend-calculated stats if present
        if (member.stats) {
          statsMap[member._id] = {
            total: member.stats.total ?? ((member.stats.assigned ?? 0) + (member.stats.inProgress ?? 0) + (member.stats.pending ?? 0) + (member.stats.done ?? 0)),
            assigned: member.stats.assigned ?? 0,
            completed: member.stats.done ?? member.stats.resolvedCount ?? 0,
            pending: member.stats.pending ?? 0,
            inProgress: member.stats.inProgress ?? 0,
            efficiencyScore: member.stats.efficiencyScore
          };
        } else {
          // Robust client fallback matching assignedStaffId, primaryStaffId or supportingStaffIds
          const memberComplaints = allComplaints.filter((c: any) => {
            const assignedId = typeof c.assignedStaffId === 'object' ? c.assignedStaffId?._id : c.assignedStaffId;
            const primaryId = typeof c.primaryStaffId === 'object' ? c.primaryStaffId?._id : c.primaryStaffId;
            const supportingList = Array.isArray(c.supportingStaffIds)
              ? c.supportingStaffIds.map((s: any) => (typeof s === 'object' ? s?._id : s))
              : [];
            return assignedId === member._id || primaryId === member._id || supportingList.includes(member._id);
          });

          const completed = memberComplaints.filter((c: any) =>
            ['resolved', 'closed', 'completed'].includes((c.status || '').toLowerCase())
          ).length;
          const inProgress = memberComplaints.filter((c: any) =>
            ['in_progress', 'in-progress', 'under_verification'].includes((c.status || '').toLowerCase())
          ).length;
          const pending = memberComplaints.filter((c: any) =>
            ['pending', 'pending_assignment', 'submitted', 'on_hold'].includes((c.status || '').toLowerCase())
          ).length;
          const assigned = memberComplaints.filter((c: any) =>
            ['assigned', 'open'].includes((c.status || '').toLowerCase())
          ).length;

          const total = memberComplaints.length;
          let efficiencyScore = 0;
          if (total > 0) {
            efficiencyScore = completed > 0 ? Math.round((completed / total) * 100) : (inProgress > 0 ? 50 : 0);
          }

          statsMap[member._id] = {
            total,
            assigned,
            completed,
            pending,
            inProgress,
            efficiencyScore
          };
        }
      });
      setComplaintStats(statsMap);

      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching staff:', err);
      setError(err.response?.data?.message || 'Failed to load staff');
      setLoading(false);
    }
  };

  const handleEdit = (member: StaffMember) => {
    setSelectedStaff(member);
    setEditForm({
      fullName: member.profile.fullName,
      phone: member.phone || '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedStaff || !editForm.fullName.trim()) {
      alert('❌ Name cannot be empty');
      return;
    }

    try {
      await axios.patch(
        `http://localhost:5000/api/users/${selectedStaff._id}`,
        {
          'profile.fullName': editForm.fullName,
          phone: editForm.phone,
        },
        { withCredentials: true }
      );

      setStaff(
        staff.map((s) =>
          s._id === selectedStaff._id
            ? {
                ...s,
                profile: { ...s.profile, fullName: editForm.fullName },
                phone: editForm.phone,
              }
            : s
        )
      );

      setShowEditModal(false);
      showSuccess('Staff member updated successfully');
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to update staff');
    }
  };

  const handleDelete = async () => {
    if (!selectedStaff) return;

    try {
      await axios.delete(
        `http://localhost:5000/api/users/${selectedStaff._id}`,
        { withCredentials: true }
      );

      setStaff(staff.filter((s) => s._id !== selectedStaff._id));
      setShowDeleteConfirm(false);
      setSelectedStaff(null);
      showSuccess('Staff member deleted successfully');
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to delete staff');
    }
  };

  const handleViewPerformance = (member: StaffMember) => {
    setSelectedStaff(member);
    setShowPerformanceModal(true);
  };

  const openAssignStaffModal = async () => {
    setShowAssignStaffModal(true);
    setSelectedUnassignedId('');
    setUnassignedSearch('');
    setUnassignedLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/users/staff?unassigned=true', {
        withCredentials: true,
      });
      setUnassignedStaffList(res.data.data || []);
    } catch (err: any) {
      console.error('Failed to load unassigned staff:', err);
      showError(err.response?.data?.message || 'Failed to fetch unassigned staff');
    } finally {
      setUnassignedLoading(false);
    }
  };

  const handleAssignSelectedStaff = async () => {
    if (!selectedUnassignedId) {
      showError('Please select a staff member to assign');
      return;
    }
    if (!user?.departmentId) {
      showError('You do not belong to an active department.');
      return;
    }

    try {
      setAssigningStaff(true);
      await axios.patch(
        'http://localhost:5000/api/users/assign-department',
        {
          departmentId: user.departmentId,
          userIds: [selectedUnassignedId],
        },
        { withCredentials: true }
      );

      showSuccess('Staff member assigned to department successfully');
      setShowAssignStaffModal(false);
      setSelectedUnassignedId('');
      await fetchStaff();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to assign staff member');
    } finally {
      setAssigningStaff(false);
    }
  };


  const getStaffInitials = (name: string) => {
    if (!name) return 'S';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const filteredStaff = staff.filter((member) =>
    member.role !== 'department_head' &&
    member._id !== user?._id &&
    (member.profile.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
     member.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 mx-auto text-primary-600 mb-4" />
          <p className="text-secondary-600">Loading staff members...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card variant="md" className="p-6 bg-red-50 border-red-200">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-700 font-semibold text-center">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Staff Management</h1>
          <p className="text-sm text-slate-500 mt-1">{filteredStaff.length} staff members in department</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowAllStaffReportModal(true)}
            className="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-medium shadow-2xs transition-colors"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            <span>Export Report</span>
          </button>
          <button
            onClick={openAssignStaffModal}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Assign Staff</span>
          </button>
        </div>
      </div>

      {/* Streamlined Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Search staff members by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl h-11 pl-11 pr-4 text-sm font-medium text-slate-800 shadow-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
        />
      </div>

      {/* Staff Cards Grid */}
      {filteredStaff.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredStaff.map((member) => {
            const stats = complaintStats[member._id] || {
              total: 0,
              assigned: 0,
              completed: 0,
              pending: 0,
              inProgress: 0,
              efficiencyScore: 0,
            };
            const totalTasks = stats.total ?? (stats.assigned + stats.completed + stats.pending + stats.inProgress);
            const efficiency = typeof stats.efficiencyScore === 'number'
              ? stats.efficiencyScore
              : (totalTasks > 0 ? Math.round((stats.completed / totalTasks) * 100) : 0);
            const initials = getStaffInitials(member.profile.fullName);

            const pendingTransfer = transferRequests.find(
              (tr: any) =>
                (tr.employeeId?._id === member._id || tr.employeeId === member._id) &&
                ['REQUESTED', 'UNDER_REVIEW', 'PENDING'].includes(tr.status?.toUpperCase())
            );

            return (
              <div 
                key={member._id} 
                className="relative bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                {/* Action Menu (Top Right) */}
                <div className="absolute top-4 right-4 z-10">
                  <button
                    onClick={() => setShowStaffActionMenu(showStaffActionMenu === member._id ? null : member._id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none"
                    aria-label="Staff options"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {/* Dropdown Menu */}
                  {showStaffActionMenu === member._id && (
                    <div className="absolute right-0 top-9 w-48 bg-white rounded-xl shadow-lg border border-slate-200/80 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <button
                        onClick={() => {
                          handleViewPerformance(member);
                          setShowStaffActionMenu(null);
                        }}
                        className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors text-xs font-medium"
                      >
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        View Performance
                      </button>

                      <button
                        onClick={() => {
                          setSelectedStaff(member);
                          setShowReportModal(true);
                          setShowStaffActionMenu(null);
                        }}
                        className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors text-xs font-medium"
                      >
                        <FileText className="w-4 h-4 text-emerald-600" />
                        Generate Report
                      </button>

                      <button
                        onClick={() => {
                          handleEdit(member);
                          setShowStaffActionMenu(null);
                        }}
                        className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors text-xs font-medium"
                      >
                        <Edit2 className="w-4 h-4 text-purple-600" />
                        Edit Staff
                      </button>

                      <button
                        disabled={Boolean(pendingTransfer)}
                        onClick={() => {
                          if (pendingTransfer) return;
                          setSelectedStaff(member);
                          setTransferTargetDeptId('');
                          setTransferReason('');
                          setShowTransferModal(true);
                          setShowStaffActionMenu(null);
                        }}
                        className={`w-full px-3.5 py-2 text-left flex items-center gap-2.5 transition-colors text-xs font-medium ${
                          pendingTransfer
                            ? 'text-slate-400 cursor-not-allowed opacity-60'
                            : 'text-slate-700 hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        <ArrowLeftRight className="w-4 h-4 text-slate-500" />
                        <span>Transfer Staff</span>
                      </button>

                      <div className="border-t border-slate-100 my-1"></div>

                      <button
                        onClick={() => {
                          setSelectedStaff(member);
                          setShowDeleteConfirm(true);
                          setShowStaffActionMenu(null);
                        }}
                        className="w-full px-3.5 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors text-xs font-medium"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Staff
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  {/* Card Header (Top Row: Avatar + Info) */}
                  <div className="flex items-start gap-3.5 pr-10 mb-4">
                    <div className="relative shrink-0">
                      <UserAvatar
                        name={member.profile?.fullName || member.email}
                        src={member.profile?.profileImage || member.profile?.avatar}
                        size="md"
                        className="w-11 h-11 text-sm"
                      />
                      {/* Active green dot or Suspended amber dot */}
                      {member.employmentStatus === 'SUSPENDED' || member.accountStatus === 'suspended' ? (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-500 border-2 border-white rounded-full" title="Suspended"></div>
                      ) : (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" title="Active"></div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-slate-900 truncate">
                        {member.profile.fullName}
                      </h3>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{member.email}</p>

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {member.employmentStatus === 'SUSPENDED' || member.accountStatus === 'suspended' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            Active
                          </span>
                        )}
                        {member.rank && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-200/60 capitalize">
                            {member.rank === 'team_lead' ? 'Team Lead' : member.rank}
                          </span>
                        )}
                        {member.profile.position && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
                            {member.profile.position}
                          </span>
                        )}
                        {pendingTransfer && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                            <span>Transfer Pending &rarr; {pendingTransfer.targetDepartmentId?.name || 'New Dept'}</span>
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          Joined {new Date(member.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Phone Info if available */}
                  {member.phone && (
                    <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
                      <span className="text-slate-400">Phone:</span>
                      <span className="font-medium text-slate-700">{member.phone}</span>
                    </p>
                  )}

                  {/* 3. Single Unified Stats Strip */}
                  <div className="grid grid-cols-4 divide-x divide-slate-200/70 bg-slate-50/80 border border-slate-100 rounded-xl py-3 my-4 text-center">
                    <div>
                      <p className="text-lg font-bold text-slate-800 leading-tight">{stats.assigned}</p>
                      <p className="text-[11px] font-medium text-slate-500 mt-0.5">Assigned</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-blue-600 leading-tight">{stats.inProgress}</p>
                      <p className="text-[11px] font-medium text-slate-500 mt-0.5">In Progress</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-amber-600 leading-tight">{stats.pending}</p>
                      <p className="text-[11px] font-medium text-slate-500 mt-0.5">Pending</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-600 leading-tight">{stats.completed}</p>
                      <p className="text-[11px] font-medium text-slate-500 mt-0.5">Done</p>
                    </div>
                  </div>
                </div>

                {/* 4. Efficiency Score Bar with Smart Empty State */}
                <div className="pt-2 mt-auto">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                      <span>Efficiency Score</span>
                    </span>
                    {totalTasks === 0 ? (
                      <span className="text-xs text-slate-400">No tasks yet</span>
                    ) : (
                      <span
                        className={`text-xs font-bold ${
                          efficiency >= 80
                            ? 'text-emerald-600'
                            : efficiency >= 50
                            ? 'text-blue-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {efficiency}%
                      </span>
                    )}
                  </div>

                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    {totalTasks > 0 ? (
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          efficiency >= 80
                            ? 'bg-emerald-500'
                            : efficiency >= 50
                            ? 'bg-blue-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.max(efficiency, 2)}%` }}
                      ></div>
                    ) : (
                      <div className="h-full w-0"></div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">
            {searchTerm ? 'No staff members match your search' : 'No staff members assigned yet'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {searchTerm ? 'Try checking for typos or searching with different keywords.' : 'Add your first staff member using the button above.'}
          </p>
        </div>
      )}

      {/* Transfer Staff Modal */}
      {showTransferModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">Transfer Staff Member</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Send transfer request for <strong className="text-slate-700">{selectedStaff.profile.fullName}</strong> to Admin
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Target Department Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Target Department <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={transferTargetDeptId}
                    onChange={(e) => setTransferTargetDeptId(e.target.value)}
                    className="w-full h-11 appearance-none pl-3.5 pr-10 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-xs cursor-pointer"
                  >
                    <option value="">Select target department...</option>
                    {allDepartments
                      .filter((d: any) => d._id !== user?.departmentId && d._id !== selectedStaff.departmentId)
                      .map((dept: any) => (
                        <option key={dept._id} value={dept._id}>
                          {dept.name}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Transfer Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Explain why this staff member should be transferred..."
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-xs resize-none"
                />
              </div>

              {/* Info Note */}
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 leading-relaxed">
                  This request will be sent to Admin for approval before the employee is moved. Any active complaint assignments will be handed over upon approval.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                disabled={isSubmittingTransfer}
                className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingTransfer || !transferTargetDeptId || !transferReason.trim()}
                onClick={async () => {
                  try {
                    await requestTransferMutation({
                      employeeId: selectedStaff._id,
                      targetDepartmentId: transferTargetDeptId,
                      reason: transferReason.trim()
                    }).unwrap();

                    showSuccess('Transfer request submitted to Admin for approval.');
                    setShowTransferModal(false);
                    refetchTransfers();
                  } catch (err: any) {
                    showError(err?.data?.message || err?.message || 'Failed to submit transfer request.');
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingTransfer && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Submit Request</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Clean White Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">Edit Staff Profile</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Update staff contact details</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-xs"
                  placeholder="Enter full name"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="text"
                  className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-xs"
                  placeholder="Enter phone number"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                    Read-only
                  </span>
                </div>
                <div className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-500 flex items-center cursor-not-allowed select-none">
                  {selectedStaff.email}
                </div>
              </div>
            </div>

            {/* Consistent Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-medium shadow-sm transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Performance Modal */}
      {showPerformanceModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Clean White Header with Staff Initials */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 font-semibold text-sm flex items-center justify-center shrink-0 border border-blue-100">
                  {getStaffInitials(selectedStaff.profile.fullName)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 truncate leading-tight">
                    {selectedStaff.profile.fullName}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Performance Overview</p>
                </div>
              </div>
              <button
                onClick={() => setShowPerformanceModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Performance Content */}
            <div className="p-6 space-y-5">
              {/* Flat Metric Tiles Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-200/70 text-slate-700 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Assigned</p>
                    <p className="text-xl font-bold text-slate-900">
                      {complaintStats[selectedStaff._id]?.assigned || 0}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-blue-600 uppercase tracking-wider">In Progress</p>
                    <p className="text-xl font-bold text-blue-700">
                      {complaintStats[selectedStaff._id]?.inProgress || 0}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-amber-600 uppercase tracking-wider">Pending</p>
                    <p className="text-xl font-bold text-amber-700">
                      {complaintStats[selectedStaff._id]?.pending || 0}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">Completed</p>
                    <p className="text-xl font-bold text-emerald-700">
                      {complaintStats[selectedStaff._id]?.completed || 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Efficiency Score Card */}
              <div className="border border-slate-200/80 rounded-xl p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                    <span>Efficiency Score</span>
                  </span>
                  {(complaintStats[selectedStaff._id]?.assigned || 0) === 0 ? (
                    <span className="text-xs text-slate-400 font-medium">No tasks yet</span>
                  ) : (
                    <span
                      className={`text-sm font-bold ${
                        Math.round(
                          ((complaintStats[selectedStaff._id]?.completed || 0) /
                            complaintStats[selectedStaff._id].assigned) *
                            100
                        ) >= 80
                          ? 'text-emerald-600'
                          : Math.round(
                              ((complaintStats[selectedStaff._id]?.completed || 0) /
                                complaintStats[selectedStaff._id].assigned) *
                                100
                            ) >= 50
                          ? 'text-blue-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {Math.round(
                        ((complaintStats[selectedStaff._id]?.completed || 0) /
                          complaintStats[selectedStaff._id].assigned) *
                          100
                      )}%
                    </span>
                  )}
                </div>

                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  {(complaintStats[selectedStaff._id]?.assigned || 0) > 0 ? (
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        Math.round(
                          ((complaintStats[selectedStaff._id]?.completed || 0) /
                            complaintStats[selectedStaff._id].assigned) *
                            100
                        ) >= 80
                          ? 'bg-emerald-500'
                          : Math.round(
                              ((complaintStats[selectedStaff._id]?.completed || 0) /
                                complaintStats[selectedStaff._id].assigned) *
                                100
                            ) >= 50
                          ? 'bg-blue-500'
                          : 'bg-amber-500'
                      }`}
                      style={{
                        width: `${Math.max(
                          Math.round(
                            ((complaintStats[selectedStaff._id]?.completed || 0) /
                              complaintStats[selectedStaff._id].assigned) *
                              100
                          ),
                          2
                        )}%`,
                      }}
                    ></div>
                  ) : (
                    <div className="h-full w-0"></div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 text-center mt-2.5">
                  Calculated from assigned vs. completed complaints ratio
                </p>
              </div>
            </div>

            {/* Consistent Right-Aligned Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowPerformanceModal(false)}
                className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-5 py-2 rounded-xl text-sm font-medium transition-colors shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedStaff && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
          <Card variant="lg" className="w-full max-w-sm p-0 overflow-hidden shadow-2xl border-0">
            <div className="p-8 text-center bg-white">
              <div className="relative mx-auto w-20 h-20 mb-6 flex items-center justify-center">
                <div className="absolute inset-0 bg-red-100 rounded-full animate-ping opacity-60"></div>
                <div className="relative bg-red-100 rounded-full w-20 h-20 flex items-center justify-center border-4 border-white shadow-md">
                  <Trash2 className="w-8 h-8 text-red-600" />
                </div>
              </div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Delete Staff?</h2>
              <p className="text-slate-500 mt-3 font-medium leading-relaxed">
                You are about to permanently delete <br/>
                <strong className="text-slate-800">{selectedStaff.profile.fullName}</strong>.<br/>
                <span className="text-red-500 font-semibold">This action cannot be undone.</span>
              </p>
            </div>

            <div className="p-6 pt-0 bg-white flex gap-3">
              <Button
                variant="outline"
                fullWidth
                className="py-3 font-bold bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedStaff(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                fullWidth
                className="py-3 font-bold bg-red-600 border-0 shadow-md hover:bg-red-700 hover:shadow-lg"
                onClick={handleDelete}
              >
                Yes, Delete
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Assign Staff Member Modal (Department Head) */}
      {showAssignStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]">
          <div className="w-full max-w-lg max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">Assign Staff Member</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Select an unassigned staff member to add to your department</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAssignStaffModal(false);
                  setSelectedUnassignedId('');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4 overflow-hidden flex-1">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search unassigned staff..."
                  value={unassignedSearch}
                  onChange={(e) => setUnassignedSearch(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-2xs"
                />
              </div>

              {/* Staff List */}
              <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[340px] rounded-xl border border-slate-200/80 bg-white divide-y divide-slate-100 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200">
                {unassignedLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mb-2 text-blue-600" />
                    <span className="text-xs font-medium">Loading unassigned staff...</span>
                  </div>
                ) : (() => {
                  const filtered = unassignedStaffList.filter((s) => {
                    const name = s.profile?.fullName || s.name || '';
                    const email = s.email || '';
                    const q = unassignedSearch.toLowerCase();
                    return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2.5">
                          <User className="w-5 h-5 text-slate-400" />
                        </div>
                        <p className="text-sm font-semibold text-slate-700">No unassigned staff available</p>
                        <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                          Ask an Admin to create new staff accounts first. You will be able to assign them here once created.
                        </p>
                      </div>
                    );
                  }

                  return filtered.map((s) => {
                    const isSelected = selectedUnassignedId === s._id;
                    const name = s.profile?.fullName || s.name || s.email;
                    const initials = getStaffInitials(name);
                    const rankDisplay = s.rank === 'senior' ? 'Senior' : s.rank === 'team_lead' ? 'Team Lead' : s.rank === 'supervisor' ? 'Supervisor' : 'Junior';

                    return (
                      <div
                        key={s._id}
                        onClick={() => setSelectedUnassignedId(s._id)}
                        className={`px-3.5 py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Radio Checkbox */}
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                              isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>

                          {/* Avatar */}
                          <UserAvatar
                            name={name}
                            src={s.profile?.profileImage || s.profile?.avatar || s.profileImage}
                            size="sm"
                            className="w-9 h-9 text-xs"
                          />

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200/60 shrink-0">
                                {rankDisplay}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 truncate mt-0.5">{s.email}</p>
                          </div>
                        </div>

                        {s.profile?.position && (
                          <span className="text-[11px] font-medium text-slate-500 shrink-0 bg-slate-100 px-2 py-0.5 rounded-md">
                            {s.profile.position}
                          </span>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Dedicated Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowAssignStaffModal(false);
                  setSelectedUnassignedId('');
                }}
                disabled={assigningStaff}
                className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedUnassignedId || assigningStaff}
                onClick={handleAssignSelectedStaff}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {assigningStaff && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Assign to Department</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Staff Report Modal */}
      {showReportModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Clean White Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">Generate Staff Report</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Filter complaints & performance by date</p>
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body with Generous Padding */}
            <div className="p-6 space-y-5">
              {/* Selected Staff Info Row */}
              <div className="bg-slate-50 border border-slate-200/70 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 font-semibold text-xs flex items-center justify-center shrink-0 border border-blue-100">
                  {getStaffInitials(selectedStaff.profile.fullName)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {selectedStaff.profile.fullName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{selectedStaff.email}</p>
                </div>
              </div>

              {/* Date Inputs in 2 Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={reportForm.startDate}
                    onChange={(e) => setReportForm({ ...reportForm, startDate: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={reportForm.endDate}
                    onChange={(e) => setReportForm({ ...reportForm, endDate: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-xs"
                  />
                </div>
              </div>
            </div>

            {/* Consistent Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  alert(`Report generated for ${selectedStaff.profile.fullName} from ${reportForm.startDate || 'start'} to ${reportForm.endDate || 'today'}`);
                  setShowReportModal(false);
                }}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-medium shadow-sm transition-all"
              >
                <FileText className="w-4 h-4" />
                <span>Generate Report</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Staff Report Modal */}
      {showAllStaffReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Clean White Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">Export Department Report</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Aggregate performance for all staff members</p>
                </div>
              </div>
              <button
                onClick={() => setShowAllStaffReportModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              <div className="bg-blue-50/70 border border-blue-200/70 rounded-xl p-3.5 flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 leading-relaxed">
                  This report will aggregate assigned, pending, in-progress, and resolved complaints across all staff members in your department.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={reportForm.startDate}
                    onChange={(e) => setReportForm({ ...reportForm, startDate: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={reportForm.endDate}
                    onChange={(e) => setReportForm({ ...reportForm, endDate: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-xs"
                  />
                </div>
              </div>
            </div>

            {/* Consistent Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAllStaffReportModal(false)}
                className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  alert(`Exporting department report from ${reportForm.startDate || 'start'} to ${reportForm.endDate || 'today'}`);
                  setShowAllStaffReportModal(false);
                  setReportForm({ startDate: '', endDate: '' });
                }}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-medium shadow-sm transition-all"
              >
                <FileText className="w-4 h-4" />
                <span>Export Report</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentStaffPage;
