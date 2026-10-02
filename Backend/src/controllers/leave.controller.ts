import { Response } from 'express';
import { LeaveType } from '../models/leaveType.model';
import { LeaveBalance } from '../models/leaveBalance.model';
import { LeaveRequest } from '../models/leaveRequest.model';
import { User } from '../models/user.model';
import { Attendance } from '../models/attendance.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendResponse } from '../utils/response';
import { AuditService } from '../services/audit.service';
import { NotificationService } from '../services/notification.service';
import { uploadBufferToCloudinary } from '../utils/cloudinary';

/**
 * GET /api/leaves/types - List configured leave types
 */
export const getLeaveTypes = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    let types = await LeaveType.find({ isActive: true });
    if (types.length === 0) {
      // Auto-initialize standard leave types if none exist
      const standardTypes = [
        { name: 'Annual Paid Leave', code: 'ANNUAL', defaultDaysPerYear: 18, isPaid: true, requiresDocument: false },
        { name: 'Medical / Sick Leave', code: 'SICK', defaultDaysPerYear: 12, isPaid: true, requiresDocument: true },
        { name: 'Casual / Emergency Leave', code: 'CASUAL', defaultDaysPerYear: 10, isPaid: true, requiresDocument: false }
      ];
      for (const st of standardTypes) {
        await LeaveType.findOneAndUpdate(
          { code: st.code },
          { $setOnInsert: st },
          { upsert: true, new: true }
        );
      }
      types = await LeaveType.find({ isActive: true });
    }
    return sendResponse(response, 200, true, 'Leave types retrieved', types);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching leave types');
  }
};

/**
 * POST /api/leaves/types - Configure leave type (Admin)
 */
export const createLeaveType = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { name, code, defaultDaysPerYear, isPaid = true, requiresDocument = false } = request.body;

    const leaveType = await LeaveType.create({
      name,
      code,
      defaultDaysPerYear,
      isPaid,
      requiresDocument
    });

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'LEAVE_TYPE_CREATED',
      entityType: 'Leave',
      entityId: leaveType._id,
      previousValue: null,
      newValue: { name, code, defaultDaysPerYear },
      reason: 'Created new leave type'
    });

    return sendResponse(response, 201, true, 'Leave type configured successfully', leaveType);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error creating leave type');
  }
};

/**
 * GET /api/leaves/balances/me - Own leave balance
 */
export const getMyLeaveBalances = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const currentYear = new Date().getFullYear();

    // Ensure balances exist for this user in current year
    let balances = await LeaveBalance.find({ employeeId: user._id, year: currentYear })
      .populate('leaveTypeId');

    if (balances.length === 0) {
      let allTypes = await LeaveType.find({ isActive: true });
      if (allTypes.length === 0) {
        const standardTypes = [
          { name: 'Annual Paid Leave', code: 'ANNUAL', defaultDaysPerYear: 18, isPaid: true, requiresDocument: false },
          { name: 'Medical / Sick Leave', code: 'SICK', defaultDaysPerYear: 12, isPaid: true, requiresDocument: true },
          { name: 'Casual / Emergency Leave', code: 'CASUAL', defaultDaysPerYear: 10, isPaid: true, requiresDocument: false }
        ];
        for (const st of standardTypes) {
          await LeaveType.findOneAndUpdate(
            { code: st.code },
            { $setOnInsert: st },
            { upsert: true, new: true }
          );
        }
        allTypes = await LeaveType.find({ isActive: true });
      }

      for (const lt of allTypes) {
        await LeaveBalance.findOneAndUpdate(
          { employeeId: user._id, leaveTypeId: lt._id, year: currentYear },
          {
            $setOnInsert: {
              employeeId: user._id,
              leaveTypeId: lt._id,
              year: currentYear,
              allocatedDays: lt.defaultDaysPerYear,
              usedDays: 0,
              pendingDays: 0,
              remainingDays: lt.defaultDaysPerYear
            }
          },
          { upsert: true }
        );
      }
      balances = await LeaveBalance.find({ employeeId: user._id, year: currentYear })
        .populate('leaveTypeId');
    }

    return sendResponse(response, 200, true, 'Leave balances retrieved', balances);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error retrieving leave balances');
  }
};

/**
 * POST /api/leaves/requests - Submit leave request
 */
