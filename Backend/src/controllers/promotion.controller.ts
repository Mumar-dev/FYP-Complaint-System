import { Response } from 'express';
import mongoose from 'mongoose';
import { PromotionRequest } from '../models/promotionRequest.model';
import { User } from '../models/user.model';
import { Complaint } from '../models/complaint.model';
import { EmploymentHistory } from '../models/employmentHistory.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendResponse } from '../utils/response';
import { AuditService } from '../services/audit.service';
import { NotificationService } from '../services/notification.service';
import { sendEmail } from '../utils/email';

/**
 * GET /api/promotions/requests - List promotion requests
 * Supports filtering by status, departmentId, and scoped by caller role (Staff, DeptHead, Admin)
 */
export const getAllPromotionRequests = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { status, departmentId } = request.query;

    const filter: any = {};

    // Role-based visibility scoping
    if (user.role === 'staff') {
      // Staff only sees their own promotion requests
      filter.employeeId = user._id;
    } else if (user.role === 'department_head') {
      // Dept Head sees promotion requests within their department
      if (user.departmentId) {
        filter.proposedDepartmentId = user.departmentId;
      }
    } else if (['admin', 'superadmin'].includes(user.role)) {
      if (departmentId) {
        filter.proposedDepartmentId = departmentId;
      }
    }

    // Status filtering
    if (status && status !== 'ALL') {
      const normalizedStatus = String(status).toUpperCase();
      if (normalizedStatus === 'PENDING') {
        if (user.role === 'staff') {
          filter.status = { $in: ['PENDING_DEPT_HEAD', 'PENDING_ADMIN', 'SUBMITTED', 'UNDER_REVIEW'] };
        } else if (user.role === 'department_head') {
          filter.status = { $in: ['PENDING_DEPT_HEAD', 'SUBMITTED', 'UNDER_REVIEW'] };
        } else {
          // Admin sees PENDING_ADMIN
          filter.status = { $in: ['PENDING_ADMIN', 'SUBMITTED', 'UNDER_REVIEW'] };
        }
      } else {
        filter.status = normalizedStatus;
      }
    }

    const requests = await PromotionRequest.find(filter)
      .populate('employeeId', 'profile.fullName profile.avatar profile.profileImage email designation rank departmentId')
      .populate('submittedBy', 'profile.fullName email role')
      .populate('reviewedBy', 'profile.fullName email role')
      .populate('forwardedBy', 'profile.fullName email role')
      .populate('proposedDepartmentId', 'name code')
      .sort({ createdAt: -1 });

    // Attach performance snapshot for each target employee
    const enriched = await Promise.all(
      requests.map(async (reqItem: any) => {
        const itemObj = reqItem.toObject();
        if (reqItem.employeeId?._id) {
          const empId = reqItem.employeeId._id;
          const stats = await Complaint.aggregate([
            { $match: { assignedStaffId: empId } },
            {
              $group: {
                _id: '$assignedStaffId',
                assignedCount: { $sum: 1 },
                completedCount: {
                  $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] }
                },
                pendingCount: {
                  $sum: { $cond: [{ $in: ['$status', ['assigned', 'in_progress', 'under_verification']] }, 1, 0] }
                },
                onTimeCount: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $in: ['$status', ['resolved', 'closed']] },
                          { $lte: ['$resolvedAt', '$slaDeadline'] }
                        ]
                      },
                      1,
                      0
                    ]
                  }
                }
              }
            }
          ]);

          const s = stats[0] || { assignedCount: 0, completedCount: 0, pendingCount: 0, onTimeCount: 0 };
          const efficiency = s.assignedCount > 0 ? Math.round((s.completedCount / s.assignedCount) * 100) : 0;
          itemObj.performanceSnapshot = {
            totalAssigned: s.assignedCount,
            completed: s.completedCount,
            pending: s.pendingCount,
            efficiencyRate: efficiency
          };
        }
        return itemObj;
      })
    );

    return sendResponse(response, 200, true, 'Promotion requests retrieved successfully', enriched);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching promotion requests');
  }
};

/**
 * POST /api/promotions/requests - Submit promotion request (Employee or Supervisor Recommendation)
 */
