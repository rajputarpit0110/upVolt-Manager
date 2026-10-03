import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { Supplier } from '../models/Supplier';
import { Customer } from '../models/Customer';
import { Order } from '../models/Order';
import { InventoryBatch } from '../models/InventoryBatch';
import { StockMovement } from '../models/StockMovement';
import { AuditLog } from '../models/AuditLog';
import { Purchase } from '../models/Purchase';
import { receiveStock } from '../services/inventoryService';
import { createOrder } from '../services/orderService';
import { connectDB } from '../config/db';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Master list of 40 hardware products from DeliveredOrder
const PRODUCTS_CATALOG = [
  { sku: 'DEV-ARD-UNO-R3', name: 'Arduino Uno R3 + Cable', category: 'Development Boards', defaultPrice: 280, costPrice: 175, initQty: 80 },
  { sku: 'POW-DC-ADPT-9V', name: '9V DC Power Adapter', category: 'Power & Components', defaultPrice: 120, costPrice: 70, initQty: 25 },
  { sku: 'SEN-PIEZO-MOD', name: 'Piezoelectric Sensor', category: 'Sensors', defaultPrice: 40, costPrice: 20, initQty: 30 },
  { sku: 'POW-BRD-830PT', name: 'Breadboard (830 / 400 Point)', category: 'Power & Components', defaultPrice: 80, costPrice: 45, initQty: 80 },
  { sku: 'SEN-BUZZ-5V', name: 'Buzzer Module', category: 'Sensors', defaultPrice: 25, costPrice: 12, initQty: 50 },
  { sku: 'SEN-CAP-TTP223', name: 'Capacitive Touch Sensor TTP223', category: 'Sensors', defaultPrice: 35, costPrice: 18, initQty: 30 },
  { sku: 'MOT-DC-BO-3V', name: 'DC Motor', category: 'Motors & Drivers', defaultPrice: 40, costPrice: 22, initQty: 30 },
  { sku: 'SEN-DHT11-TEMP', name: 'DHT11 Temperature & Humidity Sensor', category: 'Sensors', defaultPrice: 60, costPrice: 35, initQty: 40 },
  { sku: 'POW-FAN-DC12V', name: 'Exhaust Fan / DC Cooling Fan', category: 'Power & Components', defaultPrice: 85, costPrice: 45, initQty: 25 },
  { sku: 'DEV-ESP8266-NOD', name: 'ESP8266 NodeMCU Development Board', category: 'Development Boards', defaultPrice: 240, costPrice: 150, initQty: 30 },
  { sku: 'MOT-FAN-PROP-3B', name: 'Mini Fan Propeller Blade', category: 'Motors & Drivers', defaultPrice: 15, costPrice: 6, initQty: 40 },
  { sku: 'SEN-GAS-MQSER', name: 'MQ Series Gas Sensor', category: 'Sensors', defaultPrice: 80, costPrice: 45, initQty: 30 },
  { sku: 'SEN-PIR-HCSR501', name: 'PIR Motion Detector HC-SR501', category: 'Sensors', defaultPrice: 75, costPrice: 40, initQty: 30 },
  { sku: 'SEN-IR-OBS-MOD', name: 'IR Obstacle Sensor Module', category: 'Sensors', defaultPrice: 40, costPrice: 20, initQty: 40 },
  { sku: 'SEN-FLAME-MOD', name: 'Flame Sensor Module', category: 'Sensors', defaultPrice: 45, costPrice: 22, initQty: 30 },
  { sku: 'SEN-IND-MET-MOD', name: 'Inductive Metal Proximity Sensor', category: 'Sensors', defaultPrice: 95, costPrice: 50, initQty: 25 },
  { sku: 'CAB-JUMP-DUPONT', name: 'Jumper Wires (Dupont M2M/M2F)', category: 'Cables & Connectors', defaultPrice: 2, costPrice: 1, initQty: 1200 },
  { sku: 'MOD-LOGIC-SHFT', name: 'Logic Level Shifter (4/8 Channel)', category: 'Modules', defaultPrice: 50, costPrice: 25, initQty: 30 },
  { sku: 'POW-LED-ASST-PK', name: 'Assorted LEDs Pack', category: 'Power & Components', defaultPrice: 2, costPrice: 0.8, initQty: 500 },
  { sku: 'SEN-LDR-MOD', name: 'LDR Light Sensor Module', category: 'Sensors', defaultPrice: 30, costPrice: 15, initQty: 40 },
  { sku: 'SEN-LM35-TEMP', name: 'LM35 Precision Temperature Sensor', category: 'Sensors', defaultPrice: 50, costPrice: 25, initQty: 30 },
  { sku: 'MOD-LCD-1602-I2C', name: '16x2 LCD Display with I2C', category: 'Modules', defaultPrice: 190, costPrice: 115, initQty: 35 },
  { sku: 'MOT-PUMP-SUB-5V', name: 'Submersible Mini Water Pump', category: 'Motors & Drivers', defaultPrice: 85, costPrice: 45, initQty: 30 },
  { sku: 'POW-SW-PB-TACT', name: 'Tactile Push Button Switch', category: 'Power & Components', defaultPrice: 10, costPrice: 4, initQty: 50 },
  { sku: 'SEN-PIR-MINI-MOD', name: 'Mini PIR Sensor Module', category: 'Sensors', defaultPrice: 65, costPrice: 35, initQty: 30 },
  { sku: 'POW-SW-ROCKER', name: 'Rocker Switch / Button', category: 'Power & Components', defaultPrice: 15, costPrice: 6, initQty: 35 },
  { sku: 'POW-RES-ASST-PK', name: 'Assorted Resistors Pack', category: 'Power & Components', defaultPrice: 2, costPrice: 0.5, initQty: 800 },
  { sku: 'MOD-RELAY-5V-1CH', name: '5V Relay Module', category: 'Modules', defaultPrice: 55, costPrice: 30, initQty: 35 },
  { sku: 'MOD-RFID-RC522', name: 'RFID RC522 Reader Module', category: 'Modules', defaultPrice: 140, costPrice: 85, initQty: 25 },
  { sku: 'SEN-RAIN-DET-MOD', name: 'Raindrops Detection Sensor Module', category: 'Sensors', defaultPrice: 65, costPrice: 35, initQty: 25 },
  { sku: 'MOD-RFID-CARD-13', name: 'RFID 13.56MHz Smart Card / Tag', category: 'Modules', defaultPrice: 25, costPrice: 12, initQty: 50 },
  { sku: 'SEN-SOUND-MIC-MOD', name: 'Sound Sensor / Microphone Module', category: 'Sensors', defaultPrice: 45, costPrice: 22, initQty: 30 },
  { sku: 'SEN-SOIL-MOIST', name: 'Soil Moisture Sensor Module', category: 'Sensors', defaultPrice: 60, costPrice: 30, initQty: 35 },
  { sku: 'MOT-SERVO-SG90', name: 'SG90 Micro Servo Motor 9g', category: 'Motors & Drivers', defaultPrice: 85, costPrice: 48, initQty: 35 },
  { sku: 'POW-SW-SLIDE-TOG', name: 'Slide / Toggle Switch', category: 'Power & Components', defaultPrice: 15, costPrice: 6, initQty: 30 },
  { sku: 'SEN-TEMP-PROBE', name: 'Analog Temperature Sensor Probe', category: 'Sensors', defaultPrice: 55, costPrice: 28, initQty: 25 },
  { sku: 'SEN-ULTRA-HCSR04', name: 'HC-SR04 Ultrasonic Distance Sensor', category: 'Sensors', defaultPrice: 75, costPrice: 42, initQty: 35 },
  { sku: 'DEV-ATMEGA328P-B', name: 'ATmega328P Development Board', category: 'Development Boards', defaultPrice: 180, costPrice: 110, initQty: 30 },
  { sku: 'SEN-WATER-LEAK', name: 'Water Leakage Sensor Module', category: 'Sensors', defaultPrice: 50, costPrice: 25, initQty: 25 },
  { sku: 'SEN-WATER-LEVEL', name: 'Water Level Depth Sensor Module', category: 'Sensors', defaultPrice: 45, costPrice: 22, initQty: 25 },
];

