import express from 'express';
import {
  createDepartment,
  getDepartments,
  getDepartmentById,
  getDepartmentStaff,
  assignHead,
  updateDepartment,
  deleteDepartment,
  recommendStaff,
  getDepartmentHeadDashboard
} from '../controllers/department.controller';
import { transferComplaintDepartment } from '../controllers/departmentTransfer.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = express.Router();

router.use(requireAuth);

// Collection routes
router.post('/', requireRole(['admin', 'superadmin']), createDepartment);
router.get('/', requireRole(['admin', 'superadmin', 'department_head', 'supervisor', 'staff', 'resident']), getDepartments);

// Head Dashboard (MUST be before /:id routes)
router.get('/head/dashboard', requireRole(['department_head', 'supervisor', 'admin', 'superadmin']), getDepartmentHeadDashboard);

// Department Complaint Transfer
router.post('/transfer/:complaintId', requireRole(['department_head', 'supervisor', 'admin', 'superadmin']), transferComplaintDepartment);

// Single department routes
router.get('/:id/recommend-staff', requireRole(['admin', 'superadmin', 'department_head', 'supervisor']), recommendStaff);
router.get('/:id', requireRole(['admin', 'superadmin', 'department_head', 'supervisor']), getDepartmentById);
router.put('/:id', requireRole(['admin', 'superadmin']), updateDepartment);
router.patch('/:id', requireRole(['admin', 'superadmin']), updateDepartment);
router.delete('/:id', requireRole(['admin', 'superadmin']), deleteDepartment);
router.get('/:id/staff', requireRole(['admin', 'superadmin', 'department_head', 'supervisor']), getDepartmentStaff);
router.patch('/:id/assign-head', requireRole(['admin', 'superadmin']), assignHead);

export default router;
