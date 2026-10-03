import mongoose, { Document, Schema } from 'mongoose';

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
export type PaymentMethod = 'Cash' | 'UPI' | 'Bank Transfer' | 'Card' | 'Other';

export interface IBatchAllocation {
  batchId: mongoose.Types.ObjectId;
  batchNumber: string;
  quantity: number;
  costPrice: number;
}

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  sellingPrice: number;
  discount: number;
  revenue: number;
  cogs: number;
  profit: number;
  margin: number;
  batchAllocations: IBatchAllocation[];
}

export interface IDeliveryInfo {
  customerName?: string;
  phone?: string;
  email?: string;
  address?: string;
  college?: string;
  city?: string;
  state?: string;
  pincode?: string;
  deliveryDate?: Date;
  deliveredBy?: string;
  deliveryCharge?: number;
  trackingNumber?: string;
  notes?: string;
}

export interface IOrder extends Document {
  orderNumber: string;
  orderDate: Date;
  status: OrderStatus;
  customer?: {
    customerId?: mongoose.Types.ObjectId;
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    college?: string;
    city?: string;
    state?: string;
    pincode?: string;
    notes?: string;
  };
  items: IOrderItem[];
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  totalAmount: number; // Revenue
  totalCost: number;   // Total COGS
  totalProfit: number;
  grossMargin: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  amountDue: number;
  stockDeducted: boolean;
  stockReserved: boolean;
  deliveryInfo?: IDeliveryInfo;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  deleteReason?: string;
  currentVersion: number;
  createdBy: string;
  updatedBy: string;
  idempotencyKey?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BatchAllocationSchema: Schema = new Schema(
  {
    batchId: { type: Schema.Types.ObjectId, ref: 'InventoryBatch', required: true },
    batchNumber: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    costPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const OrderItemSchema: Schema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    sellingPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    revenue: { type: Number, required: true },
    cogs: { type: Number, required: true, default: 0 },
    profit: { type: Number, required: true, default: 0 },
    margin: { type: Number, default: 0 },
    batchAllocations: [BatchAllocationSchema],
  },
  { _id: false }
);

const OrderSchema: Schema = new Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    orderDate: { type: Date, default: Date.now, index: true },
    status: {
      type: String,
      enum: [
        'Draft',
        'Confirmed',
        'Processing',
        'Packed',
        'Shipped',
        'Delivered',
        'Cancelled',
        'Returned',
      ],
      default: 'Confirmed',
      index: true,
    },
    customer: {
      customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
      name: { type: String, trim: true },
      phone: { type: String, trim: true, index: true },
      email: { type: String, trim: true },
      address: { type: String, trim: true },
      college: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true },
      notes: { type: String, trim: true },
    },
    items: [OrderItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    deliveryCharge: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, default: 0 },
    totalProfit: { type: Number, required: true, default: 0 },
    grossMargin: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Partial', 'Paid', 'Refunded'],
      default: 'Pending',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other'],
      default: 'UPI',
    },
    amountPaid: { type: Number, default: 0, min: 0 },
    amountDue: { type: Number, default: 0, min: 0 },
    stockDeducted: { type: Boolean, default: false },
    stockReserved: { type: Boolean, default: false },
    deliveryInfo: {
      customerName: { type: String, trim: true },
      phone: { type: String, trim: true },
      email: { type: String, trim: true },
      address: { type: String, trim: true },
      college: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true },
      deliveryDate: { type: Date },
      deliveredBy: { type: String, trim: true },
      trackingNumber: { type: String, trim: true },
      notes: { type: String, trim: true },
    },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: String },
    deleteReason: { type: String, trim: true },
    currentVersion: { type: Number, default: 1 },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    idempotencyKey: { type: String, unique: true, sparse: true, index: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
