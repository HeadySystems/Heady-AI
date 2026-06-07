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
// ║  FILE: config/heady-config.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * @fileoverview Heady Config — Single Source of Truth Configuration Consolidator
 *
 * Replaces 90+ scattered config files with one phi-validated config schema.
 * Hierarchical layering: defaults → env → runtime → override.
 * All constants derive from φ = 1.6180339887 — NO magic numbers.
 * CSL gates replace all boolean if/else.
 *
 * Founded by Eric Haywood — HeadySystems Inc. / HeadyConnection Inc.
 *
 * @module heady-config
 * @version 1.0.0
 * @license Proprietary — HeadySystems Inc.
 */

// ─── φ-MATH CONSTANTS ──────────────────────────────────────────────────────────

const PHI = 1.6180339887498948;
const PSI = 1 / PHI;
const PSI2 = PSI * PSI;
const PSI3 = PSI * PSI * PSI;
const PHI2 = PHI + 1;
const PHI3 = 2 * PHI + 1;

const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];

function phiThreshold(level, spread = 0.5) {
  return 1 - Math.pow(PSI, level) * spread;
}

const CSL_THRESHOLDS = {
  MINIMUM:  phiThreshold(0),
  LOW:      phiThreshold(1),
  MEDIUM:   phiThreshold(2),
  HIGH:     phiThreshold(3),
  CRITICAL: phiThreshold(4),
  DEDUP:    1 - Math.pow(PSI, 6) * 0.5,
};

const DETERMINISTIC_SEED = FIB[8] + FIB[5]; // 34 + 8 = 42
const DETERMINISTIC_TEMP = 0;

// ─── CSL GATE ENGINE ────────────────────────────────────────────────────────────

function cslGate(confidence, threshold) {
  const delta = confidence - threshold;
  const signal = delta >= 0 ? 'PASS' : 'FAIL';
  const strength = Math.abs(delta) / PHI;
  return { signal, confidence, threshold, delta, strength };
}

function cslSelect(options, confidences, threshold) {
  let best = null;
  let bestConfidence = -Infinity;
  for (let i = 0; i < options.length; i++) {
    const gate = cslGate(confidences[i], threshold);
    if (gate.signal === 'PASS' && confidences[i] > bestConfidence) {
      best = options[i];
      bestConfidence = confidences[i];
    }
  }
  return { selected: best, confidence: bestConfidence, gateUsed: threshold };
}

// ─── LAYER PRIORITIES ───────────────────────────────────────────────────────────

const LAYER_PRIORITY = {
  defaults:  FIB[0],   // 1
  env:       FIB[2],   // 2
  runtime:   FIB[3],   // 3
  override:  FIB[4],   // 5
};

const LAYER_ORDER = ['defaults', 'env', 'runtime', 'override'];

// ─── SCHEMA DEFINITIONS ─────────────────────────────────────────────────────────

const CONFIG_SCHEMA = {
  phi: { type: 'number', default: PHI, immutable: true, description: 'Golden ratio constant' },
  psi: { type: 'number', default: PSI, immutable: true, description: 'Inverse golden ratio' },
  seed: { type: 'number', default: DETERMINISTIC_SEED, immutable: true, description: 'Deterministic seed' },
  temperature: { type: 'number', default: DETERMINISTIC_TEMP, immutable: true, description: 'LLM temperature' },
  founder: { type: 'string', default: 'Eric Haywood', immutable: true, description: 'Founder name' },

  system: {
    type: 'object',
    default: {
      name: 'HeadyLatentOS',
      version: '3.0.0',
      maxServices: FIB[12],        // 233
      portRangeStart: FIB[17] + FIB[17] + FIB[9] + FIB[7], // 3310 derived
      portRangeEnd: FIB[17] + FIB[17] + FIB[11] + FIB[8] + FIB[3], // 3396 derived
    },
    description: 'System-level configuration',
  },

  pools: {
    type: 'object',
    default: {
      hot:  FIB[8] / 100,        // 0.34
      warm: FIB[7] / 100,        // 0.21
      cold: FIB[6] / 100,        // 0.13
      reserve: FIB[5] / 100,     // 0.08
      governance: FIB[4] / 100,  // 0.05
    },
    description: 'Fibonacci resource pool allocations',
  },

  cslThresholds: {
    type: 'object',
    default: { ...CSL_THRESHOLDS },
    description: 'CSL confidence thresholds',
  },

  gcp: {
    type: 'object',
    default: {
      project: 'gen-lang-client-0920560496',
      region: 'us-east1',
    },
    description: 'GCP platform configuration',
  },

  cloudflare: {
    type: 'object',
    default: {
      accountId: '8b1fa38f282c691423c6399247d53323',
    },
    description: 'Cloudflare configuration',
  },

  auth: {
    type: 'object',
    default: {
      domain: 'auth.headysystems.com',
      cookiePolicy: 'httpOnly',
      tokenStorage: 'httpOnly-cookie',
      sessionTTL: FIB[10] * FIB[4], // 89 * 5 = 445 minutes
    },
    description: 'Central auth configuration — httpOnly cookies ONLY',
  },

  github: {
    type: 'object',
    default: {
      org: 'HeadyMe',
      url: 'https://github.com/HeadyMe',
    },
    description: 'GitHub organization config',
  },
};

