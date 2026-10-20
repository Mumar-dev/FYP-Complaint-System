import express from 'express';
import {
  getLeaveTypes,
  createLeaveType,
  getMyLeaveBalances,
  submitLeaveRequest,
  reviewLeaveRequest,
  getAllLeaveRequests
} from '../controllers/leave.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const router = express.Router();

router.use(requireAuth);

router.get('/types', getLeaveTypes);
router.post('/types', requireRole(['admin', 'superadmin']), createLeaveType);

router.get('/balances/me', requireRole(['staff', 'supervisor', 'department_head', 'admin']), getMyLeaveBalances);

router.get('/requests', requireRole(['staff', 'supervisor', 'department_head', 'admin', 'superadmin']), getAllLeaveRequests);
router.post(
  '/requests',
  requireRole(['staff', 'supervisor', 'department_head', 'admin']),
  upload.single('document'),
  submitLeaveRequest
);

router.patch(
  '/requests/:id/review',
  requireRole(['supervisor', 'department_head', 'admin', 'superadmin']),
  reviewLeaveRequest
);

export default router;

