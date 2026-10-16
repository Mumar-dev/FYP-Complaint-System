import express from 'express';
import {
  checkIn,
  checkOut,
  getMyAttendance,
  requestAttendanceCorrection,
  reviewAttendanceCorrection,
  getAttendanceCorrections,
  getDepartmentAttendance
} from '../controllers/attendance.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = express.Router();

router.use(requireAuth);

router.post('/check-in', requireRole(['staff', 'supervisor', 'department_head', 'admin']), checkIn);
router.post('/check-out', requireRole(['staff', 'supervisor', 'department_head', 'admin']), checkOut);
router.get('/me', requireRole(['staff', 'supervisor', 'department_head', 'admin']), getMyAttendance);
router.get('/department', requireRole(['department_head', 'supervisor', 'admin', 'superadmin']), getDepartmentAttendance);

router.get('/corrections', requireRole(['staff', 'supervisor', 'department_head', 'admin', 'superadmin']), getAttendanceCorrections);
router.post('/corrections', requireRole(['staff', 'supervisor', 'department_head', 'admin']), requestAttendanceCorrection);
router.patch('/corrections/:id/review', requireRole(['supervisor', 'department_head', 'admin', 'superadmin']), reviewAttendanceCorrection);

export default router;

