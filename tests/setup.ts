import { beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer | null = null;
let mongoConnected = false;

beforeAll(async () => {
  // Set required environment variables for tests
  process.env.ACCESS_TOKEN_SECRET = 'test-secret-key-for-testing';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-for-testing';

  try {
    mongoServer = await MongoMemoryServer.create();
    debugger;
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    mongoConnected = true;
    console.log('MongoDB memory server started successfully');
  } catch (error) {
    console.warn('Failed to start MongoDB memory server, tests requiring database will be skipped:', (error as Error).message);
    mongoConnected = false;
  }
}, 120000);

afterAll(async () => {
    if (mongoConnected) {
        await mongoose.disconnect();
    }
    if (mongoServer) {
        await mongoServer.stop();
    }
}, 30000);

beforeEach(async () => {
    if (!mongoConnected) {
        return;
    }
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
        await collections[key].deleteMany({});
    }
});

export { mongoConnected };