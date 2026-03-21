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
// ║  FILE: src/marketplace/agent-marketplace.js                     ║
// ║  LAYER: marketplace/api                                         ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * Agent Marketplace — Express router for agent bundle registry, discovery,
 * installation, and usage tracking.
 *
 * In-memory stores (Map) back all data; production will swap to Neon Postgres.
 * Emits events on global.eventBus for cross-system observability.
 *
 * Revenue model: 20% platform fee on all paid agent installs.
 */
'use strict';
const logger = require(require('path').resolve(__dirname, '..', 'utils', 'logger')) || console;

const { Router } = require('express');
const crypto = require('crypto');
const { EventEmitter } = require('events');

// ─── Constants ──────────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PLATFORM_FEE_RATE = 0.20; // 20% revenue share
const VALID_CATEGORIES = [
  'observability', 'memory', 'reasoning', 'code', 'creative',
  'security', 'ops', 'research', 'communication', 'analytics',
];
const REQUIRED_AGENT_FIELDS = ['name', 'version', 'description', 'author'];

// ─── In-Memory Stores ───────────────────────────────────────────────────────
const agentListings = new Map();   // agentId -> AgentListing
const installations = new Map();   // tenantId:agentId -> InstallRecord
const usageMetrics  = new Map();   // agentId -> { totalInstalls, totalInvocations, tenantUsage: Map }
const ratings       = new Map();   // agentId -> [{ tenantId, score, review, createdAt }]

// ─── Event Bus ──────────────────────────────────────────────────────────────
function getEventBus() {
  if (!global.eventBus) {
    global.eventBus = new EventEmitter();
    global.eventBus.setMaxListeners(100);
  }
  return global.eventBus;
}

function emit(event, payload) {
  try {
    getEventBus().emit(event, { ...payload, timestamp: Date.now() });
  } catch (_) { /* Swallow emit errors — marketplace must not crash on listener failures */ }
}

// ─── Validation Helpers ─────────────────────────────────────────────────────

