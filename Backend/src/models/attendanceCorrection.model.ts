import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAttendanceCorrection extends Document {
  attendanceId: Types.ObjectId;
  employeeId: Types.ObjectId;
  originalCheckIn: Date;
  originalCheckOut?: Date;
  correctedCheckIn: Date;
  correctedCheckOut?: Date;
  reason: string;
  requestedBy: Types.ObjectId;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewRemarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceCorrectionSchema = new Schema<IAttendanceCorrection>(
  {
    attendanceId: { type: Schema.Types.ObjectId, ref: 'Attendance', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    originalCheckIn: { type: Date, required: true },
    originalCheckOut: { type: Date },
    correctedCheckIn: { type: Date, required: true },
    correctedCheckOut: { type: Date },
    reason: { type: String, required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewRemarks: { type: String }
  },
  { timestamps: true }
);

attendanceCorrectionSchema.index({ employeeId: 1, status: 1 });

export const AttendanceCorrection = mongoose.model<IAttendanceCorrection>(
  'AttendanceCorrection',
  attendanceCorrectionSchema
);

