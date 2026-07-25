import mongoose, { Schema } from 'mongoose';
import { INotification } from '../interfaces/notification.interface';

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { 
      type: String, 
      enum: [
        'assignment',
        'reassignment',
        'status_update',
        'eta_change',
        'eta_missed',
        'sla_breach',
        'escalated',
        'resolution_submitted',
        'evidence_approved',
        'evidence_rejected',
        'closed',
        'reopened',
        'cancelled',
        'attendance_correction',
        'leave_submitted',
        'leave_approved',
        'leave_rejected',
        'leave_cancelled',
        'performance_published',
        'performance_appeal',
        'promotion_submitted',
        'promotion_forwarded',
        'promotion_approved',
        'promotion_rejected',
        'employee_transfer',
        'disciplinary_case',
        'suspension_notice',
        'reinstatement_notice',
        'complaint_created',
        'verification_needed',
        'check_in',
        'check_out',
        'transfer_request',
        'transfer_approved',
        'transfer_rejected',
        'formal_warning',
        'resident_registered',
        'resident_approved',
        'admin_alert'
      ],
      required: true 
    },
    title: { type: String },
    message: { type: String, required: true },
    complaintId: { type: Schema.Types.ObjectId, ref: 'Complaint', index: true },
    read: { type: Boolean, default: false },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'delivered', 'failed'],
      default: 'delivered'
    },
    retryCount: { type: Number, default: 0 },
    idempotencyKey: { type: String, unique: true, sparse: true, index: true },
    errorLog: { type: String }
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ deliveryStatus: 1, retryCount: 1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
