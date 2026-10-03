import React, { useState, useEffect } from 'react';
import {
  Coins,
  Cpu,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Package,
  Calendar,
} from 'lucide-react';
import { StatCard } from '../components/Common/StatCard';
import { OrderStatusBadge } from '../components/Common/Badge';
import { reportApi } from '../api/client';
import { DashboardSummary } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface DashboardViewProps {
  onNavigate: (tab: any) => void;
  onSelectProduct: (product: any) => void;
  onSelectOrder: (order: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onSelectProduct,
  onSelectOrder,
}) => {
  const { isMasterAdmin } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('this_month');

  // Format YYYY-MM-DD for default dates
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(todayStr);

  useEffect(() => {
    if (timeRange !== 'custom') {
      loadDashboard();
    } else if (startDate && endDate) {
      loadDashboard();
    }
  }, [timeRange]);

  const loadDashboard = async (overrideStart?: string, overrideEnd?: string) => {
    setIsLoading(true);
    try {
      const activeStart = overrideStart !== undefined ? overrideStart : startDate;
      const activeEnd = overrideEnd !== undefined ? overrideEnd : endDate;
      const params: any = { timeRange };
      if (timeRange === 'custom') {
        if (activeStart) params.startDate = activeStart;
        if (activeEnd) params.endDate = activeEnd;
      }
      const res = await reportApi.getDashboard(params);
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-slate-500">Loading Dashboard Metrics...</span>
        </div>
      </div>
    );
  }

  const kpi = data?.kpi || {
    totalStockValue: 0,
    totalUnitsInStock: 0,
    totalProducts: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    todaySalesCount: 0,
    todayRevenue: 0,
    todayProfit: 0,
    pendingOrdersCount: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time IoT inventory valuation, sales velocity, and FIFO gross margin metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-subtle">
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_year">This Year</option>
              <option value="custom">📅 Custom Date Range (From - To)</option>
            </select>
          </div>

          {/* Custom Date Pickers (Shown when Custom Date Range is selected) */}
          {timeRange === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 bg-amber-50/80 border border-amber-200 rounded-lg px-2.5 py-1 text-xs shadow-subtle">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-amber-900">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-amber-200 rounded text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-amber-900">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-amber-200 rounded text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <button
                type="button"
                onClick={() => loadDashboard(startDate, endDate)}
                disabled={!startDate || !endDate}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded text-xs transition shadow-xs cursor-pointer"
              >
                Apply Range
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isMasterAdmin ? (
          <>
            <StatCard
              title="Active Inventory Valuation"
              value={`₹${kpi.totalStockValue.toLocaleString('en-IN')}`}
              subtitle={`${kpi.totalUnitsInStock} total units across ${kpi.totalProducts} products`}
              icon={Coins}
              highlight={true}
            />
            <StatCard
              title="Revenue (Period)"
              value={`₹${kpi.todayRevenue.toLocaleString('en-IN')}`}
              subtitle={`${kpi.todaySalesCount} confirmed sales orders`}
              icon={ShoppingCart}
            />
            <StatCard
              title="Gross Profit (Period)"
              value={`₹${kpi.todayProfit.toLocaleString('en-IN')}`}
              subtitle={
                kpi.todayRevenue > 0
                  ? `${Math.round((kpi.todayProfit / kpi.todayRevenue) * 100)}% Gross Margin`
                  : 'Strict FIFO Batch Costing'
              }
              icon={TrendingUp}
            />
            <StatCard
              title="Low & Out of Stock"
              value={kpi.lowStockCount + kpi.outOfStockCount}
              subtitle={`${kpi.outOfStockCount} out of stock, ${kpi.lowStockCount} below threshold`}
              icon={AlertTriangle}
              alert={kpi.lowStockCount + kpi.outOfStockCount > 0}
            />
          </>
        ) : (
          <>
            <StatCard
              title="Hardware Catalog"
              value={`${kpi.totalProducts} Products`}
              subtitle="Active IoT hardware components"
              icon={Cpu}
              highlight={true}
            />
            <StatCard
              title="Physical Stock Units"
              value={`${kpi.totalUnitsInStock.toLocaleString('en-IN')}`}
              subtitle="Total units in warehouse"
              icon={Package}
            />
            <StatCard
              title="Confirmed Orders"
              value={`${kpi.todaySalesCount}`}
              subtitle={`${kpi.pendingOrdersCount || 0} currently pending`}
              icon={ShoppingCart}
            />
            <StatCard
              title="Low & Out of Stock"
              value={kpi.lowStockCount + kpi.outOfStockCount}
              subtitle={`${kpi.outOfStockCount} out of stock, ${kpi.lowStockCount} below threshold`}
              icon={AlertTriangle}
              alert={kpi.lowStockCount + kpi.outOfStockCount > 0}
            />
          </>
        )}
      </div>

      {/* Sales Velocity Chart & Low Stock alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue & Profit Trends Chart (Master Admin) OR Order Velocity Chart (Staff) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {isMasterAdmin ? 'Revenue & Gross Profit Trend' : 'Order Volume & Velocity Trend'}
              </h2>
              <p className="text-xs text-slate-500">
                {isMasterAdmin
                  ? 'Historical performance based on immutable FIFO allocations'
                  : 'Customer order activity velocity over time'}
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            {data?.salesTrend && data.salesTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.salesTrend}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="_id" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) =>
                      isMasterAdmin
                        ? `₹${val >= 1000 ? `${val / 1000}k` : val}`
                        : `${val}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any) => [
                      isMasterAdmin && (name === 'Revenue' || name === 'Gross Profit')
                        ? `₹${Number(val).toLocaleString('en-IN')}`
                        : `${val} orders`,
                      name,
                    ]}
                  />
                  {isMasterAdmin ? (
                    <>
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="Revenue"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#revenueGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="profit"
                        name="Gross Profit"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#profitGrad)"
                      />
                    </>
                  ) : (
                    <Area
                      type="monotone"
                      dataKey="ordersCount"
                      name="Confirmed Orders"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#ordersGrad)"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No activity recorded for the selected period
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Warning Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900">Stock Reorder Alerts</h2>
              </div>
              <button
                onClick={() => onNavigate('inventory')}
                className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-0.5"
              >
                <span>View All</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {data?.lowStockItems && data.lowStockItems.length > 0 ? (
                data.lowStockItems.slice(0, 5).map((prod) => (
                  <div
                    key={prod._id}
                    onClick={() => onSelectProduct(prod)}
                    className="py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded px-1 transition"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-900">{prod.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">SKU: {prod.sku}</div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                          prod.currentStock === 0
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {prod.currentStock} left
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">Min: {prod.minStockLevel}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  All inventory items are above safety thresholds!
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate('purchases')}
            className="w-full mt-4 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition flex items-center justify-center gap-2"
          >
            <Package className="w-3.5 h-3.5" />
            <span>Create Purchase Order</span>
          </button>
        </div>
      </div>

      {/* Recent Orders & Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-subtle overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recent Commercial Orders</h2>
              <p className="text-xs text-slate-500">Live order status and transaction values</p>
            </div>
            <button
              onClick={() => onNavigate('orders')}
              className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-0.5"
            >
              <span>All Orders</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-medium">
                  <th className="py-2.5 px-4">Order #</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Items</th>
                  <th className="py-2.5 px-4">Total</th>
                  <th className="py-2.5 px-4">Profit</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.recentOrders && data.recentOrders.length > 0 ? (
                  data.recentOrders.slice(0, 6).map((order) => (
                    <tr
                      key={order._id}
                      onClick={() => onSelectOrder(order)}
                      className="hover:bg-slate-50/80 cursor-pointer transition"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        {order.orderNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {order.customer?.name || 'Walk-in Customer'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {order.items?.reduce((acc, i) => acc + i.quantity, 0)} units
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        ₹{order.totalAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 font-medium text-emerald-600 font-mono">
                        +₹{(order.totalProfit ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <OrderStatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      No recent orders recorded
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-subtle">
          <h2 className="text-sm font-bold text-slate-900 mb-1">Top Selling IoT Hardware</h2>
          <p className="text-xs text-slate-500 mb-4">Highest volume components sold</p>

          <div className="space-y-3">
            {data?.topProducts && data.topProducts.length > 0 ? (
              data.topProducts.slice(0, 5).map((p, idx) => (
                <div key={p.productId || idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded bg-slate-100 font-mono text-[11px] font-bold text-slate-600 flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-900">{p.productName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-900">{p.totalQuantity} sold</div>
                    <div className="text-[10px] text-emerald-600 font-mono">+₹{p.totalProfit} profit</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">No product sales yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
