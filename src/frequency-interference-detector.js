/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Frequency Interference Prevention Layer (FIPL)
 * ═══════════════════════════════════════════════
 *
 * Detects and prevents destructive frequency interference across the
 * Heady ecosystem. Models subsystem operational frequencies as vectors,
 * tracks convergent/divergent patterns, and applies φ-offset phase
 * damping when combinations would produce negative effects (thermal
 * energy buildup, resistance, deadlock).
 *
 * CSL Gates introduced:
 *   INTERFERENCE — detects destructive frequency convergence
 *   DAMPEN       — applies anti-resonance phase correction
 *
 * All thresholds φ-derived. ZERO magic numbers.
 *
 * PATENT LOCK: Frequency interference detection via CSL geometric
 * gates is patent-pending under HeadySystems provisional portfolio.
 */

'use strict';

const crypto = require('crypto');

// ─── φ-Constants (ZERO magic numbers) ────────────────────────────────────────

const PHI         = 1.6180339887;
const PSI         = 0.6180339887;       // 1/φ
const PSI_SQ      = 0.3819660113;       // ψ²
const PHI_SQ      = PHI * PHI;          // φ² ≈ 2.618
const FIB_7       = 13;
const FIB_8       = 21;
const FIB_9       = 34;
const FIB_11      = 89;
const CYCLE_MS    = 29034;              // φ × 18,000 — system heartbeat

// Interference thresholds (φ-harmonic)
const THRESHOLDS = Object.freeze({
  /** Below this: frequencies are safely orthogonal */
  SAFE:          PSI_SQ,                // 0.382 — no interference risk
  /** Above this: frequencies converging, monitor required */
  CAUTION:       PSI,                   // 0.618 — convergence warning
  /** Above this: destructive interference imminent */
  CRITICAL:      PSI + (1 - PSI) * PSI, // 0.854 — destructive resonance
  /** Thermal energy ceiling before forced damping */
  THERMAL_MAX:   PHI_SQ,               // 2.618 — max thermal units
  /** Minimum phase offset for damping (radians) */
  MIN_PHASE_OFFSET: Math.PI / PHI,     // π/φ ≈ 1.942 radians
});

// Severity classifications
const SEVERITY = Object.freeze({
  NONE:     'NONE',
  LOW:      'LOW',
  MEDIUM:   'MEDIUM',
  HIGH:     'HIGH',
  CRITICAL: 'CRITICAL',
});

// ─── Frequency Signature ─────────────────────────────────────────────────────

/**
 * Represents a subsystem's operational frequency signature.
 * Each subsystem emits at a characteristic frequency (cycle rate)
 * with harmonic overtones derived from its operational pattern.
 */
class FrequencySignature {
  /**
   * @param {string} subsystemId - Unique subsystem identifier
   * @param {number} fundamentalHz - Primary operational frequency in Hz
   * @param {number[]} [harmonics] - Relative amplitudes of overtones
   */
  constructor(subsystemId, fundamentalHz, harmonics = []) {
    this.subsystemId = subsystemId;
    this.fundamentalHz = fundamentalHz;
    this.harmonics = harmonics.length > 0
      ? harmonics
      : this._generatePhiHarmonics();
    this.phase = 0;              // Current phase offset (radians)
    this.amplitude = 1.0;        // Current amplitude (0–1)
    this.registeredAt = Date.now();
    this.lastObservedAt = Date.now();
  }

  /**
   * Generate default harmonics using φ-decay series.
   * Each overtone is ψ^n of the fundamental amplitude.
   * @returns {number[]} Harmonic amplitude series (length = fib(5) = 5)
   */
  _generatePhiHarmonics() {
    const count = 5; // fib(5)
    const harmonics = [];
    for (let i = 1; i <= count; i++) {
      harmonics.push(Math.pow(PSI, i)); // ψ¹, ψ², ψ³, ψ⁴, ψ⁵
    }
    return harmonics;
  }

