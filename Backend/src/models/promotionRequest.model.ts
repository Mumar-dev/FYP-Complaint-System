import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPromotionRequest extends Document {
  employeeId: Types.ObjectId; // References User._id
  currentDesignation: string;
  requestedDesignation: string;
  currentRank?: string;
  requestedRank?: string;
  proposedDepartmentId?: Types.ObjectId;
  requestType: 'self' | 'supervisor_recommendation';
  submittedBy: Types.ObjectId; // Employee or Supervisor
  justification: string;
  supportingDocumentUrl?: string;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'PENDING_DEPT_HEAD' | 'PENDING_ADMIN' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  deptHeadRemarks?: string;
  forwardedBy?: Types.ObjectId;
  forwardedAt?: Date;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  effectiveDate?: Date;
  rejectionReason?: string;
  isApplied: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const promotionRequestSchema = new Schema<IPromotionRequest>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    currentDesignation: { type: String, required: true },
    requestedDesignation: { type: String, required: true },
    currentRank: { type: String },
    requestedRank: { type: String },
    proposedDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    requestType: {
      type: String,
      enum: ['self', 'supervisor_recommendation'],
      required: true
    },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    justification: { type: String, required: true },
    supportingDocumentUrl: { type: String },
    status: {
      type: String,
      enum: ['SUBMITTED', 'UNDER_REVIEW', 'PENDING_DEPT_HEAD', 'PENDING_ADMIN', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
      default: 'PENDING_DEPT_HEAD'
    },
    deptHeadRemarks: { type: String },
    forwardedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    forwardedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    effectiveDate: { type: Date },
    rejectionReason: { type: String },
    isApplied: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const PromotionRequest = mongoose.model<IPromotionRequest>(
  'PromotionRequest',
  promotionRequestSchema
);

