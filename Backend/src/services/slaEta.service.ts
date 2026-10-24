import { Complaint } from '../models/complaint.model';
import { SLAPolicy } from '../models/slaPolicy.model';
import { ETAHistory } from '../models/etaHistory.model';
import { NotificationService } from './notification.service';
import { Types } from 'mongoose';

export class SlaEtaService {
  /**
   * Calculates SLA deadline based on configured SLAPolicy or department target hours.
   */
  static async calculateSlaDeadline(
    category: string,
    priority: 'low' | 'medium' | 'high' | 'critical',
    defaultHours: number = 48
  ): Promise<Date> {
    const policy = await SLAPolicy.findOne({ category, priority, isActive: true });
    const hours = policy ? policy.targetHours : defaultHours;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  /**
   * Staff proposes an ETA change.
   * If the change is significant (> 12 hours difference or extends past SLA), supervisor approval is required.
   */
  static async proposeEtaChange(params: {
    complaintId: Types.ObjectId | string;
    proposedEta: Date;
    reason: string;
    proposedBy: Types.ObjectId | string;
    userRole: string;
  }) {
    const complaint = await Complaint.findById(params.complaintId);
    if (!complaint) throw new Error('Complaint not found');

    const previousEta = complaint.currentEta || complaint.initialEta;
    const proposedTime = new Date(params.proposedEta).getTime();
    
    // Check if change is significant (> 12 hours delta or extends beyond SLA)
    let isSignificantChange = false;
    if (previousEta) {
      const deltaHours = Math.abs(proposedTime - new Date(previousEta).getTime()) / (1000 * 60 * 60);
      if (deltaHours >= 12) isSignificantChange = true;
    } else {
      isSignificantChange = true;
    }

    if (complaint.slaDeadline && proposedTime > new Date(complaint.slaDeadline).getTime()) {
      isSignificantChange = true;
    }

    // Supervisors and Admins can auto-approve ETA modifications
    const canAutoApprove = ['supervisor', 'department_head', 'admin', 'superadmin'].includes(params.userRole);

    const etaRecord = await ETAHistory.create({
      complaintId: complaint._id,
      proposedEta: params.proposedEta,
      previousEta: previousEta,
      reason: params.reason,
      proposedBy: params.proposedBy,
      status: canAutoApprove || !isSignificantChange ? 'approved' : 'pending_approval',
      isSignificantChange,
      reviewedBy: canAutoApprove ? params.proposedBy : undefined,
      reviewedAt: canAutoApprove ? new Date() : undefined
    });

    if (canAutoApprove || !isSignificantChange) {
      complaint.currentEta = params.proposedEta;
      if (!complaint.initialEta) complaint.initialEta = params.proposedEta;
      complaint.etaHistoryCount += 1;
      await complaint.save();

      // Notify resident about ETA change
      await NotificationService.send({
        userId: complaint.residentId,
        type: 'eta_change',
        title: 'Estimated Completion Updated',
        message: `The estimated completion time for complaint #${complaint.complaintId} has been updated to ${new Date(params.proposedEta).toUTCString()}.`,
        complaintId: complaint._id,
        idempotencyKey: `eta_change_${complaint._id}_${etaRecord._id}`
      });
    }

    return etaRecord;
  }

  /**
   * Supervisor reviews pending ETA change.
   */
  static async reviewEtaChange(params: {
    etaHistoryId: Types.ObjectId | string;
    supervisorId: Types.ObjectId | string;
    action: 'approved' | 'rejected';
    reviewRemarks?: string;
  }) {
    const etaRecord = await ETAHistory.findById(params.etaHistoryId);
    if (!etaRecord) throw new Error('ETA record not found');
    if (etaRecord.status !== 'pending_approval') {
      throw new Error(`ETA record is already ${etaRecord.status}`);
    }

    etaRecord.status = params.action;
    etaRecord.reviewedBy = new Types.ObjectId(params.supervisorId as string);
    etaRecord.reviewedAt = new Date();
    etaRecord.reviewRemarks = params.reviewRemarks;
    await etaRecord.save();

    if (params.action === 'approved') {
      const complaint = await Complaint.findById(etaRecord.complaintId);
      if (complaint) {
        complaint.currentEta = etaRecord.proposedEta;
        complaint.etaHistoryCount += 1;
        await complaint.save();

        await NotificationService.send({
          userId: complaint.residentId,
          type: 'eta_change',
          title: 'Estimated Completion Approved',
          message: `The updated estimated completion for #${complaint.complaintId} has been approved: ${new Date(etaRecord.proposedEta).toUTCString()}.`,
          complaintId: complaint._id,
          idempotencyKey: `eta_approved_${complaint._id}_${etaRecord._id}`
        });
      }
    }

    return etaRecord;
  }
}

