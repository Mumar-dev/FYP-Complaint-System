import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILeaveRequest extends Document {
  employeeId: Types.ObjectId; // References User._id
  leaveTypeId: Types.ObjectId; // References LeaveType._id
  startDate: Date;
  endDate: Date;
  totalDays: number;
  reason: string;
  supportingDocumentUrl?: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN' | 'CANCELLED';
  cancellationReason?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const leaveRequestSchema = new Schema<ILeaveRequest>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    leaveTypeId: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalDays: { type: Number, required: true, min: 0.5 },
    reason: { type: String, required: true, trim: true },
    supportingDocumentUrl: { type: String },
    status: {
      type: String,
      enum: ['SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED'],
      default: 'SUBMITTED',
      index: true
    },
    cancellationReason: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String }
  },
  { timestamps: true }
);

leaveRequestSchema.index({ employeeId: 1, startDate: 1, endDate: 1 });

export const LeaveRequest = mongoose.model<ILeaveRequest>('LeaveRequest', leaveRequestSchema);

