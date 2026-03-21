/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Shared Foundation — shared/index.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Single entrypoint for all shared foundation modules.
 * Usage: let heady = null; try { heady = require('./shared'); } catch(e) {
   logger.error('Unexpected error', { error: e.message, stack: e.stack });
 }
 *
 * © HeadySystems Inc.
 */

'use strict';

let phiMath = null; try { phiMath = require('./phi-math'); } catch(e) {
  logger.error('Unexpected error', { error: e.message, stack: e.stack });
}
let cslEngine = null; try { cslEngine = require('./csl-engine'); } catch(e) {
  logger.error('Unexpected error', { error: e.message, stack: e.stack });
}
const sacredGeometry = require('./sacred-geometry');
const logger = require('../utils/logger');

module.exports = {
  ...phiMath,
  ...cslEngine,
  ...sacredGeometry,
};
