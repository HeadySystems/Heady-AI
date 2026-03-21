/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Shared Foundation — shared/index.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Single entrypoint for all shared foundation modules.
 * Usage: let heady = null; try { heady = require('./shared'); } catch (e) { /* graceful */  logger.error('Operation failed', { error: e.message }); }
 *
 * © HeadySystems Inc.
 */

'use strict';
const logger = require(require('path').resolve(__dirname, '..', 'utils', 'logger')) || console;

let phiMath = null; try { phiMath = require('./phi-math'); } catch (e) { /* graceful */  logger.error('Operation failed', { error: e.message }); }
let cslEngine = null; try { cslEngine = require('./csl-engine'); } catch (e) { /* graceful */  logger.error('Operation failed', { error: e.message }); }
const sacredGeometry = require('./sacred-geometry');

module.exports = {
  ...phiMath,
  ...cslEngine,
  ...sacredGeometry,
};
