'use strict';
/**
 * Heady™ Schema Registry — shared event/message schemas for inter-service communication.
 * © 2026 HeadySystems Inc.
 */

const _schemas = new Map();

function register(name, schema) {
  _schemas.set(name, { name, schema, version: ((_schemas.get(name)?.version) || 0) + 1, registeredAt: new Date().toISOString() });
}

function get(name) { return _schemas.get(name); }
function validate(name, data) {
  const entry = _schemas.get(name);
  if (!entry) throw new Error(`Schema "${name}" not registered`);
  const errors = [];
  for (const [field, rules] of Object.entries(entry.schema)) {
    if (rules.required && (data[field] === undefined || data[field] === null)) {
      errors.push(`Missing required field: ${field}`);
    }
    if (rules.type && data[field] !== undefined && typeof data[field] !== rules.type) {
      errors.push(`Field "${field}" expected ${rules.type}, got ${typeof data[field]}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

function listSchemas() { return Array.from(_schemas.values()).map(s => ({ name: s.name, version: s.version })); }

// Pre-register common Heady event schemas
register('user.created', { userId: { type: 'string', required: true }, email: { type: 'string', required: true }, tier: { type: 'string', required: false } });
register('session.created', { sessionId: { type: 'string', required: true }, userId: { type: 'string', required: true } });
register('billing.charge', { userId: { type: 'string', required: true }, amount: { type: 'number', required: true }, currency: { type: 'string', required: true } });
register('notification.send', { to: { type: 'string', required: true }, channel: { type: 'string', required: true }, message: { type: 'string', required: true } });
register('search.query', { query: { type: 'string', required: true }, type: { type: 'string', required: false } });

module.exports = { register, get, validate, listSchemas };
