import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEmployeeTransfer extends Document {
  employeeId: Types.ObjectId; // References User._id
  currentDepartmentId: Types.ObjectId;
  targetDepartmentId: Types.ObjectId;
  reason: string;
  requestedBy: Types.ObjectId;
  effectiveDate: Date;
  status: 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PENDING';
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  reassignedComplaintsCount: number;
  isExecuted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const employeeTransferSchema = new Schema<IEmployeeTransfer>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    currentDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    targetDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    reason: { type: String, required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    effectiveDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PENDING'],
      default: 'REQUESTED'
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
    reassignedComplaintsCount: { type: Number, default: 0 },
    isExecuted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const EmployeeTransfer = mongoose.model<IEmployeeTransfer>(
  'EmployeeTransfer',
  employeeTransferSchema
);

