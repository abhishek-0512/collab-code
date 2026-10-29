import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: Number(process.env.PORT) || 5001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production-collab-code',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  REDIS_URL: process.env.REDIS_URL || '',
  EXECUTION_PROVIDER: process.env.EXECUTION_PROVIDER || (process.env.NODE_ENV === 'test' ? 'local' : 'judge0'),
  JUDGE0_URL: process.env.JUDGE0_URL || '',
  JUDGE0_API_KEY: process.env.JUDGE0_API_KEY || '',
  PISTON_URL: process.env.PISTON_URL || '',
} as const;
