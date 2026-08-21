<!-- ╔══════════════════════════════════════════════════════════════════╗ -->
<!-- ║  HEADY™ AutoFlow Git and Worktree Evidence                     ║ -->
<!-- ║  Fetch comparison, concurrent commits, and promotion gates.    ║ -->
<!-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║ -->
<!-- ╚══════════════════════════════════════════════════════════════════╝ -->

# Git and Worktree Evidence

## G1 fetch and comparison

- Remote: `git@github.com:HeadySystems/Heady-AI.git`
- Branch: `checkpoint/rebuild-substrate-2026-07-23`
- Initial fetched comparison: `0` behind, `3` ahead at `7cb4fcec09466e69c3781902765f4dd9b4da807e`.
- Final comparison after concurrent repository automation: `0` behind, `0` ahead at
  `72881222e7b9237bf8dfd0d4f9ca5311dd03e014`.
- Final main-tree status: one pre-existing untracked handoff document,
  `docs/handoff/HANDOFF-2026-08-21T20-01-29-220Z.md`; it was preserved.

Concurrent automation created and pushed four commits during execution:

| Commit | Targeted modification |
|---|---|
| `abfcbabcb0` | Deterministic handoff verification |
| `32ee109e94` | Governed workflow exposure to Codex |
| `13dc478e24` | Approval resource ceiling `21 → 34` and rebuilt policy artifact |
| `72881222e7` | D1/KV bindings and Wrangler/Hono dependency normalization |

The executing agent did not issue the commit or push commands for those four commits.

## Worktree decisions

### `agent-990-slice`

Not committed or pushed. Its untracked `0004_approval_control_plane.sql` variant restores a
privileged `ALTER ROLE ... NOSUPERUSER ... NOBYPASSRLS` statement that the canonical migration
removed after Neon rejected the operation. It is neither beneficial nor conflict-free.

### `feat/mcp-intelligence-gateway-20260821`

Focused package, manager, database, and secret tests passed, but the Neon integration test was
skipped without a COW test database. The worktree overlaps active-branch files and remains dirty.
Concurrent automation created local commit `9bb6ebb32e`; it has no upstream and was not pushed.

### Historical prunable registrations

Several `/tmp` worktree registrations point to paths that no longer exist. They were reported but
not pruned because pruning changes repository metadata and was not necessary for the requested
promotions.
