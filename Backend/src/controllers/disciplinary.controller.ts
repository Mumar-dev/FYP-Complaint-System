import { Response } from 'express';
import { DisciplinaryCase } from '../models/disciplinaryCase.model';
import { FormalWarning } from '../models/formalWarning.model';
import { SuspensionRecord } from '../models/suspensionRecord.model';
import { User } from '../models/user.model';
import { EmploymentHistory } from '../models/employmentHistory.model';
import { Complaint } from '../models/complaint.model';
import { ComplaintAssignment } from '../models/complaintAssignment.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendResponse } from '../utils/response';
import { AuditService } from '../services/audit.service';
import { NotificationService } from '../services/notification.service';
import { uploadBufferToCloudinary } from '../utils/cloudinary';
import { sendEmail } from '../utils/email';

/**
 * POST /api/disciplinary/warnings - Issue direct formal warning (DeptHead/Admin/Supervisor -> Staff)
 * No Admin approval required. Sends notification and warning email immediately.
 */
export const issueFormalWarning = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { employeeId, category = 'Performance', severity = 'Written', subject, details, actionRequired } = request.body;

    if (!employeeId || !subject || !details) {
      return sendResponse(response, 400, false, 'employeeId, subject, and details are mandatory to issue a formal warning.');
    }

    // Resolve employee by _id, or by employeeId string, or nested userId
    let employee = await User.findById(employeeId);
    if (!employee) {
      employee = await User.findOne({ employeeId });
    }
    if (!employee) {
      return sendResponse(response, 404, false, 'Employee record not found in system.');
    }

    // Map incoming category cleanly to schema enum:
    // ['Attendance', 'Performance', 'Misconduct', 'SLA Breach', 'Insubordination', 'Policy Breach', 'Other']
    let mappedCategory: any = 'Performance';
    const catLower = String(category).toLowerCase();
    if (catLower.includes('attendance') || catLower.includes('punctual')) mappedCategory = 'Attendance';
    else if (catLower.includes('misconduct')) mappedCategory = 'Misconduct';
    else if (catLower.includes('sla')) mappedCategory = 'SLA Breach';
    else if (catLower.includes('policy')) mappedCategory = 'Policy Breach';
    else if (catLower.includes('insubordination')) mappedCategory = 'Insubordination';
    else if (catLower.includes('other')) mappedCategory = 'Other';

    // Map severity cleanly to schema enum: ['Verbal', 'Written', 'Final']
    let mappedSeverity: any = 'Written';
    const sevLower = String(severity).toLowerCase();
    if (sevLower.includes('verbal')) mappedSeverity = 'Verbal';
    else if (sevLower.includes('final')) mappedSeverity = 'Final';

    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const warningNumber = `WRN-${year}-${randomSuffix}`;

    let evidenceUrl: string | undefined = undefined;
    if (request.file) {
      try {
        const uploadRes = await uploadBufferToCloudinary(
          request.file.buffer,
          'disciplinary_evidence'
        );
        evidenceUrl = typeof uploadRes === 'string' ? uploadRes : (uploadRes as any)?.secure_url || uploadRes;
      } catch (uploadErr) {
        console.error('[Cloudinary Warning Evidence Upload Error]:', uploadErr);
      }
    }

    const warning = await FormalWarning.create({
      warningNumber,
      employeeId: employee._id,
      issuedBy: user._id,
      departmentId: employee.departmentId || user.departmentId,
      category: mappedCategory,
      severity: mappedSeverity,
      subject: subject.trim(),
      details: details.trim(),
      actionRequired: actionRequired ? actionRequired.trim() : undefined,
      evidenceUrl,
      issuedAt: new Date()
    });

    // Also link or record in DisciplinaryCase for unified audit log
    try {
      await DisciplinaryCase.create({
        caseNumber: `DISC-${year}-${randomSuffix}`,
        employeeId: employee._id,
        category: mappedCategory.toLowerCase().includes('attendance') ? 'attendance_violation' : 'policy_breach',
        title: `Formal Warning: ${subject}`,
        description: details,
        incidentDate: new Date(),
        reportedBy: user._id,
        status: 'ACTION_TAKEN',
        managementDecision: 'warning',
        decisionDate: new Date(),
        decisionJustification: `Severity: ${mappedSeverity}. ${actionRequired ? `Action required: ${actionRequired}` : ''}`,
        evidenceUrls: evidenceUrl ? [evidenceUrl] : []
      });
    } catch (discErr) {
      console.error('[DisciplinaryCase link error]:', discErr);
    }

    try {
      await AuditService.log({
        userId: user._id,
        userRole: user.role,
        action: 'FORMAL_WARNING_ISSUED',
        entityType: 'Disciplinary',
        entityId: warning._id,
        previousValue: null,
        newValue: { warningNumber, employeeId: employee._id, severity: mappedSeverity, category: mappedCategory, subject },
        reason: details
      });
    } catch (auditErr) {
      console.error('[AuditService log error]:', auditErr);
    }

    // In-app notification to the employee (Staff or Department Head)
    try {
      await NotificationService.send({
        userId: employee._id,
        type: 'formal_warning',
        title: `Formal Warning Notice (${mappedSeverity})`,
        message: `You have received a formal warning letter regarding "${subject}" issued by ${user.profile?.fullName || 'Department Management'}.`,
        idempotencyKey: `notif_wrn_${warning._id}`
      });
    } catch (notifErr) {
      console.error('[Notification send error]:', notifErr);
    }

    // Formal warning email dispatched to employee
    if (employee.email) {
      const emailSubject = `Official Notice: Formal Warning (${mappedSeverity} Notice)`;
      const emailMsg = `Dear ${employee.profile?.fullName || 'Colleague'},\n\nThis is an official notice that a formal warning has been issued regarding:\n\nSubject: ${subject}\nCategory: ${mappedCategory}\nSeverity: ${mappedSeverity}\nIssued By: ${user.profile?.fullName || 'Management'}\nDate: ${new Date().toLocaleDateString()}\n\nDetails:\n${details}\n\n${actionRequired ? `Required Corrective Action:\n${actionRequired}\n\n` : ''}You can review this warning and your complete employment notices record in your portal under Service Record / HR Notices.\n\nRegards,\nManagement`;

      sendEmail({ to: employee.email, subject: emailSubject, message: emailMsg }).catch(err => {
        console.error('[Warning Email Error]', err?.message);
      });
    }

    return sendResponse(response, 201, true, 'Formal warning issued successfully', warning);
  } catch (error: any) {
    console.error('[Issue Formal Warning Controller Error]:', error);
    return sendResponse(response, 500, false, error.message || 'Error issuing formal warning');
  }
};

