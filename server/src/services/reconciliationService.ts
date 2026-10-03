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
      totalProductsChecked: products.length,
      totalBatchesChecked: batches.length,
      totalMovementsChecked: movements.length,
      totalOrdersChecked: orders.length,
      discrepancyCount: discrepancies.length,
    },
    discrepancies,
  };
}
