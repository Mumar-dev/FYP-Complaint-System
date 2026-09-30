import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';
import { Department } from '../models/department.model';
import { LeaveRequest } from '../models/leaveRequest.model';
import { Attendance } from '../models/attendance.model';
import { EmploymentHistory } from '../models/employmentHistory.model';
import { EmployeeDocument } from '../models/employeeDocument.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendResponse } from '../utils/response';
import { AuditService } from '../services/audit.service';
import { uploadBufferToCloudinary } from '../utils/cloudinary';
import { sendEmail } from '../utils/email';

/**
 * POST /api/employees - Create employee profile (Admin/SuperAdmin/DepartmentHead)
 */
export const createEmployee = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const {
      fullName,
      email,
      password = 'TemporaryPassword123!',
      phone,
      cnic,
      departmentId,
      designation = 'Staff Member',
      rank = 'junior',
      role = 'staff',
      employmentStatus = 'ACTIVE',
      employmentType = 'full_time',
      joiningDate = new Date()
    } = request.body;

    if (!fullName || !email) {
      return sendResponse(response, 400, false, 'Full name and email are strictly required.');
    }

    // Role restrictions: Department heads can only create staff for their own department
    if (user.role === 'department_head') {
      if (departmentId && departmentId.toString() !== user.departmentId?.toString()) {
        return sendResponse(response, 403, false, 'Department heads can only create staff for their own department.');
      }
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return sendResponse(response, 400, false, 'An account with this email already exists.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const generatedEmployeeId = `EMP-${year}-${randomSuffix}`;

    const newEmployee = await User.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      rank,
      accountStatus: 'active',
      departmentId: departmentId || (user.role === 'department_head' ? user.departmentId : undefined),
      employeeId: generatedEmployeeId,
      designation,
      employmentStatus,
      employmentType,
      joiningDate: new Date(joiningDate),
      profile: {
        fullName,
        phone,
        cnic
      }
    });

    // Record Employment History
    await EmploymentHistory.create({
      employeeId: newEmployee._id,
      newDesignation: designation,
      newDepartmentId: newEmployee.departmentId,
      newStatus: employmentStatus,
      changeType: 'designation_update',
      reason: 'Initial Employee Profile Creation',
      changedBy: user._id,
      effectiveDate: new Date()
    });

    // Record Audit Log with previous/new value
    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'EMPLOYEE_CREATED',
      entityType: 'Employee',
      entityId: newEmployee._id,
      previousValue: null,
      newValue: {
        employeeId: generatedEmployeeId,
        email: newEmployee.email,
        designation,
        departmentId: newEmployee.departmentId,
        employmentStatus
      },
      reason: 'Admin onboarded employee'
    });

    const safeEmployee = newEmployee.toObject();
    delete safeEmployee.password;

    return sendResponse(response, 201, true, 'Employee created successfully', safeEmployee);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error creating employee');
  }
};

/**
 * GET /api/employees - List all employees with filtering & pagination
 */
