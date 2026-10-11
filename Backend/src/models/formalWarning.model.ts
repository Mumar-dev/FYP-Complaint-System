import mongoose, { Schema, Document, Types } from 'mongoose';

export type WarningSeverity = 'Verbal' | 'Written' | 'Final';
export type WarningCategory = 'Attendance' | 'Performance' | 'Misconduct' | 'SLA Breach' | 'Insubordination' | 'Policy Breach' | 'Other';

export interface IFormalWarning extends Document {
  warningNumber: string; // e.g. WRN-2026-0001
  employeeId: Types.ObjectId; // References User._id (Staff)
  issuedBy: Types.ObjectId; // References User._id (Department Head / Supervisor / Admin)
  departmentId?: Types.ObjectId;
  category: WarningCategory;
  severity: WarningSeverity;
  subject: string;
  details: string;
  actionRequired?: string;
  evidenceUrl?: string;
  issuedAt: Date;
  acknowledgedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const formalWarningSchema = new Schema<IFormalWarning>(
  {
    warningNumber: { type: String, unique: true, required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    issuedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    category: {
      type: String,
      enum: ['Attendance', 'Performance', 'Misconduct', 'SLA Breach', 'Insubordination', 'Policy Breach', 'Other'],
      required: true,
      default: 'Performance'
    },
    severity: {
      type: String,
      enum: ['Verbal', 'Written', 'Final'],
      required: true,
      default: 'Written'
    },
    subject: { type: String, required: true },
    details: { type: String, required: true },
    actionRequired: { type: String },
    evidenceUrl: { type: String },
    issuedAt: { type: Date, default: Date.now },
    acknowledgedAt: { type: Date }
  },
  { timestamps: true }
);

export const FormalWarning = mongoose.model<IFormalWarning>(
  'FormalWarning',
  formalWarningSchema
);
