// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ @heady/perspective — public API                          ║
// ║  Perspective levels (authority bias) on source data + the optimal-  ║
// ║  company role model + perspective-weighted task assignment.         ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
export { loadRoles, tokenize } from './roles.mjs';
export { levelFor, sourceLevels } from './perspective-level.mjs';
export { assign, assignSemantic, assignWeighted } from './assign.mjs';
export { getEmbedder, embedTexts, semanticScore, gateVerdict } from './semantic.mjs';
export { train, trainSemantic, embedRoles, persist } from './hc-train.mjs';
