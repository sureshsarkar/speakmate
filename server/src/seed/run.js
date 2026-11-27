import { connectDb, disconnectDb } from '../config/db.js';
import { ensureSeed } from './seed.js';

await connectDb();
await ensureSeed();
await disconnectDb();
console.log('Seed complete');
