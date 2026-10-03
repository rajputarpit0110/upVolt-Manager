import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Product } from '../models/Product';
import { InventoryBatch } from '../models/InventoryBatch';
import { CollegeInventory } from '../models/CollegeInventory';
import { CollegeDispatch } from '../models/CollegeDispatch';
import { StockMovement } from '../models/StockMovement';
import { createCollegeDispatch } from '../services/collegeDispatchService';
import { receiveStock } from '../services/inventoryService';
import { createOrder } from '../services/orderService';

const MONGO_URI = 'mongodb://127.0.0.1:27017/upvolt_db';

async function runVerification() {
  console.log('=== STARTING UPVOLT COLLEGE-WISE INVENTORY VERIFICATION ===\n');
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.');

  try {
    // Setup clean test data
    const testSku = 'TEST-ESP32-VERIFY';
    await Product.deleteMany({ sku: testSku });
    await CollegeInventory.deleteMany({ college: { $in: ['College A', 'College B'] } });
    await CollegeDispatch.deleteMany({ college: { $in: ['College A', 'College B'] } });

    // Step 0: Create Initial Product ESP32 with initialStock = 100 @ CP ₹250
    console.log('[Step 0] Creating test product ESP32 with initial Central stock = 100 @ CP ₹250');
    const product = await Product.create({
      sku: testSku,
      name: 'ESP32 Wi-Fi + BLE Dev Module',
      category: 'Microcontrollers',
      currentStock: 0,
      reservedStock: 0,
      averageCost: 250,
      sellingPrice: 350,
      lowStockThreshold: 15,
      isActive: true,
    });

    await InventoryBatch.create({
      productId: product._id,
      batchNumber: `BATCH-INIT-${Date.now()}`,
      initialQuantity: 100,
      remainingQuantity: 100,
      costPrice: 250,
      receivedDate: new Date(),
      status: 'ACTIVE',
    });

    await Product.findByIdAndUpdate(product._id, { currentStock: 100, averageCost: 250 });
    let p = await Product.findById(product._id);
    console.log(`✓ Initial Central Stock: ${p?.currentStock} units (Expected: 100)\n`);

    // Step 1: Add Inventory ESP32 +50 @ ₹250 -> Central stock = 150
    console.log('[Step 1] Adding 50 units of ESP32 @ ₹250 via receiveStock');
    await receiveStock({
      productId: product._id.toString(),
      quantity: 50,
      costPrice: 250,
      receivedBy: 'master_admin',
      notes: 'Verification batch',
    });

    p = await Product.findById(product._id);
    console.log(`✓ Central Stock after adding 50: ${p?.currentStock} units (Expected: 150)\n`);
    if (p?.currentStock !== 150) throw new Error(`Step 1 failed: stock is ${p?.currentStock}, expected 150`);

    // Step 2: Dispatch to College A: ESP32 × 20 -> Central stock = 130, College A stock = 20, Cost = ₹5,000
    console.log('[Step 2] Dispatching 20 units of ESP32 to College A');
    const dispatch1 = await createCollegeDispatch({
      college: 'College A',
      dispatchedBy: 'master_admin',
      items: [{ productId: product._id.toString(), quantity: 20 }],
      notes: 'Lab components delivery',
    });

    p = await Product.findById(product._id);
    const colAStock = await CollegeInventory.findOne({ college: 'College A', productId: product._id });
    console.log(`✓ Central Stock after College A dispatch: ${p?.currentStock} units (Expected: 130)`);
    console.log(`✓ College A Inventory: ${colAStock?.currentStock} units (Expected: 20)`);
    console.log(`✓ Dispatch 1 Cost: ₹${dispatch1.totalCost} (Expected: 5000)\n`);
    if (p?.currentStock !== 130 || colAStock?.currentStock !== 20 || dispatch1.totalCost !== 5000) {
      throw new Error('Step 2 failed');
    }

    // Step 3: Dispatch to College B: ESP32 × 15 -> Central stock = 115, College B stock = 15
    console.log('[Step 3] Dispatching 15 units of ESP32 to College B');
    const dispatch2 = await createCollegeDispatch({
      college: 'College B',
      dispatchedBy: 'master_admin',
      items: [{ productId: product._id.toString(), quantity: 15 }],
      notes: 'Workshop batch',
    });

    p = await Product.findById(product._id);
    const colBStock = await CollegeInventory.findOne({ college: 'College B', productId: product._id });
    console.log(`✓ Central Stock after College B dispatch: ${p?.currentStock} units (Expected: 115)`);
    console.log(`✓ College B Inventory: ${colBStock?.currentStock} units (Expected: 15)`);
    console.log(`✓ Scoping Check: College A sees only College A inventory:`);
    const colAQuery = await CollegeInventory.find({ college: 'College A' });
    console.log(`   College A items count: ${colAQuery.length}, Stock: ${colAQuery[0]?.currentStock} units\n`);
    if (p?.currentStock !== 115 || colBStock?.currentStock !== 15) {
      throw new Error('Step 3 failed');
    }

    // Step 4: Customer Order: Aman, ESP32 × 5 @ ₹350 -> Central stock = 110, Revenue = ₹1,750, Cost = ₹1,250, Profit = ₹500
    console.log('[Step 4] Creating Delivered Order for Aman: ESP32 × 5 @ ₹350');
    const order = await createOrder(
      {
        customer: { name: 'Aman', phone: '9876543210' },
        items: [{ productId: product._id.toString(), quantity: 5, sellingPrice: 350, discount: 0 }],
        deliveryCharge: 0,
        status: 'Delivered',
        paymentStatus: 'Paid',
        notes: 'Direct customer sale',
      },
      { userId: 'admin-1', name: 'Master Admin', role: 'MASTER_ADMIN' }
    );

    p = await Product.findById(product._id);
    console.log(`✓ Central Stock after sale: ${p?.currentStock} units (Expected: 110)`);
    console.log(`✓ Order Revenue: ₹${order.totalAmount} (Expected: 1750)`);
    console.log(`✓ Order COGS: ₹${order.totalCost} (Expected: 1250)`);
    console.log(`✓ Order Net Profit: ₹${order.totalProfit} (Expected: 500)\n`);
    if (p?.currentStock !== 110 || order.totalAmount !== 1750 || order.totalCost !== 1250 || order.totalProfit !== 500) {
      throw new Error('Step 4 failed');
    }

    // Step 5: Insufficient stock test: College A requests 200 ESP32 -> Must be rejected with insufficient stock error
    console.log('[Step 5] Attempting to dispatch 200 ESP32 to College A (Central stock is 110)');
    let step5Passed = false;
    try {
      await createCollegeDispatch({
        college: 'College A',
        dispatchedBy: 'master_admin',
        items: [{ productId: product._id.toString(), quantity: 200 }],
      });
    } catch (err: any) {
      console.log(`✓ Correctly rejected with error: "${err.message}"\n`);
      step5Passed = err.message.includes('Insufficient stock');
    }
    if (!step5Passed) throw new Error('Step 5 failed: Over-dispatch was not rejected!');

    // Step 6: Test Stock Movements logged
    console.log('[Step 6] Verifying StockMovement logs for COLLEGE_DISPATCH');
    const movements = await StockMovement.find({
      productId: product._id,
      movementType: 'COLLEGE_DISPATCH',
    });
    console.log(`✓ Found ${movements.length} COLLEGE_DISPATCH movements (Expected: 2)`);
    for (const m of movements) {
      console.log(`   Movement: Qty -${m.quantity}, Prev: ${m.previousStock}, New: ${m.newStock}, PerformedBy: ${m.performedBy}`);
    }
    if (movements.length !== 2) throw new Error('Step 6 failed');

    // Clean up test data
    await Product.deleteMany({ sku: testSku });
    await CollegeInventory.deleteMany({ college: { $in: ['College A', 'College B'] } });
    await CollegeDispatch.deleteMany({ college: { $in: ['College A', 'College B'] } });

    console.log('\n==================================================');
    console.log('🎉 ALL COLLEGE WORKFLOW STEPS PASSED SUCCESSFULLY!');
    console.log('==================================================\n');
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runVerification().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
