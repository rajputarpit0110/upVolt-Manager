import mongoose, { Document, Schema } from 'mongoose';

export interface ICollegeDispatchItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface ICollegeDispatch extends Document {
  dispatchNumber: string; // e.g. DISP-202609-0001
  college: string;
  dispatchDate: Date;
  items: ICollegeDispatchItem[];
  totalUnits: number;
  totalCost: number;
  dispatchedBy: string; // userId e.g. 'admin' or 'rahul'
  status: 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CollegeDispatchItemSchema: Schema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const CollegeDispatchSchema: Schema = new Schema(
  {
    dispatchNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    college: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    dispatchDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    items: [CollegeDispatchItemSchema],
    totalUnits: {
      type: Number,
      required: true,
      min: 1,
    },
    totalCost: {
      type: Number,
      required: true,
      min: 0,
    },
    dispatchedBy: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['DISPATCHED', 'RECEIVED', 'CANCELLED'],
      default: 'DISPATCHED',
      required: true,
      index: true,
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

export const CollegeDispatch = mongoose.model<ICollegeDispatch>('CollegeDispatch', CollegeDispatchSchema);
