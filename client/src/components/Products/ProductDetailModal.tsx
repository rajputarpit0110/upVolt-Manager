import React, { useState, useEffect } from 'react';
import { Modal } from '../Common/Modal';
import { Badge } from '../Common/Badge';
import { productApi } from '../../api/client';
import { Product, InventoryBatch, ProductPriceHistory } from '../../types';
import { Layers, History, DollarSign, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenAdjustStock: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  onOpenAdjustStock,
}) => {
  const [activeTab, setActiveTab] = useState<'batches' | 'ledger' | 'prices'>('batches');
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [priceHistory, setPriceHistory] = useState<ProductPriceHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (product && isOpen) {
      loadDetails();
    }
  }, [product, isOpen]);

  const loadDetails = async () => {
    if (!product) return;
    setIsLoading(true);
    try {
      const [bRes, lRes, pRes] = await Promise.all([
        productApi.getBatches(product._id),
        productApi.getLedger(product._id),
        productApi.getPriceHistory(product._id),
      ]);
      if (bRes.success) setBatches(bRes.batches);
      if (lRes.success) setLedger(lRes.ledger);
      if (pRes.success) setPriceHistory(pRes.history);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!product) return null;

  const availableStock = product.currentStock - product.reservedStock;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product.name}
      subtitle={`SKU: ${product.sku} | Category: ${product.category}`}
      maxWidth="4xl"
    >
      {/* Stock Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl mb-6">
        <div className="p-2">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Physical Stock
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
            {product.currentStock} {product.unit}
          </div>
        </div>

        <div className="p-2">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Reserved (Drafts)
          </div>
          <div className="text-xl font-bold font-mono text-amber-600 mt-0.5">
            {product.reservedStock} {product.unit}
          </div>
        </div>

        <div className="p-2">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Available to Sell
          </div>
          <div
            className={`text-xl font-bold font-mono mt-0.5 ${
              availableStock > 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {availableStock} {product.unit}
          </div>
        </div>

        <div className="p-2">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Damaged / Quarantine
          </div>
          <div className="text-xl font-bold font-mono text-rose-600 mt-0.5">
            {product.damagedStock} {product.unit}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('batches')}
            className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'batches'
                ? 'border-amber-500 text-amber-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Active FIFO Batches ({batches.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'ledger'
                ? 'border-amber-500 text-amber-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Inventory Movement Ledger ({ledger.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('prices')}
            className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'prices'
                ? 'border-amber-500 text-amber-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Price Audit History ({priceHistory.length})</span>
          </button>
        </div>

        <button
          onClick={() => {
            onClose();
            onOpenAdjustStock(product);
          }}
          className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded-lg transition"
        >
          Adjust Stock
        </button>
      </div>

      {/* Tab 1: FIFO Batches */}
      {activeTab === 'batches' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                <th className="py-2.5 px-3">Batch Number</th>
                <th className="py-2.5 px-3">Received Date</th>
                <th className="py-2.5 px-3">Unit Cost</th>
                <th className="py-2.5 px-3">Initial Qty</th>
                <th className="py-2.5 px-3">Remaining Qty</th>
                <th className="py-2.5 px-3">Batch Value</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400 font-sans">
                    No active inventory batches found. Receive stock to create batches.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr
                    key={batch._id}
                    className={batch.status === 'EXHAUSTED' ? 'opacity-50 bg-slate-50/50' : ''}
                  >
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{batch.batchNumber}</td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {new Date(batch.receivedDate).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">₹{batch.costPrice}</td>
                    <td className="py-2.5 px-3 text-slate-600">{batch.initialQuantity}</td>
                    <td className="py-2.5 px-3 font-bold text-amber-700">{batch.remainingQuantity}</td>
                    <td className="py-2.5 px-3 text-slate-900">
                      ₹{Math.round(batch.remainingQuantity * batch.costPrice).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <Badge variant={batch.status === 'ACTIVE' ? 'emerald' : 'slate'}>
                        {batch.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Inventory Movement Ledger */}
      {activeTab === 'ledger' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Movement Type</th>
                <th className="py-2 px-3">Reference</th>
                <th className="py-2 px-3">Qty Change</th>
                <th className="py-2 px-3">Stock Balance</th>
                <th className="py-2 px-3">Unit Cost</th>
                <th className="py-2 px-3">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400 font-sans">
                    No movement records recorded yet
                  </td>
                </tr>
              ) : (
                ledger.map((m) => (
                  <tr key={m._id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-500">
                      {new Date(m.createdAt).toLocaleDateString()}{' '}
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2 px-3 font-sans">
                      <Badge
                        variant={
                          m.quantity > 0
                            ? 'emerald'
                            : m.movementType === 'DAMAGE'
                            ? 'rose'
                            : 'slate'
                        }
                      >
                        {m.movementType}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-700">{m.referenceId}</td>
                    <td
                      className={`py-2 px-3 font-bold ${
                        m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900">{m.newStock}</td>
                    <td className="py-2 px-3 text-slate-600">
                      {m.costPrice ? `₹${m.costPrice}` : '—'}
                    </td>
                    <td className="py-2 px-3 font-sans text-slate-500">{m.performedBy}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Price History */}
      {activeTab === 'prices' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Price Type</th>
                <th className="py-2.5 px-3">Old Price</th>
                <th className="py-2.5 px-3">New Price</th>
                <th className="py-2.5 px-3">Changed By</th>
                <th className="py-2.5 px-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {priceHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No price changes have been made to this product
                  </td>
                </tr>
              ) : (
                priceHistory.map((p) => (
                  <tr key={p._id}>
                    <td className="py-2.5 px-3 text-slate-500 font-mono">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">
                      {p.priceType.replace('_', ' ')}
                    </td>
                    <td className="py-2.5 px-3 font-mono line-through text-slate-400">₹{p.oldPrice}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-600">₹{p.newPrice}</td>
                    <td className="py-2.5 px-3 text-slate-600">{p.changedBy}</td>
                    <td className="py-2.5 px-3 text-slate-500 italic">{p.reason || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
};
