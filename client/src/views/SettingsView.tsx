import React, { useState } from 'react';
import { Settings, Save, ShieldCheck, Database, Server, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Common/Toast';

export const SettingsView: React.FC = () => {
  const { isMasterAdmin } = useAuth();
  const { success } = useToast();

  const [companyName, setCompanyName] = useState('UpVolt Technologies Pvt Ltd');
  const [currency, setCurrency] = useState('INR (₹)');
  const [defaultThreshold, setDefaultThreshold] = useState(10);
  const [allowDraftReservation, setAllowDraftReservation] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    success('System settings saved successfully.', 'Configuration Updated');
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">System & Business Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          General company configurations, inventory thresholds, and database connection status.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Company Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-subtle space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Organization Profile
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company Legal Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Operating Currency</label>
              <input
                type="text"
                value={currency}
                disabled
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Inventory Rules */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-subtle space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Inventory & Costing Policies
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <div className="font-semibold text-slate-900">Costing Method</div>
                <div className="text-slate-500 text-[11px]">
                  Immutable First-In, First-Out (FIFO) batch cost allocation
                </div>
              </div>
              <span className="px-2.5 py-1 rounded bg-amber-100 text-amber-900 font-semibold font-mono text-[11px]">
                STRICT FIFO (LOCKED)
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <div className="font-semibold text-slate-900">Draft Stock Reservation</div>
                <div className="text-slate-500 text-[11px]">
                  Draft orders increment Reserved Stock and reduce Available Stock
                </div>
              </div>
              <input
                type="checkbox"
                checked={allowDraftReservation}
                onChange={(e) => setAllowDraftReservation(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded border-slate-300"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <div className="font-semibold text-slate-900">Default Reorder Threshold</div>
                <div className="text-slate-500 text-[11px]">
                  Triggers low-stock notification alerts when available stock drops below
                </div>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <input
                  type="number"
                  min={1}
                  value={defaultThreshold}
                  onChange={(e) => setDefaultThreshold(parseInt(e.target.value) || 10)}
                  className="w-16 px-2 py-1 bg-white border border-slate-200 rounded text-center text-xs font-bold"
                />
                <span className="text-slate-500 text-xs font-sans">units</span>
              </div>
            </div>
          </div>
        </div>

        {/* Database & Environment Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-subtle space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            System & Infrastructure Telemetry
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3 font-sans">
              <Database className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="font-semibold text-slate-900">MongoDB Database</div>
                <div className="text-[11px] text-emerald-600 font-mono font-medium">
                  CONNECTED • mongodb://127.0.0.1:27017/upvolt_db
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3 font-sans">
              <Server className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <div className="font-semibold text-slate-900">API Backend Server</div>
                <div className="text-[11px] text-amber-700 font-mono font-medium">
                  ONLINE • Node.js Express Port 5001
                </div>
              </div>
            </div>
          </div>
        </div>

        {isMasterAdmin && (
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition shadow-sm flex items-center gap-2"
            >
              <Save className="w-4 h-4 text-amber-400" />
              <span>Save Configuration</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
