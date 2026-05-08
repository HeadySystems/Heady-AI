/**
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');
const { parseLevel, Levels } = require('./levels');

const verbosityStorage = new AsyncLocalStorage();

/**
 * Get the current active verbosity level.
 * Resolution: Explicit -> Async Context -> ENV -> Default
 */
function getVerbosity() {
  const contextLevel = verbosityStorage.getStore();
  if (contextLevel !== undefined) return contextLevel;
  
  if (process.env.HEADY_VERBOSITY) {
    return parseLevel(process.env.HEADY_VERBOSITY);
  }
  
  return Levels.NORMAL;
}

/**
 * Run a function within a specific verbosity scope.
 */
function useVerbosity(level, fn) {
  const parsed = parseLevel(level);
  return verbosityStorage.run(parsed, fn);
}

module.exports = {
  getVerbosity,
  useVerbosity
};
