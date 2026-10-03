import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Tag,
  CheckCircle,
  X,
  Layers,
  Search,
} from 'lucide-react';
import { Category } from '../../types';
import { categoryApi } from '../../api/client';
import { Modal } from '../Common/Modal';
import { useToast } from '../Common/Toast';

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesUpdated?: () => void;
}

export const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({
  isOpen,
  onClose,
  onCategoriesUpdated,
}) => {
  const { success, error, warning } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Add / Edit form state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      setIsAddingNew(false);
      setEditingCatId(null);
      setName('');
      setDescription('');
    }
  }, [isOpen]);

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const res = await categoryApi.getAll();
      if (res.success) {
        setCategories(res.categories);
      }
    } catch (err: any) {
      console.error(err);
      error(err.message || 'Failed to load categories', 'Fetch Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEdit = (cat: Category) => {
    setEditingCatId(cat._id);
    setName(cat.name);
    setDescription(cat.description || '');
    setIsAddingNew(false);
  };

  const handleCancelForm = () => {
    setIsAddingNew(false);
    setEditingCatId(null);
    setName('');
    setDescription('');
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      warning('Category name is required', 'Validation');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCatId) {
        const res = await categoryApi.update(editingCatId, {
          name: name.trim(),
          description: description.trim(),
        });
        if (res.success) {
          success(`Category '${name}' updated successfully`, 'Category Updated');
        }
      } else {
        const res = await categoryApi.create({
          name: name.trim(),
          description: description.trim(),
        });
        if (res.success) {
          success(`Category '${name}' created successfully`, 'Category Created');
        }
      }
      handleCancelForm();
      await loadCategories();
      onCategoriesUpdated?.();
    } catch (err: any) {
      error(err.message || 'Failed to save category', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (cat.itemCount > 0) {
      warning(
        `Cannot delete category '${cat.name}' because it contains ${cat.itemCount} active product(s). Please reassign or archive products first.`,
        'Category In Use'
      );
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the category '${cat.name}'?`)) {
      return;
    }

    try {
      const res = await categoryApi.delete(cat._id);
      if (res.success) {
        success(`Category '${cat.name}' deleted successfully`, 'Deleted');
        await loadCategories();
        onCategoriesUpdated?.();
      }
    } catch (err: any) {
      error(err.message || 'Failed to delete category', 'Delete Error');
    }
  };

  const filteredCategories = categories.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q)) ||
      c.slug.toLowerCase().includes(q)
    );
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hardware Product Categories"
      subtitle="Manage official UpVolt hardware categories. Every team member can create and customize categories."
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search categories or descriptions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          {!isAddingNew && !editingCatId && (
            <button
              type="button"
              onClick={() => {
                setIsAddingNew(true);
                setName('');
                setDescription('');
              }}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Category</span>
            </button>
          )}
        </div>

        {/* Create / Edit Form Card */}
        {(isAddingNew || editingCatId) && (
          <form
            onSubmit={handleSaveCategory}
            className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-600" />
                {editingCatId ? 'Edit Category' : 'Create New Category'}
              </span>
              <button
                type="button"
                onClick={handleCancelForm}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Microcontrollers, Smart Sensors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Description / Subtext
                </label>
                <input
                  type="text"
                  placeholder="e.g. DC gear motors, servos, and shields"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/60 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : editingCatId ? 'Update Category' : 'Save Category'}
              </button>
            </div>
          </form>
        )}

        {/* Categories Table (Matching the user's design) */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading categories...</div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2">
            <Layers className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs text-slate-500">No categories found matching your search.</p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-subtle">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold tracking-wider uppercase text-[10px]">
                  <th className="py-2.5 px-3 w-16 text-center">ORDER</th>
                  <th className="py-2.5 px-4">CATEGORY</th>
                  <th className="py-2.5 px-4">DESCRIPTION</th>
                  <th className="py-2.5 px-3 text-center">PRODUCTS</th>
                  <th className="py-2.5 px-3 text-center">STATUS</th>
                  <th className="py-2.5 px-3">ADDED BY</th>
                  <th className="py-2.5 px-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredCategories.map((cat, idx) => (
                  <tr key={cat._id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-3 text-center font-mono text-slate-400 font-medium">
                      #{cat.order || idx + 1}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{cat.name}</div>
                      <div className="font-mono text-[11px] text-slate-400">/{cat.slug}</div>
                    </td>

                    <td className="py-3 px-4 text-slate-600 max-w-xs text-[11px] leading-relaxed">
                      {cat.description || '—'}
                    </td>

                    <td className="py-3 px-3 text-center font-mono">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                        {cat.itemCount || 0} items
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {cat.status}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-500 font-medium text-[11px]">
                      {cat.addedBy || 'upVolt Admin'}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(cat)}
                          title="Edit Category"
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          title="Delete Category"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
};
