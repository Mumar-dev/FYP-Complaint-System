import express from 'express';
import {
  submitPromotionRequest,
  reviewPromotionRequest,
  getPromotionHistory,
  getAllPromotionRequests
} from '../controllers/promotion.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = express.Router();

router.use(requireAuth);

router.get(
  '/requests',
  requireRole(['department_head', 'supervisor', 'admin', 'superadmin']),
  getAllPromotionRequests
);

router.post(
  '/requests',
  requireRole(['staff', 'supervisor', 'department_head', 'admin', 'superadmin']),
  submitPromotionRequest
);

router.patch(
  '/requests/:id/review',
  requireRole(['department_head', 'admin', 'superadmin']),
  reviewPromotionRequest
);

router.get(
  '/history/:employeeId',
  requireRole(['staff', 'supervisor', 'department_head', 'admin', 'superadmin']),
  getPromotionHistory
);

export default router;

