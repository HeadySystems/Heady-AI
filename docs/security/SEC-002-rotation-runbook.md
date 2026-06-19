# SEC-002 — Credential Rotation Runbook

**Opened:** 2026-06-17 · **Severity:** CRITICAL · **Owner:** Eric Haywood
**Trigger:** Neon alert → live prod DB string public in `HeadySystems/Heady-Main/.github/workflows/fix-gcp-secrets.yml` (~Apr 5).
**Scope:** ~135 secret-scanning alerts across **6 public legacy mirror repos** (Heady-Main / Heady-Testing / Heady-Staging = 42 each, identical mirrors; sandbox / sandbox-pre-production / Heady-pre-production = 3 each). **`heady-ai` (SoT) is clean.**

> **Assume every credential below was readable by anyone for weeks–months. Rotation — not deletion of the file — is the fix.** Privatizing the repos stops *future* scraping but does not un-leak what was already public. Work top-down: a higher item can be used to compromise lower ones.

## Pre-reqs (do once)
```
! gcloud auth login          # current token is expired — needed for Secret Manager + SA work
```
Privatize the mirrors (stops ongoing exposure) — see PR thread / the one-liner already provided.

## After EVERY rotation, update the new value in all sinks:
1. **GCP Secret Manager** (the runtime SoR) · 2. **Cloud Run** service env/secret refs · 3. **`./.env`** (local) · 4. **HeadyVault** · 5. the `@heady/secrets` registry only if the *name* changed (values never live there).

---

## TIER 0 — CRITICAL (master / broad access — rotate FIRST, in this order)

### 1. 1Password Service Account Token  → `OP_SERVICE_ACCOUNT_TOKEN`
**Why first:** unlocks the *entire vault* → every other secret. **Steps:** 1Password → Developer → Service Accounts → revoke the exposed token → create new → update sinks. Then treat all vault items as potentially read.

### 2. GCP Service Account credentials (6) + "GCP API key bound to a SA"
**Why:** broad cloud access (Secret Manager, Cloud Run, billing, data, deploy). **Steps:** **delete the exposed JSON keys, don't just rotate** — `gcloud iam service-accounts keys list/delete` per SA, then **move to Workload Identity Federation (keyless)** — you already migrated 4 SAs (see `headykey-headyvault-wif`); finish the rest. Revoke the SA-bound API key in GCP Console → APIs & Services → Credentials.

### 3. Neon production DB password  → `DATABASE_URL` (+ `NEON_API_KEY`, `NEON_PROJECT_ID`)
Neon Console → project `ep-cold-snow-aesmiwt9` (us-east-2) → Branches → role `neondb_owner` → **Reset password** → update sinks (esp. `neon-database-url` in Secret Manager). Also revoke + reissue the Neon **API key** (Account → API keys).

### 4. MongoDB Atlas URI ⚠️ UNDOCUMENTED
**Not in our service registry or secrets registry** — a Mongo cluster is in use somewhere (legacy). Atlas → Database Access → rotate the DB user password (or delete the user) → Network Access review. **Add it to `configs/service-providers.yaml` + the secrets registry** once identified.

### 5. GitHub PAT (2)  → `GITHUB_TOKEN`  +  GitHub SSH private key
PAT: GitHub → Settings → Developer settings → revoke the exposed PAT(s) → new fine-grained token. SSH: Settings → SSH keys → delete the exposed public key (its private half is leaked) → generate a new keypair. **Push protection ON afterward** (Advanced Security) so this can't recur.

---

## TIER 1 — HIGH (account control / billing / supply-chain)

| # | Credential | Our secret | Rotate at |
|---|---|---|---|
| 6 | **Anthropic Admin API Key (2)** | — | console.anthropic.com → Settings → Admin keys → revoke + reissue (org-level: can mint/revoke keys, see billing) |
| 7 | **Stripe API Key** | `STRIPE_SECRET_KEY` | dashboard.stripe.com → Developers → API keys → roll the secret key |
| 8 | **npm Access Token** | — (not in registry) | npmjs.com → Access Tokens → revoke + new (publish access = supply-chain risk) |
| 9 | **Google OAuth Client Secret** | — | GCP Console → APIs & Services → Credentials → OAuth client → reset secret (Client *ID* is public, fine) |

## TIER 2 — MEDIUM (metered API spend)

| # | Credential | Our secret | Rotate at |
|---|---|---|---|
| 10 | **Anthropic API Key (3)** | `ANTHROPIC_API_KEY`/`2`/`3` | console.anthropic.com → API keys |
| 11 | **OpenAI API Key** | `OPENAI_API_KEY` | platform.openai.com → API keys |
| 12 | **Google API Key (11)** | `GOOGLE_API_KEY`, `GEMINI_API_KEY`, `FIREBASE_API_KEY` | GCP Console → Credentials → regenerate each; add API/referrer restrictions |
| 13 | **Hugging Face token (6)** | `HUGGINGFACE_TOKEN`, `HF_TOKEN` | huggingface.co → Settings → Access Tokens |
| 14 | **Groq API Key** | `GROQ_API_KEY` | console.groq.com → API Keys |
| 15 | **Perplexity API Key** | `PERPLEXITY_API_KEY` | perplexity.ai → Settings → API |

## TIER 3 — LOW (scoped)

| # | Credential | Our secret | Rotate at |
|---|---|---|---|
| 16 | **Sentry Personal Token** | `SENTRY_PERSONAL_TOKEN` | sentry.io → Settings → Auth Tokens |
| 17 | **Notion API Token** | — | notion.so → Settings → Connections/Integrations → roll |

---

## Prevent recurrence (close the class, not just the instances)
1. **Privatize the 6 mirror repos** (done/pending) — they're "synced-from-production" copies that never needed to be public.
2. **GitHub Advanced Security: push protection + secret scanning** on every repo — blocks an inline secret *at commit time*. (This is the concrete reason to take Enterprise on the commercial org.)
3. **Never inline secrets in workflows** — `fix-gcp-secrets.yml` echoed the live string; it must read `${{ secrets.* }}`. Audit all `.github/workflows/**` for inline creds.
4. **session-guard** (PR #217) stops the autonomous writers that auto-commit; the **secret-scan enforcer** + the **`.env`↔secrets-registry coherence gate** are the local mirrors of push protection.
5. **WIF over SA keys** — keyless auth eliminates the most dangerous leak class entirely.
6. Optionally **purge git history** of the mirrors (or just delete the mirrors) — but rotation is what actually neutralizes the leaked values.

## Tracking
- SoT entry: `configs/service-providers.yaml` → `security_incidents: SEC-002-neon-public-exposure`.
- Run `node tooling/service-registry/src/service-registry.mjs risk` to see exposed/failing at a glance.
- Mark each item done here; re-run the sweep (`gh api repos/<repo>/secret-scanning/alerts?state=open`) to confirm alerts resolve after rotation + privatization.
