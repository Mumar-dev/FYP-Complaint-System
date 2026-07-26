import mongoose, { Schema } from 'mongoose';
import { IUser } from '../interfaces/user.interface';

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    role: {
      type: String,
      enum: ['admin', 'superadmin', 'department_head', 'supervisor', 'staff', 'resident'],
      required: true
    },
    rank: {
      type: String,
      enum: ['junior', 'senior', 'team_lead', 'lead', 'supervisor', 'head'],
      default: 'junior'
    },
    previousRank: {
      type: String
    },
    accountStatus: {
      type: String,
      enum: ['active', 'pending', 'suspended'],
      default: 'pending'
    },
    statusHistory: [
      {
        status: { type: String, enum: ['active', 'pending', 'suspended'], required: true },
        changedAt: { type: Date, default: Date.now },
        reason: { type: String }
      }
    ],
    applicationVersion: {
      type: Number,
      default: 1
    },
    rejectionReason: {
      type: String
    },
    lastAppliedAt: {
      type: Date
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department'
    },

    // HR Extension Fields (Unified CMS Employee Identity)
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    designation: {
      type: String,
      trim: true
    },
    employmentStatus: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED', 'TERMINATED'],
      default: 'ACTIVE'
    },
    employmentType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'probation'],
      default: 'full_time'
    },
    joiningDate: {
      type: Date
    },

    refreshToken: { type: String },
    resetOTP: { type: String },
    resetOTPExpires: { type: Date },
    profile: {
      cnic: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
        set: (value: string | undefined) => value?.replace(/\D/g, '')
      },
      proofDocumentUrl: { type: String },
      position: { type: String },
      fullName: { type: String, required: function(this: any) { return this.role === 'staff'; } },
      phone: { type: String },
      profileImage: { type: String },
      avatar: { type: String },
      address: {
        block: String,
        houseNumber: String,
        street: String
      },
      emergencyContact: {
        name: String,
        relationship: String,
        phone: String
      }
    }
  },
  { timestamps: true }
);

// Auto-generate employeeId for non-resident roles if missing
userSchema.pre('save', function () {
  if (this.role !== 'resident' && !this.employeeId) {
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    this.employeeId = `EMP-${year}-${randomSuffix}`;
  }
});

userSchema.index({ role: 1 });
userSchema.index({ departmentId: 1, role: 1 });
userSchema.index({ employmentStatus: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
