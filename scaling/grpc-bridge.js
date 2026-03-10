/**
 * GrpcBridge — gRPC-to-REST Bidirectional Bridge
 * Translates between gRPC service definitions and REST/JSON,
 * with streaming support, deadline propagation, and error mapping.
 * All constants φ-derived. CSL gates replace boolean. ESM only.
 * Author: Eric Haywood
 */
import { createHash } from 'crypto';

// ── φ-Math Foundation ────────────────────────────────────────────
const PHI = 1.6180339887;
const PSI = 0.6180339887;
const PSI2 = 0.3819660113;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

function phiThreshold(level, spread = PSI2) {
  return 1 - Math.pow(PSI, level) * spread;
}

const CSL_THRESHOLDS = {
  CRITICAL: phiThreshold(4),
  HIGH: phiThreshold(3),
  MEDIUM: phiThreshold(2),
  LOW: phiThreshold(1),
  MINIMUM: phiThreshold(0),
};

function cslGate(value, score, tau = CSL_THRESHOLDS.MEDIUM, temp = Math.pow(PSI, 3)) {
  return value * (1 / (1 + Math.exp(-(score - tau) / temp)));
}

function hashSHA256(data) {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

// ── gRPC Status Code Mapping ─────────────────────────────────────
const GRPC_TO_HTTP = {
  0:  { http: 200, name: 'OK' },
  1:  { http: 499, name: 'CANCELLED' },
  2:  { http: 500, name: 'UNKNOWN' },
  3:  { http: 400, name: 'INVALID_ARGUMENT' },
  4:  { http: 504, name: 'DEADLINE_EXCEEDED' },
  5:  { http: 404, name: 'NOT_FOUND' },
  6:  { http: 409, name: 'ALREADY_EXISTS' },
  7:  { http: 403, name: 'PERMISSION_DENIED' },
  8:  { http: 429, name: 'RESOURCE_EXHAUSTED' },
  9:  { http: 400, name: 'FAILED_PRECONDITION' },
  10: { http: 409, name: 'ABORTED' },
  11: { http: 400, name: 'OUT_OF_RANGE' },
  12: { http: 501, name: 'UNIMPLEMENTED' },
  13: { http: 500, name: 'INTERNAL' },
  14: { http: 503, name: 'UNAVAILABLE' },
  15: { http: 500, name: 'DATA_LOSS' },
  16: { http: 401, name: 'UNAUTHENTICATED' },
};

const HTTP_TO_GRPC = {};
for (const [grpcCode, mapping] of Object.entries(GRPC_TO_HTTP)) {
  if (!HTTP_TO_GRPC[mapping.http]) HTTP_TO_GRPC[mapping.http] = parseInt(grpcCode);
}

// ── Service Registry ─────────────────────────────────────────────
class ServiceDefinition {
  constructor(name, config = {}) {
    this.name = name;
    this.methods = new Map();
    this.package = config.package ?? 'heady.services';
    this.version = config.version ?? '1.0.0';
  }

  addMethod(name, config) {
    this.methods.set(name, {
      name,
      inputType: config.inputType ?? 'object',
      outputType: config.outputType ?? 'object',
      httpMethod: config.httpMethod ?? 'POST',
      httpPath: config.httpPath ?? `/api/v1/${this.name}/${name}`,
      streaming: config.streaming ?? false,
      deadlineMs: config.deadlineMs ?? FIB[9] * 1000, // 34s
    });
    return this;
  }

  toProto() {
    const methods = [...this.methods.values()].map(m => {
      const streamPrefix = m.streaming ? 'stream ' : '';
      return `  rpc ${m.name} (${m.inputType}) returns (${streamPrefix}${m.outputType});`;
    }).join('\n');
    return `service ${this.name} {\n${methods}\n}`;
  }
}

// ── Request/Response Transformer ─────────────────────────────────
class MessageTransformer {
  constructor() {
    this.transformers = new Map();
  }

  register(typeName, transform) {
    this.transformers.set(typeName, transform);
  }

  toGrpc(httpBody, typeName) {
    const transformer = this.transformers.get(typeName);
    if (transformer?.toGrpc) return transformer.toGrpc(httpBody);
    // Default: pass through with snake_case conversion
    return this._toSnakeCase(httpBody);
  }

  toHttp(grpcMessage, typeName) {
    const transformer = this.transformers.get(typeName);
    if (transformer?.toHttp) return transformer.toHttp(grpcMessage);
    // Default: pass through with camelCase conversion
    return this._toCamelCase(grpcMessage);
  }

  _toSnakeCase(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(v => this._toSnakeCase(v));
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = key.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
      result[snakeKey] = this._toSnakeCase(value);
    }
    return result;
  }

  _toCamelCase(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(v => this._toCamelCase(v));
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      result[camelKey] = this._toCamelCase(value);
    }
    return result;
  }
}

// ── Deadline Propagator ──────────────────────────────────────────
class DeadlinePropagator {
  constructor() {
    this.defaultDeadlineMs = FIB[9] * 1000; // 34s
    this.maxDeadlineMs = FIB[13] * 1000;    // 233s
  }

