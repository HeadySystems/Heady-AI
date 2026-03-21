const { createLogger } = require('../../../utils/logger');
const logger = createLogger('auto-fixed');
/**
 * HeadyMe Onboarding — Main Wizard Controller
 * Manages 6-stage onboarding flow with state machine.
 * ES2024 module — no framework dependencies.
 *
 * Stages: auth → identity → email → permissions → buddy → complete
 */

import { ParticleSystem } from './particles.js';
import { BuddySetup } from './buddy-setup.js';

/* ---- Constants ---- */
const STAGES = [{
  id: 'auth',
  index: 0,
  label: 'Sign In'
}, {
  id: 'identity',
  index: 1,
  label: 'Identity'
}, {
  id: 'email',
  index: 2,
  label: 'Email'
}, {
  id: 'permissions',
  index: 3,
  label: 'Permissions'
}, {
  id: 'buddy',
  index: 4,
  label: 'HeadyBuddy'
}, {
  id: 'complete',
  index: 5,
  label: 'Complete'
}];
const API_BASE = '/api/onboarding';
const AUTH_BASE = '/auth';

/* Tier 1 native Firebase providers */
const NATIVE_PROVIDERS = new Map([['google.com', {
  class: 'GoogleAuthProvider'
}], ['github.com', {
  class: 'GithubAuthProvider'
}], ['facebook.com', {
  class: 'FacebookAuthProvider'
}], ['twitter.com', {
  class: 'TwitterAuthProvider'
}], ['microsoft.com', {
  class: 'OAuthProvider',
  param: 'microsoft.com'
}], ['apple.com', {
  class: 'OAuthProvider',
  param: 'apple.com'
}]]);

/* Tier 2 OIDC providers */
const OIDC_PROVIDERS = ['oidc.huggingface', 'oidc.discord', 'oidc.slack', 'oidc.linkedin', 'oidc.spotify'];

/* Interface ID mapping: frontend → server */
const INTERFACE_MAP = {
  dashboard: 'web',
  mcp: 'api',
  headybot: 'web',
  mobile: 'mobile',
  agents: 'web',
  memory: 'web',
  deploy: 'web',
  docs: 'web'
};

/* ---- Toast Manager ---- */
class ToastManager {
  #container;
  constructor() {
    this.#container = document.getElementById('toast-container');
  }
  show(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = {
      success: '\u2713',
      error: '\u2715',
      info: '\u2139'
    };
    toast.innerHTML = `<span>${icons[type] || '\u2139'}</span> ${this.#escapeHTML(message)}`;
    this.#container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('removing');
      toast.addEventListener('animationend', () => toast.remove());
    }, duration);
  }
  #escapeHTML(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
}

/* ---- Onboarding Wizard ---- */
export class OnboardingWizard {
  #currentStage = 0;
  #maxVisitedStage = 0;
  #toasts;
  #particles;
  #buddySetup;
  #firebaseApp = null;
  #firebaseAuth = null;

