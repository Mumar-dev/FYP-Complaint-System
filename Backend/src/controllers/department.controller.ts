import mongoose from 'mongoose';
import { Response } from 'express';
import { Department } from '../models/department.model';
import { User } from '../models/user.model';
import { Complaint } from '../models/complaint.model';
import { ActivityLog } from '../models/activityLog.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendResponse } from '../utils/response';
import { NotificationService } from '../services/notification.service';
import { normalizeStaffRank } from '../utils/rank.util';

export const createDepartment = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    let { name, code, slaTargetHours, description, positions, categories, keywords, headId } = request.body;

    name = name?.trim();
    code = code?.trim()?.toUpperCase();
    description = description?.trim();

    if (!name || slaTargetHours === undefined) {
      return sendResponse(response, 400, false, 'Name and SLA Target Hours are strictly required.');
    }

    if (name.length > 100) {
      return sendResponse(response, 400, false, 'Department name cannot exceed 100 characters.');
    }

    if (code && code.length > 10) {
      return sendResponse(response, 400, false, 'Department code cannot exceed 10 characters.');
    }

    if (description && description.length > 300) {
      return sendResponse(response, 400, false, 'Description cannot exceed 300 characters.');
    }

    const slaNum = Number(slaTargetHours);
    if (!Number.isFinite(slaNum) || slaNum <= 0 || slaNum > 720) {
      return sendResponse(response, 400, false, 'SLA must be a valid number between 1 and 720 hours.');
    }

    const existingName = await Department.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingName) {
      return sendResponse(response, 400, false, 'Department already exists');
    }

    // Process optional positions & categories/keywords arrays
    const formattedPositions = Array.isArray(positions)
      ? positions.map((p: any) => String(p).trim()).filter(Boolean)
      : [];

    const combinedKeywords = categories || keywords;
    const formattedKeywords = Array.isArray(combinedKeywords)
      ? combinedKeywords.map((k: any) => String(k).trim()).filter(Boolean)
      : [];

    const isSuperAdmin = request.user?.role === 'superadmin';

    const newDepartment = await Department.create({
      name,
      code: code || undefined,
      slaTargetHours: slaNum,
      description: description || undefined,
      positions: formattedPositions,
      keywords: formattedKeywords,
      headOfDepartment: undefined,
      isActive: isSuperAdmin ? true : false,
      approvalStatus: isSuperAdmin ? 'approved' : 'pending',
      approvedBy: isSuperAdmin ? request.user?._id : undefined,
      approvedAt: isSuperAdmin ? new Date() : undefined,
      createdBy: request.user?._id
    });

    // If headId is provided and department is approved, bind that user as Department Head
    if (headId && newDepartment.approvalStatus === 'approved') {
      const staff = await User.findById(headId);
      if (staff && (staff.role === 'staff' || staff.role === 'department_head')) {
        if (staff.rank && staff.rank !== 'head') {
          staff.previousRank = staff.rank;
        } else if (!staff.previousRank) {
          staff.previousRank = 'senior';
        }
        staff.rank = 'head';
        staff.role = 'department_head';
        staff.departmentId = newDepartment._id as any;
        await staff.save();

        newDepartment.headOfDepartment = staff._id as any;
        await newDepartment.save();

        await ActivityLog.create({
          action: 'head_assigned',
          performedBy: request.user?._id,
          targetUser: staff._id,
          departmentId: newDepartment._id,
          oldValue: 'none',
          newValue: staff._id.toString(),
          meta: { departmentName: newDepartment.name }
        });
      }
    }

    await ActivityLog.create({
      action: 'department_created',
      performedBy: request.user?._id,
      departmentId: newDepartment._id,
      newValue: newDepartment.name,
      meta: {
        slaTargetHours: newDepartment.slaTargetHours,
        code: newDepartment.code,
        headOfDepartment: newDepartment.headOfDepartment
      }
    });

    // Notify Super Admins if created by Admin and pending approval
    if (!isSuperAdmin && newDepartment.approvalStatus === 'pending') {
      try {
        const adminName = (request.user as any)?.profile?.fullName || (request.user as any)?.email || 'An Admin';
        const superAdmins = await User.find({ role: 'superadmin' }).select('_id');
        for (const sa of superAdmins) {
          await NotificationService.send({
            userId: sa._id,
            type: 'admin_alert',
            title: 'New Department Request',
            message: `${adminName} requested a new department: ${newDepartment.name}.`,
            idempotencyKey: `notif_dept_req_${newDepartment._id}_${sa._id}`
          });
        }
      } catch (notifErr: any) {
        console.error('[createDepartment Notification Error]: Failed to alert superadmins:', notifErr?.message || notifErr);
      }
    }

    return sendResponse(response, 201, true, 'Department created successfully.', newDepartment);
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Something went wrong');
  }
};

