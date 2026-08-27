// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady990 — public surface                                 ║
// ║  Ingest IRS 990 MeF XML → normalized, provenance-linked records.   ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
export { parse990, tagText, contentSha256 } from "./parse.mjs";
export { normalize990 } from "./normalize.mjs";
export { validateOrg, validateFiling, validateSearchQuery, RETURN_TYPES } from "./shapes.mjs";
export { loadFiling } from "./loader.mjs";
export { rrfFuse, keywordSql, vectorSql, hydrateSql, RRF_K } from "./search.mjs";
