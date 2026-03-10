/**
 * HeadySacredGeometry — Canvas renderer for per-site sacred geometry animations
 * Supports: Flower of Life, Metatron's Cube, Sri Yantra, Torus, 
 *           Seed of Life, Fibonacci Spiral, Vesica Piscis
 * 
 * Usage: HeadySacredGeometry.init(canvas, 'flower-of-life', '#00d4aa')
 */
const HeadySacredGeometry = (function() {
  'use strict';

  const PHI = 1.618033988749895;
  const TAU = Math.PI * 2;

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return { r, g, b };
  }

  function makeColor(hex, alpha) {
    const c = hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${alpha})`;
  }

  // === FLOWER OF LIFE ===
  function FlowerOfLife(canvas, accent) {
    const ctx = canvas.getContext('2d');
    let w, h, t = 0;

    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const r = Math.min(w, h) * 0.06;
      const glow = makeColor(accent, 0.08 + 0.03 * Math.sin(t * 0.5));
      const stroke = makeColor(accent, 0.25 + 0.1 * Math.sin(t * 0.7));

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.05);

      // 7-circle flower pattern (center + 6 surrounding)
      const positions = [[0, 0]];
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * TAU;
        positions.push([Math.cos(angle) * r * 2, Math.sin(angle) * r * 2]);
      }

      // Second ring (12 circles)
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * TAU;
        positions.push([Math.cos(angle) * r * 4, Math.sin(angle) * r * 4]);
        const angle2 = (i / 6 + 1/12) * TAU;
        positions.push([Math.cos(angle2) * r * 3.46, Math.sin(angle2) * r * 3.46]);
      }

      positions.forEach(([px, py], idx) => {
        const phase = t * 0.3 + idx * 0.4;
        const alpha = 0.15 + 0.08 * Math.sin(phase);
        ctx.beginPath();
        ctx.arc(px, py, r, 0, TAU);
        ctx.strokeStyle = makeColor(accent, alpha);
        ctx.lineWidth = 1;
        ctx.stroke();

        // Glowing fill for center
        if (idx === 0) {
          const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
          grad.addColorStop(0, makeColor(accent, 0.12 + 0.06 * Math.sin(t)));
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.fill();
        }
      });

      // Vesica Piscis intersection highlights
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * TAU;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        ctx.beginPath();
        ctx.arc(px, py, r * 0.15, 0, TAU);
        ctx.fillStyle = makeColor(accent, 0.4 + 0.2 * Math.sin(t + i));
        ctx.fill();
      }

      ctx.restore();

      // Outer rings (decorative)
      for (let ring = 1; ring <= 3; ring++) {
        ctx.beginPath();
        ctx.arc(cx, cy, r * (5 + ring * 2) + Math.sin(t * 0.2 + ring) * 3, 0, TAU);
        ctx.strokeStyle = makeColor(accent, 0.04 + 0.02 * ring);
        ctx.lineWidth = ring === 1 ? 1.5 : 1;
        ctx.stroke();
      }

      t += 0.008;
      requestAnimationFrame(draw);
    }
    draw();
  }

  // === METATRON'S CUBE ===
  function MetatronsCube(canvas, accent) {
    const ctx = canvas.getContext('2d');
    let w, h, t = 0;

    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const size = Math.min(w, h) * 0.28;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.04);

      // 13 circles of fruit of life
      const centers = [[0, 0]];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        centers.push([Math.cos(a) * size / 2.5, Math.sin(a) * size / 2.5]);
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6 + 1/12) * TAU;
        centers.push([Math.cos(a) * size, Math.sin(a) * size]);
      }

      // Draw connecting lines (Metatron lines)
      ctx.strokeStyle = makeColor(accent, 0.08);
      ctx.lineWidth = 0.5;
      for (let i = 0; i < centers.length; i++) {
        for (let j = i + 1; j < centers.length; j++) {
          ctx.beginPath();
          ctx.moveTo(centers[i][0], centers[i][1]);
          ctx.lineTo(centers[j][0], centers[j][1]);
          ctx.stroke();
        }
      }

      // Draw circles
      centers.forEach(([px, py], idx) => {
        const r = idx === 0 ? size / 2.5 : (idx <= 6 ? size / 5 : size / 5);
        const pulse = 0.12 + 0.06 * Math.sin(t * 0.5 + idx * 0.8);
        ctx.beginPath();
        ctx.arc(px, py, r, 0, TAU);
        ctx.strokeStyle = makeColor(accent, pulse);
        ctx.lineWidth = idx === 0 ? 1.5 : 1;
        ctx.stroke();
        if (idx === 0) {
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
          g.addColorStop(0, makeColor(accent, 0.1));
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.fill();
        }
      });

      // Star of David (Star Tetrahedron)
      function drawStar(r, alpha) {
        ctx.strokeStyle = makeColor(accent, alpha);
        ctx.lineWidth = 1;
        for (let tri = 0; tri < 2; tri++) {
          ctx.beginPath();
          for (let i = 0; i < 3; i++) {
            const a = (i / 3 + tri * 0.5) * TAU - Math.PI / 2;
            const x = Math.cos(a) * r, y = Math.sin(a) * r;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
      drawStar(size * 0.55, 0.18);
      drawStar(size * 0.35, 0.12);

      ctx.restore();
      t += 0.007;
      requestAnimationFrame(draw);
    }
    draw();
  }

  // === SRI YANTRA ===
  function SriYantra(canvas, accent) {
    const ctx = canvas.getContext('2d');
    let w, h, t = 0;

    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const size = Math.min(w, h) * 0.25;

      ctx.save();
      ctx.translate(cx, cy);

      // Draw 9 interlocking triangles
      const triangles = [
        // Upward pointing (Shiva)
        { size: 1.0, up: true, offset: 0 },
        { size: 0.75, up: true, offset: -size * 0.08 },
        { size: 0.5, up: true, offset: -size * 0.15 },
        { size: 0.3, up: true, offset: -size * 0.1 },
        // Downward pointing (Shakti)
        { size: 0.85, up: false, offset: size * 0.06 },
        { size: 0.65, up: false, offset: size * 0.1 },
        { size: 0.45, up: false, offset: size * 0.08 },
        { size: 0.25, up: false, offset: size * 0.05 },
        { size: 0.15, up: false, offset: size * 0.02 },
      ];

      triangles.forEach(({ size: s, up, offset }, idx) => {
        const r = size * s;
        const rotation = up ? 0 : Math.PI;
        const alpha = 0.12 + 0.06 * Math.sin(t * 0.4 + idx * 0.5);
        
        ctx.save();
        ctx.translate(0, offset);
        ctx.rotate(rotation + t * 0.01 * (up ? 1 : -1));
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * TAU - Math.PI / 2;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = makeColor(accent, alpha + 0.05);
        ctx.lineWidth = 1;
        ctx.stroke();
        if (idx < 2) {
          ctx.fillStyle = makeColor(accent, alpha * 0.3);
          ctx.fill();
        }
        ctx.restore();
      });

      // Center bindu (dot)
      const bindupulse = 0.6 + 0.4 * Math.sin(t * 0.8);
      ctx.beginPath();
      ctx.arc(0, 0, 6 * bindupulse, 0, TAU);
      ctx.fillStyle = makeColor(accent, 0.9);
      ctx.fill();

      // Outer circles
      [1.1, 1.3, 1.5].forEach((scale, i) => {
        ctx.beginPath();
        ctx.arc(0, 0, size * scale, 0, TAU);
        ctx.strokeStyle = makeColor(accent, 0.06 + i * 0.02);
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Petals on outer circle
      const petalR = size * 1.4;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + t * 0.02;
        const px = Math.cos(a) * petalR;
        const py = Math.sin(a) * petalR;
        ctx.beginPath();
        ctx.arc(px, py, size * 0.08, 0, TAU);
        ctx.strokeStyle = makeColor(accent, 0.15);
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.restore();
      t += 0.006;
      requestAnimationFrame(draw);
    }
    draw();
  }

  // === TORUS ===
  function Torus(canvas, accent) {
    const ctx = canvas.getContext('2d');
    let w, h, t = 0;

    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const R = Math.min(w, h) * 0.22;
      const r = R * 0.35;

      ctx.save();
      ctx.translate(cx, cy);

      // Draw torus as field lines
      const lines = 32;
      const steps = 120;

      for (let i = 0; i < lines; i++) {
        const phi = (i / lines) * TAU;
        ctx.beginPath();
        for (let j = 0; j <= steps; j++) {
          const theta = (j / steps) * TAU;
          const x = (R + r * Math.cos(theta + t)) * Math.cos(phi + t * 0.3);
          const y = (R + r * Math.cos(theta + t)) * Math.sin(phi + t * 0.3) * 0.4;
          const z = r * Math.sin(theta + t);
          const px = x + z * 0.3;
          const py = y + z * 0.3;
          j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        const alpha = 0.05 + 0.04 * Math.sin(phi + t);
        ctx.strokeStyle = makeColor(accent, alpha);
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Central glow
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.5);
      grad.addColorStop(0, makeColor(accent, 0.08));
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.5, 0, TAU);
      ctx.fill();

      // Rotating ring highlight
      const ra = t * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, R, ra, ra + Math.PI * 0.5);
      ctx.strokeStyle = makeColor(accent, 0.4);
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
      t += 0.01;
      requestAnimationFrame(draw);
    }
    draw();
  }

  // === SEED OF LIFE ===
  function SeedOfLife(canvas, accent) {
    const ctx = canvas.getContext('2d');
    let w, h, t = 0;

    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const r = Math.min(w, h) * 0.1;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.04);

      // 7 circles: center + 6
      const positions = [[0, 0]];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        positions.push([Math.cos(a) * r * 2, Math.sin(a) * r * 2]);
      }

      positions.forEach(([px, py], idx) => {
        const phase = t * 0.4 + idx * (TAU / 7);
        const alpha = 0.2 + 0.12 * Math.sin(phase);

        // Vesica piscis fills between intersecting circles
        if (idx > 0) {
          const prev = positions[idx === 1 ? 6 : idx - 1];
          ctx.save();
          ctx.beginPath();
          ctx.arc(px, py, r, 0, TAU);
          ctx.clip();
          ctx.beginPath();
          ctx.arc(prev[0], prev[1], r, 0, TAU);
          ctx.fillStyle = makeColor(accent, 0.06);
          ctx.fill();
          ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(px, py, r, 0, TAU);
        ctx.strokeStyle = makeColor(accent, alpha);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (idx === 0) {
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
          g.addColorStop(0, makeColor(accent, 0.15));
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.fill();
        }

        // Node dots at center
        ctx.beginPath();
        ctx.arc(px, py, 3 + 2 * Math.sin(phase), 0, TAU);
        ctx.fillStyle = makeColor(accent, 0.6);
        ctx.fill();
      });

      // Outer ring
      ctx.beginPath();
      ctx.arc(0, 0, r * 3.5, 0, TAU);
      ctx.strokeStyle = makeColor(accent, 0.06);
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
      t += 0.007;
      requestAnimationFrame(draw);
    }
    draw();
  }

  // === FIBONACCI SPIRAL ===
  function FibonacciSpiral(canvas, accent) {
    const ctx = canvas.getContext('2d');
    let w, h, t = 0;

    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.03);

      // Fibonacci sequence spiral
      const size = Math.min(w, h) * 0.06;
      let a = 0, b = size;
      const points = [[0, 0]];
      let angle = 0;
      let x = 0, y = 0;

      for (let i = 0; i < 12; i++) {
        const c = a + b;
        a = b;
        b = c;
        angle += Math.PI / 2;
        const newx = x + Math.cos(angle) * a;
        const newy = y + Math.sin(angle) * a;

        // Draw rectangle
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle - Math.PI / 2);
        ctx.beginPath();
        ctx.rect(0, -a, a, a);
        ctx.strokeStyle = makeColor(accent, 0.08 - i * 0.004);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // Draw spiral arc
        ctx.beginPath();
        const arcX = i % 2 === 0 ? x : newx;
        const arcY = i % 2 === 0 ? newy : y;
        const startAngle = angle - Math.PI;
        const endAngle = angle - Math.PI / 2;
        ctx.arc(arcX, arcY, a, startAngle, endAngle);
        const alpha = (0.4 - i * 0.025) * (1 + 0.2 * Math.sin(t + i * 0.5));
        ctx.strokeStyle = makeColor(accent, Math.max(0, alpha));
        ctx.lineWidth = 2 - i * 0.1;
        ctx.stroke();

        x = newx;
        y = newy;
        points.push([x, y]);
      }

      // Golden ratio circles
      [1, PHI, PHI * PHI].forEach((scale, i) => {
        ctx.beginPath();
        ctx.arc(0, 0, size * scale * 3, 0, TAU);
        ctx.strokeStyle = makeColor(accent, 0.04 + i * 0.02);
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      ctx.restore();
      t += 0.006;
      requestAnimationFrame(draw);
    }
    draw();
  }

  // === VESICA PISCIS ===
  function VesicaPiscis(canvas, accent) {
    const ctx = canvas.getContext('2d');
    let w, h, t = 0;

    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const r = Math.min(w, h) * 0.2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.02);

      // Draw vesica piscis layers
      for (let layer = 0; layer < 4; layer++) {
        const lr = r * (1 + layer * 0.25);
        const offset = lr * 0.5;

        // Left circle
        ctx.beginPath();
        ctx.arc(-offset, 0, lr, 0, TAU);
        ctx.strokeStyle = makeColor(accent, 0.1 - layer * 0.015);
        ctx.lineWidth = 1;
        ctx.stroke();

        // Right circle
        ctx.beginPath();
        ctx.arc(offset, 0, lr, 0, TAU);
        ctx.strokeStyle = makeColor(accent, 0.1 - layer * 0.015);
        ctx.stroke();

        if (layer === 0) {
          // Vesica fill
          ctx.save();
          ctx.beginPath();
          ctx.arc(-offset, 0, lr, 0, TAU);
          ctx.clip();
          ctx.beginPath();
          ctx.arc(offset, 0, lr, 0, TAU);
          const g = ctx.createLinearGradient(-lr, 0, lr, 0);
          g.addColorStop(0, makeColor(accent, 0));
          g.addColorStop(0.5, makeColor(accent, 0.12 + 0.06 * Math.sin(t)));
          g.addColorStop(1, makeColor(accent, 0));
          ctx.fillStyle = g;
          ctx.fill();
          ctx.restore();
        }
      }

      // Vertical axis line through intersections
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.2);
      ctx.lineTo(0, r * 1.2);
      ctx.strokeStyle = makeColor(accent, 0.2);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Intersection nodes
      const iy = r * Math.sqrt(3) / 2;
      [iy, -iy].forEach(vy => {
        const pulse = 4 + 3 * Math.sin(t * 1.2 + vy);
        ctx.beginPath();
        ctx.arc(0, vy, pulse, 0, TAU);
        ctx.fillStyle = makeColor(accent, 0.7);
        ctx.fill();
        const g = ctx.createRadialGradient(0, vy, 0, 0, vy, pulse * 4);
        g.addColorStop(0, makeColor(accent, 0.2));
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, vy, pulse * 4, 0, TAU);
        ctx.fill();
      });

      ctx.restore();
      t += 0.007;
      requestAnimationFrame(draw);
    }
    draw();
  }

  // === PUBLIC API ===
  return {
    init(canvas, type, accent) {
      const map = {
        'flower-of-life': FlowerOfLife,
        'metatrons-cube': MetatronsCube,
        'sri-yantra': SriYantra,
        'torus': Torus,
        'seed-of-life': SeedOfLife,
        'fibonacci-spiral': FibonacciSpiral,
        'vesica-piscis': VesicaPiscis,
      };
      const Renderer = map[type];
      if (!Renderer) {
        console.warn(`[HeadySacredGeometry] Unknown type: ${type}`);
        return;
      }
      new Renderer(canvas, accent || '#00d4aa');
    }
  };
})();

// Auto-initialize from data attributes
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-sacred-geometry]').forEach(canvas => {
    HeadySacredGeometry.init(
      canvas,
      canvas.dataset.sacredGeometry,
      canvas.dataset.accent || getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#00d4aa'
    );
  });
});
