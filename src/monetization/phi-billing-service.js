/**
 * Heady™ Phi-Scaled Credit Billing Service v1.0.0
 * HeadySystems Inc.
 * 
 * Fibonacci-progression credit tiers:
 *   Free: 0 credits
 *   Starter: 89 credits/mo ($8)
 *   Pro: 144 credits/mo ($21)
 *   Business: 233 credits/mo ($34)
 *   Max: 377 credits/mo ($55)
 *   Enterprise: 610 credits/mo ($89)
 *   
 * Each tier step ≈ φ × previous. Overage: $0.13/credit (fib(7) cents).
 * 
 * Patent Zone: HS-065 (Fibonacci-Progression AI Platform Pricing)
 * @port 3408
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const pino = require('pino');

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

const logger = pino({ name: 'phi-billing', level: process.env.LOG_LEVEL || 'info' });

// ─── Tier Definitions (Fibonacci-Pure) ────────────────────────
const TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    prefix: 'hdy_free_',
    credits_monthly: 0,
    price_cents: 0,
    rate_limit_rpm: FIB[6],        // 13 requests/min
    max_tokens_per_request: FIB[12] * 10, // 2330
    models_allowed: ['workers-ai'],
    features: ['basic_chat', 'skill_browse'],
    stripe_price_id: null,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    prefix: 'hdy_str_',
    credits_monthly: FIB[10],       // 89
    price_cents: FIB[5] * 100,      // $8
    rate_limit_rpm: FIB[8],         // 34
    max_tokens_per_request: FIB[13] * 10, // 3770
    models_allowed: ['workers-ai', 'gemini-flash'],
    features: ['basic_chat', 'skill_browse', 'skill_execute', 'memory_t0'],
    stripe_price_id: process.env.STRIPE_PRICE_STARTER,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    prefix: 'hdy_pro_',
    credits_monthly: FIB[11],       // 144
    price_cents: FIB[7] * 100,      // $21
    rate_limit_rpm: FIB[9],         // 55
    max_tokens_per_request: FIB[14] * 10, // 6100
    models_allowed: ['workers-ai', 'gemini-flash', 'gemini-pro', 'claude-haiku'],
    features: ['basic_chat', 'skill_browse', 'skill_execute', 'memory_t0', 'memory_t1', 'mcp_tools', 'api_access'],
    stripe_price_id: process.env.STRIPE_PRICE_PRO,
  },
  business: {
    id: 'business',
    name: 'Business',
    prefix: 'hdy_biz_',
    credits_monthly: FIB[12],       // 233
    price_cents: FIB[8] * 100,      // $34
    rate_limit_rpm: FIB[10],        // 89
    max_tokens_per_request: FIB[15] * 10, // 9870
    models_allowed: ['workers-ai', 'gemini-flash', 'gemini-pro', 'claude-haiku', 'claude-sonnet'],
    features: ['basic_chat', 'skill_browse', 'skill_execute', 'memory_t0', 'memory_t1', 'memory_t2', 'mcp_tools', 'api_access', 'swarm_dispatch', 'custom_skills'],
    stripe_price_id: process.env.STRIPE_PRICE_BUSINESS,
  },
  max: {
    id: 'max',
    name: 'Max',
    prefix: 'hdy_max_',
    credits_monthly: FIB[13],       // 377
    price_cents: FIB[9] * 100,      // $55
    rate_limit_rpm: FIB[11],        // 144
    max_tokens_per_request: 16180,  // φ × 10000
    models_allowed: ['workers-ai', 'gemini-flash', 'gemini-pro', 'claude-haiku', 'claude-sonnet', 'claude-opus', 'gpt-4o'],
    features: ['basic_chat', 'skill_browse', 'skill_execute', 'memory_t0', 'memory_t1', 'memory_t2', 'mcp_tools', 'api_access', 'swarm_dispatch', 'custom_skills', 'battle_arena', 'distiller', 'voice_relay'],
    stripe_price_id: process.env.STRIPE_PRICE_MAX,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    prefix: 'hdy_ent_',
    credits_monthly: FIB[14],       // 610
    price_cents: FIB[10] * 100,     // $89
    rate_limit_rpm: FIB[12],        // 233
    max_tokens_per_request: 26180,  // φ² × 10000
    models_allowed: ['all'],
    features: ['all'],
    stripe_price_id: process.env.STRIPE_PRICE_ENTERPRISE,
  },
};

// Overage rate: fib(7) cents = $0.13 per credit
const OVERAGE_RATE_CENTS = FIB[6]; // 13 cents

// ─── Credit Cost per Action ───────────────────────────────────
const CREDIT_COSTS = {
  'chat.basic': 1,                    // fib(1)
  'chat.advanced': 2,                 // fib(3)
  'skill.execute': 3,                 // fib(4)
  'skill.execute.heavy': 5,           // fib(5)
  'mcp.tool_call': 2,                 // fib(3)
  'swarm.dispatch': 8,                // fib(6)
  'battle.arena': 13,                 // fib(7)
  'distill.tier1': 3,                 // fib(4)
  'distill.tier2': 5,                 // fib(5)
  'distill.tier3': 8,                 // fib(6)
  'distill.tier4': 21,                // fib(8)
  'voice.relay': 5,                   // fib(5)
  'embed.generate': 1,                // fib(1)
  'memory.store': 1,                  // fib(1)
  'memory.retrieve': 1,               // fib(1)
  'api.custom': 3,                    // fib(4)
};

// ─── Credit Manager ───────────────────────────────────────────
class CreditManager {
  constructor(redis) {
    this.redis = redis;
    this.prefix = 'billing:';
  }

  /**
   * Get current credit balance for a tenant.
   */
  async getBalance(tenantId) {
    const key = `${this.prefix}credits:${tenantId}`;
    const raw = await this.redis.hgetall(key);
    return {
      tenantId,
      tier: raw.tier || 'free',
      credits_remaining: parseInt(raw.credits_remaining || '0'),
      credits_used: parseInt(raw.credits_used || '0'),
      credits_monthly: parseInt(raw.credits_monthly || '0'),
      overage_credits: parseInt(raw.overage_credits || '0'),
      reset_at: raw.reset_at || null,
    };
  }

  /**
   * Provision credits for a billing cycle.
   */
  async provision(tenantId, tierId) {
    const tier = TIERS[tierId];
    if (!tier) throw new Error(`Unknown tier: ${tierId}`);

    const key = `${this.prefix}credits:${tenantId}`;
    const now = new Date();
    const resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    await this.redis.hmset(key, {
      tier: tierId,
      credits_remaining: String(tier.credits_monthly),
      credits_used: '0',
      credits_monthly: String(tier.credits_monthly),
      overage_credits: '0',
      reset_at: resetAt,
      provisioned_at: now.toISOString(),
    });

    // Set expiry to end of billing cycle + buffer
    const ttlSeconds = Math.ceil((new Date(resetAt) - now) / 1000) + 86400;
    await this.redis.expire(key, ttlSeconds);

    logger.info({ tenantId, tier: tierId, credits: tier.credits_monthly }, 'Credits provisioned');
    return this.getBalance(tenantId);
  }

  /**
   * Consume credits for an action.
   * Returns { allowed, remaining, overage } or { allowed: false, reason }.
   */
  async consume(tenantId, action, quantity = 1) {
    const cost = (CREDIT_COSTS[action] || 1) * quantity;
    const balance = await this.getBalance(tenantId);
    const tier = TIERS[balance.tier];

    // Free tier with no credits
    if (balance.tier === 'free' && !tier.features.includes(this._actionToFeature(action))) {
      return { allowed: false, reason: 'feature_not_available', upgrade_to: 'starter' };
    }

    // Check rate limit
    const rateLimitKey = `${this.prefix}rate:${tenantId}:${Math.floor(Date.now() / 60000)}`;
    const currentRate = parseInt(await this.redis.incr(rateLimitKey) || '0');
    await this.redis.expire(rateLimitKey, 120);

    if (currentRate > tier.rate_limit_rpm) {
      return {
        allowed: false,
        reason: 'rate_limited',
        limit: tier.rate_limit_rpm,
        retry_after_ms: Math.round(PHI * 1000), // 1618ms
      };
    }

    // Deduct credits
    const key = `${this.prefix}credits:${tenantId}`;
    const remaining = balance.credits_remaining - cost;

    if (remaining >= 0) {
      await this.redis.hincrby(key, 'credits_remaining', -cost);
      await this.redis.hincrby(key, 'credits_used', cost);

      // Log usage event
      await this._logUsage(tenantId, action, cost, false);

      return { allowed: true, cost, remaining, overage: false };
    }

    // Overage: allow but track
    if (balance.tier !== 'free') {
      await this.redis.hset(key, 'credits_remaining', '0');
      await this.redis.hincrby(key, 'credits_used', cost);
      await this.redis.hincrby(key, 'overage_credits', cost);

      await this._logUsage(tenantId, action, cost, true);

      const overageCost = cost * OVERAGE_RATE_CENTS;
      return {
        allowed: true,
        cost,
        remaining: 0,
        overage: true,
        overage_cost_cents: overageCost,
      };
    }

    return { allowed: false, reason: 'credits_exhausted', upgrade_to: 'starter' };
  }

  /**
   * Express middleware for credit-gated endpoints.
   */
  middleware(action) {
    return async (req, res, next) => {
      const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Missing tenant ID' });
      }

      const result = await this.consume(tenantId, action);

      if (!result.allowed) {
        const status = result.reason === 'rate_limited' ? 429 : 402;
        res.setHeader('X-Credits-Remaining', '0');
        if (result.retry_after_ms) {
          res.setHeader('Retry-After', Math.ceil(result.retry_after_ms / 1000));
        }
        return res.status(status).json(result);
      }

      res.setHeader('X-Credits-Cost', result.cost);
      res.setHeader('X-Credits-Remaining', result.remaining);
      if (result.overage) {
        res.setHeader('X-Credits-Overage', 'true');
      }

      next();
    };
  }

  async _logUsage(tenantId, action, cost, isOverage) {
    const event = {
      tenantId,
      action,
      cost,
      overage: isOverage,
      timestamp: Date.now(),
    };

    if (this.redis) {
      await this.redis.xadd(
        `${this.prefix}usage:${tenantId}`,
        'MAXLEN', '~', String(FIB[14]), // 610 events
        '*',
        'event', JSON.stringify(event)
      );
    }
  }

  _actionToFeature(action) {
    const map = {
      'chat.basic': 'basic_chat',
      'chat.advanced': 'basic_chat',
      'skill.execute': 'skill_execute',
      'mcp.tool_call': 'mcp_tools',
      'swarm.dispatch': 'swarm_dispatch',
      'battle.arena': 'battle_arena',
      'voice.relay': 'voice_relay',
      'api.custom': 'api_access',
    };
    return map[action] || 'basic_chat';
  }
}

