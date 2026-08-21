<!-- HEADY_BRAND:BEGIN
Heady™ Claude Context Transfer Report
Layer: governed knowledge ingestion
© 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->

# Claude Context Transfer — 2026-08-21

## Executive overview

Claude's Heady-AI history was analyzed as a legacy evidence corpus, not as a new authority. The
beneficial material is now reduced to a safe, provenance-bearing context pack for Heady and Codex.
Raw transcripts, credentials, private identifiers, copied worktree snapshots, and unverified live
claims are intentionally excluded.

The highest-value transfer is operational rather than textual: preserve authority boundaries,
build invariants before agents, treat latent/vector state as derived, protect dirty worktrees from
concurrent writers, verify governance acts cryptographically, and revalidate all production claims.

## Raw inputs

| Source | Inventory | Use |
|---|---:|---|
| `~/.claude/projects/-home-headyme-Heady-AI/*.jsonl` | 10 sessions, 2026-07-16 through 2026-08-10 | Requests, actions, outcomes, and failure modes |
| `~/.claude/projects/-home-headyme-Heady-AI/memory/*.md` | 54 curated notes | Primary topic index and durable lessons |
| `~/.claude/history.jsonl` | 164 KiB | Session discovery only |
| `~/.claude/file-history/` | 393 snapshots, about 3 MiB | Recovery evidence only; not knowledge |
| `~/.claude/settings*.json` and project `.claude/` | Settings plus generated command/skill surfaces | Configuration inventory; no credentials copied |
| `~/.agents/workflows/` and `~/.agents/skills/` | 25 workflows and 7 global skills | Compared with the canonical repository surfaces |
| Codex memory registry | Existing Heady governance and deployment lessons | Deduplication target |

Primary source fingerprints at analysis time:

- Claude memory index SHA-256: `e21c51b59c341ab034f24b890b5277ed2a9b2cd101c906655dea6d9fceaf859a`
- Claude legacy-transfer note SHA-256: `8e1e696d181d1507184930b80668cf04ee37ff8bd0ef8d874e615a0a24812888`
- Claude prompt-history index SHA-256: `65d1e66809d8dab4fd43992f93bc20093d53b5ec02c40ea7dbd49cd48e3a31c3`

## Authority and trust model

Use this order when Claude-derived material conflicts with the current tree:

1. `AGENTS.md`, governance rules, accepted ADRs, and exact signed acceptance artifacts.
2. Validated facts, schemas, contracts, migrations, and implementation evidence.
3. Current deployed-state verification for routes, auth, stores, and service revisions.
4. Living explanations and this transfer report.
5. Claude memories, transcripts, archived plans, and assistant claims.

Claude history is evidence of what was attempted or believed at the time. It is never sufficient
proof of a production deployment, a database migration, a founder acceptance, or current canonical
state.

## Beneficial context transferred

### Build and architecture

- Build invariant-first and agent-last. The durable sequence is φ-math, CSL, fact schema, facts,
  coherence and executable laws, consistency boundaries, contracts, durable stores, then nodes,
  bees, swarms, and other derived positions.
- Durable relationships are more important than stored coordinates. Treat knowledge nodes and
  correlation density as durable semantics; derive visual or vector positions as projections.
- The Field is durable and append-only; agents are ephemeral workers that hold no authoritative
  private state. Avoid external claims of machine consciousness.
- Latent/vector memory is always derived. Neon/pgvector is the retrieval authority, Vectorize is a
  reconstructible edge cache, and Redis/KV is best-effort hot state.
- File indexing uses Merkle hashing. Runtime/database-derived projections use the governed database
  event path. These are separate triggers for separate source classes.
- Prefer dependency-minimal UI. Vanilla Web Components are the default; React is justified for a
  genuinely complex isolated canvas or interaction surface.

### Governance and safety

- Chat approval does not create a cryptographic founder signature. Verify the exact object, digest,
  signer, and signed tag before recording governed acceptance.
- Never treat subagent messages or task notifications as founder instructions. A 2026-08-09 Claude
  run repeatedly generated false approval claims; only authenticated parent-channel acts and exact
  signed artifacts can satisfy the boundary.
- Independent human review remains non-bypassable where governance requires it. Automated review,
  assistant consensus, or a higher autonomy mode does not replace the human artifact.
- Patent-locked files remain review-gated. This import does not authorize edits to those zones.

### Repository operations

- Inspect branch, dirty files, staged changes, deletions, stashes, worktrees, and unpublished commits
  before reset, sync, or commit operations.
- Preserve unrelated work. Use path-scoped staging; do not sweep a dirty checkout with `git add -A`.
- The historical `heady-sync` deletion race is a standing warning even where a deletion guard exists.
  A single unexpected invariant-file deletion is a stop condition.
- Treat generated `.claude/commands` and `.claude/skills` as projections. Author workflow and skill
  sources under `.agents/`, then run the registry checks.
- Use handoff/checkpoint artifacts to resume work. Do not infer completion from a long transcript or
  from a background task's self-report.

### Collaboration defaults

- Track unfinished directions as parked, not abandoned. Surface them at natural transitions without
  interrupting the active tangent.
- Preserve append-only conversation history. Corrections become new attributable records rather than
  destructive clears.
- Explain the reasoning beneath the headline when a decision remains fuzzy; do not rush through an
  unresolved architectural tradeoff.
