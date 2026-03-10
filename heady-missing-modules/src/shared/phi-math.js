/**
 * Heady Phi-Math Foundation — Shared Constants & Functions
 * © 2026 HeadySystems Inc. — Sacred Geometry v4.0
 * @module shared/phi-math
 */

const PHI = (1 + Math.sqrt(5)) / 2;
const PSI = 1 / PHI;
const PHI2 = PHI + 1;
const PHI3 = 2 * PHI + 1;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];

function fib(n) {
  if (n < FIB.length) return FIB[n];
  let a = FIB[FIB.length - 2], b = FIB[FIB.length - 1];
  for (let i = FIB.length; i <= n; i++) { [a, b] = [b, a + b]; }
  return b;
}

function phiThreshold(level, spread = 0.5) {
  return 1 - Math.pow(PSI, level) * spread;
}

const CSL_THRESHOLDS = Object.freeze({
  MINIMUM:  phiThreshold(0),
  LOW:      phiThreshold(1),
  MEDIUM:   phiThreshold(2),
  HIGH:     phiThreshold(3),
  CRITICAL: phiThreshold(4),
});

const DEDUP_THRESHOLD = 1 - Math.pow(PSI, 6) * 0.5;

function phiFusionWeights(n) {
  const raw = Array.from({ length: n }, (_, i) => Math.pow(PSI, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(w => w / sum);
}

function phiBackoff(attempt, baseMs = 1000, maxMs = 60000) {
  return Math.min(Math.round(baseMs * Math.pow(PHI, attempt)), maxMs);
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function cslGate(value, cosScore, tau, temp = Math.pow(PSI, 3)) {
  return value * (1 / (1 + Math.exp(-(cosScore - tau) / temp)));
}

module.exports = {
  PHI, PSI, PHI2, PHI3, FIB, fib,
  phiThreshold, CSL_THRESHOLDS, DEDUP_THRESHOLD,
  phiFusionWeights, phiBackoff,
  cosineSimilarity, cslGate,
};
