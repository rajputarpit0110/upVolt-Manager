import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Common/Toast';
import { Sidebar, NavTab } from './components/Layout/Sidebar';
import { Topbar } from './components/Layout/Topbar';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { InventoryView } from './views/InventoryView';
import { AddInventoryView } from './views/AddInventoryView';
import { CollegeDispatchView } from './views/CollegeDispatchView';
import { CollegeMemberInventoryView } from './views/CollegeMemberInventoryView';
import { PurchasesView } from './views/PurchasesView';
import { OrdersView } from './views/OrdersView';
import { TrashView } from './views/TrashView';
import { StockMovementsView } from './views/StockMovementsView';
import { DailyActivityView } from './views/DailyActivityView';
import { ReportsView } from './views/ReportsView';
import { CustomersView } from './views/CustomersView';
import { SuppliersView } from './views/SuppliersView';
import { TeamView } from './views/TeamView';
import { AuditLogsView } from './views/AuditLogsView';
import { SettingsView } from './views/SettingsView';
import { CampusDeliveriesView } from './views/CampusDeliveriesView';
import { orderApi, productApi } from './api/client';
import { Product, Order } from './types';

const MainLayout: React.FC = () => {
  const { isAuthenticated, isLoading, isMasterAdmin, isCollegeMember, isCampusExecutive } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>(() =>
    isCollegeMember ? 'college_inventory' : isCampusExecutive ? 'campus_deliveries' : 'dashboard'
  );

  // Quick Action Modal states
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [isReceiveStockModalOpen, setIsReceiveStockModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);

  // Selected item passed to views from Topbar search or Dashboard
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Badge counts
  const [trashCount, setTrashCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      loadBadgeCounts();
    }
  }, [isAuthenticated, activeTab]);

  const loadBadgeCounts = async () => {
    try {
      if (isMasterAdmin) {
        const trashRes = await orderApi.getTrash();
        if (trashRes.success) setTrashCount(trashRes.count);
      }
      const prodRes = await productApi.getAll({ lowStock: true });
      if (prodRes.success) setLowStockCount(prodRes.count);
    } catch (err) {
      // quiet fail
    }
  };

  const handleSelectSearchResult = (type: 'product' | 'order' | 'customer' | 'supplier', item: any) => {
    if (type === 'product') {
      setSelectedProduct(item);
      setActiveTab('inventory');
    } else if (type === 'order') {
      setSelectedOrder(item);
      setActiveTab('orders');
    } else if (type === 'customer') {
      setActiveTab('customers');
    } else if (type === 'supplier') {
      setActiveTab('suppliers');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-500">Initializing UpVolt Manager...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        trashCount={trashCount}
        lowStockCount={lowStockCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          onOpenCreateOrder={() => {
            setActiveTab('orders');
            setIsCreateOrderModalOpen(true);
          }}
          onOpenReceiveStock={() => {
            setActiveTab('add_inventory');
          }}
          onOpenAddProduct={() => {
            setActiveTab('inventory');
            setIsAddProductModalOpen(true);
          }}
          onSelectSearchResult={handleSelectSearchResult}
        />

        <main className="flex-1 p-6 overflow-y-auto">
          {/* Campus Executive View (Strictly Scoped) */}
          {(isCampusExecutive || activeTab === 'campus_deliveries') && (
            <CampusDeliveriesView />
          )}

          {/* College Member Views */}
          {!isCampusExecutive && (activeTab === 'college_inventory' || activeTab === 'college_dispatches') && (
            <CollegeMemberInventoryView />
          )}

          {/* Core Central Views */}
          {!isCampusExecutive && activeTab === 'dashboard' && (
            <DashboardView
              onNavigate={(tab) => {
                if (tab === 'purchases') setActiveTab('add_inventory');
                else setActiveTab(tab);
              }}
              onSelectProduct={(prod) => {
                setSelectedProduct(prod);
                setActiveTab('inventory');
              }}
              onSelectOrder={(ord) => {
                setSelectedOrder(ord);
                setActiveTab('orders');
              }}
            />
          )}

          {!isCampusExecutive && (activeTab === 'inventory' || activeTab === 'products') && (
            <InventoryView
              selectedProductFromParent={selectedProduct}
              onClearSelectedProduct={() => setSelectedProduct(null)}
            />
          )}

          {!isCampusExecutive && activeTab === 'add_inventory' && <AddInventoryView />}

          {!isCampusExecutive && activeTab === 'college_dispatch' && <CollegeDispatchView />}

          {!isCampusExecutive && activeTab === 'purchases' && <AddInventoryView />}

          {!isCampusExecutive && activeTab === 'orders' && (
            <OrdersView
              isCreateOrderModalOpenFromParent={isCreateOrderModalOpen}
              onCloseCreateOrderModal={() => setIsCreateOrderModalOpen(false)}
              selectedOrderFromParent={selectedOrder}
              onClearSelectedOrder={() => setSelectedOrder(null)}
            />
          )}

          {!isCampusExecutive && activeTab === 'trash' && <TrashView />}

          {!isCampusExecutive && activeTab === 'movements' && <StockMovementsView />}

          {!isCampusExecutive && activeTab === 'daily_activity' && <DailyActivityView />}

          {!isCampusExecutive && activeTab === 'reports' && <ReportsView />}

          {!isCampusExecutive && activeTab === 'customers' && <CustomersView />}

          {!isCampusExecutive && activeTab === 'suppliers' && <SuppliersView />}

          {!isCampusExecutive && activeTab === 'team' && <TeamView />}

          {!isCampusExecutive && activeTab === 'audit_logs' && <AuditLogsView />}

          {!isCampusExecutive && activeTab === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <MainLayout />
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