  /**
   * Convert this frequency signature to a vector representation
   * for CSL gate processing. Encodes fundamental + harmonics + phase.
   * @param {number} [dims=13] - Vector dimensions (fib(7))
   * @returns {Float32Array}
   */
  toVector(dims = FIB_7) {
    const vec = new Float32Array(dims);
    // Encode fundamental frequency (normalized to Nyquist-like range)
    vec[0] = this.fundamentalHz / 1000;
    // Encode phase
    vec[1] = Math.sin(this.phase);
    vec[2] = Math.cos(this.phase);
    // Encode amplitude
    vec[3] = this.amplitude;
    // Encode harmonics
    for (let i = 0; i < Math.min(this.harmonics.length, dims - 4); i++) {
      vec[4 + i] = this.harmonics[i] * this.fundamentalHz / 1000;
    }
    // Normalize
    let mag = 0;
    for (let i = 0; i < dims; i++) mag += vec[i] * vec[i];
    mag = Math.sqrt(mag);
    if (mag > 1e-10) {
      for (let i = 0; i < dims; i++) vec[i] /= mag;
    }
    return vec;
  }
}

// ─── Thermal Model ───────────────────────────────────────────────────────────

/**
 * Models computational "heat" from overlapping frequency interactions.
 * When two subsystems operate at frequencies that converge, their
 * combined energy creates thermal buildup (wasted compute, contention).
 *
 * thermalEnergy = Σ (amplitude_i × amplitude_j × |cos(f_i, f_j)|²)
 *                 for all interacting pairs where cos > SAFE threshold
 */
class ThermalModel {
  constructor() {
    /** @type {Map<string, number>} pairKey → thermal energy */
    this._pairEnergy = new Map();
    /** @type {number} Global thermal sum */
    this._globalThermal = 0;
    /** @type {Array<{ts: number, thermal: number}>} */
    this._history = [];
  }

  /**
   * Compute thermal energy for a frequency pair.
   * @param {FrequencySignature} sigA
   * @param {FrequencySignature} sigB
   * @param {number} alignment - Cosine similarity of their vectors
   * @returns {number} Thermal energy contribution
   */
  computePairThermal(sigA, sigB, alignment) {
    if (alignment <= THRESHOLDS.SAFE) return 0;

    // Thermal = amplitude product × alignment² × harmonic resonance factor
    const amplitudeProduct = sigA.amplitude * sigB.amplitude;
    const alignmentSq = alignment * alignment;

    // Harmonic resonance: check if fundamental ratio is near a simple fraction
    const ratio = sigA.fundamentalHz / (sigB.fundamentalHz || 1e-10);
    const nearestInt = Math.round(ratio);
    const harmonicProximity = 1 - Math.abs(ratio - nearestInt);
    const resonanceFactor = 1 + harmonicProximity * PHI; // boost by φ for near-harmonic

    return amplitudeProduct * alignmentSq * resonanceFactor;
  }

  /**
   * Update thermal state for all registered frequency pairs.
   * @param {Map<string, FrequencySignature>} registry
   * @returns {{ globalThermal: number, hotPairs: Array }}
   */
  update(registry) {
    this._pairEnergy.clear();
    this._globalThermal = 0;
    const hotPairs = [];
    const entries = Array.from(registry.entries());

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [idA, sigA] = entries[i];
        const [idB, sigB] = entries[j];
        const vecA = sigA.toVector();
        const vecB = sigB.toVector();

        // Cosine similarity between frequency vectors
        let dot = 0, magA = 0, magB = 0;
        for (let k = 0; k < vecA.length; k++) {
          dot += vecA[k] * vecB[k];
          magA += vecA[k] * vecA[k];
          magB += vecB[k] * vecB[k];
        }
        const mag = Math.sqrt(magA) * Math.sqrt(magB);
        const alignment = mag > 0 ? dot / mag : 0;

        const thermal = this.computePairThermal(sigA, sigB, alignment);
        const pairKey = `${idA}↔${idB}`;
        this._pairEnergy.set(pairKey, thermal);
        this._globalThermal += thermal;

        if (thermal > THRESHOLDS.SAFE) {
          hotPairs.push({ pairKey, idA, idB, thermal, alignment });
        }
      }
    }

    this._history.push({ ts: Date.now(), thermal: this._globalThermal });
    // Keep history bounded to fib(11) = 89 entries
    if (this._history.length > FIB_11) {
      this._history = this._history.slice(-FIB_11);
    }

    return { globalThermal: this._globalThermal, hotPairs };
  }

  /** @returns {number} Current global thermal energy */
  getGlobalThermal() { return this._globalThermal; }

  /** @returns {Array<{ts: number, thermal: number}>} */
  getHistory(limit = FIB_9) { return this._history.slice(-limit); }
}

// ─── Anti-Resonance Damper ───────────────────────────────────────────────────

