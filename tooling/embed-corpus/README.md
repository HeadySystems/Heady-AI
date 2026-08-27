<!-- HEADY_BRAND:BEGIN
  HEADY™ · @heady/embed-corpus · LAYER: tooling
  ∞ Sacred Geometry · Liquid Intelligence ∞
HEADY_BRAND:END -->

# @heady/embed-corpus — Gate-Then-Embed Corpus Workflow

The single workflow that **systematically embeds the repository corpus**, but only after
guaranteeing every file is at the current Heady spec and the data is globally consistent.
Embedding never runs against drifted or inconsistent data.

```
heady-embed
```

## Why

"Embed everything" is unsafe if the corpus still references dropped stores (Qdrant), the wrong
embedding dimension, or stale legacy paths — those errors would be baked into the vector index.
This workflow makes spec-conformance and global consistency a **fail-closed precondition** of
embedding, then uses the Merkle-tree trigger (ADR-0023) so only genuinely-changed files are
re-embedded and identical content is never embedded twice (ADR-0024).

## Phases

| # | Phase | What it does | Authority |
|---|-------|--------------|-----------|
| 0 | **spec-sync** | Best-effort legacy→rebuild migration (paths, `pnpm`, store notices). Non-fatal. | `@heady/data-consistency` sync |
| 1 | **consistency-gate** | Runs the global invariant checker. **Any error ⇒ abort, embed nothing**, print the fix list. | ADR-0003 / ADR-0015 / `invariants.json` |
| 2 | **scan** | Collects the gate-governed corpus (canonical + extended) — the embedded set == the governed set. | `invariants.json` scope |
| 3 | **merkle-trigger** | Builds the Merkle index, diffs vs the persisted prior index → added / changed / removed. | ADR-0023 |
| 4 | **embed** | Embeds only new/changed content through the locked model; content-addressed dedup short-circuits the rest. | ADR-0024 / ADR-0015 |
| 5 | **commit** | Atomically writes the durable artifacts under `.data/vector-memory/`. | ADR-0000 (reconstructible) |

## Flags

- `--dry-run` — run every phase, write nothing.
- `--strict` — warnings also block (phase 1).
- `--json` — emit the machine-readable run report.
- `--no-sync` — skip phase 0.
- `--allow-hf` — consent to the non-locked Hugging Face serving path (see below). Off by default.

## Artifacts (`.data/vector-memory/`)

- `merkle-index.json` — the authoritative change-trigger snapshot (ADR-0023).
- `embedding-jobs.json` — the idempotent outbox, keyed by `vectorKey` (effectively-once).
- `ledger.json` — content-address → vector dedup ledger (written when embedding occurs).
- `vectors.json` — the local SoR **projection** of 384-d vectors (stand-in for Neon pgvector on
  dev hosts; reconstructible — never authoritative truth, ADR-0000).
- `embed-corpus-report.json` — the last run's full report.

## Embedder binding

The lock (ADR-0015) pins the **model identity** — `bge-small-en-v1.5`, 384-dim, mean — not the
serving platform.

- **Cloudflare Workers AI** (`@cf/baai/bge-small-en-v1.5`) is the canonical locked serving path,
  selected automatically from `CLOUDFLARE_ACCOUNT_ID` + a Workers AI token. Preferred when present.
- **Hugging Face** (`BAAI/bge-small-en-v1.5`, same weights, lock-equivalent vectors) is a fallback,
  but it transmits corpus content — **including patent-locked IP** — to a third-party inference API.
  It is therefore **fail-safe gated**: ignored unless you explicitly opt in with `--allow-hf` or
  `HEADY_ALLOW_HF_EMBED=1`. An unattended run can never leak IP to an unsanctioned provider.

**No usable/consented binding** ⇒ the workflow emits the merkle index + job outbox and reports
`0 embedded` honestly — it never fabricates vectors. The plan is fully recoverable: because the
ledger (not the merkle diff) is the authority for "embedded", a later run with a binding embeds every
still-missing file. The durable outbox is the same shape `HCEmbedPipeline` (ADR-0024) consumes.

### Activate the locked Cloudflare binding (one step)

The sanctioned binding is wired; it only needs the credential. Inject it (see `.env.example` for the
`[SECRET]` markers / GCP Secret Manager source) and re-run — every still-missing file embeds via the
locked path, no third-party transfer:

```
export CLOUDFLARE_ACCOUNT_ID=…           # non-secret
export CLOUDFLARE_API_TOKEN=…            # [SECRET] — Workers AI:Read
node tooling/embed-corpus/src/embed.mjs  # phase 4 now writes 384-d vectors to the SoR projection
```

## Tests

```
node --test test/workflow.test.mjs        # store + embedder resolver
```

The pure planning/merkle core is tested in `packages/embedding` (`test/corpus.test.mjs`).

---
*Made with ❤️ by HeadySystems Inc.*
