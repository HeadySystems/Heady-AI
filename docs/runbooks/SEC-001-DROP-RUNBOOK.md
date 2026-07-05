# SEC-001 Drop — Execution Runbook

> **STATUS: PREPPED, NOT EXECUTED.** Nothing in this file has been run. Execute when fresh / governor-on.
> ⚠️ = irreversible or destructive — requires deliberate, awake confirmation. **Comfort gates the irreversible.**
> **No secret VALUES appear in this file by design.** Supply new values via stdin / quarantine files at execution time, then shred them.
>
> Grounded in: `src/services/vault-boot.js` (runtime projection) + `packages/secrets/src/cli.mjs` (`heady-secrets` CLI → GCP Secret Manager). Findings from the 2026-06-21 security-bee audit.

---

## ⚠️ TWO FINDINGS THE FILE-SCAN COULDN'T SEE (read the code, decide these first)

1. **Canonical = native HeadyKey/HeadyVault services ON GCP (substrate), not GCP-direct.**
   - Intended (and already encoded in `@heady/secrets`): **HeadyVault → `secretAccessor` (reads)** + **HeadyKey → `secretVersionAdder` (writes/rotates)**, bound on GCP Secret Manager via `heady-secrets grant`. GCP Secret Manager + WIF = the keyless **backend**; HeadyKey/HeadyVault = the sovereign **interface**. (Midi-bus pattern: interface = protocol, GCP = swappable transport. Own the interface, rent the substrate.)
   - `vault-boot.js`'s `SecureKeyVault` (`VAULT_PASSPHRASE` / encrypted-RAM / `process.env` projection) is a **second path** — **reconcile it INTO HeadyVault**, don't run it parallel: decide if it's HeadyVault's runtime projection face or a legacy path to retire. Never bypass the native services for raw GCP, and don't rotate into two stores.
   - ⚠️ **HeadyKey is patent-blocked (HCP-0001):** the native HeadyKey *service* can't do the version-add yet, so **rotation runs through the `heady-secrets` CLI now** (it performs the GCP `versions add` directly — HeadyKey's function, un-servicified). CLI now → native HeadyKey service when unblocked.

2. **`POST /api/vault/project` returns FULL plaintext credentials (passphrase-gated).** (`vault-boot.js:168`)
   - This is a **credential-exfil surface over HTTP** — a hardcoded-secret scan will never flag it because it's a *route*, not a literal.
   - ⚠️ **Action:** ensure it is never publicly reachable; strongly prefer **removing full-projection-over-HTTP entirely** (keep `GET` masked-only at `:149`). One leaked passphrase + an exposed route = every credential, at once.

---

## ⚠️ SYSTEM-STATE REALITY CHECK (read before assuming any flow "runs")

There is **no functional running system yet** — these are *code paths*, not live pipelines. The handoff shows uncommitted work, gated launch, partial deploys. So SEC-001 splits along that line:

- **Containment — doable NOW, needs no running system:** revoke/rotate exposed keys (provider-side), store new values in Secret Manager (just a store), purge git history (a git op). Phases B + the rotate/store parts of A.
- **Runtime flow — needs a functional system:** `vault-boot` reading Secret Manager → `process.env` at boot, fail-closed-at-boot, "app consumes from the vault." This is **part of standing the system up**, not something done *to* a running one. The "confirm app boots reading from the vault" verification below **cannot be done until the system is functional.**

So: do containment now; the runtime-flow verification waits until there's a functional system (which is *why* SEC-001 fully drops as the system becomes functional, not before).

## Pre-flight (read-only — safe to run anytime)

```bash
gcloud config get-value project          # confirm target GCP project
gcloud auth list                         # confirm authed identity
heady-secrets list                       # ← capture the canonical registry KEY names (source of truth for rotation)
heady-secrets doctor                     # current fail-closed status: present / missing / invalid in Secret Manager
gh repo view HeadySystems/Heady-AI --json visibility   # private vs public → sets history-purge urgency
```

> The `heady-secrets rotate` KEY names must match the registry (`heady-secrets list`). The `vault-boot.js` names below are the *likely* names — **confirm against `list` before rotating.**

---

## Phase A — live `.env` keys → rotate → Secret Manager → teardown
Order = blast radius. Per key: **(1)** rotate at provider, **(2)** push new value into Secret Manager via stdin, **(3)** `doctor` to verify, **(4)** confirm app boots from the vault, **(5)** only then remove plaintext.

Rotation command pattern (value via **stdin only** — never argv/history):
```bash
printf '%s=%s' '<registry-key>' '<new-value>' | heady-secrets rotate --create --dry-run -   # preview
printf '%s=%s' '<registry-key>' '<new-value>' | heady-secrets rotate --create -             # commit
```

