import { Response } from 'express';
import { Attendance } from '../models/attendance.model';
import { AttendanceCorrection } from '../models/attendanceCorrection.model';
import { EmployeeShiftAssignment } from '../models/employeeShiftAssignment.model';
import { Shift } from '../models/shift.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendResponse } from '../utils/response';
import { AuditService } from '../services/audit.service';
import { NotificationService } from '../services/notification.service';
import { resolveEmployeeShiftForDate, isWithinCheckInWindow } from '../services/shiftResolution.service';

/**
 * Normalizes a date to local YYYY-MM-DD 00:00:00 UTC
 * Uses the local calendar year/month/date so local midnight transitions (e.g. 01:13 AM PKT)
 * are recorded on the correct calendar day rather than the previous UTC day.
 */
const getNormalizedDate = (d: Date = new Date()): Date => {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
};

/**
 * POST /api/attendance/check-in - Employee Check-in
 */
export const checkIn = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { method = 'web', location, notes } = request.body || {};

    if (user.employmentStatus === 'SUSPENDED' || user.employmentStatus === 'TERMINATED') {
      return sendResponse(response, 403, false, 'Check-in blocked: Account is suspended or terminated.');
    }

    const todayNormalized = getNormalizedDate();

    // Check if an attendance record exists for today matching employeeId and normalized date
    const startOfLocalDay = new Date();
    startOfLocalDay.setHours(0, 0, 0, 0);
    const endOfLocalDay = new Date();
    endOfLocalDay.setHours(23, 59, 59, 999);

    const existingRecord = await Attendance.findOne({
      employeeId: user._id,
      $or: [
        { date: todayNormalized },
        { checkInTime: { $gte: startOfLocalDay, $lte: endOfLocalDay } }
      ]
    });

    if (existingRecord) {
      if (existingRecord.status === 'on_leave') {
        return sendResponse(response, 400, false, 'You are on approved leave today and cannot check in.');
      }
      if (existingRecord.checkInTime) {
        return sendResponse(response, 400, false, 'You have already checked in today.');
      }
    }

    // Determine assigned shift for today (calendar specific -> all days -> default)
    const resolvedShift = await resolveEmployeeShiftForDate(user._id, new Date());
    const shift = resolvedShift.shift;

    // Enforce Shift Time Window on Check-In ONLY
    if (shift) {
      const windowCheck = isWithinCheckInWindow(shift, new Date(), 30);
      if (!windowCheck.allowed) {
        return sendResponse(response, 400, false, windowCheck.message || 'You cannot check in at this time.');
      }
    }

    let isLate = false;

    if (shift && shift.startTime) {
      const now = new Date();
      const [startHour, startMin] = shift.startTime.split(':').map(Number);
      const shiftStartTime = new Date(now);
      shiftStartTime.setHours(startHour, startMin, 0, 0);

      const graceMs = (shift.gracePeriodMinutes || 15) * 60 * 1000;
      if (now.getTime() > shiftStartTime.getTime() + graceMs) {
        isLate = true;
      }
    }

    let attendance;
    if (existingRecord) {
      existingRecord.shiftId = shift?._id;
      existingRecord.checkInTime = new Date();
      existingRecord.checkInMethod = method;
      existingRecord.checkInLocation = location;
      existingRecord.isLate = isLate;
      existingRecord.status = 'present';
      existingRecord.notes = notes;
      attendance = await existingRecord.save();
    } else {
      attendance = await Attendance.create({
        employeeId: user._id,
        date: todayNormalized,
        shiftId: shift?._id,
        checkInTime: new Date(),
        checkInMethod: method,
        checkInLocation: location,
        isLate,
        status: 'present',
        notes
      });
    }

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'ATTENDANCE_CHECK_IN',
      entityType: 'Attendance',
      entityId: attendance._id,
      previousValue: null,
      newValue: { checkInTime: attendance.checkInTime, isLate },
      reason: 'Employee checked in'
    });

    // Notify Department Head(s) of this department about the staff check-in
    if (user.departmentId && attendance.checkInTime) {
      const staffName = user.profile?.fullName || (user as any).name || user.email || 'Staff';
      const checkInFormatted = new Date(attendance.checkInTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      await NotificationService.notifyDepartmentHeads(user.departmentId, {
        type: 'check_in',
        message: `**Check-In:** ${staffName} checked in at ${checkInFormatted}.`
      });
    }

    return sendResponse(response, 201, true, 'Check-in successful', attendance);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error during check-in');
  }
};

