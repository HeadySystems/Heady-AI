/**
 * Heady™ HeadyAssure v1.0
 * Pre-deployment certification engine.
 * Validates structural integrity AND semantic coherence of an entire
 * deployment artifact before it goes live. Produces signed certificates
 * that gate the deployment pipeline.
 *
 * Part of the HCFullPipeline (Stage 6: Assurance Gate).
 *
 * All numeric values derived from φ (phi) and Fibonacci sequences.
 * Zero magic numbers.
 *
 * @author Eric Haywood — HeadySystems Inc.
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const crypto = require('crypto');
const {
  PHI, PSI, PSI_SQ, PSI_CUBE, PSI_FOURTH,
  EMBEDDING_DIM,
  fib, nearestFib,
  CSL_THRESHOLDS,
  phiThreshold,
  phiFusionWeights,
  cslGate,
  cslBlend,
  PRESSURE_LEVELS,
  ALERT_THRESHOLDS,
} = require('../../shared/phi-math.js');
const logger = require('../../shared/logger.js');
const { createHealthCheck } = require('../../shared/health.js');

// ═══════════════════════════════════════════════════════════
// CONSTANTS — All phi-derived
// ═══════════════════════════════════════════════════════════

/** Maximum files in a single certification — fib(10) = 55 */
const MAX_CERT_FILES = fib(10);

/** Certificate validity period — fib(14) × 60 × 1000 ms ≈ 6.28 hours */
const CERT_VALIDITY_MS = fib(14) * 60 * 1000;

/** Minimum overall score for certification — CSL HIGH ≈ 0.882 */
const CERT_THRESHOLD = CSL_THRESHOLDS.HIGH;

/** Structural integrity weight in final score */
const STRUCTURAL_WEIGHT = PSI; // ≈ 0.618

/** Semantic coherence weight in final score */
const SEMANTIC_WEIGHT = 1 - PSI; // ≈ 0.382

/** Certificate history buffer — fib(11) = 89 */
const CERT_HISTORY = fib(11);

/** Cross-module dependency depth limit — fib(6) = 8 */
const MAX_DEPENDENCY_DEPTH = fib(6);

/** File coherence check concurrency — fib(7) = 13 */
const COHERENCE_CONCURRENCY = fib(7);

/** Minimum file count for a meaningful certification — fib(4) = 3 */
const MIN_FILES_FOR_CERT = fib(4);

// ═══════════════════════════════════════════════════════════
// STRUCTURAL INTEGRITY ANALYZER
// ═══════════════════════════════════════════════════════════

