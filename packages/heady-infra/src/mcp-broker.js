/**
 * HeadyMCP Context-Aware Broker Protocol (CABP)
 * + Adaptive Timeout Budget Allocation (ATBA)
 * + Structured Error Recovery Framework (SERF)
 * ───────────────────────────────────────────
 * Patent coverage: HS-059 (Self-Healing Attestation Mesh)
 * @module core/infrastructure/mcp-broker
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PHI, PSI, CSL, TIMING, phiBackoffWithJitter } from '../constants/phi.js';

export const SemanticError = z.object({
  code: z.enum([
    'BUDGET_EXHAUSTED', 'IDENTITY_MISSING', 'TOOL_TIMEOUT',
    'SCHEMA_VIOLATION', 'RATE_LIMIT', 'UPSTREAM_FAILURE',
    'CAPABILITY_BOUNDARY', 'AUDIT_FAILED',
  ]),
  tool: z.string(),
  traceId: z.string().uuid(),
  recoverable: z.boolean(),
  retryAfterMs: z.number().optional(),
  suggestion: z.string().optional(),
  evidence: z.record(z.unknown()).optional(),
});

class AdaptiveTimeoutBudget {
  constructor(totalBudgetMs = TIMING.WARM) {
    this.remaining = totalBudgetMs;
    this.toolHistory = [];
    this.phi = PHI;
  }

  allocate(toolName, defaultMs = TIMING.TASK) {
    const history = this.toolHistory.filter(h => h.tool === toolName);
    if (history.length === 0) return Math.min(defaultMs, this.remaining);
    let ewma = history[0].actual;
    for (let i = 1; i < history.length; i++) {
      ewma = PSI * history[i].actual + (1 - PSI) * ewma;
    }
    return Math.min(Math.round(ewma * PHI), this.remaining);
  }

  record(toolName, actualMs) {
    this.remaining -= actualMs;
    this.toolHistory.push({ tool: toolName, actual: actualMs, ts: Date.now() });
  }

  isExhausted() { return this.remaining < TIMING.CONNECT; }
}

export class MCPBroker {
  constructor({ circuitBreaker, identityProvider, auditLog, rateLimiter } = {}) {
    this.circuitBreaker = circuitBreaker;
    this.identityProvider = identityProvider;
    this.auditLog = auditLog;
    this.rateLimiter = rateLimiter;
  }

  async invoke(toolName, params, context = {}) {
    const traceId = randomUUID();
    const budget = new AdaptiveTimeoutBudget(context.totalBudgetMs);
    const identity = await this.#authenticate(context, traceId);
    await this.#authorize(identity, toolName, traceId);
    if (budget.isExhausted()) {
      throw this.#serf('BUDGET_EXHAUSTED', toolName, traceId, false, {
        suggestion: 'Split task into smaller sub-tasks or increase totalBudgetMs',
      });
    }
    const toolBudget = budget.allocate(toolName);
    const start = Date.now();
    let result;
    try {
      result = await Promise.race([
        context.handler(params),
        new Promise((_, rej) => setTimeout(() => rej(new Error('TOOL_TIMEOUT')), toolBudget)),
      ]);
    } catch (err) {
      const code = err.message === 'TOOL_TIMEOUT' ? 'TOOL_TIMEOUT' : 'UPSTREAM_FAILURE';
      throw this.#serf(code, toolName, traceId, true, {
        retryAfterMs: phiBackoffWithJitter(context.attempt ?? 0),
        suggestion: code === 'TOOL_TIMEOUT'
          ? `Budget was ${toolBudget}ms. Consider async/background execution.`
          : `Upstream failure: ${err.message}`,
      });
    } finally {
      budget.record(toolName, Date.now() - start);
    }
    await this.auditLog?.write({ traceId, toolName, identity: identity?.sub, ok: true });
    return { result, traceId, budgetRemaining: budget.remaining };
  }

  async #authenticate(context, traceId) {
    if (!this.identityProvider) return { sub: 'anonymous', tier: 'INTERNAL' };
    try {
      return await this.identityProvider.verify(context.token);
    } catch {
      throw this.#serf('IDENTITY_MISSING', '*', traceId, false, {
        suggestion: 'Attach a valid Firebase JWT or internal service token',
      });
    }
  }

  async #authorize(identity, toolName, traceId) {
    const tier = identity?.tier ?? 'ANONYMOUS';
    const restricted = ['deploy', 'maintenance', 'ops'];
    if (restricted.includes(toolName) && tier === 'ANONYMOUS') {
      throw this.#serf('CAPABILITY_BOUNDARY', toolName, traceId, false, {
        suggestion: `Tool '${toolName}' requires PREMIUM or INTERNAL identity tier`,
      });
    }
  }

  #serf(code, tool, traceId, recoverable, extras = {}) {
    const err = new Error(`[SERF:${code}] ${tool}`);
    err.semantic = SemanticError.parse({ code, tool, traceId, recoverable, ...extras });
    return err;
  }
}
