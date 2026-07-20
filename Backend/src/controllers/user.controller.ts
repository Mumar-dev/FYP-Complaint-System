import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';
import { Department } from '../models/department.model';
import { ActivityLog } from '../models/activityLog.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendEmail } from '../utils/email';
import { sendResponse } from '../utils/response';
import { normalizeStaffRank } from '../utils/rank.util';

const normalizeCnic = (value: string): string => value.replace(/\D/g, '');

/**
 * GET /users/:id
 * Fetch a single user by ID with populated relationships
 */
export const getUserById = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;

    const user = await User.findById(id)
      .select('-password')
      .populate('departmentId', 'name')
      .lean();

    if (!user) {
      return sendResponse(response, 404, false, 'User not found.');
    }

    // Format response with consistent field names
    const formattedUser = {
      _id: user._id,
      email: user.email,
      name: user.profile?.fullName || user.email,
      profile: user.profile,
      role: user.role,
      departmentId: user.departmentId,
      rank: user.rank,
      accountStatus: user.accountStatus,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    return sendResponse(response, 200, true, 'User retrieved successfully', formattedUser);
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Server error');
  }
};

export const createStaff = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { fullName, email, password, phone, cnic, departmentId, rank, post } = request.body;
    const user = request.user!;

    // Restrict staff creation to Admin & Superadmin only
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return sendResponse(response, 403, false, 'Only administrators can create staff accounts.');
    }

    console.log('[createStaff] Payload received:', { email, departmentId, role: user.role });

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendResponse(response, 400, false, 'Email is already taken.');
    }

    if (departmentId) {
      const targetDept = await Department.findById(departmentId);
      if (!targetDept) {
        return sendResponse(response, 400, false, 'Selected department does not exist.');
      }
      if (targetDept.approvalStatus !== 'approved' || !targetDept.isActive) {
        return sendResponse(response, 400, false, 'Department is not active or is pending Super Admin approval.');
      }
    }

    let finalCnic = undefined;
    if (cnic && cnic.trim() !== '') {
      finalCnic = normalizeCnic(cnic);
      if (finalCnic.length !== 13) {
        return sendResponse(response, 400, false, 'CNIC must contain exactly 13 digits.');
      }

      const existingCnic = await User.findOne({
        'profile.cnic': new RegExp(finalCnic.split('').join('[^0-9]*'))
      });
      if (existingCnic) {
        console.log('[CNIC Check] Failed! Searching for:', finalCnic, 'Found user ID:', existingCnic._id, 'with cnic:', existingCnic.profile.cnic);
        return sendResponse(response, 400, false, 'CNIC already exists in the system.');
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      email,
      password: hashedPassword,
      role: 'staff',
      rank: rank || 'junior',
      accountStatus: 'active',
      employmentStatus: 'ACTIVE',
      departmentId: departmentId || null,
      profile: {
        fullName,
        phone,
        cnic: finalCnic,
        position: post
      }
    });

    console.log('[createStaff] New user created with departmentId:', newUser.departmentId);

    await ActivityLog.create({
      action: 'staff_created',
      performedBy: user._id,
      targetUser: newUser._id,
      departmentId: departmentId || undefined,
      meta: {
        departmentAssigned: !!departmentId,
        rank: rank || 'junior'
      }
    });

    const loginUrl = process.env.CLIENT_URL ? `${process.env.CLIENT_URL}/login` : 'http://localhost:5173/login';

    let emailSent = false;
    try {
      await sendEmail({
        to: email,
        subject: "Welcome to CMS — Your Staff Account Details",
        message: `Hello ${fullName},

Welcome to the Complaint Management System team! Your staff account has been created by the administration.

Here are your account credentials:
  Role / Rank:        ${rank === 'senior' ? 'Senior Staff' : 'Junior Staff'}
  Position:           ${post || 'Staff Member'}
  Login Email:        ${email}
  Temporary Password: ${password}

Login URL: ${loginUrl}

IMPORTANT: Please log in using the credentials above and change your password in your Settings to secure your account.

If you have any questions, please contact the administration team.

Best regards,
Administration Team`
      });
      emailSent = true;
      console.log(`[createStaff] Welcome email delivered successfully to ${email}`);
    } catch (emailErr: any) {
      console.error(`[createStaff Email Error]: Failed to send onboarding email to ${email}:`, emailErr?.message || emailErr);
      console.log('[MAIL FALLBACK] Staff credentials logged below for manual distribution:');
      console.log(`  Email: ${email} | Temporary Password: ${password}`);
    }

    const userPayload = newUser.toObject();
    delete userPayload.password;

    return sendResponse(response, 201, true, 'Staff member created successfully.', {
      ...userPayload,
      emailSent
    });
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Server error');
  }
};

