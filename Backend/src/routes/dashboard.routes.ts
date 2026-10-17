import express from 'express';
import {
  getSystemDashboard,
  getDepartmentReports,
  getStaffReports,
  getAuditLogsFiltered,
  getAdminPerformance,
  createAdminUser,
  deleteAdminUser,
  getAdminDetails,
  getResidentFeedbackList
} from '../controllers/dashboard.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = express.Router();

router.use(requireAuth);

router.get(
  '/overview',
  requireRole(['supervisor', 'department_head', 'admin', 'superadmin']),
  getSystemDashboard
);

router.get(
  '/departments',
  requireRole(['department_head', 'supervisor', 'admin', 'superadmin']),
  getDepartmentReports
);

router.get(
  '/staff',
  requireRole(['department_head', 'supervisor', 'admin', 'superadmin']),
  getStaffReports
);

router.get(
  '/audit-logs',
  requireRole(['superadmin', 'admin']),
  getAuditLogsFiltered
);

router.get(
  '/admin-performance',
  requireRole(['superadmin']),
  getAdminPerformance
);

router.post(
  '/admin-performance',
  requireRole(['superadmin']),
  createAdminUser
);

router.delete(
  '/admin-performance/:adminId',
  requireRole(['superadmin']),
  deleteAdminUser
);

router.get(
  '/admin-performance/:adminId/details',
  requireRole(['superadmin']),
  getAdminDetails
);

router.get(
  '/resident-feedback',
  requireRole(['superadmin']),
  getResidentFeedbackList
);

export default router;

