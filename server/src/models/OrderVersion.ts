import mongoose, { Document, Schema } from 'mongoose';

export interface IFieldDiff {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface IOrderVersion extends Document {
  orderId: mongoose.Types.ObjectId;
  version: number;
  snapshot: any; // Full JSON representation of order
  diff: IFieldDiff[];
  changedBy: string; // userId
  changeReason?: string;
  createdAt: Date;
}

const FieldDiffSchema: Schema = new Schema(
  {
    field: { type: String, required: true },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const OrderVersionSchema: Schema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    version: { type: Number, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    diff: [FieldDiffSchema],
    changedBy: { type: String, required: true },
    changeReason: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

OrderVersionSchema.index({ orderId: 1, version: 1 }, { unique: true });

export const OrderVersion = mongoose.model<IOrderVersion>(
  'OrderVersion',
  OrderVersionSchema
);
