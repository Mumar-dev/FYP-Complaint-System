import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IComplaintTransferRequest extends Document {
  complaintId: Types.ObjectId;
  fromDepartmentId: Types.ObjectId;
  targetDepartmentId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewRemarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const complaintTransferRequestSchema = new Schema<IComplaintTransferRequest>(
  {
    complaintId: { type: Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    fromDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    targetDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewRemarks: { type: String }
  },
  { timestamps: true }
);

complaintTransferRequestSchema.index({ complaintId: 1, status: 1 });
complaintTransferRequestSchema.index({ createdAt: -1 });

export const ComplaintTransferRequest = mongoose.model<IComplaintTransferRequest>(
  'ComplaintTransferRequest',
  complaintTransferRequestSchema
);
