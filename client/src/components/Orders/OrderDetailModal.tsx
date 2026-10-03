import React, { useState, useEffect } from 'react';
import { Modal } from '../Common/Modal';
import { OrderStatusBadge, PaymentStatusBadge, Badge } from '../Common/Badge';
import { Order, OrderVersion, OrderReturn, OrderStatus, Product } from '../../types';
import { orderApi, productApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Common/Toast';
import {
  Layers,
  History,
  RotateCcw,
  Ban,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface OrderDetailModalProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: () => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  orderId,
  isOpen,
  onClose,
  onOrderUpdated,
}) => {
  const { isMasterAdmin } = useAuth();
  const { success, error } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [versions, setVersions] = useState<OrderVersion[]>([]);
  const [returns, setReturns] = useState<OrderReturn[]>([]);
  const [activeTab, setActiveTab] = useState<'items' | 'versions' | 'returns'>('items');
  const [isLoading, setIsLoading] = useState(false);

  // Status Change State
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus>('Confirmed');

  // Cancel State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Soft Delete State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  // Return State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnItems, setReturnItems] = useState<
    { productId: string; quantity: number; condition: 'GOOD' | 'DAMAGED' | 'DEFECTIVE' }[]
  >([]);
  const [returnReason, setReturnReason] = useState('');

  // Edit Order State
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editItems, setEditItems] = useState<
    { productId: string; quantity: number; sellingPrice: number; discount: number }[]
  >([]);
  const [editReason, setEditReason] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (orderId && isOpen) {
      loadOrderDetails();
      loadProducts();
    }
  }, [orderId, isOpen]);

  const loadProducts = async () => {
    try {
      const res = await productApi.getAll();
      if (res.success) setAllProducts(res.products);
    } catch (err) {
      console.error(err);
    }
  };

  const loadOrderDetails = async () => {
    if (!orderId) return;
    setIsLoading(true);
    try {
      const res = await orderApi.getById(orderId);
      if (res.success) {
        setOrder(res.order);
        setVersions(res.versions);
        setReturns(res.returns);
        setNewStatus(res.order.status);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load order details');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!order) return;
    try {
      const res = await orderApi.updateStatus(order._id, newStatus);
      if (res.success) {
        success(`Order status updated to ${newStatus}`, 'Status Updated');
        setIsChangingStatus(false);
        loadOrderDetails();
        onOrderUpdated();
      }
    } catch (err: any) {
      error(err.message || 'Invalid status transition', 'Status Transition Error');
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    try {
      const res = await orderApi.cancel(order._id, cancelReason);
      if (res.success) {
        success(
          `Order #${order.orderNumber} cancelled. ${res.unitsRestored} units restored into their original FIFO batches.`,
          'Order Cancelled'
        );
        setIsCancelModalOpen(false);
        loadOrderDetails();
        onOrderUpdated();
      }
    } catch (err: any) {
      error(err.message || 'Failed to cancel order', 'Cancellation Error');
    }
  };

  const handleSoftDelete = async () => {
    if (!order) return;
    try {
      const res = await orderApi.softDelete(order._id, deleteReason);
      if (res.success) {
        success(`Order #${order.orderNumber} moved to Trash.`, 'Moved to Trash');
        setIsDeleteModalOpen(false);
        onClose();
        onOrderUpdated();
      }
    } catch (err: any) {
      error(err.message || 'Failed to delete order', 'Delete Error');
    }
  };

  const handleStartReturn = () => {
    if (!order) return;
    setReturnItems(
      order.items.map((i) => ({
        productId: typeof i.productId === 'object' ? (i.productId as any)._id : i.productId,
        quantity: 1,
        condition: 'GOOD',
      }))
    );
    setReturnReason('');
    setIsReturnModalOpen(true);
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    if (!returnReason.trim()) {
      error('Return reason is required', 'Validation Error');
      return;
    }

    try {
      const idempotencyKey = `ret-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const res = await orderApi.returnOrder(order._id, {
        items: returnItems,
        reason: returnReason,
        idempotencyKey,
      });

      if (res.success) {
        success(
          `Return processed! Goods returned to inventory with original batch cost preserved.`,
          'Return Recorded'
        );
        setIsReturnModalOpen(false);
        loadOrderDetails();
        onOrderUpdated();
      }
    } catch (err: any) {
      error(err.message || 'Failed to process return', 'Return Error');
    }
  };

  const handleStartEdit = () => {
    if (!order) return;
    setEditItems(
      order.items.map((i) => ({
        productId: typeof i.productId === 'object' ? (i.productId as any)._id : i.productId,
        quantity: i.quantity,
        sellingPrice: i.sellingPrice,
        discount: i.discount,
      }))
    );
    setEditReason('');
    setIsEditingOrder(true);
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    if (!editReason.trim()) {
      error('An authoritative change reason is required for editing orders.', 'Reason Required');
      return;
    }

    try {
      const res = await orderApi.update(order._id, {
        items: editItems,
        changeReason: editReason,
      });

      if (res.success) {
        success(
          `Order #${order.orderNumber} successfully updated to Version ${res.version.version}. Inventory deltas and FIFO allocations recalculated!`,
          'Order Edit Recorded'
        );
        setIsEditingOrder(false);
        loadOrderDetails();
        onOrderUpdated();
      }
    } catch (err: any) {
      error(err.message || 'Failed to edit order', 'Order Edit Error');
    }
  };

  if (!order) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Order #${order.orderNumber}`}
      subtitle={`Placed on ${new Date(order.orderDate).toLocaleDateString()} | Version: ${order.currentVersion}`}
      maxWidth="5xl"
    >
      {/* Top Banner with Financials & Status */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl mb-6">
        <div>
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
            Order Status
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            <OrderStatusBadge status={order.status} />
            {order.status !== 'Cancelled' && order.status !== 'Returned' && (
              <button
                onClick={() => setIsChangingStatus(!isChangingStatus)}
                className="text-[10px] text-amber-600 hover:text-amber-700 underline font-medium"
              >
                Change
              </button>
            )}
          </div>
        </div>

        <div>
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
            Payment Status
          </span>
          <div className="mt-1">
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
        </div>

        <div>
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
            Revenue
          </span>
          <span className="text-base font-bold font-mono text-slate-900 mt-1 block">
            ₹{order.totalAmount.toLocaleString('en-IN')}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
            FIFO COGS
          </span>
          <span className="text-base font-bold font-mono text-slate-700 mt-1 block">
            ₹{(order.totalCost ?? 0).toLocaleString('en-IN')}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
            Gross Profit (Margin)
          </span>
          <span className="text-base font-bold font-mono text-emerald-600 mt-1 block">
            +₹{(order.totalProfit ?? 0).toLocaleString('en-IN')}{' '}
            <span className="text-xs text-slate-500 font-sans">({order.grossMargin ?? 0}%)</span>
          </span>
        </div>
      </div>

      {/* Status Change Selector Pop-in */}
      {isChangingStatus && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-6 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-900">Change Status to:</span>
            <select
              value={newStatus}
              onChange={(e: any) => setNewStatus(e.target.value)}
              className="px-2.5 py-1 bg-white border border-amber-300 rounded font-medium text-slate-800"
            >
              <option value="Draft">Draft</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Processing">Processing</option>
              <option value="Packed">Packed</option>
              <option value="Shipped">Shipped</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsChangingStatus(false)}
              className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-600 rounded border border-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleStatusChange}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded shadow-sm"
            >
              Update Transition
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('items')}
            className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'items'
                ? 'border-amber-500 text-amber-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Sold Items & FIFO Batch Allocations ({order.items.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('versions')}
            className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'versions'
                ? 'border-amber-500 text-amber-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Order Version History ({versions.length})</span>
          </button>

          {returns.length > 0 && (
            <button
              onClick={() => setActiveTab('returns')}
              className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold border-b-2 transition ${
                activeTab === 'returns'
                  ? 'border-amber-500 text-amber-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Processed Returns ({returns.length})</span>
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {order.status !== 'Cancelled' && order.status !== 'Returned' && (
            <button
              onClick={handleStartEdit}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit Order</span>
            </button>
          )}

          {order.status === 'Delivered' && (
            <button
              onClick={handleStartReturn}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
              <span>Process Return</span>
            </button>
          )}

          {order.status !== 'Cancelled' && order.status !== 'Returned' && (
            <button
              onClick={() => setIsCancelModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
            >
              <Ban className="w-3.5 h-3.5 text-rose-600" />
              <span>Cancel Order</span>
            </button>
          )}

          {isMasterAdmin && (
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-lg transition"
              title="Soft delete to Trash"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Trash</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Items & Batch Allocations */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-3">Product Name & SKU</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Selling Price</th>
                  <th className="py-2.5 px-3 text-right">Revenue</th>
                  <th className="py-2.5 px-3 text-right">FIFO COGS</th>
                  <th className="py-2.5 px-3 text-right">Profit</th>
                  <th className="py-2.5 px-3">FIFO Batch Allocations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {order.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-sans">
                      <div className="font-semibold text-slate-900">{item.productName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-slate-800">{item.quantity}</td>

                    <td className="py-3 px-3 text-right text-slate-700">₹{item.sellingPrice}</td>

                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      ₹{item.revenue.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-3 text-right text-slate-700">
                      ₹{item.cogs.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-3 text-right font-bold text-emerald-600">
                      +₹{item.profit.toLocaleString('en-IN')}
                    </td>

                    {/* Exact FIFO Batch Allocations Display */}
                    <td className="py-3 px-3 font-sans">
                      {item.batchAllocations && item.batchAllocations.length > 0 ? (
                        <div className="space-y-1">
                          {item.batchAllocations.map((ba, bIdx) => (
                            <div
                              key={bIdx}
                              className="text-[11px] font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-700 flex items-center justify-between"
                            >
                              <span className="font-semibold text-slate-900">{ba.batchNumber}</span>
                              <span>
                                {ba.quantity} × ₹{ba.costPrice}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">
                          {order.status === 'Draft' ? 'Reserved (Draft)' : 'None'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Version History Diffs */}
      {activeTab === 'versions' && (
        <div className="space-y-3">
          {versions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No previous versions</div>
          ) : (
            versions.map((ver) => (
              <div
                key={ver._id}
                className="p-4 bg-white rounded-xl border border-slate-200 shadow-subtle space-y-2 text-xs"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      Version {ver.version}
                    </span>
                    <span className="text-slate-500 font-medium">by {ver.changedBy}</span>
                  </div>
                  <div className="text-slate-400 font-mono">
                    {new Date(ver.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="text-slate-700">
                  <strong className="text-slate-900 font-semibold">Change Reason:</strong>{' '}
                  <span className="italic">{ver.changeReason}</span>
                </div>

                {/* Diff table */}
                {ver.diff && ver.diff.length > 0 && (
                  <div className="mt-2 bg-slate-50 rounded-lg p-2 font-mono text-[11px]">
                    <div className="text-slate-500 uppercase text-[10px] tracking-wider mb-1 font-sans font-semibold">
                      Fields Modified
                    </div>
                    {ver.diff.map((d, dIdx) => (
                      <div key={dIdx} className="flex items-center gap-2 py-0.5">
                        <span className="font-semibold text-slate-700">{d.field}:</span>
                        <span className="text-rose-600 line-through">
                          {JSON.stringify(d.oldValue)}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="text-emerald-600 font-bold">
                          {JSON.stringify(d.newValue)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Processed Returns */}
      {activeTab === 'returns' && (
        <div className="space-y-3">
          {returns.map((ret) => (
            <div
              key={ret._id}
              className="p-4 bg-white rounded-xl border border-slate-200 shadow-subtle space-y-2 text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-900">Return Date: {new Date(ret.returnDate).toLocaleDateString()}</span>
                <span className="text-slate-500 font-mono">Processed by: {ret.processedBy}</span>
              </div>
              <div>
                <strong className="text-slate-900 font-semibold">Reason:</strong> {ret.returnReason}
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden mt-2">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 px-3">Product</th>
                      <th className="py-2 px-3 text-center">Returned Qty</th>
                      <th className="py-2 px-3 text-center">Condition</th>
                      <th className="py-2 px-3 text-right">Batch Unit Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {ret.items.map((ri, rIdx) => (
                      <tr key={rIdx}>
                        <td className="py-2 px-3 font-sans font-semibold text-slate-800">
                          {ri.productName}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-slate-900">
                          {ri.quantity}
                        </td>
                        <td className="py-2 px-3 text-center font-sans">
                          <Badge variant={ri.condition === 'GOOD' ? 'emerald' : 'rose'}>
                            {ri.condition}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right text-slate-700">₹{ri.costPrice}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancel Order Confirmation Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Commercial Order"
        subtitle={`This will restore ${order.items.reduce((acc, i) => acc + i.quantity, 0)} units directly back into their original FIFO batches.`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              Cancellation is an inventory transaction. Stock will be restored to original batches
              and a reversal StockMovement will be logged.
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Cancellation Reason</label>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Customer requested cancellation before dispatch"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setIsCancelModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Go Back
            </button>
            <button
              onClick={handleCancelOrder}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
            >
              Confirm Cancellation
            </button>
          </div>
        </div>
      </Modal>

      {/* Return Order Modal */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title="Process Order Return"
        subtitle="Returned goods preserve their original FIFO purchase batch cost."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitReturn} className="space-y-4">
          <div className="space-y-3">
            {returnItems.map((item, idx) => {
              const orderItem = order.items.find(
                (i) =>
                  (typeof i.productId === 'object' ? (i.productId as any)._id : i.productId) ===
                  item.productId
              );
              return (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{orderItem?.productName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Sold: {orderItem?.quantity} units
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Return Qty
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={orderItem?.quantity || 1}
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...returnItems];
                          updated[idx].quantity = Math.min(
                            orderItem?.quantity || 1,
                            Math.max(1, parseInt(e.target.value) || 0)
                          );
                          setReturnItems(updated);
                        }}
                        className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Condition
                      </label>
                      <select
                        value={item.condition}
                        onChange={(e: any) => {
                          const updated = [...returnItems];
                          updated[idx].condition = e.target.value;
                          setReturnItems(updated);
                        }}
                        className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium"
                      >
                        <option value="GOOD">GOOD (Restock Sellable)</option>
                        <option value="DAMAGED">DAMAGED (Quarantine)</option>
                        <option value="DEFECTIVE">DEFECTIVE (Quarantine)</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Authoritative Return Reason <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="e.g. Student lab course cancelled, surplus returned unused"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsReturnModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm"
            >
              Process Return & Restock
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Order Modal (Delta and Version History) */}
      <Modal
        isOpen={isEditingOrder}
        onClose={() => setIsEditingOrder(false)}
        title={`Edit Order #${order.orderNumber}`}
        subtitle="Modifying quantities adjusts only the inventory delta and creates an immutable snapshot version."
        maxWidth="3xl"
      >
        <form onSubmit={handleSubmitEdit} className="space-y-4">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3 text-center w-28">Quantity</th>
                  <th className="py-2.5 px-3 text-right w-32">Selling Price (₹)</th>
                  <th className="py-2.5 px-3 text-right w-28">Discount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {editItems.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-3 font-sans">
                      <select
                        value={item.productId}
                        onChange={(e) => {
                          const updated = [...editItems];
                          updated[idx].productId = e.target.value;
                          setEditItems(updated);
                        }}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                      >
                        {allProducts.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...editItems];
                          updated[idx].quantity = Math.max(1, parseInt(e.target.value) || 0);
                          setEditItems(updated);
                        }}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono font-bold text-center"
                        required
                      />
                    </td>

                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={item.sellingPrice}
                        onChange={(e) => {
                          const updated = [...editItems];
                          updated[idx].sellingPrice = parseFloat(e.target.value) || 0;
                          setEditItems(updated);
                        }}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono text-right"
                        required
                      />
                    </td>

                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        min={0}
                        value={item.discount}
                        onChange={(e) => {
                          const updated = [...editItems];
                          updated[idx].discount = parseFloat(e.target.value) || 0;
                          setEditItems(updated);
                        }}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono text-right"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Authoritative Change Reason <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="e.g. Customer increased ESP32 quantity from 5 to 8 units"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditingOrder(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm"
            >
              Save Version & Adjust Stock
            </button>
          </div>
        </form>
      </Modal>

      {/* Soft Delete Confirmation Modal (Master Admin Only) */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Soft Delete Order (Move to Trash)"
        subtitle="Only Master Admin can soft delete orders. Trashed orders can be restored or permanently purged later."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              Staff cannot delete orders. Trashed orders remain in the Trash bin with full audit
              history preserved.
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Deletion Reason</label>
            <input
              type="text"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="e.g. Duplicate order entered by staff"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSoftDelete}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
            >
              Move to Trash
            </button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
};