export const submitPromotionRequest = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { 
      employeeId, 
      requestedDesignation, 
      requestedRank, 
      proposedDesignation, // Backwards compatibility
      proposedDepartmentId, 
      justification, 
      requestType = 'self' 
    } = request.body;

    const targetEmployeeId = requestType === 'self' ? user._id : employeeId;
    const finalDesignation = requestedDesignation || proposedDesignation;

    if (!targetEmployeeId || (!finalDesignation && !requestedRank) || !justification) {
      return sendResponse(response, 400, false, 'Target employee, requested position/rank, and justification are required.');
    }

    const employee = await User.findById(targetEmployeeId);
    if (!employee) {
      return sendResponse(response, 404, false, 'Employee record not found.');
    }

    const initialStatus = requestType === 'self' ? 'PENDING_DEPT_HEAD' : 'PENDING_ADMIN';

    const promoReq = await PromotionRequest.create({
      employeeId: employee._id,
      currentDesignation: employee.designation || employee.profile?.position || 'Staff',
      requestedDesignation: finalDesignation || employee.designation || employee.profile?.position || 'Staff',
      currentRank: employee.rank || 'junior',
      requestedRank: requestedRank || undefined,
      proposedDepartmentId: proposedDepartmentId || employee.departmentId,
      requestType,
      submittedBy: user._id,
      justification,
      status: initialStatus
    });

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'PROMOTION_REQUESTED',
      entityType: 'Promotion',
      entityId: promoReq._id,
      previousValue: { currentDesignation: employee.designation, currentRank: employee.rank },
      newValue: { requestedDesignation: promoReq.requestedDesignation, requestedRank: promoReq.requestedRank, requestType, status: initialStatus },
      reason: justification
    });

    // If staff self-requested, notify their Department Head
    if (requestType === 'self') {
      const deptId = proposedDepartmentId || employee.departmentId;
      if (deptId) {
        const dept = await mongoose.model('Department').findById(deptId).populate('headOfDepartment');
        const deptHeadId = (dept as any)?.headOfDepartment?._id || (dept as any)?.headOfDepartment;
        if (deptHeadId) {
          await NotificationService.send({
            userId: deptHeadId,
            type: 'promotion_submitted',
            title: 'New Staff Promotion Request',
            message: `${employee.profile?.fullName || employee.email} submitted a promotion request to ${requestedRank || finalDesignation}.`,
            idempotencyKey: `notif_promo_self_${promoReq._id}_${deptHeadId}`
          });
        }
      }
    } else {
      // Supervisor / Dept Head recommendation: notify administrators
      const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id');
      for (const adm of admins) {
        await NotificationService.send({
          userId: adm._id,
          type: 'promotion_submitted',
          title: 'New Promotion Recommendation',
          message: `${user.profile?.fullName || 'A Department Head'} recommended ${employee.profile?.fullName || employee.email} for promotion to ${requestedRank || finalDesignation}.`,
          idempotencyKey: `notif_promo_sub_${promoReq._id}_${adm._id}`
        });
      }
    }

    return sendResponse(response, 201, true, 'Promotion request submitted successfully', promoReq);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error submitting promotion request');
  }
};

/**
 * PATCH /api/promotions/requests/:id/review - Review promotion request (Approve / Reject / Forward)
 * - Dept Head can: REJECT (with reason) or FORWARD (marks PENDING_ADMIN, notifies Admin)
 * - Admin can: APPROVE (promotes User/Employee, sends emails/notifications) or REJECT (with reason)
 */
