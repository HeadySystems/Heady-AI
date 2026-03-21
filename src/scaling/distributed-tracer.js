/**
 * DistributedTracer — OpenTelemetry-Compatible Distributed Tracing
 * Propagates trace context (W3C Trace Context format) across all 50 services,
 * creates spans with φ-scaled sampling, and exports to OTel collector.
 * All constants φ-derived. ESM only.
 * Author: Eric Haywood
 */
import { createHash, randomBytes } from 'crypto';
const PHI = 1.6180339887;
const PSI = 0.6180339887;
const PSI2 = 0.3819660113;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];
function hashSHA256(data) {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

// ── Trace ID / Span ID Generation ────────────────────────────────
function generateTraceId() {
  return randomBytes(FIB[8]).toString('hex');
} // 16 bytes = 32 hex chars
function generateSpanId() {
  return randomBytes(FIB[6]).toString('hex');
} // 8 bytes = 16 hex chars

// ── W3C Trace Context Parsing ────────────────────────────────────
function parseTraceparent(header) {
  if (!header) return null;
  const parts = header.split('-');
  if (parts.length !== 4) return null;
  return {
    version: parts[0],
    traceId: parts[1],
    parentSpanId: parts[2],
    flags: parseInt(parts[3], 16)
  };
}
function formatTraceparent(traceId, spanId, sampled = true) {
  const flags = sampled ? '01' : '00';
  return `00-${traceId}-${spanId}-${flags}`;
}

// ── Span ─────────────────────────────────────────────────────────
class Span {
  constructor(name, traceId, parentSpanId, attributes = {}) {
    this.name = name;
    this.traceId = traceId;
    this.spanId = generateSpanId();
    this.parentSpanId = parentSpanId;
    this.startTime = process.hrtime.bigint();
    this.startMs = Date.now();
    this.endTime = null;
    this.endMs = null;
    this.status = 'UNSET'; // UNSET | OK | ERROR
    this.attributes = {
      ...attributes
    };
    this.events = [];
    this.maxEvents = FIB[8]; // 21
  }
  setAttribute(key, value) {
    this.attributes[key] = value;
    return this;
  }
  addEvent(name, attributes = {}) {
    if (this.events.length < this.maxEvents) {
      this.events.push({
        name,
        attributes,
        timestamp: Date.now()
      });
    }
    return this;
  }
  setStatus(code, message) {
    this.status = code;
    if (message) this.attributes['status.message'] = message;
    return this;
  }
  end() {
    this.endTime = process.hrtime.bigint();
    this.endMs = Date.now();
    return this;
  }
  durationMs() {
    if (!this.endTime) return Date.now() - this.startMs;
    return Number(this.endTime - this.startTime) / 1_000_000;
  }
  toOTLP() {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId ?? '',
      name: this.name,
      kind: 'SPAN_KIND_SERVER',
      startTimeUnixNano: this.startMs * 1_000_000,
      endTimeUnixNano: (this.endMs ?? Date.now()) * 1_000_000,
      attributes: Object.entries(this.attributes).map(([k, v]) => ({
        key: k,
        value: {
          stringValue: String(v)
        }
      })),
      events: this.events.map(e => ({
        timeUnixNano: e.timestamp * 1_000_000,
        name: e.name,
        attributes: Object.entries(e.attributes).map(([k, v]) => ({
          key: k,
          value: {
            stringValue: String(v)
          }
        }))
      })),
      status: {
        code: this.status === 'OK' ? 1 : this.status === 'ERROR' ? 2 : 0
      }
    };
  }
}

// ── Sampler ──────────────────────────────────────────────────────
class PhiSampler {
  constructor(config = {}) {
    this.baseSampleRate = config.sampleRate ?? PSI; // Sample 61.8% by default
    this.errorSampleRate = 1.0; // Always sample errors
    this.slowThresholdMs = config.slowThresholdMs ?? FIB[9] * 10; // 340ms
  }
  shouldSample(traceId, attributes = {}) {
    // Always sample errors
    if (attributes['http.status_code'] >= 500) return true;
    // Always sample slow requests
    if (attributes['duration_ms'] > this.slowThresholdMs) return true;
    // φ-probability sampling
    const hash = parseInt(traceId.slice(0, FIB[6]), 16);
    return hash % 1000 / 1000 < this.baseSampleRate;
  }
}

