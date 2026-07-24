import mongoose, { Schema } from 'mongoose';
import { IComplaint } from '../interfaces/complaint.interface';

const complaintSchema = new Schema<IComplaint>(
  {
    complaintId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, trim: true, default: 'General' },
    status: { 
      type: String, 
      enum: [
        'submitted',
        'pending_assignment', 
        'assigned', 
        'in_progress', 
        'resolved', 
        'under_verification',
        'closed',
        'reopened',
        'cancelled'
      ],
      default: 'submitted' 
    },
    priority: { 
      type: String, 
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium' 
    },
    aiPriority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    systemPriority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    aiDepartment: { type: String, trim: true },
    systemDepartment: { type: String, trim: true },
    aiSuggestedDepartment: { type: String, trim: true },
    systemSuggestedDepartment: { type: String, trim: true },
    
    // ETA & SLA Tracking
    initialEta: { type: Date },
    currentEta: { type: Date },
    etaHistoryCount: { type: Number, default: 0 },
    slaDeadline: { type: Date, required: true },
    slaStatus: { type: String, enum: ['normal', 'extended'], default: 'normal' },
    slaBreached: { type: Boolean, default: false },
    slaWarningSent: { type: Boolean, default: false },
    
    // Timestamps for status transitions
    assignedAt: { type: Date },
    lastAssignedAt: { type: Date },
    reassignmentCount: { type: Number, default: 0 },
    resolvedAt: { type: Date },
    underVerificationAt: { type: Date },
    closedAt: { type: Date },
    reopenedAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
    reopenReason: { type: String },
    adjustmentFeedback: {
      remarks: { type: String },
      requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      requestedAt: { type: Date }
    },

    isActive: { type: Boolean, default: true },
    
    attachedImages: [{ type: String }],
    resolutionPhotos: [{ type: String }],
    
    location: {
      type: { type: String, enum: ['home', 'gps', 'manual'], default: 'manual' },
      address: { type: String },
      landmark: { type: String },
      additionalDetails: { type: String },
      lat: { type: Number },
      lng: { type: Number }
    },

    // Multi-Staff Assignments
    primaryStaffId: { type: Schema.Types.ObjectId, ref: 'User' },
    supportingStaffIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    // Ranking & Recommendations
    recommendedStaffIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    // Feedback System
    rating: { type: Number, min: 1, max: 5 },
    feedbackComment: { type: String },
    feedbackSubmittedAt: { type: Date },
    resolutionRemarks: { type: String },
    
    residentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    assignedStaffId: { type: Schema.Types.ObjectId, ref: 'User' }, // Backwards compatibility

    // Incident Correlation / Duplicate Detection
    relatedIncidentIds: [{ type: Schema.Types.ObjectId, ref: 'Complaint' }]
  },
  { timestamps: true }
);

// Pre-save hook to ensure formatted unique complaintId exists as fallback
complaintSchema.pre('save', function () {
  if (!this.complaintId) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    this.complaintId = `CMP-${dateStr}-${randomSuffix}`;
  }
  // Mirror primaryStaffId to assignedStaffId for legacy support
  if (this.primaryStaffId && !this.assignedStaffId) {
    this.assignedStaffId = this.primaryStaffId;
  }
});

// Formal structural indexing for performance optimization
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ departmentId: 1 });
complaintSchema.index({ residentId: 1 });
complaintSchema.index({ primaryStaffId: 1 });
complaintSchema.index({ assignedStaffId: 1 });
complaintSchema.index({ departmentId: 1, status: 1 });
complaintSchema.index({ 'location.lat': 1, 'location.lng': 1 });

export const Complaint = mongoose.model<IComplaint>('Complaint', complaintSchema);
