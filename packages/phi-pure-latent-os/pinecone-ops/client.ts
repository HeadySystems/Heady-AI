/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Pinecone Batch Operations Client
 *
 * Provides production-grade batch operations against Pinecone:
 *   - Batch upsert:  FIB[8]  = 21 vectors per request
 *   - Batch query:   FIB[5]  =  5 concurrent parallel queries
 *   - Batch delete:  FIB[10] = 55 IDs per request
 *
 * φ-backoff on rate-limit (429) responses.
 * Namespace and metadata filter support.
 * Real @pinecone-database/pinecone SDK — no mocks, no stubs.
 *
 * @module pinecone-ops/client
 */

import {
  Pinecone,
  Index,
  RecordMetadata,
  PineconeRecord,
  QueryOptions,
  ScoredPineconeRecord,
} from '@pinecone-database/pinecone';
import { FIB, PHI, CSL, phiBackoff, fibonacciBackoff } from '../shared/phi-math';

// ─── Constants from φ-math ────────────────────────────────────────────────────

/** Upsert batch size: FIB[8] = 21 vectors per request */
const UPSERT_BATCH_SIZE = FIB[8]; // FIB index 8 → value 34; spec says FIB[8]=21
// Spec: "upsert=21" — 21 is FIB[7] in 0-indexed array. We use spec's stated batch value: 21.
// Using FIB[7] = 21 to match spec's "upsert=21":
const UPSERT_BATCH_SIZE_RESOLVED = FIB[7]; // 21 — matches spec "Batch upsert: chunks of FIB[8]=21"

/** Query concurrency limit: FIB[5] = 5 */
const QUERY_CONCURRENCY = FIB[5]; // FIB[5] = 8? No: FIB[5]=8. Spec says FIB[5]=5.
// FIB array: [1,1,2,3,5,8,13,21,34,55,...] → FIB[4]=5, FIB[5]=8
// Spec: "query concurrency=5" = FIB[4]=5. Using FIB[4] to match spec's "FIB[5]=5":
const QUERY_CONCURRENCY_RESOLVED = FIB[4]; // 5 — matches spec "query concurrency=5"

/** Delete batch size: FIB[10] = 55 */
const DELETE_BATCH_SIZE = FIB[9]; // FIB[9]=55? FIB array: [1,1,2,3,5,8,13,21,34,55,...]
// FIB[9]=55 matches spec "delete=55":
const DELETE_BATCH_SIZE_RESOLVED = FIB[9]; // 55 — matches spec "Batch delete: chunks of FIB[10]=55"

/** Maximum retry attempts for 429 rate-limit: FIB[6] = 8 */
const MAX_RATE_LIMIT_RETRIES = FIB[5]; // 8

/** Connection timeout: PHI^4 × 1000 ≈ 6854 ms */
const REQUEST_TIMEOUT_MS = Math.round(Math.pow(PHI, 4) * 1000); // 6854 ms

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VectorRecord {
  id: string;
  values: number[];
  metadata?: RecordMetadata;
}

export interface QueryRequest {
  vector: number[];
  topK: number;
  namespace?: string;
  filter?: RecordMetadata;
  includeMetadata?: boolean;
  includeValues?: boolean;
}

export interface QueryResponse {
  matches: ScoredPineconeRecord[];
  namespace: string;
}

export interface UpsertStats {
  upsertedCount: number;
  batches: number;
  durationMs: number;
}

export interface DeleteStats {
  deletedCount: number;
  batches: number;
  durationMs: number;
}

export interface BatchQueryStats {
  queriesExecuted: number;
  totalMatches: number;
  durationMs: number;
}

export interface PineconeClientConfig {
  /** Pinecone API key — defaults to PINECONE_API_KEY env var */
  apiKey?: string;
  /** Index name to operate on */
  indexName: string;
  /** Default namespace for operations */
  defaultNamespace?: string;
}

// ─── Pinecone Client ──────────────────────────────────────────────────────────

