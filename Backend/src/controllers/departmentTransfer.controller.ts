import { Response } from 'express';
import { Department } from '../models/department.model';
import { Complaint } from '../models/complaint.model';
import { DepartmentTransferHistory } from '../models/departmentTransferHistory.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendResponse } from '../utils/response';
import { AuditService } from '../services/audit.service';
import { NotificationService } from '../services/notification.service';

/**
 * Transfer a complaint to another department with mandatory reason and authorization.
 */
export const transferComplaintDepartment = async (
  request: AuthenticatedRequest,
  response: Response
): Promise<any> => {
  try {
    const { complaintId } = request.params;
    const { targetDepartmentId, reason } = request.body;
    const user = request.user!;

    if (!targetDepartmentId || !reason || reason.trim().length === 0) {
      return sendResponse(response, 400, false, 'Target department and a valid reason are mandatory.');
    }

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return sendResponse(response, 404, false, 'Complaint not found.');
    }

    // Role verification: Department heads can only transfer complaints belonging to their own department
    if (user.role === 'department_head' && complaint.departmentId.toString() !== user.departmentId?.toString()) {
      return sendResponse(response, 403, false, 'Department Head can only transfer complaints from their own department.');
    }

    const targetDept = await Department.findById(targetDepartmentId);
    if (!targetDept || !targetDept.isActive) {
      return sendResponse(response, 400, false, 'Target department does not exist or is inactive.');
    }

    const previousDeptId = complaint.departmentId;

    // Record Department Transfer History
    const transferRecord = await DepartmentTransferHistory.create({
      complaintId: complaint._id,
      fromDepartmentId: previousDeptId,
      toDepartmentId: targetDept._id,
      transferredBy: user._id,
      reason
    });

    // Update Complaint
    complaint.departmentId = targetDept._id;
    complaint.primaryStaffId = undefined;
    complaint.assignedStaffId = undefined;
    complaint.supportingStaffIds = [];
    complaint.status = 'pending_assignment';
    await complaint.save();

    // Centralized Audit Log
    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'DEPARTMENT_TRANSFER',
      entityType: 'Department',
      entityId: targetDept._id,
      details: {
        complaintId: complaint._id,
        fromDepartmentId: previousDeptId,
        toDepartmentId: targetDept._id,
        reason
      }
    });

    // Notify Target Department Head
    if (targetDept.headOfDepartment) {
      await NotificationService.send({
        userId: targetDept.headOfDepartment,
        type: 'assignment',
        title: 'New Complaint Transferred',
        message: `Complaint #${complaint.complaintId} has been transferred to your department: "${reason}"`,
        complaintId: complaint._id,
        idempotencyKey: `transfer_${complaint._id}_${transferRecord._id}`
      });
    }

    return sendResponse(response, 200, true, 'Complaint successfully transferred to new department.', {
      complaint,
      transferRecord
    });
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error transferring complaint.');
  }
};