export const submitLeaveRequest = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { leaveTypeId, startDate, endDate, reason } = request.body;

    if (!leaveTypeId || !startDate || !endDate || !reason) {
      return sendResponse(response, 400, false, 'leaveTypeId, startDate, endDate, and reason are required.');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end.getTime() < start.getTime()) {
      return sendResponse(response, 400, false, 'End date cannot be earlier than start date.');
    }

    // Calculate calendar days
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Check for overlapping active requests
    const overlapping = await LeaveRequest.findOne({
      employeeId: user._id,
      status: { $in: ['SUBMITTED', 'APPROVED'] },
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ]
    });

    if (overlapping) {
      return sendResponse(response, 400, false, 'You already have a pending or approved leave request overlapping these dates.');
    }

    // Check if employee already has attendance records with checkInTime within the requested date range
    const startRange = new Date(start);
    startRange.setHours(0, 0, 0, 0);
    const endRange = new Date(end);
    endRange.setHours(23, 59, 59, 999);

    const checkedInAttendance = await Attendance.findOne({
      employeeId: user._id,
      checkInTime: { $exists: true, $ne: null },
      $or: [
        { date: { $gte: startRange, $lte: endRange } },
        { checkInTime: { $gte: startRange, $lte: endRange } }
      ]
    });

    if (checkedInAttendance) {
      return sendResponse(
        response,
        400,
        false,
        'You have already checked in today (or on one of the selected dates), so you cannot apply for leave on that day.'
      );
    }

    const leaveType = await LeaveType.findById(leaveTypeId);
    if (!leaveType) {
      return sendResponse(response, 404, false, 'Selected leave type not found.');
    }

    // Balance check for paid leaves
    const currentYear = start.getFullYear();
    if (leaveType.isPaid) {
      let balance = await LeaveBalance.findOne({
        employeeId: user._id,
        leaveTypeId,
        year: currentYear
      });

      if (!balance) {
        balance = await LeaveBalance.create({
          employeeId: user._id,
          leaveTypeId,
          year: currentYear,
          allocatedDays: leaveType.defaultDaysPerYear,
          usedDays: 0,
          pendingDays: 0,
          remainingDays: leaveType.defaultDaysPerYear
        });
      }

      if (balance.remainingDays < diffDays) {
        return sendResponse(response, 400, false, `Insufficient leave balance. Remaining: ${balance.remainingDays} days, Requested: ${diffDays} days.`);
      }

      // Reserve pending balance
      balance.pendingDays += diffDays;
      balance.remainingDays -= diffDays;
      await balance.save();
    }

    let supportingDocumentUrl: string | undefined;
    const file = (request as any).file;
    if (file) {
      supportingDocumentUrl = await uploadBufferToCloudinary(file.buffer, 'leave-documents');
    }

    const leaveRequest = await LeaveRequest.create({
      employeeId: user._id,
      leaveTypeId,
      startDate: start,
      endDate: end,
      totalDays: diffDays,
      reason,
      supportingDocumentUrl,
      status: 'SUBMITTED'
    });

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'LEAVE_REQUESTED',
      entityType: 'Leave',
      entityId: leaveRequest._id,
      previousValue: null,
      newValue: { startDate: start, endDate: end, totalDays: diffDays, reason },
      reason: 'Employee submitted leave request'
    });

    // Notify Department Head(s) of this department
    if (user.departmentId) {
      const staffName = user.profile?.fullName || (user as any).name || user.email || 'Staff';
      await NotificationService.notifyDepartmentHeads(user.departmentId, {
        type: 'leave_submitted',
        message: `**Staff Request:** ${staffName} submitted a ${leaveType.name || 'Leave'} request.`
      });
    }

    return sendResponse(response, 201, true, 'Leave request submitted successfully', leaveRequest);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error submitting leave request');
  }
};

/**
 * PATCH /api/leaves/requests/:id/review - Review Leave Request (Approve / Reject)
 */
