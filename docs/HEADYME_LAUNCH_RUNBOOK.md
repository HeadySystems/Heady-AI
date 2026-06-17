# headyme.com Launch Runbook

> Source of truth for the live-launch `/goal`: visit **https://headyme.com** → welcoming
> authorization page (headykey/headyvault) → onboarding into a personal workspace + persistent
> 3D vector memory → HeadyBuddy → admin UI (Heady-V1 + Heady-AI) on live headybee/headyswarm
> engines.
>
> Generated from `tooling/build-plan/goals/headyme-launch.json` via
> `node tooling/build-plan/src/plan.mjs`. Re-run that command to refresh the DAG.
> © 2026 HeadySystems Inc. — Eric Haywood, Founder.

## Honest headline

The single deliverable of this goal is a **truthful** "go to headyme.com" notification. That
notification cannot be sent until the site actually serves at that domain. From this build
environment the last mile is **externally blocked** — no `firebase login` session, public Cloud
Run is gated by an org policy + the safety classifier, there is no browser, and two required
credentials are invalid (`CLOUDFLARE_ACCOUNT_ID`, `DATABASE_URL`). Everything that *can* be built
and verified locally **is** built. The remaining work is credentials + deploy authority that only
the founder can supply. This runbook is the exact, ordered list of what unblocks the launch.

## Mapped critical path (deterministic)

`plan.mjs` produced a stable mapped DAG (`mapped_hash 3c3bf60ab44ffb98`). Frozen seams are
declared first, then capabilities are sliced straight through in dependency order:

```
secrets-real ──► auth ──► memory ──► admin-ui ──► buddy ──► deploy ──► dns
                  │          │           ▲
                  │          └───────────┘
                  └────────────────────────────► (engines depends on memory)
                  onboard depends on auth
```

| # | Capability | Seam | Depends on | State |
|---|------------|------|------------|-------|
| 1 | `secrets-real` | VaultPort | — | 🔒 external creds |
| 2 | `auth` | AuthPort | secrets-real | ✅ built |
| 3 | `memory` | MemoryPort | secrets-real | 🔒 needs DATABASE_URL + CF embedder |
| 4 | `admin-ui` | AdminPort | auth, memory | ✅ built (panel held on parallel work) |
| 5 | `buddy` | BuddyPort | auth, memory, admin-ui | ⚖️ internal built / external needs ADR-0016/0021 |
| 6 | `engines` | EnginePort | memory | ⚖️ design (packages/bees not built; ADR-0020) |
| 7 | `deploy` | DeployPort | auth, admin-ui | 🔒 firebase login + org policy |
| 8 | `dns` | DnsPort | deploy | 🔒 DNS records |
| 9 | `onboard` | OnboardPort | auth | ✅ built (provisioning row PARTIAL) |

Acceptance gates (must hold before notifying): **L1** no public unauthenticated surface unless org
policy permits · **L2** no unverified principal reaches a workspace · **L3** per-user memory
tenant-isolated · **L4** the welcome/auth page actually serves at headyme.com.

## Bucket 1 — ✅ Built & locally verified

- **Verified-principal auth** — `packages/codeflow/src/auth.mjs` (Firebase ID-token RS256, no Admin
  SDK) + founder owner credential with constant-time compare (`server.mjs:24,44`). Satisfies L2.
- **Governed codeflow API** — proposal state machine, fail-closed validators, sensitive-path human
  approval, LCS diff, rollback (`packages/codeflow/`, 13 tests passing).
- **Consistency bus middleware** — ingress locked-value guard + egress normalize wired into the
  codeflow API (`server.mjs:103,129`); blast-radius propagation over HeadyRegistry.
- **HeadyPerspective routing** — `/api/assign` ranks the optimal-company roles (8 agents/35 bees/
  134 skills), CSL-cosine semantic with lexical fallback (`packages/perspective/`, 9 tests).
- **Portal onboarding + admin UI** — `apps/headyme-portal` (OnboardingUI sign-in/up → admin; admin
  panels for live status, codeflow, perspective, file browser). Live data, no fabrication.
- **Coherence kernel** — green on the launch-path identity facts after this runbook's
  package.json↔facts.yaml reconciliation (4 contradictions cleared).
- **Secret registry + loader** — `@heady/secrets` fail-closed, GCP Secret Manager rotation paths
  declared per secret.

## Bucket 2 — ⚖️ Needs a founder decision (no external dependency)

