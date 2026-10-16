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
  Wrench,
  ShoppingCart,
  Package,
  Boxes,
  ArrowLeftRight,
  Users,
  Building2,
  FileText,
  Clock,
  Filter,
} from 'lucide-react';
import { reportApi } from '../api/client';
import { IntegrityCheckResult } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Common/Toast';

type ExportEntityType = 'orders' | 'purchases' | 'products' | 'movements' | 'customers' | 'suppliers';
type DatePresetType = 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'custom';

interface ReportOption {
  id: ExportEntityType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
  color: string;
}

const REPORT_OPTIONS: ReportOption[] = [
  {
    id: 'orders',
    title: 'Sales & Commercial Orders',
    description: 'Detailed customer sales orders, bill amounts, COGS, gross profits, profit margins, and delivery fees.',
    icon: ShoppingCart,
    tag: 'Revenue & COGS',
    color: 'emerald',
  },
  {
    id: 'purchases',
    title: 'Inbound Purchases & POs',
    description: 'Procurement history, supplier invoices, received batch quantities, and total vendor expenditure.',
    icon: Package,
    tag: 'Procurement',
    color: 'blue',
  },
  {
    id: 'products',
    title: 'Inventory & Stock Valuation',
    description: 'Current physical stock, reserved allocations, FIFO average costs, selling rates, and total stock value.',
    icon: Boxes,
    tag: 'Asset Valuation',
    color: 'amber',
  },
  {
    id: 'movements',
    title: 'Stock Movements & Audit Trail',
    description: 'Complete stock ledger: stock-ins, sales deductions, returns, damage quarantine, and manual adjustments.',
    icon: ArrowLeftRight,
    tag: 'Audit Trail',
    color: 'purple',
  },
  {
    id: 'customers',
    title: 'Customer Directory & Spending',
    description: 'Registered students and colleges, contact phone/emails, total order counts, and lifetime revenue contribution.',
    icon: Users,
    tag: 'Clients',
    color: 'cyan',
  },
  {
    id: 'suppliers',
    title: 'Supplier & Vendor Profiles',
    description: 'Active hardware suppliers, registered GST numbers, contact persons, supplied categories, and order counts.',
    icon: Building2,
    tag: 'Vendors',
    color: 'indigo',
  },
];

