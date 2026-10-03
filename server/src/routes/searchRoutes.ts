import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middlewares/auth';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { Customer } from '../models/Customer';
import { Supplier } from '../models/Supplier';
import { StockMovement } from '../models/StockMovement';

const router = Router();

router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    if (!q || String(q).trim().length === 0) {
      res.json({ success: true, results: { products: [], orders: [], customers: [], suppliers: [], movements: [] } });
      return;
    }

    const queryStr = String(q).trim();
    const regex = new RegExp(queryStr, 'i');

    const [products, orders, customers, suppliers, movements] = await Promise.all([
      Product.find({
        $or: [{ name: regex }, { sku: regex }, { category: regex }, { brand: regex }],
        isArchived: false,
      }).limit(10),

      Order.find({
        $or: [
          { orderNumber: regex },
          { 'customer.name': regex },
          { 'customer.phone': regex },
          { 'items.productName': regex },
          { 'items.sku': regex },
        ],
        isDeleted: false,
      }).limit(10),

      Customer.find({
        $or: [{ name: regex }, { phone: regex }, { email: regex }, { college: regex }],
      }).limit(10),

      Supplier.find({
        $or: [{ name: regex }, { contactPerson: regex }, { phone: regex }, { gstin: regex }],
      }).limit(10),

      StockMovement.find({
        $or: [{ referenceId: regex }, { performedBy: regex }, { notes: regex }],
      }).populate('productId', 'name sku').limit(10),
    ]);

    res.json({
      success: true,
      query: queryStr,
      results: { products, orders, customers, suppliers, movements },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
