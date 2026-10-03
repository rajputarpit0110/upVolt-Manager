import { Request, Response } from 'express';
import { Customer } from '../models/Customer';
import { Order } from '../models/Order';
import { createAuditLog } from '../services/auditService';

export const getCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, page = '1', limit = '100' } = req.query;
    const query: any = {};

    let orderMatchedCustomerIds: string[] = [];
    if (search) {
      const regex = new RegExp(String(search), 'i');
      
      // Also search in orders by product name or sku to find customers who bought it
      const matchingOrders = await Order.find({
        isDeleted: false,
        $or: [
          { 'items.productName': regex },
          { 'items.sku': regex },
        ],
      }).select('customer.customerId');

      orderMatchedCustomerIds = matchingOrders
        .map((o) => o.customer?.customerId?.toString())
        .filter(Boolean) as string[];

      query.$or = [
        { name: regex },
        { phone: regex },
        { email: regex },
        { college: regex },
        { organization: regex },
        { city: regex },
        { _id: { $in: orderMatchedCustomerIds } },
      ];
    }

    const skip = (parseInt(String(page)) - 1) * parseInt(String(limit));
    const total = await Customer.countDocuments(query);
    const customers = await Customer.find(query)
      .sort({ totalSpent: -1, updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(String(limit)));

    // Fetch orders for all returned customers in one query
    const customerIds = customers.map((c) => c._id);
    const customerPhones = customers.map((c) => c.phone).filter(Boolean);
    const customerNames = customers.map((c) => c.name).filter(Boolean);

    const allOrders = await Order.find({
      $or: [
        { 'customer.customerId': { $in: customerIds } },
        { 'customer.phone': { $in: customerPhones } },
        { 'customer.name': { $in: customerNames } },
      ],
      isDeleted: false,
    }).sort({ orderDate: -1 });

    // Group orders and item summary by customer
    const enhancedCustomers = customers.map((c) => {
      const custObj = c.toObject();
      const matchedOrders = allOrders.filter(
        (o) =>
          (o.customer?.customerId && o.customer.customerId.toString() === c._id.toString()) ||
          (c.phone && o.customer?.phone === c.phone) ||
          (o.customer?.name === c.name)
      );

      // Aggregate all items bought by this customer
      const itemMap: Record<string, { sku: string; productName: string; quantity: number; unitPrice: number; totalAmount: number }> = {};
      matchedOrders.forEach((ord) => {
        (ord.items || []).forEach((it) => {
          const key = it.sku || it.productName;
          if (!itemMap[key]) {
            itemMap[key] = {
              sku: it.sku,
              productName: it.productName,
              quantity: 0,
              unitPrice: it.sellingPrice,
              totalAmount: 0,
            };
          }
          itemMap[key].quantity += it.quantity;
          itemMap[key].totalAmount += it.revenue || it.sellingPrice * it.quantity;
        });
      });

      return {
        ...custObj,
        college: custObj.college || custObj.organization || 'KIET',
        organization: custObj.organization || custObj.college || 'KIET',
        category: custObj.category || 'Student',
        orders: matchedOrders.map((o) => ({
          _id: o._id,
          orderNumber: o.orderNumber,
          orderDate: o.orderDate,
          status: o.status,
          paymentStatus: o.paymentStatus,
          paymentMethod: o.paymentMethod,
          subtotal: o.subtotal,
          discount: o.discount,
          deliveryCharge: o.deliveryCharge || 0,
          totalAmount: o.totalAmount,
          items: (o.items || []).map((it) => ({
            productId: it.productId,
            productName: it.productName,
            sku: it.sku,
            quantity: it.quantity,
            sellingPrice: it.sellingPrice,
            revenue: it.revenue,
          })),
        })),
        purchasedItems: Object.values(itemMap),
      };
    });

    res.json({
      success: true,
      customers: enhancedCustomers,
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

export const getCustomerById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);
    if (!customer) {
      res.status(404).json({ success: false, message: 'Customer not found.' });
      return;
    }

    // Match orders by customerId, phone, or name
    const orders = await Order.find({
      $or: [
        { 'customer.customerId': id },
        ...(customer.phone ? [{ 'customer.phone': customer.phone }] : []),
        { 'customer.name': customer.name },
      ],
      isDeleted: false,
    }).sort({ orderDate: -1 });

    res.json({
      success: true,
      customer: {
        ...customer.toObject(),
        college: customer.college || customer.organization || 'KIET',
        organization: customer.organization || customer.college || 'KIET',
        category: customer.category || 'Student',
      },
      orders,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, phone, email, address, college, city, state, pincode, notes } = req.body;
    if (!name) {
      res.status(400).json({ success: false, message: 'Customer name is required.' });
      return;
    }

    const customer = new Customer({
      name: name.trim(),
      phone: phone?.trim(),
      email: email?.trim()?.toLowerCase(),
      address: address?.trim(),
      college: college?.trim(),
      city: city?.trim(),
      state: state?.trim(),
      pincode: pincode?.trim(),
      notes: notes?.trim(),
    });
    await customer.save();

    await createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.name,
      role: req.user!.role,
      action: 'CREATE_CUSTOMER',
      entityType: 'CUSTOMER',
      entityId: customer._id.toString(),
      newState: { name: customer.name, phone: customer.phone, college: customer.college },
      ip: req.ip,
    });

    res.status(201).json({ success: true, customer });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const customer = await Customer.findByIdAndUpdate(id, req.body, { new: true });
    if (!customer) {
      res.status(404).json({ success: false, message: 'Customer not found.' });
      return;
    }
    res.json({ success: true, customer });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
