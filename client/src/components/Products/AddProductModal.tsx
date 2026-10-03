import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from '../Common/Modal';
import { Product, Category } from '../../types';
import { productApi, categoryApi } from '../../api/client';
import { useToast } from '../Common/Toast';

interface AddProductModalProps {
  productToEdit?: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  productToEdit,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { success, error } = useToast();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Development Boards');
  const [unit, setUnit] = useState('pcs');
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [minStockLevel, setMinStockLevel] = useState<number>(10);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [priceChangeReason, setPriceChangeReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic Categories State
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      setIsAddingNewCategory(false);
      setNewCatName('');
      setNewCatDesc('');
    }
  }, [isOpen]);

  const loadCategories = async () => {
    try {
      const res = await categoryApi.getAll();
      if (res.success && res.categories.length > 0) {
        setCategoriesList(res.categories);
        if (!productToEdit) {
          setCategory((prev) => prev || res.categories[0].name);
        }
      }
    } catch (e) {
      console.error('Error fetching categories:', e);
    }
  };

  const handleQuickCreateCategory = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setIsSavingCategory(true);
    try {
      const res = await categoryApi.create({
        name: newCatName.trim(),
        description: newCatDesc.trim(),
      });
      if (res.success && res.category) {
        success(`Category '${res.category.name}' created!`, 'Category Added');
        setCategoriesList((prev) => [...prev, res.category]);
        setCategory(res.category.name);
        setIsAddingNewCategory(false);
        setNewCatName('');
        setNewCatDesc('');
      }
    } catch (err: any) {
      error(err.message || 'Failed to create category', 'Error');
    } finally {
      setIsSavingCategory(false);
    }
  };

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setSku(productToEdit.sku);
      setCategory(productToEdit.category);
      setUnit(productToEdit.unit || 'pcs');
      setSellingPrice(productToEdit.sellingPrice);
      setMinStockLevel(productToEdit.minStockLevel);
      setLocation(productToEdit.location || '');
      setDescription(productToEdit.description || '');
      setPriceChangeReason('');
    } else {
      setName('');
      setSku('');
      setCategory('Development Boards');
      setUnit('pcs');
      setSellingPrice(0);
      setMinStockLevel(10);
      setLocation('');
      setDescription('');
      setPriceChangeReason('');
    }
  }, [productToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      error('Product name is required', 'Validation Error');
      return;
    }
    if (sellingPrice < 0) {
      error('Selling price cannot be negative', 'Validation Error');
      return;
    }

    if (productToEdit && productToEdit.sellingPrice !== sellingPrice && !priceChangeReason.trim()) {
      error(
        'Please provide an authoritative reason when modifying the product selling price.',
        'Price Audit Reason Required'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      if (productToEdit) {
        await productApi.update(productToEdit._id, {
          name,
          category,
          unit,
          sellingPrice,
          minStockLevel,
          location,
          description,
          priceChangeReason,
        });
        success(`Product ${name} updated successfully.`, 'Product Updated');
      } else {
        await productApi.create({
          name,
          sku,
          category,
          unit,
          sellingPrice,
          minStockLevel,
          location,
          description,
        });
        success(`New product ${name} added to catalog.`, 'Product Created');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      error(err.message || 'Failed to save product', 'Save Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={productToEdit ? `Edit Product: ${productToEdit.name}` : 'Add New Hardware Product'}
      subtitle={
        productToEdit
          ? 'Historical order records will retain their original prices.'
          : 'Create a new catalog item. Initial stock must be received through purchases.'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ESP32-WROOM-32D Development Board"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">SKU</label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              disabled={!!productToEdit}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:bg-slate-100"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">Category *</label>
              <button
                type="button"
                onClick={() => setIsAddingNewCategory(!isAddingNewCategory)}
                className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 hover:underline inline-flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" />
                <span>{isAddingNewCategory ? 'Cancel' : '+ New Category'}</span>
              </button>
            </div>

            {isAddingNewCategory && (
              <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-lg space-y-2 mb-2">
                <input
                  type="text"
                  placeholder="New Category Name (e.g. Robotics)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-amber-300 rounded text-xs text-slate-800 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-amber-300 rounded text-xs text-slate-800 focus:outline-none"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsAddingNewCategory(false)}
                    className="px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-200/50 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickCreateCategory}
                    disabled={isSavingCategory || !newCatName.trim()}
                    className="px-2.5 py-0.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold rounded shadow-sm disabled:opacity-50"
                  >
                    {isSavingCategory ? 'Saving...' : 'Add & Select'}
                  </button>
                </div>
              </div>
            )}

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              {categoriesList.map((c) => (
                <option key={c._id || c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Selling Price (₹)</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={sellingPrice}
              onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Minimum Reorder Level
            </label>
            <input
              type="number"
              min={0}
              value={minStockLevel}
              onChange={(e) => setMinStockLevel(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Unit of Measurement</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. pcs, meters, kits"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Warehouse Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Bin B-04"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          {/* Price Change Reason if editing */}
          {productToEdit && productToEdit.sellingPrice !== sellingPrice && (
            <div className="sm:col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <label className="block text-xs font-bold text-amber-900 mb-1">
                Selling Price Change Audit Reason <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={priceChangeReason}
                onChange={(e) => setPriceChangeReason(e.target.value)}
                placeholder="e.g. Supplier component cost increase"
                className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                required
              />
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Detailed specs or pinout notes"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
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
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : productToEdit ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
