import { Response } from 'express';
import { User } from '../models/user.model';
import { Attendance } from '../models/attendance.model';
import { LeaveRequest } from '../models/leaveRequest.model';
import { PerformanceEvaluation } from '../models/performanceEvaluation.model';
import { PromotionRequest } from '../models/promotionRequest.model';
import { DisciplinaryCase } from '../models/disciplinaryCase.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendResponse } from '../utils/response';

/**
 * GET /api/hr-dashboard/overview - HR Metrics Overview
 */
export const getHROverview = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const now = new Date();
    const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Clean up any historical permanently persisted ON_LEAVE statuses in MongoDB
    await User.updateMany(
      { employmentStatus: 'ON_LEAVE' },
      { $set: { employmentStatus: 'ACTIVE' } }
    );

    // 1. Query today's attendance records to detect check-ins or on_leave statuses
    const todayAttendances = await Attendance.find({
      date: { $gte: startOfToday, $lte: endOfToday }
    }).select('employeeId checkInTime status');

    const checkedInUserIds = new Set<string>();
    const onLeaveAttendanceUserIds = new Set<string>();

    todayAttendances.forEach(att => {
      if (!att.employeeId) return;
      const empIdStr = att.employeeId.toString();
      if (att.checkInTime || ['present', 'late', 'half_day'].includes((att.status || '').toLowerCase())) {
        checkedInUserIds.add(empIdStr);
      } else if ((att.status || '').toLowerCase() === 'on_leave') {
        onLeaveAttendanceUserIds.add(empIdStr);
      }
    });

    // 2. Approved leaves covering today
    const approvedLeavesToday = await LeaveRequest.find({
      status: 'APPROVED',
      startDate: { $lte: endOfToday },
      endDate: { $gte: startOfToday }
    }).select('employeeId startDate endDate');

    const onLeaveUserIdSet = new Set<string>();
    approvedLeavesToday.forEach(l => {
      if (!l.employeeId) return;
      const empIdStr = l.employeeId.toString();
      const s = new Date(l.startDate);
      const e = new Date(l.endDate);
      const sYMD = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
      const eYMD = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
      if (sYMD <= todayYMD && eYMD >= todayYMD) {
        onLeaveUserIdSet.add(empIdStr);
      }
    });

    onLeaveAttendanceUserIds.forEach(id => {
      if (!checkedInUserIds.has(id)) {
        onLeaveUserIdSet.add(id);
      }
    });

    // Load workforce users with identical role filter as /api/employees
    const workforceUsers = await User.find({
      role: { $in: ['staff', 'supervisor', 'department_head', 'admin'] }
    }).select('_id employmentStatus accountStatus');

    let totalEmployees = workforceUsers.length;
    let activeEmployees = 0;
    let onLeaveEmployees = 0;
    let suspendedEmployees = 0;

    workforceUsers.forEach(u => {
      const uIdStr = u._id.toString();
      const storedStatus = (u.employmentStatus || u.accountStatus?.toUpperCase() || 'ACTIVE').toUpperCase();
      let effectiveStatus = storedStatus;

      if (['SUSPENDED', 'TERMINATED', 'RESIGNED'].includes(storedStatus)) {
        effectiveStatus = storedStatus;
      } else if (checkedInUserIds.has(uIdStr)) {
        effectiveStatus = 'ACTIVE';
      } else if (onLeaveUserIdSet.has(uIdStr)) {
        effectiveStatus = 'ON_LEAVE';
      } else if (storedStatus === 'ON_LEAVE') {
        effectiveStatus = 'ACTIVE';
      }

      if (effectiveStatus === 'ON_LEAVE') {
        onLeaveEmployees++;
      } else if (effectiveStatus === 'SUSPENDED') {
        suspendedEmployees++;
      } else if (effectiveStatus === 'ACTIVE') {
        activeEmployees++;
      }
    });

    const [
      todayPresent,
      pendingLeaves,
      pendingPromotions,
      openDisciplinaryCases
    ] = await Promise.all([
      Attendance.countDocuments({ date: { $gte: startOfToday, $lte: endOfToday }, status: 'present' }),
      LeaveRequest.countDocuments({ status: 'SUBMITTED' }),
      PromotionRequest.countDocuments({ status: 'SUBMITTED' }),
      DisciplinaryCase.countDocuments({ status: { $in: ['OPEN', 'UNDER_REVIEW'] } })
    ]);

    return sendResponse(response, 200, true, 'HR Overview metrics retrieved', {
      headcount: {
        total: totalEmployees,
        active: activeEmployees,
        onLeave: onLeaveEmployees,
        suspended: suspendedEmployees
      },
      // Flat properties for direct compatibility
      totalEmployees,
      activeEmployees,
      onLeaveEmployees,
      suspendedEmployees,
      attendanceToday: {
        present: todayPresent,
        attendanceRate: totalEmployees > 0 ? Number(((todayPresent / totalEmployees) * 100).toFixed(1)) : 0
      },
      pendingActions: {
        leaves: pendingLeaves,
        promotions: pendingPromotions,
        disciplinaryCases: openDisciplinaryCases
      }
    });
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error generating HR overview');
  }
};