export const getEmployees = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { departmentId, employmentStatus, role, search, page = 1, limit = 50 } = request.query;

    // Timezone-safe start and end of today in local system time
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const now = new Date();
    const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Clean up any historical permanently persisted ON_LEAVE statuses in MongoDB (revert to ACTIVE)
    await User.updateMany(
      { employmentStatus: 'ON_LEAVE' },
      { $set: { employmentStatus: 'ACTIVE' } }
    );

    // 1. Query today's attendance records to detect check-in overrides or on_leave statuses
    const todayAttendances = await Attendance.find({
      date: { $gte: startOfToday, $lte: endOfToday }
    }).select('employeeId checkInTime status');

    const checkedInUserIds = new Set<string>();
    const onLeaveAttendanceUserIds = new Set<string>();

    todayAttendances.forEach(att => {
      if (!att.employeeId) return;
      const empIdStr = att.employeeId.toString();
      if (att.checkInTime || ['present', 'late', 'half_day'].includes((att.status || '').toLowerCase())) {
        checkedInUserIds.add(empIdStr);
      } else if ((att.status || '').toLowerCase() === 'on_leave') {
        onLeaveAttendanceUserIds.add(empIdStr);
      }
    });

    // 2. Query all approved leave requests for date matching and metadata population
    const allApprovedLeaves = await LeaveRequest.find({
      status: 'APPROVED'
    })
      .populate('leaveTypeId', 'name code')
      .sort({ startDate: -1 });

    // Group approved leaves by employeeId
    const employeeLeavesMap = new Map<string, any[]>();
    allApprovedLeaves.forEach(leave => {
      if (!leave.employeeId) return;
      const empIdStr = leave.employeeId.toString();
      if (!employeeLeavesMap.has(empIdStr)) {
        employeeLeavesMap.set(empIdStr, []);
      }
      employeeLeavesMap.get(empIdStr)!.push(leave);
    });

    const query: any = {
      role: { $in: ['staff', 'supervisor', 'department_head', 'admin'] }
    };

    // Department Head / Supervisor see only their departmental staff
    if (['department_head', 'supervisor'].includes(user.role)) {
      if (user.departmentId) {
        query.departmentId = user.departmentId;
      }
    } else if (departmentId) {
      query.departmentId = departmentId;
    }

    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { 'profile.fullName': { $regex: search as string, $options: 'i' } },
        { email: { $regex: search as string, $options: 'i' } },
        { employeeId: { $regex: search as string, $options: 'i' } },
        { designation: { $regex: search as string, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const rawEmployees = await User.find(query)
      .select('-password -refreshToken')
      .populate('departmentId', 'name')
      .sort({ createdAt: -1 });

    // Compute effective employmentStatus and leaveInfo dynamically
    const formattedEmployees = rawEmployees.map(emp => {
      const empObj = emp.toObject();
      const empIdStr = emp._id.toString();
      const currentStoredStatus = (emp.employmentStatus || emp.accountStatus?.toUpperCase() || 'ACTIVE').toUpperCase();

      // Gather employee's approved leaves
      const userLeaves = employeeLeavesMap.get(empIdStr) || [];

      // Find active leave covering today (by comparing calendar dates cleanly YYYY-MM-DD)
      let activeLeaveDoc: any = null;
      for (const l of userLeaves) {
        const s = new Date(l.startDate);
        const e = new Date(l.endDate);
        const sYMD = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
        const eYMD = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;

        if (sYMD <= todayYMD && eYMD >= todayYMD) {
          activeLeaveDoc = l;
          break;
        }
      }

      // Check-in override: If staff checked in today, they are ACTIVE even if leave was booked
      const hasCheckedInToday = checkedInUserIds.has(empIdStr);
      const isExplicitOnLeaveAttendance = onLeaveAttendanceUserIds.has(empIdStr) && !hasCheckedInToday;

      let effectiveStatus = currentStoredStatus;
      if (['SUSPENDED', 'TERMINATED', 'RESIGNED'].includes(currentStoredStatus)) {
        effectiveStatus = currentStoredStatus;
      } else if (hasCheckedInToday) {
        effectiveStatus = 'ACTIVE';
      } else if (activeLeaveDoc || isExplicitOnLeaveAttendance) {
        effectiveStatus = 'ON_LEAVE';
      } else if (currentStoredStatus === 'ON_LEAVE') {
        effectiveStatus = 'ACTIVE';
      }

      // Build leaveInfo metadata
      let activeLeaveInfo = null;
      if (activeLeaveDoc) {
        const s = new Date(activeLeaveDoc.startDate);
        const e = new Date(activeLeaveDoc.endDate);
        const eMid = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59);
        const remainingDays = Math.max(0, Math.ceil((eMid.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        activeLeaveInfo = {
          id: activeLeaveDoc._id,
          startDate: activeLeaveDoc.startDate,
          endDate: activeLeaveDoc.endDate,
          totalDays: activeLeaveDoc.totalDays || 1,
          remainingDays,
          leaveType: (activeLeaveDoc.leaveTypeId as any)?.name || 'Approved Leave',
          reason: activeLeaveDoc.reason
        };
      }

      let totalApprovedDays = 0;
      const recentLeaves = userLeaves.slice(0, 5).map(l => {
        totalApprovedDays += (l.totalDays || 1);
        return {
          id: l._id,
          leaveType: (l.leaveTypeId as any)?.name || 'Approved Leave',
          startDate: l.startDate,
          endDate: l.endDate,
          days: l.totalDays || 1,
          reason: l.reason,
          status: l.status
        };
      });

      // Sum all approved days
      const totalAllApprovedDays = userLeaves.reduce((acc, curr) => acc + (curr.totalDays || 1), 0);

      return {
        ...empObj,
        employmentStatus: effectiveStatus,
        leaveInfo: {
          activeLeave: activeLeaveInfo,
          totalApprovedLeaveDays: totalAllApprovedDays,
          recentLeaves
        }
      };
    });

    // Filter by employmentStatus if requested in query
    let filteredEmployees = formattedEmployees;
    if (employmentStatus && employmentStatus !== 'ALL') {
      filteredEmployees = formattedEmployees.filter(e => e.employmentStatus === employmentStatus);
    }

    const total = filteredEmployees.length;
    const paginatedEmployees = filteredEmployees.slice(skip, skip + Number(limit));

    return sendResponse(response, 200, true, 'Employees retrieved', {
      employees: paginatedEmployees,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching employees');
  }
};

/**
 * GET /api/employees/:id - Employee details
 */
export const getEmployeeById = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const user = request.user!;

    // Non-admins can only view their own profile or supervisor viewing departmental staff
    if (user.role === 'staff' && user._id.toString() !== id) {
      return sendResponse(response, 403, false, 'Forbidden: You can only view your own employee profile.');
    }

    const employee = await User.findById(id)
      .select('-password -refreshToken')
      .populate('departmentId', 'name');

    if (!employee) {
      return sendResponse(response, 404, false, 'Employee not found');
    }

    return sendResponse(response, 200, true, 'Employee retrieved', employee);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error retrieving employee');
  }
};

/**
 * PATCH /api/employees/:id - Update employee profile information
 */
export const updateEmployee = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const user = request.user!;
    const { fullName, phone, designation, emergencyContact, employmentType } = request.body;

    const employee = await User.findById(id);
    if (!employee) {
      return sendResponse(response, 404, false, 'Employee not found');
    }

    const previousData = {
      fullName: employee.profile?.fullName,
      phone: employee.profile?.phone,
      designation: employee.designation,
      employmentType: employee.employmentType
    };

    if (fullName) employee.profile.fullName = fullName;
    if (phone) employee.profile.phone = phone;
    if (emergencyContact) employee.profile.emergencyContact = emergencyContact;

    // Designation and employmentType updates restricted to Admin / SuperAdmin
    if (designation && ['admin', 'superadmin', 'department_head'].includes(user.role)) {
      if (employee.designation !== designation) {
        await EmploymentHistory.create({
          employeeId: employee._id,
          previousDesignation: employee.designation,
          newDesignation: designation,
          previousDepartmentId: employee.departmentId as any,
          newDepartmentId: employee.departmentId as any,
          changeType: 'designation_update',
          reason: request.body.reason || 'Designation updated by authorized management',
          changedBy: user._id
        });
      }
      employee.designation = designation;
    }

    if (employmentType && ['admin', 'superadmin'].includes(user.role)) {
      employee.employmentType = employmentType;
    }

    await employee.save();

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'EMPLOYEE_UPDATED',
      entityType: 'Employee',
      entityId: employee._id,
      previousValue: previousData,
      newValue: {
        fullName: employee.profile?.fullName,
        phone: employee.profile?.phone,
        designation: employee.designation,
        employmentType: employee.employmentType
      },
      reason: request.body.reason || 'Profile updated'
    });

    return sendResponse(response, 200, true, 'Employee updated successfully', employee);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error updating employee');
  }
};

