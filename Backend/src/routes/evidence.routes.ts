import express from 'express';
import {
  submitResolutionEvidence,
  reviewResolutionEvidence,
  getComplaintEvidenceList,
  getPendingResolutionVerifications
} from '../controllers/evidence.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 5, fileSize: 10 * 1024 * 1024 }
});

const router = express.Router();

router.use(requireAuth);

router.get(
  '/pending-verifications',
  requireRole(['supervisor', 'department_head', 'admin', 'superadmin']),
  getPendingResolutionVerifications
);

router.get('/:complaintId', getComplaintEvidenceList);

router.post(
  '/:complaintId',
  requireRole(['staff', 'supervisor', 'department_head', 'admin', 'superadmin']),
  upload.array('images', 5),
  submitResolutionEvidence
);

router.patch(
  '/:evidenceId/review',
  requireRole(['supervisor', 'department_head', 'admin', 'superadmin']),
  reviewResolutionEvidence
);

export default router;

