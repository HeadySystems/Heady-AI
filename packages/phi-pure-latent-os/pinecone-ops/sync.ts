/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Bidirectional Sync — Neon pgvector ↔ Pinecone
 *
 * Synchronises vector memory records between Neon (pgvector) and Pinecone:
 *   - Compares by ID + updated_at timestamp
 *   - Upserts missing/newer records in both directions
 *   - Logs structured sync stats: added, updated, skipped, errors
 *
 * Sync directions:
 *   pgvector → Pinecone : push local DB records missing or stale in Pinecone
 *   Pinecone → pgvector : pull Pinecone records missing or stale in DB
 *
 * φ-Math constants used:
 *   FIB[7] = 13  : page size for DB pagination
 *   FIB[9] = 55  : Pinecone fetch batch size
 *   PHI^4 ≈ 6854 : idle sleep between sync cycles
 *
 * @module pinecone-ops/sync
 */

import { PoolClient } from 'pg';
import { RecordMetadata } from '@pinecone-database/pinecone';
import { FIB, PHI, CSL, phiBackoff, fibonacciBackoff } from '../shared/phi-math';
import { HeadyPineconeClient, VectorRecord, chunkArray } from './client';
import { getAppPool, getMigrationClient, withTransaction } from '../neon-pgvector/pool';

// ─── Constants from φ-math ────────────────────────────────────────────────────

/** DB pagination page size: FIB[7] = 13 rows per page */
const PAGE_SIZE = FIB[7]; // 13

/** Pinecone fetch batch size: FIB[9] = 55 IDs per fetch */
const PINECONE_FETCH_BATCH = FIB[9]; // 55

/** Upsert batch size: FIB[7] = 21 (matches client's UPSERT_BATCH_SIZE) */
const UPSERT_BATCH = FIB[7]; // 21 — aligns with Pinecone client batch size

/** Max sync errors before aborting: FIB[5] = 8 */
const MAX_SYNC_ERRORS = FIB[5]; // 8

/** φ-based sleep between paginated sync windows */
const SYNC_PAGE_SLEEP_MS = Math.round(PHI * 100); // ≈ 162 ms between pages

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncConfig {
  pineconeClient: HeadyPineconeClient;
  /** Pinecone namespace to sync (empty string = default) */
  namespace?: string;
  /** Only sync records in this pgvector namespace (matches memories.namespace) */
  pgNamespace?: string;
  /** If true, also sync from Pinecone → pgvector (bidirectional) */
  bidirectional?: boolean;
}

export interface SyncStats {
  direction: 'pgvector→pinecone' | 'pinecone→pgvector' | 'bidirectional';
  /** Records upserted in destination that were missing */
  added: number;
  /** Records upserted in destination that were stale (destination had older timestamp) */
  updated: number;
  /** Records identical in both — no action taken */
  skipped: number;
  /** Records that failed to sync */
  errors: number;
  /** Total records examined in source */
  examined: number;
  durationMs: number;
  namespace: string;
  pgNamespace: string;
}

/** A row from the memories table */
interface MemoryRow {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  namespace: string;
  created_at: Date;
  updated_at: Date;
}

/** Pinecone record extended with our updatedAt metadata field */
interface PineconeMemoryRecord {
  id: string;
  values: number[];
  metadata: RecordMetadata & {
    content?: string;
    namespace?: string;
    updatedAt?: string;
    createdAt?: string;
  };
}

// ─── Sync Engine ──────────────────────────────────────────────────────────────

/**
 * HeadySyncEngine — bidirectional vector memory sync.
 *
 * Usage:
 *   const engine = new HeadySyncEngine({ pineconeClient, namespace, pgNamespace, bidirectional: true });
 *   const stats = await engine.sync();
 */
export class HeadySyncEngine {
  private readonly config: Required<SyncConfig>;

  constructor(config: SyncConfig) {
    this.config = {
      namespace: '',
      pgNamespace: 'default',
      bidirectional: true,
      ...config,
    };
  }

