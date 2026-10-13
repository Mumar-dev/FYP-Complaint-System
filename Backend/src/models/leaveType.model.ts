import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILeaveType extends Document {
  name: string; // e.g. "Annual Leave", "Sick Leave", "Casual Leave", "Emergency Leave", "Unpaid Leave"
  code: string; // e.g. "ANNUAL", "SICK", "CASUAL", "UNPAID"
  defaultDaysPerYear: number;
  isPaid: boolean;
  requiresDocument: boolean;
  maxConsecutiveDays?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const leaveTypeSchema = new Schema<ILeaveType>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    defaultDaysPerYear: { type: Number, required: true, min: 0 },
    isPaid: { type: Boolean, default: true },
    requiresDocument: { type: Boolean, default: false },
    maxConsecutiveDays: { type: Number },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const LeaveType = mongoose.model<ILeaveType>('LeaveType', leaveTypeSchema);

