import { Document, Types } from 'mongoose';

export type ComplaintStatus =
  | 'submitted'
  | 'pending_assignment'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'under_verification'
  | 'closed'
  | 'reopened'
  | 'cancelled';

export type ComplaintPriority = 'low' | 'medium' | 'high' | 'critical';

export interface IComplaintLocation {
  type?: 'home' | 'gps' | 'manual';
  address?: string;
  landmark?: string;
  additionalDetails?: string;
  lat?: number;
  lng?: number;
}

export interface IComplaint extends Document {
  complaintId: string; // Formatted unique readable string e.g. CMP-20261117-0001
  title: string;
  description: string;
  category?: string;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  aiPriority?: ComplaintPriority;
  systemPriority?: ComplaintPriority;
  aiDepartment?: string;
  systemDepartment?: string;
  aiSuggestedDepartment?: string;
  systemSuggestedDepartment?: string;
  
  // ETA & SLA Tracking
  initialEta?: Date;
  currentEta?: Date;
  etaHistoryCount: number;
  slaDeadline: Date;
  slaStatus: 'normal' | 'extended';
  slaBreached: boolean;
  slaWarningSent?: boolean;
  
  // Assignment Tracking
  assignedAt?: Date;
  lastAssignedAt?: Date;
  reassignmentCount: number;
  resolvedAt?: Date;
  underVerificationAt?: Date;
  closedAt?: Date;
  reopenedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  adjustmentFeedback?: {
    remarks: string;
    requestedBy?: Types.ObjectId;
    requestedAt: Date;
  };
  reopenReason?: string;

  isActive: boolean;
  
  attachedImages: string[];
  resolutionPhotos?: string[];
  location?: IComplaintLocation;

  // Multi-Staff Assignments
  primaryStaffId?: Types.ObjectId;
  supportingStaffIds: Types.ObjectId[];

  // Ranking & Recommendations
  recommendedStaffIds: Types.ObjectId[];
  
  // Feedback System
  rating?: number;
  feedbackComment?: string;
  feedbackSubmittedAt?: Date;
  resolutionRemarks?: string;
  
  residentId: Types.ObjectId;
  departmentId: Types.ObjectId;
  assignedStaffId?: Types.ObjectId; // Kept for backwards compatibility with legacy routes/queries
  
  // Incident Grouping / Correlation
  relatedIncidentIds: Types.ObjectId[];

  createdAt: Date;
  updatedAt: Date;
}
