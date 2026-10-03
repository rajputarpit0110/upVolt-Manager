import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'MASTER_ADMIN' | 'STAFF' | 'COLLEGE_MEMBER' | 'CAMPUS_EXECUTIVE';

export interface IUser extends Document {
  userId: string; // Permanent username e.g. 'admin', 'rahul'
  name: string;
  passwordHash: string;
  role: UserRole;
  college?: string; // Permanent college scope for COLLEGE_MEMBER
  email?: string;
  phone?: string;
  department?: string;
  notes?: string;
  isActive: boolean;
  forcePasswordChange: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      immutable: true, // Permanent User ID
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['MASTER_ADMIN', 'STAFF', 'COLLEGE_MEMBER', 'CAMPUS_EXECUTIVE'],
      default: 'STAFF',
      required: true,
    },
    college: {
      type: String,
      trim: true,
      index: true,
    },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    department: { type: String, trim: true },
    notes: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    forcePasswordChange: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