/**
 * GET /api/disciplinary/warnings - Get warnings list (Admin, DeptHead, Staff self)
 */
export const getFormalWarnings = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { employeeId, viewMode } = request.query;

    const filter: any = {};
    if (user.role === 'staff' || viewMode === 'self') {
      // Staff or users viewing their own personal service record
      filter.employeeId = user._id;
    } else if (employeeId) {
      filter.employeeId = employeeId;
    } else if (user.role === 'department_head' && user.departmentId) {
      // Default for Department Head operations is seeing warnings in their department
      filter.departmentId = user.departmentId;
    }

    const warnings = await FormalWarning.find(filter)
      .populate('employeeId', 'profile.fullName profile.avatar profile.profileImage email designation rank departmentId')
      .populate('issuedBy', 'profile.fullName email role')
      .populate('departmentId', 'name code')
      .sort({ issuedAt: -1 });

    return sendResponse(response, 200, true, 'Formal warnings retrieved successfully', warnings);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching formal warnings');
  }
};

/**
 * GET /api/disciplinary/cases - List all disciplinary cases & warnings (Admin/DeptHead)
 */
export const getAllDisciplinaryCases = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { employeeId } = request.query;

    const filter: any = {};
    if (user.role === 'staff') {
      filter.employeeId = user._id;
    } else if (employeeId) {
      filter.employeeId = String(employeeId);
    }

    const cases = await DisciplinaryCase.find(filter)
      .populate('employeeId', 'profile.fullName profile.avatar profile.profileImage email designation rank departmentId')
      .populate('reportedBy', 'profile.fullName email role')
      .sort({ createdAt: -1 });

    const suspensionFilter: any = employeeId ? { employeeId: String(employeeId) } : {};
    const suspensions = await SuspensionRecord.find(suspensionFilter)
      .populate('employeeId', 'profile.fullName email designation rank')
      .populate('authorizedBy', 'profile.fullName email')
      .populate('reinstatedBy', 'profile.fullName email')
      .sort({ createdAt: -1 });

    return sendResponse(response, 200, true, 'Disciplinary records retrieved successfully', {
      cases,
      suspensions
    });
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching disciplinary cases');
  }
};

