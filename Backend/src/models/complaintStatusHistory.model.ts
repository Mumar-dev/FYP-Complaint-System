import mongoose, { Schema, Document, Types } from 'mongoose';
import { ComplaintStatus } from '../interfaces/complaint.interface';

export interface IComplaintStatusHistory extends Document {
  complaintId: Types.ObjectId;
  previousStatus: ComplaintStatus;
  newStatus: ComplaintStatus;
  changedBy: Types.ObjectId;
  reason?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const complaintStatusHistorySchema = new Schema<IComplaintStatusHistory>(
  {
    complaintId: { type: Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    previousStatus: { type: String, required: true },
    newStatus: { type: String, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

complaintStatusHistorySchema.index({ complaintId: 1, createdAt: 1 });

export const ComplaintStatusHistory = mongoose.model<IComplaintStatusHistory>(
  'ComplaintStatusHistory',
  complaintStatusHistorySchema
);