export const assignStaffDepartment = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const { departmentId, userIds, reason } = request.body;
    const user = request.user!;

    // Resolve list of target user IDs (supports both bulk userIds: string[] and single :id parameter)
    const targetIds: string[] = [];
    if (Array.isArray(userIds) && userIds.length > 0) {
      targetIds.push(...userIds.map((uid: any) => String(uid).trim()).filter(Boolean));
    } else if (id) {
      targetIds.push(String(id).trim());
    }

    if (targetIds.length === 0) {
      return sendResponse(response, 400, false, 'No staff member IDs provided.');
    }

    if (!departmentId) {
      return sendResponse(response, 400, false, 'Target departmentId is required.');
    }

    // Department head can only assign to their own department
    if (user.role === 'department_head' && user.departmentId?.toString() !== departmentId) {
      return sendResponse(response, 403, false, 'You can only assign staff to your own department.');
    }

    const targetDept = await Department.findById(departmentId);
    if (!targetDept) {
      return sendResponse(response, 404, false, 'Target department not found.');
    }

    if (targetDept.approvalStatus !== 'approved' || !targetDept.isActive) {
      return sendResponse(response, 400, false, 'Department is not active or is pending Super Admin approval.');
    }

    const targetPositions = targetDept.positions || [];
    const updatedUsers: any[] = [];

    for (const uid of targetIds) {
      const staffMember = await User.findById(uid);
      if (!staffMember) continue;
      if (staffMember.role !== 'staff' && staffMember.role !== 'department_head') continue;

      if (staffMember.employmentStatus === 'SUSPENDED') {
        return sendResponse(response, 400, false, `Cannot assign or transfer suspended staff member (${staffMember.profile?.fullName || staffMember.email}) to a department.`);
      }
      if (staffMember.employmentStatus === 'TERMINATED') {
        return sendResponse(response, 400, false, `Cannot assign or transfer terminated staff member (${staffMember.profile?.fullName || staffMember.email}) to a department.`);
      }

      const previousDeptId = staffMember.departmentId;
      const wasHead = staffMember.role === 'department_head';

      // 1. If user was head of their previous department, clear headOfDepartment on that department
      if (previousDeptId) {
        await Department.updateMany(
          { _id: previousDeptId, headOfDepartment: staffMember._id },
          { $set: { headOfDepartment: null } }
        );
      }
      // Also clear any other department pointing to them as head
      await Department.updateMany(
        { headOfDepartment: staffMember._id },
        { $set: { headOfDepartment: null } }
      );

      // 2. Clear / reset position if old position does not exist in target department positions
      const currentPosition = staffMember.profile?.position || staffMember.designation;
      let newPosition = currentPosition;
      if (targetPositions.length > 0 && currentPosition && !targetPositions.includes(currentPosition)) {
        newPosition = undefined;
      }

      // 3. Update staff member's department, role, and position
      staffMember.departmentId = targetDept._id as any;
      if (wasHead || staffMember.role === 'department_head' || staffMember.rank === 'head') {
        staffMember.role = 'staff'; // Transferred heads become regular staff in the new department
        staffMember.rank = normalizeStaffRank(staffMember.previousRank); // Cleanly revert head rank to previous rank (fallback to junior)
        staffMember.previousRank = undefined;
      }
      // Note: for existing normal staff, staffMember.rank is preserved as-is
      if (!staffMember.profile) {
        staffMember.profile = {} as any;
      }
      staffMember.profile.position = newPosition;
      staffMember.designation = newPosition;
      await staffMember.save();

      // 4. Record in EmploymentHistory if transfer
      if (previousDeptId && previousDeptId.toString() !== targetDept._id.toString()) {
        try {
          const { EmploymentHistory } = await import('../models/employmentHistory.model');
          await EmploymentHistory.create({
            employeeId: staffMember._id,
            previousDepartmentId: previousDeptId,
            newDepartmentId: targetDept._id,
            previousDesignation: currentPosition || 'Staff',
            newDesignation: newPosition || 'Staff',
            changeType: 'department_transfer',
            reason: reason || 'Department reassignment by admin',
            changedBy: user._id,
            effectiveDate: new Date()
          });
        } catch (ehErr: any) {
          console.warn('⚠️ Could not log EmploymentHistory:', ehErr?.message);
        }
      }

      // 5. Activity Log
      await ActivityLog.create({
        action: previousDeptId ? 'staff_transferred' : 'staff_assigned',
        performedBy: user._id,
        targetUser: staffMember._id,
        departmentId: targetDept._id,
        meta: {
          fromDepartment: previousDeptId,
          toDepartment: targetDept._id,
          targetDepartmentName: targetDept.name,
          staffName: staffMember.profile?.fullName || staffMember.email
        }
      });

      updatedUsers.push(staffMember);
    }

    return sendResponse(
      response,
      200,
      true,
      `Successfully processed ${updatedUsers.length} staff member(s).`,
      { count: updatedUsers.length }
    );
  } catch (error) {
    const err = error as Error;
    console.error('❌ [Staff Assignment] Error:', err.message);
    return sendResponse(response, 500, false, err.message || 'Server error tracking assignment.');
  }
};

