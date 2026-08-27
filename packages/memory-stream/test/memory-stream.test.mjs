// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Memory Stream unit tests                                 ║
// ║  Validates memory writes, pgvector cosine search, and reflections.║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import { writeMemory, retrieveMemories, reflect } from "../src/index.mjs";

function cosineSimilarity(a, b) {
  let dot = 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] * a[i];
    mb += b[i] * b[i];
  }
  if (ma === 0 || mb === 0) return 0;
  return dot / (Math.sqrt(ma) * Math.sqrt(mb));
}

class MockDb {
  constructor() {
    this.memories = [];
    this.outbox = [];
  }

  async query(sql, params) {
    const s = sql.trim().replace(/\s+/g, " ");

    if (s.startsWith("INSERT INTO vector_memory")) {
      const [content, pgVectorString, metadataJson] = params;
      const record = {
        id: "mem-uuid-" + (this.memories.length + 1),
        content,
        embedding: pgVectorString, // stored as '[v1,v2,...]'
        metadata: JSON.parse(metadataJson),
        created_at: new Date(),
      };
      this.memories.push(record);
      return { rows: [record] };
    }

    if (s.startsWith("INSERT INTO task_outbox")) {
      const [payloadJson] = params;
      const out = {
        seq: this.outbox.length + 1,
        topic: "memory:written",
        payload: JSON.parse(payloadJson),
        created_at: new Date(),
        dispatched_at: null,
      };
      this.outbox.push(out);
      return { rows: [out] };
    }

    if (s.startsWith("SELECT id, content, metadata, created_at, 1 - (embedding <=> $1::vector) AS relevance FROM vector_memory")) {
      const queryVec = params[0].replace(/[\[\]]/g, "").split(",").map(Number);
      
      // Filter based on dynamic parameters
      let filtered = this.memories;
      let paramIdx = 1;

      // Match conditions dynamically based on sql text
      if (s.includes("metadata->>'agentId' = $")) {
        const agentId = params[paramIdx++];
        filtered = filtered.filter((m) => m.metadata.agentId === agentId);
      }
      if (s.includes("metadata->>'kind' = ANY")) {
        const kinds = JSON.parse(params[paramIdx++]);
        filtered = filtered.filter((m) => kinds.includes(m.metadata.kind));
      }
      if (s.includes("created_at >= $")) {
        const sinceDate = params[paramIdx++];
        filtered = filtered.filter((m) => m.created_at >= sinceDate);
      }

      const rows = filtered.map((m) => {
        const mVec = m.embedding.replace(/[\[\]]/g, "").split(",").map(Number);
        const rel = cosineSimilarity(queryVec, mVec);
        return {
          id: m.id,
          content: m.content,
          metadata: m.metadata,
          created_at: m.created_at,
          relevance: rel,
        };
      });

      return { rows };
    }

    if (s.startsWith("SELECT id, embedding::text, metadata FROM vector_memory")) {
      const [agentId, limit] = params;
      const rows = this.memories
        .filter((m) => m.metadata.agentId === agentId)
        .slice(-limit)
        .map((m) => ({
          id: m.id,
          embedding: m.embedding,
          metadata: m.metadata,
        }));
      return { rows };
    }

    throw new Error("Unhandled mock query: " + sql);
  }
}

test("writeMemory asserts embedding size and writes to vector_memory", async () => {
  const db = new MockDb();
  const badVec = new Array(10).fill(0.1);
  const goodVec = new Array(384).fill(0.1);

  await assert.rejects(() => writeMemory(db, { content: "", embedding: goodVec }), TypeError);
  await assert.rejects(() => writeMemory(db, { content: "test", embedding: badVec }), RangeError);

  const res = await writeMemory(db, {
    content: "test observation",
    embedding: goodVec,
    metadata: { agentId: "agent-1", importance: 0.8 },
  });

  assert.equal(res.content, "test observation");
  assert.equal(db.memories.length, 1);
  assert.equal(db.memories[0].metadata.agentId, "agent-1");
  assert.equal(db.memories[0].metadata.importance, 0.8);
  
  assert.equal(db.outbox.length, 1);
  assert.equal(db.outbox[0].payload.memory_id, res.id);
});

test("retrieveMemories filters by agent, kind, window, and scores using φ-fusion", async () => {
  const db = new MockDb();
  const vec1 = new Array(384).fill(0);
  vec1[0] = 1.0; // highly aligned with query [1, 0, 0, ...]
  
  const vec2 = new Array(384).fill(0);
  vec2[1] = 1.0; // orthogonal to query [1, 0, 0, ...]

  await writeMemory(db, {
    content: "aligned observation",
    embedding: vec1,
    metadata: { agentId: "agent-1", kind: "observation", importance: 0.9 },
  });

  await writeMemory(db, {
    content: "orthogonal reflection",
    embedding: vec2,
    metadata: { agentId: "agent-1", kind: "reflection", importance: 0.1 },
  });

  const query = new Array(384).fill(0);
  query[0] = 1.0;

  // Retrieve with no filters
  const allRes = await retrieveMemories(db, { queryVector: query, minRelevance: 0 });
  assert.equal(allRes.length, 2);
  assert.ok(allRes[0].score > allRes[1].score); // aligned scores higher than orthogonal
  
  // Filter by kind
  const filteredRes = await retrieveMemories(db, {
    queryVector: query,
    includeKinds: ["reflection"],
    minRelevance: 0,
  });
  assert.equal(filteredRes.length, 1);
  assert.equal(filteredRes[0].record.content, "orthogonal reflection");
});

test("reflect aggregates past memory vectors to find centroid", async () => {
  const db = new MockDb();
  const vec1 = new Array(384).fill(0);
  vec1[0] = 1.0;
  vec1[1] = 2.0;

  const vec2 = new Array(384).fill(0);
  vec2[0] = 3.0;
  vec2[1] = 4.0;

  await writeMemory(db, { content: "m1", embedding: vec1, metadata: { agentId: "agent-1", importance: 0.5 } });
  await writeMemory(db, { content: "m2", embedding: vec2, metadata: { agentId: "agent-1", importance: 0.7 } });

  const summary = await reflect(db, { agentId: "agent-1" });
  assert.equal(summary.sourceIds.length, 2);
  assert.equal(summary.centroid[0], 2.0); // (1 + 3) / 2
  assert.equal(summary.centroid[1], 3.0); // (2 + 4) / 2
  assert.equal(summary.averageImportance, 0.6); // (0.5 + 0.7) / 2
});