/**
 * POST /api/attendance/check-out - Employee Check-out
 */
export const checkOut = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { location } = request.body || {};
    const todayNormalized = getNormalizedDate();

    const startOfLocalDay = new Date();
    startOfLocalDay.setHours(0, 0, 0, 0);
    const endOfLocalDay = new Date();
    endOfLocalDay.setHours(23, 59, 59, 999);

    // Look for today's record by normalized date, checkInTime in local day, or open session without checkout
    let attendance = await Attendance.findOne({
      employeeId: user._id,
      $or: [
        { date: todayNormalized },
        { checkInTime: { $gte: startOfLocalDay, $lte: endOfLocalDay } },
        { checkOutTime: { $exists: false } }
      ]
    }).sort({ checkInTime: -1 });

    if (!attendance) {
      return sendResponse(response, 400, false, 'No check-in record found for today. Check-in first.');
    }

    if (attendance.checkOutTime) {
      return sendResponse(response, 400, false, 'You have already checked out for today.');
    }

    const checkOutTime = new Date();
    const checkInDate = attendance.checkInTime ? new Date(attendance.checkInTime) : new Date();
    const durationMs = checkOutTime.getTime() - checkInDate.getTime();
    if (durationMs < 0) {
      return sendResponse(response, 400, false, 'Check-out time cannot be earlier than check-in time.');
    }

    const totalHours = Number((durationMs / (1000 * 60 * 60)).toFixed(2));
    let overtimeHours = 0;
    let isEarlyDeparture = false;

    // Check against shift policy
    if (attendance.shiftId) {
      const shift = await Shift.findById(attendance.shiftId);
      if (shift) {
        const threshold = shift.overtimeThresholdHours || 8;
        if (totalHours > threshold) {
          overtimeHours = Number((totalHours - threshold).toFixed(2));
        }

        // Early departure check
        const [endH, endM] = shift.endTime.split(':').map(Number);
        const shiftEndTime = new Date(checkOutTime);
        shiftEndTime.setHours(endH, endM, 0, 0);
        if (checkOutTime.getTime() < shiftEndTime.getTime() - 15 * 60 * 1000) {
          isEarlyDeparture = true;
        }
      }
    }

    attendance.checkOutTime = checkOutTime;
    attendance.checkOutLocation = location;
    attendance.workingHours = totalHours;
    attendance.overtimeHours = overtimeHours;
    attendance.isEarlyDeparture = isEarlyDeparture;
    await attendance.save();

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'ATTENDANCE_CHECK_OUT',
      entityType: 'Attendance',
      entityId: attendance._id,
      previousValue: null,
      newValue: { checkOutTime, workingHours: totalHours, overtimeHours },
      reason: 'Employee checked out'
    });

    // Notify Department Head(s) of this department about the staff check-out
    if (user.departmentId) {
      const staffName = user.profile?.fullName || (user as any).name || user.email || 'Staff';
      const checkOutFormatted = new Date(checkOutTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      await NotificationService.notifyDepartmentHeads(user.departmentId, {
        type: 'check_out',
        message: `**Check-Out:** ${staffName} checked out at ${checkOutFormatted}.`
      });
    }

    return sendResponse(response, 200, true, 'Check-out successful', attendance);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error during check-out');
  }
};

/**
 * GET /api/attendance/me - Own attendance history
 */
