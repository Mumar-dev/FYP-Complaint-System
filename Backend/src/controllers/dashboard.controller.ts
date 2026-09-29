import { Response } from 'express';
import { User } from '../models/user.model';
import { Complaint } from '../models/complaint.model';
import { Department } from '../models/department.model';
import { Feedback } from '../models/feedback.model';
import { ComplaintEvidence } from '../models/complaintEvidence.model';
import { AuditLog } from '../models/auditLog.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendResponse } from '../utils/response';
import { sendEmail } from '../utils/email';

/**
 * System-Wide Executive Dashboard Statistics
 */
export const getSystemDashboard = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const now = new Date();
    const { departmentId, range, startDate, endDate } = request.query;

    const filter: any = {};

    if (departmentId && departmentId !== 'all') {
      filter.departmentId = departmentId;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    } else if (range === '7D') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filter.createdAt = { $gte: past, $lte: now };
    } else if (range === '30D') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filter.createdAt = { $gte: past, $lte: now };
    }

    const [
      totalComplaints,
      pendingComplaints,
      assignedComplaints,
      inProgressComplaints,
      underVerificationComplaints,
      resolvedComplaints,
      closedComplaints,
      cancelledComplaints,
      overdueComplaints,
      slaBreachedComplaints,
      totalUsers,
      activeDepartments,
      pendingDepartments
    ] = await Promise.all([
      Complaint.countDocuments(filter),
      Complaint.countDocuments({ ...filter, status: { $in: ['submitted', 'pending_assignment'] } }),
      Complaint.countDocuments({ ...filter, status: 'assigned' }),
      Complaint.countDocuments({ ...filter, status: 'in_progress' }),
      Complaint.countDocuments({ ...filter, status: 'under_verification' }),
      Complaint.countDocuments({ ...filter, status: 'resolved' }),
      Complaint.countDocuments({ ...filter, status: 'closed' }),
      Complaint.countDocuments({ ...filter, status: 'cancelled' }),
      Complaint.countDocuments({
        ...filter,
        status: { $nin: ['resolved', 'closed', 'cancelled'] },
        currentEta: { $lt: now }
      }),
      Complaint.countDocuments({ ...filter, slaBreached: true }),
      User.countDocuments(),
      Department.countDocuments({ isActive: true }),
      Department.countDocuments({ approvalStatus: 'pending' })
    ]);

    // Average resolution time for closed/resolved complaints
    const resolutionAgg = await Complaint.aggregate([
      { $match: { ...filter, status: { $in: ['resolved', 'closed'] }, resolvedAt: { $exists: true } } },
      {
        $group: {
          _id: null,
          avgDurationMs: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } }
        }
      }
    ]);
    const avgResolutionHours = resolutionAgg[0]?.avgDurationMs
      ? Number((resolutionAgg[0].avgDurationMs / (1000 * 60 * 60)).toFixed(1))
      : 0;

    // SLA compliance rate
    const closedOrResolvedCount = resolvedComplaints + closedComplaints;
    const slaCompliancePercentage =
      closedOrResolvedCount > 0
        ? Math.max(0, Number((((closedOrResolvedCount - slaBreachedComplaints) / closedOrResolvedCount) * 100).toFixed(1)))
        : 100;

    // Resident satisfaction rating
    const feedbackAgg = await Feedback.aggregate([
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          totalFeedback: { $sum: 1 }
        }
      }
    ]);

    const residentSatisfaction = {
      averageRating: feedbackAgg[0]?.avgRating ? Number(feedbackAgg[0].avgRating.toFixed(2)) : 5.0,
      totalFeedbackCount: feedbackAgg[0]?.totalFeedback || 0
    };

    return sendResponse(response, 200, true, 'System dashboard statistics retrieved', {
      totalUsers,
      totalComplaints,
      activeDepartments,
      pendingDepartments,
      statusBreakdown: {
        pending: pendingComplaints,
        assigned: assignedComplaints,
        inProgress: inProgressComplaints,
        underVerification: underVerificationComplaints,
        resolved: resolvedComplaints,
        closed: closedComplaints,
        cancelled: cancelledComplaints
      },
      overdueComplaints,
      slaBreachedComplaints,
      avgResolutionHours,
      slaCompliancePercentage,
      residentSatisfaction
    });
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error generating dashboard');
  }
};

