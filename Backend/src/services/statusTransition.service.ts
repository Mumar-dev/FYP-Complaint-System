import { ComplaintStatus } from '../interfaces/complaint.interface';
import { Complaint } from '../models/complaint.model';
import { ComplaintStatusHistory } from '../models/complaintStatusHistory.model';
import { ComplaintEvidence } from '../models/complaintEvidence.model';
import { ActivityLog } from '../models/activityLog.model';
import { NotificationService } from './notification.service';
import { AuditService } from './audit.service';
import { Types } from 'mongoose';

/**
 * Standard enterprise state transitions:
 * SUBMITTED -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> UNDER_VERIFICATION -> CLOSED
 * With branches for:
 * - CLOSED -> REOPENED
 * - ANY (before CLOSED) -> CANCELLED
 * - UNDER_VERIFICATION -> IN_PROGRESS (when evidence rejected)
 */
const allowedTransitions: Record<string, string[]> = {
  submitted: ['assigned', 'cancelled'],
  pending_assignment: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['resolved', 'under_verification', 'cancelled'],
  resolved: ['under_verification', 'closed', 'cancelled'],
  under_verification: ['closed', 'resolved', 'in_progress'],
  closed: ['reopened'],
  reopened: ['assigned', 'in_progress', 'cancelled'],
  cancelled: []
};

export const isValidTransition = (currentStatus: string, nextStatus: string): boolean => {
  const allowed = allowedTransitions[currentStatus] || [];
  return allowed.includes(nextStatus);
};

export const canPerformTransition = (
  userRole: string,
  currentStatus: string,
  nextStatus: string,
  isAssignedStaff: boolean,
  isComplaintOwner: boolean
): boolean => {
  // Super Admin and Admin can manage administrative overrides
  if (['admin', 'superadmin'].includes(userRole)) {
    return true;
  }

  // Assigning a complaint
  if ((currentStatus === 'submitted' || currentStatus === 'pending_assignment' || currentStatus === 'reopened') && nextStatus === 'assigned') {
    return ['department_head', 'supervisor', 'admin', 'superadmin'].includes(userRole);
  }

  // Starting work
  if (currentStatus === 'assigned' && nextStatus === 'in_progress') {
    return isAssignedStaff || ['supervisor', 'department_head'].includes(userRole);
  }

  // Work finished -> moving to resolved or under_verification
  if (currentStatus === 'in_progress' && (nextStatus === 'resolved' || nextStatus === 'under_verification')) {
    return isAssignedStaff || ['supervisor', 'department_head'].includes(userRole);
  }

  // Under verification to closed or resolved (Supervisor / Dept Head approval)
  if (currentStatus === 'under_verification' && (nextStatus === 'closed' || nextStatus === 'resolved')) {
    return ['supervisor', 'department_head', 'admin', 'superadmin'].includes(userRole);
  }

  // Under verification returned to in_progress (Supervisor rejection)
  if (currentStatus === 'under_verification' && nextStatus === 'in_progress') {
    return ['supervisor', 'department_head', 'admin', 'superadmin'].includes(userRole);
  }

  // Direct closure from resolved by complaint owner or supervisor
  if (currentStatus === 'resolved' && nextStatus === 'closed') {
    return isComplaintOwner || ['supervisor', 'department_head', 'admin', 'superadmin'].includes(userRole);
  }

  // Reopening closed complaint: Resident (owner) or Admin/Supervisor
  if (currentStatus === 'closed' && nextStatus === 'reopened') {
    return isComplaintOwner || ['supervisor', 'department_head', 'admin', 'superadmin'].includes(userRole);
  }

  // Cancellation: Resident (before in_progress) or Admin/Supervisor
  if (nextStatus === 'cancelled') {
    if (isComplaintOwner && ['submitted', 'pending_assignment', 'assigned'].includes(currentStatus)) {
      return true;
    }
    return ['supervisor', 'department_head', 'admin', 'superadmin'].includes(userRole);
  }

  return false;
};