export const getMyAttendance = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    // Clean up any historical on_leave or absent records where checkInTime was mistakenly set to midnight UTC
    await Attendance.updateMany(
      { employeeId: user._id, status: { $in: ['on_leave', 'absent'] }, checkInTime: { $exists: true } },
      { $unset: { checkInTime: 1, checkOutTime: 1 }, $set: { workingHours: 0 } }
    );

    const records = await Attendance.find({ employeeId: user._id })
      .populate('shiftId', 'name startTime endTime')
      .sort({ date: -1, checkInTime: -1 })
      .limit(60);

    const todayNormalized = getNormalizedDate();
    const startOfLocalDay = new Date();
    startOfLocalDay.setHours(0, 0, 0, 0);
    const endOfLocalDay = new Date();
    endOfLocalDay.setHours(23, 59, 59, 999);

    // Get resolved active shift for staff for today
    const resolvedShift = await resolveEmployeeShiftForDate(user._id, new Date());

    // Find today's attendance: strictly for today's local date
    const todayAttendance = records.find((r: any) => {
      const rDateNorm = getNormalizedDate(new Date(r.date)).getTime();
      const isDateMatch = rDateNorm === todayNormalized.getTime();
      const inLocalDay = r.checkInTime && new Date(r.checkInTime) >= startOfLocalDay && new Date(r.checkInTime) <= endOfLocalDay;
      const isOpenSessionToday = r.checkInTime && !r.checkOutTime && (new Date().getTime() - new Date(r.checkInTime).getTime() < 24 * 60 * 60 * 1000);
      return isDateMatch || inLocalDay || isOpenSessionToday;
    }) || null;

    return response.status(200).json({
      success: true,
      message: 'Attendance history retrieved',
      data: records,
      todayAttendance,
      assignedShift: resolvedShift.shift || null
    });
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching attendance');
  }
};

/**
 * POST /api/attendance/corrections - Submit attendance correction request
 */
export const requestAttendanceCorrection = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { attendanceId, correctedCheckIn, correctedCheckOut, reason } = request.body;

    if (!attendanceId || !correctedCheckIn || !reason) {
      return sendResponse(response, 400, false, 'attendanceId, correctedCheckIn, and reason are required.');
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return sendResponse(response, 404, false, 'Attendance record not found.');
    }

    const correction = await AttendanceCorrection.create({
      attendanceId: attendance._id,
      employeeId: user._id,
      originalCheckIn: attendance.checkInTime,
      originalCheckOut: attendance.checkOutTime,
      correctedCheckIn: new Date(correctedCheckIn),
      correctedCheckOut: correctedCheckOut ? new Date(correctedCheckOut) : undefined,
      reason,
      requestedBy: user._id,
      status: 'pending'
    });

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'ATTENDANCE_CORRECTION_REQUESTED',
      entityType: 'Attendance',
      entityId: attendance._id,
      previousValue: { checkIn: attendance.checkInTime, checkOut: attendance.checkOutTime },
      newValue: { correctedCheckIn, correctedCheckOut },
      reason
    });

    // Notify Department Head(s) of this department about the staff Missing Punch request
    if (user.departmentId) {
      const staffName = user.profile?.fullName || (user as any).name || user.email || 'Staff';
      await NotificationService.notifyDepartmentHeads(user.departmentId, {
        type: 'attendance_correction',
        message: `**Staff Request:** ${staffName} submitted a Missing Punch request.`
      });
    }

    return sendResponse(response, 201, true, 'Attendance correction request submitted for supervisor review', correction);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error submitting correction request');
  }
};

/**
 * PATCH /api/attendance/corrections/:id/review - Supervisor/Admin reviews correction
 */
