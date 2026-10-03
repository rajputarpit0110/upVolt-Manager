import mongoose from 'mongoose';
import { InventoryBatch, IInventoryBatch } from '../models/InventoryBatch';
import { Product } from '../models/Product';
import { IBatchAllocation } from '../models/Order';

export interface IFifoAllocationResult {
  allocations: IBatchAllocation[];
  totalCogs: number;
  weightedUnitCost: number;
}

/**
 * Allocates inventory strictly using FIFO (First-In, First-Out)
 * Pulls from oldest active batches first based on receivedDate and createdAt.
 */
export async function allocateFifoStock(
  productId: string | mongoose.Types.ObjectId,
  quantity: number,
  session?: mongoose.ClientSession
): Promise<IFifoAllocationResult> {
  if (quantity <= 0) {
    throw new Error('Quantity to allocate must be strictly positive');
  }

  const allocations: IBatchAllocation[] = [];
  let remainingToAllocate = quantity;
  let totalCogs = 0;

  // Allocate from oldest active batches using atomic decrements
  while (remainingToAllocate > 0) {
    const query = InventoryBatch.findOne({
      productId,
      status: 'ACTIVE',
      remainingQuantity: { $gt: 0 },
    }).sort({ receivedDate: 1, createdAt: 1 });

    if (session) {
      query.session(session);
    }

    const batch = await query.exec();
    if (!batch) {
      const product = await Product.findById(productId);
      const prodName = product ? product.name : 'Product';
      throw new Error(
        `Insufficient stock. Inventory batches exhausted for ${prodName}. Still needed: ${remainingToAllocate} unit(s).`
      );
    }

    const takeQty = Math.min(batch.remainingQuantity, remainingToAllocate);

    // Atomically decrement batch remainingQuantity to guarantee concurrency safety
    const updateQuery: any = {
      _id: batch._id,
      remainingQuantity: { $gte: takeQty },
    };
    const updateDoc: any = {
      $inc: { remainingQuantity: -takeQty },
    };

    const updateOptions: any = { new: true };
    if (session) {
      updateOptions.session = session;
    }

    const updatedBatch = (await InventoryBatch.findOneAndUpdate(
      updateQuery,
      updateDoc,
      updateOptions
    ).exec()) as unknown as IInventoryBatch | null;

    if (!updatedBatch) {
      // Concurrently modified, retry next iteration to get correct batch state
      continue;
    }

    if (updatedBatch.remainingQuantity === 0) {
      await InventoryBatch.updateOne(
        { _id: updatedBatch._id },
        { $set: { status: 'EXHAUSTED' } },
        session ? { session } : {}
      );
    }

    const batchCostTotal = takeQty * updatedBatch.costPrice;
    totalCogs += batchCostTotal;

    allocations.push({
      batchId: updatedBatch._id as mongoose.Types.ObjectId,
      batchNumber: updatedBatch.batchNumber,
      quantity: takeQty,
      costPrice: updatedBatch.costPrice,
    });

    remainingToAllocate -= takeQty;
  }

  const weightedUnitCost = totalCogs / quantity;

  return {
    allocations,
    totalCogs: Math.round(totalCogs * 100) / 100,
    weightedUnitCost: Math.round(weightedUnitCost * 100) / 100,
  };
}

/**
 * Restores FIFO allocations back into their original batches.
 * Used for order cancellations, order quantity reductions, and returns.
 */
export async function restoreFifoAllocations(
  allocations: IBatchAllocation[],
  session?: mongoose.ClientSession
): Promise<number> {
  let totalUnitsRestored = 0;

  for (const alloc of allocations) {
    const updateOptions: any = {};
    if (session) {
      updateOptions.session = session;
    }

    const res = await InventoryBatch.updateOne(
      { _id: alloc.batchId },
      {
        $inc: { remainingQuantity: alloc.quantity },
        $set: { status: 'ACTIVE' },
      },
      updateOptions
    );

    if (res.matchedCount > 0) {
      totalUnitsRestored += alloc.quantity;
    } else {
      console.warn(`[FIFO Engine] Warning: Batch ${alloc.batchId} (${alloc.batchNumber}) not found during restoration.`);
    }
  }

  return totalUnitsRestored;
}

/**
 * Calculates current total inventory valuation strictly from remaining inventory batches.
 * Valuation = Sum of (remainingQuantity * costPrice) for all active batches.
 */
export async function calculateCurrentInventoryValuation(
  productId?: string | mongoose.Types.ObjectId
): Promise<{ totalQuantity: number; totalCostValue: number }> {
  const match: any = { status: 'ACTIVE', remainingQuantity: { $gt: 0 } };
  if (productId) {
    match.productId = new mongoose.Types.ObjectId(productId.toString());
  }

  const result = await InventoryBatch.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalQuantity: { $sum: '$remainingQuantity' },
        totalCostValue: { $sum: { $multiply: ['$remainingQuantity', '$costPrice'] } },
      },
    },
  ]);

  if (result.length === 0) {
    return { totalQuantity: 0, totalCostValue: 0 };
  }

  return {
    totalQuantity: result[0].totalQuantity,
    totalCostValue: Math.round(result[0].totalCostValue * 100) / 100,
  };
}
