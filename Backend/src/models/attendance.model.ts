import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAttendance extends Document {
  employeeId: Types.ObjectId; // References User._id
  date: Date; // Normalized to YYYY-MM-DD UTC
  shiftId?: Types.ObjectId;
  checkInTime?: Date;
  checkOutTime?: Date;
  checkInMethod: 'web' | 'mobile' | 'biometric' | 'manual';
  checkInLocation?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  checkOutLocation?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  workingHours: number; // Decimal hours e.g. 7.5
  overtimeHours: number; // Overtime past shift threshold
  isLate: boolean;
  isEarlyDeparture: boolean;
  status: 'present' | 'half_day' | 'on_leave' | 'absent';
  leaveRequestId?: Types.ObjectId;
  isCorrected: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },
    shiftId: { type: Schema.Types.ObjectId, ref: 'Shift' },
    checkInTime: { type: Date },
    checkOutTime: { type: Date },
    checkInMethod: {
      type: String,
      enum: ['web', 'mobile', 'biometric', 'manual'],
      default: 'web'
    },
    checkInLocation: {
      lat: Number,
      lng: Number,
      address: String
    },
    checkOutLocation: {
      lat: Number,
      lng: Number,
      address: String
    },
    workingHours: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    isLate: { type: Boolean, default: false },
    isEarlyDeparture: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['present', 'half_day', 'on_leave', 'absent'],
      default: 'present'
    },
    leaveRequestId: { type: Schema.Types.ObjectId, ref: 'LeaveRequest' },
    isCorrected: { type: Boolean, default: false },
    notes: { type: String }
  },
  { timestamps: true }
);

// Prevent multiple attendance records for same employee on same calendar date
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model<IAttendance>('Attendance', attendanceSchema);

