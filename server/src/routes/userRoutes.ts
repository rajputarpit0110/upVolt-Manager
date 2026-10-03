import { Router } from 'express';
import { getUsers, createUser, toggleUserStatus } from '../controllers/userController';
import { authenticateToken, requireMasterAdmin } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', requireMasterAdmin, getUsers);
router.post('/', requireMasterAdmin, createUser);
router.patch('/:id/toggle-status', requireMasterAdmin, toggleUserStatus);

export default router;