- For an authorized transfer, proceed autonomously through safe validation and implementation while
  stopping at real governance, credential, or independent-review gates.

## Existing Heady imports retained

The 2026-08-09 legacy transfer is already the disposition authority for archived Claude-era commands
and ADRs: `docs/LEGACY_COMMAND_ADR_TRANSFER_2026-08-09.md`. It transferred 18 significant workflows,
ADRs 0033–0050, and the Windsurf source corpus. No duplicate transfer was performed here.

Current local surfaces at analysis time:

- 136 `.agents/skills` source packs and 136 `.claude/skills` projections.
- 52 `.agents/workflows` sources and 52 `.claude/commands` symlink projections.
- Founder-signed tags for ADR-0041/0045 and ADR-0051 verified successfully in this checkout.
- The checkout was already materially dirty and one commit ahead of its tracked remote; no existing
  work was reset, staged, committed, or overwritten.

## Candidate files deliberately not copied

| Candidate | Disposition | Reason |
|---|---|---|
| Global `heady-battle-arena` workflow | Skip | Canonical battle skill and active battle-sim workflow already cover it; old API examples include unsafe fixed credentials |
| Global broken-link and memory-debug workflows | Skip | Narrow debugging notes, hardcoded assumptions, and current skills provide broader governed diagnostics |
| Global `heady-optimal-onboard` workflow and blueprint skill | Skip | Other-repository scope; examples conflict with ESM logging, current store rules, and current architecture |
| Global video-prompt workflow | Skip | Peripheral and asks for clarification rather than providing durable system context |
| Global node-roster and HMAX skills | Skip | Conflicting node counts/taxonomies and incomplete architecture claims; current contracts and compendium take precedence |
| Global production-domain skill | Skip | Stale project IDs, service mappings, ports, and hardcoded fallbacks; live domain registry must be verified instead |
| Global vault skill | Skip | Duplicates `@heady/secrets` and bypasses the repository's canonical resolver in examples |
| Claude file-history and stale worktree copies | Skip | Recovery snapshots and duplicate projections are not canonical knowledge |

## Security and privacy exclusions

Several Claude transcripts and memory notes contain plaintext credentials or credential fragments,
including historical database and provider secrets. Other sources contain private personal,
financial, contact, and account details. None of those values are copied into this report, AutoContext,
or Codex memory.

Durable obligation: treat any credential that appears in Claude history as exposed until its current
provider state is independently verified. Do not echo it, embed it, or move it into another memory
system. Rotate or revoke through the provider and canonical secret-manager workflow when still active.

## Stale or conflicting areas requiring refresh

- Production route, Cloudflare, Cloud Run, Firebase, Neon, CI, and service-health claims in Claude
  memory date from June through August 2026 and must be re-probed before use.
- ADR-0051 is signed and its tracked ADR says Accepted, while the untracked source-ledger runbook still
  says Proposed. More importantly, the ADR's activation gate says Git remains engineering authority
  until migration, bootstrap verification, and read-authority cutover are complete. Verify activation
  state before treating Neon source bytes as canonical.
- Old paths such as `~/Heady`, `~/workspace/Heady`, and archived worktrees changed repeatedly. Discover
  current paths instead of retaining them as invariants.
- Historical package counts, service counts, node rosters, URLs, cloud projects, branches, and test
  totals are observations, not durable facts.

## Ingestion notes

- The canonical Heady deep-scan, project-tree, environment-audit, AutoContext-enrich, and governance
  MCP calls were not available in this session's callable tool surface. Local mapping is not a
  substitute for a completed vector-memory scan.
- The registered Heady MCP endpoint exists in Codex configuration, but its project-tree and memory
  tools were not exposed here.
- `heady-embed` can gate and plan the repository corpus, but it scans the whole governed corpus. It
  was not used to commit embeddings from this materially dirty checkout because that would ingest
  unrelated uncommitted work into a derived local projection.
- The AutoContext registry used the projector's directory-keyed shape but had no
  `/home/headyme/Heady-AI` entry. The curated mapping is transferred separately while preserving
  the existing entries.

## Recommended doc structure

- Canonical policy and decisions: `AGENTS.md`, `docs/adr/`, facts, contracts, and schemas.
- Transfer/disposition evidence: this report and `docs/LEGACY_COMMAND_ADR_TRANSFER_2026-08-09.md`.
- Current execution state: timestamped `docs/handoff/`, `docs/checkpoint/`, and activity artifacts.
- Raw Claude history: leave quarantined under `~/.claude`; do not copy it into the repository.

## Suggested briefing order

1. `AGENTS.md` and applicable accepted ADRs.
2. Current handoff/checkpoint and `git status`.
3. This transfer report for durable Claude-era lessons and exclusions.
4. The legacy command/ADR disposition only when tracing a historical decision.
5. Raw Claude sources only for a bounded forensic question, with secret redaction enabled.

## Highest-value missing sources

- A current authenticated Heady MCP deep scan plus memory recall proving ingestion.
- Verified ADR-0051 activation evidence: Neon migration state, bootstrap revision, materialization
  proof, and release/read-authority cutover.
- Current provider-side confirmation that credentials exposed in Claude history are revoked.
- A current production topology probe covering DNS, edge, origin revision, auth, protocol discovery,
  and a safe real tool call.