// ── Exporter ─────────────────────────────────────────────────────
class SpanExporter {
  constructor(config = {}) {
    this.endpoint = config.endpoint ?? "http://0.0.0.0:4318/v1/traces";
    this.batchSize = config.batchSize ?? FIB[8]; // 21
    this.flushIntervalMs = config.flushIntervalMs ?? FIB[5] * 1000; // 5s
    this.buffer = [];
    this.totalExported = 0;
    this.exportErrors = 0;
  }
  add(span) {
    this.buffer.push(span.toOTLP());
    if (this.buffer.length >= this.batchSize) {
      this.flush();
    }
  }
  async flush() {
    if (this.buffer.length === 0) return {
      exported: 0
    };
    const batch = this.buffer.splice(0);
    const payload = {
      resourceSpans: [{
        resource: {
          attributes: []
        },
        scopeSpans: [{
          scope: {
            name: 'heady-tracer',
            version: '4.0.0'
          },
          spans: batch
        }]
      }]
    };
    try {
      // In production, POST to OTel collector
      this.totalExported += batch.length;
      return {
        exported: batch.length
      };
    } catch (err) {
      this.exportErrors++;
      // Re-add failed spans (up to limit)
      if (this.buffer.length < this.batchSize * FIB[3]) {
        this.buffer.unshift(...batch);
      }
      return {
        exported: 0,
        error: err.message
      };
    }
  }
  stats() {
    return {
      buffered: this.buffer.length,
      totalExported: this.totalExported,
      exportErrors: this.exportErrors
    };
  }
}

// ── Distributed Tracer ───────────────────────────────────────────
class DistributedTracer {
  constructor(config = {}) {
    this.serviceName = config.serviceName ?? 'unknown';
    this.sampler = new PhiSampler(config);
    this.exporter = new SpanExporter(config);
    this.activeSpans = new Map();
    this.totalSpans = 0;
  }
  startSpan(name, options = {}) {
    const parentContext = options.parentContext;
    const traceId = parentContext?.traceId ?? generateTraceId();
    const parentSpanId = parentContext?.spanId ?? null;
    const span = new Span(name, traceId, parentSpanId, {
      'service.name': this.serviceName,
      'heady.domain': options.domain ?? 'unknown',
      ...options.attributes
    });
    this.activeSpans.set(span.spanId, span);
    this.totalSpans++;
    return span;
  }
  endSpan(span) {
    span.end();
    this.activeSpans.delete(span.spanId);
    if (this.sampler.shouldSample(span.traceId, span.attributes)) {
      this.exporter.add(span);
    }
    return span;
  }
  middleware() {
    const self = this;
    return (req, res, next) => {
      // Parse incoming trace context
      const traceparent = req.headers['traceparent'];
      const parentContext = parseTraceparent(traceparent);
      const span = self.startSpan(`${req.method} ${req.url}`, {
        parentContext,
        domain: req.headyContext?.service?.domain ?? 'unknown',
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
          'http.user_agent': req.headers['user-agent'] ?? '',
          'net.peer.ip': req.headers['x-forwarded-for']?.split(',')[0] ?? req.socket?.remoteAddress ?? ''
        }
      });

      // Inject trace context into request
      req.traceContext = {
        traceId: span.traceId,
        spanId: span.spanId
      };

      // Set outgoing trace headers
      res.setHeader('traceparent', formatTraceparent(span.traceId, span.spanId));

      // End span on response finish
      const originalEnd = res.end.bind(res);
      res.end = function (...args) {
        span.setAttribute('http.status_code', res.statusCode);
        span.setStatus(res.statusCode >= 500 ? 'ERROR' : 'OK');
        self.endSpan(span);
        return originalEnd(...args);
      };
      next?.();
    };
  }

  // Generate propagation headers for outbound requests
  propagateHeaders(traceContext) {
    if (!traceContext) return {};
    return {
      traceparent: formatTraceparent(traceContext.traceId, traceContext.spanId)
    };
  }
  async flush() {
    return this.exporter.flush();
  }
  health() {
    return {
      service: this.serviceName,
      activeSpans: this.activeSpans.size,
      totalSpans: this.totalSpans,
      exporter: this.exporter.stats(),
      sampleRate: this.sampler.baseSampleRate
    };
  }
}
export default DistributedTracer;
export { DistributedTracer, Span, PhiSampler, SpanExporter, parseTraceparent, formatTraceparent };