<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  HEADY™ CONTRIBUTING GUIDE                                         ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Liquid Intelligence · Permanent Life        ║
<!-- ║  FILE: CONTRIBUTING.md · LAYER: root                              ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Contributing to Heady-AI

> Read **`AGENTS.md`** (authoritative rulebook) and **`CLAUDE.md`** (repo map)
> before your first change. This guide is the practical checklist that sits on
> top of them.

## Branch policy — read before you branch

Two documents govern branches; both are binding:

- `SOURCE_OF_TRUTH.md` (ADR-0001): `rebuild` is the canonical branch.
- `docs/DUAL_ACTIVE_BRANCH_STRATEGY.md`: **`main` and `rebuild` are both
  first-class and always deployable.** **Never merge one into the other.** Port
  by cherry-pick or reimplementation, and record it in `PARITY_LOG.md` and
  `docs/BRANCH-PARITY.md`.

Feature branches target `rebuild` and use a topic prefix, e.g.
`feat/…`, `fix/…`, `audit/…`, `docs/…`.

## Coding rules (enforced by CI + hooks)

1. **ESM only** — `import`/`export`, never `require()` in new code.
2. **No `console.log`** — use the pino structured logger with `X-Heady-Trace-Id`.
3. **Zero `TODO`/`FIXME`/`HACK`** and no placeholder/stub code.
4. **Zero `localhost` / hardcoded URLs** — all endpoints come from env vars.
5. **Zod validation** on every API input that crosses a service boundary.
6. **`HEADY_BRAND` header** in every new file (template in `AGENTS.md`).
7. **No magic numbers** — timeouts/TTLs/pool sizes derive from φ-constants
   (`packages/phi-math`: `phiBackoff()`, `FIB[n]`).
8. **Latent Service pattern** — every service exports `{ start, stop, health, metrics }`.
9. **Redis keys** namespaced `tenant:{id}:*`.
10. **No Vue/Angular** (React only for complex canvas work); tests alongside code.

## Registries — keep them in sync with reality

When you add or remove a component, update its registry so the deep-scan and
data-consistency gates stay green:

| You added / changed … | Update … |
|---|---|
| A Latent Service / route | `configs/service-catalog.yaml`, `heady-registry.json` |
| A runtime node | `configs/liquid-os/node-registry.yaml` |
| A bee worker (`src/bees/*`) | `configs/liquid-os/bee-catalog.yaml` |
| An agent / persona | `configs/liquid-os/agent-registry.yaml` |
| An MCP tool (`src/heady-mcp-server.js`) | `configs/mcp-tools.json`, `.well-known/mcp.json` |
| A workflow / slash command | author `.agents/workflows/*.md` (auto-mirrors) → verify in `configs/liquid-os/workflow-registry.yaml` |

## Local workflow

```bash
pnpm install
pnpm lint                         # eslint . --fix
pnpm test                         # turbo run test (root suites are Jest)
pnpm run consistency:verify       # data-consistency gate (exit 1 on drift)
node tooling/skill-registry/sync-workflows.mjs --check   # .agents ↔ .claude
```

## Pull requests

- Keep PR titles under 70 chars; put detail in the body.
- Include a **Summary** and a **Testing** section (see `.github/PULL_REQUEST_TEMPLATE.md`).
- Run `heady_governance_enforce` before opening a PR or canary deploy.
- Do **not** modify `⚠️ PATENT LOCK` files (HS-2026-051…062) without ARBITER review.
- Contributors do not self-approve or merge their own PRs.

---

*∞ Sacred Geometry · Liquid Intelligence · Permanent Life ∞*
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*
