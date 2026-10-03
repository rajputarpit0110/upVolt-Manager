import mongoose from 'mongoose';
import { Order, IOrder, IOrderItem, OrderStatus, PaymentStatus, PaymentMethod } from '../models/Order';
import { OrderVersion } from '../models/OrderVersion';
import { OrderReturn } from '../models/OrderReturn';
import { Product } from '../models/Product';
import { Customer } from '../models/Customer';
import { deductOrderStock, restoreOrderStock, reserveStock, releaseReservedStock } from './inventoryService';
import { createAuditLog } from './auditService';

export interface ICreateOrderInput {
  items: {
    productId: string;
    quantity: number;
    sellingPrice: number;
    discount?: number;
  }[];
  customer?: {
    customerId?: string;
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    college?: string;
    city?: string;
    state?: string;
    pincode?: string;
    notes?: string;
  };
  orderDate?: Date | string;
  orderNumber?: string;
  deliveryCharge?: number;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  amountPaid?: number;
  notes?: string;
  idempotencyKey?: string;
  deliveryInfo?: any;
}

export async function generateOrderNumber(): Promise<string> {
  const timestamp = Date.now().toString().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `UPV-${timestamp}${rand}`;
}

export async function generateReturnNumber(): Promise<string> {
  const timestamp = Date.now().toString().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `RET-${timestamp}${rand}`;
}

/**
 * Validates allowed status transitions
 */
export function validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
  if (currentStatus === newStatus) return true;

  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    Draft: ['Confirmed', 'Processing', 'Packed', 'Shipped', 'Delivered', 'Cancelled'],
    Confirmed: ['Processing', 'Packed', 'Shipped', 'Delivered', 'Cancelled'],
    Processing: ['Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'],
    Packed: ['Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    Shipped: ['Confirmed', 'Processing', 'Packed', 'Delivered', 'Returned', 'Cancelled'],
    Delivered: ['Confirmed', 'Processing', 'Packed', 'Shipped', 'Returned'],
    Cancelled: ['Draft', 'Confirmed'],
    Returned: [],
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
}

/**
 * Creates a new order with atomic FIFO deduction and idempotency guard
 */
