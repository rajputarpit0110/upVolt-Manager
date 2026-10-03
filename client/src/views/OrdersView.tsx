import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  ShoppingCart,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  FileText,
} from 'lucide-react';
import { Order, Product, Customer } from '../types';
import { orderApi, productApi, customerApi } from '../api/client';
import { OrderStatusBadge, PaymentStatusBadge, Badge } from '../components/Common/Badge';
import { Modal } from '../components/Common/Modal';
import { useToast } from '../components/Common/Toast';
import { OrderDetailModal } from '../components/Orders/OrderDetailModal';

interface OrdersViewProps {
  isCreateOrderModalOpenFromParent?: boolean;
  onCloseCreateOrderModal?: () => void;
  selectedOrderFromParent?: Order | null;
  onClearSelectedOrder?: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  isCreateOrderModalOpenFromParent = false,
  onCloseCreateOrderModal,
  selectedOrderFromParent,
  onClearSelectedOrder,
}) => {
  const { success, error, warning } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Selected Order for detail view
  const [inspectingOrderId, setInspectingOrderId] = useState<string | null>(null);

  // Create Order Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(isCreateOrderModalOpenFromParent);
  const [orderStatus, setOrderStatus] = useState<'Confirmed' | 'Draft'>('Confirmed');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerOrg, setCustomerOrg] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('Paid');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [items, setItems] = useState<
    { productId: string; quantity: number; sellingPrice: number; discount: number }[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isCreateOrderModalOpenFromParent) {
      handleOpenCreateModal();
    }
  }, [isCreateOrderModalOpenFromParent]);

  useEffect(() => {
    if (selectedOrderFromParent) {
      setInspectingOrderId(selectedOrderFromParent._id);
      onClearSelectedOrder?.();
    }
  }, [selectedOrderFromParent]);

  useEffect(() => {
    loadOrders();
    loadDependencies();
  }, [statusFilter]);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const res = await orderApi.getAll(params);
      if (res.success) {
        setOrders(res.orders);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDependencies = async () => {
    try {
      const [prodRes, custRes] = await Promise.all([productApi.getAll(), customerApi.getAll()]);
      if (prodRes.success) setProducts(prodRes.products);
      if (custRes.success) setCustomers(custRes.customers);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenCreateModal = () => {
    setIdempotencyKey(`ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
    setOrderStatus('Confirmed');
    setSelectedCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setCustomerOrg('');
    setPaymentStatus('Paid');
    setPaymentMethod('UPI');
    setNotes('');

    if (products.length > 0) {
      setItems([
        {
          productId: products[0]._id,
          quantity: 1,
          sellingPrice: products[0].sellingPrice,
          discount: 0,
        },
      ]);
    } else {
      setItems([]);
    }
    setIsCreateModalOpen(true);
  };

  const handleCustomerSelect = (custId: string) => {
    setSelectedCustomerId(custId);
    const c = customers.find((cust) => cust._id === custId);
    if (c) {
      setCustomerName(c.name);
      setCustomerPhone(c.phone || '');
      setCustomerEmail(c.email || '');
      setCustomerOrg(c.organization || '');
    }
  };

  const addItemRow = () => {
    if (products.length === 0) {
      warning(
        'No products exist in your catalog yet. Please add products and receive stock before creating orders.',
        'Catalog Empty'
      );
      return;
    }
    setItems([
      ...items,
      {
        productId: products[0]._id,
        quantity: 1,
        sellingPrice: products[0].sellingPrice,
        discount: 0,
      },
    ]);
  };

  const removeItemRow = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItemRow = (idx: number, field: string, val: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = val;
    if (field === 'productId') {
      const prod = products.find((p) => p._id === val);
      if (prod) {
        updated[idx].sellingPrice = prod.sellingPrice;
      }
    }
    setItems(updated);
  };

  const calculateSubtotal = () =>
    items.reduce((acc, i) => acc + i.quantity * i.sellingPrice - (i.discount || 0), 0);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      error('Order must contain at least one line item.', 'Validation Error');
      return;
    }

    // Check availability locally first for immediate feedback
    for (const item of items) {
      const prod = products.find((p) => p._id === item.productId);
      if (prod) {
        const available = prod.currentStock - prod.reservedStock;
        if (orderStatus === 'Confirmed' && item.quantity > available) {
          error(
            `Order could not be confirmed.\n\nRequested: ${item.quantity} ${prod.name}\nAvailable: ${Math.max(
              0,
              available
            )}\n\nNo stock was deducted and no order transaction was partially saved.`,
            'Insufficient Stock Error'
          );
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const subtotal = calculateSubtotal();
      const res = await orderApi.create({
        customer: {
          customerId: selectedCustomerId || undefined,
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
          organization: customerOrg,
        },
        items,
        status: orderStatus,
        paymentStatus,
        paymentMethod,
        amountPaid: paymentStatus === 'Paid' ? subtotal : amountPaid,
        notes,
        idempotencyKey,
      });

      if (res.success) {
        success(
          `Order #${res.order.orderNumber} successfully created! ${
            orderStatus === 'Confirmed'
              ? 'FIFO batches allocated and physical stock deducted.'
              : 'Stock reserved (Draft).'
          }`,
          'Order Created'
        );
        setIsCreateModalOpen(false);
        onCloseCreateOrderModal?.();
        loadOrders();
        loadDependencies(); // refresh stock levels
      }
    } catch (err: any) {
      error(
        `Order could not be confirmed.\n\n${err.message}\n\nNo stock was deducted and no order transaction was partially saved.`,
        'Transaction Reverted'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.customer?.name?.toLowerCase().includes(q) ||
      o.customer?.phone?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header and Create Button      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Delivered Orders</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manually record delivered customer orders, auto-deduct central inventory, and track sales revenue.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-sm transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Delivered Order</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Order #, customer name, or phone..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
          {[
            'ALL',
            'Draft',
            'Confirmed',
            'Processing',
            'Packed',
            'Shipped',
            'Delivered',
            'Cancelled',
            'Returned',
          ].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                statusFilter === st
                  ? 'bg-slate-900 text-white font-semibold shadow-subtle'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st === 'ALL' ? 'All Orders' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items Summary</th>
                <th className="py-3 px-4 text-right">Revenue</th>
                <th className="py-3 px-4 text-right">COGS</th>
                <th className="py-3 px-4 text-right">Gross Profit</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Loading commercial orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No orders found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order._id}
                    onClick={() => setInspectingOrderId(order._id)}
                    className="hover:bg-slate-50/80 cursor-pointer transition"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {order.orderNumber}
                      {order.currentVersion > 1 && (
                        <span className="ml-1 text-[10px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-sans font-medium">
                          v{order.currentVersion}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono">
                      {new Date(order.orderDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {order.customer?.name || 'Walk-in Customer'}
                      </div>
                      {order.customer?.phone && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          {order.customer.phone}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {order.items?.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      ₹{order.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      ₹{(order.totalCost ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                      +₹{(order.totalProfit ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <PaymentStatusBadge status={order.paymentStatus} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Order Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          onCloseCreateOrderModal?.();
        }}
        title="Create New Commercial Order"
        subtitle="Deducts physical stock atomically and permanently binds FIFO inventory batches."
        maxWidth="4xl"
      >
        <form onSubmit={handleCreateOrder} className="space-y-4">
          {/* Order Lifecycle Type Toggle */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-slate-900">Order Creation Lifecycle:</span>
              <p className="text-[11px] text-slate-500">
                {orderStatus === 'Confirmed'
                  ? 'Confirmed: Immediately checks & deducts physical stock and allocates FIFO batches.'
                  : 'Draft: Reserves stock without physical deduction. Reservation is released if cancelled.'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => setOrderStatus('Confirmed')}
                className={`px-3 py-1 rounded text-xs font-semibold transition ${
                  orderStatus === 'Confirmed'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Confirmed Order
              </button>
              <button
                type="button"
                onClick={() => setOrderStatus('Draft')}
                className={`px-3 py-1 rounded text-xs font-semibold transition ${
                  orderStatus === 'Draft'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Draft (Reserve Stock)
              </button>
            </div>
          </div>

          {/* Customer Entry */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="10-digit number"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Organization / College
              </label>
              <input
                type="text"
                value={customerOrg}
                onChange={(e) => setCustomerOrg(e.target.value)}
                placeholder="e.g. IIT Delhi Robotics Club"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>
          </div>

          {/* Line Items Table with Live Available Stock Validation */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-900 tracking-wider uppercase">
                Order Items & Available Stock Check
              </label>
              <button
                type="button"
                onClick={addItemRow}
                className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item Row</span>
              </button>
            </div>

            {products.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-slate-700">No hardware products in catalog</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Your product catalog is currently empty. Please add products and receive stock via Purchases before creating customer orders.
                </p>
              </div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-2">
                <p className="text-xs text-slate-500">No items added to this order yet.</p>
                <button
                  type="button"
                  onClick={addItemRow}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Add Line Item</span>
                </button>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                      <th className="py-2.5 px-3">Product (Available Stock)</th>
                      <th className="py-2.5 px-3 w-28 text-center">Qty to Buy</th>
                      <th className="py-2.5 px-3 w-32 text-right">Selling Price (₹)</th>
                      <th className="py-2.5 px-3 w-24 text-right">Discount (₹)</th>
                      <th className="py-2.5 px-3 w-32 text-right">Net Revenue</th>
                      <th className="py-2.5 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {items.map((item, idx) => {
                      const prod = products.find((p) => p._id === item.productId);
                      const available = prod ? prod.currentStock - prod.reservedStock : 0;
                      const isOverselling = orderStatus === 'Confirmed' && item.quantity > available;
                      const lineRevenue = item.quantity * item.sellingPrice - (item.discount || 0);

                      return (
                        <tr
                          key={idx}
                          className={isOverselling ? 'bg-rose-50/70' : 'hover:bg-slate-50/50'}
                        >
                          <td className="py-2 px-3 font-sans">
                            <select
                              value={item.productId}
                              onChange={(e) => updateItemRow(idx, 'productId', e.target.value)}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                            >
                              {products.map((p) => (
                                <option key={p._id} value={p._id}>
                                  {p.name} ({p.sku}) — Available: {p.currentStock - p.reservedStock}
                                </option>
                              ))}
                            </select>
                            {isOverselling && (
                              <div className="text-[11px] text-rose-600 font-medium mt-0.5">
                                ⚠️ Only {available} available in stock!
                              </div>
                            )}
                          </td>

                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) =>
                                updateItemRow(idx, 'quantity', parseInt(e.target.value) || 0)
                              }
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-center"
                              required
                            />
                          </td>

                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              value={item.sellingPrice}
                              onChange={(e) =>
                                updateItemRow(idx, 'sellingPrice', parseFloat(e.target.value) || 0)
                              }
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-right"
                              required
                            />
                          </td>

                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min={0}
                              value={item.discount}
                              onChange={(e) =>
                                updateItemRow(idx, 'discount', parseFloat(e.target.value) || 0)
                              }
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-right"
                            />
                          </td>

                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            ₹{Math.max(0, lineRevenue).toLocaleString('en-IN')}
                          </td>

                          <td className="py-2 px-2 text-center">
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItemRow(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-800"
              >
                <option value="Paid">Paid in Full</option>
                <option value="Partial">Partial Payment</option>
                <option value="Pending">Payment Pending</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-800"
              >
                <option value="UPI">UPI (GooglePay / PhonePe / Paytm)</option>
                <option value="Cash">Cash at Counter</option>
                <option value="Card">Credit / Debit Card</option>
                <option value="NetBanking">NEFT / RTGS / Net Banking</option>
              </select>
            </div>

            {paymentStatus === 'Partial' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Amount Collected (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                  required
                />
              </div>
            )}
          </div>

          {/* Footer Subtotal & Action */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-500">Order Subtotal (Net Revenue):</span>
              <div className="text-xl font-bold font-mono text-slate-900">
                ₹{calculateSubtotal().toLocaleString('en-IN')}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  onCloseCreateOrderModal?.();
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Validating & Deducting...'
                    : orderStatus === 'Confirmed'
                    ? 'Confirm Order & Deduct Stock'
                    : 'Save Draft Order'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Order Detail Modal */}
      <OrderDetailModal
        orderId={inspectingOrderId}
        isOpen={!!inspectingOrderId}
        onClose={() => setInspectingOrderId(null)}
        onOrderUpdated={loadOrders}
      />
    </div>
  );
};
