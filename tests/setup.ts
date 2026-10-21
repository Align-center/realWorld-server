import { beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  // Set required environment variables for tests
  process.env.ACCESS_TOKEN_SECRET = 'test-secret-key-for-testing';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-for-testing';

  // Use Ubuntu 22.04 ARM64 binaries (compatible with Debian 12)
  // MongoDB doesn't provide ARM64 binaries for Debian 12, so we use Ubuntu 22.04
  // via the MONGOMS_DISTRO environment variable
  process.env.MONGOMS_DISTRO = 'ubuntu-22.04';

  const binaryOptions = {
    binary: {
      version: '7.0.14',
      platform: 'linux',
      arch: 'aarch64',
    },
  };

  mongoServer = await MongoMemoryServer.create(binaryOptions);
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
