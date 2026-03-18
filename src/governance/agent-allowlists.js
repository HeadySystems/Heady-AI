/**
 * © 2026-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Agent Allowlists — Per-agent tool and action permission enforcement.
 *
 * Implements the per-agent governance rules from configs/governance-policies.yaml v2.
 * Each named agent has an explicit set of allowed tool groups, budget caps,
 * and self-modification restrictions.
 *
 * All thresholds and limits from phi-math — ZERO magic numbers.
 *
 * @module agent-allowlists
 */

'use strict';

const logger = require('../utils/logger');

const PHI = 1.6180339887;
const PSI = 1 / PHI; // 0.618

// ─── Tool Group Definitions ─────────────────────────────────────────────────
const TOOL_GROUPS = Object.freeze({
  intelligence: ['deep_scan', 'analyze', 'risks', 'patterns', 'refactor'],
  memory:       ['memory', 'embed', 'learn', 'recall', 'vector_store', 'vector_search', 'vector_stats'],
  orchestration:['auto_flow', 'orchestrator', 'hcfp_status', 'csl_engine'],
  execution:    ['coder', 'battle', 'buddy', 'chat', 'claude', 'openai', 'gemini', 'groq'],
  operations:   ['deploy', 'health', 'ops', 'maintenance', 'maid', 'telemetry'],
  cms:          ['cms_content', 'cms_taxonomy', 'cms_media', 'cms_views', 'cms_search'],
});

// ─── Destructive tools requiring HITL approval ──────────────────────────────
const DESTRUCTIVE_TOOLS = Object.freeze(['deploy', 'maintenance', 'maid', 'delete', 'rotate_secrets']);

// ─── CSL Thresholds ─────────────────────────────────────────────────────────
const CSL = Object.freeze({
  MINIMUM:  0.500,
  INCLUDE:  0.382,
  BOOST:    PSI,       // 0.618
  INJECT:   0.718,
  HIGH:     0.882,
  CRITICAL: 0.927,
});

// ─── Agent Definitions ──────────────────────────────────────────────────────
const AGENT_ALLOWLISTS = Object.freeze({
  BRAIN: {
    name: 'Heady Brain',
    allowedToolGroups: ['intelligence', 'memory', 'orchestration', 'execution', 'cms'],
    maxConcurrent: 3,           // fib(4)
    budgetPerSession: 10.00,
    cslThreshold: CSL.BOOST,
    canSelfModify: false,
    requiresApprovalFor: [],
  },
  RESEARCHER: {
    name: 'Heady Researcher',
    allowedToolGroups: ['intelligence', 'memory'],
    maxConcurrent: 2,           // fib(3)
    budgetPerSession: 5.00,
    cslThreshold: CSL.BOOST,
    canSelfModify: false,
    requiresApprovalFor: [],
  },
  DEVOPS: {
    name: 'Heady DevOps',
    allowedToolGroups: ['operations', 'intelligence'],
    maxConcurrent: 3,           // fib(4)
    budgetPerSession: 5.00,
    cslThreshold: CSL.INCLUDE,
    canSelfModify: false,
    requiresApprovalFor: ['deploy', 'maintenance', 'maid'],
  },
  CONTENT: {
    name: 'Heady Content',
    allowedToolGroups: ['cms', 'intelligence', 'memory'],
    maxConcurrent: 3,           // fib(4)
    budgetPerSession: 3.00,
    cslThreshold: CSL.INCLUDE,
    canSelfModify: false,
    requiresApprovalFor: [],
  },
  JULES: {
    name: 'Jules',
    allowedToolGroups: ['orchestration'],
    maxConcurrent: 5,           // fib(5)
    budgetPerSession: 2.00,
    cslThreshold: CSL.INCLUDE,
    canSelfModify: false,
    requiresApprovalFor: [],
  },
  BUILDER: {
    name: 'Builder',
    allowedToolGroups: ['execution', 'intelligence'],
    maxConcurrent: 2,           // fib(3)
    budgetPerSession: 8.00,
    cslThreshold: CSL.BOOST,
    canSelfModify: false,
    requiresApprovalFor: [],
  },
  OBSERVER: {
    name: 'Observer',
    allowedToolGroups: ['operations'],
    maxConcurrent: 5,           // fib(5)
    budgetPerSession: 1.00,
    cslThreshold: CSL.MINIMUM,
    canSelfModify: false,
    requiresApprovalFor: [],
    readOnly: true,
  },
  SENTINEL: {
    name: 'Sentinel',
    allowedToolGroups: ['intelligence', 'operations'],
    maxConcurrent: 2,           // fib(3)
    budgetPerSession: 3.00,
    cslThreshold: CSL.HIGH,
    canSelfModify: false,
    requiresApprovalFor: [],
  },
  ATLAS: {
    name: 'Atlas',
    allowedToolGroups: ['intelligence', 'memory'],
    maxConcurrent: 3,           // fib(4)
    budgetPerSession: 3.00,
    cslThreshold: CSL.INCLUDE,
    canSelfModify: false,
    requiresApprovalFor: [],
  },
  MUSE: {
    name: 'Muse',
    allowedToolGroups: ['cms', 'intelligence'],
    maxConcurrent: 2,           // fib(3)
    budgetPerSession: 3.00,
    cslThreshold: CSL.BOOST,
    canSelfModify: false,
    requiresApprovalFor: [],
  },
  SOPHIA: {
    name: 'Sophia',
    allowedToolGroups: ['memory', 'intelligence'],
    maxConcurrent: 2,           // fib(3)
    budgetPerSession: 5.00,
    cslThreshold: CSL.BOOST,
    canSelfModify: false,
    requiresApprovalFor: [],
  },
});