/**
 * GET /users/staff
 * Returns staff list. Supports:
 *   ?unassigned=true  → staff with no department
 *   ?departmentId=xxx → staff in a specific department (for transfer modal)
 */
export const getStaffMembers = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { unassigned, departmentId } = request.query;

    const filter: any = {
      role: 'staff',
      employmentStatus: { $ne: 'TERMINATED' }
    };

    if (user.role === 'department_head') {
      // Department Head can strictly only view staff inside their own department footprint
      if (!user.departmentId) {
        return sendResponse(response, 200, true, 'Staff members retrieved', []);
      }
      filter.departmentId = user.departmentId;
    } else if (unassigned === 'true') {
      // Unassigned pool — no department and not suspended
      filter.$or = [{ departmentId: null }, { departmentId: { $exists: false } }];
      filter.employmentStatus = { $nin: ['SUSPENDED', 'TERMINATED'] };
    } else if (departmentId) {
      filter.departmentId = departmentId;
    }

    const staff = await User.find(filter)
      .select('profile.fullName profile.profileImage profile.avatar profile.position email rank accountStatus employmentStatus departmentId createdAt')
      .populate('departmentId', 'name');

    const formattedStaff = staff.map(s => ({
      _id: s._id,
      name: s.profile?.fullName || s.email,
      email: s.email,
      rank: s.rank,
      accountStatus: s.accountStatus,
      employmentStatus: s.employmentStatus,
      departmentId: s.departmentId,
      profile: s.profile,
      profileImage: s.profile?.profileImage || (s.profile as any)?.avatar,
      createdAt: s.createdAt
    }));

    return sendResponse(response, 200, true, 'Staff members retrieved', formattedStaff);
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Server error');
  }
};

/**
 * PATCH /users/:id/promote
 * Progression tiers: junior → senior → team_lead → supervisor
 * Backwards compatibility: 'lead' is treated as 'team_lead', 'standard' as 'junior'
 * Also accepts optional targetRank and position/designation in request.body
 */
