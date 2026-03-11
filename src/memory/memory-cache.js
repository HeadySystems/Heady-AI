/**
 * MemoryCache — Multi-Tier Memory Cache (Working / Session / Long-Term)
 * RAM-first tiered cache with φ-geometric token budgets, priority-based
 * eviction, and automatic tier promotion/demotion.
 * All constants φ-derived. CSL gates replace boolean. ESM only.
 * Author: Eric Haywood
 */
import { createHash } from 'crypto';

const PHI = 1.6180339887; const PSI = 0.6180339887; const PSI2 = 0.3819660113;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];
function phiThreshold(level, spread = PSI2) { return 1 - Math.pow(PSI, level) * spread; }
const CSL_THRESHOLDS = { CRITICAL: phiThreshold(4), HIGH: phiThreshold(3), MEDIUM: phiThreshold(2), LOW: phiThreshold(1), MINIMUM: phiThreshold(0) };
function cslGate(value, score, tau = CSL_THRESHOLDS.MEDIUM, temp = Math.pow(PSI, 3)) { return value * (1 / (1 + Math.exp(-(score - tau) / temp))); }
function hashSHA256(data) { return createHash('sha256').update(JSON.stringify(data)).digest('hex'); }

const BASE_BUDGET = 8192;
const TOKEN_BUDGETS = {
  working: BASE_BUDGET,
  session: Math.round(BASE_BUDGET * PHI * PHI),
  longTerm: Math.round(BASE_BUDGET * Math.pow(PHI, 4)),
  artifacts: Math.round(BASE_BUDGET * Math.pow(PHI, 6)),
};
const EVICTION_WEIGHTS = { importance: 0.486, recency: 0.300, relevance: 0.214 };

class CacheEntry {
  constructor(key, value, meta = {}) {
    this.key = key; this.value = value; this.importance = meta.importance ?? PSI;
    this.createdAt = Date.now(); this.lastAccessedAt = Date.now(); this.accessCount = 0;
    this.tokenSize = meta.tokenSize ?? Math.ceil(JSON.stringify(value).length / PHI);
    this.ttlMs = meta.ttlMs ?? null; this.tags = meta.tags ?? [];
    this.hash = hashSHA256({ key, createdAt: this.createdAt });
  }
  access() { this.lastAccessedAt = Date.now(); this.accessCount++; }
  isExpired() { if (!this.ttlMs) return false; return Date.now() - this.createdAt > this.ttlMs; }
  evictionScore() {
    const recency = 1.0 / (1 + (Date.now() - this.lastAccessedAt) / (FIB[10] * 1000));
    const relevance = Math.min(1.0, this.accessCount / FIB[8]);
    return this.importance * EVICTION_WEIGHTS.importance + recency * EVICTION_WEIGHTS.recency + relevance * EVICTION_WEIGHTS.relevance;
  }
}

class MemoryTier {
  constructor(name, tokenBudget) { this.name = name; this.tokenBudget = tokenBudget; this.entries = new Map(); this.currentTokens = 0; this.evictions = 0; this.promotions = 0; this.demotions = 0; }
  get(key) { const entry = this.entries.get(key); if (!entry) return null; if (entry.isExpired()) { this._remove(key); return null; } entry.access(); return entry; }
  set(key, value, meta = {}) {
    if (this.entries.has(key)) this._remove(key);
    const entry = new CacheEntry(key, value, meta);
    while (this.currentTokens + entry.tokenSize > this.tokenBudget && this.entries.size > 0) this._evictOne();
    if (this.currentTokens + entry.tokenSize > this.tokenBudget) return { error: 'Entry too large for tier', tier: this.name, tokenSize: entry.tokenSize, budget: this.tokenBudget };
    this.entries.set(key, entry); this.currentTokens += entry.tokenSize;
    return { key, tier : this.name, tokenSize: entry.tokenSize };
  }
  _remove(key) { const entry = this.entries.get(key); if (entry) { this.currentTokens -= entry.tokenSize; this.entries.delete(key); } return entry; }
  _evictOne() {
    let worstKey = null, worstScore = Infinity;
    for (const [key, entry] of this.entries) { const score = entry.evictionScore(); if (score < worstScore) { worstScore = score; worstKey = key; } }
    if (worstKey) { const evicted = this._remove(worstKey); this.evictions++; return evicted; } return null;
  }
  gc() { const expired = []; for (const [key, entry] of this.entries) { if (entry.isExpired()) expired.push(key); } for (const key of expired) this._remove(key); return expired.length; }
  stats() { return { name: this.name, entryCount: this.entries.size, currentTokens: this.currentTokens, tokenBudget: this.tokenBudget, utilization: this.tokenBudget > 0 ? this.currentTokens / this.tokenBudget : 0, evictions: this.evictions, promotions: this.promotions, demotions: this.demotions }; }
}

