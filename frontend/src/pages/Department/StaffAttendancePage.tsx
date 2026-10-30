import React, { useState, useMemo } from 'react';
import {
  Clock,
  Calendar,
  Users,
  Search,
  Filter,
  AlertCircle,
  TrendingUp,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useGetDepartmentAttendanceQuery } from '../../features/hr/hr.api';
import { useAuth } from '@/hooks/useAuth';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const DepartmentStaffAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [departmentStaff, setDepartmentStaff] = useState<any[]>([]);

  const { data, isLoading, error } = useGetDepartmentAttendanceQuery({
    month: selectedMonth,
    year: selectedYear,
    employeeId: selectedEmployeeId || undefined,
  });

  // Always keep and accumulate the complete staff list so dropdown never shrinks (excluding department head)
  React.useEffect(() => {
    if (data?.data?.staff && data.data.staff.length > 0) {
      const regularStaff = data.data.staff.filter(
        (s: any) => s.role !== 'department_head' && s._id !== user?._id
      );
      setDepartmentStaff((prev) => {
        if (prev.length === 0 || regularStaff.length >= prev.length) {
          return regularStaff;
        }
        return prev;
      });
    }
  }, [data?.data?.staff, user?._id]);

  const records = data?.data?.records || [];
  const insights = data?.data?.insights || {
    totalTimeSpent: '0h 0m',
    averageCheckInTime: '--:--',
    averageCheckOutTime: '--:--',
    averageDuration: '0h 0m',
    totalAbsences: 0,
  };
  const staffList = departmentStaff.length > 0 ? departmentStaff : data?.data?.staff || [];

  // Helper to determine whether a record is a Missing Punch (has check-in but no check-out)
  const isRecordMissingPunch = (rec: any): boolean => {
    const s = (rec.status || '').toUpperCase();
    if (s === 'ON_LEAVE' || s === 'LEAVE' || s === 'ABSENT' || s === 'HOLIDAY') {
      return false;
    }
    if (rec.isCorrectionRequested) return true;
    if (s === 'MISSING_PUNCH') return true;

    // Show Missing Punch only when an actual Check In exists, Check Out is missing, and not on leave/absent
    if (rec.checkInTime && !rec.checkOutTime) {
      return true;
    }
    return false;
  };

  // Extract staff member name helper
  const getStaffName = (rec: any): string => {
    return (
      rec.employee?.name ||
      rec.employee?.profile?.fullName ||
      rec.employee?.profile?.name ||
      rec.employeeId?.profile?.fullName ||
      rec.employeeId?.profile?.name ||
      rec.employee?.email ||
      rec.employeeId?.email ||
      'Staff Member'
    );
  };

  const getStaffEmail = (rec: any): string => {
    return rec.employee?.email || rec.employeeId?.email || '';
  };

  // Filter records locally by staff search and status (excluding department head records)
  const filteredRecords = useMemo(() => {
    return records.filter((rec: any) => {
      const empRole = rec.employee?.role || rec.employeeId?.role;
      const empId = rec.employee?._id || rec.employeeId?._id;
      if (empRole === 'department_head' || empId === user?._id) return false;

      const staffName = getStaffName(rec);
      const staffEmail = getStaffEmail(rec);
      const matchesSearch =
        staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staffEmail.toLowerCase().includes(searchTerm.toLowerCase());

      const recIsMissingPunch = isRecordMissingPunch(rec);
      let matchesStatus = true;

      if (statusFilter === 'ALL') {
        matchesStatus = true;
      } else if (statusFilter === 'MISSING_PUNCH') {
        matchesStatus = recIsMissingPunch;
      } else if (statusFilter === 'PRESENT') {
        // Only present if not missing punch
        matchesStatus = rec.status?.toUpperCase() === 'PRESENT' && !recIsMissingPunch;
      } else {
        matchesStatus = rec.status?.toUpperCase() === statusFilter.toUpperCase();
      }

      return matchesSearch && matchesStatus;
    });
  }, [records, searchTerm, statusFilter]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const getInitials = (name: string) => {
    if (!name || name === 'Staff Member') return 'ST';
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadge = (rec: any) => {
    if (isRecordMissingPunch(rec)) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/70">
          Missing Punch
        </span>
      );
    }

    const s = (rec.status || '').toUpperCase();
    switch (s) {
      case 'PRESENT':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Present
          </span>
        );
      case 'LATE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Late
          </span>
        );
      case 'HALF_DAY':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            Half Day
          </span>
        );
      case 'ON_LEAVE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            On Leave
          </span>
        );
      case 'ABSENT':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            Absent
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {rec.status || 'Unknown'}
          </span>
        );
    }
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return <span className="text-slate-400 italic font-normal">Not recorded</span>;
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return timeStr;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return timeStr;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff Attendance</h1>
          <p className="text-sm text-slate-500 mt-1">
            Department-wide attendance tracking, monthly logs, and insights
          </p>
        </div>

        {/* Action Controls: Compact, Non-wrapping Toolbar with Uniform h-10 Controls */}
        <div className="flex items-center gap-2.5 flex-nowrap shrink-0 overflow-x-auto pb-1 lg:pb-0">
          {/* Staff Member Selector */}
          <div className="relative w-56 shrink-0">
            <Users className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full h-10 appearance-none bg-white border border-slate-200 rounded-xl pl-9 pr-9 text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors shadow-sm cursor-pointer"
            >
              <option value="">All Department Staff</option>
              {staffList.map((st: any) => {
                const sName = st.profile?.fullName || st.profile?.name || st.name || st.email;
                return (
                  <option key={st._id} value={st._id}>
                    {sName}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
          </div>

          {/* Month Selector */}
          <div className="inline-flex items-center h-10 bg-white border border-slate-200 rounded-xl shadow-sm px-1 shrink-0">
            <button
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2.5 font-semibold text-xs text-slate-800 whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {MONTHS[selectedMonth - 1]} {selectedYear}
              </span>
            </div>
            <button
              onClick={handleNextMonth}
              title="Next Month"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Insights Card (5 Standardized Tiles) ───────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Attendance Insights</h2>
              <p className="text-xs text-slate-500">
                Performance summary for {MONTHS[selectedMonth - 1]} {selectedYear}
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-500 bg-slate-100 font-medium px-2.5 py-1 rounded-full">
            {records.length === 1 ? '1 Record' : `${records.length} Records`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* 1. Total Time Spent */}
          <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                Total Time
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-100/70 text-blue-700 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {insights.totalTimeSpent || '0h 0m'}
              </div>
              <p className="text-xs text-slate-400 mt-1">Logged working hours</p>
            </div>
          </div>

          {/* 2. Avg Check-In Time */}
          <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                Avg Check-In
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {insights.averageCheckInTime || '--:--'}
              </div>
              <p className="text-xs text-slate-400 mt-1">First punch average</p>
            </div>
          </div>

          {/* 3. Avg Check-Out Time */}
          <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                Avg Check-Out
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-100/70 text-indigo-700 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {insights.averageCheckOutTime || '--:--'}
              </div>
              <p className="text-xs text-slate-400 mt-1">Last punch average</p>
            </div>
          </div>

          {/* 4. Avg Duration */}
          <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                Avg Duration
              </span>
              <div className="w-8 h-8 rounded-lg bg-teal-100/70 text-teal-700 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {insights.averageDuration || '0h 0m'}
              </div>
              <p className="text-xs text-slate-400 mt-1">Per present shift</p>
            </div>
          </div>

          {/* 5. Total Absences (Soft Rose) */}
          <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-rose-700 whitespace-nowrap">
                Total Absences
              </span>
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <UserX className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-rose-900 tabular-nums">
                {insights.totalAbsences ?? 0}
              </div>
              <p className="text-xs text-rose-600/80 mt-1">Days marked absent</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Table & Filter Controls ────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Top Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search staff name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'PRESENT', label: 'Present' },
                { id: 'LATE', label: 'Late' },
                { id: 'MISSING_PUNCH', label: 'Missing Punch' },
                { id: 'ABSENT', label: 'Absent' },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    statusFilter === st.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Body */}
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">Loading attendance records...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">Failed to load attendance</p>
            <p className="text-xs text-slate-500 mt-1">Please try refreshing or check your connection.</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">No attendance records found</p>
            <p className="text-xs text-slate-500 mt-1">
              No attendance logs match the selected period or filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">Staff Member</th>
                  <th className="py-3.5 px-6">Date</th>
                  <th className="py-3.5 px-6">Check In</th>
                  <th className="py-3.5 px-6">Check Out</th>
                  <th className="py-3.5 px-6">Duration</th>
                  <th className="py-3.5 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRecords.map((rec: any) => {
                  const sName = getStaffName(rec);
                  const sEmail = getStaffEmail(rec);
                  const durationFormatted =
                    rec.totalWorkHours !== undefined && rec.totalWorkHours !== null
                      ? `${Math.floor(rec.totalWorkHours)}h ${Math.round(
                          (rec.totalWorkHours % 1) * 60
                        )}m`
                      : rec.workingHours !== undefined && rec.workingHours !== null
                      ? `${Math.floor(rec.workingHours)}h ${Math.round(
                          (rec.workingHours % 1) * 60
                        )}m`
                      : '--';

                  return (
                    <tr
                      key={rec._id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Staff Member */}
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-semibold text-xs flex items-center justify-center flex-shrink-0">
                            {getInitials(sName)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{sName}</p>
                            {sEmail && (
                              <p className="text-xs text-slate-400 truncate">{sEmail}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-6 text-slate-600 font-medium whitespace-nowrap">
                        {formatDate(rec.date)}
                      </td>

                      {/* Check In */}
                      <td className="py-3.5 px-6 font-medium text-slate-700 whitespace-nowrap">
                        {rec.status?.toLowerCase() === 'on_leave' || rec.status?.toLowerCase() === 'absent'
                          ? '—'
                          : formatTime(rec.checkInTime)}
                      </td>

                      {/* Check Out */}
                      <td className="py-3.5 px-6 font-medium text-slate-700 whitespace-nowrap">
                        {rec.status?.toLowerCase() === 'on_leave' || rec.status?.toLowerCase() === 'absent'
                          ? '—'
                          : formatTime(rec.checkOutTime)}
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-6 font-semibold text-slate-800 whitespace-nowrap">
                        {durationFormatted}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-6 whitespace-nowrap">
                        {getStatusBadge(rec)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DepartmentStaffAttendancePage;