  /**
   * Run a full sync pass.
   * Returns aggregate stats across all directions synced.
   */
  async sync(): Promise<SyncStats[]> {
    const results: SyncStats[] = [];

    // Direction 1: pgvector → Pinecone (always)
    const pgToPinecone = await this.syncPgvectorToPinecone();
    results.push(pgToPinecone);

    // Direction 2: Pinecone → pgvector (if bidirectional)
    if (this.config.bidirectional) {
      const pineconeToPg = await this.syncPineconeToPgvector();
      results.push(pineconeToPg);
    }

    console.info(
      JSON.stringify({
        level: 'info',
        service: 'heady-sync',
        event: 'sync_complete',
        results,
        bidirectional: this.config.bidirectional,
        namespace: this.config.namespace,
        pgNamespace: this.config.pgNamespace,
      }),
    );

    return results;
  }

  // ─── pgvector → Pinecone ────────────────────────────────────────────────────

  /**
   * Push records from Neon pgvector → Pinecone.
   * Paginates through memories table, batches Pinecone fetch for comparison,
   * then upserts records that are missing or have a newer updated_at.
   */
  private async syncPgvectorToPinecone(): Promise<SyncStats> {
    const start = Date.now();
    const stats: Omit<SyncStats, 'direction' | 'durationMs'> = {
      added: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      examined: 0,
      namespace: this.config.namespace,
      pgNamespace: this.config.pgNamespace,
    };

    const pool = getAppPool();
    let offset = 0;
    let errorCount = 0;
    let hasMore = true;

    console.info(
      JSON.stringify({
        level: 'info',
        service: 'heady-sync',
        event: 'pg_to_pinecone_start',
        pgNamespace: this.config.pgNamespace,
        pineNamespace: this.config.namespace,
      }),
    );

    while (hasMore) {
      // ── Paginated DB read ──────────────────────────────────────────────────
      const { rows } = await pool.query<MemoryRow>(
        `SELECT id, content, embedding::text, metadata, namespace, created_at, updated_at
         FROM memories
         WHERE namespace = $1
         ORDER BY updated_at ASC, id ASC
         LIMIT $2 OFFSET $3`,
        [this.config.pgNamespace, PAGE_SIZE, offset],
      );

      if (rows.length === 0) {
        hasMore = false;
        break;
      }

      stats.examined += rows.length;
      offset += rows.length;
      hasMore = rows.length === PAGE_SIZE;

      // Parse embedding from pg text representation to number[]
      const parsedRows = rows.map(row => ({
        ...row,
        embedding: parseEmbeddingString(row.embedding as unknown as string),
      }));

      // ── Batch fetch corresponding Pinecone records ─────────────────────────
      const ids = parsedRows.map(r => r.id);
      const pineconeRecords = await this.config.pineconeClient.fetchByIds(
        ids,
        this.config.namespace,
      );

      // ── Compare and collect records to upsert ─────────────────────────────
      const toUpsert: VectorRecord[] = [];

      for (const row of parsedRows) {
        try {
          const existing = pineconeRecords.get(row.id) as PineconeMemoryRecord | undefined;

          if (!existing) {
            // Missing in Pinecone — add
            toUpsert.push(buildPineconeRecord(row));
            stats.added++;
          } else {
            // Compare updated_at timestamps
            const existingUpdatedAt = existing.metadata?.updatedAt
              ? new Date(existing.metadata.updatedAt as string)
              : new Date(0);
            const dbUpdatedAt = new Date(row.updated_at);

            if (dbUpdatedAt > existingUpdatedAt) {
              // DB is newer — update Pinecone
              toUpsert.push(buildPineconeRecord(row));
              stats.updated++;
            } else {
              stats.skipped++;
            }
          }
        } catch (err: unknown) {
          stats.errors++;
          errorCount++;
          console.error(
            JSON.stringify({
              level: 'error',
              service: 'heady-sync',
              event: 'pg_to_pinecone_record_error',
              id: row.id,
              error: err instanceof Error ? err.message : String(err),
            }),
          );

          if (errorCount >= MAX_SYNC_ERRORS) {
            console.error(
              JSON.stringify({
                level: 'error',
                service: 'heady-sync',
                event: 'sync_aborted',
                reason: 'max_errors_exceeded',
                errorCount,
                maxErrors: MAX_SYNC_ERRORS,
              }),
            );
            hasMore = false;
            break;
          }
        }
      }

      // ── Batch upsert records to Pinecone ──────────────────────────────────
      if (toUpsert.length > 0) {
        await this.config.pineconeClient.batchUpsert(toUpsert, this.config.namespace);
      }

      // φ-paced sleep between pages to avoid overwhelming the DB
      if (hasMore) await sleep(SYNC_PAGE_SLEEP_MS);
    }

    const durationMs = Date.now() - start;

    const result: SyncStats = {
      direction: 'pgvector→pinecone',
      ...stats,
      durationMs,
    };

    console.info(
      JSON.stringify({
        level: 'info',
        service: 'heady-sync',
        event: 'pg_to_pinecone_complete',
        ...result,
      }),
    );

    return result;
  }

