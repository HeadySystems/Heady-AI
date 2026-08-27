// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Portal Shell v3.0.1 — Dual-State Router                   ║
// ║  Routes: #onboarding · #admin (rebuild) · #legacy (advisor)        ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import './style.css';
import { OnboardingUI } from './components/OnboardingUI.js';
import { AdminUI }      from './components/AdminUI.js';
import { LegacyUI }     from './components/LegacyUI.js';
import { ServicesUI }   from './components/ServicesUI.js';
import './components/LiveStatus.js'; // self-registers <heady-live-status> (SSE fabric tiles)
import { onAuthStateChanged, auth } from './services/firebase.js';
import { initPwa } from './pwa/register.js';

const PHI = 1.618033988749895;
const appContainer = document.querySelector('#app');
let _currentUI = null;  // track active component instance
let _adminAuthorized = false;

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
    window.location.hash = _adminAuthorized ? '#admin' : '#services';
    return;
  }
  // Admin is a role, not merely an authenticated session. The gateway repeats
  // this check server-side; this route guard prevents misleading UI exposure.
  if (user && hash === '#admin' && !_adminAuthorized) {
    window.location.hash = '#services';
    return;
  }

  // #services sub-routes (#services/<category>/<service>) re-route in place —
  // no remount, so BuddyGuide keeps its state while the nav highlights.
  if (user && hash.startsWith('#services') && _currentUI instanceof ServicesUI) {
    _currentUI.route(hash);
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
  } else if (user && hash.startsWith('#services')) {
    _currentUI = new ServicesUI(appContainer, user);
    _currentUI.render();
  } else {
    _currentUI = new OnboardingUI(appContainer);
    _currentUI.render();
  }
}

// ── boot ───────────────────────────────────────────────────────────
initPwa();
renderLoader();

onAuthStateChanged(auth, async (user) => {
  _adminAuthorized = user ? (await user.getIdTokenResult().catch(() => ({ claims: {} }))).claims.admin === true : false;
  handleRoute(user);
  if (user) {
    window.dispatchEvent(new CustomEvent('auth:login:success', { detail: { uid: user.uid } }));
  } else {
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }
});

window.addEventListener('hashchange', () => handleRoute(auth.currentUser));
