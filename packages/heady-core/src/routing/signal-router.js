/**
 * Heady™ Signal-Decision Semantic Router
 * Patent coverage: HS-051 (Vibe-Match Latency Delta)
 * @module core/routing/signal-router
 */
import { cosineSimilarity, CSL, PHI, PSI, TIMING } from '../constants/phi.js';

const PROVIDERS = [
  { id: 'claude-opus',   costTier: 5, latencyMs: 3000, strengths: ['reasoning','code','analysis','long-context','creative'], maxTokens: 200000 },
  { id: 'claude-sonnet', costTier: 3, latencyMs: 1200, strengths: ['balanced','code','reasoning','instruction'],             maxTokens: 200000 },
  { id: 'groq-llama',    costTier: 1, latencyMs: 200,  strengths: ['fast','simple','factual','classification'],             maxTokens: 8192   },
  { id: 'gpt-4o',        costTier: 4, latencyMs: 2000, strengths: ['multimodal','vision','structured-output','function-calling'], maxTokens: 128000 },
  { id: 'gemini-25',     costTier: 3, latencyMs: 1500, strengths: ['long-context','multimodal','grounding','code'],          maxTokens: 1000000},
  { id: 'workers-ai',    costTier: 0, latencyMs: 80,   strengths: ['ultra-fast','edge','classification','embedding'],        maxTokens: 4096   },
];

const SIGNAL_EXTRACTORS = {
  tokenBudget:      (q) => q.estimatedTokens > 50000 ? 1.0 : (q.estimatedTokens ?? 0) / 50000,
  requiresVision:   (q) => q.hasImages ? 1.0 : 0.0,
  latencyPriority:  (q) => q.maxLatencyMs < 500 ? 1.0 : q.maxLatencyMs < 2000 ? 0.5 : 0.0,
  complexity:       (q) => { const w = q.text?.split(' ').length ?? 0; return w > 500 ? 1.0 : w > 100 ? PSI : PSI*PSI; },
  isDomainCode:     (q) => /\b(function|class|import|def |const |var |return)\b/.test(q.text ?? '') ? 1.0 : 0.0,
  isDomainMath:     (q) => /\b(equation|integral|derivative|matrix|proof)\b/.test(q.text ?? '') ? 1.0 : 0.0,
  isDomainTrading:  (q) => /\b(trade|order|position|pnl|drawdown|apex|signal)\b/i.test(q.text ?? '') ? 1.0 : 0.0,
};

export class SignalRouter {
  #cache = new Map();
  #embedder = null;

  constructor({ embedder, cacheSize = 233 } = {}) {
    this.#embedder = embedder;
    this.cacheSize = cacheSize;
  }

  async route(query) {
    const signals = this.#extractSignals(query);
    const cacheKey = await this.#semanticCacheKey(query);
    if (this.#cache.has(cacheKey)) {
      const cached = this.#cache.get(cacheKey);
      if (cosineSimilarity(signals.embedding ?? [], cached.embedding ?? []) > CSL.BOOST) {
        return { provider: cached.provider, fromCache: true, confidence: CSL.HIGH };
      }
    }
    const scores = PROVIDERS.map(provider => ({
      provider,
      score: this.#scoreProvider(provider, signals, query),
    })).sort((a, b) => b.score - a.score);
    const best = scores[0];
    const confidence = best.score / (scores[0].score + (scores[1]?.score ?? 0) + 0.001);
    this.#cacheDecision(cacheKey, best.provider.id, signals.embedding, confidence);
    return { provider: best.provider.id, confidence, fromCache: false, signals, alternatives: scores.slice(1,3).map(s=>s.provider.id) };
  }

  #extractSignals(query) {
    return Object.fromEntries(Object.entries(SIGNAL_EXTRACTORS).map(([n,f]) => [n, f(query)]));
  }

  #scoreProvider(provider, signals, query) {
    let score = 0;
    if (signals.requiresVision > CSL.BOOST && !provider.strengths.includes('multimodal')) return 0;
    if (signals.tokenBudget > CSL.BOOST && provider.maxTokens < 100000) return 0;
    if (signals.latencyPriority > CSL.BOOST && provider.latencyMs > 500) score -= PHI;
    const sw = { code: signals.isDomainCode, reasoning: signals.complexity, 'long-context': signals.tokenBudget, fast: signals.latencyPriority, 'ultra-fast': signals.latencyPriority*PSI, multimodal: signals.requiresVision };
    for (const [s, w] of Object.entries(sw)) {
      if (provider.strengths.includes(s)) score += w * PSI;
    }
    const demand = signals.complexity + signals.isDomainCode * PSI;
    if (demand < CSL.INCLUDE) score += (5 - provider.costTier) * PSI * PSI;
    return score;
  }

  async #semanticCacheKey(query) {
    if (this.#embedder && query.text) {
      const emb = await this.#embedder(query.text.slice(0, 256));
      query._embedding = emb;
      return emb.slice(0, 8).map(v => Math.round(v * 8)).join(',');
    }
    return query.text?.slice(0, 64) ?? 'no-text';
  }

  #cacheDecision(key, providerId, embedding, confidence) {
    if (this.#cache.size >= this.cacheSize) this.#cache.delete(this.#cache.keys().next().value);
    this.#cache.set(key, { provider: providerId, embedding, confidence, ts: Date.now() });
  }
}
