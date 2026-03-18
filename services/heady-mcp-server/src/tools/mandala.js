/**
 * Mandala — Sacred Geometry Computation Engine
 * =============================================
 * The first MCP tool for φ-scaled geometry: golden ratio computation,
 * Fibonacci sequences, sacred forms (Flower of Life, Metatron's Cube),
 * Platonic solids, and phyllotaxis simulation.
 *
 * Fills a complete gap in the 17,000+ MCP ecosystem.
 *
 * @module tools/mandala
 */
'use strict';

const { PHI, PSI, FIB } = require('../config/phi-constants');

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = TAU / (PHI * PHI); // ~137.508° in radians

// ── Sacred Geometry Generators ────────────────────────────────────────────

/** Generate Fibonacci sequence up to n terms with φ-convergence */
function fibonacci(n) {
  const seq = [0, 1];
  const ratios = [];
  for (let i = 2; i < n; i++) {
    seq.push(seq[i - 1] + seq[i - 2]);
    ratios.push(seq[i] / seq[i - 1]);
  }
  return {
    sequence: seq.slice(0, n),
    ratios,
    convergence_to_phi: ratios.length > 0 ? Math.abs(ratios[ratios.length - 1] - PHI) : null,
    phi: PHI,
  };
}

/** Generate golden spiral points */
function goldenSpiral(turns, pointsPerTurn = 50) {
  const points = [];
  const totalPoints = turns * pointsPerTurn;
  for (let i = 0; i < totalPoints; i++) {
    const theta = (i / pointsPerTurn) * TAU;
    const r = Math.pow(PHI, (2 * theta) / TAU);
    points.push({
      x: parseFloat((r * Math.cos(theta)).toFixed(4)),
      y: parseFloat((r * Math.sin(theta)).toFixed(4)),
      r: parseFloat(r.toFixed(4)),
      theta: parseFloat(theta.toFixed(4)),
    });
  }
  return { points, turns, phi: PHI };
}

/** Generate phyllotaxis pattern (sunflower spiral) */
function phyllotaxis(count, scale = 1) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const angle = i * GOLDEN_ANGLE;
    const r = scale * Math.sqrt(i);
    points.push({
      x: parseFloat((r * Math.cos(angle)).toFixed(4)),
      y: parseFloat((r * Math.sin(angle)).toFixed(4)),
      index: i,
    });
  }
  return {
    points,
    count,
    golden_angle_rad: parseFloat(GOLDEN_ANGLE.toFixed(6)),
    golden_angle_deg: parseFloat((GOLDEN_ANGLE * 180 / Math.PI).toFixed(3)),
  };
}

/** Generate Platonic solid vertices */
function platonicSolid(type) {
  const solids = {
    tetrahedron: {
      vertices: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
      faces: [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]],
      edges: 6, faces_count: 4, vertices_count: 4, dual: 'tetrahedron',
    },
    cube: {
      vertices: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
      faces: [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]],
      edges: 12, faces_count: 6, vertices_count: 8, dual: 'octahedron',
    },
    octahedron: {
      vertices: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
      faces: [[0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2], [1, 2, 4], [1, 4, 3], [1, 3, 5], [1, 5, 2]],
      edges: 12, faces_count: 8, vertices_count: 6, dual: 'cube',
    },
    dodecahedron: {
      vertices: (() => {
        const p = PHI, q = 1 / PHI;
        return [
          [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
          [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
          [0, q, p], [0, q, -p], [0, -q, p], [0, -q, -p],
          [q, p, 0], [q, -p, 0], [-q, p, 0], [-q, -p, 0],
          [p, 0, q], [p, 0, -q], [-p, 0, q], [-p, 0, -q],
        ];
      })(),
      edges: 30, faces_count: 12, vertices_count: 20, dual: 'icosahedron',
      note: 'φ appears naturally in dodecahedron vertex coordinates',
    },
    icosahedron: {
      vertices: (() => {
        const p = PHI;
        return [
          [0, 1, p], [0, 1, -p], [0, -1, p], [0, -1, -p],
          [1, p, 0], [1, -p, 0], [-1, p, 0], [-1, -p, 0],
          [p, 0, 1], [p, 0, -1], [-p, 0, 1], [-p, 0, -1],
        ];
      })(),
      edges: 30, faces_count: 20, vertices_count: 12, dual: 'dodecahedron',
      note: 'φ appears naturally in icosahedron vertex coordinates',
    },
  };
  return solids[type] || { error: `Unknown solid: ${type}. Options: ${Object.keys(solids).join(', ')}` };
}

/** Generate Flower of Life circle centers */
function flowerOfLife(rings = 3) {
  const circles = [{ x: 0, y: 0, r: 1 }];
  const R = 1;

  for (let ring = 1; ring <= rings; ring++) {
    const count = ring * 6;
    for (let i = 0; i < count; i++) {
      const segment = Math.floor(i / ring);
      const pos = i % ring;
      const angle1 = (segment * Math.PI) / 3;
      const angle2 = ((segment + 1) * Math.PI) / 3;
      const x = (ring - pos) * R * Math.cos(angle1) + pos * R * Math.cos(angle2);
      const y = (ring - pos) * R * Math.sin(angle1) + pos * R * Math.sin(angle2);
      circles.push({ x: parseFloat(x.toFixed(4)), y: parseFloat(y.toFixed(4)), r: R });
    }
  }

  return {
    circles,
    rings,
    total_circles: circles.length,
    sacred_name: 'Flower of Life',
    symbolism: 'The fundamental pattern of creation — all matter, all life, all consciousness emerges from this geometry.',
  };
}

