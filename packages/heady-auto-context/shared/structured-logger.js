/**
 * ═══════════════════════════════════════════════════════════
 * HEADY™ STRUCTURED LOGGER
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 * JSON-structured logging — zero console.log
 * ═══════════════════════════════════════════════════════════
 */

import { randomUUID } from 'node:crypto';

export function createLogger(serviceName) {
  const baseFields = {
    service: serviceName,
    pid: process.pid,
  };

  function emit(level, data, message) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      ...baseFields,
      trace_id: data?.trace_id || randomUUID(),
      message,
      ...(typeof data === 'object' && data !== null ? { context: data } : {}),
    };
    process.stdout.write(JSON.stringify(entry) + '\n');
  }

  return {
    info:  (data, msg) => emit('info', data, msg || (typeof data === 'string' ? data : '')),
    warn:  (data, msg) => emit('warn', data, msg || (typeof data === 'string' ? data : '')),
    error: (data, msg) => emit('error', data, msg || (typeof data === 'string' ? data : '')),
    debug: (data, msg) => emit('debug', data, msg || (typeof data === 'string' ? data : '')),
    fatal: (data, msg) => emit('fatal', data, msg || (typeof data === 'string' ? data : '')),
  };
}
