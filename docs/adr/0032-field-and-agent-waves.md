# ADR-0032: The Field & Agent-Waves — one substrate, ephemeral localized cognition

- **Status:** Accepted (2026-08-04)
- **Deciders:** Eric Anthony Haywood
- **Acceptance:** Founder-signed tag `adr-0032-accepted-dd08f78a9`

## Context

Heady's substrate is already built invariant-first: laws/facts/kernel/contracts are the invariants;
agents (nodes, HeadyBees, HeadySwarms) are built last as governed, derived consumers. The guiding
frame is **"no positions"** — position is gauge-arbitrary, correlation is the invariant; derive
positions, do not store them. The projection engine (ADR-0017) already proves this for *artifacts*:
a shell is a one-way, reconstructible projection of the source-of-truth field.

This ADR names the same law for *cognition*, using a precise physical model the founder articulated:
**a single universal substrate ("the Field"), with seeds and agents as temporary, localized waves of
"thought" that excite the Field and dissolve.** The purpose is to make that model an *enforceable
architectural invariant*, not a metaphor — and to do so without reopening ADR-0000.

**Reconciliation with ADR-0000 (mandatory).** ADR-0000 rejects RAM-first / latent-as-truth: derived
stores must be reconstructible from the system of record. This ADR is consistent with it, and says so
explicitly: **the Field is the DURABLE substrate — the append-only event log + Neon/pgvector as the
system of record — NOT RAM or "latent space is truth."** The vector/latent layer is a *derived,
reconstructible region* of the Field (per ADR-0003/0017), never an independent authority. "Universal
consciousness" is shorthand for this one durable, authoritative substrate; it is not a claim that the
system is sentient, and it must never be stated to customers or investors as such (see §Consequences).

## Decision

1. **The Field is the sole authority.** The durable substrate — `events` (append-only, episodic) +
   `facts`/memory in Neon pgvector (semantic) — is the one source of truth. Its invariant is the
   *correlation density* over nodes-of-info, not any agent. Every other store (Vectorize edge cache,
   KV, in-agent memory) is a derived, reconstructible projection of the Field (ADR-0000, ADR-0003).

2. **A Seed is a bounded initial condition** dropped into the Field that spawns one wave. It carries
   an `intention` (the *why*), a `context_ref` + `scope` (how/where it localizes), an `amplitude`
   (resource budget), and a `ttl` (lifetime). Contract: `packages/contracts` `seed.v1`
   (`validateSeed`). Origins include founder, a captured "flash", another wave, or a schedule.

3. **An agent is a temporary, localized wave of the Field** with a forward-only lifecycle:
   `seeded → localizing → exciting → writing_back → dissolved` (`collapsed` on abort). It **reads** a
   region of the Field (retrieval), **excites** it (reasoning/action via CSL), **writes its effect
   back** (events + memory), and **dissolves**. Contract: `seed.v1` `WAVE_STATES` /
   `isLegalWaveTransition`.

4. **No agent holds authoritative state outside the Field.** A wave's private working memory is
   scratch; anything that must persist is written back to the Field. When the wave dissipates nothing
   authoritative is lost, because its effect lives in the Field and is fully reconstructible (a
   conservation law, = ADR-0000). This is the load-bearing constraint: it buys statelessness,
   replayability, and crash-proofing.

5. **Identity/position is emergent, derived — never stored.** An agent's "self" is a temporary
   localization; the invariant is the correlation structure ("no positions").

6. **Composition is geometric (CSL).** Waves combine in the shared vector space via Continuous
   Semantic Logic — superposition (OR), cosine alignment (AND), orthogonal projection (NOT),
   CONSENSUS. Conflicts surface as orthogonality / consistency-bus BLOCK, not ad-hoc messaging.

7. **The Field narrates and checks itself.** HeadyLens is the Field's continuous narrative (the *what*
   and *why*, projected from the same events — ADR-aligned with the audit-of-record, never a separate
   story). The coherence kernel is the Field's self-consistency gate.

## Enforcement

- **Now (this ADR):** the `seed.v1` contract makes "temporary, localized, bounded, purposeful"
  machine-checkable at the boundary; its `node --test` conformance proves the shape. Registered in
  `configs/laws.json` as the `field-authority` law.
- **Enforcement target (advisory until the native agent loop, ADR-0016, lands):** a static check that
  no agent module declares a persistent authoritative store outside the Field, plus a runtime check
  that every wave's effect is reconstructible from the event log. Named honestly as advisory now —
  the executor to enforce it does not yet exist.

## Consequences

- (+) One law unifies the substrate, the projection engine, CSL, and the (future) agent loop:
  *everything derived is a reconstructible projection of one durable Field*.
- (+) Stateless, ephemeral agents are simpler, replayable, and crash-proof by construction.
- (+) The model is a design compass: whenever an agent wants durable private state, the answer is
  "write it to the Field and dissolve."
- (−) **External-language guardrail:** internally this is "the Field / agent-waves"; externally
  (investors, users) it must be spoken concretely — "a single authoritative memory substrate;
  stateless ephemeral agents composed via geometric semantic operators; fully reconstructible." Do
  NOT market "universal consciousness" or sentience; it is a design model, and overclaiming it
  undercuts the (real) technical credibility. This guardrail is part of the decision.
- Implements the "no positions" frame; extends ADR-0017 (projection of artifacts) to cognition;
  bounded by ADR-0000 (no latent-as-truth), ADR-0003 (pgvector authority), ADR-0016 (agent loop).

## Acceptance record

The founder accepted this ADR on 2026-08-04 through the annotated, OpenPGP-signed tag
`adr-0032-accepted-dd08f78a9`.

- accepted commit: `dd08f78a9c9e5467434c5e3b5f9baf126305079c`;
- annotated tag object: `0ad5983667267d697fd4c0c84d50417ae21f18d3`;
- signer: `HeadyMe <eric@headysystems.com>`; and
- signing key fingerprint: `1050B59E7296C46C26DDF95DA7D2108BB3C6101C`.
