'use strict';

const crypto = require('crypto');
const { getLogger } = require('../services/structured-logger');
const log = getLogger('trace-capture', 'distiller');

/**
 * Append-only JSONL trace capture with SHA-256 hash chain.
 * Every pipeline execution emits events that build an immutable audit trail.
 */

class TraceCapture {
  constructor() {
    this.events = [];
    this.prevHash = '0'.repeat(64);
  }

  append(stage, event, meta, replay = null) {
    const entry = {
      ts: Date.now(),
      stage,
      event,
      meta,
      ...(replay && { replay }),
    };

    // SHA-256 hash chain — each event hashes the previous
    const content = JSON.stringify(entry) + this.prevHash;
    entry.hash = crypto.createHash('sha256').update(content).digest('hex');
    this.prevHash = entry.hash;

    this.events.push(entry);
    return entry;
  }

  toJSONL() {
    return this.events.map(e => JSON.stringify(e)).join('\n');
  }

  verify() {
    let prevHash = '0'.repeat(64);
    for (const entry of this.events) {
      const { hash, ...rest } = entry;
      const content = JSON.stringify(rest) + prevHash;
      const computed = crypto.createHash('sha256').update(content).digest('hex');
      if (computed !== hash) return false;
      prevHash = hash;
    }
    return true;
  }
}

function captureTrace(traceId, executionLog) {
  const capture = new TraceCapture();

  for (const event of executionLog) {
    capture.append(event.stage, event.event, event.meta, event.replay);
  }

  log.info('trace captured', {
    trace_id: traceId,
    events: capture.events.length,
    integrity: capture.verify(),
  });

  return {
    trace_id: traceId,
    events: capture.events,
    jsonl: capture.toJSONL(),
    sha256: capture.prevHash,
    task_class: executionLog.find(e => e.stage === 'CLASSIFY')?.meta?.top_class || 'UNKNOWN',
  };
}

module.exports = { captureTrace, TraceCapture };
