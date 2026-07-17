import { Response } from 'express';
import { User } from '../models/user.model';
import { Complaint } from '../models/complaint.model';
import { Department } from '../models/department.model';
import { ActivityLog } from '../models/activityLog.model';
import { sendEmail } from '../utils/email';
import { NotificationService } from '../services/notification.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendResponse } from '../utils/response';

/**
 * Executes explicitly dynamic unified Global Analytics natively aggregating full clusters perfectly.
 */
export const getGlobalAnalytics = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { startDate, endDate, allTime, departmentId, range } = request.query;

    const isAllTime = startDate === 'all' || endDate === 'all' || allTime === 'true' || range === 'All Time';

    const matchStage: any = {};

    if (departmentId && departmentId !== 'all') {
      const mongoose = require('mongoose');
      matchStage.departmentId = mongoose.Types.ObjectId.isValid(departmentId)
        ? new mongoose.Types.ObjectId(departmentId as string)
        : departmentId;
    }

    if (!isAllTime) {
      if (range === '7D') {
        const now = new Date();
        const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchStage.createdAt = { $gte: past, $lte: now };
      } else if (range === '30D') {
        const now = new Date();
        const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchStage.createdAt = { $gte: past, $lte: now };
      } else {
        const start = startDate ? new Date(startDate as string) : null;
        const end = endDate ? new Date(endDate as string) : null;

        if (end) {
          end.setHours(23, 59, 59, 999);
        }

        if (!start || !end) {
          const now = new Date();
          const past = new Date();
          past.setDate(now.getDate() - 30);
          matchStage.createdAt = { $gte: past, $lte: now };
        } else {
          matchStage.createdAt = { $gte: start, $lte: end };
        }
      }
    }

    const defaultDateBounds = new Date();

    const pipeline: any[] = [
      { $match: matchStage },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalComplaints: { $sum: 1 },
                resolvedComplaints: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
                pendingComplaints: { $sum: { $cond: [{ $ne: ["$status", "resolved"] }, 1, 0] } },
                avgResolutionTimeHours: {
                  $avg: {
                    $cond: [
                      { $eq: ["$status", "resolved"] },
                      { $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 1000 * 60 * 60] },
                      null
                    ]
                  }
                }
              }
            }
          ],
          slaMetrics: [
            {
              $group: {
                _id: null,
                slaBreachedResolved: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$status", "resolved"] },
                          { $gt: ["$resolvedAt", "$slaDeadline"] }
                        ]
                      }, 1, 0
                    ]
                  }
                },
                slaBreachedPending: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $ne: ["$status", "resolved"] },
                          { $lt: ["$slaDeadline", defaultDateBounds] }
                        ]
                      }, 1, 0
                    ]
                  }
                },
                slaExtended: {
                  $sum: {
                    $cond: [{ $eq: ["$slaStatus", "extended"] }, 1, 0]
                  }
                },
                slaOnTimeResolved: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$status", "resolved"] },
                          { $lte: ["$resolvedAt", "$slaDeadline"] }
                        ]
                      }, 1, 0
                    ]
                  }
                }
              }
            }
          ],
          trends: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ],
          departments: [
            {
              $group: {
                _id: "$departmentId",
                totalComplaints: { $sum: 1 },
                resolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
                slaBreached: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $and: [{ $eq: ["$status", "resolved"] }, { $gt: ["$resolvedAt", "$slaDeadline"] }] },
                          { $and: [{ $ne: ["$status", "resolved"] }, { $lt: ["$slaDeadline", defaultDateBounds] }] }
                        ]
                      }, 1, 0
                    ]
                  }
                },
                slaOnTimeResolved: {
                  $sum: {
                    $cond: [
                      { $and: [{ $eq: ["$status", "resolved"] }, { $lte: ["$resolvedAt", "$slaDeadline"] }] }, 1, 0
                    ]
                  }
                },
                avgResolutionTimeHours: {
                  $avg: {
                    $cond: [
                      { $eq: ["$status", "resolved"] },
                      { $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 1000 * 60 * 60] },
                      null
                    ]
                  }
                }
              }
            },
            {
              $lookup: {
                from: "departments",
                localField: "_id",
                foreignField: "_id",
                as: "department"
              }
            },
            {
              $project: {
                departmentName: { $arrayElemAt: ["$department.name", 0] },
                totalComplaints: 1,
                resolved: 1,
                slaBreached: 1,
                avgResolutionTimeHours: { $round: ["$avgResolutionTimeHours", 1] },
                complianceRate: {
                  $cond: [
                    { $eq: ["$resolved", 0] },
                    0,
                    { $round: [{ $multiply: [{ $divide: ["$slaOnTimeResolved", "$resolved"] }, 100] }, 1] }
                  ]
                }
              }
            }
          ],
          staff: [
            { $match: { assignedStaffId: { $ne: null } } },
            {
              $group: {
                _id: "$assignedStaffId",
                assignedCount: { $sum: 1 },
                resolvedCount: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
                slaBreaches: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $and: [{ $eq: ["$status", "resolved"] }, { $gt: ["$resolvedAt", "$slaDeadline"] }] },
                          { $and: [{ $ne: ["$status", "resolved"] }, { $lt: ["$slaDeadline", defaultDateBounds] }] }
                        ]
                      }, 1, 0
                    ]
                  }
                },
                slaOnTimeResolved: {
                  $sum: {
                    $cond: [
                      { $and: [{ $eq: ["$status", "resolved"] }, { $lte: ["$resolvedAt", "$slaDeadline"] }] }, 1, 0
                    ]
                  }
                },
                avgResolutionTimeHours: {
                  $avg: {
                    $cond: [
                      { $eq: ["$status", "resolved"] },
                      { $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 1000 * 60 * 60] },
                      null
                    ]
                  }
                }
              }
            },
            {
              $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "staffUser"
              }
            },
            {
              $project: {
                staffName: { $arrayElemAt: ["$staffUser.profile.fullName", 0] },
                assignedCount: 1,
                resolvedCount: 1,
                slaBreaches: 1,
                avgResolutionTimeHours: { $round: ["$avgResolutionTimeHours", 1] },
                complianceRate: {
                  $cond: [
                    { $eq: ["$resolvedCount", 0] },
                    0,
                    { $round: [{ $multiply: [{ $divide: ["$slaOnTimeResolved", "$resolvedCount"] }, 100] }, 1] }
                  ]
                }
              }
            }
          ]
        }
      }
    ];

    const result = await Complaint.aggregate(pipeline);
    const resolvedPayload = result[0];

    // Fetch all active departments to ensure complete coverage even with 0 complaints
    const activeDepartments = await Department.find({ isActive: { $ne: false } })
      .select('_id name')
      .lean();

    const complaintDeptMap = new Map<string, any>();
    (resolvedPayload.departments || []).forEach((d: any) => {
      if (d._id) {
        complaintDeptMap.set(d._id.toString(), d);
      }
    });

    const mergedDepartments = activeDepartments.map((dept) => {
      const deptIdStr = dept._id.toString();
      const stats = complaintDeptMap.get(deptIdStr);

      if (stats && stats.totalComplaints > 0) {
        return {
          _id: dept._id,
          departmentName: dept.name,
          totalComplaints: stats.totalComplaints,
          resolved: stats.resolved,
          slaBreached: stats.slaBreached,
          avgResolutionTimeHours: stats.avgResolutionTimeHours ?? null,
          complianceRate: stats.complianceRate ?? null
        };
      }

      return {
        _id: dept._id,
        departmentName: dept.name,
        totalComplaints: 0,
        resolved: 0,
        slaBreached: 0,
        avgResolutionTimeHours: null,
        complianceRate: null
      };
    });

    // Also include any complaints attributed to null or unassigned departments if any
    (resolvedPayload.departments || []).forEach((d: any) => {
      if (!d._id || !activeDepartments.some(ad => ad._id.toString() === d._id.toString())) {
        mergedDepartments.push({
          _id: d._id || 'unassigned',
          departmentName: d.departmentName || 'General / Unassigned',
          totalComplaints: d.totalComplaints || 0,
          resolved: d.resolved || 0,
          slaBreached: d.slaBreached || 0,
          avgResolutionTimeHours: d.avgResolutionTimeHours ?? null,
          complianceRate: d.totalComplaints > 0 ? (d.complianceRate ?? null) : null
        });
      }
    });

    // Fetch all real staff & workforce members to align with Workforce Directory (~18)
    const allStaffMembers = await User.find({ 
      role: { $in: ['staff', 'supervisor', 'department_head'] },
      employmentStatus: { $ne: 'TERMINATED' } 
    })
      .select('_id email role profile.fullName departmentId')
      .populate('departmentId', 'name')
      .lean();

    const complaintStaffMap = new Map<string, any>();
    (resolvedPayload.staff || []).forEach((s: any) => {
      if (s._id) {
        complaintStaffMap.set(s._id.toString(), s);
      }
    });

    const mergedStaff = allStaffMembers.map((member: any) => {
      const memberIdStr = member._id.toString();
      const stats = complaintStaffMap.get(memberIdStr);
      const staffName = member.profile?.fullName || member.email?.split('@')[0] || 'Staff Member';
      const deptName = member.departmentId?.name || (member.departmentId ? 'Assigned' : 'Unassigned');

      if (stats && stats.assignedCount > 0) {
        return {
          _id: member._id,
          staffName: stats.staffName || staffName,
          email: member.email,
          role: member.role,
          departmentName: deptName,
          assignedCount: stats.assignedCount,
          resolvedCount: stats.resolvedCount,
          slaBreaches: stats.slaBreaches,
          avgResolutionTimeHours: stats.avgResolutionTimeHours ?? null,
          complianceRate: stats.complianceRate ?? null
        };
      }

      return {
        _id: member._id,
        staffName,
        email: member.email,
        role: member.role,
        departmentName: deptName,
        assignedCount: 0,
        resolvedCount: 0,
        slaBreaches: 0,
        avgResolutionTimeHours: null,
        complianceRate: null
      };
    });

    // Also include any complaint assignedStaffId not in the active staff query if any exist
    (resolvedPayload.staff || []).forEach((s: any) => {
      if (s._id && !allStaffMembers.some(sm => sm._id.toString() === s._id.toString())) {
        mergedStaff.push({
          _id: s._id,
          staffName: s.staffName || 'Staff Member',
          email: s.email,
          role: 'staff',
          departmentName: 'General',
          assignedCount: s.assignedCount || 0,
          resolvedCount: s.resolvedCount || 0,
          slaBreaches: s.slaBreaches || 0,
          avgResolutionTimeHours: s.avgResolutionTimeHours ?? null,
          complianceRate: s.assignedCount > 0 ? (s.complianceRate ?? null) : null
        });
      }
    });

    const safeOverview = resolvedPayload.overview[0] || {
      totalComplaints: 0,
      resolvedComplaints: 0,
      pendingComplaints: 0,
      avgResolutionTimeHours: 0
    };

    safeOverview.avgResolutionTimeHours = Number(safeOverview.avgResolutionTimeHours?.toFixed(1) || 0);

    const safeSla = resolvedPayload.slaMetrics[0] || {
      slaBreachedResolved: 0,
      slaBreachedPending: 0,
      slaExtended: 0,
      slaOnTimeResolved: 0
    };

    const slaComplianceRate = safeOverview.resolvedComplaints > 0 
      ? Number(((safeSla.slaOnTimeResolved / safeOverview.resolvedComplaints) * 100).toFixed(1)) 
      : 0;

    return sendResponse(response, 200, true, 'Global analytics retrieved', {
        overview: safeOverview,
        slaMetrics: { ...safeSla, slaComplianceRate },
        trends: resolvedPayload.trends || [],
        departments: mergedDepartments,
        staff: mergedStaff
    });
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Server error explicitly executing Analytics Core');
  }
};