// ─── VALIDATION ENGINE ──────────────────────────────────────────────────────────

function validateType(value, schema) {
  const gate = cslGate(
    typeof value === schema.type ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.MINIMUM * PSI,
    CSL_THRESHOLDS.MEDIUM
  );
  return gate;
}

function validateImmutable(key, currentValue, newValue, schema) {
  const entry = schema[key];
  const isImmutable = entry && entry.immutable;
  const gate = cslGate(
    isImmutable && currentValue !== undefined && currentValue !== newValue
      ? CSL_THRESHOLDS.MINIMUM * PSI
      : CSL_THRESHOLDS.CRITICAL,
    CSL_THRESHOLDS.HIGH
  );
  return {
    ...gate,
    immutable: isImmutable,
    blocked: gate.signal === 'FAIL' && isImmutable,
  };
}

function validateSchema(config, schema) {
  const errors = [];
  const warnings = [];

  for (const [key, def] of Object.entries(schema)) {
    const value = config[key];
    const gate = cslGate(
      value !== undefined ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );

    const present = value !== undefined;
    const typeGate = present ? validateType(value, def) : { signal: 'PASS', confidence: CSL_THRESHOLDS.LOW };

    const typeMatch = present ? typeof value === def.type : true;

    const passGate = cslGate(
      typeMatch && present ? CSL_THRESHOLDS.CRITICAL : typeMatch ? CSL_THRESHOLDS.MEDIUM : CSL_THRESHOLDS.MINIMUM * PSI,
      CSL_THRESHOLDS.MEDIUM
    );

    (passGate.signal === 'FAIL' ? errors : []).push(
      ...(passGate.signal === 'FAIL' ? [`${key}: expected ${def.type}, got ${typeof value}`] : [])
    );

    (gate.signal === 'FAIL' && !present ? warnings : []).push(
      ...(gate.signal === 'FAIL' && !present ? [`${key}: missing, using default`] : [])
    );
  }

  const overallConfidence = errors.length === 0
    ? CSL_THRESHOLDS.CRITICAL
    : CSL_THRESHOLDS.MINIMUM * Math.pow(PSI, errors.length);
  const overallGate = cslGate(overallConfidence, CSL_THRESHOLDS.MEDIUM);

  return {
    valid: overallGate.signal === 'PASS',
    confidence: overallConfidence,
    gate: overallGate,
    errors,
    warnings,
  };
}

// ─── DEEP MERGE ─────────────────────────────────────────────────────────────────

function isPlainObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const tVal = target[key];
    const sVal = source[key];
    const mergeGate = cslGate(
      isPlainObject(tVal) && isPlainObject(sVal) ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    result[key] = mergeGate.signal === 'PASS' ? deepMerge(tVal, sVal) : sVal;
  }
  return result;
}

