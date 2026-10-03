import { Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog';

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { action, entityType, userId, page = '1', limit = '50' } = req.query;
    const query: any = {};

    if (action) query.action = action;
    if (entityType) query.entityType = entityType;
    if (userId) query.userId = userId;

    const skip = (parseInt(String(page)) - 1) * parseInt(String(limit));
    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(String(limit)));

    res.json({
      success: true,
      logs,
      pagination: {
        total,
        page: parseInt(String(page)),
        pages: Math.ceil(total / parseInt(String(limit))),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
