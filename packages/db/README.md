# @heady/db

Neon Postgres + pgvector system of record. Canonical DDL in `migrations/0001_init.sql` (tasks, `task_dep`, `task_attempt`, **transactional `task_outbox`**, `idempotency_key`, `vector_memory` at **`vector(384)`** + HNSW). Pure helpers encode the invariants so they test without a live DB.

```js
import { idempotencyKey, buildOutboxRecord, assertEmbedding, VECTOR_DIM, TABLES } from "@heady/db";

idempotencyKey("embed", "doc", { id: 1 });   // "embed:<sha256…>" — deterministic dedupe
buildOutboxRecord({ taskId, topic: "heady.observation.task.done", payload }); // insert in-tx with the state change
assertEmbedding(vec);                          // throws unless vec is 384-dim finite (rejects the 1536 drift)
VECTOR_DIM;                                    // 384 (ADR-0015)
```

Outbox is written in the **same transaction** as the state change (ADR-0002), then projected via WAL/CDC (ADR-0014). Drizzle/`pg` wire the connection at the app layer. Pure ESM core, zero deps. `pnpm --filter @heady/db test`.
