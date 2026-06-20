#!/bin/bash
# HEADY_BRAND:BEGIN
# Heady Systems - Claude Hook: Understanding-Workflow trigger (UserPromptSubmit)
# HEADY_BRAND:END
#
# Detects the user's "I need to actually understand this" signals and injects a reminder
# to switch from terse mode into the diagnostic UNDERSTANDING WORKFLOW. Two tiers:
#   ALARM  (frustration/"wtf"/"makes no sense") -> full stop, ground-up diagnosis.
#   PROBE  (wait/okay so/so you're telling me/does that) -> deep, grounded explanation.
# Goal: get the user to a COMFORTABLE level for THEM, separating verified vs guessed,
# and naming what is unknowable or immaterial so they can let it go. Non-blocking.

set -euo pipefail

INPUT="$(cat 2>/dev/null || true)"
PROMPT="$(printf '%s' "$INPUT" | grep -oE '"prompt"[[:space:]]*:[[:space:]]*"([^"\\]|\\.)*"' | head -1 | sed -E 's/^"prompt"[[:space:]]*:[[:space:]]*"//; s/"$//')"

ALARM_RE='what the (fuck|hell|heck) is going on|wtf|makes no sense|none of this makes sense|this is wrong|that.?s not right|lost me|i.?m so confused|what is (going on|happening)'
PROBE_RE='(^|[^a-z])(okay |ok )?so[, ]|(^|[^a-z])wait([^a-z]|$)|hold on|so you.?re telling me|does that|help me understand|^explain([^a-z]|$)|i don.?t (get|understand)|i.?m confused'

emit() {
  printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}\n' "$1"
}

if printf '%s' "$PROMPT" | grep -qiE "$ALARM_RE"; then
  emit "UNDERSTANDING WORKFLOW — ALARM TIER: the user signaled their mental model and reality have diverged badly. STOP current work. Do not defend or restate. Diagnose where the divergence happened: surface your assumptions, separate what is VERIFIED (grounded in tool output/code/files) from INFERRED from GUESSED, name what you may have gotten wrong, and rebuild a correct shared picture from the ground up. End by confirming the corrected model lands."
elif printf '%s' "$PROMPT" | grep -qiE "$PROBE_RE"; then
  emit "UNDERSTANDING WORKFLOW — PROBE TIER: the user is seeking real understanding, not a terse answer. (1) Diagnose the ROOT of the gap (WHY they don't know / are unsure), not just the surface question. (2) Close it to a level COMFORTABLE FOR THEM: consequences, what is preserved vs lost vs irreversible, edge cases. (3) Separate VERIFIED vs INFERRED vs GUESSED and flag where you might be wrong — never present a guess as fact. (4) Name anything genuinely unknowable or immaterial so they can let it go. You may offer ONE light next-step suggestion, but do not push it — the user routinely ignores recommendations while thinking hard, which is expected; don't nag in the moment, but keep it and repeat it later when a CUE makes it relevant again (topic recurs, user exits flow, related blocker, or they ask) — cue-triggered, not time-based. Override terse-output defaults this turn."
fi

exit 0
