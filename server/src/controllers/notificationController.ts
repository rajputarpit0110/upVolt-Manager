import { Request, Response } from 'express';
import { Notification } from '../models/Notification';

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(30);
    const unreadCount = await Notification.countDocuments({ isRead: false });
    res.json({ success: true, notifications, unreadCount });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markNotificationRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      await Notification.updateMany({ isRead: false }, { $set: { isRead: true } });
      res.json({ success: true, message: 'All notifications marked as read.' });
      return;
    }

    await Notification.findByIdAndUpdate(id, { isRead: true });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
