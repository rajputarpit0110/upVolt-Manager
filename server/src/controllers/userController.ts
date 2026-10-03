import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { createAuditLog } from '../services/auditService';

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, name, temporaryPassword, role, college, email, phone, department, notes } = req.body;

    if (!userId || !name || !temporaryPassword || !role) {
      res.status(400).json({
        success: false,
        message: 'Full Name, permanent User ID, Temporary Password, and Role are required.',
      });
      return;
    }

    if (role === 'COLLEGE_MEMBER' && (!college || !college.trim())) {
      res.status(400).json({
        success: false,
        message: 'College is required for College Member accounts.',
      });
      return;
    }

    if (role === 'MASTER_ADMIN' && req.user?.role !== 'MASTER_ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Only existing Master Admins can create another Master Admin.',
      });
      return;
    }

    const cleanUserId = userId.toLowerCase().trim();

    const existing = await User.findOne({ userId: cleanUserId });
    if (existing) {
      res.status(400).json({ success: false, message: `User ID "${cleanUserId}" already exists.` });
      return;
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const userRole =
      role === 'MASTER_ADMIN'
        ? 'MASTER_ADMIN'
        : role === 'COLLEGE_MEMBER'
        ? 'COLLEGE_MEMBER'
        : role === 'CAMPUS_EXECUTIVE'
        ? 'CAMPUS_EXECUTIVE'
        : 'STAFF';

    const user = new User({
      userId: cleanUserId,
      name: name.trim(),
      passwordHash,
      role: userRole,
      college: (role === 'COLLEGE_MEMBER' || role === 'CAMPUS_EXECUTIVE') && college ? college.trim() : undefined,
      email: email?.trim(),
      phone: phone?.trim(),
      department: department?.trim(),
      notes: notes?.trim(),
      isActive: true,
      forcePasswordChange: true,
    });

    await user.save();

    await createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.name,
      role: req.user!.role,
      action: userRole === 'MASTER_ADMIN' ? 'CREATE_MASTER_ADMIN' : 'CREATE_USER',
      entityType: 'USER',
      entityId: user._id.toString(),
      newState: { userId: user.userId, name: user.name, role: user.role, college: user.college },
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      message: `User ${user.userId} (${user.role}) created successfully.`,
      user: {
        userId: user.userId,
        name: user.name,
        role: user.role,
        college: user.college,
        email: user.email,
        phone: user.phone,
        department: user.department,
        isActive: user.isActive,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleUserStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    if (user.userId === req.user?.userId) {
      res.status(400).json({ success: false, message: 'Master Admin cannot deactivate their own account.' });
      return;
    }

    user.isActive = !user.isActive;
    await user.save();

    await createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.name,
      role: req.user!.role,
      action: user.isActive ? 'ENABLE_USER' : 'DISABLE_USER',
      entityType: 'USER',
      entityId: user._id.toString(),
      newState: { isActive: user.isActive },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `User ${user.userId} has been ${user.isActive ? 'activated' : 'deactivated'}.`,
      user: { userId: user.userId, isActive: user.isActive },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
