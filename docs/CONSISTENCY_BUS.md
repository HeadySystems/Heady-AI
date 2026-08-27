<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Consistency Bus — runtime global data consistency         ║
║  Made with ❤️ by HeadySystems Inc.                                ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# Consistency Bus — process all data, propagate every change, stay consistent

> **Status:** Built + tested · **Date:** 2026-06-16 · **Package:** `@heady/consistency-bus`
> **Planned via** `tooling/build-plan` (mapped order, seam-rework 0, PROVEN).

The **runtime counterpart** to the coherence kernel. The kernel keeps the repo consistent at *build time*;
the Consistency Bus keeps *data in motion* consistent — it processes every ingress/egress payload against
**HeadyRegistry** (the variable registry, 78 linked values), recognizes any change to a globally-linked
value, and propagates it everywhere or refuses it. It reuses what exists: HeadyRegistry as the catalog,
`ripple`/grep for blast-radius, `@heady/codeflow` for governed global apply, and the coherence gate to
verify.

## The five ports (built straight through the mapped plan)

| Port | What it does | Guarantee |
|---|---|---|
| **LinkIndexPort** (`loadLinkIndex`) | Every registered key → `{canonical value, class, sot, locked}` from the variable registry | Single source — derived, never authored |
| **ProcessPort** (`recognize`) | Flatten any payload; mark each linked value `MATCH` / `DRIFT` vs canonical | Recognition of all linked values |
| **ProcessPort** (`ingressGuard`) | Inbound `DRIFT` on a **locked** value → **BLOCK** (fail-closed) unless authorized | No inbound data corrupts a locked value |
| **ProcessPort** (`egressNormalize`) | Outbound payload rewritten to canonical (type-preserving) | Never emit a stale linked value |
| **PropagatePort** (`changeSet` + `applyChangeSet`) | Authorized canonical change → blast-radius → governed proposals for **every** site | No partial update |
| **GatePort** (`verifyConsistent`) | Coherence gate green after apply | Provable system-wide consistency |

## The data flow

```
  ingress payload ─▶ recognize ─▶ ingressGuard ──BLOCK (locked drift, unauthorized)─▶ reject
                                       │ALLOW
                                       ▼
                              (authorized canonical change?)
                                       │yes
   changeSet(key,newValue) ─▶ blastRadius (all link-sites) ─▶ applyChangeSet
                                       │  (governed via @heady/codeflow: validate→govern→approve→apply)
                                       ▼
                              verifyConsistent ──not green──▶ rollback
                                       │green
                                       ▼
  egress payload ◀─ egressNormalize ◀─ consistent system
```

## Proven (against the real registry)

- **78 linked values** indexed from HeadyRegistry.
- A bad inbound payload (`embedding.dim=1536`, `pnpm_version=8.0.0`) → **BLOCK** on both locked keys.
- `blastRadius('@cf/baai/bge-small-en-v1.5')` → **20 files** (the real link-sites a change must reach).
- A canonical change applies to **every** site via governed proposals (test: no partial update); sensitive
  sites (`facts.yaml`, security, …) hold at `governance_pending` — global propagation is itself a governed,
  human-approved change.
- 6/6 tests pass; coherence gate green with the new package.

## Wiring it in

Wrap service boundaries:
```js
import { loadLinkIndex, ingressGuard, egressNormalize } from '@heady/consistency-bus';
const index = loadLinkIndex({});                 // from HeadyRegistry
// ingress middleware:
const { verdict, blocked } = ingressGuard(req.body, index);
if (verdict === 'BLOCK') return res.status(409).json({ error: 'locked-value drift', blocked });
// egress middleware:
res.json(egressNormalize(payload, index).payload);
```
Authorized canonical change (e.g. an approved model migration):
```js
import { changeSet, applyChangeSet, verifyConsistent } from '@heady/consistency-bus';
const cs = changeSet(index, 'embedding.dim', '512');
applyChangeSet(cs, { actor: 'migration', autoApprove: true, approver: 'eric@headysystems.com' });
if (!verifyConsistent().green) throw new Error('propagation left the system inconsistent');
```

This closes the loop: HeadyRegistry knows every linked value, the bus enforces it on every byte in and out,
and any legitimate change ripples to all sites under governance — **every change happens globally, data
remains consistent.**

---
*Made with ❤️ by HeadySystems Inc.*
