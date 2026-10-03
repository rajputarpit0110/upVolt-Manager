import { Router } from 'express';
import { getCustomers, getCustomerById, createCustomer, updateCustomer } from '../controllers/customerController';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getCustomers);
router.get('/:id', getCustomerById);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);

export default router;
