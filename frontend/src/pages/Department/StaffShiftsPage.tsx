import React, { useState } from 'react';
import {
  Clock,
  Search,
  Loader2,
  ChevronDown,
  CalendarDays,
  Calendar,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useGetDepartmentStaffQuery } from '@/features/department/department.api';
import { useGetShiftsQuery, useAssignShiftMutation } from '@/features/hr/hr.api';
import toast from 'react-hot-toast';

export const DepartmentStaffShiftsPage: React.FC = () => {
  const { user } = useAuth();
  const departmentId = typeof user?.departmentId === 'object' && user?.departmentId !== null
    ? (user.departmentId as any)._id
    : user?.departmentId || (user as any)?.department?._id || '';

  const { data: staffData, isLoading: staffLoading, refetch: refetchStaff } = useGetDepartmentStaffQuery(departmentId, {
    skip: !departmentId
  });
  const { data: shiftsData, isLoading: shiftsLoading } = useGetShiftsQuery();
  const [assignShift, { isLoading: isAssigning }] = useAssignShiftMutation();

  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [selectedStaffForModal, setSelectedStaffForModal] = useState<any | null>(null);
  const [modalShiftId, setModalShiftId] = useState<string>('');
  const [modalScheduleType, setModalScheduleType] = useState<'ALL_DAYS' | 'SPECIFIC_DATES'>('ALL_DAYS');
  const [modalFromDate, setModalFromDate] = useState<string>('');
  const [modalToDate, setModalToDate] = useState<string>('');

  const staffList = (staffData?.data || []).filter((s: any) =>
    s.role !== 'department_head' && s._id !== user?._id
  );
  const shifts = shiftsData?.data || [];

  // Default General shift fallback
  const generalShift = shifts.find((s: any) =>
    s.name?.toLowerCase().includes('general') || s.code?.toUpperCase() === 'GENERAL'
  ) || shifts[0];

  const filteredStaff = staffList.filter((staff) => {
    const name = staff.profile?.fullName?.toLowerCase() || '';
    const email = staff.email?.toLowerCase() || '';
    const q = searchTerm.toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  const formatShiftTime = (startTime?: string, endTime?: string) => {
    if (!startTime || !endTime) return '—';
    const to12h = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
    };
    return `${to12h(startTime)} – ${to12h(endTime)}`;
  };

  const getShiftBadge = (shiftName?: string) => {
    if (!shiftName) {
      return {
        label: 'Unassigned',
        style: 'bg-slate-100 text-slate-500 border-slate-200'
      };
    }
    const normalized = shiftName.toLowerCase();
    if (normalized.includes('morning')) {
      return {
        label: shiftName,
        style: 'bg-amber-50 text-amber-700 border-amber-200/70'
      };
    }
    if (normalized.includes('evening')) {
      return {
        label: shiftName,
        style: 'bg-indigo-50 text-indigo-700 border-indigo-200/70'
      };
    }
    if (normalized.includes('night')) {
      return {
        label: shiftName,
        style: 'bg-violet-50 text-violet-700 border-violet-200/70'
      };
    }
    return {
      label: shiftName,
      style: 'bg-blue-50 text-blue-700 border-blue-200'
    };
  };

  const getTodayISOString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const openAssignModal = (staff: any) => {
    setSelectedStaffForModal(staff);
    const existingShiftId = staff.currentShift?._id || generalShift?._id || (shifts[0]?._id ?? '');
    setModalShiftId(existingShiftId);

    const todayStr = getTodayISOString();
    setModalFromDate(todayStr);
    setModalToDate(todayStr);

    if (staff.currentShift?.scheduleType === 'SPECIFIC_DATES') {
      setModalScheduleType('SPECIFIC_DATES');
      if (staff.currentShift.effectiveFrom) {
        setModalFromDate(new Date(staff.currentShift.effectiveFrom).toISOString().split('T')[0]);
      }
      if (staff.currentShift.effectiveTo) {
        setModalToDate(new Date(staff.currentShift.effectiveTo).toISOString().split('T')[0]);
      }
    } else {
      setModalScheduleType('ALL_DAYS');
    }
  };

  const closeAssignModal = () => {
    setSelectedStaffForModal(null);
  };

  const handleSaveModal = async () => {
    if (!selectedStaffForModal) return;
    if (!modalShiftId) {
      toast.error('Please select a shift type.');
      return;
    }

    if (modalScheduleType === 'SPECIFIC_DATES') {
      if (!modalFromDate || !modalToDate) {
        toast.error('Please pick both start and end dates.');
        return;
      }
      if (new Date(modalToDate) < new Date(modalFromDate)) {
        toast.error('End date cannot be earlier than start date.');
        return;
      }
    }

    try {
      await assignShift({
        employeeId: selectedStaffForModal._id,
        shiftId: modalShiftId,
        scheduleType: modalScheduleType,
        effectiveFrom: modalScheduleType === 'SPECIFIC_DATES' ? modalFromDate : new Date().toISOString(),
        effectiveTo: modalScheduleType === 'SPECIFIC_DATES' ? modalToDate : null
      }).unwrap();

      toast.success(
        modalScheduleType === 'SPECIFIC_DATES'
          ? 'Date-specific shift scheduled successfully!'
          : 'Permanent shift assigned successfully!'
      );
      closeAssignModal();
      refetchStaff();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Failed to assign shift.');
    }
  };

  const formatScheduleSubtitle = (currentShift: any) => {
    if (!currentShift) return 'All Days';
    if (currentShift.scheduleType === 'SPECIFIC_DATES') {
      if (currentShift.effectiveFrom && currentShift.effectiveTo) {
        const fromDate = new Date(currentShift.effectiveFrom);
        const toDate = new Date(currentShift.effectiveTo);
        const fromStr = fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const toStr = toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return fromDate.toDateString() === toDate.toDateString()
          ? toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : `${fromStr} – ${toStr}`;
      }
      return 'Specific Dates';
    }
    return 'All Days';
  };

  const getInitials = (name?: string) => {
    if (!name) return 'ST';
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 animate-in fade-in duration-300">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff Shifts</h1>
          <p className="text-sm text-slate-500 mt-1">
            Assign and manage calendar-based work shifts for your department staff.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search staff by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* 2. Staff Shift Table Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Clean Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold text-slate-900">Department Staff</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200/60">
              {filteredStaff.length} Member{filteredStaff.length === 1 ? '' : 's'}
            </span>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">Active schedules</span>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-left text-sm text-slate-600">
            <thead className="bg-slate-50/75 border-b border-slate-100 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3.5">Staff Member</th>
                <th className="px-6 py-3.5">Current Shift</th>
                <th className="px-6 py-3.5">Timing</th>
                <th className="px-6 py-3.5 text-right pr-6">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffLoading || shiftsLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Loading staff and shift rosters...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                    <p className="text-sm font-medium text-slate-600">No staff members found.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchTerm ? 'Try adjusting your search criteria.' : 'No staff currently assigned to this department.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staff) => {
                  const staffName = staff.profile?.fullName || 'Staff Member';
                  const currentShift = staff.currentShift;
                  const badge = getShiftBadge(currentShift?.name);
                  const scheduleSubtitle = formatScheduleSubtitle(currentShift);

                  const currentTiming = currentShift
                    ? formatShiftTime(currentShift.startTime, currentShift.endTime)
                    : generalShift
                    ? formatShiftTime(generalShift.startTime, generalShift.endTime)
                    : 'Not Configured';

                  return (
                    <tr key={staff._id} className="hover:bg-slate-50/50 transition-colors">
                      {/* 1. Staff Member */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 font-semibold text-xs flex items-center justify-center shrink-0 border border-blue-100">
                            {getInitials(staffName)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate max-w-[180px] sm:max-w-[220px]">
                              {staffName}
                            </p>
                            <p className="text-xs text-slate-400 truncate max-w-[180px] sm:max-w-[220px]">
                              {staff.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* 2. Current Shift */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge.style}`}
                          >
                            {badge.label}
                          </span>
                          <p className="text-[11px] text-slate-400 font-normal">
                            {scheduleSubtitle}
                          </p>
                        </div>
                      </td>

                      {/* 3. Timing */}
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700 font-medium">
                        <span className="tabular-nums text-xs sm:text-sm text-slate-600">
                          {currentTiming}
                        </span>
                      </td>

                      {/* 4. Action */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => openAssignModal(staff)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-medium shadow-xs transition-all cursor-pointer active:scale-95 inline-flex items-center gap-1.5"
                        >
                          <CalendarDays className="w-3.5 h-3.5" />
                          <span>Assign Shift</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Clean Centered Assign Shift Modal */}
      {selectedStaffForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="max-w-md w-full rounded-2xl bg-white shadow-xl border border-slate-200/80 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Assign Shift</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Schedule shift for <strong className="text-slate-700">{selectedStaffForModal.profile?.fullName || selectedStaffForModal.email}</strong>
                </p>
              </div>
              <button
                onClick={closeAssignModal}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <div className="p-6 space-y-5">
              {/* Field 1: Shift Type */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Shift Type <span className="text-rose-500">*</span>
                </label>
                {shifts.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    No shifts created by Administration yet. Please contact your Admin to create shift templates.
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={modalShiftId}
                      onChange={(e) => setModalShiftId(e.target.value)}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                    >
                      {shifts.map((s: any) => (
                        <option key={s._id} value={s._id}>
                          {s.name} ({formatShiftTime(s.startTime, s.endTime)})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Field 2: Schedule Duration (Segmented Pill Toggle) */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Schedule Duration <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setModalScheduleType('ALL_DAYS')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      modalScheduleType === 'ALL_DAYS'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Days (Permanent)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalScheduleType('SPECIFIC_DATES')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      modalScheduleType === 'SPECIFIC_DATES'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Specific Calendar Dates
                  </button>
                </div>
              </div>

              {/* Field 3: Date Inputs (Shown when SPECIFIC_DATES is selected) */}
              {modalScheduleType === 'SPECIFIC_DATES' && (
                <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-3 animate-in fade-in duration-200">
                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>Select the start and end dates (inclusive) for this shift.</span>
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-slate-600">
                        From Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={modalFromDate}
                        onChange={(e) => setModalFromDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-slate-600">
                        To Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={modalToDate}
                        onChange={(e) => setModalToDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/50 shrink-0">
              <button
                type="button"
                onClick={closeAssignModal}
                disabled={isAssigning}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                disabled={isAssigning}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Shift</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentStaffShiftsPage;
