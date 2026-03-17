/**
 * HeadyMe Onboarding — Canvas Particle System
 * Floating particles with mouse interaction and connecting lines.
 * ES2024 module — no dependencies.
 *
 * Features:
 * - Max 80 particles for performance
 * - Mouse proximity interaction (attraction/repulsion)
 * - Connecting lines between nearby particles
 * - Responsive canvas sizing with DPR support
 * - requestAnimationFrame loop with automatic cleanup
 * - Respects prefers-reduced-motion
 */

export class ParticleSystem {
  #canvas = null;
  #ctx = null;
  #particles = [];
  #mouse = { x: -1000, y: -1000 };
  #animationId = null;
  #dpr = 1;
  #width = 0;
  #height = 0;
  #resizeObserver = null;

  /* Configuration */
  static MAX_PARTICLES = 80;
  static CONNECTION_DISTANCE = 120;
  static MOUSE_RADIUS = 150;
  static PARTICLE_MIN_RADIUS = 1;
  static PARTICLE_MAX_RADIUS = 2.5;
  static BASE_SPEED = 0.3;
  static MOUSE_FORCE = 0.02;
  static LINE_OPACITY = 0.15;
  static PARTICLE_COLOR = '#00d4aa';
  static LINE_COLOR = '0, 212, 170';

  constructor(canvasId) {
    this.#canvas = document.getElementById(canvasId);
    if (!this.#canvas) return;

    /* Respect reduced motion preference */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.#canvas.style.display = 'none';
      return;
    }

    this.#ctx = this.#canvas.getContext('2d');
    this.#dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.#resize();
    this.#createParticles();
    this.#bindEvents();
    this.#animate();
  }

  /* ---- Setup ---- */

