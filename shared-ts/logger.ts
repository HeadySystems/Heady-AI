/**
 * Heady™ Structured JSON Logger v4.0.0
 * NO console.log — ALL output is structured JSON with correlation IDs
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import crypto from 'crypto';

// ═══ Types ═══
interface LogMeta {
  [key: string]: string | number | boolean | undefined | null;
}

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  service: string;
  msg: string;
  timestamp: string;
  correlationId: string;
  version: string;
  environment: string;
  [key: string]: string | number | boolean | undefined | null;
}

interface LoggerConfig {
  service: string;
  version?: string;
  minLevel?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
}

// ═══ Level Hierarchy ═══
const LEVEL_ORDER: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

// ═══ Correlation ID Store (async-local-storage pattern) ═══
let currentCorrelationId: string = crypto.randomUUID();

export function setCorrelationId(id: string): void {
  currentCorrelationId = id;
}

export function getCorrelationId(): string {
  return currentCorrelationId;
}

export function generateCorrelationId(): string {
  const id = crypto.randomUUID();
  currentCorrelationId = id;
  return id;
}

// ═══ Logger Factory ═══
export function createLogger(config: LoggerConfig | string) {
  const cfg: LoggerConfig = typeof config === 'string'
    ? { service: config }
    : config;

  const service = cfg.service;
  const version = cfg.version || process.env.npm_package_version || '4.0.0';
  const environment = process.env.NODE_ENV || 'development';
  const minLevel = cfg.minLevel || (environment === 'production' ? 'info' : 'debug');
  const minOrder = LEVEL_ORDER[minLevel] ?? 0;

  function emit(level: LogEntry['level'], msg: string, meta?: LogMeta): void {
    if ((LEVEL_ORDER[level] ?? 0) < minOrder) return;

    const entry: LogEntry = {
      level,
      service,
      msg,
      timestamp: new Date().toISOString(),
      correlationId: currentCorrelationId,
      version,
      environment,
      ...meta,
    };

    const output = JSON.stringify(entry) + '\n';

    if (level === 'error' || level === 'fatal') {
      process.stderr.write(output);
    } else {
      process.stdout.write(output);
    }
  }

  return {
    debug: (msg: string, meta?: LogMeta) => emit('debug', msg, meta),
    info:  (msg: string, meta?: LogMeta) => emit('info', msg, meta),
    warn:  (msg: string, meta?: LogMeta) => emit('warn', msg, meta),
    error: (msg: string, meta?: LogMeta) => emit('error', msg, meta),
    fatal: (msg: string, meta?: LogMeta) => emit('fatal', msg, meta),

    /** Create a child logger with additional default metadata */
    child: (childMeta: LogMeta) => {
      const childEmit = (level: LogEntry['level'], msg: string, meta?: LogMeta) => {
        emit(level, msg, { ...childMeta, ...meta });
      };
      return {
        debug: (msg: string, meta?: LogMeta) => childEmit('debug', msg, meta),
        info:  (msg: string, meta?: LogMeta) => childEmit('info', msg, meta),
        warn:  (msg: string, meta?: LogMeta) => childEmit('warn', msg, meta),
        error: (msg: string, meta?: LogMeta) => childEmit('error', msg, meta),
        fatal: (msg: string, meta?: LogMeta) => childEmit('fatal', msg, meta),
      };
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