| # | Secret | `.env` | Rotate at | Likely registry key (confirm via `list`) |
|---|--------|--------|-----------|-------------------------------------------|
| A1 | **Stripe LIVE** (real money — highest) | `:63` | dashboard.stripe.com → Developers → API keys → roll live secret | `stripe-secret-key` |
| A2 | **GitHub PAT** (repo write / supply-chain) | `:54` | GitHub → Settings → Developer settings → PAT → revoke+regenerate, least scope | `github-pat-primary` |
| A3 | **Neon prod password / DATABASE_URL** | `:15` | Neon console → reset role password → new conn string | `neon-database-url` |
| A4 | **Cloudflare API token** | `:11` (+`.bak`) | CF dashboard → API tokens → roll | `cf-api-token-primary` |
| A5 | Neon API key | `:16` | Neon console | `neon-api-key` |
| A6 | OpenAI | `:47` | platform.openai.com | `openai-api-key` |
| A7 | Anthropic ×3 | `:39-41` | console.anthropic.com | `claude-api-key` (+ admin/dev variants) |
| A8 | Sentry, Pinecone, Groq, Perplexity, Upstash, HF (same pass) | `:60,25,44,57,21,74` | each provider | per `list` |

**A-teardown** ⚠️ (only after `heady-secrets doctor` is green AND app boots reading from the vault):
```bash
heady-secrets doctor        # must be OK (fail-closed) before deleting plaintext
shred -u .env .env.bak .env.bak.predburl     # ⚠️ destructive — removes the plaintext set
# .env* are gitignored + never committed (verified) — no git history action needed for these.
curl -s localhost:PORT/api/vault/health       # coverage check (or however the app exposes it)
```

---

## Phase B — history purge ⚠️ IRREVERSIBLE (force-push)
Three keys reachable in GitHub history (the 2026-03-06 BFG run missed them): old Neon password (~24 commits), two Google `AIza` keys (~20 / ~13 commits).

**B1 — REVOKE FIRST (history can't be un-exposed; the keys must be dead):**
- Both Google keys → GCP console → APIs & Services → Credentials → confirm **revoked/deleted**.
- Old Neon password → confirm rotated/dead (distinct from the live `.env` value).
- ⚠️ Do not proceed to purge until all three are confirmed dead at the provider.

**B2 — Purge from history (do NOT paste values into this repo):**
```bash
# Build a quarantine replacements file OUTSIDE the repo, from the audit output:
#   <secret-value>==>REDACTED   (one per line, all 3)
git filter-repo --replace-text /path/to/quarantine-replacements.txt
shred -u /path/to/quarantine-replacements.txt     # ⚠️ destroy the quarantine file immediately
# filter-repo drops the remote; re-add:
git remote add origin git@github.com:HeadySystems/Heady-AI.git
```

**B3 — Coordinate + force-push** ⚠️ (rewrites history — every clone must re-clone/hard-reset):
```bash
# Announce to any collaborators FIRST.
git push --force-with-lease --all
git push --force-with-lease --tags
# If repo is/was public: GitHub caches old commits in PRs/forks — contact GitHub Support to purge cached views.
```

---

## Phase C — tidy (low risk)
- **Firebase web key** (`apps/headyme-portal/src/services/firebase.js:8`): **NOT a secret** (public-by-design client ID). Do **not** rotate/purge. → set **GCP API-key application restrictions** (HTTP referrers + API restrictions) in console.
- **Cloudflare account-id** (`configs/cloudflare-workers/.wrangler/cache/wrangler-account.json`): identifier, not a credential. →
  ```bash
  echo 'configs/cloudflare-workers/.wrangler/' >> .gitignore
  git rm -r --cached configs/cloudflare-workers/.wrangler/
  ```

---

## Structural follow-on — so SEC-001 stays dropped ("no leaks needed to become available")
- Add a **fail-closed pre-deploy secret-scan gate** (wire into `governance-gate`/`tooling/enforcers`) so a future plaintext key **cannot ship** — convert leak-proofness from discipline to architecture.
- Add **`heady-secrets doctor`** to CI as a fail-closed precondition.
- Reconcile the two secret systems (Finding #1) and lock down `/api/vault/project` (Finding #2).

---

## Done-criteria (the drop is "done" when ALL true)
- [ ] `heady-secrets doctor` → all required present, 0 invalid, **OK**.
- [ ] No plaintext `.env*` on disk; app boots reading from the canonical vault.
- [ ] 3 history keys: confirmed revoked → purged → force-pushed.
- [ ] Two secret systems reconciled; `POST /api/vault/project` locked down or removed.
- [ ] Firebase key restricted; CF wrangler cache untracked.
- [ ] (Structural) fail-closed secret-scan gate live → recurrence is impossible, not just fixed.

When every box is checked, **SEC-001 drops** — and per your sequencing, that's the security floor solid → the next chapter in ops opens.
```

*Prepped 2026-06-21 by the SEC-001 audit + code read. Execute fresh. © 2026 HeadySystems Inc.*
