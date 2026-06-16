# 11 — Reconciliation Register (vision ↔ canonical)

> Every point where the **vision layer** (V9 super prompt, the 88KB blueprint, the maximalist skills/bees)
> disagrees with the **canonical layer** (REBUILD_PLAN_V2 + ADRs 0000–0018), with the resolution and its
> rationale. This is the authoritative tie-breaker; `00-INDEX.md` carries the summary table.

Resolution principles (in priority order): **(1)** newer founder-authored material wins over older;
**(2)** "one authority per concern" + "≤1 net-new platform/phase" (ADR-0002/0013); **(3)** derived stores
must be reconstructible from the SoR (ADR-0000); **(4)** pre-launch = no migration cost, so drop unused
things rather than carry them; **(5)** dependency minimalism (founder directive).

---

## R1 — Frontend stack · **RESOLVED**

- **Vision:** V9 Law 3 (March 2026), constitutional: "Drupal 11 + Twig + Vanilla ES2024 — no React/Vue/
  Vite/Tailwind. **Ever.**"
- **Canonical:** the MCP Console design-zip (`.jsx`) + Native Interface spec (React + Vite + assistant-ui),
  June 2026.
- **Resolution:** V9 Law 3 is **stale / non-binding** (founder confirmed). **Dependency minimalism:**
  default to vanilla + Twig + web components (no build step); reach for React/Vite **only when complexity
  earns it** — agent console, MCP console, portal. Decide per surface: "does the complexity justify the
  dependency?"
- **Rationale:** newer founder material + explicit directive. Content sites stay no-build/sovereign;
  genuinely complex interactive surfaces get the right tool. **Canonical ADR: ADR-0019.** **Affects:**
  `01`, `06-G1`, `07-T6`, `08`, `09-I6/I7`.

## R2 — Vector stores (Qdrant) · **RESOLVED → ADR-0003 amended**

- **Vision:** 3-tier — Upstash + pgvector + **Qdrant** (T2 hot/warm), evolution → Upstash Vector DiskANN.
- **Canonical:** pgvector = sole authority; **Vectorize = derived edge cache**; Redis/KV best-effort
  TTL≤60s; **Qdrant dropped.**
- **Resolution:** drop Qdrant (absent from the five-tier synthesis, provisioned-but-unused, free pre-launch
  to decommission); Vectorize promoted from "deferred" to "permitted derived cache." Reintroduce a second
  vector engine only via an ADR-0013 evidence gate (benchmark proving pgvector is the bottleneck).
- **Rationale:** one authority per concern; reconstructibility (ADR-0000). **Affects:** `04`, `09-I3`,
  ADR-0003 (amended), ADR-0014/0015.

## R3 — Cryptography (PQC vs Ed25519) · **RESOLVED → dual-track**

- **Vision:** V9 Law 4: "PQC everywhere. **Ed25519 RETIRED.** ML-DSA-65 / ML-KEM-768 / SLH-DSA."
- **Canonical:** the HCP approval system + trust receipts use **Ed25519** signed receipts (mature tooling,
  JWK + opa-wasm verifiable).
- **Resolution:** **Ed25519 is the pragmatic baseline now; PQC is Phase-4 aspirational**, adopted when the
  library/KMS ecosystem is ready, via a **dual-sign transition** (sign with both, verify either) — never a
  flag-day swap. Document as a future PQC-transition ADR.
- **Rationale:** PQC tooling for app-layer signing is immature; shipping correctness now beats blocking on
  it. **Affects:** `06-G9`, `09-I5`.

## R4 — Swarm scale (24 domains / 197 bees / 10,000 concurrent / 87 ports) · **RESOLVED → vocabulary kept, runtime reduced**

- **Vision:** 24 swarm domains, up to 197 worker bees, ≤10,000 concurrent, one process per bee on ports
  3310–3396, 4× Colab GPU, 17-swarm matrix.
- **Canonical:** modular monolith; bees = functions/skill-rows; single-agent-first (ADR-0005); concurrency
  bounded by circuit-breaker + token budget.
- **Resolution:** **keep the full vocabulary** (it's the design language and the skill/handler taxonomy);
  **reduce the runtime** — a "bee" is a handler invoked as a Workflow step / Queue consumer / MCP tool; a
  "domain" is a bounded context; port numbers are logical addressing, not network bindings; "10,000
  concurrent" is a capacity statement, not a target; a swarm spins only when tool-overlap/prompt-
  complexity proves it's needed.
- **Rationale:** ≤1 platform/phase, founder-attention scarcity (ADR-0013), single-agent-first consensus.
  **Affects:** `02` (whole file), `03-P4`.

## R5 — Monorepo layout · **RESOLVED**

- **Vision:** blueprint workspace = `apps/ packages/ shared/ services/`.
- **Canonical:** scaffold = `apps/ packages/ tooling/ configs/`.
- **Resolution:** keep the scaffold's four dirs. `shared/` → `packages/` (e.g. `phi-math`, `csl-engine`
  are packages); `services/` → bounded contexts inside the Cloud Run monolith (`core/modules/*`), not 50
  service dirs. **Rationale:** R4 (no 50 services) + the existing scaffold is canonical (ADR-0001).
  **Affects:** repo structure, `02`, `03-P4`.

## R6 — CSL thresholds · **RESOLVED → two complementary roles**

- **Vision:** two ladders — V9 ranges (PRIME 0.718 / BOOST 0.618 / RECALL 0.382) and the blueprint ladder
  (DEDUP .972 … MIN .500 via `1 − ψ^level × 0.5`).
