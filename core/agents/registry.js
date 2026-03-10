/**
 * Heady™ Agent Registry — Canonical Agent Definitions
 * ════════════════════════════════════════════════════
 *
 * Consolidates agent definitions from:
 *   - src/agents/agent-orchestrator.js (KNOWN_AGENTS)
 *   - src/hc_orchestrator.js (initializeAgentPool)
 *   - claude-agents/agent-config.json
 *
 * Single source of truth for all agent configurations.
 *
 * @module core/agents/registry
 */
'use strict';

const { fib, CSL } = require('../constants/phi');

// ─── Named Agents ──────────────────────────────────────────────────────────────

const AGENTS = {
  // ── Core Intelligence ──
  BRAIN: {
    name: 'brain',
    displayName: 'Heady Brain',
    role: 'Central cognitive engine',
    categories: ['analysis', 'reasoning', 'planning', 'synthesis'],
    domains: ['*'],  // Universal
    modelTier: 'premium',
    maxConcurrent: fib(4),  // 3
    tools: ['deep_scan', 'analyze', 'risks', 'patterns', 'refactor',
            'memory', 'embed', 'learn', 'recall',
            'auto_flow', 'orchestrator', 'hcfp_status', 'csl_engine',
            'coder', 'battle', 'buddy', 'chat',
            'deploy', 'health', 'ops', 'maintenance',
            'cms_content', 'cms_taxonomy', 'cms_media'],
    cslThreshold: CSL.BOOST,
  },

  // ── Research & Analysis ──
  RESEARCHER: {
    name: 'researcher',
    displayName: 'Heady Researcher',
    role: 'Autonomous deep research',
    categories: ['research', 'analysis', 'data', 'discovery'],
    domains: ['intelligence', 'science', 'technology'],
    modelTier: 'premium',
    maxConcurrent: fib(3),  // 2
    tools: ['deep_scan', 'analyze', 'patterns', 'memory', 'recall', 'vector_search'],
    cslThreshold: CSL.BOOST,
  },

  // ── Platform Operations ──
  DEVOPS: {
    name: 'devops',
    displayName: 'Heady DevOps',
    role: 'Platform monitoring & deployment',
    categories: ['deployment', 'monitoring', 'maintenance', 'infrastructure'],
    domains: ['operations', 'security', 'performance'],
    modelTier: 'standard',
    maxConcurrent: fib(4),  // 3
    tools: ['deploy', 'health', 'ops', 'maintenance', 'maid', 'telemetry', 'edge_ai'],
    cslThreshold: CSL.INCLUDE,
  },

  // ── Content Management ──
  CONTENT: {
    name: 'content',
    displayName: 'Heady Content',
    role: 'CMS publishing across 9 sites',
    categories: ['content', 'publishing', 'media', 'seo'],
    domains: ['cms', 'marketing', 'communication'],
    modelTier: 'standard',
    maxConcurrent: fib(4),  // 3
    tools: ['cms_content', 'cms_taxonomy', 'cms_media', 'cms_views', 'cms_search',
            'analyze', 'memory', 'learn'],
    cslThreshold: CSL.INCLUDE,
  },

  // ── Specialized Agents (from KNOWN_AGENTS) ──
  JULES: {
    name: 'jules',
    displayName: 'Jules',
    role: 'Task automation & scheduling',
    categories: ['automation', 'scheduling'],
    domains: ['workflow'],
    modelTier: 'fast',
    maxConcurrent: fib(5),  // 5
    tools: ['auto_flow', 'orchestrator'],
    cslThreshold: CSL.INCLUDE,
  },

  BUILDER: {
    name: 'builder',
    displayName: 'Builder',
    role: 'Code generation & scaffolding',
    categories: ['coding', 'generation', 'scaffolding'],
    domains: ['engineering'],
    modelTier: 'premium',
    maxConcurrent: fib(3),  // 2
    tools: ['coder', 'battle', 'buddy'],
    cslThreshold: CSL.BOOST,
  },

  OBSERVER: {
    name: 'observer',
    displayName: 'Observer',
    role: 'System monitoring & alerting',
    categories: ['monitoring', 'alerting', 'logging'],
    domains: ['operations'],
    modelTier: 'fast',
    maxConcurrent: fib(5),  // 5
    tools: ['health', 'telemetry', 'ops'],
    cslThreshold: CSL.SUPPRESS,
  },

  SENTINEL: {
    name: 'sentinel',
    displayName: 'Sentinel',
    role: 'Security scanning & threat detection',
    categories: ['security', 'scanning', 'compliance'],
    domains: ['security'],
    modelTier: 'standard',
    maxConcurrent: fib(3),  // 2
    tools: ['risks', 'deep_scan', 'analyze'],
    cslThreshold: CSL.HIGH,
  },

  ATLAS: {
    name: 'atlas',
    displayName: 'Atlas',
    role: 'Data mapping & integration',
    categories: ['data', 'integration', 'mapping'],
    domains: ['data'],
    modelTier: 'standard',
    maxConcurrent: fib(4),  // 3
    tools: ['analyze', 'patterns', 'memory'],
    cslThreshold: CSL.INCLUDE,
  },

  MUSE: {
    name: 'muse',
    displayName: 'Muse',
    role: 'Creative content & copywriting',
    categories: ['creative', 'writing', 'design'],
    domains: ['content', 'marketing'],
    modelTier: 'premium',
    maxConcurrent: fib(3),  // 2
    tools: ['cms_content', 'cms_media', 'analyze'],
    cslThreshold: CSL.BOOST,
  },

  SOPHIA: {
    name: 'sophia',
    displayName: 'Sophia',
    role: 'Knowledge synthesis & learning',
    categories: ['learning', 'synthesis', 'knowledge'],
    domains: ['intelligence', 'education'],
    modelTier: 'premium',
    maxConcurrent: fib(3),  // 2
    tools: ['memory', 'learn', 'recall', 'embed', 'vector_search', 'analyze'],
    cslThreshold: CSL.BOOST,
  },
};

// ─── Agent Name Lookup ─────────────────────────────────────────────────────────

const AGENT_NAMES = Object.keys(AGENTS);
const AGENT_BY_NAME = new Map(Object.values(AGENTS).map(a => [a.name, a]));

/** Get agent config by name (case-insensitive) */
function getAgent(name) {
  return AGENT_BY_NAME.get(name.toLowerCase()) || null;
}

/** Find agents that handle a given category */
function findAgentsByCategory(category) {
  return Object.values(AGENTS).filter(a =>
    a.categories.includes(category) || a.domains.includes('*')
  );
}

/** Find agents that have a specific tool */
function findAgentsByTool(toolName) {
  return Object.values(AGENTS).filter(a => a.tools.includes(toolName));
}

module.exports = { AGENTS, AGENT_NAMES, getAgent, findAgentsByCategory, findAgentsByTool };
