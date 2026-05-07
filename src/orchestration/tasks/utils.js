'use strict';

/**
 * Standardizes a task execution result.
 * @param {string} id - Task identifier
 * @param {string} status - 'pass', 'warn', 'fail', 'error'
 * @param {any} value - Primary data returned by the task
 * @param {number} start - Performance.now() or Date.now() start time
 * @returns {Object} Canonical result object
 */
function taskResult(id, status, value, start) {
  const duration = typeof performance !== 'undefined' ? performance.now() - start : Date.now() - start;
  return {
    id,
    status,
    value,
    durationMs: parseFloat(duration.toFixed(3)),
    timestamp: Date.now()
  };
}

module.exports = { taskResult };
