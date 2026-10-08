import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDisciplinaryCase extends Document {
  caseNumber: string; // e.g. DISC-2026-0001
  employeeId: Types.ObjectId; // References User._id
  category: 'misconduct' | 'negligence' | 'attendance_violation' | 'insubordination' | 'policy_breach' | 'other';
  title: string;
  description: string;
  incidentDate: Date;
  reportedBy: Types.ObjectId;
  evidenceUrls: string[];
  status: 'OPEN' | 'UNDER_REVIEW' | 'EMPLOYEE_RESPONDED' | 'ACTION_TAKEN' | 'APPEALED' | 'CLOSED';
  reviewerId?: Types.ObjectId;
  managementDecision?: 'warning' | 'fine' | 'suspension' | 'demotion' | 'termination' | 'exonerated';
  decisionDate?: Date;
  decisionJustification?: string;
  isConfidential: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const disciplinaryCaseSchema = new Schema<IDisciplinaryCase>(
  {
    caseNumber: { type: String, unique: true, required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: {
      type: String,
      enum: ['misconduct', 'negligence', 'attendance_violation', 'insubordination', 'policy_breach', 'other'],
      required: true
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    incidentDate: { type: Date, required: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    evidenceUrls: [{ type: String }],
    status: {
      type: String,
      enum: ['OPEN', 'UNDER_REVIEW', 'EMPLOYEE_RESPONDED', 'ACTION_TAKEN', 'APPEALED', 'CLOSED'],
      default: 'OPEN'
    },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User' },
    managementDecision: {
      type: String,
      enum: ['warning', 'fine', 'suspension', 'demotion', 'termination', 'exonerated']
    },
    decisionDate: { type: Date },
    decisionJustification: { type: String },
    isConfidential: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const DisciplinaryCase = mongoose.model<IDisciplinaryCase>(
  'DisciplinaryCase',
  disciplinaryCaseSchema
);

