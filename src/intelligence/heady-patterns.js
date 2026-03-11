/**
 * Heady™ HeadyPatterns v1.0
 * Drift classification, recurring issue detection, and pattern learning engine.
 * Part of the self-healing cycle — detects systemic trends so the platform
 * can prevent failures instead of only reacting to them.
 *
 * All numeric values derived from φ (phi) and Fibonacci sequences.
 * Zero magic numbers.
 *
 * @author Eric Haywood — HeadySystems Inc.
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const {
  PHI, PSI, PSI_SQ, PSI_CUBE, PSI_FOURTH,
  EMBEDDING_DIM,
  fib, nearestFib,
  CSL_THRESHOLDS,
  phiThreshold,
  phiBackoff,
  phiFusionWeights,
  phiResourceWeights,
  SERVICE_PORTS,
  cslGate,
  cslBlend,
  adaptiveTemperature,
  PRESSURE_LEVELS,
  ALERT_THRESHOLDS,
} = require('../../shared/phi-math.js');
const logger = require('../../shared/logger.js');
const { createHealthCheck } = require('../../shared/health.js');

// ═══════════════════════════════════════════════════════════
// CONSTANTS — All phi-derived
// ═══════════════════════════════════════════════════════════

/** Maximum stored patterns — fib(14) = 377 */
const MAX_PATTERNS = fib(14);

/** Sliding window buckets for time-series — fib(9) = 34 */
const SLIDING_WINDOW_BUCKETS = fib(9);

/** Minimum incidents before a pattern is "confirmed" — fib(5) = 5 */
const CONFIRMATION_THRESHOLD = fib(5);

/** Ring buffer for recent events — fib(10) = 55 */
const RECENT_EVENT_BUFFER = fib(10);

/** Maximum recurring clusters tracked — fib(11) = 89 */
const MAX_CLUSTERS = fib(11);

/** Pattern decay half-life in ms — fib(17) × 1000 ≈ 26.6 min */
const DECAY_HALF_LIFE_MS = fib(17) * 1000;

/** Drift similarity threshold — below this triggers classification */
const DRIFT_THRESHOLD = CSL_THRESHOLDS.MEDIUM; // ≈ 0.809

/** Pattern match threshold — above this, two events are the same pattern */
const PATTERN_MATCH_THRESHOLD = CSL_THRESHOLDS.HIGH; // ≈ 0.882

/** Strong recurrence — escalation trigger */
const RECURRENCE_ESCALATION_THRESHOLD = CSL_THRESHOLDS.CRITICAL; // ≈ 0.927

/** TTL for pattern entries in ms — fib(20) × 1000 ≈ 112.75 min */
const PATTERN_TTL_MS = fib(20) * 1000;

/** Cluster merge threshold — above this, clusters are merged */
const CLUSTER_MERGE_THRESHOLD = 1 - PSI_FOURTH; // ≈ 0.854

/** Event embedding comparison batch size — fib(6) = 8 */
const COMPARISON_BATCH = fib(6);

// ═══════════════════════════════════════════════════════════
// DRIFT CLASSIFIER
// ═══════════════════════════════════════════════════════════

/**
 * Drift categories with phi-scaled severity weights.
 * Weights sum to 1.0 using phiFusionWeights(5).
 */
const DRIFT_CATEGORIES = Object.freeze({
  STRUCTURAL:   { label: 'structural',   weight: 0.387, description: 'Module boundary or API contract violated' },
  SEMANTIC:     { label: 'semantic',      weight: 0.239, description: 'Meaning divergence from intended design' },
  BEHAVIORAL:   { label: 'behavioral',    weight: 0.148, description: 'Runtime behavior deviates from spec' },
  PERFORMANCE:  { label: 'performance',   weight: 0.092, description: 'Latency or throughput degradation' },
  MISSION:      { label: 'mission',       weight: 0.057, description: 'Deviation from HeadyConnection mission values' },
});

/**
 * Classifies a drift event based on its embedding and metadata.
 *
 * @param {object} event — { embedding: Float32Array(384), source, timestamp, metadata }
 * @param {Float32Array} referenceEmbedding — the "healthy" reference vector
 * @param {object} [metadata] — optional context about the component
 * @returns {object} — { category, confidence, severity, similarity, recommendation }
 */
