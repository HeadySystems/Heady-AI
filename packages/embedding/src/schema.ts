// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Embedding — Drizzle schema (Neon + pgvector authority)    ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
// Drizzle schema for the embedding pipeline (Neon + pgvector). Canonical stack.
// Three tables: the vector store (authority), the content-addressed ledger (dedup), and the
// embedding-jobs outbox (durable, idempotent). DDL lands via expand→migrate→contract (ADR-0007).
import { pgTable, text, integer, timestamp, jsonb, vector, index, uniqueIndex } from "drizzle-orm/pg-core";

// Authority store: 384-d vectors (ADR-0003). HNSW index (m=16, ef_construction=200).
export const vectors = pgTable(
  "vectors",
  {
    id: text("id").primaryKey(), // = vectorKey(content, model): "<sha256>:<modelId>:<version>"
    sourceId: text("source_id").notNull(), // FK to the owning record (event/fact/skill/doc)
    sourceKind: text("source_kind").notNull(),
    contentHash: text("content_hash").notNull(),
    embeddingModelVersion: text("embedding_model_version").notNull(), // ADR-0015 provenance
    embedding: vector("embedding", { dimensions: 384 }).notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }).defaultNow().notNull(),
    embeddedAt: timestamp("embedded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    hnsw: index("vectors_embedding_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops")),
    byHash: index("vectors_content_hash").on(t.contentHash),
    bySource: index("vectors_source").on(t.sourceKind, t.sourceId),
  }),
);

// Dedup ledger (Rule 2): content-address → existing vector. A hit short-circuits the pipeline.
export const embeddingLedger = pgTable(
  "embedding_ledger",
  {
    key: text("key").primaryKey(), // = vectorKey
    vectorId: text("vector_id").notNull(),
    refCount: integer("ref_count").default(1).notNull(), // many sources may share one vector
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
);

// Embedding-jobs outbox (Rules 1 & 4): durable, idempotent. Enqueued in the SAME tx as the source
// write (ADR-0002 outbox). Consumed by HCEmbedPipeline. Unique key ⇒ effectively-once.
export const embeddingJobs = pgTable(
  "embedding_jobs",
  {
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(), // = vectorKey
    sourceId: text("source_id").notNull(),
    sourceKind: text("source_kind").notNull(),
    content: text("content").notNull(),
    significantFields: jsonb("significant_fields").$type<string[]>(),
    state: text("state").notNull().default("QUEUED"), // mirrors core.JOB_STATES
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    idem: uniqueIndex("embedding_jobs_idem").on(t.idempotencyKey),
    pending: index("embedding_jobs_state").on(t.state),
  }),
);
