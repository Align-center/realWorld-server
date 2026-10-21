import { beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import fs from 'fs';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
    // Set required environment variables for tests
    process.env.ACCESS_TOKEN_SECRET = 'test-secret-key-for-testing';
    process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-for-testing';

    // Use pre-downloaded MongoDB binary for ARM64 Ubuntu 22.04
    const mongoBinaryPath = '/tmp/mongodb-binary/mongodb-linux-aarch64-ubuntu2204-7.0.14/bin/mongod';
    const binaryOptions = { binary: { systemBinary: mongoBinaryPath } };

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
