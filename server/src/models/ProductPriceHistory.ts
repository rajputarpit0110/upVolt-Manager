import mongoose, { Document, Schema } from 'mongoose';

export type PriceChangeType = 'SELLING_PRICE' | 'COST_PRICE';

export interface IProductPriceHistory extends Document {
  productId: mongoose.Types.ObjectId;
  type: PriceChangeType;
  oldPrice: number;
  newPrice: number;
  changedBy: string; // userId
  reason?: string;
  createdAt: Date;
}

const ProductPriceHistorySchema: Schema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    type: { type: String, enum: ['SELLING_PRICE', 'COST_PRICE'], required: true },
    oldPrice: { type: Number, required: true },
    newPrice: { type: Number, required: true },
    changedBy: { type: String, required: true },
    reason: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ProductPriceHistory = mongoose.model<IProductPriceHistory>(
  'ProductPriceHistory',
  ProductPriceHistorySchema
);