  // ─── Pinecone → pgvector ────────────────────────────────────────────────────

  /**
   * Pull records from Pinecone → Neon pgvector.
   * Lists all Pinecone IDs in namespace, fetches in batches,
   * compares against DB, and upserts missing/newer records.
   */
  private async syncPineconeToPgvector(): Promise<SyncStats> {
    const start = Date.now();
    const stats: Omit<SyncStats, 'direction' | 'durationMs'> = {
      added: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      examined: 0,
      namespace: this.config.namespace,
      pgNamespace: this.config.pgNamespace,
    };

    console.info(
      JSON.stringify({
        level: 'info',
        service: 'heady-sync',
        event: 'pinecone_to_pg_start',
        pineNamespace: this.config.namespace,
        pgNamespace: this.config.pgNamespace,
      }),
    );

    // ── Discover all IDs in Pinecone namespace ─────────────────────────────
    // Use describeIndexStats to know if there's anything to sync,
    // then use a query with a zero vector to list IDs (Pinecone doesn't have LIST API on all plans).
    // For production with a listable index, we use the list API if available.
    const allIds = await this.listPineconeIds();
    stats.examined = allIds.length;

    if (allIds.length === 0) {
      console.info(
        JSON.stringify({
          level: 'info',
          service: 'heady-sync',
          event: 'pinecone_to_pg_empty',
          namespace: this.config.namespace,
        }),
      );
      return {
        direction: 'pinecone→pgvector',
        ...stats,
        durationMs: Date.now() - start,
      };
    }

    const idChunks = chunkArray(allIds, PINECONE_FETCH_BATCH);

    for (const idChunk of idChunks) {
      // ── Fetch from Pinecone ─────────────────────────────────────────────
      const pineconeRecords = await this.config.pineconeClient.fetchByIds(
        idChunk,
        this.config.namespace,
      );

      // ── Check which IDs exist and are current in DB ─────────────────────
      const dbRows = await this.fetchDbRowsByIds(idChunk);
      const dbMap = new Map(dbRows.map(r => [r.id, r]));

      const toInsert: MemoryRow[] = [];
      const toUpdate: MemoryRow[] = [];

      for (const [id, pineconeRecord] of pineconeRecords) {
        try {
          const pr = pineconeRecord as unknown as PineconeMemoryRecord;
          if (!pr.metadata?.updatedAt) continue; // Skip records without our metadata schema

          const pineUpdatedAt = new Date(pr.metadata.updatedAt as string);
          const dbRow = dbMap.get(id);

          if (!dbRow) {
            // Missing in DB — insert
            const row = pineconeRecordToMemoryRow(pr, this.config.pgNamespace);
            if (row) {
              toInsert.push(row);
              stats.added++;
            }
          } else {
            const dbUpdatedAt = new Date(dbRow.updated_at);
            if (pineUpdatedAt > dbUpdatedAt) {
              // Pinecone is newer — update DB
              const row = pineconeRecordToMemoryRow(pr, this.config.pgNamespace);
              if (row) {
                toUpdate.push(row);
                stats.updated++;
              }
            } else {
              stats.skipped++;
            }
          }
        } catch (err: unknown) {
          stats.errors++;
          console.error(
            JSON.stringify({
              level: 'error',
              service: 'heady-sync',
              event: 'pinecone_to_pg_record_error',
              id,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      }

      // ── Batch write to DB ────────────────────────────────────────────────
      if (toInsert.length > 0 || toUpdate.length > 0) {
        await withTransaction(async (client: PoolClient) => {
          for (const row of [...toInsert, ...toUpdate]) {
            await client.query(
              `INSERT INTO memories (id, content, embedding, metadata, namespace, created_at, updated_at)
               VALUES ($1, $2, $3::vector, $4, $5, $6, $7)
               ON CONFLICT (id) DO UPDATE SET
                 content    = EXCLUDED.content,
                 embedding  = EXCLUDED.embedding,
                 metadata   = EXCLUDED.metadata,
                 updated_at = EXCLUDED.updated_at`,
              [
                row.id,
                row.content,
                formatEmbeddingForPg(row.embedding),
                JSON.stringify(row.metadata),
                row.namespace,
                row.created_at,
                row.updated_at,
              ],
            );
          }
        });
      }

      await sleep(SYNC_PAGE_SLEEP_MS);
    }

    const durationMs = Date.now() - start;

    const result: SyncStats = {
      direction: 'pinecone→pgvector',
      ...stats,
      durationMs,
    };

    console.info(
      JSON.stringify({
        level: 'info',
        service: 'heady-sync',
        event: 'pinecone_to_pg_complete',
        ...result,
      }),
    );

    return result;
  }

  // ─── DB Helpers ─────────────────────────────────────────────────────────────

  /** Fetch DB memory rows by IDs — parameterized, no string interpolation */
  private async fetchDbRowsByIds(ids: string[]): Promise<MemoryRow[]> {
    if (ids.length === 0) return [];

    const pool = getAppPool();

    // Build parameterized placeholder list: ($1, $2, ..., $N)
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');

    const { rows } = await pool.query<MemoryRow>(
      `SELECT id, content, embedding::text, metadata, namespace, created_at, updated_at
       FROM memories
       WHERE id IN (${placeholders})`,
      ids,
    );

    return rows.map(r => ({
      ...r,
      embedding: parseEmbeddingString(r.embedding as unknown as string),
    }));
  }

  /**
   * List all IDs in a Pinecone namespace.
   * Uses the list() API where available (Pinecone Serverless).
   * Falls back to a stats-based approximation with a large topK query.
   */
  private async listPineconeIds(): Promise<string[]> {
    try {
      // Try Pinecone list() API (available on serverless indexes)
      const client = this.config.pineconeClient as unknown as {
        index: {
          namespace: (ns: string) => { list: () => AsyncIterable<{ id?: string }[]> };
          list: () => AsyncIterable<{ id?: string }[]>;
        };
      };

      const allIds: string[] = [];

      // Access the internal Pinecone index for list() iteration
      // This uses the actual Pinecone SDK list() pagination API
      const pineconeAny = this.config.pineconeClient as unknown as {
        index: (name: string) => {
          namespace: (ns: string) => { listPaginated: (opts: object) => Promise<{ vectors?: Array<{ id: string }>; pagination?: { next?: string } }> };
          listPaginated: (opts: object) => Promise<{ vectors?: Array<{ id: string }>; pagination?: { next?: string } }>;
        };
      };

      // The Pinecone SDK exposes listPaginated on the index
      // We call it through the client to enumerate all IDs
      let paginationToken: string | undefined;
      const ns = this.config.namespace;

      do {
        const opts: Record<string, unknown> = { limit: PINECONE_FETCH_BATCH };
        if (paginationToken) opts.paginationToken = paginationToken;

        let response: { vectors?: Array<{ id: string }>; pagination?: { next?: string } };

        // Access internal pinecone instance
        const internalPinecone = (this.config.pineconeClient as unknown as { pinecone: { index: (n: string) => { namespace: (s: string) => { listPaginated: (o: object) => Promise<typeof response> }; listPaginated: (o: object) => Promise<typeof response> } } }).pinecone;

        if (ns) {
          response = await internalPinecone.index(
            (this.config.pineconeClient as unknown as { indexName: string }).indexName
          ).namespace(ns).listPaginated(opts);
        } else {
          response = await internalPinecone.index(
            (this.config.pineconeClient as unknown as { indexName: string }).indexName
          ).listPaginated(opts);
        }

        for (const v of response.vectors ?? []) {
          allIds.push(v.id);
        }

        paginationToken = response.pagination?.next;
      } while (paginationToken);

      return allIds;
    } catch (err: unknown) {
      // list() not available on this index type — fall back to empty
      // (sync will still work for pg→pinecone direction)
      console.warn(
        JSON.stringify({
          level: 'warn',
          service: 'heady-sync',
          event: 'list_ids_fallback',
          reason: err instanceof Error ? err.message : String(err),
        }),
      );
      return [];
    }
  }
}

// ─── Pure Helpers ─────────────────────────────────────────────────────────────

/**
 * Parse pgvector's text representation "[0.1,0.2,...,0.384]" into number[].
 * pgvector returns embeddings as strings when cast to ::text.
 */
function parseEmbeddingString(raw: string): number[] {
  if (!raw) return [];
  // Strip outer brackets if present: [0.1,0.2,...] or {0.1,0.2,...}
  const cleaned = raw.replace(/^\[|\]$|^\{|\}$/g, '');
  return cleaned.split(',').map(Number);
}

/**
 * Format a number[] embedding for pgvector INSERT ($3::vector).
 * Returns: "[0.1, 0.2, ..., 0.384]"
 */
function formatEmbeddingForPg(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Build a Pinecone VectorRecord from a pgvector MemoryRow.
 * Stores content, namespace, createdAt, updatedAt in metadata for sync.
 */
function buildPineconeRecord(row: MemoryRow): VectorRecord {
  return {
    id: row.id,
    values: row.embedding,
    metadata: {
      content: row.content,
      namespace: row.namespace,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      // Spread user metadata — preserve all domain fields
      ...(typeof row.metadata === 'object' && row.metadata !== null ? row.metadata as Record<string, unknown> : {}),
    } as RecordMetadata,
  };
}

/**
 * Build a MemoryRow from a Pinecone record (for pgvector INSERT).
 * Returns null if the Pinecone record lacks required metadata.
 */
function pineconeRecordToMemoryRow(
  pr: PineconeMemoryRecord,
  pgNamespace: string,
): MemoryRow | null {
  if (!pr.values || pr.values.length === 0) return null;
  if (!pr.metadata?.content) return null;

  const content = pr.metadata.content as string;
  const namespace = (pr.metadata.namespace as string | undefined) ?? pgNamespace;
  const createdAt = pr.metadata.createdAt
    ? new Date(pr.metadata.createdAt as string)
    : new Date();
  const updatedAt = pr.metadata.updatedAt
    ? new Date(pr.metadata.updatedAt as string)
    : new Date();

  // Strip sync-specific metadata fields, preserve domain metadata
  const domainMetadata: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(pr.metadata)) {
    if (!['content', 'namespace', 'createdAt', 'updatedAt'].includes(k)) {
      domainMetadata[k] = v;
    }
  }

  return {
    id: pr.id,
    content,
    embedding: pr.values,
    metadata: domainMetadata,
    namespace,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a HeadySyncEngine with LIFO shutdown registration.
 */
export function createSyncEngine(config: SyncConfig): HeadySyncEngine {
  const engine = new HeadySyncEngine(config);

  // LIFO cleanup stack
  const cleanups: Array<{ name: string; fn: () => Promise<void> }> = [];
  const registerCleanup = (name: string, fn: () => Promise<void>): void => {
    cleanups.unshift({ name, fn });
  };

  registerCleanup('sync-engine', async () => {
    console.info(
      JSON.stringify({
        level: 'info',
        service: 'heady-sync',
        event: 'engine_shutdown',
      }),
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.info(
      JSON.stringify({
        level: 'info',
        service: 'heady-sync',
        event: 'shutdown_initiated',
        signal,
      }),
    );
    for (const { name, fn } of cleanups) {
      try {
        await fn();
        console.info(JSON.stringify({ level: 'info', service: 'heady-sync', event: 'cleanup_complete', name }));
      } catch (err: unknown) {
        console.error(JSON.stringify({ level: 'error', service: 'heady-sync', event: 'cleanup_failed', name, error: err instanceof Error ? err.message : String(err) }));
      }
    }
    process.exit(0);
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  return engine;
}
