// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Platform Config v1.0.0                                 ║
// ║  Unified configuration for the Agent Platform                  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

const PHI = 1.6180339887498948;
const PSI = 0.6180339887498949;

/**
 * All system parameters derived from φ (golden ratio) — zero magic numbers.
 */
export const PlatformConfig = Object.freeze({
  // ─── Phi-Derived Timing ──────────────────────────────────────────
  heartbeatMs: Math.round(PHI * 7 * 1000), // ~11.3s
  healthCheckMs: Math.round(PHI * PHI * 5 * 1000), // ~13.1s
  circuitBreakerProbeMs: 30000,
  maxRetryDelayMs: Math.round(PHI * PHI * PHI * 10000), // ~42.4s

  // ─── Backpressure Thresholds ─────────────────────────────────────
  pressure: {
    normal: PSI * PSI, // ≈ 0.382
    elevated: PSI, // ≈ 0.618
    high: 1 - PSI * PSI * 0.5, // ≈ 0.809
    critical: 1.0,
  },

  // ─── CSL Routing Thresholds ──────────────────────────────────────
  csl: {
    high: 1 - Math.pow(PSI, 3) * 0.5, // ≈ 0.882
    medium: 1 - Math.pow(PSI, 2) * 0.5, // ≈ 0.809
    low: 1 - PSI * 0.5, // ≈ 0.691
    dedup: 1 - Math.pow(PSI, 4) * 0.5, // ≈ 0.927
  },

  // ─── Pool Sizing (Fibonacci) ─────────────────────────────────────
  pools: {
    minBees: 3, // F(4)
    defaultBees: 5, // F(5)
    maxBees: 13, // F(7)
    maxSwarmBees: 21, // F(8)
    messageHistory: 89, // F(11)
    taskQueueMax: 144, // F(12)
  },

  // ─── Circuit Breaker ─────────────────────────────────────────────
  circuitBreaker: {
    failureThreshold: 5,
    halfOpenMax: 3,
    resetTimeoutMs: Math.round(PHI * PHI * 10000), // ~26.2s
    backoffBaseMs: Math.round(PHI * 1000), // ~1.618s
  },

  // ─── Concurrency ─────────────────────────────────────────────────
  concurrency: {
    maxParallelTasks: 13, // F(7)
    maxFanOut: 8, // F(6)
    batchSize: 5, // F(5)
    workerPoolSize: 21, // F(8)
  },

  // ─── DAG Execution ───────────────────────────────────────────────
  dag: {
    maxSteps: 34, // F(9)
    maxCycles: 8, // F(6)
    stepTimeoutMs: Math.round(PHI * 30000), // ~48.5s
    checkpointEvery: 5, // F(5)
  },

  // ─── Provider Models ─────────────────────────────────────────────
  models: {
    strategic: {
      primary: 'claude-sonnet-4-20250514',
      fallback: 'gemini-2.5-pro',
    },
    tactical: {
      primary: 'claude-sonnet-4-20250514',
      fallback: 'gpt-4o',
    },
    operational: {
      primary: 'claude-haiku-3.5',
      fallback: 'gemini-2.0-flash',
    },
  },
});
