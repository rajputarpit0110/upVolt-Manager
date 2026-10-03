import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingController';
import { authenticateToken, requireMasterAdmin } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getSettings);
router.put('/', requireMasterAdmin, updateSettings);

export default router;
