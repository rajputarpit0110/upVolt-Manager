import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from '../models/User';
import { Product } from '../models/Product';
import { ProductPriceHistory } from '../models/ProductPriceHistory';
import { InventoryBatch } from '../models/InventoryBatch';
import { StockMovement } from '../models/StockMovement';
import { Purchase } from '../models/Purchase';
import { Order } from '../models/Order';
import { OrderVersion } from '../models/OrderVersion';
import { OrderReturn } from '../models/OrderReturn';
import { Customer } from '../models/Customer';
import { Supplier } from '../models/Supplier';
import { AuditLog } from '../models/AuditLog';
import { Notification } from '../models/Notification';
import { SystemSetting } from '../models/SystemSetting';

import { CollegeDispatch } from '../models/CollegeDispatch';
import { CollegeInventory } from '../models/CollegeInventory';
import { ensureDefaultCategories } from '../controllers/categoryController';

dotenv.config();

export async function cleanDatabase(): Promise<void> {
  const primaryUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/upvolt_db';
  const localFallbackUri = 'mongodb://127.0.0.1:27017/upvolt_db';

  if (mongoose.connection.readyState === 0) {
    try {
      console.log(`[CleanDB] Connecting to: ${primaryUri.replace(/:([^:@]+)@/, ':****@')}`);
      await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 5000 });
    } catch (err) {
      console.warn('[CleanDB] Primary cloud connection failed. Falling back to local MongoDB...');
      await mongoose.connect(localFallbackUri, { serverSelectionTimeoutMS: 3000 });
    }
  }

  console.log('[CleanDB] Purging dummy and transactional data...');

  const results = await Promise.all([
    Order.deleteMany({}),
    OrderVersion.deleteMany({}),
    OrderReturn.deleteMany({}),
    Purchase.deleteMany({}),
    StockMovement.deleteMany({}),
    InventoryBatch.deleteMany({}),
    Product.deleteMany({}),
    ProductPriceHistory.deleteMany({}),
    Customer.deleteMany({}),
    Supplier.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
    CollegeDispatch.deleteMany({}),
    CollegeInventory.deleteMany({}),
    User.deleteMany({ role: { $ne: 'MASTER_ADMIN' } }),
  ]);

  console.log(`[CleanDB] Removed:`);
  console.log(`  - Orders: ${results[0].deletedCount}`);
  console.log(`  - Order Versions: ${results[1].deletedCount}`);
  console.log(`  - Order Returns: ${results[2].deletedCount}`);
  console.log(`  - Purchases: ${results[3].deletedCount}`);
  console.log(`  - Stock Movements: ${results[4].deletedCount}`);
  console.log(`  - Inventory Batches: ${results[5].deletedCount}`);
  console.log(`  - Products: ${results[6].deletedCount}`);
  console.log(`  - Price History: ${results[7].deletedCount}`);
  console.log(`  - Customers: ${results[8].deletedCount}`);
  console.log(`  - Suppliers: ${results[9].deletedCount}`);
  console.log(`  - Notifications: ${results[10].deletedCount}`);
  console.log(`  - Audit Logs: ${results[11].deletedCount}`);
  console.log(`  - College Dispatches: ${results[12].deletedCount}`);
  console.log(`  - College Inventories: ${results[13].deletedCount}`);
  console.log(`  - Non-admin Users: ${results[14].deletedCount}`);

  // Ensure Master Admin account exists with known password
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@12345';
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const adminUser = await User.findOne({ role: 'MASTER_ADMIN' });
  if (!adminUser) {
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
    console.log(`[CleanDB] Initialized Master Admin: admin / ${adminPassword}`);
  } else {
    adminUser.passwordHash = adminHash;
    adminUser.isActive = true;
    adminUser.forcePasswordChange = false;
    await adminUser.save();
    console.log(`[CleanDB] Preserved Master Admin: ${adminUser.userId} (Password set to ${adminPassword})`);
  }

  // Ensure default SystemSetting exists
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
    console.log('[CleanDB] Re-initialized default SystemSettings.');
  }

  // Ensure default official categories exist for product categorization
  await ensureDefaultCategories();

  console.log('[CleanDB] Database has been completely cleaned of dummy data!');
}

if (require.main === module) {
  cleanDatabase()
    .then(() => {
      console.log('[CleanDB] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[CleanDB] Error:', err);
      process.exit(1);
    });
}
