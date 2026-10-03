import { Response } from 'express';
import { PerformanceEvaluation } from '../models/performanceEvaluation.model';
import { PerformanceAppeal } from '../models/performanceAppeal.model';
import { Complaint } from '../models/complaint.model';
import { Attendance } from '../models/attendance.model';
import { Feedback } from '../models/feedback.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendResponse } from '../utils/response';
import { AuditService } from '../services/audit.service';
import { NotificationService } from '../services/notification.service';

/**
 * POST /api/performance/evaluations - Create multi-factor weighted evaluation
 */
export const createPerformanceEvaluation = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { employeeId, periodStart, periodEnd, supervisorNotes, supervisorFeedbackScore = 80 } = request.body;

    if (!employeeId || !periodStart || !periodEnd || !supervisorNotes) {
      return sendResponse(response, 400, false, 'employeeId, periodStart, periodEnd, and supervisorNotes are required.');
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    // Collect data points from actual CMS complaints
    const resolvedComplaints = await Complaint.find({
      $or: [{ primaryStaffId: employeeId }, { assignedStaffId: employeeId }],
      status: { $in: ['resolved', 'closed'] },
      createdAt: { $gte: start, $lte: end }
    });

    const sampleSize = resolvedComplaints.length;
    const hasSufficientData = sampleSize >= 3; // Minimum 3 complaints required for statistically valid scoring

    let resolutionQuality = 75;
    let timeliness = 75;
    let residentSatisfaction = 75;
    let reopenedComplaintRatio = 90;
    let attendancePunctuality = 85;
    let complexityWorkloadScore = 70;

    if (sampleSize > 0) {
      // 1. Timeliness: SLA adherence
      const onTime = resolvedComplaints.filter(c => !c.slaBreached).length;
      timeliness = Number(((onTime / sampleSize) * 100).toFixed(1));

      // 2. Reopened ratio
      const reopenedCount = resolvedComplaints.filter(c => c.reopenedAt).length;
      reopenedComplaintRatio = Number((((sampleSize - reopenedCount) / sampleSize) * 100).toFixed(1));

      // 3. Resident Satisfaction
      const complaintIds = resolvedComplaints.map(c => c._id);
      const feedbacks = await Feedback.find({ complaintId: { $in: complaintIds } });
      if (feedbacks.length > 0) {
        const avgRating = feedbacks.reduce((acc, f) => acc + f.rating, 0) / feedbacks.length;
        residentSatisfaction = Number(((avgRating / 5) * 100).toFixed(1));
      }

      // 4. Workload complexity adjustment: more complaints handled = higher score
      complexityWorkloadScore = Math.min(100, Math.round(50 + sampleSize * 5));
      resolutionQuality = Math.round((timeliness + residentSatisfaction) / 2);
    }

    // 5. Attendance & punctuality in period
    const attendanceRecords = await Attendance.find({
      employeeId,
      date: { $gte: start, $lte: end }
    });
    if (attendanceRecords.length > 0) {
      const lateCount = attendanceRecords.filter(a => a.isLate).length;
      attendancePunctuality = Math.max(0, Math.round(100 - (lateCount / attendanceRecords.length) * 50));
    }

    // Weighted Formula (Resolution: 25%, Timeliness: 20%, Satisfaction: 20%, Attendance: 15%, Supervisor: 10%, Complexity: 10%)
    const weightedTotalScore = Number((
      resolutionQuality * 0.25 +
      timeliness * 0.20 +
      residentSatisfaction * 0.20 +
      attendancePunctuality * 0.15 +
      supervisorFeedbackScore * 0.10 +
      complexityWorkloadScore * 0.10
    ).toFixed(1));

    let performanceCategory: 'TOP_PERFORMER' | 'HIGH_PERFORMANCE' | 'MODERATE_PERFORMANCE' | 'NEEDS_IMPROVEMENT';
    if (weightedTotalScore >= 90) performanceCategory = 'TOP_PERFORMER';
    else if (weightedTotalScore >= 75) performanceCategory = 'HIGH_PERFORMANCE';
    else if (weightedTotalScore >= 60) performanceCategory = 'MODERATE_PERFORMANCE';
    else performanceCategory = 'NEEDS_IMPROVEMENT';

    const evaluation = await PerformanceEvaluation.create({
      employeeId,
      evaluatorId: user._id,
      periodStart: start,
      periodEnd: end,
      factors: {
        resolutionQuality,
        timeliness,
        residentSatisfaction,
        attendancePunctuality,
        reopenedComplaintRatio,
        supervisorFeedbackScore,
        complexityWorkloadScore
      },
      weightedTotalScore,
      performanceCategory,
      hasSufficientData,
      sampleSize,
      supervisorNotes,
      isPublished: true,
      publishedAt: new Date()
    });

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'PERFORMANCE_EVALUATION_CREATED',
      entityType: 'Performance',
      entityId: evaluation._id,
      previousValue: null,
      newValue: { employeeId, weightedTotalScore, performanceCategory, hasSufficientData },
      reason: 'Supervisor submitted performance evaluation'
    });

    await NotificationService.send({
      userId: employeeId,
      type: 'performance_published',
      title: 'Performance Evaluation Published',
      message: `Your performance evaluation has been published. Category: ${performanceCategory.replace('_', ' ')} (${weightedTotalScore}/100).`,
      idempotencyKey: `notif_perf_pub_${evaluation._id}`
    });

    return sendResponse(response, 201, true, 'Performance evaluation recorded', evaluation);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error generating performance evaluation');
  }
};