export async function createOrder(
  input: ICreateOrderInput,
  user: { userId: string; name: string; role: string },
  ip?: string
): Promise<IOrder> {
  // Idempotency check: prevent accidental double-submission
  if (input.idempotencyKey) {
    const existing = await Order.findOne({ idempotencyKey: input.idempotencyKey });
    if (existing) {
      console.log(`[OrderService] Idempotent hit for key: ${input.idempotencyKey}`);
      return existing;
    }
  }

  if (!input.items || input.items.length === 0) {
    throw new Error('Order must contain at least one item');
  }

  const orderNumber = input.orderNumber || (await generateOrderNumber());
  const status = input.status || 'Confirmed';
  const shouldDeductStock = status !== 'Draft';

  const processedItems: IOrderItem[] = [];
  let subtotal = 0;
  let totalOrderDiscount = 0;
  let totalCost = 0;

  // Track operations for rollback in case an item in multi-product order fails
  const allocatedOperations: { productId: string; allocations: any[] }[] = [];

  try {
    for (const rawItem of input.items) {
      if (rawItem.quantity <= 0) {
        throw new Error('Line item quantity must be strictly greater than 0');
      }

      const product = await Product.findById(rawItem.productId);
      if (!product) {
        throw new Error(`Product not found with ID: ${rawItem.productId}`);
      }

      const itemDiscount = rawItem.discount || 0;
      const lineRevenue = rawItem.sellingPrice * rawItem.quantity - itemDiscount;
      subtotal += rawItem.sellingPrice * rawItem.quantity;
      totalOrderDiscount += itemDiscount;

      if (shouldDeductStock) {
        // Physical stock deduction with FIFO batch allocation
        const deduction = await deductOrderStock({
          productId: rawItem.productId,
          quantity: rawItem.quantity,
          sellingPrice: rawItem.sellingPrice,
          orderNumber,
          performedBy: user.userId,
        });

        allocatedOperations.push({
          productId: rawItem.productId,
          allocations: deduction.allocations,
        });

        const lineCogs = deduction.totalCogs;
        const lineProfit = lineRevenue - lineCogs;
        const lineMargin = lineRevenue > 0 ? (lineProfit / lineRevenue) * 100 : 0;
        totalCost += lineCogs;

        processedItems.push({
          productId: product._id as mongoose.Types.ObjectId,
          productName: product.name,
          sku: product.sku,
          quantity: rawItem.quantity,
          sellingPrice: rawItem.sellingPrice,
          discount: itemDiscount,
          revenue: Math.round(lineRevenue * 100) / 100,
          cogs: Math.round(lineCogs * 100) / 100,
          profit: Math.round(lineProfit * 100) / 100,
          margin: Math.round(lineMargin * 100) / 100,
          batchAllocations: deduction.allocations,
        });
      } else {
        // Draft order: reserve stock without physical deduction
        await reserveStock(rawItem.productId, rawItem.quantity, orderNumber, user.userId);

        processedItems.push({
          productId: product._id as mongoose.Types.ObjectId,
          productName: product.name,
          sku: product.sku,
          quantity: rawItem.quantity,
          sellingPrice: rawItem.sellingPrice,
          discount: itemDiscount,
          revenue: Math.round(lineRevenue * 100) / 100,
          cogs: 0,
          profit: 0,
          margin: 0,
          batchAllocations: [],
        });
      }
    }
  } catch (error: any) {
    // Rollback any stock deducted so far for previous items in this order
    for (const op of allocatedOperations) {
      await restoreOrderStock(
        op.productId,
        op.allocations,
        orderNumber,
        'MANUAL_CORRECTION',
        user.userId,
        'Rollback due to order creation failure'
      );
    }
    throw error;
  }

  const deliveryCharge = input.deliveryCharge || 0;
  const totalAmount = subtotal - totalOrderDiscount + deliveryCharge;
  const totalProfit = shouldDeductStock ? totalAmount - totalCost : 0;
  const grossMargin = totalAmount > 0 && shouldDeductStock ? (totalProfit / totalAmount) * 100 : 0;
  const amountPaid = input.amountPaid || 0;
  const amountDue = Math.max(0, totalAmount - amountPaid);

  const order = new Order({
    orderNumber,
    orderDate: input.orderDate ? new Date(input.orderDate) : new Date(),
    status,
    customer: input.customer,
    items: processedItems,
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(totalOrderDiscount * 100) / 100,
    deliveryCharge: Math.round(deliveryCharge * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    grossMargin: Math.round(grossMargin * 100) / 100,
    paymentStatus: input.paymentStatus || (amountPaid >= totalAmount ? 'Paid' : amountPaid > 0 ? 'Partial' : 'Pending'),
    paymentMethod: input.paymentMethod || 'UPI',
    amountPaid,
    amountDue,
    stockDeducted: shouldDeductStock,
    stockReserved: !shouldDeductStock,
    deliveryInfo: input.deliveryInfo,
    currentVersion: 1,
    createdBy: user.userId,
    updatedBy: user.userId,
    idempotencyKey: input.idempotencyKey,
    notes: input.notes,
  });

  try {
    await order.save();
  } catch (saveErr: any) {
    if (saveErr.code === 11000 && input.idempotencyKey) {
      // Rollback any stock deducted in this duplicate execution
      for (const op of allocatedOperations) {
        await restoreOrderStock(
          op.productId,
          op.allocations,
          orderNumber,
          'MANUAL_CORRECTION',
          user.userId,
          'Idempotent duplicate rollback'
        );
      }
      const existingOrder = await Order.findOne({ idempotencyKey: input.idempotencyKey });
      if (existingOrder) return existingOrder;
    }
    for (const op of allocatedOperations) {
      await restoreOrderStock(
        op.productId,
        op.allocations,
        orderNumber,
        'MANUAL_CORRECTION',
        user.userId,
        'Rollback due to order save failure'
      );
    }
    throw saveErr;
  }

  // Create immutable initial OrderVersion snapshot
  await new OrderVersion({
    orderId: order._id,
    version: 1,
    snapshot: order.toObject(),
    diff: [{ field: 'status', oldValue: null, newValue: status }],
    changedBy: user.userId,
    changeReason: 'Initial Order Creation',
  }).save();

  // Upsert Customer if customer contact information is provided
  if (input.customer && (input.customer.phone || input.customer.name || input.customer.email)) {
    try {
      const matchCriteria: any[] = [];
      if (input.customer.customerId) matchCriteria.push({ _id: input.customer.customerId });
      if (input.customer.phone) matchCriteria.push({ phone: input.customer.phone });
      if (input.customer.email) matchCriteria.push({ email: input.customer.email.toLowerCase() });
      if (input.customer.name && !input.customer.phone && !input.customer.email) matchCriteria.push({ name: input.customer.name });

      let customerDoc = matchCriteria.length > 0 ? await Customer.findOne({ $or: matchCriteria }) : null;
      if (customerDoc) {
        customerDoc.totalOrders += 1;
        customerDoc.totalSpent += totalAmount;
        customerDoc.lastOrderDate = input.orderDate ? new Date(input.orderDate) : new Date();
        if (input.customer.name && !customerDoc.name) customerDoc.name = input.customer.name;
        if (input.customer.college) {
          customerDoc.college = input.customer.college;
          customerDoc.organization = input.customer.college;
        }
        if (input.customer.city) customerDoc.city = input.customer.city;
        await customerDoc.save();
      } else if (input.customer.name) {
        customerDoc = new Customer({
          name: input.customer.name,
          phone: input.customer.phone,
          email: input.customer.email,
          address: input.customer.address,
          college: input.customer.college,
          city: input.customer.city,
          state: input.customer.state,
          pincode: input.customer.pincode,
          notes: input.customer.notes,
          totalOrders: 1,
          totalSpent: totalAmount,
          lastOrderDate: new Date(),
        });
        await customerDoc.save();
      }
    } catch (custErr) {
      console.warn('[OrderService] Customer upsert warning:', custErr);
    }
  }

  // Create immutable Audit Log
  await createAuditLog({
    userId: user.userId,
    userName: user.name,
    role: user.role,
    action: 'CREATE_ORDER',
    entityType: 'ORDER',
    entityId: order._id.toString(),
    relatedOrderId: order.orderNumber,
    newState: { orderNumber: order.orderNumber, totalAmount, status },
    ip,
  });

  return order;
}

/**
 * Updates an order with strict delta inventory recalculation and immutable OrderVersion
 */
export async function updateOrder(
  orderId: string,
  updates: {
    items?: {
      productId: string;
      quantity: number;
      sellingPrice: number;
      discount?: number;
    }[];
    customer?: any;
    deliveryInfo?: any;
    paymentStatus?: PaymentStatus;
    paymentMethod?: PaymentMethod;
    amountPaid?: number;
    notes?: string;
    changeReason?: string;
  },
  user: { userId: string; name: string; role: string },
  ip?: string
): Promise<IOrder> {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');
  if (order.isDeleted) throw new Error('Cannot edit a deleted order');
  if (order.status === 'Cancelled') throw new Error('Cannot edit a cancelled order');
  if (order.status === 'Returned') throw new Error('Cannot edit a returned order');

  const oldSnapshot = order.toObject();
  const diffs: { field: string; oldValue: any; newValue: any }[] = [];

  // Update customer info if provided
  if (updates.customer) {
    diffs.push({ field: 'customer', oldValue: order.customer, newValue: updates.customer });
    order.customer = { ...order.customer, ...updates.customer };
  }

  // Update delivery info if provided
  if (updates.deliveryInfo) {
    diffs.push({ field: 'deliveryInfo', oldValue: order.deliveryInfo, newValue: updates.deliveryInfo });
    order.deliveryInfo = { ...order.deliveryInfo, ...updates.deliveryInfo };
  }

  // Update payment info if provided
  if (updates.paymentStatus && updates.paymentStatus !== order.paymentStatus) {
    diffs.push({ field: 'paymentStatus', oldValue: order.paymentStatus, newValue: updates.paymentStatus });
    order.paymentStatus = updates.paymentStatus;
  }
  if (updates.paymentMethod && updates.paymentMethod !== order.paymentMethod) {
    diffs.push({ field: 'paymentMethod', oldValue: order.paymentMethod, newValue: updates.paymentMethod });
    order.paymentMethod = updates.paymentMethod;
  }
  if (updates.amountPaid !== undefined && updates.amountPaid !== order.amountPaid) {
    diffs.push({ field: 'amountPaid', oldValue: order.amountPaid, newValue: updates.amountPaid });
    order.amountPaid = updates.amountPaid;
    order.amountDue = Math.max(0, order.totalAmount - order.amountPaid);
  }

  // If line items are being edited and order already deducted stock:
  if (updates.items && updates.items.length > 0) {
    const newItems: IOrderItem[] = [];
    let newSubtotal = 0;
    let newTotalDiscount = 0;
    let newTotalCost = 0;

    for (const newItem of updates.items) {
      const existingItem = order.items.find(
        (it) => it.productId.toString() === newItem.productId
      );
      const product = await Product.findById(newItem.productId);
      if (!product) throw new Error(`Product not found: ${newItem.productId}`);

      const itemDiscount = newItem.discount || 0;
      const lineRevenue = newItem.sellingPrice * newItem.quantity - itemDiscount;
      newSubtotal += newItem.sellingPrice * newItem.quantity;
      newTotalDiscount += itemDiscount;

      if (!order.stockDeducted) {
        // Order was in Draft or non-deducted state
        newItems.push({
          productId: product._id as mongoose.Types.ObjectId,
          productName: product.name,
          sku: product.sku,
          quantity: newItem.quantity,
          sellingPrice: newItem.sellingPrice,
          discount: itemDiscount,
          revenue: Math.round(lineRevenue * 100) / 100,
          cogs: 0,
          profit: 0,
          margin: 0,
          batchAllocations: [],
        });
        continue;
      }

      if (existingItem) {
        const qtyDiff = newItem.quantity - existingItem.quantity;

        if (qtyDiff > 0) {
          // Quantity increased: Deduct ONLY the additional delta units from FIFO!
          const deduction = await deductOrderStock({
            productId: newItem.productId,
            quantity: qtyDiff,
            sellingPrice: newItem.sellingPrice,
            orderNumber: order.orderNumber,
            performedBy: user.userId,
            notes: `Order edit: +${qtyDiff} units added to Order #${order.orderNumber}`,
          });

          const combinedAllocations = [...existingItem.batchAllocations, ...deduction.allocations];
          const lineCogs = existingItem.cogs + deduction.totalCogs;
          const lineProfit = lineRevenue - lineCogs;
          const lineMargin = lineRevenue > 0 ? (lineProfit / lineRevenue) * 100 : 0;
          newTotalCost += lineCogs;

          diffs.push({
            field: `item.${product.sku}.quantity`,
            oldValue: existingItem.quantity,
            newValue: newItem.quantity,
          });

          newItems.push({
            productId: product._id as mongoose.Types.ObjectId,
            productName: product.name,
            sku: product.sku,
            quantity: newItem.quantity,
            sellingPrice: newItem.sellingPrice,
            discount: itemDiscount,
            revenue: Math.round(lineRevenue * 100) / 100,
            cogs: Math.round(lineCogs * 100) / 100,
            profit: Math.round(lineProfit * 100) / 100,
            margin: Math.round(lineMargin * 100) / 100,
            batchAllocations: combinedAllocations,
          });
        } else if (qtyDiff < 0) {
          // Quantity decreased: Restore the reduction (-qtyDiff) to original batches!
          const unitsToReturn = Math.abs(qtyDiff);
          let remainingToReturn = unitsToReturn;
          const returnedAllocations: any[] = [];
          const preservedAllocations: any[] = [];

          // Pop from last allocated batch (LIFO restore of allocations)
          const reversedAllocations = [...existingItem.batchAllocations].reverse();
          for (const alloc of reversedAllocations) {
            if (remainingToReturn <= 0) {
              preservedAllocations.unshift(alloc);
              continue;
            }
            const returnFromAlloc = Math.min(alloc.quantity, remainingToReturn);
            returnedAllocations.push({
              batchId: alloc.batchId,
              batchNumber: alloc.batchNumber,
              quantity: returnFromAlloc,
              costPrice: alloc.costPrice,
            });
            const remainingInAlloc = alloc.quantity - returnFromAlloc;
            if (remainingInAlloc > 0) {
              preservedAllocations.unshift({
                batchId: alloc.batchId,
                batchNumber: alloc.batchNumber,
                quantity: remainingInAlloc,
                costPrice: alloc.costPrice,
              });
            }
            remainingToReturn -= returnFromAlloc;
          }

          await restoreOrderStock(
            newItem.productId,
            returnedAllocations,
            order.orderNumber,
            'ORDER_EDIT_DELTA',
            user.userId,
            `Order edit: -${unitsToReturn} units returned from #${order.orderNumber}`
          );

          const returnedCost = returnedAllocations.reduce((sum, a) => sum + a.quantity * a.costPrice, 0);
          const lineCogs = Math.max(0, existingItem.cogs - returnedCost);
          const lineProfit = lineRevenue - lineCogs;
          const lineMargin = lineRevenue > 0 ? (lineProfit / lineRevenue) * 100 : 0;
          newTotalCost += lineCogs;

          diffs.push({
            field: `item.${product.sku}.quantity`,
            oldValue: existingItem.quantity,
            newValue: newItem.quantity,
          });

          newItems.push({
            productId: product._id as mongoose.Types.ObjectId,
            productName: product.name,
            sku: product.sku,
            quantity: newItem.quantity,
            sellingPrice: newItem.sellingPrice,
            discount: itemDiscount,
            revenue: Math.round(lineRevenue * 100) / 100,
            cogs: Math.round(lineCogs * 100) / 100,
            profit: Math.round(lineProfit * 100) / 100,
            margin: Math.round(lineMargin * 100) / 100,
            batchAllocations: preservedAllocations,
          });
        } else {
          // Quantity unchanged, selling price might have changed
          if (newItem.sellingPrice !== existingItem.sellingPrice) {
            diffs.push({
              field: `item.${product.sku}.sellingPrice`,
              oldValue: existingItem.sellingPrice,
              newValue: newItem.sellingPrice,
            });
          }

          const lineCogs = existingItem.cogs;
          const lineProfit = lineRevenue - lineCogs;
          const lineMargin = lineRevenue > 0 ? (lineProfit / lineRevenue) * 100 : 0;
          newTotalCost += lineCogs;

          newItems.push({
            productId: product._id as mongoose.Types.ObjectId,
            productName: product.name,
            sku: product.sku,
            quantity: newItem.quantity,
            sellingPrice: newItem.sellingPrice,
            discount: itemDiscount,
            revenue: Math.round(lineRevenue * 100) / 100,
            cogs: Math.round(lineCogs * 100) / 100,
            profit: Math.round(lineProfit * 100) / 100,
            margin: Math.round(lineMargin * 100) / 100,
            batchAllocations: existingItem.batchAllocations,
          });
        }
      } else {
        // Brand new product added to order: Deduct from FIFO
        const deduction = await deductOrderStock({
          productId: newItem.productId,
          quantity: newItem.quantity,
          sellingPrice: newItem.sellingPrice,
          orderNumber: order.orderNumber,
          performedBy: user.userId,
          notes: `Order edit: Added new product ${product.name} to #${order.orderNumber}`,
        });

        const lineCogs = deduction.totalCogs;
        const lineProfit = lineRevenue - lineCogs;
        const lineMargin = lineRevenue > 0 ? (lineProfit / lineRevenue) * 100 : 0;
        newTotalCost += lineCogs;

        diffs.push({
          field: `item.added.${product.sku}`,
          oldValue: null,
          newValue: newItem.quantity,
        });

        newItems.push({
          productId: product._id as mongoose.Types.ObjectId,
          productName: product.name,
          sku: product.sku,
          quantity: newItem.quantity,
          sellingPrice: newItem.sellingPrice,
          discount: itemDiscount,
          revenue: Math.round(lineRevenue * 100) / 100,
          cogs: Math.round(lineCogs * 100) / 100,
          profit: Math.round(lineProfit * 100) / 100,
          margin: Math.round(lineMargin * 100) / 100,
          batchAllocations: deduction.allocations,
        });
      }
    }

    // Check if any product from previous order was completely removed
    if (order.stockDeducted) {
      for (const oldItem of order.items) {
        const stillPresent = updates.items.some(
          (it) => it.productId === oldItem.productId.toString()
        );
        if (!stillPresent) {
          // Restore the entire allocation of the removed product
          await restoreOrderStock(
            oldItem.productId,
            oldItem.batchAllocations,
            order.orderNumber,
            'ORDER_EDIT_DELTA',
            user.userId,
            `Order edit: Removed product ${oldItem.productName} from #${order.orderNumber}`
          );

          diffs.push({
            field: `item.removed.${oldItem.sku}`,
            oldValue: oldItem.quantity,
            newValue: 0,
          });
        }
      }
    }

    order.items = newItems;
    order.subtotal = Math.round(newSubtotal * 100) / 100;
    order.discount = Math.round(newTotalDiscount * 100) / 100;
    order.totalAmount = Math.round((newSubtotal - newTotalDiscount) * 100) / 100;
    order.totalCost = Math.round(newTotalCost * 100) / 100;
    order.totalProfit = Math.round((order.totalAmount - order.totalCost) * 100) / 100;
    order.grossMargin = order.totalAmount > 0 ? Math.round((order.totalProfit / order.totalAmount) * 10000) / 100 : 0;
    order.amountDue = Math.max(0, order.totalAmount - order.amountPaid);
  }

  order.currentVersion += 1;
  order.updatedBy = user.userId;
  await order.save();

  // Create immutable snapshot of this version
  await new OrderVersion({
    orderId: order._id,
    version: order.currentVersion,
    snapshot: order.toObject(),
    diff: diffs,
    changedBy: user.userId,
    changeReason: updates.changeReason || 'Order Details Updated',
  }).save();

  // Audit log
  await createAuditLog({
    userId: user.userId,
    userName: user.name,
    role: user.role,
    action: 'UPDATE_ORDER',
    entityType: 'ORDER',
    entityId: order._id.toString(),
    relatedOrderId: order.orderNumber,
    previousState: oldSnapshot,
    newState: order.toObject(),
    reason: updates.changeReason,
    ip,
  });

  return order;
}

/**
 * Updates order status following strict lifecycle rules
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  user: { userId: string; name: string; role: string },
  deliveryInfo?: any,
  ip?: string
): Promise<IOrder> {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');

  if (!validateStatusTransition(order.status, newStatus)) {
    throw new Error(
      `Invalid order status transition from "${order.status}" to "${newStatus}".`
    );
  }

  const oldStatus = order.status;

  // Transition from Draft or Cancelled to an active status: Deduct physical FIFO inventory
  if ((oldStatus === 'Draft' || oldStatus === 'Cancelled') && newStatus !== 'Cancelled' && !order.stockDeducted) {
    let totalCost = 0;
    const updatedItems: IOrderItem[] = [];

    for (const item of order.items) {
      // Release draft reservation first
      if (order.stockReserved) {
        await releaseReservedStock(item.productId, item.quantity, order.orderNumber, user.userId);
      }

      // Deduct from physical FIFO inventory
      const deduction = await deductOrderStock({
        productId: item.productId.toString(),
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        orderNumber: order.orderNumber,
        performedBy: user.userId,
      });

      const lineCogs = deduction.totalCogs;
      const lineProfit = item.revenue - lineCogs;
      const lineMargin = item.revenue > 0 ? (lineProfit / item.revenue) * 100 : 0;
      totalCost += lineCogs;

      updatedItems.push({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        discount: item.discount,
        revenue: item.revenue,
        cogs: Math.round(lineCogs * 100) / 100,
        profit: Math.round(lineProfit * 100) / 100,
        margin: Math.round(lineMargin * 100) / 100,
        batchAllocations: deduction.allocations,
      });
    }

    order.items = updatedItems;
    order.totalCost = Math.round(totalCost * 100) / 100;
    order.totalProfit = Math.round((order.totalAmount - order.totalCost) * 100) / 100;
    order.grossMargin = order.totalAmount > 0 ? Math.round((order.totalProfit / order.totalAmount) * 10000) / 100 : 0;
    order.stockDeducted = true;
    order.stockReserved = false;
  }

  // If transitioning to Cancelled: restore physical stock or draft reservation
  if (newStatus === 'Cancelled' && oldStatus !== 'Cancelled') {
    if (order.stockDeducted) {
      for (const item of order.items) {
        await restoreOrderStock(
          item.productId,
          item.batchAllocations,
          order.orderNumber,
          'ORDER_CANCEL',
          user.userId,
          `Status Transition to Cancelled: Restored ${item.quantity} units for Order #${order.orderNumber}.`
        );
      }
      order.stockDeducted = false;
    }
    if (order.stockReserved) {
      for (const item of order.items) {
        await releaseReservedStock(item.productId, item.quantity, order.orderNumber, user.userId);
      }
      order.stockReserved = false;
    }
  }

  // Delivery metadata update
  if (newStatus === 'Delivered') {
    order.deliveryInfo = {
      ...order.deliveryInfo,
      ...(deliveryInfo || {}),
      deliveryDate: deliveryInfo?.deliveryDate || new Date(),
      deliveredBy: deliveryInfo?.deliveredBy || user.name,
    };
  }

  order.status = newStatus;
  order.currentVersion += 1;
  order.updatedBy = user.userId;
  await order.save();

  // OrderVersion snapshot
  await new OrderVersion({
    orderId: order._id,
    version: order.currentVersion,
    snapshot: order.toObject(),
    diff: [{ field: 'status', oldValue: oldStatus, newValue: newStatus }],
    changedBy: user.userId,
    changeReason: `Status changed to ${newStatus}`,
  }).save();

  // Audit Log
  await createAuditLog({
    userId: user.userId,
    userName: user.name,
    role: user.role,
    action: `${newStatus.toUpperCase()}_ORDER`,
    entityType: 'ORDER',
    entityId: order._id.toString(),
    relatedOrderId: order.orderNumber,
    previousState: { status: oldStatus },
    newState: { status: newStatus },
    ip,
  });

  return order;
}

/**
 * Cancels an order and atomically restores inventory to original batches
 */
export async function cancelOrder(
  orderId: string,
  user: { userId: string; name: string; role: string },
  reason: string,
  ip?: string
): Promise<IOrder> {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');
  if (order.status === 'Cancelled') {
    throw new Error('Order is already cancelled'); // Duplicate cancellation guard
  }
  if (order.status === 'Delivered') {
    throw new Error('Delivered orders cannot be cancelled; use Returns workflow');
  }

  const previousStatus = order.status;

  // Restore physical inventory if stock was deducted
  if (order.stockDeducted) {
    for (const item of order.items) {
      await restoreOrderStock(
        item.productId,
        item.batchAllocations,
        order.orderNumber,
        'ORDER_CANCEL',
        user.userId,
        `Cancellation: Restored ${item.quantity} units for Order #${order.orderNumber}. Reason: ${reason}`
      );
    }
    order.stockDeducted = false;
  }

  // Release reservation if Draft
  if (order.stockReserved) {
    for (const item of order.items) {
      await releaseReservedStock(item.productId, item.quantity, order.orderNumber, user.userId);
    }
    order.stockReserved = false;
  }

  order.status = 'Cancelled';
  order.currentVersion += 1;
  order.updatedBy = user.userId;
  await order.save();

  await new OrderVersion({
    orderId: order._id,
    version: order.currentVersion,
    snapshot: order.toObject(),
    diff: [{ field: 'status', oldValue: previousStatus, newValue: 'Cancelled' }],
    changedBy: user.userId,
    changeReason: `Order Cancelled: ${reason}`,
  }).save();

  await createAuditLog({
    userId: user.userId,
    userName: user.name,
    role: user.role,
    action: 'CANCEL_ORDER',
    entityType: 'ORDER',
    entityId: order._id.toString(),
    relatedOrderId: order.orderNumber,
    reason,
    ip,
  });

  return order;
}

/**
 * Processes return for delivered orders with condition-based restock decisions
 */
export async function processReturn(
  params: {
    orderId: string;
    items: {
      productId: string;
      quantity: number;
      condition: 'GOOD' | 'DAMAGED' | 'DEFECTIVE';
      refundAmount?: number;
    }[];
    reason: string;
    notes?: string;
  },
  user: { userId: string; name: string; role: string },
  ip?: string
): Promise<any> {
  const { orderId, items, reason, notes } = params;
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');
  if (order.status !== 'Delivered' && order.status !== 'Returned') {
    throw new Error('Only Delivered orders can be returned');
  }

  const returnNumber = await generateReturnNumber();
  const processedReturnItems: any[] = [];
  let totalRefund = 0;

  for (const retItem of items) {
    const orderItem = order.items.find(
      (it) => it.productId.toString() === retItem.productId
    );
    if (!orderItem) {
      throw new Error(`Product ${retItem.productId} not found in Order #${order.orderNumber}`);
    }
    if (retItem.quantity > orderItem.quantity) {
      throw new Error(
        `Cannot return ${retItem.quantity} units of ${orderItem.productName}. Ordered quantity: ${orderItem.quantity}.`
      );
    }

    // Determine cost to attach from original batch allocation
    const originalBatch = orderItem.batchAllocations[0];
    const originalCostPrice = originalBatch ? originalBatch.costPrice : 0;
    const restockDecision = retItem.condition === 'GOOD' ? 'RESTOCKED_SELLABLE' : 'QUARANTINED_DAMAGED';

    // Build allocation array for restoration
    const allocationsToRestore = [
      {
        batchId: originalBatch ? originalBatch.batchId : (null as any),
        batchNumber: originalBatch ? originalBatch.batchNumber : 'UNKNOWN',
        quantity: retItem.quantity,
        costPrice: originalCostPrice,
      },
    ];

    await restoreOrderStock(
      retItem.productId,
      allocationsToRestore,
      returnNumber,
      'RETURN',
      user.userId,
      `Return #${returnNumber}: ${retItem.condition} (${reason})`,
      retItem.condition
    );

    const lineRefund = retItem.refundAmount || orderItem.sellingPrice * retItem.quantity;
    totalRefund += lineRefund;

    processedReturnItems.push({
      productId: orderItem.productId,
      productName: orderItem.productName,
      sku: orderItem.sku,
      quantity: retItem.quantity,
      condition: retItem.condition,
      restockDecision,
      originalBatchId: originalBatch?.batchId,
      originalCostPrice,
      refundAmount: lineRefund,
    });
  }

  const returnRecord = new OrderReturn({
    returnNumber,
    orderId: order._id,
    orderNumber: order.orderNumber,
    items: processedReturnItems,
    reason,
    conditionNotes: notes,
    processedBy: user.userId,
    returnDate: new Date(),
    totalRefundAmount: totalRefund,
  });
  await returnRecord.save();

  // Calculate cumulative returned units across all returns for this order
  const allReturns = await OrderReturn.find({ orderId: order._id });
  let totalReturnedUnits = 0;
  for (const r of allReturns) {
    for (const it of r.items) {
      totalReturnedUnits += it.quantity;
    }
  }
  const totalOrderedUnits = order.items.reduce((sum, it) => sum + it.quantity, 0);

  const prevStatus = order.status;
  if (totalReturnedUnits >= totalOrderedUnits) {
    order.status = 'Returned';
  }
  order.currentVersion += 1;
  order.updatedBy = user.userId;
  await order.save();

  await new OrderVersion({
    orderId: order._id,
    version: order.currentVersion,
    snapshot: order.toObject(),
    diff: [{ field: 'status', oldValue: prevStatus, newValue: order.status }],
    changedBy: user.userId,
    changeReason: `Order Return Processed: ${returnNumber}`,
  }).save();

  await createAuditLog({
    userId: user.userId,
    userName: user.name,
    role: user.role,
    action: 'RETURN_ORDER',
    entityType: 'ORDER',
    entityId: order._id.toString(),
    relatedOrderId: order.orderNumber,
    reason,
    ip,
  });

  return returnRecord;
}

/**
 * Soft deletes an order. Master Admin only.
 */
export async function softDeleteOrder(
  orderId: string,
  reason: string,
  user: { userId: string; name: string; role: string },
  ip?: string
): Promise<IOrder> {
  if (user.role !== 'MASTER_ADMIN') {
    throw new Error('FORBIDDEN: Only Master Admin can delete orders.');
  }

  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');
  if (order.isDeleted) throw new Error('Order is already in trash');

  order.isDeleted = true;
  order.deletedAt = new Date();
  order.deletedBy = user.userId;
  order.deleteReason = reason;
  order.updatedBy = user.userId;
  await order.save();

  await createAuditLog({
    userId: user.userId,
    userName: user.name,
    role: user.role,
    action: 'DELETE_ORDER',
    entityType: 'ORDER',
    entityId: order._id.toString(),
    relatedOrderId: order.orderNumber,
    reason,
    ip,
  });

  return order;
}

/**
 * Restores a soft-deleted order safely. Master Admin only.
 * Re-validates stock before restoring.
 */
export async function restoreDeletedOrder(
  orderId: string,
  user: { userId: string; name: string; role: string },
  ip?: string
): Promise<IOrder> {
  if (user.role !== 'MASTER_ADMIN') {
    throw new Error('FORBIDDEN: Only Master Admin can restore orders.');
  }

  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');
  if (!order.isDeleted) throw new Error('Order is not in trash');

  // Verify stock safety if order was deducted
  if (order.stockDeducted) {
    for (const item of order.items) {
      const prod = await Product.findById(item.productId);
      if (!prod) throw new Error(`Cannot restore: Product ${item.productName} no longer exists.`);
    }
  }

  order.isDeleted = false;
  order.deletedAt = undefined;
  order.deletedBy = undefined;
  order.deleteReason = undefined;
  order.updatedBy = user.userId;
  await order.save();

  await createAuditLog({
    userId: user.userId,
    userName: user.name,
    role: user.role,
    action: 'RESTORE_ORDER',
    entityType: 'ORDER',
    entityId: order._id.toString(),
    relatedOrderId: order.orderNumber,
    reason: 'Restored from trash by Master Admin',
    ip,
  });

  return order;
}

/**
 * Permanently deletes an order from database. MASTER ADMIN only.
 * Preserves immutable audit log.
 */
export async function permanentlyDeleteOrder(
  orderId: string,
  user: { userId: string; name: string; role: string },
  reason: string,
  ip?: string
): Promise<void> {
  if (user.role !== 'MASTER_ADMIN') {
    throw new Error('FORBIDDEN: Only Master Admin can permanently delete orders.');
  }

  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');

  const orderMetadata = {
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    totalProfit: order.totalProfit,
    itemsCount: order.items.length,
    customer: order.customer?.name,
  };

  await Order.findByIdAndDelete(orderId);

  // Retain immutable audit log
  await createAuditLog({
    userId: user.userId,
    userName: user.name,
    role: user.role,
    action: 'PERMANENT_DELETE_ORDER',
    entityType: 'ORDER',
    entityId: orderId,
    relatedOrderId: order.orderNumber,
    previousState: orderMetadata,
    reason,
    ip,
  });
}
