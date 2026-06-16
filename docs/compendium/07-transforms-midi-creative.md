# 07 — Transforms: MIDI → UDP, Creative Engine & the Representation Chain

> Heady's native runtime is the latent vector space; **everything else is a transform into or out of it.**
> This file catalogs every transform pipeline — with the **MIDI → RTP-MIDI (UDP) → event-bus → creative**
> chain as the headline — plus the protocols that carry them. **What · Why · How · When · Where ·
> Disposition** throughout.

The unifying idea: a **transform** is a typed, often lossy, mapping between representations
(text ↔ vector ↔ code ↔ 3D ↔ audio ↔ MIDI ↔ UI). Each is φ-parameterized and, where it produces
knowledge, **embedded back into vector memory** so the system can recall and reason over its own outputs.

---

## T1. The MIDI → UDP transport chain (the headline)

**What.** A real-time path that turns hardware/DAW MIDI events into Heady events and back out to remote
gear over the network — MIDI's bytes transformed into routable, vectorizable events and, in the reverse
direction, into **RTP-MIDI packets carried over UDP**. **Why.** Heady is a creative instrument as well as
an OS (the **Studio** swarm, Ableton integration); musicians need sub-frame latency, which only a
UDP-based transport delivers, and Heady needs MIDI semantics as first-class events it can gate, log, and
sonify. **How — the pipeline:**

```
Hardware/DAW MIDI in ──► midi-event-bus (central hub) ──► [ midi-bee, creative-bee, telemetry-bee ]
        (note-on/off,            │ φ-scaled CC maps,                    │
         CC, SysEx,              │ golden-ratio velocity curves         ▼
         clock)                  │                              embed into vector memory
                                 ▼                              (creative outputs are recalled)
                        network-midi  ──RTP-MIDI──►  remote DAW / devices
                        (RTP-MIDI / AppleMIDI            over UDP (RTP payload),
                         session protocol)                clock-synced, low-latency
```

- **MIDI → event:** each MIDI message is parsed at `midi-event-bus.js` into a typed Heady event; CC values
  map through **φ-scaled parameter ranges** and note velocities follow **golden-ratio curves** (no linear
  magic ranges).
- **event → UDP (the "MIDI to UDP" transform):** `network-midi.js` serializes events as **RTP-MIDI**
  (RFC 6295 / AppleMIDI session protocol), whose RTP payload rides **UDP** for minimal-latency transport
  to remote DAWs/devices, with recovery-journal handling for UDP packet loss and session clock sync.
- **fan-out:** the bus simultaneously feeds `midi-bee` (processing), `creative-bee` (generation), and
  `telemetry-bee` (observability) — one input, three consumers, stigmergic.
- **Ableton control:** `HeadyBuddyScript.py` (Ableton remote script) closes the loop to a live DAW.

**When.** Phase 4 (Hardware & MIDI domain / Studio swarm) — a creative vertical, not a P0 dependency.
**Where.** `heady-midi-creative` skill, `src/midi/network-midi.js`, `src/engines/midi-event-bus.js`,
MidiBee (domain 10, ports 3350–3353 logically). **Disposition:** baseline-for-the-creative-vertical,
**Phase 4**. *Clarifying note:* the corpus transport is **RTP-MIDI over UDP** (not raw MIDI-over-UDP);
"MIDI → UDP" in the request maps to this RTP-MIDI path. (Plain OSC-over-UDP is an acceptable alternative
sink if a target speaks OSC rather than RTP-MIDI; not currently specified.)

---

## T2. The Creative Engine (generation transforms)

