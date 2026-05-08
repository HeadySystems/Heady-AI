/**
 * HeadyAuth Structured JSON Logger
 * Zero console.log. JSON to stdout. Correlation ID support.
 *
 * © 2026 HeadySystems Inc. All Rights Reserved.
 */
'use strict';

const SERVICE = process.env.SERVICE_NAME || 'heady-auth';
const VERSION = '5.0.0';
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
const currentLevel = LEVELS[process.env.LOG_LEVEL || 'info'] || 1;

/**
 * Write a structured log entry.
 * @param {'debug'|'info'|'warn'|'error'|'fatal'} level
 * @param {string} message
 * @param {object} [data]
 */
function log(level, message, data = {}) {
  if (LEVELS[level] < currentLevel) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE,
    version: VERSION,
    message,
    ...data,
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

module.exports = { log };