export const reviewAttendanceCorrection = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const rawAction = request.body.action || request.body.status || '';
    const normalizedAction = String(rawAction).trim().toLowerCase(); // 'approved' | 'rejected'
    const reviewRemarks = request.body.reviewRemarks || request.body.rejectionReason || request.body.reason || request.body.remarks;
    const user = request.user!;

    if (!['approved', 'rejected'].includes(normalizedAction)) {
      return sendResponse(response, 400, false, 'Action must be "approved" or "rejected".');
    }

    const correction = await AttendanceCorrection.findById(id);
    if (!correction) {
      return sendResponse(response, 404, false, 'Correction request not found.');
    }

    // Rule: Employees cannot approve their own attendance correction
    if (correction.employeeId.toString() === user._id.toString()) {
      return sendResponse(response, 403, false, 'Self-approval violation: You cannot approve your own attendance correction.');
    }

    correction.status = normalizedAction as any;
    correction.reviewedBy = user._id;
    correction.reviewedAt = new Date();
    correction.reviewRemarks = reviewRemarks;
    await correction.save();

    if (normalizedAction === 'approved') {
      const attendance = await Attendance.findById(correction.attendanceId);
      if (attendance) {
        attendance.checkInTime = correction.correctedCheckIn;
        if (correction.correctedCheckOut) {
          attendance.checkOutTime = correction.correctedCheckOut;
          const diffMs = new Date(correction.correctedCheckOut).getTime() - new Date(correction.correctedCheckIn).getTime();
          attendance.workingHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
        }
        attendance.isCorrected = true;
        await attendance.save();
      }
    }

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: normalizedAction === 'approved' ? 'ATTENDANCE_CORRECTION_APPROVED' : 'ATTENDANCE_CORRECTION_REJECTED',
      entityType: 'Attendance',
      entityId: correction.attendanceId,
      previousValue: null,
      newValue: { status: normalizedAction, reviewRemarks },
      reason: reviewRemarks || 'Supervisor reviewed attendance correction'
    });

    const notifMsg = normalizedAction === 'approved'
      ? 'Your attendance correction request has been approved by supervisor.'
      : `Your attendance correction request was rejected${reviewRemarks ? `: "${reviewRemarks}"` : '.'}`;

    await NotificationService.send({
      userId: correction.employeeId,
      type: 'attendance_correction',
      title: `Attendance Correction ${normalizedAction.toUpperCase()}`,
      message: notifMsg,
      idempotencyKey: `notif_att_corr_${correction._id}_${normalizedAction}`
    });

    return sendResponse(response, 200, true, `Attendance correction ${normalizedAction} successfully`, correction);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error reviewing correction');
  }
};

/**
 * GET /api/attendance/corrections - Fetch attendance correction requests (Department-scoped for dept head)
 */
export const getAttendanceCorrections = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const filter: any = {};

    if (user.role === 'department_head' || user.role === 'supervisor') {
      if (user.departmentId) {
        const deptStaff = await require('../models/user.model').User.find({
          departmentId: user.departmentId,
          role: { $in: ['staff', 'supervisor'] }
        }).select('_id');
        const staffIds = deptStaff.map((s: any) => s._id);
        filter.employeeId = { $in: staffIds };
      }
    } else if (user.role === 'staff') {
      filter.employeeId = user._id;
    }

    if (request.query.status) {
      filter.status = request.query.status;
    }

    const corrections = await AttendanceCorrection.find(filter)
      .populate('employeeId', 'email profile.fullName profile.avatar profile.profileImage')
      .populate('attendanceId')
      .populate('reviewedBy', 'email profile.fullName')
      .sort({ createdAt: -1 });

    return sendResponse(response, 200, true, 'Attendance corrections retrieved', corrections);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching corrections');
  }
};

/**
 * GET /api/attendance/department - Department-scoped attendance logs & insights
 */
