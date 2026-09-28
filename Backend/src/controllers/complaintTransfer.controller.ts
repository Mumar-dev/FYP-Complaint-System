import { Response } from 'express';
import { Department } from '../models/department.model';
import { Complaint } from '../models/complaint.model';
import { ComplaintTransferRequest } from '../models/complaintTransferRequest.model';
import { DepartmentTransferHistory } from '../models/departmentTransferHistory.model';
import { ActivityLog } from '../models/activityLog.model';
import { User } from '../models/user.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendResponse } from '../utils/response';
import { AuditService } from '../services/audit.service';
import { NotificationService } from '../services/notification.service';

/**
 * POST /api/complaints/:complaintId/transfer-request
 * Department Head requests transferring a complaint to another department.
 * Validates department ownership, target department difference, and absence of pending requests.
 */
export const requestComplaintTransfer = async (
  request: AuthenticatedRequest,
  response: Response
): Promise<any> => {
  try {
    const { complaintId } = request.params;
    const { targetDepartmentId, reason } = request.body;
    const user = request.user!;

    if (!targetDepartmentId || !reason || reason.trim().length === 0) {
      return sendResponse(response, 400, false, 'Target department and a valid reason are required.');
    }

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return sendResponse(response, 404, false, 'Complaint not found.');
    }

    // Role verification: Department heads can only transfer complaints belonging to their own department
    if (user.role === 'department_head') {
      if (!user.departmentId || complaint.departmentId.toString() !== user.departmentId.toString()) {
        return sendResponse(
          response,
          403,
          false,
          'Department Head can only request transfers for complaints belonging to their own department.'
        );
      }
    }

    // Target department must be different from the current department
    if (complaint.departmentId.toString() === targetDepartmentId.toString()) {
      return sendResponse(response, 400, false, 'Target department must be different from current department.');
    }

    const targetDept = await Department.findById(targetDepartmentId);
    if (!targetDept || !targetDept.isActive) {
      return sendResponse(response, 400, false, 'Target department does not exist or is inactive.');
    }

    // Check if there is already a pending transfer request for this complaint
    const existingPending = await ComplaintTransferRequest.findOne({
      complaintId: complaint._id,
      status: 'pending'
    });
    if (existingPending) {
      return sendResponse(
        response,
        400,
        false,
        'A transfer request is already pending admin approval for this complaint.'
      );
    }

    const transferRequest = await ComplaintTransferRequest.create({
      complaintId: complaint._id,
      fromDepartmentId: complaint.departmentId,
      targetDepartmentId: targetDept._id,
      requestedBy: user._id,
      reason: reason.trim(),
      status: 'pending'
    });

    // Centralized Audit Log
    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'COMPLAINT_TRANSFER_REQUESTED',
      entityType: 'Complaint',
      entityId: complaint._id,
      details: {
        fromDepartmentId: complaint.departmentId,
        targetDepartmentId: targetDept._id,
        reason
      }
    });

    // Notify Admins and Superadmins
    const admins = await User.find({
      role: { $in: ['admin', 'superadmin'] },
      accountStatus: 'active'
    }).select('_id');

    const deptHeadName = user.profile?.fullName || (user as any).name || user.email || 'Department Head';
    const notificationMsg = `**Transfer Request:** ${deptHeadName} requested to transfer complaint #${complaint.complaintId} to ${targetDept.name}.`;

    for (const admin of admins) {
      await NotificationService.send({
        userId: admin._id,
        type: 'transfer_request',
        message: notificationMsg,
        complaintId: complaint._id
      });
    }

    return sendResponse(response, 201, true, 'Complaint transfer request submitted for Admin review.', transferRequest);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error requesting complaint transfer.');
  }
};

/**
 * GET /api/complaints/:complaintId/transfer-status
 * Check pending transfer status for a complaint.
 */