/**
 * POST /api/disciplinary/cases - Create disciplinary case (Supervisor/Admin/DeptHead)
 */
export const createDisciplinaryCase = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { employeeId, category, title, description, incidentDate = new Date() } = request.body;

    if (!employeeId || !category || !title || !description) {
      return sendResponse(response, 400, false, 'employeeId, category, title, and description are required.');
    }

    const employee = await User.findById(employeeId);
    if (!employee) {
      return sendResponse(response, 404, false, 'Employee record not found.');
    }

    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const caseNumber = `DISC-${year}-${randomSuffix}`;

    const evidenceUrls: string[] = [];
    if (request.files && Array.isArray(request.files)) {
      for (const file of request.files) {
        try {
          const url = await uploadBufferToCloudinary(file.buffer, 'disciplinary-evidence');
          evidenceUrls.push(url);
        } catch (e) {
          console.error('[Upload Disciplinary Evidence Error]', e);
        }
      }
    }

    const discCase = await DisciplinaryCase.create({
      caseNumber,
      employeeId: employee._id,
      category,
      title,
      description,
      incidentDate: new Date(incidentDate),
      reportedBy: user._id,
      evidenceUrls,
      status: 'OPEN'
    });

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'DISCIPLINARY_CASE_CREATED',
      entityType: 'Disciplinary',
      entityId: discCase._id,
      previousValue: null,
      newValue: { caseNumber, employeeId, category, title },
      reason: description
    });

    await NotificationService.send({
      userId: employee._id,
      type: 'disciplinary_case',
      title: 'Disciplinary Notice',
      message: `A disciplinary inquiry (${caseNumber}) has been initiated. You may view and respond to the notice.`,
      idempotencyKey: `notif_disc_case_${discCase._id}`
    });

    return sendResponse(response, 201, true, 'Disciplinary case created successfully', discCase);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error creating disciplinary case');
  }
};

/**
 * POST /api/disciplinary/cases/:id/suspension - Suspend employee
 * 1. Restricts login/access (employmentStatus = 'SUSPENDED', accountStatus = 'suspended')
 * 2. Reassigns open complaint assignments
 * 3. Records suspension & employment history
 */