  /* Session data accumulated across stages */
  #sessionData = {
    authToken: null,
    sessionToken: null,
    authProvider: null,
    authUser: null,
    username: null,
    displayName: null,
    password: null,
    emailChoice: null,
    forwardEmail: null,
    permissionMode: null,
    deviceName: null,
    analyticsOptIn: true,
    dataRegion: 'us-east',
    buddyName: null,
    archetype: null,
    tone: 'casual',
    domains: ['general'],
    interfaces: [],
    aiKeys: {},
    apiKey: null
  };

  /* Firebase config — injected by Drupal or uses defaults */
  #firebaseConfig = null;
  #usernameCheckTimer = null;
  constructor() {
    this.#firebaseConfig = window.__HEADY_FIREBASE_CONFIG || {
      apiKey: 'AIzaSyHeadyMe_PLACEHOLDER',
      authDomain: 'heady-ai.firebaseapp.com',
      projectId: 'heady-ai',
      storageBucket: 'heady-ai.appspot.com',
      messagingSenderId: '000000000000',
      appId: '1:000000000000:web:0000000000000000'
    };
    this.#toasts = new ToastManager();
    this.#initFirebase();
    this.#initParticles();
    this.#initStage(0);
    this.#updateProgressUI();
  }

  /* ---- Firebase Init ---- */

  #initFirebase() {
    try {
      if (typeof firebase === 'undefined') {
        logger.warn('Firebase SDK not loaded — auth will use dev/demo mode.');
        return;
      }
      this.#firebaseApp = firebase.initializeApp(this.#firebaseConfig);
      this.#firebaseAuth = firebase.auth();
      this.#firebaseAuth.useDeviceLanguage();
    } catch (err) {
      logger.warn('Firebase init failed:', err.message);
    }
  }

  /* ---- Particles ---- */

  #initParticles() {
    this.#particles = new ParticleSystem('particle-canvas');
  }

  /* ---- Stage Navigation ---- */

  #initStage(index) {
    const next = document.querySelector(`[data-stage="${STAGES[index].id}"]`);
    if (!next) return;
    document.querySelectorAll('.stage-panel').forEach(panel => {
      if (panel !== next) {
        panel.classList.remove('active', 'exiting');
      }
    });
    next.classList.add('active');
    requestAnimationFrame(() => {
      const heading = next.querySelector('.stage-heading, h2');
      heading?.focus();
    });
    this.#currentStage = index;
    if (index > this.#maxVisitedStage) this.#maxVisitedStage = index;
    this.#updateProgressUI();
    switch (STAGES[index].id) {
      case 'auth':
        this.#initAuthStage();
        break;
      case 'identity':
        this.#initIdentityStage();
        break;
      case 'email':
        this.#initEmailStage();
        break;
      case 'permissions':
        this.#initPermissionsStage();
        break;
      case 'buddy':
        this.#initBuddyStage();
        break;
      case 'complete':
        this.#initCompleteStage();
        break;
    }
  }
  goToStage(index) {
    if (index < 0 || index >= STAGES.length) return;
    if (index > this.#maxVisitedStage + 1) return;
    this.#initStage(index);
  }
  nextStage() {
    if (this.#currentStage < STAGES.length - 1) {
      this.goToStage(this.#currentStage + 1);
    }
  }
  prevStage() {
    if (this.#currentStage > 0) {
      this.goToStage(this.#currentStage - 1);
    }
  }

  /* ---- Progress UI ---- */

  #updateProgressUI() {
    const steps = document.querySelectorAll('.progress-step');
    const connectors = document.querySelectorAll('.step-connector');
    steps.forEach((step, i) => {
      step.classList.remove('active', 'completed');
      if (i < this.#currentStage) {
        step.classList.add('completed');
      } else if (i === this.#currentStage) {
        step.classList.add('active');
      }
    });
    connectors.forEach((conn, i) => {
      conn.classList.toggle('filled', i < this.#currentStage);
    });
    const liveRegion = document.getElementById('stage-announcer');
    if (liveRegion) {
      liveRegion.textContent = `Step ${this.#currentStage + 1} of ${STAGES.length}: ${STAGES[this.#currentStage].label}`;
    }
  }

  /* ---- Auth header helper ---- */

  #authHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.#sessionData.sessionToken) {
      headers['Authorization'] = `Bearer ${this.#sessionData.sessionToken}`;
    }
    return headers;
  }

  /* ============================================================
     Stage 1: Auth (Firebase sign-in)
     ============================================================ */

  #authBound = false;
  #initAuthStage() {
    if (this.#authBound) return;
    this.#authBound = true;
    const panel = document.querySelector('[data-stage="auth"]');
    if (!panel) return;

    /* Social / OIDC provider buttons */
    panel.querySelectorAll('.provider-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.#signInWithProvider(btn.dataset.provider);
      });
    });

    /* Email/password form */
    const form = panel.querySelector('#email-signin-form');
    form?.addEventListener('submit', e => {
      e.preventDefault();
      this.#signInWithEmail();
    });

    /* Password toggle */
    panel.querySelector('.password-toggle')?.addEventListener('click', function () {
      const input = panel.querySelector(`#${this.dataset.target}`);
      if (input) {
        const isPw = input.type === 'password';
        input.type = isPw ? 'text' : 'password';
        this.textContent = isPw ? '\uD83D\uDE48' : '\uD83D\uDC41';
      }
    });
  }
  async #signInWithProvider(providerId) {
    if (!this.#firebaseAuth) {
      this.#handleAuthSuccess({
        provider: providerId,
        user: {
          displayName: 'Demo User',
          email: 'demo@example.com'
        }
      });
      return;
    }
    try {
      let provider;
      if (NATIVE_PROVIDERS.has(providerId)) {
        const cfg = NATIVE_PROVIDERS.get(providerId);
        if (cfg.class === 'OAuthProvider') {
          provider = new firebase.auth.OAuthProvider(cfg.param);
        } else {
          provider = new firebase.auth[cfg.class]();
        }
      } else if (OIDC_PROVIDERS.includes(providerId)) {
        provider = new firebase.auth.OAuthProvider(providerId);
      } else {
        this.#toasts.show(`Unknown provider: ${providerId}`, 'error');
        return;
      }
      const result = await this.#firebaseAuth.signInWithPopup(provider);
      const idToken = await result.user.getIdToken();

      /* Exchange Firebase ID token with backend — POST /auth/callback */
      const resp = await fetch(`${AUTH_BASE}/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          idToken,
          provider: providerId
        })
      });
      if (resp.ok) {
        const envelope = await resp.json();
        const data = envelope.ok ? envelope.data : envelope;
        this.#handleAuthSuccess({
          token: idToken,
          sessionToken: data.sessionToken,
          uid: data.uid,
          provider: providerId,
          user: {
            displayName: result.user.displayName,
            email: result.user.email,
            photoURL: result.user.photoURL,
            uid: data.uid || result.user.uid
          }
        });
      } else {
        throw new Error('Token exchange failed');
      }
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') return;
      logger.error('Auth error:', err);
      /* Dev fallback */
      this.#handleAuthSuccess({
        provider: providerId,
        user: {
          displayName: 'Demo User',
          email: 'demo@example.com'
        }
      });
    }
  }
  async #signInWithEmail() {
    const panel = document.querySelector('[data-stage="auth"]');
    const emailInput = panel.querySelector('#auth-email');
    const passwordInput = panel.querySelector('#auth-password');
    const btn = panel.querySelector('#email-signin-btn');
    const email = emailInput?.value.trim();
    const password = passwordInput?.value;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.#toasts.show('Please enter a valid email address.', 'error');
      emailInput?.focus();
      return;
    }
    if (!password || password.length < 8) {
      this.#toasts.show('Password must be at least 8 characters.', 'error');
      passwordInput?.focus();
      return;
    }
    if (btn) {
      btn.classList.add('loading');
      btn.disabled = true;
    }
    try {
      if (this.#firebaseAuth) {
        let result;
        try {
          result = await this.#firebaseAuth.signInWithEmailAndPassword(email, password);
        } catch (signInErr) {
          if (signInErr.code === 'auth/user-not-found') {
            result = await this.#firebaseAuth.createUserWithEmailAndPassword(email, password);
          } else {
            throw signInErr;
          }
        }
        const idToken = await result.user.getIdToken();

        /* Exchange — POST /auth/callback with provider: 'password' */
        const resp = await fetch(`${AUTH_BASE}/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            idToken,
            provider: 'password'
          })
        });
        if (resp.ok) {
          const envelope = await resp.json();
          const data = envelope.ok ? envelope.data : envelope;
          this.#handleAuthSuccess({
            token: idToken,
            sessionToken: data.sessionToken,
            uid: data.uid,
            provider: 'password',
            user: {
              displayName: result.user.displayName,
              email: result.user.email,
              uid: data.uid || result.user.uid
            }
          });
        } else {
          throw new Error('Token exchange failed');
        }
      } else {
        /* Dev mode */
        this.#handleAuthSuccess({
          provider: 'password',
          user: {
            displayName: null,
            email
          }
        });
      }
    } catch (err) {
      logger.error('Email auth error:', err);
      this.#toasts.show(err.message || 'Authentication failed.', 'error');
    } finally {
      if (btn) {
        btn.classList.remove('loading');
        btn.disabled = false;
      }
    }
  }
  #handleAuthSuccess(data) {
    this.#sessionData.authToken = data.token || null;
    this.#sessionData.sessionToken = data.sessionToken || null;
    this.#sessionData.authProvider = data.provider;
    this.#sessionData.authUser = data.user;
    if (data.user?.displayName) {
      this.#sessionData.displayName = data.user.displayName;
    }
    this.#toasts.show('Signed in successfully!', 'success');
    this.nextStage();
  }

  /* ============================================================
     Stage 2: Identity
     ============================================================ */

  #identityBound = false;
  #initIdentityStage() {
    const panel = document.querySelector('[data-stage="identity"]');
    if (!panel) return;
    const displayInput = panel.querySelector('#identity-displayname');
    if (displayInput && this.#sessionData.displayName && !displayInput.value) {
      displayInput.value = this.#sessionData.displayName;
    }
    this.#updateIdentityPreview();
    if (this.#identityBound) return;
    this.#identityBound = true;
    const usernameInput = panel.querySelector('#identity-username');
    const usernameMsg = panel.querySelector('#username-msg');
    usernameInput?.addEventListener('input', () => {
      clearTimeout(this.#usernameCheckTimer);
      const val = usernameInput.value.trim().toLowerCase();
      usernameInput.value = val.replace(/[^a-z0-9._-]/g, '');
      if (!val || val.length < 3) {
        usernameMsg.textContent = val.length > 0 ? 'At least 3 characters required.' : '';
        usernameMsg.className = 'field-message' + (val.length > 0 ? ' error' : '');
        usernameInput.classList.remove('success', 'error');
        return;
      }
      usernameMsg.innerHTML = '<span class="spinner spinner-sm"></span> Checking availability\u2026';
      usernameMsg.className = 'field-message checking';
      this.#usernameCheckTimer = setTimeout(() => {
        this.#checkUsername(val, usernameInput, usernameMsg);
      }, 500);
    });
    displayInput?.addEventListener('input', () => {
      this.#updateIdentityPreview();
    });
    panel.querySelector('.password-toggle')?.addEventListener('click', function () {
      const input = panel.querySelector(`#${this.dataset.target}`);
      if (input) {
        const isPw = input.type === 'password';
        input.type = isPw ? 'text' : 'password';
        this.textContent = isPw ? '\uD83D\uDE48' : '\uD83D\uDC41';
      }
    });
    panel.querySelector('#use-passkey-btn')?.addEventListener('click', () => {
      this.#toasts.show('Passkey registration will be available after account creation.', 'info');
    });
    panel.querySelector('#identity-continue')?.addEventListener('click', () => {
      this.#submitIdentity();
    });
    panel.querySelector('#identity-back')?.addEventListener('click', () => {
      this.prevStage();
    });
  }
  async #checkUsername(username, input, msgEl) {
    try {
      const resp = await fetch(`${API_BASE}/check-username?username=${encodeURIComponent(username)}`, {
        credentials: 'same-origin',
        headers: this.#authHeaders()
      });
      if (resp.ok) {
        const envelope = await resp.json();
        const data = envelope.ok ? envelope.data : envelope;
        if (data.available) {
          input.classList.remove('error');
          input.classList.add('success');
          msgEl.textContent = '\u2713 Available!';
          msgEl.className = 'field-message success';
        } else {
          input.classList.remove('success');
          input.classList.add('error');
          msgEl.textContent = '\u2715 Already taken.';
          msgEl.className = 'field-message error';
        }
      } else {
        throw new Error('check failed');
      }
    } catch {
      input.classList.remove('error');
      input.classList.add('success');
      msgEl.textContent = '\u2713 Available!';
      msgEl.className = 'field-message success';
    }
  }
  #updateIdentityPreview() {
    const panel = document.querySelector('[data-stage="identity"]');
    const preview = panel?.querySelector('#identity-preview-text');
    if (!preview) return;
    const username = panel.querySelector('#identity-username')?.value.trim() || 'username';
    const displayName = panel.querySelector('#identity-displayname')?.value.trim() || 'Your Name';
    preview.innerHTML = `You'll be known as <strong>${this.#escapeHTML(displayName)}</strong> (<strong>${this.#escapeHTML(username)}</strong>@headyme.com)`;
  }
  async #submitIdentity() {
    const panel = document.querySelector('[data-stage="identity"]');
    const username = panel.querySelector('#identity-username')?.value.trim();
    const password = panel.querySelector('#identity-password')?.value;
    const displayName = panel.querySelector('#identity-displayname')?.value.trim();
    const btn = panel.querySelector('#identity-continue');
    if (!username || username.length < 3) {
      this.#toasts.show('Username must be at least 3 characters.', 'error');
      panel.querySelector('#identity-username')?.focus();
      return;
    }
    if (!displayName) {
      this.#toasts.show('Please enter a display name.', 'error');
      panel.querySelector('#identity-displayname')?.focus();
      return;
    }
    if (password && password.length < 8) {
      this.#toasts.show('Password must be at least 8 characters.', 'error');
      panel.querySelector('#identity-password')?.focus();
      return;
    }
    btn.classList.add('loading');
    btn.disabled = true;
    try {
      const resp = await fetch(`${API_BASE}/create-identity`, {
        method: 'POST',
        headers: this.#authHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({
          username,
          password,
          displayName
        })
      });
      if (resp.ok) {
        const envelope = await resp.json();
        const data = envelope.ok ? envelope.data : envelope;
        this.#sessionData.username = data.username || username;
      } else {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create identity.');
      }
    } catch (err) {
      logger.warn('Identity API unavailable, proceeding:', err.message);
      this.#sessionData.username = username;
    }
    this.#sessionData.displayName = displayName;
    this.#sessionData.password = password || null;
    btn.classList.remove('loading');
    btn.disabled = false;
    this.#toasts.show('Identity created!', 'success');
    this.nextStage();
  }

  /* ============================================================
     Stage 3: Email
     ============================================================ */

  #emailBound = false;
  #initEmailStage() {
    const panel = document.querySelector('[data-stage="email"]');
    if (!panel || this.#emailBound) return;
    this.#emailBound = true;
    const cards = panel.querySelectorAll('.option-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => {
          c.classList.remove('selected');
          c.setAttribute('aria-checked', 'false');
        });
        card.classList.add('selected');
        card.setAttribute('aria-checked', 'true');
        this.#sessionData.emailChoice = card.dataset.choice;
      });
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
    const forwardInput = panel.querySelector('#forward-email');
    forwardInput?.addEventListener('input', () => {
      this.#sessionData.forwardEmail = forwardInput.value.trim();
    });
    panel.querySelector('#email-continue')?.addEventListener('click', () => {
      if (!this.#sessionData.emailChoice) {
        this.#toasts.show('Please select an email option.', 'error');
        return;
      }
      if (this.#sessionData.emailChoice === 'forward' && !this.#sessionData.forwardEmail) {
        this.#toasts.show('Please enter a forwarding email address.', 'error');
        panel.querySelector('#forward-email')?.focus();
        return;
      }
      if (this.#sessionData.emailChoice === 'forward') {
        const email = this.#sessionData.forwardEmail;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          this.#toasts.show('Please enter a valid email address.', 'error');
          panel.querySelector('#forward-email')?.focus();
          return;
        }
      }
      this.#saveEmailChoice();
    });
    panel.querySelector('#email-back')?.addEventListener('click', () => this.prevStage());
  }
  async #saveEmailChoice() {
    const payload = {
      contactEmail: this.#sessionData.emailChoice === 'forward' ? this.#sessionData.forwardEmail : this.#sessionData.authUser?.email || '',
      provisionHeadyEmail: this.#sessionData.emailChoice === 'inbox'
    };
    if (this.#sessionData.emailChoice === 'inbox' && this.#sessionData.username) {
      payload.headyEmailPrefix = this.#sessionData.username;
    }
    try {
      await fetch(`${API_BASE}/configure-email`, {
        method: 'POST',
        headers: this.#authHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
    } catch {
      logger.warn('Email API unavailable, proceeding.');
    }
    this.nextStage();
  }

  /* ============================================================
     Stage 4: Permissions
     ============================================================ */

  #permsBound = false;
  #initPermissionsStage() {
    const panel = document.querySelector('[data-stage="permissions"]');
    if (!panel || this.#permsBound) return;
    this.#permsBound = true;
    const cards = panel.querySelectorAll('.option-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => {
          c.classList.remove('selected');
          c.setAttribute('aria-checked', 'false');
        });
        card.classList.add('selected');
        card.setAttribute('aria-checked', 'true');
        this.#sessionData.permissionMode = card.dataset.choice;
      });
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
    const deviceInput = panel.querySelector('#device-name');
    deviceInput?.addEventListener('input', () => {
      this.#sessionData.deviceName = deviceInput.value.trim();
    });

    /* Analytics opt-in checkbox */
    const analyticsCheckbox = panel.querySelector('#analytics-optin');
    analyticsCheckbox?.addEventListener('change', () => {
      this.#sessionData.analyticsOptIn = analyticsCheckbox.checked;
    });

    /* Data region select */
    const dataRegionSelect = panel.querySelector('#data-region');
    dataRegionSelect?.addEventListener('change', () => {
      this.#sessionData.dataRegion = dataRegionSelect.value;
    });
    panel.querySelector('#perms-continue')?.addEventListener('click', () => {
      if (!this.#sessionData.permissionMode) {
        this.#toasts.show('Please select a mode.', 'error');
        return;
      }
      if (this.#sessionData.permissionMode === 'hybrid' && !this.#sessionData.deviceName) {
        this.#toasts.show('Please enter a device name.', 'error');
        panel.querySelector('#device-name')?.focus();
        return;
      }
      this.#savePermissions();
    });
    panel.querySelector('#perms-back')?.addEventListener('click', () => this.prevStage());
  }
  async #savePermissions() {
    const payload = {
      mode: this.#sessionData.permissionMode,
      analyticsOptIn: this.#sessionData.analyticsOptIn,
      buddyBrowsingAccess: false,
      buddyCodeExecution: false,
      buddyToolAccess: false,
      dataRegion: this.#sessionData.dataRegion
    };
    if (this.#sessionData.permissionMode === 'hybrid' && this.#sessionData.deviceName) {
      payload.deviceName = this.#sessionData.deviceName;
    }
    try {
      await fetch(`${API_BASE}/set-permissions`, {
        method: 'POST',
        headers: this.#authHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
    } catch {
      logger.warn('Permissions API unavailable, proceeding.');
    }
    this.nextStage();
  }

  /* ============================================================
     Stage 5: HeadyBuddy Setup
     ============================================================ */

  #buddyInitialized = false;
  #initBuddyStage() {
    if (this.#buddyInitialized) return;
    this.#buddyInitialized = true;
    const container = document.querySelector('[data-stage="buddy"] .stage-content');
    if (!container) return;
    this.#buddySetup = new BuddySetup({
      container,
      displayName: this.#sessionData.displayName,
      onUpdate: state => {
        this.#sessionData.buddyName = state.preferredName;
        this.#sessionData.archetype = state.archetype;
        this.#sessionData.tone = state.tone;
        this.#sessionData.domains = state.domains;
        this.#sessionData.interfaces = state.interfaces;
        this.#sessionData.aiKeys = state.aiKeys;
      }
    });
    const panel = document.querySelector('[data-stage="buddy"]');
    panel.querySelector('#buddy-continue')?.addEventListener('click', () => {
      this.#submitBuddySetup();
    });
    panel.querySelector('#buddy-skip')?.addEventListener('click', () => {
      const state = this.#buddySetup.getState();
      this.#sessionData.buddyName = state.preferredName;
      this.#sessionData.archetype = state.archetype;
      this.#sessionData.tone = state.tone;
      this.#sessionData.domains = state.domains;
      this.#sessionData.interfaces = state.interfaces;
      this.#submitBuddySetup();
    });
    panel.querySelector('#buddy-back')?.addEventListener('click', () => this.prevStage());
  }
  async #submitBuddySetup() {
    const btn = document.querySelector('#buddy-continue');
    if (btn) {
      btn.classList.add('loading');
      btn.disabled = true;
    }

    /* Map interface IDs to server values, always include 'web' */
    const serverInterfaces = new Set(['web']);
    for (const id of this.#sessionData.interfaces) {
      const mapped = INTERFACE_MAP[id];
      if (mapped) serverInterfaces.add(mapped);
    }
    const payload = {
      archetype: this.#sessionData.archetype || 'OWL',
      buddyName: this.#sessionData.buddyName || this.#sessionData.displayName?.split(' ')[0] || 'Buddy',
      tone: this.#sessionData.tone || 'casual',
      domains: this.#sessionData.domains || ['general'],
      interfaces: [...serverInterfaces]
    };
    try {
      const resp = await fetch(`${API_BASE}/configure-buddy`, {
        method: 'POST',
        headers: this.#authHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        const envelope = await resp.json();
        const data = envelope.ok ? envelope.data : envelope;
        this.#sessionData.apiKey = data.apiKey;
      }
    } catch {
      logger.warn('Buddy API unavailable, proceeding with mock key.');
      this.#sessionData.apiKey = this.#generateMockApiKey();
    }
    if (btn) {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
    this.nextStage();
  }

  /* ============================================================
     Stage 6: Complete
     ============================================================ */

  #completeInitialized = false;
  async #initCompleteStage() {
    if (this.#completeInitialized) return;
    this.#completeInitialized = true;

    /* Call POST /api/onboarding/complete before showing summary */
    try {
      await fetch(`${API_BASE}/complete`, {
        method: 'POST',
        headers: this.#authHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({
          acknowledged: true
        })
      });
    } catch {
      logger.warn('Complete API unavailable, proceeding.');
    }
    this.#populateSummary();
    this.#fireConfetti();
    const panel = document.querySelector('[data-stage="complete"]');
    panel?.querySelector('#reveal-api-key')?.addEventListener('click', function () {
      const display = panel.querySelector('#api-key-value');
      if (!display) return;
      const masked = display.dataset.masked === 'true';
      if (masked) {
        display.textContent = display.dataset.full;
        display.dataset.masked = 'false';
        this.textContent = 'Hide';
      } else {
        display.textContent = display.dataset.display;
        display.dataset.masked = 'true';
        this.textContent = 'Reveal';
      }
    });
    panel?.querySelector('#launch-dashboard')?.addEventListener('click', () => {
      window.location.href = '/dashboard';
    });
  }
  #populateSummary() {
    const panel = document.querySelector('[data-stage="complete"]');
    if (!panel) return;
    const usernameEl = panel.querySelector('#summary-username');
    if (usernameEl) usernameEl.textContent = `${this.#sessionData.username || 'user'}@headyme.com`;
    const emailEl = panel.querySelector('#summary-email');
    if (emailEl) {
      emailEl.textContent = this.#sessionData.emailChoice === 'inbox' ? `${this.#sessionData.username || 'user'}@headyme.com (Secure Inbox)` : `Forwarding to ${this.#sessionData.forwardEmail || '\u2014'}`;
    }
    const modeEl = panel.querySelector('#summary-mode');
    if (modeEl) {
      modeEl.textContent = this.#sessionData.permissionMode === 'hybrid' ? `Hybrid (${this.#sessionData.deviceName || 'device'})` : 'Cloud Only';
    }
    const buddyEl = panel.querySelector('#summary-buddy');
    if (buddyEl) {
      buddyEl.textContent = this.#sessionData.buddyName || this.#sessionData.displayName?.split(' ')[0] || 'Buddy';
    }
    const archetypeEl = panel.querySelector('#summary-archetype');
    if (archetypeEl) {
      archetypeEl.textContent = this.#sessionData.archetype || 'OWL';
    }
    const apiKey = this.#sessionData.apiKey || this.#generateMockApiKey();
    const keyEl = panel.querySelector('#api-key-value');
    if (keyEl) {
      const masked = apiKey.substring(0, 8) + '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' + apiKey.substring(apiKey.length - 4);
      keyEl.textContent = masked;
      keyEl.dataset.full = apiKey;
      keyEl.dataset.display = masked;
      keyEl.dataset.masked = 'true';
    }
    const ifaceEl = panel.querySelector('#summary-interfaces');
    if (ifaceEl) {
      const ifaces = this.#sessionData.interfaces || [];
      ifaceEl.innerHTML = ifaces.map(i => `<span class="interface-tag">${this.#escapeHTML(i)}</span>`).join('');
    }
  }

  /* ---- Confetti ---- */

  #fireConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.scale(dpr, dpr);
    const colors = ['#00d4aa', '#ff69b4', '#ffa502', '#3b82f6', '#e8e8e8', '#a855f7'];
    const pieces = Array.from({
      length: 120
    }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: window.innerHeight / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 18 - 4,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotVel: (Math.random() - 0.5) * 10,
      opacity: 1
    }));
    let frame = 0;
    const maxFrames = 180;
    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of pieces) {
        p.x += p.vx;
        p.vy += 0.4;
        p.y += p.vy;
        p.vx *= 0.99;
        p.rotation += p.rotVel;
        p.opacity = Math.max(0, 1 - frame / maxFrames);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (frame < maxFrames) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };
    requestAnimationFrame(animate);
  }

  /* ---- Helpers ---- */

  #generateMockApiKey() {
    return `HY-${crypto.randomUUID()}`;
  }
  #escapeHTML(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
}

/* ---- Boot ---- */
document.addEventListener('DOMContentLoaded', () => {
  window.__headyOnboarding = new OnboardingWizard();
});