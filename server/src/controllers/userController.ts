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

    const requesterRole = req.user?.role;

    // Permissions check: Members/Staff can only create College Executives or Campus Distributive Agents
    if (requesterRole !== 'MASTER_ADMIN') {
      if (role !== 'COLLEGE_MEMBER' && role !== 'CAMPUS_EXECUTIVE') {
        res.status(403).json({
          success: false,
          message: 'Members are only authorized to create College Executives and Distributive Agents.',
        });
        return;
      }
    }

    // Mandatory college selection for College Executive and Distributive Agent
    if ((role === 'COLLEGE_MEMBER' || role === 'CAMPUS_EXECUTIVE') && (!college || !college.trim())) {
      res.status(400).json({
        success: false,
        message: 'Target college is required when creating a College Executive or Distributive Agent.',
      });
      return;
    }

    if (role === 'MASTER_ADMIN' && requesterRole !== 'MASTER_ADMIN') {
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
        : 'MEMBER';

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
      res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
      return;
    }

    // Members can only manage College Executives and Distributive Agents
    if (req.user?.role !== 'MASTER_ADMIN') {
      if (user.role !== 'COLLEGE_MEMBER' && user.role !== 'CAMPUS_EXECUTIVE') {
        res.status(403).json({
          success: false,
          message: 'Members are only authorized to manage College Executives and Distributive Agents.',
        });
        return;
      }
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

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    if (req.user?.role !== 'MASTER_ADMIN') {
      if (user.role !== 'COLLEGE_MEMBER' && user.role !== 'CAMPUS_EXECUTIVE') {
        res.status(403).json({
          success: false,
          message: 'Members are only authorized to manage College Executives and Distributive Agents.',
        });
        return;
      }
    }

    const { isActive, name, email, phone, college, role, department, notes } = req.body;
    if (typeof isActive === 'boolean') {
      if (user.userId === req.user?.userId && !isActive) {
        res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
        return;
      }
      user.isActive = isActive;
    }
    if (name) user.name = name.trim();
    if (email !== undefined) user.email = email.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (department !== undefined) user.department = department.trim();
    if (notes !== undefined) user.notes = notes.trim();

    // Role changes are restricted strictly to MASTER_ADMIN
    if (role && role !== user.role) {
      if (req.user?.role !== 'MASTER_ADMIN') {
        res.status(403).json({ success: false, message: 'Only Master Admins can modify user roles.' });
        return;
      }

      // Safety check: Prevent changing self role away from MASTER_ADMIN if they are the only Master Admin
      if (user.userId === req.user?.userId && role !== 'MASTER_ADMIN') {
        const masterAdminCount = await User.countDocuments({ role: 'MASTER_ADMIN', isActive: true });
        if (masterAdminCount <= 1) {
          res.status(400).json({
            success: false,
            message: 'Cannot demote the only active Master Admin account.',
          });
          return;
        }
      }

      user.role = role;
    }

    // College assignment logic
    if (college !== undefined) {
      user.college = college.trim() ? college.trim() : undefined;
    }

    // Validate college requirement for College Member and Campus Executive
    if (
      (user.role === 'COLLEGE_MEMBER' || user.role === 'CAMPUS_EXECUTIVE') &&
      (!user.college || !user.college.trim())
    ) {
      res.status(400).json({
        success: false,
        message: 'A college campus is required for College Executives and Campus Distributive Agents.',
      });
      return;
    }

    await user.save();

    await createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.name,
      role: req.user!.role,
      action: 'UPDATE_USER',
      entityType: 'USER',
      entityId: user._id.toString(),
      newState: {
        userId: user.userId,
        isActive: user.isActive,
        name: user.name,
        role: user.role,
        college: user.college,
        email: user.email,
        phone: user.phone,
        department: user.department,
      },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `User ${user.userId} updated successfully.`,
      user,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    // Safeguard 1: Master Admin cannot delete their own account
    if (user.userId === req.user?.userId) {
      res.status(400).json({
        success: false,
        message: 'You cannot delete your own account.',
      });
      return;
    }

    // Safeguard 2: Ensure at least one active Master Admin remains
    if (user.role === 'MASTER_ADMIN') {
      const masterAdminCount = await User.countDocuments({ role: 'MASTER_ADMIN' });
      if (masterAdminCount <= 1) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete the only Master Admin account in the system.',
        });
        return;
      }
    }

    await User.findByIdAndDelete(id);

    await createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.name,
      role: req.user!.role,
      action: 'DELETE_USER',
      entityType: 'USER',
      entityId: user._id.toString(),
      previousState: {
        userId: user.userId,
        name: user.name,
        role: user.role,
        college: user.college,
        email: user.email,
      },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `User ${user.name} (@${user.userId}) deleted successfully.`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    if (req.user?.role !== 'MASTER_ADMIN') {
      if (user.role !== 'COLLEGE_MEMBER' && user.role !== 'CAMPUS_EXECUTIVE') {
        res.status(403).json({
          success: false,
          message: 'Members can only reset passwords for College Executives and Distributive Agents.',
        });
        return;
      }
    }

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
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
      newState: { userId: user.userId },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Password for ${user.userId} has been reset successfully.`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
