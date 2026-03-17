/**
 * Heady™ Structured Logger — Pino + Trace Context
 * Drop-in for console.log. Patent coverage: HS-053 (Neural Stream Telemetry)
 * Migration: s/console\.log(/log.info({/ across monorepo
 * @module core/logging/heady-logger
 */
import pino from 'pino';
import { randomUUID } from 'node:crypto';
import { CSL, PHI } from '../constants/phi.js';

const BASE_CONFIG = {
  level: process.env.LOG_LEVEL ?? 'info',
  messageKey: 'msg',
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { service: process.env.SERVICE_NAME ?? 'heady', env: process.env.NODE_ENV ?? 'production', version: process.env.npm_package_version ?? '0.0.0' },
  serializers: { err: pino.stdSerializers.err, error: pino.stdSerializers.err, req: pino.stdSerializers.req, res: pino.stdSerializers.res },
  formatters: { level: (label) => ({ severity: label.toUpperCase() }) },
};

export const rootLogger = pino(BASE_CONFIG);

export function createLogger(context = {}) {
  return rootLogger.child({ traceId: context.traceId ?? randomUUID(), beeId: context.beeId, swarmId: context.swarmId, pipelineStage: context.pipelineStage, ...context });
}

export function cslLog(logger, confidence, msg, data = {}) {
  if (confidence >= CSL.CRITICAL) return logger.error({ csl: confidence, ...data }, msg);
  if (confidence >= CSL.HIGH)     return logger.warn({ csl: confidence, ...data }, msg);
  if (confidence >= CSL.BOOST)    return logger.info({ csl: confidence, ...data }, msg);
  if (confidence >= CSL.INCLUDE)  return logger.debug({ csl: confidence, ...data }, msg);
}

export function trace(logger, label) {
  const start = Date.now();
  return {
    end: (data = {}) => { const ms = Date.now()-start; logger.info({ label, ms, phiLatency: ms/(PHI*1000), ...data }, `trace:${label}`); return ms; },
    error: (err, data = {}) => { const ms = Date.now()-start; logger.error({ label, ms, err, ...data }, `trace:${label}:error`); return ms; },
  };
}
