// Setup env for test before imports
process.env.PROXY_AUTH_TOKEN = 'test-token-123';

import request from 'supertest';
import express from 'express';
import { authMiddleware } from '../src/middleware/auth';

// Mock app for testing middleware
const app = express();
app.use(express.json());
app.get('/test-auth', authMiddleware, (req, res) => res.status(200).json({ ok: true }));

describe('Proxy Authentication Middleware', () => {
  it('should reject request without authorization header', async () => {
    const res = await request(app).get('/test-auth');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Missing or invalid token/);
  });

  it('should reject request with invalid token', async () => {
    const res = await request(app)
      .get('/test-auth')
      .set('Authorization', 'Bearer wrong-token');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid token/);
  });

  it('should allow request with correct token', async () => {
    const res = await request(app)
      .get('/test-auth')
      .set('Authorization', 'Bearer test-token-123');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('Health Check Endpoint', () => {
  // We need to import the real app for this or mock it
  // For simplicity, just test the auth logic as requested
});
