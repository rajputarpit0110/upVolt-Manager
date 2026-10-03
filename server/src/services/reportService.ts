import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { StockMovement } from '../models/StockMovement';
import { Purchase } from '../models/Purchase';
import { InventoryBatch } from '../models/InventoryBatch';
import { Customer } from '../models/Customer';
import { ProductPriceHistory } from '../models/ProductPriceHistory';
import { AuditLog } from '../models/AuditLog';

export function getDateRangeFilter(preset: string, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'yesterday':
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case 'this_week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'last_week': {
      const day = now.getDay();
      const diff = now.getDate() - day - 6;
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    case 'custom':
      if (customStart) {
        start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
      }
      if (customEnd) {
        end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
      }
      break;
    default:
      // Default to last 30 days
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

/**
 * Generates the "What Changed Today?" report for a target date
 */
export async function getDailyChangeReport(targetDateStr?: string) {
  const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Stock movements for the day
  const movements = await StockMovement.find({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  }).populate('productId', 'name sku');

  // 2. Purchases for the day
  const purchases = await Purchase.find({
    purchaseDate: { $gte: startOfDay, $lte: endOfDay },
    isCancelled: false,
  });

  // 3. Orders for the day (non-deleted, stock deducted)
  const orders = await Order.find({
    orderDate: { $gte: startOfDay, $lte: endOfDay },
    isDeleted: false,
    status: { $nin: ['Cancelled', 'Draft'] },
  });

  // Aggregations
  let receivedUnits = 0;
  let receivedCost = 0;
  let soldUnits = 0;
  let salesRevenue = 0;
  let salesCogs = 0;
  let salesProfit = 0;
  let returnedUnits = 0;
  let damagedUnits = 0;
  let adjustedUnits = 0;

  const productMovementMap: Record<string, any> = {};

  for (const m of movements) {
    const prodName = (m.productId as any)?.name || 'Unknown';
    const prodSku = (m.productId as any)?.sku || 'UNKNOWN';
    const key = prodSku;

    if (!productMovementMap[key]) {
      productMovementMap[key] = {
        productName: prodName,
        sku: prodSku,
        received: 0,
        sold: 0,
        returned: 0,
        damaged: 0,
        adjusted: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      };
    }

    if (m.movementType === 'STOCK_RECEIVED') {
      receivedUnits += m.quantity;
      const cost = m.quantity * (m.costPrice || 0);
      receivedCost += cost;
      productMovementMap[key].received += m.quantity;
      productMovementMap[key].cost += cost;
    } else if (m.movementType === 'SALE') {
      const qty = Math.abs(m.quantity);
      soldUnits += qty;
      productMovementMap[key].sold += qty;
    } else if (m.movementType === 'RETURN') {
      returnedUnits += m.quantity;
      productMovementMap[key].returned += m.quantity;
    } else if (m.movementType === 'DAMAGE') {
      const qty = Math.abs(m.quantity);
      damagedUnits += qty;
      productMovementMap[key].damaged += qty;
    } else if (m.movementType === 'ADJUSTMENT' || m.movementType === 'MANUAL_CORRECTION') {
      adjustedUnits += m.quantity;
      productMovementMap[key].adjusted += m.quantity;
    }
  }

  for (const o of orders) {
    salesRevenue += o.totalAmount;
    salesCogs += o.totalCost;
    salesProfit += o.totalProfit;

    for (const item of o.items) {
      if (productMovementMap[item.sku]) {
        productMovementMap[item.sku].revenue += item.revenue;
        productMovementMap[item.sku].cost += item.cogs;
        productMovementMap[item.sku].profit += item.profit;
      }
    }
  }

  const netInventoryValueChange = receivedCost - salesCogs;

  const priceChangesCount = await ProductPriceHistory.countDocuments({
    effectiveDate: { $gte: startOfDay, $lte: endOfDay },
  });

  const productChangesCount = await AuditLog.countDocuments({
    entityType: 'PRODUCT',
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  return {
    date: startOfDay.toISOString().split('T')[0],
    stockReceived: {
      units: receivedUnits,
      cost: Math.round(receivedCost * 100) / 100,
      count: purchases.length,
    },
    stockSold: {
      units: soldUnits,
      count: orders.length,
    },
    stockReturned: {
      units: returnedUnits,
      count: movements.filter((m) => m.movementType === 'RETURN').length,
    },
    stockDamaged: {
      units: damagedUnits,
      count: movements.filter((m) => m.movementType === 'DAMAGE').length,
    },
    stockAdjusted: {
      units: adjustedUnits,
      count: movements.filter((m) => m.movementType === 'ADJUSTMENT' || m.movementType === 'MANUAL_CORRECTION').length,
    },
    financials: {
      revenue: Math.round(salesRevenue * 100) / 100,
      cogs: Math.round(salesCogs * 100) / 100,
      profit: Math.round(salesProfit * 100) / 100,
      margin: salesRevenue > 0 ? Math.round((salesProfit / salesRevenue) * 10000) / 100 : 0,
    },
    ordersCreatedCount: orders.length,
    purchasesCount: purchases.length,
    priceChangesCount,
    productChangesCount,
    summary: {
      receivedUnits,
      receivedCost: Math.round(receivedCost * 100) / 100,
      soldUnits,
      salesRevenue: Math.round(salesRevenue * 100) / 100,
      salesCogs: Math.round(salesCogs * 100) / 100,
      salesProfit: Math.round(salesProfit * 100) / 100,
      profitMargin: salesRevenue > 0 ? Math.round((salesProfit / salesRevenue) * 10000) / 100 : 0,
      returnedUnits,
      damagedUnits,
      adjustedUnits,
      netInventoryValueChange: Math.round(netInventoryValueChange * 100) / 100,
      totalOrdersCount: orders.length,
      totalPurchasesCount: purchases.length,
    },
    productBreakdown: Object.values(productMovementMap),
  };
}

/**
 * Comprehensive dashboard metrics & business KPIs
 */
export async function getDashboardMetrics(preset = 'this_month', customStart?: string, customEnd?: string) {
  const { start, end } = getDateRangeFilter(preset, customStart, customEnd);

  // Products valuation & stock metrics
  const products = await Product.find({ isArchived: false });
  const totalProducts = products.length;
  let totalStockQuantity = 0;
  let lowStockProducts = 0;
  let outOfStockProducts = 0;
  let potentialSalesValue = 0;

  for (const p of products) {
    totalStockQuantity += p.currentStock;
    potentialSalesValue += p.currentStock * p.sellingPrice;
    if (p.currentStock === 0) {
      outOfStockProducts++;
    } else if (p.currentStock <= p.minStockLevel) {
      lowStockProducts++;
    }
  }

  // Active batches valuation (authoritative FIFO valuation)
  const activeBatches = await InventoryBatch.aggregate([
    { $match: { status: 'ACTIVE', remainingQuantity: { $gt: 0 } } },
    {
      $group: {
        _id: null,
        totalStockCost: { $sum: { $multiply: ['$remainingQuantity', '$costPrice'] } },
      },
    },
  ]);
  const currentInventoryValue = activeBatches[0]?.totalStockCost || 0;
  const potentialGrossProfit = Math.max(0, potentialSalesValue - currentInventoryValue);

  // Orders in range (non-deleted)
  const orders = await Order.find({
    orderDate: { $gte: start, $lte: end },
    isDeleted: false,
  });

  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let pendingOrders = 0;
  let deliveredOrders = 0;

  for (const o of orders) {
    if (o.status !== 'Cancelled') {
      totalRevenue += o.totalAmount;
      totalCost += o.totalCost;
      totalProfit += o.totalProfit;
    }
    if (o.status === 'Delivered') deliveredOrders++;
    if (['Draft', 'Confirmed', 'Processing', 'Packed', 'Shipped'].includes(o.status)) pendingOrders++;
  }

  const grossMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  // Today & This Week specific sales
  const todayRange = getDateRangeFilter('today');
  const todayOrders = await Order.find({
    orderDate: { $gte: todayRange.start, $lte: todayRange.end },
    isDeleted: false,
    status: { $ne: 'Cancelled' },
  });
  const todaySales = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  const weekRange = getDateRangeFilter('this_week');
  const weekOrders = await Order.find({
    orderDate: { $gte: weekRange.start, $lte: weekRange.end },
    isDeleted: false,
    status: { $ne: 'Cancelled' },
  });
  const thisWeekSales = weekOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  // Customers count
  const customerCount = await Customer.countDocuments({ status: 'ACTIVE' });

  // Top Selling Products in range
  const productSalesMap: Record<string, { name: string; sku: string; unitsSold: number; revenue: number; profit: number }> = {};
  for (const o of orders) {
    if (o.status === 'Cancelled') continue;
    for (const it of o.items) {
      const key = it.sku;
      if (!productSalesMap[key]) {
        productSalesMap[key] = {
          name: it.productName,
          sku: it.sku,
          unitsSold: 0,
          revenue: 0,
          profit: 0,
        };
      }
      productSalesMap[key].unitsSold += it.quantity;
      productSalesMap[key].revenue += it.revenue;
      productSalesMap[key].profit += it.profit;
    }
  }
  const topSellingProducts = Object.values(productSalesMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Daily Chart Data for Orders, Revenue, Profit
  const dayBuckets: Record<string, { date: string; revenue: number; profit: number; cogs: number; orders: number }> = {};
  for (const o of orders) {
    if (o.status === 'Cancelled') continue;
    const dayStr = o.orderDate.toISOString().split('T')[0];
    if (!dayBuckets[dayStr]) {
      dayBuckets[dayStr] = { date: dayStr, revenue: 0, profit: 0, cogs: 0, orders: 0 };
    }
    dayBuckets[dayStr].revenue += o.totalAmount;
    dayBuckets[dayStr].profit += o.totalProfit;
    dayBuckets[dayStr].cogs += o.totalCost;
    dayBuckets[dayStr].orders += 1;
  }
  const chartData = Object.values(dayBuckets).sort((a, b) => a.date.localeCompare(b.date));

  // Dead stock: Products with no sales in past 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentSoldProductIds = await Order.distinct('items.productId', {
    orderDate: { $gte: thirtyDaysAgo },
    isDeleted: false,
    status: { $ne: 'Cancelled' },
  });
  const deadStockProducts = products.filter(
    (p) => p.currentStock > 0 && !recentSoldProductIds.some((id) => id.toString() === p._id.toString())
  ).length;

  return {
    kpis: {
      totalProducts,
      totalStockQuantity,
      currentInventoryValue: Math.round(currentInventoryValue * 100) / 100,
      potentialSalesValue: Math.round(potentialSalesValue * 100) / 100,
      potentialGrossProfit: Math.round(potentialGrossProfit * 100) / 100,
      todaySales: Math.round(todaySales * 100) / 100,
      todayOrdersCount: todayOrders.length,
      thisWeekSales: Math.round(thisWeekSales * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      grossMargin: Math.round(grossMargin * 100) / 100,
      pendingOrders,
      deliveredOrders,
      lowStockProducts,
      outOfStockProducts,
      deadStockProducts,
      customerCount,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
    },
    topSellingProducts,
    chartData,
    dateRange: { start, end },
  };
}
