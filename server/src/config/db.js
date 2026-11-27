import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

let memoryServer = null;

export async function connectDb() {
  let uri = env.mongoUri;
  if (!uri && env.useMemoryDb) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create({ instance: { dbName: 'speakmate' } });
    uri = memoryServer.getUri('speakmate');
    logger.warn('Using in-memory MongoDB (data is lost on restart). Set MONGODB_URI for persistence.');
  }
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Set it in server/.env or run `npm run dev:memory` for a throwaway database.');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 30 });
  logger.info('MongoDB connected');
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
