import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  ShieldCheck,
  AlertTriangle,
  Download,
  CheckCircle2,
  Calendar,
  Layers,
  FileSpreadsheet,
  Activity,
} from 'lucide-react';
import { reportApi } from '../api/client';
import { IntegrityCheckResult } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Common/Toast';

export const ReportsView: React.FC = () => {
  const { isMasterAdmin } = useAuth();
  const { success, error } = useToast();
  const [integrityResult, setIntegrityResult] = useState<IntegrityCheckResult | null>(null);
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [exportEntity, setExportEntity] = useState<'orders' | 'purchases' | 'products' | 'movements'>('orders');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (isMasterAdmin) {
      loadIntegrity();
    }
  }, [isMasterAdmin]);

  const loadIntegrity = async () => {
    try {
      const res = await reportApi.getIntegrityCheck();
      if (res.success) {
        setIntegrityResult(res.result);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunIntegrityCheck = async () => {
    setIsRunningCheck(true);
    try {
      const res = await reportApi.getIntegrityCheck();
      if (res.success) {
        setIntegrityResult(res.result);
        if (res.result.passed) {
          success('System integrity verified! All mathematical invariants passed with 0 discrepancies.', 'Integrity Check Passed');
        } else {
          error(`Integrity check found ${res.result.summary.discrepancyCount} discrepancy(s).`, 'Discrepancy Found');
        }
      }
    } catch (err: any) {
      error(err.message || 'Failed to run integrity check');
    } finally {
      setIsRunningCheck(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await reportApi.exportCsv(exportEntity);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `upvolt-${exportEntity}-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      success(`${exportEntity.toUpperCase()} CSV export downloaded.`, 'Export Ready');
    } catch (err: any) {
      error(err.message || 'Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Financial Reports & System Integrity
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Backend authoritative reconciliation, CSV data export, and mathematical audit verification.
        </p>
      </div>

      {/* System Integrity Check Card (Master Admin) */}
      {isMasterAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-subtle space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  integrityResult?.passed
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-amber-50 text-amber-600 border border-amber-200'
                }`}
              >
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Database & Inventory Reconciliation Engine
                </h2>
                <p className="text-xs text-slate-500">
                  Audits all 4 mathematical invariants: zero negative stock, sum of batches equals
                  physical stock, movements trail completeness, and FIFO COGS consistency.
                </p>
              </div>
            </div>

            <button
              onClick={handleRunIntegrityCheck}
              disabled={isRunningCheck}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-2 shrink-0 disabled:opacity-50"
            >
              <Activity className={`w-4 h-4 text-amber-400 ${isRunningCheck ? 'animate-spin' : ''}`} />
              <span>{isRunningCheck ? 'Auditing Invariants...' : 'Run System Integrity Check'}</span>
            </button>
          </div>

          {/* Integrity Summary Stats */}
          {integrityResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-400 font-sans block">Products Audited</span>
                  <span className="text-lg font-bold text-slate-900">
                    {integrityResult.summary.productsChecked}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-400 font-sans block">FIFO Batches Audited</span>
                  <span className="text-lg font-bold text-slate-900">
                    {integrityResult.summary.batchesChecked}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-400 font-sans block">Movements Audited</span>
                  <span className="text-lg font-bold text-slate-900">
                    {integrityResult.summary.movementsChecked}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-400 font-sans block">Orders Audited</span>
                  <span className="text-lg font-bold text-slate-900">
                    {integrityResult.summary.ordersChecked}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-400 font-sans block">Discrepancies Found</span>
                  <span
                    className={`text-lg font-bold ${
                      integrityResult.summary.discrepancyCount === 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {integrityResult.summary.discrepancyCount}
                  </span>
                </div>
              </div>

              {/* Status Banner */}
              {integrityResult.passed ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs text-emerald-900">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <strong className="font-semibold block">All Mathematical Invariants Passed!</strong>
                    Every product physical stock matches the exact sum of active FIFO batches. No
                    negative stock exists across any records.
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs text-rose-900">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                    <span>Inconsistencies Detected:</span>
                  </div>
                  <div className="divide-y divide-rose-200/60 font-mono text-[11px]">
                    {integrityResult.discrepancies.map((d, idx) => (
                      <div key={idx} className="py-2">
                        <span className="font-bold">{d.entityType}:</span> {d.name || d.entityId} —{' '}
                        {d.issue}
                        <div className="text-slate-600 mt-0.5">{JSON.stringify(d.details)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CSV Export Panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-subtle space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Authoritative Financial Data Export</h2>
            <p className="text-xs text-slate-500">
              Download clean, timezone-aware CSV files for external accounting and tax audit.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full sm:w-64">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Dataset to Export
            </label>
            <select
              value={exportEntity}
              onChange={(e: any) => setExportEntity(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
            >
              <option value="orders">Sales Orders (Revenue, Profit, COGS)</option>
              <option value="purchases">Purchases (Batches, Suppliers, POs)</option>
              <option value="products">Product Catalog & Current Stock</option>
              <option value="movements">Stock Movements & Audit Ledger</option>
            </select>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full sm:w-auto mt-auto px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Generating CSV...' : `Download ${exportEntity.toUpperCase()} CSV`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