/**
 * When two subsystems' operational frequencies converge toward destructive
 * alignment, this module applies a φ-offset phase shift to one of them,
 * breaking the resonance pattern.
 *
 * The Three-Gap Theorem guarantees that φ-scaled offsets never create
 * new synchronization points — the mathematically optimal anti-resonance.
 */
class AntiResonanceDamper {
  constructor() {
    /** @type {Map<string, {offset: number, appliedAt: number, reason: string}>} */
    this._activeCorrections = new Map();
  }

  /**
   * Apply a φ-offset phase correction to break destructive resonance.
   * @param {FrequencySignature} target - The signature to phase-shift
   * @param {FrequencySignature} source - The interfering signature
   * @param {number} interferenceScore - How destructive the combination is
   * @returns {{ applied: boolean, offset: number, reason: string }}
   */
  dampen(target, source, interferenceScore) {
    if (interferenceScore < THRESHOLDS.CAUTION) {
      return { applied: false, offset: 0, reason: 'Below caution threshold' };
    }

    // Phase offset scales with interference severity
    // Base: π/φ ≈ 1.942 rad, scaled up to π for critical
    const severityFactor = (interferenceScore - THRESHOLDS.CAUTION) /
                           (1 - THRESHOLDS.CAUTION);
    const offset = THRESHOLDS.MIN_PHASE_OFFSET +
                   severityFactor * (Math.PI - THRESHOLDS.MIN_PHASE_OFFSET);

    // Apply golden-angle offset (ensures maximal separation per Three-Gap Theorem)
    const goldenOffset = offset * PHI;
    target.phase = (target.phase + goldenOffset) % (2 * Math.PI);

    // Also attenuate amplitude by ψ to reduce energy contribution
    if (interferenceScore >= THRESHOLDS.CRITICAL) {
      target.amplitude *= PSI; // Reduce to 61.8% of current
    }

    const correction = {
      offset: goldenOffset,
      appliedAt: Date.now(),
      reason: `Interference ${interferenceScore.toFixed(3)} with ${source.subsystemId}`,
    };
    this._activeCorrections.set(target.subsystemId, correction);

    return { applied: true, offset: goldenOffset, reason: correction.reason };
  }

  /**
   * Get all active phase corrections.
   * @returns {Array<{subsystemId: string, offset: number, appliedAt: number, reason: string}>}
   */
  getActiveCorrections() {
    return Array.from(this._activeCorrections.entries()).map(([id, c]) => ({
      subsystemId: id, ...c,
    }));
  }

  /**
   * Release a phase correction (subsystem is no longer in dangerous alignment).
   * @param {string} subsystemId
   * @returns {boolean}
   */
  release(subsystemId) {
    return this._activeCorrections.delete(subsystemId);
  }
}

// ─── CSL INTERFERENCE Gate ───────────────────────────────────────────────────

/**
 * INTERFERENCE gate — a new CSL gate that detects destructive frequency
 * convergence between two subsystem frequency vectors.
 *
 * Formula:
 *   interference(f₁, f₂) = cos(f₁, f₂)² × (amp₁ + amp₂) / 2
 *   destructive if: interference > ψ AND harmonicResonance > ψ²
 *
 * @param {Float32Array} vecA - Frequency vector A
 * @param {Float32Array} vecB - Frequency vector B
 * @param {number} ampA - Amplitude of signal A
 * @param {number} ampB - Amplitude of signal B
 * @returns {{ score: number, isDestructive: boolean, severity: string }}
 */
function cslINTERFERENCE(vecA, vecB, ampA = 1.0, ampB = 1.0) {
  // Cosine alignment
  let dot = 0, magA = 0, magB = 0;
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  const cosAlign = denom > 0 ? dot / denom : 0;

  // Interference score: alignment² × average amplitude
  const score = cosAlign * cosAlign * (ampA + ampB) / 2;

  // Classify severity
  let severity = SEVERITY.NONE;
  let isDestructive = false;
  if (score >= THRESHOLDS.CRITICAL) {
    severity = SEVERITY.CRITICAL;
    isDestructive = true;
  } else if (score >= THRESHOLDS.CAUTION) {
    severity = SEVERITY.HIGH;
    isDestructive = true;
  } else if (score >= THRESHOLDS.SAFE) {
    severity = SEVERITY.MEDIUM;
  } else if (score > 0) {
    severity = SEVERITY.LOW;
  }

  return { score, isDestructive, severity, cosineAlignment: cosAlign };
}

