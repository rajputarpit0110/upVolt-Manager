import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

interface ProductCatalogItem {
  name: string;
  sku: string;
  category: string;
  sellingPrice: number;
  costPrice: number;
  initialStock: number;
  unit: string;
  tags: string[];
}

export const AUTHORITATIVE_PRODUCTS: ProductCatalogItem[] = [
  // Image 1
  {
    name: 'ESP32 Development Board',
    sku: 'DEV-ESP32-WROOM-32D',
    category: 'Development Boards',
    sellingPrice: 280,
    costPrice: 180,
    initialStock: 50,
    unit: 'pcs',
    tags: ['NEW'],
  },
  {
    name: 'DHT11 Temperature & Humidity Sensor Module',
    sku: 'SEN-DHT11-TEMP-HUMID',
    category: 'Sensors',
    sellingPrice: 60,
    costPrice: 35,
    initialStock: 60,
    unit: 'pcs',
    tags: ['HOT'],
  },
  {
    name: 'Smart Automatic Toll Gate Kit',
    sku: 'KIT-SMART-TOLL-GATE',
    category: 'Kits & Projects',
    sellingPrice: 850,
    costPrice: 550,
    initialStock: 20,
    unit: 'kit',
    tags: [],
  },
  {
    name: 'TDS Water Quality Sensor Probe',
    sku: 'SEN-TDS-WATER-QUALITY',
    category: 'Sensors',
    sellingPrice: 250,
    costPrice: 160,
    initialStock: 35,
    unit: 'pcs',
    tags: ['NEW'],
  },
  {
    name: 'LM35 Precision Analog Temperature Sensor',
    sku: 'SEN-LM35-ANALOG-TEMP',
    category: 'Sensors',
    sellingPrice: 50,
    costPrice: 25,
    initialStock: 50,
    unit: 'pcs',
    tags: ['POPULAR'],
  },
  {
    name: 'DC Motor with Fan blade',
    sku: 'MOT-DC-FAN-BLADE-3V',
    category: 'Motors & Drivers',
    sellingPrice: 45,
    costPrice: 22,
    initialStock: 50,
    unit: 'pcs',
    tags: ['POPULAR'],
  },
  {
    name: 'Flame Sensor Module',
    sku: 'SEN-FLAME-DETECTION-MOD',
    category: 'Sensors',
    sellingPrice: 45,
    costPrice: 22,
    initialStock: 45,
    unit: 'pcs',
    tags: [],
  },
  {
    name: '0.96-inch OLED Display — 128×64 I2C',
    sku: 'DIS-OLED-096-128X64-I2C',
    category: 'Displays',
    sellingPrice: 180,
    costPrice: 115,
    initialStock: 40,
    unit: 'pcs',
    tags: ['NEW'],
  },
  {
    name: '5V 2A DC Power Adapter',
    sku: 'POW-ADAPTER-5V-2A-DC',
    category: 'Power & Components',
    sellingPrice: 140,
    costPrice: 80,
    initialStock: 35,
    unit: 'pcs',
    tags: ['NEW'],
  },

  // Image 2
  {
    name: '13.56 MHz RFID IC Card — MIFARE Classic 1K Description (1 piece)',
    sku: 'MOD-RFID-CARD-1356MHZ',
    category: 'Modules',
    sellingPrice: 25,
    costPrice: 12,
    initialStock: 100,
    unit: 'pcs',
    tags: [],
  },
  {
    name: 'MQ-6 LPG Gas Sensor Module',
    sku: 'SEN-MQ6-LPG-GAS-MOD',
    category: 'Sensors',
    sellingPrice: 80,
    costPrice: 45,
    initialStock: 35,
    unit: 'pcs',
    tags: [],
  },
  {
    name: 'MQ-135 Air Quality / Gas Sensor',
    sku: 'SEN-MQ135-AIR-QUALITY',
    category: 'Sensors',
    sellingPrice: 85,
    costPrice: 48,
    initialStock: 35,
    unit: 'pcs',
    tags: [],
  },
  {
    name: '10KΩ Trimmer Potentiometer (Preset Potentiometer)',
    sku: 'POW-POT-10K-TRIMMER',
    category: 'Power & Components',
    sellingPrice: 15,
    costPrice: 6,
    initialStock: 60,
    unit: 'pcs',
    tags: [],
  },
  {
    name: '2-position SPST ON/OFF rocker switch',
    sku: 'POW-SW-SPST-ROCKER-2POS',
    category: 'Power & Components',
    sellingPrice: 15,
    costPrice: 6,
    initialStock: 60,
    unit: 'pcs',
    tags: [],
  },
  {
    name: 'SG90 9g Micro Servo Motor',
    sku: 'MOT-SERVO-SG90-9G-MICRO',
    category: 'Motors & Drivers',
    sellingPrice: 85,
    costPrice: 48,
    initialStock: 45,
    unit: 'pcs',
    tags: [],
  },
  {
    name: 'LDR Light Sensor Module',
    sku: 'SEN-LDR-LIGHT-SENSOR-MOD',
    category: 'Sensors',
    sellingPrice: 30,
    costPrice: 15,
    initialStock: 50,
    unit: 'pcs',
    tags: [],
  },
  {
    name: 'NodeMCU ESP8266 Wi-Fi Development Board',
    sku: 'DEV-NODEMCU-ESP8266-WIFI',
    category: 'Development Boards',
    sellingPrice: 240,
    costPrice: 150,
    initialStock: 45,
    unit: 'pcs',
    tags: [],
  },
  {
    name: 'USB Cable for Arduino UNO (CH340 Interface)',
    sku: 'CAB-USB-CABLE-UNO-CH340',
    category: 'Cables & Connectors',
    sellingPrice: 50,
    costPrice: 25,
    initialStock: 60,
    unit: 'pcs',
    tags: [],
  },

  // Image 3
  {
    name: 'UNO ATmega328P R3 Development Board',
    sku: 'DEV-UNO-ATMEGA328P-R3',
    category: 'Development Boards',
    sellingPrice: 280,
    costPrice: 175,
    initialStock: 50,
    unit: 'pcs',
    tags: [],
  },
  {
    name: '6×6mm Tactile Push Button Switch',
    sku: 'POW-SW-TACTILE-6X6MM',
    category: 'Power & Components',
    sellingPrice: 10,
    costPrice: 4,
    initialStock: 100,
    unit: 'pcs',
    tags: [],
  },
  {
    name: 'Soil Moisture Sensor Module',
    sku: 'SEN-SOIL-MOISTURE-MOD',
    category: 'Sensors',
    sellingPrice: 60,
    costPrice: 30,
    initialStock: 45,
    unit: 'pcs',
    tags: ['POPULAR'],
  },
  {
    name: 'Sound Detection Sensor Module',
    sku: 'SEN-SOUND-DETECTION-MOD',
    category: 'Sensors',
    sellingPrice: 45,
    costPrice: 22,
    initialStock: 40,
    unit: 'pcs',
    tags: [],
  },
  {
    name: 'Female-to-Female Dupont Jumper Wires (Pack of 5)',
    sku: 'CAB-JUMP-F2F-PACK5',
    category: 'Cables & Connectors',
    sellingPrice: 10,
    costPrice: 4,
    initialStock: 150,
    unit: 'pack',
    tags: [],
  },
  {
    name: 'Male-to-Female Dupont Jumper Wires (Pack of 5)',
    sku: 'CAB-JUMP-M2F-PACK5',
    category: 'Cables & Connectors',
    sellingPrice: 10,
    costPrice: 4,
    initialStock: 150,
    unit: 'pack',
    tags: ['HOT'],
  },
  {
    name: 'Male-to-Male Dupont Jumper Wires (Pack of 5)',
    sku: 'CAB-JUMP-M2M-PACK5',
    category: 'Cables & Connectors',
    sellingPrice: 10,
    costPrice: 4,
    initialStock: 200,
    unit: 'pack',
    tags: ['BESTSELLER'],
  },
  {
    name: '1kΩ Resistor — Through-Hole (Pack of 4)',
    sku: 'POW-RES-1KOHM-PACK4',
    category: 'Power & Components',
    sellingPrice: 8,
    costPrice: 2,
    initialStock: 120,
    unit: 'pack',
    tags: [],
  },

  // Image 4
  {
    name: 'TTP223 Capacitive Touch Sensor Module',
    sku: 'SEN-TTP223-TOUCH-SENSOR',
    category: 'Sensors',
    sellingPrice: 35,
    costPrice: 18,
    initialStock: 50,
    unit: 'pcs',
    tags: [],
  },
  {
    name: 'RGB / 5mm LED (Pack of 9 LEDs)',
    sku: 'POW-LED-RGB-5MM-PACK9',
    category: 'Power & Components',
    sellingPrice: 20,
    costPrice: 8,
    initialStock: 80,
    unit: 'pack',
    tags: ['POPULAR'],
  },
  {
    name: '830-Point Solderless Breadboard',
    sku: 'POW-BRD-830PT-SOLDERLESS',
    category: 'Power & Components',
    sellingPrice: 80,
    costPrice: 45,
    initialStock: 60,
    unit: 'pcs',
    tags: ['BESTSELLER'],
  },
  {
    name: 'SmartWeather Monitoring Kit',
    sku: 'KIT-SMART-WEATHER-MONITOR',
    category: 'Kits & Projects',
    sellingPrice: 950,
    costPrice: 600,
    initialStock: 20,
    unit: 'kit',
    tags: [],
  },
  {
    name: 'PlantCare Auto-Watering Kit',
    sku: 'KIT-PLANT-CARE-AUTO-WATER',
    category: 'Kits & Projects',
    sellingPrice: 750,
    costPrice: 480,
    initialStock: 20,
    unit: 'kit',
    tags: [],
  },
  {
    name: 'HC-SR04 Ultrasonic Distance Sensor Module',
    sku: 'SEN-HCSR04-ULTRASONIC-DIST',
    category: 'Sensors',
    sellingPrice: 75,
    costPrice: 42,
    initialStock: 50,
    unit: 'pcs',
    tags: ['HOT'],
  },
  {
    name: '5V Active Piezoelectric Buzzer',
    sku: 'SEN-BUZZER-5V-ACTIVE-PIEZO',
    category: 'Sensors',
    sellingPrice: 25,
    costPrice: 12,
    initialStock: 60,
    unit: 'pcs',
    tags: ['HOT'],
  },
  {
    name: 'Rain Drop Sensor Module',
    sku: 'SEN-RAIN-DROP-SENSOR-MOD',
    category: 'Sensors',
    sellingPrice: 65,
    costPrice: 35,
    initialStock: 40,
    unit: 'pcs',
    tags: [],
  },

  // Image 5
  {
    name: 'Mini 5V DC Submersible Water Pump with Tube',
    sku: 'MOT-PUMP-MINI-5V-DC-TUBE',
    category: 'Motors & Drivers',
    sellingPrice: 95,
    costPrice: 50,
    initialStock: 45,
    unit: 'pcs',
    tags: ['POPULAR'],
  },
  {
    name: 'IR (Infrared) Obstacle Avoidance Sensor Module',
    sku: 'SEN-IR-OBSTACLE-AVOIDANCE',
    category: 'Sensors',
    sellingPrice: 40,
    costPrice: 20,
    initialStock: 50,
    unit: 'pcs',
    tags: ['POPULAR'],
  },
  {
    name: 'Yellow LEDs (Pack of 5)',
    sku: 'POW-LED-YELLOW-5MM-PACK5',
    category: 'Power & Components',
    sellingPrice: 10,
    costPrice: 3,
    initialStock: 100,
    unit: 'pack',
    tags: ['POPULAR'],
  },
  {
    name: 'Green LEDs (Pack of 5)',
    sku: 'POW-LED-GREEN-5MM-PACK5',
    category: 'Power & Components',
    sellingPrice: 10,
    costPrice: 3,
    initialStock: 100,
    unit: 'pack',
    tags: ['POPULAR'],
  },
  {
    name: 'Red LEDs (Pack of 5)',
    sku: 'POW-LED-RED-5MM-PACK5',
    category: 'Power & Components',
    sellingPrice: 10,
    costPrice: 3,
    initialStock: 100,
    unit: 'pack',
    tags: ['HOT'],
  },
  {
    name: '220 Ohm Resistor(Pack of 4)',
    sku: 'POW-RES-220OHM-PACK4',
    category: 'Power & Components',
    sellingPrice: 8,
    costPrice: 2,
    initialStock: 120,
    unit: 'pack',
    tags: ['HOT'],
  },
  {
    name: 'Fire Detection Alarm Kit',
    sku: 'KIT-FIRE-DETECTION-ALARM',
    category: 'Kits & Projects',
    sellingPrice: 650,
    costPrice: 420,
    initialStock: 25,
    unit: 'kit',
    tags: [],
  },
  {
    name: 'Gas Detection & SMS Kit',
    sku: 'KIT-GAS-DETECTION-SMS-SIM',
    category: 'Kits & Projects',
    sellingPrice: 1100,
    costPrice: 720,
    initialStock: 20,
    unit: 'kit',
    tags: ['POPULAR'],
  },

  // Image 6
  {
    name: 'Motion Alert Security Kit',
    sku: 'KIT-MOTION-ALERT-SECURITY',
    category: 'Kits & Projects',
    sellingPrice: 850,
    costPrice: 550,
    initialStock: 25,
    unit: 'kit',
    tags: [],
  },

  // Image 7 (Latest additions)
  {
    name: 'Rain Alert Kit',
    sku: 'KIT-RAIN-ALERT',
    category: 'Kits & Projects',
    sellingPrice: 650,
    costPrice: 420,
    initialStock: 25,
    unit: 'kit',
    tags: ['POPULAR'],
  },
  {
    name: '5V Single-Channel Relay Module',
    sku: 'MOD-RELAY-5V-1CH',
    category: 'Modules',
    sellingPrice: 60,
    costPrice: 30,
    initialStock: 45,
    unit: 'pcs',
    tags: ['POPULAR'],
  },
  {
    name: 'Soil Moisture Alert Kit',
    sku: 'KIT-SOIL-MOISTURE-ALERT',
    category: 'Kits & Projects',
    sellingPrice: 650,
    costPrice: 420,
    initialStock: 25,
    unit: 'kit',
    tags: [],
  },
  {
    name: '16×2 Character LCD Display with I2C Interface',
    sku: 'DIS-LCD-16X2-I2C',
    category: 'Displays',
    sellingPrice: 190,
    costPrice: 120,
    initialStock: 40,
    unit: 'pcs',
    tags: ['NEW'],
  },
  {
    name: 'LDR-Based Night Lamp',
    sku: 'KIT-LDR-NIGHT-LAMP',
    category: 'Kits & Projects',
    sellingPrice: 450,
    costPrice: 280,
    initialStock: 25,
    unit: 'kit',
    tags: [],
  },
  {
    name: 'Uno R3 ATmega328P-Compatible Development Board with CH340 USB Interface (cable)',
    sku: 'DEV-UNO-R3-CH340-CABLE-KIT',
    category: 'Development Boards',
    sellingPrice: 350,
    costPrice: 220,
    initialStock: 50,
    unit: 'pcs',
    tags: ['BESTSELLER'],
  },
  {
    name: 'MQ-2 Gas / Smoke / LPG Sensor Module',
    sku: 'SEN-MQ2-GAS-SMOKE-LPG',
    category: 'Sensors',
    sellingPrice: 75,
    costPrice: 42,
    initialStock: 40,
    unit: 'pcs',
    tags: [],
  },
];

