import axios from 'axios';
import { apiCache, CacheOptions } from './cache';
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
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 45000,
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

// Response interceptor: capture error message & invalidate cache on mutations
api.interceptors.response.use(
  (response) => {
    const method = (response.config.method || '').toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      apiCache.handleMutation(response.config.url || '');
    }
    return response;
  },
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

/**
 * Universal cached GET helper with request deduplication and configurable TTL
 */
export const cachedGet = async <T>(
  url: string,
  params?: any,
  options?: CacheOptions
): Promise<T> => {
  const key = options?.cacheKey || apiCache.generateKey(url, params);
  return apiCache.fetchWithCache<T>(
    key,
    async () => {
      const res = await api.get<T>(url, { params });
      return res.data;
    },
    options
  );
};

export const authApi = {
  login: async (credentials: { username?: string; email?: string; password: string }) => {
    const res = await api.post<{ success: boolean; token: string; user: User }>('/auth/login', credentials);
    apiCache.clear(); // Clear all cache on new login
    return res.data;
  },
  getMe: async (options?: CacheOptions) => {
    return cachedGet<{ success: boolean; user: User }>('/auth/me', undefined, options);
  },
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const res = await api.post<{ success: boolean; message: string }>('/auth/change-password', data);
    return res.data;
  },
};

export const productApi = {
  getAll: async (
    params?: { category?: string; search?: string; lowStock?: boolean; outOfStock?: boolean },
    options?: CacheOptions
  ) => {
    return cachedGet<{ success: boolean; count: number; products: Product[] }>('/products', params, options);
  },
  getById: async (id: string, options?: CacheOptions) => {
    return cachedGet<{ success: boolean; product: Product }>('/products/' + id, undefined, options);
  },
  create: async (data: Partial<Product> & Record<string, any>) => {
    const res = await api.post<{ success: boolean; product: Product }>('/products', data);
    return res.data;
  },
  update: async (id: string, data: Partial<Product> & { priceChangeReason?: string }) => {
    const res = await api.put<{ success: boolean; product: Product }>('/products/' + id, data);
    return res.data;
  },
  getPriceHistory: async (id: string, options?: CacheOptions) => {
    return cachedGet<{ success: boolean; count: number; history: ProductPriceHistory[] }>(
      `/products/${id}/price-history`,
      undefined,
      options
    );
  },
  getBatches: async (id: string, options?: CacheOptions) => {
    return cachedGet<{ success: boolean; count: number; batches: InventoryBatch[] }>(
      `/products/${id}/batches`,
      undefined,
      options
    );
  },
  getLedger: async (id: string, options?: CacheOptions) => {
    return cachedGet<{ success: boolean; count: number; ledger: any[] }>(
      `/products/${id}/ledger`,
      undefined,
      options
    );
  },
};

