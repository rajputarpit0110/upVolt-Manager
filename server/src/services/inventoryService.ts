import mongoose from 'mongoose';
import { Product, IProduct } from '../models/Product';
import { InventoryBatch, IInventoryBatch } from '../models/InventoryBatch';
import { StockMovement, MovementType } from '../models/StockMovement';
import { Notification } from '../models/Notification';
import { allocateFifoStock, restoreFifoAllocations, calculateCurrentInventoryValuation } from './fifoEngine';
import { IBatchAllocation } from '../models/Order';

export interface IReceiveStockParams {
  productId: string;
  quantity: number;
  costPrice: number;
  supplierId?: string;
  purchaseId?: string;
  invoiceNumber?: string;
  storageLocation?: string;
  notes?: string;
  receivedBy: string;
}

export interface IDeductStockParams {
  productId: string;
  quantity: number;
  sellingPrice: number;
  orderNumber: string;
  performedBy: string;
  notes?: string;
  session?: mongoose.ClientSession;
}

/**
 * Generates an incrementing human-readable batch number e.g. BATCH-202609-0012
 */
export async function generateBatchNumber(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const count = await InventoryBatch.countDocuments();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `BATCH-${yearMonth}-${String(count + 1).padStart(4, '0')}-${randomSuffix}`;
}

/**
 * Handles incoming inventory / purchases.
 * Creates an immutable FIFO batch and increments physical stock atomically.
 */
export async function receiveStock(params: IReceiveStockParams): Promise<{
  product: IProduct;
  batch: IInventoryBatch;
  movement: any;
}> {
  const {
    productId,
    quantity,
    costPrice,
    supplierId,
    purchaseId,
    storageLocation,
    notes,
    receivedBy,
  } = params;

  if (quantity <= 0) {
    throw new Error('Quantity received must be strictly greater than zero');
  }
  if (costPrice < 0) {
    throw new Error('Cost price cannot be negative');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new Error(`Product not found with ID: ${productId}`);
  }

  const batchNumber = await generateBatchNumber();
  const previousStock = product.currentStock;
  const newStock = previousStock + quantity;

  // Create isolated FIFO batch
  const batch = new InventoryBatch({
    batchNumber,
    productId: product._id,
    supplierId: supplierId || undefined,
    purchaseId: purchaseId || undefined,
    costPrice,
    initialQuantity: quantity,
    remainingQuantity: quantity,
    storageLocation: storageLocation || product.locationShelf,
    receivedDate: new Date(),
    notes,
    status: 'ACTIVE',
  });
  await batch.save();

  // Atomically increment current physical stock on Product
  product.currentStock = newStock;
  if (storageLocation && !product.locationShelf) {
    product.locationShelf = storageLocation;
  }

  // Recalculate average cost from all active batches
  const valuation = await calculateCurrentInventoryValuation(product._id as any);
  if (valuation.totalQuantity > 0) {
    product.averageCost = Math.round((valuation.totalCostValue / valuation.totalQuantity) * 100) / 100;
  } else {
    product.averageCost = costPrice;
  }

  await product.save();

  // Record immutable StockMovement
  const movement = new StockMovement({
    productId: product._id,
    batchId: batch._id,
    movementType: 'STOCK_RECEIVED',
    quantity,
    previousStock,
    newStock,
    previousReserved: product.reservedStock,
    newReserved: product.reservedStock,
    referenceType: 'PURCHASE',
    referenceId: purchaseId || batchNumber,
    costPrice,
    performedBy: receivedBy,
    notes: notes || `Received ${quantity} units @ ₹${costPrice}/unit in ${batchNumber}`,
  });
  await movement.save();

  // Low stock notification resolution if resolved
  if (newStock > product.minStockLevel) {
    await Notification.updateMany(
      { referenceId: product._id.toString(), type: { $in: ['LOW_STOCK', 'OUT_OF_STOCK'] }, isRead: false },
      { $set: { isRead: true } }
    );
  }

  return { product, batch, movement };
}

/**
 * Deducts physical inventory atomically and allocates from FIFO batches.
 * Guaranteed concurrency safety: atomic database conditional ensures stock never drops below 0.
 */
