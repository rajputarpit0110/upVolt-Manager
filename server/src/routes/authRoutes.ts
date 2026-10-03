import { Router } from 'express';
import { login, getMe, changePassword, resetUserPassword } from '../controllers/authController';
import { authenticateToken, requireMasterAdmin } from '../middlewares/auth';

const router = Router();

router.post('/login', login);
router.get('/me', authenticateToken, getMe);
router.post('/change-password', authenticateToken, changePassword);
router.post('/reset-password', authenticateToken, requireMasterAdmin, resetUserPassword);

export default router;