/**
 * PATCH /api/employees/:id/status - Change employment status (ACTIVE, SUSPENDED, TERMINATED, etc.)
 */
export const updateEmploymentStatus = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const user = request.user!;
    const { status, reason } = request.body;

    if (!status || !reason) {
      return sendResponse(response, 400, false, 'Status and mandatory reason are required.');
    }

    const validStatuses = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED', 'TERMINATED'];
    if (!validStatuses.includes(status)) {
      return sendResponse(response, 400, false, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const employee = await User.findById(id);
    if (!employee) {
      return sendResponse(response, 404, false, 'Employee not found');
    }

    const prevStatus = employee.employmentStatus || 'ACTIVE';
    employee.employmentStatus = status;

    // Sync accountStatus so suspended/terminated employees cannot log in
    if (['SUSPENDED', 'TERMINATED', 'RESIGNED', 'INACTIVE'].includes(status)) {
      employee.accountStatus = 'suspended';
      // Invalidate refresh token to immediately kill active sessions
      employee.refreshToken = undefined;
    } else if (status === 'ACTIVE' || status === 'ON_LEAVE') {
      employee.accountStatus = 'active';
    }

    // Specific logic for TERMINATED employees:
    if (status === 'TERMINATED') {
      const oldDeptId = employee.departmentId;
      employee.departmentId = undefined;

      // If user was head of any department, unset headOfDepartment
      await Department.updateMany(
        { headOfDepartment: employee._id },
        { $set: { headOfDepartment: null } }
      );

      // Send formal termination email
      const employeeName = employee.profile?.fullName || employee.email;
      const terminationMessage = `Dear ${employeeName},

This is a formal notification that your employment status has been marked as TERMINATED in the Complaint Management System effective immediately.

Reason for Termination:
${reason}

Your access credentials to the staff portal have been revoked. If you believe this notice was sent in error or require further clarification, please contact the Administration Office.

Sincerely,
Administration & Human Resources
Complaint Management System`;

      try {
        await sendEmail({
          to: employee.email,
          subject: 'Notice of Employment Termination',
          message: terminationMessage
        });
      } catch (emailErr: any) {
        console.error(`[TERMINATION EMAIL] Failed to send termination notice to ${employee.email}:`, emailErr?.message);
      }
    }

    await employee.save();

    // Record Employment History
    await EmploymentHistory.create({
      employeeId: employee._id,
      previousDesignation: employee.designation,
      newDesignation: employee.designation || 'Staff',
      previousStatus: prevStatus,
      newStatus: status,
      changeType: 'status_change',
      reason,
      changedBy: user._id
    });

    // Record Centralized Audit Log
    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'EMPLOYEE_STATUS_CHANGED',
      entityType: 'Employee',
      entityId: employee._id,
      previousValue: { employmentStatus: prevStatus },
      newValue: { employmentStatus: status },
      reason
    });

    return sendResponse(response, 200, true, `Employment status updated to ${status}`, employee);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error changing employment status');
  }
};

