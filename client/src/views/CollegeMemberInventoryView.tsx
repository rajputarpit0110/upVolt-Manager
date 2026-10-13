import React, { useState, useEffect, useMemo } from 'react';
import {
  Cpu,
  Building2,
  Package,
  Calendar,
  Layers,
  Search,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
  ShoppingCart,
  Truck,
  Plus,
  UserCheck,
  User as UserIcon,
  Phone,
  FileText,
  X,
  CreditCard,
  Banknote,
  AlertCircle,
  ExternalLink,
  Printer,
  ChevronRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { CollegeInventory, CollegeDispatch, Order, User, Product } from '../types';
import { collegeApi, orderApi, productApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Common/Toast';

interface CollegeMemberInventoryViewProps {
  initialTab?: 'orders' | 'stock' | 'received';
}

export const CollegeMemberInventoryView: React.FC<CollegeMemberInventoryViewProps> = ({
  initialTab = 'orders',
}) => {
  const { user } = useAuth();
  const { success, error, warning } = useToast();

  const collegeName = user?.college || 'My College';

  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'stock' | 'received'>(initialTab);
  const [inventory, setInventory] = useState<CollegeInventory[]>([]);
  const [dispatches, setDispatches] = useState<CollegeDispatch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryAgents, setDeliveryAgents] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'ALL' | 'UNASSIGNED' | 'ASSIGNED' | 'DELIVERED'>('ALL');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('ALL');

  // Modals
  const [isLogOrderModalOpen, setIsLogOrderModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedOrderToAssign, setSelectedOrderToAssign] = useState<Order | null>(null);
  const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null);

  // Order Form State
  const [webOrderNumber, setWebOrderNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [campusLocation, setCampusLocation] = useState('');
  const [items, setItems] = useState<
    { productId: string; quantity: number; sellingPrice: number }[]
  >([]);
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Pending'>('Paid');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Cash' | 'Card'>('UPI');
  const [assignedAgentUserId, setAssignedAgentUserId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Assign Modal State
  const [modalSelectedAgentId, setModalSelectedAgentId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    setActiveSubTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    loadCollegeData();
    loadTeamAndProducts();
    loadOrders();
  }, [collegeName]);

  const loadCollegeData = async () => {
    setIsLoading(true);
    try {
      const [invRes, dispRes] = await Promise.all([
        collegeApi.getInventory(collegeName),
        collegeApi.getDispatches({ college: collegeName }),
      ]);

      if (invRes.success) {
        setInventory(invRes.items || []);
      }
      if (dispRes.success) {
        setDispatches(dispRes.dispatches || []);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load college inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTeamAndProducts = async () => {
    try {
      const [teamRes, prodRes] = await Promise.all([
        collegeApi.getTeam(collegeName),
        productApi.getAll(),
      ]);

      if (teamRes.success) {
        setDeliveryAgents(teamRes.deliveryAgents || []);
      }
      if (prodRes.success) {
        setProducts(prodRes.products || []);
      }
    } catch (err) {
      // quiet fail
    }
  };

  const loadOrders = async () => {
    try {
      const res = await orderApi.getAll({ limit: 200 });
      if (res.success) {
        setOrders(res.orders || []);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load campus orders');
    }
  };

  const handleOpenLogModal = () => {
    // Generate suggested web order ref
    const randNum = Math.floor(1000 + Math.random() * 9000);
    setWebOrderNumber(`WEB-${randNum}`);
    setStudentName('');
    setStudentPhone('');
    setCampusLocation('');
    setDeliveryCharge(0);
    setPaymentStatus('Paid');
    setPaymentMethod('UPI');
    setAssignedAgentUserId(deliveryAgents.length > 0 ? deliveryAgents[0].userId : '');
    setNotes('');

    // Pre-populate 1st line item from available inventory if exists
    if (inventory.length > 0) {
      const firstItem = inventory[0];
      const prod = products.find((p) => p._id === firstItem.productId.toString());
      setItems([
        {
          productId: firstItem.productId.toString(),
          quantity: 1,
          sellingPrice: prod ? prod.sellingPrice : 0,
        },
      ]);
    } else {
      setItems([{ productId: '', quantity: 1, sellingPrice: 0 }]);
    }

    setIsLogOrderModalOpen(true);
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, { productId: '', quantity: 1, sellingPrice: 0 }]);
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
          const prod = products.find((p) => p._id === value);
          return {
            ...item,
            productId: value,
            sellingPrice: prod ? prod.sellingPrice : item.sellingPrice,
          };
        }
        return { ...item, [field]: value };
      })
    );
  };

  // Line calculations
  const itemsSubtotal = useMemo(() => {
    return items.reduce(
      (acc, curr) => acc + (Number(curr.sellingPrice) || 0) * (Number(curr.quantity) || 0),
      0
    );
  }, [items]);

  const grandTotal = itemsSubtotal + (Number(deliveryCharge) || 0);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentName.trim()) {
      error('Please enter student full name', 'Student Name Required');
      return;
    }
    if (!studentPhone.trim()) {
      error('Please enter student contact number', 'Phone Number Required');
      return;
    }

    if (items.length === 0) {
      error('Please add at least one hardware item', 'No Items Added');
      return;
    }

    for (const item of items) {
      if (!item.productId) {
        error('Please select a hardware component for each row', 'Invalid Item');
        return;
      }
      if (item.quantity <= 0) {
        error('Quantity must be 1 or higher', 'Invalid Quantity');
        return;
      }

      // Check against campus inventory
      const invRecord = inventory.find((i) => i.productId.toString() === item.productId);
      if (!invRecord || invRecord.currentStock < item.quantity) {
        const prod = products.find((p) => p._id === item.productId);
        const avail = invRecord ? invRecord.currentStock : 0;
        error(
          `Insufficient stock in campus lab for "${prod?.name || 'Component'}". Available in lab: ${avail}, Requested: ${item.quantity}`,
          'Stock Shortage'
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        customer: {
          name: studentName.trim(),
          phone: studentPhone.trim(),
          college: collegeName,
          address: campusLocation.trim() || undefined,
          notes: campusLocation.trim() || undefined,
        },
        deliveryInfo: {
          customerName: studentName.trim(),
          phone: studentPhone.trim(),
          college: collegeName,
          address: campusLocation.trim() || undefined,
          notes: campusLocation.trim() || undefined,
          deliveryCharge: Number(deliveryCharge) || 0,
        },
        items: items.map((it) => ({
          productId: it.productId,
          quantity: Number(it.quantity),
          sellingPrice: Number(it.sellingPrice),
          discount: 0,
        })),
        deliveryCharge: Number(deliveryCharge) || 0,
        status: 'Confirmed',
        paymentStatus: paymentStatus,
        paymentMethod: paymentMethod,
        amountPaid: paymentStatus === 'Paid' ? grandTotal : 0,
        college: collegeName,
        source: 'Website',
        webOrderNumber: webOrderNumber.trim() || undefined,
        assignedAgentUserId: assignedAgentUserId || undefined,
        notes: `Website Order logged by ${user?.name || 'College Executive'}. Location: ${campusLocation}. Notes: ${notes}`.trim(),
      };

      const res = await orderApi.create(payload);
      if (res.success && res.order) {
        success(
          `Order #${res.order.orderNumber} successfully created and lab stock deducted!`,
          'Website Order Logged'
        );
        setIsLogOrderModalOpen(false);
        await Promise.all([loadOrders(), loadCollegeData()]);
      }
    } catch (err: any) {
      error(err.message || 'Failed to create website order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAssignModal = (order: Order) => {
    setSelectedOrderToAssign(order);
    setModalSelectedAgentId(order.assignedAgent?.userId || '');
    setIsAssignModalOpen(true);
  };

  const handleSaveAssignment = async () => {
    if (!selectedOrderToAssign) return;
    setIsAssigning(true);
    try {
      const res = await orderApi.assignAgent(
        selectedOrderToAssign._id,
        modalSelectedAgentId ? modalSelectedAgentId : null
      );
      if (res.success) {
        const agentObj = deliveryAgents.find((a) => a.userId === modalSelectedAgentId);
        success(
          modalSelectedAgentId
            ? `Order #${selectedOrderToAssign.orderNumber} assigned to ${agentObj?.name || 'Distributive Agent'}!`
            : `Order #${selectedOrderToAssign.orderNumber} unassigned.`,
          'Assignment Updated'
        );
        setIsAssignModalOpen(false);
        loadOrders();
      }
    } catch (err: any) {
      error(err.message || 'Failed to update order assignment');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    try {
      const res = await orderApi.updateStatus(orderId, 'Delivered');
      if (res.success) {
        success('Order marked as delivered successfully!', 'Handover Complete');
        loadOrders();
      }
    } catch (err: any) {
      error(err.message || 'Failed to update order status');
    }
  };

  // Filtered Inventory
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return item.productName.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
    });
  }, [inventory, search]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // Status filter
      if (orderStatusFilter === 'UNASSIGNED' && ord.assignedAgent?.userId) return false;
      if (orderStatusFilter === 'ASSIGNED' && (!ord.assignedAgent?.userId || ord.status === 'Delivered'))
        return false;
      if (orderStatusFilter === 'DELIVERED' && ord.status !== 'Delivered') return false;

      // Agent filter
      if (selectedAgentFilter !== 'ALL') {
        if (selectedAgentFilter === '__UNASSIGNED__' && ord.assignedAgent?.userId) return false;
        if (selectedAgentFilter !== '__UNASSIGNED__' && ord.assignedAgent?.userId !== selectedAgentFilter)
          return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const numMatch = ord.orderNumber?.toLowerCase().includes(q);
        const webMatch = ord.webOrderNumber?.toLowerCase().includes(q);
        const nameMatch = ord.customer?.name?.toLowerCase().includes(q);
        const phoneMatch = ord.customer?.phone?.toLowerCase().includes(q);
        const agentMatch = ord.assignedAgent?.name?.toLowerCase().includes(q);
        const itemMatch = ord.items?.some((i) => i.productName?.toLowerCase().includes(q));
        return numMatch || webMatch || nameMatch || phoneMatch || agentMatch || itemMatch;
      }

      return true;
    });
  }, [orders, orderStatusFilter, selectedAgentFilter, search]);

  const totalStockUnits = inventory.reduce((sum, i) => sum + i.currentStock, 0);

  // Orders KPI Stats
  const orderStats = useMemo(() => {
    const total = orders.length;
    const unassigned = orders.filter((o) => !o.assignedAgent?.userId && o.status !== 'Delivered').length;
    const outForDelivery = orders.filter(
      (o) => o.assignedAgent?.userId && o.status !== 'Delivered' && o.status !== 'Cancelled'
    ).length;
    const delivered = orders.filter((o) => o.status === 'Delivered').length;

    return { total, unassigned, outForDelivery, delivered };
  }, [orders]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* College Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white shadow-md border border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              College Node Lead / Campus Ambassador
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-amber-400" />
            {collegeName} — Campus Portal
          </h1>
          <p className="text-xs text-slate-300">
            Manage incoming website orders, assign student delivery tasks to distributive agents, and supervise campus inventory.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenLogModal}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition active:scale-95"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>Log Website Order</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveSubTab('orders')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === 'orders'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <ShoppingCart className="w-4 h-4 text-amber-600" />
            <span>Campus Orders & Assign ({orders.length})</span>
            {orderStats.unassigned > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px]">
                {orderStats.unassigned}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('stock')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === 'stock'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Cpu className="w-4 h-4 text-blue-600" />
            <span>Available Stock ({inventory.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('received')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === 'received'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Truck className="w-4 h-4 text-emerald-600" />
            <span>Received Dispatches ({dispatches.length})</span>
          </button>
        </div>

        {/* Global Quick Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeSubTab === 'orders'
                ? 'Search student, order #, component...'
                : 'Search components, sensors...'
            }
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
          />
        </div>
      </div>

      {/* SUBTAB 1: CAMPUS ORDERS & DISTRIBUTIVE AGENT ASSIGNMENT */}
      {activeSubTab === 'orders' && (
        <div className="space-y-6">
          {/* KPI Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Total Campus Orders</p>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{orderStats.total}</h3>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">Orders logged for this campus</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <ShoppingCart className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-amber-200/80 bg-gradient-to-br from-white to-amber-50/30 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-800">Needs Agent Assignment</p>
                <h3 className="text-2xl font-extrabold text-amber-700 mt-1">{orderStats.unassigned}</h3>
                <p className="text-[11px] text-amber-600 font-semibold mt-0.5">Ready to assign to an agent</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Out for Delivery</p>
                <h3 className="text-2xl font-extrabold text-indigo-900 mt-1">{orderStats.outForDelivery}</h3>
                <p className="text-[11px] text-indigo-600 font-medium mt-0.5">With distributive agents</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Truck className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Handed Over / Delivered</p>
                <h3 className="text-2xl font-extrabold text-emerald-900 mt-1">{orderStats.delivered}</h3>
                <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Received by students</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Orders Table Container */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Table Filters Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 mr-1">Filter Status:</span>
                <button
                  type="button"
                  onClick={() => setOrderStatusFilter('ALL')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                    orderStatusFilter === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({orders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOrderStatusFilter('UNASSIGNED')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                    orderStatusFilter === 'UNASSIGNED'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  ⚠️ Unassigned ({orderStats.unassigned})
                </button>
                <button
                  type="button"
                  onClick={() => setOrderStatusFilter('ASSIGNED')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                    orderStatusFilter === 'ASSIGNED'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🚚 Out for Delivery ({orderStats.outForDelivery})
                </button>
                <button
                  type="button"
                  onClick={() => setOrderStatusFilter('DELIVERED')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                    orderStatusFilter === 'DELIVERED'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ✓ Delivered ({orderStats.delivered})
                </button>
              </div>

              {/* Agent Filter Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Agent:</span>
                <select
                  value={selectedAgentFilter}
                  onChange={(e) => setSelectedAgentFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="ALL">All Distributive Agents</option>
                  <option value="__UNASSIGNED__">⚠️ Unassigned Only</option>
                  {deliveryAgents.map((ag) => (
                    <option key={ag.userId} value={ag.userId}>
                      {ag.name} ({ag.phone || ag.userId})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-3 px-4">Order # & Website Ref</th>
                    <th className="py-3 px-4">Student & Campus Room</th>
                    <th className="py-3 px-4">Ordered Hardware</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                    <th className="py-3 px-4 text-center">Payment</th>
                    <th className="py-3 px-4">Assigned Distributive Agent</th>
                    <th className="py-3 px-4 text-center">Delivery Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Loading campus orders...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <ShoppingCart className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700">No campus orders found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          When student orders arrive from the main website, click "+ Log Website Order" to add them here and assign an agent.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const isAssigned = !!order.assignedAgent?.userId;
                      const isDelivered = order.status === 'Delivered';

                      return (
                        <tr key={order._id} className="hover:bg-amber-50/20 transition group">
                          {/* Order # and Web Ref */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px] inline-block">
                              {order.orderNumber}
                            </div>
                            {order.webOrderNumber ? (
                              <div className="text-[11px] text-amber-700 font-semibold mt-1 flex items-center gap-1">
                                <span className="px-1.5 py-0.5 bg-amber-100 rounded text-[10px] font-mono">
                                  🌐 {order.webOrderNumber}
                                </span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {order.source || 'Direct'}
                              </div>
                            )}
                            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                              {new Date(order.orderDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>

                          {/* Student Details */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">
                              {order.customer?.name || order.deliveryInfo?.customerName || 'Student'}
                            </div>
                            <div className="text-slate-500 flex items-center gap-2 mt-0.5 text-[11px]">
                              {order.customer?.phone && (
                                <span className="flex items-center gap-1 font-mono text-slate-600">
                                  <Phone className="w-2.5 h-2.5 text-slate-400" />
                                  {order.customer.phone}
                                </span>
                              )}
                            </div>
                            {(order.customer?.address || order.deliveryInfo?.address) && (
                              <div className="text-[10px] text-slate-500 font-medium mt-0.5 truncate max-w-[180px]">
                                📍 {order.customer?.address || order.deliveryInfo?.address}
                              </div>
                            )}
                          </td>

                          {/* Components */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {order.items?.map((it, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-800 text-[10px] font-medium"
                                >
                                  <span className="font-bold text-amber-700">{it.quantity}×</span>
                                  <span className="truncate max-w-[110px]">{it.productName}</span>
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Total */}
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm whitespace-nowrap">
                            ₹{order.totalAmount?.toLocaleString('en-IN')}
                          </td>

                          {/* Payment */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                order.paymentStatus === 'Paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {order.paymentStatus === 'Paid'
                                ? `✓ Paid (${order.paymentMethod || 'Online'})`
                                : '⏳ Cash on Handover'}
                            </span>
                          </td>

                          {/* Assigned Agent */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isAssigned ? (
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>{order.assignedAgent?.name}</span>
                                  </div>
                                  {order.assignedAgent?.phone && (
                                    <span className="text-[10px] font-mono text-slate-500 block ml-5">
                                      {order.assignedAgent.phone}
                                    </span>
                                  )}
                                </div>
                                {!isDelivered && (
                                  <button
                                    onClick={() => handleOpenAssignModal(order)}
                                    className="px-2 py-0.5 rounded text-[10px] font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition"
                                    title="Reassign to another agent"
                                  >
                                    Reassign
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => handleOpenAssignModal(order)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] border border-amber-300 shadow-xs transition active:scale-95"
                              >
                                <UserIcon className="w-3 h-3 text-amber-700" />
                                <span>Assign Agent</span>
                              </button>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isDelivered
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isAssigned
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {isDelivered ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Delivered
                                </>
                              ) : isAssigned ? (
                                <>
                                  <Truck className="w-3 h-3 text-indigo-600" />
                                  Out for Delivery
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  Pending Assignment
                                </>
                              )}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {!isDelivered && isAssigned && (
                                <button
                                  onClick={() => handleMarkDelivered(order._id)}
                                  className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs border border-emerald-200 transition"
                                  title="Mark order as handed over to student"
                                >
                                  ✓ Handed Over
                                </button>
                              )}
                              <button
                                onClick={() => setInspectingOrder(order)}
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition inline-flex items-center gap-1"
                              >
                                <FileText className="w-3 h-3 text-slate-500" />
                                <span>Slip</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: AVAILABLE CAMPUS STOCK */}
      {activeSubTab === 'stock' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-subtle flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <span className="text-[10px] uppercase font-bold text-blue-600 block">Total Catalog Items</span>
                <span className="text-base font-bold font-mono text-blue-900">{inventory.length}</span>
              </div>
              <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-600 block">Total Lab Units</span>
                <span className="text-base font-bold font-mono text-emerald-900">{totalStockUnits}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Available in campus lab for student kit distribution.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 text-[10px] uppercase">
                    <th className="py-3 px-4">Component Name</th>
                    <th className="py-3 px-4">SKU / Code</th>
                    <th className="py-3 px-4 text-center">Available in Lab</th>
                    <th className="py-3 px-4">Last Stock Update</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        Loading campus stock...
                      </td>
                    </tr>
                  ) : filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        No stock records currently available for {collegeName}.
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map((item) => (
                      <tr key={item._id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {item.productName}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                          {item.sku}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono font-extrabold text-slate-900 text-sm">
                          {item.currentStock}
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                          {new Date(item.lastDispatchedAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>In College Lab</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: RECEIVED DISPATCHES */}
      {activeSubTab === 'received' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 text-[10px] uppercase">
                  <th className="py-3 px-4">Date Received</th>
                  <th className="py-3 px-4">Dispatch Reference</th>
                  <th className="py-3 px-4">Components Received</th>
                  <th className="py-3 px-4 text-center">Total Units</th>
                  <th className="py-3 px-4">Dispatched By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      Loading received dispatches...
                    </td>
                  </tr>
                ) : dispatches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      No dispatches received yet.
                    </td>
                  </tr>
                ) : (
                  dispatches.map((d) => (
                    <tr key={d._id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {new Date(d.dispatchDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {d.dispatchNumber}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {d.items.map((it, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200"
                            >
                              <span className="font-bold text-amber-700">{it.quantity}x</span>
                              <span className="truncate max-w-[120px]">{it.productName}</span>
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        {d.totalUnits}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {d.dispatchedBy}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: LOG WEBSITE / STUDENT ORDER */}
      {isLogOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-amber-500" />
                  Log Website Order for {collegeName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record an order received from the main website and immediately assign it to a campus distributive agent.
                </p>
              </div>
              <button
                onClick={() => setIsLogOrderModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="mt-4 space-y-4">
              {/* Order Reference & Source */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>1. Website Reference</span>
                  <span className="text-[11px] font-normal text-amber-800 bg-amber-100/60 px-2 py-0.5 rounded">
                    Main Website Source
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Website Order Reference # <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. WEB-10492"
                      value={webOrderNumber}
                      onChange={(e) => setWebOrderNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium text-slate-800 placeholder-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Campus Node
                    </label>
                    <input
                      type="text"
                      disabled
                      value={collegeName}
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* Student Information */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Student Delivery Details
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Student Full Name <span className="text-rose-500">*</span>
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
                      Student Mobile Phone <span className="text-rose-500">*</span>
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Campus Handover Location / Hostel / Room / Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hostel 3, Room 204 / Electronics Lab"
                    value={campusLocation}
                    onChange={(e) => setCampusLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Ordered Hardware Components */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    3. Ordered Hardware Components ({items.length})
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 bg-amber-100/70 hover:bg-amber-100 px-2 py-1 rounded transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Another Item
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {items.map((item, idx) => {
                    const lineTotal = (Number(item.quantity) || 0) * (Number(item.sellingPrice) || 0);
                    const invRec = inventory.find((i) => i.productId.toString() === item.productId);

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
                            <option value="">-- Select from Lab Inventory --</option>
                            {inventory.map((inv) => (
                              <option key={inv.productId.toString()} value={inv.productId.toString()}>
                                {inv.productName} ({inv.currentStock} in lab)
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
                              max={invRec ? invRec.currentStock : undefined}
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  'quantity',
                                  Math.max(1, parseInt(e.target.value) || 1)
                                )
                              }
                              className="w-16 px-2 py-1 bg-white border border-slate-200 rounded text-xs text-center font-bold"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-400 font-semibold">Rate (₹):</span>
                            <input
                              type="number"
                              min={0}
                              value={item.sellingPrice}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  'sellingPrice',
                                  parseFloat(e.target.value) || 0
                                )
                              }
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

              {/* Payment & Distributive Agent Assignment */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  4. Payment & Distributive Agent
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment Status
                    </label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                    >
                      <option value="Paid">✓ Paid Online (Website / UPI)</option>
                      <option value="Pending">⏳ Cash on Handover (COD / Pending)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Assign Campus Distributive Agent
                    </label>
                    <select
                      value={assignedAgentUserId}
                      onChange={(e) => setAssignedAgentUserId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-950"
                    >
                      <option value="">-- Assign Later / Leave Unassigned --</option>
                      {deliveryAgents.map((ag) => (
                        <option key={ag.userId} value={ag.userId}>
                          👤 {ag.name} ({ag.phone || ag.userId})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Special Website Instructions / Customer Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Call before delivery, deliver after 4 PM"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Total Calculation Strip */}
              <div className="p-3.5 bg-amber-500/10 rounded-xl border border-amber-500/20 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-600 block">Total Payable:</span>
                  <span className="text-xl font-extrabold font-mono text-slate-900">
                    ₹{grandTotal.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-600 block">Items Count:</span>
                  <span className="text-xs font-bold text-amber-900 font-mono">
                    {items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0)} units
                  </span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLogOrderModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Logging Order...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Log Website Order</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ASSIGN / REASSIGN DISTRIBUTIVE AGENT */}
      {isAssignModalOpen && selectedOrderToAssign && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                Assign Distributive Agent
              </h3>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900 text-xs">
                    {selectedOrderToAssign.orderNumber}
                  </span>
                  <span className="font-mono font-bold text-amber-700 text-xs">
                    ₹{selectedOrderToAssign.totalAmount?.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-xs text-slate-700 font-semibold">
                  Student: {selectedOrderToAssign.customer?.name} ({selectedOrderToAssign.customer?.phone})
                </div>
                {selectedOrderToAssign.customer?.address && (
                  <div className="text-[11px] text-slate-500">
                    Location: {selectedOrderToAssign.customer.address}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Distributive Agent for Handover:
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <label
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer text-xs transition ${
                      modalSelectedAgentId === ''
                        ? 'border-amber-500 bg-amber-50/50 text-amber-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>⚠️ Leave Unassigned</span>
                    <input
                      type="radio"
                      name="agentSelection"
                      checked={modalSelectedAgentId === ''}
                      onChange={() => setModalSelectedAgentId('')}
                      className="accent-amber-500"
                    />
                  </label>

                  {deliveryAgents.map((ag) => {
                    const isSelected = modalSelectedAgentId === ag.userId;
                    return (
                      <label
                        key={ag.userId}
                        className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer text-xs transition ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50/50 text-indigo-950 font-bold'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-bold">{ag.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {ag.phone || ag.userId} • Distributive Agent
                          </div>
                        </div>
                        <input
                          type="radio"
                          name="agentSelection"
                          checked={isSelected}
                          onChange={() => setModalSelectedAgentId(ag.userId)}
                          className="accent-indigo-600"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isAssigning}
                  onClick={handleSaveAssignment}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  {isAssigning ? 'Saving...' : 'Confirm Assignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW ORDER RECEIPT SLIP */}
      {inspectingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-500" />
                Campus Handover Slip
              </h3>
              <button
                onClick={() => setInspectingOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs font-medium text-slate-700">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="font-bold text-slate-900 text-sm">UpVolt Campus Node</span>
                  <span className="font-mono font-bold text-amber-700">{inspectingOrder.orderNumber}</span>
                </div>
                {inspectingOrder.webOrderNumber && (
                  <div className="text-[11px] text-slate-500">
                    Website Order ID: <span className="font-mono font-bold text-slate-800">{inspectingOrder.webOrderNumber}</span>
                  </div>
                )}
                <div>
                  Student: <span className="font-bold text-slate-900">{inspectingOrder.customer?.name}</span>
                </div>
                <div>
                  Phone: <span className="font-mono">{inspectingOrder.customer?.phone}</span>
                </div>
                <div>
                  College: <span className="font-bold">{collegeName}</span>
                </div>
                {inspectingOrder.customer?.address && (
                  <div>
                    Location: <span>{inspectingOrder.customer.address}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Delivered Components:
                </div>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
                  {inspectingOrder.items.map((it, idx) => (
                    <div key={idx} className="p-2 flex justify-between items-center bg-white text-xs">
                      <span>
                        {it.quantity}× {it.productName}
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        ₹{(it.quantity * it.sellingPrice).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                  <div className="p-2.5 flex justify-between items-center bg-slate-50 font-bold text-slate-900">
                    <span>Total Amount</span>
                    <span className="font-mono text-sm text-amber-700">
                      ₹{inspectingOrder.totalAmount?.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex justify-between items-center">
                <span>Payment Status:</span>
                <span className="font-bold">
                  {inspectingOrder.paymentStatus === 'Paid'
                    ? `✓ Paid (${inspectingOrder.paymentMethod || 'Online'})`
                    : '⏳ Cash on Handover Pending'}
                </span>
              </div>

              {inspectingOrder.assignedAgent && (
                <div className="text-[11px] text-slate-600 bg-slate-100 p-2.5 rounded-lg flex items-center justify-between">
                  <span>Assigned Distributive Agent:</span>
                  <span className="font-bold text-slate-900">{inspectingOrder.assignedAgent.name}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Slip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
