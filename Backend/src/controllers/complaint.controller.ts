import { Response } from 'express';
import mongoose from 'mongoose';
import { Filter } from 'mongodb';
import { Complaint } from '../models/complaint.model';
import { Department } from '../models/department.model';
import { ActivityLog } from '../models/activityLog.model';
import { User } from '../models/user.model';
import { Notification } from '../models/notification.model';
import { Feedback } from '../models/feedback.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { IComplaint, ComplaintStatus, ComplaintPriority } from '../interfaces/complaint.interface';
import { uploadBufferToCloudinary } from '../utils/cloudinary';
import { classifyComplaint } from '../services/ai.service';
import { sendResponse } from '../utils/response';
import { ComplaintWorkflowService } from '../services/statusTransition.service';
import { AssignmentService } from '../services/assignment.service';
import { DuplicateDetectionService } from '../services/duplicateDetection.service';
import { SlaEtaService } from '../services/slaEta.service';
import { AuditService } from '../services/audit.service';
import { NotificationService } from '../services/notification.service';

/**
 * POST /api/complaints/check-duplicate - Pre-submission check
 * Returns matching open tickets without saving or committing a new complaint.
 */
export const checkDuplicateComplaint = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const {
      title,
      description,
      departmentId: payloadDeptId,
      locationType = 'manual',
      address,
      lat,
      lng
    } = request.body;

    if (!description) {
      return sendResponse(response, 200, true, 'Check complete', { duplicates: [] });
    }

    const allDepartments = await Department.find({
      approvalStatus: 'approved',
      isActive: true
    });
    const validDepartmentsPayload = allDepartments.map(d => ({
      name: d.name,
      description: d.description || '',
      keywords: d.keywords || []
    }));

    // Predict department if not provided
    const aiContext = title && !title.includes('Automated Voice') ? `${title}. ${description}` : description;
    const aiResult = await classifyComplaint(aiContext, validDepartmentsPayload);

    const fallbackTarget = allDepartments.find(
      d => d.name.trim().toLowerCase() === 'general' || d.name.trim().toLowerCase() === 'unassigned'
    );
    const fallbackDeptId = fallbackTarget ? fallbackTarget._id : (allDepartments[0]?._id);

    let finalDepartmentId = payloadDeptId;
    if (!finalDepartmentId && aiResult) {
      const matchedDept = allDepartments.find(
        d => d.name.trim().toLowerCase() === aiResult.department.trim().toLowerCase()
      );
      finalDepartmentId = matchedDept ? matchedDept._id : fallbackDeptId;
    } else if (!finalDepartmentId) {
      finalDepartmentId = fallbackDeptId;
    }

    // Resolve address
    let resolvedAddress = address;
    if (locationType === 'home' && user.profile?.address) {
      const addr = user.profile.address;
      resolvedAddress = `House ${addr.houseNumber || ''}, Block ${addr.block || ''}, ${addr.street || ''}`.trim();
    }

    const duplicates = await DuplicateDetectionService.findPotentialDuplicates({
      title: title || description.slice(0, 50),
      description,
      departmentId: finalDepartmentId,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      address: resolvedAddress
    });

    const formattedDuplicates = duplicates.map(d => ({
      _id: d._id,
      ticketId: d.complaintId || `#${d._id.toString().slice(-6).toUpperCase()}`,
      title: d.title,
      description: d.description,
      status: d.status,
      priority: d.priority,
      createdAt: (d as any).createdAt
    }));

    return sendResponse(response, 200, true, 'Duplicate check completed', {
      duplicates: formattedDuplicates
    });
  } catch (error: any) {
    console.error('[Check Duplicate Error]:', error);
    return sendResponse(response, 200, true, 'Duplicate check completed', { duplicates: [] });
  }
};

/**
 * Resident creates a new complaint:
 * - Unique formatted complaint ID generated automatically.
 * - Supports 3 location modes: home, gps, manual text + landmark.
 * - Supports multiple image uploads.
 * - Computes SLA deadline dynamically.
 * - Runs duplicate detection to warn and link related incidents without merging records.
 */