/**
 * GET /api/employees/:id/history - Employment history
 */
export const getEmploymentHistory = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const history = await EmploymentHistory.find({ employeeId: id })
      .populate('changedBy', 'profile.fullName email role')
      .populate('previousDepartmentId', 'name')
      .populate('newDepartmentId', 'name')
      .sort({ createdAt: -1 });

    return sendResponse(response, 200, true, 'Employment history retrieved', history);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching history');
  }
};

/**
 * POST /api/employees/:id/documents - Secure Document Upload
 */
export const uploadEmployeeDocument = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const { documentType, title, isConfidential = true } = request.body;
    const user = request.user!;

    if (!documentType || !title) {
      return sendResponse(response, 400, false, 'Document type and title are required.');
    }

    const file = (request as any).file;
    if (!file) {
      return sendResponse(response, 400, false, 'No document file uploaded.');
    }

    const documentUrl = await uploadBufferToCloudinary(file.buffer, 'employee-documents');

    const employeeTargetId = Array.isArray(id) ? id[0] : id;

    const doc = await EmployeeDocument.create({
      employeeId: employeeTargetId as any,
      documentType,
      title,
      documentUrl,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedBy: user._id,
      isConfidential: isConfidential === 'true' || isConfidential === true
    });

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'EMPLOYEE_DOCUMENT_UPLOADED',
      entityType: 'Employee',
      entityId: employeeTargetId as any,
      previousValue: null,
      newValue: { documentId: (doc as any)._id, title, documentType },
      reason: 'Uploaded employment document'
    });

    return sendResponse(response, 201, true, 'Document uploaded securely', doc);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error uploading document');
  }
};

/**
 * GET /api/employees/:id/documents - Retrieve documents with confidentiality check
 */
export const getEmployeeDocuments = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const user = request.user!;

    const query: any = { employeeId: id };

    // Ordinary staff can view only their own documents; non-admin cannot view confidential docs of others
    if (user.role === 'staff' && user._id.toString() !== id) {
      return sendResponse(response, 403, false, 'Forbidden: Cannot access other employees documents.');
    }

    const docs = await EmployeeDocument.find(query)
      .populate('uploadedBy', 'profile.fullName email')
      .sort({ createdAt: -1 });

    return sendResponse(response, 200, true, 'Documents retrieved', docs);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching documents');
  }
};
