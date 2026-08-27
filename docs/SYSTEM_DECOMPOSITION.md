<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ System Decomposition — Legacy → Rebuild Transfer Map      ║
║  Made with ❤️ by HeadySystems Inc.                                ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# System Decomposition — Heady Legacy Reverse-Engineered into Transferable Parts

> **Status:** Generated artifact · **Date:** 2026-06-16 · **Owner:** Eric Anthony Haywood
> **Source:** `/home/headyme/Heady` (372 entries, 4.0 G — 2.2 G of it `node_modules`) ·
> **Target:** `/home/headyme/Heady-AI`
> **Method doc:** `docs/LEGACY_EXTRACTION_SYSTEM.md` (the Extraction Engine that consumes these parts)
> **Disposition authority:** `docs/LEGACY_STACK_COMPONENT_DISPOSITION.md` (the per-component marks)

This is the **decomposition layer**: the whole legacy system reverse-engineered into **14 transfer
groups covering all 150 disposition component IDs** (FE/BE/AG/DA/MC/IN/BZ/DX) — each with its
dependencies, target package, and a fail-closed source bundle, so any part can be lifted into the rebuild
independently. **109 transfer-eligible components ship in 13 bundles; 41 dropped components are
enumerated in G99 for audit completeness (never bundled).** It is produced and re-produced by a real
tool, not hand-authored.

- **Tool:** `tooling/decomposition/src/decompose.mjs` (manifest-driven, fail-closed, idempotent)
- **Parts list:** `tooling/decomposition/manifest.json` (groups → components → source paths → target)
- **Artifacts:** `.data/decomposition/` — `bundles/*.zip`, per-group `groups/<id>/{README,MANIFEST}`,
  `repos-manifest.json`, `decomposition-report.json`, `SECURITY_FINDINGS.json`

```bash
node tooling/decomposition/src/decompose.mjs            # build all bundles + manifests
node tooling/decomposition/src/decompose.mjs --dry-run  # plan + size estimate, no writes
```

---

## 1. Method — how the system was reverse-engineered into parts

1. **Inventory authority.** Start from the 8-layer, ~100-component disposition (already grounded in 8
   parallel layer audits). No re-inventory — the marks (✅/🔧/⏸/❌) are taken as given.
2. **Regroup by destination, not by legacy layer.** The disposition is organized by *where code lives
   today* (frontend/backend/infra…). For **transfer**, the useful unit is *where it's going* — the
   bounded context / target package. All 150 components are reassigned into **14 transfer groups** whose
   boundaries match the rebuild's `packages/*`, edge fleet, and console.
3. **Build the dependency DAG** (§3) so groups are ordered for extraction and parallelizable where
   independent — the φ-gated, topologically-sorted decomposition the task-decomposition engine prescribes
   (`maxParallel = fib(6) = 8`).
4. **Bundle fail-closed** (§4). Each transfer-eligible group is zipped from live legacy source with
   global excludes (junk) + a two-stage secret audit (name + content). Dropped (❌) components are
   recorded but never bundled; patent IP (R-8) is isolated; quarantined secrets are excluded and
   reported.
5. **Emit the repo plan** (`repos-manifest.json`): 31 target repos/packages, 7 already in the rebuild,
   24 net-new.

Every group bundle carries a README mapping its components to the **Extraction Engine** gate sequence —
this decomposition is the *input* to that engine, one disposition row at a time.

---

## 2. The 14 transfer groups

