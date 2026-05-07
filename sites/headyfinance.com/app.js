/**
 * HeadyFinance — Landing Page Interactive Logic
 * Waitlist form, scroll animations, chart animation
 */

document.addEventListener('DOMContentLoaded', () => {
  initWaitlistForm();
  initScrollAnimations();
  animateChart();
});

// ── Waitlist Form ───────────────────────────────────────────────────
function initWaitlistForm() {
  const form = document.getElementById('waitlist-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const role = document.getElementById('role').value;

    if (!name || !email) return;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address.');
      return;
    }

    // Disable form
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Submitting...</span>';

    try {
      // Store locally for now — will wire to Stripe/API later
      const entry = {
        name, email, role,
        timestamp: new Date().toISOString(),
        source: 'headyfinance.com',
      };

      // Try to submit to backend
      try {
        await fetch('https://headymcp.com/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
      } catch {
        // Silently fail — store in localStorage as backup
        const waitlist = JSON.parse(localStorage.getItem('hf_waitlist') || '[]');
        waitlist.push(entry);
        localStorage.setItem('hf_waitlist', JSON.stringify(waitlist));
      }

      // Show success
      form.style.display = 'none';
      const success = document.getElementById('waitlist-success');
      if (success) {
        success.style.display = 'block';
        // Animate position number
        const posEl = document.getElementById('position-number');
        if (posEl) {
          const pos = Math.floor(Math.random() * 200) + 50;
          animateNumber(posEl, pos);
        }
      }
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Request Early Access</span>';
      alert('Something went wrong. Please try again.');
    }
  });
}

// ── Number Animation ────────────────────────────────────────────────
function animateNumber(el, target) {
  let current = 0;
  const step = Math.ceil(target / 30);
  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = `#${current}`;
    if (current >= target) clearInterval(interval);
  }, 40);
}

// ── Scroll Animations ───────────────────────────────────────────────
function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  );

  document.querySelectorAll('.feature-card, .step-card, .section-header, .waitlist-container, .disclaimer').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
}

// ── Chart Line Animation ────────────────────────────────────────────
function animateChart() {
  const line = document.querySelector('.chart-line');
  const area = document.querySelector('.chart-area');
  if (!line) return;

  const length = line.getTotalLength();
  line.style.strokeDasharray = length;
  line.style.strokeDashoffset = length;
  line.style.transition = 'stroke-dashoffset 2s ease-out';

  if (area) {
    area.style.opacity = '0';
    area.style.transition = 'opacity 1.5s ease-out 0.5s';
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          line.style.strokeDashoffset = '0';
          if (area) area.style.opacity = '1';
          observer.disconnect();
        }
      });
    },
    { threshold: 0.3 }
  );

  const chart = document.querySelector('.chart-container');
  if (chart) observer.observe(chart);
}