export const reviewLeaveRequest = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const rawAction = request.body.action || request.body.status || '';
    const normalizedAction = String(rawAction).trim().toUpperCase();
    const rejectionReason = request.body.rejectionReason || request.body.reason || request.body.remarks || '';
    const user = request.user!;

    if (!['APPROVED', 'REJECTED'].includes(normalizedAction)) {
      return sendResponse(response, 400, false, 'Action must be "APPROVED" or "REJECTED".');
    }

    if (normalizedAction === 'REJECTED' && !rejectionReason) {
      return sendResponse(response, 400, false, 'Rejection reason is mandatory when rejecting leave.');
    }

    const leaveReq = await LeaveRequest.findById(id).populate('leaveTypeId');
    if (!leaveReq) {
      return sendResponse(response, 404, false, 'Leave request not found.');
    }

    // Rule: Employees cannot approve their own leave request
    if (leaveReq.employeeId.toString() === user._id.toString()) {
      return sendResponse(response, 403, false, 'Self-approval violation: You cannot approve your own leave request.');
    }

    if (leaveReq.status !== 'SUBMITTED') {
      return sendResponse(response, 400, false, `Leave request is already in ${leaveReq.status} state.`);
    }

    const leaveType = leaveReq.leaveTypeId as any;
    const year = new Date(leaveReq.startDate).getFullYear();

    if (leaveType && leaveType.isPaid) {
      const balance = await LeaveBalance.findOne({ employeeId: leaveReq.employeeId, leaveTypeId: leaveType._id, year });
      if (balance) {
        if (normalizedAction === 'APPROVED') {
          balance.pendingDays = Math.max(0, balance.pendingDays - leaveReq.totalDays);
          balance.usedDays += leaveReq.totalDays;
        } else {
          // Revert reserved pending days
          balance.pendingDays = Math.max(0, balance.pendingDays - leaveReq.totalDays);
          balance.remainingDays += leaveReq.totalDays;
        }
        await balance.save();
      }
    }

    leaveReq.status = normalizedAction as any;
    leaveReq.reviewedBy = user._id;
    leaveReq.reviewedAt = new Date();
    if (normalizedAction === 'REJECTED') leaveReq.rejectionReason = rejectionReason;
    await leaveReq.save();

    // If approved, reconcile attendance records
    if (normalizedAction === 'APPROVED') {
      // Reconcile attendance records for each day of approved leave (never overwrite days with existing checkInTime)
      const cur = new Date(leaveReq.startDate);
      while (cur <= new Date(leaveReq.endDate)) {
        const norm = new Date(cur);
        norm.setUTCHours(0, 0, 0, 0);

        // Check if an attendance record already exists with a checkInTime
        const existingAtt = await Attendance.findOne({
          employeeId: leaveReq.employeeId,
          date: norm
        });

        if (!existingAtt || !existingAtt.checkInTime) {
          await Attendance.findOneAndUpdate(
            { employeeId: leaveReq.employeeId, date: norm },
            {
              $set: {
                status: 'on_leave',
                leaveRequestId: leaveReq._id,
                workingHours: 0,
                notes: 'Approved Leave Reconciliation'
              },
              $unset: {
                checkInTime: 1,
                checkOutTime: 1
              }
            },
            { upsert: true, new: true }
          );
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: normalizedAction === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      entityType: 'Leave',
      entityId: leaveReq._id,
      previousValue: { status: 'SUBMITTED' },
      newValue: { status: normalizedAction, rejectionReason },
      reason: rejectionReason || 'Supervisor reviewed leave request'
    });

    const notifMessage = normalizedAction === 'APPROVED'
      ? `**Leave Approved:** Your leave request for ${leaveReq.totalDays} day(s) has been approved by your department supervisor.`
      : `**Leave Rejected:** Your leave request was rejected${rejectionReason ? `: "${rejectionReason}"` : '.'}`;

    await NotificationService.send({
      userId: leaveReq.employeeId,
      type: normalizedAction === 'APPROVED' ? 'leave_approved' : 'leave_rejected',
      title: `Leave Request ${normalizedAction}`,
      message: notifMessage,
      idempotencyKey: `notif_leave_rev_${leaveReq._id}_${normalizedAction}`
    });

    return sendResponse(response, 200, true, `Leave request ${normalizedAction.toLowerCase()} successfully`, leaveReq);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error reviewing leave request');
  }
};

/**
 * GET /api/leaves/requests - List leave requests (department-scoped for dept head)
 */
export const getAllLeaveRequests = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
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
      filter.status = (request.query.status as string).toUpperCase();
    }

    const requests = await LeaveRequest.find(filter)
      .populate('employeeId', 'email profile.fullName profile.avatar profile.profileImage')
      .populate('leaveTypeId')
      .populate('reviewedBy', 'email profile.fullName')
      .sort({ createdAt: -1 });

    return sendResponse(response, 200, true, 'Leave requests retrieved', requests);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching leave requests');
  }
};