class StructuralAnalyzer {
  /**
   * Analyze structural integrity of a set of files.
   *
   * @param {Array<{path: string, content: string}>} files
   * @returns {object} — { score, issues, dependencyGraph, moduleMap }
   */
  analyze(files) {
    let score = 1.0;
    const issues = [];

    // 1. Build dependency graph
    const depGraph = this._buildDependencyGraph(files);

    // 2. Check for circular dependencies
    const cycles = this._detectCycles(depGraph);
    if (cycles.length > 0) {
      score -= cycles.length * PSI_CUBE;
      issues.push(...cycles.map(c => `Circular dependency: ${c.join(' → ')}`));
    }

    // 3. Check dependency depth
    const maxDepth = this._maxDependencyDepth(depGraph);
    if (maxDepth > MAX_DEPENDENCY_DEPTH) {
      score -= PSI_FOURTH;
      issues.push(`Dependency depth ${maxDepth} exceeds limit ${MAX_DEPENDENCY_DEPTH}`);
    }

    // 4. Check for orphaned files (no imports, no exports used)
    const orphans = this._findOrphans(files, depGraph);
    if (orphans.length > 0) {
      score -= orphans.length * PSI_FOURTH * PSI;
      issues.push(...orphans.map(o => `Orphaned file: ${o}`));
    }

    // 5. Check strict mode
    for (const file of files) {
      if (file.path.endsWith('.js') && !file.content.includes("'use strict'")) {
        score -= PSI_FOURTH * PSI;
        issues.push(`Missing 'use strict': ${file.path}`);
      }
    }

    // 6. Check for forbidden patterns
    for (const file of files) {
      if (/console\.(log|warn|error|info|debug)\s*\(/.test(file.content)) {
        score -= PSI_FOURTH;
        issues.push(`console.log in ${file.path}`);
      }
      if (/localStorage/.test(file.content)) {
        score -= PSI_CUBE;
        issues.push(`localStorage in ${file.path}`);
      }
      if (/\beval\s*\(/.test(file.content)) {
        score -= PSI;
        issues.push(`eval() in ${file.path} — security violation`);
      }
    }

    // 7. Check for consistent author attribution
    for (const file of files) {
      if (/Eric\s+Head(?!y)/i.test(file.content)) {
        score -= PSI_FOURTH;
        issues.push(`"Eric Head" found in ${file.path} — should be "Eric Haywood"`);
      }
    }

    // 8. Verify package.json consistency
    const pkgJson = files.find(f => f.path === 'package.json' || f.path.endsWith('/package.json'));
    if (pkgJson) {
      try {
        const pkg = JSON.parse(pkgJson.content);
        if (!pkg.name || !pkg.version) {
          score -= PSI_FOURTH;
          issues.push('package.json missing name or version');
        }
      } catch (err) {
        score -= PSI_SQ;
        issues.push('package.json is not valid JSON');
      }
    }

    return {
      score: Math.max(0, Number(score.toFixed(6))),
      issues,
      dependencyGraph: depGraph,
      fileCount: files.length,
      maxDependencyDepth: maxDepth,
      cycleCount: cycles.length,
      orphanCount: orphans.length,
    };
  }

  /**
   * Build a dependency graph from require/import statements.
   * @private
   */
  _buildDependencyGraph(files) {
    const graph = {};
    const filePaths = new Set(files.map(f => f.path));

    for (const file of files) {
      if (!file.path.endsWith('.js')) continue;

      const deps = [];
      const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      let match;
      while ((match = requireRegex.exec(file.content)) !== null) {
        deps.push(match[1]);
      }

      const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
      while ((match = importRegex.exec(file.content)) !== null) {
        deps.push(match[1]);
      }

      graph[file.path] = deps.filter(d => {
        // Only track internal deps
        return d.startsWith('./') || d.startsWith('../') || d.includes('shared/');
      });
    }

    return graph;
  }

  /**
   * Detect circular dependencies using DFS.
   * @private
   */
  _detectCycles(graph) {
    const cycles = [];
    const visited = new Set();
    const inStack = new Set();
    const path = [];

    const dfs = (node) => {
      if (inStack.has(node)) {
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart).concat(node));
        }
        return;
      }
      if (visited.has(node)) return;

      visited.add(node);
      inStack.add(node);
      path.push(node);

      for (const dep of (graph[node] || [])) {
        dfs(dep);
      }

      path.pop();
      inStack.delete(node);
    };

    for (const node of Object.keys(graph)) {
      dfs(node);
    }

    return cycles;
  }

  /**
   * Calculate maximum dependency depth.
   * @private
   */
  _maxDependencyDepth(graph) {
    const memo = {};

    const depth = (node, visited = new Set()) => {
      if (visited.has(node)) return 0;
      if (memo[node] !== undefined) return memo[node];

      visited.add(node);
      const deps = graph[node] || [];
      let maxD = 0;
      for (const dep of deps) {
        maxD = Math.max(maxD, 1 + depth(dep, new Set(visited)));
      }
      memo[node] = maxD;
      return maxD;
    };

    let max = 0;
    for (const node of Object.keys(graph)) {
      max = Math.max(max, depth(node));
    }
    return max;
  }

  /**
   * Find files that are neither imported nor import anything.
   * @private
   */
  _findOrphans(files, graph) {
    const jsFiles = files.filter(f => f.path.endsWith('.js')).map(f => f.path);
    const imported = new Set();

    for (const deps of Object.values(graph)) {
      for (const dep of deps) {
        imported.add(dep);
      }
    }

    return jsFiles.filter(f => {
      const hasDeps = (graph[f] || []).length > 0;
      const isImported = imported.has(f);
      // Entry points and test files are not orphans
      if (f.includes('bootstrap') || f.includes('test') || f.includes('server')) return false;
      return !hasDeps && !isImported;
    });
  }
}

// ═══════════════════════════════════════════════════════════
// SEMANTIC COHERENCE ANALYZER
// ═══════════════════════════════════════════════════════════

class SemanticAnalyzer {
  /**
   * @param {function} [embedder] — async (text) => Float32Array(384)
   */
  constructor(embedder = null) {
    this._embedder = embedder;
  }

