import { Router } from 'express';
import {
  createDispatch,
  getDispatches,
  getInventoryByCollege,
  getColleges,
  getCollegeTeamHandler,
} from '../controllers/collegeDispatchController';
import { authenticateToken, requireStaffOrAdmin } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);

router.post('/dispatch', requireStaffOrAdmin, createDispatch);
router.post('/dispatches', requireStaffOrAdmin, createDispatch);
router.get('/dispatches', getDispatches);
router.get('/inventory', getInventoryByCollege);
router.get('/inventory/:college', getInventoryByCollege);
router.get('/list', getColleges);
router.get('/team', getCollegeTeamHandler);

export default router;
