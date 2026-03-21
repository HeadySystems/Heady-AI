/**
 * Heady API Contracts — Schema Registry + Contract Validation
 * Versioned schemas, backward compatibility checks, contract testing
 * Author: Eric Haywood | All constants φ-derived | ESM only
 */
import { createHash } from 'crypto';
import { PHI, PSI, PSI2, phiThreshold, fibonacci } from '../shared/phi-math-v2.js';
import { cslGate, cosineSimilarity } from '../shared/csl-engine-v2.js';

const MAX_SCHEMAS        = fibonacci(14);  // 377
const MAX_VERSIONS       = fibonacci(8);   // 21 per schema
const COMPATIBILITY_MODES = ['BACKWARD', 'FORWARD', 'FULL', 'NONE'];

function sha256(input) { return createHash('sha256').update(String(input)).digest('hex'); }

const schemas = new Map();
const contracts = new Map();
const validationLog = [];
const metrics = { registered: 0, validated: 0, compatChecks: 0, violations: 0 };

function registerSchema(subject, version, schema, compatibility) {
  if (schemas.size >= MAX_SCHEMAS && !schemas.has(subject)) return { error: 'max_schemas_reached' };
  let versions = schemas.get(subject);
  if (!versions) { versions = []; schemas.set(subject, versions); }
  if (versions.length >= MAX_VERSIONS) versions.shift();

  const entry = {
    subject, version: version || versions.length + 1,
    schema, compatibility: compatibility || 'BACKWARD',
    hash: sha256(JSON.stringify(schema)),
    registered: Date.now(),
  };
  versions.push(entry);
  metrics.registered++;
  return { subject, version: entry.version, hash: entry.hash };
}

function getSchema(subject, version) {
  const versions = schemas.get(subject);
  if (!versions) return null;
  if (version) return versions.find(v => v.version === version) || null;
  return versions[versions.length - 1];
}

function checkCompatibility(subject, newSchema) {
  const versions = schemas.get(subject);
  if (!versions || versions.length === 0) return { compatible: true, reason: 'no_previous_version' };
  const latest = versions[versions.length - 1];
  metrics.compatChecks++;

  const mode = latest.compatibility;
  if (mode === 'NONE') return { compatible: true, reason: 'no_check_required' };

  const oldFields = extractFields(latest.schema);
  const newFields = extractFields(newSchema);

  const removedFields = oldFields.filter(f => !newFields.some(n => n.name === f.name));
  const addedFields = newFields.filter(f => !oldFields.some(o => o.name === f.name));
  const changedFields = newFields.filter(f => {
    const old = oldFields.find(o => o.name === f.name);
    return old && old.type !== f.type;
  });

  let compatible = true;
  const issues = [];

  if (mode === 'BACKWARD' || mode === 'FULL') {
    if (removedFields.length > 0) {
      compatible = false;
      issues.push({ type: 'removed_fields', fields: removedFields.map(f => f.name) });
    }
    const addedRequired = addedFields.filter(f => f.required && !f.hasDefault);
    if (addedRequired.length > 0) {
      compatible = false;
      issues.push({ type: 'added_required_without_default', fields: addedRequired.map(f => f.name) });
    }
  }

  if (mode === 'FORWARD' || mode === 'FULL') {
    if (addedFields.length > 0 && addedFields.some(f => f.required)) {
      compatible = false;
      issues.push({ type: 'new_required_fields', fields: addedFields.filter(f => f.required).map(f => f.name) });
    }
  }

  if (changedFields.length > 0) {
    compatible = false;
    issues.push({ type: 'type_changes', fields: changedFields.map(f => f.name) });
  }

  if (!compatible) metrics.violations++;
  return { compatible, mode, issues, hash: sha256(JSON.stringify(newSchema)) };
}

function extractFields(schema) {
  if (!schema || !schema.properties) return [];
  return Object.entries(schema.properties).map(([name, def]) => ({
    name, type: def.type || 'unknown',
    required: (schema.required || []).includes(name),
    hasDefault: def.default !== undefined,
  }));
}

function validatePayload(subject, payload, version) {
  const schemaEntry = getSchema(subject, version);
  if (!schemaEntry) return { valid: false, error: 'schema_not_found' };
  const fields = extractFields(schemaEntry.schema);
  const errors = [];

  for (const field of fields) {
    if (field.required && (payload[field.name] === undefined || payload[field.name] === null)) {
      errors.push({ field: field.name, error: 'required_field_missing' });
    }
    if (payload[field.name] !== undefined && field.type !== 'unknown') {
      const actualType = Array.isArray(payload[field.name]) ? 'array' : typeof payload[field.name];
      if (actualType !== field.type && field.type !== 'any') {
        errors.push({ field: field.name, error: 'type_mismatch', expected: field.type, actual: actualType });
      }
    }
  }

  metrics.validated++;
  const result = { valid: errors.length === 0, errors, schema: schemaEntry.subject, version: schemaEntry.version };
  validationLog.push({ ...result, timestamp: Date.now() });
  return result;
}

function registerContract(name, spec) {
  contracts.set(name, {
    name, producer: spec.producer, consumer: spec.consumer,
    schema: spec.schema, version: spec.version || 1,
    sla: spec.sla || { latencyP99Ms: fibonacci(13) * 10, availabilityPct: phiThreshold(4) * 100 },
    created: Date.now(), hash: sha256(name + JSON.stringify(spec)),
  });
  return { name, registered: true };
}

function listSchemas() {
  return [...schemas.entries()].map(([subject, versions]) => ({
    subject, versions: versions.length, latest: versions[versions.length - 1]?.version,
    compatibility: versions[versions.length - 1]?.compatibility,
  }));
}

function createServer(port = 3384) {
  return import('http').then(({ default: http }) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const respond = (s, b) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(b)); };
      const readBody = () => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => { try { r(JSON.parse(Buffer.concat(c).toString())); } catch { r({}); } }); }});

      if (url.pathname === '/schemas/register' && req.method === 'POST') { const b = await readBody(); respond(201, registerSchema(b.subject, b.version, b.schema, b.compatibility)); }
      else if (url.pathname === '/schemas/get' && req.method === 'GET') { const s = getSchema(url.searchParams.get('subject'), parseInt(url.searchParams.get('version')) || undefined); respond(s ? 200 : 404, s || { error: 'not_found' }); }
      else if (url.pathname === '/schemas/check' && req.method === 'POST') { const b = await readBody(); respond(200, checkCompatibility(b.subject, b.schema)); }
      else if (url.pathname === '/schemas/validate' && req.method === 'POST') { const b = await readBody(); respond(200, validatePayload(b.subject, b.payload, b.version)); }
      else if (url.pathname === '/schemas/list' && req.method === 'GET') respond(200, listSchemas());
      else if (url.pathname === '/contracts/register' && req.method === 'POST') respond(201, registerContract((await readBody()).name, await readBody()));
      else if (url.pathname === '/health') respond(200, { service: 'api-contracts', status: 'healthy', schemas: schemas.size, contracts: contracts.size, metrics }});
      else respond(404, { error: 'not_found' }});
    }});
    server.listen(port);
    return server;
  });
}

export default { createServer, registerSchema, getSchema, checkCompatibility, validatePayload, registerContract, listSchemas };
export { createServer, registerSchema, getSchema, checkCompatibility, validatePayload, registerContract, listSchemas };