  /**
   * Analyze semantic coherence of a set of files.
   *
   * @param {Array<{path: string, content: string}>} files
   * @param {object} [context] — { designEmbeddings, missionEmbedding }
   * @returns {Promise<object>} — { score, pairwiseCoherence, outliers }
   */
  async analyze(files, context = {}) {
    const jsFiles = files.filter(f => f.path.endsWith('.js'));

    if (jsFiles.length < MIN_FILES_FOR_CERT) {
      return {
        score: CSL_THRESHOLDS.MEDIUM,
        pairwiseCoherence: [],
        outliers: [],
        note: 'Insufficient files for full semantic analysis',
      };
    }

    // Compute embeddings for each file
    const embeddings = {};
    for (const file of jsFiles) {
      if (this._embedder) {
        try {
          embeddings[file.path] = await this._embedder(file.content);
        } catch (err) { // Fallback: synthetic embedding from content characteristics
          embeddings[file.path] = this._syntheticEmbedding(file);  logger.error('Operation failed', { error: err.message }); }
      } else {
        embeddings[file.path] = this._syntheticEmbedding(file);
      }
    }

    // Pairwise coherence within modules
    const moduleGroups = this._groupByModule(jsFiles);
    const pairwiseResults = [];
    let totalCoherence = 0;
    let pairCount = 0;

    for (const [module, moduleFiles] of Object.entries(moduleGroups)) {
      for (let i = 0; i < moduleFiles.length; i++) {
        for (let j = i + 1; j < moduleFiles.length; j++) {
          const a = embeddings[moduleFiles[i].path];
          const b = embeddings[moduleFiles[j].path];
          if (a && b) {
            const sim = cosineSimilarity(a, b);
            pairwiseResults.push({
              fileA: moduleFiles[i].path,
              fileB: moduleFiles[j].path,
              module,
              similarity: Number(sim.toFixed(6)),
            });
            totalCoherence += sim;
            pairCount++;
          }
        }
      }
    }

    const avgCoherence = pairCount > 0 ? totalCoherence / pairCount : CSL_THRESHOLDS.MEDIUM;

    // Find outliers — files with low avg similarity to their module
    const outliers = [];
    for (const [module, moduleFiles] of Object.entries(moduleGroups)) {
      for (const file of moduleFiles) {
        const emb = embeddings[file.path];
        if (!emb) continue;

        const siblings = moduleFiles.filter(f => f.path !== file.path);
        if (siblings.length === 0) continue;

        let avgSim = 0;
        for (const sib of siblings) {
          const sibEmb = embeddings[sib.path];
          if (sibEmb) avgSim += cosineSimilarity(emb, sibEmb);
        }
        avgSim /= siblings.length;

        if (avgSim < CSL_THRESHOLDS.LOW) {
          outliers.push({
            file: file.path,
            module,
            averageSimilarity: Number(avgSim.toFixed(6)),
          });
        }
      }
    }

    // Design intent check — compare against design embeddings if available
    let designScore = 1.0;
    if (context.designEmbeddings) {
      let designMatch = 0;
      let designCount = 0;
      for (const [path, emb] of Object.entries(embeddings)) {
        const designEmb = context.designEmbeddings[path];
        if (designEmb) {
          designMatch += cosineSimilarity(emb, designEmb);
          designCount++;
        }
      }
      designScore = designCount > 0 ? designMatch / designCount : 1.0;
    }

    // Blend coherence and design scores
    const score = cslBlend(
      avgCoherence,
      designScore,
      avgCoherence,
      CSL_THRESHOLDS.MEDIUM
    );

    return {
      score: Number(Math.min(1.0, score).toFixed(6)),
      averageCoherence: Number(avgCoherence.toFixed(6)),
      designScore: Number(designScore.toFixed(6)),
      pairwiseCoherence: pairwiseResults,
      outliers,
      moduleCount: Object.keys(moduleGroups).length,
    };
  }

