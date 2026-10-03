import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { CollegeDispatch, ICollegeDispatchItem } from '../models/CollegeDispatch';
import { CollegeInventory } from '../models/CollegeInventory';
import { StockMovement } from '../models/StockMovement';
import { AuditLog } from '../models/AuditLog';

export interface ICreateDispatchInput {
  college: string;
  dispatchDate?: string | Date;
  items: {
    productId: string;
    quantity: number;
  }[];
  dispatchedBy: string; // userId
  notes?: string;
}

export async function createCollegeDispatch(input: ICreateDispatchInput) {
  const { college, dispatchDate = new Date(), items, dispatchedBy, notes } = input;

  if (!college || !college.trim()) {
    throw new Error('College name is required.');
  }

  if (!items || items.length === 0) {
    throw new Error('At least one hardware product must be added to the dispatch.');
  }

  // 1. Fetch products and validate stock sufficiency against Central Inventory
  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds } });

  const productMap = new Map<string, any>();
  for (const p of products) {
    productMap.set(p._id.toString(), p);
  }

  const dispatchItems: ICollegeDispatchItem[] = [];
  let totalUnits = 0;
  let totalCost = 0;

  for (const item of items) {
    if (!item.quantity || item.quantity <= 0) {
      throw new Error(`Invalid quantity ${item.quantity} for product.`);
    }

    const prod = productMap.get(item.productId.toString());
    if (!prod) {
      throw new Error(`Product with ID ${item.productId} was not found in catalog.`);
    }

    // Strict Central Stock Validation
    if (prod.currentStock < item.quantity) {
      throw new Error(
        `Insufficient stock for ${prod.name}. Available: ${prod.currentStock}, Requested: ${item.quantity}`
      );
    }

    const unitCost = Number(prod.averageCost || prod.costPrice || 0);
    const lineCost = Math.round(unitCost * item.quantity * 100) / 100;

    dispatchItems.push({
      productId: prod._id,
      productName: prod.name,
      sku: prod.sku,
      quantity: item.quantity,
      unitCost,
      totalCost: lineCost,
    });

    totalUnits += item.quantity;
    totalCost += lineCost;
  }

  // 2. Generate unique Dispatch Number
  const dateStr = new Date(dispatchDate).toISOString().slice(0, 10).replace(/-/g, '');
  const countToday = await CollegeDispatch.countDocuments({
    createdAt: {
      $gte: new Date(new Date().setHours(0, 0, 0, 0)),
    },
  });
  const dispatchNumber = `DISP-${dateStr}-${String(countToday + 1).padStart(4, '0')}`;

  // 3. Atomically decrement central stock, increment college stock, and record stock movements
  for (const item of dispatchItems) {
    const prod = productMap.get(item.productId.toString());
    const prevStock = prod.currentStock;
    const newStock = prevStock - item.quantity;

    // Decrement central inventory
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { currentStock: -item.quantity },
    });

    // Increment destination college inventory
    await CollegeInventory.findOneAndUpdate(
      { college: college.trim(), productId: item.productId },
      {
        $inc: { currentStock: item.quantity },
        $set: {
          productName: item.productName,
          sku: item.sku,
          lastDispatchedAt: new Date(dispatchDate),
        },
      },
      { upsert: true, new: true }
    );

    // Record stock movement
    await StockMovement.create({
      productId: item.productId,
      movementType: 'COLLEGE_DISPATCH',
      quantity: -item.quantity,
      previousStock: prevStock,
      newStock: newStock,
      referenceType: 'COLLEGE_DISPATCH',
      referenceId: dispatchNumber,
      costPrice: item.unitCost,
      performedBy: dispatchedBy,
      notes: `Dispatched ${item.quantity} units to ${college.trim()}`,
    });
  }

  // 4. Save College Dispatch record
  const dispatch = await CollegeDispatch.create({
    dispatchNumber,
    college: college.trim(),
    dispatchDate: new Date(dispatchDate),
    items: dispatchItems,
    totalUnits,
    totalCost: Math.round(totalCost * 100) / 100,
    dispatchedBy,
    status: 'DISPATCHED',
    notes,
  });

  // 5. Audit Log
  await AuditLog.create({
    userId: dispatchedBy,
    userName: dispatchedBy,
    role: 'STAFF',
    action: 'DISPATCH_CREATED',
    entityType: 'CollegeDispatch',
    entityId: dispatch._id.toString(),
    newState: {
      dispatchNumber,
      college: college.trim(),
      totalUnits,
      totalCost,
      itemsSummary: dispatchItems.map((i) => `${i.quantity}x ${i.productName}`).join(', '),
    },
  });

  return dispatch;
}

export async function getCollegeDispatches(filters: {
  college?: string;
  startDate?: string;
  endDate?: string;
  dispatchedBy?: string;
}) {
  const query: any = {};

  if (filters.college) {
    query.college = filters.college;
  }

  if (filters.startDate || filters.endDate) {
    query.dispatchDate = {};
    if (filters.startDate) query.dispatchDate.$gte = new Date(filters.startDate);
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      query.dispatchDate.$lte = end;
    }
  }

  if (filters.dispatchedBy) {
    query.dispatchedBy = filters.dispatchedBy;
  }

  return CollegeDispatch.find(query).sort({ dispatchDate: -1, createdAt: -1 });
}

export async function getCollegeInventory(college: string) {
  if (!college) return [];
  return CollegeInventory.find({ college, currentStock: { $gt: 0 } }).sort({ productName: 1 });
}

export async function getAllCollegesList() {
  const fromDispatches = await CollegeDispatch.distinct('college');
  const fromInventories = await CollegeInventory.distinct('college');
  const unique = Array.from(new Set([...fromDispatches, ...fromInventories].filter(Boolean)));
  return unique.sort();
}
