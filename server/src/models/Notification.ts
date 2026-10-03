import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType =
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'NEW_ORDER'
  | 'ORDER_DELIVERED'
  | 'STOCK_RECEIVED'
  | 'RETURN'
  | 'INTEGRITY_ALERT';

export interface INotification extends Document {
  title: string;
  message: string;
  type: NotificationType;
  referenceId?: string;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'LOW_STOCK',
        'OUT_OF_STOCK',
        'NEW_ORDER',
        'ORDER_DELIVERED',
        'STOCK_RECEIVED',
        'RETURN',
        'INTEGRITY_ALERT',
      ],
      required: true,
      index: true,
    },
    referenceId: { type: String },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Notification = mongoose.model<INotification>(
  'Notification',
  NotificationSchema
);
