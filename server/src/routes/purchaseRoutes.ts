import { Router } from 'express';
import { getPurchases, createPurchase } from '../controllers/purchaseController';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getPurchases);
router.post('/', createPurchase);

export default router;