export const purchaseApi = {
  getAll: async (
    params?: { search?: string; startDate?: string; endDate?: string; page?: number; limit?: number },
    options?: CacheOptions
  ) => {
    return cachedGet<{ success: boolean; count: number; total: number; purchases: Purchase[] }>(
      '/purchases',
      params,
      options
    );
  },
  getById: async (id: string, options?: CacheOptions) => {
    return cachedGet<{ success: boolean; purchase: Purchase }>('/purchases/' + id, undefined, options);
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
  getAll: async (
    params?: {
      status?: string;
      paymentStatus?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
    options?: CacheOptions
  ) => {
    return cachedGet<{ success: boolean; count: number; total: number; orders: Order[] }>(
      '/orders',
      params,
      options
    );
  },
  getById: async (id: string, options?: CacheOptions) => {
    return cachedGet<{ success: boolean; order: Order; versions: OrderVersion[]; returns: OrderReturn[] }>(
      '/orders/' + id,
      undefined,
      options
    );
  },
  create: async (data: {
    customer?: any;
    items: { productId: string; quantity: number; sellingPrice: number; discount?: number }[];
    status?: 'Draft' | 'Confirmed' | 'Delivered' | 'Processing';
    paymentStatus?: string;
    paymentMethod?: string;
    amountPaid?: number;
    deliveryCharge?: number;
    notes?: string;
    idempotencyKey?: string;
    deliveryInfo?: any;
    college?: string;
    source?: 'Website' | 'Direct' | 'Manual';
    webOrderNumber?: string;
    assignedAgentUserId?: string;
    orderDate?: string | Date;
  }) => {
    const res = await api.post<{ success: boolean; order: Order }>('/orders', data);
    return res.data;
  },
  assignAgent: async (orderId: string, agentUserId: string | null) => {
    const res = await api.patch<{ success: boolean; message: string; order: Order }>(
      `/orders/${orderId}/assign`,
      { agentUserId }
    );
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
  getTrash: async (options?: CacheOptions) => {
    return cachedGet<{ success: boolean; count: number; orders: Order[] }>('/orders/trash/all', undefined, options);
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
  getVersions: async (id: string, options?: CacheOptions) => {
    return cachedGet<{ success: boolean; count: number; versions: OrderVersion[] }>(
      `/orders/${id}/versions`,
      undefined,
      options
    );
  },
};

export const inventoryApi = {
  getMovements: async (
    params?: {
      productId?: string;
      movementType?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
    options?: CacheOptions
  ) => {
    return cachedGet<{ success: boolean; count: number; total: number; movements: StockMovement[] }>(
      '/inventory/movements',
      params,
      options
    );
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
    params?: { timeRange?: string; range?: string; startDate?: string; endDate?: string } | string,
    options?: CacheOptions
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
    return cachedGet<{ success: boolean; data: DashboardSummary }>('/reports/dashboard', queryParams, options);
  },
  getIntegrityCheck: async (options?: CacheOptions) => {
    return cachedGet<{ success: boolean; result: IntegrityCheckResult }>('/reports/integrity-check', undefined, options);
  },
  reconcileIntegrity: async () => {
    const res = await api.post<{ success: boolean; outcome: any; result: IntegrityCheckResult }>('/reports/reconcile');
    return res.data;
  },
  getDailyActivity: async (date?: string, options?: CacheOptions) => {
    return cachedGet<{ success: boolean; report: DailyActivityReport }>('/reports/daily-activity', { date }, options);
  },
  exportCsv: async (
    entity: string,
    params?: { range?: string; startDate?: string; endDate?: string; format?: string }
  ) => {
    const res = await api.get(`/reports/export/${entity}`, {
      params,
      responseType: 'blob',
    });
    return res.data;
  },
};

export const customerApi = {
  getAll: async (params?: { search?: string; category?: string }, options?: CacheOptions) => {
    return cachedGet<{ success: boolean; count: number; customers: Customer[] }>('/customers', params, options);
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
  getAll: async (params?: { search?: string }, options?: CacheOptions) => {
    return cachedGet<{ success: boolean; count: number; suppliers: Supplier[] }>('/suppliers', params, options);
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
  getAll: async (options?: CacheOptions) => {
    return cachedGet<{ success: boolean; count: number; users: User[] }>('/users', undefined, options);
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
  delete: async (id: string) => {
    const res = await api.delete<{ success: boolean; message: string }>('/users/' + id);
    return res.data;
  },
};

export const collegeApi = {
  createDispatch: async (data: {
    college: string;
    collegeExecutive?: string;
    deliveryAgent?: string;
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
  getDispatches: async (
    params?: { college?: string; startDate?: string; endDate?: string },
    options?: CacheOptions
  ) => {
    return cachedGet<{ success: boolean; dispatches: CollegeDispatch[] }>(
      '/colleges/dispatches',
      params,
      options
    );
  },
  getInventory: async (college?: string, options?: CacheOptions) => {
    return cachedGet<{
      success: boolean;
      college: string;
      items: CollegeInventory[];
      totalProducts: number;
      totalUnits: number;
    }>('/colleges/inventory', { college }, options);
  },
  getColleges: async (options?: CacheOptions) => {
    return cachedGet<{ success: boolean; colleges: string[] }>('/colleges/list', undefined, options);
  },
  getTeam: async (college?: string, options?: CacheOptions) => {
    return cachedGet<{
      success: boolean;
      executives: User[];
      deliveryAgents: User[];
      all: User[];
    }>('/colleges/team', { college }, options);
  },
};

export const auditApi = {
  getAll: async (
    params?: {
      action?: string;
      entityType?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
    options?: CacheOptions
  ) => {
    return cachedGet<{ success: boolean; count: number; total: number; logs: AuditLog[] }>(
      '/audit-logs',
      params,
      options
    );
  },
};

export const notificationApi = {
  getAll: async (unreadOnly: boolean = false, options?: CacheOptions) => {
    return cachedGet<{ success: boolean; count: number; notifications: Notification[] }>(
      '/notifications',
      { unreadOnly },
      options
    );
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
  globalSearch: async (q: string, options?: CacheOptions) => {
    return cachedGet<{
      success: boolean;
      query: string;
      results: {
        products: Product[];
        orders: Order[];
        customers: Customer[];
        suppliers: Supplier[];
      };
    }>('/search', { q }, options);
  },
};

export const categoryApi = {
  getAll: async (options?: CacheOptions) => {
    return cachedGet<{ success: boolean; count: number; categories: Category[] }>('/categories', undefined, options);
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

export { apiCache };
export default api;