function validateAgentPayload(body) {
  const errors = [];

  for (const field of REQUIRED_AGENT_FIELDS) {
    if (!body[field] || typeof body[field] !== 'string' || body[field].trim().length === 0) {
      errors.push(`Missing or invalid required field: ${field}`);
    }
  }

  if (body.name && (body.name.length < 2 || body.name.length > 128)) {
    errors.push('name must be 2-128 characters');
  }

  if (body.version && !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(body.version)) {
    errors.push('version must be valid semver (e.g. 1.0.0)');
  }

  if (body.category && !VALID_CATEGORIES.includes(body.category)) {
    errors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  if (body.pricing) {
    if (typeof body.pricing !== 'object') {
      errors.push('pricing must be an object');
    } else {
      if (body.pricing.model && !['free', 'one-time', 'metered', 'subscription'].includes(body.pricing.model)) {
        errors.push('pricing.model must be free, one-time, metered, or subscription');
      }
      if (body.pricing.priceUsd !== undefined && (typeof body.pricing.priceUsd !== 'number' || body.pricing.priceUsd < 0)) {
        errors.push('pricing.priceUsd must be a non-negative number');
      }
    }
  }

  return errors;
}

function generateId() {
  return `agent_${crypto.randomBytes(12).toString('hex')}`;
}

function computeAverageRating(agentId) {
  const agentRatings = ratings.get(agentId);
  if (!agentRatings || agentRatings.length === 0) return 0;
  const sum = agentRatings.reduce((acc, r) => acc + r.score, 0);
  return Math.round((sum / agentRatings.length) * 100) / 100;
}

function computePlatformFee(priceUsd) {
  return Math.round(priceUsd * PLATFORM_FEE_RATE * 100) / 100;
}

function getOrCreateUsage(agentId) {
  if (!usageMetrics.has(agentId)) {
    usageMetrics.set(agentId, {
      totalInstalls: 0,
      totalInvocations: 0,
      tenantUsage: new Map(),
      revenue: { gross: 0, platformFees: 0, authorEarnings: 0 },
    });
  }
  return usageMetrics.get(agentId);
}

// ─── Router ─────────────────────────────────────────────────────────────────

const router = Router();

/**
 * POST /api/v1/marketplace/agents
 * Register a new agent bundle.
 */
router.post('/agents', (req, res) => {
  try {
    const body = req.body || {};
    const errors = validateAgentPayload(body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    // Check for duplicate name+version
    for (const [, listing] of agentListings) {
      if (listing.name === body.name.trim() && listing.version === body.version.trim()) {
        return res.status(409).json({
          error: 'Conflict',
          message: `Agent "${body.name}" version ${body.version} already registered`,
        });
      }
    }

    const id = generateId();
    const now = new Date().toISOString();

    const listing = {
      id,
      name: body.name.trim(),
      version: body.version.trim(),
      description: body.description.trim(),
      author: body.author.trim(),
      category: body.category || 'ops',
      pricing: body.pricing || { model: 'free', priceUsd: 0 },
      tags: Array.isArray(body.tags) ? body.tags.map(t => String(t).trim()) : [],
      manifest: body.manifest || null,
      status: 'published',
      averageRating: 0,
      installCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    agentListings.set(id, listing);
    getOrCreateUsage(id);

    emit('marketplace:agent_registered', {
      agentId: id,
      name: listing.name,
      version: listing.version,
      author: listing.author,
      category: listing.category,
      pricing: listing.pricing,
    });

    return res.status(201).json({ agent: listing });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

/**
 * GET /api/v1/marketplace/agents
 * List available agents with optional filtering.
 *
 * Query params:
 *   category  — filter by category
 *   minPrice  — minimum price (USD)
 *   maxPrice  — maximum price (USD)
 *   minRating — minimum average rating (0-5)
 *   search    — text search in name + description
 *   sort      — rating | installs | newest (default: newest)
 *   limit     — results per page (default 20, max 100)
 *   offset    — pagination offset (default 0)
 */
router.get('/agents', (req, res) => {
  try {
    let results = Array.from(agentListings.values()).filter(a => a.status === 'published');

    const { category, minPrice, maxPrice, minRating, search, sort, limit, offset } = req.query;

    // Category filter
    if (category && VALID_CATEGORIES.includes(category)) {
      results = results.filter(a => a.category === category);
    }

    // Price range filter
    if (minPrice !== undefined) {
      const min = parseFloat(minPrice);
      if (!isNaN(min)) results = results.filter(a => (a.pricing.priceUsd || 0) >= min);
    }
    if (maxPrice !== undefined) {
      const max = parseFloat(maxPrice);
      if (!isNaN(max)) results = results.filter(a => (a.pricing.priceUsd || 0) <= max);
    }

    // Rating filter
    if (minRating !== undefined) {
      const minR = parseFloat(minRating);
      if (!isNaN(minR)) results = results.filter(a => a.averageRating >= minR);
    }

    // Text search
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      results = results.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    // Sorting
    switch (sort) {
      case 'rating':
        results.sort((a, b) => b.averageRating - a.averageRating);
        break;
      case 'installs':
        results.sort((a, b) => b.installCount - a.installCount);
        break;
      case 'newest':
      default:
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }

    // Pagination
    const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const pageOffset = Math.max(parseInt(offset, 10) || 0, 0);
    const total = results.length;
    results = results.slice(pageOffset, pageOffset + pageLimit);

    return res.json({
      agents: results,
      pagination: { total, limit: pageLimit, offset: pageOffset },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

/**
 * GET /api/v1/marketplace/agents/:id
 * Get full agent details including ratings.
 */
router.get('/agents/:id', (req, res) => {
  try {
    const listing = agentListings.get(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const agentRatings = ratings.get(listing.id) || [];
    const usage = getOrCreateUsage(listing.id);

    return res.json({
      agent: {
        ...listing,
        averageRating: computeAverageRating(listing.id),
      },
      ratings: agentRatings.slice(-20), // last 20 reviews
      usage: {
        totalInstalls: usage.totalInstalls,
        totalInvocations: usage.totalInvocations,
        revenue: usage.revenue,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

/**
 * POST /api/v1/marketplace/agents/:id/install
 * Install an agent for a tenant.
 *
 * Body: { tenantId: string }
 */
router.post('/agents/:id/install', (req, res) => {
  try {
    const listing = agentListings.get(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const { tenantId } = req.body || {};
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim().length === 0) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const installKey = `${tenantId.trim()}:${listing.id}`;

    // Check for existing installation
    if (installations.has(installKey)) {
      const existing = installations.get(installKey);
      if (existing.status === 'active') {
        return res.status(409).json({
          error: 'Already installed',
          installation: existing,
        });
      }
    }

    // Calculate billing
    const priceUsd = listing.pricing.priceUsd || 0;
    const platformFee = computePlatformFee(priceUsd);
    const authorEarnings = Math.round((priceUsd - platformFee) * 100) / 100;

    const now = new Date().toISOString();
    const installRecord = {
      id: `install_${crypto.randomBytes(8).toString('hex')}`,
      agentId: listing.id,
      agentName: listing.name,
      agentVersion: listing.version,
      tenantId: tenantId.trim(),
      status: 'active',
      pricing: {
        model: listing.pricing.model,
        priceUsd,
        platformFee,
        authorEarnings,
      },
      installedAt: now,
      lastUsedAt: null,
      invocationCount: 0,
    };

    installations.set(installKey, installRecord);

    // Update usage metrics
    const usage = getOrCreateUsage(listing.id);
    usage.totalInstalls++;
    usage.revenue.gross += priceUsd;
    usage.revenue.platformFees += platformFee;
    usage.revenue.authorEarnings += authorEarnings;

    if (!usage.tenantUsage.has(tenantId.trim())) {
      usage.tenantUsage.set(tenantId.trim(), {
        installedAt: now,
        invocations: 0,
        lastUsedAt: null,
        meteredCharges: 0,
      });
    }

    // Update listing install count
    listing.installCount++;
    listing.updatedAt = now;

    emit('marketplace:agent_installed', {
      agentId: listing.id,
      agentName: listing.name,
      tenantId: tenantId.trim(),
      pricing: installRecord.pricing,
      installId: installRecord.id,
    });

    return res.status(201).json({ installation: installRecord });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

/**
 * GET /api/v1/marketplace/agents/:id/usage
 * Get usage metrics for an agent.
 *
 * Query params:
 *   tenantId — optional, filter usage to a specific tenant
 */
router.get('/agents/:id/usage', (req, res) => {
  try {
    const listing = agentListings.get(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const usage = getOrCreateUsage(listing.id);
    const { tenantId } = req.query;

    // Tenant-specific usage
    if (tenantId) {
      const tenantData = usage.tenantUsage.get(tenantId);
      if (!tenantData) {
        return res.status(404).json({ error: 'No usage data for this tenant' });
      }
      return res.json({
        agentId: listing.id,
        agentName: listing.name,
        tenantId,
        usage: tenantData,
      });
    }

    // Aggregate usage
    const tenantBreakdown = [];
    for (const [tid, data] of usage.tenantUsage) {
      tenantBreakdown.push({ tenantId: tid, ...data });
    }

    return res.json({
      agentId: listing.id,
      agentName: listing.name,
      totalInstalls: usage.totalInstalls,
      totalInvocations: usage.totalInvocations,
      revenue: usage.revenue,
      platformFeeRate: PLATFORM_FEE_RATE,
      tenants: tenantBreakdown,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// ─── Programmatic Helpers (for use by other modules) ────────────────────────

/**
 * Record an invocation for billing / metering purposes.
 * Called by the agent runtime when an installed agent is executed.
 */
function recordInvocation(agentId, tenantId, { durationMs = 0, tokensUsed = 0 } = {}) {
  const listing = agentListings.get(agentId);
  if (!listing) return null;

  const usage = getOrCreateUsage(agentId);
  usage.totalInvocations++;

  const tenantData = usage.tenantUsage.get(tenantId);
  if (tenantData) {
    tenantData.invocations++;
    tenantData.lastUsedAt = new Date().toISOString();

    // Metered billing: charge per invocation if pricing model is metered
    if (listing.pricing.model === 'metered' && listing.pricing.priceUsd > 0) {
      const charge = listing.pricing.priceUsd; // per-invocation price
      const fee = computePlatformFee(charge);
      tenantData.meteredCharges += charge;
      usage.revenue.gross += charge;
      usage.revenue.platformFees += fee;
      usage.revenue.authorEarnings += Math.round((charge - fee) * 100) / 100;
    }
  }

  const installKey = `${tenantId}:${agentId}`;
  const install = installations.get(installKey);
  if (install) {
    install.invocationCount++;
    install.lastUsedAt = new Date().toISOString();
  }

  emit('marketplace:agent_invoked', {
    agentId,
    tenantId,
    durationMs,
    tokensUsed,
    totalInvocations: usage.totalInvocations,
  });

  return { recorded: true, totalInvocations: usage.totalInvocations };
}

/**
 * Get the full store state (for testing / diagnostics).
 */
function getStoreSnapshot() {
  return {
    listings: agentListings.size,
    installations: installations.size,
    agents: Array.from(agentListings.keys()),
  };
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  router,
  recordInvocation,
  getStoreSnapshot,
  PLATFORM_FEE_RATE,
  VALID_CATEGORIES,
  // Expose stores for testing
  _stores: { agentListings, installations, usageMetrics, ratings },
};
