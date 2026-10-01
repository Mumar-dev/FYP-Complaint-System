import { Response } from 'express';
import { EmployeeTransfer } from '../models/employeeTransfer.model';
import { User } from '../models/user.model';
import { Department } from '../models/department.model';
import { EmploymentHistory } from '../models/employmentHistory.model';
import { Complaint } from '../models/complaint.model';
import { ComplaintAssignment } from '../models/complaintAssignment.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendResponse } from '../utils/response';
import { normalizeStaffRank } from '../utils/rank.util';
import { AuditService } from '../services/audit.service';
import { NotificationService } from '../services/notification.service';

/**
 * Helper to notify all active Admins and SuperAdmins
 */
const notifyAdmins = async (params: { title?: string; message: string; type?: any }) => {
  try {
    const admins = await User.find({ role: { $in: ['admin', 'superadmin'] }, accountStatus: 'active' }).select('_id');
    for (const admin of admins) {
      await NotificationService.send({
        userId: admin._id,
        type: params.type || 'employee_transfer',
        title: params.title || 'Staff Transfer Request',
        message: params.message
      });
    }
  } catch (err) {
    console.error('[EmployeeTransfer] Error notifying admins:', err);
  }
};

/**
 * GET /api/employee-transfers - List employee transfer requests
 * Filterable by status (REQUESTED / PENDING, APPROVED, REJECTED)
 */
export const getEmployeeTransfers = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { status, employeeId, departmentId } = request.query;

    const filter: any = {};

    if (status) {
      const s = String(status).toUpperCase();
      if (s === 'PENDING') {
        filter.status = { $in: ['REQUESTED', 'UNDER_REVIEW', 'PENDING'] };
      } else {
        filter.status = s;
      }
    }

    if (employeeId) {
      filter.employeeId = employeeId;
    }

    // If Department Head, allow seeing transfers originating from or targeting their department
    if (user.role === 'department_head') {
      const userDeptId = user.departmentId;
      filter.$or = [
        { currentDepartmentId: userDeptId },
        { targetDepartmentId: userDeptId },
        { requestedBy: user._id }
      ];
    } else if (departmentId) {
      filter.$or = [
        { currentDepartmentId: departmentId },
        { targetDepartmentId: departmentId }
      ];
    }

    const transfers = await EmployeeTransfer.find(filter)
      .populate('employeeId', 'profile.fullName profile.profileImage profile.avatar email profile.position designation rank departmentId')
      .populate('currentDepartmentId', 'name')
      .populate('targetDepartmentId', 'name')
      .populate('requestedBy', 'profile.fullName profile.profileImage profile.avatar email role')
      .populate('reviewedBy', 'profile.fullName profile.profileImage profile.avatar email role')
      .sort({ createdAt: -1 });

    return sendResponse(response, 200, true, 'Employee transfer requests retrieved', transfers);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching transfer requests');
  }
};

/**
 * POST /api/employee-transfers - Request employee department transfer
 * Supports both Dept Head and Admin initiation
 */
