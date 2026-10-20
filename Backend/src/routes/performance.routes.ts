import express from 'express';
import {
  createPerformanceEvaluation,
  getEmployeePerformanceHistory,
  submitPerformanceAppeal,
  reviewPerformanceAppeal
} from '../controllers/performance.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = express.Router();

router.use(requireAuth);

router.post(
  '/evaluations',
  requireRole(['supervisor', 'department_head', 'admin', 'superadmin']),
  createPerformanceEvaluation
);

router.get(
  '/employees/:id',
  requireRole(['staff', 'supervisor', 'department_head', 'admin', 'superadmin']),
  getEmployeePerformanceHistory
);

router.post(
  '/appeals',
  requireRole(['staff', 'supervisor', 'department_head']),
  submitPerformanceAppeal
);

router.patch(
  '/appeals/:id/review',
  requireRole(['department_head', 'admin', 'superadmin']),
  reviewPerformanceAppeal
);

export default router;

