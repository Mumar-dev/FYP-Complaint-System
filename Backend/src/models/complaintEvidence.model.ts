import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IComplaintEvidence extends Document {
  complaintId: Types.ObjectId;
  submittedBy: Types.ObjectId;
  notes: string;
  images: string[];
  isException: boolean;
  exceptionReason?: string;
  exceptionGrantedBy?: Types.ObjectId;
  status: 'submitted' | 'approved' | 'rejected';
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const complaintEvidenceSchema = new Schema<IComplaintEvidence>(
  {
    complaintId: { type: Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, required: true },
    images: [{ type: String }],
    isException: { type: Boolean, default: false },
    exceptionReason: { type: String },
    exceptionGrantedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['submitted', 'approved', 'rejected'],
      default: 'submitted'
    },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    rejectionReason: { type: String }
  },
  { timestamps: true }
);

complaintEvidenceSchema.index({ complaintId: 1, createdAt: -1 });

export const ComplaintEvidence = mongoose.model<IComplaintEvidence>(
  'ComplaintEvidence',
  complaintEvidenceSchema
);