export const reviewPromotionRequest = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const { action, effectiveDate = new Date(), rejectionReason, deptHeadRemarks } = request.body; 
    // Allowed actions: 'APPROVED' | 'REJECTED' | 'FORWARDED_TO_ADMIN' | 'FORWARD'
    const user = request.user!;
    const normalizedAction = String(action).toUpperCase();

    if (!['APPROVED', 'REJECTED', 'FORWARDED_TO_ADMIN', 'FORWARD'].includes(normalizedAction)) {
      return sendResponse(response, 400, false, 'Action must be "APPROVED", "REJECTED", or "FORWARD".');
    }

    if (normalizedAction === 'REJECTED' && !rejectionReason) {
      return sendResponse(response, 400, false, 'Rejection reason is mandatory when rejecting a promotion request.');
    }

    const promoReq = await PromotionRequest.findById(id);
    if (!promoReq) {
      return sendResponse(response, 404, false, 'Promotion request not found.');
    }

    // Rule: Employee cannot approve their own promotion
    if (promoReq.employeeId.toString() === user._id.toString()) {
      return sendResponse(response, 403, false, 'Self-approval violation: You cannot approve or review your own promotion.');
    }

    // Department Head action: FORWARD TO ADMIN
    if (['FORWARDED_TO_ADMIN', 'FORWARD'].includes(normalizedAction)) {
      if (user.role !== 'department_head' && !['admin', 'superadmin'].includes(user.role)) {
        return sendResponse(response, 403, false, 'Only Department Heads or Administrators can forward promotion requests.');
      }

      promoReq.status = 'PENDING_ADMIN';
      promoReq.deptHeadRemarks = deptHeadRemarks || promoReq.deptHeadRemarks;
      promoReq.forwardedBy = user._id;
      promoReq.forwardedAt = new Date();
      await promoReq.save();

      await AuditService.log({
        userId: user._id,
        userRole: user.role,
        action: 'PROMOTION_FORWARDED',
        entityType: 'Promotion',
        entityId: promoReq._id,
        previousValue: { status: 'PENDING_DEPT_HEAD' },
        newValue: { status: 'PENDING_ADMIN', deptHeadRemarks },
        reason: deptHeadRemarks || 'Forwarded to Society Administration for final approval'
      });

      // Notify Staff member that their request was endorsed and forwarded
      await NotificationService.send({
        userId: promoReq.employeeId,
        type: 'promotion_forwarded',
        title: 'Promotion Request Forwarded to Admin',
        message: `Your Department Head endorsed your promotion request and forwarded it to Society Administration for final decision.`,
        idempotencyKey: `notif_promo_fwd_${promoReq._id}`
      });

      // Notify Admins that a promotion request has been forwarded for final review
      const targetEmp = await User.findById(promoReq.employeeId);
      const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id');
      for (const adm of admins) {
        await NotificationService.send({
          userId: adm._id,
          type: 'promotion_submitted',
          title: 'Promotion Request Awaiting Admin Approval',
          message: `${user.profile?.fullName || 'Department Head'} forwarded ${targetEmp?.profile?.fullName || targetEmp?.email}'s promotion request for final decision.`,
          idempotencyKey: `notif_promo_admin_q_${promoReq._id}_${adm._id}`
        });
      }

      return sendResponse(response, 200, true, 'Promotion request forwarded to Administration successfully', promoReq);
    }

    // Admin / Dept Head REJECT or Admin APPROVE
    if (normalizedAction === 'APPROVED' && !['admin', 'superadmin'].includes(user.role)) {
      return sendResponse(response, 403, false, 'Only Administrators have final authority to approve promotions.');
    }

    promoReq.status = normalizedAction as any;
    promoReq.reviewedBy = user._id;
    promoReq.reviewedAt = new Date();
    promoReq.effectiveDate = new Date(effectiveDate);
    if (normalizedAction === 'REJECTED') {
      promoReq.rejectionReason = rejectionReason;
      if (deptHeadRemarks) promoReq.deptHeadRemarks = deptHeadRemarks;
    }

    // If approved and effective immediately, update employee designation, rank and employment history
    if (normalizedAction === 'APPROVED') {
      const employee = await User.findById(promoReq.employeeId);
      if (employee) {
        const prevDesignation = employee.designation || employee.profile?.position || 'Staff';
        const prevRank = employee.rank || 'junior';
        
        employee.designation = promoReq.requestedDesignation;
        if (!employee.profile) employee.profile = {} as any;
        employee.profile.position = promoReq.requestedDesignation;

        if (promoReq.requestedRank) {
          const normalizedRank = promoReq.requestedRank === 'lead' ? 'team_lead' : promoReq.requestedRank;
          employee.rank = normalizedRank as any;
        }

        await employee.save();

        await EmploymentHistory.create({
          employeeId: employee._id,
          previousDesignation: prevDesignation,
          newDesignation: promoReq.requestedDesignation,
          previousDepartmentId: employee.departmentId as any,
          newDepartmentId: promoReq.proposedDepartmentId || (employee.departmentId as any),
          changeType: 'promotion',
          reason: `Approved promotion request: ${promoReq.justification}${promoReq.requestedRank ? ` (Rank: ${promoReq.requestedRank})` : ''}`,
          changedBy: user._id,
          effectiveDate: promoReq.effectiveDate
        });

        promoReq.isApplied = true;
      }
    }

    await promoReq.save();

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: normalizedAction === 'APPROVED' ? 'PROMOTION_APPROVED' : 'PROMOTION_REJECTED',
      entityType: 'Promotion',
      entityId: promoReq._id,
      previousValue: { currentDesignation: promoReq.currentDesignation },
      newValue: { newDesignation: promoReq.requestedDesignation, status: normalizedAction, rejectionReason },
      reason: rejectionReason || 'Reviewed promotion request'
    });

    // Send in-app notification & congratulatory email if approved
    if (normalizedAction === 'APPROVED') {
      const employee = await User.findById(promoReq.employeeId);
      const newRankDisplay = promoReq.requestedRank
        ? (promoReq.requestedRank === 'team_lead' ? 'Team Lead' : promoReq.requestedRank.charAt(0).toUpperCase() + promoReq.requestedRank.slice(1))
        : '';
      const emailSubject = 'Congratulations on Your Promotion!';
      const emailMsg = `Dear ${employee?.profile?.fullName || 'Colleague'},\n\nWe are pleased to inform you that your promotion recommendation to ${newRankDisplay || promoReq.requestedDesignation} has been officially approved by the Administration.\n\nThank you for your continuous dedication and valuable service to our community.\n\nWarm regards,\nManagement & Administration`;

      if (employee?.email) {
        sendEmail({ to: employee.email, subject: emailSubject, message: emailMsg }).catch(err => {
          console.error('[Promotion Email Error]', err?.message);
        });
      }

      await NotificationService.send({
        userId: promoReq.employeeId,
        type: 'promotion_approved',
        title: 'Promotion Approved! 🎉',
        message: `Congratulations! Your promotion to ${newRankDisplay || promoReq.requestedDesignation} has been approved.`,
        idempotencyKey: `notif_promo_${promoReq._id}_APPROVED`
      });

      // Also notify the Department Head
      if (promoReq.forwardedBy) {
        await NotificationService.send({
          userId: promoReq.forwardedBy,
          type: 'promotion_approved',
          title: 'Staff Promotion Approved',
          message: `The promotion request for ${employee?.profile?.fullName || employee?.email || 'staff'} was approved by Administration.`,
          idempotencyKey: `notif_promo_fwd_approved_${promoReq._id}`
        });
      } else if (promoReq.submittedBy && promoReq.submittedBy.toString() !== promoReq.employeeId.toString()) {
        await NotificationService.send({
          userId: promoReq.submittedBy,
          type: 'promotion_approved',
          title: 'Promotion Recommendation Approved',
          message: `Your promotion recommendation for ${employee?.profile?.fullName || employee?.email || 'staff'} has been approved.`,
          idempotencyKey: `notif_promo_sub_${promoReq._id}_APPROVED`
        });
      }
    } else {
      // Rejection notification to employee and submitter
      await NotificationService.send({
        userId: promoReq.employeeId,
        type: 'promotion_rejected',
        title: 'Promotion Request Update',
        message: `Your promotion request was not approved.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
        idempotencyKey: `notif_promo_${promoReq._id}_REJECTED`
      });

      if (promoReq.submittedBy && promoReq.submittedBy.toString() !== promoReq.employeeId.toString()) {
        await NotificationService.send({
          userId: promoReq.submittedBy,
          type: 'promotion_rejected',
          title: 'Promotion Recommendation Rejected',
          message: `The promotion recommendation for staff was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
          idempotencyKey: `notif_promo_sub_${promoReq._id}_REJECTED`
        });
      }
    }

    return sendResponse(response, 200, true, `Promotion request ${normalizedAction.toLowerCase()} successfully`, promoReq);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error reviewing promotion');
  }
};

/**
 * GET /api/promotions/history/:employeeId - Promotion history
 */
export const getPromotionHistory = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { employeeId } = request.params;
    const history = await PromotionRequest.find({ employeeId })
      .populate('submittedBy', 'profile.fullName email')
      .populate('reviewedBy', 'profile.fullName email')
      .sort({ createdAt: -1 });

    return sendResponse(response, 200, true, 'Promotion history retrieved', history);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching promotion history');
  }
};

