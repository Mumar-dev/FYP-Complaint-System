import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEmploymentHistory extends Document {
  employeeId: Types.ObjectId; // References User._id
  previousDesignation?: string;
  newDesignation: string;
  previousDepartmentId?: Types.ObjectId;
  newDepartmentId?: Types.ObjectId;
  previousStatus?: string;
  newStatus?: string;
  changeType: 'designation_update' | 'department_transfer' | 'status_change' | 'promotion' | 'suspension' | 'reinstatement';
  reason: string;
  changedBy: Types.ObjectId; // References User._id
  effectiveDate: Date;
  createdAt: Date;
}

const employmentHistorySchema = new Schema<IEmploymentHistory>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    previousDesignation: { type: String },
    newDesignation: { type: String, required: true },
    previousDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    newDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    previousStatus: { type: String },
    newStatus: { type: String },
    changeType: {
      type: String,
      enum: ['designation_update', 'department_transfer', 'status_change', 'promotion', 'suspension', 'reinstatement'],
      required: true
    },
    reason: { type: String, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    effectiveDate: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

employmentHistorySchema.index({ employeeId: 1, createdAt: -1 });

export const EmploymentHistory = mongoose.model<IEmploymentHistory>(
  'EmploymentHistory',
  employmentHistorySchema
);

