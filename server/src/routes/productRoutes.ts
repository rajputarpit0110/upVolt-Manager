import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  adjustStock,
  getProductLedger,
  deleteProduct,
} from '../controllers/productController';
import { authenticateToken, requireMasterAdmin } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.post('/:id/adjust-stock', requireMasterAdmin, adjustStock);
router.get('/:id/ledger', getProductLedger);
router.delete('/:id', requireMasterAdmin, deleteProduct);

export default router;
