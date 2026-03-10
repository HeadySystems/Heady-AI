/**
 * Heady Schema Registry — Sacred Genesis v4.0.0
 * Manages event schemas, API schemas, and contract definitions
 * Port: 3370
 *
 * @module schema-registry
 * @author Eric Haywood, HeadySystems Inc.
 */

'use strict';

const http = require('http');
const { PHI, PSI, fib, phiThreshold } = require('../../shared/phi-math');

/** @type {number} Service port */
const PORT = 3370;

/** @type {number} Maximum schema versions retained — fib(10) */
const MAX_VERSIONS = fib(10);

/** @type {number} Maximum schemas — fib(12) */
const MAX_SCHEMAS = fib(12);

/**
 * Schema store
 * @type {Map<string, Array<{version: number, schema: object, createdAt: string, hash: string}>>}
 */
const schemas = new Map();

/**
 * Compatibility modes for schema evolution
 * @readonly
 * @enum {string}
 */
const COMPAT_MODES = {
  NONE: 'NONE',
  BACKWARD: 'BACKWARD',
  FORWARD: 'FORWARD',
  FULL: 'FULL'
};

/** @type {Map<string, string>} Subject compatibility overrides */
const compatConfig = new Map();

/** @type {string} Global default compatibility */
let globalCompat = COMPAT_MODES.BACKWARD;

/**
 * Compute a simple hash for schema content
 * @param {object} schema - The schema object
 * @returns {string} Hex hash string
 */
function hashSchema(schema) {
  const str = JSON.stringify(schema, Object.keys(schema).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Validate basic schema structure
 * @param {object} schema - Schema to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateSchema(schema) {
  if (!schema || typeof schema !== 'object') {
    return { valid: false, error: 'Schema must be a non-null object' };
  }
  if (!schema.type) {
    return { valid: false, error: 'Schema must have a type field' };
  }
  return { valid: true };
}

/**
 * Check backward compatibility between schemas
 * @param {object} oldSchema - Previous schema version
 * @param {object} newSchema - New schema version
 * @returns {{compatible: boolean, reason?: string}}
 */
function checkBackwardCompat(oldSchema, newSchema) {
  if (!oldSchema.properties || !newSchema.properties) {
    return { compatible: true };
  }
  const oldRequired = new Set(oldSchema.required || []);
  const newRequired = new Set(newSchema.required || []);
  for (const field of newRequired) {
    if (!oldRequired.has(field) && !(field in (oldSchema.properties || {}))) {
      return { compatible: false, reason: `New required field "${field}" breaks backward compatibility` };
    }
  }
  return { compatible: true };
}

/**
 * Register a new schema version
 * @param {string} subject - Schema subject name
 * @param {object} schema - Schema definition
 * @returns {{id: number, version: number, hash: string} | {error: string}}
 */
function registerSchema(subject, schema) {
  const validation = validateSchema(schema);
  if (!validation.valid) {
    return { error: validation.error };
  }

  if (!schemas.has(subject)) {
    if (schemas.size >= MAX_SCHEMAS) {
      return { error: `Maximum schema count (${MAX_SCHEMAS}) reached` };
    }
    schemas.set(subject, []);
  }

  const versions = schemas.get(subject);
  const hash = hashSchema(schema);

  if (versions.length > 0 && versions[versions.length - 1].hash === hash) {
    const latest = versions[versions.length - 1];
    return { id: latest.version, version: latest.version, hash };
  }

  const compat = compatConfig.get(subject) || globalCompat;
  if (compat !== COMPAT_MODES.NONE && versions.length > 0) {
    const lastSchema = versions[versions.length - 1].schema;
    if (compat === COMPAT_MODES.BACKWARD || compat === COMPAT_MODES.FULL) {
      const check = checkBackwardCompat(lastSchema, schema);
      if (!check.compatible) {
        return { error: check.reason };
      }
    }
  }

  const version = versions.length + 1;
  versions.push({
    version,
    schema,
    createdAt: new Date().toISOString(),
    hash
  });

  if (versions.length > MAX_VERSIONS) {
    versions.shift();
  }

  return { id: version, version, hash };
}

/**
 * Get schema by subject and optional version
 * @param {string} subject - Schema subject name
 * @param {number|null} version - Optional specific version
 * @returns {object|null}
 */
function getSchema(subject, version) {
  const versions = schemas.get(subject);
  if (!versions || versions.length === 0) return null;
  if (version) {
    return versions.find(v => v.version === version) || null;
  }
  return versions[versions.length - 1];
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean);

  res.setHeader('Content-Type', 'application/json');

  if (url.pathname === '/health' || url.pathname === '/healthz') {
    res.writeHead(200);
    res.end(JSON.stringify({
      service: 'heady-schema-registry',
      status: 'healthy',
      version: '4.0.0',
      schemas: schemas.size,
      maxSchemas: MAX_SCHEMAS,
      maxVersions: MAX_VERSIONS,
      globalCompat
    }));
    return;
  }

  if (url.pathname === '/metrics') {
    let totalVersions = 0;
    for (const [, v] of schemas) totalVersions += v.length;
    const metrics = [
      '# HELP heady_schema_registry_schemas Total registered schemas',
      '# TYPE heady_schema_registry_schemas gauge',
      `heady_schema_registry_schemas ${schemas.size}`,
      '# HELP heady_schema_registry_versions Total schema versions',
      '# TYPE heady_schema_registry_versions gauge',
      `heady_schema_registry_versions ${totalVersions}`,
    ].join('\n');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(metrics);
    return;
  }

  if (req.method === 'GET' && parts[0] === 'subjects') {
    if (parts.length === 1) {
      res.writeHead(200);
      res.end(JSON.stringify(Array.from(schemas.keys())));
      return;
    }
    if (parts.length >= 2) {
      const subject = decodeURIComponent(parts[1]);
      const version = parts[2] === 'versions' ? null : parseInt(parts[2], 10);
      if (parts[2] === 'versions') {
        const versions = schemas.get(subject);
        if (!versions) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Subject not found' }));
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify(versions.map(v => v.version)));
        return;
      }
      const schema = getSchema(subject, version || null);
      if (!schema) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Schema not found' }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(schema));
      return;
    }
  }

  if (req.method === 'POST' && parts[0] === 'subjects' && parts.length >= 2) {
    const subject = decodeURIComponent(parts[1]);
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { schema } = JSON.parse(body);
        const result = registerSchema(subject, schema);
        if (result.error) {
          res.writeHead(409);
          res.end(JSON.stringify(result));
          return;
        }
        res.writeHead(201);
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  process.stdout.write(JSON.stringify({
    level: 'info',
    service: 'heady-schema-registry',
    port: PORT,
    message: 'Schema registry started',
    maxSchemas: MAX_SCHEMAS,
    maxVersions: MAX_VERSIONS,
    globalCompat
  }) + '\n');
});
