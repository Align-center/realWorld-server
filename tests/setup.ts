import { beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Set required environment variables for tests BEFORE any module imports
process.env.ACCESS_TOKEN_SECRET = 'test-secret-key-for-testing';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-for-testing';

let mongoServer: MongoMemoryServer | null = null;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.DATABASE_URI = uri;
  await mongoose.connect(uri);
}, 120000);

afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
    }
}, 30000);

beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
        await collections[key].deleteMany({});
    }
});

export { mongoServer };