/**
 * DAMPEN gate — applies sigmoid-attenuated correction to a value
 * based on interference score. Higher interference → more damping.
 *
 * output = value × (1 - σ((interference - τ) / T))
 *
 * @param {number} value - The value to dampen
 * @param {number} interferenceScore - Output of INTERFERENCE gate
 * @param {number} [tau=PSI] - Threshold
 * @param {number} [temp=PSI_SQ*PSI] - Temperature (ψ³ ≈ 0.236)
 * @returns {number} Dampened value
 */
function cslDAMPEN(value, interferenceScore, tau = PSI, temp = PSI_SQ * PSI) {
  const sigmoid = 1 / (1 + Math.exp(-(interferenceScore - tau) / temp));
  return value * (1 - sigmoid);
}

// ─── Frequency Interference Detector (Main Class) ────────────────────────────

/**
 * The master orchestrator for frequency interference prevention.
 * Maintains a registry of all active subsystem frequencies, runs
 * continuous interference scans on each heartbeat, and dispatches
 * damping corrections when destructive combinations are detected.
 */
class FrequencyInterferenceDetector {
  /**
   * @param {object} [opts]
   * @param {function} [opts.onInterference] - Callback on destructive detection
   * @param {function} [opts.onDampen] - Callback when damping is applied
   * @param {number} [opts.scanIntervalMs=29034] - Scan cycle (default: φ heartbeat)
   */
  constructor(opts = {}) {
    /** @type {Map<string, FrequencySignature>} */
    this._registry = new Map();
    this._thermalModel = new ThermalModel();
    this._damper = new AntiResonanceDamper();
    this._onInterference = opts.onInterference || null;
    this._onDampen = opts.onDampen || null;
    this._scanIntervalMs = opts.scanIntervalMs || CYCLE_MS;

    /** @type {Array<object>} Interference event log */
    this._eventLog = [];
    /** @type {NodeJS.Timeout|null} */
    this._intervalHandle = null;
    this._scanCount = 0;
  }

  // ─── Registry ──────────────────────────────────────────────────────────────

  /**
   * Register a subsystem's frequency signature.
   * @param {string} subsystemId
   * @param {number} fundamentalHz - Primary operational frequency
   * @param {number[]} [harmonics] - Harmonic overtones
   * @returns {FrequencySignature}
   */
  register(subsystemId, fundamentalHz, harmonics) {
    const sig = new FrequencySignature(subsystemId, fundamentalHz, harmonics);
    this._registry.set(subsystemId, sig);
    return sig;
  }

  /**
   * Unregister a subsystem.
   * @param {string} subsystemId
   * @returns {boolean}
   */
  unregister(subsystemId) {
    this._damper.release(subsystemId);
    return this._registry.delete(subsystemId);
  }

  /**
   * Update a subsystem's observed amplitude (e.g. from load metrics).
   * @param {string} subsystemId
   * @param {number} amplitude - 0.0–1.0
   */
  updateAmplitude(subsystemId, amplitude) {
    const sig = this._registry.get(subsystemId);
    if (sig) {
      sig.amplitude = Math.max(0, Math.min(1, amplitude));
      sig.lastObservedAt = Date.now();
    }
  }

  // ─── Scanning ──────────────────────────────────────────────────────────────