/**
 * Department Performance Report
 */
export const getDepartmentReports = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const departments = await Department.find();
    const reports = await Promise.all(
      departments.map(async dept => {
        const total = await Complaint.countDocuments({ departmentId: dept._id });
        const active = await Complaint.countDocuments({
          departmentId: dept._id,
          status: { $in: ['assigned', 'in_progress', 'under_verification'] }
        });
        const resolved = await Complaint.countDocuments({
          departmentId: dept._id,
          status: { $in: ['resolved', 'closed'] }
        });
        const breached = await Complaint.countDocuments({
          departmentId: dept._id,
          slaBreached: true
        });

        const compliance = total > 0 ? Number((((total - breached) / total) * 100).toFixed(1)) : 100;

        return {
          departmentId: dept._id,
          departmentName: dept.name,
          totalComplaints: total,
          activeWorkload: active,
          resolvedCount: resolved,
          slaBreaches: breached,
          complianceRate: compliance
        };
      })
    );

    return sendResponse(response, 200, true, 'Department reports retrieved', reports);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error generating department report');
  }
};

/**
 * Staff Workload & Performance Report
 */
export const getStaffReports = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const staffList = await User.find({ role: 'staff', accountStatus: 'active' })
      .populate('departmentId', 'name')
      .select('email profile rank departmentId');

    const reports = await Promise.all(
      staffList.map(async staff => {
        const assignedActive = await Complaint.countDocuments({
          $or: [{ primaryStaffId: staff._id }, { assignedStaffId: staff._id }],
          status: { $in: ['assigned', 'in_progress', 'under_verification'] }
        });

        const completed = await Complaint.countDocuments({
          $or: [{ primaryStaffId: staff._id }, { assignedStaffId: staff._id }],
          status: { $in: ['resolved', 'closed'] }
        });

        const overdue = await Complaint.countDocuments({
          $or: [{ primaryStaffId: staff._id }, { assignedStaffId: staff._id }],
          status: { $nin: ['resolved', 'closed', 'cancelled'] },
          currentEta: { $lt: new Date() }
        });

        return {
          staffId: staff._id,
          fullName: staff.profile?.fullName || staff.email,
          email: staff.email,
          rank: staff.rank,
          department: (staff.departmentId as any)?.name || 'Unassigned',
          activeWorkload: assignedActive,
          completedCount: completed,
          overdueAssignments: overdue
        };
      })
    );

    return sendResponse(response, 200, true, 'Staff reports retrieved', reports);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error generating staff report');
  }
};

/**
 * Filtered Audit Logs
 */
export const getAuditLogsFiltered = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      entityType, 
      action, 
      userId, 
      userRole,
      search,
      startDate, 
      endDate, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = request.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query: any = {};

    if (entityType && entityType !== 'all') {
      query.entityType = entityType;
    }

    if (action && action !== 'all') {
      query.action = new RegExp(String(action).trim(), 'i');
    }

    if (userRole && userRole !== 'all') {
      query.userRole = userRole;
    }

    if (userId) {
      query.userId = userId;
    }

    if (search) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      query.$or = [
        { action: searchRegex },
        { entityType: searchRegex },
        { userRole: searchRegex },
        { 'details.reason': searchRegex },
        { 'details.title': searchRegex },
        { 'details.category': searchRegex },
        { ipAddress: searchRegex }
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const sortObj: any = {};
    const sortByStr = (sortBy as string) || 'createdAt';
    const sortOrderNum = (sortOrder as string) === 'asc' ? 1 : -1;
    sortObj[sortByStr] = sortOrderNum;

    const totalCount = await AuditLog.countDocuments(query);

    const logs = await AuditLog.find(query)
      .populate('userId', 'email profile.fullName role')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Fetch distinct actions and entityTypes for dynamic UI filter dropdowns
    const [distinctActions, distinctEntities] = await Promise.all([
      AuditLog.distinct('action'),
      AuditLog.distinct('entityType')
    ]);

    return sendResponse(response, 200, true, 'Audit logs retrieved', {
      logs,
      pagination: {
        current: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum) || 1
      },
      availableFilters: {
        actions: distinctActions.sort(),
        entityTypes: distinctEntities.sort()
      }
    });
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error retrieving audit logs');
  }
};

