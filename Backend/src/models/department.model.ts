import mongoose, { Schema } from 'mongoose';
import { IDepartment } from '../interfaces/department.interface';

const departmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, unique: true },
    code: { type: String, trim: true, uppercase: true, sparse: true },
    keywords: { type: [String], default: [] },
    positions: { type: [String], default: [] },
    slaTargetHours: { 
      type: Number, 
      required: true 
    },
    description: { type: String },
    headOfDepartment: { 
      type: Schema.Types.ObjectId, 
      ref: 'User',
      default: null
    },
    isActive: { 
      type: Boolean, 
      default: false 
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    rejectionReason: { type: String, trim: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

export const Department = mongoose.model<IDepartment>('Department', departmentSchema);
