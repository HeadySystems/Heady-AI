<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Autopilot 2026-07-04 — human-gated checklist              ║
║  Every step below is structurally reserved for the founder:       ║
║  external credentials, IAM, DNS, support tickets, destructive ops.║
║  Made with ❤️ by HeadySystems Inc.                                ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# Human-gated checklist — autopilot run 2026-07-04

Everything the run could not do for you, ranked. Each item names the blocker it clears.
Companion runbooks: `SEC-001-DROP-RUNBOOK.md` (rotation detail), `1IME1_ADMIN_SURFACE_RUNBOOK.md` (DNS/hosting detail).

## 1 — Rotate the live keys (SEC-001 Phase A) · CRITICAL
Ranked order and per-provider steps are in `docs/runbooks/SEC-001-DROP-RUNBOOK.md` (status: PREPPED, NOT EXECUTED).
Highest first: **Stripe LIVE key → GitHub PAT → Neon prod password → Cloudflare API token → Neon API key → OpenAI → Anthropic ×3 → the rest.**
- Autopilot did **not** rotate anything: credential mutation in external consoles is founder-gated (and the round-2 approval question went unanswered — refused rather than assumed).
- Observed today: the Cloudflare token in `.env` already fails auth (401 on both zones and Workers AI) — it may be expired or revoked; rotating it doubles as item 3.

## 2 — Grant + persist ADMIN_TOKEN (SEC-002 arming) · HIGH
A strong `ADMIN_TOKEN` was generated into untracked `.env` (the guard arms from it via `@heady/secrets` env fallback today). To make it durable + Cloud-Run-usable:
```bash
grep '^ADMIN_TOKEN=' .env | cut -d= -f2 | tr -d '\n' | \
  gcloud secrets create ADMIN_TOKEN --project=heady-ai --replication-policy=automatic --data-file=-
# runtime SA read access (match the service account of the Cloud Run service):
gcloud secrets add-iam-policy-binding ADMIN_TOKEN --project=heady-ai \
  --member="serviceAccount:609590223909-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```
(The write was attempted and denied by the session permission classifier — correctly: external secret-store writes are yours.)

Same pattern for **SYNC_TOKEN** (device sync fabric + buddy platform-control tier; generated into `.env` on 2026-07-05):
```bash
grep '^SYNC_TOKEN=' .env | cut -d= -f2 | tr -d '\n' | \
  gcloud secrets create SYNC_TOKEN --project=heady-ai --replication-policy=automatic --data-file=-
```
Until provisioned, `/ws/sync` and the 5 platform-control buddy routes correctly refuse with 503 (fail-closed by design).
Related findings recorded this run: the legacy CrossDeviceSyncHub has been silently dead in prod (TDZ throw, caught at boot) — superseded by `@heady/sync-fabric`; `src/buddy-authorization.js:194` auto-approves unknown actions (fail-open) — mitigated today by the admin guard in front, queued for its own hardening leg.

## 3 — Mint working Cloudflare tokens · HIGH (clears TWO blockers)
The `.env` token authenticates nothing (HTTP 401, code 10000). Mint two scoped tokens in the Cloudflare dashboard:
- **Workers AI: Read** → unblocks the embed pipeline (432 jobs queued, 0 vectors written — pipeline verified fail-closed, re-run `node tooling/embed-corpus/src/embed.mjs` after updating `CLOUDFLARE_API_TOKEN` in `.env`).
- **Zone: DNS Edit** (zones: 1ime1.com, headyme.com) → unblocks DNS automation in `scripts/dns-update.js` and the 1ime1 runbook Gate A.

## 4 — GitHub Actions: support ticket for the HeadyMe account · HIGH
Evidence (all verified 2026-07-04): repo public, Actions `enabled/all` at org and repo, all 20 workflows `active`, 9,123 historical push-event runs — yet **pushes from HeadyMe create zero runs** while Dependabot pushes and dynamic workflows (CodeQL) run fine. `ci.yml` triggers on bare `push`. This signature = account-level Actions suppression; only GitHub Support can see/clear it.
- File at https://support.github.com → "Actions workflows are not triggered by pushes from my account (HeadySystems/Heady-AI); Dependabot-triggered runs work."
- Interim lever added this run: `workflow_dispatch` on `ci` and `derive-gate` — after this branch merges to `rebuild`: `gh workflow run ci --ref rebuild`.

## 5 — 1ime1.com admin surface go-live · MEDIUM
Zone already exists on your Cloudflare account and sits behind **Cloudflare Access** (302 → headyconnection.cloudflareaccess.com). Follow `docs/runbooks/1IME1_ADMIN_SURFACE_RUNBOOK.md`:
- **Ruling recorded there (yours to make): keep Access in front of the admin portal (recommended) or Firebase-only.**
- Gate A: DNS records (needs the zone token from item 3). Gate B: Firebase console custom-domain attach (TXT `hosting-site=heady-ai`, A `199.36.158.100`).

## 6 — SEC-001 Phase B: history purge (STAGED, DESTRUCTIVE — do not run before revocation) · MEDIUM
3 keys remain in git history (old Neon password ~24 commits, two Google AIza keys ~20/~13). **Revoke at provider FIRST (item 1), then**:
```bash
# irreversible force-push — after this, every clone must re-clone
git clone --mirror git@github.com:HeadySystems/Heady-AI.git heady-ai-mirror.git
java -jar bfg.jar --replace-text sec001-purge-patterns.txt heady-ai-mirror.git
cd heady-ai-mirror.git && git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force
```
(`sec001-purge-patterns.txt` = the three literals, listed in SEC-001-DROP-RUNBOOK Phase B. Autopilot staged, did not run: irreversible.)

## 7 — Paid/console leftovers · LOW
- Cloud Run `secretAccessor` grant + redeploy from the headyme.com launch runbook (if not covered by item 2's binding).
- Firebase API key referrer restrictions (SEC-001 Phase C — not a secret, restrict only).
