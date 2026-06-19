// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Studio Shell v1.0.0 — auth gate + workspace router        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import './style.css';
import { auth, onAuthStateChanged } from './services/firebase.js';
import { LoginUI } from './components/LoginUI.js';
import { StudioUI } from './components/StudioUI.js';

const root = document.querySelector('#app');
let active = null;

function mount(Component, ...args) {
  if (active?.destroy) active.destroy();
  root.innerHTML = '';
  active = new Component(root, ...args);
  active.render();
}

function renderLoader() {
  root.innerHTML = `
    <div class="loader" role="status" aria-live="polite">
      <div class="sacred-spinner" aria-hidden="true"></div>
      <p>Synchronizing vector state…</p>
    </div>`;
}

renderLoader();
onAuthStateChanged(auth, (user) => {
  if (user) mount(StudioUI, user);
  else mount(LoginUI);
});
