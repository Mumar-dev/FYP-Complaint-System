export interface Complaint {
  _id: string;
  complaintId?: string;
  title: string;
  description: string;
  status: 'pending' | 'pending_assignment' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  aiPriority?: 'low' | 'medium' | 'high' | 'critical';
  systemPriority?: 'low' | 'medium' | 'high' | 'critical';
  aiDepartment?: string;
  systemDepartment?: string;
  residentId?: { _id: string; email: string; profile?: { fullName: string } };
  primaryStaffId?: {
    _id: string;
    email: string;
    profile?: { fullName?: string; phone?: string; profileImage?: string };
  } | string;
  supportingStaffIds?: Array<{
    _id: string;
    email: string;
    profile?: { fullName?: string; phone?: string; profileImage?: string };
  } | string>;
  assignedStaffId?: {
    _id: string;
    email: string;
    profile?: { fullName?: string; phone?: string; profileImage?: string };
  } | string;
  departmentId?: { _id: string; name: string } | any;
  category?: string;
  location?: { lat: number; lng: number };
  locationText?: string;
  slaDeadline: string;
  slaStatus?: 'normal' | 'extended';
  slaBreached?: boolean;
  assignedAt?: string;
  lastAssignedAt?: string;
  resolvedAt?: string;
  reassignmentCount?: number;
  createdAt: string;
  updatedAt: string;
  feedbackSubmitted?: boolean;
  rating?: number;
  feedbackComment?: string;
  feedbackSubmittedAt?: string;
  resolutionRemarks?: string;
  resolutionPhotos?: string[];
  resolutionEvidence?: {
    _id: string;
    notes: string;
    images: string[];
    status: 'submitted' | 'approved' | 'rejected';
    submittedBy?: {
      _id: string;
      email: string;
      profile?: { fullName?: string; phone?: string; profileImage?: string };
    } | string;
    verifiedBy?: {
      _id: string;
      email: string;
      profile?: { fullName?: string };
    } | string;
    rejectionReason?: string;
    verifiedAt?: string;
    createdAt: string;
    updatedAt: string;
  };
  adjustmentFeedback?: {
    remarks: string;
    requestedBy?: { _id: string; email: string; profile?: { fullName?: string } } | string;
    requestedAt: string;
  };
  attachedImages?: string[];
  images?: string[];
  isActive?: boolean;
  recommendedStaffIds?: string[];
}

export interface SubmitFeedbackDto {
  id: string;
  rating: number;
  comment?: string;
}

export interface CreateComplaintDto {
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  departmentId?: string;
  locationText?: string;
}

export interface UpdateComplaintStatusDto {
  id: string;
  status: 'pending' | 'pending_assignment' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'under_verification';
  resolutionRemarks?: string;
  resolutionPhotos?: string[];
  resolutionEvidence?: {
    _id: string;
    notes: string;
    images: string[];
    status: 'submitted' | 'approved' | 'rejected';
    submittedBy?: {
      _id: string;
      email: string;
      profile?: { fullName?: string; phone?: string; profileImage?: string };
    } | string;
    verifiedBy?: {
      _id: string;
      email: string;
      profile?: { fullName?: string };
    } | string;
    rejectionReason?: string;
    verifiedAt?: string;
    createdAt: string;
    updatedAt: string;
  };
  notes?: string;
  reason?: string;
}

export interface AssignComplaintDto {
  id: string;
  assignedStaffId?: string;
  primaryStaffId?: string;
  supportingStaffIds?: string[];
  reason?: string;
}

export interface StaffMember {
  _id: string;
  name: string;
  email?: string;
  rank?: string;
  accountStatus?: string;
  departmentId?: string | { _id: string; name: string };
  profile?: {
    fullName?: string;
    phone?: string;
    profileImage?: string;
  };
}

export interface GetStaffResponse {
  success: boolean;
  count: number;
  data: StaffMember[];
}

export interface ComplaintResponse {
  success: boolean;
  message?: string;
  data: Complaint;
}

export interface GetComplaintsResponse {
  success: boolean;
  data: Complaint[];
  total: number;
}

export interface ActivityLogNode {
  action: string;
  performedBy: { name: string; email: string | null };
  metadata: {
    from?: string;
    to?: string;
    assignedTo?: string;
    assignedToName?: string;
    message?: string;
  };
  createdAt: string;
}

export interface GetComplaintActivityResponse {
  success: boolean;
  count: number;
  data: ActivityLogNode[];
}
