import mongoose, { Document, Schema } from 'mongoose';

export interface ICollegeInventory extends Document {
  college: string;
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  currentStock: number;
  lastDispatchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CollegeInventorySchema: Schema = new Schema(
  {
    college: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    currentStock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lastDispatchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound unique index ensuring one stock counter per product per college
CollegeInventorySchema.index({ college: 1, productId: 1 }, { unique: true });

export const CollegeInventory = mongoose.model<ICollegeInventory>('CollegeInventory', CollegeInventorySchema);
