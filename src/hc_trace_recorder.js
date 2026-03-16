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
// ║  FILE: src/hc_trace_recorder.js                                 ║
// ║  LAYER: distiller/trace-collection                              ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * HeadyDistiller — Trace Recorder
 * 
 * Hooks into SkillExecutor and HCFullPipeline event emitters to capture
 * structured execution traces as append-only JSONL files.
 * 
 * Architecture insight (from research): record non-deterministic inputs
 * (LLM responses, API results), not computation — then use those traces
 * as training signal for prompt optimization, few-shot selection, and
 * skill distillation.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const DEFAULT_TRACE_DIR = path.join(__dirname, '..', 'logs', 'traces');

class TraceRecorder extends EventEmitter {
  constructor(options = {}) {
    super();
    this.traceDir = options.traceDir || DEFAULT_TRACE_DIR;
    this.activeTraces = new Map();   // traceId → { entries[], meta }
    this.traceIndex = new Map();     // traceId → filepath
    this.maxEntriesPerTrace = options.maxEntriesPerTrace || 50000;
    this.flushIntervalMs = options.flushIntervalMs || 5000;
    this._flushTimer = null;
    this._pendingWrites = [];

    // Ensure trace directory exists
    if (!fs.existsSync(this.traceDir)) {
      fs.mkdirSync(this.traceDir, { recursive: true });
    }
  }

  // ─── TRACE LIFECYCLE ────────────────────────────────────────────────────────

