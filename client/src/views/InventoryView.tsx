import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Filter,
  Layers,
  Sliders,
  AlertTriangle,
  Edit2,
  Boxes,
  Tag,
} from 'lucide-react';
import { Product, Category } from '../types';
import { productApi, categoryApi } from '../api/client';
import { ProductDetailModal } from '../components/Products/ProductDetailModal';
import { AdjustStockModal } from '../components/Products/AdjustStockModal';
import { AddProductModal } from '../components/Products/AddProductModal';
import { ManageCategoriesModal } from '../components/Products/ManageCategoriesModal';

interface InventoryViewProps {
  selectedProductFromParent?: Product | null;
  onClearSelectedProduct?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  selectedProductFromParent,
  onClearSelectedProduct,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');

  // Modals
  const [inspectingProduct, setInspectingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [categoryFilter, stockFilter]);

  const loadCategories = async () => {
    try {
      const res = await categoryApi.getAll();
      if (res.success) {
        setCategoriesList(res.categories);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  useEffect(() => {
    if (selectedProductFromParent) {
      setInspectingProduct(selectedProductFromParent);
      onClearSelectedProduct?.();
    }
  }, [selectedProductFromParent]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (stockFilter === 'LOW') params.lowStock = true;
      if (stockFilter === 'OUT') params.outOfStock = true;

      const res = await productApi.getAll(params);
      if (res.success) {
        setProducts(res.products);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  const categoryNames = ['ALL', ...categoriesList.map((c) => c.name)];

  return (
    <div className="space-y-5">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Hardware Catalog & Inventory</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Physical stock, reserved draft allocations, and FIFO cost tracking for IoT components.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCategoriesModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs shadow-subtle transition active:scale-95 shrink-0"
          >
            <Tag className="w-3.5 h-3.5 text-amber-500" />
            <span>Manage Categories</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-sm transition active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name or SKU..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        {/* Filter Badges & Dropdown */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              {categoryNames.map((c) => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'All Categories' : c}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Level Quick Filters */}
          <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
            <button
              onClick={() => setStockFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                stockFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-subtle font-semibold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setStockFilter('LOW')}
              className={`px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1 ${
                stockFilter === 'LOW'
                  ? 'bg-amber-100 text-amber-900 font-semibold shadow-subtle'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>Low Stock</span>
            </button>
            <button
              onClick={() => setStockFilter('OUT')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                stockFilter === 'OUT'
                  ? 'bg-rose-100 text-rose-900 font-semibold shadow-subtle'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Out of Stock
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-3 px-4">Product Details</th>
                <th className="py-3 px-4 text-center">Physical Stock</th>
                <th className="py-3 px-4 text-center">Reserved</th>
                <th className="py-3 px-4 text-center">Available Stock</th>
                <th className="py-3 px-4 text-center">Damaged</th>
                <th className="py-3 px-4 text-right">Selling Price</th>
                <th className="py-3 px-4 text-right">Avg Cost</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading products...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Boxes className="w-8 h-8 text-slate-300" />
                      <span>No products found matching the criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const available = p.currentStock - p.reservedStock;
                  const isLow = p.currentStock <= p.minStockLevel && p.currentStock > 0;
                  const isOut = p.currentStock === 0;

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/80 transition">
                      {/* Product Name & SKU */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-mono bg-slate-100 px-1 rounded text-slate-600">
                            {p.sku}
                          </span>
                          <span>•</span>
                          <span>{p.category}</span>
                          {p.location && (
                            <>
                              <span>•</span>
                              <span>{p.location}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Physical Stock */}
                      <td className="py-3 px-4 text-center font-mono">
                        <span
                          className={`font-bold px-2 py-0.5 rounded ${
                            isOut
                              ? 'bg-rose-100 text-rose-700'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'text-slate-900 font-semibold'
                          }`}
                        >
                          {p.currentStock} {p.unit}
                        </span>
                        {isLow && (
                          <div className="text-[10px] text-amber-600 mt-0.5 font-sans font-medium">
                            Low (min {p.minStockLevel})
                          </div>
                        )}
                        {isOut && (
                          <div className="text-[10px] text-rose-600 mt-0.5 font-sans font-medium">
                            Reorder Now
                          </div>
                        )}
                      </td>

                      {/* Reserved (Drafts) */}
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="text-amber-600 font-medium">
                          {p.reservedStock > 0 ? `${p.reservedStock} ${p.unit}` : '—'}
                        </span>
                      </td>

                      {/* Available Stock */}
                      <td className="py-3 px-4 text-center font-mono">
                        <span
                          className={`font-bold ${
                            available > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {available} {p.unit}
                        </span>
                      </td>

                      {/* Damaged Stock */}
                      <td className="py-3 px-4 text-center font-mono">
                        <span className={p.damagedStock > 0 ? 'text-rose-600 font-semibold' : 'text-slate-300'}>
                          {p.damagedStock > 0 ? `${p.damagedStock} ${p.unit}` : '0'}
                        </span>
                      </td>

                      {/* Selling Price */}
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                        ₹{p.sellingPrice.toLocaleString('en-IN')}
                      </td>

                      {/* Avg Cost */}
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        ₹{p.averageCost ? p.averageCost.toLocaleString('en-IN') : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setInspectingProduct(p)}
                            title="Inspect FIFO Batches & Ledger"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition"
                          >
                            <Layers className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setAdjustingProduct(p)}
                            title="Manual Stock Adjustment"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                          >
                            <Sliders className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setEditingProduct(p)}
                            title="Edit Product Specs & Price"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <ProductDetailModal
        product={inspectingProduct}
        isOpen={!!inspectingProduct}
        onClose={() => setInspectingProduct(null)}
        onOpenAdjustStock={(prod) => setAdjustingProduct(prod)}
      />

      <AdjustStockModal
        product={adjustingProduct}
        isOpen={!!adjustingProduct}
        onClose={() => setAdjustingProduct(null)}
        onSuccess={loadProducts}
      />

      <AddProductModal
        productToEdit={editingProduct}
        isOpen={isAddModalOpen || !!editingProduct}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingProduct(null);
        }}
        onSuccess={loadProducts}
      />

      <ManageCategoriesModal
        isOpen={isCategoriesModalOpen}
        onClose={() => setIsCategoriesModalOpen(false)}
        onCategoriesUpdated={() => {
          loadCategories();
          loadProducts();
        }}
      />
    </div>
  );
};
