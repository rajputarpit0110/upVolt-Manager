import axios from 'axios';
import {
  User,
  Product,
  InventoryBatch,
  ProductPriceHistory,
  StockMovement,
  Purchase,
  Order,
  OrderVersion,
  OrderReturn,
  Customer,
  Supplier,
  AuditLog,
  Notification,
  DashboardSummary,
  IntegrityCheckResult,
  DailyActivityReport,
  OrderStatus,
  Category,
  CollegeDispatch,
  CollegeInventory,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('upvolt_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: capture error message
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('upvolt_token');
      localStorage.removeItem('upvolt_user');
      // If unauthorized, redirect to login unless already there
      if (!window.location.pathname.includes('/login')) {
        window.dispatchEvent(new Event('upvolt_unauthorized'));
      }
    }
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

export const authApi = {
  login: async (credentials: { username?: string; email?: string; password: string }) => {
    const res = await api.post<{ success: boolean; token: string; user: User }>('/auth/login', credentials);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get<{ success: boolean; user: User }>('/auth/me');
    return res.data;
  },
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const res = await api.post<{ success: boolean; message: string }>('/auth/change-password', data);
    return res.data;
  },
};

export const productApi = {
  getAll: async (params?: { category?: string; search?: string; lowStock?: boolean; outOfStock?: boolean }) => {
    const res = await api.get<{ success: boolean; count: number; products: Product[] }>('/products', { params });
    return res.data;
  },
  getById: async (id: string) => {
    const res = await api.get<{ success: boolean; product: Product }>('/products/' + id);
    return res.data;
  },
  create: async (data: Partial<Product> & Record<string, any>) => {
    const res = await api.post<{ success: boolean; product: Product }>('/products', data);
    return res.data;
  },
  update: async (id: string, data: Partial<Product> & { priceChangeReason?: string }) => {
    const res = await api.put<{ success: boolean; product: Product }>('/products/' + id, data);
    return res.data;
  },
  getPriceHistory: async (id: string) => {
    const res = await api.get<{ success: boolean; count: number; history: ProductPriceHistory[] }>(
      `/products/${id}/price-history`
    );
    return res.data;
  },
  getBatches: async (id: string) => {
    const res = await api.get<{ success: boolean; count: number; batches: InventoryBatch[] }>(
      `/products/${id}/batches`
    );
    return res.data;
  },
  getLedger: async (id: string) => {
    const res = await api.get<{ success: boolean; count: number; ledger: any[] }>(`/products/${id}/ledger`);
    return res.data;
  },
};

