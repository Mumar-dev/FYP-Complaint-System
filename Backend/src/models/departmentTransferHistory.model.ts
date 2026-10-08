import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDepartmentTransferHistory extends Document {
  complaintId: Types.ObjectId;
  fromDepartmentId: Types.ObjectId;
  toDepartmentId: Types.ObjectId;
  transferredBy: Types.ObjectId;
  reason: string;
  transferredAt: Date;
  createdAt: Date;
}

const departmentTransferHistorySchema = new Schema<IDepartmentTransferHistory>(
  {
    complaintId: { type: Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    fromDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    toDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    transferredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    transferredAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

departmentTransferHistorySchema.index({ complaintId: 1, createdAt: -1 });

export const DepartmentTransferHistory = mongoose.model<IDepartmentTransferHistory>(
  'DepartmentTransferHistory',
  departmentTransferHistorySchema
);

