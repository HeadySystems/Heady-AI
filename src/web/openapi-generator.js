/**
 * openapi-generator.js — Auto-Generate OpenAPI 3.1 Spec from Heady Routes
 *
 * Scans route definitions to build a complete OpenAPI specification
 * with φ-scaled rate limit documentation, security schemes, and examples.
 *
 * Eric Haywood — HeadySystems
 * License: PROPRIETARY
 */

import { PHI, PSI, phiThreshold, fibSequence } from '../shared/phi-math.js';

// ── φ-Derived Constants ──────────────────────────────────
const MAX_ENDPOINTS     = 233;          // fib(13)
const MAX_PARAMS        = 21;           // fib(8)
const MAX_EXAMPLES      = 8;            // fib(6)
const RATE_LIMITS = {
  standard: 89,                         // fib(11) req/min
  burst:    144,                        // fib(12) req/min
  limited:  34,                         // fib(9) req/min
};

// ── Base Spec ────────────────────────────────────────────
function createBaseSpec(options = {}) {
  const {
    title = 'Heady API',
    description = 'Sovereign AI Platform API — Alive Software Architecture',
    version = '1.0.0',
    baseUrl = 'https://api.headyme.com',
    contactName = 'Eric Haywood',
    contactEmail = 'eric@headysystems.com',
    license = 'PROPRIETARY',
  } = options;

  return {
    openapi: '3.1.0',
    info: {
      title,
      description,
      version,
      contact: {
        name: contactName,
        email: contactEmail,
        url: 'https://headysystems.com',
      },
      license: { name: license },
      'x-phi-constants': {
        PHI: PHI,
        PSI: PSI,
        NOTE: 'All rate limits and sizing use Fibonacci numbers; all thresholds are phi-derived.',
      },
    },
    servers: [
      { url: baseUrl, description: 'Production' },
      { url: 'https://staging-api.headyme.com', description: 'Staging' },
    ],
    paths: {},
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token delivered via httpOnly cookie. Bearer auth for API clients.',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'heady_session',
          description: 'httpOnly session cookie (primary auth method — NO localStorage)',
        },
      },
      schemas: {},
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Authentication required' },
                  code: { type: 'string', example: 'AUTH_REQUIRED' },
                },
              },
            },
          },
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Rate limit exceeded' },
                  retryAfter: { type: 'integer', example: 34, description: 'Seconds until retry (fib(9))' },
                },
              },
            },
          },
          headers: {
            'Retry-After': { schema: { type: 'integer' }, description: 'Seconds until rate limit resets' },
            'X-RateLimit-Limit': { schema: { type: 'integer' }, description: 'Request limit per window (Fibonacci-sized)' },
            'X-RateLimit-Remaining': { schema: { type: 'integer' } },
          },
        },
      },
    },
    security: [{ cookieAuth: [] }],
  };
}

// ── Route-to-Endpoint Converter ──────────────────────────
function routeToEndpoint(route) {
  const {
    method = 'get',
    path,
    summary,
    description,
    tags = [],
    parameters = [],
    requestBody,
    responses = {},
    security,
    rateLimit = 'standard',
    deprecated = false,
  } = route;

  const endpoint = {
    summary,
    description,
    tags,
    deprecated,
    'x-rate-limit': RATE_LIMITS[rateLimit] || RATE_LIMITS.standard,
  };

  if (parameters.length > 0) {
    endpoint.parameters = parameters.slice(0, MAX_PARAMS).map(p => ({
      name: p.name,
      in: p.in || 'query',
      required: p.required ?? false,
      schema: p.schema || { type: 'string' },
      description: p.description || '',
    }));
  }

  if (requestBody) {
    endpoint.requestBody = {
      required: requestBody.required ?? true,
      content: {
        'application/json': {
          schema: requestBody.schema || { type: 'object' },
          ...(requestBody.example && { example: requestBody.example }),
        },
      },
    };
  }

  // Default responses
  endpoint.responses = {
    '200': responses['200'] || { description: 'Success' },
    '401': { '$ref': '#/components/responses/UnauthorizedError' },
    '429': { '$ref': '#/components/responses/RateLimitError' },
    ...responses,
  };

  if (security !== undefined) {
    endpoint.security = security;
  }

  return { path, method: method.toLowerCase(), endpoint };
}

// ── Schema Helpers ───────────────────────────────────────
function paginatedSchema(itemSchema, itemName = 'items') {
  return {
    type: 'object',
    properties: {
      [itemName]: { type: 'array', items: itemSchema },
      total: { type: 'integer' },
      page: { type: 'integer' },
      perPage: { type: 'integer', description: `Items per page (Fibonacci-sized: ${fibSequence?.slice(5, 10).join(', ') || '5,8,13,21,34'})` },
      hasMore: { type: 'boolean' },
    },
  };
}

function errorSchema() {
  return {
    type: 'object',
    properties: {
      error: { type: 'string' },
      code: { type: 'string' },
      details: { type: 'object', additionalProperties: true },
      requestId: { type: 'string', format: 'uuid' },
      timestamp: { type: 'string', format: 'date-time' },
    },
    required: ['error', 'code'],
  };
}

// ── Main Generator ───────────────────────────────────────
/**
 * Generate a complete OpenAPI 3.1 specification from route definitions
 */
export function generateSpec(routes = [], options = {}) {
  const spec = createBaseSpec(options);
  
  // Add common schemas
  spec.components.schemas.Error = errorSchema();
  spec.components.schemas.HealthCheck = {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
      uptime: { type: 'number' },
      version: { type: 'string' },
      phi: { type: 'number', example: PHI, description: 'Golden ratio constant' },
      services: { type: 'object', additionalProperties: { type: 'string' } },
    },
  };
  
  // Add custom schemas from options
  if (options.schemas) {
    Object.assign(spec.components.schemas, options.schemas);
  }

  // Process routes
  for (const route of routes.slice(0, MAX_ENDPOINTS)) {
    const { path, method, endpoint } = routeToEndpoint(route);
    if (!spec.paths[path]) spec.paths[path] = {};
    spec.paths[path][method] = endpoint;
  }

  return spec;
}

/**
 * Serialize spec to YAML-like format (JSON with comments)
 */
export function specToJson(spec, pretty = true) {
  return JSON.stringify(spec, null, pretty ? 2 : 0);
}

/**
 * Generate Heady-standard health endpoint
 */
export function healthEndpoint() {
  return {
    method: 'get',
    path: '/health',
    summary: 'Health check',
    description: 'Returns service health with φ-scaled metrics',
    tags: ['System'],
    security: [],
    responses: {
      '200': {
        description: 'Service is healthy',
        content: { 'application/json': { schema: { '$ref': '#/components/schemas/HealthCheck' } } },
      },
    },
  };
}

export { createBaseSpec, routeToEndpoint, paginatedSchema, errorSchema, RATE_LIMITS };
export default { generateSpec, specToJson, healthEndpoint, createBaseSpec, RATE_LIMITS };