export const promoteStaff = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const { targetRank, position, designation } = request.body || {};

    const user = await User.findById(id);
    if (!user) {
      return sendResponse(response, 404, false, 'Staff member not found.');
    }

    if (user.role !== 'staff' && user.role !== 'department_head') {
      return sendResponse(response, 400, false, 'Promotion is only applicable to staff members.');
    }

    // Normalized 4-step progression: Junior -> Senior -> Team Lead -> Supervisor
    const rankTiers = ['junior', 'senior', 'team_lead', 'supervisor'];
    const rankProgression: Record<string, string> = {
      junior: 'senior',
      standard: 'senior', // Backwards compatibility mapping
      senior: 'team_lead',
      lead: 'supervisor',
      team_lead: 'supervisor',
    };

    let rawCurrent: string = (user.rank as string) || 'junior';
    if (rawCurrent === 'lead') rawCurrent = 'team_lead';
    if (rawCurrent === 'standard') rawCurrent = 'junior';

    let nextRank: string | undefined;

    if (targetRank) {
      const normalizedTarget = targetRank === 'lead' ? 'team_lead' : targetRank;
      if (!rankTiers.includes(normalizedTarget)) {
        return sendResponse(response, 400, false, `Invalid rank. Allowed ranks: ${rankTiers.join(', ')}.`);
      }
      nextRank = normalizedTarget;
    } else {
      nextRank = rankProgression[rawCurrent];
    }

    if (!nextRank || rawCurrent === 'supervisor') {
      return sendResponse(response, 400, false, 'This staff member is already at the highest rank (Supervisor).');
    }

    const oldRank = user.rank || 'junior';
    user.rank = nextRank as any;

    const newPosition = position || designation;
    if (newPosition) {
      if (!user.profile) user.profile = {} as any;
      user.profile.position = newPosition;
      user.designation = newPosition;
    }

    await user.save();

    await ActivityLog.create({
      action: 'staff_promoted',
      performedBy: request.user?._id,
      targetUser: user._id,
      departmentId: user.departmentId as any,
      oldValue: oldRank,
      newValue: nextRank,
      meta: {
        staffName: user.profile?.fullName,
        position: newPosition || user.profile?.position
      }
    });

    const rankDisplayNames: Record<string, string> = {
      junior: 'Junior',
      senior: 'Senior',
      team_lead: 'Team Lead',
      supervisor: 'Supervisor'
    };

    const nextDisplay = rankDisplayNames[nextRank] || nextRank;
    const oldDisplay = rankDisplayNames[oldRank] || oldRank;

    return sendResponse(
      response,
      200,
      true,
      `${user.profile?.fullName || user.email} has been promoted from ${oldDisplay} to ${nextDisplay}.`,
      { newRank: nextRank, position: user.profile?.position }
    );
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Failed to promote staff member.');
  }
};

/**
 * PATCH /users/:id/demote
 * Progression tiers: supervisor → team_lead → senior → junior
 * Accepts optional targetRank and position/designation in request.body
 */
export const demoteStaff = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const { targetRank, position, designation } = request.body || {};

    const user = await User.findById(id);
    if (!user) {
      return sendResponse(response, 404, false, 'Staff member not found.');
    }

    if (user.role !== 'staff' && user.role !== 'department_head') {
      return sendResponse(response, 400, false, 'Demotion is only applicable to staff members.');
    }

    const rankTiers = ['junior', 'senior', 'team_lead', 'supervisor'];
    const rankDemotion: Record<string, string> = {
      supervisor: 'team_lead',
      lead: 'senior',
      team_lead: 'senior',
      senior: 'junior'
    };

    let rawCurrent: string = (user.rank as string) || 'junior';
    if (rawCurrent === 'lead') rawCurrent = 'team_lead';
    if (rawCurrent === 'standard') rawCurrent = 'junior';

    let prevRank: string | undefined;

    if (targetRank) {
      const normalizedTarget = targetRank === 'lead' ? 'team_lead' : targetRank;
      if (!rankTiers.includes(normalizedTarget)) {
        return sendResponse(response, 400, false, `Invalid rank. Allowed ranks: ${rankTiers.join(', ')}.`);
      }
      prevRank = normalizedTarget;
    } else {
      prevRank = rankDemotion[rawCurrent];
    }

    if (!prevRank || rawCurrent === 'junior') {
      return sendResponse(response, 400, false, 'This staff member is already at the lowest rank (Junior).');
    }

    const oldRank = user.rank || 'junior';
    user.rank = prevRank as any;

    const newPosition = position || designation;
    if (newPosition) {
      if (!user.profile) user.profile = {} as any;
      user.profile.position = newPosition;
      user.designation = newPosition;
    }

    await user.save();

    await ActivityLog.create({
      action: 'staff_demoted',
      performedBy: request.user?._id,
      targetUser: user._id,
      departmentId: user.departmentId as any,
      oldValue: oldRank,
      newValue: prevRank,
      meta: {
        staffName: user.profile?.fullName,
        position: newPosition || user.profile?.position
      }
    });

    const rankDisplayNames: Record<string, string> = {
      junior: 'Junior',
      senior: 'Senior',
      team_lead: 'Team Lead',
      supervisor: 'Supervisor'
    };

    const prevDisplay = rankDisplayNames[prevRank] || prevRank;
    const oldDisplay = rankDisplayNames[oldRank] || oldRank;

    return sendResponse(
      response,
      200,
      true,
      `${user.profile?.fullName || user.email} has been demoted from ${oldDisplay} to ${prevDisplay}.`,
      { newRank: prevRank, position: user.profile?.position }
    );
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Failed to demote staff member.');
  }
};