class MemoryCache {
  constructor(config = {}) {
    this.tiers = new Map();
    this.tiers.set('working', new MemoryTier('working', config.workingBudget ?? TOKEN_BUDGETS.working));
    this.tiers.set('session', new MemoryTier('session', config.sessionBudget ?? TOKEN_BUDGETS.session));
    this.tiers.set('longTerm', new MemoryTier('longTerm', config.longTermBudget ?? TOKEN_BUDGETS.longTerm));
    this.tiers.set('artifacts', new MemoryTier('artifacts', config.artifactsBudget ?? TOKEN_BUDGETS.artifacts));
    this.tierOrder = ['working', 'session', 'longTerm', 'artifacts'];
    this.promotionThreshold = CSL_THRESHOLDS.HIGH; this.demotionThreshold = CSL_THRESHOLDS.LOW;
    this.auditLog = []; this.maxAuditEntries = FIB[16];
  }
  _audit(action, detail) { const entry = { ts: Date.now(), action, detail, hash: hashSHA256({ action, detail, ts: Date.now() }) }; this.auditLog.push(entry); if (this.auditLog.length > this.maxAuditEntries) this.auditLog = this.auditLog.slice(-FIB[14]); }
  get(key) { for (const tierName of this.tierOrder) { const tier = this.tiers.get(tierName); const entry = tier.get(key); if (entry) return { ...entry, tier: tierName }; } return null; }
  set(key, value, options = {}) { const targetTier = options.tier ?? 'working'; const tier = this.tiers.get(targetTier); if (!tier) return { error: `Unknown tier: ${targetTier}` }; const result = tier.set(key, value, options); this._audit('set', { key, tier: targetTier }); return result; }
  remove(key) { for (const tierName of this.tierOrder) { const tier = this.tiers.get(tierName); const entry = tier._remove(key); if (entry) { this._audit('remove', { key, tier: tierName }); return true; } } return false; }

  promote(key) {
    for (let i = this.tierOrder.length - 1; i > 0; i--) {
      const currentTierName = this.tierOrder[i]; const higherTierName = this.tierOrder[i - 1];
      const currentTier = this.tiers.get(currentTierName); const higherTier = this.tiers.get(higherTierName);
      const entry = currentTier.get(key);
      if (entry) {
        const score = entry.evictionScore(); const shouldPromote = cslGate(1.0, score, this.promotionThreshold);
        if (shouldPromote >= CSL_THRESHOLDS.MEDIUM) {
          currentTier._remove(key); higherTier.set(key, entry.value, { importance: entry.importance, tokenSize: entry.tokenSize, tags: entry.tags });
          currentTier.promotions++; this._audit('promote', { key, from: currentTierName, to: higherTierName, score });
          return { promoted: true, from: currentTierName, to: higherTierName };
        }
        return { promoted: false, reason: 'score-below-threshold', score };
      }
    }
    return { promoted: false, reason: 'key-not-found' };
  }

  demote(key) {
    for (let i = 0; i < this.tierOrder.length - 1; i++) {
      const currentTierName = this.tierOrder[i]; const lowerTierName = this.tierOrder[i + 1];
      const currentTier = this.tiers.get(currentTierName); const lowerTier = this.tiers.get(lowerTierName);
      const entry = currentTier.get(key);
      if (entry) {
        const score = entry.evictionScore(); const shouldDemote = score < this.demotionThreshold ? 1.0 : 0.0;
        if (shouldDemote > CSL_THRESHOLDS.MINIMUM) {
          currentTier._remove(key); lowerTier.set(key, entry.value, { importance: entry.importance * PSI, tokenSize: entry.tokenSize, tags: entry.tags });
          currentTier.demotions++; this._audit('demote', { key, from: currentTierName, to: lowerTierName, score });
          return { demoted: true, from: currentTierName, to: lowerTierName };
        }
        return { demoted: false, reason: 'score-above-threshold', score };
      }
    }
    return { demoted: false, reason: 'key-not-found' };
  }

  rebalance() {
    let promotions = 0, demotions = 0;
    for (const [key, entry] of this.tiers.get('working').entries) { if (entry.evictionScore() < this.demotionThreshold) { const result = this.demote(key); if (result.demoted) demotions++; } }
    for (let i = this.tierOrder.length - 1; i > 0; i--) { const tier = this.tiers.get(this.tierOrder[i]); for (const [key, entry] of tier.entries) { if (entry.evictionScore() > this.promotionThreshold) { const result = this.promote(key); if (result.promoted) promotions++; } } }
    return { promotions, demotions };
  }

  gc() { let totalExpired = 0; for (const tier of this.tiers.values()) totalExpired += tier.gc(); this._audit('gc', { expired: totalExpired }); return totalExpired; }
  stats() {
    const tierStats = {}; let totalTokens = 0, totalBudget = 0;
    for (const [name, tier] of this.tiers) { tierStats[name] = tier.stats(); totalTokens += tier.currentTokens; totalBudget += tier.tokenBudget; }
    return { tiers: tierStats, totalTokens, totalBudget, overallUtilization: totalBudget > 0 ? totalTokens / totalBudget : 0, auditLogSize: this.auditLog.length };
  }
}

export default MemoryCache;
export { MemoryCache, MemoryTier, CacheEntry, TOKEN_BUDGETS, EVICTION_WEIGHTS };