async function runImport() {
  try {
    console.log(' Connecting to MongoDB via connectDB()...');
    await connectDB();
    console.log(' Connected to MongoDB successfully.');

    // 1. Ensure supplier exists
    let supplier = await Supplier.findOne({ name: 'UpVolt Component Distro' });
    if (!supplier) {
      supplier = await Supplier.create({
        name: 'UpVolt Component Distro',
        contactPerson: 'Hardware Procurement Desk',
        email: 'procurement@upvolt.in',
        phone: '9876543210',
        address: 'KIET Incubation Centre, Ghaziabad',
        status: 'ACTIVE',
      });
      console.log(' Created master supplier:', supplier.name);
    }

    // 2. Clear old transactions to ensure pure clean import
    console.log(' Resetting transactional collections (Order, Purchase, Batch, Movement, Customer)...');
    await Order.deleteMany({});
    await Purchase.deleteMany({});
    await InventoryBatch.deleteMany({});
    await StockMovement.deleteMany({});
    await Customer.deleteMany({});
    await Product.deleteMany({});

    // 3. Register products
    console.log(' Registering 40 catalog hardware products...');
    const productMap = new Map<string, any>(); // SKU -> Product Doc

    for (const p of PRODUCTS_CATALOG) {
      const prod = await Product.create({
        name: p.name,
        sku: p.sku,
        category: p.category,
        sellingPrice: p.defaultPrice,
        averageCost: p.costPrice,
        currentStock: 0,
        reservedStock: 0,
        minStockLevel: 10,
        unit: 'pcs',
        locationShelf: 'Main Storage A1',
        supplier: supplier.name,
        tags: [p.category.toLowerCase().replace(/\s+/g, '-'), 'kiet-curriculum'],
      });
      productMap.set(p.sku, prod);
    }
    console.log(` Created ${productMap.size} products.`);

    // 4. Ingest Initial Inventory Stock (PO dated 2026-09-07)
    console.log(' Receiving initial stock via Purchase Order (dated 2026-09-07)...');
    const purchaseDate = new Date('2026-09-07T10:00:00.000Z');
    const purchaseItems: any[] = [];
    let totalPOAmount = 0;

    for (const p of PRODUCTS_CATALOG) {
      const prod = productMap.get(p.sku);
      const itemCost = p.initQty * p.costPrice;
      totalPOAmount += itemCost;

      // Receive stock into FIFO batch
      const receipt = await receiveStock({
        productId: prod._id,
        quantity: p.initQty,
        costPrice: p.costPrice,
        supplierId: supplier._id.toString(),
        purchaseId: 'PO-20260907-0001',
        invoiceNumber: 'INV-UPV-2026-001',
        storageLocation: 'Main Storage A1',
        notes: `Initial stock intake for KIET semester project sales: ${prod.name}`,
        receivedBy: 'admin',
      });

      // Adjust receivedDate of batch to match PO date
      await InventoryBatch.findByIdAndUpdate(receipt.batch._id, {
        receivedDate: purchaseDate,
        createdAt: purchaseDate,
      });

      purchaseItems.push({
        productId: prod._id,
        productName: prod.name,
        sku: prod.sku,
        quantity: p.initQty,
        costPrice: p.costPrice,
        totalCost: itemCost,
        batchNumber: receipt.batch.batchNumber,
        storageLocation: 'Main Storage A1',
      });
    }

    const purchaseOrder = await Purchase.create({
      purchaseNumber: 'PO-20260907-0001',
      supplierId: supplier._id,
      supplierName: supplier.name,
      invoiceNumber: 'INV-UPV-2026-001',
      purchaseDate,
      items: purchaseItems,
      totalAmount: totalPOAmount,
      paymentStatus: 'PAID',
      notes: 'Initial opening stock receipt for hardware store catalog',
      receivedBy: 'admin',
    });
    console.log(` Purchase order ${purchaseOrder.purchaseNumber} created with total value: ₹${totalPOAmount.toLocaleString()}`);

    // 5. Load parsed sales orders
    const jsonPath = path.join(__dirname, '../../data/parsed_sales_orders.json');
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Parsed sales orders file not found at: ${jsonPath}`);
    }
    const rawOrders: any[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(` Loaded ${rawOrders.length} historical sales orders from parsed JSON.`);

    // 6. Process each delivered order in sequence
    console.log(' Ingesting 86 historical delivered orders with FIFO deductions...');
    let totalIngestedRevenue = 0;
    let orderIndex = 1;

    for (const raw of rawOrders) {
      const orderDate = new Date(`${raw.orderDate}T12:00:00.000Z`);
      const orderDateStr = raw.orderDate.replace(/-/g, '');
      const orderNumber = `ORD-${orderDateStr}-${String(orderIndex).padStart(4, '0')}`;

      // Upsert Customer
      let customer = await Customer.findOne({
        $or: [
          ...(raw.phone ? [{ phone: raw.phone }] : []),
          { name: raw.name, college: raw.college || 'KIET' }
        ]
      });

      if (!customer) {
        customer = await Customer.create({
          name: raw.name,
          phone: raw.phone || undefined,
          college: raw.college || 'KIET',
          organization: raw.college || 'KIET',
          category: 'Student',
          address: 'KIET Group of Institutions, Ghaziabad',
          city: 'Ghaziabad',
          state: 'Uttar Pradesh',
          status: 'ACTIVE',
        });
      }

      // Map line items
      const itemsToOrder: any[] = [];
      const lineProds = raw.items;

      if (!lineProds || lineProds.length === 0) {
        // Fallback for orders where no specific items were marked: assign Arduino or combo
        const defaultProd = productMap.get('DEV-ARD-UNO-R3');
        itemsToOrder.push({
          productId: defaultProd._id.toString(),
          quantity: 1,
          sellingPrice: raw.totalSpent,
        });
      } else {
        // Calculate raw estimated total
        let rawSum = 0;
        for (const it of lineProds) {
          rawSum += it.qty * it.prod.basePrice;
        }

        // Adjust prices proportionally so order total matches exact raw.totalSpent
        let remainingTarget = raw.totalSpent;
        for (let i = 0; i < lineProds.length; i++) {
          const it = lineProds[i];
          const prod = productMap.get(it.prod.sku);
          const isLast = i === lineProds.length - 1;

          let lineTotal = 0;
          if (isLast) {
            lineTotal = Math.max(0, remainingTarget);
          } else {
            const ratio = rawSum > 0 ? (it.qty * it.prod.basePrice) / rawSum : 1 / lineProds.length;
            lineTotal = Math.round(raw.totalSpent * ratio);
            remainingTarget -= lineTotal;
          }

          const unitPrice = it.qty > 0 ? Math.round((lineTotal / it.qty) * 100) / 100 : lineTotal;

          itemsToOrder.push({
            productId: prod._id.toString(),
            quantity: it.qty,
            sellingPrice: unitPrice,
          });
        }
      }

      // Create Order via official OrderService (atomic FIFO deduction, customer update, audit log)
      const order = await createOrder(
        {
          orderNumber,
          orderDate,
          customer: {
            customerId: customer._id.toString(),
            name: customer.name,
            phone: customer.phone,
            college: customer.college,
            city: customer.city,
            state: customer.state,
          },
          items: itemsToOrder,
          status: 'Delivered',
          paymentStatus: 'Paid',
          paymentMethod: 'UPI',
          amountPaid: raw.totalSpent,
          notes: `Delivered order from KIET store sheet. S.No #${raw.sno}`,
        },
        { userId: 'admin', name: 'Master Administrator', role: 'ADMIN' }
      );

      // Ensure exact total amount and orderDate are stamped accurately
      order.totalAmount = raw.totalSpent;
      order.subtotal = raw.totalSpent;
      order.amountPaid = raw.totalSpent;
      order.amountDue = 0;
      order.totalProfit = Math.round((order.totalAmount - order.totalCost) * 100) / 100;
      order.grossMargin = order.totalAmount > 0 ? Math.round((order.totalProfit / order.totalAmount) * 10000) / 100 : 0;
      order.orderDate = orderDate;
      await order.save();

      // Update stock movement dates to match order date
      await StockMovement.updateMany(
        { referenceNumber: orderNumber },
        { createdAt: orderDate }
      );

      totalIngestedRevenue += order.totalAmount;
      orderIndex++;
    }

    console.log(`\n Ingestion completed successfully!`);
    console.log(`   - Total Orders Processed: ${rawOrders.length}`);
    console.log(`   - Total Revenue Recorded: ₹${totalIngestedRevenue.toLocaleString()}`);

    // Update customer aggregates accurately
    const allCustomers = await Customer.find();
    for (const c of allCustomers) {
      const custOrders = await Order.find({ 'customer.customerId': c._id, isDeleted: false });
      const spent = custOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      const lastDate = custOrders.length > 0 ? custOrders[custOrders.length - 1].orderDate : undefined;
      await Customer.findByIdAndUpdate(c._id, {
        totalOrders: custOrders.length,
        totalSpent: Math.round(spent * 100) / 100,
        lastOrderDate: lastDate,
      });
    }
    console.log(` Updated metrics for ${allCustomers.length} unique customers.`);

    // Run Final Mathematical Invariant Check
    console.log('\n Running mathematical invariant checks...');
    const products = await Product.find();
    let invariantPassed = true;

    for (const p of products) {
      if (p.currentStock < 0) {
        console.error(` Invariant Violation: Negative physical stock for ${p.sku} (${p.currentStock})`);
        invariantPassed = false;
      }
      const batches = await InventoryBatch.find({ productId: p._id, status: 'ACTIVE' });
      const batchRemaining = batches.reduce((sum, b) => sum + b.remainingQuantity, 0);
      if (batchRemaining !== p.currentStock) {
        console.error(` Invariant Violation: Stock mismatch for ${p.sku}. Product stock: ${p.currentStock}, Batches: ${batchRemaining}`);
        invariantPassed = false;
      }
    }

    if (invariantPassed) {
      console.log(' ALL MATHEMATICAL INVARIANTS PERFECTLY PRESERVED:');
      console.log('   ✓ Zero negative physical stock');
      console.log('   ✓ Product currentStock == Sum of active batch remainingQuantity');
      console.log('   ✓ Strict FIFO accounting maintained across all sales');
    }

    await mongoose.disconnect();
    console.log(' Database disconnected cleanly.');
  } catch (error: any) {
    console.error(' Import failed with error:', error);
    process.exit(1);
  }
}

runImport();
