import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPerformanceAppeal extends Document {
  evaluationId: Types.ObjectId; // References PerformanceEvaluation._id
  employeeId: Types.ObjectId; // References User._id
  reason: string;
  supportingDocumentUrl?: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'UPHELD' | 'MODIFIED' | 'REJECTED';
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  decisionNotes?: string;
  revisedScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

const performanceAppealSchema = new Schema<IPerformanceAppeal>(
  {
    evaluationId: { type: Schema.Types.ObjectId, ref: 'PerformanceEvaluation', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reason: { type: String, required: true },
    supportingDocumentUrl: { type: String },
    status: {
      type: String,
      enum: ['PENDING', 'UNDER_REVIEW', 'UPHELD', 'MODIFIED', 'REJECTED'],
      default: 'PENDING'
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    decisionNotes: { type: String },
    revisedScore: { type: Number, min: 0, max: 100 }
  },
  { timestamps: true }
);

export const PerformanceAppeal = mongoose.model<IPerformanceAppeal>(
  'PerformanceAppeal',
  performanceAppealSchema
);

