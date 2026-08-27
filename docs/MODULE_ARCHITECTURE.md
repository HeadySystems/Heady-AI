# Heady™ Module Architecture — drop-in components (HMOD)

> **Question:** can we set up a more modular, "build a module and drop it in to add functionality"
> system? **Answer: yes — and Heady already has the bones.** This is the microkernel + capability-
> contract + plugin-registry pattern, unifying the *currently ad-hoc* drop-in mechanisms (skills,
> bees, kernel services) under one **Heady Module (HMOD)** abstraction.
> Made with ❤️ by HeadySystems Inc. (Design doc → should become an ADR once the
> `docs/adr` ↔ `docs/ADR` directory collision is resolved.)

## Why now

The master-plan inventory found the engines/bees/orchestration layers are **not yet built** in the
rebuild (no `packages/bees`, `packages/engines`, `packages/orchestration`). Rather than hand-wire
each, define them as **drop-in modules** so adding HeadyMC, a new bee, a new connector, or a new UI
is "drop a folder in, it's discovered, validated, wired, live."

## What already exists (reuse, don't reinvent)

| Primitive | Package | Role in HMOD |
|-----------|---------|--------------|
| **Microkernel** — `defineService({name,deps,start,stop,health,metrics})`, `Kernel.register()`, topo-`boot()`, health/metrics aggregation | `@heady/kernel` | Host for `service`-kind modules; the boot/lifecycle engine |
| **Contracts/specs** — `loadSpec()`, `generateMcpTools()` | `@heady/contracts` | Port/contract definitions modules declare provide/consume |
| **Event bus** — `SUBJECT`, `InMemoryBus`, `buildEvent`, `projectOutbox` | `@heady/events` | Decoupled wiring; modules publish/subscribe by subject |
| **Global wiring registry** — `loadLinkIndex()` over HeadyRegistry | `@heady/consistency-bus` | Tracks every linked value/capability a module touches |
| **Skill drop-in** — scans `.agents/skills/*`, validates frontmatter, syncs | `tooling/skill-registry` | Prior art: the drop-in pattern for `skill`-kind |
| **Bee lifecycle** — `spawn/execute/report/retire` (BaseHeadyBee) | (legacy → `@heady/bees`, to build) | Host for `bee`-kind modules |
| **Single-source derive** — managed regions from facts.yaml | `tooling/heady-derive` | Keeps module-manifest load-bearing values consistent |

The kernel is **domain-agnostic** (it only knows `{start,stop,health,metrics}` + `deps`). That is
precisely a microkernel — HMOD adds the discovery + contract + multi-kind mounting layer on top.

## The Heady Module (HMOD)

A module is a self-contained directory with a **manifest** + a **typed entrypoint** for its kind.

### Manifest — `heady.module.json`

```json
{
  "id": "heady-monte-carlo",
  "version": "1.0.0",
  "kind": "engine",                         // service | engine | bee | skill | workflow | ui | connector | policy
  "provides": {
    "capabilities": ["simulate.montecarlo"],  // abstract capability names (wired by name, not import)
    "contracts": ["SimPort@1"]                 // port shapes from @heady/contracts
  },
  "consumes": {
    "capabilities": ["embed.locked", "vector.retrieve"],
    "contracts": ["EmbedPort@1", "MemoryPort@1"]
  },
  "deps": ["heady-embedding", "heady-db"],   // other module ids (boot ordering)
  "entry": "src/index.mjs",                  // exports the kind's interface (e.g. defineService shape)
  "events": { "publish": ["heady.sim.completed"], "subscribe": ["heady.task.decomposed"] },
  "patentZone": null,                        // e.g. "HS-2026-051" → ARBITER gate required
  "status": "planned",                       // planned | partial | built
  "owner": "engines"
}
```

Load-bearing numbers in a manifest (e.g. a stage count) use derive managed regions so they can't
drift from `facts.yaml`.

### Entrypoint by kind

