'use strict';

/**
 * Security Flow Integration Tests (TEST-13)
 * Tests the security middleware stack end-to-end.
 */

const express = require('express');
const request = require('supertest');

describe('Security Flow Integration', () => {
  let app;

  beforeEach(() => {
    app = express();
    const { securityHeaders } = require('../../src/middleware/security-headers');
    app.use(securityHeaders);
    app.get('/test', (req, res) => res.json({ ok: true }));
    app.get('/health/live', (req, res) => res.json({ status: 'ok' }));
    app.post('/api/data', express.json(), (req, res) => res.json({ received: true }));
  });

  describe('Security Headers', () => {
    it('should set all security headers on response', async () => {
      const res = await request(app).get('/test');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-xss-protection']).toBe('0');
      expect(res.headers['strict-transport-security']).toContain('max-age=');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['permissions-policy']).toContain('camera=()');
    });

    it('should set headers on all routes', async () => {
      const res = await request(app).get('/health/live');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('CORS Policy', () => {
    it('should allow CORS for headyme.com', async () => {
      const res = await request(app)
        .get('/test')
        .set('Origin', 'https://headyme.com');
      expect(res.headers['access-control-allow-origin']).toBe('https://headyme.com');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should allow CORS for headysystems.com', async () => {
      const res = await request(app)
        .get('/test')
        .set('Origin', 'https://headysystems.com');
      expect(res.headers['access-control-allow-origin']).toBe('https://headysystems.com');
    });

    it('should allow CORS for www subdomain', async () => {
      const res = await request(app)
        .get('/test')
        .set('Origin', 'https://www.headyme.com');
      expect(res.headers['access-control-allow-origin']).toBe('https://www.headyme.com');
    });

    it('should reject CORS for unknown origin', async () => {
      const res = await request(app)
        .get('/test')
        .set('Origin', 'https://malicious.com');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should reject CORS for similar-looking domains', async () => {
      const res = await request(app)
        .get('/test')
        .set('Origin', 'https://headyme.com.evil.com');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Rate Limiter', () => {
    it('should define Fibonacci tiers', () => {
      const { TIERS } = require('../../src/resilience/rate-limiter-hardened');
      expect(TIERS.free.max).toBe(13);
      expect(TIERS.enterprise.max).toBe(89);
    });
  });

  describe('Env Validator', () => {
    it('should validate complete environment', () => {
      process.env.NODE_ENV = 'test';
      const { validateEnvironment } = require('../../src/security/env-validator-hardened');
      const result = validateEnvironment({
        DATABASE_URL: 'postgres://host/db',
        REDIS_URL: 'redis://host:6379',
        JWT_SECRET: 'a'.repeat(64),
        ANTHROPIC_API_KEY: 'sk-ant-key',
        CLOUDFLARE_API_TOKEN: 'cf-token',
        GCP_PROJECT_ID: 'project',
        NODE_ENV: 'development',
      });
      expect(result.valid).toBe(true);
    });
  });
});
