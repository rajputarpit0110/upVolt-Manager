import { Router } from 'express';
import {
  getUsers,
  createUser,
  toggleUserStatus,
  updateUser,
  resetPassword,
  deleteUser,
} from '../controllers/userController';
import { authenticateToken, requireStaffOrAdmin, requireMasterAdmin } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', requireStaffOrAdmin, getUsers);
router.post('/', requireStaffOrAdmin, createUser);
router.patch('/:id/toggle-status', requireStaffOrAdmin, toggleUserStatus);
router.put('/:id', requireStaffOrAdmin, updateUser);
router.post('/:id/reset-password', requireStaffOrAdmin, resetPassword);
router.delete('/:id', requireMasterAdmin, deleteUser);

export default router;
