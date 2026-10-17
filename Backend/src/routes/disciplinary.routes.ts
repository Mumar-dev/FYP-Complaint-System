import express from 'express';
import {
  createDisciplinaryCase,
  recordSuspension,
  recordReinstatement,
  issueFormalWarning,
  getFormalWarnings,
  getAllDisciplinaryCases
} from '../controllers/disciplinary.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const router = express.Router();

router.use(requireAuth);

router.get(
  '/cases',
  requireRole(['supervisor', 'department_head', 'admin', 'superadmin']),
  getAllDisciplinaryCases
);

router.get(
  '/warnings',
  requireRole(['staff', 'supervisor', 'department_head', 'admin', 'superadmin']),
  getFormalWarnings
);

router.post(
  '/warnings',
  requireRole(['supervisor', 'department_head', 'admin', 'superadmin']),
  upload.single('evidence'),
  issueFormalWarning
);

router.post(
  '/cases',
  requireRole(['supervisor', 'department_head', 'admin', 'superadmin']),
  upload.array('evidence', 5),
  createDisciplinaryCase
);

router.post(
  '/cases/:id/suspension',
  requireRole(['admin', 'superadmin']),
  recordSuspension
);

router.post(
  '/cases/:id/reinstatement',
  requireRole(['admin', 'superadmin']),
  recordReinstatement
);

export default router;

