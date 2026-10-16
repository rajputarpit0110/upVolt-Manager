import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController';
import { authenticateToken } from '../middlewares/auth';
import { serverCacheMiddleware } from '../middlewares/cache';

const router = Router();

// All authenticated employees and admins can view and create categories
router.use(authenticateToken);

router.get('/', serverCacheMiddleware({ ttlSeconds: 300, tag: 'categories' }), getCategories);
router.post('/', createCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

export default router;