export const createComplaint = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const {
      title,
      description,
      departmentId: payloadDeptId,
      priority: payloadPriority,
      category = 'General',
      locationType = 'manual',
      address,
      landmark,
      additionalDetails,
      lat,
      lng
    } = request.body;

    if (!title || !description) {
      return sendResponse(response, 400, false, 'Title and description are required.');
    }

    const allDepartments = await Department.find({
      approvalStatus: 'approved',
      isActive: true
    });
    if (allDepartments.length === 0) {
      return sendResponse(response, 500, false, 'Critical Fault: No Departments available for routing.');
    }

    const validDepartmentsPayload = allDepartments.map(d => ({
      name: d.name,
      description: d.description || '',
      keywords: d.keywords || []
    }));

    // AI & System Auto-classification Pipeline
    const aiContext = title && !title.includes('Automated Voice') ? `${title}. ${description}` : description;
    const aiResult = await classifyComplaint(aiContext, validDepartmentsPayload);

    let finalDepartmentId = payloadDeptId;
    let finalPriority: any = payloadPriority || 'medium';
    let aiPriority: any = undefined;
    let systemPriority: any = undefined;
    let aiDepartment: string | null = null;
    let systemDepartment: string | null = null;
    let aiSuggestedDepartment: string | null = null;
    let systemSuggestedDepartment: string | null = null;

    const fallbackTarget = allDepartments.find(
      d => d.name.trim().toLowerCase() === 'general' || d.name.trim().toLowerCase() === 'unassigned'
    );
    const fallbackDeptId = fallbackTarget ? fallbackTarget._id : allDepartments[0]._id;

    if (aiResult) {
      const matchedDept = allDepartments.find(
        d => d.name.trim().toLowerCase() === aiResult.department.trim().toLowerCase()
      );
      finalDepartmentId = payloadDeptId || (matchedDept ? matchedDept._id : fallbackDeptId);
      finalPriority = payloadPriority || aiResult.priority;
      aiPriority = aiResult.aiPriority;
      systemPriority = aiResult.systemPriority;
      aiDepartment = aiResult.aiDepartment;
      systemDepartment = aiResult.systemDepartment;
      aiSuggestedDepartment = aiResult.aiSuggestedDepartment || aiResult.aiDepartment;
      systemSuggestedDepartment = aiResult.systemSuggestedDepartment || aiResult.systemDepartment;
    } else {
      finalDepartmentId = payloadDeptId || fallbackDeptId;
      finalPriority = payloadPriority || 'medium';
    }

    const department = await Department.findById(finalDepartmentId);
    if (!department) {
      return sendResponse(response, 500, false, 'Department resolution failed.');
    }

    // Resolve category: If not provided or 'General', automatically set category to matched department name
    // so it always matches configured SLA Policies (e.g. 'Electrical & Power', 'Maintenance', etc.)
    let resolvedCategory = category;
    if (!resolvedCategory || resolvedCategory.trim().toLowerCase() === 'general') {
      resolvedCategory = department.name;
    }

    // Attachment processing
    const attachedImages: string[] = [];
    if (request.files && Array.isArray(request.files)) {
      for (const file of request.files) {
        try {
          const url = await uploadBufferToCloudinary(file.buffer, 'complaints');
          attachedImages.push(url);
        } catch (e) {
          console.error('[Backend] Cloudinary upload exception:', e);
        }
      }
    }

    // Location configuration
    let resolvedAddress = address;
    if (locationType === 'home' && user.profile?.address) {
      const addr = user.profile.address;
      resolvedAddress = `House ${addr.houseNumber || ''}, Block ${addr.block || ''}, ${addr.street || ''}`.trim();
    }

    const locationObj = {
      type: locationType,
      address: resolvedAddress,
      landmark,
      additionalDetails,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined
    };

    // Calculate SLA using policy engine with the resolved category & priority
    const slaDeadline = await SlaEtaService.calculateSlaDeadline(
      resolvedCategory,
      finalPriority,
      department.slaTargetHours || 48
    );

    // Initial ETA set by default to SLA deadline until staff recommends revision
    const initialEta = new Date(Date.now() + (department.slaTargetHours || 24) * 60 * 60 * 1000);

    // Duplicate Complaint Detection: Link related complaints without merging or deleting
    const relatedIncidents = await DuplicateDetectionService.findPotentialDuplicates({
      title,
      description,
      category: resolvedCategory,
      departmentId: finalDepartmentId,
      lat: locationObj.lat,
      lng: locationObj.lng,
      address: locationObj.address
    });
    const relatedIncidentIds = relatedIncidents.map(i => i._id);

    // Format unique readable complaintId incorporating department code if available:
    // Format: CMP-<CODE>-<YYYYMMDD>-<RANDOM> or CMP-<YYYYMMDD>-<RANDOM>
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const deptCode = department.code ? String(department.code).trim().toUpperCase() : '';
    const generatedComplaintId = deptCode
      ? `CMP-${deptCode}-${dateStr}-${randomSuffix}`
      : `CMP-${dateStr}-${randomSuffix}`;

    const complaint: any = await Complaint.create({
      complaintId: generatedComplaintId,
      title,
      description,
      category: resolvedCategory,
      departmentId: finalDepartmentId,
      priority: finalPriority,
      aiPriority,
      systemPriority,
      aiDepartment: aiDepartment || undefined,
      systemDepartment: systemDepartment || undefined,
      aiSuggestedDepartment: aiSuggestedDepartment || undefined,
      systemSuggestedDepartment: systemSuggestedDepartment || undefined,
      attachedImages,
      location: locationObj,
      residentId: user._id,
      status: 'submitted',
      slaDeadline,
      initialEta,
      currentEta: initialEta,
      relatedIncidentIds
    });

    // Centralized Audit Log
    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'CREATE_COMPLAINT',
      entityType: 'Complaint',
      entityId: complaint._id,
      details: {
        title,
        category: resolvedCategory,
        priority: finalPriority,
        aiPriority,
        systemPriority,
        aiDepartment,
        systemDepartment,
        aiSuggestedDepartment,
        systemSuggestedDepartment,
        departmentId: finalDepartmentId
      }
    });

    // Activity Log for Complaint Timeline
    await ActivityLog.create({
      complaintId: complaint._id,
      departmentId: finalDepartmentId,
      action: 'created',
      performedBy: user._id,
      metadata: {
        message: 'Complaint submitted by resident'
      }
    });

    // In-App Notification to Resident confirming submission
    await NotificationService.send({
      userId: user._id,
      type: 'status_update',
      title: 'Complaint Submitted',
      message: `Your complaint #${complaint.complaintId} has been successfully registered.`,
      complaintId: complaint._id,
      idempotencyKey: `created_${complaint._id}`
    });

    // Notify Department Head(s) of this department about the new complaint
    const residentName = user.profile?.fullName || (user as any).name || user.email || 'Resident';
    await NotificationService.notifyDepartmentHeads(finalDepartmentId, {
      type: 'complaint_created',
      message: `**New Complaint:** ${residentName} reported "${complaint.title}" (#${complaint.complaintId}).`,
      complaintId: complaint._id
    });

    return sendResponse(response, 201, true, 'Complaint created successfully.', {
      complaint,
      hasRelatedIncidents: relatedIncidents.length > 0,
      relatedCount: relatedIncidents.length
    });
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Server error creating complaint');
  }
};

