import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditController';
import { authenticateToken, requireMasterAdmin } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', requireMasterAdmin, getAuditLogs);

export default router;
