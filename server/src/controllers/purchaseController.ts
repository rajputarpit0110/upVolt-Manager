import { Request, Response } from 'express';
import { Purchase, IPurchaseItem } from '../models/Purchase';
import { Product } from '../models/Product';
import { Supplier } from '../models/Supplier';
import { receiveStock } from '../services/inventoryService';
import { createAuditLog } from '../services/auditService';

export const getPurchases = async (req: Request, res: Response): Promise<void> => {
  try {
    const { supplierId, startDate, endDate, page = '1', limit = '50' } = req.query;
    const query: any = {};

    if (supplierId) query.supplierId = supplierId;
    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) query.purchaseDate.$gte = new Date(String(startDate));
      if (endDate) {
        const e = new Date(String(endDate));
        e.setHours(23, 59, 59, 999);
        query.purchaseDate.$lte = e;
      }
    }

    const skip = (parseInt(String(page)) - 1) * parseInt(String(limit));
    const total = await Purchase.countDocuments(query);
    const purchases = await Purchase.find(query)
      .sort({ purchaseDate: -1 })
      .skip(skip)
      .limit(parseInt(String(limit)));

    res.json({
      success: true,
      purchases,
      pagination: {
        total,
        page: parseInt(String(page)),
        pages: Math.ceil(total / parseInt(String(limit))),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createPurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      supplierId,
      supplierName,
      invoiceNumber,
      purchaseDate,
      items,
      paymentStatus = 'PAID',
      notes,
      attachmentUrl,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'Purchase must contain at least one item.' });
      return;
    }

    const now = new Date();
    const count = await Purchase.countDocuments();
    const purchaseNumber = `PO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;

    const processedItems: IPurchaseItem[] = [];
    let totalAmount = 0;

    for (const item of items) {
      if (!item.productId || !item.quantity || item.costPrice === undefined) {
        res.status(400).json({
          success: false,
          message: 'Each item must have productId, quantity (>0), and costPrice (>=0).',
        });
        return;
      }

      const product = await Product.findById(item.productId);
      if (!product) {
        res.status(404).json({ success: false, message: `Product not found: ${item.productId}` });
        return;
      }

      const qty = Number(item.quantity);
      const cp = Number(item.costPrice);
      const itemTotal = qty * cp;
      totalAmount += itemTotal;

      // Execute inventory receipt and create FIFO batch
      const receipt = await receiveStock({
        productId: item.productId,
        quantity: qty,
        costPrice: cp,
        supplierId,
        purchaseId: purchaseNumber,
        invoiceNumber,
        storageLocation: item.storageLocation || product.locationShelf,
        notes: `Purchase #${purchaseNumber}: ${notes || ''}`.trim(),
        receivedBy: req.user!.userId,
      });

      processedItems.push({
        productId: product._id,
        productName: product.name,
        sku: product.sku,
        quantity: qty,
        costPrice: cp,
        totalCost: Math.round(itemTotal * 100) / 100,
        batchNumber: receipt.batch.batchNumber,
        storageLocation: item.storageLocation || product.locationShelf,
      });
    }

    let finalSupplierName = supplierName;
    if (supplierId) {
      const supplierDoc = await Supplier.findById(supplierId);
      if (supplierDoc) finalSupplierName = supplierDoc.name;
    }

    const purchase = new Purchase({
      purchaseNumber,
      supplierId: supplierId || undefined,
      supplierName: finalSupplierName,
      invoiceNumber: invoiceNumber?.trim(),
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      items: processedItems,
      totalAmount: Math.round(totalAmount * 100) / 100,
      paymentStatus,
      notes: notes?.trim(),
      attachmentUrl,
      receivedBy: req.user!.userId,
      isCancelled: false,
    });

    await purchase.save();

    await createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.name,
      role: req.user!.role,
      action: 'RECEIVE_STOCK',
      entityType: 'PURCHASE',
      entityId: purchase._id.toString(),
      newState: { purchaseNumber, totalAmount, itemsCount: processedItems.length },
      ip: req.ip,
    });

    res.status(201).json({ success: true, purchase });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
