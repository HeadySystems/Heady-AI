import './style.css';
import { OnboardingUI } from './components/OnboardingUI.js';
import { AdminUI } from './components/AdminUI.js';
import { onAuthStateChanged, auth } from './services/firebase.js';

// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Portal Shell v2.0.0                                    ║
// ║  Micro-frontend shell and routing coordinator                  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

const appContainer = document.querySelector('#app');

function renderLoader() {
  appContainer.innerHTML = `
    <div class="loader-container">
      <div class="sacred-spinner"></div>
      <p>Synchronizing Vector State...</p>
    </div>
  `;
}

function handleRoute(user) {
  const hash = window.location.hash || '#onboarding';

  if (!user && hash !== '#onboarding') {
    window.location.hash = '#onboarding';
    return;
  }

  if (user && hash === '#onboarding') {
    window.location.hash = '#admin';
    return;
  }

  appContainer.innerHTML = '';

  if (user && hash === '#admin') {
    const admin = new AdminUI(appContainer, user);
    admin.render();
    window.dispatchEvent(new CustomEvent('navigation:admin:entered'));
  } else {
    const onboarding = new OnboardingUI(appContainer);
    onboarding.render();
  }
}

// Boot Sequence
renderLoader();

onAuthStateChanged(auth, (user) => {
  handleRoute(user);
  
  if (user) {
    window.dispatchEvent(new CustomEvent('auth:login:success', { detail: { uid: user.uid } }));
  } else {
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }
});

window.addEventListener('hashchange', () => {
  handleRoute(auth.currentUser);
});