  #resize() {
    this.#width = window.innerWidth;
    this.#height = window.innerHeight;
    this.#canvas.width = this.#width * this.#dpr;
    this.#canvas.height = this.#height * this.#dpr;
    this.#canvas.style.width = `${this.#width}px`;
    this.#canvas.style.height = `${this.#height}px`;
    this.#ctx.scale(this.#dpr, this.#dpr);
  }

  #createParticles() {
    const count = Math.min(
      ParticleSystem.MAX_PARTICLES,
      Math.floor((this.#width * this.#height) / 15000)
    );

    this.#particles = Array.from({ length: count }, () => this.#spawnParticle());
  }

  #spawnParticle(x, y) {
    const minR = ParticleSystem.PARTICLE_MIN_RADIUS;
    const maxR = ParticleSystem.PARTICLE_MAX_RADIUS;
    const speed = ParticleSystem.BASE_SPEED;

    return {
      x: x ?? Math.random() * this.#width,
      y: y ?? Math.random() * this.#height,
      vx: (Math.random() - 0.5) * speed * 2,
      vy: (Math.random() - 0.5) * speed * 2,
      radius: minR + Math.random() * (maxR - minR),
      opacity: 0.3 + Math.random() * 0.5,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.01 + Math.random() * 0.02,
    };
  }

  /* ---- Events ---- */

  #bindEvents() {
    /* Mouse tracking */
    const onMouseMove = (e) => {
      this.#mouse.x = e.clientX;
      this.#mouse.y = e.clientY;
    };

    const onMouseLeave = () => {
      this.#mouse.x = -1000;
      this.#mouse.y = -1000;
    };

    const onTouchMove = (e) => {
      if (e.touches.length > 0) {
        this.#mouse.x = e.touches[0].clientX;
        this.#mouse.y = e.touches[0].clientY;
      }
    };

    const onTouchEnd = () => {
      this.#mouse.x = -1000;
      this.#mouse.y = -1000;
    };

    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    /* Resize handling (debounced) */
    let resizeTimer = null;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.#ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.#resize();
        /* Re-clamp particles into viewport */
        for (const p of this.#particles) {
          p.x = Math.min(p.x, this.#width);
          p.y = Math.min(p.y, this.#height);
        }
      }, 150);
    };
    window.addEventListener('resize', onResize, { passive: true });

    /* Visibility API — pause when hidden */
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.#stopAnimation();
      } else {
        this.#animate();
      }
    });
  }

  /* ---- Animation Loop ---- */

  #animate() {
    if (this.#animationId) return;

    const loop = () => {
      this.#update();
      this.#draw();
      this.#animationId = requestAnimationFrame(loop);
    };

    this.#animationId = requestAnimationFrame(loop);
  }

  #stopAnimation() {
    if (this.#animationId) {
      cancelAnimationFrame(this.#animationId);
      this.#animationId = null;
    }
  }

  /* ---- Physics Update ---- */

  #update() {
    const mouseR = ParticleSystem.MOUSE_RADIUS;
    const force = ParticleSystem.MOUSE_FORCE;
    const w = this.#width;
    const h = this.#height;

    for (const p of this.#particles) {
      /* Mouse interaction */
      const dx = p.x - this.#mouse.x;
      const dy = p.y - this.#mouse.y;
      const distSq = dx * dx + dy * dy;
      const mouseRSq = mouseR * mouseR;

      if (distSq < mouseRSq && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const strength = (1 - dist / mouseR) * force;
        p.vx += (dx / dist) * strength;
        p.vy += (dy / dist) * strength;
      }

      /* Velocity damping */
      p.vx *= 0.99;
      p.vy *= 0.99;

      /* Ensure minimum velocity so particles keep drifting */
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const minSpeed = ParticleSystem.BASE_SPEED * 0.3;
      if (speed < minSpeed && speed > 0) {
        const scale = minSpeed / speed;
        p.vx *= scale;
        p.vy *= scale;
      }

      /* Position update */
      p.x += p.vx;
      p.y += p.vy;

      /* Wrap around edges */
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;

      /* Pulse */
      p.pulsePhase += p.pulseSpeed;
    }
  }

  /* ---- Rendering ---- */

  #draw() {
    const ctx = this.#ctx;
    const w = this.#width;
    const h = this.#height;

    ctx.clearRect(0, 0, w, h);

    const connDist = ParticleSystem.CONNECTION_DISTANCE;
    const connDistSq = connDist * connDist;
    const lineColor = ParticleSystem.LINE_COLOR;
    const maxLineOpacity = ParticleSystem.LINE_OPACITY;
    const particleColor = ParticleSystem.PARTICLE_COLOR;
    const particles = this.#particles;
    const len = particles.length;

    /* Draw connecting lines */
    for (let i = 0; i < len; i++) {
      const a = particles[i];
      for (let j = i + 1; j < len; j++) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < connDistSq) {
          const dist = Math.sqrt(distSq);
          const opacity = maxLineOpacity * (1 - dist / connDist);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${lineColor}, ${opacity})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    /* Draw mouse connection lines */
    const mouseR = ParticleSystem.MOUSE_RADIUS;
    const mouseRSq = mouseR * mouseR;
    if (this.#mouse.x > 0 && this.#mouse.y > 0) {
      for (const p of particles) {
        const dx = p.x - this.#mouse.x;
        const dy = p.y - this.#mouse.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < mouseRSq) {
          const dist = Math.sqrt(distSq);
          const opacity = maxLineOpacity * 1.5 * (1 - dist / mouseR);
          ctx.beginPath();
          ctx.moveTo(this.#mouse.x, this.#mouse.y);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = `rgba(${lineColor}, ${opacity})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }

    /* Draw particles */
    for (const p of particles) {
      const pulse = 0.85 + 0.15 * Math.sin(p.pulsePhase);
      const currentOpacity = p.opacity * pulse;
      const currentRadius = p.radius * (0.9 + 0.1 * Math.sin(p.pulsePhase));

      ctx.beginPath();
      ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
      ctx.fillStyle = particleColor;
      ctx.globalAlpha = currentOpacity;
      ctx.fill();

      /* Subtle glow */
      ctx.beginPath();
      ctx.arc(p.x, p.y, currentRadius * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = particleColor;
      ctx.globalAlpha = currentOpacity * 0.15;
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  /* ---- Public API ---- */

  destroy() {
    this.#stopAnimation();
  }
}