/**
 * Get complaints with strict role-based access control and resource ownership.
 * Residents: View ONLY their own complaints.
 * Staff: View complaints where they are primary or supporting staff.
 * Supervisors / Dept Heads: View all complaints for their department.
 * Admins: View all complaints with filtering.
 */
export const getComplaints = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const filter: any = {};

    if (user.role === 'resident') {
      filter.residentId = user._id;
    } else if (user.role === 'staff') {
      filter.$or = [
        { primaryStaffId: user._id },
        { assignedStaffId: user._id },
        { supportingStaffIds: user._id }
      ];
    } else if (user.role === 'department_head' || user.role === 'supervisor') {
      if (user.departmentId) {
        filter.departmentId = user.departmentId;
      }
    }

    if (request.query.status) {
      filter.status = request.query.status;
    }
    if (request.query.priority) {
      filter.priority = request.query.priority;
    }
    if (request.query.departmentId && ['admin', 'superadmin'].includes(user.role)) {
      filter.departmentId = request.query.departmentId;
    }

    const complaints = await Complaint.find(filter)
      .populate('residentId', 'email profile.fullName profile.phone')
      .populate('primaryStaffId', 'email profile.fullName profile.phone profile.profileImage')
      .populate('assignedStaffId', 'email profile.fullName profile.phone profile.profileImage')
      .populate('supportingStaffIds', 'email profile.fullName')
      .populate('departmentId', 'name')
      .sort({ createdAt: -1 });

    return sendResponse(response, 200, true, 'Complaints retrieved', complaints);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Server error');
  }
};