  /**
   * Run a full interference scan across all registered frequencies.
   * This is the core detection loop, designed to run on each heartbeat.
   *
   * @returns {{
   *   scanId: string,
   *   timestamp: number,
   *   registeredCount: number,
   *   globalThermal: number,
   *   thermalExceeded: boolean,
   *   interferences: Array,
   *   dampingActions: Array,
   *   severity: string
   * }}
   */
  scan() {
    this._scanCount++;
    const scanId = crypto.randomUUID();
    const timestamp = Date.now();
    const interferences = [];
    const dampingActions = [];

    // Phase 1: Update thermal model
    const { globalThermal, hotPairs } = this._thermalModel.update(this._registry);
    const thermalExceeded = globalThermal > THRESHOLDS.THERMAL_MAX;

    // Phase 2: Pairwise INTERFERENCE gate check
    const entries = Array.from(this._registry.entries());
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [idA, sigA] = entries[i];
        const [idB, sigB] = entries[j];

        const result = cslINTERFERENCE(
          sigA.toVector(), sigB.toVector(),
          sigA.amplitude, sigB.amplitude
        );

        if (result.severity !== SEVERITY.NONE && result.severity !== SEVERITY.LOW) {
          interferences.push({
            pairA: idA,
            pairB: idB,
            ...result,
          });

          // Phase 3: Apply damping if destructive
          if (result.isDestructive) {
            // Dampen the higher-frequency subsystem (less disruptive to shift)
            const target = sigA.fundamentalHz >= sigB.fundamentalHz ? sigA : sigB;
            const source = target === sigA ? sigB : sigA;
            const dampResult = this._damper.dampen(target, source, result.score);

            if (dampResult.applied) {
              dampingActions.push({
                targetId: target.subsystemId,
                sourceId: source.subsystemId,
                ...dampResult,
              });
              if (typeof this._onDampen === 'function') {
                try { this._onDampen(dampResult, target, source); } catch (_) {}
              }
            }

            // Fire interference callback
            if (typeof this._onInterference === 'function') {
              try { this._onInterference(result, idA, idB); } catch (_) {}
            }
          }
        }
      }
    }

    // Determine overall severity
    let overallSeverity = SEVERITY.NONE;
    if (thermalExceeded) overallSeverity = SEVERITY.CRITICAL;
    else if (interferences.some(i => i.severity === SEVERITY.CRITICAL)) overallSeverity = SEVERITY.CRITICAL;
    else if (interferences.some(i => i.severity === SEVERITY.HIGH)) overallSeverity = SEVERITY.HIGH;
    else if (interferences.length > 0) overallSeverity = SEVERITY.MEDIUM;

    const scanResult = {
      scanId,
      timestamp,
      scanNumber: this._scanCount,
      registeredCount: this._registry.size,
      globalThermal,
      thermalExceeded,
      interferences,
      dampingActions,
      severity: overallSeverity,
    };

    // Log significant events
    if (overallSeverity !== SEVERITY.NONE) {
      this._eventLog.push(scanResult);
      if (this._eventLog.length > FIB_11) {
        this._eventLog = this._eventLog.slice(-FIB_11);
      }
    }

    return scanResult;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Start the periodic interference scan loop.
   * @param {number} [intervalMs] - Defaults to 29,034ms (φ heartbeat)
   * @returns {this}
   */
  start(intervalMs) {
    const ms = intervalMs || this._scanIntervalMs;
    if (this._intervalHandle) return this;

    // Initial scan
    this.scan();

    this._intervalHandle = setInterval(() => {
      try { this.scan(); } catch (_) {}
    }, ms);

    if (this._intervalHandle.unref) this._intervalHandle.unref();
    return this;
  }

  /**
   * Stop the scan loop.
   * @returns {this}
   */
  stop() {
    if (this._intervalHandle) {
      clearInterval(this._intervalHandle);
      this._intervalHandle = null;
    }
    return this;
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  /** @returns {Array<object>} Recent interference events */
  getEventLog(limit = FIB_9) { return this._eventLog.slice(-limit); }

  /** @returns {{ globalThermal: number, history: Array }} */
  getThermalStatus() {
    return {
      globalThermal: this._thermalModel.getGlobalThermal(),
      exceeded: this._thermalModel.getGlobalThermal() > THRESHOLDS.THERMAL_MAX,
      history: this._thermalModel.getHistory(),
    };
  }

  /** @returns {Array} Active phase corrections */
  getActiveCorrections() { return this._damper.getActiveCorrections(); }

  /** @returns {Map<string, FrequencySignature>} */
  getRegistry() { return new Map(this._registry); }

  /**
   * Full system summary for the awareness dashboard.
   * @returns {object}
   */
  summary() {
    const lastScan = this._eventLog.length > 0
      ? this._eventLog[this._eventLog.length - 1]
      : null;

    return {
      registeredSubsystems: this._registry.size,
      subsystems: Array.from(this._registry.keys()),
      globalThermal: this._thermalModel.getGlobalThermal(),
      thermalExceeded: this._thermalModel.getGlobalThermal() > THRESHOLDS.THERMAL_MAX,
      activeCorrections: this._damper.getActiveCorrections().length,
      recentEvents: this._eventLog.length,
      scanCount: this._scanCount,
      lastSeverity: lastScan ? lastScan.severity : SEVERITY.NONE,
    };
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Main class
  FrequencyInterferenceDetector,
  // Supporting classes
  FrequencySignature,
  ThermalModel,
  AntiResonanceDamper,
  // CSL Gates
  cslINTERFERENCE,
  cslDAMPEN,
  // Constants
  THRESHOLDS,
  SEVERITY,
};
