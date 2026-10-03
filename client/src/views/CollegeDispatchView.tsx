import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Trash2,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Search,
  Package,
  Layers,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { Product, CollegeDispatch } from '../types';
import { productApi, collegeApi } from '../api/client';
import { Modal } from '../components/Common/Modal';
import { useToast } from '../components/Common/Toast';
import { useAuth } from '../context/AuthContext';

interface DispatchRow {
  productId: string;
  quantity: number;
}

export const CollegeDispatchView: React.FC = () => {
  const { user, isMasterAdmin } = useAuth();
  const { success, error } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [dispatches, setDispatches] = useState<CollegeDispatch[]>([]);
  const [collegesList, setCollegesList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [collegeName, setCollegeName] = useState('KIET Group of Institutions');
  const [customCollege, setCustomCollege] = useState('');
  const [dispatchDate, setDispatchDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DispatchRow[]>([{ productId: '', quantity: 1 }]);

  // Confirmation Modal State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Detail Modal State
  const [inspectingDispatch, setInspectingDispatch] = useState<CollegeDispatch | null>(null);

  // Filter State for History
  const [filterCollege, setFilterCollege] = useState('ALL');
  const [filterSearch, setFilterSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, dispRes, colRes] = await Promise.all([
        productApi.getAll(),
        collegeApi.getDispatches(),
        collegeApi.getColleges(),
      ]);

      if (prodRes.success) {
        setProducts(prodRes.products);
        if (prodRes.products.length > 0 && !items[0]?.productId) {
          setItems([{ productId: prodRes.products[0]._id, quantity: 1 }]);
        }
      }
      if (dispRes.success) {
        setDispatches(dispRes.dispatches);
      }
      if (colRes.success) {
        setCollegesList(colRes.colleges);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load dispatch data');
    } finally {
      setIsLoading(false);
    }
  };

  // Row Manipulation
  const addItemRow = () => {
    if (products.length === 0) return;
    setItems((prev) => [...prev, { productId: products[0]._id, quantity: 1 }]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateItemRow = (index: number, field: keyof DispatchRow, val: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  // Calculations & Validations
  const getSelectedCollege = () => {
    return collegeName === '__CUSTOM__' ? customCollege.trim() : collegeName.trim();
  };

  const totalUnits = items.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  const totalCost = items.reduce((sum, r) => {
    const p = products.find((prod) => prod._id === r.productId);
    const cp = p ? Number(p.averageCost || 0) : 0;
    return sum + (Number(r.quantity) || 0) * cp;
  }, 0);

  // Check if any row exceeds available stock
  const hasInsufficientStock = items.some((row) => {
    const prod = products.find((p) => p._id === row.productId);
    if (!prod) return true;
    return (Number(row.quantity) || 0) > prod.currentStock;
  });

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCollege = getSelectedCollege();
    if (!finalCollege) {
      error('Please select or enter a valid college name.');
      return;
    }

    if (items.length === 0) {
      error('At least one product must be added to the dispatch.');
      return;
    }

    for (const row of items) {
      const prod = products.find((p) => p._id === row.productId);
      if (!prod) {
        error('Please select a valid product for all rows.');
        return;
      }
      if (!row.quantity || row.quantity <= 0) {
        error(`Quantity must be greater than 0 for ${prod.name}.`);
        return;
      }
      if (row.quantity > prod.currentStock) {
        error(
          `Insufficient stock for ${prod.name}. Available: ${prod.currentStock}, Requested: ${row.quantity}`
        );
        return;
      }
    }

    setIsConfirmModalOpen(true);
  };

  const handleExecuteDispatch = async () => {
    setIsSubmitting(true);
    const finalCollege = getSelectedCollege();

    try {
      const res = await collegeApi.createDispatch({
        college: finalCollege,
        dispatchDate,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
        })),
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        success(
          `Successfully dispatched ${res.dispatch.totalUnits} units to ${finalCollege}. Central stock decreased and college stock updated!`,
          'Dispatch Confirmed'
        );
        setIsConfirmModalOpen(false);
        setNotes('');
        if (products.length > 0) {
          setItems([{ productId: products[0]._id, quantity: 1 }]);
        }
        loadData();
      }
    } catch (err: any) {
      error(err.message || 'Failed to execute dispatch');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered dispatches for history
  const filteredDispatches = dispatches.filter((d) => {
    if (filterCollege !== 'ALL' && d.college !== filterCollege) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const matchCollege = d.college.toLowerCase().includes(q);
      const matchNumber = d.dispatchNumber.toLowerCase().includes(q);
      const matchItems = d.items.some(
        (it) => it.productName.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q)
      );
      if (!matchCollege && !matchNumber && !matchItems) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">College Hardware Dispatch</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Transfer components from Central Inventory to partner colleges with real-time stock validation and automatic costing.
          </p>
        </div>
      </div>

      {/* Main Dispatch Creation Form */}
      <form
        onSubmit={handleOpenConfirm}
        className="bg-white border border-slate-200 rounded-xl shadow-subtle p-5 space-y-6"
      >
        {/* Destination & Date Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Destination College / Institution <span className="text-rose-500">*</span>
            </label>
            <select
              value={collegeName}
              onChange={(e) => setCollegeName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="KIET Group of Institutions">KIET Group of Institutions</option>
              <option value="ABES Engineering College">ABES Engineering College</option>
              <option value="AKGEC Ghaziabad">AKGEC Ghaziabad</option>
              <option value="Galgotias University">Galgotias University</option>
              <option value="GL Bajaj Institute">GL Bajaj Institute</option>
              {collegesList
                .filter(
                  (c) =>
                    ![
                      'KIET Group of Institutions',
                      'ABES Engineering College',
                      'AKGEC Ghaziabad',
                      'Galgotias University',
                      'GL Bajaj Institute',
                    ].includes(c)
                )
                .map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              <option value="__CUSTOM__">+ Other / Enter Custom College...</option>
            </select>

            {collegeName === '__CUSTOM__' && (
              <input
                type="text"
                required
                value={customCollege}
                onChange={(e) => setCustomCollege(e.target.value)}
                placeholder="Enter college / university name"
                className="mt-2 w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Dispatch Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={dispatchDate}
              onChange={(e) => setDispatchDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Dispatch Notes / Lab Incharge
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. For IoT Lab Workshop / Prof. Sharma"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>

        {/* Multi-Product Dispatch Table with Live Available Stock Indicators */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Products to Dispatch (Direct from Central Inventory)
              </h2>
              <p className="text-[11px] text-slate-400">
                Components will be deducted from Central UpVolt Stock and credited to the college's local stock.
              </p>
            </div>

            <button
              type="button"
              onClick={addItemRow}
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Component</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[10px] uppercase">
                  <th className="py-2.5 px-3">Component / Product</th>
                  <th className="py-2.5 px-3 w-32 text-center">Available Stock</th>
                  <th className="py-2.5 px-3 w-32 text-center">Sending Qty</th>
                  <th className="py-2.5 px-3 w-36 text-center">Stock Status</th>
                  <th className="py-2.5 px-4 w-36 text-right">Batch Cost (₹)</th>
                  <th className="py-2.5 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row, idx) => {
                  const prod = products.find((p) => p._id === row.productId);
                  const available = prod ? prod.currentStock : 0;
                  const sending = Number(row.quantity) || 0;
                  const remaining = available - sending;
                  const isInsufficient = sending > available;
                  const unitCost = prod ? Number(prod.averageCost || 0) : 0;
                  const lineCost = sending * unitCost;

                  return (
                    <tr
                      key={idx}
                      className={isInsufficient ? 'bg-rose-50/60' : 'hover:bg-slate-50/50'}
                    >
                      <td className="py-2.5 px-3">
                        <select
                          required
                          value={row.productId}
                          onChange={(e) => updateItemRow(idx, 'productId', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          {products.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.name} ({p.sku}) — Available: {p.currentStock}
                            </option>
                          ))}
                        </select>
                        {prod && (
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            SKU: {prod.sku} • CP: ₹{prod.averageCost}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                        {available} units
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          min={1}
                          required
                          value={row.quantity}
                          onChange={(e) => updateItemRow(idx, 'quantity', parseInt(e.target.value) || 0)}
                          className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-mono font-bold text-center focus:outline-none focus:ring-1 ${
                            isInsufficient
                              ? 'border-rose-300 text-rose-700 focus:ring-rose-500'
                              : 'border-slate-200 text-slate-800 focus:ring-amber-500'
                          }`}
                        />
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        {isInsufficient ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                            <span>Insufficient ({available})</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>✓ Available (Rem: {remaining})</span>
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        ₹{lineCost.toLocaleString('en-IN')}
                      </td>

                      <td className="py-2.5 px-2 text-center">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dispatch Costing Summary Footer */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Total Dispatch Inventory Cost
            </span>
            <div className="text-2xl font-extrabold font-mono text-slate-900">
              ₹{totalCost.toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-slate-500">
              Calculated using true FIFO inventory batch cost prices ({totalUnits} units total)
            </span>
          </div>

          <div className="flex items-center gap-3">
            {hasInsufficientStock && (
              <span className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                <span>Fix stock shortage before dispatching</span>
              </span>
            )}

            <button
              type="submit"
              disabled={hasInsufficientStock || totalUnits <= 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <Truck className="w-4 h-4" />
              <span>Review & Confirm Dispatch</span>
            </button>
          </div>
        </div>
      </form>

      {/* ========================================================= */}
      {/* CONFIRMATION SUMMARY MODAL BEFORE SAVING DISPATCH */}
      {/* ========================================================= */}
      {isConfirmModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsConfirmModalOpen(false)}
          title="Confirm College Dispatch"
          subtitle="Please verify the components and quantities being transferred from Central Stock"
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-900">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600">Destination:</span>
                <span className="font-bold text-slate-900">{getSelectedCollege()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600">Dispatch Date:</span>
                <span className="font-bold text-slate-900">{dispatchDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600">Handled By:</span>
                <span className="font-bold text-slate-900">{user?.name} ({user?.userId})</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[10px] uppercase">
                    <th className="py-2 px-3">Product Name</th>
                    <th className="py-2 px-3 text-center">Qty to Send</th>
                    <th className="py-2 px-3 text-right">Cost Price</th>
                    <th className="py-2 px-3 text-right">Line Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {items.map((row, idx) => {
                    const prod = products.find((p) => p._id === row.productId);
                    const unitCost = prod ? prod.averageCost || 0 : 0;
                    const lineCost = (Number(row.quantity) || 0) * unitCost;

                    return (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-sans font-medium text-slate-800">
                          {prod?.name} ({prod?.sku})
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-amber-700">
                          {row.quantity}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600">
                          ₹{unitCost}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          ₹{lineCost.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-bold">
              <span>Total Units to Dispatch: {totalUnits}</span>
              <span className="text-sm font-mono text-emerald-700">
                Total Cost: ₹{totalCost.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel / Edit
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleExecuteDispatch}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Transferring Stock...' : 'Confirm Dispatch'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* COLLEGE DISPATCH HISTORY TABLE */}
      {/* ========================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-subtle overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">College Dispatch History</h2>
            <p className="text-xs text-slate-500">Authoritative audit of hardware components sent to partner institutions</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Search dispatch..."
                className="w-full pl-8 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <select
              value={filterCollege}
              onChange={(e) => setFilterCollege(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Colleges</option>
              {collegesList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 text-[10px] uppercase">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Dispatch #</th>
                <th className="py-3 px-4">College</th>
                <th className="py-3 px-4">Products & Units</th>
                <th className="py-3 px-4 text-center">Total Units</th>
                <th className="py-3 px-4 text-right">Total Cost</th>
                <th className="py-3 px-4">Dispatched By</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading dispatch ledger...
                  </td>
                </tr>
              ) : filteredDispatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No dispatch records found.
                  </td>
                </tr>
              ) : (
                filteredDispatches.map((d) => (
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

                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {d.college}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {d.items.map((it, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200"
                          >
                            <span className="font-bold text-amber-700">{it.quantity}x</span>
                            <span className="truncate max-w-[100px]">{it.productName}</span>
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                      {d.totalUnits}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      ₹{(d.totalCost || 0).toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      {d.dispatchedBy}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setInspectingDispatch(d)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium text-[11px] border border-slate-200 transition"
                      >
                        <Eye className="w-3 h-3 text-slate-500" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: DISPATCH DETAILS */}
      {/* ========================================================= */}
      {inspectingDispatch && (
        <Modal
          isOpen={true}
          onClose={() => setInspectingDispatch(null)}
          title={`Dispatch: ${inspectingDispatch.dispatchNumber}`}
          subtitle={`Sent to ${inspectingDispatch.college} on ${new Date(inspectingDispatch.dispatchDate).toLocaleDateString()}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">College</span>
                <span className="font-bold text-slate-800 mt-0.5 block">{inspectingDispatch.college}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Total Cost</span>
                <span className="font-extrabold font-mono text-slate-900 mt-0.5 block">
                  ₹{(inspectingDispatch.totalCost || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[10px] uppercase">
                    <th className="py-2 px-3">Product Name</th>
                    <th className="py-2 px-3 text-center">Qty Sent</th>
                    <th className="py-2 px-3 text-right">Unit Cost</th>
                    <th className="py-2 px-3 text-right">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {inspectingDispatch.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-sans font-medium text-slate-800">
                        <div>{it.productName}</div>
                        <div className="text-[10px] text-slate-400">{it.sku}</div>
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-amber-700">{it.quantity}</td>
                      <td className="py-2 px-3 text-right text-slate-600">₹{it.unitCost || 0}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">₹{it.totalCost || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {inspectingDispatch.notes && (
              <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                <span className="font-bold">Notes:</span> {inspectingDispatch.notes}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
