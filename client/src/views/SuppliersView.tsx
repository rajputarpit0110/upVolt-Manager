import React, { useState, useEffect } from 'react';
import { Truck, Search, Plus, Phone, Mail, Building2 } from 'lucide-react';
import { Supplier } from '../types';
import { supplierApi } from '../api/client';
import { Modal } from '../components/Common/Modal';
import { useToast } from '../components/Common/Toast';

export const SuppliersView: React.FC = () => {
  const { success, error } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [categories, setCategories] = useState('Microcontrollers, Sensors, Modules');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setIsLoading(true);
    try {
      const res = await supplierApi.getAll();
      if (res.success) setSuppliers(res.suppliers);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      error('Supplier name is required', 'Validation Error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await supplierApi.create({
        name,
        contactPerson,
        email,
        phone,
        address,
        gstNumber,
        categoriesSupplied: categories.split(',').map((c) => c.trim()),
      });

      if (res.success) {
        success(`Supplier ${name} registered.`, 'Supplier Added');
        setIsModalOpen(false);
        setName('');
        setContactPerson('');
        setEmail('');
        setPhone('');
        setAddress('');
        setGstNumber('');
        loadSuppliers();
      }
    } catch (err: any) {
      error(err.message || 'Failed to add supplier');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.contactPerson?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Hardware Supplier Vendors</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Component distributors, OEM manufacturers, and PCB fabrication partners.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition shrink-0"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Add Supplier</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor name, contact person or GSTIN..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-3 px-4">Supplier Name</th>
                <th className="py-3 px-4">Contact Person</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">Categories Supplied</th>
                <th className="py-3 px-4 text-right">GST Number</th>
                <th className="py-3 px-4 text-center">Total Purchases</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading suppliers...
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No suppliers found. Register your first hardware supplier above.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-semibold text-slate-900">{s.name}</td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{s.contactPerson || '—'}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono">
                      {s.phone && <div>{s.phone}</div>}
                      {s.email && <div className="text-[11px] text-slate-400">{s.email}</div>}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {s.categoriesSupplied?.join(', ') || 'All categories'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 font-medium">
                      {s.gstNumber || '—'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                      {s.totalPurchases}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Hardware Supplier"
        subtitle="Used for receiving incoming inventory batches with authoritative purchase costs."
        maxWidth="md"
      >
        <form onSubmit={handleCreateSupplier} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supplier / Company Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apex Electronics & Sensors Ltd"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="e.g. Anand Mehta"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sales@vendor.com"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN Number</label>
            <input
              type="text"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              placeholder="e.g. 07AAAAA0000A1Z5"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Categories Supplied (comma-separated)
            </label>
            <input
              type="text"
              value={categories}
              onChange={(e) => setCategories(e.target.value)}
              placeholder="Microcontrollers, Sensors, PCBs"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Register Supplier'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
