import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { OrderVersion } from '../models/OrderVersion';
import { OrderReturn } from '../models/OrderReturn';
import {
  createOrder,
  updateOrder,
  updateOrderStatus,
  cancelOrder,
  processReturn,
  softDeleteOrder,
  restoreDeletedOrder,
  permanentlyDeleteOrder,
} from '../services/orderService';

export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      status,
      paymentStatus,
      startDate,
      endDate,
      page = '1',
      limit = '50',
      isDeleted = 'false',
    } = req.query;

    const conditions: any[] = [{ isDeleted: isDeleted === 'true' }];

    // If CAMPUS_EXECUTIVE, strictly restrict to orders they personally delivered or created
    if (req.user?.role === 'CAMPUS_EXECUTIVE') {
      conditions.push({
        $or: [
          { 'deliveryInfo.deliveredBy': req.user.name },
          { 'deliveryInfo.deliveredBy': req.user.userId },
          { createdBy: req.user.userId },
          { createdBy: req.user.name },
        ],
      });
    }

    if (status) conditions.push({ status });
    if (paymentStatus) conditions.push({ paymentStatus });

    if (search) {
      const regex = new RegExp(String(search), 'i');
      conditions.push({
        $or: [
          { orderNumber: regex },
          { 'customer.name': regex },
          { 'customer.phone': regex },
          { 'customer.college': regex },
          { 'deliveryInfo.customerName': regex },
          { 'deliveryInfo.phone': regex },
          { 'deliveryInfo.college': regex },
          { 'items.productName': regex },
          { 'items.sku': regex },
        ],
      });
    }

    if (startDate || endDate) {
      const dateCond: any = {};
      if (startDate) dateCond.$gte = new Date(String(startDate));
      if (endDate) {
        const e = new Date(String(endDate));
        e.setHours(23, 59, 59, 999);
        dateCond.$lte = e;
      }
      conditions.push({ orderDate: dateCond });
    }

    const query = conditions.length > 1 ? { $and: conditions } : conditions[0];

    const skip = (parseInt(String(page)) - 1) * parseInt(String(limit));
    const total = await Order.countDocuments(query);
    const rawOrders = await Order.find(query)
      .sort({ orderDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(String(limit)));

    // Strip business profit & COGS metrics for CAMPUS_EXECUTIVE
    const orders = req.user?.role === 'CAMPUS_EXECUTIVE'
      ? rawOrders.map((ord: any) => {
          const o = ord.toObject ? ord.toObject() : { ...ord };
          delete o.totalCost;
          delete o.totalProfit;
          delete o.grossMargin;
          if (o.items) {
            o.items = o.items.map((it: any) => {
              const itemObj = { ...it };
              delete itemObj.cogs;
              delete itemObj.profit;
              delete itemObj.margin;
              delete itemObj.batchAllocations;
              return itemObj;
            });
          }
          return o;
        })
      : rawOrders;

    res.json({
      success: true,
      orders,
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

export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found.' });
      return;
    }

    // CAMPUS_EXECUTIVE can only view their own delivered order
    if (req.user?.role === 'CAMPUS_EXECUTIVE') {
      const isOwner =
        order.deliveryInfo?.deliveredBy === req.user.name ||
        order.deliveryInfo?.deliveredBy === req.user.userId ||
        order.createdBy === req.user.userId ||
        order.createdBy === req.user.name;
      if (!isOwner) {
        res.status(403).json({ success: false, message: 'Access Denied: You can only view your own deliveries.' });
        return;
      }
    }

    const versions = await OrderVersion.find({ orderId: id }).sort({ version: 1 });
    const returns = await OrderReturn.find({ orderId: id }).sort({ returnDate: -1 });

    res.json({ success: true, order, versions, returns });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const handleCreateOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const body = { ...req.body };

    // When Campus Executive records a delivery, auto-mark as Delivered and tag them
    if (user.role === 'CAMPUS_EXECUTIVE') {
      body.status = 'Delivered';
      body.deliveryInfo = {
        ...(body.deliveryInfo || {}),
        deliveredBy: user.name,
        deliveryDate: body.deliveryInfo?.deliveryDate || new Date(),
        customerName: body.customer?.name || body.deliveryInfo?.customerName,
        phone: body.customer?.phone || body.deliveryInfo?.phone,
        college: body.customer?.college || body.deliveryInfo?.college,
      };
    }

    const order = await createOrder(body, user, req.ip);
    res.status(201).json({ success: true, order });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const handleUpdateOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const order = await updateOrder(id, req.body, user, req.ip);
    res.json({ success: true, order });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const handleUpdateStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, deliveryInfo } = req.body;
    if (!status) {
      res.status(400).json({ success: false, message: 'New status is required.' });
      return;
    }
    const user = req.user!;
    const order = await updateOrderStatus(id, status, user, deliveryInfo, req.ip);
    res.json({ success: true, order });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const handleCancelOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason = 'Customer requested cancellation' } = req.body;
    const user = req.user!;
    const order = await cancelOrder(id, user, reason, req.ip);
    res.json({ success: true, message: 'Order cancelled and stock restored successfully.', order });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const handleReturnOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { items, reason, notes } = req.body;
    if (!items || !items.length || !reason) {
      res.status(400).json({ success: false, message: 'Returned items and reason are required.' });
      return;
    }
    const user = req.user!;
    const returnRecord = await processReturn({ orderId: id, items, reason, notes }, user, req.ip);
    res.status(201).json({ success: true, returnRecord });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const handleSoftDeleteOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason = 'Archived by Master Admin' } = req.body;
    const user = req.user!;
    const order = await softDeleteOrder(id, reason, user, req.ip);
    res.json({ success: true, message: 'Order moved to trash successfully.', order });
  } catch (error: any) {
    const statusCode = error.message.includes('FORBIDDEN') ? 403 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const getTrashOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'MASTER_ADMIN') {
      res.status(403).json({ success: false, message: 'Access denied: Master Admin only.' });
      return;
    }
    const orders = await Order.find({ isDeleted: true }).sort({ deletedAt: -1 });
    res.json({ success: true, orders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const handleRestoreOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const order = await restoreDeletedOrder(id, user, req.ip);
    res.json({ success: true, message: 'Order restored from trash successfully.', order });
  } catch (error: any) {
    const statusCode = error.message.includes('FORBIDDEN') ? 403 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const handlePermanentDeleteOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason = 'Permanent purge' } = req.body;
    const user = req.user!;
    await permanentlyDeleteOrder(id, user, reason, req.ip);
    res.json({ success: true, message: 'Order permanently deleted. Audit record preserved.' });
  } catch (error: any) {
    const statusCode = error.message.includes('FORBIDDEN') ? 403 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const getOrderVersions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const versions = await OrderVersion.find({ orderId: id }).sort({ version: 1 });
    res.json({ success: true, versions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
