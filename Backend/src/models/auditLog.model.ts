import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  userId: Types.ObjectId;
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
  details?: {
    previousValue?: any;
    newValue?: any;
    reason?: string;
    affectedRecord?: string;
    metadata?: Record<string, any>;
  };
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    entityType: {
      type: String,
      enum: [
        'Complaint',
        'User',
        'Department',
        'Assignment',
        'Evidence',
        'ETA',
        'SLA',
        'Feedback',
        'Employee',
        'Attendance',
        'Shift',
        'Leave',
        'Performance',
        'Promotion',
        'Transfer',
        'Disciplinary'
      ],
      required: true,
      index: true
    },
    entityId: { type: Schema.Types.Mixed, index: true },
    details: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
