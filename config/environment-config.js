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
// ║  FILE: config/environment-config.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * @fileoverview Environment Config — Environment Configuration Generator
 *
 * Generates, validates, diffs, and migrates configs for dev/staging/production.
 * GCP Project: gen-lang-client-0920560496, Region: us-east1.
 * Cloudflare Account: 8b1fa38f282c691423c6399247d53323.
 * All constants derive from φ = 1.6180339887 — NO magic numbers.
 * CSL gates replace all boolean if/else.
 *
 * Founded by Eric Haywood — HeadySystems Inc. / HeadyConnection Inc.
 *
 * @module environment-config
 * @version 1.0.0
 * @license Proprietary — HeadySystems Inc.
 */

// ─── φ-MATH CONSTANTS ──────────────────────────────────────────────────────────

const PHI = 1.6180339887498948;
const PSI = 1 / PHI;
const PSI2 = PSI * PSI;
const PSI3 = PSI * PSI * PSI;
const PHI2 = PHI + 1;

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

const DETERMINISTIC_SEED = FIB[8] + FIB[5]; // 42
const DETERMINISTIC_TEMP = 0;

// ─── CSL GATE ───────────────────────────────────────────────────────────────────

function cslGate(confidence, threshold) {
  const delta = confidence - threshold;
  const signal = delta >= 0 ? 'PASS' : 'FAIL';
  const strength = Math.abs(delta) / PHI;
  return { signal, confidence, threshold, delta, strength };
}

