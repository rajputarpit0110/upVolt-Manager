import { Request, Response } from 'express';
import { Purchase, IPurchaseItem } from '../models/Purchase';
import { Product } from '../models/Product';
import { Supplier } from '../models/Supplier';
import { InventoryBatch } from '../models/InventoryBatch';
import { StockMovement } from '../models/StockMovement';
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

    // Pre-validate and fetch all products in a single fast query
    const productIds = items.map((i) => i.productId);
    const productsMap = new Map<string, any>();
    const foundProducts = await Product.find({ _id: { $in: productIds } });
    foundProducts.forEach((p) => productsMap.set(p._id.toString(), p));

    for (const item of items) {
      if (!item.productId || !item.quantity || item.costPrice === undefined) {
        res.status(400).json({
          success: false,
          message: 'Each item must have productId, quantity (>0), and costPrice (>=0).',
        });
        return;
      }

      const product = productsMap.get(item.productId.toString());
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

export const deletePurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const purchase = await Purchase.findById(id);

    if (!purchase) {
      res.status(404).json({ success: false, message: 'Purchase record not found.' });
      return;
    }

    if (req.user?.role !== 'MASTER_ADMIN') {
      res.status(403).json({ success: false, message: 'Access Denied: Only Master Admin can delete inventory purchase logs.' });
      return;
    }

    // For every item in this purchase, revert the added stock and batches
    for (const item of purchase.items) {
      const product = await Product.findById(item.productId);
      if (!product) continue;

      const previousStock = product.currentStock;
      // Deduct the quantity originally added by this purchase
      const deductQty = item.quantity;
      const newStock = Math.max(0, previousStock - deductQty);
      product.currentStock = newStock;
      await product.save();

      // Cancel or delete the batches associated with this purchase number or batchNumber
      if (item.batchNumber) {
        await InventoryBatch.deleteMany({
          productId: product._id,
          batchNumber: item.batchNumber,
        });
      }

      // Also clean up any active batches created specifically under this purchaseId
      await InventoryBatch.deleteMany({
        productId: product._id,
        purchaseId: purchase.purchaseNumber,
      });

      // Recalculate average cost from remaining active batches
      const { calculateCurrentInventoryValuation } = await import('../services/fifoEngine');
      const valuation = await calculateCurrentInventoryValuation(product._id as any);
      if (valuation.totalQuantity > 0) {
        product.averageCost = Math.round((valuation.totalCostValue / valuation.totalQuantity) * 100) / 100;
      }
      await product.save();

      // Record compensating StockMovement
      const movement = new StockMovement({
        productId: product._id,
        movementType: 'ADJUSTMENT',
        quantity: -deductQty,
        previousStock,
        newStock,
        previousReserved: product.reservedStock,
        newReserved: product.reservedStock,
        referenceType: 'PURCHASE',
        referenceId: `DEL-${purchase.purchaseNumber}`,
        costPrice: item.costPrice,
        performedBy: req.user!.userId,
        notes: `Inventory rollback: Deleted Purchase Entry #${purchase.purchaseNumber}`,
      });
      await movement.save();
    }

    // Delete the purchase record
    await Purchase.findByIdAndDelete(id);

    await createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.name,
      role: req.user!.role,
      action: 'DELETE_PURCHASE_ENTRY',
      entityType: 'PURCHASE',
      entityId: purchase._id.toString(),
      previousState: {
        purchaseNumber: purchase.purchaseNumber,
        totalAmount: purchase.totalAmount,
        itemsCount: purchase.items.length,
      },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Purchase entry #${purchase.purchaseNumber} deleted and stock reversed from inventory successfully.`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
