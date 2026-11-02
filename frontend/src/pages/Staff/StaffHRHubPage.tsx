import React, { useMemo } from 'react';
import Card from '@components/Common/Card';
import {
  Clock,
  Calendar,
  Loader2,
} from 'lucide-react';
import {
  useGetMyAttendanceQuery,
  useCheckInMutation,
  useCheckOutMutation,
} from '@/features/hr/hr.api';
import toast from 'react-hot-toast';

export const StaffHRHubPage: React.FC = () => {
  // Attendance query & actions
  const { data: attendanceData, isLoading: attendanceLoading, refetch: refetchAttendance } = useGetMyAttendanceQuery();
  const [checkIn, { isLoading: checkingIn }] = useCheckInMutation();
  const [checkOut, { isLoading: checkingOut }] = useCheckOutMutation();

  const handleCheckIn = async () => {
    try {
      await checkIn().unwrap();
      toast.success('Check-in recorded successfully!');
      await refetchAttendance();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to check in');
    }
  };

  const handleCheckOut = async () => {
    try {
      await checkOut().unwrap();
      toast.success('Check-out recorded successfully!');
      await refetchAttendance();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to check out');
    }
  };

  const attendanceRecords = attendanceData?.data || [];

  // Identify today's record and states
  const todayRecord = useMemo(() => {
    if (!attendanceRecords || attendanceRecords.length === 0) return null;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return attendanceRecords.find((rec: any) => {
      if (!rec.date && !rec.checkInTime) return false;
      const recDate = new Date(rec.date || rec.checkInTime);
      const recDateStr = `${recDate.getFullYear()}-${String(recDate.getMonth() + 1).padStart(2, '0')}-${String(recDate.getDate()).padStart(2, '0')}`;
      return recDateStr === todayStr;
    });
  }, [attendanceRecords]);

  const isTodayOnLeave = todayRecord?.status?.toLowerCase() === 'on_leave';
  const isCheckedIn = !!todayRecord?.checkInTime;
  const isCheckedOut = !!todayRecord?.checkOutTime;

  const todayFormattedDate = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '--:--';
    try {
      const d = new Date(timeStr);
      return isNaN(d.getTime())
        ? timeStr
        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return timeStr;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime())
        ? dateStr
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getAttendanceStatusBadge = (record: any) => {
    const normalizedStatus = (record.status || '').toLowerCase();
    if (normalizedStatus === 'on_leave' || normalizedStatus === 'leave') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/70">
          On Leave
        </span>
      );
    }
    if (normalizedStatus === 'half_day') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/70">
          Half Day
        </span>
      );
    }

    if (record.checkInTime && !record.checkOutTime) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/70">
          Missing Punch
        </span>
      );
    }
    if (record.checkInTime && record.checkOutTime) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
          Present
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        {record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1).toLowerCase().replace('_', ' ') : 'Absent'}
      </span>
    );
  };

  const assignedShift = (attendanceData as any)?.assignedShift;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 animate-in fade-in duration-300">
      {/* 1. Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Attendance</h1>
        <p className="text-sm text-slate-500 mt-1">
          Track your daily check-ins, working hours, and attendance logs.
        </p>
      </div>

      {/* 2. Hero Smart Check-In / Check-Out Status Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Date & Status */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>
              {assignedShift?.name || 'General Shift'}
              {assignedShift?.startTime && assignedShift?.endTime ? (
                <span className="text-slate-400 font-normal ml-1.5 normal-case">
                  ({assignedShift.startTime} – {assignedShift.endTime})
                </span>
              ) : (
                <span className="text-slate-400 font-normal ml-1.5 normal-case">(09:00 AM – 05:00 PM)</span>
              )}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {todayFormattedDate}
          </h2>
          <div className="flex items-center gap-2 pt-0.5 text-xs sm:text-sm text-slate-600">
            {isTodayOnLeave ? (
              <span className="inline-flex items-center gap-1.5 text-blue-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                On approved leave today
              </span>
            ) : !isCheckedIn ? (
              <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                Not checked in yet
              </span>
            ) : isCheckedIn && !isCheckedOut && todayRecord ? (
              <span className="inline-flex items-center gap-1.5 text-blue-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                Checked in at <strong className="font-semibold text-slate-900">{formatTime(todayRecord.checkInTime)}</strong>
              </span>
            ) : todayRecord ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Shift completed
              </span>
            ) : null}
          </div>
        </div>

        {/* Right: Smart Single Action Button */}
        <div>
          {isTodayOnLeave ? (
            <div className="inline-flex items-center justify-center min-w-[140px] px-5 py-2.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-sm font-medium">
              On Leave Today
            </div>
          ) : !isCheckedIn ? (
            <button
              onClick={handleCheckIn}
              disabled={checkingIn}
              className="w-full sm:w-auto inline-flex items-center justify-center min-w-[140px] px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {checkingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Recording...
                </>
              ) : (
                'Check In'
              )}
            </button>
          ) : !isCheckedOut ? (
            <button
              onClick={handleCheckOut}
              disabled={checkingOut}
              className="w-full sm:w-auto inline-flex items-center justify-center min-w-[140px] px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {checkingOut ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Recording...
                </>
              ) : (
                'Check Out'
              )}
            </button>
          ) : (
            <button
              disabled
              className="w-full sm:w-auto inline-flex items-center justify-center min-w-[140px] px-6 py-3 rounded-xl bg-slate-100 text-slate-400 text-sm font-medium border border-slate-200 cursor-not-allowed"
            >
              Shift Ended
            </button>
          )}
        </div>
      </div>

      {/* 3. Dedicated Attendance Logs Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Attendance Logs</h3>
          </div>
          <span className="text-xs text-slate-500">Showing latest records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/75 border-b border-slate-100 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Shift</th>
                <th className="px-6 py-3.5">Check In</th>
                <th className="px-6 py-3.5">Check Out</th>
                <th className="px-6 py-3.5">Working Hours</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attendanceLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Loading attendance logs...</span>
                    </div>
                  </td>
                </tr>
              ) : attendanceRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    No attendance logs recorded yet.
                  </td>
                </tr>
              ) : (
                attendanceRecords.map((record: any) => (
                  <tr key={record._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                      {formatDate(record.date || record.checkInTime)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                      {record.shiftId?.name || record.shift?.name || assignedShift?.name || 'General Shift'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {record.status?.toLowerCase() === 'on_leave' || !record.checkInTime
                        ? '—'
                        : formatTime(record.checkInTime)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {record.status?.toLowerCase() === 'on_leave' || !record.checkOutTime
                        ? '—'
                        : formatTime(record.checkOutTime)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-700">
                      {record.status?.toLowerCase() === 'on_leave'
                        ? '—'
                        : record.workingHours || record.totalWorkHours
                        ? `${record.workingHours || record.totalWorkHours}h`
                        : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getAttendanceStatusBadge(record)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StaffHRHubPage;
