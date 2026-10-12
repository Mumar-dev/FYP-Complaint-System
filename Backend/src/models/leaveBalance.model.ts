import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILeaveBalance extends Document {
  employeeId: Types.ObjectId; // References User._id
  leaveTypeId: Types.ObjectId; // References LeaveType._id
  year: number; // e.g. 2026
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  createdAt: Date;
  updatedAt: Date;
}

const leaveBalanceSchema = new Schema<ILeaveBalance>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    leaveTypeId: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true, index: true },
    year: { type: Number, required: true },
    allocatedDays: { type: Number, required: true, default: 0 },
    usedDays: { type: Number, default: 0 },
    pendingDays: { type: Number, default: 0 },
    remainingDays: { type: Number, required: true, default: 0 }
  },
  { timestamps: true }
);

leaveBalanceSchema.index({ employeeId: 1, leaveTypeId: 1, year: 1 }, { unique: true });

export const LeaveBalance = mongoose.model<ILeaveBalance>('LeaveBalance', leaveBalanceSchema);

