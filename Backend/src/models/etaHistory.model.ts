import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IETAHistory extends Document {
  complaintId: Types.ObjectId;
  proposedEta: Date;
  previousEta?: Date;
  reason: string;
  proposedBy: Types.ObjectId;
  status: 'pending_approval' | 'approved' | 'rejected' | 'auto_approved';
  isSignificantChange: boolean;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewRemarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const etaHistorySchema = new Schema<IETAHistory>(
  {
    complaintId: { type: Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    proposedEta: { type: Date, required: true },
    previousEta: { type: Date },
    reason: { type: String, required: true },
    proposedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending_approval', 'approved', 'rejected', 'auto_approved'],
      default: 'pending_approval'
    },
    isSignificantChange: { type: Boolean, default: false },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewRemarks: { type: String }
  },
  { timestamps: true }
);

etaHistorySchema.index({ complaintId: 1, createdAt: -1 });

export const ETAHistory = mongoose.model<IETAHistory>('ETAHistory', etaHistorySchema);

