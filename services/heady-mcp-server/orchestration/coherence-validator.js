/**
 * @fileoverview Coherence Validator — System-Wide Sacred Geometry Health Assessment
 * @description Validates all connections, verifies /health endpoints, checks CSL scores
 * across all components, and produces a Sacred Geometry coherence map.
 * @module coherence-validator
 */

'use strict';

const {
  PHI, PSI, PHI_SQUARED, PHI_CUBED, FIB, CSL, CSL_ERROR_CODES,
  SACRED_GEOMETRY, INTERVALS, FUSION_WEIGHTS,
  phiDecay, correlationId, structuredLog,
} = require('./phi-constants');

// ─── COHERENCE LEVELS ────────────────────────────────────────────────────────

/**
 * @constant {Object} COHERENCE_LEVELS - Human-readable coherence classifications
 */
const COHERENCE_LEVELS = {
  PERFECT:   { min: CSL.DEDUP,     label: 'Perfect',    color: '#00ff88' },
  EXCELLENT: { min: CSL.CRITICAL,  label: 'Excellent',  color: '#00cc66' },
  GOOD:      { min: CSL.HIGH,      label: 'Good',       color: '#88cc00' },
  ADEQUATE:  { min: CSL.MEDIUM,    label: 'Adequate',   color: '#cccc00' },
  DEGRADED:  { min: CSL.LOW,       label: 'Degraded',   color: '#cc8800' },
  POOR:      { min: CSL.MINIMUM,   label: 'Poor',       color: '#cc4400' },
  CRITICAL:  { min: 0,             label: 'Critical',   color: '#cc0000' },
};

/**
 * Classify a coherence score
 * @param {number} score
 * @returns {Object} Level classification
 */
function classifyCoherence(score) {
  for (const [key, level] of Object.entries(COHERENCE_LEVELS)) {
    if (score >= level.min) return { key, ...level, score };
  }
  return { key: 'CRITICAL', ...COHERENCE_LEVELS.CRITICAL, score };
}

// ─── RING VALIDATOR ──────────────────────────────────────────────────────────

/**
 * @class RingValidator
 * @description Validates a single Sacred Geometry ring's health
 */
class RingValidator {
  /**
   * @param {string} ringName - Ring key from SACRED_GEOMETRY
   * @param {Object} ringConfig - Ring configuration
   */
  constructor(ringName, ringConfig) {
    this.ringName = ringName;
    this.config = ringConfig;
    this.nodeResults = new Map();
  }

  /**
   * Record a node's health check result
   * @param {string} nodeName
   * @param {Object} healthResult
   */
  recordNodeHealth(nodeName, healthResult) {
    this.nodeResults.set(nodeName, {
      ...healthResult,
      checkedAt: Date.now(),
    });
  }

  /**
   * Compute ring coherence
   * @returns {Object} Ring health report
   */
  computeCoherence() {
    const expectedNodes = this.config.nodes;
    const reportedNodes = Array.from(this.nodeResults.keys());
    const missingNodes = expectedNodes.filter(n => !this.nodeResults.has(n));
    const extraNodes = reportedNodes.filter(n => !expectedNodes.includes(n));

    // Compute weighted average coherence
    let totalCoherence = 0;
    let totalWeight = 0;
    for (const [nodeName, result] of this.nodeResults.entries()) {
      const nodeCoherence = result.coherence != null ? result.coherence : 0;
      const weight = result.status === 'healthy' ? PHI : PSI;
      totalCoherence += nodeCoherence * weight;
      totalWeight += weight;
    }

    // Penalize missing nodes
    const missingPenalty = missingNodes.length * PSI / Math.max(expectedNodes.length, 1);
    const rawCoherence = totalWeight > 0 ? totalCoherence / totalWeight : 0;
    const coherence = Math.max(0, rawCoherence - missingPenalty);

    return {
      ring: this.ringName,
      label: this.config.label,
      order: this.config.order,
      weight: this.config.weight,
      coherence: parseFloat(coherence.toFixed(FIB[4])),
      classification: classifyCoherence(coherence),
      expectedNodes: expectedNodes.length,
      reportedNodes: reportedNodes.length,
      missingNodes,
      extraNodes,
      nodeDetails: Object.fromEntries(this.nodeResults),
    };
  }
}

// ─── CONNECTION VALIDATOR ────────────────────────────────────────────────────

/**
 * @class ConnectionValidator
 * @description Validates inter-service connections and wiring integrity
 */
class ConnectionValidator {
  constructor() {
    /** @private {Array} */
    this._issues = [];
    /** @private {Map<string, Object>} */
    this._connections = new Map();
  }

