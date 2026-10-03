import { Router } from 'express';
import { getNotifications, markNotificationRead } from '../controllers/notificationController';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getNotifications);
router.patch('/:id/read', markNotificationRead);

export default router;
