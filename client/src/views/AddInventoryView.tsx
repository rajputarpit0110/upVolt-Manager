import React, { useState, useEffect } from 'react';
import {
  PackagePlus,
  Plus,
  Trash2,
  FileText,
  Upload,
  Coins,
  Receipt,
  Calendar,
  Eye,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
} from 'lucide-react';
import { Product, Purchase } from '../types';
import { productApi, purchaseApi, categoryApi } from '../api/client';
import { Modal } from '../components/Common/Modal';
import { useToast } from '../components/Common/Toast';
import { useAuth } from '../context/AuthContext';
import { SearchableProductSelect } from '../components/Common/SearchableProductSelect';

const DEFAULT_CATEGORIES = [
  'Development Boards',
  'Sensors',
  'Motors & Actuators',
  'Power & Batteries',
  'Displays',
  'Wireless & IoT',
  'Cables & Connectors',
  'Tools & Equipment',
  'General',
];

interface InventoryItemRow {
  productId: string;
  quantity: number;
  costPrice: number;
}

export const AddInventoryView: React.FC = () => {
  const { user, isMasterAdmin } = useAuth();
  const { success, error } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [billFile, setBillFile] = useState<string | null>(null);
  const [billFileName, setBillFileName] = useState('');

  const [items, setItems] = useState<InventoryItemRow[]>([
    { productId: '', quantity: 1, costPrice: 0 },
  ]);

  // Inline Custom Product State
  const [customRowIndex, setCustomRowIndex] = useState<number | null>(null);
  const [customProdName, setCustomProdName] = useState('');
  const [customProdCategory, setCustomProdCategory] = useState('Development Boards');
  const [customProdSellingPrice, setCustomProdSellingPrice] = useState<number | ''>('');
  const [isCreatingInlineProd, setIsCreatingInlineProd] = useState(false);

  // Modal State: Inline "+ Add New Product"
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Development Boards');
  const [newProdCostPrice, setNewProdCostPrice] = useState<number | ''>('');
  const [newProdSellingPrice, setNewProdSellingPrice] = useState<number | ''>('');
  const [newProdInitialQty, setNewProdInitialQty] = useState<number | ''>(1);
  const [newProdBillFile, setNewProdBillFile] = useState<string | null>(null);
  const [newProdBillFileName, setNewProdBillFileName] = useState('');
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  // Modal State: View Bill / Invoice & Delete Purchase
  const [viewingBillUrl, setViewingBillUrl] = useState<string | null>(null);
  const [inspectingPurchase, setInspectingPurchase] = useState<Purchase | null>(null);
  const [purchaseToDelete, setPurchaseToDelete] = useState<Purchase | null>(null);
  const [deletePurchaseConfirmText, setDeletePurchaseConfirmText] = useState('');
  const [isDeletingPurchase, setIsDeletingPurchase] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, purRes, catRes] = await Promise.all([
        productApi.getAll(),
        purchaseApi.getAll({ limit: 20 }),
        categoryApi.getAll().catch(() => ({ success: false, categories: [] })),
      ]);
      if (prodRes.success) {
        setProducts(prodRes.products);
      }
      if (purRes.success) {
        setPurchases(purRes.purchases);
      }
      if (catRes && catRes.success && catRes.categories?.length > 0) {
        const catNames = catRes.categories
          .filter((c: any) => c.status !== 'Inactive')
          .map((c: any) => c.name);
        setCategories(Array.from(new Set([...catNames, ...DEFAULT_CATEGORIES])));
      }
    } catch (err: any) {
      error(err.message || 'Failed to load inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePurchase = async () => {
    if (!purchaseToDelete) return;
    if (deletePurchaseConfirmText.trim().toUpperCase() !== 'DELETE') {
      error('Please type DELETE to confirm deletion');
      return;
    }

    setIsDeletingPurchase(true);
    try {
      const res = await purchaseApi.delete(purchaseToDelete._id);
      if (res.success) {
        success(res.message || 'Purchase log deleted and inventory stock reversed');
        setPurchaseToDelete(null);
        setDeletePurchaseConfirmText('');
        await loadData();
      }
    } catch (err: any) {
      error(err.message || 'Failed to delete purchase record');
    } finally {
      setIsDeletingPurchase(false);
    }
  };

  // Row Manipulation
  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: '',
        quantity: 1,
        costPrice: 0,
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    if (customRowIndex === index) {
      setCustomRowIndex(null);
      setCustomProdName('');
    } else if (customRowIndex !== null && customRowIndex > index) {
      setCustomRowIndex(customRowIndex - 1);
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreateInlineProduct = async (rowIndex: number) => {
    if (!customProdName.trim()) {
      error('Product Name is required.');
      return;
    }

    setIsCreatingInlineProd(true);
    try {
      const res = await productApi.create({
        name: customProdName.trim(),
        category: customProdCategory.trim() || 'Development Boards',
        sellingPrice: customProdSellingPrice !== '' ? Number(customProdSellingPrice) : 0,
        costPrice: Number(items[rowIndex]?.costPrice) || 0,
      });

      if (res.success && res.product) {
        success(`Product "${res.product.name}" created and added to list!`, 'Product Created');
        setProducts((prev) => [res.product, ...prev]);
        updateItemRow(rowIndex, 'productId', res.product._id);
        setCustomRowIndex(null);
        setCustomProdName('');
        setCustomProdCategory('Development Boards');
        setCustomProdSellingPrice('');
      }
    } catch (err: any) {
      error(err.message || 'Failed to create product');
    } finally {
      setIsCreatingInlineProd(false);
    }
  };

  const updateItemRow = (index: number, field: keyof InventoryItemRow, val: any) => {
    setItems((prev) => {
      const copy = [...prev];
      if (field === 'productId') {
        const prod = products.find((p) => p._id === val);
        copy[index] = {
          ...copy[index],
          productId: val,
          costPrice: prod ? prod.averageCost || 0 : copy[index].costPrice,
        };
      } else {
        copy[index] = { ...copy[index], [field]: val };
      }
      return copy;
    });
  };

  // Calculations
  const calculateTotalCost = () => {
    return items.reduce((acc, row) => acc + (Number(row.quantity) || 0) * (Number(row.costPrice) || 0), 0);
  };

  // Compress images to max 1280px and JPEG quality 0.7 to avoid massive base64 payloads and upload timeouts
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      // If it's a PDF, read as-is
      if (!file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1024;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Ultra-lightweight JPEG for bills (< 200KB), fast transfer over any connection
            resolve(canvas.toDataURL('image/jpeg', 0.65));
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = () => resolve(event.target?.result as string);
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle Bill File Upload with automatic compression
  const handleBillUpload = async (e: React.ChangeEvent<HTMLInputElement>, isNewProd: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedBase64 = await compressImage(file);
      if (isNewProd) {
        setNewProdBillFile(compressedBase64);
        setNewProdBillFileName(file.name);
      } else {
        setBillFile(compressedBase64);
        setBillFileName(file.name);
      }
    } catch {
      // Fallback in case of canvas error
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (isNewProd) {
          setNewProdBillFile(base64);
          setNewProdBillFileName(file.name);
        } else {
          setBillFile(base64);
          setBillFileName(file.name);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Inventory Entry
  const handleSubmitInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      error('Please add at least one product row to receive inventory.');
      return;
    }

    for (const row of items) {
      if (!row.productId) {
        error('Please select a valid product for all rows.');
        return;
      }
      if (!row.quantity || row.quantity <= 0) {
        error('Quantity must be greater than 0 for all items.');
        return;
      }
      if (row.costPrice === undefined || row.costPrice < 0) {
        error('Cost price cannot be negative.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await purchaseApi.create({
        supplierName: supplierName.trim() || 'General IoT Vendor',
        invoiceNumber: invoiceNumber.trim() || undefined,
        purchaseDate,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          costPrice: Number(i.costPrice),
        })),
        attachmentUrl: billFile || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        success('Inventory received successfully! Central stock updated.', 'Stock Added');
        // Reset form
        setSupplierName('');
        setInvoiceNumber('');
        setNotes('');
        setBillFile(null);
        setBillFileName('');
        setItems([
          {
            productId: '',
            quantity: 1,
            costPrice: 0,
          },
        ]);
        loadData();
      }
    } catch (err: any) {
      error(err.message || 'Failed to add inventory entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit "+ Add New Product" inline modal
  const handleCreateNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newProdName.trim()) {
      error('Product Name is required.');
      return;
    }

    if (newProdCostPrice === '' || Number(newProdCostPrice) <= 0) {
      error('Cost Price is mandatory for adding a new product.');
      return;
    }

    if (newProdSellingPrice === '' || Number(newProdSellingPrice) < 0) {
      error('Selling Price is required.');
      return;
    }

    // MANDATORY VALIDATION: Bill/Invoice Photo
    if (!newProdBillFile) {
      error('Purchase bill/invoice is required for a new product.', 'Validation Error');
      return;
    }

    setIsCreatingProduct(true);
    try {
      const res = await productApi.create({
        name: newProdName.trim(),
        category: newProdCategory.trim(),
        costPrice: Number(newProdCostPrice),
        sellingPrice: Number(newProdSellingPrice),
        initialQuantity: Number(newProdInitialQty) || 0,
        billPhoto: newProdBillFile,
        isFromInventory: true,
      });

      if (res.success && res.product) {
        success(
          `New product "${res.product.name}" created with initial stock ${res.product.currentStock}. Central inventory increased!`,
          'Product Created'
        );
        setIsNewProductModalOpen(false);
        // Reset modal form
        setNewProdName('');
        setNewProdCostPrice('');
        setNewProdSellingPrice('');
        setNewProdInitialQty(1);
        setNewProdBillFile(null);
        setNewProdBillFileName('');

        // Reload data and set the newly created product in the current row
        await loadData();
        setItems((prev) => [
          ...prev,
          {
            productId: res.product._id,
            quantity: 1,
            costPrice: res.product.averageCost || Number(newProdCostPrice),
          },
        ]);
      }
    } catch (err: any) {
      error(err.message || 'Failed to create new product');
    } finally {
      setIsCreatingProduct(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <PackagePlus className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Add Purchased Inventory</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Record newly purchased IoT components, update central inventory, and attach vendor bills.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsNewProductModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition shadow-sm"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>+ Add New Product</span>
        </button>
      </div>

      {/* Main Inventory Purchase Form */}
      <form
        onSubmit={handleSubmitInventory}
        className="bg-white border border-slate-200 rounded-xl shadow-subtle p-5 space-y-6"
      >
        {/* Purchase Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Purchase / Receiving Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supplier / Vendor Name
            </label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="e.g. Robocraze / Local Distributor"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Bill / Invoice Reference #
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-9042"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>

        {/* Multi-Product Entry Table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Components Purchased & Unit Costs
              </h2>
              <p className="text-[11px] text-slate-400">
                Select products from central inventory and enter quantities brought in.
              </p>
            </div>

            <button
              type="button"
              onClick={addItemRow}
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Item</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-visible bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[10px] uppercase">
                  <th className="py-2.5 px-3">Hardware Product</th>
                  <th className="py-2.5 px-3 w-32 text-center">Quantity (Units)</th>
                  <th className="py-2.5 px-3 w-36 text-right">Cost Price Per Unit (₹)</th>
                  <th className="py-2.5 px-4 w-36 text-right">Line Total Cost (₹)</th>
                  <th className="py-2.5 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row, idx) => {
                  const selectedProd = products.find((p) => p._id === row.productId);
                  const lineTotal = (Number(row.quantity) || 0) * (Number(row.costPrice) || 0);

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3">
                        {customRowIndex === idx ? (
                          <div className="p-3 bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-white border-2 border-amber-400 rounded-xl space-y-2.5 shadow-sm min-w-[280px]">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                <span>Add Custom Product</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setCustomRowIndex(null);
                                  setCustomProdName('');
                                }}
                                className="text-[11px] text-slate-400 hover:text-slate-700 font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-amber-100/60 transition"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Cancel</span>
                              </button>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-700 block mb-1">
                                Product Name <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="text"
                                autoFocus
                                value={customProdName}
                                onChange={(e) => setCustomProdName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCreateInlineProduct(idx);
                                  } else if (e.key === 'Escape') {
                                    setCustomRowIndex(null);
                                    setCustomProdName('');
                                  }
                                }}
                                placeholder="e.g. OLED Display 0.96 inch I2C"
                                className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 shadow-2xs"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Category</label>
                                <select
                                  value={customProdCategory}
                                  onChange={(e) => setCustomProdCategory(e.target.value)}
                                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                                >
                                  {categories.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Selling Price (₹)</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={customProdSellingPrice}
                                  onChange={(e) => setCustomProdSellingPrice(e.target.value ? parseFloat(e.target.value) : '')}
                                  placeholder="e.g. 250"
                                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-amber-200/60">
                              <span className="text-[10px] text-slate-400">Press Enter to save</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomRowIndex(null);
                                    setCustomProdName('');
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded-md transition"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={isCreatingInlineProd || !customProdName.trim()}
                                  onClick={() => handleCreateInlineProduct(idx)}
                                  className="px-3 py-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-md shadow-xs transition disabled:opacity-50 flex items-center gap-1"
                                >
                                  {isCreatingInlineProd ? (
                                    <span>Adding...</span>
                                  ) : (
                                    <>
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Add Product</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <SearchableProductSelect
                              products={products}
                              value={row.productId}
                              allowCustom={true}
                              onSelectCustom={() => {
                                setCustomRowIndex(idx);
                                setCustomProdName('');
                                setCustomProdCategory('Development Boards');
                                setCustomProdSellingPrice('');
                              }}
                              onChange={(productId) => {
                                updateItemRow(idx, 'productId', productId);
                              }}
                              placeholder="-- Select Component / Product --"
                            />
                            {selectedProd && (
                              <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                                <span>Current Central Stock: {selectedProd.currentStock}</span>
                                <span>•</span>
                                <span>Selling Price: ₹{selectedProd.sellingPrice}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          min={1}
                          required
                          value={row.quantity}
                          onChange={(e) => updateItemRow(idx, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-center text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs">₹</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            required
                            value={row.costPrice}
                            onChange={(e) => updateItemRow(idx, 'costPrice', parseFloat(e.target.value) || 0)}
                            className="w-full pl-6 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-right text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        ₹{lineTotal.toLocaleString('en-IN')}
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

        {/* Bill Attachment & Total Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl items-center">
          {/* Bill Attachment Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Purchase Bill / Invoice Attachment
            </label>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-700 cursor-pointer transition shadow-xs">
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Upload Bill Photo / PDF</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleBillUpload(e, false)}
                  className="hidden"
                />
              </label>

              {billFileName && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="truncate max-w-[150px]">{billFileName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setBillFile(null);
                      setBillFileName('');
                    }}
                    className="text-slate-400 hover:text-rose-600 ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Supported formats: JPEG, PNG, PDF. Bill will be permanently linked to this transaction.
            </p>
          </div>

          {/* Total Purchase Cost Card */}
          <div className="text-right">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold block">
              Total Purchase Cost
            </span>
            <div className="text-2xl font-extrabold font-mono text-slate-900 mt-0.5">
              ₹{calculateTotalCost().toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-slate-400">
              {items.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)} units total to receive
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
          >
            <PackagePlus className="w-4 h-4" />
            <span>{isSubmitting ? 'Updating Inventory...' : 'Save Inventory & Increase Central Stock'}</span>
          </button>
        </div>
      </form>

      {/* ========================================================= */}
      {/* INVENTORY PURCHASE HISTORY TABLE */}
      {/* ========================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-subtle overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Inventory Purchase History</h2>
            <p className="text-xs text-slate-500">Authoritative record of components added to UpVolt Central Stock</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 text-[10px] uppercase">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Purchase #</th>
                <th className="py-3 px-4">Products & Quantities</th>
                <th className="py-3 px-4 text-right">Total Purchase Amount</th>
                <th className="py-3 px-4">Added By</th>
                <th className="py-3 px-4 text-center">Bill / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading purchase history...
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No purchase history records found.
                  </td>
                </tr>
              ) : (
                purchases.map((pur) => (
                  <tr key={pur._id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {new Date(pur.purchaseDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {pur.purchaseNumber}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {pur.items.map((it, iIdx) => (
                          <span
                            key={iIdx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200"
                          >
                            <span className="font-bold text-amber-700">{it.quantity}x</span>
                            <span className="truncate max-w-[120px]">{it.productName}</span>
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      ₹{pur.totalAmount.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {pur.receivedBy}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {pur.attachmentUrl ? (
                          <button
                            type="button"
                            onClick={() => setViewingBillUrl(pur.attachmentUrl!)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium text-[11px] border border-emerald-200 transition"
                          >
                            <Receipt className="w-3 h-3 text-emerald-600" />
                            <span>View Bill</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No bill</span>
                        )}

                        <button
                          type="button"
                          onClick={() => setInspectingPurchase(pur)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium text-[11px] border border-slate-200 transition"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span>Details</span>
                        </button>

                        {isMasterAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setPurchaseToDelete(pur);
                              setDeletePurchaseConfirmText('');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-medium text-[11px] border border-rose-200 transition"
                            title="Delete purchase log and reverse added stock"
                          >
                            <Trash2 className="w-3 h-3 text-rose-600" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* INLINE MODAL: "+ ADD NEW PRODUCT" (WITH MANDATORY BILL) */}
      {/* ========================================================= */}
      {isNewProductModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsNewProductModalOpen(false)}
          title="Create New Product"
          subtitle="Add a new IoT hardware component directly to central catalog and inventory"
          maxWidth="lg"
        >
          <form onSubmit={handleCreateNewProduct} className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <span className="font-bold">Important requirement:</span> For any new product added to inventory,{' '}
              <span className="underline font-bold">Cost Price</span> and a valid{' '}
              <span className="underline font-bold">Purchase Bill/Invoice photo</span> are strictly mandatory.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                placeholder="e.g. ESP32-WROOM-32D Development Board"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newProdCategory}
                  onChange={(e) => setNewProdCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-medium"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Quantity <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={newProdInitialQty}
                  onChange={(e) => setNewProdInitialQty(parseInt(e.target.value) || '')}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cost Price Per Unit (₹) <span className="text-rose-500">* (Mandatory)</span>
                </label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  required
                  value={newProdCostPrice}
                  onChange={(e) => setNewProdCostPrice(parseFloat(e.target.value) || '')}
                  placeholder="e.g. 250"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Selling Price Per Unit (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={newProdSellingPrice}
                  onChange={(e) => setNewProdSellingPrice(parseFloat(e.target.value) || '')}
                  placeholder="e.g. 350"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            {/* MANDATORY BILL/INVOICE PHOTO */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Purchase Bill / Invoice Photo <span className="text-rose-500">* (MANDATORY)</span>
              </label>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-amber-300 hover:bg-amber-50 rounded-lg text-xs font-bold text-amber-900 cursor-pointer transition shadow-xs">
                  <Upload className="w-3.5 h-3.5 text-amber-600" />
                  <span>Attach Bill / Invoice</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleBillUpload(e, true)}
                    className="hidden"
                  />
                </label>

                {newProdBillFileName ? (
                  <div className="flex items-center gap-1 text-xs text-emerald-700 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{newProdBillFileName}</span>
                  </div>
                ) : (
                  <span className="text-xs text-rose-600 font-semibold">
                    * Bill attachment required
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsNewProductModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingProduct}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition shadow-sm disabled:opacity-50"
              >
                {isCreatingProduct ? 'Saving Product...' : 'Create Product & Add Stock'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL: VIEW BILL PHOTO / DOCUMENT */}
      {/* ========================================================= */}
      {viewingBillUrl && (
        <Modal
          isOpen={true}
          onClose={() => setViewingBillUrl(null)}
          title="Purchase Bill / Invoice Document"
          subtitle="Official vendor invoice recorded with this purchase entry"
          maxWidth="2xl"
        >
          <div className="space-y-4 text-center">
            {viewingBillUrl.startsWith('data:image') || viewingBillUrl.startsWith('http') ? (
              <img
                src={viewingBillUrl}
                alt="Purchase Invoice"
                className="max-h-[70vh] mx-auto rounded-lg border border-slate-200 object-contain shadow-sm"
              />
            ) : (
              <iframe
                src={viewingBillUrl}
                title="Bill Document"
                className="w-full h-[70vh] rounded-lg border border-slate-200"
              />
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setViewingBillUrl(null)}
                className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Close Bill
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL: PURCHASE DETAILS */}
      {/* ========================================================= */}
      {inspectingPurchase && (
        <Modal
          isOpen={true}
          onClose={() => setInspectingPurchase(null)}
          title={`Purchase Entry: ${inspectingPurchase.purchaseNumber}`}
          subtitle={`Received on ${new Date(inspectingPurchase.purchaseDate).toLocaleDateString()} by ${inspectingPurchase.receivedBy}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Supplier</span>
                <span className="font-bold text-slate-800 mt-0.5 block">{inspectingPurchase.supplierName || 'General Supplier'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Total Purchase Cost</span>
                <span className="font-extrabold font-mono text-slate-900 mt-0.5 block">₹{inspectingPurchase.totalAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[10px] uppercase">
                    <th className="py-2 px-3">Product Name</th>
                    <th className="py-2 px-3 text-center">Qty</th>
                    <th className="py-2 px-3 text-right">Cost Price</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inspectingPurchase.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-medium text-slate-800">
                        <div>{it.productName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{it.sku}</div>
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">{it.quantity}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">₹{it.costPrice}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">₹{it.totalCost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {inspectingPurchase.attachmentUrl && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setViewingBillUrl(inspectingPurchase.attachmentUrl!);
                    setInspectingPurchase(null);
                  }}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Open Attached Purchase Bill</span>
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL: CONFIRM DELETE PURCHASE RECORD */}
      {/* ========================================================= */}
      {purchaseToDelete && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!isDeletingPurchase) {
              setPurchaseToDelete(null);
              setDeletePurchaseConfirmText('');
            }
          }}
          title={`Delete Purchase: ${purchaseToDelete.purchaseNumber}`}
          subtitle="Permanently remove purchase record and reverse added stock"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-800">Critical Stock Reversal Warning</p>
                <p className="mt-1 text-rose-700 leading-relaxed">
                  Deleting this purchase record will <strong>permanently delete</strong> the purchase entry{' '}
                  <span className="font-mono font-bold">{purchaseToDelete.purchaseNumber}</span> and{' '}
                  <strong>automatically deduct</strong> the following quantities from UpVolt Central Stock & FIFO batches:
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto p-2 bg-slate-50 space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase px-2 py-1">
                Quantities To Be Deducted:
              </div>
              {purchaseToDelete.items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-2 py-1 bg-white rounded border border-slate-200 text-xs"
                >
                  <span className="font-medium text-slate-800 truncate mr-2">{it.productName}</span>
                  <span className="font-mono font-bold text-rose-600 shrink-0">
                    -{it.quantity} units
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Type <span className="font-mono font-bold text-rose-600">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deletePurchaseConfirmText}
                onChange={(e) => setDeletePurchaseConfirmText(e.target.value)}
                placeholder="Type DELETE here..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingPurchase}
                onClick={() => {
                  setPurchaseToDelete(null);
                  setDeletePurchaseConfirmText('');
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  deletePurchaseConfirmText.trim().toUpperCase() !== 'DELETE' || isDeletingPurchase
                }
                onClick={handleDeletePurchase}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingPurchase ? 'Deleting & Reverting...' : 'Delete & Deduct Stock'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
