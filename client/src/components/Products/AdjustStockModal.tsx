import React, { useState } from 'react';
import { Modal } from '../Common/Modal';
import { Product } from '../../types';
import { inventoryApi } from '../../api/client';
import { useToast } from '../Common/Toast';
import { AlertCircle } from 'lucide-react';

interface AdjustStockModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdjustStockModal: React.FC<AdjustStockModalProps> = ({
  product,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { success, error } = useToast();
  const [direction, setDirection] = useState<'ADD' | 'REMOVE'>('REMOVE');
  const [quantity, setQuantity] = useState<number>(1);
  const [movementType, setMovementType] = useState<'ADJUSTMENT' | 'DAMAGE' | 'MANUAL_CORRECTION'>(
    'ADJUSTMENT'
  );
  const [condition, setCondition] = useState<'GOOD' | 'DAMAGED'>('GOOD');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) {
      error('Quantity must be greater than 0', 'Invalid Quantity');
      return;
    }
    if (!reason.trim()) {
      error('An authoritative reason is required for any manual stock adjustment.', 'Reason Required');
      return;
    }

    const netQuantity = direction === 'ADD' ? quantity : -quantity;

    if (direction === 'REMOVE' && quantity > product.currentStock) {
      error(
        `Cannot remove ${quantity} units. Current physical stock is only ${product.currentStock}.`,
        'Insufficient Stock'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = `adj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const res = await inventoryApi.adjustStock({
        productId: product._id,
        quantity: netQuantity,
        movementType,
        condition,
        reason,
        notes,
        idempotencyKey,
      });

      if (res.success) {
        success(
          `Stock successfully adjusted by ${netQuantity > 0 ? `+${netQuantity}` : netQuantity} units for ${product.name}.`,
          'Stock Adjustment Recorded'
        );
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      error(err.message || 'Failed to adjust stock', 'Adjustment Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manual Stock Adjustment"
      subtitle={`Product: ${product.name} (SKU: ${product.sku})`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            Every manual adjustment generates an immutable Stock Movement and Audit Record. Current
            stock is <strong className="font-mono">{product.currentStock} units</strong>.
          </div>
        </div>

        {/* Direction selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Adjustment Direction</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection('REMOVE')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                direction === 'REMOVE'
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Decrease Stock (-)
            </button>
            <button
              type="button"
              onClick={() => setDirection('ADD')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                direction === 'ADD'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Increase Stock (+)
            </button>
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            required
          />
        </div>

        {/* Movement Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Type of Adjustment</label>
          <select
            value={movementType}
            onChange={(e: any) => setMovementType(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="ADJUSTMENT">Standard Stock Adjustment</option>
            <option value="DAMAGE">Damaged in Lab / Testing</option>
            <option value="MANUAL_CORRECTION">Manual Inventory Count Correction</option>
          </select>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Authoritative Reason <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Broken header pins during bench testing"
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            required
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional additional audit context"
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? 'Recording Adjustment...' : 'Apply Stock Adjustment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
