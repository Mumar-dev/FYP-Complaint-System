import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  TrendingUp,
  Loader,
  AlertCircle,
  Search,
  Users,
  MoreVertical,
  Award,
  AlertTriangle,
  X,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@hooks/useAuth';
import { UserAvatar } from '@components/Common';
import { useRequestPromotionMutation, useIssueFormalWarningMutation } from '@/features/hr/hr.api';
import toast from 'react-hot-toast';
import axios from 'axios';

interface StaffPerformance {
  _id: string;
  email?: string;
  role?: string;
  rank?: string;
  profile: {
    fullName: string;
    avatar?: string;
    profileImage?: string;
    position?: string;
  };
  assignedComplaints: number;
  completedComplaints: number;
  pendingComplaints: number;
}

const RANK_HIERARCHY: Record<string, string> = {
  junior: 'senior',
  standard: 'senior', // Backwards compatibility fallback
  senior: 'team_lead',
  lead: 'supervisor',
  team_lead: 'supervisor',
};

const formatRankLabel = (r?: string) => {
  if (!r) return 'Staff';
  if (r === 'team_lead') return 'Team Lead';
  return r.charAt(0).toUpperCase() + r.slice(1);
};

const DepartmentPerformancePage: React.FC = () => {
  const { user } = useAuth();
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchStaff, setSearchStaff] = useState('');

  // Mutations
  const [requestPromotion, { isLoading: submittingPromo }] = useRequestPromotionMutation();
  const [issueFormalWarning, { isLoading: issuingWarning }] = useIssueFormalWarningMutation();

  // Action Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Modals state
  const [promoModal, setPromoModal] = useState<{
    open: boolean;
    member: StaffPerformance | null;
    nextRank: string;
    reason: string;
  }>({
    open: false,
    member: null,
    nextRank: '',
    reason: '',
  });

  const [warningModal, setWarningModal] = useState<{
    open: boolean;
    member: StaffPerformance | null;
    category: string;
    severity: string;
    subject: string;
    details: string;
    actionRequired: string;
  }>({
    open: false,
    member: null,
    category: 'Performance',
    severity: 'Written',
    subject: '',
    details: '',
    actionRequired: '',
  });

  // Close action menu on click outside or Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveMenuId(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    fetchPerformanceData();
  }, [user?.departmentId]);

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user?.departmentId) {
        setError('No department assigned to user');
        setLoading(false);
        return;
      }

      // Fetch staff (specifically requesting only regular staff members)
      const staffRes = await axios.get(
        `/api/departments/${user.departmentId}/staff?role=staff`,
        { withCredentials: true }
      );

      // Fetch all complaints
      const complaintsRes = await axios.get(
        '/api/complaints',
        { withCredentials: true }
      );

      const allComplaints = complaintsRes.data.data || [];
      const rawStaffList = staffRes.data.data || [];

      // Defensively filter out the department head or current user
      const staffList = rawStaffList.filter((s: any) =>
        s.role !== 'department_head' && s._id !== user._id
      );

      // Calculate performance for each staff member
      const performance = staffList.map((staff: any) => {
        const staffComplaints = allComplaints.filter((c: any) => {
          const primaryId =
            typeof c.primaryStaffId === 'object'
              ? c.primaryStaffId?._id
              : c.primaryStaffId ||
                (typeof c.assignedStaffId === 'object' ? c.assignedStaffId?._id : c.assignedStaffId);
          return primaryId === staff._id;
        });

        return {
          _id: staff._id,
          email: staff.email,
          role: staff.role,
          rank: staff.rank || 'junior',
          profile: staff.profile || { fullName: staff.name || 'Staff Member' },
          assignedComplaints: staffComplaints.length,
          completedComplaints: staffComplaints.filter((c: any) =>
            ['completed', 'resolved', 'closed'].includes(c.status)
          ).length,
          pendingComplaints: staffComplaints.filter((c: any) =>
            ['pending', 'pending_assignment', 'submitted', 'assigned', 'in_progress'].includes(c.status)
          ).length,
        };
      });

      setStaffPerformance(
        performance.sort((a: any, b: any) => b.completedComplaints - a.completedComplaints)
      );
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching performance data:', err);
      setError(err.response?.data?.message || 'Failed to load performance data');
      setLoading(false);
    }
  };

  const handleOpenPromoModal = (member: StaffPerformance) => {
    const currRank = (member.rank || 'junior').toLowerCase();
    const next = RANK_HIERARCHY[currRank] || '';
    setPromoModal({
      open: true,
      member,
      nextRank: next,
      reason: '',
    });
    setActiveMenuId(null);
  };

  const handleOpenWarningModal = (member: StaffPerformance) => {
    setWarningModal({
      open: true,
      member,
      category: 'Performance',
      severity: 'Written',
      subject: '',
      details: '',
      actionRequired: '',
    });
    setActiveMenuId(null);
  };

  const handleSubmitPromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoModal.member || !promoModal.reason.trim()) return;

    try {
      await requestPromotion({
        employeeId: promoModal.member._id,
        requestedRank: promoModal.nextRank,
        requestedDesignation:
          promoModal.member.profile?.position || formatRankLabel(promoModal.nextRank),
        proposedDepartmentId: user?.departmentId,
        requestType: 'supervisor_recommendation',
        justification: promoModal.reason.trim(),
      }).unwrap();

      toast.success(
        `Promotion recommendation for ${promoModal.member.profile?.fullName || 'staff'} submitted to Administration.`
      );
      setPromoModal({ open: false, member: null, nextRank: '', reason: '' });
      fetchPerformanceData();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Failed to submit promotion recommendation.');
    }
  };

  const handleSubmitWarning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warningModal.member || !warningModal.subject.trim() || !warningModal.details.trim()) return;

    try {
      await issueFormalWarning({
        employeeId: warningModal.member._id,
        category: warningModal.category,
        severity: warningModal.severity,
        subject: warningModal.subject.trim(),
        details: warningModal.details.trim(),
        actionRequired: warningModal.actionRequired.trim() || undefined,
      }).unwrap();

      toast.success(
        `Formal warning issued to ${warningModal.member.profile?.fullName || 'staff'}.`
      );
      setWarningModal({
        open: false,
        member: null,
        category: 'Performance',
        severity: 'Written',
        subject: '',
        details: '',
        actionRequired: '',
      });
      fetchPerformanceData();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Failed to issue formal warning.');
    }
  };

  // KPI Computations
  const totalAssigned = staffPerformance.reduce((sum, s) => sum + s.assignedComplaints, 0);
  const totalCompleted = staffPerformance.reduce((sum, s) => sum + s.completedComplaints, 0);
  const totalPending = staffPerformance.reduce((sum, s) => sum + s.pendingComplaints, 0);
  const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

  // Filtered staff list (defensively ensuring no department head or self is shown)
  const filteredStaff = useMemo(() => {
    const regularStaff = staffPerformance.filter(
      (s) => s.role !== 'department_head' && s._id !== user?._id
    );
    if (!searchStaff.trim()) return regularStaff;
    const term = searchStaff.toLowerCase();
    return regularStaff.filter(
      (s) =>
        s.profile.fullName?.toLowerCase().includes(term) ||
        s.email?.toLowerCase().includes(term)
    );
  }, [staffPerformance, searchStaff, user?._id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader className="animate-spin h-10 w-10 mx-auto text-blue-600 mb-3" />
          <p className="text-sm font-medium text-slate-500">Loading department performance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-2xl p-6 text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 mb-1">Failed to Load Performance</h3>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Department Performance
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor operational efficiency, task completion rates, and staff capacity
        </p>
      </div>

      {/* 1. Clean 4-Column KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Assigned */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Assigned</p>
              <p className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">
                {totalAssigned}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 border border-blue-100">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Completed</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1 tracking-tight">
                {totalCompleted}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Pending</p>
              <p className="text-3xl font-bold text-amber-600 mt-1 tracking-tight">
                {totalPending}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600 border border-amber-100">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Completion Rate with Integrated Progress Bar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Completion Rate</p>
              <p className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">
                {completionRate}%
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-purple-50 text-purple-600 border border-purple-100">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3">
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  completionRate >= 80
                    ? 'bg-emerald-500'
                    : completionRate >= 50
                    ? 'bg-blue-500'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${Math.max(completionRate, 2)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Staff Performance Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm">
        {/* Table Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-t-2xl">
          <div>
            <h2 className="text-base font-bold text-slate-900">Staff Performance</h2>
            <p className="text-xs text-slate-500 mt-0.5">Breakdown by individual staff member</p>
          </div>

          {/* Compact Inline Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchStaff}
              onChange={(e) => setSearchStaff(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs sm:text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400 font-medium"
            />
          </div>
        </div>

        {/* Responsive Table Container (visible overflow so floating 3-dot menus are never clipped) */}
        <div className="overflow-x-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3.5">Staff Member</th>
                <th className="px-4 py-3.5 text-center">Assigned</th>
                <th className="px-4 py-3.5 text-center">Completed</th>
                <th className="px-4 py-3.5 text-center">Pending</th>
                <th className="px-6 py-3.5 text-center">Efficiency</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStaff.length > 0 ? (
                filteredStaff.map((staff) => {
                  const efficiency =
                    staff.assignedComplaints > 0
                      ? Math.round((staff.completedComplaints / staff.assignedComplaints) * 100)
                      : 0;

                  const isOwnRow = user?._id === staff._id || staff.role === 'department_head';
                  const isMenuOpen = activeMenuId === staff._id;
                  const nextRank = RANK_HIERARCHY[(staff.rank || 'junior').toLowerCase()];

                  return (
                    <tr
                      key={staff._id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Staff Member Column */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={staff.profile.fullName}
                            src={staff.profile.profileImage || staff.profile.avatar}
                            size="md"
                            className="w-10 h-10 text-xs shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-semibold text-slate-900 truncate">
                                {staff.profile.fullName}
                              </p>
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 capitalize">
                                {formatRankLabel(staff.rank)}
                              </span>
                            </div>
                            {staff.email && (
                              <p className="text-xs text-slate-500 truncate">{staff.email}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Assigned Column */}
                      <td className="px-4 py-3.5 text-center tabular-nums font-semibold text-slate-900">
                        {staff.assignedComplaints}
                      </td>

                      {/* Completed Column */}
                      <td className="px-4 py-3.5 text-center tabular-nums font-semibold text-emerald-600">
                        {staff.completedComplaints}
                      </td>

                      {/* Pending Column */}
                      <td className="px-4 py-3.5 text-center tabular-nums font-semibold text-amber-600">
                        {staff.pendingComplaints}
                      </td>

                      {/* Efficiency Column */}
                      <td className="px-6 py-3.5 text-center">
                        {staff.assignedComplaints === 0 ? (
                          <span className="text-xs text-slate-400 font-medium">No tasks</span>
                        ) : (
                          <div className="inline-flex items-center gap-3 justify-center">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className={`h-full rounded-full ${
                                  efficiency >= 80
                                    ? 'bg-emerald-500'
                                    : efficiency >= 50
                                    ? 'bg-blue-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.max(efficiency, 2)}%` }}
                              ></div>
                            </div>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                efficiency >= 80
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                                    : efficiency >= 50
                                    ? 'bg-blue-50 text-blue-700 border-blue-200/70'
                                    : 'bg-rose-50 text-rose-700 border-rose-200/70'
                              }`}
                            >
                              {efficiency}%
                            </span>
                          </div>
                        )}
                      </td>

                      {/* ACTIONS Column (right-aligned, sleek 3-dot dropdown) */}
                      <td className="px-6 py-3.5 text-right">
                        {!isOwnRow ? (
                          <div
                            className="relative inline-block text-left"
                            ref={isMenuOpen ? menuRef : undefined}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(isMenuOpen ? null : staff._id);
                              }}
                              aria-label={`Actions for ${staff.profile.fullName}`}
                              className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {isMenuOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 bottom-full mb-1 sm:bottom-auto sm:top-full sm:mt-1 w-52 rounded-xl bg-white shadow-lg border border-slate-200/80 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-left"
                              >
                                {/* 1. Recommend for Promotion */}
                                {nextRank ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPromoModal(staff)}
                                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Award className="w-4 h-4 text-blue-600" />
                                    <span>Recommend for Promotion</span>
                                  </button>
                                ) : (
                                  <div className="px-3.5 py-1.5 text-[11px] text-slate-400 italic">
                                    Highest rank attained ({formatRankLabel(staff.rank)})
                                  </div>
                                )}

                                <div className="my-1 border-t border-slate-100" />

                                {/* 2. Issue Warning */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenWarningModal(staff)}
                                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                                  <span>Issue Warning</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Department Head</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-700">No staff members found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {searchStaff ? 'Try adjusting your search query' : 'No staff members assigned to this department yet'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: RECOMMEND FOR PROMOTION */}
      {promoModal.open && promoModal.member && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Recommend for Promotion</h3>
                  <p className="text-xs text-gray-500">Submit an executive promotion recommendation to Administration</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPromoModal({ open: false, member: null, nextRank: '', reason: '' })}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Staff Member:</span>
                <span className="font-semibold text-slate-800">
                  {promoModal.member.profile?.fullName || promoModal.member.email}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Current Rank:</span>
                <span className="font-semibold text-slate-700 capitalize">
                  {formatRankLabel(promoModal.member.rank)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Proposed Next Rank:</span>
                <span className="font-bold text-blue-600 capitalize">
                  {formatRankLabel(promoModal.nextRank)}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmitPromotion} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Justification & Recommendation Remarks <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                  rows={4}
                  placeholder="Outline this staff member's efficiency, resolution volume, leadership traits, or reason for promotion..."
                  value={promoModal.reason}
                  onChange={(e) => setPromoModal((prev) => ({ ...prev, reason: e.target.value }))}
                  required
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPromoModal({ open: false, member: null, nextRank: '', reason: '' })}
                  disabled={submittingPromo}
                  className="h-9 px-4 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPromo || !promoModal.reason.trim()}
                  className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-xs disabled:opacity-50 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {submittingPromo && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Submit Recommendation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ISSUE WARNING */}
      {warningModal.open && warningModal.member && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Issue Warning Notice</h3>
                  <p className="text-xs text-gray-500">Official notice will be delivered directly to the staff member's record & email</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWarningModal((prev) => ({ ...prev, open: false, member: null }))}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl text-xs space-y-1">
              <p className="text-rose-900 font-semibold">
                Recipient: {warningModal.member.profile?.fullName || warningModal.member.email}
              </p>
            </div>

            <form onSubmit={handleSubmitWarning} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Subject / Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:border-blue-500"
                    value={warningModal.category}
                    onChange={(e) => setWarningModal((prev) => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="Performance">Performance Deficiencies</option>
                    <option value="Attendance">Attendance / Punctuality</option>
                    <option value="SLA Breach">Repeated SLA Breaches</option>
                    <option value="Misconduct">Misconduct / Unprofessional Behavior</option>
                    <option value="Insubordination">Insubordination</option>
                    <option value="Policy Breach">Policy Violation</option>
                    <option value="Other">Other Operational Concern</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Notice Severity <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:border-blue-500"
                    value={warningModal.severity}
                    onChange={(e) => setWarningModal((prev) => ({ ...prev, severity: e.target.value }))}
                  >
                    <option value="Verbal">Verbal Warning (Recorded)</option>
                    <option value="Written">Formal Written Warning</option>
                    <option value="Final">Final Warning Notice</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Subject Headline <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Failure to comply with ticket resolution SLA deadlines"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                  value={warningModal.subject}
                  onChange={(e) => setWarningModal((prev) => ({ ...prev, subject: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Factual Details & Evidence <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                  rows={3}
                  placeholder="Provide precise dates, complaint IDs, or incidents prompting this notice..."
                  value={warningModal.details}
                  onChange={(e) => setWarningModal((prev) => ({ ...prev, details: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Corrective Action Expected (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bring response efficiency above 85% within 14 calendar days"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                  value={warningModal.actionRequired}
                  onChange={(e) => setWarningModal((prev) => ({ ...prev, actionRequired: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setWarningModal((prev) => ({ ...prev, open: false, member: null }))}
                  disabled={issuingWarning}
                  className="h-9 px-4 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={issuingWarning || !warningModal.subject.trim() || !warningModal.details.trim()}
                  className="h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium shadow-xs disabled:opacity-50 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {issuingWarning && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Issue Warning</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentPerformancePage;