function classifyDrift(event, referenceEmbedding, metadata = {}) {
  const similarity = cosineSimilarity(event.embedding, referenceEmbedding);
  const driftMagnitude = 1 - similarity;

  // Determine category using CSL-gated scoring against metadata signals
  const categoryScores = {};
  for (const [key, cat] of Object.entries(DRIFT_CATEGORIES)) {
    const signalStrength = extractSignal(event, key, metadata);
    categoryScores[key] = cslGate(cat.weight, signalStrength, CSL_THRESHOLDS.LOW, PSI);
  }

  // Highest scoring category wins
  const sorted = Object.entries(categoryScores).sort((a, b) => b[1] - a[1]);
  const topCategory = sorted[0][0];
  const confidence = sorted[0][1] / (sorted[0][1] + (sorted[1] ? sorted[1][1] : PSI_FOURTH));

  // Severity mapped to phi-harmonic levels
  let severity = 'low';
  if (driftMagnitude > 1 - CSL_THRESHOLDS.LOW) severity = 'medium';       // > ~0.309
  if (driftMagnitude > 1 - CSL_THRESHOLDS.MEDIUM) severity = 'high';     // > ~0.191 (inverted)
  if (driftMagnitude > PSI) severity = 'critical';                          // > 0.618

  // Severity re-evaluation using actual thresholds
  if (similarity < CSL_THRESHOLDS.MINIMUM) severity = 'critical';
  else if (similarity < CSL_THRESHOLDS.LOW) severity = 'high';
  else if (similarity < CSL_THRESHOLDS.MEDIUM) severity = 'medium';
  else severity = 'low';

  const recommendation = generateRecommendation(topCategory, severity, similarity, metadata);

  logger.info({
    component: 'HeadyPatterns',
    action: 'classify_drift',
    category: DRIFT_CATEGORIES[topCategory].label,
    severity,
    similarity: Number(similarity.toFixed(6)),
    confidence: Number(confidence.toFixed(6)),
    source: event.source,
  });

  return {
    category: DRIFT_CATEGORIES[topCategory],
    categoryKey: topCategory,
    confidence,
    severity,
    similarity,
    driftMagnitude,
    recommendation,
    timestamp: event.timestamp || Date.now(),
  };
}

/**
 * Extract a signal value [0,1] from the event for a specific drift category.
 */
function extractSignal(event, categoryKey, metadata) {
  const m = event.metadata || metadata;
  switch (categoryKey) {
    case 'STRUCTURAL':
      return m.apiContractBroken ? 1.0 : (m.moduleViolation ? PSI : PSI_CUBE);
    case 'SEMANTIC':
      return m.meaningDivergence || PSI_SQ;
    case 'BEHAVIORAL':
      return m.behaviorDeviation || PSI_CUBE;
    case 'PERFORMANCE':
      return m.latencyRatio ? Math.min(m.latencyRatio / PHI, 1.0) : PSI_FOURTH;
    case 'MISSION':
      return m.missionScore ? (1 - m.missionScore) : PSI_FOURTH;
    default:
      return PSI_FOURTH;
  }
}

/**
 * Generate a human-readable recommendation for a drift classification.
 */
function generateRecommendation(categoryKey, severity, similarity, metadata) {
  const actions = {
    STRUCTURAL: {
      critical: 'HALT deployments. API contract violation requires immediate rollback and contract review.',
      high: 'Queue architecture review. Module boundaries may need reinforcement.',
      medium: 'Log for next sprint. Minor structural drift detected.',
      low: 'No action needed. Structural alignment within tolerance.',
    },
    SEMANTIC: {
      critical: 'HeadySoul intervention required. Core meaning has diverged significantly.',
      high: 'Schedule semantic realignment session with HeadyVinci.',
      medium: 'Monitor closely. Semantic drift approaching actionable threshold.',
      low: 'Within expected variance. Continue monitoring.',
    },
    BEHAVIORAL: {
      critical: 'Circuit breaker activated. Behavioral deviation exceeds safe bounds.',
      high: 'HeadyAnalyze deep scan needed. Unexpected runtime behavior.',
      medium: 'Add additional behavioral tests. Minor deviation observed.',
      low: 'Normal variance. No action required.',
    },
    PERFORMANCE: {
      critical: 'Scale immediately. Performance degradation exceeds φ× baseline.',
      high: 'HeadyMC simulation recommended. Evaluate optimization strategies.',
      medium: 'Review resource allocation. Performance trending down.',
      low: 'Performance within phi-scaled bounds.',
    },
    MISSION: {
      critical: 'HeadySoul emergency review. Mission alignment critically compromised.',
      high: 'Schedule mission alignment workshop. Values drift detected.',
      medium: 'Note in HeadyAutobiographer. Minor mission drift.',
      low: 'Mission aligned. No concerns.',
    },
  };

  return (actions[categoryKey] || {})[severity] || 'Review and assess manually.';
}

