import { Request, Response } from 'express';
import { getDashboardMetrics, getDailyChangeReport, getDateRangeFilter } from '../services/reportService';
import { runSystemIntegrityCheck, autoReconcileDiscrepancies } from '../services/reconciliationService';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { StockMovement } from '../models/StockMovement';
import { Purchase } from '../models/Purchase';

export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const isMasterAdmin = req.user?.role === 'MASTER_ADMIN';
    const selectedRange = String(req.query.range || req.query.timeRange || 'this_month');
    const { startDate, endDate } = req.query;
    const metrics = await getDashboardMetrics(
      selectedRange,
      startDate ? String(startDate) : undefined,
      endDate ? String(endDate) : undefined
    );
    const recentOrders = await Order.find({ isDeleted: false })
      .sort({ orderDate: -1, createdAt: -1 })
      .limit(5);

    const lowStockItems = await Product.find({
      $expr: { $lte: ['$currentStock', '$minStockLevel'] },
    }).limit(10);

    const data: any = {
      kpi: {
        totalStockValue: isMasterAdmin ? metrics.kpis.currentInventoryValue : 0,
        totalUnitsInStock: metrics.kpis.totalStockQuantity,
        totalProducts: metrics.kpis.totalProducts,
        lowStockCount: metrics.kpis.lowStockProducts,
        outOfStockCount: metrics.kpis.outOfStockProducts,
        todaySalesCount: metrics.kpis.deliveredOrders || metrics.kpis.todayOrdersCount,
        todayRevenue: isMasterAdmin ? metrics.kpis.totalRevenue : 0,
        todayProfit: isMasterAdmin ? metrics.kpis.totalProfit : 0,
        pendingOrdersCount: metrics.kpis.pendingOrders,
      },
      lowStockItems,
      recentOrders,
      salesTrend: (metrics.chartData || []).map((d: any) => ({
        _id: d.date,
        ordersCount: d.orders,
        ...(isMasterAdmin ? { revenue: d.revenue, profit: d.profit } : {}),
      })),
      topProducts: (metrics.topSellingProducts || []).map((p: any) => ({
        productId: p.sku,
        productName: p.name,
        sku: p.sku,
        totalQuantity: p.unitsSold,
        ...(isMasterAdmin ? { totalRevenue: p.revenue, totalProfit: p.profit } : {}),
      })),
    };

    // If not Master Admin, scrub overall revenue and profit metrics
    if (!isMasterAdmin) {
      if (metrics.kpis) {
        delete (metrics.kpis as any).totalRevenue;
        delete (metrics.kpis as any).totalProfit;
        delete (metrics.kpis as any).netProfit;
        delete (metrics.kpis as any).grossMargin;
        delete (metrics.kpis as any).currentInventoryValue;
      }
      if (metrics.chartData) {
        metrics.chartData = metrics.chartData.map((d: any) => ({
          date: d.date,
          orders: d.orders,
          revenue: 0,
          profit: 0,
          cogs: 0,
        })) as any;
      }
      if (metrics.topSellingProducts) {
        metrics.topSellingProducts = metrics.topSellingProducts.map((p: any) => ({
          sku: p.sku,
          name: p.name,
          unitsSold: p.unitsSold,
          revenue: 0,
          profit: 0,
        })) as any;
      }
    }

    res.json({ success: true, metrics, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDailyActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const isMasterAdmin = req.user?.role === 'MASTER_ADMIN';
    const { date } = req.query;
    const report = await getDailyChangeReport(date ? String(date) : undefined);

    // If not Master Admin, scrub financial revenue and profits
    if (!isMasterAdmin && report) {
      if ((report as any).financials) {
        (report as any).financials = { revenue: 0, cogs: 0, profit: 0, margin: 0 };
      }
      if ((report as any).stockReceived) {
        (report as any).stockReceived.cost = 0;
      }
      if ((report as any).productBreakdown) {
        (report as any).productBreakdown = (report as any).productBreakdown.map((item: any) => ({
          ...item,
          revenue: 0,
          cost: 0,
          profit: 0,
        }));
      }
    }

    res.json({ success: true, report });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSystemIntegrity = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await runSystemIntegrityCheck();
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const reconcileDiscrepancies = async (req: Request, res: Response): Promise<void> => {
  try {
    const outcome = await autoReconcileDiscrepancies();
    const result = await runSystemIntegrityCheck();
    res.json({ success: true, outcome, result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Filtered CSV/JSON exporter for Orders, Sales, Inventory, Stock Movements, Purchases
 */
export const exportData = async (req: Request, res: Response): Promise<void> => {
  try {
    const isMasterAdmin = req.user?.role === 'MASTER_ADMIN';
    const exportType = String(req.params.type || req.query.type || 'orders').toLowerCase();
    const { range, startDate, endDate, format = 'csv' } = req.query;
    
    // If explicit start/end dates are provided, treat as custom range
    const rangePreset = String(range || (startDate || endDate ? 'custom' : 'all_time'));
    const { start, end } = getDateRangeFilter(rangePreset, startDate as string, endDate as string);

    let records: any[] = [];
    const dateTag = startDate && endDate ? `${startDate}_to_${endDate}` : rangePreset;
    const filename = `upvolt_${exportType}_${dateTag}`;

    if (exportType === 'orders' || exportType === 'sales') {
      const orders = await Order.find({
        orderDate: { $gte: start, $lte: end },
        isDeleted: false,
      }).sort({ orderDate: -1 });

      records = orders.map((o) => ({
        OrderNumber: o.orderNumber,
        Date: o.orderDate.toISOString().split('T')[0],
        Customer: o.customer?.name || 'Walk-in',
        Phone: o.customer?.phone || '',
        College: o.customer?.college || '',
        ItemsCount: o.items.length,
        ItemsSummary: o.items.map((i) => `${i.quantity}x ${i.productName}`).join('; '),
        ...(isMasterAdmin
          ? {
              Revenue: o.totalAmount,
              COGS: o.totalCost,
              Profit: o.totalProfit,
              GrossMarginPct: o.grossMargin,
            }
          : {}),
        DeliveryCharge: o.deliveryCharge || 0,
        Status: o.status,
        PaymentStatus: o.paymentStatus,
        PaymentMethod: o.paymentMethod,
        Source: o.source || 'Direct',
      }));
    } else if (exportType === 'inventory' || exportType === 'products') {
      const products = await Product.find({ isArchived: false }).sort({ name: 1 });
      records = products.map((p) => ({
        SKU: p.sku,
        Name: p.name,
        Category: p.category,
        CurrentStock: p.currentStock,
        ReservedStock: p.reservedStock,
        AvailableStock: p.currentStock - p.reservedStock,
        MinStockLevel: p.minStockLevel,
        AverageCost: p.averageCost,
        SellingPrice: p.sellingPrice,
        TotalInventoryValue: Math.round(p.currentStock * p.averageCost * 100) / 100,
        Location: p.locationShelf || '',
      }));
    } else if (exportType === 'movements') {
      const movements = await StockMovement.find({
        createdAt: { $gte: start, $lte: end },
      }).populate('productId', 'name sku').sort({ createdAt: -1 });

      records = movements.map((m) => ({
        Date: m.createdAt.toISOString().replace('T', ' ').slice(0, 19),
        Product: (m.productId as any)?.name || '',
        SKU: (m.productId as any)?.sku || '',
        Type: m.movementType,
        Quantity: m.quantity,
        PreviousStock: m.previousStock,
        NewStock: m.newStock,
        Reference: m.referenceId || '',
        UnitCost: m.costPrice || 0,
        SellingPrice: m.sellingPrice || 0,
        PerformedBy: m.performedBy,
        Notes: m.notes || '',
      }));
    } else if (exportType === 'purchases') {
      const purchases = await Purchase.find({
        purchaseDate: { $gte: start, $lte: end },
        isCancelled: false,
      }).sort({ purchaseDate: -1 });

      records = purchases.map((p) => ({
        PurchaseNumber: p.purchaseNumber,
        Date: p.purchaseDate.toISOString().split('T')[0],
        Supplier: p.supplierName || '',
        InvoiceNumber: p.invoiceNumber || '',
        ItemsCount: p.items.length,
        TotalAmount: p.totalAmount,
        PaymentStatus: p.paymentStatus,
        ReceivedBy: p.receivedBy,
      }));
    } else if (exportType === 'customers') {
      const { Customer } = await import('../models/Customer');
      const customers = await Customer.find({ createdAt: { $gte: start, $lte: end } }).sort({ name: 1 });
      records = customers.map((c) => ({
        Name: c.name,
        Phone: c.phone || '',
        Email: c.email || '',
        College: c.college || '',
        Category: c.category || '',
        TotalOrders: c.totalOrders || 0,
        TotalSpent: c.totalSpent || 0,
        CreatedAt: c.createdAt ? c.createdAt.toISOString().split('T')[0] : '',
      }));
    } else if (exportType === 'suppliers') {
      const { Supplier } = await import('../models/Supplier');
      const suppliers = await Supplier.find({ createdAt: { $gte: start, $lte: end } }).sort({ name: 1 });
      records = suppliers.map((s) => ({
        Name: s.name,
        ContactPerson: s.contactPerson || '',
        Phone: s.phone || '',
        Email: s.email || '',
        Address: s.address || '',
        GSTIN: s.gstin || '',
        Status: s.isActive ? 'ACTIVE' : 'INACTIVE',
        Notes: s.notes || '',
      }));
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.json(records);
      return;
    }

    // Default to CSV
    if (records.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send('No records found for the selected filter');
      return;
    }

    const headers = Object.keys(records[0]).join(',');
    const rows = records.map((r) =>
      Object.values(r)
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent = [headers, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
