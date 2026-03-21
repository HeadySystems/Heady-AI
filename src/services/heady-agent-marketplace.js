/*
 * © 2026 Heady™Systems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
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
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/services/heady-agent-marketplace.js                  ║
// ║  LAYER: services                                                ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * AgentMarketplace — Decentralized Agent Discovery, Registry & Revenue Engine
 *
 * Provides a full marketplace for autonomous agents within the Heady ecosystem.
 * Agents register with skills, pricing, and metadata; consumers discover agents
 * by skill, category, or rating; usage is tracked and revenue is shared on an
 * 80/20 split (creator/platform) using φ-scaled accounting.
 *
 * Key properties:
 *   - Agent registration with versioned metadata & SDK hooks
 *   - Discovery engine: skill match, category filter, rating sort
 *   - Usage metering & revenue ledger per agent
 *   - Health monitoring with Fibonacci-interval heartbeats
 *   - Rating/review system with anti-gaming protections
 *   - Featured agents seeded at boot
 *
 * Integrates with @heady/agent-sdk for lifecycle hooks.
 */

const EventEmitter = require("events");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// ─── φ-SCALED CONSTANTS — all values Fibonacci-derived, zero magic numbers ───
const PHI = (1 + Math.sqrt(5)) / 2;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];
const MAX_AGENTS          = FIB[17]; // 2584 — registry cap
const MAX_REVIEWS         = FIB[19]; // 6765 — review store cap
const MAX_USAGE_ENTRIES   = FIB[18]; // 4181 — usage ledger cap
const HEALTH_INTERVAL_MS  = FIB[13] * 1000; // 377s heartbeat cycle
const SEARCH_RESULT_LIMIT = FIB[8];  // 34 — max search results per query
const MIN_REVIEWS_FEATURED = FIB[4]; // 5 — minimum reviews to qualify for featured
const REVENUE_CREATOR_SHARE = 0.80;
const REVENUE_PLATFORM_SHARE = 0.20;

// ─── DATA PATHS ──────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, "..", "data");
const REGISTRY_PATH = path.join(DATA_DIR, "agent-marketplace-registry.json");
const USAGE_PATH    = path.join(DATA_DIR, "agent-marketplace-usage.json");
const REVIEWS_PATH  = path.join(DATA_DIR, "agent-marketplace-reviews.json");
const REVENUE_PATH  = path.join(DATA_DIR, "agent-marketplace-revenue.json");

// ─── AGENT CATEGORIES (fib(7) = 13 categories) ──────────────────────────────
const AGENT_CATEGORIES = Object.freeze([
    "monitoring",
    "messaging",
    "scheduling",
    "data-processing",
    "security",
    "analytics",
    "devops",
    "trading",
    "creative",
    "learning",
    "orchestration",
    "integration",
    "infrastructure",
]);

// ─── FEATURED AGENTS — seeded at boot ────────────────────────────────────────
const FEATURED_AGENTS = Object.freeze([
    {
        id: "argus-v2",
        name: "Argus V2",
        description: "Production-grade infrastructure monitoring with anomaly detection, SLO tracking, and predictive alerting powered by φ-scaled thresholds.",
        author: "heady-core",
        version: "2.3.1",
        skills: ["health-check", "anomaly-detection", "slo-tracking", "alert-routing", "metric-aggregation"],
        categories: ["monitoring", "infrastructure"],
        pricing: { model: "per-invocation", unitCostUSD: 0.002, bulkDiscount: { threshold: FIB[12], discount: 0.15 } },
        featured: true,
        rating: 4.89,
        totalInvocations: 0,
    },
    {
        id: "hermes-v2",
        name: "Hermes V2",
        description: "Omnichannel messaging relay with queue management, delivery guarantees, template rendering, and cross-platform routing.",
        author: "heady-core",
        version: "2.1.0",
        skills: ["message-relay", "queue-management", "template-render", "delivery-tracking", "channel-routing"],
        categories: ["messaging", "integration"],
        pricing: { model: "per-message", unitCostUSD: 0.001, bulkDiscount: { threshold: FIB[14], discount: 0.20 } },
        featured: true,
        rating: 4.76,
        totalInvocations: 0,
    },
    {
        id: "kronos-v2",
        name: "Kronos V2",
        description: "Distributed scheduler with cron, one-shot, and Fibonacci-interval task execution, timezone-aware with conflict resolution.",
        author: "heady-core",
        version: "2.0.5",
        skills: ["cron-scheduling", "one-shot-tasks", "fibonacci-intervals", "conflict-resolution", "timezone-management"],
        categories: ["scheduling", "orchestration"],
        pricing: { model: "per-schedule", unitCostUSD: 0.0015, bulkDiscount: { threshold: FIB[13], discount: 0.18 } },
        featured: true,
        rating: 4.82,
        totalInvocations: 0,
    },
]);