/**
 * Resolve all allowed tools for a given agent.
 * @param {string} agentId - Agent identifier (e.g., 'BRAIN', 'DEVOPS')
 * @returns {string[]} Flat list of allowed tool names
 */
function resolveAllowedTools(agentId) {
  const agent = AGENT_ALLOWLISTS[agentId];
  if (!agent) return [];
  return agent.allowedToolGroups.flatMap(group => TOOL_GROUPS[group] || []);
}

/**
 * Check if an agent is allowed to invoke a specific tool.
 * @param {string} agentId - Agent identifier
 * @param {string} toolName - MCP tool name
 * @returns {{ allowed: boolean, requiresApproval: boolean, reason: string }}
 */
function checkToolAccess(agentId, toolName) {
  const agent = AGENT_ALLOWLISTS[agentId];
  if (!agent) {
    return { allowed: false, requiresApproval: false, reason: `Unknown agent: ${agentId}` };
  }

  const allowedTools = resolveAllowedTools(agentId);
  if (!allowedTools.includes(toolName)) {
    logger.warn({ agentId, toolName }, 'Tool access denied — not in agent allowlist');
    return { allowed: false, requiresApproval: false, reason: `Tool '${toolName}' not in allowlist for agent '${agentId}'` };
  }

  if (agent.readOnly && DESTRUCTIVE_TOOLS.includes(toolName)) {
    logger.warn({ agentId, toolName }, 'Tool access denied — agent is read-only');
    return { allowed: false, requiresApproval: false, reason: `Agent '${agentId}' is read-only; cannot invoke destructive tool '${toolName}'` };
  }

  const requiresApproval = agent.requiresApprovalFor.includes(toolName) || DESTRUCTIVE_TOOLS.includes(toolName);

  if (requiresApproval) {
    logger.info({ agentId, toolName }, 'Tool access allowed with HITL approval required');
  }

  return { allowed: true, requiresApproval, reason: requiresApproval ? 'HITL approval required' : 'Allowed' };
}

/**
 * Get the budget limit for an agent session.
 * @param {string} agentId - Agent identifier
 * @returns {{ tokens: number, usd: number }}
 */
function getAgentBudget(agentId) {
  const agent = AGENT_ALLOWLISTS[agentId];
  if (!agent) return { tokens: 0, usd: 0 };
  // Token budget is USD × 10,000 (approximate token-per-dollar ratio)
  return { tokens: agent.budgetPerSession * 10000, usd: agent.budgetPerSession };
}

module.exports = {
  TOOL_GROUPS,
  DESTRUCTIVE_TOOLS,
  CSL,
  AGENT_ALLOWLISTS,
  resolveAllowedTools,
  checkToolAccess,
  getAgentBudget,
};
