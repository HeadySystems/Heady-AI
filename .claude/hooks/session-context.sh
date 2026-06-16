#!/usr/bin/env bash
# SessionStart hook — injects live Heady ecosystem context into the model at
# the start of every session so it operates against current repo state, not a
# stale snapshot. Emits the SessionStart additionalContext contract as JSON.
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$repo_root"

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'detached')"
head_sha="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
head_subject="$(git log -1 --pretty=%s 2>/dev/null || echo 'n/a')"

# Surface which canonical config files are present (source of truth per CLAUDE.md).
configs=""
for f in configs/hcfullpipeline.yaml configs/resource-policies.yaml \
         configs/governance-policies.yaml configs/service-catalog.yaml \
         heady-registry.json; do
  [ -f "$f" ] && configs="${configs}${f} "
done
[ -z "$configs" ] && configs="(none found in this repo)"

context=$(cat <<EOF
HEADY SESSION CONTEXT (auto-loaded $(date -u +%Y-%m-%dT%H:%M:%SZ)):
- Repo root: ${repo_root}
- Branch: ${branch} @ ${head_sha} — "${head_subject}"
- Canonical configs present: ${configs}
- Context budget: 1M window, auto-compact at boundary, xhigh effort. Use the
  full window: read whole configs and source files rather than fragments.
- Source of truth: configs/*.yaml and heady-registry.json. Treat outdated docs
  as a defect (CLAUDE.md Standing Rule).
- Stop Rule: build aggressively when healthy; repair first when core infra,
  data integrity, or security errors exist.
EOF
)

# jq builds valid JSON regardless of special characters in the context body.
jq -n --arg ctx "$context" \
  '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'