export const requestEmployeeTransfer = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { employeeId, targetDepartmentId, reason, effectiveDate = new Date() } = request.body;

    if (!employeeId || !targetDepartmentId || !reason) {
      return sendResponse(response, 400, false, 'employeeId, targetDepartmentId, and reason are required.');
    }

    const employee = await User.findById(employeeId);
    if (!employee) {
      return sendResponse(response, 404, false, 'Employee not found.');
    }

    const currentDeptId = employee.departmentId;
    if (!currentDeptId) {
      return sendResponse(response, 400, false, 'Employee does not have an assigned current department.');
    }

    // Dept Head scoping rule: Staff must belong to requesting Dept Head's department
    if (user.role === 'department_head') {
      if (!user.departmentId || currentDeptId.toString() !== user.departmentId.toString()) {
        return sendResponse(response, 403, false, 'You can only request transfers for staff within your department.');
      }
    }

    // Target department must be different
    if (currentDeptId.toString() === targetDepartmentId.toString()) {
      return sendResponse(response, 400, false, 'Target department must be different from current department.');
    }

    const targetDept = await Department.findById(targetDepartmentId);
    if (!targetDept) {
      return sendResponse(response, 404, false, 'Target department not found.');
    }

    // Check if there is already an active Pending transfer request
    const existingPending = await EmployeeTransfer.findOne({
      employeeId: employee._id,
      status: { $in: ['REQUESTED', 'UNDER_REVIEW', 'PENDING'] }
    });

    if (existingPending) {
      return sendResponse(
        response,
        400,
        false,
        'There is already a pending transfer request for this staff member.'
      );
    }

    const currentDept = await Department.findById(currentDeptId);

    const transfer = await EmployeeTransfer.create({
      employeeId: employee._id,
      currentDepartmentId: currentDeptId,
      targetDepartmentId,
      reason,
      requestedBy: user._id,
      effectiveDate: new Date(effectiveDate),
      status: 'REQUESTED'
    });

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'EMPLOYEE_TRANSFER_REQUESTED',
      entityType: 'Transfer',
      entityId: transfer._id,
      previousValue: { currentDepartmentId: currentDeptId },
      newValue: { targetDepartmentId },
      reason
    });

    // Notify Admin(s)
    const staffName = employee.profile?.fullName || employee.email || 'Staff';
    const deptHeadName = user.profile?.fullName || user.email || 'Department Head';
    const targetDeptName = targetDept.name || 'Target Department';
    const currentDeptName = currentDept?.name || 'Current Department';

    await notifyAdmins({
      title: 'Staff Transfer Request',
      message: `**Staff Transfer Request:** ${deptHeadName} requested to transfer ${staffName} from ${currentDeptName} to ${targetDeptName}.`
    });

    return sendResponse(response, 201, true, 'Employee transfer requested successfully', transfer);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error requesting transfer');
  }
};

/**
 * PATCH /api/employee-transfers/:id/review - Approve or Reject employee transfer (Admin / SuperAdmin)
 */
