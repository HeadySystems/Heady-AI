// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ @heady/consistency-bus — public API                      ║
// ║  Process all ingress/egress data against HeadyRegistry; propagate   ║
// ║  any change globally; verify consistency. © 2026 HeadySystems       ║
// ╚══════════════════════════════════════════════════════════════════╝
export { loadLinkIndex, lookup } from './link-index.mjs';
export { recognize, ingressGuard, egressNormalize } from './process.mjs';
export { blastRadius, changeSet, applyChangeSet } from './propagate.mjs';
export { verifyConsistent } from './gate.mjs';
