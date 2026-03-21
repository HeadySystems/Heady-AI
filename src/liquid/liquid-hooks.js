/**
 * Heady™ LiquidHooks v1.0
 * Pre/post action hooks system with deny-override capability
 * Absorbed from: Claude Code hooks architecture
 *
 * Hooks are shell commands that execute in response to agent events.
 * They provide automated guardrails, approval gates, and custom
 * post-processing without modifying core agent logic.
 *
 * @author Eric Haywood — HeadySystems Inc.
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const EventEmitter = require('events');
const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const {
  PHI, PSI, fib,
  CSL_THRESHOLDS,
} = require('../../shared/phi-math');
const { createLogger } = require('../../shared/logger');

const logger = createLogger('liquid-hooks');

const HOOK_PHASES = Object.freeze({
  PRE:      'pre',       // Before action — can deny
  POST:     'post',      // After action — can modify result
  ON_ERROR: 'on_error',  // On failure — can recover
  FINALLY:  'finally',   // Always runs — cleanup
});

const HOOK_EVENTS = Object.freeze({
  FILE_EDIT:    'file_edit',
  FILE_CREATE:  'file_create',
  SHELL_EXEC:   'shell_exec',
  TOOL_CALL:    'tool_call',
  MODEL_QUERY:  'model_query',
  GIT_COMMIT:   'git_commit',
  GIT_PUSH:     'git_push',
  DEPLOY:       'deploy',
  AGENT_SPAWN:  'agent_spawn',
  PIPELINE_RUN: 'pipeline_run',
});

const HOOK_RESULTS = Object.freeze({
  ALLOW:   'ALLOW',
  DENY:    'DENY',
  MODIFY:  'MODIFY',
  SKIP:    'SKIP',
});

const HOOK_TIMEOUT_MS = fib(7) * 1000;   // 13s
const MAX_HOOKS_PER_EVENT = fib(6);       // 8
const MAX_HOOK_OUTPUT = fib(13) * 100;    // ~23,300 bytes

class HookDefinition {
  constructor(config) {
    this.id = config.id || crypto.randomUUID();
    this.event = config.event;
    this.phase = config.phase || HOOK_PHASES.PRE;
    this.command = config.command;     // shell command
    this.script = config.script;       // path to script file (alternative)
    this.priority = config.priority || PSI;  // 0-1, higher runs first
    this.enabled = config.enabled !== false;
    this.description = config.description || '';
    this.env = config.env || {};       // extra env vars
    this.timeout = config.timeout || HOOK_TIMEOUT_MS;
    this.canDeny = config.canDeny !== false && this.phase === HOOK_PHASES.PRE;
    this.runCount = 0;
    this.lastResult = null;
    this.lastError = null;
  }
}

class HookResult {
  constructor(hookId, result, output = '', error = null) {
    this.hookId = hookId;
    this.result = result;        // ALLOW, DENY, MODIFY, SKIP
    this.output = output;
    this.error = error;
    this.timestamp = Date.now();
    this.modifiedPayload = null; // set if result === MODIFY
  }
}

class LiquidHooks extends EventEmitter {
  constructor(config = {}) {
    super();
    this._hooks = new Map();     // hookId → HookDefinition
    this._eventIndex = new Map(); // event:phase → Set<hookId>
    this._configPath = config.configPath || null;

    this._metrics = {
      hooksExecuted: 0,
      hooksDenied: 0,
      hooksModified: 0,
      hookErrors: 0,
      avgLatencyMs: 0,
      _latencySum: 0,
    };

    // Load from config file if provided
    if (this._configPath) this._loadFromFile(this._configPath);

    logger.info({ hookCount: this._hooks.size }, 'LiquidHooks initialized');
  }

  // ── Register Hook ──────────────────────────────────────────────
  register(config) {
    const hook = new HookDefinition(config);
    const key = `${hook.event}:${hook.phase}`;

    // Enforce per-event limit
    if (!this._eventIndex.has(key)) this._eventIndex.set(key, new Set());
    const eventHooks = this._eventIndex.get(key);
    if (eventHooks.size >= MAX_HOOKS_PER_EVENT) {
      throw new Error(`HEADY-HOOK-001: Max ${MAX_HOOKS_PER_EVENT} hooks per event:phase`);
    }

    this._hooks.set(hook.id, hook);
    eventHooks.add(hook.id);

    logger.info({ hookId: hook.id, event: hook.event, phase: hook.phase }, 'Hook registered');
    return hook.id;
  }

  unregister(hookId) {
    const hook = this._hooks.get(hookId);
    if (!hook) return false;

    const key = `${hook.event}:${hook.phase}`;
    this._eventIndex.get(key)?.delete(hookId);
    this._hooks.delete(hookId);
    return true;
  }

  // ── Execute Hooks for Event ────────────────────────────────────
  async executePhase(event, phase, payload = {}) {
    const key = `${event}:${phase}`;
    const hookIds = this._eventIndex.get(key);
    if (!hookIds || hookIds.size === 0) return { result: HOOK_RESULTS.ALLOW, payload };

    // Sort by priority (highest first)
    const hooks = [...hookIds]
      .map(id => this._hooks.get(id))
      .filter(h => h && h.enabled)
      .sort((a, b) => b.priority - a.priority);

    let currentPayload = { ...payload };
    const results = [];

    for (const hook of hooks) {
      const start = Date.now();
      try {
        const hookResult = await this._executeHook(hook, currentPayload);
        results.push(hookResult);

        this._metrics.hooksExecuted++;
        this._metrics._latencySum += Date.now() - start;
        this._metrics.avgLatencyMs = this._metrics._latencySum / this._metrics.hooksExecuted;

        hook.runCount++;
        hook.lastResult = hookResult.result;

        if (hookResult.result === HOOK_RESULTS.DENY) {
          this._metrics.hooksDenied++;
          this.emit('hook:denied', { hookId: hook.id, event, output: hookResult.output });
          logger.warn({ hookId: hook.id, event }, 'Hook denied action');
          return { result: HOOK_RESULTS.DENY, reason: hookResult.output, hookId: hook.id };
        }

        if (hookResult.result === HOOK_RESULTS.MODIFY && hookResult.modifiedPayload) {
          this._metrics.hooksModified++;
          currentPayload = hookResult.modifiedPayload;
        }

      } catch (e) {
        this._metrics.hookErrors++;
        hook.lastError = e.message;
        logger.error({ hookId: hook.id, error: e.message }, 'Hook execution error');
        this.emit('hook:error', { hookId: hook.id, error: e });

        // Errors in pre-hooks deny by default (fail-closed)
        if (phase === HOOK_PHASES.PRE) {
          return { result: HOOK_RESULTS.DENY, reason: `Hook error: ${e.message}`, hookId: hook.id };
        }
      }
    }

    return { result: HOOK_RESULTS.ALLOW, payload: currentPayload, results };
  }

  // ── Convenience: run full lifecycle ────────────────────────────
  async runLifecycle(event, payload, actionFn) {
    // Pre-hooks
    const preResult = await this.executePhase(event, HOOK_PHASES.PRE, payload);
    if (preResult.result === HOOK_RESULTS.DENY) {
      return { denied: true, reason: preResult.reason };
    }

    let actionResult;
    let actionError;

    try {
      // Execute the action with potentially modified payload
      actionResult = await actionFn(preResult.payload);

      // Post-hooks
      await this.executePhase(event, HOOK_PHASES.POST, {
        ...preResult.payload,
        result: actionResult,
      });
    } catch (e) {
      actionError = e;
      // Error hooks
      await this.executePhase(event, HOOK_PHASES.ON_ERROR, {
        ...preResult.payload,
        error: e.message,
      });
    } finally {
      // Finally hooks
      await this.executePhase(event, HOOK_PHASES.FINALLY, {
        ...preResult.payload,
        result: actionResult,
        error: actionError?.message,
      });
    }

    if (actionError) throw actionError;
    return { denied: false, result: actionResult };
  }

  // ── Internal: Execute Single Hook ──────────────────────────────
  async _executeHook(hook, payload) {
    const cmd = hook.script
      ? `bash "${hook.script}"`
      : hook.command;

    const env = {
      ...process.env,
      ...hook.env,
      HEADY_HOOK_EVENT: hook.event,
      HEADY_HOOK_PHASE: hook.phase,
      HEADY_HOOK_PAYLOAD: JSON.stringify(payload).slice(0, MAX_HOOK_OUTPUT),
    };

    return new Promise((resolve, reject) => {
      const child = exec(cmd, {
        env,
        timeout: hook.timeout,
        maxBuffer: MAX_HOOK_OUTPUT,
        cwd: process.cwd(),
      }, (error, stdout, stderr) => {
        if (error) {
          if (error.killed) {
            reject(new Error('HEADY-HOOK-002: Hook timeout'));
            return;
          }

          // Non-zero exit = DENY for pre-hooks
          if (hook.canDeny) {
            resolve(new HookResult(hook.id, HOOK_RESULTS.DENY, stderr || stdout || error.message));
            return;
          }

          reject(error);
          return;
        }

        const output = (stdout || '').trim();

        // Check for MODIFY directive in output
        if (output.startsWith('HEADY_MODIFY:')) {
          try {
            const modified = JSON.parse(output.slice('HEADY_MODIFY:'.length));
            const result = new HookResult(hook.id, HOOK_RESULTS.MODIFY, output);
            result.modifiedPayload = modified;
            resolve(result);
            return;
          } catch(e) { /* absorbed: */ console.error(e.message); }
        }

        resolve(new HookResult(hook.id, HOOK_RESULTS.ALLOW, output));
      });
    });
  }

  // ── Load from Config File ──────────────────────────────────────
  _loadFromFile(configPath) {
    try {
      if (!fs.existsSync(configPath)) return;
      const raw = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw);

      if (Array.isArray(config.hooks)) {
        for (const h of config.hooks) {
          this.register(h);
        }
      }
    } catch (e) {
      logger.error({ path: configPath, error: e.message }, 'Failed to load hooks config');
    }
  }

  // ── Query ──────────────────────────────────────────────────────
  list(event = null) {
    let hooks = [...this._hooks.values()];
    if (event) hooks = hooks.filter(h => h.event === event);
    return hooks.map(h => ({
      id: h.id, event: h.event, phase: h.phase,
      enabled: h.enabled, priority: h.priority,
      runCount: h.runCount, description: h.description,
    }));
  }

  get metrics() { return { ...this._metrics }; }
}

module.exports = { LiquidHooks, HOOK_PHASES, HOOK_EVENTS, HOOK_RESULTS };