1. **Patent count — RESOLVED = 51** (HS-2026-001 through HS-2026-051). `facts.yaml` previously
   carried a wrong `60`, which the coherence kernel (treating facts.yaml as authority) used to flag
   the *correct* "51" prose as drift. Founder confirmed **51**; `facts.yaml` and all skills/docs
   corrected. The historical "22 filed in January 2026" is an early batch, not the total.
2. **`@headyme` scope escape** — `heady-sacred-geometry-sdk` publishes as `@headyme/...`; locked
   scope is `@heady`. Rename or formally except it.
3. **Drupal qdrant/localhost** — `configs/drupal/web/modules/heady_config/...` references a dropped
   store at a loopback URL (legacy). Decide: delete the drupal config or quarantine it out of the
   canonical scan roots.
4. **engines (headybee/headyswarm)** — `packages/bees` is design-only. Building the NATS async swarm
   is net-new work behind ADR-0020; not required for the auth→onboarding→admin first cut.

## Bucket 3a — ✅ Resolved via connected apps (live-verified)

Retrieved from the provider APIs using credentials already in `.env`, then verified live:

| Value | Source | Verification |
|-------|--------|--------------|
| `CLOUDFLARE_ACCOUNT_ID` = `8b1fa38f…d53323` ("Heady") | CF API `/accounts` via Global API Key (X-Auth as `eric@headyconnection.org`) | Workers AI `@cf/baai/bge-small-en-v1.5` returned a **384-dim** vector ✓ |
| `DATABASE_URL` (Neon pooled `postgres://`) | Neon API `/connection_uri` (project `cool-wind-37254039`, branch `production`, db `neondb`) | TLS handshake to `…westus3.azure.neon.tech:5432`, `Verify return 0` ✓ |
| `CLOUDFLARE_EMAIL` = `eric@headyconnection.org` | required for Global-API-Key auth | end-to-end `resolveEmbedder` serves `workers-ai:global-key`, dim 384 ✓ |

Code change: `tooling/embed-corpus/src/embedder.mjs` now supports **both** a scoped token (Bearer)
and a Global API Key (X-Auth-Email + X-Auth-Key, inferred from `CLOUDFLARE_EMAIL`).
`CLOUDFLARE_EMAIL` added to `packages/secrets/src/registry.mjs`.

> **Security follow-up (recommended):** the Cloudflare credential is a **Global API Key** — full
> account access. Per least-privilege, mint a **scoped Workers AI token** (`Workers AI:Read`),
> replace `CLOUDFLARE_API_TOKEN`, and remove `CLOUDFLARE_EMAIL`. The code falls back to Bearer
> automatically. The Global key works today; the scoped token shrinks blast radius.

## Bucket 3b — 🔒 Still externally blocked (founder must supply)

| Blocker | What's wrong | Action |
|---------|-------------|--------|
| Firebase deploy | no `firebase login` session | Run `! firebase login` in this session, then `firebase deploy` |
| Public Cloud Run | org policy blocks `--allow-unauthenticated`; safety classifier blocks the public deploy | Approve/relax the org policy or front the API with an authenticated edge worker |
| DNS for headyme.com | no records pointing at the live origin | Point headyme.com → Firebase Hosting / Cloud Run origin |

## Deploy sequence (once Bucket 3 is supplied)

1. `! firebase login` (interactive — run with the `!` prefix so output lands here).
2. Write real `CLOUDFLARE_ACCOUNT_ID` + `DATABASE_URL` to `.env`, then push to Secret Manager:
   `node packages/secrets/bin/heady-secrets.mjs push CLOUDFLARE_ACCOUNT_ID DATABASE_URL`.
3. `node packages/secrets/bin/heady-secrets.mjs verify` — fail-closed loader must pass.
4. Run migrations against the real Neon DB; confirm `vector(384)` per ADR-0015.
5. Deploy the codeflow API to Cloud Run (authenticated, or behind the edge worker per org policy).
6. `pnpm --filter headyme-portal build && firebase deploy --only hosting`.
7. Point DNS: headyme.com → hosting; api origin → Cloud Run/edge worker.
8. **Verify L4**: curl https://headyme.com → the welcome/auth page renders. Only then is the
   "go to headyme.com" notification truthful.

## What I will NOT do

- Send a completion notification before L4 holds (the site actually serves). The goal explicitly
  asked to be notified *on completion* — a notification before the site is live would be false.
- Work around the public-deploy org policy or the safety classifier.
- Commit `.env` or echo any secret value.
- Unilaterally rewrite patent counts or other founder/legal claims.
