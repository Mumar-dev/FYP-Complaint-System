import { Response } from 'express';
import { ComplaintEvidence } from '../models/complaintEvidence.model';
import { Complaint } from '../models/complaint.model';
import { ComplaintWorkflowService } from '../services/statusTransition.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendResponse } from '../utils/response';
import { AuditService } from '../services/audit.service';
import { NotificationService } from '../services/notification.service';
import { uploadBufferToCloudinary } from '../utils/cloudinary';

/**
 * Staff submits completion evidence with photos and notes.
 */
export const submitResolutionEvidence = async (
  request: AuthenticatedRequest,
  response: Response
): Promise<any> => {
  try {
    const { complaintId } = request.params;
    const { notes, isException, exceptionReason } = request.body;
    const user = request.user!;

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return sendResponse(response, 404, false, 'Complaint not found.');
    }

    const isPrimary = complaint.primaryStaffId?.toString() === user._id.toString();
    const isAssigned = complaint.assignedStaffId?.toString() === user._id.toString();
    const isSupporting = complaint.supportingStaffIds?.some(id => id.toString() === user._id.toString());
    const isSupervisor = ['supervisor', 'department_head', 'admin', 'superadmin'].includes(user.role);

    if (!isPrimary && !isAssigned && !isSupporting && !isSupervisor) {
      return sendResponse(response, 403, false, 'Only assigned staff or supervisors can submit completion evidence.');
    }

    const images: string[] = [];
    if (request.files && Array.isArray(request.files)) {
      for (const file of request.files) {
        try {
          const url = await uploadBufferToCloudinary(file.buffer, 'evidence');
          images.push(url);
        } catch (e) {
          console.error('[Cloudinary Upload Error]', e);
        }
      }
    }

    const updatedComplaint = await ComplaintWorkflowService.transitionStatus({
      complaintId: complaint._id,
      nextStatus: 'under_verification',
      userId: user._id,
      userRole: user.role,
      notes,
      evidenceImages: images,
      isException: isException === 'true' || isException === true,
      exceptionReason
    });

    // Clear previous adjustmentFeedback if resubmitting evidence
    complaint.adjustmentFeedback = undefined;
    if (images.length > 0) {
      complaint.resolutionPhotos = Array.from(new Set([
        ...(complaint.resolutionPhotos || []),
        ...images
      ]));
    }
    await complaint.save();

    // Notify Department Head(s) of this department that verification proof is submitted
    if (complaint.departmentId) {
      const staffName = user.profile?.fullName || (user as any).name || user.email || 'Staff';
      const complaintCode = complaint.complaintId || `#${complaint._id.toString().slice(-6).toUpperCase()}`;
      await NotificationService.notifyDepartmentHeads(complaint.departmentId, {
        type: 'verification_needed',
        message: `**Verification Needed:** ${staffName} submitted resolution proof for "${complaint.title}" (${complaintCode}).`,
        complaintId: complaint._id
      });
    }

    return sendResponse(response, 201, true, 'Resolution evidence submitted. Sent to supervisor for verification.', updatedComplaint);
  } catch (error: any) {
    return sendResponse(response, 400, false, error.message || 'Error submitting evidence.');
  }
};

/**
 * Supervisor reviews resolution evidence: Approve (close ticket) or Reject (return to in_progress).
 */