// ═══════════════════════════════════════════════════════════
// PATTERN STORE — Fibonacci-bounded, LRU eviction
// ═══════════════════════════════════════════════════════════

class PatternStore {
  constructor(maxPatterns = MAX_PATTERNS) {
    /** @type {Map<string, Pattern>} */
    this._patterns = new Map();
    this._maxPatterns = maxPatterns;
    this._accessOrder = [];
  }

  get size() { return this._patterns.size; }

  /**
   * Add or update a pattern.
   * @param {string} id — unique pattern ID
   * @param {Pattern} pattern
   */
  set(id, pattern) {
    if (this._patterns.size >= this._maxPatterns && !this._patterns.has(id)) {
      this._evict();
    }
    this._patterns.set(id, pattern);
    this._touch(id);
  }

  /**
   * Retrieve a pattern by ID.
   * @param {string} id
   * @returns {Pattern|undefined}
   */
  get(id) {
    const p = this._patterns.get(id);
    if (p) this._touch(id);
    return p;
  }

  /**
   * Remove a pattern.
   * @param {string} id
   */
  delete(id) {
    this._patterns.delete(id);
    this._accessOrder = this._accessOrder.filter(x => x !== id);
  }

  /**
   * Return all patterns as an array.
   */
  all() {
    return Array.from(this._patterns.values());
  }

  /**
   * Find patterns matching an embedding above threshold.
   * @param {Float32Array} embedding
   * @param {number} [threshold=PATTERN_MATCH_THRESHOLD]
   * @returns {Array<{pattern: Pattern, similarity: number}>}
   */
  findMatching(embedding, threshold = PATTERN_MATCH_THRESHOLD) {
    const results = [];
    for (const pattern of this._patterns.values()) {
      if (!pattern.centroid) continue;
      const sim = cosineSimilarity(embedding, pattern.centroid);
      if (sim >= threshold) {
        results.push({ pattern, similarity: sim });
      }
    }
    return results.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Evict least-recently-used pattern with lowest importance.
   */
  _evict() {
    if (this._accessOrder.length === 0) return;

    // Score candidates: phi-weighted (importance × recency × frequency)
    let worstId = null;
    let worstScore = Infinity;

    const evictionWeights = { importance: 0.486, recency: 0.300, frequency: 0.214 };
    const now = Date.now();

    for (const id of this._accessOrder) {
      const p = this._patterns.get(id);
      if (!p) continue;

      const age = (now - p.lastSeen) / PATTERN_TTL_MS;
      const importanceScore = p.occurrences / CONFIRMATION_THRESHOLD;
      const recencyScore = Math.exp(-age * PHI);
      const frequencyScore = p.frequency || PSI_FOURTH;

      const score = (
        evictionWeights.importance * Math.min(importanceScore, 1.0) +
        evictionWeights.recency * recencyScore +
        evictionWeights.frequency * Math.min(frequencyScore, 1.0)
      );

      if (score < worstScore) {
        worstScore = score;
        worstId = id;
      }
    }

    if (worstId) {
      logger.info({
        component: 'HeadyPatterns',
        action: 'evict_pattern',
        patternId: worstId,
        score: Number(worstScore.toFixed(6)),
      });
      this.delete(worstId);
    }
  }

  _touch(id) {
    this._accessOrder = this._accessOrder.filter(x => x !== id);
    this._accessOrder.push(id);
  }

  /**
   * Prune expired patterns.
   */
  prune() {
    const now = Date.now();
    const expired = [];
    for (const [id, p] of this._patterns) {
      if (now - p.lastSeen > PATTERN_TTL_MS && p.occurrences < CONFIRMATION_THRESHOLD) {
        expired.push(id);
      }
    }
    for (const id of expired) {
      this.delete(id);
    }
    if (expired.length > 0) {
      logger.info({
        component: 'HeadyPatterns',
        action: 'prune_expired',
        count: expired.length,
        remaining: this._patterns.size,
      });
    }
    return expired.length;
  }
}

// ═══════════════════════════════════════════════════════════
// PATTERN — Individual detected pattern
// ═══════════════════════════════════════════════════════════

class Pattern {
  /**
   * @param {object} opts
   * @param {string} opts.id — unique pattern ID
   * @param {string} opts.category — drift category label
   * @param {string} opts.severity — current severity
   * @param {Float32Array} opts.centroid — 384D centroid embedding
   * @param {string} [opts.description] — human description
   */
  constructor({ id, category, severity, centroid, description = '' }) {
    this.id = id;
    this.category = category;
    this.severity = severity;
    this.centroid = centroid;
    this.description = description;
    this.occurrences = 1;
    this.firstSeen = Date.now();
    this.lastSeen = Date.now();
    this.frequency = 0; // events per decay half-life
    this.confirmed = false;
    this.escalated = false;
    this.incidents = [];
    this._recentTimestamps = [];
  }