  /**
   * Start a new trace. Returns traceId.
   */
  startTrace(meta = {}) {
    const traceId = `trace_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const trace = {
      traceId,
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: 'recording',
      meta: {
        source: meta.source || 'unknown',
        agentId: meta.agentId || null,
        skillId: meta.skillId || null,
        runId: meta.runId || null,
        model: meta.model || null,
        ...meta,
      },
      entries: [],
      entryCount: 0,
    };

    this.activeTraces.set(traceId, trace);
    this._appendEntry(traceId, {
      type: 'trace_start',
      traceId,
      meta: trace.meta,
    });

    this.emit('trace:started', { traceId, meta: trace.meta });
    return traceId;
  }

  /**
   * Record an event into an active trace.
   */
  record(traceId, event) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      // Auto-start a trace if none exists (convenience for pipeline hooks)
      const newId = this.startTrace({ source: 'auto', traceId });
      return this.record(newId, event);
    }

    if (trace.entryCount >= this.maxEntriesPerTrace) {
      this._appendEntry(traceId, {
        type: 'trace_truncated',
        reason: `Max entries (${this.maxEntriesPerTrace}) reached`,
      });
      return traceId;
    }

    this._appendEntry(traceId, {
      type: event.type || 'event',
      timestamp: new Date().toISOString(),
      ...event,
    });

    return traceId;
  }

  /**
   * Record an LLM call (the critical non-deterministic input).
   */
  recordLLMCall(traceId, { model, prompt, response, tokens, latencyMs, temperature, seed }) {
    return this.record(traceId, {
      type: 'llm_call',
      model,
      prompt: typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
      response: typeof response === 'string' ? response : JSON.stringify(response),
      tokens: tokens || null,
      latencyMs: latencyMs || null,
      temperature: temperature ?? null,
      seed: seed ?? null,
      responseHash: crypto.createHash('sha256')
        .update(typeof response === 'string' ? response : JSON.stringify(response))
        .digest('hex')
        .slice(0, 16),
    });
  }

  /**
   * Record a tool invocation.
   */
  recordToolCall(traceId, { tool, input, output, durationMs, success }) {
    return this.record(traceId, {
      type: 'tool_call',
      tool,
      input: typeof input === 'object' ? JSON.stringify(input) : input,
      output: typeof output === 'object' ? JSON.stringify(output) : output,
      durationMs: durationMs || 0,
      success: success !== false,
      outputHash: crypto.createHash('sha256')
        .update(typeof output === 'string' ? output : JSON.stringify(output || ''))
        .digest('hex')
        .slice(0, 16),
    });
  }

  /**
   * End a trace, flush to disk, and return the complete trace.
   */
  endTrace(traceId, { status = 'completed', summary = null } = {}) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return null;

    trace.completedAt = new Date().toISOString();
    trace.status = status;
    trace.durationMs = new Date(trace.completedAt) - new Date(trace.startedAt);

    this._appendEntry(traceId, {
      type: 'trace_end',
      status,
      summary,
      durationMs: trace.durationMs,
      entryCount: trace.entryCount,
    });

    // Flush to disk
    const filepath = this._flush(traceId);
    this.traceIndex.set(traceId, filepath);
    this.activeTraces.delete(traceId);

    this.emit('trace:ended', { traceId, status, filepath, durationMs: trace.durationMs });
    return { traceId, filepath, status, durationMs: trace.durationMs, entryCount: trace.entryCount };
  }

  // ─── SKILL EXECUTOR HOOKS ─────────────────────────────────────────────────

  /**
   * Attach to a SkillExecutor instance to auto-record all skill executions.
   */
  hookSkillExecutor(executor) {
    executor.on('skill:started', ({ skillId, skill }) => {
      const traceId = this.startTrace({
        source: 'skill-executor',
        skillId,
        skillName: skill.name,
        category: skill.category,
      });
      // Store traceId on the skill for later retrieval
      executor._activeTraceIds = executor._activeTraceIds || new Map();
      executor._activeTraceIds.set(skillId, traceId);
    });

    executor.on('skill:step:completed', ({ skillId, step, result }) => {
      const traceId = executor._activeTraceIds?.get(skillId);
      if (!traceId) return;
      this.record(traceId, {
        type: 'skill_step',
        step,
        success: result.success !== false,
        durationMs: result.duration || result.durationMs || 0,
        result: result.result ? JSON.stringify(result.result).slice(0, 2000) : null,
      });
    });

    executor.on('skill:completed', ({ skillId, execution }) => {
      const traceId = executor._activeTraceIds?.get(skillId);
      if (!traceId) return;
      this.endTrace(traceId, {
        status: 'completed',
        summary: `Skill ${skillId} completed in ${execution.duration}ms`,
      });
      executor._activeTraceIds.delete(skillId);
    });

    executor.on('skill:failed', ({ skillId, execution, error }) => {
      const traceId = executor._activeTraceIds?.get(skillId);
      if (!traceId) return;
      this.record(traceId, {
        type: 'skill_error',
        error: error.message || String(error),
        stack: error.stack?.slice(0, 1000) || null,
      });
      this.endTrace(traceId, {
        status: 'failed',
        summary: `Skill ${skillId} failed: ${error.message}`,
      });
      executor._activeTraceIds.delete(skillId);
    });

    return this;
  }

  // ─── PIPELINE HOOKS ───────────────────────────────────────────────────────

  /**
   * Attach to an HCFullPipeline instance to auto-record pipeline runs.
   */
  hookPipeline(pipeline) {
    pipeline.on('run:start', ({ runId }) => {
      const traceId = this.startTrace({
        source: 'hcfullpipeline',
        runId,
        pipelineName: pipeline.state?.pipelineName || 'unknown',
      });
      pipeline._distillerTraceId = traceId;
    });

    pipeline.on('stage:start', ({ stageId, name }) => {
      const traceId = pipeline._distillerTraceId;
      if (!traceId) return;
      this.record(traceId, {
        type: 'pipeline_stage_start',
        stageId,
        stageName: name,
      });
    });

    pipeline.on('stage:end', ({ stageId, status }) => {
      const traceId = pipeline._distillerTraceId;
      if (!traceId) return;
      const stageState = pipeline.state?.stages?.[stageId];
      this.record(traceId, {
        type: 'pipeline_stage_end',
        stageId,
        status,
        taskResults: stageState?.taskResults
          ? stageState.taskResults.map(r => ({
              task: r.task,
              status: r.status,
              durationMs: r.durationMs,
              cached: r.cached || false,
            }))
          : [],
      });
    });

    pipeline.on('run:stopped', ({ runId, reason }) => {
      const traceId = pipeline._distillerTraceId;
      if (!traceId) return;
      this.endTrace(traceId, {
        status: 'stopped',
        summary: `Pipeline ${runId} stopped: ${JSON.stringify(reason)}`,
      });
      pipeline._distillerTraceId = null;
    });

    return this;
  }

  // ─── TRACE RETRIEVAL ──────────────────────────────────────────────────────

  /**
   * Load a completed trace from disk by traceId.
   */
  loadTrace(traceId) {
    const filepath = this.traceIndex.get(traceId);
    if (filepath && fs.existsSync(filepath)) {
      return this._readJSONL(filepath);
    }
    // Scan trace directory for the traceId
    const files = fs.readdirSync(this.traceDir).filter(f => f.includes(traceId));
    if (files.length > 0) {
      const fp = path.join(this.traceDir, files[0]);
      this.traceIndex.set(traceId, fp);
      return this._readJSONL(fp);
    }
    return null;
  }

  /**
   * List all available trace files with metadata.
   */
  listTraces({ limit = 50, status = null, source = null } = {}) {
    const files = fs.readdirSync(this.traceDir)
      .filter(f => f.endsWith('.jsonl'))
      .sort()
      .reverse()
      .slice(0, limit * 2); // over-fetch for filtering

    const traces = [];
    for (const file of files) {
      if (traces.length >= limit) break;
      const fp = path.join(this.traceDir, file);
      try {
        const firstLine = fs.readFileSync(fp, 'utf8').split('\n')[0];
        const meta = JSON.parse(firstLine);
        if (status && meta.status !== status) continue;
        if (source && meta.meta?.source !== source) continue;
        traces.push({
          traceId: meta.traceId,
          source: meta.meta?.source,
          skillId: meta.meta?.skillId,
          runId: meta.meta?.runId,
          filepath: fp,
        });
      } catch (e) {
        // skip malformed files
      }
    }
    return traces;
  }

  // ─── INTERNALS ────────────────────────────────────────────────────────────

  _appendEntry(traceId, entry) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;
    const enriched = {
      ...entry,
      _seq: trace.entryCount++,
      _ts: Date.now(),
    };
    trace.entries.push(enriched);
  }

  _flush(traceId) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return null;

    const filename = `${traceId}.jsonl`;
    const filepath = path.join(this.traceDir, filename);

    const lines = trace.entries.map(e => JSON.stringify(e)).join('\n') + '\n';
    fs.writeFileSync(filepath, lines, 'utf8');

    return filepath;
  }

  _readJSONL(filepath) {
    const content = fs.readFileSync(filepath, 'utf8').trim();
    if (!content) return [];
    return content.split('\n').map(line => {
      try { return JSON.parse(line); }
      catch (e) { return { type: 'parse_error', raw: line }; }
    });
  }

  /**
   * Get statistics about recorded traces.
   */
  getStats() {
    const files = fs.readdirSync(this.traceDir).filter(f => f.endsWith('.jsonl'));
    return {
      totalTraces: files.length,
      activeTraces: this.activeTraces.size,
      indexedTraces: this.traceIndex.size,
      traceDir: this.traceDir,
    };
  }

  /**
   * Cleanup — stop flush timer.
   */
  destroy() {
    if (this._flushTimer) clearInterval(this._flushTimer);
    // Flush any active traces
    for (const traceId of this.activeTraces.keys()) {
      this.endTrace(traceId, { status: 'abandoned' });
    }
  }
}

module.exports = TraceRecorder;
