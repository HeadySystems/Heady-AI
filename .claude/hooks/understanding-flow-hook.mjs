#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Understanding-Flow Hook — UserPromptSubmit v1.0.0        ║
// ║  Auto-detects the user's probe/alarm phrases and injects the     ║
// ║  Human Understanding & Flow Protocol (CLAUDE.md §VII).           ║
// ║  Advisory only: emits additionalContext, never blocks/writes.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Reads the UserPromptSubmit payload from stdin, matches the prompt against
// two tiers of understanding-seeking signals, and — on a match — prints a
// hookSpecificOutput block that reminds the agent to run the diagnostic
// Understanding Workflow instead of a terse answer.
//
// Non-blocking by contract: always exits 0, emits nothing on no-match, and
// swallows all errors so a malformed payload can never gate a prompt.

import { readFileSync } from "node:fs";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

// Tier signals. Liberal by design — the user prefers over-explaining to being
// silently misread. ALARM = model/reality divergence (full stop); PROBE =
// wants real understanding (deep, grounded explanation).
const ALARM_RE =
  /what the (fuck|hell|heck) is going on|(^|\W)wtf(\W|$)|makes no sense|none of this makes sense|that'?s not right|lost me|i'?m so confused|what is (going on|happening)/i;
const PROBE_RE =
  /(^|\W)(okay |ok )?so[, ]|(^|\W)wait(\W|$)|hold on|so you'?re telling me|does that|help me understand|(^|\W)explain(\W|$)|i don'?t (get|understand)|i'?m confused/i;

const ALARM_CONTEXT =
  "UNDERSTANDING WORKFLOW — ALARM TIER: the user signaled their mental model and reality have diverged badly. STOP current work; do not defend or restate. Diagnose where the divergence happened: surface assumptions, separate VERIFIED (tool output/code/files) from INFERRED from GUESSED, name what you may have gotten wrong, and rebuild a correct shared picture from the ground up. End by confirming the corrected model lands.";

const PROBE_CONTEXT =
  "UNDERSTANDING WORKFLOW — PROBE TIER: the user wants real understanding, not a terse answer. (1) Diagnose the ROOT of the gap (WHY they are unsure), not just the surface question. (2) Close it to a level COMFORTABLE FOR THEM: consequences, what is preserved vs lost vs irreversible, edge cases. (3) Separate VERIFIED vs INFERRED vs GUESSED/RIFFED and LABEL improvised takes as riffs — confident tone must not pose as established fact (the user's high trust amplifies this); a joke may breathe, but never leave a riff taken as real. (4) Name anything genuinely unknowable or immaterial so they can let it go. You may offer ONE light next step, but do not nag — keep it and resurface later on a CUE, not a timer. Override terse-output defaults this turn.";

function emit(context) {
  const payload = {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: context,
    },
  };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readStdin() || "{}");
  } catch {
    process.exit(0); // never gate a prompt on a parse failure
  }

  const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
  if (!prompt) process.exit(0);

  if (ALARM_RE.test(prompt)) {
    emit(ALARM_CONTEXT);
  } else if (PROBE_RE.test(prompt)) {
    emit(PROBE_CONTEXT);
  }

  process.exit(0);
}

main();
