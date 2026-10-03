import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Bell, Check, AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { searchApi, notificationApi } from '../../api/client';
import { Notification } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface TopbarProps {
  onOpenCreateOrder: () => void;
  onOpenReceiveStock: () => void;
  onOpenAddProduct: () => void;
  onSelectSearchResult?: (type: 'product' | 'order' | 'customer' | 'supplier', item: any) => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  onOpenCreateOrder,
  onOpenReceiveStock,
  onOpenAddProduct,
  onSelectSearchResult,
}) => {
  const { user, isCampusExecutive, isCollegeMember } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Load notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await notificationApi.getAll();
        if (res.success) {
          setNotifications(res.notifications);
        }
      } catch (err) {
        // quiet fail
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchApi.globalSearch(searchQuery);
        if (res.success) {
          setSearchResults(res.results);
          setShowSearchResults(true);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Global Search Bar */}
      <div className="relative w-96" ref={searchRef}>
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchResults) setShowSearchResults(true);
            }}
            placeholder="Search products, SKU, orders, customers..."
            className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults(null);
              }}
              className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Global Search Results Dropdown */}
        {showSearchResults && searchResults && (
          <div className="absolute top-full mt-1.5 left-0 w-full bg-white rounded-xl shadow-dropdown border border-slate-200 overflow-hidden max-h-96 overflow-y-auto z-50">
            {searchResults.products?.length === 0 &&
            searchResults.orders?.length === 0 &&
            searchResults.customers?.length === 0 &&
            searchResults.suppliers?.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No matching results found for "{searchQuery}"
              </div>
            ) : (
              <div className="p-2 space-y-3">
                {/* Products */}
                {searchResults.products?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase px-2 py-1">
                      Products ({searchResults.products.length})
                    </div>
                    {searchResults.products.map((p: any) => (
                      <div
                        key={p._id}
                        onClick={() => {
                          setShowSearchResults(false);
                          onSelectSearchResult?.('product', p);
                        }}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          <div className="text-slate-400 font-mono">SKU: {p.sku}</div>
                        </div>
                        <div className="text-right font-mono">
                          <span className="font-semibold text-slate-800">
                            {p.currentStock} in stock
                          </span>
                          <div className="text-slate-400">₹{p.sellingPrice}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Orders */}
                {searchResults.orders?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase px-2 py-1">
                      Orders ({searchResults.orders.length})
                    </div>
                    {searchResults.orders.map((o: any) => (
                      <div
                        key={o._id}
                        onClick={() => {
                          setShowSearchResults(false);
                          onSelectSearchResult?.('order', o);
                        }}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 font-mono">{o.orderNumber}</div>
                          <div className="text-slate-500">{o.customer?.name || 'Walk-in'}</div>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-slate-900">₹{o.totalAmount}</span>
                          <div className="text-amber-600 font-medium">{o.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons & Notifications */}
      <div className="flex items-center gap-3">
        {/* Quick Actions (Admin / Staff only) */}
        {!isCampusExecutive && !isCollegeMember && (
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCreateOrder}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs shadow-sm transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Order</span>
            </button>

            <button
              onClick={onOpenReceiveStock}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-sm transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Receive Stock</span>
            </button>

            <button
              onClick={onOpenAddProduct}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs transition"
            >
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              <span>Add Product</span>
            </button>
          </div>
        )}

        <div className="h-5 w-px bg-slate-200 mx-1" />

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-dropdown border border-slate-200 overflow-hidden z-50">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] text-amber-600 hover:text-amber-700 font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">No notifications</div>
                ) : (
                  notifications.slice(0, 8).map((n) => (
                    <div
                      key={n._id}
                      className={`p-3 text-xs transition ${
                        !n.isRead ? 'bg-amber-50/30' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {n.type === 'OUT_OF_STOCK' || n.type === 'LOW_STOCK' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        ) : (
                          <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900">{n.title}</div>
                          <div className="text-slate-600 mt-0.5 leading-snug">{n.message}</div>
                          <div className="text-[10px] text-slate-400 mt-1 font-mono">
                            {new Date(n.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
