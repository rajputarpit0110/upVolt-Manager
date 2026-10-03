import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { signUserToken } from '../middlewares/auth';
import { createAuditLog } from '../services/auditService';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const inputId = req.body.userId || req.body.username || req.body.email;
    const { password } = req.body;

    if (!inputId || !password) {
      res.status(400).json({ success: false, message: 'Username/Email and password are required.' });
      return;
    }

    const cleanId = inputId.toLowerCase().trim();
    const user = await User.findOne({
      $or: [{ userId: cleanId }, { email: cleanId }],
    });
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'Account is deactivated. Please contact Master Admin.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid credentials.' });
      return;
    }

    const token = signUserToken(user);

    await createAuditLog({
      userId: user.userId,
      userName: user.name,
      role: user.role,
      action: 'LOGIN',
      entityType: 'USER',
      entityId: user._id.toString(),
      ip: req.ip,
    });

    res.json({
      success: true,
      token,
      user: {
        userId: user.userId,
        name: user.name,
        role: user.role,
        college: user.college,
        email: user.email,
        phone: user.phone,
        department: user.department,
        forcePasswordChange: user.forcePasswordChange,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const user = await User.findOne({ userId: req.user.userId }).select('-passwordHash');
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, message: 'Current and new password are required.' });
      return;
    }

    const user = await User.findOne({ userId: req.user?.userId });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ success: false, message: 'Current password does not match.' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
      return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.forcePasswordChange = false;
    await user.save();

    await createAuditLog({
      userId: user.userId,
      userName: user.name,
      role: user.role,
      action: 'CHANGE_PASSWORD',
      entityType: 'USER',
      entityId: user._id.toString(),
      ip: req.ip,
    });

    res.json({ success: true, message: 'Password updated successfully. User ID remains unchanged.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resetUserPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetUserId, newPassword } = req.body;
    if (!targetUserId || !newPassword) {
      res.status(400).json({ success: false, message: 'Target User ID and new password are required.' });
      return;
    }

    const user = await User.findOne({ userId: targetUserId.toLowerCase().trim() });
    if (!user) {
      res.status(404).json({ success: false, message: 'Target user not found.' });
      return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.forcePasswordChange = true;
    await user.save();

    await createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.name,
      role: req.user!.role,
      action: 'RESET_PASSWORD',
      entityType: 'USER',
      entityId: user._id.toString(),
      reason: `Password reset for user ${user.userId}`,
      ip: req.ip,
    });

    res.json({ success: true, message: `Password for ${user.userId} has been reset successfully.` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