/**
 * Update complaint status through the centralized workflow transition service.
 */
export const updateComplaintStatus = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { id } = request.params;
    const { status, reason, notes, evidenceImages, isException, exceptionReason } = request.body;

    if (!status) {
      return sendResponse(response, 400, false, 'Target status is required.');
    }

    const updated = await ComplaintWorkflowService.transitionStatus({
      complaintId: id as string,
      nextStatus: status as ComplaintStatus,
      userId: user._id,
      userRole: user.role,
      reason,
      notes,
      evidenceImages,
      isException,
      exceptionReason
    });

    return sendResponse(response, 200, true, 'Complaint status updated successfully', updated);
  } catch (error: any) {
    return sendResponse(response, 400, false, error.message || 'Invalid status transition');
  }
};

/**
 * Assign primary and optional supporting staff.
 */
export const assignComplaint = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { id } = request.params;
    const { primaryStaffId, supportingStaffIds, reason } = request.body;

    const staffId = primaryStaffId || request.body.assignedStaffId;
    if (!staffId) {
      return sendResponse(response, 400, false, 'Primary staff member is required.');
    }

    const assignment = await AssignmentService.assignComplaint({
      complaintId: id as string,
      primaryStaffId: staffId,
      supportingStaffIds,
      assignedBy: user._id,
      assignedByRole: user.role,
      reason
    });

    return sendResponse(response, 200, true, 'Complaint assigned successfully', assignment);
  } catch (error: any) {
    return sendResponse(response, 400, false, error.message || 'Error during assignment');
  }
};

/**
 * Propose or update ETA for a complaint.
 */
export const updateComplaintEta = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { id } = request.params;
    const { proposedEta, reason } = request.body;

    if (!proposedEta || !reason) {
      return sendResponse(response, 400, false, 'Proposed ETA and reason are required.');
    }

    const etaRecord = await SlaEtaService.proposeEtaChange({
      complaintId: id as string,
      proposedEta: new Date(proposedEta),
      reason,
      proposedBy: user._id,
      userRole: user.role
    });

    return sendResponse(response, 200, true, 'ETA update submitted.', etaRecord);
  } catch (error: any) {
    return sendResponse(response, 400, false, error.message || 'Error updating ETA');
  }
};

/**
 * Fetch a single complaint by ID with ownership/role security check.
 */