  /**
   * Record a new occurrence.
   * @param {number} [timestamp]
   * @param {object} [incidentData]
   */
  record(timestamp = Date.now(), incidentData = null) {
    this.occurrences++;
    this.lastSeen = timestamp;
    this._recentTimestamps.push(timestamp);

    // Keep recent timestamps bounded — fib(10) = 55
    while (this._recentTimestamps.length > RECENT_EVENT_BUFFER) {
      this._recentTimestamps.shift();
    }

    // Update frequency — events in last decay half-life
    const cutoff = timestamp - DECAY_HALF_LIFE_MS;
    this._recentTimestamps = this._recentTimestamps.filter(t => t > cutoff);
    this.frequency = this._recentTimestamps.length / (DECAY_HALF_LIFE_MS / 1000);

    // Check confirmation threshold
    if (this.occurrences >= CONFIRMATION_THRESHOLD && !this.confirmed) {
      this.confirmed = true;
      logger.info({
        component: 'HeadyPatterns',
        action: 'pattern_confirmed',
        patternId: this.id,
        category: this.category,
        occurrences: this.occurrences,
      });
    }

    if (incidentData) {
      this.incidents.push({
        timestamp,
        ...incidentData,
      });
      // Keep incidents bounded — fib(8) = 21
      while (this.incidents.length > fib(8)) {
        this.incidents.shift();
      }
    }
  }