// ─── AGENT MARKETPLACE CLASS ─────────────────────────────────────────────────
class AgentMarketplace extends EventEmitter {
    constructor(options = {}) {
        super();
        this.agents = new Map();
        this.usageLedger = [];
        this.reviews = new Map();       // agentId -> [{ reviewerId, rating, text, ts }]
        this.revenueLedger = new Map();  // agentId -> { creatorEarned, platformEarned, totalRevenue }
        this.healthStatus = new Map();   // agentId -> { healthy, lastCheck, consecutiveFails }
        this.sdkHooks = new Map();       // agentId -> { onRegister, onInvoke, onDeregister }

        this._healthTimer = null;
        this._bootTs = Date.now();
        this._invocationCounter = 0;

        // Options
        this.dataDir = options.dataDir || DATA_DIR;
        this.persistEnabled = options.persist !== false;
        this.healthCheckEnabled = options.healthCheck !== false;

        // Load persisted state
        this._loadState();

        // Seed featured agents if registry is empty
        if (this.agents.size === 0) {
            this._seedFeaturedAgents();
        }

        // Start health monitor
        if (this.healthCheckEnabled) {
            this._startHealthMonitor();
        }

        this.emit("marketplace:boot", { ts: this._bootTs, agentCount: this.agents.size });
    }

    // ─── REGISTRATION ────────────────────────────────────────────────────────
    registerAgent(agentDef) {
        if (!agentDef || !agentDef.id || !agentDef.name) {
            throw new Error("Agent registration requires at least { id, name }");
        }
        if (this.agents.size >= MAX_AGENTS) {
            throw new Error(`Registry cap reached (${MAX_AGENTS}). Deregister unused agents first.`);
        }

        const agent = {
            id: agentDef.id,
            name: agentDef.name,
            description: agentDef.description || "",
            author: agentDef.author || "anonymous",
            version: agentDef.version || "1.0.0",
            skills: Array.isArray(agentDef.skills) ? [...agentDef.skills] : [],
            categories: Array.isArray(agentDef.categories) ? [...agentDef.categories] : [],
            pricing: agentDef.pricing || { model: "free", unitCostUSD: 0 },
            featured: agentDef.featured === true,
            rating: typeof agentDef.rating === "number" ? agentDef.rating : 0,
            totalInvocations: agentDef.totalInvocations || 0,
            registeredAt: Date.now(),
            updatedAt: Date.now(),
            checksum: this._computeChecksum(agentDef),
        };

        const isUpdate = this.agents.has(agent.id);
        this.agents.set(agent.id, agent);

        // Initialize revenue tracking
        if (!this.revenueLedger.has(agent.id)) {
            this.revenueLedger.set(agent.id, { creatorEarned: 0, platformEarned: 0, totalRevenue: 0 });
        }
        if (!this.reviews.has(agent.id)) {
            this.reviews.set(agent.id, []);
        }
        this.healthStatus.set(agent.id, { healthy: true, lastCheck: Date.now(), consecutiveFails: 0 });

        // SDK hook: onRegister
        this._fireSdkHook(agent.id, "onRegister", agent);

        this._persist();
        const eventName = isUpdate ? "agent:updated" : "agent:registered";
        this.emit(eventName, { agentId: agent.id, name: agent.name, version: agent.version });

        return agent;
    }

    deregisterAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) return false;

        // SDK hook: onDeregister
        this._fireSdkHook(agentId, "onDeregister", agent);

        this.agents.delete(agentId);
        this.healthStatus.delete(agentId);
        this._persist();
        this.emit("agent:deregistered", { agentId });
        return true;
    }

    // ─── DISCOVERY ───────────────────────────────────────────────────────────
    searchAgents(query = {}) {
        let results = Array.from(this.agents.values());

        // Filter by skill
        if (query.skill) {
            const skill = query.skill.toLowerCase();
            results = results.filter(a => a.skills.some(s => s.toLowerCase().includes(skill)));
        }

        // Filter by category
        if (query.category) {
            const cat = query.category.toLowerCase();
            results = results.filter(a => a.categories.some(c => c.toLowerCase() === cat));
        }

        // Filter by author
        if (query.author) {
            results = results.filter(a => a.author.toLowerCase() === query.author.toLowerCase());
        }

        // Full-text search across name + description
        if (query.text) {
            const terms = query.text.toLowerCase().split(/\s+/);
            results = results.filter(a => {
                const haystack = `${a.name} ${a.description} ${a.skills.join(" ")}`.toLowerCase();
                return terms.every(t => haystack.includes(t));
            });
        }

        // Filter by minimum rating
        if (typeof query.minRating === "number") {
            results = results.filter(a => a.rating >= query.minRating);
        }

        // Filter by pricing model
        if (query.pricingModel) {
            results = results.filter(a => a.pricing && a.pricing.model === query.pricingModel);
        }

        // Sort: featured first, then by φ-weighted score
        results.sort((a, b) => {
            if (a.featured !== b.featured) return b.featured ? 1 : -1;
            const scoreA = this._computeDiscoveryScore(a);
            const scoreB = this._computeDiscoveryScore(b);
            return scoreB - scoreA;
        });

        return results.slice(0, query.limit || SEARCH_RESULT_LIMIT);
    }

    getAgent(agentId) {
        return this.agents.get(agentId) || null;
    }

    listFeatured() {
        return Array.from(this.agents.values()).filter(a => a.featured);
    }

    listByCategory(category) {
        return this.searchAgents({ category });
    }

    // ─── USAGE TRACKING ──────────────────────────────────────────────────────
    recordInvocation(agentId, metadata = {}) {
        const agent = this.agents.get(agentId);
        if (!agent) throw new Error(`Agent ${agentId} not found in registry`);

        this._invocationCounter++;
        agent.totalInvocations++;
        agent.updatedAt = Date.now();

        const entry = {
            id: crypto.randomUUID(),
            agentId,
            ts: Date.now(),
            durationMs: metadata.durationMs || 0,
            success: metadata.success !== false,
            costUSD: this._computeInvocationCost(agent, metadata),
            metadata: { ...metadata },
        };

        this.usageLedger.push(entry);
        if (this.usageLedger.length > MAX_USAGE_ENTRIES) {
            this.usageLedger = this.usageLedger.slice(-MAX_USAGE_ENTRIES);
        }

        // Revenue split
        if (entry.costUSD > 0) {
            this._recordRevenue(agentId, entry.costUSD);
        }

        // SDK hook: onInvoke
        this._fireSdkHook(agentId, "onInvoke", { agent, invocation: entry });

        this.emit("agent:invoked", { agentId, invocationId: entry.id, costUSD: entry.costUSD });
        this._persist();

        return entry;
    }

    getUsageStats(agentId) {
        const entries = this.usageLedger.filter(e => e.agentId === agentId);
        if (entries.length === 0) return { agentId, totalInvocations: 0, totalCostUSD: 0, successRate: 0, avgDurationMs: 0 };

        const totalCost = entries.reduce((sum, e) => sum + e.costUSD, 0);
        const successes = entries.filter(e => e.success).length;
        const avgDuration = entries.reduce((sum, e) => sum + e.durationMs, 0) / entries.length;

        return {
            agentId,
            totalInvocations: entries.length,
            totalCostUSD: Math.round(totalCost * 10000) / 10000,
            successRate: Math.round((successes / entries.length) * 10000) / 10000,
            avgDurationMs: Math.round(avgDuration * 100) / 100,
            revenueBreakdown: this.revenueLedger.get(agentId) || { creatorEarned: 0, platformEarned: 0, totalRevenue: 0 },
        };
    }

    getGlobalStats() {
        const agents = Array.from(this.agents.values());
        const totalRevenue = Array.from(this.revenueLedger.values()).reduce((s, r) => s + r.totalRevenue, 0);
        const healthyCount = Array.from(this.healthStatus.values()).filter(h => h.healthy).length;

        return {
            totalAgents: this.agents.size,
            totalInvocations: this._invocationCounter,
            totalRevenueUSD: Math.round(totalRevenue * 10000) / 10000,
            platformRevenueUSD: Math.round(totalRevenue * REVENUE_PLATFORM_SHARE * 10000) / 10000,
            creatorRevenueUSD: Math.round(totalRevenue * REVENUE_CREATOR_SHARE * 10000) / 10000,
            healthyAgents: healthyCount,
            unhealthyAgents: this.agents.size - healthyCount,
            featuredCount: agents.filter(a => a.featured).length,
            categoryCounts: this._categoryCounts(),
            uptimeMs: Date.now() - this._bootTs,
        };
    }

    // ─── REVENUE SHARING (80/20 SPLIT) ───────────────────────────────────────
    _recordRevenue(agentId, totalUSD) {
        const ledger = this.revenueLedger.get(agentId) || { creatorEarned: 0, platformEarned: 0, totalRevenue: 0 };
        const creatorCut = totalUSD * REVENUE_CREATOR_SHARE;
        const platformCut = totalUSD * REVENUE_PLATFORM_SHARE;

        ledger.creatorEarned += creatorCut;
        ledger.platformEarned += platformCut;
        ledger.totalRevenue += totalUSD;
        this.revenueLedger.set(agentId, ledger);

        this.emit("revenue:recorded", {
            agentId,
            totalUSD,
            creatorCut: Math.round(creatorCut * 10000) / 10000,
            platformCut: Math.round(platformCut * 10000) / 10000,
        });
    }

    getRevenueLedger(agentId) {
        if (agentId) return this.revenueLedger.get(agentId) || null;
        const all = {};
        for (const [id, rev] of this.revenueLedger) all[id] = rev;
        return all;
    }

    // ─── RATING & REVIEW SYSTEM ──────────────────────────────────────────────
    submitReview(agentId, review) {
        const agent = this.agents.get(agentId);
        if (!agent) throw new Error(`Agent ${agentId} not found`);
        if (!review || typeof review.rating !== "number" || review.rating < 1 || review.rating > 5) {
            throw new Error("Review must include rating (1-5)");
        }
        if (!review.reviewerId) {
            throw new Error("Review must include reviewerId");
        }

        const reviews = this.reviews.get(agentId) || [];

        // Anti-gaming: one review per reviewer per φ-scaled cooldown (fib(10) = 89 hours)
        const cooldownMs = FIB[10] * 3600 * 1000;
        const existing = reviews.find(r => r.reviewerId === review.reviewerId);
        if (existing && (Date.now() - existing.ts) < cooldownMs) {
            throw new Error(`Review cooldown active. Try again after ${FIB[10]} hours from last review.`);
        }

        // Replace or add
        const entry = {
            reviewerId: review.reviewerId,
            rating: Math.round(review.rating * 100) / 100,
            text: review.text || "",
            ts: Date.now(),
            verified: review.verified === true,
        };

        const idx = reviews.findIndex(r => r.reviewerId === review.reviewerId);
        if (idx >= 0) {
            reviews[idx] = entry;
        } else {
            reviews.push(entry);
        }

        // Cap reviews
        if (reviews.length > MAX_REVIEWS) {
            reviews.splice(0, reviews.length - MAX_REVIEWS);
        }
        this.reviews.set(agentId, reviews);

        // Recalculate agent rating using φ-weighted recent bias
        agent.rating = this._computeWeightedRating(reviews);
        agent.updatedAt = Date.now();

        // Check featured eligibility
        if (!agent.featured && reviews.length >= MIN_REVIEWS_FEATURED && agent.rating >= 4.5) {
            agent.featured = true;
            this.emit("agent:featured", { agentId, rating: agent.rating });
        }

        this._persist();
        this.emit("review:submitted", { agentId, reviewerId: entry.reviewerId, rating: entry.rating });

        return entry;
    }

    getReviews(agentId) {
        return this.reviews.get(agentId) || [];
    }

    _computeWeightedRating(reviews) {
        if (reviews.length === 0) return 0;

        // φ-weighted: more recent reviews count more
        const now = Date.now();
        let weightedSum = 0;
        let weightTotal = 0;

        const sorted = [...reviews].sort((a, b) => b.ts - a.ts);
        for (let i = 0; i < sorted.length; i++) {
            // Weight decays by PHI^(-i/fib(5)) — recent reviews dominate
            const weight = Math.pow(PHI, -i / FIB[5]);
            const verifiedBoost = sorted[i].verified ? 1.0 + (1 / PHI) : 1.0;
            weightedSum += sorted[i].rating * weight * verifiedBoost;
            weightTotal += weight * verifiedBoost;
        }

        return Math.round((weightedSum / weightTotal) * 100) / 100;
    }

    // ─── AGENT HEALTH MONITORING ─────────────────────────────────────────────
    _startHealthMonitor() {
        if (this._healthTimer) clearInterval(this._healthTimer);

        this._healthTimer = setInterval(() => {
            this._runHealthChecks();
        }, HEALTH_INTERVAL_MS);

        // Unref so it doesn't prevent process exit
        if (this._healthTimer.unref) this._healthTimer.unref();
    }

    async _runHealthChecks() {
        for (const [agentId, agent] of this.agents) {
            const status = this.healthStatus.get(agentId) || { healthy: true, lastCheck: 0, consecutiveFails: 0 };

            // Check via SDK hook if available
            const hooks = this.sdkHooks.get(agentId);
            let isHealthy = true;

            if (hooks && typeof hooks.healthCheck === "function") {
                try {
                    isHealthy = await Promise.resolve(hooks.healthCheck(agent));
                } catch (err) {
                    isHealthy = false;
                }
            } else {
                // Default: agent is healthy if it has been invoked within fib(14) = 610 seconds
                const lastUsage = this.usageLedger.filter(e => e.agentId === agentId).pop();
                const staleness = lastUsage ? Date.now() - lastUsage.ts : Date.now() - agent.registeredAt;
                isHealthy = staleness < FIB[14] * 1000 || agent.totalInvocations === 0;
            }

            if (isHealthy) {
                status.healthy = true;
                status.consecutiveFails = 0;
            } else {
                status.consecutiveFails++;
                // Fibonacci-scaled degradation: unhealthy after fib(4) = 5 consecutive fails
                if (status.consecutiveFails >= FIB[4]) {
                    status.healthy = false;
                    this.emit("agent:unhealthy", { agentId, consecutiveFails: status.consecutiveFails });
                }
            }

            status.lastCheck = Date.now();
            this.healthStatus.set(agentId, status);
        }

        this.emit("health:cycle", { checkedAgents: this.agents.size, ts: Date.now() });
    }

    getHealthStatus(agentId) {
        if (agentId) return this.healthStatus.get(agentId) || null;
        const all = {};
        for (const [id, status] of this.healthStatus) all[id] = status;
        return all;
    }

    // ─── SDK INTEGRATION HOOKS ───────────────────────────────────────────────
    /**
     * Register SDK lifecycle hooks for an agent.
     * Expected shape: { onRegister(agent), onInvoke({agent, invocation}), onDeregister(agent), healthCheck(agent) }
     * Compatible with @heady/agent-sdk
     */
    registerSdkHooks(agentId, hooks) {
        if (!this.agents.has(agentId)) {
            throw new Error(`Cannot register SDK hooks for unknown agent: ${agentId}`);
        }
        this.sdkHooks.set(agentId, hooks);
        this.emit("sdk:hooks-registered", { agentId, hookNames: Object.keys(hooks) });
    }

    _fireSdkHook(agentId, hookName, payload) {
        const hooks = this.sdkHooks.get(agentId);
        if (hooks && typeof hooks[hookName] === "function") {
            try {
                hooks[hookName](payload);
            } catch (err) {
                this.emit("sdk:hook-error", { agentId, hookName, error: err.message });
            }
        }
    }

    // ─── INTERNAL HELPERS ────────────────────────────────────────────────────
    _computeInvocationCost(agent, metadata) {
        if (!agent.pricing || agent.pricing.model === "free") return 0;
        let cost = agent.pricing.unitCostUSD || 0;

        // Bulk discount via Fibonacci threshold
        if (agent.pricing.bulkDiscount && agent.totalInvocations >= agent.pricing.bulkDiscount.threshold) {
            cost *= (1 - agent.pricing.bulkDiscount.discount);
        }

        // φ-scaled multiplier for premium metadata flags
        if (metadata.priority === "urgent") cost *= PHI;
        if (metadata.priority === "low") cost /= PHI;

        return Math.round(cost * 100000) / 100000;
    }

    _computeDiscoveryScore(agent) {
        // φ-scaled composite: rating × PHI + log(invocations+1) + (featured ? fib(5) : 0)
        const ratingComponent = agent.rating * PHI;
        const usageComponent = Math.log(agent.totalInvocations + 1);
        const featuredBonus = agent.featured ? FIB[5] : 0;
        const freshness = 1 / (1 + (Date.now() - (agent.updatedAt || agent.registeredAt)) / (FIB[15] * 1000));
        return ratingComponent + usageComponent + featuredBonus + freshness * PHI;
    }

    _computeChecksum(obj) {
        return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex").slice(0, 16);
    }

    _categoryCounts() {
        const counts = {};
        for (const cat of AGENT_CATEGORIES) counts[cat] = 0;
        for (const agent of this.agents.values()) {
            for (const cat of agent.categories) {
                if (counts[cat] !== undefined) counts[cat]++;
            }
        }
        return counts;
    }

    _seedFeaturedAgents() {
        for (const def of FEATURED_AGENTS) {
            this.registerAgent({ ...def });
        }
    }

    // ─── PERSISTENCE ─────────────────────────────────────────────────────────
    _persist() {
        if (!this.persistEnabled) return;
        try {
            if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });

            const registry = {};
            for (const [id, agent] of this.agents) registry[id] = agent;
            fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));

            fs.writeFileSync(USAGE_PATH, JSON.stringify(this.usageLedger.slice(-FIB[12]), null, 2));

            const reviews = {};
            for (const [id, revs] of this.reviews) reviews[id] = revs;
            fs.writeFileSync(REVIEWS_PATH, JSON.stringify(reviews, null, 2));

            const revenue = {};
            for (const [id, rev] of this.revenueLedger) revenue[id] = rev;
            fs.writeFileSync(REVENUE_PATH, JSON.stringify(revenue, null, 2));
        } catch (err) {
            this.emit("persist:error", { error: err.message });
        }
    }

    _loadState() {
        try {
            if (fs.existsSync(REGISTRY_PATH)) {
                const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
                for (const [id, agent] of Object.entries(reg)) this.agents.set(id, agent);
            }
            if (fs.existsSync(USAGE_PATH)) {
                this.usageLedger = JSON.parse(fs.readFileSync(USAGE_PATH, "utf8")) || [];
            }
            if (fs.existsSync(REVIEWS_PATH)) {
                const rev = JSON.parse(fs.readFileSync(REVIEWS_PATH, "utf8"));
                for (const [id, revs] of Object.entries(rev)) this.reviews.set(id, revs);
            }
            if (fs.existsSync(REVENUE_PATH)) {
                const rev = JSON.parse(fs.readFileSync(REVENUE_PATH, "utf8"));
                for (const [id, r] of Object.entries(rev)) this.revenueLedger.set(id, r);
            }
            // Restore invocation counter
            this._invocationCounter = this.usageLedger.length;
        } catch (err) {
            this.emit("load:error", { error: err.message });
        }
    }

    // ─── LIFECYCLE ───────────────────────────────────────────────────────────
    shutdown() {
        if (this._healthTimer) {
            clearInterval(this._healthTimer);
            this._healthTimer = null;
        }
        this._persist();
        this.emit("marketplace:shutdown", { ts: Date.now(), uptimeMs: Date.now() - this._bootTs });
    }
}

module.exports = { AgentMarketplace, FEATURED_AGENTS, AGENT_CATEGORIES };
