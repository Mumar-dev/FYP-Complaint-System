import express from 'express';
import {
  requestEmployeeTransfer,
  reviewEmployeeTransfer,
  getEmployeeTransfers
} from '../controllers/employeeTransfer.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = express.Router();

router.use(requireAuth);

router.get(
  '/',
  requireRole(['department_head', 'admin', 'superadmin']),
  getEmployeeTransfers
);

router.post(
  '/',
  requireRole(['department_head', 'admin', 'superadmin']),
  requestEmployeeTransfer
);

router.patch(
  '/:id/review',
  requireRole(['admin', 'superadmin']),
  reviewEmployeeTransfer
);

export default router;
