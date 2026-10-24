import { Types } from 'mongoose';
import { EmployeeShiftAssignment, IEmployeeShiftAssignment } from '../models/employeeShiftAssignment.model';
import { Shift, IShift } from '../models/shift.model';

export interface ResolvedShiftInfo {
  assignment: IEmployeeShiftAssignment | null;
  shift: IShift | null;
  scheduleType: 'ALL_DAYS' | 'SPECIFIC_DATES' | 'DEFAULT';
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
}

/**
 * Resolves an employee's active shift for a given target date.
 * Logic:
 * 1. Checks active SPECIFIC_DATES assignment where effectiveFrom <= targetDate <= effectiveTo.
 * 2. If none, checks active ALL_DAYS assignment (effectiveTo is null, effectiveFrom <= targetDate).
 * 3. If none, falls back to active General Shift or default.
 */
export const resolveEmployeeShiftForDate = async (
  employeeId: Types.ObjectId | string,
  targetDate: Date = new Date()
): Promise<ResolvedShiftInfo> => {
  // Normalize targetDate to beginning and end of the local day
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Check for specific date assignment covering targetDate
  const specificAssignment = await EmployeeShiftAssignment.findOne({
    employeeId,
    isActive: true,
    effectiveFrom: { $lte: endOfDay },
    $and: [
      { effectiveTo: { $ne: null } },
      { effectiveTo: { $gte: startOfDay } }
    ]
  })
    .sort({ createdAt: -1 })
    .populate('shiftId');

  if (specificAssignment && specificAssignment.shiftId) {
    return {
      assignment: specificAssignment,
      shift: specificAssignment.shiftId as any,
      scheduleType: 'SPECIFIC_DATES',
      effectiveFrom: specificAssignment.effectiveFrom,
      effectiveTo: specificAssignment.effectiveTo
    };
  }

  // 2. Check for All Days / Ongoing assignment
  const allDaysAssignment = await EmployeeShiftAssignment.findOne({
    employeeId,
    isActive: true,
    effectiveTo: null,
    effectiveFrom: { $lte: endOfDay }
  })
    .sort({ createdAt: -1 })
    .populate('shiftId');

  if (allDaysAssignment && allDaysAssignment.shiftId) {
    return {
      assignment: allDaysAssignment,
      shift: allDaysAssignment.shiftId as any,
      scheduleType: 'ALL_DAYS',
      effectiveFrom: allDaysAssignment.effectiveFrom,
      effectiveTo: null
    };
  }

  // 3. Fallback: Query default General shift from database
  const generalShift = await Shift.findOne({
    isActive: true,
    $or: [{ code: 'GENERAL' }, { name: /general/i }]
  }) || await Shift.findOne({ isActive: true });

  return {
    assignment: null,
    shift: generalShift,
    scheduleType: 'DEFAULT'
  };
};

/**
 * Validates whether the current PKT time is within the allowed check-in window
 * for the given shift.
 * - Early buffer: 30 minutes before shift startTime.
 * - Standard shifts (e.g. 09:00 - 17:00): window is [startTime - 30min, endTime].
 * - Overnight shifts (e.g. 16:00 - 00:00 or 20:00 - 06:00): handled cleanly across midnight.
 */
export const isWithinCheckInWindow = (
  shift: IShift,
  now: Date = new Date(),
  earlyBufferMinutes: number = 30
): { allowed: boolean; message?: string } => {
  if (!shift || !shift.startTime || !shift.endTime) {
    return { allowed: true };
  }

  // Convert shift start & end into minutes from midnight
  const parseMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const startM = parseMinutes(shift.startTime);
  const endM = parseMinutes(shift.endTime);

  // Get current PKT (Asia/Karachi) hours & minutes
  const pktFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = pktFormatter.formatToParts(now);
  const curH = Number(parts.find((p) => p.type === 'hour')?.value ?? now.getHours());
  const curM = Number(parts.find((p) => p.type === 'minute')?.value ?? now.getMinutes());
  const nowM = curH * 60 + curM;

  // Window start with early check-in buffer
  const windowStartM = startM - earlyBufferMinutes;

  let allowed = false;

  const isOvernight = shift.isOvernight || endM <= startM;

  if (!isOvernight) {
    // Normal day shift (e.g. 08:00 to 16:00, or 09:00 to 17:00)
    allowed = nowM >= windowStartM && nowM <= endM;
  } else {
    // Overnight shift: e.g. 20:00 to 06:00, windowStart = 19:30
    if (windowStartM >= 0) {
      // Allowed if >= windowStartM (evening before midnight) OR <= endM (morning after midnight)
      allowed = nowM >= windowStartM || nowM <= endM;
    } else {
      // If start is e.g. 00:00 and buffer is 30m, windowStart is 23:30 (1410 min)
      const wrappedStartM = 1440 + windowStartM;
      allowed = nowM >= wrappedStartM || nowM <= endM;
    }
  }

  // Format 12-hour display for error message
  const format12h = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  if (!allowed) {
    const formattedStart = format12h(shift.startTime);
    const formattedEnd = format12h(shift.endTime);
    return {
      allowed: false,
      message: `Your shift (${shift.name}) is scheduled from ${formattedStart} to ${formattedEnd}. You cannot check in at this time.`
    };
  }

  return { allowed: true };
};
