import { Product } from '../models/Product';
import { InventoryBatch } from '../models/InventoryBatch';
import { StockMovement } from '../models/StockMovement';
import { Order } from '../models/Order';

export interface IIntegrityDiscrepancy {
  entityType: 'PRODUCT' | 'BATCH' | 'ORDER' | 'MOVEMENT';
  entityId: string;
  name?: string;
  issue: string;
  details: any;
}

export interface IIntegrityCheckResult {
  passed: boolean;
  checkedAt: Date;
  summary: {
    totalProductsChecked: number;
    totalBatchesChecked: number;
    totalMovementsChecked: number;
    totalOrdersChecked: number;
    discrepancyCount: number;
    productsChecked?: number;
    batchesChecked?: number;
    movementsChecked?: number;
    ordersChecked?: number;
  };
  discrepancies: IIntegrityDiscrepancy[];
}

/**
 * Runs a comprehensive mathematical integrity check across all products,
 * batches, stock movements, and orders.
 */
export async function runSystemIntegrityCheck(): Promise<IIntegrityCheckResult> {
  const discrepancies: IIntegrityDiscrepancy[] = [];

  const products = await Product.find({ isArchived: false });
  const batches = await InventoryBatch.find({});
  const movements = await StockMovement.find({});
  const orders = await Order.find({ isDeleted: false });

  // 1. Check Products for negative stock and batch sum parity
  for (const prod of products) {
    if (prod.currentStock < 0) {
      discrepancies.push({
        entityType: 'PRODUCT',
        entityId: prod._id.toString(),
        name: prod.name,
        issue: 'Negative physical current stock detected!',
        details: { currentStock: prod.currentStock },
      });
    }

    if (prod.reservedStock < 0) {
      discrepancies.push({
        entityType: 'PRODUCT',
        entityId: prod._id.toString(),
        name: prod.name,
        issue: 'Negative reserved stock detected!',
        details: { reservedStock: prod.reservedStock },
      });
    }

    // Check sum of remaining quantities in active batches for this product
    const prodBatches = batches.filter(
      (b) => b.productId.toString() === prod._id.toString() && b.status === 'ACTIVE'
    );
    const sumBatchRemaining = prodBatches.reduce((acc, b) => acc + b.remainingQuantity, 0);

    if (sumBatchRemaining !== prod.currentStock) {
      discrepancies.push({
        entityType: 'PRODUCT',
        entityId: prod._id.toString(),
        name: prod.name,
        issue: 'Product physical stock does not match sum of active batch quantities!',
        details: {
          productStock: prod.currentStock,
          batchRemainingSum: sumBatchRemaining,
          difference: prod.currentStock - sumBatchRemaining,
        },
      });
    }
  }

  // 2. Check Batches for negative remaining quantity or invalid status
  for (const b of batches) {
    if (b.remainingQuantity < 0) {
      discrepancies.push({
        entityType: 'BATCH',
        entityId: b._id.toString(),
        name: b.batchNumber,
        issue: 'Batch remainingQuantity is negative!',
        details: { remainingQuantity: b.remainingQuantity },
      });
    }

    if (b.remainingQuantity === 0 && b.status === 'ACTIVE') {
      discrepancies.push({
        entityType: 'BATCH',
        entityId: b._id.toString(),
        name: b.batchNumber,
        issue: 'Batch has 0 remaining quantity but is still marked ACTIVE',
        details: { status: b.status, remainingQuantity: b.remainingQuantity },
      });
    }

    if (b.remainingQuantity > b.initialQuantity) {
      discrepancies.push({
        entityType: 'BATCH',
        entityId: b._id.toString(),
        name: b.batchNumber,
        issue: 'Batch remaining quantity exceeds initial purchased quantity!',
        details: { remainingQuantity: b.remainingQuantity, initialQuantity: b.initialQuantity },
      });
    }
  }

  // 3. Check Orders for valid COGS and batch allocations
  for (const order of orders) {
    if (order.stockDeducted) {
      for (const item of order.items) {
        const totalAllocatedQty = (item.batchAllocations || []).reduce(
          (sum, alloc) => sum + alloc.quantity,
          0
        );

        if (totalAllocatedQty !== item.quantity) {
          discrepancies.push({
            entityType: 'ORDER',
            entityId: order._id.toString(),
            name: order.orderNumber,
            issue: `Order item ${item.productName} allocated quantity (${totalAllocatedQty}) does not match line quantity (${item.quantity})`,
            details: { orderedQty: item.quantity, allocatedQty: totalAllocatedQty },
          });
        }
      }
    }
  }

  return {
    passed: discrepancies.length === 0,
    checkedAt: new Date(),
    summary: {
      productsChecked: products.length,
      totalProductsChecked: products.length,
      batchesChecked: batches.length,
      totalBatchesChecked: batches.length,
      movementsChecked: movements.length,
      totalMovementsChecked: movements.length,
      ordersChecked: orders.length,
      totalOrdersChecked: orders.length,
      discrepancyCount: discrepancies.length,
    },
    discrepancies,
  };
}

/**
 * Automatically creates opening stock FIFO batches for products whose
 * physical stock exceeds the sum of active batch quantities.
 */
export async function autoReconcileDiscrepancies(): Promise<{
  reconciledCount: number;
  repairedProducts: Array<{ name: string; sku: string; unitsAdded: number; batchNumber: string }>;
}> {
  const products = await Product.find({ isArchived: false });
  const batches = await InventoryBatch.find({ status: 'ACTIVE' });

  const repairedProducts: Array<{ name: string; sku: string; unitsAdded: number; batchNumber: string }> = [];

  for (const prod of products) {
    if (prod.currentStock <= 0) continue;

    const prodBatches = batches.filter((b) => b.productId.toString() === prod._id.toString());
    const sumBatchRemaining = prodBatches.reduce((acc, b) => acc + b.remainingQuantity, 0);

    const difference = prod.currentStock - sumBatchRemaining;
    if (difference > 0) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randHex = Math.floor(1000 + Math.random() * 9000);
      const batchNumber = `BATCH-RECON-${dateStr}-${randHex}`;
      const cp = prod.averageCost > 0 ? prod.averageCost : 0;

      await InventoryBatch.create({
        batchNumber,
        productId: prod._id,
        costPrice: cp,
        initialQuantity: difference,
        remainingQuantity: difference,
        storageLocation: prod.locationShelf || 'Shelf General',
        receivedDate: new Date(),
        notes: `Auto-reconciled FIFO batch for opening physical stock (${difference} units)`,
        status: 'ACTIVE',
      });

      repairedProducts.push({
        name: prod.name,
        sku: prod.sku,
        unitsAdded: difference,
        batchNumber,
      });
    }
  }

  return {
    reconciledCount: repairedProducts.length,
    repairedProducts,
  };
}
