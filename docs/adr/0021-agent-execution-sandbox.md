# ADR-0021: Agent Code Execution Sandbox

- **Status:** Accepted (2026-06-15)
- **Deciders:** Eric Anthony Haywood

## Context

Agents continuously generate, test, and execute code. Executing untrusted AI-generated code natively poses severe security and stability risks. We require a secure, multi-tenant sandbox to prevent runaway loops, container escapes, and host system degradation.

## Decision

1. **WASM WebContainers (`heady-web-container`)** are the primary execution sandbox for AI-generated code.
2. Code execution happens entirely in the browser/client side via WebAssembly.
3. Cloud Run isolated Docker instances are reserved strictly for authorized deployment pipelines, not iterative agent testing.

## Consequences

- (+) Zero cloud compute cost for agent code evaluation.
- (+) Instant startup and teardown of environments.
- (+) Inherent isolation from the backend network and secrets.
- (−) Certain native Node.js binaries or C++ addons cannot compile or run in WASM.

## Reconciliation (v2, 2026-06-15)

**Scoped by purpose** to avoid conflict with ADR-0016:
- **Agent dev-loop / code execution (server-side):** Cloudflare **Sandboxes + Outbound Workers** (ADR-0016)
  — the apprentice's build/test/eval loop, with credentials held in the Worker; escape hatch = Cloud Run Jobs.
- **In-browser instant preview (user-facing):** **WASM WebContainers** (`heady-web-container`) — live
  coding previews with no server compute. This is what this ADR governs.
The June Native Interface spec (newer) chose Cloudflare Sandboxes for the agent loop; WebContainers remain
the browser-preview surface. See ADR-0016 and `docs/compendium/06-governance.md` §G8.
