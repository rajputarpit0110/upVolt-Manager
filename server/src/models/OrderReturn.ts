import mongoose, { Document, Schema } from 'mongoose';

export interface IReturnItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  condition: 'GOOD' | 'DAMAGED' | 'DEFECTIVE';
  restockDecision: 'RESTOCKED_SELLABLE' | 'QUARANTINED_DAMAGED';
  originalBatchId?: mongoose.Types.ObjectId;
  originalCostPrice: number;
  refundAmount: number;
}

export interface IOrderReturn extends Document {
  returnNumber: string; // e.g. RET-202609-001
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  items: IReturnItem[];
  reason: string;
  conditionNotes?: string;
  processedBy: string; // userId
  returnDate: Date;
  totalRefundAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReturnItemSchema: Schema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    condition: {
      type: String,
      enum: ['GOOD', 'DAMAGED', 'DEFECTIVE'],
      required: true,
    },
    restockDecision: {
      type: String,
      enum: ['RESTOCKED_SELLABLE', 'QUARANTINED_DAMAGED'],
      required: true,
    },
    originalBatchId: { type: Schema.Types.ObjectId, ref: 'InventoryBatch' },
    originalCostPrice: { type: Number, required: true, min: 0 },
    refundAmount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const OrderReturnSchema: Schema = new Schema(
  {
    returnNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderNumber: { type: String, required: true, trim: true },
    items: [ReturnItemSchema],
    reason: { type: String, required: true, trim: true },
    conditionNotes: { type: String, trim: true },
    processedBy: { type: String, required: true },
    returnDate: { type: Date, default: Date.now, index: true },
    totalRefundAmount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export const OrderReturn = mongoose.model<IOrderReturn>(
  'OrderReturn',
  OrderReturnSchema
);