/**
 * Super Admin: Executive Admin Performance Analytics
 */
export const getAdminPerformance = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const admins = await User.find({ role: 'admin', accountStatus: 'active' })
      .select('email profile role createdAt accountStatus')
      .lean();

    // System-wide complaint benchmark metrics
    const [totalComplaints, resolvedComplaints, pendingComplaints, activeComplaints, overdueComplaints, slaBreachedCount] = await Promise.all([
      Complaint.countDocuments({}),
      Complaint.countDocuments({ status: { $in: ['resolved', 'closed'] } }),
      Complaint.countDocuments({ status: { $in: ['submitted', 'pending_assignment'] } as any }),
      Complaint.countDocuments({ status: { $in: ['assigned', 'in_progress', 'under_verification'] } }),
      Complaint.countDocuments({
        status: { $nin: ['resolved', 'closed', 'cancelled'] },
        $or: [
          { currentEta: { $lt: new Date() } },
          { slaDeadline: { $lt: new Date() } }
        ]
      }),
      Complaint.countDocuments({ slaBreached: true })
    ]);

    // Average system resolution time in hours
    const resolvedRecords = await Complaint.find({
      status: { $in: ['resolved', 'closed'] },
      resolvedAt: { $exists: true },
      createdAt: { $exists: true }
    }).select('createdAt resolvedAt').lean();

    let avgResolutionHours = 0;
    if (resolvedRecords.length > 0) {
      const totalHours = resolvedRecords.reduce((acc, c: any) => {
        const diffMs = new Date(c.resolvedAt).getTime() - new Date(c.createdAt).getTime();
        return acc + Math.max(0, diffMs / (1000 * 60 * 60));
      }, 0);
      avgResolutionHours = Math.round((totalHours / resolvedRecords.length) * 10) / 10;
    }

    const slaComplianceRate = totalComplaints > 0
      ? Math.round((Math.max(0, totalComplaints - slaBreachedCount) / totalComplaints) * 100)
      : 100;

    // Per-admin activity and throughput
    const adminPerformanceList = await Promise.all(
      admins.map(async (admin) => {
        // Administrative actions logged in AuditLog
        const [totalActions, userApprovals, transferReviews, promoActions, disciplinaryWarnings, slaConfigs] = await Promise.all([
          AuditLog.countDocuments({ userId: admin._id }),
          User.countDocuments({ approvedBy: admin._id }),
          AuditLog.countDocuments({
            userId: admin._id,
            action: { $in: ['EMPLOYEE_TRANSFER_APPROVED', 'EMPLOYEE_TRANSFER_REJECTED'] }
          }),
          AuditLog.countDocuments({
            userId: admin._id,
            action: { $in: ['PROMOTION_APPROVED', 'PROMOTION_REJECTED'] }
          }),
          AuditLog.countDocuments({
            userId: admin._id,
            action: 'FORMAL_WARNING_ISSUED'
          }),
          AuditLog.countDocuments({
            userId: admin._id,
            action: { $in: ['CONFIGURE_SLA_POLICY', 'UPDATE_SLA_POLICY'] }
          })
        ]);

        // Latest activity timestamp
        const latestLog = await AuditLog.findOne({ userId: admin._id })
          .sort({ createdAt: -1 })
          .select('createdAt action')
          .lean();

        return {
          _id: admin._id,
          email: admin.email,
          fullName: admin.profile?.fullName || admin.email.split('@')[0],
          accountStatus: admin.accountStatus,
          joinedAt: admin.createdAt,
          totalActionsLogged: totalActions,
          userApprovals,
          transferReviews,
          promotionReviews: promoActions,
          disciplinaryActions: disciplinaryWarnings,
          slaConfigurations: slaConfigs,
          lastActiveAt: latestLog?.createdAt || admin.createdAt,
          // Operational metrics for administrative oversight
          totalComplaintsSupervised: totalComplaints,
          resolvedComplaints,
          pendingComplaints,
          activeWorkload: activeComplaints,
          overdueComplaints,
          averageResolutionHours: avgResolutionHours,
          slaComplianceRate
        };
      })
    );

    return sendResponse(response, 200, true, 'Admin performance analytics retrieved', {
      admins: adminPerformanceList,
      summary: {
        totalAdmins: admins.length,
        totalComplaints,
        resolvedComplaints,
        pendingComplaints,
        activeWorkload: activeComplaints,
        overdueComplaints,
        avgResolutionHours,
        slaComplianceRate
      }
    });
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error generating admin performance');
  }
};