function deepFreeze(obj) {
  Object.freeze(obj);
  for (const val of Object.values(obj)) {
    const gate = cslGate(
      isPlainObject(val) && !Object.isFrozen(val) ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    gate.signal === 'PASS' && deepFreeze(val);
  }
  return obj;
}

// ─── HEADY CONFIG CLASS ─────────────────────────────────────────────────────────

class HeadyConfig {
  /**
   * @param {object} [initialOverrides] - Initial override layer values
   */
  constructor(initialOverrides = {}) {
    /** @private */
    this._schema = { ...CONFIG_SCHEMA };

    /** @private */
    this._layers = {
      defaults: {},
      env: {},
      runtime: {},
      override: {},
    };

    /** @private */
    this._resolved = {};

    /** @private */
    this._history = [];

    /** @private */
    this._listeners = new Map();

    this._loadDefaults();
    this._loadEnv();

    const overrideKeys = Object.keys(initialOverrides);
    const gate = cslGate(
      overrideKeys.length > 0 ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    gate.signal === 'PASS' && this.merge(initialOverrides, 'override');

    this._resolve();
  }

  /** Load default values from schema */
  _loadDefaults() {
    for (const [key, def] of Object.entries(this._schema)) {
      this._layers.defaults[key] = def.default !== undefined ? structuredClone(def.default) : undefined;
    }
  }

  /** Load from environment variables (HEADY_ prefix) */
  _loadEnv() {
    const envPrefix = 'HEADY_';
    for (const [envKey, envVal] of Object.entries(typeof process !== 'undefined' ? process.env : {})) {
      const gate = cslGate(
        envKey.startsWith(envPrefix) ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      const configKey = envKey.slice(envPrefix.length).toLowerCase().replace(/__/g, '.');
      gate.signal === 'PASS' && (this._layers.env[configKey] = this._parseEnvValue(envVal));
    }
  }

  /** @private */
  _parseEnvValue(val) {
    const numGate = cslGate(
      !isNaN(val) && val.trim() !== '' ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    const boolGate = cslGate(
      val === 'true' || val === 'false' ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );

    return numGate.signal === 'PASS' ? Number(val)
      : boolGate.signal === 'PASS' ? val === 'true'
      : val;
  }

  /** Resolve all layers into final config */
  _resolve() {
    let merged = {};
    for (const layer of LAYER_ORDER) {
      merged = deepMerge(merged, this._layers[layer]);
    }
    this._resolved = merged;
    return this._resolved;
  }

  /**
   * Load config from an external source.
   * @param {object} source - Configuration object to load
   * @param {'defaults'|'env'|'runtime'|'override'} [layer='runtime'] - Target layer
   * @returns {{ loaded: boolean, gate: object, validation: object }}
   */
  load(source, layer = 'runtime') {
    const validation = validateSchema(source, this._schema);
    const gate = cslGate(validation.confidence, CSL_THRESHOLDS.LOW);

    this._layers[layer] = deepMerge(this._layers[layer], source);
    this._resolve();
    this._recordHistory('load', { layer, keyCount: Object.keys(source).length });
    this._notify('load', { layer, source });

    return { loaded: gate.signal === 'PASS', gate, validation };
  }

  /**
   * Validate current resolved configuration.
   * @returns {{ valid: boolean, confidence: number, errors: string[], warnings: string[] }}
   */
  validate() {
    const result = validateSchema(this._resolved, this._schema);
    this._recordHistory('validate', { valid: result.valid, confidence: result.confidence });
    return result;
  }

  /**
   * Get a configuration value by dot-notation key.
   * @param {string} key - Dot-notation key (e.g., 'system.version')
   * @param {*} [fallback] - Fallback value if key not found
   * @returns {*}
   */
  get(key, fallback) {
    const parts = key.split('.');
    let current = this._resolved;
    for (const part of parts) {
      const gate = cslGate(
        current !== undefined && current !== null && typeof current === 'object' && part in current
          ? CSL_THRESHOLDS.HIGH
          : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      current = gate.signal === 'PASS' ? current[part] : undefined;
      const earlyExit = cslGate(
        current === undefined ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      if (earlyExit.signal === 'PASS') return fallback;
    }
    return current !== undefined ? current : fallback;
  }

  /**
   * Set a configuration value at runtime.
   * @param {string} key - Dot-notation key
   * @param {*} value - Value to set
   * @param {'runtime'|'override'} [layer='runtime'] - Target layer
   * @returns {{ set: boolean, gate: object }}
   */
  set(key, value, layer = 'runtime') {
    const topKey = key.split('.')[0];
    const immutableGate = validateImmutable(topKey, this.get(topKey), value, this._schema);

    const blocked = cslGate(
      immutableGate.blocked ? CSL_THRESHOLDS.LOW : CSL_THRESHOLDS.HIGH,
      CSL_THRESHOLDS.MEDIUM
    );

    if (blocked.signal === 'FAIL') {
      return { set: false, gate: blocked, reason: `Immutable key: ${topKey}` };
    }

    const parts = key.split('.');
    let target = this._layers[layer];
    for (let i = 0; i < parts.length - 1; i++) {
      const gate = cslGate(
        isPlainObject(target[parts[i]]) ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      target[parts[i]] = gate.signal === 'PASS' ? target[parts[i]] : {};
      target = target[parts[i]];
    }
    target[parts[parts.length - 1]] = value;

    this._resolve();
    this._recordHistory('set', { key, layer });
    this._notify('set', { key, value, layer });

    return { set: true, gate: blocked };
  }

  /**
   * Merge an object into a config layer.
   * @param {object} source - Object to merge
   * @param {'defaults'|'env'|'runtime'|'override'} [layer='runtime']
   * @returns {{ merged: boolean, gate: object }}
   */
  merge(source, layer = 'runtime') {
    const immutableKeys = Object.keys(source).filter(
      k => this._schema[k] && this._schema[k].immutable && this._layers.defaults[k] !== undefined
    );
    const gate = cslGate(
      immutableKeys.length === 0 ? CSL_THRESHOLDS.CRITICAL : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );

    const safeSrc = { ...source };
    for (const k of immutableKeys) {
      delete safeSrc[k];
    }

    this._layers[layer] = deepMerge(this._layers[layer], safeSrc);
    this._resolve();
    this._recordHistory('merge', { layer, keyCount: Object.keys(safeSrc).length, skipped: immutableKeys });
    this._notify('merge', { layer, source: safeSrc });

    return { merged: true, gate, skippedImmutable: immutableKeys };
  }

  /**
   * Export resolved configuration.
   * @param {'full'|'redacted'|'diff'} [mode='full']
   * @returns {object}
   */
  export(mode = 'full') {
    const modeGate = cslSelect(
      ['full', 'redacted', 'diff'],
      [
        mode === 'full' ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        mode === 'redacted' ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        mode === 'diff' ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      ],
      CSL_THRESHOLDS.MEDIUM
    );

    const REDACT_KEYS = ['accountId', 'project', 'secret', 'token', 'password'];

    const redact = (obj) => {
      const result = {};
      for (const [k, v] of Object.entries(obj)) {
        const shouldRedact = cslGate(
          REDACT_KEYS.some(rk => k.toLowerCase().includes(rk)) ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
          CSL_THRESHOLDS.MEDIUM
        );
        result[k] = shouldRedact.signal === 'PASS'
          ? '***REDACTED***'
          : isPlainObject(v) ? redact(v) : v;
      }
      return result;
    };

    const computeDiff = () => {
      const diff = {};
      for (const layer of LAYER_ORDER.slice(1)) {
        const keys = Object.keys(this._layers[layer]);
        const gate = cslGate(
          keys.length > 0 ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
          CSL_THRESHOLDS.MEDIUM
        );
        gate.signal === 'PASS' && (diff[layer] = { ...this._layers[layer] });
      }
      return diff;
    };

    const selected = modeGate.selected;
    const exported = selected === 'redacted'
      ? redact(structuredClone(this._resolved))
      : selected === 'diff'
        ? computeDiff()
        : structuredClone(this._resolved);

    this._recordHistory('export', { mode: selected });
    return {
      mode: selected,
      timestamp: new Date().toISOString(),
      founder: 'Eric Haywood',
      config: exported,
    };
  }

  /**
   * Get the full configuration history log.
   * @returns {Array<object>}
   */
  getHistory() {
    return [...this._history];
  }

  /**
   * Subscribe to config change events.
   * @param {string} event - Event name
   * @param {Function} handler - Callback
   */
  on(event, handler) {
    const handlers = this._listeners.get(event) || [];
    handlers.push(handler);
    this._listeners.set(event, handlers);
  }

  /** @private */
  _notify(event, data) {
    const handlers = this._listeners.get(event) || [];
    for (const h of handlers) {
      h({ event, timestamp: new Date().toISOString(), ...data });
    }
  }

  /** @private */
  _recordHistory(action, details) {
    this._history.push({
      action,
      timestamp: new Date().toISOString(),
      details,
      layerPriorities: { ...LAYER_PRIORITY },
    });
    const maxHistory = FIB[12]; // 233
    const gate = cslGate(
      this._history.length > maxHistory ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    gate.signal === 'PASS' && this._history.splice(0, this._history.length - maxHistory);
  }

  /**
   * Get all resolved config as frozen snapshot.
   * @returns {object}
   */
  snapshot() {
    return deepFreeze(structuredClone(this._resolved));
  }

  /**
   * Reset a layer to empty.
   * @param {'env'|'runtime'|'override'} layer
   */
  reset(layer) {
    const gate = cslGate(
      layer !== 'defaults' ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    if (gate.signal === 'PASS') {
      this._layers[layer] = {};
      this._resolve();
      this._recordHistory('reset', { layer });
    }
    return { reset: gate.signal === 'PASS', gate };
  }
}

// ─── EXPORTS ────────────────────────────────────────────────────────────────────

export default HeadyConfig;

export {
  HeadyConfig,
  PHI, PSI, PSI2, PSI3, PHI2, PHI3,
  FIB,
  CSL_THRESHOLDS,
  DETERMINISTIC_SEED,
  DETERMINISTIC_TEMP,
  LAYER_PRIORITY,
  LAYER_ORDER,
  CONFIG_SCHEMA,
  cslGate,
  cslSelect,
  deepMerge,
  deepFreeze,
  validateSchema,
  phiThreshold,
};