/**
 * GET /api/performance/employees/:id - View performance history for an employee
 */
export const getEmployeePerformanceHistory = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const user = request.user!;

    if (user.role === 'staff' && user._id.toString() !== id) {
      return sendResponse(response, 403, false, 'Forbidden: You can only view your own performance evaluations.');
    }

    const evaluations = await PerformanceEvaluation.find({ employeeId: id, isPublished: true })
      .populate('evaluatorId', 'profile.fullName email role')
      .sort({ periodEnd: -1 });

    return sendResponse(response, 200, true, 'Performance evaluations retrieved', evaluations);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error retrieving performance history');
  }
};

/**
 * POST /api/performance/appeals - Submit an appeal against evaluation
 */
export const submitPerformanceAppeal = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const user = request.user!;
    const { evaluationId, reason } = request.body;

    if (!evaluationId || !reason) {
      return sendResponse(response, 400, false, 'evaluationId and reason are required.');
    }

    const evaluation = await PerformanceEvaluation.findById(evaluationId);
    if (!evaluation) {
      return sendResponse(response, 404, false, 'Evaluation record not found.');
    }

    if (evaluation.employeeId.toString() !== user._id.toString()) {
      return sendResponse(response, 403, false, 'Forbidden: You can only appeal your own performance evaluation.');
    }

    const appeal = await PerformanceAppeal.create({
      evaluationId,
      employeeId: user._id,
      reason,
      status: 'PENDING'
    });

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'PERFORMANCE_APPEAL_SUBMITTED',
      entityType: 'Performance',
      entityId: appeal._id,
      previousValue: null,
      newValue: { evaluationId, reason },
      reason: 'Employee submitted performance appeal'
    });

    return sendResponse(response, 201, true, 'Performance appeal submitted successfully', appeal);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error submitting appeal');
  }
};

/**
 * PATCH /api/performance/appeals/:id/review - Review performance appeal
 */
export const reviewPerformanceAppeal = async (request: AuthenticatedRequest, response: Response): Promise<any> => {
  try {
    const { id } = request.params;
    const { action, decisionNotes, revisedScore } = request.body; // 'UPHELD' | 'MODIFIED' | 'REJECTED'
    const user = request.user!;

    if (!['UPHELD', 'MODIFIED', 'REJECTED'].includes(action)) {
      return sendResponse(response, 400, false, 'Action must be "UPHELD", "MODIFIED", or "REJECTED".');
    }

    const appeal = await PerformanceAppeal.findById(id);
    if (!appeal) {
      return sendResponse(response, 404, false, 'Appeal not found.');
    }

    // Rule: Employee cannot review their own appeal
    if (appeal.employeeId.toString() === user._id.toString()) {
      return sendResponse(response, 403, false, 'Self-approval violation: You cannot review your own appeal.');
    }

    appeal.status = action;
    appeal.reviewedBy = user._id;
    appeal.reviewedAt = new Date();
    appeal.decisionNotes = decisionNotes;

    if (action === 'MODIFIED' && revisedScore !== undefined) {
      appeal.revisedScore = Number(revisedScore);
      const evalDoc = await PerformanceEvaluation.findById(appeal.evaluationId);
      if (evalDoc) {
        evalDoc.weightedTotalScore = Number(revisedScore);
        if (Number(revisedScore) >= 90) evalDoc.performanceCategory = 'TOP_PERFORMER';
        else if (Number(revisedScore) >= 75) evalDoc.performanceCategory = 'HIGH_PERFORMANCE';
        else if (Number(revisedScore) >= 60) evalDoc.performanceCategory = 'MODERATE_PERFORMANCE';
        else evalDoc.performanceCategory = 'NEEDS_IMPROVEMENT';
        await evalDoc.save();
      }
    }
    await appeal.save();

    await AuditService.log({
      userId: user._id,
      userRole: user.role,
      action: 'PERFORMANCE_APPEAL_REVIEWED',
      entityType: 'Performance',
      entityId: appeal._id,
      previousValue: { status: 'PENDING' },
      newValue: { status: action, decisionNotes, revisedScore },
      reason: decisionNotes || 'Management reviewed performance appeal'
    });

    return sendResponse(response, 200, true, `Performance appeal ${action.toLowerCase()} successfully`, appeal);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message || 'Error reviewing appeal');
  }
};

