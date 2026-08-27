<!-- HEADY_BRAND:BEGIN
  HEADY™ · @heady/secrets · LAYER: packages
  ∞ Sacred Geometry · Liquid Intelligence ∞
HEADY_BRAND:END -->

# @heady/secrets — Secure Injection + Rotation

Fail-closed secret loading and one-command rotation for the Heady monorepo. Secrets travel
**value → store via stdin only** — never argv, never shell history, never a committed file, never
the chat transcript. The runtime fetches through a validated, fail-closed loader; nothing reads a
raw secret without it being present and well-formed.

## Why

Before this package, code read `process.env` directly and a rotated secret only took effect if you
also re-`export`ed it. There was no catalog, no validation, no audit. This makes "fetch credentials
via secure injection" (AGENTS.md) real, and "rotate all" a single governed command.

## Library — `loadSecrets()`

```js
import { loadSecrets } from "@heady/secrets";

// Fail-closed: throws SecretsError if a required secret is missing or malformed.
const secrets = await loadSecrets({
  source: "auto",                 // "auto" (Secret Manager → env), "gcp", or "env"
  require: ["CLOUDFLARE_API_TOKEN"], // promote optional → required for this caller
});
// secrets is a frozen { NAME: value } map. The thrown error never carries values.
```

- **Production (Cloud Run):** map Secret Manager → env at deploy with `--set-secrets`, then load with
  `source: "env"`. Rotation = new version + new revision; `:latest` mapping picks it up.
- **Local dev:** `source: "auto"` reads Secret Manager via `gcloud`, falling back to `.env`.
- **Validation:** non-empty, `minLength`, `prefix`, and a loopback-URL guard (AGENTS.md #4).

## CLI — `heady-secrets`

```
heady-secrets list                      # the registry (names + required, no values)
heady-secrets doctor [--source env|gcp|auto] [--require A,B]   # fail-closed resolution check
heady-secrets rotate [file] [--project P] [--create] [--dry-run] [--disable-prev]
```

### Rotate all secrets (the secure flow)

1. Put the **new** values in a gitignored quarantine file (`.env.rotate` — matches `.gitignore`'s
   `.env.*`), one `KEY=VALUE` per line. Keys must be in the registry (`heady-secrets list`).
2. Rotate every one — each pushes a **new Secret Manager version** (value via stdin, never argv):
   ```
   heady-secrets rotate .env.rotate --project heady-ai --create
   shred -u .env.rotate
   ```
   …or pipe directly, leaving nothing on disk:
   ```
   cat .env.rotate | heady-secrets rotate --project heady-ai && history -d $(history 1)
   ```
3. `heady-secrets doctor` to confirm everything resolves. Anything reading `:latest` (or a Cloud Run
   revision mapped to `:latest`) now uses the rotated values.

`--dry-run` previews which keys would rotate (key + length only). `rotate` validates each value
**before** pushing — an invalid secret is never written. Unknown keys are skipped unless
`--allow-unknown`.

## Rotation & the HeadyVault / HeadyKey handoff

Bootstrap secrets once (the flow above), then hand ongoing rotation to Heady's services.

**1. Give Heady standing auth** (the "Heady has auth" step) — bind your dedicated service account,
least-privilege, per-secret: HeadyVault gets `secretAccessor` on every secret, HeadyKey gets
`secretVersionAdder` only on the secrets it can auto-rotate.
```
heady-secrets grant heady-vault@heady-ai.iam.gserviceaccount.com --project heady-ai [--dry-run]
```

**2. See what's due** — `planRotation` over the registry's FIB-derived `maxAgeDays`
(`INTERNAL_NODE_SECRET` 21d, provider/root 34d, manual keys 89d), reading version ages from Secret
Manager:
```
heady-secrets rotation-status --project heady-ai
```

**What actually auto-rotates — honest scope.** Each secret declares a `rotation.strategy`:

| strategy | secrets | rotation |
|----------|---------|----------|
| `internal` | `INTERNAL_NODE_SECRET` | Heady-generated → **cleanly auto-rotatable** |
| `provider` | `DATABASE_URL` (Neon), `UPSTASH_REDIS_REST_TOKEN` | only via the provider's admin API |
| `manual` | `CLOUDFLARE_API_TOKEN`, `ANTHROPIC/OPENAI/GROQ/GEMINI_API_KEY` | no rotation API → human via `rotate` |
| `root` | `VAULT_PASSPHRASE` | encryption root — needs a KEK/DEK envelope (separate design) |

"Auto-rotate everything" is not physically possible: third-party keys have no rotation API, and the
encryption root would brick data if rotated without re-encryption. This package makes every secret
**secure** (age-tracked, due-alerted, governed rotation + IAM auth); the truly-auto subset is the one
`internal` secret.

**The auto-rotation executor is patent-gated.** The Fibonacci-cadence + dual-key-overlap + zero-
downtime rotation *protocol* (generate → new version → overlap window → disable) is Heady patent
claim-surface (HS-2026-051+, per ARBITER). It is **not built here** — it requires founder
patent-clearance + an approved HCP before any executor code. Until then, `internal` secrets are
flagged `DUE` by `rotation-status` and rotated through the governed `rotate` path like the rest.

## The registry

`src/registry.mjs` is the single catalog (mirrors `.env.example`). Add a secret once there and it is
known to `loadSecrets`, `doctor`, and `rotate`. `●` required, `○` optional, `[SECRET]` never printed.

## Tests

```
node --test test/secrets.test.mjs
```

---
*Made with ❤️ by HeadySystems Inc.*
