'use strict';

/**
 * Context7 MCPRouter Registration — wires Context7 into the Heady MCP ecosystem.
 *
 * Provides:
 *   - registerContext7(router) — register Context7 as an MCP server
 *   - enrichCodeContext(taskDescription, adapter) — pipeline hook for library doc enrichment
 *
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 */

const logger = require('../utils/logger');
const { Context7Adapter } = require('./context7-adapter');

// ─── Phi-Math Constants ─────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// ─── CSL Gate Thresholds ────────────────────────────────────────────────────
const CSL_GATES = {
  MINIMUM: 0.500,
  LOW: 0.691,
  MEDIUM: 0.809,
  HIGH: 0.882,
  CRITICAL: 0.927,
  DEDUP: 0.972,
};

// ─── Token Budget ───────────────────────────────────────────────────────────
// FIB 0-indexed: [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987]
const MAX_TOKENS_PER_LIB = FIB[11] * 100;    // 144 * 100 = 14400
const MAX_LIBRARIES_PER_TASK = FIB[6];         // 13

const log = logger.child ? logger.child({ component: 'context7-registration' }) : logger;

// ─── Context7 Server Info ───────────────────────────────────────────────────
const CONTEXT7_SERVER_INFO = {
  name: 'Context7 Documentation Server',
  url: 'https://mcp.context7.com/mcp',
  tools: ['context7.resolve-library-id', 'context7.query-docs'],
  capabilities: [
    'documentation',
    'library-reference',
    'api-docs',
    'code-examples',
    'version-specific-docs',
    'framework-docs',
    'sdk-reference',
  ],
  transport: 'streamable-http',
  namespace: 'context7',
  sacredGeometry: {
    layer: 'Outer',
    node: 'BRIDGE',
    pool: 'Warm',
  },
};

// ─── Library Name Extraction Patterns ───────────────────────────────────────
const LIBRARY_PATTERNS = [
  // ES module imports: import x from 'package'
  /import\s+(?:[\w{},*\s]+from\s+)?['"]([^'"./][^'"]*)['"]/g,
  // CommonJS require: require('package')
  /require\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g,
  // Dynamic import: import('package')
  /import\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g,
  // Package name mentions in natural language: "using express", "with react"
  /\b(?:using|with|install|add|require|import)\s+(@?[a-z][\w.-]*(?:\/[\w.-]+)?)/gi,
  // package.json dependency format
  /"(@?[a-z][\w.-]*(?:\/[\w.-]+)?)"\s*:\s*"[\^~>=]*[\d.]/g,
  // pip install pattern
  /pip\s+install\s+([a-z][\w.-]+)/gi,
  // gem/cargo/go patterns
  /(?:gem|cargo\s+add|go\s+get)\s+([a-z][\w.-]+(?:\/[\w.-]+)*)/gi,
];

// Common noise words to filter out of library extraction
const NOISE_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'it', 'is', 'be', 'as', 'do', 'if', 'so', 'no', 'not', 'how',
  'can', 'use', 'get', 'set', 'new', 'all', 'my', 'function', 'class',
  'const', 'let', 'var', 'this', 'that', 'true', 'false', 'null', 'undefined',
]);

/**
 * Extract library names from a task description or code snippet.
 * @param {string} text — Task description or code
 * @returns {string[]} — Unique library names found
 */
function extractLibraryNames(text) {
  if (!text || typeof text !== 'string') return [];

  const found = new Set();

  for (const pattern of LIBRARY_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim();
      // Filter scoped packages and valid names
      if (name && name.length >= 2 && name.length <= 128 && !NOISE_WORDS.has(name.toLowerCase())) {
        // Extract base package name (strip subpath)
        const baseName = name.startsWith('@')
          ? name.split('/').slice(0, 2).join('/')
          : name.split('/')[0];
        found.add(baseName);
      }
    }
  }

  // Cap at MAX_LIBRARIES_PER_TASK
  return Array.from(found).slice(0, MAX_LIBRARIES_PER_TASK);
}

/**
 * CSL soft_gate — smooth sigmoid activation for relevance scoring.
 */
function softGate(value, cosScore, tau, temp) {
  tau = tau !== undefined ? tau : CSL_GATES.MINIMUM;
  temp = temp !== undefined ? temp : 0.236;
  return value * (1 / (1 + Math.exp(-(cosScore - tau) / temp)));
}

/**
 * Simple deterministic text-to-vector (matches mcp-router's _textToVec pattern).
 * Produces a 64D deterministic embedding for CSL comparison.
 */
