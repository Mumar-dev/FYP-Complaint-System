import { Response } from 'express';
import { Shift } from '../models/shift.model';
import { EmployeeShiftAssignment } from '../models/employeeShiftAssignment.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendResponse } from '../utils/response';
import { AuditService } from '../services/audit.service';

/**
 * POST /api/shifts - Create shift
 */
export const createShift = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const {
      name,
      startTime,
      endTime,
      breakDurationMinutes = 60,
      gracePeriodMinutes = 15,
      workingDays = [1, 2, 3, 4, 5],
      isOvernight = false,
      overtimeThresholdHours = 8,
      departmentId
    } = request.body;

    if (!name || !startTime || !endTime) {
      return sendResponse(response, 400, false, 'Name, start time, and end time are required.');
    }

    const shift = await Shift.create({
      name,
      startTime,
      endTime,
      breakDurationMinutes,
      gracePeriodMinutes,
      workingDays,
      isOvernight,
      overtimeThresholdHours,
      departmentId,
      createdBy: user._id
    });

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'SHIFT_CREATED',
      entityType: 'Shift',
      entityId: shift._id,
      previousValue: null,
      newValue: { name, startTime, endTime },
      reason: 'Created new shift'
    });

    return sendResponse(response, 201, true, 'Shift created successfully', shift);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error creating shift');
  }
};

/**
 * GET /api/shifts - List active shifts
 */
export const getShifts = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const shifts = await Shift.find({ isActive: true })
      .populate('departmentId', 'name')
      .sort({ createdAt: -1 });

    return sendResponse(response, 200, true, 'Shifts retrieved', shifts);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error fetching shifts');
  }
};

/**
 * DELETE /api/shifts/:id - Delete shift (soft delete or hard delete if unused)
 */
export const deleteShift = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const user = request.user!;

    const shift = await Shift.findById(id);
    if (!shift) {
      return sendResponse(response, 404, false, 'Shift not found.');
    }

    // Soft delete shift
    shift.isActive = false;
    await shift.save();

    // Deactivate active shift assignments for this shift
    await EmployeeShiftAssignment.updateMany(
      { shiftId: shift._id, isActive: true },
      { isActive: false, effectiveTo: new Date() }
    );

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'SHIFT_DELETED',
      entityType: 'Shift',
      entityId: shift._id,
      previousValue: { name: shift.name, isActive: true },
      newValue: { isActive: false },
      reason: 'Shift deleted by admin'
    });

    return sendResponse(response, 200, true, `Shift "${shift.name}" deleted successfully.`);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error deleting shift.');
  }
};

/**
 * POST /api/shifts/assignments - Assign shift to employee (All Days or Specific Calendar Dates)
 */
export const assignShiftToEmployee = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const {
      employeeId,
      shiftId,
      scheduleType = 'ALL_DAYS',
      effectiveFrom = new Date(),
      effectiveTo = null
    } = request.body;

    if (!employeeId || !shiftId) {
      return sendResponse(response, 400, false, 'employeeId and shiftId are required.');
    }

    // If Department Head, ensure employee belongs to their department
    if (user.role === 'department_head') {
      const targetEmp = await require('../models/user.model').User.findById(employeeId);
      if (!targetEmp || !targetEmp.departmentId || targetEmp.departmentId.toString() !== user.departmentId?.toString()) {
        return sendResponse(response, 403, false, 'You can only assign shifts to staff members within your department.');
      }
    }

    // Verify shift exists
    const shift = await Shift.findById(shiftId);
    if (!shift || !shift.isActive) {
      return sendResponse(response, 404, false, 'Selected shift not found or inactive.');
    }

    const isSpecificDates = scheduleType === 'SPECIFIC_DATES';
    const parsedFrom = new Date(effectiveFrom);
    parsedFrom.setHours(0, 0, 0, 0);

    let parsedTo: Date | null = null;
    if (isSpecificDates && effectiveTo) {
      parsedTo = new Date(effectiveTo);
      parsedTo.setHours(23, 59, 59, 999);
    }

    // Clean deactivation logic:
    // If assigning ALL_DAYS (permanent), deactivate any prior ALL_DAYS assignments
    // If assigning SPECIFIC_DATES, deactivate any overlapping active specific-date assignments for the same date window
    if (!isSpecificDates) {
      await EmployeeShiftAssignment.updateMany(
        { employeeId, isActive: true, scheduleType: 'ALL_DAYS' },
        { isActive: false, effectiveTo: new Date() }
      );
    } else if (parsedTo) {
      await EmployeeShiftAssignment.updateMany(
        {
          employeeId,
          isActive: true,
          scheduleType: 'SPECIFIC_DATES',
          effectiveFrom: { $lte: parsedTo },
          effectiveTo: { $gte: parsedFrom }
        },
        { isActive: false }
      );
    }

    const assignment = await EmployeeShiftAssignment.create({
      employeeId,
      shiftId,
      assignedBy: user._id,
      scheduleType: isSpecificDates ? 'SPECIFIC_DATES' : 'ALL_DAYS',
      effectiveFrom: parsedFrom,
      effectiveTo: parsedTo,
      isActive: true
    });

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'SHIFT_ASSIGNED',
      entityType: 'Shift',
      entityId: shiftId,
      previousValue: null,
      newValue: { employeeId, shiftId, scheduleType, effectiveFrom: parsedFrom, effectiveTo: parsedTo },
      reason: 'Shift assigned to employee'
    });

    return sendResponse(response, 201, true, 'Shift assigned to employee successfully', assignment);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error assigning shift');
  }
};

