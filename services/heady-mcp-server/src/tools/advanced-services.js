/**
 * ═══════════════════════════════════════════════════════════════════════
 * HEADY™ ADVANCED MCP SERVICES v5.1 — 25 New Services, 109 Tools
 * ═══════════════════════════════════════════════════════════════════════
 * All services follow φ-scaled tiers with CSL-gated routing.
 * Each tool wires to its dedicated microservice via callService().
 *
 * @module tools/advanced-services
 * @version 5.1.0
 */
'use strict';

const { PHI, PSI, PSI2, FIB, CSL } = require('../config/phi-constants');
const { callService } = require('./service-client');

function registerAdvancedServices(register) {

  // ═══════════════════════════════════════════════════════════════════
  // SERVICE 1: HEADY-CHRONO — Temporal Intelligence
  // ═══════════════════════════════════════════════════════════════════

  register({
    name: 'heady_chrono_timeline',
    description: 'Build timeline of ecosystem events — deploys, incidents, config changes, PR merges across all services.',
    category: 'intelligence',
    phiTier: 0,
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Start time (ISO 8601)' },
        to: { type: 'string', description: 'End time (ISO 8601)' },
        services: { type: 'array', items: { type: 'string' }, description: 'Filter by service names' },
        eventTypes: { type: 'array', items: { type: 'string', enum: ['deploy', 'incident', 'config', 'pr', 'release', 'alert'] }, description: 'Event type filter' },
        limit: { type: 'integer', default: 50, description: 'Max events to return' },
      },
      required: ['from'],
    },
    handler: (args) => callService('heady-chrono', '/timeline', args),
  });

  register({
    name: 'heady_chrono_correlate',
    description: 'Correlate events across services in a time window — find causal chains between deploys, errors, and alerts.',
    category: 'intelligence',
    phiTier: 0,
    inputSchema: {
      type: 'object',
      properties: {
        event: { type: 'string', description: 'Anchor event description or ID' },
        windowMinutes: { type: 'integer', default: 30, description: 'Correlation window in minutes' },
        minCorrelation: { type: 'number', default: 0.618, description: 'Minimum correlation score (ψ default)' },
      },
      required: ['event'],
    },
    handler: (args) => callService('heady-chrono', '/correlate', args),
  });

  register({
    name: 'heady_chrono_bisect',
    description: 'Binary search through time to find when a behavior changed — like git bisect for system state.',
    category: 'intelligence',
    phiTier: 0,
    inputSchema: {
      type: 'object',
      properties: {
        condition: { type: 'string', description: 'Condition to test (natural language or metric query)' },
        knownGood: { type: 'string', description: 'Time when condition was true (ISO 8601)' },
        knownBad: { type: 'string', description: 'Time when condition became false (ISO 8601)' },
      },
      required: ['condition', 'knownGood', 'knownBad'],
    },
    handler: (args) => callService('heady-chrono', '/bisect', args),
  });

  register({
    name: 'heady_chrono_replay',
    description: 'Replay events from a point in time — reconstruct system state at any historical moment.',
    category: 'intelligence',
    phiTier: 0,
    inputSchema: {
      type: 'object',
      properties: {
        timestamp: { type: 'string', description: 'Point in time to replay from (ISO 8601)' },
        duration: { type: 'string', default: '1h', description: 'Duration to replay' },
        speed: { type: 'number', default: 1.0, description: 'Replay speed multiplier' },
      },
      required: ['timestamp'],
    },
    handler: (args) => callService('heady-chrono', '/replay', args),
  });

  // ═══════════════════════════════════════════════════════════════════
  // SERVICE 2: HEADY-CARTOGRAPH — Dependency & Impact Mapper
  // ═══════════════════════════════════════════════════════════════════

  register({
    name: 'heady_carto_impact',
    description: 'Analyze blast radius of changing a service — what breaks, what degrades, what needs testing.',
    category: 'intelligence',
    phiTier: 0,
    inputSchema: {
      type: 'object',
      properties: {
        service: { type: 'string', description: 'Service to analyze' },
        changeType: { type: 'string', enum: ['api', 'config', 'schema', 'dependency', 'removal'], default: 'api' },
        depth: { type: 'integer', default: 3, description: 'Impact depth to traverse' },
      },
      required: ['service'],
    },
    handler: (args) => callService('heady-cartograph', '/impact', args),
  });

  register({
    name: 'heady_carto_graph',
    description: 'Generate full dependency graph of the Heady ecosystem — services, configs, data flows.',
    category: 'intelligence',
    phiTier: 0,
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['all', 'runtime', 'build', 'data'], default: 'all' },
        format: { type: 'string', enum: ['json', 'dot', 'mermaid'], default: 'json' },
        filter: { type: 'string', description: 'Filter services by pattern' },
      },
    },
    handler: (args) => callService('heady-cartograph', '/graph', args),
  });

  register({
    name: 'heady_carto_upstream',
    description: 'List all upstream dependencies of a service — what it depends on.',
    category: 'intelligence',
    phiTier: 0,
    inputSchema: {
      type: 'object',
      properties: {
        service: { type: 'string', description: 'Service name' },
        depth: { type: 'integer', default: 5, description: 'Max depth' },
        includeTransitive: { type: 'boolean', default: true },
      },
      required: ['service'],
    },
    handler: (args) => callService('heady-cartograph', '/upstream', args),
  });

  register({
    name: 'heady_carto_downstream',
    description: 'List all downstream dependents — what depends on this service.',
    category: 'intelligence',
    phiTier: 0,
    inputSchema: {
      type: 'object',
      properties: {
        service: { type: 'string', description: 'Service name' },
        depth: { type: 'integer', default: 5, description: 'Max depth' },
      },
      required: ['service'],
    },
    handler: (args) => callService('heady-cartograph', '/downstream', args),
  });

  register({
    name: 'heady_carto_orphans',
    description: 'Find orphaned services with no inbound or outbound connections.',
    category: 'intelligence',
    phiTier: 0,
    inputSchema: {
      type: 'object',
      properties: {
        includeStale: { type: 'boolean', default: true, description: 'Include stale services (no deploys in 30 days)' },
      },
    },
    handler: (args) => callService('heady-cartograph', '/orphans', args),
  });

  // ═══════════════════════════════════════════════════════════════════
  // SERVICE 3: HEADY-LINGUA — i18n & Translation
  // ═══════════════════════════════════════════════════════════════════

  register({
    name: 'heady_lingua_scan',
    description: 'Scan codebase for untranslated strings across all UI surfaces.',
    category: 'platform',
    phiTier: 3,
    inputSchema: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Directory to scan' },
        filePatterns: { type: 'array', items: { type: 'string' }, default: ['*.tsx', '*.jsx', '*.html'] },
        locale: { type: 'string', default: 'en', description: 'Base locale' },
      },
      required: ['directory'],
    },
    handler: (args) => callService('heady-lingua', '/scan', args),
  });

  register({
    name: 'heady_lingua_translate',
    description: 'Generate translations for a target locale using AI-powered translation with context awareness.',
    category: 'platform',
    phiTier: 3,
    inputSchema: {
      type: 'object',
      properties: {
        strings: { type: 'array', items: { type: 'string' }, description: 'Strings to translate' },
        targetLocale: { type: 'string', description: 'Target locale (e.g., fr, es, ja, zh)' },
        context: { type: 'string', description: 'Context for better translation' },
      },
      required: ['strings', 'targetLocale'],
    },
    handler: (args) => callService('heady-lingua', '/translate', args),
  });

  register({
    name: 'heady_lingua_validate',
    description: 'Validate translation completeness, format correctness, and RTL/LTR layout compliance.',
    category: 'platform',
    phiTier: 3,
    inputSchema: {
      type: 'object',
      properties: {
        locale: { type: 'string', description: 'Locale to validate' },
        strict: { type: 'boolean', default: false, description: 'Strict mode (fail on warnings)' },
      },
      required: ['locale'],
    },
    handler: (args) => callService('heady-lingua', '/validate', args),
  });

  register({
    name: 'heady_lingua_coverage',
    description: 'Report translation coverage percentages across all locales and surfaces.',
    category: 'platform',
    phiTier: 3,
    inputSchema: {
      type: 'object',
      properties: {
        locales: { type: 'array', items: { type: 'string' }, description: 'Locales to check (empty = all)' },
      },
    },
    handler: (args) => callService('heady-lingua', '/coverage', args),
  });

  // ═══════════════════════════════════════════════════════════════════
  // SERVICE 4: HEADY-FOSSIL — Code Archaeology
  // ═══════════════════════════════════════════════════════════════════

  register({
    name: 'heady_fossil_blame_deep',
    description: 'Deep blame analysis with PR/issue context — understand the full history behind any code block.',
    category: 'devex',
    phiTier: 2,
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'File path' },
        startLine: { type: 'integer', description: 'Start line' },
        endLine: { type: 'integer', description: 'End line' },
        repo: { type: 'string', description: 'Repository name' },
      },
      required: ['file'],
    },
    handler: (args) => callService('heady-fossil', '/blame-deep', args),
  });

  register({
    name: 'heady_fossil_decision_trail',
    description: 'Trace why a code decision was made — links commits, PRs, issues, and discussions.',
    category: 'devex',
    phiTier: 2,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What decision to investigate (natural language)' },
        file: { type: 'string', description: 'Related file path' },
        repo: { type: 'string', description: 'Repository' },
      },
      required: ['query'],
    },
    handler: (args) => callService('heady-fossil', '/decision-trail', args),
  });

  register({
    name: 'heady_fossil_experts',
    description: 'Find who knows this code best — ranked by recency, depth, and breadth of contributions.',
    category: 'devex',
    phiTier: 2,
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'File or directory path' },
        repo: { type: 'string', description: 'Repository' },
        limit: { type: 'integer', default: 5, description: 'Top N experts' },
      },
      required: ['file'],
    },
    handler: (args) => callService('heady-fossil', '/experts', args),
  });

  register({
    name: 'heady_fossil_churn',
    description: 'Identify highest-churn files/modules — hotspots that change most frequently.',
    category: 'devex',
    phiTier: 2,
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository' },
        days: { type: 'integer', default: 90, description: 'Lookback period in days' },
        limit: { type: 'integer', default: 20, description: 'Top N files' },
      },
    },
    handler: (args) => callService('heady-fossil', '/churn', args),
  });

  // ═══════════════════════════════════════════════════════════════════
  // SERVICE 5: HEADY-MIMIC — Mock & Fixture Generator
  // ═══════════════════════════════════════════════════════════════════

  register({
    name: 'heady_mimic_generate',
    description: 'Generate realistic test data from schema definitions — GDPR-safe synthetic data.',
    category: 'testing',
    phiTier: 2,
    inputSchema: {
      type: 'object',
      properties: {
        schema: { type: 'string', description: 'JSON Schema or table name' },
        count: { type: 'integer', default: 10, description: 'Number of records' },
        locale: { type: 'string', default: 'en', description: 'Faker locale' },
        seed: { type: 'integer', description: 'Random seed for reproducibility' },
      },
      required: ['schema'],
    },
    handler: (args) => callService('heady-mimic', '/generate', args),
  });

  register({
    name: 'heady_mimic_from_schema',
    description: 'Create fixtures matching a JSON Schema — type-safe, constraint-aware generation.',
    category: 'testing',
    phiTier: 2,
    inputSchema: {
      type: 'object',
      properties: {
        jsonSchema: { type: 'object', description: 'JSON Schema to generate from' },
        count: { type: 'integer', default: 5 },
      },
      required: ['jsonSchema'],
    },
    handler: (args) => callService('heady-mimic', '/from-schema', args),
  });

  register({
    name: 'heady_mimic_snapshot',
    description: 'Snapshot production data shape (GDPR-safe) — captures structure without sensitive data.',
    category: 'testing',
    phiTier: 2,
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Data source (table, API endpoint)' },
        sampleSize: { type: 'integer', default: 100 },
        redactPII: { type: 'boolean', default: true },
      },
      required: ['source'],
    },
    handler: (args) => callService('heady-mimic', '/snapshot', args),
  });

  register({
    name: 'heady_mimic_replay',
    description: 'Replay production traffic patterns with synthetic data for load testing.',
    category: 'testing',
    phiTier: 2,
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Traffic pattern ID or time range' },
        scale: { type: 'number', default: 1.0, description: 'Scale factor (1.0 = same volume)' },
        target: { type: 'string', description: 'Target environment' },
      },
      required: ['pattern'],
    },
    handler: (args) => callService('heady-mimic', '/replay', args),
  });

  // ═══════════════════════════════════════════════════════════════════
  // SERVICE 6: HEADY-MERIDIAN — Cross-Timezone Coordination
  // ═══════════════════════════════════════════════════════════════════

  register({
    name: 'heady_meridian_window',
    description: 'Find optimal meeting windows across timezones for distributed teams.',
    category: 'platform',
    phiTier: 3,
    inputSchema: {
      type: 'object',
      properties: {
        participants: { type: 'array', items: { type: 'string' }, description: 'Participant emails or timezone IDs' },
        duration: { type: 'integer', default: 60, description: 'Meeting duration in minutes' },
        preference: { type: 'string', enum: ['morning', 'afternoon', 'any'], default: 'any' },
      },
      required: ['participants'],
    },
    handler: (args) => callService('heady-meridian', '/window', args),
  });

  register({
    name: 'heady_meridian_handoff',
    description: 'Generate async handoff summaries for cross-timezone collaboration.',
    category: 'platform',
    phiTier: 3,
    inputSchema: {
      type: 'object',
      properties: {
        context: { type: 'string', description: 'What was worked on' },
        blockers: { type: 'array', items: { type: 'string' }, description: 'Current blockers' },
        nextSteps: { type: 'array', items: { type: 'string' }, description: 'Suggested next steps' },
      },
      required: ['context'],
    },
    handler: (args) => callService('heady-meridian', '/handoff', args),
  });

  register({
    name: 'heady_meridian_available',
    description: 'Query who is currently available across the team.',
    category: 'platform',
    phiTier: 3,
    inputSchema: { type: 'object', properties: { team: { type: 'string', description: 'Team name filter' } } },
    handler: (args) => callService('heady-meridian', '/available', args),
  });

  register({
    name: 'heady_meridian_schedule',
    description: 'Schedule an event across timezones with automatic conversion.',
    category: 'platform',
    phiTier: 3,
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        datetime: { type: 'string', description: 'ISO 8601 datetime' },
        participants: { type: 'array', items: { type: 'string' } },
        duration: { type: 'integer', default: 60 },
      },
      required: ['title', 'datetime'],
    },
    handler: (args) => callService('heady-meridian', '/schedule', args),
  });

  // ═══════════════════════════════════════════════════════════════════
  // SERVICE 7: HEADY-ARBITER — Conflict Resolution
  // ═══════════════════════════════════════════════════════════════════

  register({
    name: 'heady_arbiter_predict',
    description: 'Predict upcoming merge conflicts across branches and repos.',
    category: 'orchestration',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: {
        repos: { type: 'array', items: { type: 'string' }, description: 'Repos to check' },
        branches: { type: 'array', items: { type: 'string' }, description: 'Branch names to compare' },
      },
    },
    handler: (args) => callService('heady-arbiter', '/predict', args),
  });

  register({
    name: 'heady_arbiter_resolve',
    description: 'Auto-resolve detected conflicts using AI-powered merge strategies.',
    category: 'orchestration',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: {
        conflictId: { type: 'string', description: 'Conflict ID' },
        strategy: { type: 'string', enum: ['auto', 'ours', 'theirs', 'merge'], default: 'auto' },
      },
      required: ['conflictId'],
    },
    handler: (args) => callService('heady-arbiter', '/resolve', args),
  });

  register({
    name: 'heady_arbiter_drift',
    description: 'Detect config drift between environments — staging vs production vs development.',
    category: 'orchestration',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: {
        envA: { type: 'string', enum: ['development', 'staging', 'production'], default: 'staging' },
        envB: { type: 'string', enum: ['development', 'staging', 'production'], default: 'production' },
        scope: { type: 'string', enum: ['config', 'secrets', 'versions', 'all'], default: 'all' },
      },
    },
    handler: (args) => callService('heady-arbiter', '/drift', args),
  });

  register({
    name: 'heady_arbiter_reconcile',
    description: 'Reconcile diverged states between environments or branches.',
    category: 'orchestration',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: {
        driftId: { type: 'string', description: 'Drift report ID' },
        direction: { type: 'string', enum: ['a-to-b', 'b-to-a', 'merge'], default: 'a-to-b' },
        dryRun: { type: 'boolean', default: true },
      },
      required: ['driftId'],
    },
    handler: (args) => callService('heady-arbiter', '/reconcile', args),
  });

  // ═══════════════════════════════════════════════════════════════════
  // SERVICE 8: HEADY-RESONANCE — Feedback Loop Aggregator
  // ═══════════════════════════════════════════════════════════════════

  register({
    name: 'heady_resonance_ingest',
    description: 'Ingest feedback from any channel — Discord, Slack, GitHub, app reviews, support tickets.',
    category: 'data',
    phiTier: 2,
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', enum: ['discord', 'slack', 'github', 'appstore', 'support', 'inapp', 'custom'] },
        content: { type: 'string', description: 'Feedback content' },
        metadata: { type: 'object', description: 'Additional metadata' },
      },
      required: ['source', 'content'],
    },
    handler: (args) => callService('heady-resonance', '/ingest', args),
  });

  register({
    name: 'heady_resonance_themes',
    description: 'Cluster feedback into themes using semantic clustering.',
    category: 'data',
    phiTier: 2,
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', default: '7d', description: 'Time period' },
        minClusterSize: { type: 'integer', default: 3 },
        sources: { type: 'array', items: { type: 'string' } },
      },
    },
    handler: (args) => callService('heady-resonance', '/themes', args),
  });

  register({
    name: 'heady_resonance_trend',
    description: 'Detect trending pain points and rising themes.',
    category: 'data',
    phiTier: 2,
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', default: '30d' },
        direction: { type: 'string', enum: ['rising', 'falling', 'both'], default: 'rising' },
      },
    },
    handler: (args) => callService('heady-resonance', '/trend', args),
  });

  register({
    name: 'heady_resonance_alert',
    description: 'Alert on sentiment shifts — detects when user satisfaction changes significantly.',
    category: 'data',
    phiTier: 2,
    inputSchema: {
      type: 'object',
      properties: {
        threshold: { type: 'number', default: 0.15, description: 'Sentiment change threshold' },
        period: { type: 'string', default: '24h' },
      },
    },
    handler: (args) => callService('heady-resonance', '/alert', args),
  });

  // ═══════════════════════════════════════════════════════════════════
  // SERVICE 9: HEADY-PRISM — Multi-Perspective Code Review
  // ═══════════════════════════════════════════════════════════════════

  register({
    name: 'heady_prism_review',
    description: 'Review code from multiple angles simultaneously — security, performance, a11y, phi-compliance.',
    category: 'analysis',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to review' },
        language: { type: 'string', description: 'Programming language' },
        facets: { type: 'array', items: { type: 'string', enum: ['security', 'performance', 'accessibility', 'phi-compliance', 'api-stability', 'maintainability'] }, default: ['security', 'performance', 'maintainability'] },
      },
      required: ['code'],
    },
    handler: (args) => callService('heady-prism', '/review', args),
  });

  register({
    name: 'heady_prism_facet',
    description: 'Review from a single specific perspective with deep analysis.',
    category: 'analysis',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to review' },
        facet: { type: 'string', enum: ['security', 'performance', 'accessibility', 'phi-compliance', 'api-stability', 'maintainability'] },
        severity: { type: 'string', enum: ['all', 'critical', 'high', 'medium'], default: 'all' },
      },
      required: ['code', 'facet'],
    },
    handler: (args) => callService('heady-prism', '/facet', args),
  });

  register({
    name: 'heady_prism_compare',
    description: 'Compare two implementations across all review facets.',
    category: 'analysis',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: {
        codeA: { type: 'string', description: 'First implementation' },
        codeB: { type: 'string', description: 'Second implementation' },
        language: { type: 'string' },
      },
      required: ['codeA', 'codeB'],
    },
    handler: (args) => callService('heady-prism', '/compare', args),
  });

  register({
    name: 'heady_prism_consensus',
    description: 'Generate consensus from multiple review facets — weighted recommendation.',
    category: 'analysis',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: {
        reviewId: { type: 'string', description: 'Review ID from prism_review' },
      },
      required: ['reviewId'],
    },
    handler: (args) => callService('heady-prism', '/consensus', args),
  });

  // ═══════════════════════════════════════════════════════════════════
  // SERVICE 10: HEADY-LOOM — Workflow Weaver
  // ═══════════════════════════════════════════════════════════════════

  register({
    name: 'heady_loom_weave',
    description: 'Create multi-service workflow from natural language description.',
    category: 'orchestration',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Workflow description in natural language' },
        trigger: { type: 'string', enum: ['manual', 'cron', 'webhook', 'event'], default: 'manual' },
        timeout: { type: 'string', default: '30m' },
      },
      required: ['description'],
    },
    handler: (args) => callService('heady-loom', '/weave', args),
  });

  register({
    name: 'heady_loom_inspect',
    description: 'Inspect running workflow state — current step, history, pending actions.',
    category: 'orchestration',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: { workflowId: { type: 'string' } },
      required: ['workflowId'],
    },
    handler: (args) => callService('heady-loom', '/inspect', args),
  });

  register({
    name: 'heady_loom_pause',
    description: 'Pause a running workflow at current checkpoint.',
    category: 'orchestration',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: { workflowId: { type: 'string' }, reason: { type: 'string' } },
      required: ['workflowId'],
    },
    handler: (args) => callService('heady-loom', '/pause', args),
  });

  register({
    name: 'heady_loom_replay',
    description: 'Replay a workflow from a specific checkpoint.',
    category: 'orchestration',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: { workflowId: { type: 'string' }, fromStep: { type: 'integer', default: 0 } },
      required: ['workflowId'],
    },
    handler: (args) => callService('heady-loom', '/replay', args),
  });

  register({
    name: 'heady_loom_unravel',
    description: 'Debug a failed workflow step-by-step — trace execution, identify failure point.',
    category: 'orchestration',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: { workflowId: { type: 'string' }, verbose: { type: 'boolean', default: true } },
      required: ['workflowId'],
    },
    handler: (args) => callService('heady-loom', '/unravel', args),
  });

  // ═══════════════════════════════════════════════════════════════════
  // SERVICE 11: HEADY-AXIOM — Invariant & Contract Enforcer
  // ═══════════════════════════════════════════════════════════════════

  register({
    name: 'heady_axiom_define',
    description: 'Define a system invariant (e.g., "API latency < 200ms", "no circular dependencies").',
    category: 'orchestration',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Invariant name' },
        condition: { type: 'string', description: 'Condition expression or natural language' },
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'], default: 'high' },
        checkInterval: { type: 'string', default: '5m' },
      },
      required: ['name', 'condition'],
    },
    handler: (args) => callService('heady-axiom', '/define', args),
  });

  register({
    name: 'heady_axiom_check',
    description: 'Check all defined invariants — returns pass/fail with details.',
    category: 'orchestration',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Filter by name pattern' },
        severity: { type: 'string', enum: ['all', 'critical', 'high'], default: 'all' },
      },
    },
    handler: (args) => callService('heady-axiom', '/check', args),
  });

  register({
    name: 'heady_axiom_report',
    description: 'Generate invariant health report — trends, violations, compliance score.',
    category: 'orchestration',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: { period: { type: 'string', default: '7d' } },
    },
    handler: (args) => callService('heady-axiom', '/report', args),
  });

  register({
    name: 'heady_axiom_enforce',
    description: 'Enable continuous enforcement of invariants — block deploys on violation.',
    category: 'orchestration',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: {
        invariantId: { type: 'string' },
        mode: { type: 'string', enum: ['enforce', 'warn', 'disable'], default: 'enforce' },
      },
      required: ['invariantId'],
    },
    handler: (args) => callService('heady-axiom', '/enforce', args),
  });

  // ═══════════════════════════════════════════════════════════════════
  // SERVICES 12-25: Remaining services (compact registration)
  // ═══════════════════════════════════════════════════════════════════

  // 12. HEADY-ORACLE — Predictive Resource Planner
  const oracleTools = [
    ['heady_oracle_forecast', 'Forecast resource needs based on growth curves and historical patterns.', { period: { type: 'string', default: '30d' }, resources: { type: 'array', items: { type: 'string' } } }, []],
    ['heady_oracle_capacity', 'Check current capacity vs projected needs — when will limits be hit.', { service: { type: 'string' } }, ['service']],
    ['heady_oracle_cost', 'Predict cloud costs for a given time period with growth projections.', { period: { type: 'string', default: '30d' }, scenario: { type: 'string', enum: ['baseline', 'growth', 'aggressive'], default: 'baseline' } }, []],
    ['heady_oracle_recommend', 'Get φ-optimized resource allocation recommendations.', { budget: { type: 'number' }, constraints: { type: 'array', items: { type: 'string' } } }, []],
  ];
  oracleTools.forEach(([name, desc, props, req]) => register({ name, description: desc, category: 'optimization', phiTier: 2, inputSchema: { type: 'object', properties: props, required: req }, handler: (args) => callService('heady-oracle', `/${name.split('_').pop()}`, args) }));

  // 13. HEADY-ECHO — Cross-Environment Diff
  const echoTools = [
    ['heady_echo_diff', 'Diff two environments — configs, versions, flags, schemas, secrets.', { envA: { type: 'string', default: 'staging' }, envB: { type: 'string', default: 'production' }, scope: { type: 'string', enum: ['config', 'versions', 'flags', 'schemas', 'all'], default: 'all' } }, []],
    ['heady_echo_snapshot', 'Take full environment state snapshot.', { env: { type: 'string' }, label: { type: 'string' } }, ['env']],
    ['heady_echo_promote', 'Promote config/version from one environment to another.', { from: { type: 'string' }, to: { type: 'string' }, items: { type: 'array', items: { type: 'string' } } }, ['from', 'to']],
    ['heady_echo_rollback', 'Rollback to a previous environment snapshot.', { snapshotId: { type: 'string' }, dryRun: { type: 'boolean', default: true } }, ['snapshotId']],
  ];
  echoTools.forEach(([name, desc, props, req]) => register({ name, description: desc, category: 'operations', phiTier: 2, inputSchema: { type: 'object', properties: props, required: req }, handler: (args) => callService('heady-echo', `/${name.split('_').pop()}`, args) }));

  // 14. HEADY-SYNAPSE — Inter-Agent Communication
  const synapseTools = [
    ['heady_synapse_publish', 'Publish message to semantic topic — CSL-routed delivery.', { topic: { type: 'string' }, payload: { type: 'object' }, priority: { type: 'number', default: 0.618 } }, ['topic', 'payload']],
    ['heady_synapse_subscribe', 'Subscribe to semantic topics with CSL matching.', { pattern: { type: 'string' }, cslThreshold: { type: 'number', default: 0.618 } }, ['pattern']],
    ['heady_synapse_query', 'Query agent state across the swarm.', { agentId: { type: 'string' }, field: { type: 'string' } }, ['agentId']],
    ['heady_synapse_negotiate', 'Negotiate resource access between agents.', { resource: { type: 'string' }, action: { type: 'string', enum: ['acquire', 'release', 'share'] } }, ['resource', 'action']],
  ];
  synapseTools.forEach(([name, desc, props, req]) => register({ name, description: desc, category: 'intelligence', phiTier: 0, inputSchema: { type: 'object', properties: props, required: req }, handler: (args) => callService('heady-synapse', `/${name.split('_').pop()}`, args) }));

  // 15. HEADY-PATINA — Technical Debt Tracker
  const patinaTools = [
    ['heady_patina_scan', 'Scan for tech debt indicators — TODOs, outdated deps, dead code, coverage gaps.', { repo: { type: 'string' }, includeDeprecated: { type: 'boolean', default: true } }, []],
    ['heady_patina_score', 'Calculate debt score per module — weighted by impact and effort.', { module: { type: 'string' } }, ['module']],
    ['heady_patina_prioritize', 'Prioritize debt payoff by ROI — highest value fixes first.', { budget: { type: 'string', default: '1 sprint' }, maxItems: { type: 'integer', default: 10 } }, []],
    ['heady_patina_track', 'Track debt trends over time — is debt growing or shrinking?', { period: { type: 'string', default: '90d' } }, []],
  ];
  patinaTools.forEach(([name, desc, props, req]) => register({ name, description: desc, category: 'optimization', phiTier: 2, inputSchema: { type: 'object', properties: props, required: req }, handler: (args) => callService('heady-patina', `/${name.split('_').pop()}`, args) }));

  // 16. HEADY-NIMBUS — Cloud Cost Intelligence
  const nimbusTools = [
    ['heady_nimbus_spend', 'Get current cloud spend breakdown by service, region, resource type.', { period: { type: 'string', default: '30d' }, groupBy: { type: 'string', enum: ['service', 'region', 'resource', 'team'], default: 'service' } }, []],
    ['heady_nimbus_waste', 'Detect wasted resources — idle instances, oversized volumes, unused LBs.', { minSavings: { type: 'number', default: 10, description: 'Min $/month to flag' } }, []],
    ['heady_nimbus_optimize', 'Get cost optimization plan with φ-scaled recommendations.', { target: { type: 'number', description: 'Target monthly budget' } }, []],
    ['heady_nimbus_forecast', 'Forecast future cloud costs based on growth trends.', { months: { type: 'integer', default: 3 } }, []],
    ['heady_nimbus_allocate', 'Allocate costs per feature or team — showback/chargeback.', { period: { type: 'string', default: '30d' } }, []],
  ];
  nimbusTools.forEach(([name, desc, props, req]) => register({ name, description: desc, category: 'optimization', phiTier: 2, inputSchema: { type: 'object', properties: props, required: req }, handler: (args) => callService('heady-nimbus', `/${name.split('_').pop()}`, args) }));

  // 17. HEADY-SCRIBE — Auto-Documentation
  const scribeTools = [
    ['heady_scribe_generate', 'Generate documentation from living code — API docs, guides.', { source: { type: 'string' }, format: { type: 'string', enum: ['markdown', 'html', 'openapi'], default: 'markdown' } }, ['source']],
    ['heady_scribe_drift', 'Detect doc-code drift — where docs are stale or wrong.', { docPath: { type: 'string' }, codePath: { type: 'string' } }, ['docPath', 'codePath']],
    ['heady_scribe_diagram', 'Generate architecture diagrams from code structure.', { scope: { type: 'string' }, format: { type: 'string', enum: ['mermaid', 'dot', 'svg'], default: 'mermaid' } }, ['scope']],
    ['heady_scribe_runbook', 'Generate incident runbooks from service definitions and past incidents.', { service: { type: 'string' } }, ['service']],
  ];
  scribeTools.forEach(([name, desc, props, req]) => register({ name, description: desc, category: 'devex', phiTier: 2, inputSchema: { type: 'object', properties: props, required: req }, handler: (args) => callService('heady-scribe', `/${name.split('_').pop()}`, args) }));

  // 18. HEADY-TESSERA — Feature Flags & Experiments
  const tesseraTools = [
    ['heady_tessera_create', 'Create feature flag with metadata and targeting rules.', { name: { type: 'string' }, description: { type: 'string' }, defaultValue: { type: 'boolean', default: false } }, ['name']],
    ['heady_tessera_rollout', 'Set φ-scaled rollout percentage (6.18%, 16.18%, 38.2%, 61.8%, 100%).', { flag: { type: 'string' }, percentage: { type: 'number' }, phiStep: { type: 'integer', description: '0-4 for φ-scaled steps' } }, ['flag']],
    ['heady_tessera_evaluate', 'Evaluate flag for a user/context — returns boolean + metadata.', { flag: { type: 'string' }, userId: { type: 'string' }, context: { type: 'object' } }, ['flag']],
    ['heady_tessera_results', 'Get experiment results with statistical significance.', { experiment: { type: 'string' } }, ['experiment']],
    ['heady_tessera_kill', 'Emergency kill switch — immediately disable a flag everywhere.', { flag: { type: 'string' }, reason: { type: 'string' } }, ['flag']],
  ];
  tesseraTools.forEach(([name, desc, props, req]) => register({ name, description: desc, category: 'data', phiTier: 2, inputSchema: { type: 'object', properties: props, required: req }, handler: (args) => callService('heady-tessera', `/${name.split('_').pop()}`, args) }));

  // 19. HEADY-VAULT — Secrets Lifecycle
  const vaultTools = [
    ['heady_vault_rotate', 'Rotate a secret with zero-downtime — updates all consumers.', { secretId: { type: 'string' }, newValue: { type: 'string' } }, ['secretId']],
    ['heady_vault_audit', 'Audit secret access patterns — who accessed what, when.', { secretId: { type: 'string' }, period: { type: 'string', default: '30d' } }, ['secretId']],
    ['heady_vault_blast_radius', 'Analyze blast radius if a secret is leaked — what is exposed.', { secretId: { type: 'string' } }, ['secretId']],
    ['heady_vault_revoke', 'Emergency revoke — instantly invalidate a secret.', { secretId: { type: 'string' }, reason: { type: 'string' } }, ['secretId']],
    ['heady_vault_expire', 'Check upcoming secret expirations across the ecosystem.', { days: { type: 'integer', default: 30 } }, []],
  ];
  vaultTools.forEach(([name, desc, props, req]) => register({ name, description: desc, category: 'security', phiTier: 1, inputSchema: { type: 'object', properties: props, required: req }, handler: (args) => callService('heady-vault', `/${name.split('_').pop()}`, args) }));

  // 20. HEADY-COMPASS — Developer Experience Navigator
  const compassTools = [
    ['heady_compass_howto', 'Find how to do something in the Heady ecosystem — searches all repos, docs, Slack.', { question: { type: 'string' } }, ['question']],
    ['heady_compass_example', 'Find best examples of a pattern or implementation.', { pattern: { type: 'string' }, language: { type: 'string' } }, ['pattern']],
    ['heady_compass_setup', 'Generate setup instructions for a service or development environment.', { service: { type: 'string' } }, ['service']],
    ['heady_compass_path', 'Map learning path for a topic — ordered resources for onboarding.', { topic: { type: 'string' }, level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' } }, ['topic']],
  ];
  compassTools.forEach(([name, desc, props, req]) => register({ name, description: desc, category: 'devex', phiTier: 2, inputSchema: { type: 'object', properties: props, required: req }, handler: (args) => callService('heady-compass', `/${name.split('_').pop()}`, args) }));

  // 21. HEADY-CRUCIBLE — Chaos Engineering
  const crucibleTools = [
    ['heady_crucible_inject', 'Inject fault into a service — latency, errors, partition.', { service: { type: 'string' }, faultType: { type: 'string', enum: ['latency', 'error', 'partition', 'cpu', 'memory'] }, duration: { type: 'string', default: '5m' } }, ['service', 'faultType']],
    ['heady_crucible_scenario', 'Run predefined chaos scenario with φ-scaled blast radius.', { scenario: { type: 'string', enum: ['network-partition', 'cascade-failure', 'slow-dependency', 'zone-outage'] } }, ['scenario']],
    ['heady_crucible_observe', 'Observe system behavior during chaos — metrics, errors, recovery.', { experimentId: { type: 'string' } }, ['experimentId']],
    ['heady_crucible_report', 'Generate resilience report after chaos experiment.', { experimentId: { type: 'string' } }, ['experimentId']],
    ['heady_crucible_abort', 'Emergency abort all active chaos experiments.', { reason: { type: 'string' } }, []],
  ];
  crucibleTools.forEach(([name, desc, props, req]) => register({ name, description: desc, category: 'testing', phiTier: 2, inputSchema: { type: 'object', properties: props, required: req }, handler: (args) => callService('heady-crucible', `/${name.split('_').pop()}`, args) }));

  // 22. HEADY-MOSAIC — Multi-Repo Orchestrator
  const mosaicTools = [
    ['heady_mosaic_plan', 'Plan cross-repo change — identify all repos affected, order of changes.', { description: { type: 'string' }, repos: { type: 'array', items: { type: 'string' } } }, ['description']],
    ['heady_mosaic_execute', 'Execute cross-repo PRs atomically — all succeed or all fail.', { planId: { type: 'string' }, dryRun: { type: 'boolean', default: true } }, ['planId']],
    ['heady_mosaic_status', 'Check cross-repo operation status.', { operationId: { type: 'string' } }, ['operationId']],
    ['heady_mosaic_rollback', 'Rollback cross-repo change — revert all affected repos.', { operationId: { type: 'string' } }, ['operationId']],
    ['heady_mosaic_sync', 'Sync dependency versions across repos — coordinate version bumps.', { package: { type: 'string' }, version: { type: 'string' } }, ['package', 'version']],
  ];
  mosaicTools.forEach(([name, desc, props, req]) => register({ name, description: desc, category: 'orchestration', phiTier: 1, inputSchema: { type: 'object', properties: props, required: req }, handler: (args) => callService('heady-mosaic', `/${name.split('_').pop()}`, args) }));

  // 23. HEADY-CADENCE — Release Rhythm
  const cadenceTools = [
    ['heady_cadence_prepare', 'Prepare release candidate — version bump, freeze, pre-checks.', { version: { type: 'string' }, branch: { type: 'string', default: 'main' } }, ['version']],
    ['heady_cadence_changelog', 'Generate changelog from commits, PRs, and issues.', { from: { type: 'string' }, to: { type: 'string', default: 'HEAD' }, format: { type: 'string', enum: ['markdown', 'json'], default: 'markdown' } }, ['from']],
    ['heady_cadence_gate', 'Run release gate checks — tests, coverage, security, performance.', { version: { type: 'string' } }, ['version']],
    ['heady_cadence_ship', 'Ship release to production — deploy, verify, announce.', { version: { type: 'string' }, strategy: { type: 'string', enum: ['canary', 'blue-green', 'rolling'], default: 'canary' } }, ['version']],
    ['heady_cadence_announce', 'Generate release announcements for all channels.', { version: { type: 'string' }, audience: { type: 'string', enum: ['internal', 'public', 'both'], default: 'both' } }, ['version']],
  ];
  cadenceTools.forEach(([name, desc, props, req]) => register({ name, description: desc, category: 'orchestration', phiTier: 1, inputSchema: { type: 'object', properties: props, required: req }, handler: (args) => callService('heady-cadence', `/${name.split('_').pop()}`, args) }));

  // 24. HEADY-SPECTRA — API Contract Testing
  const spectraTools = [
    ['heady_spectra_validate', 'Validate API contract against implementation.', { spec: { type: 'string', description: 'OpenAPI spec path or URL' }, target: { type: 'string', description: 'API base URL' } }, ['spec', 'target']],
    ['heady_spectra_breaking', 'Detect breaking changes between two API versions.', { oldSpec: { type: 'string' }, newSpec: { type: 'string' } }, ['oldSpec', 'newSpec']],
    ['heady_spectra_matrix', 'Generate compatibility matrix across service versions.', { services: { type: 'array', items: { type: 'string' } } }, []],
    ['heady_spectra_generate', 'Generate consumer-driven contract tests.', { producer: { type: 'string' }, consumer: { type: 'string' } }, ['producer', 'consumer']],
    ['heady_spectra_evolve', 'Evolve API version with backwards compatibility checks.', { spec: { type: 'string' }, changes: { type: 'array', items: { type: 'string' } } }, ['spec', 'changes']],
  ];
  spectraTools.forEach(([name, desc, props, req]) => register({ name, description: desc, category: 'testing', phiTier: 2, inputSchema: { type: 'object', properties: props, required: req }, handler: (args) => callService('heady-spectra', `/${name.split('_').pop()}`, args) }));

  // 25. HEADY-AURORA — Ambient Context Enricher
  const auroraTools = [
    ['heady_aurora_context', 'Get enriched context for current system state — recent deploys, incidents, on-call.', { scope: { type: 'string', enum: ['full', 'minimal', 'relevant'], default: 'relevant' } }, []],
    ['heady_aurora_enrich', 'Enrich a request with ambient context — adds peripheral awareness.', { request: { type: 'object', description: 'Request to enrich' }, depth: { type: 'string', enum: ['shallow', 'deep'], default: 'shallow' } }, ['request']],
    ['heady_aurora_relevant', 'Find relevant recent events for a given context.', { context: { type: 'string' }, limit: { type: 'integer', default: 10 } }, ['context']],
    ['heady_aurora_ambient', 'Get ambient system awareness snapshot — everything an agent should know.', { agentId: { type: 'string' } }, []],
  ];
  auroraTools.forEach(([name, desc, props, req]) => register({ name, description: desc, category: 'intelligence', phiTier: 0, inputSchema: { type: 'object', properties: props, required: req }, handler: (args) => callService('heady-aurora', `/${name.split('_').pop()}`, args) }));
}

module.exports = { registerAdvancedServices };
