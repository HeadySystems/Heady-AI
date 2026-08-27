// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ PortfolioStatusBee v1.0.0                              ║
// ║  Swarm 22 (Announcer) — Domain lifecycle status injection      ║
// ║  Made with ❤️ by HeadySystems Inc.                             ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── φ-derived constants ─────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 1 / PHI;                       // 0.618…
const EVALUATION_INTERVAL = Math.round(PHI * PHI * PHI * 1000); // φ³ × 1000 ≈ 4236ms
const BANNER_TTL_SECONDS = Math.round(PHI * PHI * PHI * PHI * PHI * 10); // φ⁵ × 10 ≈ 112s

// ── Valid lifecycle states ──────────────────────────────────────────
const VALID_STATUSES = new Set([
  'production',
  'beta',
  'coming-soon',
  'maintenance',
]);

// ── Banner templates per status ─────────────────────────────────────
const BANNER_TEMPLATES = {
  'production': null, // No banner needed for production domains
  'beta': {
    type: 'info',
    text: '🧪 Beta — This service is in active development. Expect rapid improvements.',
    css: `
      .heady-status-banner { 
        position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
        background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
        color: #fff; text-align: center; padding: 8px 16px;
        font-family: 'Inter', system-ui, sans-serif; font-size: 13px;
        letter-spacing: 0.02em; backdrop-filter: blur(8px);
        animation: heady-banner-slide 0.4s ease-out;
      }
      @keyframes heady-banner-slide {
        from { transform: translateY(-100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `,
  },
  'coming-soon': {
    type: 'announcement',
    text: '🚀 Coming Soon — This Heady node is under construction. Stay tuned.',
    css: `
      .heady-status-banner {
        position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
        background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
        color: #fff; text-align: center; padding: 10px 16px;
        font-family: 'Inter', system-ui, sans-serif; font-size: 14px;
        font-weight: 600; letter-spacing: 0.03em;
        animation: heady-banner-pulse 2s ease-in-out infinite alternate;
      }
      @keyframes heady-banner-pulse {
        from { opacity: 0.9; }
        to { opacity: 1; }
      }
    `,
  },
  'maintenance': {
    type: 'warning',
    text: '🔧 Maintenance — This service is temporarily offline for scheduled maintenance.',
    css: `
      .heady-status-banner {
        position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: #fff; text-align: center; padding: 10px 16px;
        font-family: 'Inter', system-ui, sans-serif; font-size: 14px;
        font-weight: 600;
      }
    `,
  },
};

/**
 * PortfolioStatusBee — Bee #151 in Swarm 22 (Announcer)
 *
 * Responsibilities:
 *   1. Read site-registry.json (source of truth)
 *   2. Evaluate each domain's launchStatus
 *   3. Generate cross-domain injection payloads (CSS/HTML banners)
 *   4. Broadcast status changes via the event bus
 *
 * Activation: Deployment event or registry file change
 * CSL Gate:   ≥ 0.618 (PSI)
 */
const domain = 'portfolio-status';
const description = 'Tracks domain lifecycle states and auto-injects routing banners across the 11-domain projection mesh';
const priority = 0.9;
const swarm = 22;
const beeId = 151;

/**
 * Load and parse site-registry.json
 * @returns {Promise<Object>} Parsed registry
 */
