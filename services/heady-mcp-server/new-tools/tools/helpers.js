/**
 * Heady MCP Tools — Shared Helpers
 * φ-pure constants and utilities used across all tool modules.
 */

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927 };
const VECTOR_DIM = 384;

function fibBackoff(attempt) {
  return (FIB[Math.min(attempt, FIB.length - 1)] || 1) * 1000;
}

function phiScale(base, factor) {
  return base * Math.pow(PHI, factor);
}

function cslGate(score, requiredLevel) {
  return score >= CSL[requiredLevel];
}

function correlationId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `hdy-${ts}-${rand}`;
}

function timestamp() {
  return new Date().toISOString();
}

module.exports = { PHI, PSI, FIB, CSL, VECTOR_DIM, fibBackoff, phiScale, cslGate, correlationId, timestamp };
