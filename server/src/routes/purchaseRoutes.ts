import { Router } from 'express';
import { getPurchases, createPurchase, deletePurchase } from '../controllers/purchaseController';
import { authenticateToken, requireMasterAdmin } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getPurchases);
router.post('/', createPurchase);
router.delete('/:id', requireMasterAdmin, deletePurchase);

export default router;