export const ReportsView: React.FC = () => {
  const { isMasterAdmin } = useAuth();
  const { success, error } = useToast();

  // Integrity Engine States
  const [integrityResult, setIntegrityResult] = useState<IntegrityCheckResult | null>(null);
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  // Export Filter States
  const [exportEntity, setExportEntity] = useState<ExportEntityType>('orders');
  const [datePreset, setDatePreset] = useState<DatePresetType>('this_month');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [isExporting, setIsExporting] = useState(false);

  // Format Helper YYYY-MM-DD
  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getPresetDates = (preset: DatePresetType): { start: string; end: string } => {
    const now = new Date();
    switch (preset) {
      case 'today':
        return { start: formatDate(now), end: formatDate(now) };
      case 'yesterday': {
        const y = new Date(now);
        y.setDate(now.getDate() - 1);
        return { start: formatDate(y), end: formatDate(y) };
      }
      case 'this_week': {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const mon = new Date(now);
        mon.setDate(diff);
        return { start: formatDate(mon), end: formatDate(now) };
      }
      case 'this_month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: formatDate(start), end: formatDate(now) };
      }
      case 'last_month': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start: formatDate(start), end: formatDate(end) };
      }
      case 'this_year': {
        const start = new Date(now.getFullYear(), 0, 1);
        return { start: formatDate(start), end: formatDate(now) };
      }
      case 'all':
        return { start: '2024-01-01', end: formatDate(now) };
      default:
        return {
          start: formatDate(new Date(now.getFullYear(), now.getMonth(), 1)),
          end: formatDate(now),
        };
    }
  };

  const [startDate, setStartDate] = useState(() => getPresetDates('this_month').start);
  const [endDate, setEndDate] = useState(() => getPresetDates('this_month').end);

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
          success(
            'System integrity verified! All mathematical invariants passed with 0 discrepancies.',
            'Integrity Check Passed'
          );
        } else {
          error(
            `Integrity check found ${res.result.summary.discrepancyCount} discrepancy(s).`,
            'Discrepancy Found'
          );
        }
      }
    } catch (err: any) {
      error(err.message || 'Failed to run integrity check');
    } finally {
      setIsRunningCheck(false);
    }
  };

  const handleAutoReconcile = async () => {
    setIsReconciling(true);
    try {
      const res = await reportApi.reconcileIntegrity();
      if (res.success) {
        setIntegrityResult(res.result);
        success(
          `Successfully reconciled ${res.outcome.reconciledCount} product(s)! Missing FIFO opening batches created.`,
          'Inventory Reconciled'
        );
      }
    } catch (err: any) {
      error(err.message || 'Failed to auto-reconcile inventory discrepancies');
    } finally {
      setIsReconciling(false);
    }
  };

  const handlePresetSelect = (preset: DatePresetType) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const { start, end } = getPresetDates(preset);
      setStartDate(start);
      setEndDate(end);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params: any = {
        format: exportFormat,
      };

      if (datePreset === 'all') {
        params.range = 'all';
      } else {
        params.startDate = startDate;
        params.endDate = endDate;
        params.range = 'custom';
      }

      const blob = await reportApi.exportCsv(exportEntity, params);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;

      const dateStr = datePreset === 'all' ? 'all_time' : `${startDate}_to_${endDate}`;
      link.setAttribute('download', `upvolt-${exportEntity}_${dateStr}.${exportFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      success(
        `${exportEntity.toUpperCase()} ${exportFormat.toUpperCase()} report successfully downloaded for period ${dateStr}.`,
        'Export Complete'
      );
    } catch (err: any) {
      error(err.message || 'Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const selectedReport = REPORT_OPTIONS.find((r) => r.id === exportEntity) || REPORT_OPTIONS[0];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Financial Reports & Authoritative Data Export
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Select dataset, configure custom date ranges, and export clean, audit-compliant CSV / JSON files.
        </p>
      </div>

      {/* Database & Inventory Reconciliation Engine (Master Admin) */}
      {isMasterAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-subtle space-y-4">
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

            <div className="flex items-center gap-2">
              {integrityResult && !integrityResult.passed && (
                <button
                  onClick={handleAutoReconcile}
                  disabled={isReconciling || isRunningCheck}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs shadow-sm transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  <Wrench className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
                  <span>{isReconciling ? 'Fixing...' : 'Auto-Fix Invariants'}</span>
                </button>
              )}

              <button
                onClick={handleRunIntegrityCheck}
                disabled={isRunningCheck || isReconciling}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                <Activity className={`w-4 h-4 text-amber-400 ${isRunningCheck ? 'animate-spin' : ''}`} />
                <span>{isRunningCheck ? 'Auditing Invariants...' : 'Run System Integrity Check'}</span>
              </button>
            </div>
          </div>

          {/* Integrity Summary Stats */}
          {integrityResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-400 font-sans block">Products Audited</span>
                  <span className="text-lg font-bold text-slate-900">
                    {(integrityResult.summary as any).totalProductsChecked ??
                      integrityResult.summary.productsChecked ??
                      0}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-400 font-sans block">FIFO Batches Audited</span>
                  <span className="text-lg font-bold text-slate-900">
                    {(integrityResult.summary as any).totalBatchesChecked ??
                      integrityResult.summary.batchesChecked ??
                      0}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-400 font-sans block">Movements Audited</span>
                  <span className="text-lg font-bold text-slate-900">
                    {(integrityResult.summary as any).totalMovementsChecked ??
                      integrityResult.summary.movementsChecked ??
                      0}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-400 font-sans block">Orders Audited</span>
                  <span className="text-lg font-bold text-slate-900">
                    {(integrityResult.summary as any).totalOrdersChecked ??
                      integrityResult.summary.ordersChecked ??
                      0}
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
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs text-emerald-900">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <strong className="font-semibold block">All Mathematical Invariants Passed!</strong>
                    Every product physical stock matches the exact sum of active FIFO batches. No
                    negative stock exists across any records.
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3 text-xs text-rose-900">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                      <span>Inconsistencies Detected:</span>
                    </div>

                    <button
                      onClick={handleAutoReconcile}
                      disabled={isReconciling}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
                    >
                      <Wrench className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
                      <span>{isReconciling ? 'Reconciling...' : 'Auto-Fix All Discrepancies'}</span>
                    </button>
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

      {/* Advanced Custom Report Generator Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle overflow-hidden">
        {/* Card Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Custom Business Report & Data Exporter</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Generate and download tailored CSV or JSON spreadsheets with custom date intervals.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Step 1: Select Report Type */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-mono">1</span>
                <span>Select Report to Download (Kya Download Karna Hai):</span>
              </label>
              <span className="text-xs text-slate-400 font-medium">
                Active: <strong className="text-slate-700">{selectedReport.title}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {REPORT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = exportEntity === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setExportEntity(opt.id)}
                    className={`relative p-4 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/30 ring-2 ring-amber-500/20 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-2 rounded-lg ${
                            isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-xs text-slate-900">{opt.title}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
                        {opt.tag}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed">{opt.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Date Range Filter */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-mono">2</span>
                <span>Select Date Range (Kis Date Se Kis Date Tak):</span>
              </label>

              {exportEntity === 'products' && (
                <span className="text-[11px] text-amber-600 font-medium bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  Note: Products report reflects live stock on hand
                </span>
              )}
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'this_month', label: 'This Month' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'this_week', label: 'This Week' },
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'this_year', label: 'This Year (YTD)' },
                { id: 'all', label: 'All Time' },
                { id: 'custom', label: 'Custom Range' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePresetSelect(p.id as DatePresetType)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    datePreset === p.id
                      ? 'bg-slate-900 text-white shadow-subtle'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date Range Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Start Date (From):</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset('custom');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>End Date (To):</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset('custom');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Export Format & Action Bar */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">File Format:</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                <button
                  type="button"
                  onClick={() => setExportFormat('csv')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    exportFormat === 'csv'
                      ? 'bg-white text-slate-900 shadow-subtle'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  CSV (Excel)
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('json')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    exportFormat === 'json'
                      ? 'bg-white text-slate-900 shadow-subtle'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  JSON Data
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <span className="block text-[11px] font-mono text-slate-400">
                  {datePreset === 'all' ? 'All Historical Records' : `${startDate} → ${endDate}`}
                </span>
                <span className="block text-xs font-semibold text-slate-700">
                  {selectedReport.title} ({exportFormat.toUpperCase()})
                </span>
              </div>

              <button
                onClick={handleExport}
                disabled={isExporting}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold rounded-lg text-xs shadow-md transition flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
              >
                <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
                <span>
                  {isExporting
                    ? 'Preparing Export...'
                    : `Download ${selectedReport.title.split(' ')[0]} ${exportFormat.toUpperCase()}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
