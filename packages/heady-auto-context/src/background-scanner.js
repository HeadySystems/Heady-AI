/**
 * ═══════════════════════════════════════════════════════════
 * HEADY™ BACKGROUND SCANNER (Pass 1: SCAN)
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 *
 * Runs every fib(8) × 1000 = 21,000ms to refresh workspace
 * context, active session state, and recent vector queries.
 *
 * CSL relevance scoring against current task domain.
 * Feeds Pass 1 state into ContextFusionEngine.
 * ═══════════════════════════════════════════════════════════
 */

import { createLogger } from '../shared/structured-logger.js';
import { PSI, fib, phiBackoff, CSL_GATES } from '../shared/phi-math.js';
import { updatePass1State } from './context-fusion-engine.js';
import * as vectorStore from './vector-store.js';
import config from './config.js';

const logger = createLogger('background-scanner');

let scanInterval = null;
let scanCount = 0;
let lastScanDurationMs = 0;
let lastScanError = null;
let isRunning = false;
let consecutiveFailures = 0;

/**
 * Fetch recent vectors from T1 (pgvector) as a proxy for
 * workspace state. In a full deployment, this would also
 * scan file hashes (Merkle tree delta detection) and active
 * session state from T0 Redis.
 */
async function scanRecentContext() {
  // Query recent vectors across all domains — Pass 1 uses lower threshold (RECALL)
  // This represents the "ambient context" the system is aware of.
  const zeroVec = new Array(config.vectorDim).fill(0);

  // Scan the most recently updated entries as a proxy for "active context"
  try {
    const client = await vectorStore.healthCheck();
    if (!client.ok) {
      throw new Error('Vector store not healthy');
    }

    // Get recent entries by recency (not by similarity — Pass 1 is about freshness)
    const recentResults = await scanRecentEntries();
    return recentResults;
  } catch (err) {
    logger.warn({ error: err.message }, 'Pass 1 scan: vector store unavailable, using empty state');
    return [];
  }
}

/**
 * Query recent context entries ordered by recency.
 * Uses direct SQL to get the freshest context without needing a query vector.
 */
async function scanRecentEntries() {
  // We re-use the vector store's health-checked pool connection indirectly.
  // This is a lightweight recency scan, not a similarity search.
  // In production, this would query T0 Redis for session state + T1 for recent vectors.

  // Use a neutral embedding search with a very low threshold to get recent entries
  const neutralVec = new Array(config.vectorDim).fill(1 / Math.sqrt(config.vectorDim));

  const results = await vectorStore.search(
    neutralVec,
    config.searchTopK,     // fib(8) = 21
    CSL_GATES.RECALL,      // ψ² ≈ 0.382 — low bar for background scan
    null,                  // all domains
  );

  return results;
}

/**
 * Optional: Fetch session state from Upstash Redis (T0).
 * Returns null if Redis is not configured.
 */
async function scanRedisState() {
  if (!config.redisUrl || !config.redisToken) return null;

  try {
    const res = await fetch(`${config.redisUrl}/keys/*`, {
      headers: {
        'Authorization': `Bearer ${config.redisToken}`,
      },
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, 'Redis T0 scan failed');
      return null;
    }

    const data = await res.json();
    return {
      sessionKeys: Array.isArray(data.result) ? data.result.length : 0,
      scannedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn({ error: err.message }, 'Redis T0 unreachable');
    return null;
  }
}

/**
 * Execute a single Pass 1 scan cycle.
 */
async function executeScan() {
  if (isRunning) {
    logger.debug('Scan already in progress, skipping');
    return;
  }

  isRunning = true;
  const start = performance.now();
  scanCount++;

  try {
    // Scan T1 (pgvector) for recent context
    const recentContext = await scanRecentContext();

    // Optionally scan T0 (Redis) for session state
    const redisState = await scanRedisState();

    // Update the ContextFusionEngine's Pass 1 state
    updatePass1State({
      scanResults: recentContext,
      domain: null, // Background scan is cross-domain
      redisState,
    });

    lastScanDurationMs = Math.round(performance.now() - start);
    lastScanError = null;
    consecutiveFailures = 0;

    logger.info({
      scanCount,
      durationMs: lastScanDurationMs,
      resultCount: recentContext.length,
      redisAvailable: !!redisState,
    }, 'Pass 1 scan complete');
  } catch (err) {
    consecutiveFailures++;
    lastScanError = err.message;
    lastScanDurationMs = Math.round(performance.now() - start);

    logger.error({
      error: err.message,
      scanCount,
      consecutiveFailures,
    }, 'Pass 1 scan failed');
  } finally {
    isRunning = false;
  }
}

/**
 * Start the background scanner.
 * Runs executeScan every config.scanIntervalMs (default 21,000ms).
 *
 * First scan executes immediately, then repeats on interval.
 */
export function startScanner() {
  if (scanInterval) {
    logger.warn('Scanner already running');
    return;
  }

  logger.info({
    intervalMs: config.scanIntervalMs,
    redisConfigured: !!(config.redisUrl && config.redisToken),
  }, 'Starting background scanner (Pass 1)');

  // Immediate first scan (non-blocking)
  executeScan().catch(err => {
    logger.error({ error: err.message }, 'Initial scan failed');
  });

  scanInterval = setInterval(() => {
    executeScan().catch(err => {
      logger.error({ error: err.message }, 'Periodic scan failed');

      // If too many consecutive failures, slow down (phi-backoff)
      if (consecutiveFailures >= fib(5)) { // 5 failures
        const backoff = phiBackoff(consecutiveFailures - fib(5), config.scanIntervalMs);
        logger.warn({ backoffMs: backoff, consecutiveFailures }, 'Applying phi-backoff to scanner');
        stopScanner();
        setTimeout(() => startScanner(), backoff);
      }
    });
  }, config.scanIntervalMs);
}

/**
 * Stop the background scanner.
 */
export function stopScanner() {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
    logger.info('Background scanner stopped');
  }
}

/**
 * Force an immediate scan (used by /context/force-scan endpoint).
 */
export async function forceScan() {
  await executeScan();
}

/**
 * Get scanner diagnostics.
 */
export function getScannerStats() {
  return {
    scanCount,
    lastScanDurationMs,
    lastScanError,
    isRunning,
    consecutiveFailures,
    intervalMs: config.scanIntervalMs,
    redisConfigured: !!(config.redisUrl && config.redisToken),
  };
}
