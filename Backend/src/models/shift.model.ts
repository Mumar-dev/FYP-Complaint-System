import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IShift extends Document {
  name: string; // e.g. "Morning Maintenance", "Night Security"
  startTime: string; // Format "HH:mm" e.g. "08:00"
  endTime: string; // Format "HH:mm" e.g. "17:00"
  breakDurationMinutes: number; // e.g. 60
  gracePeriodMinutes: number; // e.g. 15 (allow check-in until 08:15 without being late)
  workingDays: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  isOvernight: boolean; // e.g. 20:00 to 06:00
  overtimeThresholdHours: number; // e.g. 8
  isActive: boolean;
  departmentId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const shiftSchema = new Schema<IShift>(
  {
    name: { type: String, required: true, trim: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    breakDurationMinutes: { type: Number, default: 60, min: 0 },
    gracePeriodMinutes: { type: Number, default: 15, min: 0 },
    workingDays: [{ type: Number, min: 0, max: 6 }],
    isOvernight: { type: Boolean, default: false },
    overtimeThresholdHours: { type: Number, default: 8, min: 1 },
    isActive: { type: Boolean, default: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export const Shift = mongoose.model<IShift>('Shift', shiftSchema);

