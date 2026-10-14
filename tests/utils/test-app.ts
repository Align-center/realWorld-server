import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '@/api/index';

export const getTestApp = (): Express => {
    return createApp();
};

export const createTestAgent = () => {
    const app = getTestApp();
    return request(app);
};

export default createTestAgent;
