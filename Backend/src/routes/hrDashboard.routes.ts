import express from 'express';
import { getHROverview } from '../controllers/hrDashboard.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = express.Router();

router.use(requireAuth);

router.get(
  '/overview',
  requireRole(['supervisor', 'department_head', 'admin', 'superadmin']),
  getHROverview
);

export default router;