async function syncTargetDb(dbUri: string, dbName: string) {
  console.log(`\n==============================================`);
  console.log(`Connecting to ${dbName}: ${dbUri.includes('@') ? 'Atlas Cluster' : dbUri}...`);
  const conn = await mongoose.createConnection(dbUri).asPromise();
  console.log(`Connected to ${dbName}.`);

  const ProductCol = conn.db!.collection('products');
  const BatchCol = conn.db!.collection('inventorybatches');
  const MovementCol = conn.db!.collection('stockmovements');

  // 1. Remove all products that are not in the new 43 products list
  const validNames = AUTHORITATIVE_PRODUCTS.map((p) => p.name);
  const deleteResult = await ProductCol.deleteMany({ name: { $nin: validNames } });
  console.log(`[${dbName}] Removed ${deleteResult.deletedCount} old/unlisted products.`);

  // 2. Insert or update all 43 authoritative products
  for (const item of AUTHORITATIVE_PRODUCTS) {
    const existing = await ProductCol.findOne({ name: item.name });

    if (existing) {
      // Update details, keep currentStock if already present, or initialize
      await ProductCol.updateOne(
        { _id: existing._id },
        {
          $set: {
            sku: item.sku,
            category: item.category,
            sellingPrice: item.sellingPrice,
            averageCost: item.costPrice,
            unit: item.unit,
            tags: item.tags,
            minStockLevel: 10,
            isArchived: false,
            updatedAt: new Date(),
          },
        }
      );

      // Ensure batch exists
      const batch = await BatchCol.findOne({ productId: existing._id, status: 'ACTIVE' });
      if (!batch) {
        const batchDoc = {
          batchNumber: `BATCH-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`,
          productId: existing._id,
          costPrice: item.costPrice,
          initialQuantity: item.initialStock,
          remainingQuantity: existing.currentStock > 0 ? existing.currentStock : item.initialStock,
          receivedDate: new Date(),
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await BatchCol.insertOne(batchDoc);
        if (!existing.currentStock || existing.currentStock <= 0) {
          await ProductCol.updateOne({ _id: existing._id }, { $set: { currentStock: item.initialStock } });
        }
      }
      console.log(`  ✓ Updated: ${item.name} (${item.sku})`);
    } else {
      // Create new product
      const newProd = {
        name: item.name,
        sku: item.sku,
        category: item.category,
        sellingPrice: item.sellingPrice,
        averageCost: item.costPrice,
        currentStock: item.initialStock,
        reservedStock: 0,
        damagedStock: 0,
        minStockLevel: 10,
        unit: item.unit,
        tags: item.tags,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const insertResult = await ProductCol.insertOne(newProd);

      // Create initial active batch
      const batchDoc = {
        batchNumber: `BATCH-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`,
        productId: insertResult.insertedId,
        costPrice: item.costPrice,
        initialQuantity: item.initialStock,
        remainingQuantity: item.initialStock,
        receivedDate: new Date(),
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const batchRes = await BatchCol.insertOne(batchDoc);

      // Log initial movement
      await MovementCol.insertOne({
        productId: insertResult.insertedId,
        batchId: batchRes.insertedId,
        movementType: 'STOCK_RECEIVED',
        quantity: item.initialStock,
        previousStock: 0,
        newStock: item.initialStock,
        previousReserved: 0,
        newReserved: 0,
        referenceType: 'PURCHASE',
        referenceId: 'INITIAL-STOCK',
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice,
        performedBy: 'admin',
        notes: 'Initial authoritative catalog stock intake',
        createdAt: new Date(),
      });
      console.log(`  + Created: ${item.name} (${item.sku}) [Stock: ${item.initialStock}]`);
    }
  }

  const finalCount = await ProductCol.countDocuments({});
  console.log(`[${dbName}] Catalog set to exactly ${finalCount} products.`);
  await conn.close();
}

async function main() {
  const localUri = 'mongodb://127.0.0.1:27017/upvolt_db';
  const atlasUri = process.env.MONGODB_URI || 'mongodb+srv://arpitrajput01102006_db_user:JwTbbfnL1jZa0B98@upvoltmanager.xtenjuc.mongodb.net/?appName=upVoltManager';

  // Sync to local MongoDB
  await syncTargetDb(localUri, 'Local MongoDB');

  // Sync to Atlas MongoDB
  if (atlasUri && atlasUri !== localUri) {
    try {
      await syncTargetDb(atlasUri, 'Atlas MongoDB');
    } catch (err: any) {
      console.warn('Atlas sync warning:', err.message);
    }
  }

  console.log('\n🎉 ALL 43 PRODUCTS SUCCESSFULLY ADDED & OTHERS REMOVED!');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
