/**
 * @heady/sacred-geometry-sdk
 * Mathematical harmony design system built on the golden ratio.
 * © 2026 HeadySystems Inc. All Rights Reserved.
 */
'use strict';

// ── Core Constants ────────────────────────────────────────────
const PHI = (1 + Math.sqrt(5)) / 2;          // 1.618033988749895
const PHI_INV = PHI - 1;                      // 0.618033988749895
const PHI_SQ = PHI * PHI;                     // 2.618033988749895
const PHI_CUBE = PHI * PHI * PHI;             // 4.236067977499789
const SQRT5 = Math.sqrt(5);

// ── Fibonacci ─────────────────────────────────────────────────

function fibonacci(n) {
  if (n < 0) throw new RangeError('n must be non-negative');
  const seq = [0, 1];
  for (let i = 2; i <= n; i++) seq.push(seq[i - 1] + seq[i - 2]);
  return seq;
}

function fibonacciN(n) {
  return Math.round((PHI ** n - (-PHI_INV) ** n) / SQRT5);
}

const FIB_SEQUENCE = Object.freeze([
  1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765,
]);

// ── Phi Timing ────────────────────────────────────────────────

const PHI_TIMING = Object.freeze({
  TICK:       Math.round(1000 / PHI),            // 618ms
  HEARTBEAT:  Math.round(1000 * PHI),            // 1618ms
  BREATH:     Math.round(1000 * PHI_SQ),         // 2618ms
  CYCLE:      Math.round(1000 * PHI_CUBE),       // 4236ms
  DEEP:       Math.round(1000 * PHI ** 4),       // 6854ms
  MEDITATION: Math.round(1000 * PHI ** 5),       // 11090ms
  REST:       Math.round(1000 * PHI ** 6),       // 17944ms
  DREAM:      Math.round(1000 * PHI ** 7),       // 29034ms
});

function phiDelay(base, power = 1) {
  return Math.round(base * PHI ** power);
}

function phiBackoff(attempt, baseMs = 1000, maxMs = 60000) {
  return Math.min(Math.round(baseMs * PHI ** attempt), maxMs);
}

function fibonacciInterval(index, baseMs = 1000) {
  const fib = index < FIB_SEQUENCE.length ? FIB_SEQUENCE[index] : fibonacciN(index + 1);
  return fib * baseMs;
}

// ── Sacred Geometry Coordinates ───────────────────────────────

function goldenSpiral(steps, scale = 1) {
  const points = [];
  for (let i = 0; i < steps; i++) {
    const angle = i * 2 * Math.PI * PHI_INV;
    const radius = scale * Math.sqrt(i);
    points.push({
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
      angle: angle % (2 * Math.PI),
      radius,
    });
  }
  return points;
}

function torusCoordinates(u, v, R = PHI, r = 1) {
  return {
    x: (R + r * Math.cos(v)) * Math.cos(u),
    y: (R + r * Math.cos(v)) * Math.sin(u),
    z: r * Math.sin(v),
  };
}

function metatronsCube(scale = 1) {
  const vertices = [];
  for (let i = 0; i < 13; i++) {
    if (i === 0) {
      vertices.push({ x: 0, y: 0, label: 'center' });
    } else if (i <= 6) {
      const angle = ((i - 1) / 6) * 2 * Math.PI;
      vertices.push({ x: scale * Math.cos(angle), y: scale * Math.sin(angle), label: `inner-${i}` });
    } else {
      const angle = ((i - 7) / 6) * 2 * Math.PI + Math.PI / 6;
      vertices.push({ x: scale * PHI * Math.cos(angle), y: scale * PHI * Math.sin(angle), label: `outer-${i - 6}` });
    }
  }
  const edges = [];
  for (let i = 0; i < 13; i++) {
    for (let j = i + 1; j < 13; j++) {
      edges.push([i, j]);
    }
  }
  return { vertices, edges };
}

function flowerOfLife(layers = 3, scale = 1) {
  const circles = [{ x: 0, y: 0, r: scale }];
  for (let layer = 1; layer <= layers; layer++) {
    const count = layer * 6;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      const dist = scale * layer;
      circles.push({ x: dist * Math.cos(angle), y: dist * Math.sin(angle), r: scale });
    }
  }
  return circles;
}

// ── CSS Custom Properties Generator ───────────────────────────

function generateCSSProperties(prefix = 'sg') {
  const props = {
    [`--${prefix}-phi`]: PHI.toFixed(6),
    [`--${prefix}-phi-inv`]: PHI_INV.toFixed(6),
    [`--${prefix}-phi-sq`]: PHI_SQ.toFixed(6),
    [`--${prefix}-phi-cube`]: PHI_CUBE.toFixed(6),
  };

  // Fibonacci spacing scale (rem)
  FIB_SEQUENCE.slice(0, 12).forEach((fib, i) => {
    props[`--${prefix}-space-${i}`] = `${(fib / 16).toFixed(4)}rem`;
  });

  // Phi-ratio font sizes
  const baseFontSize = 1;
  for (let i = -2; i <= 5; i++) {
    const size = baseFontSize * PHI ** i;
    props[`--${prefix}-font-${i < 0 ? `n${Math.abs(i)}` : i}`] = `${size.toFixed(4)}rem`;
  }

  // Phi-ratio border-radius
  for (let i = 0; i < 6; i++) {
    props[`--${prefix}-radius-${i}`] = `${(FIB_SEQUENCE[i + 2] / 16).toFixed(4)}rem`;
  }

  // Golden ratio breakpoints
  const baseBreakpoint = 320;
  for (let i = 0; i < 6; i++) {
    props[`--${prefix}-bp-${i}`] = `${Math.round(baseBreakpoint * PHI ** i)}px`;
  }

  // Phi timing (transitions)
  Object.entries(PHI_TIMING).forEach(([key, ms]) => {
    props[`--${prefix}-timing-${key.toLowerCase()}`] = `${ms}ms`;
  });

  return props;
}

function toCSSString(prefix = 'sg') {
  const props = generateCSSProperties(prefix);
  const lines = Object.entries(props).map(([k, v]) => `  ${k}: ${v};`);
  return `:root {\n${lines.join('\n')}\n}`;
}

// ── Phi Weighting ─────────────────────────────────────────────

function phiWeights(count) {
  const raw = [];
  for (let i = 0; i < count; i++) raw.push(PHI ** -(i + 1));
  const sum = raw.reduce((s, v) => s + v, 0);
  return raw.map(v => v / sum);
}

function phiScale(base, steps) {
  return Array.from({ length: steps }, (_, i) => base * PHI ** i);
}

// ── Harmonic Resonance ────────────────────────────────────────

function harmonicResonance(frequency, harmonics = 7) {
  return Array.from({ length: harmonics }, (_, i) => ({
    harmonic: i + 1,
    frequency: frequency * (i + 1),
    amplitude: 1 / (i + 1),
    phiAmplitude: PHI_INV ** i,
  }));
}

module.exports = {
  PHI, PHI_INV, PHI_SQ, PHI_CUBE, SQRT5,
  FIB_SEQUENCE,
  fibonacci, fibonacciN,
  PHI_TIMING,
  phiDelay, phiBackoff, fibonacciInterval,
  goldenSpiral, torusCoordinates, metatronsCube, flowerOfLife,
  generateCSSProperties, toCSSString,
  phiWeights, phiScale,
  harmonicResonance,
};