export const getDepartments = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const userRole = request.user?.role;
    const { approvedOnly, activeOnly } = request.query;

    // Filter query:
    // If approvedOnly=true or activeOnly=true, restrict to approved/active
    // Non-admin / non-superadmin roles (residents, staff, dept heads) can only see approved & active departments
    const query: any = {};
    const isRestrictedRole = !['admin', 'superadmin'].includes(userRole || '');

    if (isRestrictedRole || approvedOnly === 'true') {
      query.approvalStatus = 'approved';
    }
    if (isRestrictedRole || activeOnly === 'true') {
      query.isActive = true;
    }

    const departments = await Department.find(query)
      .populate('headOfDepartment', 'profile.fullName profile.profileImage profile.avatar email')
      .sort({ createdAt: -1 });

    const departmentsWithStats = await Promise.all(departments.map(async (dept) => {
      // Auto-sync: if headOfDepartment is null, check if there is a User assigned to this department with role department_head
      let head = dept.headOfDepartment;
      if (!head) {
        const fallbackHead = await User.findOne({
          departmentId: dept._id,
          role: 'department_head' as any
        }).select('profile.fullName email');

        if (fallbackHead) {
          head = fallbackHead as any;
          dept.headOfDepartment = fallbackHead._id as any;
          await Department.findByIdAndUpdate(dept._id, { headOfDepartment: fallbackHead._id });
        }
      }

      // Count ALL active members assigned to this department (staff + department_head)
      const staffCount = await User.countDocuments({
        departmentId: dept._id,
        role: { $in: ['staff', 'department_head'] },
        employmentStatus: { $ne: 'TERMINATED' }
      });

      const deptObj = dept.toObject();
      const positionsList = deptObj.positions || (deptObj as any).jobPositions || [];

      return {
        ...deptObj,
        positions: positionsList,
        jobPositions: positionsList,
        headOfDepartment: head,
        staffCount
      };
    }));

    return sendResponse(response, 200, true, 'Departments retrieved successfully.', departmentsWithStats);
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Something went wrong while fetching departments.');
  }
};

/**
 * GET /departments/:id
 * Returns a single department with head populated, staff count, and SLA metrics
 */
export const getDepartmentById = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;

    const department = await Department.findById(id)
      .populate('headOfDepartment', 'profile.fullName profile.profileImage profile.avatar email rank');

    if (!department) {
      return sendResponse(response, 404, false, 'Department not found.');
    }

    // Auto-sync: if headOfDepartment is null, check if there is a User assigned to this department with role department_head
    if (!department.headOfDepartment) {
      const fallbackHead = await User.findOne({
        departmentId: department._id,
        role: 'department_head' as any
      }).select('profile.fullName email rank');

      if (fallbackHead) {
        department.headOfDepartment = fallbackHead as any;
        await Department.findByIdAndUpdate(department._id, { headOfDepartment: fallbackHead._id });
      }
    }

    // Count ALL active members assigned to this department (staff + department_head)
    const staffCount = await User.countDocuments({ 
      departmentId: id, 
      role: { $in: ['staff', 'department_head'] },
      employmentStatus: { $ne: 'TERMINATED' }
    });

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);

    // Current period SLA metrics (last 30 days)
    const [currentMetrics] = await Complaint.aggregate([
      {
        $match: {
          departmentId: department._id,
          createdAt: { $gte: thirtyDaysAgo, $lte: now }
        }
      },
      {
        $group: {
          _id: null,
          totalResolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          slaOnTime: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$status', 'resolved'] }, { $lte: ['$resolvedAt', '$slaDeadline'] }] },
                1, 0
              ]
            }
          },
          slaBreached: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $and: [{ $eq: ['$status', 'resolved'] }, { $gt: ['$resolvedAt', '$slaDeadline'] }] },
                    { $and: [{ $ne: ['$status', 'resolved'] }, { $lt: ['$slaDeadline', now] }] }
                  ]
                },
                1, 0
              ]
            }
          },
          avgResolutionMs: {
            $avg: {
              $cond: [
                { $eq: ['$status', 'resolved'] },
                { $subtract: ['$resolvedAt', '$createdAt'] },
                null
              ]
            }
          }
        }
      }
    ]);

    const [prevMetrics] = await Complaint.aggregate([
      {
        $match: {
          departmentId: department._id,
          createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          totalResolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          slaOnTime: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$status', 'resolved'] }, { $lte: ['$resolvedAt', '$slaDeadline'] }] },
                1, 0
              ]
            }
          }
        }
      }
    ]);

    const currTotal = currentMetrics?.totalResolved ?? 0;
    const currOnTime = currentMetrics?.slaOnTime ?? 0;
    const currBreached = currentMetrics?.slaBreached ?? 0;
    const complianceRate = currTotal > 0 ? Number(((currOnTime / currTotal) * 100).toFixed(1)) : 0;
    const avgResolutionHours = currentMetrics?.avgResolutionMs
      ? Number((currentMetrics.avgResolutionMs / (1000 * 60 * 60)).toFixed(1))
      : 0;

    const prevTotal = prevMetrics?.totalResolved ?? 0;
    const prevOnTime = prevMetrics?.slaOnTime ?? 0;
    const prevCompliance = prevTotal > 0 ? (prevOnTime / prevTotal) * 100 : 0;
    const currCompliance = currTotal > 0 ? (currOnTime / currTotal) * 100 : 0;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (currCompliance > prevCompliance + 2) trend = 'up';
    else if (currCompliance < prevCompliance - 2) trend = 'down';

    const deptObj = department.toObject();
    const positionsList = deptObj.positions || (deptObj as any).jobPositions || [];

    return sendResponse(response, 200, true, 'Department details retrieved', {
      ...deptObj,
      positions: positionsList,
      jobPositions: positionsList,
      staffCount,
      slaMetrics: {
        complianceRate,
        totalResolved: currTotal,
        totalBreached: currBreached,
        avgResolutionHours,
        trend
      }
    });
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Failed to fetch department.');
  }
};

