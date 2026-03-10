/**
 * Heady™ Demo Onboarding — Interactive Logic
 * Sacred geometry canvas, step navigation, connector simulation
 */

// ═══════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════
let currentStep = 0;
const totalSteps = 5;
const connectedServices = new Set();

// ═══════════════════════════════════════════════
// Step Navigation
// ═══════════════════════════════════════════════
function nextStep() {
    if (currentStep >= totalSteps - 1) return;
    const current = document.querySelector(`.step[data-step="${currentStep}"]`);
    current.classList.remove('active');
    currentStep++;
    const next = document.querySelector(`.step[data-step="${currentStep}"]`);
    next.classList.add('active');
    updateProgress();
    playTransitionSound();
}

function prevStep() {
    if (currentStep <= 0) return;
    const current = document.querySelector(`.step[data-step="${currentStep}"]`);
    current.classList.remove('active');
    currentStep--;
    const prev = document.querySelector(`.step[data-step="${currentStep}"]`);
    prev.classList.add('active');
    updateProgress();
}

function updateProgress() {
    const fill = document.getElementById('progressFill');
    const pct = ((currentStep + 1) / totalSteps) * 100;
    fill.style.width = pct + '%';

    document.querySelectorAll('.step-marker').forEach((m, i) => {
        m.classList.remove('active', 'completed');
        if (i < currentStep) m.classList.add('completed');
        else if (i === currentStep) m.classList.add('active');
    });
}

// ═══════════════════════════════════════════════
// Role Selector (Step 1)
// ═══════════════════════════════════════════════
document.querySelectorAll('.role-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.role-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
    });
});

// ═══════════════════════════════════════════════
// Service Connectors (Step 2)
// ═══════════════════════════════════════════════
function toggleConnect(btn, service) {
    const card = btn.closest('.connector-card');
    if (connectedServices.has(service)) {
        connectedServices.delete(service);
        card.classList.remove('connected');
        btn.textContent = 'Connect';
        btn.classList.remove('connected-btn');
    } else {
        // Simulate connection
        btn.textContent = 'Connecting...';
        btn.disabled = true;
        setTimeout(() => {
            connectedServices.add(service);
            card.classList.add('connected');
            btn.textContent = '✓ Connected';
            btn.classList.add('connected-btn');
            btn.disabled = false;
            createSparkle(btn);
        }, 800 + Math.random() * 600);
    }
}

// ═══════════════════════════════════════════════
// Preferences (Step 3)
// ═══════════════════════════════════════════════
function toggleChip(chip) {
    chip.classList.toggle('selected');
}

function updateSwarmLabel(val) {
    const labels = ['Minimal', 'Conservative', 'Balanced', 'Aggressive', 'Maximum'];
    document.getElementById('swarmLabel').textContent = labels[val - 1];
}

// ═══════════════════════════════════════════════
// Launch (Step 4)
// ═══════════════════════════════════════════════
function copyApiKey() {
    const key = 'heady_sk_φ_' + generateId(32);
    navigator.clipboard?.writeText(key).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.innerHTML = '<span style="color: #10b981; font-size: 12px;">Copied!</span>';
        setTimeout(() => {
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        }, 2000);
    });
}

function launchDashboard() {
    const btn = document.querySelector('.btn-launch');
    btn.innerHTML = '<span class="launch-text">Launching...</span>';
    btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';

    // Particle burst
    createParticleBurst(btn);

    setTimeout(() => {
        btn.innerHTML = '<span class="launch-text">✓ Dashboard Ready</span>';
        // In a real app, this would redirect
        setTimeout(() => {
            btn.innerHTML = '<span class="launch-text">🚀 Open Dashboard</span>';
            btn.style.background = '';
        }, 2000);
    }, 1500);
}

// ═══════════════════════════════════════════════
// Sacred Geometry Canvas Background
// ═══════════════════════════════════════════════
const PHI = 1.618033988749895;
const canvas = document.getElementById('sacredCanvas');
const ctx = canvas.getContext('2d');
let width, height, time = 0;
const nodes = [];
const connections = [];

function resizeCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    initNodes();
}

function initNodes() {
    nodes.length = 0;
    connections.length = 0;

    // Create φ-distributed node grid
    const count = Math.floor((width * height) / 40000); // density
    for (let i = 0; i < count; i++) {
        nodes.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            radius: 1.5 + Math.random() * 1.5,
            phase: Math.random() * Math.PI * 2,
            freq: 0.5 + Math.random() * 1.5,
        });
    }
}

