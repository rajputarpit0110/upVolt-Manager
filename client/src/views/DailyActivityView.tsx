import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  PackagePlus,
  ShoppingCart,
  RotateCcw,
  AlertTriangle,
  Sliders,
  DollarSign,
  TrendingUp,
  Tag,
  Boxes,
  RefreshCw,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { DailyActivityReport } from '../types';
import { reportApi } from '../api/client';
import { StatCard } from '../components/Common/StatCard';

export const DailyActivityView: React.FC = () => {
  const [report, setReport] = useState<DailyActivityReport | null>(null);
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadDailyActivity();
  }, [date]);

  const loadDailyActivity = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await reportApi.getDailyActivity(date);
      if (res.success && res.report) {
        setReport(res.report);
      } else {
        setErrorMsg('Failed to load daily activity report');
      }
    } catch (err: any) {
      console.error('Error fetching daily activity:', err);
      setErrorMsg(err.message || 'Unable to connect to reporting service');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreviousDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setDate(new Date().toISOString().split('T')[0]);
  };

  // Safe destructuring with fallback defaults
  const sr = report?.stockReceived || { units: 0, cost: 0, count: 0 };
  const ss = report?.stockSold || { units: 0, count: 0 };
  const sret = report?.stockReturned || { units: 0, count: 0 };
  const sd = report?.stockDamaged || { units: 0, count: 0 };
  const sa = report?.stockAdjusted || { units: 0, count: 0 };
  const f = report?.financials || { revenue: 0, cogs: 0, profit: 0, margin: 0 };
  const breakdowns = report?.productBreakdown || [];

  const hasAnyActivity =
    (sr.units || 0) > 0 ||
    (ss.units || 0) > 0 ||
    (sret.units || 0) > 0 ||
    (sd.units || 0) > 0 ||
    (sa.units || 0) > 0 ||
    (report?.ordersCreatedCount || 0) > 0 ||
    (report?.priceChangesCount || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header and Date Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-amber-500" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">What Changed Today?</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete daily activity ledger compiled directly from authoritative database transactions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-subtle p-0.5">
            <button
              type="button"
              onClick={handlePreviousDay}
              title="Previous Day"
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-2 py-1 bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleNextDay}
              title="Next Day"
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleToday}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
          >
            Today
          </button>

          <button
            type="button"
            onClick={loadDailyActivity}
            title="Refresh Ledger"
            disabled={isLoading}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-600' : ''}`} />
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
          <AlertTriangle className="w-6 h-6 text-rose-600 mx-auto" />
          <p className="text-xs font-semibold text-rose-800">{errorMsg}</p>
          <button
            type="button"
            onClick={loadDailyActivity}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className="p-16 text-center bg-white rounded-xl border border-slate-200 shadow-subtle space-y-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-slate-500">Compiling authoritative ledger for {date}...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Inventory Physical Flow Summary */}
          <div>
            <h2 className="text-xs font-bold text-slate-500 tracking-wider uppercase mb-3">
              Physical Inventory Delta & Movements
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-subtle">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                  <span>Stock Received</span>
                  <PackagePlus className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl font-bold font-mono text-emerald-600">
                  +{sr.units || 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  ₹{(sr.cost || 0).toLocaleString('en-IN')} cost
                </div>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-subtle">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                  <span>Stock Sold</span>
                  <ShoppingCart className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-xl font-bold font-mono text-slate-900">
                  {ss.units || 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  {ss.count || 0} order lines
                </div>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-subtle">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                  <span>Stock Returned</span>
                  <RotateCcw className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-xl font-bold font-mono text-blue-600">
                  +{sret.units || 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  {sret.count || 0} return actions
                </div>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-subtle">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                  <span>Stock Damaged</span>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-xl font-bold font-mono text-rose-600">
                  {sd.units || 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 font-mono">Quarantined</div>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-subtle">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                  <span>Stock Adjusted</span>
                  <Sliders className="w-4 h-4 text-slate-600" />
                </div>
                <div className="text-xl font-bold font-mono text-slate-800">
                  {sa.units || 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 font-mono">Manual counts</div>
              </div>
            </div>
          </div>

          {/* Daily Financials */}
          <div>
            <h2 className="text-xs font-bold text-slate-500 tracking-wider uppercase mb-3">
              Commercial Sales & Profit Realized
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <StatCard
                title="Total Revenue"
                value={`₹${(f.revenue || 0).toLocaleString('en-IN')}`}
                subtitle={`${report?.ordersCreatedCount || 0} orders created`}
                icon={DollarSign}
                highlight={true}
              />
              <StatCard
                title="FIFO COGS"
                value={`₹${(f.cogs || 0).toLocaleString('en-IN')}`}
                subtitle="True batch purchase cost"
                icon={Boxes}
              />
              <StatCard
                title="Gross Profit"
                value={`+₹${(f.profit || 0).toLocaleString('en-IN')}`}
                subtitle={`${f.margin || 0}% Gross Margin`}
                icon={TrendingUp}
              />
              <StatCard
                title="Catalog Audit Events"
                value={`${report?.priceChangesCount || 0} price changes`}
                subtitle={`${report?.productChangesCount || 0} products modified`}
                icon={Tag}
              />
            </div>
          </div>

          {/* Product Movement Breakdown */}
          <div>
            <h2 className="text-xs font-bold text-slate-500 tracking-wider uppercase mb-3">
              Item-by-Item Activity Breakdown
            </h2>
            {breakdowns.length > 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-subtle">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-right">Received</th>
                      <th className="py-2.5 px-3 text-right">Sold</th>
                      <th className="py-2.5 px-3 text-right">Returned</th>
                      <th className="py-2.5 px-3 text-right">Damaged</th>
                      <th className="py-2.5 px-3 text-right">Revenue</th>
                      <th className="py-2.5 px-3 text-right">Gross Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {breakdowns.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">
                          {item.productName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{item.sku}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-600 font-bold">
                          {item.received > 0 ? `+${item.received}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-800 font-bold">
                          {item.sold > 0 ? item.sold : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-blue-600 font-bold">
                          {item.returned > 0 ? `+${item.returned}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-rose-600 font-bold">
                          {item.damaged > 0 ? item.damaged : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-900 font-bold">
                          ₹{item.revenue.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-600 font-bold">
                          +₹{item.profit.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 bg-white border border-dashed border-slate-300 rounded-xl text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                  <Layers className="w-5 h-5 text-slate-400" />
                </div>
                <h4 className="text-xs font-bold text-slate-800">
                  {hasAnyActivity
                    ? 'Summary Recorded for This Date'
                    : `No Hardware Transactions Recorded on ${date}`}
                </h4>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Stock receipts, orders, returns, and catalog adjustments performed on this day will be
                  automatically compiled here in real time.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
