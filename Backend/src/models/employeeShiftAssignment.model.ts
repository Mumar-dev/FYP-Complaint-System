import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEmployeeShiftAssignment extends Document {
  employeeId: Types.ObjectId; // References User._id
  shiftId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  scheduleType: 'ALL_DAYS' | 'SPECIFIC_DATES';
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const employeeShiftAssignmentSchema = new Schema<IEmployeeShiftAssignment>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shiftId: { type: Schema.Types.ObjectId, ref: 'Shift', required: true, index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scheduleType: {
      type: String,
      enum: ['ALL_DAYS', 'SPECIFIC_DATES'],
      default: 'ALL_DAYS'
    },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: { type: Date, default: null },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

employeeShiftAssignmentSchema.index({ employeeId: 1, isActive: 1 });
employeeShiftAssignmentSchema.index({ employeeId: 1, effectiveFrom: 1, effectiveTo: 1 });

export const EmployeeShiftAssignment = mongoose.model<IEmployeeShiftAssignment>(
  'EmployeeShiftAssignment',
  employeeShiftAssignmentSchema
);
