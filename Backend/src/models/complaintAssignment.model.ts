import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IComplaintAssignment extends Document {
  complaintId: Types.ObjectId;
  departmentId: Types.ObjectId;
  primaryStaffId: Types.ObjectId;
  supportingStaffIds: Types.ObjectId[];
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  reason?: string;
  isActive: boolean;
  deactivatedAt?: Date;
  deactivatedBy?: Types.ObjectId;
  deactivationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const complaintAssignmentSchema = new Schema<IComplaintAssignment>(
  {
    complaintId: { type: Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    primaryStaffId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    supportingStaffIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedAt: { type: Date, default: Date.now },
    reason: { type: String },
    isActive: { type: Boolean, default: true, index: true },
    deactivatedAt: { type: Date },
    deactivatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deactivationReason: { type: String }
  },
  { timestamps: true }
);

complaintAssignmentSchema.index({ complaintId: 1, isActive: 1 });
complaintAssignmentSchema.index({ primaryStaffId: 1, isActive: 1 });

export const ComplaintAssignment = mongoose.model<IComplaintAssignment>(
  'ComplaintAssignment',
  complaintAssignmentSchema
);

