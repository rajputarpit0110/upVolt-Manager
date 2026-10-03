import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const primaryUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/upvolt_db';
  const localFallbackUri = 'mongodb://127.0.0.1:27017/upvolt_db';

  try {
    await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 2000 });
    console.log(`[UpVolt Server] Connected to MongoDB: ${primaryUri.includes('@') ? 'MongoDB Atlas Cluster' : primaryUri}`);
  } catch (error: any) {
    if (primaryUri !== localFallbackUri) {
      console.warn('[UpVolt Server] Primary MongoDB connection failed (e.g. Atlas IP whitelist or network). Attempting local fallback...');
      try {
        await mongoose.connect(localFallbackUri, { serverSelectionTimeoutMS: 2000 });
        console.log(`[UpVolt Server] Successfully connected to local MongoDB fallback at ${localFallbackUri}`);
        return;
      } catch (localErr) {
        console.error('[UpVolt Server] Local MongoDB fallback also failed:', localErr);
      }
    }
    console.error('[UpVolt Server] MongoDB Connection Error:', error);
    process.exit(1);
  }
};

