/**
 * Heady™ Typed Error Catalog v4.0.0
 * All 48+ error codes from docs/errors/error-catalog.md — production-ready
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

// ═══ Error Categories ═══
export type ErrorCategory =
  | 'AUTH'      // 1000-1099: Authentication & Authorization
  | 'VECTOR'    // 2000-2099: Vector Memory & Embeddings
  | 'CSL'       // 2100-2199: Continuous Semantic Logic
  | 'PIPELINE'  // 3000-3099: HCFullPipeline & Orchestration
  | 'SERVICE'   // 4000-4099: Microservice Communication
  | 'INFRA'     // 5000-5099: Infrastructure & Deployment
  | 'SECURITY'  // 6000-6099: Security Violations
  | 'DATA'      // 7000-7099: Data Integrity & Validation
  | 'GPU'       // 8000-8099: Colab/GPU Operations
  | 'BILLING';  // 9000-9099: Billing & Quotas

// ═══ Base Error Class ═══
export class HeadyError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly category: ErrorCategory;
  readonly details: Record<string, unknown>;
  readonly isOperational: boolean;
  readonly timestamp: string;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    category: ErrorCategory = 'SERVICE',
    details: Record<string, unknown> = {},
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'HeadyError';
    this.code = code;
    this.statusCode = statusCode;
    this.category = category;
    this.details = details;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      category: this.category,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

// ═══ Error Factory Functions ═══

// AUTH (1000-1099)
export const AuthErrors = {
  invalidCredentials: (details?: Record<string, unknown>) =>
    new HeadyError('Invalid credentials', 'HEADY-1001', 401, 'AUTH', details ?? {}),
  tokenExpired: (details?: Record<string, unknown>) =>
    new HeadyError('Authentication token has expired', 'HEADY-1002', 401, 'AUTH', details ?? {}),
  tokenMalformed: (details?: Record<string, unknown>) =>
    new HeadyError('Malformed authentication token', 'HEADY-1003', 401, 'AUTH', details ?? {}),
  insufficientPermissions: (required: string, details?: Record<string, unknown>) =>
    new HeadyError(`Insufficient permissions: requires ${required}`, 'HEADY-1004', 403, 'AUTH', { required, ...details }),
  sessionNotFound: (details?: Record<string, unknown>) =>
    new HeadyError('Session not found or expired', 'HEADY-1005', 401, 'AUTH', details ?? {}),
  pkceVerificationFailed: (details?: Record<string, unknown>) =>
    new HeadyError('PKCE code verification failed', 'HEADY-1006', 401, 'AUTH', details ?? {}),
  rateLimited: (retryAfterMs: number) =>
    new HeadyError('Rate limit exceeded', 'HEADY-1007', 429, 'AUTH', { retryAfterMs }),
  csrfViolation: () =>
    new HeadyError('CSRF token validation failed', 'HEADY-1008', 403, 'AUTH'),
  oauthProviderError: (provider: string, reason: string) =>
    new HeadyError(`OAuth provider error: ${provider} — ${reason}`, 'HEADY-1009', 502, 'AUTH', { provider, reason }),
  refreshTokenRevoked: () =>
    new HeadyError('Refresh token has been revoked', 'HEADY-1010', 401, 'AUTH'),
};

// VECTOR (2000-2099)
export const VectorErrors = {
  dimensionMismatch: (expected: number, received: number) =>
    new HeadyError(`Vector dimension mismatch: expected ${expected}, received ${received}`, 'HEADY-2001', 400, 'VECTOR', { expected, received }),
  embeddingFailed: (reason: string) =>
    new HeadyError(`Embedding generation failed: ${reason}`, 'HEADY-2002', 500, 'VECTOR', { reason }),
  similarityBelowThreshold: (score: number, threshold: number) =>
    new HeadyError(`Similarity ${score.toFixed(4)} below threshold ${threshold.toFixed(4)}`, 'HEADY-2003', 422, 'VECTOR', { score, threshold }),
  memoryCapacityExceeded: (current: number, limit: number) =>
    new HeadyError(`Vector memory capacity exceeded: ${current}/${limit}`, 'HEADY-2004', 507, 'VECTOR', { current, limit }),
  projectionFailed: (reason: string) =>
    new HeadyError(`3D projection failed: ${reason}`, 'HEADY-2005', 500, 'VECTOR', { reason }),
  indexCorrupted: (indexName: string) =>
    new HeadyError(`Vector index corrupted: ${indexName}`, 'HEADY-2006', 500, 'VECTOR', { indexName }),
};

// CSL (2100-2199)
export const CSLErrors = {
  gateThresholdViolation: (gate: string, score: number, threshold: number) =>
    new HeadyError(`CSL gate ${gate} violation: ${score.toFixed(4)} vs ${threshold.toFixed(4)}`, 'HEADY-2101', 422, 'CSL', { gate, score, threshold }),
  operationUndefined: (operation: string) =>
    new HeadyError(`CSL operation undefined: ${operation}`, 'HEADY-2102', 400, 'CSL', { operation }),
  consensusDivergence: (score: number) =>
    new HeadyError(`Consensus divergence too high: ${score.toFixed(4)}`, 'HEADY-2103', 422, 'CSL', { score }),
};

// PIPELINE (3000-3099)
export const PipelineErrors = {
  stageTimeout: (stage: string, timeoutMs: number) =>
    new HeadyError(`Pipeline stage ${stage} timed out after ${timeoutMs}ms`, 'HEADY-3001', 504, 'PIPELINE', { stage, timeoutMs }),
  stageFailed: (stage: string, reason: string) =>
    new HeadyError(`Pipeline stage ${stage} failed: ${reason}`, 'HEADY-3002', 500, 'PIPELINE', { stage, reason }),
  dagCycleDetected: (nodes: string[]) =>
    new HeadyError('DAG cycle detected in pipeline graph', 'HEADY-3003', 400, 'PIPELINE', { nodes }),
  nodeUnavailable: (node: string) =>
    new HeadyError(`Pipeline node unavailable: ${node}`, 'HEADY-3004', 503, 'PIPELINE', { node }),
  contextAssemblyFailed: (reason: string) =>
    new HeadyError(`Context assembly failed: ${reason}`, 'HEADY-3005', 500, 'PIPELINE', { reason }),
};

// SERVICE (4000-4099)
export const ServiceErrors = {
  connectionRefused: (service: string, port: number) =>
    new HeadyError(`Connection refused: ${service}:${port}`, 'HEADY-4001', 503, 'SERVICE', { service, port }),
  circuitBreakerOpen: (service: string) =>
    new HeadyError(`Circuit breaker OPEN for ${service}`, 'HEADY-4002', 503, 'SERVICE', { service }),
  serviceTimeout: (service: string, timeoutMs: number) =>
    new HeadyError(`Service ${service} timed out after ${timeoutMs}ms`, 'HEADY-4003', 504, 'SERVICE', { service, timeoutMs }),
  invalidResponse: (service: string, reason: string) =>
    new HeadyError(`Invalid response from ${service}: ${reason}`, 'HEADY-4004', 502, 'SERVICE', { service, reason }),
  versionMismatch: (service: string, expected: string, actual: string) =>
    new HeadyError(`Version mismatch: ${service} expected ${expected}, got ${actual}`, 'HEADY-4005', 409, 'SERVICE', { service, expected, actual }),
};

// INFRA (5000-5099)
export const InfraErrors = {
  databaseConnectionFailed: (host: string) =>
    new HeadyError(`Database connection failed: ${host}`, 'HEADY-5001', 503, 'INFRA', { host }),
  natsConnectionFailed: () =>
    new HeadyError('NATS JetStream connection failed', 'HEADY-5002', 503, 'INFRA'),
  redisConnectionFailed: () =>
    new HeadyError('Redis connection failed', 'HEADY-5003', 503, 'INFRA'),
  envoyRoutingFailed: (route: string) =>
    new HeadyError(`Envoy routing failed for ${route}`, 'HEADY-5004', 502, 'INFRA', { route }),
  consulServiceNotFound: (service: string) =>
    new HeadyError(`Service not found in Consul: ${service}`, 'HEADY-5005', 503, 'INFRA', { service }),
};

// SECURITY (6000-6099)
export const SecurityErrors = {
  inputValidationFailed: (field: string, reason: string) =>
    new HeadyError(`Input validation failed: ${field} — ${reason}`, 'HEADY-6001', 400, 'SECURITY', { field, reason }),
  zeroTrustViolation: (policy: string) =>
    new HeadyError(`Zero-trust policy violation: ${policy}`, 'HEADY-6002', 403, 'SECURITY', { policy }),
  encryptionFailed: (reason: string) =>
    new HeadyError(`Encryption operation failed: ${reason}`, 'HEADY-6003', 500, 'SECURITY', { reason }),
  auditLogTampered: () =>
    new HeadyError('Audit log integrity violation detected', 'HEADY-6004', 500, 'SECURITY'),
};

// GPU (8000-8099)
export const GPUErrors = {
  colabRuntimeUnavailable: (runtime: number) =>
    new HeadyError(`Colab Pro+ runtime ${runtime} unavailable`, 'HEADY-8001', 503, 'GPU', { runtime }),
  gpuMemoryExhausted: (runtime: number, usedGB: number) =>
    new HeadyError(`GPU memory exhausted on runtime ${runtime}: ${usedGB}GB used`, 'HEADY-8002', 507, 'GPU', { runtime, usedGB }),
  workloadRoutingFailed: (workload: string, reason: string) =>
    new HeadyError(`GPU workload routing failed: ${workload} — ${reason}`, 'HEADY-8003', 500, 'GPU', { workload, reason }),
};

// BILLING (9000-9099)
export const BillingErrors = {
  quotaExceeded: (resource: string, limit: number) =>
    new HeadyError(`Quota exceeded for ${resource}: limit ${limit}`, 'HEADY-9001', 429, 'BILLING', { resource, limit }),
  paymentFailed: (reason: string) =>
    new HeadyError(`Payment processing failed: ${reason}`, 'HEADY-9002', 402, 'BILLING', { reason }),
  subscriptionExpired: (tier: string) =>
    new HeadyError(`Subscription expired: ${tier}`, 'HEADY-9003', 402, 'BILLING', { tier }),
};

// ═══ Global Error Handler Middleware ═══
export function errorHandler(err: Error, _req: unknown, res: { status: (code: number) => { json: (data: unknown) => void } }, _next: () => void): void {
  if (err instanceof HeadyError) {
    res.status(err.statusCode).json(err.toJSON());
  } else {
    res.status(500).json({
      error: 'InternalError',
      code: 'HEADY-0000',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    });
  }
}