function cslSelect(options, confidences, threshold) {
  let best = null;
  let bestConf = -Infinity;
  for (let i = 0; i < options.length; i++) {
    const gate = cslGate(confidences[i], threshold);
    const pickGate = cslGate(
      gate.signal === 'PASS' && confidences[i] > bestConf ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    if (pickGate.signal === 'PASS') {
      best = options[i];
      bestConf = confidences[i];
    }
  }
  return { selected: best, confidence: bestConf };
}

// ─── PLATFORM CONSTANTS ─────────────────────────────────────────────────────────

const PLATFORM = {
  gcpProject: 'gen-lang-client-0920560496',
  region: 'us-east1',
  cloudflareAccount: '8b1fa38f282c691423c6399247d53323',
  authDomain: 'auth.headysystems.com',
  github: 'https://github.com/HeadyMe',
  founder: 'Eric Haywood',
};

const ENVIRONMENTS = ['development', 'staging', 'production'];

// ─── RESOURCE SCALING ───────────────────────────────────────────────────────────

const SCALING = {
  development: {
    replicaMin: FIB[0],          // 1
    replicaMax: FIB[3],          // 3
    cpuRequest: `${FIB[4] * FIB[5] * FIB[3]}m`, // 120m
    cpuLimit: `${FIB[8] * FIB[5] * FIB[1]}m`,   // 272m
    memoryRequest: `${FIB[7] * FIB[5]}Mi`,       // 168Mi
    memoryLimit: `${FIB[8] * FIB[6]}Mi`,         // 442Mi
    maxConcurrency: FIB[6],      // 13
    tokenBudget: FIB[14],        // 610
    rateLimitRPS: FIB[5],        // 8
  },
  staging: {
    replicaMin: FIB[2],          // 2
    replicaMax: FIB[5],          // 8
    cpuRequest: `${FIB[7] * FIB[5] * FIB[2]}m`,  // 336m
    cpuLimit: `${FIB[9] * FIB[6]}m`,             // 442m
    memoryRequest: `${FIB[8] * FIB[6]}Mi`,       // 442Mi
    memoryLimit: `${FIB[10] * FIB[5]}Mi`,        // 712Mi
    maxConcurrency: FIB[8],      // 34
    tokenBudget: FIB[16],        // 1597
    rateLimitRPS: FIB[7],        // 21
  },
  production: {
    replicaMin: FIB[3],          // 3
    replicaMax: FIB[6],          // 13
    cpuRequest: `${FIB[10] * FIB[4]}m`,          // 445m
    cpuLimit: `${FIB[11] * FIB[5]}m`,            // 1152m
    memoryRequest: `${FIB[10] * FIB[6]}Mi`,      // 1157Mi
    memoryLimit: `${FIB[11] * FIB[7]}Mi`,        // 3024Mi
    maxConcurrency: FIB[10],     // 89
    tokenBudget: FIB[18],        // 4181
    rateLimitRPS: FIB[9],        // 34
  },
};

// ─── RESOURCE POOL ALLOCATIONS ──────────────────────────────────────────────────

const POOL_ALLOCATIONS = {
  hot:        FIB[8] / 100,   // 0.34
  warm:       FIB[7] / 100,   // 0.21
  cold:       FIB[6] / 100,   // 0.13
  reserve:    FIB[5] / 100,   // 0.08
  governance: FIB[4] / 100,   // 0.05
};

// ─── ENVIRONMENT DEFINITIONS ────────────────────────────────────────────────────

function generateBaseConfig(env) {
  const scaling = SCALING[env];
  const isProduction = cslGate(
    env === 'production' ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
    CSL_THRESHOLDS.MEDIUM
  );
  const isStaging = cslGate(
    env === 'staging' ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
    CSL_THRESHOLDS.MEDIUM
  );

  const logLevel = cslSelect(
    ['debug', 'info', 'warn'],
    [
      env === 'development' ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      env === 'staging' ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      env === 'production' ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
    ],
    CSL_THRESHOLDS.MEDIUM
  );

  const tlsMode = cslSelect(
    ['self-signed', 'letsencrypt', 'managed'],
    [
      env === 'development' ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      env === 'staging' ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      env === 'production' ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
    ],
    CSL_THRESHOLDS.MEDIUM
  );

  return {
    environment: env,
    founder: 'Eric Haywood',
    timestamp: new Date().toISOString(),
    seed: DETERMINISTIC_SEED,
    temperature: DETERMINISTIC_TEMP,

    platform: {
      gcpProject: PLATFORM.gcpProject,
      region: PLATFORM.region,
      cloudflareAccount: PLATFORM.cloudflareAccount,
      namespace: `heady-${env}`,
      cluster: `heady-${PLATFORM.region}-${env}`,
    },

    scaling: { ...scaling },
    pools: { ...POOL_ALLOCATIONS },

    networking: {
      portRangeStart: FIB[17] + FIB[17] + FIB[9] + FIB[7],
      portRangeEnd: FIB[17] + FIB[17] + FIB[11] + FIB[8] + FIB[3],
      serviceCount: FIB[9] + FIB[7] - FIB[3], // 50 approx (34 + 21 - 3 = 52)
      internalDNS: `*.heady-${env}.svc.cluster.local`,
      externalDNS: isProduction.signal === 'PASS'
        ? '*.headysystems.com'
        : `*.${env}.headysystems.com`,
    },

    auth: {
      domain: PLATFORM.authDomain,
      cookiePolicy: 'httpOnly',
      tokenStorage: 'httpOnly-cookie',
      sessionTTL: FIB[10] * FIB[4], // 445 minutes
      refreshWindow: FIB[8] * FIB[3], // 102 minutes
      maxSessions: isProduction.signal === 'PASS' ? FIB[4] : FIB[6],
    },

    logging: {
      level: logLevel.selected,
      structured: true,
      traceEnabled: isProduction.signal === 'PASS' || isStaging.signal === 'PASS',
      retentionDays: isProduction.signal === 'PASS' ? FIB[10] : isStaging.signal === 'PASS' ? FIB[8] : FIB[5],
      samplingRate: isProduction.signal === 'PASS' ? PSI : 1.0,
    },

    security: {
      tlsMode: tlsMode.selected,
      cslThreshold: isProduction.signal === 'PASS'
        ? CSL_THRESHOLDS.CRITICAL
        : isStaging.signal === 'PASS'
          ? CSL_THRESHOLDS.HIGH
          : CSL_THRESHOLDS.MEDIUM,
      rateLimitRPS: scaling.rateLimitRPS,
      corsOrigins: isProduction.signal === 'PASS'
        ? ['https://headyme.com', 'https://headysystems.com', 'https://heady-ai.com']
        : ['*'],
    },

    csl: {
      thresholds: { ...CSL_THRESHOLDS },
      defaultGateLevel: isProduction.signal === 'PASS' ? 'CRITICAL' : isStaging.signal === 'PASS' ? 'HIGH' : 'MEDIUM',
    },

    monitoring: {
      healthCheckInterval: FIB[8] * FIB[3] * 1000,  // 102s
      metricsInterval: FIB[7] * FIB[3] * 1000,      // 63s
      alertThreshold: isProduction.signal === 'PASS' ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.MEDIUM,
      uptimeSLO: isProduction.signal === 'PASS' ? phiThreshold(5) : phiThreshold(3),
    },

    features: {
      arenaMode: true,
      socraticLoop: true,
      selfHealing: isProduction.signal === 'PASS' || isStaging.signal === 'PASS',
      driftDetection: true,
      patternCapture: true,
      debugMode: isProduction.signal === 'FAIL',
    },
  };
}

// ─── ENVIRONMENT CONFIG CLASS ───────────────────────────────────────────────────

class EnvironmentConfig {
  constructor() {
    /** @private */
    this._configs = new Map();

    /** @private */
    this._history = [];

    /** @private */
    this._listeners = new Map();

    for (const env of ENVIRONMENTS) {
      this._configs.set(env, generateBaseConfig(env));
    }
  }

  /**
   * Generate config for a specific environment.
   * @param {'development'|'staging'|'production'} env
   * @param {object} [overrides={}]
   * @returns {object} Complete environment configuration
   */
  generate(env, overrides = {}) {
    const validEnv = cslGate(
      ENVIRONMENTS.includes(env) ? CSL_THRESHOLDS.CRITICAL : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.HIGH
    );

    if (validEnv.signal === 'FAIL') {
      return { error: `Unknown environment: ${env}`, validEnvironments: ENVIRONMENTS, gate: validEnv };
    }

    const base = generateBaseConfig(env);
    const merged = this._deepMerge(base, overrides);
    this._configs.set(env, merged);
    this._recordHistory('generate', { env, overrideKeys: Object.keys(overrides) });
    this._notify('generate', { env, config: merged });

    return { environment: env, config: merged, gate: validEnv };
  }

  /**
   * Validate an environment configuration.
   * @param {'development'|'staging'|'production'} env
   * @returns {{ valid: boolean, confidence: number, errors: string[], warnings: string[] }}
   */
  validate(env) {
    const config = this._configs.get(env);
    const exists = cslGate(
      config ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );

    if (exists.signal === 'FAIL') {
      return { valid: false, confidence: 0, errors: [`No config for env: ${env}`], warnings: [] };
    }

    const errors = [];
    const warnings = [];

    const platformGate = cslGate(
      config.platform && config.platform.gcpProject === PLATFORM.gcpProject ? CSL_THRESHOLDS.CRITICAL : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.HIGH
    );
    platformGate.signal === 'FAIL' && errors.push('GCP project mismatch');

    const regionGate = cslGate(
      config.platform && config.platform.region === PLATFORM.region ? CSL_THRESHOLDS.CRITICAL : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.HIGH
    );
    regionGate.signal === 'FAIL' && errors.push('Region mismatch');

    const authGate = cslGate(
      config.auth && config.auth.cookiePolicy === 'httpOnly' ? CSL_THRESHOLDS.CRITICAL : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.HIGH
    );
    authGate.signal === 'FAIL' && errors.push('Auth must use httpOnly cookies');

    const seedGate = cslGate(
      config.seed === DETERMINISTIC_SEED ? CSL_THRESHOLDS.CRITICAL : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.HIGH
    );
    seedGate.signal === 'FAIL' && errors.push('Deterministic seed must be 42');

    const tempGate = cslGate(
      config.temperature === DETERMINISTIC_TEMP ? CSL_THRESHOLDS.CRITICAL : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.HIGH
    );
    tempGate.signal === 'FAIL' && errors.push('Temperature must be 0');

    const scalingGate = cslGate(
      config.scaling && config.scaling.replicaMin >= FIB[0] ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    scalingGate.signal === 'FAIL' && warnings.push('Replica minimum below Fibonacci floor');

    const poolTotal = config.pools
      ? Object.values(config.pools).reduce((s, v) => s + v, 0)
      : 0;
    const poolGate = cslGate(
      Math.abs(poolTotal - (FIB[8] + FIB[7] + FIB[6] + FIB[5] + FIB[4]) / 100) < PSI3
        ? CSL_THRESHOLDS.HIGH
        : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    poolGate.signal === 'FAIL' && warnings.push('Resource pool allocations deviate from Fibonacci ratios');

    const overallConfidence = errors.length === 0
      ? CSL_THRESHOLDS.CRITICAL
      : CSL_THRESHOLDS.MINIMUM * Math.pow(PSI, errors.length);

    const result = {
      valid: cslGate(overallConfidence, CSL_THRESHOLDS.MEDIUM).signal === 'PASS',
      confidence: overallConfidence,
      environment: env,
      errors,
      warnings,
      founder: 'Eric Haywood',
    };

    this._recordHistory('validate', { env, valid: result.valid });
    return result;
  }

  /**
   * Compute diff between two environments.
   * @param {'development'|'staging'|'production'} envA
   * @param {'development'|'staging'|'production'} envB
   * @returns {object} Diff report
   */
  diff(envA, envB) {
    const configA = this._configs.get(envA);
    const configB = this._configs.get(envB);
    const bothExist = cslGate(
      configA && configB ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );

    if (bothExist.signal === 'FAIL') {
      return { error: 'One or both environments not found', envA, envB };
    }

    const differences = [];
    const shared = [];

    const compare = (a, b, path = '') => {
      const allKeys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
      for (const key of allKeys) {
        const fullPath = path ? `${path}.${key}` : key;
        const aVal = a ? a[key] : undefined;
        const bVal = b ? b[key] : undefined;

        const bothObjects = cslGate(
          typeof aVal === 'object' && aVal !== null && !Array.isArray(aVal) &&
          typeof bVal === 'object' && bVal !== null && !Array.isArray(bVal)
            ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
          CSL_THRESHOLDS.MEDIUM
        );

        if (bothObjects.signal === 'PASS') {
          compare(aVal, bVal, fullPath);
        } else {
          const same = cslGate(
            JSON.stringify(aVal) === JSON.stringify(bVal) ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
            CSL_THRESHOLDS.MEDIUM
          );
          same.signal === 'PASS'
            ? shared.push({ path: fullPath, value: aVal })
            : differences.push({ path: fullPath, [envA]: aVal, [envB]: bVal });
        }
      }
    };

    compare(configA, configB);

    const similarity = shared.length / (shared.length + differences.length);
    const result = {
      envA,
      envB,
      differenceCount: differences.length,
      sharedCount: shared.length,
      similarity,
      similarityCSL: cslGate(similarity, CSL_THRESHOLDS.MEDIUM),
      differences,
      shared: shared.slice(0, FIB[7]), // limit output to 21 shared items
      timestamp: new Date().toISOString(),
    };

    this._recordHistory('diff', { envA, envB, differenceCount: differences.length });
    return result;
  }

  /**
   * Migrate configuration from one environment to another.
   * @param {'development'|'staging'|'production'} fromEnv
   * @param {'development'|'staging'|'production'} toEnv
   * @param {object} [adjustments={}] - Environment-specific adjustments
   * @returns {object} Migration result
   */
  migrate(fromEnv, toEnv, adjustments = {}) {
    const fromConfig = this._configs.get(fromEnv);
    const toExists = cslGate(
      ENVIRONMENTS.includes(toEnv) ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );

    if (toExists.signal === 'FAIL') {
      return { error: `Invalid target environment: ${toEnv}`, gate: toExists };
    }

    const fromExists = cslGate(
      fromConfig ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );

    if (fromExists.signal === 'FAIL') {
      return { error: `Source environment not found: ${fromEnv}`, gate: fromExists };
    }

    const IMMUTABLE_PATHS = ['platform.gcpProject', 'platform.region', 'platform.cloudflareAccount',
      'auth.cookiePolicy', 'auth.tokenStorage', 'seed', 'temperature', 'founder'];

    const newBase = generateBaseConfig(toEnv);
    const migratedFields = [];
    const skippedFields = [];

    const migrateObj = (from, to, path = '') => {
      for (const [key, val] of Object.entries(from)) {
        const fullPath = path ? `${path}.${key}` : key;

        const isImmutable = cslGate(
          IMMUTABLE_PATHS.includes(fullPath) ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
          CSL_THRESHOLDS.MEDIUM
        );

        if (isImmutable.signal === 'PASS') {
          skippedFields.push(fullPath);
          continue;
        }

        const isObject = cslGate(
          typeof val === 'object' && val !== null && !Array.isArray(val)
            ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
          CSL_THRESHOLDS.MEDIUM
        );

        if (isObject.signal === 'PASS') {
          const toObj = typeof to[key] === 'object' && to[key] !== null ? to[key] : {};
          migrateObj(val, toObj, fullPath);
          to[key] = toObj;
        } else {
          const hasAdjustment = cslGate(
            fullPath in adjustments ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
            CSL_THRESHOLDS.MEDIUM
          );
          to[key] = hasAdjustment.signal === 'PASS' ? adjustments[fullPath] : val;
          migratedFields.push(fullPath);
        }
      }
    };

    migrateObj(fromConfig, newBase);

    newBase.environment = toEnv;
    newBase.scaling = SCALING[toEnv];
    this._configs.set(toEnv, newBase);

    const preDiff = this.diff(fromEnv, toEnv);

    const result = {
      fromEnv,
      toEnv,
      migratedFields: migratedFields.length,
      skippedImmutable: skippedFields.length,
      adjustmentsApplied: Object.keys(adjustments).length,
      postMigrationDiff: preDiff.differenceCount,
      validation: this.validate(toEnv),
      timestamp: new Date().toISOString(),
      founder: 'Eric Haywood',
    };

    this._recordHistory('migrate', { fromEnv, toEnv, migratedFields: migratedFields.length });
    this._notify('migrate', result);

    return result;
  }

  /**
   * Get config for a specific environment.
   * @param {'development'|'staging'|'production'} env
   * @returns {object|null}
   */
  getConfig(env) {
    return this._configs.get(env) || null;
  }

  /**
   * Get all configs.
   * @returns {object}
   */
  getAllConfigs() {
    const result = {};
    for (const [env, config] of this._configs) {
      result[env] = config;
    }
    return result;
  }

  /**
   * Get history log.
   * @returns {Array<object>}
   */
  getHistory() {
    return [...this._history];
  }

  /**
   * Subscribe to events.
   * @param {string} event
   * @param {Function} handler
   */
  on(event, handler) {
    const handlers = this._listeners.get(event) || [];
    handlers.push(handler);
    this._listeners.set(event, handlers);
  }

  /** @private */
  _notify(event, data) {
    for (const h of (this._listeners.get(event) || [])) {
      h({ event, timestamp: new Date().toISOString(), ...data });
    }
  }

  /** @private */
  _recordHistory(action, details) {
    this._history.push({ action, timestamp: new Date().toISOString(), details });
    const maxHistory = FIB[12]; // 233
    const gate = cslGate(
      this._history.length > maxHistory ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    gate.signal === 'PASS' && this._history.splice(0, this._history.length - maxHistory);
  }

  /** @private */
  _deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      const tVal = target[key];
      const sVal = source[key];
      const mergeGate = cslGate(
        typeof tVal === 'object' && tVal !== null && !Array.isArray(tVal) &&
        typeof sVal === 'object' && sVal !== null && !Array.isArray(sVal)
          ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      result[key] = mergeGate.signal === 'PASS' ? this._deepMerge(tVal, sVal) : sVal;
    }
    return result;
  }
}

// ─── EXPORTS ────────────────────────────────────────────────────────────────────

export default EnvironmentConfig;

export {
  EnvironmentConfig,
  PLATFORM,
  ENVIRONMENTS,
  SCALING,
  POOL_ALLOCATIONS,
  CSL_THRESHOLDS,
  PHI, PSI, PSI2, PSI3, PHI2,
  FIB,
  DETERMINISTIC_SEED,
  DETERMINISTIC_TEMP,
  cslGate,
  cslSelect,
  phiThreshold,
  generateBaseConfig,
};
