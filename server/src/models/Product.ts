import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  sku: string;
  category: string;
  brand?: string;
  modelNumber?: string;
  description?: string;
  imageUrl?: string;
  supplier?: string;
  currentStock: number;   // Physical stock
  reservedStock: number;  // Reserved by Draft orders
  minStockLevel: number;  // Low stock alert threshold
  unit: string;           // pcs, meters, kits, etc.
  locationShelf?: string; // e.g. 'Shelf A-3, Bin 12'
  specifications?: Record<string, string>;
  tags?: string[];
  notes?: string;
  sellingPrice: number;
  averageCost: number;
  damagedStock: number;   // Damaged/inspection quarantine stock
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Computed virtual
  availableStock: number;
}

const ProductSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    category: { type: String, required: true, trim: true, index: true },
    brand: { type: String, trim: true },
    modelNumber: { type: String, trim: true },
    description: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    supplier: { type: String, trim: true },
    currentStock: { type: Number, default: 0, min: 0 },
    reservedStock: { type: Number, default: 0, min: 0 },
    minStockLevel: { type: Number, default: 10, min: 0 },
    unit: { type: String, default: 'pcs', trim: true },
    locationShelf: { type: String, trim: true },
    specifications: { type: Map, of: String },
    tags: [{ type: String, trim: true }],
    notes: { type: String, trim: true },
    sellingPrice: { type: Number, required: true, min: 0 },
    averageCost: { type: Number, default: 0, min: 0 },
    damagedStock: { type: Number, default: 0, min: 0 },
    isArchived: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Available Stock = currentStock - reservedStock
ProductSchema.virtual('availableStock').get(function (this: IProduct) {
  return Math.max(0, (this.currentStock || 0) - (this.reservedStock || 0));
});

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
