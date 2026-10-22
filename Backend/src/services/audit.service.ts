import { Types } from 'mongoose';
import { AuditLog, IAuditLog } from '../models/auditLog.model';

export interface CreateAuditLogParams {
  userId: Types.ObjectId | string;
  userRole: string;
  action: string;
  entityType:
    | 'Complaint'
    | 'User'
    | 'Department'
    | 'Assignment'
    | 'Evidence'
    | 'ETA'
    | 'SLA'
    | 'Feedback'
    | 'Employee'
    | 'Attendance'
    | 'Shift'
    | 'Leave'
    | 'Performance'
    | 'Promotion'
    | 'Transfer'
    | 'Disciplinary';
  entityId?: Types.ObjectId | string;
  previousValue?: any;
  newValue?: any;
  reason?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  /**
   * Log high-value actions with previous & new values, actor, timestamp, and optional reason.
   */
  static async log(params: CreateAuditLogParams): Promise<IAuditLog | null> {
    try {
      // Assemble structured audit details showing exactly who changed what, prior and new value
      const detailsPayload: any = {
        ...(params.details || {}),
        previousValue: params.previousValue,
        newValue: params.newValue,
        reason: params.reason
      };

      const record = await AuditLog.create({
        userId: params.userId,
        userRole: params.userRole,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: detailsPayload,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent
      });
      return record;
    } catch (error) {
      console.error('[AuditService] Failed to record audit log:', error);
      return null;
    }
  }
}