export const getComplaintTransferStatus = async (
  request: AuthenticatedRequest,
  response: Response
): Promise<any> => {
  try {
    const { complaintId } = request.params;
    const transfer = await ComplaintTransferRequest.findOne({
      complaintId,
      status: 'pending'
    })
      .populate('targetDepartmentId', 'name code')
      .populate('fromDepartmentId', 'name code')
      .populate('requestedBy', 'email profile.fullName');

    return sendResponse(response, 200, true, 'Transfer status retrieved.', transfer);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error checking transfer status.');
  }
};

/**
 * GET /api/complaints/transfer-requests
 * Admin lists transfer requests with filtering.
 */
export const getComplaintTransferRequests = async (
  request: AuthenticatedRequest,
  response: Response
): Promise<any> => {
  try {
    const { status } = request.query;
    const filter: any = {};
    if (status && status !== 'all') {
      filter.status = status.toString().toLowerCase();
    }

    const requests = await ComplaintTransferRequest.find(filter)
      .populate({
        path: 'complaintId',
        select: 'complaintId title priority status category location createdAt'
      })
      .populate('fromDepartmentId', 'name code')
      .populate('targetDepartmentId', 'name code')
      .populate('requestedBy', 'email profile.fullName profile.profileImage profile.avatar profile.name')
      .populate('reviewedBy', 'email profile.fullName profile.name')
      .sort({ createdAt: -1 });

    return sendResponse(response, 200, true, 'Complaint transfer requests retrieved.', requests);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching transfer requests.');
  }
};

/**
 * PATCH /api/complaints/transfer-requests/:id/approve
 * Admin approves transfer request: moves complaint, resets staff assignments, logs timeline, and notifies parties.
 */
export const approveComplaintTransfer = async (
  request: AuthenticatedRequest,
  response: Response
): Promise<any> => {
  try {
    const { id } = request.params;
    const { reviewRemarks } = request.body;
    const user = request.user!;

    const transferReq = await ComplaintTransferRequest.findById(id)
      .populate('fromDepartmentId', 'name code')
      .populate('targetDepartmentId', 'name code')
      .populate('requestedBy', 'email profile.fullName');

    if (!transferReq) {
      return sendResponse(response, 404, false, 'Transfer request not found.');
    }

    if (transferReq.status !== 'pending') {
      return sendResponse(response, 400, false, `Transfer request has already been ${transferReq.status}.`);
    }

    const complaint = await Complaint.findById(transferReq.complaintId);
    if (!complaint) {
      return sendResponse(response, 404, false, 'Associated complaint not found.');
    }

    const oldDeptId = complaint.departmentId;
    const targetDeptId = transferReq.targetDepartmentId._id;
    const targetDept = await Department.findById(targetDeptId);

    // 1. Move complaint and clear staff assignments
    complaint.departmentId = targetDeptId;
    complaint.primaryStaffId = undefined;
    complaint.assignedStaffId = undefined;
    complaint.supportingStaffIds = [];
    complaint.status = 'pending_assignment';
    await complaint.save();

    // 2. Mark transfer request as approved
    transferReq.status = 'approved';
    transferReq.reviewedBy = user._id;
    transferReq.reviewedAt = new Date();
    transferReq.reviewRemarks = reviewRemarks;
    await transferReq.save();

    // 3. Record in DepartmentTransferHistory model
    await DepartmentTransferHistory.create({
      complaintId: complaint._id,
      fromDepartmentId: oldDeptId,
      toDepartmentId: targetDeptId,
      transferredBy: user._id,
      reason: transferReq.reason
    });

    // 4. Record Activity Log for Complaint Timeline
    await ActivityLog.create({
      complaintId: complaint._id,
      departmentId: targetDeptId,
      action: 'DEPARTMENT_TRANSFERRED',
      performedBy: user._id,
      oldValue: (transferReq.fromDepartmentId as any)?.name || 'Previous Department',
      newValue: targetDept?.name || 'New Department',
      metadata: {
        from: (transferReq.fromDepartmentId as any)?.name,
        to: targetDept?.name,
        message: `Transferred by Admin. Reason: ${transferReq.reason}`
      }
    });

    // 5. Centralized Audit Log
    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'APPROVE_COMPLAINT_TRANSFER',
      entityType: 'Complaint',
      entityId: complaint._id,
      details: {
        transferRequestId: transferReq._id,
        fromDepartmentId: oldDeptId,
        toDepartmentId: targetDeptId,
        reason: transferReq.reason,
        reviewRemarks
      }
    });

    // 6. Notify requesting Department Head
    await NotificationService.send({
      userId: transferReq.requestedBy._id,
      type: 'transfer_approved',
      message: `**Transfer Approved:** Complaint #${complaint.complaintId} has been moved to ${targetDept?.name || 'the target department'}.`,
      complaintId: complaint._id
    });

    // 7. Notify new Department Head(s)
    await NotificationService.notifyDepartmentHeads(targetDeptId, {
      type: 'transfer_approved',
      message: `**New Complaint Transferred:** Complaint #${complaint.complaintId} has been transferred to your department.`,
      complaintId: complaint._id
    });

    return sendResponse(response, 200, true, 'Complaint transfer approved successfully.', {
      complaint,
      transferReq
    });
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error approving transfer request.');
  }
};

