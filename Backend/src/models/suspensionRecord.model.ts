import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISuspensionRecord extends Document {
  employeeId: Types.ObjectId; // References User._id
  disciplinaryCaseId?: Types.ObjectId;
  startDate: Date;
  expectedEndDate: Date;
  actualEndDate?: Date;
  reason: string;
  authorizedBy: Types.ObjectId;
  status: 'ACTIVE' | 'COMPLETED' | 'REVOKED';
  reinstatementNotes?: string;
  reinstatedBy?: Types.ObjectId;
  reinstatedAt?: Date;
  reassignedComplaintsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const suspensionRecordSchema = new Schema<ISuspensionRecord>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    disciplinaryCaseId: { type: Schema.Types.ObjectId, ref: 'DisciplinaryCase' },
    startDate: { type: Date, required: true },
    expectedEndDate: { type: Date, required: true },
    actualEndDate: { type: Date },
    reason: { type: String, required: true },
    authorizedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED', 'REVOKED'],
      default: 'ACTIVE'
    },
    reinstatementNotes: { type: String },
    reinstatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reinstatedAt: { type: Date },
    reassignedComplaintsCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const SuspensionRecord = mongoose.model<ISuspensionRecord>(
  'SuspensionRecord',
  suspensionRecordSchema
);