/**
 * Retrieves all users securely trapped in the pending approval queue.
 */
export const getPendingUsers = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const pendingUsers = await User.find({ accountStatus: 'pending', role: 'resident' })
      .select('-password -refreshToken') // Heavily strict DB stripping
      .sort({ createdAt: -1 });

    const approvedCount = await User.countDocuments({ accountStatus: 'active', role: 'resident' });
    const rejectedCount = await User.countDocuments({ accountStatus: 'suspended', role: 'resident' });

    return sendResponse(response, 200, true, 'Pending users retrieved', {
      pendingUsers,
      approvedCount,
      rejectedCount
    });
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Server error');
  }
};

/**
 * Executes a hard approval explicitly switching status and notifying the user.
 */
export const approveUser = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const user = await User.findById(id);

    if (!user) {
      return sendResponse(response, 404, false, 'User not found in registry');
    }

    if (user.accountStatus !== 'pending') {
      return sendResponse(response, 400, false, 'Only heavily locked pending users can be approved');
    }

    user.accountStatus = 'active';
    user.approvedBy = request.user?._id;
    user.statusHistory.push({ status: 'active', changedAt: new Date() });
    await user.save();

    // Trigger explicit administrative audit logging dynamically
    await ActivityLog.create({
      action: 'user_approved',
      performedBy: request.user?._id,
      targetUser: user._id,
      oldValue: 'pending',
      newValue: 'active'
    });

    const loginUrl = process.env.CLIENT_URL ? `${process.env.CLIENT_URL}/login` : 'http://localhost:5173/login';

    // 1. Fire dedicated Resident Welcome / Approval Email
    try {
      await sendEmail({
        to: user.email,
        subject: "Your Resident Account Has Been Approved 🎉",
        message: `Hello ${user.profile?.fullName || 'Resident'},
        
Great news! 🎉

Your resident account application has been verified and officially approved by the administration team. You now have full access to the Resident Portal.

You can log in to your account at any time using the link below:
${loginUrl}

From your dashboard, you can submit maintenance complaints, track resolution progress in real time, and view updates from our department staff.

Welcome to the community! If you need any assistance, our administration team is here to help.

Warm regards,
Community Administration Team`
      });
    } catch (emailErr) {
      console.error("[Resident Approval Mail Error]:", emailErr);
    }

    // 2. Send In-App Notification for Resident
    try {
      await NotificationService.send({
        userId: user._id,
        type: 'resident_approved',
        title: 'Account Approved',
        message: 'Your resident account has been approved. Welcome to the portal!',
        idempotencyKey: `resident-approved-${user._id}`
      });
    } catch (notifErr) {
      console.error("[Resident Approval Notification Error]:", notifErr);
    }

    return sendResponse(response, 200, true, 'User has been officially approved and activated.');
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Server error');
  }
};

