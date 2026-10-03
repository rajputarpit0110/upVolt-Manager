import mongoose, { Document, Schema } from 'mongoose';

export type BatchStatus = 'ACTIVE' | 'EXHAUSTED' | 'CANCELLED';

export interface IInventoryBatch extends Document {
  batchNumber: string;
  productId: mongoose.Types.ObjectId;
  supplierId?: mongoose.Types.ObjectId;
  purchaseId?: string;
  costPrice: number;        // Immutable cost per unit
  initialQuantity: number;  // Units originally received
  remainingQuantity: number;// Units available for FIFO allocation
  storageLocation?: string; // Bin / Shelf
  receivedDate: Date;
  notes?: string;
  status: BatchStatus;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryBatchSchema: Schema = new Schema(
  {
    batchNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      index: true,
    },
    purchaseId: {
      type: String,
      trim: true,
      index: true,
    },
    costPrice: {
      type: Number,
      required: true,
      min: 0,
      immutable: true, // Never overwrite cost price of an existing batch!
    },
    initialQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    remainingQuantity: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },
    storageLocation: { type: String, trim: true },
    receivedDate: { type: Date, default: Date.now, index: true },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXHAUSTED', 'CANCELLED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  { timestamps: true }
);

export const InventoryBatch = mongoose.model<IInventoryBatch>(
  'InventoryBatch',
  InventoryBatchSchema
);
