// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Portal Shell v3.0.1 — Dual-State Router                   ║
// ║  Routes: #onboarding · #admin (rebuild) · #legacy (advisor)        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import './style.css';
import { OnboardingUI } from './components/OnboardingUI.js';
import { AdminUI }      from './components/AdminUI.js';
import { LegacyUI }     from './components/LegacyUI.js';
import { onAuthStateChanged, auth } from './services/firebase.js';

const PHI = 1.618033988749895;
const appContainer = document.querySelector('#app');
let _currentUI = null;  // track active component instance

// ── loader ─────────────────────────────────────────────────────────
function renderLoader() {
  appContainer.innerHTML = `
    <div class="loader-container" role="status" aria-live="polite">
      <div class="sacred-spinner" aria-hidden="true"></div>
      <p>Synchronizing Vector State…</p>
    </div>`;
}

// ── router ─────────────────────────────────────────────────────────
function handleRoute(user) {
  const hash = window.location.hash || '#onboarding';

  // unauthenticated guard
  if (!user && hash !== '#onboarding') {
    window.location.hash = '#onboarding';
    return;
  }
  // skip onboarding once authed
  if (user && hash === '#onboarding') {
    window.location.hash = '#admin';
    return;
  }

  // tear down any previous stream before replacing DOM
  if (_currentUI && typeof _currentUI._destroyStream === 'function') {
    _currentUI._destroyStream();
  }

  appContainer.innerHTML = '';

  if (user && hash === '#admin') {
    _currentUI = new AdminUI(appContainer, user);
    _currentUI.render();
    window.dispatchEvent(new CustomEvent('navigation:admin:entered'));
  } else if (user && hash === '#legacy') {
    _currentUI = new LegacyUI(appContainer, user);
    _currentUI.render();
    window.dispatchEvent(new CustomEvent('navigation:legacy:entered'));
  } else {
    _currentUI = new OnboardingUI(appContainer);
    _currentUI.render();
  }
}

// ── boot ───────────────────────────────────────────────────────────
renderLoader();

onAuthStateChanged(auth, (user) => {
  handleRoute(user);
  if (user) {
    window.dispatchEvent(new CustomEvent('auth:login:success', { detail: { uid: user.uid } }));
  } else {
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }
});

window.addEventListener('hashchange', () => handleRoute(auth.currentUser));
