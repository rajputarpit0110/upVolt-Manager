import { Router } from 'express';
import {
  getOrders,
  getOrderById,
  handleCreateOrder,
  handleUpdateOrder,
  handleUpdateStatus,
  handleCancelOrder,
  handleReturnOrder,
  handleSoftDeleteOrder,
  getTrashOrders,
  handleRestoreOrder,
  handlePermanentDeleteOrder,
  getOrderVersions,
} from '../controllers/orderController';
import { authenticateToken, requireMasterAdmin } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);

// Master Admin Trash endpoints
router.get('/trash/list', requireMasterAdmin, getTrashOrders);
router.post('/:id/restore', requireMasterAdmin, handleRestoreOrder);
router.delete('/:id/permanent', requireMasterAdmin, handlePermanentDeleteOrder);

// Standard Order CRUD and Lifecycle
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.get('/:id/versions', getOrderVersions);
router.post('/', handleCreateOrder);
router.put('/:id', handleUpdateOrder);
router.patch('/:id/status', handleUpdateStatus);
router.post('/:id/cancel', handleCancelOrder);
router.post('/:id/return', handleReturnOrder);

// Soft delete (Master Admin only!)
router.delete('/:id', requireMasterAdmin, handleSoftDeleteOrder);

export default router;