export const reviewResolutionEvidence = async (
  request: AuthenticatedRequest,
  response: Response
): Promise<any> => {
  try {
    const { evidenceId } = request.params;
    const { action, rejectionReason, remarks } = request.body; // 'approved' | 'rejected'
    const finalRemarks = rejectionReason || remarks || '';
    const user = request.user!;

    if (!['approved', 'rejected'].includes(action)) {
      return sendResponse(response, 400, false, 'Action must be "approved" or "rejected".');
    }

    if (action === 'rejected' && (!finalRemarks || finalRemarks.trim().length === 0)) {
      return sendResponse(response, 400, false, 'Adjustment remarks or rejection reason is mandatory when requesting changes.');
    }

    // Support looking up either by Evidence ID or by Complaint ID directly
    let evidence = await ComplaintEvidence.findById(evidenceId);
    let complaint: any = null;

    if (!evidence) {
      // Check if evidenceId is actually a complaintId
      evidence = await ComplaintEvidence.findOne({ complaintId: evidenceId }).sort({ createdAt: -1 });
      if (evidence) {
        complaint = await Complaint.findById(evidence.complaintId);
      } else {
        // If no evidence document exists but complaint exists in under_verification status
        complaint = await Complaint.findById(evidenceId);
      }
    } else {
      complaint = await Complaint.findById(evidence.complaintId);
    }

    if (!complaint) {
      return sendResponse(response, 404, false, 'Associated complaint record not found.');
    }

    if (evidence) {
      evidence.status = action;
      evidence.verifiedBy = user._id;
      evidence.verifiedAt = new Date();
      if (action === 'rejected') {
        evidence.rejectionReason = finalRemarks;
      }
      await evidence.save();
    }

    if (action === 'approved') {
      await ComplaintWorkflowService.transitionStatus({
        complaintId: complaint._id,
        nextStatus: 'resolved',
        userId: user._id,
        userRole: user.role,
        reason: 'Resolution evidence verified and approved by Department Head'
      });

      // Notify resident that issue is resolved
      if (complaint.residentId) {
        await NotificationService.send({
          userId: complaint.residentId,
          type: 'status_update',
          title: 'Complaint Resolved',
          message: `Your complaint "${complaint.title}" has been verified and marked as Resolved.`,
          complaintId: complaint._id,
          idempotencyKey: `evidence_appr_res_${complaint._id}_${Date.now()}`
        });
      }

      // Notify assigned staff that resolution was approved
      const staffRecipient = complaint.primaryStaffId || complaint.assignedStaffId;
      if (staffRecipient) {
        await NotificationService.send({
          userId: staffRecipient,
          type: 'evidence_approved',
          title: 'Evidence Approved',
          message: `Your resolution evidence for "${complaint.title}" was approved by Department Head.`,
          complaintId: complaint._id,
          idempotencyKey: `evidence_appr_staff_${complaint._id}_${Date.now()}`
        });
      }
    } else {
      await ComplaintWorkflowService.transitionStatus({
        complaintId: complaint._id,
        nextStatus: 'in_progress',
        userId: user._id,
        userRole: user.role,
        reason: `Evidence adjustments requested: ${finalRemarks}`
      });

      // Save adjustment feedback directly on the complaint for staff display
      complaint.adjustmentFeedback = {
        remarks: finalRemarks,
        requestedBy: user._id,
        requestedAt: new Date()
      };
      await complaint.save();

      // Alert assigned staff about adjustments requested / rejection
      const staffRecipient = complaint.primaryStaffId || complaint.assignedStaffId;
      if (staffRecipient) {
        await NotificationService.send({
          userId: staffRecipient,
          type: 'evidence_rejected',
          title: 'Adjustments Requested',
          message: `Resolution proof for #${complaint.complaintId || complaint._id.toString().slice(-6).toUpperCase()} requires adjustments: "${finalRemarks}". Please review and update.`,
          complaintId: complaint._id,
          idempotencyKey: `evidence_reject_${complaint._id}_${Date.now()}`
        });
      }
    }

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: action === 'approved' ? 'EVIDENCE_APPROVED' : 'EVIDENCE_REJECTED',
      entityType: 'Evidence',
      entityId: evidence ? evidence._id : complaint._id,
      details: { complaintId: complaint._id, action, rejectionReason }
    });

    return sendResponse(response, 200, true, `Evidence successfully ${action}.`, evidence || complaint);
  } catch (error: any) {
    return sendResponse(response, 400, false, error.message || 'Error reviewing evidence.');
  }
};

/**
 * Fetch all evidence submissions for a complaint
 */
export const getComplaintEvidenceList = async (
  request: AuthenticatedRequest,
  response: Response
): Promise<any> => {
  try {
    const { complaintId } = request.params;
    const evidenceList = await ComplaintEvidence.find({ complaintId })
      .populate('submittedBy', 'email profile.fullName')
      .populate('verifiedBy', 'email profile.fullName')
      .sort({ createdAt: -1 });

    return sendResponse(response, 200, true, 'Evidence list retrieved', evidenceList);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching evidence.');
  }
};

/**
 * Fetch all pending resolution verifications for a department (for Department Head)
 */
export const getPendingResolutionVerifications = async (
  request: AuthenticatedRequest,
  response: Response
): Promise<any> => {
  try {
    const user = request.user!;
    const filter: any = {
      status: 'under_verification'
    };

    if (user.role === 'department_head' || user.role === 'supervisor') {
      if (user.departmentId) {
        filter.departmentId = user.departmentId;
      }
    }

    const complaints = await Complaint.find(filter)
      .populate('residentId', 'email profile.fullName profile.phone')
      .populate('primaryStaffId', 'email profile.fullName profile.phone profile.profileImage')
      .populate('assignedStaffId', 'email profile.fullName profile.phone profile.profileImage')
      .populate('supportingStaffIds', 'email profile.fullName')
      .populate('departmentId', 'name')
      .sort({ updatedAt: -1 });

    // Fetch the latest evidence record for each complaint
    const complaintIds = complaints.map(c => c._id);
    const evidences = await ComplaintEvidence.find({ complaintId: { $in: complaintIds } })
      .populate('submittedBy', 'email profile.fullName')
      .sort({ createdAt: -1 });

    const evidenceMap: Record<string, any> = {};
    for (const ev of evidences) {
      const cId = ev.complaintId.toString();
      if (!evidenceMap[cId]) {
        evidenceMap[cId] = ev;
      }
    }

    const result = complaints.map(c => {
      const cObj = c.toObject();
      return {
        ...cObj,
        latestEvidence: evidenceMap[c._id.toString()] || null
      };
    });

    return sendResponse(response, 200, true, 'Pending resolution verifications retrieved', result);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching verifications.');
  }
};


