'use strict';

const {
  PHI,
  PSI2
} = require('./constants');
function phiBackoff(attempt, baseMs = 1000, maxMs = 60000) {
  if (!Number.isInteger(attempt) || attempt < 0) {
    throw new RangeError(`attempt must be a non-negative integer, got ${attempt}`);
  }
  if (baseMs <= 0) {
    throw new RangeError(`baseMs must be positive, got ${baseMs}`);
  }
  if (maxMs < baseMs) {
    throw new RangeError(`maxMs (${maxMs}) must be >= baseMs (${baseMs})`);
  }
  const raw = baseMs * Math.pow(PHI, attempt);
  const jitterMin = 1 - PSI2;
  const jitterMax = 1 + PSI2;
  const jitter = jitterMin + Math.random() * (jitterMax - jitterMin);
  const delayed = raw * jitter;
  return Math.min(Math.round(delayed), maxMs);
}
module.exports = {
  phiBackoff
};