/**
 * GET /departments/:id/staff
 */
export const getDepartmentStaff = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    let { id } = request.params;

    // Strict Department Head security: can only view their own department's staff
    if (user.role === 'department_head') {
      if (!user.departmentId) {
        return sendResponse(response, 403, false, 'Department Head is not assigned to a department.');
      }
      if (id !== user.departmentId.toString()) {
        id = user.departmentId.toString();
      }
    }

    const { role } = request.query;

    // Fetch department to identify the assigned Department Head
    const targetDept = await Department.findById(id).select('headOfDepartment');
    const deptHeadId = targetDept?.headOfDepartment?.toString();

    const staffFilter: any = {
      departmentId: id,
      employmentStatus: { $ne: 'TERMINATED' }
    };

    if (user.role === 'department_head') {
      // Department Heads must NOT see themselves in their staff/team list
      staffFilter.role = 'staff';
      staffFilter._id = { $ne: user._id };
    } else {
      // Admin / Super Admin: Include both Department Head and Staff members
      if (role === 'staff') {
        staffFilter.role = 'staff';
        if (deptHeadId) {
          staffFilter._id = { $ne: deptHeadId };
        }
      } else {
        // Default for Admin / Super Admin is all department members (Staff + Head)
        staffFilter.role = { $in: ['staff', 'department_head'] };
      }
    }

    const staffList = await User.find(staffFilter).select('profile.fullName profile.profileImage profile.avatar profile.position email rank role accountStatus employmentStatus createdAt');

    if (staffList.length === 0) {
      return sendResponse(response, 200, true, 'No staff found for this department', []);
    }

    const staffIds = staffList.map(s => s._id);
    const now = new Date();

    // Fetch active shift assignments for all staff in this department
    const shiftAssignments = await require('../models/employeeShiftAssignment.model').EmployeeShiftAssignment.find({
      employeeId: { $in: staffIds },
      isActive: true
    }).populate('shiftId', 'name startTime endTime breakDurationMinutes isOvernight');

    // Build shift resolution per staff for today:
    // Prioritize active SPECIFIC_DATES covering today over ALL_DAYS
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const shiftMap = new Map();
    for (const empId of staffIds) {
      const empIdStr = empId.toString();
      const empAssignments = shiftAssignments.filter((sa: any) => sa.employeeId.toString() === empIdStr);

      // 1. Look for specific date assignment covering today
      const specific = empAssignments.find((sa: any) =>
        sa.scheduleType === 'SPECIFIC_DATES' &&
        new Date(sa.effectiveFrom) <= endOfToday &&
        sa.effectiveTo && new Date(sa.effectiveTo) >= startOfToday
      );

      if (specific && specific.shiftId) {
        shiftMap.set(empIdStr, {
          ...(specific.shiftId.toObject ? specific.shiftId.toObject() : specific.shiftId),
          scheduleType: 'SPECIFIC_DATES',
          effectiveFrom: specific.effectiveFrom,
          effectiveTo: specific.effectiveTo
        });
        continue;
      }

      // 2. Look for All Days assignment
      const allDays = empAssignments.find((sa: any) =>
        sa.scheduleType !== 'SPECIFIC_DATES' || sa.effectiveTo === null
      );

      if (allDays && allDays.shiftId) {
        shiftMap.set(empIdStr, {
          ...(allDays.shiftId.toObject ? allDays.shiftId.toObject() : allDays.shiftId),
          scheduleType: 'ALL_DAYS',
          effectiveFrom: allDays.effectiveFrom,
          effectiveTo: null
        });
      }
    }

    const statsAgg = await Complaint.aggregate([
      {
        $match: {
          $or: [
            { assignedStaffId: { $in: staffIds } },
            { primaryStaffId: { $in: staffIds } },
            { supportingStaffIds: { $in: staffIds } }
          ]
        }
      },
      {
        $project: {
          status: { $toLower: { $ifNull: ['$status', ''] } },
          slaDeadline: 1,
          resolvedAt: 1,
          updatedAt: 1,
          allStaff: {
            $setUnion: [
              { $cond: [{ $ifNull: ['$assignedStaffId', false] }, ['$assignedStaffId'], []] },
              { $cond: [{ $ifNull: ['$primaryStaffId', false] }, ['$primaryStaffId'], []] },
              { $cond: [{ $isArray: '$supportingStaffIds' }, '$supportingStaffIds', []] }
            ]
          }
        }
      },
      { $unwind: '$allStaff' },
      { $match: { allStaff: { $in: staffIds } } },
      {
        $group: {
          _id: '$allStaff',
          totalTasks: { $sum: 1 },
          assigned: {
            $sum: { $cond: [{ $in: ['$status', ['assigned', 'open']] }, 1, 0] }
          },
          inProgress: {
            $sum: { $cond: [{ $in: ['$status', ['in_progress', 'in-progress', 'under_verification']] }, 1, 0] }
          },
          pending: {
            $sum: { $cond: [{ $in: ['$status', ['pending', 'pending_assignment', 'submitted', 'on_hold']] }, 1, 0] }
          },
          done: {
            $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed', 'completed']] }, 1, 0] }
          },
          slaBreaches: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $and: [{ $in: ['$status', ['resolved', 'closed', 'completed']] }, { $gt: ['$resolvedAt', '$slaDeadline'] }] },
                    { $and: [{ $not: [{ $in: ['$status', ['resolved', 'closed', 'completed']] }] }, { $lt: ['$slaDeadline', now] }] }
                  ]
                },
                1, 0
              ]
            }
          },
          slaOnTime: {
            $sum: {
              $cond: [
                { $and: [{ $in: ['$status', ['resolved', 'closed', 'completed']] }, { $lte: ['$resolvedAt', '$slaDeadline'] }] },
                1, 0
              ]
            }
          },
          lastActivityAt: { $max: '$updatedAt' }
        }
      }
    ]);

    const statsMap = new Map(statsAgg.map((s: any) => [s._id.toString(), s]));

    const enriched = staffList.map(staff => {
      const s = statsMap.get(staff._id.toString());
      const total = s?.totalTasks ?? 0;
      const done = s?.done ?? 0;
      const assigned = s?.assigned ?? 0;
      const inProgress = s?.inProgress ?? 0;
      const pending = s?.pending ?? 0;
      const slaOnTime = s?.slaOnTime ?? 0;
      const slaBreaches = s?.slaBreaches ?? 0;

      // Real efficiency score calculation:
      // If done > 0, calculate based on on-time completion percentage (or done/total ratio)
      let efficiencyScore = 0;
      if (total > 0) {
        if (done > 0) {
          // Weighted metric: completion rate and on-time compliance
          const completionRate = (done / total) * 100;
          const onTimeRate = (slaOnTime / done) * 100;
          efficiencyScore = Math.round((completionRate * 0.5) + (onTimeRate * 0.5));
        } else if (inProgress > 0) {
          efficiencyScore = 50; // Active work ongoing
        }
      }

      const complianceRate = done > 0
        ? Number(((slaOnTime / done) * 100).toFixed(1))
        : 0;

      return {
        _id: staff._id,
        email: staff.email,
        rank: staff.rank,
        role: staff.role,
        accountStatus: staff.accountStatus,
        profile: staff.profile,
        createdAt: staff.createdAt,
        currentShift: shiftMap.get(staff._id.toString()) || null,
        stats: {
          total,
          assigned,
          inProgress,
          pending,
          done,
          assignedCount: assigned + inProgress,
          resolvedCount: done,
          slaBreaches,
          slaOnTime,
          complianceRate,
          efficiencyScore,
          lastActivityAt: s?.lastActivityAt ?? null
        }
      };
    });

    return sendResponse(response, 200, true, 'Department staff retrieved successfully.', enriched);
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Failed to fetch department staff.');
  }
};

