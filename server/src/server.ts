import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db';
import { seedDatabase } from './config/seed';

import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import productRoutes from './routes/productRoutes';
import purchaseRoutes from './routes/purchaseRoutes';
import orderRoutes from './routes/orderRoutes';
import supplierRoutes from './routes/supplierRoutes';
import customerRoutes from './routes/customerRoutes';
import reportRoutes from './routes/reportRoutes';
import auditRoutes from './routes/auditRoutes';
import settingRoutes from './routes/settingRoutes';
import notificationRoutes from './routes/notificationRoutes';
import searchRoutes from './routes/searchRoutes';
import categoryRoutes from './routes/categoryRoutes';
import collegeRoutes from './routes/collegeRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Security Middlewares
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);

      // In production and dev, allow localhost, render.com, vercel, or custom frontend URL
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.endsWith('.onrender.com') ||
        origin.endsWith('.vercel.app') ||
        (process.env.CLIENT_URL && origin.includes(process.env.CLIENT_URL))
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Allow all web origins for SaaS API access
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limit for authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

app.use('/api/auth/login', authLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'UpVolt API Server', timestamp: new Date() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/colleges', collegeRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[UpVolt Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  connectDB().then(async () => {
    // Seed initial admin, staff, and products if empty
    try {
      await seedDatabase();
    } catch (seedErr) {
      console.error('[UpVolt Server] Seeding error:', seedErr);
    }

    app.listen(PORT, () => {
      console.log(`[UpVolt Server] Running on http://localhost:${PORT}`);
    });
  });
}

export default app;
