import { Router } from 'express';
import {
  createDispatch,
  getDispatches,
  getInventoryByCollege,
  getColleges,
  getCollegeTeamHandler,
} from '../controllers/collegeDispatchController';
import { authenticateToken, requireStaffOrAdmin } from '../middlewares/auth';
import { serverCacheMiddleware } from '../middlewares/cache';

const router = Router();

router.use(authenticateToken);

router.post('/dispatch', requireStaffOrAdmin, createDispatch);
router.post('/dispatches', requireStaffOrAdmin, createDispatch);
router.get('/dispatches', getDispatches);
router.get('/inventory', getInventoryByCollege);
router.get('/inventory/:college', getInventoryByCollege);
router.get('/list', serverCacheMiddleware({ ttlSeconds: 120, tag: 'colleges' }), getColleges);
router.get('/team', serverCacheMiddleware({ ttlSeconds: 60, tag: 'colleges' }), getCollegeTeamHandler);

export default router;
