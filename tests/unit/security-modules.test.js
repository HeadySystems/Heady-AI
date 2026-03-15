'use strict';

/**
 * Security Module Unit Tests (TEST-10)
 * Tests: env-validator-hardened, security-headers, rate-limiter-hardened
 */

// ── ENV VALIDATOR ──────────────────────────────────────────────────────

describe('EnvValidator (Hardened)', () => {
  let validateEnvironment;

  beforeEach(() => {
    jest.resetModules();
    // Ensure NODE_ENV is NOT production (prevents auto-exit on import)
    process.env.NODE_ENV = 'test';
    const mod = require('../../src/security/env-validator-hardened');
    validateEnvironment = mod.validateEnvironment || mod;
  });

  it('should pass with all required vars present', () => {
    const env = {
      DATABASE_URL: 'postgres://host:5432/db',
      REDIS_URL: 'redis://host:6379',
      JWT_SECRET: 'a'.repeat(64),
      ANTHROPIC_API_KEY: 'sk-ant-test123456789012345678901234',
      CLOUDFLARE_API_TOKEN: 'cf-token-123',
      GCP_PROJECT_ID: 'my-project',
      NODE_ENV: 'development',
    };
    const result = validateEnvironment(env);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when required var is missing', () => {
    const env = { NODE_ENV: 'development' };
    const result = validateEnvironment(env);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.type === 'missing')).toBe(true);
  });

  it('should enforce production-only vars in production', () => {
    const env = {
      DATABASE_URL: 'postgres://host:5432/db',
      REDIS_URL: 'redis://host:6379',
      JWT_SECRET: 'a'.repeat(64),
      ANTHROPIC_API_KEY: 'sk-ant-test',
      CLOUDFLARE_API_TOKEN: 'token',
      GCP_PROJECT_ID: 'proj',
      NODE_ENV: 'production',
    };
    const result = validateEnvironment(env);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.type === 'missing_prod')).toBe(true);
  });

  it('should detect forbidden patterns in production', () => {
    const env = {
      DATABASE_URL: 'postgres://localhost:5432/db',
      REDIS_URL: 'redis://host:6379',
      JWT_SECRET: 'a'.repeat(64),
      ANTHROPIC_API_KEY: 'sk-ant-test',
      CLOUDFLARE_API_TOKEN: 'token',
      GCP_PROJECT_ID: 'proj',
      NODE_ENV: 'production',
      HEADY_CONDUCTOR_URL: 'https://conductor.headysystems.com',
      HEADY_MCP_URL: 'https://mcp.headysystems.com',
      SENTRY_DSN: 'https://sentry.io/123',
    };
    const result = validateEnvironment(env);
    expect(result.errors.some(e => e.type === 'forbidden')).toBe(true);
  });

  it('should warn on weak secrets', () => {
    const env = {
      DATABASE_URL: 'postgres://host/db',
      REDIS_URL: 'redis://host:6379',
      JWT_SECRET: 'short',
      ANTHROPIC_API_KEY: 'key',
      CLOUDFLARE_API_TOKEN: 'token',
      GCP_PROJECT_ID: 'proj',
      NODE_ENV: 'development',
    };
    const result = validateEnvironment(env);
    expect(result.warnings.some(w => w.type === 'weak_secret')).toBe(true);
  });

  it('should include summary in result', () => {
    const result = validateEnvironment({ NODE_ENV: 'test' });
    expect(result.summary).toContain('errors');
    expect(result.summary).toContain('warnings');
  });
});

// ── SECURITY HEADERS ───────────────────────────────────────────────────

describe('SecurityHeaders Middleware', () => {
  let securityHeaders, HEADY_DOMAINS, CORS_ORIGINS;

  beforeEach(() => {
    const mod = require('../../src/middleware/security-headers');
    securityHeaders = mod.securityHeaders;
    HEADY_DOMAINS = mod.HEADY_DOMAINS;
    CORS_ORIGINS = mod.CORS_ORIGINS;
  });

  function createMockReqRes(origin) {
    const headers = {};
    return {
      req: { headers: { origin } },
      res: {
        setHeader: jest.fn((key, val) => { headers[key] = val; }),
        _headers: headers,
      },
      next: jest.fn(),
      headers,
    };
  }

  it('should set X-Content-Type-Options', () => {
    const { req, res, next } = createMockReqRes();
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  it('should set X-Frame-Options to DENY', () => {
    const { req, res, next } = createMockReqRes();
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
  });

  it('should set HSTS', () => {
    const { req, res, next } = createMockReqRes();
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      expect.stringContaining('max-age=')
    );
  });

  it('should set Referrer-Policy', () => {
    const { req, res, next } = createMockReqRes();
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
  });

  it('should set Permissions-Policy', () => {
    const { req, res, next } = createMockReqRes();
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      expect.stringContaining('camera=()')
    );
  });

  it('should allow CORS for known Heady domain', () => {
    const { req, res, next } = createMockReqRes('https://headyme.com');
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://headyme.com');
  });

  it('should not set CORS for unknown origin', () => {
    const { req, res, next } = createMockReqRes('https://evil.com');
    securityHeaders(req, res, next);
    const corsCall = res.setHeader.mock.calls.find(c => c[0] === 'Access-Control-Allow-Origin');
    expect(corsCall).toBeUndefined();
  });

  it('should call next()', () => {
    const { req, res, next } = createMockReqRes();
    securityHeaders(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should define 16 Heady domains', () => {
    expect(HEADY_DOMAINS.length).toBe(16);
    expect(HEADY_DOMAINS).toContain('headyme.com');
    expect(HEADY_DOMAINS).toContain('headysystems.com');
  });

  it('should generate CORS_ORIGINS with https:// and www variants', () => {
    expect(CORS_ORIGINS).toContain('https://headyme.com');
    expect(CORS_ORIGINS).toContain('https://www.headyme.com');
    expect(CORS_ORIGINS.length).toBe(HEADY_DOMAINS.length * 2);
  });
});

// ── RATE LIMITER HARDENED ──────────────────────────────────────────────

describe('RateLimiterHardened', () => {
  let createRateLimiter, createEndpointLimiter, TIERS;

  beforeEach(() => {
    const mod = require('../../src/resilience/rate-limiter-hardened');
    createRateLimiter = mod.createRateLimiter;
    createEndpointLimiter = mod.createEndpointLimiter;
    TIERS = mod.TIERS;
  });

  it('should define Fibonacci-stepped tiers', () => {
    expect(TIERS.free.max).toBe(13);       // fib(7)
    expect(TIERS.starter.max).toBe(21);    // fib(8)
    expect(TIERS.pro.max).toBe(34);        // fib(9)
    expect(TIERS.business.max).toBe(55);   // fib(10)
    expect(TIERS.enterprise.max).toBe(89); // fib(11)
    expect(TIERS.internal.max).toBe(233);  // fib(13)
    expect(TIERS.pilot.max).toBe(55);      // fib(10)
  });

  it('should create rate limiter middleware', () => {
    const limiter = createRateLimiter('free');
    expect(typeof limiter).toBe('function');
  });

  it('should default to free tier', () => {
    const limiter = createRateLimiter();
    expect(typeof limiter).toBe('function');
  });

  it('should create endpoint limiter', () => {
    const limiter = createEndpointLimiter(10);
    expect(typeof limiter).toBe('function');
  });
});
