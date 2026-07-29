// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady990 — public surface                                 ║
// ║  Ingest IRS 990 MeF XML → normalized, provenance-linked records.   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
export { parse990, tagText, contentSha256 } from "./parse.mjs";
export { normalize990 } from "./normalize.mjs";
export { validateOrg, validateFiling, RETURN_TYPES } from "./shapes.mjs";
export { loadFiling } from "./loader.mjs";
