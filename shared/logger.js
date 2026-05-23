'use strict';

/**
 * @fileoverview Heady™ Shared Logger — Pino-based structured logging
 * @description Central logger with redaction, pretty-printing in dev,
 *              and child-logger factory for per-component tagging.
 * @version 2.0.0
 */

const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
  base: { service: process.env.HEADY_SERVICE || 'heady', version: '4.1.0' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ['req.headers.authorization', 'req.headers["x-heady-key"]', 'password', 'secret', 'token'],
});

module.exports = logger;
module.exports.createChildLogger = (name) => logger.child({ component: name });
