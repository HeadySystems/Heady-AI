---
description: Batch exact-scope destructive actions into one hashed, one-time approval ceremony without bypassing safety, governance, or platform permission gates
---

<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Destructive Manifest Approval v1.0.0                    ║
║  Exact targets · one-time consent · drift-invalidated execution ║
║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# `@heady-destructive-approve-all` / `/heady-destructive-approve-all`

Batch approval for destructive work related to the user's input. Despite the
compatibility name, this command is not blanket authorization: it approves only
the entries in one displayed, content-addressed manifest, for one execution,
against one verified before-state.

It never suppresses the safety classifier, answers a platform permission prompt
on the user's behalf, impersonates a founder or independent reviewer, weakens
CODEOWNERS or branch protection, accesses signing keys, or converts chat consent
into a cryptographic governance artifact.

## Invocation

```text
/heady-destructive-approve-all --task "<requested outcome>" --scope "<exact targets>"
```

An omitted or ambiguous task or scope keeps the command in preview mode. A
`--dry-run` request always ends after the manifest and risk report.

## Phase A — read-only orientation

1. Read the applicable `AGENTS.md`, accepted governance ADRs, and current
   approval policy. Run `/heady-handoff-check` before autonomous work.
2. Resolve every repository root, branch, HEAD, worktree, stash, remote, database
   identifier, deployment target, and filesystem boundary involved. Inspect
   in-progress Git operations. Never print secret values or broad environment
   dumps.
3. Separate the user's stated outcome from the operations merely inferred to be
   useful. Inferred destructive operations are proposed, never silently added.
4. Prefer recoverable actions: trash or quarantine before deletion, backups
   before overwrite, transaction or temporary branch before database mutation,
   and revertable commits before history rewriting.

## Phase B — exact action manifest

Create a canonical manifest with a stable key order and no unresolved variables,
globs, aliases, or symbolic target names:

```yaml
schema: heady.destructive-manifest.v1
task: exact user outcome
actor: authenticated user or verified principal
created_from:
  repository: absolute canonical root
  branch: exact branch
  head: full commit SHA
actions:
  - id: D01
    class: file_delete | overwrite | git_history | database | deployment | iam | secret | external
    operation: exact command or API mutation
    target: exact absolute path or canonical remote resource ID
    before_sha256: digest or canonical state identifier
    expected_after: explicit postcondition
    affected_resources: exact bounded list
    reversible: true | false
    backup_or_rollback: concrete verified procedure
    prerequisites: exact gates and credentials
scope_sha256: sha256 of the canonical manifest without this field
```

Use the approval policy's bounded-resource ceiling. Split a larger proposal into
multiple manifests instead of treating `all repos`, `all databases`, `all
filesystems`, or an entire home/workspace tree as an executable target.

Reject these targets until narrowed to explicit descendants:

- `/`, `$HOME`, `~`, a workspace or repository root as a recursive deletion;
- unresolved environment variables, command substitutions, wildcards, or
  symlinks whose resolved destinations were not shown;
- every remote, database, bucket, deployment, secret, or branch selected only by
  a broad `all` label.

## Phase C — gates that this command cannot batch away

List these beside the manifest as independently unsatisfied until their native
evidence exists:

- safety-classifier and runtime permission prompts;
- founder signatures, exact-hash approval receipts, CODEOWNERS, protected-branch
  review, and independent human or ARBITER evidence;
- approval-control-plane, stage-0, patent-locked, signer-registry, KMS, IAM, and
  secret-destruction ceremonies;
- production deployment protection and database safeguards;
- credentials or live access that are absent, expired, or unverified.

The repository autonomous-approval lane is low-risk and reversible. It cannot be
repurposed to authorize destructive, infrastructure, policy, secret, approval-
system, or production-deployment work.

## Phase D — one explicit approval

Show the full manifest, irreversible consequences, backups, rollback limits,
external gates, and the final `scope_sha256`. Then stop and require this exact
confirmation in a new user message:

```text
APPROVE HEADY DESTRUCTIVE MANIFEST <scope_sha256>
```

Ordinary agreement such as `yes`, `proceed`, `approve all`, an Autopilot level,
or the command invocation itself does not satisfy this ceremony. A changed
manifest, target state, branch, HEAD, database checksum, deployment revision, or
scope invalidates the approval and requires a new digest and confirmation.

## Phase E — controlled execution

After exact confirmation:

1. Recompute every before-state and the manifest digest. Fail closed on drift.
2. Execute only listed action IDs, requesting every platform-required permission
   normally. Never broaden a tool approval prefix to cover destructive commands.
3. Verify the postcondition after each action. Stop on the first mismatch rather
   than cascading uncertain state.
4. Preserve rollback material until the user accepts the verified outcome.
5. Return an audit receipt with action ID, target, before/after identifiers,
   actual result, remaining gates, and rollback status. Redact credentials.

Approval expires when the manifest completes, any entry fails, state drifts, the
task changes, or the current execution ends. It is never reusable or persistent.
