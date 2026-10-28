import React, { useState, useEffect, useRef } from 'react';
import Card from '@components/Common/Card';
import Button from '@components/Common/Button';
import { UserAvatar } from '@components/Common';
import {
  Users,
  Calendar,
  Clock,
  Award,
  AlertOctagon,
  Plus,
  Trash2,
  X,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  MoreVertical,
  ShieldAlert,
  UserCheck,
  Check,
  FileText,
  CalendarDays,
  Info,
  Image as ImageIcon,
  Search,
  ChevronDown,
  UploadCloud,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '@hooks/useAuth';
import {
  useGetHRDashboardStatsQuery,
  useGetEmployeesQuery,
  useGetShiftsQuery,
  useCreateShiftMutation,
  useDeleteShiftMutation,
  useUpdateEmploymentStatusMutation,
  useGetAllPromotionRequestsQuery,
  useReviewPromotionMutation,
  useGetFormalWarningsQuery,
  useIssueFormalWarningMutation
} from '@/features/hr/hr.api';
import toast from 'react-hot-toast';

const AdminHRManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'employees' | 'shifts' | 'promotions' | 'disciplinary'>('employees');
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  // Close action dropdown on outside click or Escape
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setOpenActionMenuId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Stats
  const { data: statsData, refetch: refetchStats } = useGetHRDashboardStatsQuery();
  const stats = statsData?.data;

  // Data Queries
  const { data: employeesData, refetch: refetchEmployees } = useGetEmployeesQuery();
  const { data: shiftsData, refetch: refetchShifts } = useGetShiftsQuery();
  const { data: promotionsData, isLoading: loadingPromotions, refetch: refetchPromotions } = useGetAllPromotionRequestsQuery();
  const { data: warningsData, isLoading: loadingWarnings, refetch: refetchWarnings } = useGetFormalWarningsQuery();

  // Promotions tab filter state
  const [promoFilter, setPromoFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [rejectPromoModal, setRejectPromoModal] = useState<{ open: boolean; requestId: string; staffName: string; reason: string }>({
    open: false,
    requestId: '',
    staffName: '',
    reason: ''
  });

  // Mutations
  const [createShift, { isLoading: creatingShift }] = useCreateShiftMutation();
  const [deleteShift, { isLoading: deletingShift }] = useDeleteShiftMutation();
  const [updateEmploymentStatus, { isLoading: updatingStatus }] = useUpdateEmploymentStatusMutation();
  const [reviewPromotion, { isLoading: reviewingPromotion }] = useReviewPromotionMutation();
  const [issueFormalWarning, { isLoading: issuingWarning }] = useIssueFormalWarningMutation();

  // Filter state
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  // Status Change Confirmation Modal
  const [statusConfirmModal, setStatusConfirmModal] = useState<{
    open: boolean;
    employee: any;
    newStatus: string;
    reason: string;
  }>({
    open: false,
    employee: null,
    newStatus: '',
    reason: '',
  });

  // Delete Shift Confirmation Modal
  const [deleteShiftModal, setDeleteShiftModal] = useState<{
    open: boolean;
    shift: any;
  }>({
    open: false,
    shift: null,
  });

  // Leave Details Modal
  const [leaveDetailsModal, setLeaveDetailsModal] = useState<{
    open: boolean;
    employee: any | null;
  }>({
    open: false,
    employee: null,
  });

  // Modal states
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftName, setShiftName] = useState('');
  const [shiftCode, setShiftCode] = useState('');
  const [shiftStart, setShiftStart] = useState('08:00');
  const [shiftEnd, setShiftEnd] = useState('16:00');

  // Issue Warning Modal State
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningEmpId, setWarningEmpId] = useState('');
  const [warningEmpSearch, setWarningEmpSearch] = useState('');
  const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);
  const empDropdownRef = useRef<HTMLDivElement | null>(null);
  const [warningCategory, setWarningCategory] = useState('Attendance & Punctuality');
  const [warningSeverity, setWarningSeverity] = useState('Formal Written Warning');
  const [warningSubject, setWarningSubject] = useState('');
  const [warningDetails, setWarningDetails] = useState('');
  const [warningActionRequired, setWarningActionRequired] = useState('');
  const [warningEvidenceFile, setWarningEvidenceFile] = useState<File | null>(null);
  const [warningEvidencePreview, setWarningEvidencePreview] = useState<string | null>(null);

  // Close employee picker dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (empDropdownRef.current && !empDropdownRef.current.contains(e.target as Node)) {
        setIsEmpDropdownOpen(false);
      }
    };
    if (isEmpDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isEmpDropdownOpen]);

  // Evidence Preview Modal State
  const [previewEvidenceUrl, setPreviewEvidenceUrl] = useState<string | null>(null);

  const handleEvidenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file (PNG, JPG, JPEG, WEBP).');
        return;
      }
      setWarningEvidenceFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setWarningEvidencePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetWarningForm = () => {
    setShowWarningModal(false);
    setWarningEmpId('');
    setWarningEmpSearch('');
    setIsEmpDropdownOpen(false);
    setWarningCategory('Attendance & Punctuality');
    setWarningSeverity('Formal Written Warning');
    setWarningSubject('');
    setWarningDetails('');
    setWarningActionRequired('');
    setWarningEvidenceFile(null);
    setWarningEvidencePreview(null);
  };

  const handleIssueWarningSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warningEmpId) {
      toast.error('Please select an employee');
      return;
    }
    if (!warningSubject.trim() || !warningDetails.trim()) {
      toast.error('Subject and Details are required');
      return;
    }

    try {
      // Map frontend warning type to backend severity
      let backendSeverity = 'Written';
      if (warningSeverity === 'Verbal Warning') backendSeverity = 'Verbal';
      else if (warningSeverity === 'Final Warning') backendSeverity = 'Final';

      let backendCategory = 'Performance';
      if (warningCategory.includes('Attendance')) backendCategory = 'Attendance';
      else if (warningCategory.includes('Misconduct')) backendCategory = 'Misconduct';
      else if (warningCategory.includes('SLA')) backendCategory = 'SLA Breach';
      else if (warningCategory.includes('Policy')) backendCategory = 'Policy Breach';
      else if (warningCategory.includes('Other')) backendCategory = 'Other';

      if (warningEvidenceFile) {
        const formData = new FormData();
        formData.append('employeeId', warningEmpId);
        formData.append('category', backendCategory);
        formData.append('severity', backendSeverity);
        formData.append('subject', warningSubject.trim());
        formData.append('details', warningDetails.trim());
        if (warningActionRequired.trim()) {
          formData.append('actionRequired', warningActionRequired.trim());
        }
        formData.append('evidence', warningEvidenceFile);

        await issueFormalWarning(formData).unwrap();
      } else {
        await issueFormalWarning({
          employeeId: warningEmpId,
          category: backendCategory,
          severity: backendSeverity,
          subject: warningSubject.trim(),
          details: warningDetails.trim(),
          actionRequired: warningActionRequired.trim() || undefined,
        }).unwrap();
      }

      toast.success('Formal warning letter issued successfully');
      resetWarningForm();
      refetchWarnings();
    } catch (err: any) {
      console.error('[Issue Warning Error]:', err);
      const serverMsg = err?.data?.message || err?.message || 'Failed to issue formal warning letter';
      toast.error(serverMsg);
    }
  };

  const handleCreateShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createShift({
        name: shiftName,
        code: shiftCode,
        startTime: shiftStart,
        endTime: shiftEnd,
        gracePeriodMinutes: 15,
      }).unwrap();
      toast.success('Shift template configured');
      setShowShiftModal(false);
      setShiftName('');
      setShiftCode('');
      refetchShifts();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Shift creation failed');
    }
  };

  const handleDeleteShift = async () => {
    if (!deleteShiftModal.shift) return;
    try {
      await deleteShift(deleteShiftModal.shift._id).unwrap();
      toast.success(`Shift "${deleteShiftModal.shift.name}" deleted successfully`);
      setDeleteShiftModal({ open: false, shift: null });
      refetchShifts();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to delete shift');
    }
  };

  const handleStatusSelectChange = (emp: any, newStatus: string) => {
    if (newStatus === emp.employmentStatus) return;
    if (['SUSPENDED', 'TERMINATED', 'RESIGNED'].includes(newStatus)) {
      setStatusConfirmModal({
        open: true,
        employee: emp,
        newStatus,
        reason: '',
      });
    } else {
      executeStatusChange(emp, newStatus, `Status updated to ${newStatus} by administrator`);
    }
  };

  const executeStatusChange = async (emp: any, newStatus: string, reason: string) => {
    try {
      await updateEmploymentStatus({
        id: emp._id,
        status: newStatus,
        reason: reason.trim() || `Status updated to ${newStatus} by administrator`,
      }).unwrap();
      toast.success(`Employee status updated to ${newStatus}`);
      setStatusConfirmModal({ open: false, employee: null, newStatus: '', reason: '' });
      refetchEmployees();
      refetchStats();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to update employee status');
    }
  };

  const rawEmpData: any = employeesData?.data;
  const employees: any[] = Array.isArray(rawEmpData)
    ? rawEmpData
    : Array.isArray(rawEmpData?.employees)
    ? rawEmpData.employees
    : Array.isArray(employeesData)
    ? (employeesData as any)
    : [];

  const rawShiftsData: any = shiftsData?.data;
  const shifts: any[] = Array.isArray(rawShiftsData)
    ? rawShiftsData
    : Array.isArray(rawShiftsData?.shifts)
    ? rawShiftsData.shifts
    : Array.isArray(shiftsData)
    ? (shiftsData as any)
    : [];

  // Derive status counts and workforce metrics from the identical employees dataset
  const totalWorkforceCount = employees.length;
  const activeWorkforceCount = employees.filter(e => (e.employmentStatus || e.accountStatus?.toUpperCase()) === 'ACTIVE').length;
  const onLeaveWorkforceCount = employees.filter(e => (e.employmentStatus || e.accountStatus?.toUpperCase()) === 'ON_LEAVE').length;
  const suspendedWorkforceCount = employees.filter(e => (e.employmentStatus || e.accountStatus?.toUpperCase()) === 'SUSPENDED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Workforce Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Society-wide workforce roster, shifts, attendance, promotions, transfers, and disciplinary actions.
          </p>
        </div>
      </div>

      {/* KPI Cards - Always exactly 100% synchronized with Workforce Directory */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-blue-50/50 border-blue-200">
          <p className="text-xs font-semibold text-blue-600 uppercase">Total Workforce</p>
          <p className="text-2xl font-black text-blue-900 mt-1">{totalWorkforceCount}</p>
        </Card>
        <Card className="p-4 bg-emerald-50/50 border-emerald-200">
          <p className="text-xs font-semibold text-emerald-600 uppercase">Active Workforce</p>
          <p className="text-2xl font-black text-emerald-900 mt-1">{activeWorkforceCount}</p>
        </Card>
        <Card className="p-4 bg-amber-50/50 border-amber-200">
          <p className="text-xs font-semibold text-amber-600 uppercase">On Leave</p>
          <p className="text-2xl font-black text-amber-900 mt-1">{onLeaveWorkforceCount}</p>
        </Card>
        <Card className="p-4 bg-purple-50/50 border-purple-200">
          <p className="text-xs font-semibold text-purple-600 uppercase">Suspended</p>
          <p className="text-2xl font-black text-purple-900 mt-1">{suspendedWorkforceCount}</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 space-x-6 overflow-x-auto">
        {[
          { key: 'employees', label: 'Employees', icon: <Users className="w-4 h-4" /> },
          { key: 'shifts', label: 'Shifts & Rosters', icon: <Calendar className="w-4 h-4" /> },
          { key: 'promotions', label: 'Promotions', icon: <Award className="w-4 h-4" /> },
          { key: 'disciplinary', label: 'Disciplinary', icon: <AlertOctagon className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: EMPLOYEES */}
      {activeTab === 'employees' && (() => {
        const statusCounts = {
          ALL: employees.length,
          ACTIVE: employees.filter(e => (e.employmentStatus || e.accountStatus?.toUpperCase()) === 'ACTIVE').length,
          ON_LEAVE: employees.filter(e => (e.employmentStatus || e.accountStatus?.toUpperCase()) === 'ON_LEAVE').length,
          SUSPENDED: employees.filter(e => (e.employmentStatus || e.accountStatus?.toUpperCase()) === 'SUSPENDED').length,
          TERMINATED: employees.filter(e => (e.employmentStatus || e.accountStatus?.toUpperCase()) === 'TERMINATED').length,
          RESIGNED: employees.filter(e => (e.employmentStatus || e.accountStatus?.toUpperCase()) === 'RESIGNED').length,
          INACTIVE: employees.filter(e => (e.employmentStatus || e.accountStatus?.toUpperCase()) === 'INACTIVE').length,
        };

        const filteredEmployees = employees.filter(emp => {
          if (selectedStatusFilter === 'ALL') return true;
          const status = emp.employmentStatus || emp.accountStatus?.toUpperCase() || 'ACTIVE';
          return status === selectedStatusFilter;
        });

        const filterPills = [
          { key: 'ALL', label: 'All', count: statusCounts.ALL },
          { key: 'ACTIVE', label: 'Active', count: statusCounts.ACTIVE },
          { key: 'ON_LEAVE', label: 'On Leave', count: statusCounts.ON_LEAVE },
          { key: 'SUSPENDED', label: 'Suspended', count: statusCounts.SUSPENDED },
          { key: 'TERMINATED', label: 'Terminated', count: statusCounts.TERMINATED },
          { key: 'RESIGNED', label: 'Resigned', count: statusCounts.RESIGNED },
          { key: 'INACTIVE', label: 'Inactive', count: statusCounts.INACTIVE },
        ].filter(p => p.key === 'ALL' || p.count > 0 || ['ACTIVE', 'ON_LEAVE', 'SUSPENDED'].includes(p.key));

        const getStatusBadgeClass = (status: string) => {
          switch (status) {
            case 'ACTIVE':
              return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
            case 'ON_LEAVE':
              return 'bg-amber-50 text-amber-700 border border-amber-200/80';
            case 'SUSPENDED':
              return 'bg-purple-50 text-purple-700 border border-purple-200/80';
            case 'TERMINATED':
              return 'bg-red-50 text-red-700 border border-red-200/80';
            case 'RESIGNED':
              return 'bg-slate-100 text-slate-700 border border-slate-200';
            default:
              return 'bg-gray-100 text-gray-700 border border-gray-200';
          }
        };

        return (
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Workforce Directory</h3>
                <p className="text-xs text-gray-500 mt-0.5">Manage employee employment statuses, positions, and accounts</p>
              </div>

              {/* Status Filter Bar */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {filterPills.map((pill) => {
                  const isSelected = selectedStatusFilter === pill.key;
                  return (
                    <button
                      key={pill.key}
                      onClick={() => setSelectedStatusFilter(pill.key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                      }`}
                    >
                      <span>{pill.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isSelected ? 'bg-blue-700/60 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {pill.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase bg-gray-50">
                    <th className="py-3 px-4 font-semibold">Employee</th>
                    <th className="py-3 px-4 font-semibold">Department</th>
                    <th className="py-3 px-4 font-semibold">Designation</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Joining Date</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-gray-400">
                        No employees found matching the "{selectedStatusFilter}" filter.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const empName = emp.profile?.fullName || emp.name || emp.email;
                      const deptName = emp.departmentId?.name || emp.department?.name || 'General';
                      const designationName = emp.profile?.position || emp.designation || 'Staff';
                      const currentStatus = emp.employmentStatus || emp.accountStatus?.toUpperCase() || 'ACTIVE';

                      return (
                        <tr key={emp._id} className="hover:bg-gray-50/50">
                          <td className="py-3 px-4">
                            <p className="font-bold text-gray-900">{empName}</p>
                            <p className="text-xs text-gray-500">{emp.email}</p>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{deptName}</td>
                          <td className="py-3 px-4 text-gray-600">{designationName}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(currentStatus)}`}>
                              {currentStatus.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {emp.joiningDate
                              ? new Date(emp.joiningDate).toLocaleDateString()
                              : emp.createdAt
                              ? new Date(emp.createdAt).toLocaleDateString()
                              : 'Active'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {(() => {
                              const empUserId = emp.userId?._id || emp.userId || emp._id;
                              const isSelf = currentUser && (currentUser._id === empUserId || currentUser.email === emp.email);
                              const isAdmin = emp.role === 'admin' || emp.role === 'superadmin' || isSelf;

                              if (isAdmin) {
                                return <span className="text-gray-400 font-semibold px-2">—</span>;
                              }

                              if (currentStatus === 'TERMINATED') {
                                return <span className="text-gray-400 font-semibold px-2">—</span>;
                              }

                              const isMenuOpen = openActionMenuId === emp._id;

                              return (
                                <div className="relative inline-block text-left" ref={isMenuOpen ? actionMenuRef : undefined}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenActionMenuId(isMenuOpen ? null : emp._id);
                                    }}
                                    disabled={updatingStatus}
                                    aria-label={`Actions for ${empName}`}
                                    className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center transition-colors cursor-pointer"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>

                                  {isMenuOpen && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="absolute right-0 bottom-full mb-1 sm:bottom-auto sm:top-full sm:mt-1 w-48 rounded-xl bg-white shadow-lg border border-slate-200/80 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-left"
                                    >
                                      {/* 1. View Leave Details (Always visible) */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          setLeaveDetailsModal({
                                            open: true,
                                            employee: emp,
                                          });
                                        }}
                                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors cursor-pointer"
                                      >
                                        <CalendarDays className="w-4 h-4 text-blue-600" />
                                        <span>View Leave Details</span>
                                      </button>

                                      <div className="my-1 border-t border-slate-100" />

                                      {currentStatus === 'SUSPENDED' ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenActionMenuId(null);
                                              setStatusConfirmModal({
                                                open: true,
                                                employee: emp,
                                                newStatus: 'ACTIVE',
                                                reason: 'Reinstated by administrator',
                                              });
                                            }}
                                            className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 transition-colors cursor-pointer"
                                          >
                                            <UserCheck className="w-4 h-4 text-emerald-600" />
                                            <span>Unsuspend</span>
                                          </button>
                                          <div className="my-1 border-t border-slate-100" />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenActionMenuId(null);
                                              setStatusConfirmModal({
                                                open: true,
                                                employee: emp,
                                                newStatus: 'TERMINATED',
                                                reason: '',
                                              });
                                            }}
                                            className="w-full px-3.5 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
                                          >
                                            <AlertOctagon className="w-4 h-4 text-red-600" />
                                            <span>Terminate</span>
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenActionMenuId(null);
                                              setStatusConfirmModal({
                                                open: true,
                                                employee: emp,
                                                newStatus: 'SUSPENDED',
                                                reason: '',
                                              });
                                            }}
                                            className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2 transition-colors cursor-pointer"
                                          >
                                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                                            <span>Suspend</span>
                                          </button>
                                          <div className="my-1 border-t border-slate-100" />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenActionMenuId(null);
                                              setStatusConfirmModal({
                                                open: true,
                                                employee: emp,
                                                newStatus: 'TERMINATED',
                                                reason: '',
                                              });
                                            }}
                                            className="w-full px-3.5 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
                                          >
                                            <AlertOctagon className="w-4 h-4 text-red-600" />
                                            <span>Terminate</span>
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })()}

      {/* TAB CONTENT: SHIFTS */}
      {activeTab === 'shifts' && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Shift Schedules</h3>
              <p className="text-xs text-gray-500 mt-0.5">Manage daily work hours and grace periods across departments</p>
            </div>
            <Button variant="primary" onClick={() => setShowShiftModal(true)} icon={<Plus className="w-4 h-4" />}>
              Create Shift
            </Button>
          </div>
          {shifts.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">No shifts created yet.</p>
              <p className="text-xs text-slate-400 mt-1">Click "Create Shift" to add your first work shift schedule.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {shifts.map((shift) => (
                <div key={shift._id} className="p-5 border border-gray-200 rounded-xl bg-gray-50/50 hover:bg-white transition-all shadow-2xs group flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900">{shift.name}</span>
                      <div className="flex items-center gap-1.5">
                        {shift.code && (
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">{shift.code}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteShiftModal({ open: true, shift })}
                          aria-label={`Delete shift ${shift.name}`}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-70 group-hover:opacity-100 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mt-3 font-semibold flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>{shift.startTime} — {shift.endTime}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Grace Period: {shift.gracePeriodMinutes || 15} minutes</p>
                    {shift.departmentId?.name && (
                      <p className="text-xs text-blue-600 font-medium mt-1">Department: {shift.departmentId.name}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB CONTENT: PROMOTIONS */}
      {activeTab === 'promotions' && (() => {
        const promoList: any[] = Array.isArray(promotionsData?.data) ? promotionsData.data : [];
        const filteredPromos = promoList.filter((item: any) => {
          if (promoFilter === 'ALL') return true;
          if (promoFilter === 'PENDING') return ['SUBMITTED', 'UNDER_REVIEW', 'PENDING'].includes(item.status);
          return item.status === promoFilter;
        });

        const handleApprovePromotion = async (reqItem: any) => {
          try {
            await reviewPromotion({
              id: reqItem._id,
              action: 'APPROVED'
            }).unwrap();
            toast.success(`Promotion approved! Congratulatory email dispatched to ${reqItem.employeeId?.email || 'staff'}.`);
            refetchPromotions();
            refetchEmployees();
            refetchStats();
          } catch (err: any) {
            toast.error(err?.data?.message || err?.message || 'Failed to approve promotion');
          }
        };

        const handleConfirmRejectPromotion = async () => {
          if (!rejectPromoModal.reason.trim()) return;
          try {
            await reviewPromotion({
              id: rejectPromoModal.requestId,
              action: 'REJECTED',
              rejectionReason: rejectPromoModal.reason.trim()
            }).unwrap();
            toast.success('Promotion recommendation rejected and Department Head notified.');
            setRejectPromoModal({ open: false, requestId: '', staffName: '', reason: '' });
            refetchPromotions();
          } catch (err: any) {
            toast.error(err?.data?.message || err?.message || 'Failed to reject promotion');
          }
        };

        return (
          <Card className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Promotion Recommendations</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Review promotion applications and supervisor recommendations with real-time performance snapshots.
                </p>
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setPromoFilter(tab)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      promoFilter === tab
                        ? 'bg-white text-blue-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab === 'ALL' ? 'All Requests' : tab.charAt(0) + tab.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {loadingPromotions ? (
              <div className="py-12 flex justify-center items-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : filteredPromos.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                No promotion recommendations found for the "{promoFilter}" status.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPromos.map((reqItem: any) => {
                  const emp = reqItem.employeeId;
                  const empName = emp?.profile?.fullName || emp?.email || 'Unknown Staff';
                  const empAvatar = emp?.profile?.profileImage || emp?.profile?.avatar;
                  const deptName = reqItem.proposedDepartmentId?.name || emp?.departmentId?.name || 'General';
                  const currentRank = reqItem.currentRank || emp?.rank || 'junior';
                  const requestedRank = reqItem.requestedRank || reqItem.requestedDesignation || 'standard';
                  const isPending = ['PENDING_ADMIN', 'SUBMITTED', 'UNDER_REVIEW', 'PENDING'].includes(reqItem.status);
                  const perf = reqItem.performanceSnapshot || { totalAssigned: 0, completed: 0, pending: 0, efficiencyRate: 0 };

                  return (
                    <div
                      key={reqItem._id}
                      className="p-5 border border-slate-200/80 rounded-2xl bg-white hover:border-slate-300 transition-all shadow-2xs space-y-4"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Staff Profile + Rank transition */}
                        <div className="flex items-center gap-3.5">
                          <UserAvatar
                            name={empName}
                            src={empAvatar}
                            size="md"
                            className="w-12 h-12 text-sm"
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-gray-900 text-base">{empName}</h4>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                                {deptName}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                reqItem.status === 'APPROVED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : reqItem.status === 'REJECTED'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {isPending ? 'Pending Review' : reqItem.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{emp?.email}</p>

                            {/* Rank transition pill */}
                            <div className="flex items-center gap-2 mt-2 text-xs font-semibold">
                              <span className="text-slate-500">Rank Progression:</span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 capitalize">{currentRank}</span>
                              <span className="text-blue-600 font-bold">&rarr;</span>
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold capitalize">{requestedRank}</span>
                            </div>
                          </div>
                        </div>

                        {/* Two Admin Actions on PENDING */}
                        {isPending && (
                          <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
                            <button
                              type="button"
                              onClick={() => setRejectPromoModal({
                                open: true,
                                requestId: reqItem._id,
                                staffName: empName,
                                reason: ''
                              })}
                              disabled={reviewingPromotion}
                              className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApprovePromotion(reqItem)}
                              disabled={reviewingPromotion}
                              className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              {reviewingPromotion && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                              <span>Promote</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Performance Snapshot Strip */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                        <div>
                          <p className="text-xs text-slate-500">Total Assigned</p>
                          <p className="text-base font-bold text-slate-800 mt-0.5">{perf.totalAssigned}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Completed Tickets</p>
                          <p className="text-base font-bold text-emerald-600 mt-0.5">{perf.completed}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Pending / In-Progress</p>
                          <p className="text-base font-bold text-amber-600 mt-0.5">{perf.pending}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Efficiency Rate</p>
                          <p className="text-base font-bold text-purple-600 mt-0.5">{perf.efficiencyRate}%</p>
                        </div>
                      </div>

                      {/* Recommender remarks */}
                      <div className="p-3 bg-blue-50/40 border border-blue-100 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between text-slate-500">
                          <span className="font-semibold text-slate-700">
                            {reqItem.requestType === 'self' ? 'Applicant: ' : 'Recommended by: '}
                            {reqItem.submittedBy?.profile?.fullName || reqItem.submittedBy?.email || 'Staff Member'}
                          </span>
                          <span>{new Date(reqItem.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-slate-700 text-xs italic">
                          "{reqItem.justification}"
                        </p>
                        {reqItem.deptHeadRemarks && (
                          <p className="text-blue-800 font-medium pt-1 border-t border-blue-100 mt-1">
                            <strong>Dept Head Endorsement:</strong> {reqItem.deptHeadRemarks}
                          </p>
                        )}
                        {reqItem.rejectionReason && (
                          <p className="text-red-700 font-semibold pt-1 border-t border-red-100 mt-1">
                            Rejection Reason: {reqItem.rejectionReason}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* REJECT PROMOTION MODAL */}
            {rejectPromoModal.open && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
                <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">Reject Promotion Recommendation</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Please provide a mandatory justification for rejecting {rejectPromoModal.staffName}'s promotion.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRejectPromoModal({ open: false, requestId: '', staffName: '', reason: '' })}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Rejection Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-red-500"
                      rows={3}
                      placeholder="e.g. Current workload targets or attendance compliance did not satisfy promotion criteria..."
                      value={rejectPromoModal.reason}
                      onChange={(e) => setRejectPromoModal(prev => ({ ...prev, reason: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setRejectPromoModal({ open: false, requestId: '', staffName: '', reason: '' })}
                      disabled={reviewingPromotion}
                      className="h-9 px-4 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmRejectPromotion}
                      disabled={reviewingPromotion || !rejectPromoModal.reason.trim()}
                      className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {reviewingPromotion && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                      <span>Confirm Rejection</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        );
      })()}

      {/* TAB CONTENT: DISCIPLINARY & WARNINGS */}
      {activeTab === 'disciplinary' && (() => {
        const warningsList: any[] = Array.isArray(warningsData?.data) ? warningsData.data : [];

        // Active employees eligible for warnings (staff & department heads, excluding admins, superadmins, and terminated)
        const eligibleEmployees = employees.filter((emp: any) => {
          const role = (emp.role || emp.userId?.role || '').toLowerCase();
          const status = emp.employmentStatus || emp.accountStatus?.toUpperCase() || 'ACTIVE';
          const isTerminated = status === 'TERMINATED';
          const isAdmin = role === 'admin' || role === 'superadmin';
          return !isAdmin && !isTerminated;
        });

        return (
          <div className="space-y-6">
            {/* Single Full-Width Card: Formal Warning Letters */}
            <Card className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-lg font-bold text-gray-900">Formal Warning Letters</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      {warningsList.length} Total
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Official warning letters issued to staff members by Administration and Department Heads.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowWarningModal(true)}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold shadow-xs"
                >
                  Issue Warning Letter
                </Button>
              </div>

              {loadingWarnings ? (
                <div className="py-12 flex justify-center items-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-red-600" />
                </div>
              ) : warningsList.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-gray-800">No formal warning letters on record.</p>
                    <p className="text-xs text-gray-500">
                      Use the button below to issue an official warning notice with optional evidence.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Button
                      size="sm"
                      onClick={() => setShowWarningModal(true)}
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold shadow-xs"
                    >
                      Issue Warning Letter
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500 uppercase bg-gray-50/80">
                        <th className="py-3 px-3 font-semibold">Staff Member</th>
                        <th className="py-3 px-3 font-semibold">Notice #</th>
                        <th className="py-3 px-3 font-semibold">Severity</th>
                        <th className="py-3 px-3 font-semibold">Category</th>
                        <th className="py-3 px-3 font-semibold">Subject & Details</th>
                        <th className="py-3 px-3 font-semibold">Evidence</th>
                        <th className="py-3 px-3 font-semibold">Issued By</th>
                        <th className="py-3 px-3 font-semibold text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {warningsList.map((wrn: any) => {
                        const emp = wrn.employeeId;
                        const empName = emp?.profile?.fullName || emp?.name || emp?.email || 'Staff Member';
                        const empAvatar = emp?.profile?.profileImage || emp?.profile?.avatar;
                        const empEmail = emp?.email || '';
                        const issuerName = wrn.issuedBy?.profile?.fullName || wrn.issuedBy?.name || wrn.issuedBy?.email || 'Management';

                        const severityBadgeClass =
                          wrn.severity === 'Final'
                            ? 'bg-red-100 text-red-800 border-red-200'
                            : wrn.severity === 'Written'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-blue-100 text-blue-800 border-blue-200';

                        return (
                          <tr key={wrn._id} className="hover:bg-gray-50/60 transition-colors">
                            {/* Staff Member Avatar + Name */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <UserAvatar
                                  name={empName}
                                  src={empAvatar}
                                  size="sm"
                                  className="w-8 h-8 text-xs shrink-0"
                                />
                                <div>
                                  <p className="font-bold text-slate-900 leading-tight">{empName}</p>
                                  {empEmail && (
                                    <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{empEmail}</p>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Notice Number */}
                            <td className="py-3 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                              {wrn.warningNumber}
                            </td>

                            {/* Severity Badge */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${severityBadgeClass}`}>
                                {wrn.severity} Warning
                              </span>
                            </td>

                            {/* Category */}
                            <td className="py-3 px-3 whitespace-nowrap text-slate-700 font-medium">
                              {wrn.category}
                            </td>

                            {/* Subject & Details */}
                            <td className="py-3 px-3 max-w-xs">
                              <p className="font-semibold text-slate-900 truncate">{wrn.subject}</p>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">{wrn.details}</p>
                              {wrn.actionRequired && (
                                <p className="text-[10px] text-amber-700 truncate mt-0.5">
                                  <span className="font-semibold">Action:</span> {wrn.actionRequired}
                                </p>
                              )}
                            </td>

                            {/* Evidence Image Thumbnail */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              {wrn.evidenceUrl ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewEvidenceUrl(wrn.evidenceUrl)}
                                  className="relative group block overflow-hidden rounded-lg border border-slate-200 bg-slate-50 w-12 h-10 hover:border-blue-400 transition-all cursor-pointer shadow-2xs"
                                  title="Click to view evidence image"
                                >
                                  <img
                                    src={wrn.evidenceUrl}
                                    alt="Evidence thumbnail"
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </div>
                                </button>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>

                            {/* Issued By */}
                            <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                              {issuerName}
                            </td>

                            {/* Date */}
                            <td className="py-3 px-3 text-slate-500 text-right whitespace-nowrap">
                              {new Date(wrn.issuedAt || wrn.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* ISSUE WARNING LETTER MODAL */}
            {showWarningModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
                <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] flex flex-col border border-slate-200">
                  {/* Modal Header */}
                  <div className="flex items-start justify-between gap-3 shrink-0 pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">Issue Formal Warning Letter</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Dispatch an official disciplinary warning notice directly to a staff member.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={resetWarningForm}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Form Scrollable Body */}
                  <form onSubmit={handleIssueWarningSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
                    {/* 1. Clean Searchable Employee Picker (Required) */}
                    <div className="relative" ref={empDropdownRef}>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
                        Employee <span className="text-red-500">*</span>
                      </label>

                      {/* Dropdown Trigger Box */}
                      <button
                        type="button"
                        onClick={() => setIsEmpDropdownOpen(!isEmpDropdownOpen)}
                        className={`w-full px-3 py-2 border rounded-xl text-left text-xs bg-white flex items-center justify-between transition-all cursor-pointer ${
                          isEmpDropdownOpen ? 'border-red-500 ring-2 ring-red-500/10' : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {(() => {
                          const selectedEmp = eligibleEmployees.find((e: any) => {
                            const empUserId = e.userId?._id || e.userId || e._id;
                            return empUserId === warningEmpId;
                          });

                          if (!selectedEmp) {
                            return <span className="text-slate-400">Select employee to issue warning...</span>;
                          }

                          const empName = selectedEmp.name || selectedEmp.profile?.fullName || selectedEmp.email;
                          const empAvatar = selectedEmp.profile?.profileImage || selectedEmp.profile?.avatar;
                          const deptName = selectedEmp.department?.name || selectedEmp.departmentId?.name || 'General';
                          const roleLabel = (selectedEmp.role || selectedEmp.userId?.role || 'staff') === 'department_head' ? 'Dept Head' : 'Staff';
                          const rankLabel = selectedEmp.rank || 'Standard';

                          return (
                            <div className="flex items-center gap-2.5 min-w-0">
                              <UserAvatar
                                name={empName}
                                src={empAvatar}
                                size="sm"
                                className="w-6 h-6 text-[10px] shrink-0"
                              />
                              <span className="font-bold text-slate-900 truncate">{empName}</span>
                              <span className="text-slate-400 text-[11px] truncate hidden sm:inline">({selectedEmp.email})</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 shrink-0">
                                {deptName}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                                {roleLabel}
                              </span>
                            </div>
                          );
                        })()}
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isEmpDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Dropdown Menu Panel */}
                      {isEmpDropdownOpen && (
                        <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-white rounded-xl shadow-xl border border-slate-200 py-2 animate-in fade-in zoom-in-95 duration-100">
                          {/* Search Input Filter */}
                          <div className="px-3 pb-2 border-b border-slate-100">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Search by name, email, or department..."
                                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-red-500 bg-slate-50 focus:bg-white transition-all"
                                value={warningEmpSearch}
                                onChange={(e) => setWarningEmpSearch(e.target.value)}
                                autoFocus
                              />
                            </div>
                          </div>

                          {/* Options List */}
                          <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                            {(() => {
                              const searchLower = warningEmpSearch.toLowerCase().trim();
                              const filteredList = eligibleEmployees.filter((emp: any) => {
                                const name = (emp.name || emp.profile?.fullName || '').toLowerCase();
                                const email = (emp.email || '').toLowerCase();
                                const dept = (emp.department?.name || emp.departmentId?.name || '').toLowerCase();
                                return name.includes(searchLower) || email.includes(searchLower) || dept.includes(searchLower);
                              });

                              if (filteredList.length === 0) {
                                return (
                                  <div className="p-4 text-center text-xs text-slate-400">
                                    No matching employees found.
                                  </div>
                                );
                              }

                              return filteredList.map((emp: any) => {
                                const empUserId = emp.userId?._id || emp.userId || emp._id;
                                const name = emp.name || emp.profile?.fullName || emp.email;
                                const avatar = emp.profile?.profileImage || emp.profile?.avatar;
                                const deptName = emp.department?.name || emp.departmentId?.name || 'General';
                                const role = emp.role || emp.userId?.role || 'staff';
                                const isDeptHead = role === 'department_head';
                                const rank = emp.rank || 'Standard';
                                const isSelected = warningEmpId === empUserId;

                                return (
                                  <div
                                    key={emp._id}
                                    onClick={() => {
                                      setWarningEmpId(empUserId);
                                      setIsEmpDropdownOpen(false);
                                      setWarningEmpSearch('');
                                    }}
                                    className={`px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                                      isSelected ? 'bg-red-50/50' : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <UserAvatar
                                        name={name}
                                        src={avatar}
                                        size="sm"
                                        className="w-7 h-7 text-xs shrink-0"
                                      />
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                                          {name}
                                        </p>
                                        <p className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">
                                          {emp.email}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Badges: Department, Role, Rank */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                        {deptName}
                                      </span>
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                        isDeptHead
                                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                                          : 'bg-blue-50 text-blue-700 border-blue-200'
                                      }`}>
                                        {isDeptHead ? 'Dept Head' : 'Staff'}
                                      </span>
                                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                                        {rank}
                                      </span>
                                      {isSelected && (
                                        <Check className="w-4 h-4 text-red-600 ml-1" />
                                      )}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. Category Dropdown (Required) */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:border-red-500"
                        value={warningCategory}
                        onChange={(e) => setWarningCategory(e.target.value)}
                        required
                      >
                        <option value="Attendance & Punctuality">Attendance & Punctuality</option>
                        <option value="Performance">Performance</option>
                        <option value="Misconduct">Misconduct</option>
                        <option value="SLA Breach">SLA Breach</option>
                        <option value="Policy Violation">Policy Violation</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {/* 3. Warning Type (Severity) (Required) */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
                        Warning Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:border-red-500"
                        value={warningSeverity}
                        onChange={(e) => setWarningSeverity(e.target.value)}
                        required
                      >
                        <option value="Verbal Warning">Verbal Warning</option>
                        <option value="Formal Written Warning">Formal Written Warning</option>
                        <option value="Final Warning">Final Warning</option>
                      </select>
                    </div>

                    {/* 4. Subject / Headline (Required) */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
                        Subject / Headline <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Failure to comply with response SLA standards"
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-red-500"
                        value={warningSubject}
                        onChange={(e) => setWarningSubject(e.target.value)}
                        required
                      >
                      </input>
                    </div>

                    {/* 5. Details (Required) */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
                        Details & Remarks <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-red-500"
                        rows={3}
                        placeholder="Provide full context regarding the infraction, incident dates, and expectations..."
                        value={warningDetails}
                        onChange={(e) => setWarningDetails(e.target.value)}
                        required
                      />
                    </div>

                    {/* 6. Evidence (Optional Image Upload) */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
                        Evidence <span className="text-slate-400 font-normal">(Optional Screenshot / Image)</span>
                      </label>
                      {warningEvidencePreview ? (
                        <div className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-xl bg-slate-50">
                          <img
                            src={warningEvidencePreview}
                            alt="Evidence preview"
                            className="w-16 h-14 object-cover rounded-lg border border-slate-200"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">
                              {warningEvidenceFile?.name || 'evidence_image.png'}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {(warningEvidenceFile ? (warningEvidenceFile.size / 1024).toFixed(1) : '0')} KB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setWarningEvidenceFile(null);
                              setWarningEvidencePreview(null);
                            }}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                            title="Remove attachment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 hover:border-red-400 rounded-xl cursor-pointer bg-gray-50/50 hover:bg-red-50/30 transition-all">
                          <UploadCloud className="w-6 h-6 text-gray-400 mb-1" />
                          <span className="text-xs font-semibold text-gray-700">Upload Evidence Image</span>
                          <span className="text-[10px] text-gray-400 mt-0.5">PNG, JPG, WEBP up to 10MB</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleEvidenceFileChange}
                          />
                        </label>
                      )}
                    </div>

                    {/* 7. Corrective Action Required */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
                        Corrective Action Required <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-red-500"
                        rows={2}
                        placeholder="e.g. Complete retraining on resolution turnaround by Friday; attend scheduled 1-on-1 review."
                        value={warningActionRequired}
                        onChange={(e) => setWarningActionRequired(e.target.value)}
                      />
                    </div>

                    {/* Modal Footer */}
                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 shrink-0">
                      <button
                        type="button"
                        onClick={resetWarningForm}
                        disabled={issuingWarning}
                        className="h-9 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={issuingWarning || !warningEmpId || !warningSubject.trim() || !warningDetails.trim()}
                        className="h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        {issuingWarning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Issue Warning Notice</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* EVIDENCE PREVIEW MODAL */}
      {previewEvidenceUrl && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewEvidenceUrl(null)}
        >
          <div
            className="relative bg-white rounded-2xl max-w-2xl w-full p-4 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-gray-900">Warning Evidence</h3>
              <button
                type="button"
                onClick={() => setPreviewEvidenceUrl(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-3 max-h-[70vh] flex items-center justify-center overflow-auto rounded-lg bg-slate-900">
              <img
                src={previewEvidenceUrl}
                alt="Warning Evidence Attachment"
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* SHIFT MODAL */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Create Shift Template</h3>
            <form onSubmit={handleCreateShiftSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Shift Name</label>
                <input
                  type="text"
                  placeholder="e.g. Night Emergency Shift"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  value={shiftName}
                  onChange={(e) => setShiftName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Shift Code</label>
                <input
                  type="text"
                  placeholder="e.g. NES-3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  value={shiftCode}
                  onChange={(e) => setShiftCode(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Start Time</label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    value={shiftStart}
                    onChange={(e) => setShiftStart(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">End Time</label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    value={shiftEnd}
                    onChange={(e) => setShiftEnd(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => setShowShiftModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" isLoading={creatingShift}>
                  Save Shift
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATUS CHANGE CONFIRMATION MODAL */}
      {statusConfirmModal.open && statusConfirmModal.employee && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {statusConfirmModal.newStatus === 'TERMINATED'
                    ? 'Confirm Employee Termination'
                    : statusConfirmModal.newStatus === 'SUSPENDED'
                    ? 'Confirm Employee Suspension'
                    : statusConfirmModal.newStatus === 'ACTIVE'
                    ? 'Confirm Employee Reinstatement'
                    : `Confirm Status Change: ${statusConfirmModal.newStatus}`}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {statusConfirmModal.newStatus === 'TERMINATED' ? (
                    <>
                      You are about to permanently terminate{' '}
                      <span className="font-semibold text-gray-800">
                        {statusConfirmModal.employee.profile?.fullName || statusConfirmModal.employee.email}
                      </span>
                      . This will permanently revoke login credentials, unassign them from any department, and dispatch an official termination notice email to{' '}
                      <span className="font-semibold text-gray-800">{statusConfirmModal.employee.email}</span>.
                    </>
                  ) : statusConfirmModal.newStatus === 'SUSPENDED' ? (
                    <>
                      You are suspending{' '}
                      <span className="font-semibold text-gray-800">
                        {statusConfirmModal.employee.profile?.fullName || statusConfirmModal.employee.email}
                      </span>
                      . They will be immediately blocked from logging in and will not be eligible for new complaint assignments.
                    </>
                  ) : statusConfirmModal.newStatus === 'ACTIVE' ? (
                    <>
                      You are reinstating{' '}
                      <span className="font-semibold text-gray-800">
                        {statusConfirmModal.employee.profile?.fullName || statusConfirmModal.employee.email}
                      </span>{' '}
                      to active duty. Their login access will be restored.
                    </>
                  ) : (
                    <>
                      You are changing the status of{' '}
                      <span className="font-semibold text-gray-800">
                        {statusConfirmModal.employee.profile?.fullName || statusConfirmModal.employee.email}
                      </span>{' '}
                      to <span className="font-semibold text-purple-700">{statusConfirmModal.newStatus}</span>.
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatusConfirmModal({ open: false, employee: null, newStatus: '', reason: '' })}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {statusConfirmModal.newStatus !== 'ACTIVE' && (
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Reason / Justification <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  rows={3}
                  placeholder={`Provide reason for marking as ${statusConfirmModal.newStatus}...`}
                  value={statusConfirmModal.reason}
                  onChange={(e) => setStatusConfirmModal(prev => ({ ...prev, reason: e.target.value }))}
                  required
                />
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStatusConfirmModal({ open: false, employee: null, newStatus: '', reason: '' })}
                disabled={updatingStatus}
                className="h-9 px-4 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeStatusChange(
                  statusConfirmModal.employee,
                  statusConfirmModal.newStatus,
                  statusConfirmModal.reason
                )}
                disabled={updatingStatus || (statusConfirmModal.newStatus !== 'ACTIVE' && !statusConfirmModal.reason.trim())}
                className={`h-9 px-4 rounded-lg text-white text-sm font-medium shadow-xs disabled:opacity-50 flex items-center gap-2 transition-colors cursor-pointer ${
                  statusConfirmModal.newStatus === 'TERMINATED'
                    ? 'bg-red-600 hover:bg-red-700'
                    : statusConfirmModal.newStatus === 'SUSPENDED'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {updatingStatus && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {statusConfirmModal.newStatus === 'TERMINATED'
                    ? 'Confirm Termination'
                    : statusConfirmModal.newStatus === 'SUSPENDED'
                    ? 'Confirm Suspension'
                    : statusConfirmModal.newStatus === 'ACTIVE'
                    ? 'Confirm Reinstatement'
                    : `Confirm ${statusConfirmModal.newStatus}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SHIFT CONFIRMATION MODAL */}
      {deleteShiftModal.open && deleteShiftModal.shift && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Delete Shift</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Are you sure you want to delete shift{' '}
                  <span className="font-semibold text-gray-800">
                    "{deleteShiftModal.shift.name}"
                  </span>? It will no longer be assignable to staff members across departments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteShiftModal({ open: false, shift: null })}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteShiftModal({ open: false, shift: null })}
                disabled={deletingShift}
                className="h-9 px-4 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteShift}
                disabled={deletingShift}
                className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium shadow-xs disabled:opacity-50 flex items-center gap-2 transition-colors cursor-pointer"
              >
                {deletingShift && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Delete Shift</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW LEAVE DETAILS MODAL */}
      {leaveDetailsModal.open && leaveDetailsModal.employee && (() => {
        const emp = leaveDetailsModal.employee;
        const empName = emp.profile?.fullName || emp.name || emp.email;
        const leaveInfo = emp.leaveInfo;
        const activeLeave = leaveInfo?.activeLeave;
        const totalApprovedDays = leaveInfo?.totalApprovedLeaveDays || 0;
        const recentLeaves = leaveInfo?.recentLeaves || [];

        const formatDate = (dateStr?: string) => {
          if (!dateStr) return '--';
          try {
            return new Date(dateStr).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
          } catch {
            return dateStr;
          }
        };

        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{empName}</h3>
                    <p className="text-xs text-slate-500">{emp.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLeaveDetailsModal({ open: false, employee: null })}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4 overflow-y-auto">
                {/* 1. Current Leave Status Card */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Current Leave Status
                  </h4>
                  {activeLeave ? (
                    <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-900 text-sm">{activeLeave.leaveType}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white uppercase tracking-wider">
                          Active Today
                        </span>
                      </div>
                      <div className="text-xs text-blue-800 flex items-center justify-between">
                        <span>Date Range:</span>
                        <span className="font-semibold text-slate-800">
                          {formatDate(activeLeave.startDate)} &rarr; {formatDate(activeLeave.endDate)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-blue-200/60 text-xs">
                        <div>
                          <span className="text-blue-700">Total Duration:</span>
                          <p className="font-bold text-slate-800">{activeLeave.totalDays} day{activeLeave.totalDays > 1 ? 's' : ''}</p>
                        </div>
                        <div>
                          <span className="text-blue-700">Days Remaining:</span>
                          <p className="font-bold text-blue-700">{activeLeave.remainingDays} day{activeLeave.remainingDays !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      {activeLeave.reason && (
                        <p className="text-xs text-slate-600 italic pt-1 border-t border-blue-200/60">
                          "{activeLeave.reason}"
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <p className="text-xs font-medium text-slate-600">Currently not on leave.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Staff member is active or scheduled according to regular shift.</p>
                    </div>
                  )}
                </div>

                {/* 2. Leave Summary / History */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Leave Summary & History
                    </h4>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      Total Taken: {totalApprovedDays} days
                    </span>
                  </div>

                  {recentLeaves.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-slate-100">
                      No approved leave history recorded.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentLeaves.map((l: any, idx: number) => (
                        <div
                          key={l.id || idx}
                          className="p-3 rounded-xl border border-slate-100 bg-slate-50/40 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <p className="font-semibold text-slate-800">{l.leaveType}</p>
                            <p className="text-slate-500 text-[11px] mt-0.5">
                              {formatDate(l.startDate)} &rarr; {formatDate(l.endDate)}
                            </p>
                          </div>
                          <span className="font-bold text-slate-700 shrink-0 px-2 py-1 rounded bg-white border border-slate-200 text-[11px]">
                            {l.days} day{l.days > 1 ? 's' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex justify-end">
                <button
                  type="button"
                  onClick={() => setLeaveDetailsModal({ open: false, employee: null })}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default AdminHRManagementPage;
