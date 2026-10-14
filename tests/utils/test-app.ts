import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '@/api/index';

let testApp: Express | null = null;

export const getTestApp = (): Express => {
    if (!testApp) {
        testApp = createApp();
    }
    return testApp;
};

export const createTestAgent = () => {
    const app = getTestApp();
    return request(app);
};

export default createTestAgent;