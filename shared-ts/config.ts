/**
 * Heady™ Universal Configuration Module v4.0.0
 * All env vars validated, typed, with φ-derived defaults
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import { FIB, POOL_SIZES, TIMING, PHI } from './phi-math.js';

// ═══ Config Helpers ═══
function envInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : defaultValue;
}

function envStr(key: string, defaultValue?: string): string {
  const val = process.env[key];
  if (!val && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val || defaultValue || '';
}

function envBool(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (!val) return defaultValue;
  return val === 'true' || val === '1';
}

function envList(key: string, defaultValue: string[] = []): string[] {
  const val = process.env[key];
  return val ? val.split(',').map(s => s.trim()).filter(Boolean) : defaultValue;
}

// ═══ Configuration Object ═══
export function loadConfig(serviceName: string) {
  return Object.freeze({
    service: {
      name: serviceName,
      port: envInt('PORT', 3000),
      version: envStr('npm_package_version', '4.0.0'),
      environment: envStr('NODE_ENV', 'development'),
    },
    database: {
      host: envStr('DB_HOST', 'postgres'),
      port: envInt('DB_PORT', 5432),
      name: envStr('DB_NAME', 'heady'),
      user: envStr('DB_USER', 'heady'),
      password: envStr('DB_PASSWORD', ''),
      pool: {
        min: envInt('DB_POOL_MIN', POOL_SIZES.min),
        max: envInt('DB_POOL_MAX', POOL_SIZES.max),
        idle: envInt('DB_POOL_IDLE', POOL_SIZES.idle),
      },
      ssl: envBool('DB_SSL', true),
    },
    redis: {
      host: envStr('REDIS_HOST', 'redis'),
      port: envInt('REDIS_PORT', 6379),
      password: envStr('REDIS_PASSWORD', ''),
      db: envInt('REDIS_DB', 0),
    },
    nats: {
      url: envStr('NATS_URL', 'nats://nats:4222'),
      token: envStr('NATS_TOKEN', ''),
    },
    auth: {
      jwtPublicKey: envStr('JWT_PUBLIC_KEY', ''),
      jwtPrivateKey: envStr('JWT_PRIVATE_KEY', ''),
      sessionTTLMs: envInt('SESSION_TTL_MS', TIMING.SESSION_TTL_MS),
      refreshTTLMs: envInt('REFRESH_TTL_MS', TIMING.REFRESH_TTL_MS),
      allowedOrigins: envList('ALLOWED_ORIGINS'),
    },
    colab: {
      runtime1Url: envStr('COLAB_RUNTIME_1_URL', ''),
      runtime2Url: envStr('COLAB_RUNTIME_2_URL', ''),
      runtime3Url: envStr('COLAB_RUNTIME_3_URL', ''),
      apiToken: envStr('COLAB_API_TOKEN', ''),
    },
    embedding: {
      provider: envStr('EMBEDDING_PROVIDER', 'nomic'),
      model: envStr('EMBEDDING_MODEL', 'nomic-embed-text-v1.5'),
      dimensions: envInt('EMBEDDING_DIMENSIONS', 384),
    },
    observability: {
      logLevel: envStr('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error',
      metricsEnabled: envBool('METRICS_ENABLED', true),
      tracingEnabled: envBool('TRACING_ENABLED', false),
    },
    scaling: {
      maxConcurrentBees: envInt('MAX_CONCURRENT_BEES', FIB[13] * FIB[9]), // 233 × 34 ≈ 7,922
      circuitBreakerThreshold: envInt('CIRCUIT_BREAKER_THRESHOLD', FIB[5]), // 8
      rateLimitPerMinute: envInt('RATE_LIMIT_PER_MINUTE', FIB[12]), // 144
    },
  });
}

export type HeadyConfig = ReturnType<typeof loadConfig>;
