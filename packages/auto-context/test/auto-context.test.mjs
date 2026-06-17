// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Auto-Context unit tests                                  ║
// ║  Validates WAL projection, count-parity, and reconciliation.     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import { VectorizeProjector } from "../src/index.mjs";

class MockVectorize {
  constructor() {
    this.store = new Map();
  }
  async insert(vectors) {
    for (const v of vectors) {
      this.store.set(v.id, v);
    }
  }
  async delete(ids) {
    for (const id of ids) {
      this.store.delete(id);
    }
  }
  async listIds() {
    return Array.from(this.store.keys());
  }
}

class MockDb {
  constructor() {
    this.rows = [];
  }
  async query(sql) {
    if (sql.includes("SELECT id FROM vector_memory")) {
      const sorted = [...this.rows].sort((a, b) => a.id.localeCompare(b.id));
      return { rows: sorted.map((r) => ({ id: r.id })) };
    }
    if (sql.includes("SELECT id, embedding::text, metadata FROM vector_memory")) {
      const rows = this.rows.map((r) => ({
        id: r.id,
        embedding: `[${r.embedding.join(",")}]`,
        metadata: r.metadata,
      }));
      return { rows };
    }
    throw new Error("MockDb unhandled query: " + sql);
  }
}

test("VectorizeProjector validates setup parameters", () => {
  assert.throws(() => new VectorizeProjector({}), TypeError);
  assert.throws(() => new VectorizeProjector({ vectorizeClient: {} }), TypeError);
});

test("VectorizeProjector projects INSERT / DELETE events from WAL", async () => {
  const db = new MockDb();
  const edge = new MockVectorize();
  const proj = new VectorizeProjector({ dbClient: db, vectorizeClient: edge });

  const vec = new Array(384).fill(0.1);
  
  // Insert
  await proj.project({
    op: "INSERT",
    table: "vector_memory",
    row: { id: "id-1", embedding: vec, metadata: { kind: "observation" } },
  });
  
  assert.equal(edge.store.size, 1);
  assert.ok(edge.store.has("id-1"));
  assert.deepEqual(edge.store.get("id-1").values, vec);

  // Delete
  await proj.project({
    op: "DELETE",
    table: "vector_memory",
    row: { id: "id-1" },
  });

  assert.equal(edge.store.size, 0);
});

test("VectorizeProjector detects sync drift (parity & hash)", async () => {
  const db = new MockDb();
  const edge = new MockVectorize();
  const proj = new VectorizeProjector({ dbClient: db, vectorizeClient: edge });

  const vec = new Array(384).fill(0.1);
  db.rows.push({ id: "id-1", embedding: vec, metadata: {} });
  await edge.insert([{ id: "id-1", values: vec, metadata: {} }]);

  // In sync
  const res1 = await proj.verifyParity();
  assert.ok(res1.ok);
  assert.ok(res1.countParity);
  assert.equal(res1.hashDrift, false);

  // Drift in counts
  db.rows.push({ id: "id-2", embedding: vec, metadata: {} });
  const res2 = await proj.verifyParity();
  assert.equal(res2.ok, false);
  assert.equal(res2.countParity, false);

  // Parity reconciled
  await edge.insert([{ id: "id-2", values: vec, metadata: {} }]);
  const res3 = await proj.verifyParity();
  assert.ok(res3.ok);

  // Hash drift (different keys but same count)
  await edge.delete(["id-1"]);
  await edge.insert([{ id: "id-3", values: vec, metadata: {} }]);
  const res4 = await proj.verifyParity();
  assert.equal(res4.ok, false);
  assert.ok(res4.countParity); // counts match (2 vs 2)
  assert.ok(res4.hashDrift); // keys mismatched (id-1,id-2 vs id-2,id-3)
});

test("VectorizeProjector reconciles stores correctly", async () => {
  const db = new MockDb();
  const edge = new MockVectorize();
  const proj = new VectorizeProjector({ dbClient: db, vectorizeClient: edge });

  const vec = new Array(384).fill(0.1);
  db.rows.push({ id: "id-1", embedding: vec, metadata: { importance: 0.9 } });
  db.rows.push({ id: "id-2", embedding: vec, metadata: { importance: 0.5 } });

  // Out of sync state at edge (id-3 is stale, id-1/id-2 missing)
  await edge.insert([{ id: "id-3", values: vec, metadata: {} }]);

  await proj.reconcile();

  const parity = await proj.verifyParity();
  assert.ok(parity.ok);
  assert.equal(edge.store.size, 2);
  assert.ok(edge.store.has("id-1"));
  assert.ok(edge.store.has("id-2"));
  assert.equal(edge.store.has("id-3"), false);
});
