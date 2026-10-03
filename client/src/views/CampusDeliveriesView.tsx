import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Calendar,
  Phone,
  Building2,
  PackageCheck,
  CheckCircle2,
  Clock,
  Printer,
  X,
  CreditCard,
  Banknote,
  DollarSign,
  AlertCircle,
  ShoppingBag,
  Sparkles,
  MapPin,
  FileText,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { orderApi, productApi, collegeApi } from '../api/client';
import { Order, Product } from '../types';
import { useToast } from '../components/Common/Toast';

export const CampusDeliveriesView: React.FC = () => {
  const { user } = useAuth();
  const { success, error, warning } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [colleges, setColleges] = useState<string[]>([
    'KIET Group of Institutions',
    'ABES Engineering College',
    'AKGEC Ghaziabad',
    'Galgotias University',
    'GL Bajaj Institute',
    'IIT Bombay',
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'ALL' | 'CUSTOM'>('TODAY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isLogDeliveryModalOpen, setIsLogDeliveryModalOpen] = useState(false);
  const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null);

  // Delivery Form State
  const [studentName, setStudentName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [studentCollege, setStudentCollege] = useState(user?.college || 'KIET Group of Institutions');
  const [customCollege, setCustomCollege] = useState('');
  const [locationNotes, setLocationNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  });
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Pending'>('UPI');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Line items for delivery
  const [items, setItems] = useState<
    { productId: string; quantity: number; sellingPrice: number }[]
  >([]);

  useEffect(() => {
    loadProducts();
    loadColleges();
  }, []);

  useEffect(() => {
    loadMyDeliveries();
  }, [dateFilter, startDate, endDate]);

  const loadProducts = async () => {
    try {
      const res = await productApi.getAll();
      if (res.success) {
        setProducts(res.products || []);
      }
    } catch (err: any) {
      console.error('Failed to load products', err);
    }
  };

  const loadColleges = async () => {
    try {
      const res = await collegeApi.getDispatches();
      if (res.success && res.dispatches) {
        const unique = Array.from(new Set(res.dispatches.map((d: any) => d.college).filter(Boolean)));
        if (unique.length > 0) {
          setColleges((prev) => Array.from(new Set([...prev, ...unique])));
        }
      }
    } catch (err) {
      // quiet fail
    }
  };

  const loadMyDeliveries = async () => {
    setIsLoading(true);
    try {
      let start: string | undefined;
      let end: string | undefined;

      const now = new Date();

      if (dateFilter === 'TODAY') {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        start = d.toISOString();
        const e = new Date();
        e.setHours(23, 59, 59, 999);
        end = e.toISOString();
      } else if (dateFilter === 'YESTERDAY') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        d.setHours(0, 0, 0, 0);
        start = d.toISOString();
        const e = new Date();
        e.setDate(e.getDate() - 1);
        e.setHours(23, 59, 59, 999);
        end = e.toISOString();
      } else if (dateFilter === 'THIS_WEEK') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        d.setHours(0, 0, 0, 0);
        start = d.toISOString();
      } else if (dateFilter === 'CUSTOM') {
        if (startDate) start = new Date(startDate).toISOString();
        if (endDate) {
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          end = e.toISOString();
        }
      }

      const res = await orderApi.getAll({
        startDate: start,
        endDate: end,
        limit: 200,
      });

      if (res.success) {
        setOrders(res.orders || []);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load your deliveries');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenLogModal = () => {
    setStudentName('');
    setStudentPhone('');
    setStudentCollege(user?.college || colleges[0] || 'KIET Group of Institutions');
    setCustomCollege('');
    setLocationNotes('');
    setDeliveryCharge(0);
    setPaymentMode('UPI');
    setDeliveryDate(new Date().toISOString().slice(0, 16));

    // Default with 1 item row
    if (products.length > 0) {
      const first = products[0];
      setItems([{ productId: first._id, quantity: 1, sellingPrice: first.sellingPrice }]);
    } else {
      setItems([]);
    }

    setIsLogDeliveryModalOpen(true);
  };

  const handleAddItem = () => {
    if (products.length === 0) return;
    const first = products[0];
    setItems((prev) => [...prev, { productId: first._id, quantity: 1, sellingPrice: first.sellingPrice }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (field === 'productId') {
          const p = products.find((prod) => prod._id === value);
          return {
            ...item,
            productId: value,
            sellingPrice: p ? p.sellingPrice : item.sellingPrice,
          };
        }
        return { ...item, [field]: value };
      })
    );
  };

  // Financial calculations
  const itemsSubtotal = useMemo(() => {
    return items.reduce((acc, curr) => acc + (Number(curr.sellingPrice) || 0) * (Number(curr.quantity) || 0), 0);
  }, [items]);

  const grandTotal = itemsSubtotal + (Number(deliveryCharge) || 0);

  const handleSubmitDelivery = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentName.trim()) {
      error('Please enter student name', 'Student Name Required');
      return;
    }
    if (!studentPhone.trim()) {
      error('Please enter student contact number', 'Phone Number Required');
      return;
    }

    const resolvedCollege = studentCollege === '__CUSTOM__' ? customCollege.trim() : studentCollege.trim();
    if (!resolvedCollege) {
      error('Please specify college name', 'College Required');
      return;
    }

    if (items.length === 0) {
      error('Please add at least one delivered component', 'No Items Added');
      return;
    }

    for (const item of items) {
      if (!item.productId) {
        error('Please select a product for all rows', 'Invalid Product');
        return;
      }
      if (item.quantity <= 0) {
        error('Quantity must be 1 or higher', 'Invalid Quantity');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const orderPayload: any = {
        customer: {
          name: studentName.trim(),
          phone: studentPhone.trim(),
          college: resolvedCollege,
          notes: locationNotes.trim() || undefined,
        },
        deliveryInfo: {
          customerName: studentName.trim(),
          phone: studentPhone.trim(),
          college: resolvedCollege,
          deliveredBy: user?.name || 'Campus Executive',
          deliveryDate: new Date(deliveryDate),
          deliveryCharge: Number(deliveryCharge) || 0,
          notes: locationNotes.trim() || undefined,
        },
        items: items.map((it) => ({
          productId: it.productId,
          quantity: Number(it.quantity),
          sellingPrice: Number(it.sellingPrice),
          discount: 0,
        })),
        deliveryCharge: Number(deliveryCharge) || 0,
        status: 'Delivered',
        paymentStatus: paymentMode === 'Pending' ? 'Pending' : 'Paid',
        paymentMethod: paymentMode === 'Pending' ? 'UPI' : paymentMode,
        amountPaid: paymentMode === 'Pending' ? 0 : grandTotal,
        orderDate: new Date(deliveryDate),
        notes: `Direct Campus Handover by ${user?.name || 'Campus Executive'}. ${locationNotes}`.trim(),
      };

      const res = await orderApi.create(orderPayload);
      if (res.success && res.order) {
        success('Delivery recorded successfully!', 'Handover Completed');
        setIsLogDeliveryModalOpen(false);
        // Automatically open the receipt slip
        setInspectingOrder(res.order);
        loadMyDeliveries();
      }
    } catch (err: any) {
      error(err.message || 'Failed to record delivery');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const numMatch = ord.orderNumber?.toLowerCase().includes(q);
      const studentMatch = ord.customer?.name?.toLowerCase().includes(q);
      const phoneMatch = ord.customer?.phone?.toLowerCase().includes(q);
      const collegeMatch = ord.customer?.college?.toLowerCase().includes(q);
      const prodMatch = ord.items?.some((i) => i.productName?.toLowerCase().includes(q));
      return numMatch || studentMatch || phoneMatch || collegeMatch || prodMatch;
    });
  }, [orders, search]);

  // Executive KPI summary
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = orders.filter((o) => {
      const d = o.orderDate ? new Date(o.orderDate).toISOString().slice(0, 10) : '';
      return d === today;
    });

    const totalCollected = orders
      .filter((o) => o.paymentStatus === 'Paid')
      .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

    const todayCollected = todayOrders
      .filter((o) => o.paymentStatus === 'Paid')
      .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

    return {
      totalCount: orders.length,
      todayCount: todayOrders.length,
      totalCollected,
      todayCollected,
    };
  }, [orders]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner & Executive Identification */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 rounded-2xl p-6 text-white shadow-md border border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Campus Executive Active
            </span>
            {user?.college && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {user.college}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <PackageCheck className="w-7 h-7 text-amber-400" />
            Campus Deliveries & Student Handover
          </h1>
          <p className="text-xs text-slate-300">
            Welcome back, <span className="font-semibold text-white">{user?.name}</span>. Record student deliveries and track your daily handovers.
          </p>
        </div>

        <div>
          <button
            onClick={handleOpenLogModal}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition active:scale-95"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>Record New Delivery</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Today's Deliveries</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{stats.todayCount}</h3>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Handed over today</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Today's Collections</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">₹{stats.todayCollected.toLocaleString('en-IN')}</h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Payment received today</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Banknote className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Handed Over</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{stats.totalCount}</h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Orders delivered by you</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Paid Handed</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">₹{stats.totalCollected.toLocaleString('en-IN')}</h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Total collected revenue</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Deliveries Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name, phone, order #, component..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date Preset Buttons */}
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setDateFilter('TODAY')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  dateFilter === 'TODAY'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('YESTERDAY')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  dateFilter === 'YESTERDAY'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('THIS_WEEK')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  dateFilter === 'THIS_WEEK'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('ALL')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  dateFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('CUSTOM')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  dateFilter === 'CUSTOM'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Custom
              </button>
            </div>

            {dateFilter === 'CUSTOM' && (
              <div className="flex items-center gap-1.5 text-xs">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* Deliveries List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 select-none">
              <tr>
                <th className="py-3 px-4">Delivery Date</th>
                <th className="py-3 px-4">Receipt / Order #</th>
                <th className="py-3 px-4">Student & College</th>
                <th className="py-3 px-4">Items Handed Over</th>
                <th className="py-3 px-4 text-right">Delivery Charge</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Payment</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading your deliveries...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <PackageCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No deliveries found for this period</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Click "+ Record New Delivery" above to log your first handover.</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const itemsCount = order.items?.reduce((acc, it) => acc + it.quantity, 0) || 0;
                  const formattedDate = order.deliveryInfo?.deliveryDate || order.orderDate
                    ? new Date(order.deliveryInfo?.deliveryDate || order.orderDate).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—';

                  return (
                    <tr key={order._id} className="hover:bg-amber-50/20 transition group">
                      <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {formattedDate}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {order.orderNumber}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{order.customer?.name || order.deliveryInfo?.customerName || 'Student'}</div>
                        <div className="text-slate-500 flex items-center gap-2 mt-0.5 text-[11px]">
                          {order.customer?.phone && (
                            <span className="flex items-center gap-0.5">
                              <Phone className="w-2.5 h-2.5 text-slate-400" />
                              {order.customer.phone}
                            </span>
                          )}
                          <span className="text-amber-700 font-medium">
                            • {order.customer?.college || order.deliveryInfo?.college || 'College Campus'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">
                          {order.items?.map((it, idx) => (
                            <span key={idx} className="inline-block bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] mr-1 mb-0.5">
                              {it.quantity}× {it.productName}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                        {order.deliveryCharge > 0 ? `₹${order.deliveryCharge}` : 'Free'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                        ₹{order.totalAmount?.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            order.paymentStatus === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {order.paymentStatus === 'Paid' ? `✓ Paid (${order.paymentMethod || 'UPI'})` : '⏳ Pending'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => setInspectingOrder(order)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 font-semibold text-xs transition inline-flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3 text-slate-500" />
                          <span>View Slip</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Record New Delivery */}
      {isLogDeliveryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-amber-500" />
                  Record Student Delivery Handover
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter student details and components delivered. Stock is automatically updated.
                </p>
              </div>
              <button
                onClick={() => setIsLogDeliveryModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDelivery} className="mt-4 space-y-4">
              {/* Student Details Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  1. Student Information
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Student Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Student Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 9876543210"
                      value={studentPhone}
                      onChange={(e) => setStudentPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      College Campus <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={studentCollege}
                      onChange={(e) => setStudentCollege(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                    >
                      {colleges.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="__CUSTOM__">+ Other / Enter Custom College...</option>
                    </select>

                    {studentCollege === '__CUSTOM__' && (
                      <input
                        type="text"
                        required
                        placeholder="Enter college name"
                        value={customCollege}
                        onChange={(e) => setCustomCollege(e.target.value)}
                        className="mt-2 w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Handover Location / Hostel / Lab (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Near CS Block / Hostel 4"
                      value={locationNotes}
                      onChange={(e) => setLocationNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Delivered Items Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    2. Components Handed Over ({items.length})
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 bg-amber-100/70 hover:bg-amber-100 px-2 py-1 rounded"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Another Item
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {items.map((item, idx) => {
                    const lineTotal = (Number(item.quantity) || 0) * (Number(item.sellingPrice) || 0);
                    const selectedProd = products.find((p) => p._id === item.productId);

                    return (
                      <div
                        key={idx}
                        className="p-2.5 bg-white rounded-lg border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-2"
                      >
                        <div className="flex-1 w-full sm:w-auto">
                          <select
                            value={item.productId}
                            onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium text-slate-800"
                          >
                            {products.map((p) => (
                              <option key={p._id} value={p._id}>
                                {p.name} (₹{p.sellingPrice}) — {p.currentStock} in stock
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-400 font-semibold">Qty:</span>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-16 px-2 py-1 bg-white border border-slate-200 rounded text-xs text-center font-bold"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-400 font-semibold">Rate (₹):</span>
                            <input
                              type="number"
                              min={0}
                              value={item.sellingPrice}
                              onChange={(e) => handleItemChange(idx, 'sellingPrice', parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-xs text-right font-bold"
                            />
                          </div>

                          <div className="font-mono font-bold text-slate-900 text-xs min-w-16 text-right">
                            ₹{lineTotal}
                          </div>

                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Delivery Charge & Payment Section */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  3. Payment & Delivery Charges
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Delivery Charge (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={deliveryCharge}
                      onChange={(e) => setDeliveryCharge(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e: any) => setPaymentMode(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                    >
                      <option value="UPI">Paid via UPI / QR Code</option>
                      <option value="Cash">Paid in Cash</option>
                      <option value="Pending">Payment Pending (Unpaid)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Delivery Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div className="p-3 bg-amber-100/50 rounded-lg flex items-center justify-between border border-amber-200">
                  <div className="text-xs text-amber-950 font-medium">
                    Grand Total to Collect:
                  </div>
                  <div className="text-lg font-black text-amber-950 font-mono">
                    ₹{grandTotal.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLogDeliveryModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                      <span>Recording Delivery...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                      <span>Confirm & Record Delivery</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: View Delivery Handover Slip / Receipt */}
      {inspectingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-xs">
                  DELIVERED
                </span>
                <span className="font-mono text-xs text-slate-400 font-bold">
                  {inspectingOrder.orderNumber}
                </span>
              </div>
              <button
                onClick={() => setInspectingOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Slip Body */}
            <div id="handover-slip" className="py-4 space-y-4 text-xs text-slate-800">
              {/* Slip Header */}
              <div className="text-center pb-3 border-b border-dashed border-slate-200">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  UPVOLT TECHNOLOGIES
                </h2>
                <p className="text-[11px] text-slate-500">Official Student Handover Slip</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {new Date(inspectingOrder.deliveryInfo?.deliveryDate || inspectingOrder.orderDate).toLocaleString('en-IN')}
                </p>
              </div>

              {/* Student & Executive Info */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Student</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {inspectingOrder.customer?.name || inspectingOrder.deliveryInfo?.customerName}
                  </div>
                  <div className="text-slate-500">{inspectingOrder.customer?.phone || inspectingOrder.deliveryInfo?.phone}</div>
                  <div className="text-amber-800 font-semibold">{inspectingOrder.customer?.college || inspectingOrder.deliveryInfo?.college}</div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Handed Over By</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {inspectingOrder.deliveryInfo?.deliveredBy || user?.name}
                  </div>
                  <div className="text-emerald-700 font-medium">Campus Executive</div>
                  <div className="text-[10px] text-slate-400 mt-1">Status: Delivered & Verified</div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <table className="w-full text-left">
                  <thead className="border-b border-slate-200 text-slate-400 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="py-1.5">Component</th>
                      <th className="py-1.5 text-center">Qty</th>
                      <th className="py-1.5 text-right">Rate</th>
                      <th className="py-1.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {inspectingOrder.items?.map((it, i) => (
                      <tr key={i}>
                        <td className="py-2 text-slate-800 font-sans font-medium">{it.productName}</td>
                        <td className="py-2 text-center text-slate-700">{it.quantity}</td>
                        <td className="py-2 text-right text-slate-600">₹{it.sellingPrice}</td>
                        <td className="py-2 text-right font-bold text-slate-900">
                          ₹{it.quantity * it.sellingPrice}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Charges and Total */}
              <div className="pt-2 border-t border-slate-200 space-y-1 font-mono text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span>₹{inspectingOrder.subtotal?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Delivery Charge:</span>
                  <span>
                    {inspectingOrder.deliveryCharge > 0 ? `₹${inspectingOrder.deliveryCharge}` : 'Free'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold text-sm pt-1 border-t border-slate-200">
                  <span>Total Collected:</span>
                  <span>₹{inspectingOrder.totalAmount?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold text-[11px] pt-0.5">
                  <span>Payment Status:</span>
                  <span>
                    {inspectingOrder.paymentStatus === 'Paid'
                      ? `Paid via ${inspectingOrder.paymentMethod || 'UPI'}`
                      : 'Pending'}
                  </span>
                </div>
              </div>
            </div>

            {/* Slip Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Slip</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectingOrder(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