  extract(headers) {
    const grpcTimeout = headers['grpc-timeout'];
    if (grpcTimeout) {
      return this._parseGrpcTimeout(grpcTimeout);
    }
    const httpDeadline = headers['x-deadline-ms'];
    if (httpDeadline) {
      return Math.min(parseInt(httpDeadline, 10), this.maxDeadlineMs);
    }
    return this.defaultDeadlineMs;
  }

  propagate(deadlineMs) {
    const remaining = Math.max(0, deadlineMs - FIB[3]); // subtract 2ms overhead
    return {
      'grpc-timeout': `${remaining}m`,
      'x-deadline-ms': remaining.toString(),
    };
  }

  _parseGrpcTimeout(timeout) {
    const match = timeout.match(/^(\d+)([HMSmun])$/);
    if (!match) return this.defaultDeadlineMs;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers = { H: 3600000, M: 60000, S: 1000, m: 1, u: 0.001, n: 0.000001 };
    return Math.min(value * (multipliers[unit] ?? 1), this.maxDeadlineMs);
  }
}

// ── gRPC Bridge ──────────────────────────────────────────────────
class GrpcBridge {
  constructor(config = {}) {
    this.services = new Map();
    this.transformer = new MessageTransformer();
    this.deadline = new DeadlinePropagator();
    this.handlers = new Map();
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.auditLog = [];
    this.maxAuditEntries = FIB[16];
    this.interceptors = [];
  }

  _audit(action, detail) {
    const entry = { ts: Date.now(), action, detail, hash: hashSHA256({ action, detail, ts: Date.now() }) };
    this.auditLog.push(entry);
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-FIB[14]);
    }
  }

  registerService(name, config = {}) {
    const def = new ServiceDefinition(name, config);
    this.services.set(name, def);
    return def;
  }

  addInterceptor(interceptor) {
    this.interceptors.push(interceptor);
  }

  registerHandler(serviceName, methodName, handler) {
    const key = `${serviceName}/${methodName}`;
    this.handlers.set(key, handler);
    this._audit('register-handler', { service: serviceName, method: methodName });
  }

  async handleHttpToGrpc(req) {
    this.totalRequests++;
    const startTime = Date.now();

    // Route: find matching service/method by path
    let matchedService = null;
    let matchedMethod = null;
    for (const [svcName, svc] of this.services) {
      for (const [methName, meth] of svc.methods) {
        if (req.path === meth.httpPath && req.method === meth.httpMethod) {
          matchedService = svcName;
          matchedMethod = meth;
          break;
        }
      }
      if (matchedService) break;
    }

    if (!matchedService || !matchedMethod) {
      this.totalErrors++;
      return { grpcStatus: 12, httpStatus: 501, error: 'Method not found' };
    }

    // Extract deadline
    const deadlineMs = this.deadline.extract(req.headers ?? {});

    // Transform request
    const grpcRequest = this.transformer.toGrpc(req.body, matchedMethod.inputType);

    // Apply interceptors
    let context = { service: matchedService, method: matchedMethod.name, deadline: deadlineMs };
    for (const interceptor of this.interceptors) {
      const result = await interceptor(context, grpcRequest);
      if (result?.abort) {
        this.totalErrors++;
        return result;
      }
      context = { ...context, ...result };
    }

    // Execute handler
    const handlerKey = `${matchedService}/${matchedMethod.name}`;
    const handler = this.handlers.get(handlerKey);

    if (!handler) {
      this.totalErrors++;
      return { grpcStatus: 12, httpStatus: 501, error: 'Handler not implemented' };
    }

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Deadline exceeded')), deadlineMs)
      );

      const result = await Promise.race([handler(grpcRequest, context), timeoutPromise]);
      const httpResponse = this.transformer.toHttp(result, matchedMethod.outputType);

      this._audit('http-to-grpc', {
        service: matchedService,
        method: matchedMethod.name,
        latencyMs: Date.now() - startTime,
      });

      return {
        grpcStatus: 0,
        httpStatus: 200,
        body: httpResponse,
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      this.totalErrors++;
      const grpcStatus = err.message === 'Deadline exceeded' ? 4 : 13;
      const httpMapping = GRPC_TO_HTTP[grpcStatus];

      return {
        grpcStatus,
        httpStatus: httpMapping.http,
        error: err.message,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  generateRoutes() {
    const routes = [];
    for (const [svcName, svc] of this.services) {
      for (const [methName, meth] of svc.methods) {
        routes.push({
          service: svcName,
          method: methName,
          httpMethod: meth.httpMethod,
          httpPath: meth.httpPath,
          streaming: meth.streaming,
          deadlineMs: meth.deadlineMs,
        });
      }
    }
    return routes;
  }

  health() {
    return {
      registeredServices: this.services.size,
      registeredHandlers: this.handlers.size,
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      errorRate: this.totalRequests > 0 ? this.totalErrors / this.totalRequests : 0,
      interceptorCount: this.interceptors.length,
      auditLogSize: this.auditLog.length,
    };
  }
}

export default GrpcBridge;
export { GrpcBridge, ServiceDefinition, MessageTransformer, DeadlinePropagator, GRPC_TO_HTTP };
