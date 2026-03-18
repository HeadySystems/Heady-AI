'use strict';

/**
 * heady_dream_harvest — Harvest insights from the dream engine's background
 * ideation, filtered by CSL relevance to current task context.
 * JSON-RPC 2.0 MCP Tool
 */

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };
const EMBEDDING_DIM = 384;

const DREAM_CATEGORIES = ['pattern_synthesis', 'anomaly_insight', 'creative_connection', 'predictive_thread', 'consolidation_artifact', 'serendipity_spark'];
const dreamStore = [];
let dreamSeq = 0;

function correlationId() {
  return `dream-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function classifyError(code) {
  if (code >= 5000 && code < 5500) return 'DREAM_INPUT_ERROR';
  if (code >= 5500 && code < 6000) return 'DREAM_HARVEST_ERROR';
  return 'UNKNOWN_ERROR';
}

function hashSimple(str) {
  let h = FIB[7];
  for (let i = 0; i < str.length; i++) h = ((h << FIB[3]) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function generateEmbedding(text) {
  const vec = new Float32Array(EMBEDDING_DIM);
  const h = hashSimple(text);
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    vec[i] = Math.sin((h + i) * PHI) * PSI;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm > 0) for (let i = 0; i < EMBEDDING_DIM; i++) vec[i] /= norm;
  return vec;
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

function seedDreams() {
  if (dreamStore.length > 0) return;
  const seeds = [
    { content: 'Pattern detected: phi-harmonic resonance in service latency correlates with memory pool transitions', category: 'pattern_synthesis' },
    { content: 'Anomaly: orphaned vector embeddings in cold pool exceed Fibonacci threshold, potential knowledge loss', category: 'anomaly_insight' },
    { content: 'Connection: swarm behavior in Code domain mirrors biological ant colony optimization at phi-scaled intervals', category: 'creative_connection' },
    { content: 'Prediction: governance coherence will degrade in next cycle without checkpoint consolidation', category: 'predictive_thread' },
    { content: 'Consolidation: episodic memories from security events form semantic cluster around authentication flow', category: 'consolidation_artifact' },
    { content: 'Serendipity: cross-domain query patterns suggest undiscovered API surface between ATLAS and PYTHIA', category: 'serendipity_spark' },
    { content: 'Pattern: golden ratio distribution in token usage across services indicates natural load equilibrium', category: 'pattern_synthesis' },
    { content: 'Prediction: circuit breaker cascade risk increases when more than Fib(8) services share hot pool', category: 'predictive_thread' },
    { content: 'Creative: MUSE and SOPHIA response patterns create emergent narrative coherence when interleaved', category: 'creative_connection' },
    { content: 'Anomaly: drift in HCFP pipeline stage durations suggests temporal coupling between EXECUTE and QUALITY_GATE', category: 'anomaly_insight' },
    { content: 'Consolidation: recurring security audit patterns can be compressed into reusable governance templates', category: 'consolidation_artifact' },
    { content: 'Serendipity: vector similarity between trading signals and deployment success rates suggests hidden causal link', category: 'serendipity_spark' },
    { content: 'Pattern: phi-scaled batch sizes in pipeline processing yield optimal throughput per Fibonacci sequence', category: 'pattern_synthesis' },
  ];
  for (const seed of seeds) {
    dreamStore.push({
      id: `dream_${++dreamSeq}`,
      content: seed.content,
      category: seed.category,
      embedding: generateEmbedding(seed.content),
      created_at: new Date(Date.now() - Math.random() * FIB[10] * 60000).toISOString(),
      phi_weight: Number((Math.random() * PHI * PSI + PSI * PSI).toFixed(6)),
      harvested: false,
    });
  }
}

function harvestDreams(context, cslThreshold, maxResults, categories) {
  seedDreams();
  const contextEmb = generateEmbedding(context);
  const candidates = dreamStore
    .filter(d => !categories || categories.length === 0 || categories.includes(d.category))
    .map(d => ({ ...d, relevance: cosineSimilarity(contextEmb, d.embedding), embedding: undefined }))
    .filter(d => d.relevance >= cslThreshold)
    .sort((a, b) => b.relevance * b.phi_weight - a.relevance * a.phi_weight)
    .slice(0, maxResults);

  for (const c of candidates) {
    const stored = dreamStore.find(d => d.id === c.id);
    if (stored) stored.harvested = true;
  }

  return candidates.map(c => ({
    id: c.id,
    content: c.content,
    category: c.category,
    relevance: Number(c.relevance.toFixed(6)),
    phi_weight: c.phi_weight,
    created_at: c.created_at,
    csl_confidence: c.relevance >= CSL.HIGH ? CSL.CRITICAL : c.relevance >= CSL.MEDIUM ? CSL.HIGH : CSL.MEDIUM,
  }));
}

function computeInsightMap(insights) {
  if (insights.length === 0) return { clusters: [], coherence: 0 };
  const clusters = {};
  for (const ins of insights) {
    clusters[ins.category] = clusters[ins.category] || [];
    clusters[ins.category].push(ins.id);
  }
  const avgRelevance = insights.reduce((s, i) => s + i.relevance, 0) / insights.length;
  const coherence = avgRelevance * PHI * PSI;
  return {
    clusters: Object.entries(clusters).map(([cat, ids]) => ({ category: cat, dream_ids: ids, size: ids.length })),
    coherence: Number(coherence.toFixed(6)),
    phi_harmony: Number((coherence / PHI).toFixed(6)),
  };
}

const name = 'heady_dream_harvest';

const description = 'Harvest insights from the dream engine background ideation process, filtered by CSL relevance to the current task context. Returns phi-weighted dream insights with category clustering.';

const inputSchema = {
  type: 'object',
  properties: {
    context: { type: 'string', description: 'Current task context to match dreams against' },
    csl_threshold: { type: 'number', description: 'Minimum CSL relevance threshold (default: MEDIUM=0.809)' },
    max_results: { type: 'number', description: 'Maximum insights to return (default: Fib(5)=5)' },
    categories: { type: 'array', items: { type: 'string', enum: ['pattern_synthesis', 'anomaly_insight', 'creative_connection', 'predictive_thread', 'consolidation_artifact', 'serendipity_spark'] }, description: 'Filter by dream categories' },
    include_insight_map: { type: 'boolean', description: 'Include clustered insight map in response' },
  },
  required: ['context'],
};

async function handler(params) {
  const cid = correlationId();
  const ts = new Date().toISOString();

  try {
    if (!params.context || typeof params.context !== 'string') throw { code: 5001, message: 'context must be a non-empty string' };

    const cslThreshold = params.csl_threshold || CSL.MEDIUM;
    const maxResults = params.max_results || FIB[5];
    const categories = params.categories || [];

    if (cslThreshold < CSL.MINIMUM || cslThreshold > CSL.DEDUP) throw { code: 5002, message: `csl_threshold must be between ${CSL.MINIMUM} and ${CSL.DEDUP}` };

    const insights = harvestDreams(params.context, cslThreshold, maxResults, categories);
    const overallRelevance = insights.length > 0 ? insights.reduce((s, i) => s + i.relevance, 0) / insights.length : 0;

    const result = {
      insights,
      total_harvested: insights.length,
      dream_pool_size: dreamStore.length,
      context_embedding_dim: EMBEDDING_DIM,
      csl_threshold_used: cslThreshold,
      overall_relevance: Number(overallRelevance.toFixed(6)),
      csl_confidence: overallRelevance >= CSL.HIGH ? CSL.CRITICAL : overallRelevance >= CSL.MEDIUM ? CSL.HIGH : CSL.MEDIUM,
      phi_coherence: Number((overallRelevance * PHI * PSI).toFixed(6)),
      correlation_id: cid,
      timestamp: ts,
    };

    if (params.include_insight_map) result.insight_map = computeInsightMap(insights);

    return { jsonrpc: '2.0', result };
  } catch (err) {
    const code = err.code || 5999;
    return { jsonrpc: '2.0', error: { code, message: err.message || 'Dream harvest failed', classification: classifyError(code), correlation_id: cid, timestamp: ts } };
  }
}

function health() {
  seedDreams();
  const harvested = dreamStore.filter(d => d.harvested).length;
  return { status: 'healthy', dream_pool_size: dreamStore.length, harvested: harvested, unharvested: dreamStore.length - harvested, categories: DREAM_CATEGORIES.length, embedding_dim: EMBEDDING_DIM, phi: PHI, timestamp: new Date().toISOString() };
}

module.exports = { name, description, inputSchema, handler, health };
