import React, { useState, useEffect } from 'react';
import { Search, Filter, ArrowLeftRight, Download } from 'lucide-react';
import { StockMovement } from '../types';
import { inventoryApi, reportApi } from '../api/client';
import { Badge } from '../components/Common/Badge';

export const StockMovementsView: React.FC = () => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [movementType, setMovementType] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadMovements();
  }, [movementType]);

  const loadMovements = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (movementType !== 'ALL') params.movementType = movementType;
      const res = await inventoryApi.getMovements(params);
      if (res.success) {
        setMovements(res.movements);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const blob = await reportApi.exportCsv('movements');
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `upvolt-movements-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredMovements = movements.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const prodName = typeof m.productId === 'object' ? (m.productId as any).name : '';
    const prodSku = typeof m.productId === 'object' ? (m.productId as any).sku : '';
    return (
      prodName.toLowerCase().includes(q) ||
      prodSku.toLowerCase().includes(q) ||
      m.referenceId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Inventory Movements Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-grade record of every physical stock deduction, receipt, return, adjustment, and
            reversal.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 shadow-subtle transition"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by product, SKU or reference..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <select
            value={movementType}
            onChange={(e) => setMovementType(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
          >
            <option value="ALL">All Movement Types</option>
            <option value="STOCK_RECEIVED">STOCK_RECEIVED</option>
            <option value="SALE">SALE</option>
            <option value="RETURN">RETURN</option>
            <option value="DAMAGE">DAMAGE</option>
            <option value="ADJUSTMENT">ADJUSTMENT</option>
            <option value="ORDER_CANCEL">ORDER_CANCEL</option>
            <option value="ORDER_EDIT_DELTA">ORDER_EDIT_DELTA</option>
            <option value="MANUAL_CORRECTION">MANUAL_CORRECTION</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Movement Type</th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4 text-center">Qty Change</th>
                <th className="py-3 px-4 text-center">Previous</th>
                <th className="py-3 px-4 text-center">New Stock</th>
                <th className="py-3 px-4 text-right">Unit Cost</th>
                <th className="py-3 px-4 text-right">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                    Loading movements ledger...
                  </td>
                </tr>
              ) : filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                    No stock movements recorded yet.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => {
                  const prod = typeof m.productId === 'object' ? (m.productId as any) : null;
                  return (
                    <tr key={m._id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-4 text-slate-500">
                        {new Date(m.createdAt).toLocaleDateString()}{' '}
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-2.5 px-4 font-sans">
                        <div className="font-semibold text-slate-900">{prod?.name || 'Unknown Item'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{prod?.sku}</div>
                      </td>

                      <td className="py-2.5 px-4 font-sans">
                        <Badge
                          variant={
                            m.quantity > 0
                              ? 'emerald'
                              : m.movementType === 'DAMAGE'
                              ? 'rose'
                              : m.movementType === 'ORDER_CANCEL'
                              ? 'amber'
                              : 'slate'
                          }
                        >
                          {m.movementType}
                        </Badge>
                      </td>

                      <td className="py-2.5 px-4 font-semibold text-slate-700">{m.referenceId}</td>

                      <td
                        className={`py-2.5 px-4 text-center font-bold ${
                          m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </td>

                      <td className="py-2.5 px-4 text-center text-slate-500">{m.previousStock}</td>

                      <td className="py-2.5 px-4 text-center font-bold text-slate-900">
                        {m.newStock}
                      </td>

                      <td className="py-2.5 px-4 text-right text-slate-600">
                        {m.costPrice ? `₹${m.costPrice}` : '—'}
                      </td>

                      <td className="py-2.5 px-4 text-right text-slate-500 font-sans">
                        {m.performedBy}
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
  );
};