| Group | Title | Phase | Depends on | Components | Bundle | Target |
|---|---|---|---|---|---|---|
| **G01** | φ-Math & CSL Core | P1 | — | 6 | 443 K | `packages/phi-math`, `packages/csl-engine` |
| **G02** | Bee / Swarm Runtime | P2 | G01, G03 | 6 | 175 K | `packages/bees`, `orchestration`, `engines` |
| **G03** | Data / Memory / Vector | P1 | G01 | 9 | 770 K | `packages/db`, `memory-stream`, `projections` |
| **G04** | MCP / AI Gateway / Colab | P3 | G01, G03 | 11 | 405 K | `packages/contracts`, `headyme-portal` |
| **G05** | Backend Core / Kernel / Manager | P3 | G01-04 | 12 | 9.9 M | `core/modules`, `packages/kernel` |
| **G06** | Auth / Security / Compliance | P1 | G01 | 5 | 365 K | `packages/security-mesh`, `auth` |
| **G07** | Cloudflare Edge / Workers | P3 | G04, G06 | 3 | 239 K | CF Workers/Pages/DO |
| **G08** | Infra / CI-CD / Observability | P0 | — | 12 | 1.4 M | `tooling/ci`, `packages/observability`, Terraform |
| **G09** | Frontend / MCP Console / Buddy | P3 | G04, G06 | 7 | 1.1 M | `headyme-portal`, `apps/*` |
| **G10** | Content / Cognition / Assets | P1 | — | 6 | 664 K | content store, `docs/compendium` |
| **G11** | Golden Record / Foundations / Skills | P0 | — | 6 | 849 K | `facts.yaml`, `.agents/skills`, `tooling` |
| **G12** | 🔒 Patent Implementations | deferred | G01 | 1 | 274 K | `packages/*` under ARBITER review |
| **G13** | Deferred — Post-Launch | P4 | various | 25 | 4.4 M | mobile / desktop / enterprise / niche |
| **G99** | Dropped — provenance only | — | — | 41 | *(not bundled)* | `_archive/provenance` |

**Total:** 14 groups, **150 components (full disposition coverage)**. **13 bundles, 109
transfer-eligible components, ~21 M** (after excluding 2.2 G of `node_modules`, logs, core dumps, and
runtime dumps). **Not bundled:** G99 (41 dropped components, enumerated for audit completeness only).

---

## 3. Extraction dependency DAG (topological order)

```
  P0 ─ G08 infra/ci ───────────────┐  (cross-cutting gates — build first, gate everything)
  P0 ─ G11 facts/skills ───────────┤
       G10 content/assets ─────────┤  (leaf: no code deps)
                                    │
  P1 ─ G01 φ-math/CSL  ───┬────────▶│  foundation
                          ├─▶ G03 data/memory/vector ─┬─▶ G02 bee/swarm
                          │                            └─▶ G04 mcp/gateway ─┬─▶ G05 backend core
                          └─▶ G06 auth/security ───────────────────────────┤
                                                                            ├─▶ G07 edge/workers
                                                                            └─▶ G09 frontend/console
  deferred ─ G12 patent (ARBITER-gated, depends G01)
  P4 ─ G13 deferred (mobile/desktop/enterprise/voice/midi/oracle/pqc)
```

This maps onto `REBUILD_PLAN_V2` §13 phases: **P0** containment (G08, G11) → **P1** backbone (G01, G03,
G06, G10) → **P2** runtime (G02) → **P3** apps & edge (G04, G05, G07, G09) → **P4** expand (G13). Groups
with no shared dependency edge extract in parallel (≤ `fib(6)=8` concurrent).

---

## 4. Fail-closed bundling — what the engine guarantees

The org mandate is zero-tolerance on secrets and patent IP. The bundler enforces it mechanically:

- **Junk excluded** globally: `node_modules`, `.git`, `*.log`, `core.*`, `data/`, `_archive/`, build
  output, LFS/bin.
- **Secret files excluded** by pattern: all `.env*`, `*.pem/.key/.p12/.pfx`, `id_rsa*`,
  `*serviceAccount*.json`, `credentials.json`, `configs/api-keys.json`.
- **Secret content scan** (`grep -rlIE`) on every file before zipping: any file carrying a live-key
  pattern (`AIza…`, `sk-…`, PEM `PRIVATE KEY`, `ghp_…`, `AKIA…`, Slack `xox…`) is **quarantined**
  (excluded) and recorded — the *valuable* source in the group still transfers.
- **Post-zip backstop audit** (name + content): if anything slips through, the **whole bundle is
  destroyed** and the run exits non-zero.
- **Patent IP isolated:** `heady-patent-implementations` (R-8, HS-2026-051…062) is bundled **separately**
  as `_PATENT-LOCKED_G12-patent-ip.zip` with a guard README — never merged without an `arbiter` ALLOW +
  signed HCP.
