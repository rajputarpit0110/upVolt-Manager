import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Mail,
  Phone,
  Building,
  Package,
  Truck,
  Receipt,
  Eye,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Layers,
  Calendar,
  CreditCard,
  X,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { Customer, CustomerOrderSummary, CustomerPurchasedItem } from '../types';
import { customerApi } from '../api/client';
import { Modal } from '../components/Common/Modal';
import { useToast } from '../components/Common/Toast';

export const CustomersView: React.FC = () => {
  const { success, error } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Customer Purchase Details Modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  // Add Customer Form Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [organization, setOrganization] = useState('KIET');
  const [category, setCategory] = useState<'Student' | 'Developer' | 'College/University' | 'Startup/Company' | 'Other'>('Student');
  const [shippingAddress, setShippingAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const res = await customerApi.getAll();
      if (res.success) {
        setCustomers(res.customers);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPhone = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPhone(text);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      error('Customer name is required', 'Validation Error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await customerApi.create({
        name,
        email,
        phone,
        organization,
        category,
        shippingAddress,
      });

      if (res.success) {
        success(`Customer ${name} added to directory.`, 'Customer Created');
        setIsAddModalOpen(false);
        setName('');
        setEmail('');
        setPhone('');
        setOrganization('KIET');
        setShippingAddress('');
        loadCustomers();
      }
    } catch (err: any) {
      error(err.message || 'Failed to create customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter customers by search (name, phone, college, or purchased item) and category
  const filteredCustomers = customers.filter((c) => {
    if (selectedCategory !== 'ALL' && c.category !== selectedCategory) {
      return false;
    }

    if (!search.trim()) return true;
    const q = search.toLowerCase();

    // Check customer name, email, phone, organization/college
    const matchesProfile =
      c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.organization?.toLowerCase().includes(q) ||
      c.college?.toLowerCase().includes(q);

    if (matchesProfile) return true;

    // Check if customer bought this item (by product name or SKU)
    const matchesPurchasedItems = (c.purchasedItems || []).some(
      (it) => it.productName.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q)
    );

    return matchesPurchasedItems;
  });

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Customer Directory & Sales Ledger</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              {customers.length} Students & Clients
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Full customer purchase history, itemized equipment breakdown, unit rates, and delivery charges.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-sm transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, phone, or item bought (e.g. Arduino, Servo)..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {['ALL', 'Student', 'Developer', 'College/University'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'ALL' ? 'All Customers' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Customers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Customer & Campus</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Items Bought & Rates (Detail)</th>
                <th className="py-3 px-4 text-center">Delivery Charge</th>
                <th className="py-3 px-4 text-center">Orders</th>
                <th className="py-3 px-4 text-right">Lifetime Spend</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading customer purchase history...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <span>No customer records match your filter.</span>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const purchased = c.purchasedItems || [];
                  const orders = c.orders || [];
                  const deliveryFee = orders.reduce((sum, o) => sum + (o.deliveryCharge || 0), 0);

                  return (
                    <tr
                      key={c._id}
                      onClick={() => setSelectedCustomer(c)}
                      className="hover:bg-amber-50/40 transition cursor-pointer group"
                    >
                      {/* Customer Name & College */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center border border-amber-200 shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-amber-700 transition">
                              {c.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-medium text-[10px]">
                                {c.category || 'Student'}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                {c.organization || c.college || 'KIET'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact Details */}
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {c.phone ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyPhone(c.phone!);
                            }}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 cursor-pointer transition text-[11px]"
                            title="Click to copy phone"
                          >
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{c.phone}</span>
                            {copiedPhone === c.phone ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No phone on file</span>
                        )}
                      </td>

                      {/* Items Bought & Rates */}
                      <td className="py-3.5 px-4 max-w-md">
                        {purchased.length === 0 ? (
                          <span className="text-slate-400 italic text-[11px]">No purchases recorded</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {purchased.slice(0, 3).map((it, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-medium text-[11px]"
                              >
                                <span className="font-bold text-amber-700">{it.quantity}x</span>
                                <span className="truncate max-w-[130px]">{it.productName}</span>
                                <span className="text-slate-500 font-mono text-[10px]">
                                  @ ₹{Math.round(it.unitPrice)}
                                </span>
                              </span>
                            ))}
                            {purchased.length > 3 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px]">
                                +{purchased.length - 3} more items
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Delivery Charge */}
                      <td className="py-3.5 px-4 text-center">
                        {deliveryFee > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 font-mono font-semibold text-slate-800 border border-slate-200 text-[11px]">
                            ₹{deliveryFee}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 text-[10px]">
                            <Truck className="w-3 h-3 text-emerald-600" />
                            <span>Free Campus Handover</span>
                          </span>
                        )}
                      </td>

                      {/* Total Orders Count */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">
                        {c.totalOrders || orders.length}
                      </td>

                      {/* Lifetime Spend */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                        ₹{(c.totalSpent || 0).toLocaleString('en-IN')}
                      </td>

                      {/* Action Button */}
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedCustomer(c)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-amber-500 hover:text-white text-slate-700 font-medium text-xs border border-slate-200 hover:border-amber-500 transition shadow-xs"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>View Detail</span>
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

      {/* ========================================================= */}
      {/* DETAILED CUSTOMER PURCHASE DOSSIER MODAL */}
      {/* ========================================================= */}
      {selectedCustomer && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCustomer(null)}
          title={`Purchase Ledger: ${selectedCustomer.name}`}
          subtitle={`Student & Hardware Client Dossier • ${selectedCustomer.organization || selectedCustomer.college || 'KIET'}`}
          maxWidth="2xl"
        >
          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
            {/* Customer Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Contact Phone
                </span>
                <div className="mt-1 flex items-center gap-1.5 font-mono text-xs font-bold text-slate-800">
                  <Phone className="w-3.5 h-3.5 text-amber-600" />
                  <span>{selectedCustomer.phone || 'No phone recorded'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Campus / College
                </span>
                <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Building className="w-3.5 h-3.5 text-blue-600" />
                  <span>{selectedCustomer.organization || selectedCustomer.college || 'KIET Campus'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Lifetime Spend / Orders
                </span>
                <div className="mt-1 flex items-center gap-1.5 font-mono text-sm font-extrabold text-slate-900">
                  <span>₹{selectedCustomer.totalSpent.toLocaleString('en-IN')}</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    ({selectedCustomer.totalOrders} {selectedCustomer.totalOrders === 1 ? 'order' : 'orders'})
                  </span>
                </div>
              </div>
            </div>

            {/* Orders & Line Items Details */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-amber-600" />
                  <span>Delivered Orders & Equipment Invoices</span>
                </h3>
                <span className="text-xs font-medium text-slate-500">
                  {selectedCustomer.orders?.length || 0} Delivered Transaction(s)
                </span>
              </div>

              {(!selectedCustomer.orders || selectedCustomer.orders.length === 0) ? (
                <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No individual order lines recorded for this customer.
                </div>
              ) : (
                selectedCustomer.orders.map((order, orderIdx) => (
                  <div
                    key={order._id || orderIdx}
                    className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs"
                  >
                    {/* Order Header Bar */}
                    <div className="bg-slate-50/90 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {order.orderNumber}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-600 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(order.orderDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Delivered
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          Paid (UPI)
                        </span>
                      </div>
                    </div>

                    {/* Order Line Items Table */}
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100/50 text-slate-500 border-b border-slate-100 text-[10px] font-semibold uppercase">
                          <th className="py-2 px-4">Hardware Component</th>
                          <th className="py-2 px-3 text-center">Qty</th>
                          <th className="py-2 px-3 text-right">Unit Rate</th>
                          <th className="py-2 px-4 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {order.items.map((item, itemIdx) => (
                          <tr key={itemIdx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-4 font-medium text-slate-800">
                              <div>{item.productName}</div>
                              <div className="font-mono text-[10px] text-slate-400">{item.sku}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              ₹{item.sellingPrice.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                              ₹{(item.revenue || item.sellingPrice * item.quantity).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Order Financial Summary Footer */}
                    <div className="bg-slate-50/60 p-3 px-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                        <Truck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Delivery Charge:</span>
                        <span className="font-bold text-emerald-700">
                          {order.deliveryCharge > 0 ? `₹${order.deliveryCharge.toFixed(2)}` : '₹0.00 (Campus Free Handover)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-slate-500 text-[11px]">
                          Subtotal: <span className="font-mono">₹{order.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="text-sm font-bold text-slate-900">
                          Total Paid:{' '}
                          <span className="font-mono text-emerald-700 font-extrabold">
                            ₹{order.totalAmount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Aggregated Hardware Items Bought Table */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span>All Hardware Components Purchased (Combined Summary)</span>
                </h3>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold text-[10px] uppercase border-b border-slate-200">
                      <th className="py-2 px-4">Component Name</th>
                      <th className="py-2 px-3">SKU</th>
                      <th className="py-2 px-3 text-center">Total Quantity</th>
                      <th className="py-2 px-3 text-right">Avg Rate</th>
                      <th className="py-2 px-4 text-right">Total Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedCustomer.purchasedItems || []).map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{it.productName}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{it.sku}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-700">
                          {it.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          ₹{it.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          ₹{it.totalAmount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Customer"
        subtitle="Customer records will be linked to commercial sales orders."
        maxWidth="md"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vikramaditya Verma"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e: any) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
            >
              <option value="Student">Student</option>
              <option value="Developer">Developer</option>
              <option value="College/University">College / University Lab</option>
              <option value="Startup/Company">Startup / Company</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit number"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Organization / University
            </label>
            <input
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="e.g. KIET Group of Institutions"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Shipping Address
            </label>
            <textarea
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              rows={2}
              placeholder="Campus or hostel room address"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Create Customer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
