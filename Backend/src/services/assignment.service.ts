import { Types } from 'mongoose';
import { Complaint } from '../models/complaint.model';
import { User } from '../models/user.model';
import { ComplaintAssignment } from '../models/complaintAssignment.model';
import { ActivityLog } from '../models/activityLog.model';
import { NotificationService } from './notification.service';
import { AuditService } from './audit.service';

export class AssignmentService {
  /**
   * Assigns primary staff and optional supporting staff to a complaint.
   * Validates department membership, prevents duplicate active assignments, and records assignment history.
   */
  static async assignComplaint(params: {
    complaintId: Types.ObjectId | string;
    primaryStaffId: Types.ObjectId | string;
    supportingStaffIds?: (Types.ObjectId | string)[];
    assignedBy: Types.ObjectId | string;
    assignedByRole: string;
    reason?: string;
  }) {
    const complaint = await Complaint.findById(params.complaintId);
    if (!complaint) throw new Error('Complaint not found');

    const primaryStaff = await User.findById(params.primaryStaffId);
    if (!primaryStaff || primaryStaff.role !== 'staff') {
      throw new Error('Assigned primary user must be a valid staff member');
    }

    const isPrimaryActive =
      (primaryStaff.employmentStatus === 'ACTIVE' || (!primaryStaff.employmentStatus && primaryStaff.accountStatus === 'active') || primaryStaff.accountStatus === 'active') &&
      primaryStaff.employmentStatus !== 'SUSPENDED' &&
      primaryStaff.employmentStatus !== 'TERMINATED' &&
      primaryStaff.accountStatus !== 'suspended' &&
      !(primaryStaff as any).isDeleted;

    if (!isPrimaryActive) {
      throw new Error(
        primaryStaff.employmentStatus === 'SUSPENDED' || primaryStaff.accountStatus === 'suspended'
          ? 'Cannot assign complaint to a suspended staff member'
          : primaryStaff.employmentStatus === 'TERMINATED'
          ? 'Cannot assign complaint to a terminated staff member'
          : 'Primary staff account is not active'
      );
    }

    // Verify staff department membership matches complaint department
    if (
      primaryStaff.departmentId &&
      primaryStaff.departmentId.toString() !== complaint.departmentId.toString()
    ) {
      throw new Error('Primary staff does not belong to the department assigned to this complaint');
    }

    // Validate supporting staff
    const validSupportingIds: Types.ObjectId[] = [];
    if (params.supportingStaffIds && params.supportingStaffIds.length > 0) {
      for (const supId of params.supportingStaffIds) {
        if (supId.toString() === params.primaryStaffId.toString()) continue; // Skip if same as primary

        const supStaff = await User.findById(supId);
        const isSupActive =
          supStaff &&
          supStaff.role === 'staff' &&
          (supStaff.employmentStatus === 'ACTIVE' || (!supStaff.employmentStatus && supStaff.accountStatus === 'active') || supStaff.accountStatus === 'active') &&
          supStaff.employmentStatus !== 'SUSPENDED' &&
          supStaff.employmentStatus !== 'TERMINATED' &&
          supStaff.accountStatus !== 'suspended' &&
          !(supStaff as any).isDeleted;

        if (isSupActive) {
          validSupportingIds.push(new Types.ObjectId(supId as string));
        }
      }
    }

    // Deactivate any existing active assignment for this complaint
    await ComplaintAssignment.updateMany(
      { complaintId: complaint._id, isActive: true },
      {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: new Types.ObjectId(params.assignedBy as string),
        deactivationReason: params.reason || 'Reassigned to new staff member'
      }
    );

    // Create new assignment record
    const assignment = await ComplaintAssignment.create({
      complaintId: complaint._id,
      departmentId: complaint.departmentId,
      primaryStaffId: primaryStaff._id,
      supportingStaffIds: validSupportingIds,
      assignedBy: new Types.ObjectId(params.assignedBy as string),
      assignedAt: new Date(),
      reason: params.reason,
      isActive: true
    });

    const isReassignment = Boolean(complaint.primaryStaffId);
    if (isReassignment) {
      complaint.reassignmentCount += 1;
      complaint.lastAssignedAt = new Date();
    } else {
      complaint.assignedAt = new Date();
    }

    complaint.primaryStaffId = primaryStaff._id;
    complaint.assignedStaffId = primaryStaff._id; // Backward compatibility
    complaint.supportingStaffIds = validSupportingIds;
    complaint.status = 'assigned';
    await complaint.save();

    // Audit Log
    await AuditService.log({
      userId: params.assignedBy,
      userRole: params.assignedByRole,
      action: isReassignment ? 'REASSIGN_COMPLAINT' : 'ASSIGN_COMPLAINT',
      entityType: 'Assignment',
      entityId: assignment._id,
      details: {
        complaintId: complaint._id,
        primaryStaffId: primaryStaff._id,
        supportingStaffIds: validSupportingIds,
        reason: params.reason
      }
    });

    const staffDisplayName = primaryStaff.profile?.fullName || (primaryStaff as any).name || primaryStaff.email || 'Staff Member';

    // Activity Log for Complaint Timeline
    await ActivityLog.create({
      complaintId: complaint._id,
      departmentId: complaint.departmentId,
      action: 'assigned',
      performedBy: params.assignedBy,
      metadata: {
        assignedTo: primaryStaff._id,
        assignedToName: staffDisplayName,
        message: `Assigned to ${staffDisplayName}`
      }
    });

    // Notify Primary Staff
    await NotificationService.send({
      userId: primaryStaff._id,
      type: isReassignment ? 'reassignment' : 'assignment',
      title: 'New Complaint Assigned',
      message: `You have been assigned as primary staff on complaint #${complaint.complaintId}: ${complaint.title}`,
      complaintId: complaint._id,
      idempotencyKey: `assign_primary_${complaint._id}_${primaryStaff._id}_${Date.now()}`
    });

    // Notify Supporting Staff
    for (const supId of validSupportingIds) {
      await NotificationService.send({
        userId: supId,
        type: 'assignment',
        title: 'Assigned as Supporting Staff',
        message: `You have been assigned as supporting staff on complaint #${complaint.complaintId}`,
        complaintId: complaint._id,
        idempotencyKey: `assign_sup_${complaint._id}_${supId}_${Date.now()}`
      });
    }

    return assignment;
  }

  /**
   * Calculates employee workload (active assigned complaints).
   */
  static async getStaffWorkload(staffId: Types.ObjectId | string): Promise<number> {
    return await Complaint.countDocuments({
      $or: [
        { primaryStaffId: staffId },
        { assignedStaffId: staffId },
        { supportingStaffIds: staffId }
      ],
      status: { $in: ['assigned', 'in_progress', 'under_verification'] }
    });
  }
}