/**
 * PATCH /departments/:id/assign-head
 * Supports assigning a staff member as head, or passing staffId: null / "remove" / "demote" to demote current head back to staff.
 */
export const assignHead = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const { staffId } = request.body;

    const department = await Department.findById(id);
    if (!department) {
      return sendResponse(response, 404, false, 'Department not found.');
    }

    // Demote current head back to staff if staffId is null, empty string, or 'remove'
    if (!staffId || staffId === 'remove' || staffId === 'demote') {
      const currentHeadId = department.headOfDepartment;
      if (!currentHeadId) {
        return sendResponse(response, 400, false, 'This department currently does not have an assigned head.');
      }

      const currentHead = await User.findById(currentHeadId);
      if (currentHead) {
        currentHead.role = 'staff';
        currentHead.rank = normalizeStaffRank(currentHead.previousRank);
        currentHead.previousRank = undefined;
        await currentHead.save();

        await NotificationService.send({
          userId: currentHead._id.toString(),
          type: 'admin_alert',
          title: 'Role Update',
          message: `You have been relieved of your Department Head duties for ${department.name} and reverted to staff.`
        });
      }

      department.headOfDepartment = undefined;
      await department.save();

      await ActivityLog.create({
        action: 'head_demoted',
        performedBy: request.user?._id,
        targetUser: currentHeadId,
        departmentId: department._id,
        oldValue: currentHeadId.toString(),
        newValue: 'none',
        meta: { departmentName: department.name, reason: 'Demoted from department head by admin' }
      });

      return sendResponse(
        response,
        200,
        true,
        `${currentHead?.profile?.fullName || currentHead?.email || 'Department head'} has been demoted back to regular staff.`
      );
    }

    const staff = await User.findById(staffId);
    if (!staff) {
      return sendResponse(response, 404, false, 'Staff member not found.');
    }

    if (department.approvalStatus !== 'approved' || !department.isActive) {
      return sendResponse(response, 400, false, 'Cannot assign Department Head: Department is not active or is pending Super Admin approval.');
    }

    if (staff.role !== 'staff' && staff.role !== 'department_head') {
      return sendResponse(response, 400, false, 'Only staff or department heads can be assigned as head.');
    }

    if (staff.departmentId?.toString() !== id) {
      return sendResponse(response, 400, false, 'Staff member must belong to this department to become head.');
    }

    const previousHeadId = department.headOfDepartment;

    // Update roles & rank for previous head if replacing
    if (previousHeadId && previousHeadId.toString() !== staff._id.toString()) {
      const prevHead = await User.findById(previousHeadId);
      if (prevHead) {
        prevHead.role = 'staff';
        prevHead.rank = normalizeStaffRank(prevHead.previousRank);
        prevHead.previousRank = undefined;
        await prevHead.save();
      }
    }

    if (staff.rank && staff.rank !== 'head') {
      staff.previousRank = staff.rank;
    } else if (!staff.previousRank) {
      staff.previousRank = 'senior';
    }
    staff.rank = 'head';
    staff.role = 'department_head';
    await staff.save();

    department.headOfDepartment = staff._id as any;
    await department.save();

    await NotificationService.send({
      userId: staff._id.toString(),
      type: 'admin_alert',
      title: 'Appointed Department Head',
      message: `Congratulations! You have been appointed as Department Head for ${department.name}.`
    });

    await ActivityLog.create({
      action: 'head_assigned',
      performedBy: request.user?._id,
      targetUser: staff._id,
      departmentId: department._id,
      oldValue: previousHeadId?.toString() || 'none',
      newValue: staff._id.toString(),
      meta: { departmentName: department.name }
    });

    return sendResponse(response, 200, true, `${staff.profile?.fullName || staff.email} has been assigned as department head.`);
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Failed to assign department head.');
  }
};