/**
 * PATCH /users/:id/remove-department
 * Sets departmentId to null, effectively unassigning staff / department head from their department.
 * If the user is currently the department head, automatically clears department.headOfDepartment.
 */
export const removeStaffFromDepartment = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;

    const user = await User.findById(id);
    if (!user) {
      return sendResponse(response, 404, false, 'Staff member not found.');
    }

    if (user.role !== 'staff' && user.role !== 'department_head') {
      return sendResponse(response, 400, false, 'Only staff members or department heads can be removed from a department.');
    }

    if (!user.departmentId) {
      return sendResponse(response, 400, false, 'This staff member is not assigned to any department.');
    }

    const { Department } = await import('../models/department.model');
    // If this user is the current department head, clear headOfDepartment on the department
    await Department.updateMany(
      { headOfDepartment: user._id },
      { $set: { headOfDepartment: null } }
    );

    const oldDepartmentId = user.departmentId;
    user.departmentId = undefined;
    if (user.role === 'department_head' || user.rank === 'head') {
      user.role = 'staff';
      user.rank = normalizeStaffRank(user.previousRank);
      user.previousRank = undefined;
    }
    await user.save();

    await ActivityLog.create({
      action: 'staff_removed_from_department',
      performedBy: request.user?._id,
      targetUser: user._id,
      departmentId: oldDepartmentId as any,
      meta: { staffName: user.profile?.fullName, previousRole: user.role }
    });

    return sendResponse(response, 200, true, `${user.profile?.fullName || user.email} has been removed from their department.`);
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Failed to remove staff from department.');
  }
};

/**
 * PATCH /users/:id/make-head
 * Promotes a staff member directly to department_head role.
 * Their password remains identical, login simply routes them dynamically.
 */
export const makeDepartmentHead = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;

    const user = await User.findById(id);
    if (!user) {
      return sendResponse(response, 404, false, 'User not found.');
    }

    if (user.role === 'department_head') {
      return sendResponse(response, 400, false, 'User is already a department head.');
    }

    if (user.role !== 'staff') {
      return sendResponse(response, 400, false, 'Only staff members can be promoted to department head.');
    }

    user.role = 'department_head';
    await user.save();

    await ActivityLog.create({
      action: 'role_updated_to_head',
      performedBy: request.user?._id,
      targetUser: user._id,
      departmentId: user.departmentId as any,
      meta: { staffName: user.profile?.fullName }
    });

    return sendResponse(response, 200, true, `${user.profile?.fullName || user.email} has been successfully promoted to Department Head.`);
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Failed to promote staff to department head.');
  }
};

/**
 * PATCH /users/:id
 * General endpoint to update a user's details (e.g. name, phone).
 */
export const updateUser = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const updateData = request.body;

    // Use findByIdAndUpdate to directly support dot-notation like 'profile.fullName'
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return sendResponse(response, 404, false, 'User not found.');
    }

    return sendResponse(response, 200, true, 'User profile updated successfully.', updatedUser);
  } catch (error) {
    const err = error as Error;
    return sendResponse(response, 500, false, err.message || 'Failed to update user.');
  }
};
