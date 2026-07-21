import { Document, Types } from 'mongoose';

export type NotificationType =
  | 'assignment'
  | 'reassignment'
  | 'status_update'
  | 'eta_change'
  | 'eta_missed'
  | 'sla_breach'
  | 'escalated'
  | 'resolution_submitted'
  | 'evidence_approved'
  | 'evidence_rejected'
  | 'closed'
  | 'reopened'
  | 'cancelled'
  | 'attendance_correction'
  | 'leave_submitted'
  | 'leave_approved'
  | 'leave_rejected'
  | 'leave_cancelled'
  | 'performance_published'
  | 'performance_appeal'
  | 'promotion_submitted'
  | 'promotion_forwarded'
  | 'promotion_approved'
  | 'promotion_rejected'
  | 'employee_transfer'
  | 'disciplinary_case'
  | 'suspension_notice'
  | 'reinstatement_notice'
  | 'complaint_created'
  | 'verification_needed'
  | 'check_in'
  | 'check_out'
  | 'transfer_request'
  | 'transfer_approved'
  | 'transfer_rejected'
  | 'formal_warning'
  | 'resident_registered'
  | 'resident_approved'
  | 'admin_alert';

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: NotificationType;
  title?: string;
  message: string;
  complaintId?: Types.ObjectId;
  read: boolean;
  deliveryStatus: 'pending' | 'delivered' | 'failed';
  retryCount: number;
  idempotencyKey?: string;
  errorLog?: string;
  createdAt: Date;
  updatedAt: Date;
}
