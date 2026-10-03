import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Truck,
  Trash2,
  Calendar,
  Layers,
  ArrowDownLeft,
} from 'lucide-react';
import { Purchase, Product, Supplier } from '../types';
import { purchaseApi, productApi, supplierApi } from '../api/client';
import { Modal } from '../components/Common/Modal';
import { Badge, PaymentStatusBadge } from '../components/Common/Badge';
import { useToast } from '../components/Common/Toast';
import { AddProductModal } from '../components/Products/AddProductModal';

interface PurchasesViewProps {
  isReceiveModalOpenFromParent?: boolean;
  onCloseReceiveModal?: () => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  isReceiveModalOpenFromParent = false,
  onCloseReceiveModal,
}) => {
  const { success, error, warning } = useToast();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Receive Stock Modal
  const [isModalOpen, setIsModalOpen] = useState(isReceiveModalOpenFromParent);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Partial' | 'Pending'>('Paid');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<
    { productId: string; quantity: number; costPrice: number }[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected Purchase for detail view
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  useEffect(() => {
    if (isReceiveModalOpenFromParent) {
      setIsModalOpen(true);
    }
  }, [isReceiveModalOpenFromParent]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [purRes, prodRes, supRes] = await Promise.all([
        purchaseApi.getAll(),
        productApi.getAll(),
        supplierApi.getAll(),
      ]);
      if (purRes.success) setPurchases(purRes.purchases);
      if (prodRes.success) setProducts(prodRes.products);
      if (supRes.success) setSuppliers(supRes.suppliers);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = () => {
    setItems(
      products.length > 0
        ? [
            {
              productId: products[0]._id,
              quantity: 1,
              costPrice: products[0].averageCost || products[0].sellingPrice || 0,
            },
          ]
        : []
    );
    setSelectedSupplierId(suppliers[0]?._id || '');
    setSupplierName(suppliers[0]?.name || '');
    setSupplierPhone(suppliers[0]?.phone || '');
    setInvoiceNumber('');
    setIsModalOpen(true);
  };

  const handleSupplierChange = (supId: string) => {
    setSelectedSupplierId(supId);
    const sup = suppliers.find((s) => s._id === supId);
    if (sup) {
      setSupplierName(sup.name);
      setSupplierPhone(sup.phone || '');
    }
  };

  const addItemRow = () => {
    if (products.length === 0) {
      warning('No hardware products exist in your catalog yet. Please add a product first.', 'Product Required');
      setIsAddProductModalOpen(true);
      return;
    }
    setItems([
      ...items,
      {
        productId: products[0]._id,
        quantity: 1,
        costPrice: products[0].averageCost || products[0].sellingPrice || 0,
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItemRow = (index: number, field: string, val: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = val;
    if (field === 'productId') {
      const prod = products.find((p) => p._id === val);
      if (prod && prod.averageCost > 0) {
        updated[index].costPrice = prod.averageCost;
      }
    }
    setItems(updated);
  };

  const handleReceiveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      error('Please add at least one line item', 'Line Items Required');
      return;
    }

    for (const item of items) {
      if (item.quantity <= 0) {
        error('Quantity must be greater than 0 for all items', 'Invalid Quantity');
        return;
      }
      if (item.costPrice <= 0) {
        error('Unit cost price must be greater than 0', 'Invalid Cost Price');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = `pur-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const res = await purchaseApi.create({
        supplier: {
          supplierId: selectedSupplierId || undefined,
          name: supplierName || 'Direct Vendor',
          phone: supplierPhone,
        },
        items,
        paymentStatus,
        invoiceNumber,
        notes,
        idempotencyKey,
      });

      if (res.success) {
        success(
          `Stock successfully received! Created ${res.batches.length} new immutable FIFO batches for PO #${res.purchase.purchaseOrderNumber}.`,
          'Inventory Received'
        );
        setIsModalOpen(false);
        onCloseReceiveModal?.();
        loadData();
      }
    } catch (err: any) {
      error(err.message || 'Failed to receive stock', 'Receive Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPoAmount = items.reduce((acc, i) => acc + i.quantity * i.costPrice, 0);

  const filteredPurchases = purchases.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (p.purchaseOrderNumber || p.purchaseNumber || '').toLowerCase().includes(q) ||
      p.supplier?.name?.toLowerCase().includes(q) ||
      p.invoiceNumber?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header and Receive Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Purchases & Incoming Shipments</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Every incoming purchase creates an immutable FIFO Inventory Batch with fixed unit cost.
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Receive New Stock</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO #, supplier, or invoice..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>
      </div>

      {/* Purchases Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Items Received</th>
                <th className="py-3 px-4 text-center">Total Quantity</th>
                <th className="py-3 px-4 text-right">Total Cost</th>
                <th className="py-3 px-4 text-center">Payment</th>
                <th className="py-3 px-4 text-right">Receiver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading purchases history...
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No purchase orders recorded yet. Receive incoming stock above.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((p) => (
                  <tr
                    key={p._id}
                    onClick={() => setSelectedPurchase(p)}
                    className="hover:bg-slate-50/80 cursor-pointer transition"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {p.purchaseOrderNumber}
                      {p.invoiceNumber && (
                        <span className="block text-[10px] text-slate-400 font-normal">
                          Inv: {p.invoiceNumber}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono">
                      {new Date(p.purchaseDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{p.supplier?.name}</div>
                      {p.supplier?.phone && (
                        <div className="text-[10px] text-slate-400">{p.supplier.phone}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {p.items?.map((i) => i.productName).join(', ') || 'Hardware items'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                      {p.totalQuantity} units
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      ₹{p.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <PaymentStatusBadge status={p.paymentStatus || 'Paid'} />
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 font-mono">
                      {p.receivedBy}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receive Stock Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          onCloseReceiveModal?.();
        }}
        title="Receive Hardware Stock & Create FIFO Batches"
        subtitle="Each line item creates an independent inventory batch with immutable cost price."
        maxWidth="4xl"
      >
        <form onSubmit={handleReceiveStock} className="space-y-4">
          {/* Supplier Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Supplier</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => handleSupplierChange(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="">Custom / Direct Vendor</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Name</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Vendor name"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Invoice #</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. TAX-9842"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-900 tracking-wider uppercase">
                Stock Items to Receive
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(true)}
                  className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                  <span>Create Product</span>
                </button>
                <button
                  type="button"
                  onClick={addItemRow}
                  className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item Row</span>
                </button>
              </div>
            </div>

            {products.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto font-bold">
                  <Layers className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Your Catalog is Currently Empty</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Before you can receive inventory batches, you need to create at least one hardware product in your catalog.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(true)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product to Catalog</span>
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-2">
                <p className="text-xs text-slate-500">No stock items added to this receipt yet.</p>
                <button
                  type="button"
                  onClick={addItemRow}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>Add Stock Item Row</span>
                </button>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3 w-32">Quantity</th>
                      <th className="py-2.5 px-3 w-36">Unit Cost Price (₹)</th>
                      <th className="py-2.5 px-3 w-36 text-right">Subtotal</th>
                      <th className="py-2.5 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {items.map((item, idx) => {
                      const rowSubtotal = item.quantity * item.costPrice;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-sans">
                            <select
                              value={item.productId}
                              onChange={(e) => updateItemRow(idx, 'productId', e.target.value)}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                            >
                              {products.map((p) => (
                                <option key={p._id} value={p._id}>
                                  {p.name} ({p.sku}) — Stock: {p.currentStock}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) =>
                                updateItemRow(idx, 'quantity', parseInt(e.target.value) || 0)
                              }
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                              required
                            />
                          </td>

                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={0.5}
                              step={0.5}
                              value={item.costPrice}
                              onChange={(e) =>
                                updateItemRow(idx, 'costPrice', parseFloat(e.target.value) || 0)
                              }
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                              required
                            />
                          </td>

                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            ₹{rowSubtotal.toLocaleString('en-IN')}
                          </td>

                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer Totals & Submit */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-500">Total Purchase Value:</span>
              <div className="text-xl font-bold font-mono text-slate-900">
                ₹{totalPoAmount.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  onCloseReceiveModal?.();
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                <ArrowDownLeft className="w-4 h-4 text-amber-400" />
                <span>{isSubmitting ? 'Receiving & Creating Batches...' : 'Confirm Stock Receipt'}</span>
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Purchase Detail Modal */}
      {selectedPurchase && (
        <Modal
          isOpen={!!selectedPurchase}
          onClose={() => setSelectedPurchase(null)}
          title={`Purchase Order: ${selectedPurchase.purchaseOrderNumber}`}
          subtitle={`Supplier: ${selectedPurchase.supplier?.name} | Invoice: ${selectedPurchase.invoiceNumber || 'N/A'}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg text-xs">
              <div>
                <span className="text-slate-400 block">Date</span>
                <span className="font-mono font-semibold text-slate-800">
                  {new Date(selectedPurchase.purchaseDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Total Quantity</span>
                <span className="font-mono font-semibold text-slate-800">
                  {selectedPurchase.totalQuantity} units
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Total Cost</span>
                <span className="font-mono font-bold text-slate-900">
                  ₹{selectedPurchase.totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Receiver</span>
                <span className="font-mono font-semibold text-slate-800">
                  {selectedPurchase.receivedBy}
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3 text-center">Quantity</th>
                    <th className="py-2.5 px-3 text-right">Unit Cost</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {selectedPurchase.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">
                        {item.productName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{item.sku}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">₹{item.costPrice}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        ₹{(item.quantity * item.costPrice).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Product Modal for quick catalog addition */}
      <AddProductModal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        onSuccess={async () => {
          setIsAddProductModalOpen(false);
          try {
            const res = await productApi.getAll();
            if (res.success && res.products) {
              setProducts(res.products);
              if (res.products.length > 0) {
                const newest = res.products[res.products.length - 1];
                setItems((prev) => [
                  ...prev,
                  {
                    productId: newest._id,
                    quantity: 1,
                    costPrice: newest.averageCost || newest.sellingPrice || 10,
                  },
                ]);
              }
            }
          } catch (e) {
            console.error(e);
          }
        }}
      />
    </div>
  );
};