/** Generate SVG for sacred forms */
function sacredFormSVG(form, size = 400) {
  const half = size / 2;
  const scale = size / 8;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="#0a0a1a"/>`;

  if (form === 'flower-of-life') {
    const fol = flowerOfLife(3);
    for (const c of fol.circles) {
      svg += `<circle cx="${half + c.x * scale}" cy="${half + c.y * scale}" r="${c.r * scale}" fill="none" stroke="gold" stroke-width="0.5" opacity="0.8"/>`;
    }
  } else if (form === 'golden-spiral') {
    const sp = goldenSpiral(4, 100);
    let path = `M ${half + sp.points[0].x * 5} ${half + sp.points[0].y * 5}`;
    for (const p of sp.points.slice(1)) {
      path += ` L ${half + p.x * 5} ${half + p.y * 5}`;
    }
    svg += `<path d="${path}" fill="none" stroke="gold" stroke-width="1.5"/>`;
  } else if (form === 'phyllotaxis') {
    const ph = phyllotaxis(200, 2);
    for (const p of ph.points) {
      const r = 2 + (p.index / 200) * 3;
      svg += `<circle cx="${half + p.x}" cy="${half + p.y}" r="${r}" fill="gold" opacity="${0.3 + (p.index / 200) * 0.7}"/>`;
    }
  }

  svg += '</svg>';
  return svg;
}

/** φ-based layout calculator */
function phiLayout(totalWidth, sections = 2) {
  const layouts = [];
  let remaining = totalWidth;

  for (let i = 0; i < sections; i++) {
    const width = i === sections - 1 ? remaining : remaining / PHI;
    layouts.push({
      section: i + 1,
      width: parseFloat(width.toFixed(2)),
      ratio_of_total: parseFloat((width / totalWidth).toFixed(4)),
    });
    remaining -= width;
  }

  return {
    total_width: totalWidth,
    sections: layouts,
    phi: PHI,
    principle: 'Each section relates to the next by the golden ratio φ',
  };
}

/** Detect φ-proportions in a set of measurements */
function detectPhi(values) {
  const ratios = [];
  for (let i = 0; i < values.length - 1; i++) {
    const ratio = values[i + 1] / values[i];
    const deviation = Math.abs(ratio - PHI);
    ratios.push({
      pair: `${values[i]}:${values[i + 1]}`,
      ratio: parseFloat(ratio.toFixed(6)),
      deviation_from_phi: parseFloat(deviation.toFixed(6)),
      is_golden: deviation < 0.05,
    });
  }
  const goldenCount = ratios.filter((r) => r.is_golden).length;
  return {
    ratios,
    golden_ratio_matches: goldenCount,
    total_pairs: ratios.length,
    phi_harmony_score: ratios.length > 0 ? parseFloat((goldenCount / ratios.length).toFixed(4)) : 0,
  };
}

// ── Mandala Tool Definitions ──────────────────────────────────────────────
const MANDALA_TOOLS = [
  {
    name: 'mandala_phi',
    description: 'Sacred geometry φ-computation: golden ratio, Fibonacci, phi-layout, harmonic analysis. The world\'s first MCP sacred geometry engine.',
    category: 'sacred-geometry',
    phiTier: 0,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['fibonacci', 'golden-spiral', 'phyllotaxis', 'platonic-solid', 'flower-of-life', 'phi-layout', 'detect-phi', 'svg'],
          description: 'Sacred geometry operation',
        },
        n: { type: 'integer', default: 20, description: 'Count/terms for fibonacci, phyllotaxis' },
        type: { type: 'string', description: 'Solid type for platonic-solid (tetrahedron/cube/octahedron/dodecahedron/icosahedron), SVG form type' },
        turns: { type: 'number', default: 4, description: 'Spiral turns for golden-spiral' },
        width: { type: 'number', default: 1200, description: 'Total width for phi-layout' },
        sections: { type: 'integer', default: 2, description: 'Number of sections for phi-layout' },
        values: { type: 'array', items: { type: 'number' }, description: 'Measurements for detect-phi harmonic analysis' },
      },
      required: ['action'],
    },
    handler: async (args) => {
      switch (args.action) {
        case 'fibonacci':
          return fibonacci(args.n || 20);
        case 'golden-spiral':
          return goldenSpiral(args.turns || 4);
        case 'phyllotaxis':
          return phyllotaxis(args.n || 200);
        case 'platonic-solid':
          return platonicSolid(args.type || 'icosahedron');
        case 'flower-of-life':
          return flowerOfLife(args.n || 3);
        case 'phi-layout':
          return phiLayout(args.width || 1200, args.sections || 2);
        case 'detect-phi':
          return detectPhi(args.values || []);
        case 'svg':
          return { svg: sacredFormSVG(args.type || 'flower-of-life'), form: args.type || 'flower-of-life' };
        default:
          return { error: `Unknown action: ${args.action}` };
      }
    },
  },

  {
    name: 'mandala_constants',
    description: 'Return all φ-derived constants used across the Heady system — thresholds, Fibonacci pools, CSL gates.',
    category: 'sacred-geometry',
    phiTier: 1,
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({
      phi: PHI,
      psi: PSI,
      psi_squared: PSI * PSI,
      golden_angle_deg: 137.508,
      golden_angle_rad: GOLDEN_ANGLE,
      fibonacci_sequence: FIB,
      tau: TAU,
      phi_powers: Array.from({ length: 8 }, (_, i) => ({
        power: i,
        value: parseFloat(Math.pow(PHI, i).toFixed(6)),
      })),
      psi_powers: Array.from({ length: 8 }, (_, i) => ({
        power: i,
        value: parseFloat(Math.pow(PSI, i).toFixed(6)),
      })),
      identity: 'φ² = φ + 1, φ × ψ = 1, φ − ψ = 1',
    }),
  },
];

module.exports = { MANDALA_TOOLS };
