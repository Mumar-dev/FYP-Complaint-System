import express from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { 
  createComplaint, 
  checkDuplicateComplaint,
  getComplaints, 
  updateComplaintStatus,
  assignComplaint,
  getComplaintById,
  getComplaintActivity,
  submitComplaintFeedback,
  updateComplaintEta
} from '../controllers/complaint.controller';
import {
  requestComplaintTransfer,
  getComplaintTransferStatus,
  getComplaintTransferRequests,
  approveComplaintTransfer,
  rejectComplaintTransfer
} from '../controllers/complaintTransfer.controller';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 5, fileSize: 10 * 1024 * 1024 }
});

const router = express.Router();

router.use(requireAuth);

router.get('/', getComplaints);
router.post(
  '/check-duplicate',
  requireRole(['resident', 'staff', 'supervisor', 'department_head', 'admin', 'superadmin']),
  checkDuplicateComplaint
);
router.get('/:id', getComplaintById);
router.get('/:id/activity', getComplaintActivity);

router.post(
  '/', 
  requireRole(['resident']), 
  upload.array('images', 5),
  createComplaint
);

// Status updates across workflow
router.patch(
  '/:id/status', 
  requireRole(['resident', 'staff', 'supervisor', 'department_head', 'admin', 'superadmin']),
  updateComplaintStatus
);

// Multi-staff assignment
router.patch(
  '/:id/assign',
  requireRole(['department_head', 'supervisor', 'admin', 'superadmin']),
  assignComplaint
);

// ETA update and revision proposal
router.patch(
  '/:id/eta',
  requireRole(['staff', 'supervisor', 'department_head', 'admin', 'superadmin']),
  updateComplaintEta
);

// Feedback Loop exclusively for Residents on Resolved/Closed Tickets
router.post(
  '/:id/feedback',
  requireRole(['resident']),
  submitComplaintFeedback
);

// Complaint Transfer Workflow
router.post(
  '/:complaintId/transfer-request',
  requireRole(['department_head', 'supervisor', 'admin', 'superadmin']),
  requestComplaintTransfer
);

router.get(
  '/:complaintId/transfer-status',
  requireRole(['department_head', 'supervisor', 'admin', 'superadmin']),
  getComplaintTransferStatus
);

router.get(
  '/transfer-requests/all',
  requireRole(['admin', 'superadmin']),
  getComplaintTransferRequests
);

router.patch(
  '/transfer-requests/:id/approve',
  requireRole(['admin', 'superadmin']),
  approveComplaintTransfer
);

router.patch(
  '/transfer-requests/:id/reject',
  requireRole(['admin', 'superadmin']),
  rejectComplaintTransfer
);

export default router;