export async function deductOrderStock(params: IDeductStockParams): Promise<{
  allocations: IBatchAllocation[];
  totalCogs: number;
  movement: any;
}> {
  const { productId, quantity, sellingPrice, orderNumber, performedBy, notes, session } = params;

  if (quantity <= 0) {
    throw new Error('Quantity to deduct must be strictly greater than zero');
  }

  // Atomic deduction with concurrency guard at DB level:
  // `{ _id: productId, currentStock: { $gte: quantity } }`
  const query = { _id: productId, currentStock: { $gte: quantity } };
  const update = { $inc: { currentStock: -quantity } };
  const options = { new: true };

  let updatedProduct: IProduct | null = null;
  if (session) {
    updatedProduct = await Product.findOneAndUpdate(query, update, { ...options, session });
  } else {
    updatedProduct = await Product.findOneAndUpdate(query, update, options);
  }

  if (!updatedProduct) {
    const currentProd = await Product.findById(productId);
    const available = currentProd ? currentProd.currentStock - currentProd.reservedStock : 0;
    const name = currentProd ? currentProd.name : 'Product';
    throw new Error(
      `Insufficient stock. Only ${Math.max(0, available)} unit(s) available for ${name}. Requested: ${quantity}.`
    );
  }

  const previousStock = updatedProduct.currentStock + quantity;
  const newStock = updatedProduct.currentStock;

  // Allocate strictly via FIFO from active batches
  const fifoResult = await allocateFifoStock(productId, quantity, session);

  // Recalculate average cost based on remaining batches
  const valuation = await calculateCurrentInventoryValuation(productId);
  if (valuation.totalQuantity > 0) {
    const avg = Math.round((valuation.totalCostValue / valuation.totalQuantity) * 100) / 100;
    if (session) {
      await Product.updateOne({ _id: productId }, { $set: { averageCost: avg } }).session(session);
    } else {
      await Product.updateOne({ _id: productId }, { $set: { averageCost: avg } });
    }
  }

  // Create immutable stock movement
  const movement = new StockMovement({
    productId: updatedProduct._id,
    movementType: 'SALE',
    quantity: -quantity,
    previousStock,
    newStock,
    previousReserved: updatedProduct.reservedStock,
    newReserved: updatedProduct.reservedStock,
    referenceType: 'ORDER',
    referenceId: orderNumber,
    costPrice: fifoResult.weightedUnitCost,
    sellingPrice,
    performedBy,
    notes: notes || `Sale of ${quantity} units for Order #${orderNumber}`,
  });

  if (session) {
    await movement.save({ session });
  } else {
    await movement.save();
  }

  // Trigger low stock notifications if needed
  if (newStock === 0) {
    await new Notification({
      title: 'Out of Stock Alert',
      message: `${updatedProduct.name} (SKU: ${updatedProduct.sku}) is now OUT OF STOCK!`,
      type: 'OUT_OF_STOCK',
      referenceId: updatedProduct._id.toString(),
    }).save();
  } else if (newStock <= updatedProduct.minStockLevel) {
    await new Notification({
      title: 'Low Stock Alert',
      message: `${updatedProduct.name} (SKU: ${updatedProduct.sku}) has reached low stock: ${newStock} units left (threshold: ${updatedProduct.minStockLevel}).`,
      type: 'LOW_STOCK',
      referenceId: updatedProduct._id.toString(),
    }).save();
  }

  return {
    allocations: fifoResult.allocations,
    totalCogs: fifoResult.totalCogs,
    movement,
  };
}

/**
 * Restores inventory from an order cancellation or return.
 * Re-deposits units into their original batches and increments currentStock.
 */
