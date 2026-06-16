#!/usr/bin/env bash
# PreToolUse(Bash) hook — last-line guard against catastrophic, irreversible
# commands that pattern-match past the permission allowlist. Aligns with the
# Heady governance rule: destructive actions require explicit human confirmation.
#
# Exit contract: emits a PreToolUse permissionDecision. "deny" hard-blocks the
# call; "ask" forces a confirmation prompt; absence of either lets normal
# permission rules decide. Never blocks on benign commands.
set -uo pipefail

payload="$(cat)"
if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null)"
else
  cmd="$payload"
fi

emit() {
  # $1 = allow|deny|ask, $2 = reason
  jq -n --arg d "$1" --arg r "$2" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: $d, permissionDecisionReason: $r}}'
}

# Catastrophic / irreversible — hard deny.
deny_patterns=(
  'rm[[:space:]]+-rf[[:space:]]+/'
  'rm[[:space:]]+-rf[[:space:]]+~'
  ':\(\)\{.*\|.*&.*\}'
  'git[[:space:]]+push[[:space:]].*(--force|-f)([[:space:]]|$)'
  'git[[:space:]]+reset[[:space:]]+--hard[[:space:]]+origin'
  'mkfs\.'
  'dd[[:space:]]+if=.*of=/dev/'
  '>[[:space:]]*/dev/sd'
)

# Destructive but legitimate in context — require confirmation.
ask_patterns=(
  'DROP[[:space:]]+(TABLE|DATABASE|SCHEMA)'
  'TRUNCATE[[:space:]]+TABLE'
  'gcloud[[:space:]]+.*delete'
  'gh[[:space:]]+repo[[:space:]]+delete'
  'wrangler[[:space:]]+.*delete'
  'kubectl[[:space:]]+delete'
)

for p in "${deny_patterns[@]}"; do
  if printf '%s' "$cmd" | grep -qiE "$p"; then
    emit deny "Blocked by Heady guard: matches catastrophic pattern /$p/. Irreversible data/infra loss — run by hand after confirming."
    exit 0
  fi
done

for p in "${ask_patterns[@]}"; do
  if printf '%s' "$cmd" | grep -qiE "$p"; then
    emit ask "Heady guard: destructive operation (/$p/). Confirm before proceeding."
    exit 0
  fi
done

# No match: stay silent so normal permission rules apply.
exit 0
