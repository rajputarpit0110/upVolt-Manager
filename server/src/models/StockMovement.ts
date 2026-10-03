import mongoose, { Document, Schema } from 'mongoose';

export type MovementType =
  | 'STOCK_RECEIVED'
  | 'SALE'
  | 'RETURN'
  | 'DAMAGE'
  | 'ADJUSTMENT'
  | 'TRANSFER'
  | 'COLLEGE_DISPATCH'
  | 'MANUAL_CORRECTION'
  | 'ORDER_EDIT_DELTA'
  | 'ORDER_CANCEL'
  | 'RESERVATION_HOLD'
  | 'RESERVATION_RELEASE';

export interface IStockMovement extends Document {
  productId: mongoose.Types.ObjectId;
  batchId?: mongoose.Types.ObjectId;
  movementType: MovementType;
  quantity: number; // Signed: + for incoming/restoration, - for sale/damage deduction
  previousStock: number;
  newStock: number;
  previousReserved?: number;
  newReserved?: number;
  referenceType?: 'PURCHASE' | 'ORDER' | 'RETURN' | 'ADJUSTMENT' | 'AUDIT' | 'COLLEGE_DISPATCH';
  referenceId?: string; // e.g. orderId or purchaseId or 'ADJ-101'
  costPrice?: number;
  sellingPrice?: number;
  condition?: 'GOOD' | 'DAMAGED' | 'DEFECTIVE';
  performedBy: string; // userId e.g. 'admin' or 'rahul'
  notes?: string;
  createdAt: Date;
}

const StockMovementSchema: Schema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryBatch',
      index: true,
    },
    movementType: {
      type: String,
      required: true,
      enum: [
        'STOCK_RECEIVED',
        'SALE',
        'RETURN',
        'DAMAGE',
        'ADJUSTMENT',
        'TRANSFER',
        'COLLEGE_DISPATCH',
        'MANUAL_CORRECTION',
        'ORDER_EDIT_DELTA',
        'ORDER_CANCEL',
        'RESERVATION_HOLD',
        'RESERVATION_RELEASE',
      ],
      index: true,
    },
    quantity: { type: Number, required: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    previousReserved: { type: Number, default: 0 },
    newReserved: { type: Number, default: 0 },
    referenceType: {
      type: String,
      enum: ['PURCHASE', 'ORDER', 'RETURN', 'ADJUSTMENT', 'AUDIT', 'COLLEGE_DISPATCH'],
      index: true,
    },
    referenceId: { type: String, trim: true, index: true },
    costPrice: { type: Number },
    sellingPrice: { type: Number },
    condition: {
      type: String,
      enum: ['GOOD', 'DAMAGED', 'DEFECTIVE'],
      default: 'GOOD',
    },
    performedBy: { type: String, required: true, index: true },
    notes: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const StockMovement = mongoose.model<IStockMovement>(
  'StockMovement',
  StockMovementSchema
);