// ─── Express Server ───────────────────────────────────────────
function createServer(creditManager) {
  const app = express();
  app.use(express.json());

  // Health
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'phi-billing',
      version: '1.0.0',
      tiers: Object.keys(TIERS).length,
      overage_rate_cents: OVERAGE_RATE_CENTS,
      uptime: process.uptime(),
    });
  });

  // Get all tiers
  app.get('/tiers', (req, res) => {
    const tiers = Object.values(TIERS).map(t => ({
      id: t.id,
      name: t.name,
      credits: t.credits_monthly,
      price_cents: t.price_cents,
      price_display: t.price_cents === 0 ? 'Free' : `$${t.price_cents / 100}/mo`,
      rate_limit_rpm: t.rate_limit_rpm,
      features: t.features,
      models: t.models_allowed,
    }));
    res.json({ tiers, overage_rate_cents: OVERAGE_RATE_CENTS });
  });

  // Get balance
  app.get('/balance/:tenantId', async (req, res) => {
    try {
      const balance = await creditManager.getBalance(req.params.tenantId);
      res.json(balance);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Provision credits
  app.post('/provision', async (req, res) => {
    try {
      const { tenantId, tierId } = req.body;
      const balance = await creditManager.provision(tenantId, tierId);
      res.json(balance);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Consume credits
  app.post('/consume', async (req, res) => {
    try {
      const { tenantId, action, quantity } = req.body;
      const result = await creditManager.consume(tenantId, action, quantity);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Credit cost lookup
  app.get('/costs', (req, res) => {
    res.json({ costs: CREDIT_COSTS, unit: 'credits', overage_rate_cents: OVERAGE_RATE_CENTS });
  });

  return app;
}

// ─── Bootstrap ────────────────────────────────────────────────
if (require.main === module) {
  const creditManager = new CreditManager(null);
  const app = createServer(creditManager);
  const port = parseInt(process.env.PORT || '3408');

  app.listen(port, () => {
    logger.info({ port, tiers: Object.keys(TIERS).length }, 'Phi Billing Service started');
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down Phi Billing Service');
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { CreditManager, TIERS, CREDIT_COSTS, OVERAGE_RATE_CENTS, createServer };
