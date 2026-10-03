import mongoose, { Document, Schema } from 'mongoose';

export interface ISystemSetting extends Document {
  companyName: string;
  companyLogo?: string;
  currencySymbol: string;
  taxRatePercent: number;
  defaultLowStockThreshold: number;
  inventoryCostingMethod: 'FIFO' | 'AVERAGE';
  allowNegativeStock: boolean;
  reserveStockOnDraft: boolean;
  deadStockDays: number;
  updatedBy: string;
  updatedAt: Date;
}

const SystemSettingSchema: Schema = new Schema(
  {
    companyName: { type: String, default: 'UpVolt', trim: true },
    companyLogo: { type: String, trim: true },
    currencySymbol: { type: String, default: '₹', trim: true },
    taxRatePercent: { type: Number, default: 18, min: 0 },
    defaultLowStockThreshold: { type: Number, default: 10, min: 0 },
    inventoryCostingMethod: {
      type: String,
      enum: ['FIFO', 'AVERAGE'],
      default: 'FIFO',
    },
    allowNegativeStock: { type: Boolean, default: false },
    reserveStockOnDraft: { type: Boolean, default: true },
    deadStockDays: { type: Number, default: 30, min: 1 },
    updatedBy: { type: String, default: 'system' },
  },
  { timestamps: true }
);

export const SystemSetting = mongoose.model<ISystemSetting>(
  'SystemSetting',
  SystemSettingSchema
);