/**
 * PATCH /departments/:id
 */
export const updateDepartment = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    let { name, code, slaTargetHours, description, positions, categories, keywords, headId } = request.body;

    name = name?.trim();
    description = description?.trim();

    const department = await Department.findById(id);
    if (!department) {
      return sendResponse(response, 404, false, 'Department not found.');
    }

    const previousStatus = department.approvalStatus;

    if (name && name !== department.name) {
      if (name.length > 100) {
        return sendResponse(response, 400, false, 'Department name cannot exceed 100 characters.');
      }
      const conflict = await Department.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name}$`, 'i') }
      });
      if (conflict) {
        return sendResponse(response, 400, false, 'Another department with this name already exists.');
      }
      department.name = name;
    }

    if (code !== undefined) {
      const codeStr = String(code).trim().toUpperCase();
      if (codeStr.length > 10) {
        return sendResponse(response, 400, false, 'Department code cannot exceed 10 characters.');
      }
      department.code = codeStr || undefined;
    }

    if (slaTargetHours !== undefined) {
      const slaNum = Number(slaTargetHours);
      if (!Number.isFinite(slaNum) || slaNum <= 0 || slaNum > 720) {
        return sendResponse(response, 400, false, 'SLA must be between 1 and 720 hours.');
      }
      department.slaTargetHours = slaNum;
    }

    if (description !== undefined) {
      if (description.length > 300) {
        return sendResponse(response, 400, false, 'Description cannot exceed 300 characters.');
      }
      department.description = description;
    }

    if (positions !== undefined) {
      department.positions = Array.isArray(positions)
        ? positions.map((p: any) => String(p).trim()).filter(Boolean)
        : [];
    }

    const combinedKeywords = categories !== undefined ? categories : keywords;
    if (combinedKeywords !== undefined) {
      department.keywords = Array.isArray(combinedKeywords)
        ? combinedKeywords.map((k: any) => String(k).trim()).filter(Boolean)
        : [];
    }

    // Allow Super Admin to update approvalStatus directly, or reset rejected back to pending upon edit
    if (request.body.approvalStatus !== undefined) {
      if (request.user?.role === 'superadmin') {
        const newStatus = request.body.approvalStatus;
        if (['pending', 'approved', 'rejected'].includes(newStatus)) {
          department.approvalStatus = newStatus;
          if (newStatus === 'approved') {
            department.isActive = true;
            department.approvedBy = request.user?._id;
            department.approvedAt = new Date();
            department.rejectionReason = undefined;
          } else if (newStatus === 'rejected') {
            department.isActive = false;
            department.rejectionReason = request.body.rejectionReason || request.body.reason || undefined;
          } else if (newStatus === 'pending') {
            department.isActive = false;
            department.rejectionReason = undefined;
          }
        }
      } else if (department.approvalStatus === 'rejected' && request.body.resubmitForApproval) {
        // Admin re-submitting rejected department for approval
        department.approvalStatus = 'pending';
        department.isActive = false;
        department.rejectionReason = undefined;
      }
    } else if (department.approvalStatus === 'rejected' && request.user?.role === 'admin') {
      // Auto-re-enter pending queue if admin edits a rejected department
      department.approvalStatus = 'pending';
      department.isActive = false;
      department.rejectionReason = undefined;
    }

    // Block head assignment if department is not approved
    if (headId !== undefined && department.approvalStatus !== 'approved' && headId !== '' && headId !== null) {
      return sendResponse(response, 400, false, 'Cannot assign Department Head: Department is not active or is pending Super Admin approval.');
    }

    // Optional headId update
    if (headId !== undefined && department.approvalStatus === 'approved') {
      if (headId === '' || headId === null) {
        // Unassign head
        if (department.headOfDepartment) {
          const currentHead = await User.findById(department.headOfDepartment);
          if (currentHead) {
            currentHead.role = 'staff';
            currentHead.rank = normalizeStaffRank(currentHead.previousRank);
            currentHead.previousRank = undefined;
            await currentHead.save();
          }
          department.headOfDepartment = null as any;
        }
      } else {
        const staff = await User.findById(headId);
        if (staff && (staff.role === 'staff' || staff.role === 'department_head')) {
          const previousHeadId = department.headOfDepartment;
          if (previousHeadId && previousHeadId.toString() !== staff._id.toString()) {
            const prevHead = await User.findById(previousHeadId);
            if (prevHead) {
              prevHead.role = 'staff';
              prevHead.rank = normalizeStaffRank(prevHead.previousRank);
              prevHead.previousRank = undefined;
              await prevHead.save();
            }
          }
          if (staff.rank && staff.rank !== 'head') {
            staff.previousRank = staff.rank;
          } else if (!staff.previousRank) {
            staff.previousRank = 'senior';
          }
          staff.rank = 'head';
          staff.role = 'department_head';
          staff.departmentId = department._id as any;
          await staff.save();

          department.headOfDepartment = staff._id as any;
        }
      }
    }

    if (request.body.isActive !== undefined && department.approvalStatus === 'approved') {
      department.isActive = Boolean(request.body.isActive);
    }

    await department.save();

    await ActivityLog.create({
      action: 'department_updated',
      performedBy: request.user?._id,
      departmentId: department._id,
      meta: { updatedFields: Object.keys(request.body) }
    });

    // Notify Super Admins if an Admin edited/resubmitted a pending or previously rejected department
    if (request.user?.role === 'admin' && (previousStatus === 'pending' || previousStatus === 'rejected')) {
      try {
        const isResubmit = previousStatus === 'rejected';
        const notifTitle = isResubmit ? 'Department Resubmitted for Approval' : 'Department Request Updated';
        const notifMessage = `${department.name} was updated and is awaiting approval.`;

        const superAdmins = await User.find({ role: 'superadmin' }).select('_id');
        for (const sa of superAdmins) {
          await NotificationService.send({
            userId: sa._id,
            type: 'admin_alert',
            title: notifTitle,
            message: notifMessage,
            idempotencyKey: `notif_dept_upd_${department._id}_${Date.now()}_${sa._id}`
          });
        }
      } catch (notifErr: any) {
        console.error('[updateDepartment Notification Error]: Failed to alert superadmins:', notifErr?.message || notifErr);
      }
    }

    // Notify Admin when Super Admin Approves or Rejects a department request
    if (request.user?.role === 'superadmin' && (department.approvalStatus === 'approved' || department.approvalStatus === 'rejected') && previousStatus !== department.approvalStatus) {
      try {
        let recipientIds: any[] = [];
        if (department.createdBy) {
          recipientIds.push(department.createdBy);
        } else {
          const admins = await User.find({ role: 'admin' }).select('_id');
          recipientIds = admins.map(a => a._id);
        }

        const isApproved = department.approvalStatus === 'approved';
        const title = isApproved ? 'Department Request Approved' : 'Department Request Rejected';
        let message = isApproved
          ? `${department.name} has been approved and is now active.`
          : `Your request for ${department.name} was rejected.`;

        if (!isApproved && department.rejectionReason) {
          message += ` Reason: ${department.rejectionReason}`;
        }

        for (const recipientId of recipientIds) {
          await NotificationService.send({
            userId: recipientId,
            type: 'admin_alert',
            title,
            message,
            idempotencyKey: `notif_dept_${department.approvalStatus}_${department._id}_${Date.now()}_${recipientId}`
          });
        }
      } catch (adminNotifErr: any) {
        console.error('[updateDepartment Admin Notification Error]: Failed to alert admin:', adminNotifErr?.message || adminNotifErr);
      }
    }

    return sendResponse(response, 200, true, 'Department updated successfully.', department);
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Failed to update department.');
  }
};

/**
 * DELETE /departments/:id
 * Admin/Superadmin only.
 * Safely removes a department if it has no active staff and no open complaints.
 */
export const deleteDepartment = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;

    const department = await Department.findById(id);
    if (!department) {
      return sendResponse(response, 404, false, 'Department not found.');
    }

    // 1. Check for assigned staff members
    const staffCount = await User.countDocuments({
      departmentId: id,
      accountStatus: { $ne: 'suspended' }
    });
    if (staffCount > 0) {
      return sendResponse(
        response,
        400,
        false,
        `Cannot delete department: It currently has ${staffCount} staff member(s) assigned. Reassign or transfer them first, or archive this department instead.`
      );
    }

    // 2. Check for active/open complaints
    const openComplaintsCount = await Complaint.countDocuments({
      departmentId: id,
      status: { $nin: ['resolved', 'closed', 'cancelled'] }
    });
    if (openComplaintsCount > 0) {
      return sendResponse(
        response,
        400,
        false,
        `Cannot delete department: It has ${openComplaintsCount} active or open complaint(s). Resolve, transfer, or close them first, or archive this department instead.`
      );
    }

    // 3. Delete department
    await Department.findByIdAndDelete(id);

    // 4. Log activity
    await ActivityLog.create({
      action: 'department_deleted',
      performedBy: request.user?._id,
      meta: { departmentName: department.name, departmentId: id }
    });

    return sendResponse(response, 200, true, `Department "${department.name}" was deleted successfully.`);
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Failed to delete department.');
  }
};

/**
 * GET /departments/:id/recommend-staff
 */
export const recommendStaff = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    let { id } = request.params;

    // Strict Department Head security: can only query recommendation for their own department
    if (user.role === 'department_head') {
      if (!user.departmentId) {
        return sendResponse(response, 403, false, 'Department Head is not assigned to a department.');
      }
      if (id !== user.departmentId.toString()) {
        id = user.departmentId.toString();
      }
    }

    const staffAgg = await User.aggregate([
      {
        $match: {
          departmentId: new mongoose.Types.ObjectId(id as string),
          role: 'staff',
          accountStatus: 'active',
          employmentStatus: { $nin: ['SUSPENDED', 'TERMINATED'] }
        }
      },
      {
        $lookup: {
          from: 'complaints',
          localField: '_id',
          foreignField: 'assignedStaffId',
          as: 'ticketHistory'
        }
      },
      {
        $addFields: {
          activeComplaints: {
            $size: {
              $filter: {
                input: '$ticketHistory',
                cond: { $in: ['$$this.status', ['assigned', 'in_progress']] }
              }
            }
          },
          resolvedTotal: {
            $size: {
              $filter: {
                input: '$ticketHistory',
                cond: { $in: ['$$this.status', ['resolved', 'closed']] }
              }
            }
          },
          resolvedOnTime: {
            $size: {
              $filter: {
                input: '$ticketHistory',
                cond: {
                  $and: [
                    { $in: ['$$this.status', ['resolved', 'closed']] },
                    { $lte: ['$$this.resolvedAt', '$$this.slaDeadline'] }
                  ]
                }
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          profile: 1,
          email: 1,
          activeComplaints: 1,
          resolvedTotal: 1,
          resolvedOnTime: 1
        }
      }
    ]);

    const rankedStaff = staffAgg.map(staff => {
      let score_W = 0;
      let score_SLA = 0;
      let score_A = 0;

      if (staff.activeComplaints >= 10) {
        score_W = -50;
      } else {
        score_W = Math.max(0, 40 - (Math.pow(staff.activeComplaints, 1.3) * 3));
      }

      if (staff.resolvedTotal === 0) {
        score_SLA = 25;
      } else {
        score_SLA = (staff.resolvedOnTime / staff.resolvedTotal) * 40;
      }

      if (staff.activeComplaints === 0) {
        score_A = 20;
      } else if (staff.activeComplaints < 3) {
        score_A = 15;
      } else {
        score_A = 5;
      }

      const matchScore = Number((score_W + score_SLA + score_A).toFixed(1));
      const slaComplianceRate = staff.resolvedTotal > 0 ? Number(((staff.resolvedOnTime / staff.resolvedTotal) * 100).toFixed(1)) : 0;

      return {
        staffId: staff._id,
        fullName: staff.profile?.fullName || 'Unknown Unit',
        email: staff.email,
        metrics: {
          activeComplaints: staff.activeComplaints,
          slaComplianceRate,
          matchScore
        }
      };
    });

    rankedStaff.sort((a, b) => {
      if (b.metrics.matchScore !== a.metrics.matchScore) return b.metrics.matchScore - a.metrics.matchScore;
      if (b.metrics.slaComplianceRate !== a.metrics.slaComplianceRate) return b.metrics.slaComplianceRate - a.metrics.slaComplianceRate;
      return a.metrics.activeComplaints - b.metrics.activeComplaints;
    });

    const topRecommendations = rankedStaff.slice(0, 3);

    return sendResponse(response, 200, true, 'Staff recommendations retrieved successfully.', topRecommendations);
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Server Exception ranking operators');
  }
};

/**
 * Retrieve specialized dashboard metrics for the Department Head
 * Strict role and boundary constraints applied.
 */
export const getDepartmentHeadDashboard = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;

    if (!user.departmentId) {
      return sendResponse(response, 403, false, 'User is not assigned to a valid department footprint.');
    }

    const deptId = user.departmentId;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // Parallel optimized query execution avoiding N+1 blocks
    const [unassigned, inProgress, resolvedToday, slaAtRisk, recentComplaints] = await Promise.all([
      Complaint.countDocuments({ departmentId: deptId, status: 'pending_assignment' }),
      Complaint.countDocuments({ departmentId: deptId, status: 'in_progress' }),
      Complaint.countDocuments({ departmentId: deptId, status: 'resolved', resolvedAt: { $gte: startOfToday } }),
      Complaint.countDocuments({
        departmentId: deptId,
        status: { $nin: ['resolved', 'closed'] }, // Safe logic matching requirement logic
        slaDeadline: { $lte: twoHoursFromNow }
      }),
      Complaint.find({ departmentId: deptId })
        .select('_id title status priority slaDeadline assignedStaffId departmentId createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
    ]);

    const dashboardData = {
      stats: {
        unassigned,
        inProgress,
        resolvedToday,
        slaAtRisk
      },
      recentComplaints
    };

    return sendResponse(response, 200, true, 'Department Head Dashboard retrieved successfully', dashboardData);
  } catch (error) {
    console.error('[getDepartmentHeadDashboard] Error:', error);
    return sendResponse(response, 500, false, 'Server error extracting dashboard metadata');
  }
};