function drawFrame() {
    ctx.clearRect(0, 0, width, height);
    time += 0.008;

    // Update and draw nodes
    nodes.forEach((n, i) => {
        n.x += n.vx;
        n.y += n.vy;

        // Wrap around
        if (n.x < 0) n.x = width;
        if (n.x > width) n.x = 0;
        if (n.y < 0) n.y = height;
        if (n.y > height) n.y = 0;

        // Breathing opacity
        const alpha = 0.15 + 0.15 * Math.sin(time * n.freq + n.phase);

        // Draw node
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139, 92, 246, ${alpha})`;
        ctx.fill();

        // Connect nearby nodes
        for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[j].x - n.x;
            const dy = nodes[j].y - n.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = 150;

            if (dist < maxDist) {
                const lineAlpha = (1 - dist / maxDist) * 0.08;
                ctx.beginPath();
                ctx.moveTo(n.x, n.y);
                ctx.lineTo(nodes[j].x, nodes[j].y);
                ctx.strokeStyle = `rgba(99, 102, 241, ${lineAlpha})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    });

    // Draw a subtle Flower of Life pattern
    drawFlowerOfLife();

    requestAnimationFrame(drawFrame);
}

function drawFlowerOfLife() {
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) * 0.15;
    const alpha = 0.02 + 0.01 * Math.sin(time * 0.5);

    ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
    ctx.lineWidth = 0.5;

    // Central circle
    drawCircle(cx, cy, r);

    // Six surrounding circles
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 + time * 0.1;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        drawCircle(x, y, r);
    }
}

function drawCircle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
}

// ═══════════════════════════════════════════════
// Visual Effects
// ═══════════════════════════════════════════════
function createSparkle(el) {
    const rect = el.getBoundingClientRect();
    for (let i = 0; i < 6; i++) {
        const spark = document.createElement('div');
        spark.style.cssText = `
      position: fixed;
      width: 4px; height: 4px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 6px #10b981;
      pointer-events: none;
      z-index: 9999;
      left: ${rect.left + rect.width / 2}px;
      top: ${rect.top + rect.height / 2}px;
      transition: all 0.6s cubic-bezier(.4,0,.2,1);
    `;
        document.body.appendChild(spark);
        requestAnimationFrame(() => {
            spark.style.transform = `translate(${(Math.random() - 0.5) * 80}px, ${(Math.random() - 0.5) * 80}px) scale(0)`;
            spark.style.opacity = '0';
        });
        setTimeout(() => spark.remove(), 700);
    }
}

function createParticleBurst(el) {
    const rect = el.getBoundingClientRect();
    const colors = ['#6366f1', '#a855f7', '#d946ef', '#22d3ee', '#10b981'];

    for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        const color = colors[Math.floor(Math.random() * colors.length)];
        p.style.cssText = `
      position: fixed;
      width: ${3 + Math.random() * 4}px;
      height: ${3 + Math.random() * 4}px;
      border-radius: 50%;
      background: ${color};
      box-shadow: 0 0 8px ${color};
      pointer-events: none;
      z-index: 9999;
      left: ${rect.left + rect.width / 2}px;
      top: ${rect.top + rect.height / 2}px;
      transition: all ${0.5 + Math.random() * 0.5}s cubic-bezier(.4,0,.2,1);
    `;
        document.body.appendChild(p);
        requestAnimationFrame(() => {
            const angle = (Math.PI * 2 * i) / 20;
            const dist = 60 + Math.random() * 100;
            p.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(0)`;
            p.style.opacity = '0';
        });
        setTimeout(() => p.remove(), 1200);
    }
}

// ═══════════════════════════════════════════════
// Audio Feedback (subtle)
// ═══════════════════════════════════════════════
function playTransitionSound() {
    try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.frequency.setValueAtTime(523.25, ac.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, ac.currentTime + 0.1); // E5
        gain.gain.setValueAtTime(0.05, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.2);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.2);
    } catch (e) { /* silent fail for browsers that block audio */ }
}

// ═══════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════
function generateId(len) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

// ═══════════════════════════════════════════════
// Initialize
// ═══════════════════════════════════════════════
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
drawFrame();
updateProgress();

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter') nextStep();
    if (e.key === 'ArrowLeft') prevStep();
});

console.log('%c🧠 Heady™ Onboarding Loaded', 'color: #a855f7; font-size: 14px; font-weight: bold;');
console.log('%cφ = 1.618033988749895', 'color: #6366f1; font-size: 11px;');