**What.** `creative-bee` + `edge-diffusion.js` — text→image, text→music, and style-transfer transforms.
**Why.** Heady generates artistic content (album art, generative visuals, music) as a product surface and
as MIDI-driven live output. **How.** `creative-bee` orchestrates the generation; **edge-diffusion** runs
lightweight image inference on **Cloudflare Workers AI** (edge, sub-100ms, no origin round-trip); **CSL
gates control creative parameters** (temperature, guidance scale, steps) instead of hardcoded knobs; all
outputs are embedded into vector memory for recall and remix. **When.** Phase 4 (Studio). **Where.**
`src/creative/edge-diffusion.js`, creative-bee. **Disposition:** Phase 4; uses the canonical model mesh
(`05`) and edge tier (`09`).

---

## T3. Vector sonification & VSA (audio ↔ vector ↔ symbol)

**What.** Bidirectional transforms between the vector space and (a) audio and (b) symbolic structure.
**Why.** Sonification makes system state audible (the "hive breathing" maps to real telemetry, like the
console's 29034ms heartbeat); VSA (vector-symbolic architecture) lets the system bind/bundle/permute
concepts as hypervectors for associative memory and state machines. **How.** **Sonification:** map vector
features (domain, recency, importance) to audio params via the MIDI bus → real-time audio. **VSA**
(`heady-vsa-hyperdimensional-computing`): `bind` (⊛, element-wise), `bundle` (+, superpose), `permute`
(ρ, sequence), similarity by cosine — the same algebra as the CSL Tensor swarm (ResonanceBee/
SuperpositionBee/OrthogonalBee, `02`/`06-G2`). **When.** Sonification P4; VSA as-needed for associative
memory (P2+). **Where.** `heady-vsa-hyperdimensional-computing`, midi-event-bus. **Disposition:** VSA
baseline-as-pattern; sonification P4.

---

## T4. Embedding transforms (text/code ↔ vector) — the core transform

**What.** The most-used transform: content → 384-D vector (and 1536-D for full CSL). **Why.** It's the
on-ramp to the latent runtime — nothing is reasoned over until embedded. **How.** Locked embedder
`@cf/baai/bge-small-en-v1.5`, **384-D, mean pooling** (ADR-0003 amended / ADR-0015); via the
**embedding-router** so the model is swappable without touching the schema; change-significance filtering
skips re-embedding metadata-only diffs. **Code→skill** uses the Voyager pattern (code → embedding → index
in the `skills` table). **When.** Phase 2 (memory) onward; every ingest. **Where.** EmbedBee/VectorBee
(Memory Mesh, domain 2), `heady-embedding-router`, `heady-merkle-index` (incremental re-embed on file
hash change). **Disposition:** baseline (`04-memory-and-retrieval.md`).

---

## T5. Spatial transforms (vector ↔ 3D) — HeadyFS, ProjectionBee, Logic Visualizer

**What.** Project high-dimensional vectors into navigable 3D, and project logic gates into interactive
visuals. **Why.** Human comprehension and the "3D vector workspace" UX; debugging CSL decisions visually.
**How.** **HeadyFS** = 3D UMAP projection on axes (semantic domain × temporal recency × importance);
**ProjectionBee** (Visual Computing, domain 15) renders multidimensional logic gates as interactive 3D;
**Logic Visualizer** (`05-Architecture-Specs/LOGIC-VISUALIZER-SPEC.md`) animates CSL gate evaluation. The
design system's `--hatch-projection` pattern visually marks projected (vs real) surfaces. **When.** P4
(visual). **Where.** `heady-vector-projection`, ProjectionBee, octree spatial engines. **Disposition:**
P4; the *data* (UMAP coords) can be precomputed earlier as a derived projection (Tier 5).

---

## T6. Design ↔ code transforms

**What.** Bidirectional design↔code: Figma/visual → components, and code → visual. **Why.** Speeds UI
construction and keeps the brand design system (the honeycomb console) in sync with code. **How.**
`heady-design-bridge` (Figma import, design-token extraction, component generation), and the
**design-system zip** itself (tokens + `.jsx`/`.d.ts` + `.prompt.md` per component) is a design→code
artifact. **When.** P3 (portal/console). **Where.** `heady-design-bridge`, `heady-visual-builder` (DAG
drag-drop), `heady-sacred-geometry-css-generator` (φ-scaled CSS). **Disposition:** baseline for the SPA
surfaces (subject to **R1** frontend resolution — React/Vite components).

---

## T7. Knowledge transforms (repo/docs ↔ knowledge pack ↔ recipe)

**What.** Turn raw material (repos, notes, traces) into structured, retrievable knowledge — and turn
successful execution traces into reusable recipes. **Why.** Law 9 "distill every success"; anti-
hallucination grounding. **How.** `heady-knowledge-ingestion-briefing` (repo/notes → knowledge packs →
embedded); **heady-distiller** (stage 21): execution trace → DSPy MIPROv2/GEPA-optimized recipe →
tiered registry (Tier-1 optimized prompt / Tier-2 pipeline config / Tier-3 fast-path DAG / Tier-4 model
distillation via DPO). **When.** Continuous (every successful pipeline run). **Where.** `heady-distiller`
node, `heady-repo-map`, Graph-RAG. **Disposition:** baseline (the distiller is the inverse of the
optimization loop, `06-G10`).

---

## T8. The transport/protocol layer (what carries the transforms)

**What.** The wire protocols events ride. **Why.** Different planes need different transports; one
chokepoint per concern. **How:**

| Transport | Carries | Plane | Disposition |
|---|---|---|---|
| **RTP-MIDI / UDP** | MIDI events to remote DAW/devices | creative real-time | P4 (T1) |
| **NATS JetStream** | async events, dead-letter (QueueBee) | internal event bus | reconcile → see note |
| **Redis Streams (Upstash)** | high-throughput task distribution, XAUTOCLAIM | pipeline tasks | best-effort cache plane |
| **Cloudflare Queues + pgmq outbox** | durable cross-boundary writes | system-of-record plane | **canonical** (ADR-0002) |
| **WebSocket (control) + SSE (data) + HTTP/2** | token streaming, session control (`liquid-stream`) | UI/agent streaming | baseline (P3) |
| **MCP Streamable HTTP** | agent↔tool | tool plane | baseline (P3) |
| **A2A / A2UI** (`heady-a2a-protocol`) | agent↔agent, agent↔UI, `.well-known/agent.json` | inter-agent | baseline pattern |

**Event-bus reconciliation:** the corpus names **both** NATS JetStream (QueueBee, `heady-event-bus`) and
the canonical **pgmq outbox + Cloudflare Queues**. **Resolution:** the **durable system-of-record write
path is the outbox + Queues** (ADR-0002, non-negotiable); NATS/Redis-Streams are permitted as
**best-effort, in-flight task distribution** (e.g., Colab fan-out) but **never** as the cross-boundary
write path and **never** authoritative. This mirrors the store reconciliation (R2): one durable
authority, fast caches in front.

---

## T9. Transform governance (every transform is gated)

Every transform obeys the cross-cutting rules: **CSL gates** parameterize it (creative temp/guidance,
relevance cutoffs); **Zod** validates its I/O at the boundary; **φ-scaling** sets its constants; outputs
that are knowledge are **embedded + receipted** (`06-G5`); destructive sinks (e.g., pushing MIDI/control
to external hardware, writing generated content to a public site) pass the **approval gate** (`06-G6`).
A transform is just another bee under BaseHeadyBee — it spawns, executes, reports, retires.

---

## Disposition summary

- **Baseline now/P2–P3:** embedding transforms (T4), knowledge/distiller transforms (T7), design↔code for
  SPAs (T6, pending R1), the durable transport plane (T8 outbox/Queues/WebSocket+SSE/MCP/A2A).
- **Phase 4 (creative vertical):** MIDI→RTP-MIDI/UDP chain (T1), Creative Engine (T2), sonification (T3),
  spatial 3D projection (T5).
- **Reconciled:** NATS/Redis-Streams as best-effort only (T8), never the write path; frontend transforms
  pending **R1**.
