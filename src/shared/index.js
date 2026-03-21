/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Shared Foundation — shared/index.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Single entrypoint for all shared foundation modules.
 * Usage: let heady = null; try { heady = require('./shared'); } catch(e) {
   const logger = require('../utils/logger');
   logger.error('Unexpected error', { error: e.message, stack: e.stack });
 }
 *
 * © HeadySystems Inc.
 */

'use strict';

let phiMath = null; try { phiMath = require('./phi-math'); } catch(e) {
  const logger = require('../utils/logger');
  logger.error('Unexpected error', { error: e.message, stack: e.stack });
}
let cslEngine = null; try { cslEngine = require('./csl-engine'); } catch(e) {
  const logger = require('../utils/logger');
  logger.error('Unexpected error', { error: e.message, stack: e.stack });
}
const sacredGeometry = require('./sacred-geometry');

module.exports = {
  ...phiMath,
  ...cslEngine,
  ...sacredGeometry,
};
