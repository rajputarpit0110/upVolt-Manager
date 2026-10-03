import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, AlertOctagon, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Order } from '../types';
import { orderApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Common/Toast';
import { Modal } from '../components/Common/Modal';

export const TrashView: React.FC = () => {
  const { isMasterAdmin } = useAuth();
  const { success, error } = useToast();
  const [trashedOrders, setTrashedOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Permanent Delete Modal
  const [orderToPurge, setOrderToPurge] = useState<Order | null>(null);
  const [purgeReason, setPurgeReason] = useState('');
  const [isPurging, setIsPurging] = useState(false);

  useEffect(() => {
    loadTrash();
  }, []);

  const loadTrash = async () => {
    setIsLoading(true);
    try {
      const res = await orderApi.getTrash();
      if (res.success) {
        setTrashedOrders(res.orders);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load trash');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (order: Order) => {
    try {
      const res = await orderApi.restore(order._id);
      if (res.success) {
        success(
          `Order #${order.orderNumber} successfully restored from Trash! Current stock inspected and verified safely.`,
          'Order Restored'
        );
        loadTrash();
      }
    } catch (err: any) {
      error(err.message || 'Failed to restore order', 'Restoration Error');
    }
  };

  const handlePermanentDelete = async () => {
    if (!orderToPurge) return;
    if (!purgeReason.trim()) {
      error('An authoritative reason is required for permanent purging.', 'Reason Required');
      return;
    }

    setIsPurging(true);
    try {
      const res = await orderApi.permanentDelete(orderToPurge._id, purgeReason);
      if (res.success) {
        success(
          `Order #${orderToPurge.orderNumber} permanently purged from database. Immutable audit metadata retained.`,
          'Permanent Deletion Executed'
        );
        setOrderToPurge(null);
        setPurgeReason('');
        loadTrash();
      }
    } catch (err: any) {
      error(err.message || 'Failed to permanently delete order', 'Purge Error');
    } finally {
      setIsPurging(false);
    }
  };

  if (!isMasterAdmin) {
    return (
      <div className="p-8 bg-white rounded-xl border border-slate-200 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Access Restricted (HTTP 403)</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Staff members are strictly prohibited from viewing or managing the Trash bin. Only
          Master Admin has soft delete, restoration, and permanent purge privileges.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Trash (Soft-Deleted Orders)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Master Admin control panel for soft-deleted commercial orders. Inspect inventory before
            restoring.
          </p>
        </div>

        <div className="text-xs font-mono px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-semibold">
          {trashedOrders.length} Trashed Record(s)
        </div>
      </div>

      {/* Trashed Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Deleted At</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-right">Order Value</th>
                <th className="py-3 px-4">Deleted By</th>
                <th className="py-3 px-4">Deletion Reason</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading trash records...
                  </td>
                </tr>
              ) : trashedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Trash is completely clean. No deleted orders.
                  </td>
                </tr>
              ) : (
                trashedOrders.map((order) => (
                  <tr key={order._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {order.orderNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono">
                      {order.deletedAt ? new Date(order.deletedAt).toLocaleString() : '—'}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {order.customer?.name || 'Walk-in'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      ₹{order.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                      {order.deletedBy}
                    </td>
                    <td className="py-3 px-4 text-slate-500 italic max-w-xs truncate">
                      {order.deleteReason || 'No reason specified'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRestore(order)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold transition"
                          title="Restore order"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>

                        <button
                          onClick={() => setOrderToPurge(order)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold transition"
                          title="Permanently purge"
                        >
                          <AlertOctagon className="w-3.5 h-3.5" />
                          <span>Purge</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permanent Delete Modal */}
      {orderToPurge && (
        <Modal
          isOpen={!!orderToPurge}
          onClose={() => setOrderToPurge(null)}
          title="Permanently Purge Order Record"
          subtitle="WARNING: This action is irreversible. Audit log metadata will be permanently recorded."
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-rose-600" />
                <span>Irreversible Master Admin Action</span>
              </div>
              <div>Order ID: <strong className="font-mono">{orderToPurge.orderNumber}</strong></div>
              <div>Customer: <strong>{orderToPurge.customer?.name}</strong></div>
              <div>Total Amount: <strong className="font-mono">₹{orderToPurge.totalAmount}</strong></div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Permanent Purge Reason <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={purgeReason}
                onChange={(e) => setPurgeReason(e.target.value)}
                placeholder="e.g. Test order created during staging QA"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setOrderToPurge(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handlePermanentDelete}
                disabled={isPurging}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm disabled:opacity-50"
              >
                {isPurging ? 'Purging Record...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