/**
 * PATCH /api/complaints/transfer-requests/:id/reject
 * Admin rejects transfer request: keeps complaint in original department and notifies requesting Dept Head.
 */
export const rejectComplaintTransfer = async (
  request: AuthenticatedRequest,
  response: Response
): Promise<any> => {
  try {
    const { id } = request.params;
    const { reviewRemarks } = request.body;
    const user = request.user!;

    const transferReq = await ComplaintTransferRequest.findById(id)
      .populate('requestedBy', 'email profile.fullName');

    if (!transferReq) {
      return sendResponse(response, 404, false, 'Transfer request not found.');
    }

    if (transferReq.status !== 'pending') {
      return sendResponse(response, 400, false, `Transfer request has already been ${transferReq.status}.`);
    }

    const complaint = await Complaint.findById(transferReq.complaintId);

    // 1. Mark transfer request as rejected
    transferReq.status = 'rejected';
    transferReq.reviewedBy = user._id;
    transferReq.reviewedAt = new Date();
    transferReq.reviewRemarks = reviewRemarks;
    await transferReq.save();

    // 2. Activity Log
    if (complaint) {
      await ActivityLog.create({
        complaintId: complaint._id,
        departmentId: complaint.departmentId,
        action: 'TRANSFER_REJECTED',
        performedBy: user._id,
        metadata: {
          message: `Transfer request rejected by Admin.${reviewRemarks ? ` Remarks: ${reviewRemarks}` : ''}`
        }
      });
    }

    // 3. Centralized Audit Log
    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'REJECT_COMPLAINT_TRANSFER',
      entityType: 'Complaint',
      entityId: transferReq.complaintId,
      details: {
        transferRequestId: transferReq._id,
        reviewRemarks
      }
    });

    // 4. Notify requesting Department Head (deduplicated & idempotent)
    const targetUserId = (transferReq.requestedBy as any)?._id || transferReq.requestedBy;
    if (targetUserId) {
      await NotificationService.send({
        userId: targetUserId,
        type: 'transfer_rejected',
        title: 'Transfer Request Rejected',
        message: `**Transfer Rejected:** Your transfer request for complaint #${complaint?.complaintId || ''} was rejected by Admin.${reviewRemarks ? ` Remarks: "${reviewRemarks}"` : ''}`,
        complaintId: transferReq.complaintId,
        idempotencyKey: `complaint_transfer_rejected_${transferReq._id}_${targetUserId}`
      });
    }

    return sendResponse(response, 200, true, 'Complaint transfer request rejected.', transferReq);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error rejecting transfer request.');
  }
};
