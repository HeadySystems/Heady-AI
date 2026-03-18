/**
 * Heady™ φ-Scaled Constants
 * All system parameters derived from the Golden Ratio
 */
'use strict';

const PHI = 1.618033988749895;
const PSI = 0.618033988749895; // 1/PHI
const PSI2 = 0.381966011250105; // 1 - PSI

// Fibonacci sequence for pool/buffer sizing
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// CSL (Confidence Signal Logic) thresholds
const CSL = {
  INCLUDE: PSI2,   // 0.382 — minimum for consideration
  BOOST: PSI,      // 0.618 — promoted
  INJECT: 0.718,   // BOOST + 0.1 — forced inject
  SUPPRESS: 0.236, // below threshold
  MEDIUM: 1 / (1 + PSI), // ~0.809 for routing
};

// φ-scaled timeouts (seconds)
const TIMEOUTS = {
  CONNECT: PHI,           // 1.618s
  REQUEST: PHI * PHI + 1, // ~4.236s
  IDLE: PHI * 8,          // ~12.944s
  LONG: PHI * 21,         // ~33.978s
  MAX: PHI * 55,          // ~89.0s
};

// φ-scaled rate limits (requests/window)
const RATE_LIMITS = {
  ANONYMOUS: FIB[9],      // 34 req/min
  AUTHENTICATED: FIB[10], // 55 req/min
  PREMIUM: FIB[11],       // 89 req/min
  ENTERPRISE: FIB[12],    // 144 req/min
  INTERNAL: FIB[13],      // 233 req/min
};

// Service ports — φ-indexed across all 95 services
const PORTS = {
  // ═══ Core (33xx) ═══
  MCP_SERVER: 3310,
  HEADY_BRAIN: 3311,
  HEADY_MEMORY: 3312,
  HEADY_MANAGER: 3313,
  AUTH_SESSION: 3314,
  API_GATEWAY: 3315,
  NOTIFICATION: 3316,
  BILLING: 3317,
  ANALYTICS: 3318,
  SEARCH: 3319,
  SCHEDULER: 3320,
  HEADY_SOUL: 3321,
  HEADY_VINCI: 3322,
  HEADY_CONDUCTOR: 3323,
  HEADY_CODER: 3324,
  HEADY_BATTLE: 3325,
  HEADY_BUDDY: 3326,
  HEADY_LENS: 3327,
  HEADY_MAID: 3328,
  HEADY_GUARD: 3329,
  HCFP: 3330,
  EDGE_AI: 3331,

  // ═══ Advanced MCP Services — Tier 0 (34xx) ═══
  HEADY_CHRONO: 3400,
  HEADY_CARTOGRAPH: 3401,
  HEADY_SYNAPSE: 3402,
  HEADY_AURORA: 3403,
  HEADY_NEXUS: 3404,

  // ═══ Advanced MCP Services — Tier 1 (34xx) ═══
  HEADY_PRISM: 3410,
  HEADY_LOOM: 3411,
  HEADY_AXIOM: 3412,
  HEADY_MOSAIC: 3413,
  HEADY_CADENCE: 3414,
  HEADY_CHIMERA: 3415,
  HEADY_TAPESTRY: 3416,

  // ═══ Advanced MCP Services — Tier 2 (34xx) ═══
  HEADY_ECHO: 3420,
  HEADY_VAULT: 3421,
  HEADY_AEGIS: 3422,
  HEADY_CRUCIBLE: 3423,
  HEADY_ARBITER: 3424,
  HEADY_OUROBOROS: 3425,
  HEADY_MYCELIUM: 3426,
  HEADY_RUNE: 3427,

  // ═══ Advanced MCP Services — Tier 3 (35xx) ═══
  HEADY_ORACLE: 3500,
  HEADY_NIMBUS: 3501,
  HEADY_PATINA: 3502,
  HEADY_POLARIS: 3503,
  HEADY_SOLSTICE: 3504,
  HEADY_QUANTUM: 3505,
  HEADY_TEMPEST: 3506,
  HEADY_VERDANT: 3507,

  // ═══ Advanced MCP Services — Tier 4 (35xx) ═══
  HEADY_COMPASS: 3510,
  HEADY_SCRIBE: 3511,
  HEADY_FOSSIL: 3512,
  HEADY_GENESIS: 3513,
  HEADY_LABYRINTH: 3514,
  HEADY_MIMIC: 3515,

  // ═══ Advanced MCP Services — Tier 5 (36xx) ═══
  HEADY_ALCHEMY: 3600,
  HEADY_WEAVE: 3601,
  HEADY_HERALD: 3602,
  HEADY_RESONANCE: 3603,
  HEADY_EMBER: 3604,
  HEADY_SIGIL: 3605,
  HEADY_TESSERA: 3606,

  // ═══ Advanced MCP Services — Tier 6 (36xx) ═══
  HEADY_LINGUA: 3610,
  HEADY_MERIDIAN: 3611,
  HEADY_SPECTRA: 3612,
  HEADY_AETHER: 3613,
};

// φ-scaled retry delays (ms)
function phiRetryDelays(maxRetries = 5) {
  return Array.from({ length: maxRetries }, (_, i) =>
    Math.round(1000 * Math.pow(PHI, i))
  );
}

// CSL gate function
function cslGate(signal, confidence, threshold = CSL.BOOST) {
  if (confidence < CSL.SUPPRESS) return 0;
  if (confidence < threshold) return signal * PSI2;
  if (confidence >= CSL.INJECT) return signal * PHI;
  return signal * confidence;
}

module.exports = {
  PHI, PSI, PSI2, FIB, CSL, TIMEOUTS, RATE_LIMITS, PORTS,
  phiRetryDelays, cslGate,
};
