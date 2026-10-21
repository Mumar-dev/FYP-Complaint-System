import express from 'express';
import {
  createShift,
  getShifts,
  assignShiftToEmployee,
  deleteShift
} from '../controllers/shift.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = express.Router();

router.use(requireAuth);

router.post(
  '/',
  requireRole(['admin', 'superadmin', 'department_head']),
  createShift
);

router.get(
  '/',
  requireRole(['admin', 'superadmin', 'department_head', 'supervisor', 'staff']),
  getShifts
);

router.delete(
  '/:id',
  requireRole(['admin', 'superadmin']),
  deleteShift
);

router.post(
  '/assignments',
  requireRole(['admin', 'superadmin', 'department_head', 'supervisor']),
  assignShiftToEmployee
);

export default router;

