import mongoose, { Document, Schema } from 'mongoose';

export interface IPurchaseItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  costPrice: number;
  totalCost: number;
  batchNumber: string;
  storageLocation?: string;
}

export interface IPurchase extends Document {
  purchaseNumber: string; // e.g. PUR-202609-001
  supplierId?: mongoose.Types.ObjectId;
  supplierName?: string;
  invoiceNumber?: string;
  purchaseDate: Date;
  items: IPurchaseItem[];
  totalAmount: number;
  paymentStatus: 'PAID' | 'PENDING' | 'PARTIAL';
  notes?: string;
  attachmentUrl?: string;
  receivedBy: string; // userId
  isCancelled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseItemSchema: Schema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    costPrice: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    batchNumber: { type: String, required: true },
    storageLocation: { type: String, trim: true },
  },
  { _id: false }
);

const PurchaseSchema: Schema = new Schema(
  {
    purchaseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', index: true },
    supplierName: { type: String, trim: true },
    invoiceNumber: { type: String, trim: true, index: true },
    purchaseDate: { type: Date, default: Date.now, index: true },
    items: [PurchaseItemSchema],
    totalAmount: { type: Number, required: true, min: 0 },
    paymentStatus: {
      type: String,
      enum: ['PAID', 'PENDING', 'PARTIAL'],
      default: 'PAID',
    },
    notes: { type: String, trim: true },
    attachmentUrl: { type: String, trim: true },
    receivedBy: { type: String, required: true },
    isCancelled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Purchase = mongoose.model<IPurchase>('Purchase', PurchaseSchema);