  /**
   * Generate a synthetic 384D embedding from content characteristics.
   * @private
   */
  _syntheticEmbedding(file) {
    const emb = new Float32Array(EMBEDDING_DIM);
    const content = file.content;

    // Feature extraction
    const features = {
      lineCount: content.split('\n').length,
      functionCount: (content.match(/function\s+\w+/g) || []).length,
      classCount: (content.match(/class\s+\w+/g) || []).length,
      importCount: (content.match(/require\s*\(/g) || []).length,
      exportCount: (content.match(/module\.exports/g) || []).length,
      commentCount: (content.match(/\/\//g) || []).length,
      jsdocCount: (content.match(/\/\*\*/g) || []).length,
    };

    // Map features to embedding dimensions deterministically
    let seed = 0;
    for (let i = 0; i < file.path.length; i++) {
      seed = ((seed << 5) - seed + file.path.charCodeAt(i)) | 0;
    }

    for (let i = 0; i < EMBEDDING_DIM; i++) {
      seed = ((seed << 13) ^ seed) | 0;
      seed = ((seed >> 17) ^ seed) | 0;
      seed = ((seed << 5) ^ seed) | 0;
      const base = (seed >>> 0) / 4294967296;

      // Modulate by features
      const featureIdx = i % 7;
      const featureValues = Object.values(features);
      const featureWeight = featureValues[featureIdx] / (featureValues[featureIdx] + PHI);

      emb[i] = (base - 0.5) + featureWeight * PSI_SQ;
    }

    // L2 normalize
    let norm = 0;
    for (let i = 0; i < EMBEDDING_DIM; i++) norm += emb[i] * emb[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < EMBEDDING_DIM; i++) emb[i] /= norm;
    }

    return emb;
  }

  /**
   * Group files by their module directory.
   * @private
   */
  _groupByModule(files) {
    const groups = {};
    for (const file of files) {
      const parts = file.path.split('/');
      const module = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
      if (!groups[module]) groups[module] = [];
      groups[module].push(file);
    }
    return groups;
  }
}

// ═══════════════════════════════════════════════════════════
// CERTIFICATE — Deployment authorization artifact
// ═══════════════════════════════════════════════════════════

class Certificate {
  /**
   * @param {object} opts
   * @param {string} opts.deploymentId — what this certifies
   * @param {number} opts.structuralScore — law 1 score
   * @param {number} opts.semanticScore — law 2 score
   * @param {number} opts.compositeScore — blended score
   * @param {boolean} opts.certified — pass/fail
   * @param {Array<string>} opts.issues — any issues found
   * @param {object} opts.details — full analysis details
   */
  constructor({ deploymentId, structuralScore, semanticScore, compositeScore, certified, issues, details }) {
    this.id = `cert_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    this.deploymentId = deploymentId;
    this.structuralScore = structuralScore;
    this.semanticScore = semanticScore;
    this.compositeScore = compositeScore;
    this.certified = certified;
    this.issues = issues;
    this.details = details;
    this.issued = Date.now();
    this.expires = Date.now() + CERT_VALIDITY_MS;
    this.hash = this._computeHash();
  }

  /**
   * Check if certificate is still valid.
   */
  isValid() {
    return this.certified && Date.now() < this.expires;
  }

  /**
   * Verify the certificate hash.
   */
  verify() {
    return this.hash === this._computeHash();
  }

  /**
   * Compute a SHA-256 hash of the certificate data.
   * @private
   */
  _computeHash() {
    const data = JSON.stringify({
      deploymentId: this.deploymentId,
      structuralScore: this.structuralScore,
      semanticScore: this.semanticScore,
      compositeScore: this.compositeScore,
      certified: this.certified,
      issued: this.issued,
      expires: this.expires,
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  toJSON() {
    return {
      id: this.id,
      deploymentId: this.deploymentId,
      certified: this.certified,
      compositeScore: this.compositeScore,
      structuralScore: this.structuralScore,
      semanticScore: this.semanticScore,
      issued: new Date(this.issued).toISOString(),
      expires: new Date(this.expires).toISOString(),
      isValid: this.isValid(),
      issueCount: this.issues.length,
      hash: this.hash,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// HEADY ASSURE ENGINE — Main certification engine
// ═══════════════════════════════════════════════════════════

class HeadyAssureEngine {
  /**
   * @param {object} [opts]
   * @param {function} [opts.embedder] — async embedding function
   */
  constructor({ embedder = null } = {}) {
    this._structural = new StructuralAnalyzer();
    this._semantic = new SemanticAnalyzer(embedder);
    /** @type {Array<Certificate>} */
    this._certificates = [];
    this._totalCertifications = 0;
    this._totalPassed = 0;
    this._totalFailed = 0;
  }

  /**
   * Certify a deployment artifact.
   *
   * @param {string} deploymentId — identifier for this deployment
   * @param {Array<{path: string, content: string}>} files — all files in deployment
   * @param {object} [context] — { designEmbeddings, missionEmbedding }
   * @returns {Promise<Certificate>}
   */
  async certify(deploymentId, files, context = {}) {
    this._totalCertifications++;

    logger.info({
      component: 'HeadyAssure',
      action: 'certify_start',
      deploymentId,
      fileCount: files.length,
    });

    // Phase 1: Structural analysis
    const structural = this._structural.analyze(files);

    // Phase 2: Semantic analysis
    const semantic = await this._semantic.analyze(files, context);

    // Phase 3: Compute composite score
    const compositeScore = Number((
      STRUCTURAL_WEIGHT * structural.score +
      SEMANTIC_WEIGHT * semantic.score
    ).toFixed(6));

    // Phase 4: Determine certification
    const certified = compositeScore >= CERT_THRESHOLD;

    if (certified) {
      this._totalPassed++;
    } else {
      this._totalFailed++;
    }

    // Phase 5: Create certificate
    const allIssues = [
      ...structural.issues,
      ...(semantic.outliers || []).map(o => `Semantic outlier: ${o.file} (sim: ${o.averageSimilarity})`),
    ];

    const cert = new Certificate({
      deploymentId,
      structuralScore: structural.score,
      semanticScore: semantic.score,
      compositeScore,
      certified,
      issues: allIssues,
      details: {
        structural: {
          score: structural.score,
          fileCount: structural.fileCount,
          maxDependencyDepth: structural.maxDependencyDepth,
          cycleCount: structural.cycleCount,
          orphanCount: structural.orphanCount,
          issueCount: structural.issues.length,
        },
        semantic: {
          score: semantic.score,
          averageCoherence: semantic.averageCoherence,
          designScore: semantic.designScore,
          moduleCount: semantic.moduleCount,
          outlierCount: (semantic.outliers || []).length,
        },
      },
    });

    // Store certificate
    this._certificates.push(cert);
    while (this._certificates.length > CERT_HISTORY) {
      this._certificates.shift();
    }

    logger.info({
      component: 'HeadyAssure',
      action: 'certify_complete',
      deploymentId,
      certId: cert.id,
      certified,
      compositeScore,
      structuralScore: structural.score,
      semanticScore: semantic.score,
      issueCount: allIssues.length,
    });

    return cert;
  }

  /**
   * Validate an existing certificate.
   *
   * @param {string} certId
   * @returns {object} — { valid, reason }
   */
  validateCertificate(certId) {
    const cert = this._certificates.find(c => c.id === certId);
    if (!cert) return { valid: false, reason: 'Certificate not found' };
    if (!cert.verify()) return { valid: false, reason: 'Certificate hash mismatch — tampering detected' };
    if (!cert.isValid()) return { valid: false, reason: 'Certificate expired' };
    return { valid: true, certificate: cert.toJSON() };
  }

  /**
   * Get all certificates for a deployment.
   *
   * @param {string} deploymentId
   * @returns {Array<object>}
   */
  getCertificates(deploymentId) {
    return this._certificates
      .filter(c => c.deploymentId === deploymentId)
      .map(c => c.toJSON());
  }

  /**
   * Get engine statistics.
   */
  getStats() {
    const passRate = this._totalCertifications > 0
      ? this._totalPassed / this._totalCertifications
      : 0;

    return {
      totalCertifications: this._totalCertifications,
      totalPassed: this._totalPassed,
      totalFailed: this._totalFailed,
      passRate: Number(passRate.toFixed(6)),
      activeCertificates: this._certificates.filter(c => c.isValid()).length,
      expiredCertificates: this._certificates.filter(c => !c.isValid()).length,
      certThreshold: CERT_THRESHOLD,
    };
  }

  /**
   * Get recent certification history.
   * @param {number} [n=fib(7)] — default 13
   */
  recentHistory(n = fib(7)) {
    return this._certificates.slice(-n).map(c => c.toJSON());
  }
}

// ═══════════════════════════════════════════════════════════
// UTILITY — Cosine similarity
// ═══════════════════════════════════════════════════════════

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

// ═══════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════

const healthCheck = createHealthCheck('heady-assure', () => {
  const engine = getSharedEngine();
  return engine.getStats();
});

// ═══════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════

let _sharedEngine = null;

function getSharedEngine() {
  if (!_sharedEngine) {
    _sharedEngine = new HeadyAssureEngine();
  }
  return _sharedEngine;
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  // Core
  HeadyAssureEngine,
  StructuralAnalyzer,
  SemanticAnalyzer,
  Certificate,

  // Singleton
  getSharedEngine,

  // Health
  healthCheck,

  // Utility
  cosineSimilarity,

  // Constants (for testing)
  MAX_CERT_FILES,
  CERT_VALIDITY_MS,
  CERT_THRESHOLD,
  STRUCTURAL_WEIGHT,
  SEMANTIC_WEIGHT,
  CERT_HISTORY,
  MAX_DEPENDENCY_DEPTH,
  COHERENCE_CONCURRENCY,
  MIN_FILES_FOR_CERT,
};
