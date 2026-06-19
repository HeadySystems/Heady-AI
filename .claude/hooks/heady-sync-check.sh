#!/bin/bash
# HEADY_BRAND:BEGIN
# Heady Systems - Claude Hook: CLAUDE.md <-> HEADY.md Sync Guard
# HEADY_BRAND:END
#
# PostToolUse hook (Edit|Write). When CLAUDE.md is changed, remind the agent to
# propagate shared conventions to HEADY.md and the agent context pack, so any
# customization made for Claude permanently benefits the whole Heady system.
#
# Reads the tool-call JSON from stdin; emits a non-blocking reminder on match.

set -euo pipefail

INPUT="$(cat 2>/dev/null || true)"

# Extract the edited file path from the hook payload (best-effort, no jq dependency).
FILE_PATH="$(printf '%s' "$INPUT" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*"file_path"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"

case "$FILE_PATH" in
  *CLAUDE.md)
    cat <<'MSG'
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"SYNC RULE: CLAUDE.md was modified. Propagate any shared convention change (dev flow, artifact criteria, stop rule, ORS, checkpoint, source-of-truth) to HEADY.md in the SAME change, then run `node scripts/refresh-agent-context.mjs`. Divergence between CLAUDE.md and HEADY.md is a defect under the Standing Rule."}}
MSG
    ;;
  *)
    : # no-op for other files
    ;;
esac

exit 0
