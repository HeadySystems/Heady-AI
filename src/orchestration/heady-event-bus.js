/**
 * Re-export from canonical src/core/heady-event-bus.js location.
 * The src/core/ version is the single source of truth (698 lines, full implementation).
 * This shim exists for backward compatibility with orchestration/ imports.
 * Last consolidated: 2026-03-21 (Session 6)
 */
module.exports = require('../core/heady-event-bus');
