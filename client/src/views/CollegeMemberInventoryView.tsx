import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { CollegeInventory, CollegeDispatch } from '../types';
import { collegeApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Common/Toast';

export const CollegeMemberInventoryView: React.FC = () => {
  const { user } = useAuth();
  const { error } = useToast();

  const collegeName = user?.college || 'My College';

  const [inventory, setInventory] = useState<CollegeInventory[]>([]);
  const [dispatches, setDispatches] = useState<CollegeDispatch[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'stock' | 'received'>('stock');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCollegeData();
  }, [collegeName]);

  const loadCollegeData = async () => {
    setIsLoading(true);
    try {
      const [invRes, dispRes] = await Promise.all([
        collegeApi.getInventory(collegeName),
        collegeApi.getDispatches({ college: collegeName }),
      ]);

      if (invRes.success) {
        setInventory(invRes.items);
      }
      if (dispRes.success) {
        setDispatches(dispRes.dispatches);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load college inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredInventory = inventory.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.productName.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
  });

  const totalStockUnits = inventory.reduce((sum, i) => sum + i.currentStock, 0);

  return (
    <div className="space-y-6">
      {/* College Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {collegeName} — Campus Inventory
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Hardware components and sensor kits available at your college lab / makerspace.
          </p>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <span className="text-[10px] uppercase font-bold text-blue-600 block">Total Products</span>
            <span className="text-lg font-bold font-mono text-blue-900">{inventory.length}</span>
          </div>
          <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-600 block">Available Units</span>
            <span className="text-lg font-bold font-mono text-emerald-900">{totalStockUnits}</span>
          </div>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 w-fit">
          <button
            type="button"
            onClick={() => setActiveSubTab('stock')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeSubTab === 'stock'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Available Stock ({inventory.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('received')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeSubTab === 'received'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Received Dispatches ({dispatches.length})
          </button>
        </div>

        {activeSubTab === 'stock' && (
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search components, sensors..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        )}
      </div>

      {/* Available Stock Tab */}
      {activeSubTab === 'stock' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 text-[10px] uppercase">
                  <th className="py-3 px-4">Component Name</th>
                  <th className="py-3 px-4">SKU / Code</th>
                  <th className="py-3 px-4 text-center">Available Units</th>
                  <th className="py-3 px-4">Last Received Date</th>
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
      )}

      {/* Received Dispatches Tab */}
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
    </div>
  );
};
