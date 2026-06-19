// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Studio — Login                                            ║
// ║  Firebase email/password + Google. On success the shell routes to  ║
// ║  the workspace and the user's persistent memory becomes available. ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import {
  auth, googleProvider, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signInWithPopup,
} from '../services/firebase.js';

export class LoginUI {
  constructor(root) { this.root = root; this.mode = 'signin'; }

  render() {
    this.root.innerHTML = `
      <main class="auth-shell">
        <section class="auth-card" aria-labelledby="auth-title">
          <div class="brand-mark" aria-hidden="true">∞</div>
          <h1 id="auth-title">Heady Studio</h1>
          <p class="auth-sub">Your MCP workspace — memory, repos, models, and services in one place.</p>
          <form id="auth-form" novalidate>
            <label>Email<input type="email" name="email" autocomplete="email" required /></label>
            <label>Password<input type="password" name="password" autocomplete="current-password" required minlength="6" /></label>
            <p class="auth-error" id="auth-error" role="alert" hidden></p>
            <button class="btn-primary" type="submit" id="auth-submit">Sign in</button>
          </form>
          <button class="btn-google" id="google-btn">Continue with Google</button>
          <button class="btn-link" id="toggle-mode">Need an account? Create one</button>
        </section>
      </main>`;

    this.form = this.root.querySelector('#auth-form');
    this.errEl = this.root.querySelector('#auth-error');
    this.form.addEventListener('submit', (e) => this._submit(e));
    this.root.querySelector('#google-btn').addEventListener('click', () => this._google());
    this.root.querySelector('#toggle-mode').addEventListener('click', () => this._toggle());
  }

  _toggle() {
    this.mode = this.mode === 'signin' ? 'signup' : 'signin';
    this.root.querySelector('#auth-submit').textContent = this.mode === 'signin' ? 'Sign in' : 'Create account';
    this.root.querySelector('#toggle-mode').textContent =
      this.mode === 'signin' ? 'Need an account? Create one' : 'Have an account? Sign in';
  }

  _error(msg) { this.errEl.textContent = msg; this.errEl.hidden = false; }

  async _submit(e) {
    e.preventDefault();
    this.errEl.hidden = true;
    const { email, password } = Object.fromEntries(new FormData(this.form));
    try {
      if (this.mode === 'signin') await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) { this._error(err?.message ?? 'authentication failed'); }
  }

  async _google() {
    this.errEl.hidden = true;
    try { await signInWithPopup(auth, googleProvider); }
    catch (err) { this._error(err?.message ?? 'google sign-in failed'); }
  }

  destroy() {}
}
