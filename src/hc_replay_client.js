// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  FILE: src/hc_replay_client.js                                  ║
// ║  LAYER: distiller/replay                                        ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  EventEmitter
} = require('events');
class ReplayClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.traceDir = options.traceDir || path.join(__dirname, '..', 'logs', 'traces');
  }

  /**
   * Load a trace from disk for replay.
   */
  loadTrace(traceId) {
    // Try direct file
    const directPath = path.join(this.traceDir, `${traceId}.jsonl`);
    if (fs.existsSync(directPath)) {
      return this._parseJSONL(directPath);
    }
    // Scan directory
    const files = fs.readdirSync(this.traceDir).filter(f => f.includes(traceId));
    if (files.length > 0) {
      return this._parseJSONL(path.join(this.traceDir, files[0]));
    }
    throw new Error(`Trace not found: ${traceId}`);
  }

  /**
   * Build a replay stub map from a loaded trace.
   * Maps LLM call prompts (hashed) → recorded responses.
   */
  buildStubMap(traceEntries) {
    const stubMap = new Map();
    let llmCallIndex = 0;
    for (const entry of traceEntries) {
      if (entry.type === 'llm_call') {
        const promptHash = crypto.createHash('sha256').update(entry.prompt || '').digest('hex').slice(0, 16);
        stubMap.set(`llm_${llmCallIndex}_${promptHash}`, {
          response: entry.response,
          responseHash: entry.responseHash,
          model: entry.model,
          tokens: entry.tokens,
          latencyMs: entry.latencyMs
        });
        llmCallIndex++;
      }
      if (entry.type === 'tool_call') {
        const inputHash = crypto.createHash('sha256').update(entry.input || '').digest('hex').slice(0, 16);
        stubMap.set(`tool_${entry.tool}_${inputHash}`, {
          output: entry.output,
          outputHash: entry.outputHash,
          durationMs: entry.durationMs,
          success: entry.success
        });
      }
    }
    return stubMap;
  }

  /**
   * Create a TracedLLMClient that returns recorded responses.
   * This is the core record-and-stub pattern.
   */
  createStubbedLLMClient(stubMap) {
    let callIndex = 0;
    return {
      /**
       * Stub LLM call — returns recorded response if available,
       * throws if no recording found (strict replay mode).
       */
      async call(prompt, options = {}) {
        const promptHash = crypto.createHash('sha256').update(typeof prompt === 'string' ? prompt : JSON.stringify(prompt)).digest('hex').slice(0, 16);
        const key = `llm_${callIndex}_${promptHash}`;
        const stub = stubMap.get(key);
        callIndex++;
        if (stub) {
          return {
            response: stub.response,
            model: stub.model,
            tokens: stub.tokens,
            latencyMs: 0,
            // instant replay
            replayed: true,
            originalLatencyMs: stub.latencyMs
          };
        }

        // Fallback: search by promptHash only (position-independent)
        for (const [k, v] of stubMap) {
          if (k.endsWith(promptHash) && k.startsWith('llm_')) {
            return {
              response: v.response,
              model: v.model,
              tokens: v.tokens,
              latencyMs: 0,
              replayed: true,
              fuzzyMatch: true,
              originalLatencyMs: v.latencyMs
            };
          }
        }
        if (options.strict !== false) {
          throw new Error(`Replay: No recorded response for LLM call #${callIndex - 1} (hash: ${promptHash})`);
        }
        return {
          response: null,
          replayed: false,
          missing: true
        };
      }
    };
  }

  /**
   * Replay a trace and verify outputs match recorded hashes.
   * Returns a verification report.
   */
  async verify(traceId) {
    const entries = this.loadTrace(traceId);
    const report = {
      traceId,
      totalEntries: entries.length,
      llmCalls: 0,
      toolCalls: 0,
      hashMatches: 0,
      hashMismatches: 0,
      missingStubs: 0,
      verified: false,
      details: []
    };
    const stubMap = this.buildStubMap(entries);
    for (const entry of entries) {
      if (entry.type === 'llm_call') {
        report.llmCalls++;
        const promptHash = crypto.createHash('sha256').update(entry.prompt || '').digest('hex').slice(0, 16);

        // Verify response hash integrity
        const computedHash = crypto.createHash('sha256').update(entry.response || '').digest('hex').slice(0, 16);
        if (computedHash === entry.responseHash) {
          report.hashMatches++;
          report.details.push({
            type: 'llm',
            seq: entry._seq,
            status: 'match'
          });
        } else {
          report.hashMismatches++;
          report.details.push({
            type: 'llm',
            seq: entry._seq,
            status: 'mismatch',
            expected: entry.responseHash,
            got: computedHash
          });
        }
      }
      if (entry.type === 'tool_call') {
        report.toolCalls++;
        const computedHash = crypto.createHash('sha256').update(entry.output || '').digest('hex').slice(0, 16);
        if (computedHash === entry.outputHash) {
          report.hashMatches++;
        } else {
          report.hashMismatches++;
        }
      }
    }
    report.verified = report.hashMismatches === 0 && report.missingStubs === 0;
    this.emit('verify:complete', report);
    return report;
  }

  /**
   * Extract a timeline from a trace for visualization.
   */
  extractTimeline(traceId) {
    const entries = this.loadTrace(traceId);
    const timeline = [];
    for (const entry of entries) {
      if (['trace_start', 'trace_end', 'llm_call', 'tool_call', 'skill_step', 'pipeline_stage_start', 'pipeline_stage_end'].includes(entry.type)) {
        timeline.push({
          seq: entry._seq,
          type: entry.type,
          timestamp: entry.timestamp || entry._ts,
          durationMs: entry.durationMs || entry.latencyMs || 0,
          label: entry.tool || entry.step || entry.stageName || entry.model || entry.type,
          success: entry.success !== false && entry.status !== 'failed'
        });
      }
    }
    return timeline;
  }

  /**
   * Compute summary statistics for a trace.
   */
  summarize(traceId) {
    const entries = this.loadTrace(traceId);
    const startEntry = entries.find(e => e.type === 'trace_start');
    const endEntry = entries.find(e => e.type === 'trace_end');
    const llmCalls = entries.filter(e => e.type === 'llm_call');
    const toolCalls = entries.filter(e => e.type === 'tool_call');
    const steps = entries.filter(e => e.type === 'skill_step');
    return {
      traceId,
      source: startEntry?.meta?.source || 'unknown',
      skillId: startEntry?.meta?.skillId || null,
      runId: startEntry?.meta?.runId || null,
      status: endEntry?.status || 'unknown',
      durationMs: endEntry?.durationMs || 0,
      entryCount: entries.length,
      llmCallCount: llmCalls.length,
      toolCallCount: toolCalls.length,
      stepCount: steps.length,
      totalLLMLatencyMs: llmCalls.reduce((s, e) => s + (e.latencyMs || 0), 0),
      totalToolDurationMs: toolCalls.reduce((s, e) => s + (e.durationMs || 0), 0),
      successfulSteps: steps.filter(s => s.success !== false).length,
      failedSteps: steps.filter(s => s.success === false).length
    };
  }

  // ─── INTERNALS ────────────────────────────────────────────────────────────

  _parseJSONL(filepath) {
    const content = fs.readFileSync(filepath, 'utf8').trim();
    if (!content) return [];
    return content.split('\n').map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return {
          type: 'parse_error',
          raw: line
        };
      }
    });
  }
}
module.exports = ReplayClient;