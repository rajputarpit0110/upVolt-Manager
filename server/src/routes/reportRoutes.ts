import { Router } from 'express';
import {
  getDashboard,
  getDailyActivity,
  getSystemIntegrity,
  exportData,
} from '../controllers/reportController';
import { authenticateToken, requireMasterAdmin, requireStaffOrAdmin } from '../middlewares/auth';
import { serverCacheMiddleware } from '../middlewares/cache';

const router = Router();

router.use(authenticateToken);
router.use(requireStaffOrAdmin);

router.get('/dashboard', serverCacheMiddleware({ ttlSeconds: 30, tag: 'reports' }), getDashboard);
router.get('/daily-activity', serverCacheMiddleware({ ttlSeconds: 30, tag: 'reports' }), getDailyActivity);
router.get('/export', exportData);
router.get('/integrity-check', requireMasterAdmin, getSystemIntegrity);

export default router;