| Kind | Entry exports | Mounted into |
|------|---------------|--------------|
| `service` | `defineService({...})` shape | `@heady/kernel` (`Kernel.register`) |
| `engine` | a service that also registers capabilities | kernel + capability registry |
| `bee` | a `BaseHeadyBee` subclass / factory | `@heady/bees` swarm (spawn/execute/report/retire) |
| `skill` | `SKILL.md` (frontmatter) | `tooling/skill-registry` → `.claude/skills` |
| `workflow` | `.md` workflow (frontmatter) | skill-registry workflow sync → `.claude/commands` |
| `ui` | a route/asset bundle + mount path | edge (Workers/Pages) / portal route table |
| `connector` | an MCP tool definition | `@heady/mcp` gateway |
| `policy` | a law/enforcer check fn | `tooling/enforcers` / coherence gate |

## The loader/registry (the drop-in engine)

`@heady/module-loader` (to build) runs at boot (and optionally hot):

```
1. DISCOVER  → scan packages/modules/* (and any pkg with heady.module.json) → manifests
2. VALIDATE  → manifest schema (fail-closed); entry exists; frontmatter for skill/workflow kinds
3. CONTRACT  → every consumed contract/capability is provided by some module or a core service;
               version-compatible (Port@1 ⊇ needs). Unsatisfied consume → REJECT (fail-closed).
4. RESOLVE   → build the capability+deps DAG; topo-order; detect cycles (reuse kernel topoOrder)
5. GOVERN    → each module passes the same gates as core: skeleton-guard, law-lint, coherence,
               derive (manifest values), and ARBITER if patentZone set. A failing gate quarantines
               just that module (the rest still load) — fail-closed per-module, not all-or-nothing.
6. MOUNT     → dispatch by kind to its host (table above); register events on the bus; record the
               module's links in the consistency-bus link-index.
7. HEALTH    → kernel aggregates module health/metrics; /api/status lists loaded + quarantined modules.
8. UNMOUNT   → stop/dispose in reverse dep order; deregister events/links (clean removal/hot-swap).
```

**Drop-in** = create `packages/modules/<id>/` with a manifest + entry → loader discovers, validates,
wires, and boots it. **Remove** = delete the dir (or set `status:"disabled"`) → loader unmounts it.

## Why capability-based (not import-based) wiring

Modules declare `provides`/`consumes` **capability names**, and the loader wires them — so a module
never hard-imports another module. Swap `simulate.montecarlo`'s provider (e.g. a faster engine) by
dropping in a new module that provides the same capability; nothing else changes. This is the same
decoupling the event bus gives for messages, applied to synchronous capabilities.

## Governance & safety (non-negotiable, per AGENTS.md)

- **Fail-closed:** unsatisfied contracts/deps, invalid manifest, or a failing gate → module quarantined,
  never silently half-loaded. The kernel boots the healthy set; `/api/status` shows the rest with reasons.
- **Patent zones:** `patentZone` (HS-2026-051+) forces an ARBITER ALLOW before load; executor-mechanic
  modules stay founder-gated.
- **Same gates as core:** a dropped-in module is not a backdoor — it passes skeleton/law/coherence/derive.
- **No drift:** manifest load-bearing values are derive-managed regions from `facts.yaml`.
- **Least privilege:** a module's `consumes` is its capability allowlist; the loader grants nothing else.

## Migration path (incremental, low-risk)

1. **Define the spec** — `heady.module.json` schema in `@heady/contracts` + a `defineModule()` helper.
2. **Build `@heady/module-loader`** — discover→validate→resolve→govern→mount, reusing `kernel.topoOrder`.
3. **Adopt for new work first** — build the unbuilt engines/bees (HeadyMC, swarm, etc.) AS modules.
4. **Wrap existing** — make `skill`/`workflow` registries and current `@heady/*` services emit a
   manifest (thin adapters) so they load through the same path — one registry for everything.
5. **CI gate** — `module-loader validate` (dry run): every manifest valid, every capability satisfied,
   no cycles, patent zones gated. Fail-closed in CI like derive/coherence.

## Trade-offs

- **For:** uniform drop-in for all component kinds; capability decoupling; per-module fail-closed;
  one governance path; directly unblocks the unbuilt engine/bee layers.
- **Cost:** a manifest per component + a loader to maintain; capability indirection adds one lookup;
  hot-swap needs careful dispose semantics (boot-time mounting is the safe default; hot-swap later).
- **Rejected alt:** ad-hoc per-kind registries (today's state) — works but fragments discovery,
  validation, and governance across N mechanisms; no capability decoupling; harder to audit.