export const reviewEmployeeTransfer = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const user = request.user!;
    const rawAction = request.body.action || request.body.status || '';
    const rejectionReason = request.body.rejectionReason || request.body.remarks || request.body.reviewRemarks;

    const normalizedAction = String(rawAction).toUpperCase();

    if (!['APPROVED', 'REJECTED'].includes(normalizedAction)) {
      return sendResponse(response, 400, false, 'Action must be "APPROVED" or "REJECTED".');
    }

    const transfer = await EmployeeTransfer.findById(id)
      .populate('currentDepartmentId', 'name')
      .populate('targetDepartmentId', 'name');

    if (!transfer) {
      return sendResponse(response, 404, false, 'Transfer request not found.');
    }

    // Rule: Employee cannot approve their own transfer
    if (transfer.employeeId.toString() === user._id.toString()) {
      return sendResponse(response, 403, false, 'Self-approval violation: You cannot approve your own transfer.');
    }

    transfer.status = normalizedAction as any;
    transfer.reviewedBy = user._id;
    transfer.reviewedAt = new Date();
    if (normalizedAction === 'REJECTED') {
      transfer.rejectionReason = rejectionReason;
    }

    let reassignedCount = 0;
    const employee = await User.findById(transfer.employeeId);
    const targetDeptName = (transfer.targetDepartmentId as any)?.name || 'Target Department';
    const currentDeptName = (transfer.currentDepartmentId as any)?.name || 'Current Department';
    const staffName = employee?.profile?.fullName || employee?.email || 'Staff';

    if (normalizedAction === 'APPROVED' && employee) {
      const oldDeptId = employee.departmentId;

      // If this employee was the Department Head of their old department, clear headOfDepartment on that department
      if (oldDeptId) {
        await Department.updateMany(
          { _id: oldDeptId, headOfDepartment: employee._id },
          { $set: { headOfDepartment: null } }
        );
      }
      await Department.updateMany(
        { headOfDepartment: employee._id },
        { $set: { headOfDepartment: null } }
      );

      employee.departmentId = transfer.targetDepartmentId as any;
      if (employee.role === 'department_head' || employee.rank === 'head') {
        employee.role = 'staff';
        employee.rank = normalizeStaffRank(employee.previousRank);
        employee.previousRank = undefined;
      }
      // Note: For regular staff members, their existing rank is strictly preserved upon transfer!
      await employee.save();

      // Reassign all active complaints assigned to this employee in previous department
      const activeComplaints = await Complaint.find({
        $or: [
          { primaryStaffId: employee._id },
          { assignedStaffId: employee._id },
          { supportingStaffIds: employee._id }
        ],
        status: { $in: ['assigned', 'in_progress', 'under_verification'] }
      });

      reassignedCount = activeComplaints.length;
      for (const comp of activeComplaints) {
        if (comp.primaryStaffId?.toString() === employee._id.toString()) {
          comp.primaryStaffId = undefined;
          comp.assignedStaffId = undefined;
          comp.status = 'pending_assignment';
        }
        comp.supportingStaffIds = comp.supportingStaffIds.filter(
          (sid) => sid.toString() !== employee._id.toString()
        );
        await comp.save();

        // Deactivate assignment record
        await ComplaintAssignment.updateMany(
          { complaintId: comp._id, primaryStaffId: employee._id, isActive: true },
          {
            isActive: false,
            deactivatedAt: new Date(),
            deactivatedBy: user._id,
            deactivationReason: 'Employee transferred to new department'
          }
        );
      }

      // Record Employment History
      await EmploymentHistory.create({
        employeeId: employee._id,
        previousDesignation: employee.designation || 'Staff',
        newDesignation: employee.designation || 'Staff',
        previousDepartmentId: oldDeptId as any,
        newDepartmentId: transfer.targetDepartmentId,
        changeType: 'department_transfer',
        reason: transfer.reason,
        changedBy: user._id,
        effectiveDate: transfer.effectiveDate
      });

      transfer.isExecuted = true;
      transfer.reassignedComplaintsCount = reassignedCount;

      // 1. Notify the Transferred Staff Member
      await NotificationService.send({
        userId: transfer.employeeId,
        type: 'employee_transfer',
        title: 'Department Transfer Approved',
        message: `Your transfer to ${targetDeptName} has been approved.${reassignedCount > 0 ? ` ${reassignedCount} active complaint assignments were re-queued for handover.` : ''}`
      });

      // 2. Notify the Requesting Department Head
      if (transfer.requestedBy) {
        await NotificationService.send({
          userId: transfer.requestedBy,
          type: 'employee_transfer',
          title: 'Staff Transfer Approved',
          message: `The transfer of ${staffName} to ${targetDeptName} has been approved by Admin.`
        });
      }

      // 3. Notify the New Department Head(s)
      await NotificationService.notifyDepartmentHeads(transfer.targetDepartmentId as any, {
        type: 'employee_transfer',
        title: 'New Staff Member Transferred In',
        message: `**Staff Transfer:** ${staffName} has been transferred to your department from ${currentDeptName}.`
      });
    } else if (normalizedAction === 'REJECTED') {
      const recipientIds = new Set<string>();
      if (transfer.requestedBy) recipientIds.add(transfer.requestedBy.toString());
      if (transfer.employeeId) recipientIds.add(transfer.employeeId.toString());

      for (const recipientId of recipientIds) {
        const isRequestingHead = transfer.requestedBy && recipientId === transfer.requestedBy.toString();
        const msg = isRequestingHead
          ? `The transfer request for ${staffName} to ${targetDeptName} was rejected by Admin.${rejectionReason ? ` Reason: "${rejectionReason}"` : ''}`
          : `Your transfer request to ${targetDeptName} was rejected.${rejectionReason ? ` Reason: "${rejectionReason}"` : ''}`;

        await NotificationService.send({
          userId: recipientId,
          type: 'employee_transfer',
          title: isRequestingHead ? 'Staff Transfer Rejected' : 'Department Transfer Rejected',
          message: msg,
          idempotencyKey: `employee_transfer_rejected_${transfer._id}_${recipientId}`
        });
      }
    }

    await transfer.save();

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: normalizedAction === 'APPROVED' ? 'EMPLOYEE_TRANSFER_APPROVED' : 'EMPLOYEE_TRANSFER_REJECTED',
      entityType: 'Transfer',
      entityId: transfer._id,
      previousValue: { departmentId: transfer.currentDepartmentId },
      newValue: { departmentId: transfer.targetDepartmentId, reassignedComplaints: reassignedCount },
      reason: rejectionReason || transfer.reason
    });

    return sendResponse(response, 200, true, `Employee transfer ${normalizedAction.toLowerCase()} successfully`, transfer);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error reviewing transfer');
  }
};
