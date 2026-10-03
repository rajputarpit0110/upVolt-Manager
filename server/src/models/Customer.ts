import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  college?: string; // College / Organization
  organization?: string;
  category?: string;
  city?: string;
  state?: string;
  pincode?: string;
  notes?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: Date;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true, index: true },
    address: { type: String, trim: true },
    college: { type: String, trim: true, index: true },
    organization: { type: String, trim: true, index: true },
    category: { type: String, trim: true, default: 'Student' },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    notes: { type: String, trim: true },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastOrderDate: { type: Date },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);
