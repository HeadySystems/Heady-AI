# 01 — Laws, Constants, CSL & Archetypes (the substrate)

> The mathematical and constitutional foundation everything else inherits. **What · Why · How · When ·
> Where · Disposition.**

---

## L1. The 4 Liquid Architecture laws (engineering invariants)

**What/Why/How:**

| Law | Principle | How enforced |
|---|---|---|
| **Liquidity** | Complete redundancy, zero single points of failure | mandatory fallback routes + real-time state checkpointing across nodes (ADR-0004 Workflows; ADR-0018 gateway failover) |
| **φ-Scaled Proportionality** | Every constant derives from φ/Fibonacci | no magic numbers; lint/review rejects hand-tuned values (§C below) |
| **Sovereignty** | Production isolated from local leaks | zero localhost; all assets cloud-hosted behind edge proxy (ADR-0008 secrets; Law 0) |
| **Zero Placeholders** | No stubs/mocks/TODO in production paths | pre-commit + CI reject placeholder blocks |

**Disposition:** baseline. These are the "Liquid Architecture" framing of the constitutional laws below.

## L2. The 10 Constitutional Laws (V9) — with canonical dispositions

| # | Law | Disposition |
|---|---|---|
| 0 | No localhost (all `*.headysystems.com` tunnels) | baseline |
| 1 | No placeholders ("TODO" is failure) | baseline |
| 2 | No silent failures (pino JSON, Glass Box) | baseline |
| 3 | No build steps in frontend (Drupal/Twig/Vanilla) | **STALE / non-binding (R1)** — dependency-minimalism: vanilla by default, React/Vite when complexity earns it |
| 4 | PQC everywhere (ML-DSA/ML-KEM, Ed25519 retired) | **aspirational/Phase-4 (R3)** — Ed25519 baseline now, PQC later via dual-sign |
| 5 | Determinism (temp=0, top_p=1, seed=42, SHA-256, signed) | baseline |
| 6 | Metacognitive honesty (conf < ψ² → state gaps) | baseline |
| 7 | Safety over speed (root-cause only) | baseline |
| 8 | No shipping without tests (4-Layer Fortress) | baseline |
| 9 | Distill every success (stage 21 → recipe) | baseline |

> Positioned at primacy (§2) and recency (§42) in V9 to exploit the U-shaped attention curve — a prompt-
> engineering tactic worth preserving in `AGENTS.md`.

## C. Sacred constants (φ-derived — the canonical values)

φ = 1.6180339887 · ψ = φ⁻¹ = 0.6180339887 · ψ² = 0.3819660113 · FIB = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987].

| Constant | Value | Derivation |
|---|---|---|
| `AUTO_SUCCESS_CYCLE_MS` / `heartbeatMs` | 29034 | φ⁷ × 1000 (the ambient heartbeat; also the MCP-console pulse) |
| `TASK_TIMEOUT_MS` | 4236 | φ² × 1000 |
| Connection pool | min 2 / max 13 | fib(3) / fib(7) |
| Pools hot/warm/cold | 34 / 21 / 13 | fib(9/8/7) |
| Memory TTLs | T0 21h · T1 47h · T2 warm 55h · archive 144h | Fibonacci hours |
| Retry delays (ms) | [1000,1000,2000,3000,5000,8000,13000,21000] ±(ψ×d) | Fibonacci + ψ jitter |
| Vector dims | 384 / 1536 | quick / full CSL |
| Resource split | hot 34% · warm 21% · cold 13% · reserve 8% · governance 5% | Fibonacci % allocation |
| Budget | infra $610 · API cap $377 · ceiling $987 · daily $13 | fib(15/14/16/7) |
| MAPE-K | monitor 89000ms · drift ψ · rollback φ²≈2.62h | fib(11)×1000 / ψ / φ² |
| Sentry sampling | txn 0.618 · replay/profile 0.382 | ψ / ψ² |
| Determinism | temp 0, top_p 1, seed 42, max_tokens 4096 | Law 5 |
| PQC | ML-DSA-65 / ML-KEM-768 / SLH-DSA (NIST L3) | Law 4 (aspirational) |

**Disposition:** baseline. φ-scaling is a real, implemented convention (`phi-math` package). Note the
$610/$987 V9 budget vs the $618 figure elsewhere — both are "~$600/mo lean"; treat $610+$377=$987 ceiling
as canonical (φ-pure), $618 as a rounded shorthand.

## G. CSL gates (the decision algebra) — see also `06-G2`

Operators: `AND=cos(a,b)` · `OR=normalize(a+b)` · `NOT=a−proj_b(a)` · `GATE=σ((cos−τ)/T)` ·
`IMPLY=proj_b(a)` · `CONSENSUS=normalize(Σwᵢaᵢ)` · `ANALOGY=normalize(b−a+c)`.

**Two threshold formulations (R6):**
- **Routing cuts (canonical):** HALT `<0.382` · CAUTIOUS `≥0.382` · EXECUTE `≥0.618`. Score bands:
  PRIME 0.718+ (T0, auto-inject) · BOOST 0.618+ (T1) · RECALL 0.382+ (T2) · NOISE <0.382 (discard).
- **Privileged-action ladder** (`1 − ψ^level × 0.5`): DEDUP ≥0.972 · CRITICAL ≥0.927 · HIGH ≥0.882 ·
  MEDIUM ≥0.809 · LOW ≥0.691 · MIN 0.500.

**Canonical use:** CSL is for **relevance gating + privileged-action thresholds, never for ranking**
(the no-ranking principle). Adaptive temperature `T = ψ^(1+2(1−H/Hmax))`. **Disposition:** baseline
(`csl-engine` package); the Tensor/Topology bees implement the operators (`02`).

## A. The 7 cognitive archetypes & 11 personas

**7 archetypes** (every task passes through all 7; each emits confidence ∈[0,1]; ALL must exceed 0.7):
OWL (wisdom/first-principles) · EAGLE (omniscience/edge-cases) · DOLPHIN (creativity) · RABBIT
(multiplication/5+ angles) · ANT (repetition/zero-skip) · ELEPHANT (memory/recall) · BEAVER
(structure/tests-alongside-code). Archetype→node mapping: Sovereign=HeadySoul, Architect=Conductor/
Orchestrator, Executor=Bee/Buddy/IO, Guardian=Guard/Governance, Librarian=Memory/Vinci/Autobiographer,
Analyst=Arena/Check/Assure/Corrections, Researcher=Brain/DeepScan/Perplexity, Distiller=heady-distiller.

**11 personas** (`skills/downloaded-skills/HEADY_PERSONA_*`): Ant (automation), Beaver (building), Bee
(coordination), Dolphin (creative), Eagle (vision), Elephant (memory), Fox (tactics), Lion (decision
authority), Owl (strategy), Rabbit (variation). The 7 archetypes are the permanent always-on lenses; the
11 personas are selectable interaction masks (also the empathic 5-persona companion masking,
`heady-liquid-persona`).

**Disposition:** baseline as a *prompt-architecture pattern* (multi-lens self-critique), implemented in
`AGENTS.md` + the agent system prompt, not as 11 separate services. The "ALL exceed 0.7" rule maps to the
Judge stage (`03`) and the eval gate.