async function loadRegistry() {
  const registryPath = resolve(__dirname, '..', 'sites', 'site-registry.json');
  const raw = await readFile(registryPath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Evaluate the portfolio — scan all preconfigured domains and return
 * a structured status map.
 *
 * @returns {Promise<Object>} Portfolio evaluation result
 */
async function evaluatePortfolio() {
  const registry = await loadRegistry();
  const domains = registry.preconfigured || {};
  const portfolio = {
    production: [],
    beta: [],
    'coming-soon': [],
    maintenance: [],
    unknown: [],
    totalDomains: 0,
    evaluatedAt: new Date().toISOString(),
  };

  for (const [domainName, config] of Object.entries(domains)) {
    const status = config.launchStatus || 'coming-soon';
    portfolio.totalDomains++;

    if (VALID_STATUSES.has(status)) {
      portfolio[status].push({
        domain: domainName,
        name: config.name,
        status,
        chatEnabled: config.chatEnabled ?? false,
      });
    } else {
      portfolio.unknown.push({
        domain: domainName,
        name: config.name,
        status,
        issue: `Invalid launchStatus: "${status}"`,
      });
    }
  }

  return portfolio;
}

/**
 * Generate cross-domain injection payloads.
 * Returns an object keyed by domain with the HTML/CSS snippet to inject.
 *
 * @returns {Promise<Object>} Map of domain → injection payload
 */
async function generateCrossDomainInjections() {
  const portfolio = await evaluatePortfolio();
  const injections = {};

  const allDomains = [
    ...portfolio.production,
    ...portfolio.beta,
    ...portfolio['coming-soon'],
    ...portfolio.maintenance,
  ];

  for (const entry of allDomains) {
    const template = BANNER_TEMPLATES[entry.status];
    if (!template) {
      // Production domains get no banner
      injections[entry.domain] = { inject: false, status: entry.status };
      continue;
    }

    injections[entry.domain] = {
      inject: true,
      status: entry.status,
      bannerType: template.type,
      html: `<div class="heady-status-banner" data-heady-status="${entry.status}">${template.text}</div>`,
      css: template.css.trim(),
      ttl: BANNER_TTL_SECONDS,
    };
  }

  return {
    injections,
    summary: {
      production: portfolio.production.length,
      beta: portfolio.beta.length,
      comingSoon: portfolio['coming-soon'].length,
      maintenance: portfolio.maintenance.length,
      totalInjections: Object.values(injections).filter(i => i.inject).length,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Broadcast status changes to the event bus.
 * Emits on channel: `announcer.portfolio.status`
 *
 * @param {Object} [eventBus] - Optional event bus reference (defaults to global)
 * @returns {Promise<Object>} Broadcast result
 */
async function broadcastStatus(eventBus) {
  const bus = eventBus || globalThis.eventBus;
  const portfolio = await evaluatePortfolio();

  const payload = {
    channel: 'announcer.portfolio.status',
    swarm,
    beeId,
    portfolio: {
      production: portfolio.production.map(d => d.domain),
      beta: portfolio.beta.map(d => d.domain),
      comingSoon: portfolio['coming-soon'].map(d => d.domain),
      maintenance: portfolio.maintenance.map(d => d.domain),
    },
    totalDomains: portfolio.totalDomains,
    ts: Date.now(),
  };

  if (bus && typeof bus.emit === 'function') {
    bus.emit('announcer.portfolio.status', payload);
  }

  return payload;
}

/**
 * Main getWork entry point — returns the array of work functions
 * compatible with the BeeFactory protocol.
 *
 * @param {Object} ctx - Execution context from the swarm orchestrator
 * @returns {Function[]} Array of async work functions
 */
function getWork(ctx = {}) {
  return [
    async () => {
      const portfolio = await evaluatePortfolio();
      return {
        bee: domain,
        action: 'evaluate-portfolio',
        status: 'active',
        ...portfolio,
        ts: Date.now(),
      };
    },
    async () => {
      const result = await generateCrossDomainInjections();
      return {
        bee: domain,
        action: 'generate-injections',
        status: 'active',
        ...result,
        ts: Date.now(),
      };
    },
    async () => {
      const result = await broadcastStatus(ctx.eventBus);
      return {
        bee: domain,
        action: 'broadcast-status',
        status: 'active',
        ...result,
      };
    },
  ];
}

// ── Latent Service Pattern exports ──────────────────────────────────
let _intervalHandle = null;

async function start() {
  const portfolio = await evaluatePortfolio();
  _intervalHandle = setInterval(async () => {
    try {
      await broadcastStatus();
    } catch { /* circuit breaker handles this upstream */ }
  }, EVALUATION_INTERVAL);

  return { swarm, beeId, domain, started: true, domains: portfolio.totalDomains };
}

function stop() {
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
  return { swarm, beeId, domain, stopped: true };
}

async function health() {
  try {
    const portfolio = await evaluatePortfolio();
    return { healthy: true, domains: portfolio.totalDomains, ts: Date.now() };
  } catch (err) {
    return { healthy: false, error: err.message, ts: Date.now() };
  }
}

function metrics() {
  return {
    swarm,
    beeId,
    domain,
    evaluationIntervalMs: EVALUATION_INTERVAL,
    bannerTtlSeconds: BANNER_TTL_SECONDS,
    running: _intervalHandle !== null,
  };
}

export {
  domain,
  description,
  priority,
  swarm,
  beeId,
  getWork,
  evaluatePortfolio,
  generateCrossDomainInjections,
  broadcastStatus,
  start,
  stop,
  health,
  metrics,
};

export default {
  domain,
  description,
  priority,
  swarm,
  beeId,
  getWork,
  start,
  stop,
  health,
  metrics,
};