/**
 * Executes a firm rejection keeping the footprint heavily logged but stripping access via 'suspended'.
 */
export const rejectUser = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const { reason } = request.body;

    const user = await User.findById(id);

    if (!user) {
      return sendResponse(response, 404, false, 'User not found in registry');
    }

    if (user.accountStatus !== 'pending') {
      return sendResponse(response, 400, false, 'Only heavily locked pending users can be formally rejected');
    }

    user.accountStatus = 'suspended';
    user.rejectionReason = reason;
    user.rejectedBy = request.user?._id;
    user.statusHistory.push({ status: 'suspended', changedAt: new Date(), reason });
    await user.save();

    // Trigger explicit structural audit tracking strictly documenting dynamic rejection
    await ActivityLog.create({
      action: 'user_rejected',
      performedBy: request.user?._id,
      targetUser: user._id,
      oldValue: 'pending',
      newValue: reason ? `suspended: ${reason}` : 'suspended'
    });

    // Fire dedicated polite Rejection Email with Context
    try {
      await sendEmail({
        to: user.email,
        subject: "Update Regarding Your Resident Registration Application",
        message: `Hello ${user.profile?.fullName || 'Resident'},
        
Thank you for submitting your registration application for the Resident Portal.

Our administration team has reviewed your application and verification details. Unfortunately, your registration could not be approved at this time.

${reason ? `Reason provided by Administration:\n"${reason}"\n\n` : ''}If you have corrected documents or believe this decision was made in error, you may re-apply using your existing account credentials, or reach out directly to the management office for assistance.

Thank you for your understanding.

Best regards,
Community Administration Team`
      });
    } catch (emailErr) {
      console.error("[Resident Rejection Mail Error]:", emailErr);
    }

    return sendResponse(response, 200, true, 'User has been officially rejected and suspended.');
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Server error');
  }
};