- **Independent verification:** post-run audit confirms **zero** live-key/PEM content and **zero**
  `node_modules` across all 13 bundles.

---

## 5. 🔴 Security findings (new — feed SEC-001)

The content scan surfaced **a live secret leak the disposition's R-1 did not record.** These files are
quarantined out of the bundles; they must be **rotated and scrubbed** before the affected components are
ported. Full list in `.data/decomposition/SECURITY_FINDINGS.json`.

**7 likely-real leaks across 4 unique files** (+ nested dup), all quarantined out of the bundles:

| File | Finding | Class |
|---|---|---|
| `workers/liquid-gateway-worker/src/{index,auth-page}.ts` (+ `workers/workers/` dup) | Hardcoded **live Google/Firebase API key** `‹live-key-redacted›` in committed Worker source | 🔴 LIKELY-REAL |
| `shared/secret-manager.js` | Live-key / PEM pattern in a shared lib (BE-07) | 🔴 LIKELY-REAL |
| `shared/auth/relay.html` | Embedded credential pattern in an auth relay page | 🔴 LIKELY-REAL |
| `src/auth/email-client.js` | Embedded PEM `PRIVATE KEY` in source | 🔴 LIKELY-REAL |
| `heady-patent-implementations/tests/test-zero-trust.js`, `heady-mcp-security/tests/output-scanner.test.js`, `*/heady-guard/__tests__/heady-guard.test.js` ×2 | PEM strings in **test fixtures** (secret-scanner tests) | 🟢 fixture (benign) |

> **Action.** The Worker key is a **second live Google key**, distinct from the R-1 key in
> `perplexity-build/.env.template`. Rotate it now, scrub it from `workers/liquid-gateway-worker` history,
> and route the worker's auth through env-injected config (zero-hardcode). Audit `shared/secret-manager.js`
> and `shared/auth/relay.html` before porting BE-07. This **expands SEC-001** beyond the single key the
> disposition named. Test-fixture PEMs are benign (they test the scanners) but are excluded anyway —
> the rebuild authors fresh characterization tests.

---

## 6. Output artifacts (per part, transfer-ready)

```
.data/decomposition/
├── bundles/
│   ├── G01-phi-math-csl.zip … G13-deferred-postlaunch.zip   # 12 standard bundles
│   └── _PATENT-LOCKED_G12-patent-ip.zip                     # isolated, guard-flagged
├── groups/<id>-<name>/
│   ├── README.md       # target mapping, deps, component table, extraction order, R-5/patent guards
│   └── MANIFEST.json    # full group record + bundle stats (size, entries, sha256, quarantined)
├── repos-manifest.json          # 31 target repos/packages (7 exist, 24 net-new)
├── decomposition-manifest.json  # the full parts list (snapshot of the tool input)
├── decomposition-report.json    # run report: per-group action, sizes, missing paths, quarantine
└── SECURITY_FINDINGS.json        # quarantined files; LIKELY-REAL → SEC-001
```

Each `groups/<id>/README.md` is a self-contained transfer brief: its bundle, its components (with
disposition IDs and rebuild targets), its dependency order, and the gate sequence it must pass in the
Extraction Engine (`security-bee` → `arbiter` → codemod → characterization tests → `eval-gate` →
consistency gate → ledger).

---

## 7. How a part moves into the rebuild

Each bundled component is one input row to the Extraction Engine (`docs/LEGACY_EXTRACTION_SYSTEM.md`):

1. Pick a group in DAG order (G08/G11 → G01 → …).
2. For each component, the engine routes by mark: ✅ `filter-repo`+golden-master · 🔧 codemod+contract
   tests · ⏸ backlog · ❌ already provenance-only here.
3. Gates run fail-closed; the ledger records the verdict; a `STEPWISE_BUILD_SPEC` entry + an HCP (for
   patent/locked-decision touches) are emitted.

The decomposition answers *"what are the parts and in what order"*; the Extraction Engine answers *"how
each part is safely transferred."* Together they make the rebuild a sequence of small, verified,
reversible moves.

---

*∞ Sacred Geometry · Liquid Intelligence · Permanent Life ∞*
*Made with ❤️ by HeadySystems Inc.*