/**
 * Super Admin: Create a new Administrator account
 */
export const createAdminUser = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { fullName, email, phone, password } = request.body;

    if (!fullName || !email || !password) {
      return sendResponse(response, 400, false, 'Full name, email, and password are required.');
    }

    const existingUser = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (existingUser) {
      return sendResponse(response, 400, false, 'An account with this email address already exists.');
    }

    const newAdmin: any = new User({
      email: String(email).trim().toLowerCase(),
      password,
      role: 'admin',
      accountStatus: 'active',
      profile: {
        fullName: String(fullName).trim(),
        phone: phone ? String(phone).trim() : undefined,
      },
      approvedBy: request.user?._id
    });
    await newAdmin.save();

    // Record in central AuditLog
    await AuditLog.create({
      userId: request.user?._id,
      userRole: 'superadmin',
      action: 'ADMIN_ACCOUNT_CREATED',
      entityType: 'User',
      entityId: newAdmin._id,
      details: {
        adminEmail: newAdmin.email,
        adminFullName: fullName,
        reason: 'Super Admin created new Administrator account'
      },
      ipAddress: request.ip
    });

    // Send Welcome & Credentials Email (non-blocking)
    const clientUrl = process.env.CLIENT_URL ? `${process.env.CLIENT_URL}/login` : 'http://localhost:5173/login';
    try {
      await sendEmail({
        to: newAdmin.email,
        subject: 'Welcome to CMS — Your Central Administrator Account Credentials',
        message: `Hello ${fullName},

Welcome to the Complaint Management System! A Central Administrator account has been provisioned for you by the Super Administrator.

Your Account Details:
  Role:               Central Administrator
  Login Email:        ${newAdmin.email}
  Temporary Password: ${password}

Login Portal:
  ${clientUrl}

Next Steps:
  1. Navigate to the login portal above.
  2. Log in using your email and temporary password.
  3. Once logged in, immediately navigate to your Profile / Settings page to update and secure your password.

If you have any questions or did not expect this invitation, please contact your Super Administrator immediately.

Warm regards,
Complaint Management System Administration`
      });
      console.log(`[createAdminUser] Credentials email successfully dispatched to ${newAdmin.email}`);
    } catch (emailErr: any) {
      console.warn(`[createAdminUser] Warning: Failed to send credentials email to ${newAdmin.email}:`, emailErr?.message || emailErr);
    }

    const adminPayload = newAdmin.toObject();
    delete (adminPayload as any).password;

    return sendResponse(response, 201, true, 'Administrator created successfully.', adminPayload);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error creating administrator');
  }
};

