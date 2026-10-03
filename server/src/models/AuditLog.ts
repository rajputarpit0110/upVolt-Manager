import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  userId: string;
  userName: string;
  role: string;
  action: string;
  entityType: string;
  entityId: string;
  previousState?: any;
  newState?: any;
  reason?: string;
  relatedOrderId?: string;
  relatedStockMovementId?: string;
  ip?: string;
  createdAt: Date;
}

const AuditLogSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    role: { type: String, required: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    previousState: { type: Schema.Types.Mixed },
    newState: { type: Schema.Types.Mixed },
    reason: { type: String, trim: true },
    relatedOrderId: { type: String, trim: true, index: true },
    relatedStockMovementId: { type: String, trim: true, index: true },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
