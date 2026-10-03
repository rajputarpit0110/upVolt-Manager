import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from '../models/User';
import { SystemSetting } from '../models/SystemSetting';
import { ensureDefaultCategories } from '../controllers/categoryController';

dotenv.config();

/**
 * Initializes essential administrative setup and system settings if missing.
 * Does NOT generate any mock products, dummy purchases, or dummy orders.
 */
export async function seedDatabase(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/upvolt_db';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  // 1. Ensure Master Admin Account Exists
  const adminUser = await User.findOne({ role: 'MASTER_ADMIN' });
  if (!adminUser) {
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'UpVolt#Master_2026!';
    const adminHash = await bcrypt.hash(adminPassword, 10);
    await new User({
      userId: 'admin',
      name: 'Master Admin',
      passwordHash: adminHash,
      role: 'MASTER_ADMIN',
      email: process.env.INITIAL_ADMIN_EMAIL || 'admin@upvolt.in',
      department: 'Operations & Management',
      isActive: true,
      forcePasswordChange: false,
    }).save();
    console.log(`[Seed] Initialized Master Admin account: admin / ${adminPassword}`);
  }

  // 2. Ensure System Settings Exist
  let setting = await SystemSetting.findOne();
  if (!setting) {
    setting = new SystemSetting({
      companyName: 'UpVolt Technologies',
      currencySymbol: '₹',
      defaultLowStockThreshold: 10,
      inventoryCostingMethod: 'FIFO',
      allowNegativeStock: false,
      reserveStockOnDraft: true,
      deadStockDays: 30,
      updatedBy: 'admin',
    });
    await setting.save();
    console.log('[Seed] Initialized System Settings (FIFO, ₹, UpVolt Technologies)');
  }

  // 3. Ensure Official UpVolt Categories Exist
  await ensureDefaultCategories();
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('[Seed] Database initialization completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Database initialization failed:', err);
      process.exit(1);
    });
}
