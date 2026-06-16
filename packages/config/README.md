# @heady/config

The **`facts.yaml` golden record** loader + validation + fail-closed env access. `facts.yaml` (repo root) is the single source of derived facts (DX-01); README badges, CI matrices, and OpenAPI servers should generate from it.

```js
import { loadFacts, getFact, requireEnv } from "@heady/config";

loadFacts();                       // parse + validate facts.yaml (cached)
getFact("embedding.dim");          // 384
getFact("stores.retrieval_authority"); // "pgvector"
requireEnv("DATABASE_URL");        // throws if missing; rejects loopback addresses (AGENTS.md #4)
```

- `parseYaml` — dependency-free reader for the controlled facts.yaml subset (nested maps, scalar lists, scalars, comments). A full `yaml` parser can replace it without API change.
- `validateFacts` — enforces required keys + locked invariants (`embedding.dim === 384`, `retrieval_authority === pgvector`).

Depends on `@heady/shared`. `pnpm --filter @heady/config test`.