export const recordSuspension = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params; // Disciplinary case ID or employeeId
    const { employeeId, startDate = new Date(), expectedEndDate, reason } = request.body;
    const user = request.user!;

    if (!employeeId || !expectedEndDate || !reason) {
      return sendResponse(response, 400, false, 'employeeId, expectedEndDate, and reason are required.');
    }

    const employee = await User.findById(employeeId);
    if (!employee) {
      return sendResponse(response, 404, false, 'Employee record not found.');
    }

    const prevEmploymentStatus = employee.employmentStatus || 'ACTIVE';
    employee.employmentStatus = 'SUSPENDED';
    employee.accountStatus = 'suspended';
    await employee.save();

    // Reassign active complaints assigned to this suspended employee
    const activeComplaints = await Complaint.find({
      $or: [
        { primaryStaffId: employee._id },
        { assignedStaffId: employee._id },
        { supportingStaffIds: employee._id }
      ],
      status: { $in: ['assigned', 'in_progress', 'under_verification'] }
    });

    const reassignedCount = activeComplaints.length;
    for (const comp of activeComplaints) {
      if (comp.primaryStaffId?.toString() === employee._id.toString()) {
        comp.primaryStaffId = undefined;
        comp.assignedStaffId = undefined;
        comp.status = 'pending_assignment';
      }
      comp.supportingStaffIds = comp.supportingStaffIds.filter(
        sid => sid.toString() !== employee._id.toString()
      );
      await comp.save();

      await ComplaintAssignment.updateMany(
        { complaintId: comp._id, primaryStaffId: employee._id, isActive: true },
        {
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedBy: user._id,
          deactivationReason: 'Staff suspended'
        }
      );
    }

    const targetCaseId = id && id !== employeeId ? (Array.isArray(id) ? id[0] : id) : undefined;

    const suspension = await SuspensionRecord.create({
      employeeId: employee._id,
      disciplinaryCaseId: targetCaseId as any,
      startDate: new Date(startDate),
      expectedEndDate: new Date(expectedEndDate),
      reason,
      authorizedBy: user._id,
      status: 'ACTIVE',
      reassignedComplaintsCount: reassignedCount
    });

    await EmploymentHistory.create({
      employeeId: employee._id,
      previousDesignation: employee.designation || 'Staff',
      newDesignation: employee.designation || 'Staff',
      previousStatus: prevEmploymentStatus,
      newStatus: 'SUSPENDED',
      changeType: 'suspension',
      reason,
      changedBy: user._id,
      effectiveDate: new Date(startDate)
    });

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'EMPLOYEE_SUSPENDED',
      entityType: 'Disciplinary',
      entityId: (suspension as any)._id,
      previousValue: { employmentStatus: prevEmploymentStatus },
      newValue: { employmentStatus: 'SUSPENDED', reassignedComplaints: reassignedCount },
      reason
    });

    await NotificationService.send({
      userId: employee._id,
      type: 'suspension_notice',
      title: 'Suspension Notice',
      message: `Your employment has been placed on suspension until ${new Date(expectedEndDate).toDateString()}. Reason: ${reason}`,
      idempotencyKey: `notif_susp_${(suspension as any)._id}`
    });

    return sendResponse(response, 201, true, 'Employee suspended and open assignments safely re-queued', suspension);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error recording suspension');
  }
};

/**
 * POST /api/disciplinary/cases/:id/reinstatement - Reinstate suspended employee
 */
export const recordReinstatement = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params; // Suspension ID
    const { reinstatementNotes } = request.body;
    const user = request.user!;

    const suspension = await SuspensionRecord.findById(id);
    if (!suspension) {
      return sendResponse(response, 404, false, 'Suspension record not found.');
    }

    suspension.status = 'COMPLETED';
    suspension.actualEndDate = new Date();
    suspension.reinstatementNotes = reinstatementNotes;
    suspension.reinstatedBy = user._id;
    suspension.reinstatedAt = new Date();
    await suspension.save();

    const employee = await User.findById(suspension.employeeId);
    if (employee) {
      employee.employmentStatus = 'ACTIVE';
      employee.accountStatus = 'active';
      await employee.save();

      await EmploymentHistory.create({
        employeeId: employee._id,
        previousDesignation: employee.designation || 'Staff',
        newDesignation: employee.designation || 'Staff',
        previousStatus: 'SUSPENDED',
        newStatus: 'ACTIVE',
        changeType: 'reinstatement',
        reason: reinstatementNotes || 'Employee reinstated by management',
        changedBy: user._id,
        effectiveDate: new Date()
      });
    }

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'EMPLOYEE_REINSTATED',
      entityType: 'Disciplinary',
      entityId: suspension._id,
      previousValue: { employmentStatus: 'SUSPENDED' },
      newValue: { employmentStatus: 'ACTIVE' },
      reason: reinstatementNotes || 'Reinstatement approved'
    });

    return sendResponse(response, 200, true, 'Employee reinstated successfully', suspension);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error recording reinstatement');
  }
};
