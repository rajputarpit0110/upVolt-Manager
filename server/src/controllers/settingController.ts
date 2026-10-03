import { Request, Response } from 'express';
import { SystemSetting } from '../models/SystemSetting';
import { createAuditLog } from '../services/auditService';

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    let setting = await SystemSetting.findOne();
    if (!setting) {
      setting = new SystemSetting();
      await setting.save();
    }
    res.json({ success: true, setting });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    let setting = await SystemSetting.findOne();
    if (!setting) {
      setting = new SystemSetting();
    }

    const previous = setting.toObject();
    Object.assign(setting, req.body);
    setting.updatedBy = req.user?.userId || 'system';
    await setting.save();

    await createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.name,
      role: req.user!.role,
      action: 'UPDATE_SETTINGS',
      entityType: 'SYSTEM_SETTING',
      entityId: setting._id.toString(),
      previousState: previous,
      newState: setting.toObject(),
      ip: req.ip,
    });

    res.json({ success: true, setting });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