/**
 * Super Admin: Delete an Administrator account
 */
export const deleteAdminUser = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const adminId = String(request.params.adminId);

    const targetUser = await User.findById(adminId);
    if (!targetUser) {
      return sendResponse(response, 404, false, 'Administrator not found.');
    }

    if (targetUser.role === 'superadmin') {
      return sendResponse(response, 403, false, 'Super Admin accounts cannot be deleted.');
    }

    if (targetUser.role !== 'admin') {
      return sendResponse(response, 400, false, 'Target user is not an administrator.');
    }

    // Clear any active sessions / tokens immediately before deletion
    await User.findByIdAndUpdate(adminId, {
      $set: {
        refreshToken: null,
        accountStatus: 'suspended',
        employmentStatus: 'TERMINATED',
        socketId: null
      }
    });

    // Delete the administrator document from database
    await User.findByIdAndDelete(adminId);

    // Record in AuditLog
    await AuditLog.create({
      userId: request.user?._id,
      userRole: 'superadmin',
      action: 'ADMIN_ACCOUNT_DELETED',
      entityType: 'User',
      entityId: adminId,
      details: {
        adminEmail: targetUser.email,
        adminFullName: targetUser.profile?.fullName,
        reason: 'Administrator account deleted by Super Admin'
      },
      ipAddress: request.ip
    });

    return sendResponse(response, 200, true, 'Administrator deleted successfully.');
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error deleting administrator');
  }
};

/**
 * Super Admin: Get drill-down details for a specific Administrator
 */
export const getAdminDetails = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { adminId } = request.params;

    const admin = await User.findById(adminId)
      .select('email profile role createdAt accountStatus')
      .lean();

    if (!admin) {
      return sendResponse(response, 404, false, 'Administrator not found.');
    }

    // 1. Actions performed by this admin (from central AuditLog)
    const actions = await AuditLog.find({ userId: adminId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // 2. Supervised complaints (all complaints, sorted by priority and recency)
    const supervisedComplaints = await Complaint.find({})
      .populate('departmentId', 'name')
      .populate('residentId', 'email profile.fullName')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const formattedComplaints = supervisedComplaints.map((c: any) => ({
      _id: c._id,
      complaintId: c.complaintId || `#${String(c._id).slice(-6)}`,
      title: c.title,
      department: c.departmentId?.name || 'General',
      status: c.status,
      priority: c.priority || 'medium',
      createdAt: c.createdAt,
      resolvedAt: c.resolvedAt || null,
      slaBreached: Boolean(c.slaBreached)
    }));

    return sendResponse(response, 200, true, 'Admin oversight details retrieved', {
      admin,
      actions,
      supervisedComplaints: formattedComplaints
    });
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error retrieving admin details');
  }
};

/**
 * Super Admin: Get all live complaints with resident feedback & resolution metrics
 */