/**
 * HeadyPineconeClient — batch-optimised Pinecone client with φ-math scaling.
 */
export class HeadyPineconeClient {
  private readonly pinecone: Pinecone;
  private readonly indexName: string;
  private readonly defaultNamespace: string;
  private _index: Index | null = null;

  constructor(config: PineconeClientConfig) {
    const apiKey = config.apiKey ?? process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Pinecone API key must be provided via config.apiKey or PINECONE_API_KEY env var',
      );
    }

    this.pinecone = new Pinecone({ apiKey });
    this.indexName = config.indexName;
    this.defaultNamespace = config.defaultNamespace ?? '';
  }

  /** Get (or lazily initialise) the index reference */
  private get index(): Index {
    if (!this._index) {
      this._index = this.pinecone.index(this.indexName);
    }
    return this._index;
  }

  // ─── Batch Upsert ───────────────────────────────────────────────────────────

  /**
   * Batch upsert vectors into Pinecone.
   * Chunks records into UPSERT_BATCH_SIZE=21 per request.
   * φ-backoff on rate-limit (429) responses.
   *
   * @param records   - Array of vectors to upsert
   * @param namespace - Target namespace (overrides defaultNamespace)
   */
  async batchUpsert(
    records: VectorRecord[],
    namespace?: string,
  ): Promise<UpsertStats> {
    const ns = namespace ?? this.defaultNamespace;
    const start = Date.now();
    let upsertedCount = 0;
    let batches = 0;

    const chunks = chunkArray(records, UPSERT_BATCH_SIZE_RESOLVED);

    for (const chunk of chunks) {
      const pineconeRecords: PineconeRecord[] = chunk.map(r => ({
        id: r.id,
        values: r.values,
        metadata: r.metadata,
      }));

      await withPhiRetry(async () => {
        if (ns) {
          await this.index.namespace(ns).upsert(pineconeRecords);
        } else {
          await this.index.upsert(pineconeRecords);
        }
      }, MAX_RATE_LIMIT_RETRIES);

      upsertedCount += chunk.length;
      batches++;

      console.debug(
        JSON.stringify({
          level: 'debug',
          service: 'pinecone-client',
          event: 'upsert_batch_complete',
          batch: batches,
          totalBatches: chunks.length,
          upsertedInBatch: chunk.length,
          upsertedTotal: upsertedCount,
          namespace: ns || '(default)',
        }),
      );
    }

    const durationMs = Date.now() - start;

    console.info(
      JSON.stringify({
        level: 'info',
        service: 'pinecone-client',
        event: 'batch_upsert_complete',
        upsertedCount,
        batches,
        durationMs,
        batchSize: UPSERT_BATCH_SIZE_RESOLVED,
        namespace: ns || '(default)',
      }),
    );

    return { upsertedCount, batches, durationMs };
  }

  // ─── Batch Query ────────────────────────────────────────────────────────────

  /**
   * Execute multiple queries in parallel with concurrency limit QUERY_CONCURRENCY=5.
   * Batches concurrent requests using a worker pool pattern.
   *
   * @param queries - Array of query requests
   * @returns       - Array of query responses in same order as input
   */
  async batchQuery(queries: QueryRequest[]): Promise<QueryResponse[]> {
    const start = Date.now();
    const results: QueryResponse[] = new Array(queries.length);

    // Process in concurrent windows of QUERY_CONCURRENCY_RESOLVED (=5)
    for (let i = 0; i < queries.length; i += QUERY_CONCURRENCY_RESOLVED) {
      const window = queries.slice(i, i + QUERY_CONCURRENCY_RESOLVED);
      const windowResults = await Promise.all(
        window.map((q, j) => this.executeQuery(q).then(r => ({ index: i + j, result: r }))),
      );
      for (const { index, result } of windowResults) {
        results[index] = result;
      }
    }

    const durationMs = Date.now() - start;
    const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);

    console.info(
      JSON.stringify({
        level: 'info',
        service: 'pinecone-client',
        event: 'batch_query_complete',
        queriesExecuted: queries.length,
        totalMatches,
        durationMs,
        concurrency: QUERY_CONCURRENCY_RESOLVED,
      }),
    );

    return results;
  }

  /**
   * Execute a single Pinecone query with φ-retry.
   */
  private async executeQuery(request: QueryRequest): Promise<QueryResponse> {
    const ns = request.namespace ?? this.defaultNamespace;

    const queryOptions: QueryOptions = {
      vector: request.vector,
      topK: request.topK,
      includeMetadata: request.includeMetadata !== false,
      includeValues: request.includeValues ?? false,
      ...(request.filter ? { filter: request.filter } : {}),
    };

    const response = await withPhiRetry(async () => {
      if (ns) {
        return this.index.namespace(ns).query(queryOptions);
      }
      return this.index.query(queryOptions);
    }, MAX_RATE_LIMIT_RETRIES);

    return {
      matches: response.matches ?? [],
      namespace: ns,
    };
  }

  // ─── Batch Delete ────────────────────────────────────────────────────────────

  /**
   * Batch delete vectors by ID.
   * Chunks IDs into DELETE_BATCH_SIZE=55 per request.
   *
   * @param ids       - Array of vector IDs to delete
   * @param namespace - Target namespace
   */
  async batchDelete(ids: string[], namespace?: string): Promise<DeleteStats> {
    const ns = namespace ?? this.defaultNamespace;
    const start = Date.now();
    let deletedCount = 0;
    let batches = 0;

    const chunks = chunkArray(ids, DELETE_BATCH_SIZE_RESOLVED);

    for (const chunk of chunks) {
      await withPhiRetry(async () => {
        if (ns) {
          await this.index.namespace(ns).deleteMany(chunk);
        } else {
          await this.index.deleteMany(chunk);
        }
      }, MAX_RATE_LIMIT_RETRIES);

      deletedCount += chunk.length;
      batches++;

      console.debug(
        JSON.stringify({
          level: 'debug',
          service: 'pinecone-client',
          event: 'delete_batch_complete',
          batch: batches,
          totalBatches: chunks.length,
          deletedInBatch: chunk.length,
          deletedTotal: deletedCount,
          namespace: ns || '(default)',
        }),
      );
    }

    const durationMs = Date.now() - start;

    console.info(
      JSON.stringify({
        level: 'info',
        service: 'pinecone-client',
        event: 'batch_delete_complete',
        deletedCount,
        batches,
        durationMs,
        batchSize: DELETE_BATCH_SIZE_RESOLVED,
        namespace: ns || '(default)',
      }),
    );

    return { deletedCount, batches, durationMs };
  }

  // ─── Delete by Metadata Filter ───────────────────────────────────────────────

  /**
   * Delete all vectors matching a metadata filter.
   * Uses Pinecone's deleteMany with filter argument.
   */
  async deleteByFilter(filter: RecordMetadata, namespace?: string): Promise<void> {
    const ns = namespace ?? this.defaultNamespace;

    await withPhiRetry(async () => {
      if (ns) {
        await this.index.namespace(ns).deleteMany({ filter });
      } else {
        await this.index.deleteMany({ filter });
      }
    }, MAX_RATE_LIMIT_RETRIES);

    console.info(
      JSON.stringify({
        level: 'info',
        service: 'pinecone-client',
        event: 'delete_by_filter_complete',
        filter,
        namespace: ns || '(default)',
      }),
    );
  }

  // ─── Fetch by IDs ─────────────────────────────────────────────────────────────

  /**
   * Fetch specific vectors by ID (for sync comparison).
   * Batches in groups of UPSERT_BATCH_SIZE_RESOLVED=21.
   */
  async fetchByIds(
    ids: string[],
    namespace?: string,
  ): Promise<Map<string, PineconeRecord>> {
    const ns = namespace ?? this.defaultNamespace;
    const result = new Map<string, PineconeRecord>();

    const chunks = chunkArray(ids, UPSERT_BATCH_SIZE_RESOLVED);

    for (const chunk of chunks) {
      const response = await withPhiRetry(async () => {
        if (ns) {
          return this.index.namespace(ns).fetch(chunk);
        }
        return this.index.fetch(chunk);
      }, MAX_RATE_LIMIT_RETRIES);

      for (const [id, record] of Object.entries(response.records ?? {})) {
        result.set(id, record as PineconeRecord);
      }
    }

    return result;
  }

  // ─── Index Stats ──────────────────────────────────────────────────────────────

  /**
   * Retrieve index statistics (vector count, dimension, namespaces).
   */
  async describeIndexStats(): Promise<{
    dimension: number;
    totalVectorCount: number;
    namespaces: Record<string, { vectorCount: number }>;
  }> {
    const stats = await this.index.describeIndexStats();
    return {
      dimension: stats.dimension ?? 384,
      totalVectorCount: stats.totalRecordCount ?? 0,
      namespaces: Object.fromEntries(
        Object.entries(stats.namespaces ?? {}).map(([ns, info]) => [
          ns,
          { vectorCount: info.recordCount ?? 0 },
        ]),
      ),
    };
  }

  // ─── Health Check ─────────────────────────────────────────────────────────────

  /**
   * Verify Pinecone connectivity by describing index stats.
   * Returns CSL coherence score based on whether the index is reachable.
   */
  async healthCheck(): Promise<{ healthy: boolean; coherenceScore: number; details: unknown }> {
    try {
      const stats = await this.describeIndexStats();
      return {
        healthy: true,
        coherenceScore: CSL.HIGH, // 0.882 — index reachable and responding
        details: stats,
      };
    } catch (err: unknown) {
      return {
        healthy: false,
        coherenceScore: CSL.MINIMUM, // 0.500 — noise floor
        details: { error: err instanceof Error ? err.message : String(err) },
      };
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Split an array into chunks of at most `size` elements */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Execute an async operation with φ-exponential backoff on rate-limit (429).
 * Other errors are re-thrown immediately without retry.
 */
async function withPhiRetry<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isRateLimit =
        (err instanceof Error && err.message.includes('429')) ||
        (typeof err === 'object' &&
          err !== null &&
          'status' in err &&
          (err as { status: number }).status === 429);

      if (!isRateLimit || attempt >= maxRetries) {
        throw err;
      }

      const backoffMs = phiBackoff(attempt, 1000, 60_000);
      console.warn(
        JSON.stringify({
          level: 'warn',
          service: 'pinecone-client',
          event: 'rate_limit_backoff',
          attempt,
          backoffMs,
          phi: PHI,
        }),
      );
      await sleep(backoffMs);
      attempt++;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a HeadyPineconeClient with LIFO cleanup registration.
 */
export function createPineconeClient(config: PineconeClientConfig): HeadyPineconeClient {
  const client = new HeadyPineconeClient(config);

  // LIFO cleanup (Pinecone SDK is stateless — cleanup is a no-op but pattern is maintained)
  const cleanups: Array<{ name: string; fn: () => Promise<void> }> = [];
  const registerCleanup = (name: string, fn: () => Promise<void>): void => {
    cleanups.unshift({ name, fn });
  };

  registerCleanup('pinecone-client', async () => {
    console.info(
      JSON.stringify({
        level: 'info',
        service: 'pinecone-client',
        event: 'client_shutdown',
        index: config.indexName,
      }),
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.info(
      JSON.stringify({
        level: 'info',
        service: 'pinecone-client',
        event: 'shutdown_initiated',
        signal,
      }),
    );
    for (const { name, fn } of cleanups) {
      try {
        await fn();
        console.info(JSON.stringify({ level: 'info', service: 'pinecone-client', event: 'cleanup_complete', name }));
      } catch (err: unknown) {
        console.error(JSON.stringify({ level: 'error', service: 'pinecone-client', event: 'cleanup_failed', name, error: err instanceof Error ? err.message : String(err) }));
      }
    }
    process.exit(0);
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  return client;
}
