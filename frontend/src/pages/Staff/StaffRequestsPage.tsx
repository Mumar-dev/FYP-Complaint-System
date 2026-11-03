import React, { useState, useMemo, useRef } from 'react';
import Card from '@components/Common/Card';
import Button from '@components/Common/Button';
import {
  FileText,
  CalendarDays,
  Plus,
  Loader2,
  X,
  ChevronDown,
  UploadCloud,
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import {
  useGetMyLeaveBalancesQuery,
  useGetLeaveTypesQuery,
  useGetAllLeaveRequestsQuery,
  useApplyLeaveMutation,
  useGetAllPromotionRequestsQuery,
  useRequestPromotionMutation
} from '@/features/hr/hr.api';
import { useAuth } from '@hooks/useAuth';
import toast from 'react-hot-toast';

const RANK_HIERARCHY: Record<string, string> = {
  junior: 'standard',
  standard: 'senior',
  senior: 'team_lead',
  team_lead: 'supervisor'
};

const formatRankLabel = (r?: string) => {
  if (!r) return 'Staff';
  if (r === 'team_lead') return 'Team Lead';
  return r.charAt(0).toUpperCase() + r.slice(1);
};

export const StaffRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'leaves' | 'promotions'>('leaves');

  // --- Leaves State & Queries ---
  const { data: leaveBalancesData, refetch: refetchBalances } = useGetMyLeaveBalancesQuery();
  const { data: leaveTypesData } = useGetLeaveTypesQuery();
  const { data: leaveRequestsData, isLoading: leaveRequestsLoading, refetch: refetchRequests } = useGetAllLeaveRequestsQuery();
  const [applyLeave, { isLoading: applyingLeave }] = useApplyLeaveMutation();

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Promotions State & Queries ---
  const { data: promoData, isLoading: promoLoading, refetch: refetchPromos } = useGetAllPromotionRequestsQuery();
  const [requestPromotion, { isLoading: submittingPromo }] = useRequestPromotionMutation();

  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoReason, setPromoReason] = useState('');

  const currentRank = (user?.rank || 'junior').toLowerCase();
  const nextRank = RANK_HIERARCHY[currentRank] || '';

  // Leave Balances and Helpers
  const leaveBalances = leaveBalancesData?.data || [];
  const leaveRequests = (leaveRequestsData?.data as any[]) || [];
  const rawTypes = leaveTypesData?.data || [];

  const availableLeaveTypes = useMemo(() => {
    if (rawTypes && rawTypes.length > 0) return rawTypes;
    return [
      { _id: '65f000000000000000000001', name: 'Annual Paid Leave', code: 'ANNUAL' },
      { _id: '65f000000000000000000002', name: 'Medical / Sick Leave', code: 'SICK' },
      { _id: '65f000000000000000000003', name: 'Casual / Emergency Leave', code: 'CASUAL' }
    ];
  }, [rawTypes]);

  const activeLeaveTypeId = leaveTypeId || (availableLeaveTypes[0]?._id ?? '');

  const { currentTypeName, currentTypeRemaining, currentTypeTotal } = useMemo(() => {
    const selectedTypeObj = availableLeaveTypes.find((t: any) => t._id === activeLeaveTypeId);
    const typeName = selectedTypeObj?.name || 'Leave';

    const balanceObj = leaveBalances.find(
      (b: any) => b.leaveTypeId?._id === activeLeaveTypeId || b.leaveTypeId === activeLeaveTypeId
    );

    const remaining = balanceObj?.remainingDays ?? balanceObj?.balanceDays ?? 0;
    const total = balanceObj?.totalAllocated ?? balanceObj?.allocatedDays ?? 0;

    return {
      currentTypeName: typeName,
      currentTypeRemaining: remaining,
      currentTypeTotal: total
    };
  }, [availableLeaveTypes, activeLeaveTypeId, leaveBalances]);

  const requestedDays = useMemo(() => {
    if (!leaveStartDate || !leaveEndDate) return 0;
    const s = new Date(leaveStartDate);
    const e = new Date(leaveEndDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
    const diffTime = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [leaveStartDate, leaveEndDate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        setFilePreview(URL.createObjectURL(file));
      } else {
        setFilePreview(null);
      }
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetLeaveForm = () => {
    setLeaveTypeId('');
    setLeaveStartDate('');
    setLeaveEndDate('');
    setLeaveReason('');
    removeSelectedFile();
    setShowLeaveModal(false);
  };

  const handleApplyLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStartDate || !leaveEndDate || !leaveReason) {
      toast.error('Please complete all mandatory leave fields');
      return;
    }

    const effectiveTypeId = leaveTypeId || availableLeaveTypes[0]?._id;
    if (!effectiveTypeId) {
      toast.error('Please select a valid leave type');
      return;
    }

    try {
      if (selectedFile) {
        const formData = new FormData();
        formData.append('leaveTypeId', effectiveTypeId);
        formData.append('startDate', leaveStartDate);
        formData.append('endDate', leaveEndDate);
        formData.append('reason', leaveReason);
        formData.append('document', selectedFile);
        await applyLeave(formData).unwrap();
      } else {
        await applyLeave({
          leaveTypeId: effectiveTypeId,
          startDate: leaveStartDate,
          endDate: leaveEndDate,
          reason: leaveReason
        }).unwrap();
      }

      toast.success('Leave application submitted for approval');
      resetLeaveForm();
      refetchRequests();
      refetchBalances();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Leave application failed');
    }
  };

  const handleApplyPromotionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoReason.trim()) {
      toast.error('Please provide a reason or justification for your promotion request.');
      return;
    }

    try {
      await requestPromotion({
        employeeId: user?._id,
        requestedRank: nextRank,
        requestedDesignation: user?.profile?.position || formatRankLabel(nextRank),
        proposedDepartmentId: user?.departmentId,
        requestType: 'self',
        justification: promoReason.trim()
      }).unwrap();

      toast.success('Promotion request submitted to your Department Head!');
      setShowPromoModal(false);
      setPromoReason('');
      refetchPromos();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Failed to submit promotion request');
    }
  };

  const formatLeaveDateRange = (startDate?: string, endDate?: string, totalDays?: number) => {
    if (!startDate) return { range: '--', daysCount: 0 };
    try {
      const s = new Date(startDate);
      const e = endDate ? new Date(endDate) : s;
      const sStr = s.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const eStr = e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const range = sStr === eStr ? sStr : `${sStr} - ${eStr}`;
      const daysCount = totalDays || (Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      return { range, daysCount };
    } catch {
      return { range: `${startDate} - ${endDate}`, daysCount: totalDays || 1 };
    }
  };

  const getLeaveStatusBadge = (status?: string) => {
    const s = (status || 'PENDING').toUpperCase();
    if (s === 'APPROVED') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
          Approved
        </span>
      );
    }
    if (s === 'REJECTED') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/70">
          Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/70">
        Pending
      </span>
    );
  };

  const getPromoStatusBadge = (status?: string) => {
    const s = (status || 'PENDING').toUpperCase();
    if (s === 'APPROVED') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Approved
        </span>
      );
    }
    if (s === 'REJECTED') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
          Rejected
        </span>
      );
    }
    if (s === 'PENDING_ADMIN') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
          Forwarded to Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
        Pending Dept Head
      </span>
    );
  };

  const promoList = promoData?.data || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 animate-in fade-in duration-300">
      {/* 1. Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Requests</h1>
        <p className="text-sm text-slate-500 mt-1">
          Submit and track your formal leave applications and rank promotion requests.
        </p>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('leaves')}
            className={`py-3.5 px-1 border-b-2 font-medium text-sm flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'leaves'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Leave Requests & Balances</span>
          </button>
          <button
            onClick={() => setActiveTab('promotions')}
            className={`py-3.5 px-1 border-b-2 font-medium text-sm flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'promotions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Promotion Requests</span>
          </button>
        </nav>
      </div>

      {/* TAB 1: LEAVE REQUESTS */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Leave History</h3>
              <p className="text-xs text-slate-500 mt-0.5">View your past and pending leave applications.</p>
            </div>
            <button
              onClick={() => setShowLeaveModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-all self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Apply for Leave</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/75 border-b border-slate-100 text-xs uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-6 py-3.5">Leave Type</th>
                    <th className="px-6 py-3.5">Dates</th>
                    <th className="px-6 py-3.5">Reason</th>
                    <th className="px-6 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaveRequestsLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          <span>Loading leave requests...</span>
                        </div>
                      </td>
                    </tr>
                  ) : leaveRequests.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                        <div className="max-w-sm mx-auto space-y-2">
                          <p className="text-sm text-slate-600 font-medium">No leave requests yet.</p>
                          <p className="text-xs text-slate-400">
                            Click <strong className="text-slate-600 font-semibold">"Apply for Leave"</strong> to submit one.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    leaveRequests.map((req: any) => {
                      const typeName = req.leaveTypeId?.name || req.leaveType?.name || 'Leave';
                      const { range, daysCount } = formatLeaveDateRange(req.startDate, req.endDate, req.totalDays);
                      return (
                        <tr key={req._id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-semibold text-slate-900">{typeName}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-slate-900 font-medium">{range}</div>
                            <span className="text-xs text-slate-400">{daysCount} day{daysCount > 1 ? 's' : ''}</span>
                          </td>
                          <td className="px-6 py-4 max-w-xs">
                            <p className="line-clamp-2 text-slate-600 text-xs sm:text-sm" title={req.reason}>
                              {req.reason || '—'}
                            </p>
                            {req.rejectionReason && (
                              <p className="text-xs text-rose-600 mt-1">
                                <strong>Supervisor note:</strong> {req.rejectionReason}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getLeaveStatusBadge(req.status)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROMOTION REQUESTS */}
      {activeTab === 'promotions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Rank Progression</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Current Rank: <span className="font-semibold text-slate-800 capitalize">{formatRankLabel(currentRank)}</span>
                {nextRank && (
                  <span> &bull; Next Eligible Rank: <span className="font-semibold text-blue-600 capitalize">{formatRankLabel(nextRank)}</span></span>
                )}
              </p>
            </div>
            {nextRank ? (
              <button
                onClick={() => setShowPromoModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-all self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Request Promotion</span>
              </button>
            ) : (
              <div className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold">
                Highest Rank Attained
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/75 border-b border-slate-100 text-xs uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-6 py-3.5">Rank Requested</th>
                    <th className="px-6 py-3.5">Date Submitted</th>
                    <th className="px-6 py-3.5">Justification</th>
                    <th className="px-6 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {promoLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          <span>Loading promotion requests...</span>
                        </div>
                      </td>
                    </tr>
                  ) : promoList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                        <div className="max-w-sm mx-auto space-y-2">
                          <p className="text-sm text-slate-600 font-medium">No promotion requests submitted yet.</p>
                          <p className="text-xs text-slate-400">
                            {nextRank ? 'Click "Request Promotion" to submit a case to your Department Head.' : 'You are currently at the highest rank tier.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    promoList.map((req: any) => {
                      const reqRank = req.requestedRank || req.requestedDesignation;
                      const dateStr = new Date(req.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      });

                      return (
                        <tr key={req._id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800 capitalize">
                                {formatRankLabel(req.currentRank || currentRank)}
                              </span>
                              <span className="text-blue-600 font-bold">&rarr;</span>
                              <span className="font-bold text-blue-600 capitalize">
                                {formatRankLabel(reqRank)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                            {dateStr}
                          </td>
                          <td className="px-6 py-4 max-w-sm">
                            <p className="text-xs sm:text-sm text-slate-700 line-clamp-2">
                              {req.justification}
                            </p>
                            {req.rejectionReason && (
                              <p className="text-xs text-red-600 mt-1">
                                <strong>Feedback:</strong> {req.rejectionReason}
                              </p>
                            )}
                            {req.deptHeadRemarks && (
                              <p className="text-xs text-blue-600 mt-1">
                                <strong>Dept Head Note:</strong> {req.deptHeadRemarks}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getPromoStatusBadge(req.status)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: APPLY FOR LEAVE */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Apply for Leave</h3>
                <p className="text-xs text-slate-500 mt-0.5">Submit a new leave request for approval</p>
              </div>
              <button
                type="button"
                onClick={resetLeaveForm}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyLeaveSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">
                    Leave Type <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={activeLeaveTypeId}
                      onChange={(e) => setLeaveTypeId(e.target.value)}
                      className="w-full appearance-none px-3.5 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                      required
                    >
                      {availableLeaveTypes.map((type: any) => (
                        <option key={type._id} value={type._id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      From Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={leaveStartDate}
                      onChange={(e) => setLeaveStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      To Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={leaveEndDate}
                      onChange={(e) => setLeaveEndDate(e.target.value)}
                      min={leaveStartDate || undefined}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                      required
                    />
                  </div>
                </div>

                <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Requested Days:</span>
                    <span className="font-bold text-slate-900 whitespace-nowrap">{requestedDays} Days</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="truncate pr-2">Total Balance ({currentTypeName}):</span>
                    <span className="font-bold text-slate-900 whitespace-nowrap">{currentTypeTotal} Days</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="truncate pr-2">Remaining Balance ({currentTypeName}):</span>
                    <span className="font-bold text-blue-600 whitespace-nowrap">{currentTypeRemaining} Days</span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">
                    Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Briefly explain the reason for your leave..."
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">
                    Attach File <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {!selectedFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl px-4 py-3 flex items-center justify-center gap-2.5 cursor-pointer transition-colors bg-slate-50/50 hover:bg-blue-50/20"
                    >
                      <UploadCloud className="w-5 h-5 text-slate-400 shrink-0" />
                      <p className="text-xs text-slate-600">
                        <strong className="font-medium text-slate-800">Upload document or photo</strong>{' '}
                        <span className="text-slate-400">(PNG, JPG, PDF)</span>
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center gap-3 overflow-hidden">
                        {filePreview ? (
                          <img
                            src={filePreview}
                            alt="Preview"
                            className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                        )}
                        <div className="truncate">
                          <p className="text-xs font-medium text-slate-900 truncate">{selectedFile.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {(selectedFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeSelectedFile}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50 rounded-b-2xl shrink-0">
                <button
                  type="button"
                  onClick={resetLeaveForm}
                  className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applyingLeave}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer inline-flex items-center gap-2"
                >
                  {applyingLeave && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Submit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REQUEST PROMOTION */}
      {showPromoModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200/80 animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Request Rank Promotion</h3>
                  <p className="text-xs text-slate-500">Submit a formal case to your Department Head</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPromoModal(false);
                  setPromoReason('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Rank progression display */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Applicant:</span>
                <span className="font-bold text-slate-800">{user?.profile?.fullName || user?.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Current Rank:</span>
                <span className="font-semibold text-slate-700 capitalize">{formatRankLabel(currentRank)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Target Rank:</span>
                <span className="font-bold text-blue-600 capitalize">{formatRankLabel(nextRank)}</span>
              </div>
            </div>

            <form onSubmit={handleApplyPromotionSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Justification & Achievements <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Outline your recent performance, completed complaints, SLA compliance, or leadership responsibilities..."
                  value={promoReason}
                  onChange={(e) => setPromoReason(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPromoModal(false);
                    setPromoReason('');
                  }}
                  disabled={submittingPromo}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPromo || !promoReason.trim()}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {submittingPromo && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffRequestsPage;
