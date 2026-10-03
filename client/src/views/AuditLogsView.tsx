import React, { useState, useEffect } from 'react';
import { History, Search, Filter, ShieldCheck, ArrowRight } from 'lucide-react';
import { AuditLog } from '../types';
import { auditApi } from '../api/client';
import { Badge } from '../components/Common/Badge';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (actionFilter !== 'ALL') params.action = actionFilter;
      const res = await auditApi.getAll(params);
      if (res.success) setLogs(res.logs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.userName.toLowerCase().includes(q) ||
      l.entityType.toLowerCase().includes(q) ||
      l.reason?.toLowerCase().includes(q) ||
      l.relatedOrderId?.toLowerCase().includes(q)
    );
  });

  const actions = [
    'ALL',
    'LOGIN',
    'CREATE_PRODUCT',
    'UPDATE_PRODUCT',
    'RECEIVE_STOCK',
    'CREATE_ORDER',
    'UPDATE_ORDER',
    'CANCEL_ORDER',
    'RETURN_ORDER',
    'DELETE_ORDER',
    'RESTORE_ORDER',
    'PERMANENT_DELETE_ORDER',
    'PRICE_CHANGE',
    'STOCK_ADJUSTMENT',
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Immutable Audit History Log
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Append-only system activity trail. No user, staff or admin can modify or delete audit
            records.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, user, or reason..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
        >
          {actions.map((a) => (
            <option key={a} value={a}>
              {a === 'ALL' ? 'All Audit Actions' : a}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Authoritative Reason / Details</th>
                <th className="py-3 px-4">Linked Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No audit records match the current filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 text-slate-500 font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`font-mono font-semibold px-2 py-0.5 rounded text-[11px] ${
                          log.action.includes('DELETE') || log.action.includes('CANCEL')
                            ? 'bg-rose-100 text-rose-800'
                            : log.action.includes('CREATE') || log.action.includes('RECEIVE')
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.action.includes('PRICE') || log.action.includes('ADJUST')
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{log.userName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {log.role} ({log.userId})
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{log.entityType}</span>
                      {log.entityId && (
                        <span className="block font-mono text-[10px] text-slate-400">
                          {log.entityId}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-600 max-w-sm">
                      {log.reason ? (
                        <div className="italic text-slate-800 font-medium">{log.reason}</div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                      {log.relatedOrderId || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
