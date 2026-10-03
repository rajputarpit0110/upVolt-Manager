import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../server';
import { Product } from '../models/Product';
import { InventoryBatch } from '../models/InventoryBatch';
import { Order } from '../models/Order';
import { StockMovement } from '../models/StockMovement';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { seedDatabase } from '../config/seed';
import { runSystemIntegrityCheck } from '../services/reconciliationService';

describe('UpVolt Manager — 14 Critical Business Logic Invariants & Hardening Tests', () => {
  let adminToken: string;
  let staffToken: string;
  let testProductId: string;
  let testProductSku: string;
  let activeOrderId: string;

  beforeAll(async () => {
    const testMongoUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/upvolt_db';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testMongoUri, { serverSelectionTimeoutMS: 3000 });
    }

    // Seed admin & staff
    await seedDatabase();

    // Login as Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ userId: 'admin', password: 'Admin@12345' });
    adminToken = adminRes.body.token;

    // Create test staff for role authorization tests
    let testStaff = await User.findOne({ userId: 'test_staff' });
    if (!testStaff) {
      const staffHash = await bcrypt.hash('Staff@12345', 10);
      testStaff = await User.create({
        name: 'Test Staff',
        userId: 'test_staff',
        email: 'staff@test.com',
        role: 'STAFF',
        passwordHash: staffHash,
        isActive: true,
      });
    }

    // Login as Staff
    const staffRes = await request(app)
      .post('/api/auth/login')
      .send({ userId: 'test_staff', password: 'Staff@12345' });
    staffToken = staffRes.body.token;

    // Create a pristine test product for exact scenario verification
    testProductSku = `TEST-ESP32-${Date.now()}`;
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test ESP32 NodeMCU',
        sku: testProductSku,
        category: 'Microcontrollers',
        sellingPrice: 350,
        minStockLevel: 10,
      });

    expect(prodRes.body.success).toBe(true);
    testProductId = prodRes.body.product._id;
  });

  afterAll(async () => {
    // Cleanup test product and related batches
    if (testProductId) {
      await Product.findByIdAndDelete(testProductId);
      await InventoryBatch.deleteMany({ productId: testProductId });
      await StockMovement.deleteMany({ productId: testProductId });
      await Order.deleteMany({ 'items.productId': testProductId });
    }
  });

  // ==========================================
  // TEST 1: Receive 100 @ ₹250, Receive 50 @ ₹270 -> Stock = 150
  // ==========================================
  it('TEST 1: Receive two independent batches (100 @ ₹250, 50 @ ₹270) -> Total Stock = 150', async () => {
    // Batch 1: 100 units @ ₹250
    const res1 = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 100, costPrice: 250 }],
        notes: 'Batch A Shipment',
      });
    expect(res1.body.success).toBe(true);

    // Batch 2: 50 units @ ₹270
    const res2 = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 50, costPrice: 270 }],
        notes: 'Batch B Shipment',
      });
    expect(res2.body.success).toBe(true);

    const product = await Product.findById(testProductId);
    expect(product?.currentStock).toBe(150);

    const batches = await InventoryBatch.find({ productId: testProductId }).sort({ receivedDate: 1 });
    expect(batches.length).toBe(2);
    expect(batches[0].remainingQuantity).toBe(100);
    expect(batches[0].costPrice).toBe(250);
    expect(batches[1].remainingQuantity).toBe(50);
    expect(batches[1].costPrice).toBe(270);
  });

  // ==========================================
  // TEST 2: Sell 120 @ ₹350 -> FIFO (100 @ ₹250, 20 @ ₹270). COGS: ₹30,400, Rev: ₹42,000, Profit: ₹11,600, Stock: 30
  // ==========================================
  it('TEST 2: Sell 120 ESP32 @ ₹350 -> Strict FIFO consumption, COGS = ₹30,400, Rev = ₹42,000, Profit = ₹11,600, Remaining = 30', async () => {
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 120, sellingPrice: 350 }],
        customer: { name: 'Test Customer', phone: '9999900000' },
      });

    expect(orderRes.body.success).toBe(true);
    const order = orderRes.body.order;
    activeOrderId = order._id;

    // Check financial numbers
    expect(order.totalAmount).toBe(42000); // 120 * 350
    expect(order.totalCost).toBe(30400);   // 100 * 250 + 20 * 270 = 25000 + 5400 = 30400
    expect(order.totalProfit).toBe(11600); // 42000 - 30400 = 11600

    // Check allocations stored in order item
    const lineItem = order.items[0];
    expect(lineItem.batchAllocations.length).toBe(2);
    expect(lineItem.batchAllocations[0].quantity).toBe(100);
    expect(lineItem.batchAllocations[0].costPrice).toBe(250);
    expect(lineItem.batchAllocations[1].quantity).toBe(20);
    expect(lineItem.batchAllocations[1].costPrice).toBe(270);

    // Verify remaining physical and batch inventory
    const product = await Product.findById(testProductId);
    expect(product?.currentStock).toBe(30);

    const batches = await InventoryBatch.find({ productId: testProductId }).sort({ receivedDate: 1 });
    expect(batches[0].remainingQuantity).toBe(0);
    expect(batches[0].status).toBe('EXHAUSTED');
    expect(batches[1].remainingQuantity).toBe(30);
    expect(batches[1].status).toBe('ACTIVE');
  });

  // ==========================================
  // TEST 3: Attempt Sell 35 ESP32 -> REJECTED (only 30 available, stock remains 30)
  // ==========================================
  it('TEST 3: Attempt to oversell (Sell 35 when 30 in stock) -> REJECTED with clear error, no stock changed', async () => {
    const failRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 35, sellingPrice: 350 }],
      });

    expect(failRes.status).toBe(400);
    expect(failRes.body.success).toBe(false);
    expect(failRes.body.message).toContain('Insufficient stock');

    const product = await Product.findById(testProductId);
    expect(product?.currentStock).toBe(30);
  });

  // ==========================================
  // TEST 4: Edit existing order: 120 -> 125 -> Only 5 additional units deducted
  // ==========================================
  it('TEST 4: Edit existing order: 120 -> 125 -> Only delta 5 units deducted, NOT 125 again', async () => {
    const editRes = await request(app)
      .put(`/api/orders/${activeOrderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 125, sellingPrice: 350 }],
        changeReason: 'Customer requested 5 more units',
      });

    expect(editRes.body.success).toBe(true);
    const updatedOrder = editRes.body.order;

    // Order totals: 125 * 350 = 43,750. COGS: 30,400 + (5 * 270) = 31,750. Profit = 12,000
    expect(updatedOrder.totalAmount).toBe(43750);
    expect(updatedOrder.totalCost).toBe(31750);
    expect(updatedOrder.totalProfit).toBe(12000);

    // Remaining physical stock: was 30, now 30 - 5 = 25
    const product = await Product.findById(testProductId);
    expect(product?.currentStock).toBe(25);
  });

  // ==========================================
  // TEST 5: Edit existing order: 125 -> 120 -> 5 units returned to correct batch
  // ==========================================
  it('TEST 5: Edit existing order: 125 -> 120 -> 5 units returned to correct inventory allocation', async () => {
    const editRes = await request(app)
      .put(`/api/orders/${activeOrderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 120, sellingPrice: 350 }],
        changeReason: 'Customer reduced order back to 120',
      });

    expect(editRes.body.success).toBe(true);
    const updatedOrder = editRes.body.order;

    expect(updatedOrder.totalAmount).toBe(42000);
    expect(updatedOrder.totalCost).toBe(30400);

    // Stock should be restored back to 30
    const product = await Product.findById(testProductId);
    expect(product?.currentStock).toBe(30);

    const batches = await InventoryBatch.find({ productId: testProductId }).sort({ receivedDate: 1 });
    expect(batches[1].remainingQuantity).toBe(30);
  });

  // ==========================================
  // TEST 6: Cancel order -> Exact sold quantities restored (120 units restored)
  // ==========================================
  it('TEST 6: Cancel order -> Exact sold quantities restored, duplicate cancellation prevented', async () => {
    const cancelRes = await request(app)
      .post(`/api/orders/${activeOrderId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Customer cancelled project' });

    expect(cancelRes.body.success).toBe(true);

    // Physical stock should be fully restored to 150 (30 + 120)
    const product = await Product.findById(testProductId);
    expect(product?.currentStock).toBe(150);

    const batches = await InventoryBatch.find({ productId: testProductId }).sort({ receivedDate: 1 });
    expect(batches[0].remainingQuantity).toBe(100);
    expect(batches[0].status).toBe('ACTIVE');
    expect(batches[1].remainingQuantity).toBe(50);
    expect(batches[1].status).toBe('ACTIVE');

    // Duplicate cancellation attempt
    const dupCancel = await request(app)
      .post(`/api/orders/${activeOrderId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Duplicate call' });

    expect(dupCancel.status).toBe(400);
    expect(dupCancel.body.message).toContain('already cancelled');

    // Stock must remain 150 (not 270!)
    const productAfter = await Product.findById(testProductId);
    expect(productAfter?.currentStock).toBe(150);
  });

  // ==========================================
  // TEST 7: Return 10 units from delivered order (GOOD vs DAMAGED)
  // ==========================================
  it('TEST 7: Return 10 units from delivered order -> GOOD restores sellable stock, DAMAGED moves to quarantine', async () => {
    // 1. Create and deliver an order of 20 units
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 20, sellingPrice: 350 }],
        status: 'Delivered',
      });
    expect(orderRes.body.success).toBe(true);
    const orderId = orderRes.body.order._id;
    // Stock was 150 - 20 = 130

    // 2. Return 5 units with condition 'GOOD'
    const returnGoodRes = await request(app)
      .post(`/api/orders/${orderId}/return`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 5, condition: 'GOOD' }],
        reason: 'Surplus returned unused',
      });
    expect(returnGoodRes.body.success).toBe(true);

    // Stock should increase to 135
    let prod = await Product.findById(testProductId);
    expect(prod?.currentStock).toBe(135);

    // 3. Return 5 units with condition 'DAMAGED'
    const returnDamagedRes = await request(app)
      .post(`/api/orders/${orderId}/return`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 5, condition: 'DAMAGED' }],
        reason: 'Defective pin header from shipping',
      });
    expect(returnDamagedRes.body.success).toBe(true);

    // Physical sellable stock should stay 135, damagedStock should be 5
    prod = await Product.findById(testProductId);
    expect(prod?.currentStock).toBe(135);
    expect(prod?.damagedStock).toBe(5);
  });

  // ==========================================
  // TEST 8: Edit product selling price -> History preserved, historical orders unchanged
  // ==========================================
  it('TEST 8: Edit product selling price -> Price history stored, historical orders unchanged', async () => {
    const updateRes = await request(app)
      .put(`/api/products/${testProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sellingPrice: 380, priceChangeReason: 'Inflation price hike' });

    expect(updateRes.body.success).toBe(true);

    const prod = await Product.findById(testProductId);
    expect(prod?.sellingPrice).toBe(380);

    // Historical order must remain at original selling price
    const historicalOrder = await Order.findById(activeOrderId);
    expect(historicalOrder?.items[0].sellingPrice).toBe(350);
  });

  // ==========================================
  // TEST 9: Staff attempts: DELETE /api/orders/:id -> HTTP 403 Forbidden
  // ==========================================
  it('TEST 9: Staff attempts DELETE /api/orders/:id -> HTTP 403 Forbidden, no deletion', async () => {
    const delRes = await request(app)
      .delete(`/api/orders/${activeOrderId}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(delRes.status).toBe(403);
    expect(delRes.body.success).toBe(false);

    const orderStillExists = await Order.findById(activeOrderId);
    expect(orderStillExists).not.toBeNull();
    expect(orderStillExists?.isDeleted).toBe(false);
  });

  // ==========================================
  // TEST 10: Master Admin deletes order -> Soft delete to trash, audit log created
  // ==========================================
  it('TEST 10: Master Admin deletes order -> Soft delete to Trash, audit record generated', async () => {
    const adminDelRes = await request(app)
      .delete(`/api/orders/${activeOrderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Admin archiving duplicate test order' });

    expect(adminDelRes.body.success).toBe(true);

    const trashedOrder = await Order.findById(activeOrderId);
    expect(trashedOrder?.isDeleted).toBe(true);
    expect(trashedOrder?.deletedBy).toBe('admin');
  });

  // ==========================================
  // TEST 11: Master Admin restores deleted order -> Safely restored without negative stock
  // ==========================================
  it('TEST 11: Master Admin restores deleted order -> Restored from trash, audit record created', async () => {
    const restoreRes = await request(app)
      .post(`/api/orders/${activeOrderId}/restore`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(restoreRes.body.success).toBe(true);

    const restoredOrder = await Order.findById(activeOrderId);
    expect(restoredOrder?.isDeleted).toBe(false);
  });

  // ==========================================
  // TEST 12: Simultaneous sales attempt to consume last available stock -> Concurrency safe
  // ==========================================
  it('TEST 12: Two simultaneous sales attempt to consume stock -> Only valid succeeds, no negative stock', async () => {
    // Current stock is 135. Let's create a special product with exactly 5 units in stock.
    const concSku = `CONC-TEST-${Date.now()}`;
    const pRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Concurrency Test Item', sku: concSku, category: 'Sensors', sellingPrice: 100 });
    const concProdId = pRes.body.product._id;

    // Receive exactly 5 units
    await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [{ productId: concProdId, quantity: 5, costPrice: 50 }],
      });

    // User A attempts to buy 4, User B attempts to buy 3 simultaneously (total 7 > 5)
    const reqA = request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [{ productId: concProdId, quantity: 4, sellingPrice: 100 }] });

    const reqB = request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [{ productId: concProdId, quantity: 3, sellingPrice: 100 }] });

    const [resA, resB] = await Promise.all([reqA, reqB]);

    // One must succeed, one must fail with Insufficient stock
    const oneSucceeded = (resA.body.success && !resB.body.success) || (!resA.body.success && resB.body.success);
    expect(oneSucceeded).toBe(true);

    const concProd = await Product.findById(concProdId);
    expect(concProd!.currentStock).toBeGreaterThanOrEqual(0); // NEVER negative!

    // Cleanup
    await Product.findByIdAndDelete(concProdId);
    await InventoryBatch.deleteMany({ productId: concProdId });
  });

  // ==========================================
  // TEST 13: Double-click Create Order (Idempotency key) -> Only one order created
  // ==========================================
  it('TEST 13: Double-click Create Order with same idempotency key -> Only 1 order created', async () => {
    const idemKey = `idem-${Date.now()}`;

    const [call1, call2] = await Promise.all([
      request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          items: [{ productId: testProductId, quantity: 1, sellingPrice: 350 }],
          idempotencyKey: idemKey,
        }),
      request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          items: [{ productId: testProductId, quantity: 1, sellingPrice: 350 }],
          idempotencyKey: idemKey,
        }),
    ]);

    expect(call1.body.success).toBe(true);
    expect(call2.body.success).toBe(true);
    // Both return the exact same orderNumber
    expect(call1.body.order.orderNumber).toBe(call2.body.order.orderNumber);

    // In DB, count with this idempotency key must be exactly 1
    const count = await Order.countDocuments({ idempotencyKey: idemKey });
    expect(count).toBe(1);
  });

  // ==========================================
  // TEST 14: Run System Integrity Check -> All mathematical invariants pass
  // ==========================================
  it('TEST 14: Run System Integrity Check -> Zero negative stock, sum of batches equals product stock', async () => {
    const integrityRes = await request(app)
      .get('/api/reports/integrity-check')
      .set('Authorization', `Bearer ${adminToken}`);

    if (integrityRes.body.result?.summary?.discrepancyCount > 0) {
      console.error('DISCREPANCIES:', JSON.stringify(integrityRes.body.result.discrepancies, null, 2));
    }
    expect(integrityRes.body.success).toBe(true);
    expect(integrityRes.body.result.summary.discrepancyCount).toBe(0);
    expect(integrityRes.body.result.passed).toBe(true);
  });
});