export const purchaseApi = {
  getAll: async (params?: { search?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) => {
    const res = await api.get<{ success: boolean; count: number; total: number; purchases: Purchase[] }>(
      '/purchases',
      { params }
    );
    return res.data;
  },
  getById: async (id: string) => {
    const res = await api.get<{ success: boolean; purchase: Purchase }>('/purchases/' + id);
    return res.data;
  },
  create: async (data: {
    supplier?: any;
    supplierName?: string;
    items: { productId: string; quantity: number; costPrice: number }[];
    purchaseDate?: string;
    attachmentUrl?: string;
    paymentStatus?: string;
    invoiceNumber?: string;
    notes?: string;
    idempotencyKey?: string;
    [key: string]: any;
  }) => {
    const res = await api.post<{ success: boolean; purchase: Purchase; batches: InventoryBatch[] }>(
      '/purchases',
      data
    );
    return res.data;
  },
};

export const orderApi = {
  getAll: async (params?: {
    status?: string;
    paymentStatus?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await api.get<{ success: boolean; count: number; total: number; orders: Order[] }>('/orders', {
      params,
    });
    return res.data;
  },
  getById: async (id: string) => {
    const res = await api.get<{ success: boolean; order: Order; versions: OrderVersion[]; returns: OrderReturn[] }>(
      '/orders/' + id
    );
    return res.data;
  },
  create: async (data: {
    customer?: any;
    items: { productId: string; quantity: number; sellingPrice: number; discount?: number }[];
    status?: 'Draft' | 'Confirmed';
    paymentStatus?: string;
    paymentMethod?: string;
    amountPaid?: number;
    notes?: string;
    idempotencyKey?: string;
  }) => {
    const res = await api.post<{ success: boolean; order: Order }>('/orders', data);
    return res.data;
  },
  update: async (
    id: string,
    data: {
      items?: { productId: string; quantity: number; sellingPrice: number; discount?: number }[];
      customer?: any;
      paymentStatus?: string;
      notes?: string;
      changeReason: string;
    }
  ) => {
    const res = await api.put<{ success: boolean; order: Order; version: OrderVersion }>('/orders/' + id, data);
    return res.data;
  },
  updateStatus: async (id: string, status: OrderStatus) => {
    const res = await api.patch<{ success: boolean; order: Order }>(`/orders/${id}/status`, { status });
    return res.data;
  },
  cancel: async (id: string, reason?: string) => {
    const res = await api.post<{ success: boolean; order: Order; unitsRestored: number }>(`/orders/${id}/cancel`, {
      reason,
    });
    return res.data;
  },
  returnOrder: async (
    id: string,
    data: {
      items: { productId: string; quantity: number; condition: 'GOOD' | 'DAMAGED' | 'DEFECTIVE' }[];
      reason: string;
      notes?: string;
      idempotencyKey?: string;
    }
  ) => {
    const res = await api.post<{ success: boolean; orderReturn: OrderReturn; order: Order }>(
      `/orders/${id}/return`,
      data
    );
    return res.data;
  },
  getTrash: async () => {
    const res = await api.get<{ success: boolean; count: number; orders: Order[] }>('/orders/trash/all');
    return res.data;
  },
  softDelete: async (id: string, reason?: string) => {
    const res = await api.delete<{ success: boolean; message: string; order: Order }>(`/orders/${id}`, {
      data: { reason },
    });
    return res.data;
  },
  restore: async (id: string) => {
    const res = await api.post<{ success: boolean; message: string; order: Order }>(`/orders/${id}/restore`);
    return res.data;
  },
  permanentDelete: async (id: string, reason: string) => {
    const res = await api.delete<{ success: boolean; message: string }>(`/orders/${id}/permanent`, {
      data: { reason },
    });
    return res.data;
  },
  getVersions: async (id: string) => {
    const res = await api.get<{ success: boolean; count: number; versions: OrderVersion[] }>(
      `/orders/${id}/versions`
    );
    return res.data;
  },
};

export const inventoryApi = {
  getMovements: async (params?: {
    productId?: string;
    movementType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await api.get<{ success: boolean; count: number; total: number; movements: StockMovement[] }>(
      '/inventory/movements',
      { params }
    );
    return res.data;
  },
  adjustStock: async (data: {
    productId: string;
    quantity: number;
    movementType?: 'ADJUSTMENT' | 'DAMAGE' | 'MANUAL_CORRECTION';
    condition?: 'GOOD' | 'DAMAGED';
    reason: string;
    notes?: string;
    idempotencyKey?: string;
  }) => {
    const res = await api.post<{ success: boolean; product: Product; movement: StockMovement }>(
      '/inventory/adjust',
      data
    );
    return res.data;
  },
};

export const reportApi = {
  getDashboard: async (
    params?: { timeRange?: string; range?: string; startDate?: string; endDate?: string } | string
  ) => {
    const queryParams =
      typeof params === 'string'
        ? { timeRange: params, range: params }
        : {
            timeRange: params?.timeRange || params?.range || 'this_month',
            range: params?.range || params?.timeRange || 'this_month',
            startDate: params?.startDate,
            endDate: params?.endDate,
          };
    const res = await api.get<{ success: boolean; data: DashboardSummary }>('/reports/dashboard', {
      params: queryParams,
    });
    return res.data;
  },
  getIntegrityCheck: async () => {
    const res = await api.get<{ success: boolean; result: IntegrityCheckResult }>('/reports/integrity-check');
    return res.data;
  },
  getDailyActivity: async (date?: string) => {
    const res = await api.get<{ success: boolean; report: DailyActivityReport }>('/reports/daily-activity', {
      params: { date },
    });
    return res.data;
  },
  exportCsv: async (entity: 'orders' | 'purchases' | 'products' | 'movements', params?: any) => {
    const res = await api.get(`/reports/export/${entity}`, {
      params,
      responseType: 'blob',
    });
    return res.data;
  },
};

export const customerApi = {
  getAll: async (params?: { search?: string; category?: string }) => {
    const res = await api.get<{ success: boolean; count: number; customers: Customer[] }>('/customers', {
      params,
    });
    return res.data;
  },
  create: async (data: Partial<Customer>) => {
    const res = await api.post<{ success: boolean; customer: Customer }>('/customers', data);
    return res.data;
  },
  update: async (id: string, data: Partial<Customer>) => {
    const res = await api.put<{ success: boolean; customer: Customer }>('/customers/' + id, data);
    return res.data;
  },
};

export const supplierApi = {
  getAll: async (params?: { search?: string }) => {
    const res = await api.get<{ success: boolean; count: number; suppliers: Supplier[] }>('/suppliers', {
      params,
    });
    return res.data;
  },
  create: async (data: Partial<Supplier>) => {
    const res = await api.post<{ success: boolean; supplier: Supplier }>('/suppliers', data);
    return res.data;
  },
  update: async (id: string, data: Partial<Supplier>) => {
    const res = await api.put<{ success: boolean; supplier: Supplier }>('/suppliers/' + id, data);
    return res.data;
  },
};

export const userApi = {
  getAll: async () => {
    const res = await api.get<{ success: boolean; count: number; users: User[] }>('/users');
    return res.data;
  },
  create: async (data: {
    userId: string;
    username?: string;
    name: string;
    temporaryPassword?: string;
    password?: string;
    email?: string;
    phone?: string;
    department?: string;
    notes?: string;
    role: string;
    college?: string;
    [key: string]: any;
  }) => {
    const res = await api.post<{ success: boolean; user: User }>('/users', {
      ...data,
      temporaryPassword: data.temporaryPassword || data.password,
    });
    return res.data;
  },
  update: async (id: string, data: Partial<User>) => {
    const res = await api.put<{ success: boolean; user: User }>('/users/' + id, data);
    return res.data;
  },
  resetPassword: async (id: string, newPassword?: string) => {
    const res = await api.post<{ success: boolean; message: string; temporaryPassword?: string }>(
      `/users/${id}/reset-password`,
      { newPassword }
    );
    return res.data;
  },
};

export const collegeApi = {
  createDispatch: async (data: {
    college: string;
    dispatchDate?: string;
    items: { productId: string; quantity: number }[];
    notes?: string;
  }) => {
    const res = await api.post<{ success: boolean; message: string; dispatch: CollegeDispatch }>(
      '/colleges/dispatch',
      data
    );
    return res.data;
  },
  getDispatches: async (params?: { college?: string; startDate?: string; endDate?: string }) => {
    const res = await api.get<{ success: boolean; dispatches: CollegeDispatch[] }>(
      '/colleges/dispatches',
      { params }
    );
    return res.data;
  },
  getInventory: async (college?: string) => {
    const res = await api.get<{
      success: boolean;
      college: string;
      items: CollegeInventory[];
      totalProducts: number;
      totalUnits: number;
    }>('/colleges/inventory', { params: { college } });
    return res.data;
  },
  getColleges: async () => {
    const res = await api.get<{ success: boolean; colleges: string[] }>('/colleges/list');
    return res.data;
  },
};

export const auditApi = {
  getAll: async (params?: {
    action?: string;
    entityType?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await api.get<{ success: boolean; count: number; total: number; logs: AuditLog[] }>(
      '/audit-logs',
      { params }
    );
    return res.data;
  },
};

export const notificationApi = {
  getAll: async (unreadOnly: boolean = false) => {
    const res = await api.get<{ success: boolean; count: number; notifications: Notification[] }>(
      '/notifications',
      { params: { unreadOnly } }
    );
    return res.data;
  },
  markAsRead: async (id: string) => {
    const res = await api.patch<{ success: boolean }>(`/notifications/${id}/read`);
    return res.data;
  },
  markAllAsRead: async () => {
    const res = await api.post<{ success: boolean }>('/notifications/read-all');
    return res.data;
  },
};

export const searchApi = {
  globalSearch: async (q: string) => {
    const res = await api.get<{
      success: boolean;
      query: string;
      results: {
        products: Product[];
        orders: Order[];
        customers: Customer[];
        suppliers: Supplier[];
      };
    }>('/search', { params: { q } });
    return res.data;
  },
};

export const categoryApi = {
  getAll: async () => {
    const res = await api.get<{ success: boolean; count: number; categories: Category[] }>('/categories');
    return res.data;
  },
  create: async (data: { name: string; description?: string }) => {
    const res = await api.post<{ success: boolean; message: string; category: Category }>('/categories', data);
    return res.data;
  },
  update: async (id: string, data: Partial<Category>) => {
    const res = await api.put<{ success: boolean; message: string; category: Category }>(`/categories/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete<{ success: boolean; message: string }>(`/categories/${id}`);
    return res.data;
  },
};

export default api;