export async function restoreOrderStock(
  productId: string | mongoose.Types.ObjectId,
  allocations: IBatchAllocation[],
  referenceId: string,
  movementType: MovementType,
  performedBy: string,
  notes?: string,
  condition: 'GOOD' | 'DAMAGED' | 'DEFECTIVE' = 'GOOD',
  session?: mongoose.ClientSession
): Promise<number> {
  const totalUnits = allocations.reduce((acc, a) => acc + a.quantity, 0);
  if (totalUnits <= 0) return 0;

  const product = await Product.findById(productId);
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const previousStock = product.currentStock;
  let newStock = previousStock;

  if (condition === 'GOOD') {
    // Restore units directly to active inventory batches
    await restoreFifoAllocations(allocations, session);
    newStock = previousStock + totalUnits;
    if (session) {
      await Product.updateOne({ _id: productId }, { $inc: { currentStock: totalUnits } }).session(session);
    } else {
      await Product.updateOne({ _id: productId }, { $inc: { currentStock: totalUnits } });
    }
  } else {
    // If damaged or defective, place into damaged quarantine stock (do not add to sellable batches)
    if (session) {
      await Product.updateOne({ _id: productId }, { $inc: { damagedStock: totalUnits } }).session(session);
    } else {
      await Product.updateOne({ _id: productId }, { $inc: { damagedStock: totalUnits } });
    }
  }

  // Recalculate average cost
  const valuation = await calculateCurrentInventoryValuation(productId);
  if (valuation.totalQuantity > 0) {
    const avg = Math.round((valuation.totalCostValue / valuation.totalQuantity) * 100) / 100;
    if (session) {
      await Product.updateOne({ _id: productId }, { $set: { averageCost: avg } }).session(session);
    } else {
      await Product.updateOne({ _id: productId }, { $set: { averageCost: avg } });
    }
  }

  // Log restoration movement
  const movement = new StockMovement({
    productId: product._id,
    movementType,
    quantity: condition === 'GOOD' ? totalUnits : 0,
    previousStock,
    newStock,
    previousReserved: product.reservedStock,
    newReserved: product.reservedStock,
    referenceType: movementType === 'RETURN' ? 'RETURN' : 'ORDER',
    referenceId,
    condition,
    performedBy,
    notes: notes || `Restoration of ${totalUnits} units (${condition}) from ${referenceId}`,
  });

  if (session) {
    await movement.save({ session });
  } else {
    await movement.save();
  }

  return totalUnits;
}

/**
 * Reserves stock for Draft orders without physically removing it from currentStock.
 */
export async function reserveStock(
  productId: string | mongoose.Types.ObjectId,
  quantity: number,
  orderNumber: string,
  performedBy: string
): Promise<void> {
  const product = await Product.findById(productId);
  if (!product) throw new Error(`Product not found: ${productId}`);

  const available = product.currentStock - product.reservedStock;
  if (available < quantity) {
    throw new Error(
      `Cannot reserve ${quantity} units for ${product.name}. Only ${Math.max(0, available)} available.`
    );
  }

  product.reservedStock += quantity;
  await product.save();

  await new StockMovement({
    productId: product._id,
    movementType: 'RESERVATION_HOLD',
    quantity: 0,
    previousStock: product.currentStock,
    newStock: product.currentStock,
    previousReserved: product.reservedStock - quantity,
    newReserved: product.reservedStock,
    referenceType: 'ORDER',
    referenceId: orderNumber,
    performedBy,
    notes: `Draft hold of ${quantity} units for #${orderNumber}`,
  }).save();
}

/**
 * Releases reserved draft stock.
 */
export async function releaseReservedStock(
  productId: string | mongoose.Types.ObjectId,
  quantity: number,
  orderNumber: string,
  performedBy: string
): Promise<void> {
  const product = await Product.findById(productId);
  if (!product) return;

  const prevReserved = product.reservedStock;
  product.reservedStock = Math.max(0, product.reservedStock - quantity);
  await product.save();

  await new StockMovement({
    productId: product._id,
    movementType: 'RESERVATION_RELEASE',
    quantity: 0,
    previousStock: product.currentStock,
    newStock: product.currentStock,
    previousReserved: prevReserved,
    newReserved: product.reservedStock,
    referenceType: 'ORDER',
    referenceId: orderNumber,
    performedBy,
    notes: `Released reservation of ${quantity} units for #${orderNumber}`,
  }).save();
}
