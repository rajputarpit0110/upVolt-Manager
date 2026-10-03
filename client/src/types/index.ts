export type Role = 'MASTER_ADMIN' | 'MEMBER' | 'STAFF' | 'COLLEGE_MEMBER' | 'CAMPUS_EXECUTIVE';

export interface User {
  _id: string;
  userId: string;
  username: string;
  name: string;
  email: string;
  role: Role;
  college?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface CollegeDispatchItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost?: number;
  totalCost?: number;
}

export interface CollegeDispatch {
  _id: string;
  dispatchNumber: string;
  college: string;
  dispatchDate: string;
  items: CollegeDispatchItem[];
  totalUnits: number;
  totalCost?: number;
  dispatchedBy: string;
  status: 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';
  notes?: string;
  createdAt: string;
}

export interface CollegeInventory {
  _id: string;
  college: string;
  productId: string | any;
  productName: string;
  sku: string;
  currentStock: number;
  lastDispatchedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  _id: string;
  name: string;
  sku: string;
  category: string;
  description?: string;
  unit: string;
  sellingPrice: number;
  averageCost: number;
  currentStock: number;
  reservedStock: number;
  availableStock?: number;
  damagedStock: number;
  minStockLevel: number;
  location?: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryBatch {
  _id: string;
  batchNumber: string;
  productId: string | { _id: string; name: string; sku: string };
  purchaseId?: string;
  purchaseOrderNumber?: string;
  initialQuantity: number;
  remainingQuantity: number;
  costPrice: number;
  receivedDate: string;
  supplierId?: string | { _id: string; name: string };
  status: 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'QUARANTINED';
  notes?: string;
  createdAt: string;
}

export interface ProductPriceHistory {
  _id: string;
  productId: string;
  priceType: 'SELLING_PRICE' | 'COST_PRICE';
  oldPrice: number;
  newPrice: number;
  changedBy: string;
  reason: string;
  createdAt: string;
}

export type MovementType =
  | 'STOCK_RECEIVED'
  | 'SALE'
  | 'RETURN'
  | 'DAMAGE'
  | 'ADJUSTMENT'
  | 'RESERVATION'
  | 'RESERVATION_RELEASE'
  | 'ORDER_CANCEL'
  | 'ORDER_EDIT_DELTA'
  | 'MANUAL_CORRECTION'
  | 'COLLEGE_DISPATCH';

export interface StockMovement {
  _id: string;
  productId: { _id: string; name: string; sku: string } | string;
  movementType: MovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  previousReserved: number;
  newReserved: number;
  referenceType: 'PURCHASE' | 'ORDER' | 'RETURN' | 'ADJUSTMENT' | 'AUDIT' | 'COLLEGE_DISPATCH';
  referenceId: string;
  condition?: 'GOOD' | 'DAMAGED' | 'DEFECTIVE';
  costPrice?: number;
  sellingPrice?: number;
  performedBy: string;
  notes?: string;
  createdAt: string;
}

export interface PurchaseItem {
  productId: string | { _id: string; name: string; sku: string };
  productName: string;
  sku: string;
  quantity: number;
  costPrice: number;
  subtotal: number;
  totalCost?: number;
  batchNumber?: string;
}

export interface Purchase {
  _id: string;
  purchaseOrderNumber?: string;
  purchaseNumber?: string;
  purchaseDate: string;
  supplier?: {
    supplierId?: string;
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
  };
  supplierName?: string;
  items: PurchaseItem[];
  totalQuantity: number;
  totalAmount: number;
  status: 'Received' | 'Ordered' | 'Cancelled';
  paymentStatus?: 'Paid' | 'Partial' | 'Pending';
  invoiceNumber?: string;
  attachmentUrl?: string;
  receivedBy: string;
  notes?: string;
  createdAt: string;
}

export interface BatchAllocation {
  batchId: string;
  batchNumber: string;
  quantity: number;
  costPrice: number;
}

export interface OrderItem {
  productId: string | { _id: string; name: string; sku: string };
  productName: string;
  sku: string;
  quantity: number;
  sellingPrice: number;
  discount: number;
  revenue: number;
  cogs: number;
  profit: number;
  margin: number;
  batchAllocations: BatchAllocation[];
}

export type OrderStatus =
  | 'Draft'
  | 'Confirmed'
  | 'Processing'
  | 'Packed'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled'
  | 'Returned';

export type PaymentStatus = 'Pending' | 'Partial' | 'Paid' | 'Refunded';

export interface Order {
  _id: string;
  orderNumber: string;
  orderDate: string;
  status: OrderStatus;
  customer?: {
    customerId?: string;
    name: string;
    email?: string;
    phone?: string;
    college?: string;
    organization?: string;
    shippingAddress?: string;
  };
  items: OrderItem[];
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  totalAmount: number;
  totalCost?: number;
  totalProfit?: number;
  grossMargin?: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  amountPaid: number;
  amountDue: number;
  stockDeducted: boolean;
  stockReserved: boolean;
  deliveryInfo?: {
    customerName?: string;
    phone?: string;
    college?: string;
    deliveryDate?: string | Date;
    deliveredBy?: string;
    deliveryCharge?: number;
    notes?: string;
  };
  currentVersion: number;
  createdBy: string;
  updatedBy: string;
  isDeleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderVersion {
  _id: string;
  orderId: string;
  version: number;
  snapshot: any;
  diff: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  changedBy: string;
  changeReason: string;
  createdAt: string;
}

export interface OrderReturn {
  _id: string;
  orderId: string | { _id: string; orderNumber: string };
  orderNumber: string;
  items: {
    productId: string | { _id: string; name: string; sku: string };
    productName: string;
    sku: string;
    quantity: number;
    condition: 'GOOD' | 'DAMAGED' | 'DEFECTIVE';
    restocked: boolean;
    costPrice: number;
  }[];
  returnReason: string;
  returnDate: string;
  processedBy: string;
  notes?: string;
  createdAt: string;
}

export interface CustomerPurchasedItem {
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface CustomerOrderSummary {
  _id: string;
  orderNumber: string;
  orderDate: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  totalAmount: number;
  items: {
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    sellingPrice: number;
    revenue: number;
  }[];
}

export interface Customer {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  college?: string;
  category: 'Student' | 'Developer' | 'College/University' | 'Startup/Company' | 'Other';
  shippingAddress?: string;
  address?: string;
  city?: string;
  state?: string;
  totalOrders: number;
  totalSpent: number;
  orders?: CustomerOrderSummary[];
  purchasedItems?: CustomerPurchasedItem[];
  createdAt: string;
}

export interface Supplier {
  _id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
  categoriesSupplied: string[];
  totalPurchases: number;
  createdAt: string;
}

export interface AuditLog {
  _id: string;
  userId: string;
  userName: string;
  role: Role;
  action: string;
  entityType: string;
  entityId?: string;
  previousState?: any;
  newState?: any;
  reason?: string;
  relatedOrderId?: string;
  relatedStockMovementId?: string;
  ipAddress?: string;
  timestamp: string;
}

export interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'ORDER_CREATED' | 'SYSTEM' | 'ERROR';
  isRead: boolean;
  referenceId?: string;
  createdAt: string;
}

export interface DashboardSummary {
  kpi: {
    totalStockValue: number;
    totalUnitsInStock: number;
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
    todaySalesCount: number;
    todayRevenue: number;
    todayProfit: number;
    pendingOrdersCount: number;
  };
  lowStockItems: Product[];
  recentOrders: Order[];
  salesTrend: {
    _id: string;
    revenue: number;
    profit: number;
    ordersCount: number;
  }[];
  topProducts: {
    productId: string;
    productName: string;
    sku: string;
    totalQuantity: number;
    totalRevenue: number;
    totalProfit: number;
  }[];
}

export interface IntegrityCheckResult {
  passed: boolean;
  timestamp: string;
  summary: {
    productsChecked: number;
    batchesChecked: number;
    movementsChecked: number;
    ordersChecked: number;
    discrepancyCount: number;
  };
  discrepancies: {
    entityType: string;
    entityId: string;
    name?: string;
    orderNumber?: string;
    batchNumber?: string;
    issue: string;
    details: any;
  }[];
}

export interface DailyProductMovementBreakdown {
  productName: string;
  sku: string;
  received: number;
  sold: number;
  returned: number;
  damaged: number;
  adjusted: number;
  revenue: number;
  cost: number;
  profit: number;
}

export interface DailyActivityReport {
  date: string;
  stockReceived: { units: number; cost: number; count: number };
  stockSold: { units: number; count: number };
  stockReturned: { units: number; count: number };
  stockDamaged: { units: number; count: number };
  stockAdjusted: { units: number; count: number };
  financials: {
    revenue: number;
    cogs: number;
    profit: number;
    margin: number;
  };
  ordersCreatedCount: number;
  purchasesCount: number;
  priceChangesCount: number;
  productChangesCount: number;
  productBreakdown?: DailyProductMovementBreakdown[];
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  itemCount: number;
  status: 'Active' | 'Inactive';
  addedBy: string;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

