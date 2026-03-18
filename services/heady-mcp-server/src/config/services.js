/**
 * Heady™ Service Endpoint Registry
 * Maps all 50 microservices to their connection endpoints
 */
'use strict';

const { PORTS } = require('./phi-constants');

const BASE_HOST = process.env.HEADY_SERVICE_HOST || 'localhost';
const BASE_URL = process.env.HEADY_SERVICE_BASE_URL || `http://${BASE_HOST}`;

/**
 * Service endpoint configuration
 * Each service has: port, healthPath, basePath, description
 */
const SERVICES = {
  // ═══ Core Intelligence ═══
  'heady-brain': {
    port: PORTS.HEADY_BRAIN,
    url: `${BASE_URL}:${PORTS.HEADY_BRAIN}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Central inference engine — multi-model routing',
  },
  'heady-memory': {
    port: PORTS.HEADY_MEMORY,
    url: `${BASE_URL}:${PORTS.HEADY_MEMORY}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Persistent 3D vector memory — pgvector + HNSW',
  },
  'heady-soul': {
    port: PORTS.HEADY_SOUL,
    url: `${BASE_URL}:${PORTS.HEADY_SOUL}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Values arbiter — coherence, alignment, safety',
  },
  'heady-vinci': {
    port: PORTS.HEADY_VINCI,
    url: `${BASE_URL}:${PORTS.HEADY_VINCI}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Session planner — topology, multi-step reasoning',
  },
  'heady-conductor': {
    port: PORTS.HEADY_CONDUCTOR,
    url: `${BASE_URL}:${PORTS.HEADY_CONDUCTOR}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Orchestration scheduler — task routing',
  },

  // ═══ Execution ═══
  'heady-coder': {
    port: PORTS.HEADY_CODER,
    url: `${BASE_URL}:${PORTS.HEADY_CODER}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Code generation — multi-assistant workflows',
  },
  'heady-battle': {
    port: PORTS.HEADY_BATTLE,
    url: `${BASE_URL}:${PORTS.HEADY_BATTLE}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'AI competition arena — evaluation, leaderboard',
  },
  'heady-buddy': {
    port: PORTS.HEADY_BUDDY,
    url: `${BASE_URL}:${PORTS.HEADY_BUDDY}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Personal AI assistant — multi-provider',
  },

  // ═══ Security & Ops ═══
  'heady-guard': {
    port: PORTS.HEADY_GUARD,
    url: `${BASE_URL}:${PORTS.HEADY_GUARD}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Zero-trust security — RBAC, audit, encryption',
  },
  'heady-maid': {
    port: PORTS.HEADY_MAID,
    url: `${BASE_URL}:${PORTS.HEADY_MAID}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'System cleanup — scheduling, garbage collection',
  },
  'heady-lens': {
    port: PORTS.HEADY_LENS,
    url: `${BASE_URL}:${PORTS.HEADY_LENS}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Visual analysis — image processing, detection',
  },

  // ═══ Infrastructure ═══
  'auth-session': {
    port: PORTS.AUTH_SESSION,
    url: `${BASE_URL}:${PORTS.AUTH_SESSION}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Central SSO — cross-domain auth, Firebase',
  },
  'api-gateway': {
    port: PORTS.API_GATEWAY,
    url: `${BASE_URL}:${PORTS.API_GATEWAY}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'API gateway — routing, rate limiting, auth',
  },
  'notification': {
    port: PORTS.NOTIFICATION,
    url: `${BASE_URL}:${PORTS.NOTIFICATION}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'WebSocket + SSE + push notifications',
  },
  'billing': {
    port: PORTS.BILLING,
    url: `${BASE_URL}:${PORTS.BILLING}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Stripe billing — φ-scaled plans',
  },
  'analytics': {
    port: PORTS.ANALYTICS,
    url: `${BASE_URL}:${PORTS.ANALYTICS}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Privacy-first analytics — funnels, timeseries',
  },
  'search': {
    port: PORTS.SEARCH,
    url: `${BASE_URL}:${PORTS.SEARCH}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Hybrid search — vector + full-text',
  },
  'scheduler': {
    port: PORTS.SCHEDULER,
    url: `${BASE_URL}:${PORTS.SCHEDULER}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Fibonacci-interval job scheduler',
  },
  'hcfp': {
    port: PORTS.HCFP,
    url: `${BASE_URL}:${PORTS.HCFP}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Heady Context Flow Processor — auto-success pipeline',
  },
  'edge-ai': {
    port: PORTS.EDGE_AI,
    url: `${BASE_URL}:${PORTS.EDGE_AI}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Cloudflare edge AI — embeddings, classification',
  },

  // ═══════════════════════════════════════════════════════════════════
  // ADVANCED MCP SERVICES — 45 new φ-scaled microservices
  // ═══════════════════════════════════════════════════════════════════

  // ── Tier 0 — Critical Intelligence ────────────────────────────────
  'heady-chrono': {
    port: PORTS.HEADY_CHRONO,
    url: `${BASE_URL}:${PORTS.HEADY_CHRONO}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Temporal intelligence — event correlation, bisect, replay',
  },
  'heady-cartograph': {
    port: PORTS.HEADY_CARTOGRAPH,
    url: `${BASE_URL}:${PORTS.HEADY_CARTOGRAPH}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Dependency & impact mapper — blast radius, graph analysis',
  },
  'heady-synapse': {
    port: PORTS.HEADY_SYNAPSE,
    url: `${BASE_URL}:${PORTS.HEADY_SYNAPSE}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Inter-agent communication bus — semantic pub/sub, negotiation',
  },
  'heady-aurora': {
    port: PORTS.HEADY_AURORA,
    url: `${BASE_URL}:${PORTS.HEADY_AURORA}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Ambient context enricher — peripheral awareness, relevance',
  },
  'heady-nexus': {
    port: PORTS.HEADY_NEXUS,
    url: `${BASE_URL}:${PORTS.HEADY_NEXUS}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Knowledge graph engine — traverse, connect, visualize',
  },

  // ── Tier 1 — Analysis & Orchestration ─────────────────────────────
  'heady-prism': {
    port: PORTS.HEADY_PRISM,
    url: `${BASE_URL}:${PORTS.HEADY_PRISM}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Multi-perspective code review — faceted analysis, consensus',
  },
  'heady-loom': {
    port: PORTS.HEADY_LOOM,
    url: `${BASE_URL}:${PORTS.HEADY_LOOM}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Workflow weaver — compose, inspect, replay multi-service flows',
  },
  'heady-axiom': {
    port: PORTS.HEADY_AXIOM,
    url: `${BASE_URL}:${PORTS.HEADY_AXIOM}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Invariant & contract enforcer — define, check, enforce',
  },
  'heady-mosaic': {
    port: PORTS.HEADY_MOSAIC,
    url: `${BASE_URL}:${PORTS.HEADY_MOSAIC}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Multi-repo orchestrator — atomic cross-repo changes, sync',
  },
  'heady-cadence': {
    port: PORTS.HEADY_CADENCE,
    url: `${BASE_URL}:${PORTS.HEADY_CADENCE}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Release rhythm manager — changelogs, gates, ship',
  },
  'heady-chimera': {
    port: PORTS.HEADY_CHIMERA,
    url: `${BASE_URL}:${PORTS.HEADY_CHIMERA}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Multi-model AI router — benchmark, blend, cost optimize',
  },
  'heady-tapestry': {
    port: PORTS.HEADY_TAPESTRY,
    url: `${BASE_URL}:${PORTS.HEADY_TAPESTRY}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Event sourcing & CQRS — emit, replay, project, snapshot',
  },

  // ── Tier 2 — Operations & Security ────────────────────────────────
  'heady-echo': {
    port: PORTS.HEADY_ECHO,
    url: `${BASE_URL}:${PORTS.HEADY_ECHO}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Cross-environment diff — staging vs prod, promote, rollback',
  },
  'heady-vault': {
    port: PORTS.HEADY_VAULT,
    url: `${BASE_URL}:${PORTS.HEADY_VAULT}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Secrets lifecycle — rotate, audit, blast radius, revoke',
  },
  'heady-aegis': {
    port: PORTS.HEADY_AEGIS,
    url: `${BASE_URL}:${PORTS.HEADY_AEGIS}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Security posture manager — assess, harden, compliance, threat model',
  },
  'heady-crucible': {
    port: PORTS.HEADY_CRUCIBLE,
    url: `${BASE_URL}:${PORTS.HEADY_CRUCIBLE}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Chaos engineering — fault injection, scenarios, resilience reports',
  },
  'heady-arbiter': {
    port: PORTS.HEADY_ARBITER,
    url: `${BASE_URL}:${PORTS.HEADY_ARBITER}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Conflict resolution — predict, resolve, drift, reconcile',
  },
  'heady-ouroboros': {
    port: PORTS.HEADY_OUROBOROS,
    url: `${BASE_URL}:${PORTS.HEADY_OUROBOROS}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Self-healing pipeline — diagnose, heal, evolve, journal',
  },
  'heady-mycelium': {
    port: PORTS.HEADY_MYCELIUM,
    url: `${BASE_URL}:${PORTS.HEADY_MYCELIUM}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Service mesh intelligence — traces, topology, hotspots',
  },
  'heady-rune': {
    port: PORTS.HEADY_RUNE,
    url: `${BASE_URL}:${PORTS.HEADY_RUNE}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Infrastructure as Code — plan, apply, drift, rollback, cost',
  },

  // ── Tier 3 — Intelligence & Optimization ──────────────────────────
  'heady-oracle': {
    port: PORTS.HEADY_ORACLE,
    url: `${BASE_URL}:${PORTS.HEADY_ORACLE}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Predictive resource planner — forecast, capacity, cost',
  },
  'heady-nimbus': {
    port: PORTS.HEADY_NIMBUS,
    url: `${BASE_URL}:${PORTS.HEADY_NIMBUS}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Cloud cost intelligence — spend, waste, optimize, forecast',
  },
  'heady-patina': {
    port: PORTS.HEADY_PATINA,
    url: `${BASE_URL}:${PORTS.HEADY_PATINA}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Technical debt tracker — scan, score, prioritize, track',
  },
  'heady-polaris': {
    port: PORTS.HEADY_POLARIS,
    url: `${BASE_URL}:${PORTS.HEADY_POLARIS}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'North star metrics — define, track, correlate, dashboard',
  },
  'heady-solstice': {
    port: PORTS.HEADY_SOLSTICE,
    url: `${BASE_URL}:${PORTS.HEADY_SOLSTICE}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Seasonal pattern analyzer — detect, predict, anomaly, calibrate',
  },
  'heady-quantum': {
    port: PORTS.HEADY_QUANTUM,
    url: `${BASE_URL}:${PORTS.HEADY_QUANTUM}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Probabilistic decision engine — Monte Carlo, Bayesian, φ-weighted',
  },
  'heady-tempest': {
    port: PORTS.HEADY_TEMPEST,
    url: `${BASE_URL}:${PORTS.HEADY_TEMPEST}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Load & stress testing — φ-scaled ramp, scenarios, baselines',
  },
  'heady-verdant': {
    port: PORTS.HEADY_VERDANT,
    url: `${BASE_URL}:${PORTS.HEADY_VERDANT}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Green computing tracker — carbon footprint, sustainability',
  },

  // ── Tier 4 — Developer Experience ─────────────────────────────────
  'heady-compass': {
    port: PORTS.HEADY_COMPASS,
    url: `${BASE_URL}:${PORTS.HEADY_COMPASS}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Developer experience navigator — howto, examples, setup',
  },
  'heady-scribe': {
    port: PORTS.HEADY_SCRIBE,
    url: `${BASE_URL}:${PORTS.HEADY_SCRIBE}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Auto-documentation generator — docs, diagrams, runbooks',
  },
  'heady-fossil': {
    port: PORTS.HEADY_FOSSIL,
    url: `${BASE_URL}:${PORTS.HEADY_FOSSIL}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Code archaeology — deep blame, decision trails, experts',
  },
  'heady-genesis': {
    port: PORTS.HEADY_GENESIS,
    url: `${BASE_URL}:${PORTS.HEADY_GENESIS}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Project scaffolder — templates, migration, validation',
  },
  'heady-labyrinth': {
    port: PORTS.HEADY_LABYRINTH,
    url: `${BASE_URL}:${PORTS.HEADY_LABYRINTH}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Test maze runner — generate, mutate, coverage, fuzz',
  },
  'heady-mimic': {
    port: PORTS.HEADY_MIMIC,
    url: `${BASE_URL}:${PORTS.HEADY_MIMIC}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Mock & fixture generator — synthetic data, snapshots, replay',
  },

  // ── Tier 5 — Data & Communication ─────────────────────────────────
  'heady-alchemy': {
    port: PORTS.HEADY_ALCHEMY,
    url: `${BASE_URL}:${PORTS.HEADY_ALCHEMY}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Data pipeline transformer — ETL, streaming, validation',
  },
  'heady-weave': {
    port: PORTS.HEADY_WEAVE,
    url: `${BASE_URL}:${PORTS.HEADY_WEAVE}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'GraphQL federation gateway — schema stitching, introspect',
  },
  'heady-herald': {
    port: PORTS.HEADY_HERALD,
    url: `${BASE_URL}:${PORTS.HEADY_HERALD}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Notification & announcement engine — multi-channel, digest',
  },
  'heady-resonance': {
    port: PORTS.HEADY_RESONANCE,
    url: `${BASE_URL}:${PORTS.HEADY_RESONANCE}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Feedback loop aggregator — themes, trends, sentiment',
  },
  'heady-ember': {
    port: PORTS.HEADY_EMBER,
    url: `${BASE_URL}:${PORTS.HEADY_EMBER}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Warm cache manager — pre-warm, invalidate, optimize',
  },
  'heady-sigil': {
    port: PORTS.HEADY_SIGIL,
    url: `${BASE_URL}:${PORTS.HEADY_SIGIL}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'API key & token manager — create, rotate, usage, revoke',
  },
  'heady-tessera': {
    port: PORTS.HEADY_TESSERA,
    url: `${BASE_URL}:${PORTS.HEADY_TESSERA}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Feature flags & experiments — φ-scaled rollout, A/B testing',
  },

  // ── Tier 6 — Platform Services ────────────────────────────────────
  'heady-lingua': {
    port: PORTS.HEADY_LINGUA,
    url: `${BASE_URL}:${PORTS.HEADY_LINGUA}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Polyglot translation & i18n — scan, translate, validate',
  },
  'heady-meridian': {
    port: PORTS.HEADY_MERIDIAN,
    url: `${BASE_URL}:${PORTS.HEADY_MERIDIAN}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Cross-timezone coordination — windows, handoffs, scheduling',
  },
  'heady-spectra': {
    port: PORTS.HEADY_SPECTRA,
    url: `${BASE_URL}:${PORTS.HEADY_SPECTRA}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'API contract testing — validate, breaking changes, compatibility',
  },
  'heady-aether': {
    port: PORTS.HEADY_AETHER,
    url: `${BASE_URL}:${PORTS.HEADY_AETHER}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Edge computing orchestrator — deploy, CDN, geo-routing, latency',
  },
};

/**
 * Get service endpoint config
 */
function getServiceEndpoint(serviceName) {
  return SERVICES[serviceName] || null;
}

/**
 * Get all registered services
 */
function getAllServiceEndpoints() {
  return { ...SERVICES };
}

/**
 * Build HTTP URL for a service endpoint
 */
function serviceUrl(serviceName, path = '') {
  const svc = SERVICES[serviceName];
  if (!svc) throw new Error(`Unknown service: ${serviceName}`);
  return `${svc.url}${svc.basePath}${path}`;
}

module.exports = { SERVICES, getServiceEndpoint, getAllServiceEndpoints, serviceUrl };
