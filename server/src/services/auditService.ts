import { AuditLog } from '../models/AuditLog';

export interface IAuditEntry {
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
}

export async function createAuditLog(entry: IAuditEntry): Promise<void> {
  try {
    const log = new AuditLog(entry);
    await log.save();
  } catch (error) {
    console.error('[AuditService] Failed to create audit log:', error);
  }
}
