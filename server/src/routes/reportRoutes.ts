import { Router } from 'express';
import {
  getDashboard,
  getDailyActivity,
  getSystemIntegrity,
  exportData,
} from '../controllers/reportController';
import { authenticateToken, requireMasterAdmin, requireStaffOrAdmin } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.use(requireStaffOrAdmin);

router.get('/dashboard', getDashboard);
router.get('/daily-activity', getDailyActivity);
router.get('/export', exportData);
router.get('/integrity-check', requireMasterAdmin, getSystemIntegrity);

export default router;