  /**
   * Register a connection for validation
   * @param {string} from - Source service
   * @param {string} to - Target service
   * @param {string} type - Connection type (event, rpc, dependency)
   * @param {Object} [metadata={}]
   */
  registerConnection(from, to, type, metadata = {}) {
    const key = `${from}→${to}`;
    this._connections.set(key, { from, to, type, metadata, validated: false });
  }

  /**
   * Validate all registered connections
   * @param {Set<string>} knownServices - Set of known service IDs
   * @returns {Object} Validation report
   */
  validate(knownServices) {
    this._issues = [];
    let validCount = 0;
    let invalidCount = 0;

    for (const [key, conn] of this._connections.entries()) {
      const issues = [];

      // Check endpoints exist
      if (!knownServices.has(conn.from)) {
        issues.push({ type: 'orphaned_source', message: `Source '${conn.from}' not registered` });
      }
      if (!knownServices.has(conn.to)) {
        issues.push({ type: 'orphaned_target', message: `Target '${conn.to}' not registered` });
      }

      // Check self-loops
      if (conn.from === conn.to) {
        issues.push({ type: 'self_loop', message: `Self-loop detected on '${conn.from}'` });
      }

      conn.validated = true;
      conn.issues = issues;
      if (issues.length === 0) {
        validCount++;
      } else {
        invalidCount++;
        this._issues.push(...issues.map(i => ({ ...i, connection: key })));
      }
    }

    const totalConnections = this._connections.size;
    const coherence = totalConnections > 0 ? validCount / totalConnections : 1;

    return {
      totalConnections,
      valid: validCount,
      invalid: invalidCount,
      coherence: parseFloat(coherence.toFixed(FIB[4])),
      issues: this._issues,
    };
  }
}

// ─── COHERENCE VALIDATOR ─────────────────────────────────────────────────────

/**
 * @class CoherenceValidator
 * @description System-wide coherence validation producing Sacred Geometry health maps
 */
class CoherenceValidator {
  /**
   * @param {Object} [config={}]
   * @param {Object} [config.serviceMesh] - ServiceMesh instance
   * @param {Object} [config.eventBus] - LiquidEventBus instance
   * @param {Object} [config.conductor] - ConductorV2 instance
   */
  constructor(config = {}) {
    /** @private */
    this._serviceMesh = config.serviceMesh || null;
    this._eventBus = config.eventBus || null;
    this._conductor = config.conductor || null;

    /** @private */
    this._corrId = correlationId('coh');
    this._running = false;
    this._scanTimer = null;
    this._lastReport = null;

    /** @private */
    this._connectionValidator = new ConnectionValidator();

    /** @private */
    this._stats = {
      scansCompleted: 0,
      issuesDetected: 0,
      lastScanDuration: 0,
    };
  }

  /**
   * Start periodic coherence scanning
   * @returns {Promise<void>}
   */
  async start() {
    if (this._running) return;
    this._running = true;
    this._scanTimer = setInterval(() => this.scan(), INTERVALS.COHERENCE_SCAN);
    await this.scan(); // Initial scan
  }

  /**
   * Stop scanning
   * @returns {Promise<void>}
   */
  async stop() {
    this._running = false;
    if (this._scanTimer) {
      clearInterval(this._scanTimer);
      this._scanTimer = null;
    }
  }

  /**
   * Register a connection for validation
   * @param {string} from
   * @param {string} to
   * @param {string} type
   * @param {Object} [metadata={}]
   */
  registerConnection(from, to, type, metadata = {}) {
    this._connectionValidator.registerConnection(from, to, type, metadata);
  }