export const getDepartmentAttendance = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    let departmentId = user.departmentId ? user.departmentId.toString() : undefined;

    if (user.role !== 'department_head' && user.role !== 'supervisor') {
      departmentId = (request.query.departmentId as string) || departmentId;
    }

    if (!departmentId) {
      return sendResponse(response, 400, false, 'No department associated with current user.');
    }

    // Optional query filters
    const { employeeId, month, year } = request.query;

    // Find all staff belonging to this department (strictly regular staff members)
    const allDeptStaff = await require('../models/user.model').User.find({
      departmentId,
      role: { $in: ['staff', 'supervisor'] }
    }).select('_id email profile role accountStatus');

    let staffIds = allDeptStaff.map((s: any) => s._id);
    if (employeeId && employeeId !== 'all') {
      staffIds = staffIds.filter((id: any) => id.toString() === employeeId.toString());
    }

    // Build date filter (default to specified month/year or current month)
    const now = new Date();
    const targetYear = year ? parseInt(year as string, 10) : now.getFullYear();
    const targetMonth = month ? parseInt(month as string, 10) - 1 : now.getMonth();

    const startOfMonth = new Date(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999));

    const attendanceFilter: any = {
      employeeId: { $in: staffIds },
      date: { $gte: startOfMonth, $lte: endOfMonth }
    };

    const records = await Attendance.find(attendanceFilter)
      .populate('employeeId', 'email profile.fullName profile.name profile.avatar profile.profileImage role designation')
      .populate('shiftId', 'name startTime endTime')
      .sort({ date: -1, checkInTime: -1 });

    // Format records so frontend receives uniform employee and record properties
    const formattedRecords = records.map((rec: any) => {
      const recObj = rec.toObject ? rec.toObject() : rec;
      const emp = recObj.employeeId || {};
      const empName = emp.profile?.fullName || emp.profile?.name || emp.name || emp.email || 'Staff Member';
      return {
        ...recObj,
        employee: {
          _id: emp._id,
          name: empName,
          email: emp.email,
          designation: emp.designation || emp.role,
          profile: emp.profile,
          ...emp
        },
        // Ensure totalWorkHours matches workingHours if not present
        totalWorkHours: recObj.totalWorkHours ?? recObj.workingHours
      };
    });

    // Compute monthly insights / averages
    let totalMinutes = 0;
    let checkInMinutesSum = 0;
    let checkInCount = 0;
    let checkOutMinutesSum = 0;
    let checkOutCount = 0;
    let totalAbsences = 0;

    records.forEach((rec) => {
      if (rec.status === 'absent') {
        totalAbsences++;
      }
      if (rec.workingHours) {
        totalMinutes += rec.workingHours * 60;
      }
      if (rec.checkInTime) {
        const d = new Date(rec.checkInTime);
        checkInMinutesSum += d.getHours() * 60 + d.getMinutes();
        checkInCount++;
      }
      if (rec.checkOutTime) {
        const d = new Date(rec.checkOutTime);
        checkOutMinutesSum += d.getHours() * 60 + d.getMinutes();
        checkOutCount++;
      }
    });

    const formatTimeMinutes = (minTotal: number) => {
      const h = Math.floor(minTotal / 60);
      const m = Math.floor(minTotal % 60);
      return `${h}h ${m}m`;
    };

    const formatClockTime = (avgMin: number) => {
      if (isNaN(avgMin)) return '--:--';
      const hours = Math.floor(avgMin / 60) % 24;
      const mins = Math.floor(avgMin % 60);
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayH = hours % 12 || 12;
      return `${String(displayH).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;
    };

    const avgDurationMin = checkInCount > 0 ? totalMinutes / checkInCount : 0;
    const avgCheckInMin = checkInCount > 0 ? checkInMinutesSum / checkInCount : NaN;
    const avgCheckOutMin = checkOutCount > 0 ? checkOutMinutesSum / checkOutCount : NaN;

    const insights = {
      totalTimeSpent: formatTimeMinutes(totalMinutes),
      averageCheckInTime: formatClockTime(avgCheckInMin),
      averageCheckOutTime: formatClockTime(avgCheckOutMin),
      averageDuration: formatTimeMinutes(avgDurationMin),
      totalAbsences
    };

    return sendResponse(response, 200, true, 'Department attendance retrieved', {
      records: formattedRecords,
      insights,
      staff: allDeptStaff
    });
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching department attendance');
  }
};


