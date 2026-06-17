// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ @heady/perspective — public API                          ║
// ║  Perspective levels (authority bias) on source data + the optimal-  ║
// ║  company role model + perspective-weighted task assignment.         ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
export { loadRoles, tokenize } from './roles.mjs';
export { levelFor, sourceLevels } from './perspective-level.mjs';
export { assign } from './assign.mjs';
export { train, persist } from './hc-train.mjs';