export class ComplaintWorkflowService {
  /**
   * Executes a verified status transition and logs status history, audit logs, and notifications.
   */
  static async transitionStatus(params: {
    complaintId: Types.ObjectId | string;
    nextStatus: ComplaintStatus;
    userId: Types.ObjectId | string;
    userRole: string;
    reason?: string;
    notes?: string;
    evidenceImages?: string[];
    isException?: boolean;
    exceptionReason?: string;
  }) {
    const complaint = await Complaint.findById(params.complaintId);
    if (!complaint) throw new Error('Complaint record not found');

    const currentStatus = complaint.status;
    const isOwner = complaint.residentId.toString() === params.userId.toString();
    const isPrimaryStaff = complaint.primaryStaffId?.toString() === params.userId.toString();
    const isSupportingStaff = complaint.supportingStaffIds?.some(id => id.toString() === params.userId.toString());
    const isAssigned = isPrimaryStaff || isSupportingStaff;

    // Rule: Supporting staff member must not independently close a complaint
    if (isSupportingStaff && !isPrimaryStaff && params.nextStatus === 'closed') {
      throw new Error('Supporting staff cannot independently close complaints');
    }

    if (!isValidTransition(currentStatus, params.nextStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${params.nextStatus}`);
    }

    if (!canPerformTransition(params.userRole, currentStatus, params.nextStatus, isAssigned, isOwner)) {
      throw new Error(`User with role '${params.userRole}' is unauthorized to perform this transition`);
    }

    // Workflow rule: Moving to under_verification or resolved requires resolution notes and evidence
    if (params.nextStatus === 'under_verification' || params.nextStatus === 'resolved') {
      const isSupervisorApproving = ['department_head', 'supervisor', 'admin', 'superadmin'].includes(params.userRole);

      // Check if complaint already has evidence recorded in database
      const existingEvidence = await ComplaintEvidence.findOne({ complaintId: complaint._id }).sort({ createdAt: -1 });
      const hasExistingImages = existingEvidence && existingEvidence.images && existingEvidence.images.length > 0;
      const hasParamImages = params.evidenceImages && params.evidenceImages.length > 0;
      const hasImages = hasParamImages || hasExistingImages;
      const isGrantedException = params.isException && params.exceptionReason;

      // Allow Department Head / Supervisor approval of Under Verification or existing evidence without re-uploading
      if (!hasImages && !isGrantedException && !(isSupervisorApproving && currentStatus === 'under_verification')) {
        throw new Error('Resolution evidence photo is mandatory unless an authorized supervisor exception is granted');
      }

      // Check notes: accept params.notes, params.reason, or existing evidence notes
      const effectiveNotes = params.notes?.trim() || params.reason?.trim() || existingEvidence?.notes || complaint.resolutionRemarks;
      if (!effectiveNotes && !(isSupervisorApproving && currentStatus === 'under_verification')) {
        throw new Error('Resolution notes are mandatory when completing work');
      }

      // Accumulate resolution proof photos across re-submissions instead of overwriting
      const newImages = params.evidenceImages || [];
      const priorEvidenceList = await ComplaintEvidence.find({ complaintId: complaint._id });
      const priorImages = priorEvidenceList.flatMap(e => e.images || []);
      const existingComplaintPhotos = (complaint as any).resolutionPhotos || [];
      const accumulatedImages = Array.from(new Set([
        ...existingComplaintPhotos,
        ...priorImages,
        ...newImages
      ]));

      // Save merged resolutionPhotos to complaint document
      if (accumulatedImages.length > 0) {
        (complaint as any).resolutionPhotos = accumulatedImages;
      }

      // If new evidence details are supplied, record a new evidence entry with accumulated photos
      if (params.notes || hasParamImages || params.isException) {
        await ComplaintEvidence.create({
          complaintId: complaint._id,
          submittedBy: params.userId,
          notes: params.notes || effectiveNotes || 'Resolution completed',
          images: accumulatedImages.length > 0 ? accumulatedImages : (existingEvidence?.images || []),
          isException: Boolean(params.isException),
          exceptionReason: params.exceptionReason,
          exceptionGrantedBy: params.isException ? params.userId : undefined,
          status: params.nextStatus === 'resolved' ? 'approved' : 'submitted',
          verifiedBy: params.nextStatus === 'resolved' ? params.userId : undefined,
          verifiedAt: params.nextStatus === 'resolved' ? new Date() : undefined
        });
      }

      if (params.nextStatus === 'under_verification') {
        complaint.underVerificationAt = new Date();
      }
    }

    // Reopen mandatory reason check
    if (params.nextStatus === 'reopened') {
      if (!params.reason || params.reason.trim().length === 0) {
        throw new Error('A valid reason is mandatory to reopen a complaint');
      }
      complaint.reopenReason = params.reason;
      complaint.reopenedAt = new Date();
    }

    // Cancellation mandatory reason check
    if (params.nextStatus === 'cancelled') {
      if (!params.reason || params.reason.trim().length === 0) {
        throw new Error('A valid reason is mandatory to cancel a complaint');
      }
      complaint.cancellationReason = params.reason;
      complaint.cancelledAt = new Date();
    }

    if (params.nextStatus === 'closed') {
      complaint.closedAt = new Date();
    }

    if (params.nextStatus === 'resolved') {
      complaint.resolvedAt = new Date();
    }

    complaint.status = params.nextStatus;
    await complaint.save();

    // Log status history
    await ComplaintStatusHistory.create({
      complaintId: complaint._id,
      previousStatus: currentStatus,
      newStatus: params.nextStatus,
      changedBy: params.userId,
      reason: params.reason || params.notes
    });

    // Centralized Audit Log
    await AuditService.log({
      userId: params.userId,
      userRole: params.userRole,
      action: `STATUS_CHANGE_${params.nextStatus.toUpperCase()}`,
      entityType: 'Complaint',
      entityId: complaint._id,
      details: { previousStatus: currentStatus, newStatus: params.nextStatus, reason: params.reason }
    });

    // Activity Log for Complaint Timeline
    await ActivityLog.create({
      complaintId: complaint._id,
      departmentId: complaint.departmentId,
      action: 'status_updated',
      performedBy: params.userId,
      oldValue: currentStatus,
      newValue: params.nextStatus,
      metadata: {
        from: currentStatus,
        to: params.nextStatus,
        message: params.reason || params.notes || `Status changed from ${currentStatus} to ${params.nextStatus}`
      }
    });

    // Dispatch status update notification to resident
    await NotificationService.send({
      userId: complaint.residentId,
      type: 'status_update',
      title: `Complaint Status: ${params.nextStatus.replace('_', ' ').toUpperCase()}`,
      message: `Your complaint #${complaint.complaintId} status changed from ${currentStatus} to ${params.nextStatus}.`,
      complaintId: complaint._id,
      idempotencyKey: `status_${complaint._id}_${params.nextStatus}_${Date.now()}`
    });

    return complaint;
  }
}