export const getResidentFeedbackList = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { rating, search } = request.query;

    // 1. Find all complaints that either have rating > 0 or have feedback in Feedback collection
    const feedbacks = await Feedback.find({}).lean();
    const feedbackComplaintIds = feedbacks.map((f) => f.complaintId);

    const query: any = {
      $or: [
        { rating: { $exists: true, $ne: null, $gt: 0 } },
        { feedbackSubmittedAt: { $exists: true, $ne: null } },
        { _id: { $in: feedbackComplaintIds } }
      ]
    };

    if (rating && !isNaN(Number(rating))) {
      const numRating = Number(rating);
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { rating: numRating },
          { _id: { $in: feedbacks.filter((f) => f.rating === numRating).map((f) => f.complaintId) } }
        ]
      });
    }

    const complaints = await Complaint.find(query)
      .populate('departmentId', 'name')
      .populate('residentId', 'email profile.fullName profile.phone')
      .populate('primaryStaffId', 'email profile.fullName')
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    // Map evidence photos
    const complaintIds = complaints.map((c) => c._id);
    const evidences = await ComplaintEvidence.find({ complaintId: { $in: complaintIds } })
      .sort({ createdAt: -1 })
      .lean();

    const evidenceByComplaintId: Record<string, any[]> = {};
    evidences.forEach((ev: any) => {
      const cId = String(ev.complaintId);
      if (!evidenceByComplaintId[cId]) evidenceByComplaintId[cId] = [];
      evidenceByComplaintId[cId].push(ev);
    });

    const feedbackByComplaintId: Record<string, any> = {};
    feedbacks.forEach((fb: any) => {
      feedbackByComplaintId[String(fb.complaintId)] = fb;
    });

    const formattedList = complaints.map((c: any) => {
      const fb = feedbackByComplaintId[String(c._id)];
      const relatedEvidences = evidenceByComplaintId[String(c._id)] || [];
      
      const beforePhotos: string[] = [
        ...(Array.isArray(c.attachedImages) ? c.attachedImages : []),
        ...(Array.isArray(c.images) ? c.images : [])
      ];

      const afterPhotos: string[] = Array.from(new Set([
        ...(Array.isArray(c.resolutionPhotos) ? c.resolutionPhotos : []),
        ...relatedEvidences.flatMap((e: any) => (Array.isArray(e.images) ? e.images : []))
      ]));

      // Compute resolution time
      let resolutionTimeFormatted = '—';
      let resolutionTimeHours = 0;
      const startTime = new Date(c.createdAt).getTime();
      const endTime = c.resolvedAt ? new Date(c.resolvedAt).getTime() : (c.updatedAt ? new Date(c.updatedAt).getTime() : 0);

      if (endTime && endTime > startTime) {
        const diffMs = endTime - startTime;
        resolutionTimeHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
        const totalMinutes = Math.floor(diffMs / (1000 * 60));
        const days = Math.floor(totalMinutes / (60 * 24));
        const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
        const minutes = totalMinutes % 60;

        if (days > 0) {
          resolutionTimeFormatted = `${days}d ${hours}h`;
        } else if (hours > 0) {
          resolutionTimeFormatted = `${hours}h ${minutes}m`;
        } else {
          resolutionTimeFormatted = `${minutes}m`;
        }
      }

      const ratingVal = fb?.rating || c.rating || 5;
      const feedbackComment = fb?.comments || c.feedbackComment || '';
      const feedbackSubmittedAt = fb?.createdAt || c.feedbackSubmittedAt || c.resolvedAt || c.updatedAt;

      return {
        _id: c._id,
        complaintId: c.complaintId || `#${String(c._id).slice(-6).toUpperCase()}`,
        title: c.title,
        description: c.description,
        status: c.status,
        priority: c.priority || 'medium',
        department: c.departmentId?.name || 'General Operations',
        resident: {
          name: c.residentId?.profile?.fullName || 'Resident',
          email: c.residentId?.email || '—',
          phone: c.residentId?.profile?.phone || '—'
        },
        rating: ratingVal,
        feedbackComment,
        feedbackSubmittedAt,
        createdAt: c.createdAt,
        resolvedAt: c.resolvedAt || null,
        resolutionTimeHours,
        resolutionTime: resolutionTimeFormatted,
        beforePhotos,
        afterPhotos,
        primaryImage: afterPhotos[0] || beforePhotos[0] || null
      };
    });

    // Client-side text search filter if requested
    let result = formattedList;
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((item) =>
        item.complaintId.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.feedbackComment.toLowerCase().includes(q) ||
        item.department.toLowerCase().includes(q) ||
        item.resident.name.toLowerCase().includes(q)
      );
    }

    return sendResponse(response, 200, true, 'Resident feedback list retrieved', {
      total: result.length,
      feedbackList: result
    });
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error retrieving resident feedback');
  }
};




