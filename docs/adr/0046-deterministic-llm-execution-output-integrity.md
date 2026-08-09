# ADR-0046: Deterministic LLM Execution and SHA-256 Output Integrity

- **Status:** Accepted (original date unrecorded, legacy corpus) · Transferred to canonical corpus 2026-08-09
- **Deciders:** Eric Anthony Haywood

## Context

AI-generated outputs need integrity verification to detect tampering, ensure reproducibility, and
enable audit trails.

## Decision

1. All significant outputs are hashed with **SHA-256**.
2. **Temperature = 0, seed = 42** for deterministic outputs.
3. Hashes are stored alongside outputs in all logs.
4. Integrity verification is available at all API endpoints.

## Consequences

- (+) Every output is verifiable.
- (+) Deterministic outputs enable reproducibility testing.
- (+) The audit trail has cryptographic integrity.
- (−) Storage overhead: 64 bytes per hash (minimal).

## Reconciliation (2026-08-09 transfer)

- **Scope correction on determinism:** seed-based determinism is provider-dependent and is not
  guaranteed by modern hosted LLM APIs — identical (temperature, seed) requests can still return
  different tokens across provider infrastructure changes. The original text is preserved above
  unaltered; the decision as carried forward is scoped to its enforceable core:
  1. **temperature = 0 on deterministic-intent paths** (declared intent to minimize sampling
     variance);
  2. **SHA-256 hashing of significant outputs**, stored alongside the outputs in logs, verifiable at
     API boundaries;
  3. **drift detection over recorded outputs** — the rebuild's continuous-action pattern
     (`/home/headyme/Heady-AI/.agents/skills/heady-continuous-action`) records execution outputs,
     detects output drift against prior hashes, and triggers reconfiguration when determinism
     degrades. Reproducibility is therefore *observed and alarmed*, not assumed.
- `seed = 42` remains the declared parameter wherever a provider accepts a seed, but no rebuild
  component may treat seed-identity as a correctness guarantee; hash comparison is the guarantee.
- Corroborated by the legacy ADR index (`/home/headyme/Heady-AI/docs/ADR/INDEX.md`, entry 0014,
  "Deterministic LLM Execution", Accepted), whose body aligned with this source.

## Provenance

- Source: `/home/headyme/_archive/Heady/docs/adrs/008-sha256-output-integrity.md` (Accepted, undated;
  legacy corpus).
- Corroborating index entry: `/home/headyme/Heady-AI/docs/ADR/INDEX.md` (entry 0014).
- Live pattern: `/home/headyme/Heady-AI/.agents/skills/heady-continuous-action` (output recording,
  drift detection, auto-reconfiguration).
- Transferred into the canonical corpus 2026-08-09; the original remains in place in the archive.
