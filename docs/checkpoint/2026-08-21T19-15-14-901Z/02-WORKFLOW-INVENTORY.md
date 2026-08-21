<!-- HEADY_BRAND:BEGIN
<!-- ╭───────────────────────────────────────────────────────────────╮
<!-- │  HEADY™ Workflow Inventory v1.0.0                           │
<!-- │  Significance, benefit, use, and evidence boundary by flow    │
<!-- │  © 2026 HeadySystems Inc. — Eric Haywood, Founder           │
<!-- ╰──────────────────────────────────────────────────────────────╯
<!-- HEADY_BRAND:END -->

# Workflow Inventory

The 52 source files below exist under `.agents/workflows/` and have matching
`.claude/commands/` symlink projections. Registry validation proves metadata and
projection integrity; it does not prove every referenced service, route,
credential, or production target is currently available.

| Workflow | Significance | Primary benefit | Use and evidence boundary |
|---|---|---|---|
| `agent-performance-review` | Evaluation | Makes agent effectiveness comparable | Use with real traces and defined metrics; do not infer quality from prose. |
| `antigravity-runtime` | Runtime policy | Consolidates workspace/runtime checks | Legacy examples need availability checks before execution. |
| `auto-context` | Context grounding | Pulls repository rules before work | MCP projector availability must be verified; local rules are the fallback. |
| `auto-extract-tasks` | Planning | Turns reports into actionable work | Review extracted scope before creating external tasks or mutations. |
| `bee-swarm-diagnostic` | Swarm health | Centralizes worker diagnostics | Requires actual bee registry and service evidence. |
| `code-projection` | Code generation | Connects specifications to generated artifacts | Treat vector language as process guidance; source files remain governed. |
| `concept-alignment` | Coherence | Detects concept/code divergence | Useful before architecture changes and documentation releases. |
| `continuous-embedding` | Retrieval maintenance | Keeps derived search context fresh | Neon/pgvector is authority; file indexing must use Merkle triggers. |
| `deep-scan-init` | Orientation | Broadens context before major work | Referenced scan/research capabilities must be available and verified. |
| `deployment-verification` | Release assurance | Separates deploy completion from live proof | Requires authenticated protocol and endpoint probes after deployment. |
| `domain-branding-audit` | Brand governance | Finds cross-site presentation drift | Use with generated artifacts plus deployed-page evidence when relevant. |
| `edge-cache-warm` | Performance | Reduces cold edge latency | Outward network traffic requires a confirmed target and authorization. |
| `foundational-pillars` | Architecture gate | Reasserts system invariants | Apply before structural changes; canonical ADRs override stale prose. |
| `heady-activity-tree` | Audit reporting | Produces safe activity and checkpoint evidence | Repaired to avoid the unsafe legacy generator and checkpoint mutation. |
| `heady-battle-sim` | Model evaluation | Exercises competitive multi-stage assessment | Requires current battle engine and bounded evaluation inputs. |
| `heady-command` | Compatibility | Preserves historical command usage | Now aliases the canonical non-recursive `/heady` route. |
| `heady-connectors` | Integration inventory | Reveals available MCP/services | Discovery or health is not proof that a protected tool call succeeds. |
| `heady-deploy-cloudrun` | Release execution | Standardizes Cloud Run deployment | Human-gated; verify project, region, identity, image, and canary. |
| `heady-drift-monitor` | Reliability | Detects changing output behavior | Needs durable measurements and controlled reconfiguration authority. |
| `heady-emergency-protocol` | Incident recovery | Gives failures an ordered response path | Prefer containment and evidence preservation before mutation. |
| `heady-env-sanity-checks` | Environment validation | Finds DNS/config/service mismatches early | Report secret presence only and distinguish local from deployed state. |
| `heady-g-bundle` | Knowledge transfer | Creates a dated architecture briefing | Generated summaries remain subordinate to source and governance. |
| `heady-handoff-check` | Continuity | Catches an agent up before new work | Read-only unless the user explicitly requests a new handoff bundle. |
| `heady-handoff` | Continuity | Captures delta, gates, and open work | Canonical writer advances checkpoint state; generated failures stay visible. |
| `heady-ide-rules` | Developer experience | Aligns IDE-agent behavior | Repository `AGENTS.md` remains higher authority. |
| `heady-localhost-migration` | Cloud hygiene | Removes local-only production dependencies | Confirm legitimate test-only loopback waivers before changing tests. |
| `heady-multi-remote-sync` | Git topology | Reconciles multiple remotes | Fetch/push are outward operations; verify branch, SHA, and remote authority. |
| `heady-no-local` | Architecture policy | Enforces cloud-deployed service boundaries | Repaired stale tunnel wording; exemptions remain gate-controlled. |
| `heady-omni-sync` | Meta-orchestration | Coordinates broad consistency work | Contains persistent/outward concepts; never auto-install hooks or schedulers. |
| `heady-patent-lock` | IP governance | Marks sensitive implementation zones | ARBITER/CODEOWNERS review is non-bypassable. |
| `heady-pre-commit` | Local enforcement | Proposes pre-commit quality checks | Installing hooks is persistent and requires explicit human approval. |
| `heady-prompt-pipeline` | Prompt execution | Makes model prompting repeatable and gated | Validate the current MCP executor and avoid legacy CommonJS examples. |
| `heady-secret-rotation` | Credential response | Coordinates targeted rotation | Requires exact secret scope, provider access, rollout, and revocation proof. |
| `heady-seed` | Bootstrap | Makes fresh-environment prerequisites explicit | Repaired to be plan-first; persistence and Neon writes remain human-gated. |
| `heady-service-bootstrap` | Service creation | Standardizes cold-start service setup | Verify templates and generated code against current ESM/service contracts. |
| `heady-site-deploy` | Web release | Coordinates site build and deployment | Confirm domain, project, route, auth, and rollback before outward mutation. |
| `heady-sync-sentry` | Incident integration | Connects error telemetry to work tracking | Requires live Sentry, Linear, Neon, and authorization evidence. |
| `heady-sync` | Git continuity | Supports cross-device repository synchronization | Preserve dirty trees and verify each remote before merge or push. |
| `heady-translator` | Execution posture | Converts intent into concrete action | It cannot override safety, governance, or missing user authority. |
| `heady-trigger-update` | Compatibility | Routes observations into Heady intelligence | Repaired to avoid fabricated API/storage claims and silent persistence. |
| `heady` | Primary router | Selects beneficial current Heady capabilities first | Tested Auto-Flow plus Perspective route; user authority bounds execution. |
| `health-check` | Availability | Provides cross-domain health triage | A status code alone is insufficient; probe protocol/auth/tool flows. |
| `incident-response` | Operations | Structures triage through postmortem | External remediation needs explicit incident authority. |
| `max-effort` | Resource posture | Signals intensive local analysis | “Maximum” never removes budgets, safety checks, or human gates. |
| `memory-compaction` | Retrieval hygiene | Reduces duplicate/stale derived memory | Never destruct authoritative history; validate the current memory backend. |
| `no-placeholders` | Quality gate | Prevents stubs and misleading completion | Useful across implementation and documentation. |
| `pipeline-dry-run` | Change safety | Exercises pipelines without intended side effects | Confirm the implementation really honors dry-run before trusting it. |
| `projection-hygiene` | Derived-state integrity | Finds stale or orphan projections | Classification is review evidence, not deletion authority. |
| `provider-failover-drill` | Resilience | Validates fallback behavior under simulated loss | Keep traffic bounded and avoid production disruption without approval. |
| `ram-ops` | Historical architecture | Documents earlier vector-first operating ideas | Current ADRs make Neon authoritative; do not use RAM as source of truth. |
| `secret-rotation` | Credential lifecycle | Supplies general rotation sequencing | Same exact-scope, provider, rollout, and revocation gates apply. |
| `vector-space-ops` | Cognitive operations | Describes vector/bee/event workflows | Validate current ESM modules, dimensions, and storage authority first. |

## Portfolio interpretation

The most immediately reusable cluster is routing and continuity: `heady`,
`heady-command`, `heady-handoff-check`, `heady-handoff`, and
`heady-activity-tree`. The highest-blast-radius cluster is deployment, Git sync,
secret rotation, persistent hooks/schedulers, incident remediation, and memory
compaction. Those flows are valuable precisely because they make prerequisites
visible; their existence never grants permission to satisfy those prerequisites.