export const getComplaintById = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const user = request.user!;

    const complaint = await Complaint.findById(id)
      .populate('residentId', 'email profile.fullName profile.phone profile.address')
      .populate('primaryStaffId', 'email profile.fullName profile.phone profile.profileImage')
      .populate('assignedStaffId', 'email profile.fullName profile.phone profile.profileImage')
      .populate('supportingStaffIds', 'email profile.fullName profile.phone')
      .populate('departmentId', 'name')
      .populate('relatedIncidentIds', 'complaintId title status createdAt');

    if (!complaint) {
      return sendResponse(response, 404, false, 'Complaint not found');
    }

    // Role-based Resource Ownership Check: Residents can ONLY view their own complaints
    if (user.role === 'resident' && complaint.residentId._id.toString() !== user._id.toString()) {
      return sendResponse(response, 403, false, 'Forbidden: You cannot access other residents complaints.');
    }

    // Fetch latest resolution evidence and accumulated proof photos if available
    const allEvidences = await require('../models/complaintEvidence.model').ComplaintEvidence.find({ complaintId: complaint._id })
      .populate('submittedBy', 'email profile.fullName profile.phone profile.profileImage')
      .populate('verifiedBy', 'email profile.fullName')
      .sort({ createdAt: -1 });

    const latestEvidence = allEvidences.length > 0 ? allEvidences[0] : null;

    // Accumulate all photos across evidence entries and complaint.resolutionPhotos
    const accumulatedImages = Array.from(new Set([
      ...((complaint as any).resolutionPhotos || []),
      ...allEvidences.flatMap((e: any) => e.images || [])
    ]));

    const complaintObj: any = complaint.toObject();
    complaintObj.resolutionPhotos = accumulatedImages;
    if (latestEvidence) {
      const latestObj = latestEvidence.toObject();
      latestObj.images = accumulatedImages.length > 0 ? accumulatedImages : latestObj.images;
      complaintObj.resolutionEvidence = latestObj;
    } else {
      complaintObj.resolutionEvidence = null;
    }

    // Attach feedback details if submitted or present in Feedback collection
    let existingFeedback = null;
    if (complaint.rating || complaint.feedbackSubmittedAt) {
      existingFeedback = await Feedback.findOne({ complaintId: complaint._id });
    } else {
      existingFeedback = await Feedback.findOne({ complaintId: complaint._id });
    }

    if (existingFeedback) {
      complaintObj.feedbackSubmitted = true;
      complaintObj.rating = existingFeedback.rating || complaint.rating;
      complaintObj.feedbackComment = existingFeedback.comments || complaint.feedbackComment;
      complaintObj.feedbackSubmittedAt = existingFeedback.createdAt || complaint.feedbackSubmittedAt;
    } else if (complaint.rating || complaint.feedbackSubmittedAt) {
      complaintObj.feedbackSubmitted = true;
      complaintObj.rating = complaint.rating;
      complaintObj.feedbackComment = complaint.feedbackComment;
      complaintObj.feedbackSubmittedAt = complaint.feedbackSubmittedAt;
    } else {
      complaintObj.feedbackSubmitted = false;
    }

    return sendResponse(response, 200, true, 'Complaint details retrieved', complaintObj);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching complaint');
  }
};

/**
 * Chronological activity timeline
 */
