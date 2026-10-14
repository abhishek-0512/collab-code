import mongoose from 'mongoose';
import { env } from './env';

export async function connectDatabase(): Promise<boolean> {
  if (!env.MONGODB_URI) {
    console.log('[Database] MONGODB_URI not configured. Running with in-memory stores.');
    return false;
  }

  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('[Database] Connected to MongoDB Atlas successfully.');
    return true;
  } catch (err) {
    console.error('[Database] Failed to connect to MongoDB Atlas:', err);
    return false;
  }
}