/**
 * Retrieves all audit logs with pagination, filtering, and sorting capabilities
 */
export const getAuditLogs = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    console.log('🔍🔍🔍 [AUDIT LOGS] API CALLED! User:', request.user?.email);
    const { page = 1, limit = 20, action, userId, startDate, endDate, sortBy = 'createdAt', sortOrder = 'desc' } = request.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    console.log('🔍 [Audit Logs] Fetching logs with params:', { page: pageNum, limit: limitNum, action, userId, sortBy, sortOrder });

    // Build filter object
    const filter: any = {};

    if (action) {
      filter.action = new RegExp(action as string, 'i');
    }

    if (userId) {
      filter.performedBy = userId;
    }

    // Date range filter
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
    }

    console.log('📋 [Audit Logs] Filter object:', filter);

    // Build sort object
    const sortObj: any = {};
    const sortByStr = (sortBy as string) || 'createdAt';
    const sortOrderNum = (sortOrder as string) === 'asc' ? 1 : -1;
    sortObj[sortByStr] = sortOrderNum;

    // Count total FIRST
    const total = await ActivityLog.countDocuments(filter);
    console.log('📊 [Audit Logs] Total count BEFORE find:', total);

    // Fetch audit logs with pagination
    const logs = await ActivityLog.find(filter)
      .populate('performedBy', 'email profile')
      .populate('targetUser', 'email profile')
      .populate('complaintId', '_id title')
      .populate('departmentId', 'name')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean();

    console.log('✅ [Audit Logs] Found logs:', logs.length);

    // Get total count for pagination
    const totalCount = await ActivityLog.countDocuments(filter);
    console.log('📊 [Audit Logs] Total count:', totalCount);

    return sendResponse(response, 200, true, 'Audit logs retrieved successfully', {
      logs,
      pagination: {
        current: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum),
      }
    });
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Server error');
  }
};

/**
 * TEST ENDPOINT: Check ActivityLog collection
 */
export const testActivityLogs = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    console.log('🧪 [TEST] ActivityLog endpoint called!');
    
    const count = await ActivityLog.countDocuments({});
    console.log('📊 [TEST] Total ActivityLog documents:', count);
    
    const allLogs = await ActivityLog.find({}).limit(5).lean();
    console.log('📋 [TEST] Sample logs:', JSON.stringify(allLogs, null, 2));
    
    return sendResponse(response, 200, true, 'Test result', { count, sample: allLogs });
  } catch (error) {
    const err = error as Error;
    console.error('❌ [TEST] Error:', err);
    return sendResponse(response, 500, false, err.message || 'Test error');
  }
};
