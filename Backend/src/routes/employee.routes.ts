import express from 'express';
import {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  updateEmploymentStatus,
  getEmploymentHistory,
  uploadEmployeeDocument,
  getEmployeeDocuments
} from '../controllers/employee.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const router = express.Router();

router.use(requireAuth);

router.post(
  '/',
  requireRole(['admin', 'superadmin', 'department_head']),
  createEmployee
);

router.get(
  '/',
  requireRole(['admin', 'superadmin', 'department_head', 'supervisor']),
  getEmployees
);

router.get(
  '/:id',
  requireRole(['admin', 'superadmin', 'department_head', 'supervisor', 'staff']),
  getEmployeeById
);

router.patch(
  '/:id',
  requireRole(['admin', 'superadmin', 'department_head']),
  updateEmployee
);

router.patch(
  '/:id/status',
  requireRole(['admin', 'superadmin']),
  updateEmploymentStatus
);

router.get(
  '/:id/history',
  requireRole(['admin', 'superadmin', 'department_head', 'supervisor', 'staff']),
  getEmploymentHistory
);

router.post(
  '/:id/documents',
  requireRole(['admin', 'superadmin', 'department_head']),
  upload.single('document'),
  uploadEmployeeDocument
);

router.get(
  '/:id/documents',
  requireRole(['admin', 'superadmin', 'department_head', 'supervisor', 'staff']),
  getEmployeeDocuments
);

export default router;

