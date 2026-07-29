// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval State Machine v1.0.0                            ║
// ║  Fail-closed legal transitions for immutable approval history.   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { ConflictError } from "@heady/shared";

const TRANSITIONS = Object.freeze({
  draft: Object.freeze(["pending", "superseded"]),
  pending: Object.freeze(["approved", "rejected", "expired", "superseded"]),
  approved: Object.freeze(["superseded"]),
  rejected: Object.freeze([]),
  expired: Object.freeze([]),
  superseded: Object.freeze([]),
});

export function canTransition(from, to) {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new ConflictError(`illegal approval transition: ${from} → ${to}`, { from, to });
  }
  return true;
}

export function isTerminalState(state) {
  return TRANSITIONS[state]?.length === 0;
}
