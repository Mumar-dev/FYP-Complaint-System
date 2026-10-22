import express from 'express';
import { SLAPolicy } from '../models/slaPolicy.model';
import { ETAHistory } from '../models/etaHistory.model';
import { SlaEtaService } from '../services/slaEta.service';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { sendResponse } from '../utils/response';
import { AuditService } from '../services/audit.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/sla/policies - List all SLA policies
 */
router.get('/policies', async (request: AuthenticatedRequest, response) => {
  try {
    const policies = await SLAPolicy.find().sort({ category: 1, priority: 1 });
    return sendResponse(response, 200, true, 'SLA Policies retrieved', policies);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message);
  }
});

/**
 * POST /api/sla/policies - Create or update SLA policy (Admin/SuperAdmin)
 */
router.post(
  '/policies',
  requireRole(['admin', 'superadmin']),
  async (request: AuthenticatedRequest, response) => {
    try {
      const { name, category, priority, targetHours, warningThresholdPercent } = request.body;
      const user = request.user!;

      if (!name || !category || !priority || !targetHours) {
        return sendResponse(response, 400, false, 'Name, category, priority, and targetHours are required.');
      }

      const cleanCategory = String(category).trim();
      const cleanPriority = String(priority).toLowerCase().trim() as 'low' | 'medium' | 'high' | 'critical';

      if (!['low', 'medium', 'high', 'critical'].includes(cleanPriority)) {
        return sendResponse(response, 400, false, 'Priority must be one of: low, medium, high, critical.');
      }

      const policy = await SLAPolicy.findOneAndUpdate(
        { category: cleanCategory, priority: cleanPriority },
        {
          name: String(name).trim(),
          category: cleanCategory,
          priority: cleanPriority,
          targetHours: Number(targetHours),
          warningThresholdPercent: warningThresholdPercent ? Number(warningThresholdPercent) : 80,
          createdBy: user._id,
          isActive: true
        },
        { upsert: true, new: true }
      );

      await AuditService.log({
        userId: user._id,
        userRole: user.role,
        action: 'CONFIGURE_SLA_POLICY',
        entityType: 'SLA',
        entityId: policy._id,
        details: { category: cleanCategory, priority: cleanPriority, targetHours }
      });

      return sendResponse(response, 201, true, 'SLA Policy saved successfully', policy);
    } catch (error: any) {
      return sendResponse(response, 500, false, error.message);
    }
  }
);

/**
 * PUT /api/sla/policies/:id - Update existing SLA policy by ID (Admin/SuperAdmin)
 */
router.put(
  '/policies/:id',
  requireRole(['admin', 'superadmin']),
  async (request: AuthenticatedRequest, response) => {
    try {
      const { id } = request.params;
      const { name, category, priority, targetHours, warningThresholdPercent, isActive } = request.body;
      const user = request.user!;

      const policy = await SLAPolicy.findById(id);
      if (!policy) {
        return sendResponse(response, 404, false, 'SLA Policy not found.');
      }

      if (category) policy.category = String(category).trim();
      if (priority) {
        const cleanPriority = String(priority).toLowerCase().trim() as 'low' | 'medium' | 'high' | 'critical';
        if (!['low', 'medium', 'high', 'critical'].includes(cleanPriority)) {
          return sendResponse(response, 400, false, 'Priority must be one of: low, medium, high, critical.');
        }
        policy.priority = cleanPriority;
      }
      if (name) policy.name = String(name).trim();
      if (targetHours !== undefined) policy.targetHours = Number(targetHours);
      if (warningThresholdPercent !== undefined) policy.warningThresholdPercent = Number(warningThresholdPercent);
      if (isActive !== undefined) policy.isActive = Boolean(isActive);

      await policy.save();

      await AuditService.log({
        userId: user._id,
        userRole: user.role,
        action: 'UPDATE_SLA_POLICY',
        entityType: 'SLA',
        entityId: policy._id,
        details: { category: policy.category, priority: policy.priority, targetHours: policy.targetHours }
      });

      return sendResponse(response, 200, true, 'SLA Policy updated successfully', policy);
    } catch (error: any) {
      return sendResponse(response, 500, false, error.message);
    }
  }
);

/**
 * DELETE /api/sla/policies/:id - Delete SLA policy by ID (Admin/SuperAdmin)
 */
router.delete(
  '/policies/:id',
  requireRole(['admin', 'superadmin']),
  async (request: AuthenticatedRequest, response) => {
    try {
      const { id } = request.params;
      const user = request.user!;

      const policy = await SLAPolicy.findByIdAndDelete(id);
      if (!policy) {
        return sendResponse(response, 404, false, 'SLA Policy not found.');
      }

      await AuditService.log({
        userId: user._id,
        userRole: user.role,
        action: 'DELETE_SLA_POLICY',
        entityType: 'SLA',
        entityId: id as string,
        details: { category: policy.category, priority: policy.priority, name: policy.name }
      });

      return sendResponse(response, 200, true, 'SLA Policy deleted successfully', { id });
    } catch (error: any) {
      return sendResponse(response, 500, false, error.message);
    }
  }
);

/**
 * GET /api/sla/eta/history/:complaintId - List ETA history for complaint
 */
router.get('/eta/history/:complaintId', async (request: AuthenticatedRequest, response) => {
  try {
    const { complaintId } = request.params;
    const history = await ETAHistory.find({ complaintId })
      .populate('proposedBy', 'email profile.fullName')
      .populate('reviewedBy', 'email profile.fullName')
      .sort({ createdAt: -1 });

    return sendResponse(response, 200, true, 'ETA history retrieved', history);
  } catch (error: any) {
    return sendResponse(response, 500, false, error.message);
  }
});

/**
 * PATCH /api/sla/eta/:etaHistoryId/review - Supervisor reviews ETA revision request
 */
router.patch(
  '/eta/:etaHistoryId/review',
  requireRole(['supervisor', 'department_head', 'admin', 'superadmin']),
  async (request: AuthenticatedRequest, response) => {
    try {
      const { action, reviewRemarks } = request.body; // 'approved' | 'rejected'
      const user = request.user!;

      if (!['approved', 'rejected'].includes(action)) {
        return sendResponse(response, 400, false, 'Action must be "approved" or "rejected".');
      }

      const rawId = request.params.etaHistoryId;
      const targetEtaId = Array.isArray(rawId) ? rawId[0] : rawId;

      const updated = await SlaEtaService.reviewEtaChange({
        etaHistoryId: targetEtaId as string,
        supervisorId: user._id,
        action,
        reviewRemarks
      });

      return sendResponse(response, 200, true, `ETA revision ${action} successfully.`, updated);
    } catch (error: any) {
      return sendResponse(response, 400, false, error.message);
    }
  }
);

export default router;