  /**
   * Run a full coherence scan
   * @returns {Object} Complete coherence report
   */
  async scan() {
    const scanStart = Date.now();
    const scanId = correlationId('scan');

    // ── Step 1: Validate each Sacred Geometry ring ──
    const ringReports = {};
    for (const [ringKey, ringConfig] of Object.entries(SACRED_GEOMETRY)) {
      const validator = new RingValidator(ringKey, ringConfig);

      for (const nodeName of ringConfig.nodes) {
        // Try to get health from service mesh
        let healthResult = { status: 'unknown', coherence: 0 };
        if (this._serviceMesh) {
          const service = this._serviceMesh.getService(nodeName);
          if (service) {
            healthResult = { status: service.status, coherence: service.coherence };
          }
        }
        validator.recordNodeHealth(nodeName, healthResult);
      }

      ringReports[ringKey] = validator.computeCoherence();
    }

    // ── Step 2: Validate connections ──
    const knownServices = new Set();
    if (this._serviceMesh) {
      for (const svc of this._serviceMesh.getServices()) {
        knownServices.add(svc.id);
      }
    }
    const connectionReport = this._connectionValidator.validate(knownServices);

    // ── Step 3: Component health aggregation ──
    const componentHealth = {};
    if (this._eventBus) {
      componentHealth.eventBus = this._eventBus.health();
    }
    if (this._serviceMesh) {
      componentHealth.serviceMesh = this._serviceMesh.health();
    }
    if (this._conductor) {
      componentHealth.conductor = this._conductor.health();
    }

    // ── Step 4: Compute global coherence ──
    const ringCoherences = Object.values(ringReports).map(r => ({
      coherence: r.coherence,
      weight: r.weight,
    }));

    let weightedSum = 0;
    let weightTotal = 0;
    for (const rc of ringCoherences) {
      weightedSum += rc.coherence * rc.weight;
      weightTotal += rc.weight;
    }

    // Factor in connection coherence
    const connectionWeight = PSI;
    weightedSum += connectionReport.coherence * connectionWeight;
    weightTotal += connectionWeight;

    const globalCoherence = weightTotal > 0 ? weightedSum / weightTotal : 0;

    // ── Step 5: Generate Sacred Geometry map ──
    const geometryMap = this._generateGeometryMap(ringReports, globalCoherence);

    // ── Step 6: Detect issues ──
    const issues = [];
    for (const ring of Object.values(ringReports)) {
      if (ring.missingNodes.length > 0) {
        issues.push({
          severity: 'warning',
          ring: ring.ring,
          type: 'missing_nodes',
          nodes: ring.missingNodes,
        });
      }
      if (ring.coherence < CSL.LOW) {
        issues.push({
          severity: 'error',
          ring: ring.ring,
          type: 'low_ring_coherence',
          coherence: ring.coherence,
        });
      }
    }
    issues.push(...connectionReport.issues.map(i => ({
      severity: 'warning',
      type: i.type,
      message: i.message,
      connection: i.connection,
    })));

    const scanDuration = Date.now() - scanStart;
    this._stats.scansCompleted++;
    this._stats.issuesDetected = issues.length;
    this._stats.lastScanDuration = scanDuration;

    // Build final report
    this._lastReport = {
      scanId,
      timestamp: new Date().toISOString(),
      globalCoherence: parseFloat(globalCoherence.toFixed(FIB[4])),
      classification: classifyCoherence(globalCoherence),
      rings: ringReports,
      connections: connectionReport,
      components: componentHealth,
      geometryMap,
      issues,
      scanDuration,
      phi: PHI,
    };

    // Publish scan results via event bus
    if (this._eventBus) {
      this._eventBus.publish('health', 'coherence.scan.complete', {
        scanId,
        globalCoherence: this._lastReport.globalCoherence,
        issueCount: issues.length,
      }, { correlationId: scanId, source: 'CoherenceValidator' });
    }

    return this._lastReport;
  }

  /**
   * Generate ASCII Sacred Geometry coherence map
   * @private
   */
  _generateGeometryMap(ringReports, globalCoherence) {
    const ringStatus = (key) => {
      const r = ringReports[key];
      if (!r) return '?';
      if (r.coherence >= CSL.HIGH) return '+';
      if (r.coherence >= CSL.MEDIUM) return '~';
      if (r.coherence >= CSL.LOW) return '-';
      return '!';
    };

    return {
      global: parseFloat(globalCoherence.toFixed(FIB[4])),
      rings: {
        CENTER:      { symbol: ringStatus('CENTER'),     coherence: ringReports.CENTER?.coherence || 0 },
        INNER_RING:  { symbol: ringStatus('INNER_RING'), coherence: ringReports.INNER_RING?.coherence || 0 },
        MIDDLE_RING: { symbol: ringStatus('MIDDLE_RING'),coherence: ringReports.MIDDLE_RING?.coherence || 0 },
        OUTER_RING:  { symbol: ringStatus('OUTER_RING'), coherence: ringReports.OUTER_RING?.coherence || 0 },
        GOVERNANCE:  { symbol: ringStatus('GOVERNANCE'), coherence: ringReports.GOVERNANCE?.coherence || 0 },
      },
      legend: { '+': '>= HIGH', '~': '>= MEDIUM', '-': '>= LOW', '!': '< LOW', '?': 'unknown' },
    };
  }

  /**
   * Get the last scan report
   * @returns {Object|null}
   */
  getLastReport() {
    return this._lastReport;
  }

  /**
   * Get health status
   * @returns {Object}
   */
  health() {
    const coherence = this._lastReport
      ? this._lastReport.globalCoherence
      : CSL.MINIMUM;

    return {
      status: this._running ? 'healthy' : 'stopped',
      coherence: parseFloat(coherence.toFixed(FIB[4])),
      running: this._running,
      scansCompleted: this._stats.scansCompleted,
      lastScanDuration: this._stats.lastScanDuration,
      issuesDetected: this._stats.issuesDetected,
      phi: PHI,
    };
  }
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

module.exports = {
  CoherenceValidator,
  RingValidator,
  ConnectionValidator,
  COHERENCE_LEVELS,
  classifyCoherence,
};
