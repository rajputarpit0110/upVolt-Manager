import { Router } from 'express';
import { getSuppliers, getSupplierById, createSupplier, updateSupplier } from '../controllers/supplierController';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getSuppliers);
router.get('/:id', getSupplierById);
router.post('/', createSupplier);
router.put('/:id', updateSupplier);

export default router;
