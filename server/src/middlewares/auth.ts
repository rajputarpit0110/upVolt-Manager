import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';

export interface AuthUserPayload {
  userId: string;
  name: string;
  role: 'MASTER_ADMIN' | 'STAFF' | 'COLLEGE_MEMBER' | 'CAMPUS_EXECUTIVE';
  college?: string;
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'upvolt_super_secure_jwt_secret_key_2026';

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;

    // Verify user is still active in database
    const user = await User.findOne({ userId: decoded.userId });
    if (!user || !user.isActive) {
      res.status(401).json({ success: false, message: 'User account is deactivated or no longer exists.' });
      return;
    }

    req.user = {
      userId: user.userId,
      name: user.name,
      role: user.role,
      college: user.college,
      email: user.email,
    };

    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
  }
};

export const requireMasterAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== 'MASTER_ADMIN') {
    res.status(403).json({
      success: false,
      message: 'Access Denied: Master Admin privileges required.',
    });
    return;
  }
  next();
};

export const requireStaffOrAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || (req.user.role !== 'MASTER_ADMIN' && req.user.role !== 'STAFF')) {
    res.status(403).json({
      success: false,
      message: 'Access Denied: UpVolt Staff or Master Admin privileges required.',
    });
    return;
  }
  next();
};

export const signUserToken = (user: IUser): string => {
  return jwt.sign(
    {
      userId: user.userId,
      name: user.name,
      role: user.role,
      college: user.college,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};
