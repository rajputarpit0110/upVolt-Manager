import React from 'react';
import {
  LayoutDashboard,
  Cpu,
  PackagePlus,
  ShoppingCart,
  Truck,
  BarChart3,
  UserCheck,
  Boxes,
  LogOut,
  Zap,
  ShieldCheck,
  Building2,
  PackageCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavTab =
  | 'dashboard'
  | 'inventory'
  | 'add_inventory'
  | 'college_dispatch'
  | 'orders'
  | 'products'
  | 'team'
  | 'reports'
  | 'college_inventory'
  | 'college_dispatches'
  | 'campus_deliveries'
  | 'purchases'
  | 'customers'
  | 'suppliers'
  | 'trash'
  | 'movements'
  | 'daily_activity'
  | 'audit_logs'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  trashCount?: number;
  lowStockCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  lowStockCount = 0,
}) => {
  const { user, isMasterAdmin, isCollegeMember, isCampusExecutive, logout } = useAuth();

  // Navigation items simplified to the exact 8 primary sections requested
  const regularNavItems: {
    id: NavTab;
    label: string;
    icon: any;
    badge?: number;
    badgeVariant?: 'amber' | 'rose' | 'slate';
    adminOnly?: boolean;
    section?: string;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Core' },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: Cpu,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      badgeVariant: 'amber',
      section: 'Stock & Distribution',
    },
    { id: 'add_inventory', label: 'Add Inventory', icon: PackagePlus, section: 'Stock & Distribution' },
    { id: 'college_dispatch', label: 'College Dispatch', icon: Truck, section: 'Stock & Distribution' },
    { id: 'orders', label: 'Delivered Orders', icon: ShoppingCart, section: 'Sales' },
    { id: 'products', label: 'Products', icon: Boxes, section: 'Catalog' },
    { id: 'team', label: 'Team / Users', icon: UserCheck, adminOnly: true, section: 'Administration' },
    { id: 'reports', label: 'Reports', icon: BarChart3, section: 'Analytics' },
  ];

  // College Member navigation is strictly scoped to their college
  const collegeNavItems: {
    id: NavTab;
    label: string;
    icon: any;
    section?: string;
  }[] = [
    { id: 'college_inventory', label: 'My College Inventory', icon: Cpu, section: 'Campus Scope' },
    { id: 'college_dispatches', label: 'Received Stock', icon: Truck, section: 'Campus Scope' },
  ];

  // Campus Executive navigation is strictly scoped to Student Handover & Deliveries
  const campusExecutiveNavItems: {
    id: NavTab;
    label: string;
    icon: any;
    section?: string;
  }[] = [
    { id: 'campus_deliveries', label: 'Campus Deliveries', icon: PackageCheck, section: 'Fulfillment' },
  ];

  const navItems = isCollegeMember
    ? collegeNavItems
    : isCampusExecutive
    ? campusExecutiveNavItems
    : regularNavItems;

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 h-screen sticky top-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center text-white shadow-sm">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base text-slate-900 tracking-tight">UpVolt</span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              {isCollegeMember
                ? `${user?.college || 'COLLEGE'} PORTAL`
                : isCampusExecutive
                ? 'CAMPUS FULFILLMENT'
                : 'HARDWARE SAAS'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item: any) => {
          if (item.adminOnly && !isMasterAdmin) return null;

          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-amber-50 text-amber-900 font-semibold border border-amber-200/60 shadow-subtle'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-amber-600' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                <span>{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono font-semibold ${
                    item.badgeVariant === 'rose'
                      ? 'bg-rose-100 text-rose-700'
                      : item.badgeVariant === 'amber'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate">{user?.name}</p>
              <div className="flex items-center gap-1">
                {isMasterAdmin ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 font-semibold">
                    <ShieldCheck className="w-3 h-3 text-amber-600" />
                    Master Admin
                  </span>
                ) : isCollegeMember ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-700 font-semibold truncate">
                    <Building2 className="w-3 h-3 text-blue-600 shrink-0" />
                    <span className="truncate">{user?.college || 'College Member'}</span>
                  </span>
                ) : isCampusExecutive ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 font-semibold truncate">
                    <UserCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="truncate">Campus Executive</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-medium">Staff Member</span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