function textToVec(text, dim) {
  dim = dim || 64;
  const vec = new Float32Array(dim);
  const chars = text.toLowerCase().split('');
  for (let i = 0; i < chars.length; i++) {
    const code = chars[i].charCodeAt(0);
    const idx = (code * FIB[5] + i * FIB[3]) % dim;
    vec[idx] += Math.sin(code * PHI + i * PSI) * PSI;
  }
  // Normalize
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (mag > 0) {
    for (let j = 0; j < dim; j++) vec[j] /= mag;
  }
  return vec;
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── registerContext7 ───────────────────────────────────────────────────────

/**
 * Register Context7 as an MCP server with the MCPRouter.
 * @param {Object} router — MCPRouter instance (from src/mcp/mcp-router.js)
 */
function registerContext7(router) {
  if (!router || typeof router.registerServer !== 'function') {
    throw new Error('Valid MCPRouter instance with registerServer() required');
  }

  router.registerServer('context7', CONTEXT7_SERVER_INFO);

  log.info({
    serverId: 'context7',
    tools: CONTEXT7_SERVER_INFO.tools,
    capabilities: CONTEXT7_SERVER_INFO.capabilities,
    transport: CONTEXT7_SERVER_INFO.transport,
    namespace: CONTEXT7_SERVER_INFO.namespace,
  }, 'Context7 registered with MCPRouter');
}

// ─── enrichCodeContext ──────────────────────────────────────────────────────

/**
 * Pipeline hook that extracts library names from a task description,
 * resolves each via Context7, queries docs, and returns enriched context.
 *
 * CSL soft_gate scores relevance of each doc chunk.
 *
 * @param {string} taskDescription — The task or code context to enrich
 * @param {Context7Adapter} adapter — Context7Adapter instance
 * @returns {Promise<Object>} — { libraries: [{name, id, docs, relevance}], totalTokens }
 */
async function enrichCodeContext(taskDescription, adapter) {
  if (!taskDescription || typeof taskDescription !== 'string') {
    return { libraries: [], totalTokens: 0 };
  }

  if (!adapter || typeof adapter.resolveLibrary !== 'function' || typeof adapter.queryDocs !== 'function') {
    adapter = new Context7Adapter();
  }

  const libraryNames = extractLibraryNames(taskDescription);
  if (libraryNames.length === 0) {
    log.debug({ taskDescription: taskDescription.slice(0, 200) }, 'No library names found in task description');
    return { libraries: [], totalTokens: 0 };
  }

  log.info({ libraryCount: libraryNames.length, libraries: libraryNames }, 'Enriching code context');

  // Build task vector for relevance scoring
  const taskVector = textToVec(taskDescription);

  const results = [];
  let totalTokens = 0;

  // Process libraries concurrently with settled pattern
  const resolutions = await Promise.allSettled(
    libraryNames.map(async (name) => {
      try {
        // Step 1: Resolve library ID
        const resolved = await adapter.resolveLibrary(name);
        if (!resolved || !resolved.libraryId) {
          log.warn({ library: name }, 'Could not resolve library ID');
          return null;
        }

        // Step 2: Query documentation
        const docs = await adapter.queryDocs(resolved.libraryId, {
          tokens: MAX_TOKENS_PER_LIB,
        });

        // Step 3: Score relevance via CSL soft_gate
        const docText = typeof docs === 'string' ? docs : (docs?.content || JSON.stringify(docs));
        const docVector = textToVec(docText.slice(0, 2000)); // Cap input for vectorization
        const rawSimilarity = cosineSimilarity(taskVector, docVector);
        const relevance = softGate(1.0, rawSimilarity, CSL_GATES.LOW);

        const tokenEstimate = typeof docText === 'string' ? Math.ceil(docText.length / 4) : 0;

        return {
          name,
          id: resolved.libraryId,
          docs,
          relevance: Number(relevance.toFixed(4)),
          tokenEstimate,
        };
      } catch (err) {
        log.warn({ library: name, error: err.message }, 'Failed to enrich library');
        return null;
      }
    })
  );

  for (const settlement of resolutions) {
    if (settlement.status === 'fulfilled' && settlement.value !== null) {
      results.push(settlement.value);
      totalTokens += settlement.value.tokenEstimate;
    }
  }

  // Sort by relevance descending
  results.sort((a, b) => b.relevance - a.relevance);

  log.info({
    enriched: results.length,
    totalTokens,
    topLibrary: results[0]?.name,
    topRelevance: results[0]?.relevance,
  }, 'Code context enrichment complete');

  return { libraries: results, totalTokens };
}

// ─── Exports ────────────────────────────────────────────────────────────────
module.exports = {
  registerContext7,
  enrichCodeContext,
  extractLibraryNames,
  CONTEXT7_SERVER_INFO,
  MAX_TOKENS_PER_LIB,
  MAX_LIBRARIES_PER_TASK,
  // Utility exports for downstream consumers
  softGate,
  textToVec,
  cosineSimilarity,
  PHI,
  PSI,
  FIB,
  CSL_GATES,
};
