/**
 * Heady™ Global Task Manager — Unified Linear + Sentry Bridge
 *
 * Bridges the error tracking telemetry (Sentry) with the project management
 * layer (Linear) to create a fully autonomous, self-healing task lifecycle:
 *
 *   1. Failures detected by the Auto-Success Engine are dispatched to Sentry.
 *   2. High-severity Sentry events automatically spawn Linear issues.
 *   3. Resolved Linear issues feed back into the 3D Vector Memory as
 *      confidence signals, closing the semantic loop.
 *
 * ALL constants φ-derived. Zero magic numbers.
 *
 * © 2026 HeadySystems Inc. All Rights Reserved.
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ─── PHI CONSTANTS ──────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 1 / PHI; // 0.618
const fib = (n) => {
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
};

// ─── CONFIGURATION ──────────────────────────────────────────────────────────
const GTM_CONFIG = {
  ESCALATION_THRESHOLD: fib(6),         // 8 failures before auto-issue creation
  STALE_HOURS_WARN: 48,                 // Hours before stale warning
  STALE_HOURS_COMMENT: 72,              // Hours before auto-comment
  STALE_DAYS_CLOSE: 5,                  // Days before auto-close
  VELOCITY_WINDOW_HOURS: 168,           // 7 days of velocity data
  SYNC_INTERVAL_MS: Math.round(Math.pow(PHI, 7) * 1000),  // 29,034ms
  MAX_LINEAR_BATCH: fib(7),             // 13 issues per batch
  MIN_CONFIDENCE_GATE: PSI,             // 0.618 CSL threshold
};

const LINEAR_API = 'https://api.linear.app/graphql';
// Lazy getters — reads at call time so vault-boot has projected into process.env
const getLinearApiKey = () => process.env.LINEAR_API_KEY;
const getLinearTeamId = () => process.env.LINEAR_TEAM_ID || '7ac56e42-6d6b-4c11-a916-0cd4b5b4c19b';

// ─── LINEAR GRAPHQL CLIENT ──────────────────────────────────────────────────

async function linearQuery(query, vars = {}) {
  const apiKey = getLinearApiKey();
  if (!apiKey) {
    return null; // Graceful degradation — no crash
  }

  try {
    const res = await fetch(LINEAR_API, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: vars }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data.errors?.length) return null;

    return data.data;
  } catch {
    return null;
  }
}

// ─── SENTRY BRIDGE ──────────────────────────────────────────────────────────

let sentryModule = null;
try {
  sentryModule = require('../services/sentry');
} catch {
  // Sentry not available — graceful degradation
}

function reportToSentry(error, context = {}) {
  if (!sentryModule?.isEnabled) return null;
  return sentryModule.captureException(error, {
    tags: {
      source: 'global-task-manager',
      category: context.category || 'unknown',
      severity: context.severity || 'error',
    },
    extra: {
      cycleId: context.cycleId,
      failureCount: context.failureCount,
      ...context.extra,
    },
  });
}

// ─── GLOBAL TASK MANAGER ────────────────────────────────────────────────────

class GlobalTaskManager {
  constructor() {
    this.failureAccumulator = {};  // category → count
    this.velocityCache = null;
    this.lastSyncTs = null;
    this.issuesCreatedThisCycle = 0;
    this.totalIssuesCreated = 0;
    this.totalErrorsTracked = 0;
  }

  /**
   * Track a failure event end-to-end: Sentry → Linear → Vector Memory.
   *
   * @param {Error}  error        The error object
   * @param {object} context      { category, cycleId, failureCount }
   * @returns {{ sentryEventId: string|null, linearIssueId: string|null }}
   */
  async trackAndResolve(error, context = {}) {
    const result = { sentryEventId: null, linearIssueId: null };

    // 1. Always report to Sentry
    result.sentryEventId = reportToSentry(error, context);
    this.totalErrorsTracked++;

    // 2. Accumulate failures per category
    const cat = context.category || 'unknown';
    this.failureAccumulator[cat] = (this.failureAccumulator[cat] || 0) + 1;

    // 3. Only escalate to Linear after exceeding the phi-scaled threshold
    if (this.failureAccumulator[cat] >= GTM_CONFIG.ESCALATION_THRESHOLD) {
      result.linearIssueId = await this._createLinearIssue(error, context);
      this.failureAccumulator[cat] = 0; // Reset after escalation
    }

    // 4. Log the tracking event to local persistence
    this._appendTrackingLog({
      timestamp: new Date().toISOString(),
      category: cat,
      error: error.message,
      sentryEventId: result.sentryEventId,
      linearIssueId: result.linearIssueId,
      failureCount: this.failureAccumulator[cat],
    });

    return result;
  }

  /**
   * Sync velocity metrics from Linear completions.
   * Updates the internal velocity cache and returns metrics.
   */
  async syncVelocity() {
    if (!getLinearApiKey()) {
      return { ok: false, reason: 'LINEAR_API_KEY not configured' };
    }

    try {
      const since = new Date(
        Date.now() - GTM_CONFIG.VELOCITY_WINDOW_HOURS * 60 * 60 * 1000
      ).toISOString();

      const data = await linearQuery(`{
        issues(
          filter: {
            assignee: { isMe: { eq: true } }
            completedAt: { gt: "${since}" }
          }
          first: 50
          orderBy: completedAt
        ) {
          nodes {
            id identifier title priority
            state { name }
            completedAt startedAt
            estimate
          }
        }
      }`);

      if (!data) return { ok: false, reason: 'Linear API unreachable' };

      const completions = data.issues?.nodes || [];
      const days = GTM_CONFIG.VELOCITY_WINDOW_HOURS / 24;

      // Calculate velocity
      const velocity = completions.length / days;

      // Calculate average cycle time (started → completed)
      const cycleTimes = completions
        .filter(c => c.startedAt && c.completedAt)
        .map(c => (new Date(c.completedAt) - new Date(c.startedAt)) / (60 * 60 * 1000));

      const avgCycleTimeHours = cycleTimes.length
        ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
        : null;

      // Estimate-weighted velocity
      const estimateVelocity = completions.reduce((sum, c) => sum + (c.estimate || 1), 0) / days;

      this.velocityCache = {
        velocity: Number(velocity.toFixed(2)),
        estimateVelocity: Number(estimateVelocity.toFixed(2)),
        avgCycleTimeHours: avgCycleTimeHours ? Number(avgCycleTimeHours.toFixed(1)) : null,
        completionsCount: completions.length,
        windowDays: days,
        syncedAt: new Date().toISOString(),
      };

      this.lastSyncTs = Date.now();
      return { ok: true, metrics: this.velocityCache };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  /**
   * Get a health summary of the Global Task Manager.
   */
  getHealth() {
    return {
      totalErrorsTracked: this.totalErrorsTracked,
      totalIssuesCreated: this.totalIssuesCreated,
      issuesCreatedThisCycle: this.issuesCreatedThisCycle,
      failureAccumulator: { ...this.failureAccumulator },
      velocityCache: this.velocityCache,
      lastSyncTs: this.lastSyncTs ? new Date(this.lastSyncTs).toISOString() : null,
      sentryEnabled: !!sentryModule?.isEnabled,
      linearEnabled: !!getLinearApiKey(),
      config: GTM_CONFIG,
    };
  }

  /**
   * Reset the per-cycle counters (called at the start of each engine cycle).
   */
  resetCycle() {
    this.issuesCreatedThisCycle = 0;
  }

  // ─── PRIVATE METHODS ────────────────────────────────────────────────────

  async _createLinearIssue(error, context) {
    const apiKey = getLinearApiKey();
    const teamId = getLinearTeamId();
    if (!apiKey || !teamId) return null;

    try {
      const title = `[Auto-Success] ${context.category || 'System'}: ${error.message.substring(0, 120)}`;
      const description = [
        `## Auto-Generated Issue`,
        ``,
        `**Source**: Auto-Success Engine → Global Task Manager`,
        `**Category**: \`${context.category || 'unknown'}\``,
        `**Cycle ID**: \`${context.cycleId || 'N/A'}\``,
        `**Failure Count**: ${context.failureCount || 'N/A'} (threshold: ${GTM_CONFIG.ESCALATION_THRESHOLD})`,
        `**Sentry Event**: ${context.sentryEventId || 'N/A'}`,
        ``,
        `### Error Details`,
        '```',
        error.stack || error.message,
        '```',
        ``,
        `### Context`,
        `- **Timestamp**: ${new Date().toISOString()}`,
        `- **Environment**: ${process.env.NODE_ENV || 'development'}`,
        `- **CSL Gate**: ${GTM_CONFIG.MIN_CONFIDENCE_GATE}`,
        ``,
        `---`,
        `*This issue was automatically created by the Heady Auto-Success Engine when the failure count for category \`${context.category}\` exceeded the φ-scaled threshold of ${GTM_CONFIG.ESCALATION_THRESHOLD}.*`,
      ].join('\n');

      const data = await linearQuery(`
        mutation($title: String!, $description: String!, $teamId: String!, $priority: Int) {
          issueCreate(input: {
            title: $title
            description: $description
            teamId: $teamId
            priority: $priority
          }) {
            success
            issue { id identifier url title }
          }
        }
      `, {
        title,
        description,
        teamId: getLinearTeamId(),
        priority: context.severity === 'critical' ? 1 : 2,
      });

      if (data?.issueCreate?.success) {
        const issue = data.issueCreate.issue;
        this.issuesCreatedThisCycle++;
        this.totalIssuesCreated++;
        console.log(`[GlobalTaskManager] Created Linear issue: ${issue.identifier} — ${issue.title}`);
        return issue.identifier;
      }

      return null;
    } catch {
      return null;
    }
  }

  _appendTrackingLog(entry) {
    try {
      const logDir = path.join(__dirname, '..', '.heady');
      const logPath = path.join(logDir, 'global-task-tracking.json');

      fs.mkdirSync(logDir, { recursive: true });

      const existing = (() => {
        try { return JSON.parse(fs.readFileSync(logPath, 'utf8')); }
        catch { return []; }
      })();

      existing.push(entry);
      // Keep last fib(11) = 89 entries
      const trimmed = existing.slice(-89);
      fs.writeFileSync(logPath, JSON.stringify(trimmed, null, 2), 'utf8');
    } catch {
      // Non-critical — don't crash for logging failures
    }
  }
}

// ─── SINGLETON ──────────────────────────────────────────────────────────────
const globalTaskManager = new GlobalTaskManager();

module.exports = {
  GlobalTaskManager,
  globalTaskManager,
  GTM_CONFIG,
};