- **Resolution:** adopt **V9's ψ-anchored cuts as the canonical routing gate** (HALT <0.382 / CAUTIOUS
  ≥0.382 / EXECUTE ≥0.618); use the **blueprint ladder as privileged-action sub-gates** (DEDUP→serve
  cache, CRITICAL→authorize high-privilege write, MEDIUM→trigger self-heal). They are not in conflict —
  one routes, the other authorizes. **Rationale:** both φ-derived; different purposes. **Affects:** `01-G`,
  `06-G2`.

## R7 — "Instantaneous, no-queue, all-parallel" pipeline · **RESOLVED → DAG on durable queues**

- **Vision:** V9 §0 #1 rule — "remove all priorities/queues; every task/bee/swarm fires at once;
  instantaneous dispatch."
- **Canonical:** transactional outbox + durable Cloudflare Workflows/Queues + idempotency (ADR-0002/0006).
- **Resolution:** the **data-dependency DAG is real and honored** (stages fire when inputs are ready), but
  **durable queues/outbox are required** — "no queues" is rejected. "Instantaneous" = no *artificial
  priority ordering*, not *no durability*. **Rationale:** at-least-once delivery + crash recovery are
  non-negotiable for a system of record. **Affects:** `03-P1`, `07-T8`.

## R8 — Event bus (NATS vs outbox) · **RESOLVED**

- **Vision:** NATS JetStream (QueueBee, `heady-event-bus`) + Redis Streams for tasks.
- **Resolution:** the **durable cross-boundary write path = pgmq outbox + Cloudflare Queues** (ADR-0002,
  non-negotiable). NATS/Redis-Streams permitted as **best-effort in-flight distribution** (e.g. Colab
  fan-out), never authoritative, never the write path. **Affects:** `07-T8`, `09-I3`.

## R9 — Budget figures ($618 vs $987) · **RESOLVED (cosmetic)**

- Both describe "lean ~$600/mo infra." Canonical: **$610 infra + $377 API = $987 ceiling** (φ-pure, V9
  §27); "$618/mo" is a rounded shorthand in the blueprint. Use the $610/$377/$987 breakdown.

## R10 — Determinism vs LLM nondeterminism · **NOTED**

- **Vision:** Law 5 — "same input hash → same output (temp=0, seed=42)."
- **Reality:** LLMs are not bit-deterministic even at temp=0. **Resolution:** determinism applies to
  Heady's *own* logic (CSL gates, φ-math, routing, hashing) and to *replay* (seeded PRNG in Arena/
  Monte-Carlo); LLM calls are treated as opaque and guarded by evals run **3× median** to absorb flake
  (ADR-0011 eval gates). Not a contradiction once scoped. **Affects:** `01-L2`, `03-P5`.

## R11 — Re-index trigger: Merkle vs CDC · **RESOLVED → two triggers, two sources**

- **Conflict:** ADR-0023 (was 0018, "Accepted") makes **Merkle-tree file hashing** the authoritative
  re-index trigger and *rejects Postgres CDC*; ADR-0014 mandates **WAL-driven CDC**.
- **Resolution:** they operate on different sources. **Merkle hashing** triggers re-embedding when
  *source files* change (file/code indexing, `heady-merkle-index`). **WAL CDC** keeps *derived stores*
  (Vectorize/KV) in sync with the *database* system of record (ADR-0014). ADR-0023's "reject CDC" is
  scoped to file-level syncs only. Its "re-embed into Qdrant" clause is superseded by R2.
- **Affects:** ADR-0014, ADR-0023, `04-M4`, `07-T4`.

## R12 — Agent sandbox: WASM WebContainers vs Cloudflare Sandboxes · **RESOLVED → scoped by purpose**

- **Conflict:** ADR-0021 (was 0016, "Accepted") makes **WASM WebContainers** the primary agent sandbox;
  ADR-0016 (Native Interface, newer) uses **Cloudflare Sandboxes + Outbound Workers**.
- **Resolution:** **Cloudflare Sandboxes** = the server-side agent dev-loop (build/test/eval with creds
  held in the Worker); **WASM WebContainers** = in-browser instant preview for user-facing live coding
  (`heady-web-container`). Newer wins for the agent loop. **Affects:** ADR-0016, ADR-0021, `06-G8`.

## R13 — State sync: SSE vs WebSocket · **RESOLVED → scoped by direction**

- **Conflict:** ADR-0022 (was 0017) makes **SSE+HTTP/2** canonical and avoids WebSockets; the agent shell
  uses **WebSocket** over a Durable Object.
- **Resolution:** **SSE+HTTP/2** for unidirectional server→client state sync (dashboards, console
  health); **WebSocket** reserved for the bidirectional agent session (streaming, approvals, terminal).
  Yjs CRDTs for multiplayer editing only. **Affects:** ADR-0022, `07-T8`.

## ADR numbering note (consistency fix, 2026-06-15)

An earlier "Accepted" set used numbers **0014–0018** (frontend, event-bus, sandbox, state-sync,
vector-trigger), colliding with the v2 set. The earlier set was **renumbered to 0019–0023** and each
given a v2 Reconciliation section (R1/R8/R11/R12/R13). The v2 set keeps 0014–0018. No content was deleted.

---

## Disposition legend (used across the compendium)

- **baseline / canonical** — build it as described; it's in v2/ADRs.
- **reconciled (Rn)** — kept but modified; see the matching entry here.
- **deferred / Phase-4 / evidence-gated** — real, but only after a benchmark + flag + rollback (ADR-0013).
- **superseded** — recorded for provenance; not built as the vision stated.
- **research-only** — opaque/aspirational; do not bake architectural assumptions on it (e.g. latent
  reasoning, RSI self-improvement benchmarks).
