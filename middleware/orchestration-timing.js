// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Orchestration Timing Middleware v1.0.0                 ║
// ║  Measures and exposes orchestration-layer latency for          ║
// ║  transparency and competitive benchmarking                     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Express middleware that measures orchestration overhead (excluding LLM inference time)
 * and exposes it via the X-Orchestration-Time-Ms response header.
 *
 * This is a unique competitive differentiator — no major platform (LangChain, CrewAI,
 * AutoGen, OpenAI Agents SDK) publishes orchestration latency benchmarks.
 *
 * Usage:
 *   import { orchestrationTiming } from './orchestration-timing.js';
 *   app.use(orchestrationTiming());
 *
 * Headers added to every response:
 *   X-Orchestration-Time-Ms: 12        (total orchestration time)
 *   X-Heady-Trace-Id: abc123           (correlation ID)
 *   X-Request-Start: 1716932400000     (request start timestamp)
 *
 * To exclude LLM inference time, call req.markInferenceStart() before
 * an LLM call and req.markInferenceEnd() after — the middleware will
 * subtract inference time from the total.
 */

import { randomBytes } from 'node:crypto';

/**
 * Creates the orchestration timing middleware.
 * @param {object} [options]
 * @param {string} [options.traceHeader='X-Heady-Trace-Id'] - Header name for trace ID
 * @param {string} [options.timingHeader='X-Orchestration-Time-Ms'] - Header name for timing
 * @param {boolean} [options.includeServerTiming=true] - Also expose via Server-Timing header
 * @returns {Function} Express middleware
 */
export function orchestrationTiming(options = {}) {
  const {
    traceHeader = 'X-Heady-Trace-Id',
    timingHeader = 'X-Orchestration-Time-Ms',
    includeServerTiming = true,
  } = options;

  return function orchestrationTimingMiddleware(req, res, next) {
    const startHr = process.hrtime.bigint();
    const startMs = Date.now();

    // Generate or propagate trace ID
    const traceId = req.headers[traceHeader.toLowerCase()]
      || `hdy-${randomBytes(8).toString('hex')}`;

    req.headyTraceId = traceId;
    req.requestStartMs = startMs;

    // Inference time tracking — agents call these around LLM API calls
    let totalInferenceNs = 0n;
    let inferenceStartNs = null;

    req.markInferenceStart = function markInferenceStart() {
      inferenceStartNs = process.hrtime.bigint();
    };

    req.markInferenceEnd = function markInferenceEnd() {
      if (inferenceStartNs !== null) {
        totalInferenceNs += process.hrtime.bigint() - inferenceStartNs;
        inferenceStartNs = null;
      }
    };

    // Hook into response finish to calculate timing
    const originalEnd = res.end;
    res.end = function patchedEnd(...args) {
      const endHr = process.hrtime.bigint();
      const totalNs = endHr - startHr;
      const orchestrationNs = totalNs - totalInferenceNs;
      const orchestrationMs = Number(orchestrationNs / 1_000_000n);
      const totalMs = Number(totalNs / 1_000_000n);
      const inferenceMs = Number(totalInferenceNs / 1_000_000n);

      // Set timing headers
      if (!res.headersSent) {
        res.setHeader(traceHeader, traceId);
        res.setHeader(timingHeader, String(orchestrationMs));
        res.setHeader('X-Request-Start', String(startMs));
        res.setHeader('X-Total-Time-Ms', String(totalMs));

        if (inferenceMs > 0) {
          res.setHeader('X-Inference-Time-Ms', String(inferenceMs));
        }

        if (includeServerTiming) {
          const parts = [
            `orchestration;dur=${orchestrationMs};desc="Orchestration Layer"`,
          ];
          if (inferenceMs > 0) {
            parts.push(`inference;dur=${inferenceMs};desc="LLM Inference"`);
          }
          parts.push(`total;dur=${totalMs};desc="Total"`);
          res.setHeader('Server-Timing', parts.join(', '));
        }
      }

      return originalEnd.apply(this, args);
    };

    // Set trace ID early so downstream middleware can use it
    res.setHeader(traceHeader, traceId);

    next();
  };
}

/**
 * Creates a simple timing tracker for non-Express contexts (Workers, Hono, etc.)
 * @returns {{ start: Function, markInferenceStart: Function, markInferenceEnd: Function, finish: Function }}
 */
export function createTimingTracker() {
  const startHr = process.hrtime.bigint();
  let totalInferenceNs = 0n;
  let inferenceStartNs = null;

  return {
    start: startHr,
    markInferenceStart() {
      inferenceStartNs = process.hrtime.bigint();
    },
    markInferenceEnd() {
      if (inferenceStartNs !== null) {
        totalInferenceNs += process.hrtime.bigint() - inferenceStartNs;
        inferenceStartNs = null;
      }
    },
    finish() {
      const endHr = process.hrtime.bigint();
      const totalNs = endHr - startHr;
      const orchestrationNs = totalNs - totalInferenceNs;
      return {
        orchestrationMs: Number(orchestrationNs / 1_000_000n),
        inferenceMs: Number(totalInferenceNs / 1_000_000n),
        totalMs: Number(totalNs / 1_000_000n),
      };
    },
  };
}