export const getComplaintActivity = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    let activities = await ActivityLog.find({ complaintId: id })
      .populate('performedBy', 'email profile.fullName')
      .populate('metadata.assignedTo', 'email profile.fullName')
      .sort({ createdAt: 1 });

    // Collect any unpopulated 24-char hex ObjectIds from metadata.assignedTo or "Assigned to <id>" messages
    const hexIdRegex = /^[0-9a-fA-F]{24}$/;
    const assignedToRegex = /^Assigned to ([0-9a-fA-F]{24})$/i;
    const unresolvedUserIds = new Set<string>();

    for (const act of activities) {
      const assignedToVal = act.metadata?.assignedTo;
      if (assignedToVal && typeof assignedToVal === 'string' && hexIdRegex.test(assignedToVal)) {
        unresolvedUserIds.add(assignedToVal);
      }
      const msg = act.metadata?.message || '';
      const match = msg.match(assignedToRegex);
      if (match && match[1]) {
        unresolvedUserIds.add(match[1]);
      }
    }

    let userMap = new Map<string, string>();
    if (unresolvedUserIds.size > 0) {
      const users = await User.find({ _id: { $in: Array.from(unresolvedUserIds) } }).select('email profile.fullName');
      for (const u of users) {
        const displayName = u.profile?.fullName || (u as any).name || u.email || 'Staff Member';
        userMap.set(u._id.toString(), displayName);
      }
    }

    // Fallback: If no activity logs exist yet (e.g. legacy/pre-existing complaint), generate default creation event
    if (activities.length === 0) {
      const complaint = await Complaint.findById(id).populate('residentId', 'email profile.fullName');
      if (complaint) {
        const creator: any = complaint.residentId;
        return sendResponse(response, 200, true, 'Complaint activity timeline retrieved', [
          {
            action: 'created',
            performedBy: creator
              ? { name: creator.profile?.fullName || 'Resident', email: creator.email }
              : { name: 'Resident', email: null },
            metadata: { message: 'Complaint submitted by resident' },
            createdAt: complaint.createdAt
          }
        ]);
      }
    }

    const formattedActivities = activities.map(activity => {
      const performedBy: any = activity.performedBy;
      const rawMetadata = (activity.metadata as any) || {};

      let resolvedAssignedName = rawMetadata.assignedToName;
      if (!resolvedAssignedName) {
        if (rawMetadata.assignedTo && typeof rawMetadata.assignedTo === 'object' && rawMetadata.assignedTo.profile) {
          resolvedAssignedName = rawMetadata.assignedTo.profile.fullName || rawMetadata.assignedTo.email;
        } else if (rawMetadata.assignedTo) {
          const idStr = rawMetadata.assignedTo.toString();
          resolvedAssignedName = userMap.get(idStr);
        }
      }

      let message = rawMetadata.message;
      if (message) {
        const match = message.match(assignedToRegex);
        if (match && match[1]) {
          const staffName = userMap.get(match[1]) || resolvedAssignedName;
          if (staffName) {
            message = `Assigned to ${staffName}`;
          }
        }
      } else if (activity.action === 'assigned' && resolvedAssignedName) {
        message = `Assigned to ${resolvedAssignedName}`;
      }

      return {
        action: activity.action,
        performedBy: performedBy
          ? {
              name: performedBy.profile?.fullName || 'System',
              email: performedBy.email
            }
          : { name: 'System', email: null },
        metadata: {
          ...rawMetadata,
          assignedTo: rawMetadata.assignedTo?._id || rawMetadata.assignedTo,
          assignedToName: resolvedAssignedName || rawMetadata.assignedToName,
          message: message || rawMetadata.message
        },
        createdAt: activity.createdAt
      };
    });

    return sendResponse(response, 200, true, 'Complaint activity timeline retrieved', formattedActivities);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching timeline');
  }
};

/**
 * Resident feedback submission
 */
export const submitComplaintFeedback = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const idParam = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const { rating, feedbackComment, comment, comments } = request.body;

    const actualComment = feedbackComment || comment || comments || '';

    // Search by ObjectId or complaintId string (e.g. CMP-20261120-7604)
    let complaint;
    if (mongoose.Types.ObjectId.isValid(idParam)) {
      complaint = await Complaint.findById(idParam);
    }
    if (!complaint) {
      complaint = await Complaint.findOne({ complaintId: idParam });
    }

    if (!complaint) {
      return sendResponse(response, 404, false, 'Complaint not found');
    }

    if (complaint.residentId.toString() !== user._id.toString()) {
      return sendResponse(response, 403, false, 'You are not authorized to submit feedback for this complaint.');
    }

    const normalizedStatus = (complaint.status || '').toLowerCase();
    if (!['resolved', 'closed'].includes(normalizedStatus)) {
      return sendResponse(response, 400, false, 'Feedback can only be submitted for resolved or closed complaints.');
    }

    const existingFeedback = await Feedback.findOne({ complaintId: complaint._id });
    if (existingFeedback || complaint.feedbackSubmittedAt) {
      return sendResponse(response, 400, false, 'Feedback has already been submitted for this complaint.');
    }

    const ratingNum = Number(rating);
    if (!rating || isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return sendResponse(response, 400, false, 'A valid rating between 1 and 5 is strictly required.');
    }

    await Feedback.create({
      complaintId: complaint._id,
      residentId: user._id,
      rating: ratingNum,
      comments: actualComment
    });

    complaint.rating = ratingNum;
    complaint.feedbackComment = actualComment;
    complaint.feedbackSubmittedAt = new Date();
    await complaint.save();

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'FEEDBACK_SUBMITTED',
      entityType: 'Feedback',
      entityId: complaint._id,
      details: { rating: ratingNum, feedbackComment: actualComment }
    });

    return sendResponse(response, 200, true, 'Feedback submitted successfully. Thank you for your input!', complaint);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error submitting feedback');
  }
};