  /**
   * Update centroid with a new observation via exponential moving average.
   * @param {Float32Array} newEmbedding
   */
  updateCentroid(newEmbedding) {
    if (!this.centroid) {
      this.centroid = new Float32Array(newEmbedding);
      return;
    }
    // EMA alpha = ψ² ≈ 0.382
    const alpha = PSI_SQ;
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      this.centroid[i] = (1 - alpha) * this.centroid[i] + alpha * newEmbedding[i];
    }
    // L2 normalize
    let norm = 0;
    for (let i = 0; i < EMBEDDING_DIM; i++) norm += this.centroid[i] * this.centroid[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < EMBEDDING_DIM; i++) this.centroid[i] /= norm;
    }
  }

  /**
   * Serialize for storage/transport.
   */
  toJSON() {
    return {
      id: this.id,
      category: this.category,
      severity: this.severity,
      description: this.description,
      occurrences: this.occurrences,
      firstSeen: this.firstSeen,
      lastSeen: this.lastSeen,
      frequency: Number(this.frequency.toFixed(6)),
      confirmed: this.confirmed,
      escalated: this.escalated,
      incidentCount: this.incidents.length,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// CLUSTER ENGINE — Groups related patterns
// ═══════════════════════════════════════════════════════════

class ClusterEngine {
  constructor(maxClusters = MAX_CLUSTERS) {
    /** @type {Map<string, PatternCluster>} */
    this._clusters = new Map();
    this._maxClusters = maxClusters;
  }

  get size() { return this._clusters.size; }

  /**
   * Assign a pattern to the best matching cluster, or create a new one.
   * @param {Pattern} pattern
   * @returns {string} — cluster ID
   */
  assign(pattern) {
    if (!pattern.centroid) return null;

    // Find matching clusters
    let bestCluster = null;
    let bestSim = 0;

    for (const [id, cluster] of this._clusters) {
      const sim = cosineSimilarity(pattern.centroid, cluster.centroid);
      if (sim > bestSim) {
        bestSim = sim;
        bestCluster = cluster;
      }
    }

    if (bestCluster && bestSim >= CLUSTER_MERGE_THRESHOLD) {
      bestCluster.addPattern(pattern);
      return bestCluster.id;
    }

    // Create new cluster
    if (this._clusters.size >= this._maxClusters) {
      this._evictSmallest();
    }

    const clusterId = `cluster_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const newCluster = new PatternCluster(clusterId, pattern);
    this._clusters.set(clusterId, newCluster);

    logger.info({
      component: 'HeadyPatterns',
      action: 'new_cluster',
      clusterId,
      patternId: pattern.id,
      category: pattern.category,
    });

    return clusterId;
  }

  /**
   * Get all clusters sorted by total occurrences.
   */
  ranked() {
    return Array.from(this._clusters.values())
      .sort((a, b) => b.totalOccurrences - a.totalOccurrences);
  }

  /**
   * Attempt to merge similar clusters.
   * @returns {number} — number of merges performed
   */
  consolidate() {
    const clusterList = Array.from(this._clusters.values());
    let merges = 0;

    for (let i = 0; i < clusterList.length; i++) {
      for (let j = i + 1; j < clusterList.length; j++) {
        const sim = cosineSimilarity(clusterList[i].centroid, clusterList[j].centroid);
        if (sim >= CLUSTER_MERGE_THRESHOLD) {
          // Merge j into i
          for (const p of clusterList[j].patterns) {
            clusterList[i].addPattern(p);
          }
          this._clusters.delete(clusterList[j].id);
          merges++;
          logger.info({
            component: 'HeadyPatterns',
            action: 'merge_clusters',
            kept: clusterList[i].id,
            merged: clusterList[j].id,
            similarity: Number(sim.toFixed(6)),
          });
        }
      }
    }
    return merges;
  }

  /**
   * Evict the cluster with the fewest total occurrences.
   */
  _evictSmallest() {
    let worstId = null;
    let worstCount = Infinity;

    for (const [id, cluster] of this._clusters) {
      if (cluster.totalOccurrences < worstCount) {
        worstCount = cluster.totalOccurrences;
        worstId = id;
      }
    }

    if (worstId) {
      this._clusters.delete(worstId);
    }
  }
}

class PatternCluster {
  constructor(id, initialPattern) {
    this.id = id;
    this.patterns = [initialPattern];
    this.centroid = new Float32Array(initialPattern.centroid);
    this.totalOccurrences = initialPattern.occurrences;
    this.dominantCategory = initialPattern.category;
    this.created = Date.now();
  }

  addPattern(pattern) {
    this.patterns.push(pattern);
    this.totalOccurrences += pattern.occurrences;

    // Recompute centroid as mean of all pattern centroids
    const dim = this.centroid.length;
    this.centroid.fill(0);
    for (const p of this.patterns) {
      if (!p.centroid) continue;
      for (let i = 0; i < dim; i++) {
        this.centroid[i] += p.centroid[i];
      }
    }
    // Normalize
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += this.centroid[i] * this.centroid[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < dim; i++) this.centroid[i] /= norm;
    }

    // Update dominant category
    const catCounts = {};
    for (const p of this.patterns) {
      catCounts[p.category] = (catCounts[p.category] || 0) + p.occurrences;
    }
    this.dominantCategory = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  toJSON() {
    return {
      id: this.id,
      patternCount: this.patterns.length,
      totalOccurrences: this.totalOccurrences,
      dominantCategory: this.dominantCategory,
      created: this.created,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// RECURRING ISSUE DETECTOR
// ═══════════════════════════════════════════════════════════

class RecurringIssueDetector {
  /**
   * @param {PatternStore} store
   * @param {ClusterEngine} clusters
   */
  constructor(store, clusters) {
    this._store = store;
    this._clusters = clusters;
    this._escalationCallbacks = [];
  }

  /**
   * Register a callback for when a pattern escalates.
   * @param {function} callback — (pattern, cluster) => void
   */
  onEscalation(callback) {
    this._escalationCallbacks.push(callback);
  }

  /**
   * Process a new drift event, updating patterns and detecting recurrence.
   *
   * @param {object} event — { embedding, source, timestamp, metadata }
   * @param {Float32Array} referenceEmbedding
   * @returns {object} — { classification, pattern, cluster, isRecurring, isEscalation }
   */
  process(event, referenceEmbedding) {
    const classification = classifyDrift(event, referenceEmbedding, event.metadata);

    // Find matching existing pattern
    const matches = this._store.findMatching(event.embedding, PATTERN_MATCH_THRESHOLD);
    let pattern;
    let isRecurring = false;
    let isEscalation = false;

    if (matches.length > 0) {
      // Update existing pattern
      pattern = matches[0].pattern;
      pattern.record(event.timestamp || Date.now(), {
        source: event.source,
        severity: classification.severity,
        similarity: classification.similarity,
      });
      pattern.updateCentroid(event.embedding);
      isRecurring = pattern.confirmed;

      // Check for escalation
      if (pattern.confirmed && !pattern.escalated && pattern.frequency > PSI) {
        pattern.escalated = true;
        isEscalation = true;
        this._fireEscalation(pattern);
      }
    } else {
      // Create new pattern
      const patternId = `pattern_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      pattern = new Pattern({
        id: patternId,
        category: classification.category.label,
        severity: classification.severity,
        centroid: event.embedding,
        description: `${classification.category.description} detected from ${event.source}`,
      });
      this._store.set(patternId, pattern);
    }

    // Assign to cluster
    const clusterId = this._clusters.assign(pattern);

    return {
      classification,
      pattern: pattern.toJSON(),
      clusterId,
      isRecurring,
      isEscalation,
    };
  }

  /**
   * Fire escalation callbacks.
   */
  _fireEscalation(pattern) {
    const cluster = this._findPatternCluster(pattern);

    logger.info({
      component: 'HeadyPatterns',
      action: 'escalation_triggered',
      patternId: pattern.id,
      category: pattern.category,
      occurrences: pattern.occurrences,
      frequency: Number(pattern.frequency.toFixed(6)),
    });

    for (const cb of this._escalationCallbacks) {
      try {
        cb(pattern, cluster);
      } catch (err) {
        logger.error({
          component: 'HeadyPatterns',
          action: 'escalation_callback_error',
          error: err.message,
        });
      }
    }
  }

  _findPatternCluster(pattern) {
    for (const cluster of this._clusters.ranked()) {
      if (cluster.patterns.includes(pattern)) return cluster;
    }
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// TREND ANALYZER — Time-series analysis with sliding windows
// ═══════════════════════════════════════════════════════════

class TrendAnalyzer {
  constructor() {
    /** @type {Array<{timestamp: number, severity: string, category: string}>} */
    this._events = [];
    this._maxEvents = fib(16); // 987
  }

  /**
   * Record a classified drift event.
   */
  record(classification) {
    this._events.push({
      timestamp: classification.timestamp || Date.now(),
      severity: classification.severity,
      category: classification.category.label || classification.category,
      similarity: classification.similarity,
    });

    while (this._events.length > this._maxEvents) {
      this._events.shift();
    }
  }

  /**
   * Compute a trend report over a time window.
   * @param {number} windowMs — time window in ms (default: DECAY_HALF_LIFE_MS)
   * @returns {object} — trend summary
   */
  analyze(windowMs = DECAY_HALF_LIFE_MS) {
    const now = Date.now();
    const cutoff = now - windowMs;
    const recent = this._events.filter(e => e.timestamp > cutoff);

    if (recent.length === 0) {
      return { trend: 'stable', eventCount: 0, categories: {}, severities: {} };
    }

    // Category distribution
    const categories = {};
    for (const e of recent) {
      categories[e.category] = (categories[e.category] || 0) + 1;
    }

    // Severity distribution
    const severities = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const e of recent) {
      severities[e.severity] = (severities[e.severity] || 0) + 1;
    }

    // Trend direction — compare first half vs second half
    const midpoint = cutoff + windowMs / 2;
    const firstHalf = recent.filter(e => e.timestamp <= midpoint).length;
    const secondHalf = recent.filter(e => e.timestamp > midpoint).length;

    let trend = 'stable';
    if (secondHalf > firstHalf * PHI) trend = 'worsening';
    else if (firstHalf > secondHalf * PHI) trend = 'improving';

    // Average similarity
    const avgSimilarity = recent.reduce((sum, e) => sum + (e.similarity || 0), 0) / recent.length;

    return {
      trend,
      eventCount: recent.length,
      categories,
      severities,
      averageSimilarity: Number(avgSimilarity.toFixed(6)),
      firstHalfCount: firstHalf,
      secondHalfCount: secondHalf,
      windowMs,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// HEADY PATTERNS ENGINE — Main orchestrator
// ═══════════════════════════════════════════════════════════

class HeadyPatternsEngine {
  constructor() {
    this._store = new PatternStore(MAX_PATTERNS);
    this._clusters = new ClusterEngine(MAX_CLUSTERS);
    this._detector = new RecurringIssueDetector(this._store, this._clusters);
    this._trends = new TrendAnalyzer();
    this._pruneInterval = null;
    this._consolidateInterval = null;
    this._started = false;
  }

  /**
   * Start the pattern engine with periodic maintenance.
   */
  start() {
    if (this._started) return;
    this._started = true;

    // Prune every fib(13) × 1000 ms ≈ 3.88 min
    this._pruneInterval = setInterval(() => {
      this._store.prune();
    }, fib(13) * 1000);

    // Consolidate clusters every fib(14) × 1000 ms ≈ 6.28 min
    this._consolidateInterval = setInterval(() => {
      const merges = this._clusters.consolidate();
      if (merges > 0) {
        logger.info({
          component: 'HeadyPatterns',
          action: 'periodic_consolidation',
          merges,
          clusterCount: this._clusters.size,
        });
      }
    }, fib(14) * 1000);

    logger.info({
      component: 'HeadyPatterns',
      action: 'engine_started',
      maxPatterns: MAX_PATTERNS,
      maxClusters: MAX_CLUSTERS,
      pruneIntervalMs: fib(13) * 1000,
      consolidateIntervalMs: fib(14) * 1000,
    });
  }

  /**
   * Stop the pattern engine.
   */
  stop() {
    if (!this._started) return;
    this._started = false;
    if (this._pruneInterval) clearInterval(this._pruneInterval);
    if (this._consolidateInterval) clearInterval(this._consolidateInterval);
    logger.info({ component: 'HeadyPatterns', action: 'engine_stopped' });
  }

  /**
   * Process a new drift event end-to-end.
   *
   * @param {object} event — { embedding, source, timestamp, metadata }
   * @param {Float32Array} referenceEmbedding — healthy reference vector
   * @returns {object} — full result including classification, pattern, trend
   */
  processDriftEvent(event, referenceEmbedding) {
    const result = this._detector.process(event, referenceEmbedding);
    this._trends.record(result.classification);
    return result;
  }

  /**
   * Get current trend analysis.
   * @param {number} [windowMs]
   */
  getTrend(windowMs) {
    return this._trends.analyze(windowMs);
  }

  /**
   * Get all confirmed patterns.
   */
  getConfirmedPatterns() {
    return this._store.all()
      .filter(p => p.confirmed)
      .map(p => p.toJSON());
  }

  /**
   * Get ranked clusters.
   */
  getRankedClusters() {
    return this._clusters.ranked().map(c => c.toJSON());
  }

  /**
   * Register an escalation callback.
   */
  onEscalation(callback) {
    this._detector.onEscalation(callback);
  }

  /**
   * Get engine status for health checks.
   */
  status() {
    return {
      started: this._started,
      patternCount: this._store.size,
      confirmedPatterns: this._store.all().filter(p => p.confirmed).length,
      clusterCount: this._clusters.size,
      trend: this._trends.analyze(),
    };
  }
}

// ═══════════════════════════════════════════════════════════
// UTILITY — Cosine similarity for 384D vectors
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

const healthCheck = createHealthCheck('heady-patterns', () => {
  const engine = getSharedEngine();
  return engine.status();
});

// ═══════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════

let _sharedEngine = null;

function getSharedEngine() {
  if (!_sharedEngine) {
    _sharedEngine = new HeadyPatternsEngine();
  }
  return _sharedEngine;
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  // Core classifier
  classifyDrift,
  DRIFT_CATEGORIES,

  // Pattern management
  Pattern,
  PatternStore,

  // Clustering
  PatternCluster,
  ClusterEngine,

  // Recurrence detection
  RecurringIssueDetector,

  // Trend analysis
  TrendAnalyzer,

  // Main engine
  HeadyPatternsEngine,
  getSharedEngine,

  // Health
  healthCheck,

  // Constants (for testing)
  MAX_PATTERNS,
  SLIDING_WINDOW_BUCKETS,
  CONFIRMATION_THRESHOLD,
  DRIFT_THRESHOLD,
  PATTERN_MATCH_THRESHOLD,
  RECURRENCE_ESCALATION_THRESHOLD,
  PATTERN_TTL_MS,
  CLUSTER_MERGE_THRESHOLD,
  DECAY_HALF_LIFE_MS,

  // Utility
  cosineSimilarity,
};
