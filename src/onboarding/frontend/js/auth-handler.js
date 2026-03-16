/**
 * auth-handler.js — Firebase Auth Handler for HeadyMe Onboarding
 * Tier 1: Firebase Native Providers (Google, GitHub, Facebook, Twitter, Microsoft, Apple)
 * Tier 2: OIDC Custom Providers (HuggingFace, Discord, Slack, LinkedIn, Spotify)
 * ES2024 · No frameworks · Firebase compat CDN
 */

const PROVIDERS = Object.freeze({
  'google.com': {
    name: 'Google',
    icon: 'google',
    category: 'social',
    tier: 1,
    scopes: ['email', 'profile'],
    create() {
      const p = new firebase.auth.GoogleAuthProvider();
      this.scopes.forEach(s => p.addScope(s));
      return p;
    },
  },
  'github.com': {
    name: 'GitHub',
    icon: 'github',
    category: 'social',
    tier: 1,
    scopes: ['read:user', 'user:email'],
    create() {
      const p = new firebase.auth.GithubAuthProvider();
      this.scopes.forEach(s => p.addScope(s));
      return p;
    },
  },
  'facebook.com': {
    name: 'Facebook',
    icon: 'facebook',
    category: 'social',
    tier: 1,
    scopes: ['email', 'public_profile'],
    create() {
      const p = new firebase.auth.FacebookAuthProvider();
      this.scopes.forEach(s => p.addScope(s));
      return p;
    },
  },
  'twitter.com': {
    name: 'Twitter / X',
    icon: 'twitter',
    category: 'social',
    tier: 1,
    scopes: [],
    create() {
      return new firebase.auth.TwitterAuthProvider();
    },
  },
  'microsoft.com': {
    name: 'Microsoft',
    icon: 'microsoft',
    category: 'social',
    tier: 1,
    scopes: ['openid', 'email', 'profile'],
    create() {
      const p = new firebase.auth.OAuthProvider('microsoft.com');
      this.scopes.forEach(s => p.addScope(s));
      return p;
    },
  },
  'apple.com': {
    name: 'Apple',
    icon: 'apple',
    category: 'social',
    tier: 1,
    scopes: ['email', 'name'],
    create() {
      const p = new firebase.auth.OAuthProvider('apple.com');
      this.scopes.forEach(s => p.addScope(s));
      return p;
    },
  },
  'oidc.huggingface': {
    name: 'HuggingFace',
    icon: 'huggingface',
    category: 'social',
    tier: 2,
    scopes: ['openid', 'profile', 'email'],
    create() {
      const p = new firebase.auth.OAuthProvider('oidc.huggingface');
      this.scopes.forEach(s => p.addScope(s));
      return p;
    },
  },
  'oidc.discord': {
    name: 'Discord',
    icon: 'discord',
    category: 'social',
    tier: 2,
    scopes: ['identify', 'email', 'openid'],
    create() {
      const p = new firebase.auth.OAuthProvider('oidc.discord');
      this.scopes.forEach(s => p.addScope(s));
      return p;
    },
  },
  'oidc.slack': {
    name: 'Slack',
    icon: 'slack',
    category: 'social',
    tier: 2,
    scopes: ['openid', 'profile', 'email'],
    create() {
      const p = new firebase.auth.OAuthProvider('oidc.slack');
      this.scopes.forEach(s => p.addScope(s));
      return p;
    },
  },
  'oidc.linkedin': {
    name: 'LinkedIn',
    icon: 'linkedin',
    category: 'social',
    tier: 2,
    scopes: ['openid', 'profile', 'email'],
    create() {
      const p = new firebase.auth.OAuthProvider('oidc.linkedin');
      this.scopes.forEach(s => p.addScope(s));
      return p;
    },
  },
  'oidc.spotify': {
    name: 'Spotify',
    icon: 'spotify',
    category: 'social',
    tier: 2,
    scopes: ['openid', 'email', 'profile'],
    create() {
      const p = new firebase.auth.OAuthProvider('oidc.spotify');
      this.scopes.forEach(s => p.addScope(s));
      return p;
    },
  },
});

const AUTH_ERRORS = Object.freeze({
  'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
  'auth/cancelled-popup-request': 'Only one sign-in popup can be open at a time.',
  'auth/popup-blocked': 'Sign-in popup was blocked by the browser. Please allow popups for this site.',
  'auth/account-exists-with-different-credential': 'An account already exists with the same email using a different sign-in method.',
  'auth/wrong-password': 'Incorrect password. Please try again or reset your password.',
  'auth/user-not-found': 'No account found with that email address.',
  'auth/weak-password': 'Password must be at least 6 characters long.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/too-many-requests': 'Too many failed attempts. Please wait a moment before trying again.',
  'auth/network-request-failed': 'Network error. Please check your connection and try again.',
  'auth/user-disabled': 'This account has been disabled. Contact support for assistance.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled. Contact support.',
  'auth/credential-already-in-use': 'This credential is already linked to a different account.',
  'auth/invalid-credential': 'The sign-in credential is invalid or has expired. Please try again.',
  'auth/requires-recent-login': 'This operation requires recent authentication. Please sign in again.',
});

const TOKEN_EXCHANGE_ENDPOINT = '/api/onboarding/auth';
const TOKEN_EXCHANGE_TIMEOUT_MS = 12_000;

export class AuthHandler {
  #container;
  #firebaseConfig;
  #onSuccess;
  #onError;
  #auth;
  #loading = false;
  #activePopup = false;
  #emailFormMode = 'signin';

  constructor({ container, firebaseConfig, onSuccess, onError }) {
    if (!container || !(container instanceof HTMLElement)) {
      throw new TypeError('container must be a valid HTMLElement');
    }
    if (!firebaseConfig?.apiKey || !firebaseConfig?.authDomain || !firebaseConfig?.projectId) {
      throw new TypeError('firebaseConfig requires apiKey, authDomain, and projectId');
    }
    if (typeof onSuccess !== 'function') {
      throw new TypeError('onSuccess must be a function');
    }

    this.#container = container;
    this.#firebaseConfig = firebaseConfig;
    this.#onSuccess = onSuccess;
    this.#onError = typeof onError === 'function' ? onError : (err) => console.error('[AuthHandler]', err);

    this.#initFirebase();
    this.#render();
    this.#bindEvents();
  }

  #initFirebase() {
    if (!firebase.apps.length) {
      firebase.initializeApp(this.#firebaseConfig);
    }
    this.#auth = firebase.auth();
    this.#auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
  }

  #render() {
    const tier1 = Object.entries(PROVIDERS).filter(([, p]) => p.tier === 1);
    const tier2 = Object.entries(PROVIDERS).filter(([, p]) => p.tier === 2);

    this.#container.innerHTML = '';
    this.#container.setAttribute('role', 'region');
    this.#container.setAttribute('aria-label', 'Sign in to HeadyMe');

    const wrapper = document.createElement('div');
    wrapper.className = 'auth-handler';
    wrapper.innerHTML = `
      <div class="auth-header">
        <h2 id="auth-heading">Sign in to HeadyMe</h2>
        <p class="auth-subtitle">Choose your preferred sign-in method</p>
      </div>

      <div class="auth-providers" role="group" aria-labelledby="auth-heading">
        <div class="provider-section">
          <h3 class="provider-section-label">Sign in with</h3>
          <div class="provider-grid" role="list">
            ${tier1.map(([id, p]) => this.#renderProviderButton(id, p)).join('')}
          </div>
        </div>

        <div class="provider-section provider-section--oidc">
          <h3 class="provider-section-label">More options</h3>
          <div class="provider-grid provider-grid--compact" role="list">
            ${tier2.map(([id, p]) => this.#renderProviderButton(id, p)).join('')}
          </div>
        </div>
      </div>

      <div class="auth-divider" role="separator">
        <span>or</span>
      </div>

      <form class="auth-email-form" novalidate aria-label="Email sign-in form">
        <div class="form-field">
          <label for="auth-email">Email address</label>
          <input
            type="email"
            id="auth-email"
            name="email"
            autocomplete="email"
            required
            placeholder="you@example.com"
            aria-describedby="auth-email-error"
          />
          <span id="auth-email-error" class="field-error" role="alert" aria-live="polite"></span>
        </div>

        <div class="form-field">
          <label for="auth-password">Password</label>
          <input
            type="password"
            id="auth-password"
            name="password"
            autocomplete="current-password"
            required
            minlength="6"
            placeholder="Enter your password"
            aria-describedby="auth-password-error"
          />
          <span id="auth-password-error" class="field-error" role="alert" aria-live="polite"></span>
        </div>

        <button type="submit" class="auth-submit-btn" aria-live="polite">
          <span class="btn-text">Sign In</span>
          <span class="btn-spinner" aria-hidden="true" hidden></span>
        </button>

        <div class="auth-email-toggle">
          <button type="button" class="auth-toggle-btn" data-action="toggle-mode">
            Don't have an account? <strong>Create one</strong>
          </button>
        </div>
      </form>

      <div class="auth-status" role="status" aria-live="polite" hidden>
        <div class="auth-status-spinner" aria-hidden="true"></div>
        <span class="auth-status-text"></span>
      </div>

      <div class="auth-error" role="alert" aria-live="assertive" hidden>
        <span class="auth-error-text"></span>
        <button type="button" class="auth-error-dismiss" aria-label="Dismiss error">&times;</button>
      </div>
    `;

    this.#container.appendChild(wrapper);
  }

  #renderProviderButton(id, provider) {
    const tierLabel = provider.tier === 2 ? ' (OIDC)' : '';
    return `
      <button
        type="button"
        class="provider-btn provider-btn--${provider.icon}"
        data-provider="${id}"
        role="listitem"
        aria-label="Sign in with ${provider.name}${tierLabel}"
      >
        <span class="provider-icon provider-icon--${provider.icon}" aria-hidden="true"></span>
        <span class="provider-name">${provider.name}</span>
      </button>
    `;
  }

  #bindEvents() {
    this.#container.addEventListener('click', (e) => {
      const providerBtn = e.target.closest('[data-provider]');
      if (providerBtn && !this.#loading) {
        const providerId = providerBtn.dataset.provider;
        this.#handleProviderAuth(providerId);
        return;
      }

      const toggleBtn = e.target.closest('[data-action="toggle-mode"]');
      if (toggleBtn) {
        this.#toggleEmailMode();
        return;
      }

      const dismissBtn = e.target.closest('.auth-error-dismiss');
      if (dismissBtn) {
        this.#hideError();
      }
    });

    const form = this.#container.querySelector('.auth-email-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!this.#loading) {
        this.#handleEmailAuth(form);
      }
    });
  }

  async #handleProviderAuth(providerId) {
    const providerConfig = PROVIDERS[providerId];
    if (!providerConfig) {
      this.#showError(`Unknown provider: ${providerId}`);
      return;
    }

    if (this.#activePopup) {
      this.#showError(AUTH_ERRORS['auth/cancelled-popup-request']);
      return;
    }

    this.#setLoading(true, `Connecting to ${providerConfig.name}…`);
    this.#activePopup = true;

    try {
      const provider = providerConfig.create();
      const result = await this.#auth.signInWithPopup(provider);
      const idToken = await result.user.getIdToken(true);
      const session = await this.#exchangeToken(idToken, providerId);

      this.#onSuccess({
        user: result.user,
        provider: providerId,
        providerName: providerConfig.name,
        tier: providerConfig.tier,
        sessionId: session.sessionId,
        sessionToken: session.sessionToken,
      });
    } catch (err) {
      const message = AUTH_ERRORS[err.code] ?? `Authentication failed: ${err.message}`;

      if (err.code === 'auth/account-exists-with-different-credential') {
        this.#handleAccountConflict(err);
        return;
      }

      if (err.code !== 'auth/popup-closed-by-user') {
        this.#onError(err);
      }
      this.#showError(message);
    } finally {
      this.#activePopup = false;
      this.#setLoading(false);
    }
  }

  async #handleEmailAuth(form) {
    const emailInput = form.querySelector('#auth-email');
    const passwordInput = form.querySelector('#auth-password');
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    this.#clearFieldErrors(form);

    if (!email) {
      this.#setFieldError(emailInput, 'Email address is required.');
      return;
    }

    if (!this.#isValidEmail(email)) {
      this.#setFieldError(emailInput, 'Please enter a valid email address.');
      return;
    }

    if (!password) {
      this.#setFieldError(passwordInput, 'Password is required.');
      return;
    }

    if (this.#emailFormMode === 'signup' && password.length < 6) {
      this.#setFieldError(passwordInput, 'Password must be at least 6 characters.');
      return;
    }

    const actionLabel = this.#emailFormMode === 'signup' ? 'Creating account…' : 'Signing in…';
    this.#setLoading(true, actionLabel);

    try {
      let result;
      if (this.#emailFormMode === 'signup') {
        result = await this.#auth.createUserWithEmailAndPassword(email, password);
      } else {
        result = await this.#auth.signInWithEmailAndPassword(email, password);
      }

      const idToken = await result.user.getIdToken(true);
      const session = await this.#exchangeToken(idToken, 'password');

      this.#onSuccess({
        user: result.user,
        provider: 'password',
        providerName: 'Email',
        tier: 0,
        sessionId: session.sessionId,
        sessionToken: session.sessionToken,
      });
    } catch (err) {
      const message = AUTH_ERRORS[err.code] ?? `Authentication failed: ${err.message}`;

      if (err.code === 'auth/user-not-found' && this.#emailFormMode === 'signin') {
        this.#setFieldError(emailInput, 'No account found. Would you like to create one?');
      } else if (err.code === 'auth/wrong-password') {
        this.#setFieldError(passwordInput, AUTH_ERRORS['auth/wrong-password']);
      } else if (err.code === 'auth/weak-password') {
        this.#setFieldError(passwordInput, AUTH_ERRORS['auth/weak-password']);
      } else if (err.code === 'auth/email-already-in-use') {
        this.#setFieldError(emailInput, AUTH_ERRORS['auth/email-already-in-use']);
      } else if (err.code === 'auth/invalid-email') {
        this.#setFieldError(emailInput, AUTH_ERRORS['auth/invalid-email']);
      } else {
        this.#showError(message);
      }

      this.#onError(err);
    } finally {
      this.#setLoading(false);
    }
  }

  async #exchangeToken(idToken, provider) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TOKEN_EXCHANGE_TIMEOUT_MS);

    try {
      const response = await fetch(TOKEN_EXCHANGE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ idToken, provider }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Token exchange failed (HTTP ${response.status})`);
      }

      const data = await response.json();
      if (!data.sessionId || !data.sessionToken) {
        throw new Error('Invalid session response from server');
      }
      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Token exchange timed out. Please try again.');
      }

      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        return this.#fallbackMockSession(idToken, provider);
      }

      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  #fallbackMockSession(idToken, provider) {
    if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      throw new Error('Backend unreachable. Please try again later.');
    }

    console.warn('[AuthHandler] Backend unreachable — using mock session (dev mode)');

    const mockId = `dev-${crypto.randomUUID()}`;
    return {
      sessionId: mockId,
      sessionToken: btoa(JSON.stringify({
        mock: true,
        sessionId: mockId,
        provider,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      })),
    };
  }

  #handleAccountConflict(error) {
    const email = error.email;
    if (!email) {
      this.#showError(AUTH_ERRORS['auth/account-exists-with-different-credential']);
      return;
    }

    this.#auth.fetchSignInMethodsForEmail(email).then((methods) => {
      if (methods.length > 0) {
        const existingProvider = methods[0];
        const providerName = PROVIDERS[existingProvider]?.name ?? existingProvider;
        this.#showError(
          `This email is already linked to ${providerName}. Sign in with ${providerName} first, then link additional providers from your account settings.`
        );
      } else {
        this.#showError(AUTH_ERRORS['auth/account-exists-with-different-credential']);
      }
    }).catch(() => {
      this.#showError(AUTH_ERRORS['auth/account-exists-with-different-credential']);
    });
  }

  #toggleEmailMode() {
    const form = this.#container.querySelector('.auth-email-form');
    this.#clearFieldErrors(form);

    if (this.#emailFormMode === 'signin') {
      this.#emailFormMode = 'signup';
      form.querySelector('.auth-submit-btn .btn-text').textContent = 'Create Account';
      form.querySelector('.auth-toggle-btn').innerHTML =
        'Already have an account? <strong>Sign in</strong>';
      form.querySelector('#auth-password').setAttribute('autocomplete', 'new-password');
      form.querySelector('#auth-password').setAttribute('minlength', '6');
    } else {
      this.#emailFormMode = 'signin';
      form.querySelector('.auth-submit-btn .btn-text').textContent = 'Sign In';
      form.querySelector('.auth-toggle-btn').innerHTML =
        "Don't have an account? <strong>Create one</strong>";
      form.querySelector('#auth-password').setAttribute('autocomplete', 'current-password');
      form.querySelector('#auth-password').removeAttribute('minlength');
    }
  }

  #setLoading(active, statusText = '') {
    this.#loading = active;

    const buttons = this.#container.querySelectorAll('.provider-btn, .auth-submit-btn');
    const statusEl = this.#container.querySelector('.auth-status');
    const statusTextEl = this.#container.querySelector('.auth-status-text');
    const submitBtn = this.#container.querySelector('.auth-submit-btn');
    const btnSpinner = submitBtn?.querySelector('.btn-spinner');
    const btnText = submitBtn?.querySelector('.btn-text');

    if (active) {
      buttons.forEach(btn => {
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
      });
      if (statusEl) {
        statusEl.hidden = false;
        statusTextEl.textContent = statusText;
      }
      if (btnSpinner) btnSpinner.hidden = false;
      if (btnText) btnText.style.opacity = '0.5';
      this.#hideError();
    } else {
      buttons.forEach(btn => {
        btn.disabled = false;
        btn.removeAttribute('aria-disabled');
      });
      if (statusEl) statusEl.hidden = true;
      if (btnSpinner) btnSpinner.hidden = true;
      if (btnText) btnText.style.opacity = '';
    }
  }

  #showError(message) {
    const errorEl = this.#container.querySelector('.auth-error');
    const errorText = this.#container.querySelector('.auth-error-text');
    if (errorEl && errorText) {
      errorText.textContent = message;
      errorEl.hidden = false;
    }
  }

  #hideError() {
    const errorEl = this.#container.querySelector('.auth-error');
    if (errorEl) errorEl.hidden = true;
  }

  #setFieldError(input, message) {
    const errorSpan = input.parentElement.querySelector('.field-error');
    if (errorSpan) {
      errorSpan.textContent = message;
    }
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }

  #clearFieldErrors(form) {
    form.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach(el => { el.removeAttribute('aria-invalid'); });
  }

  #isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  destroy() {
    this.#container.innerHTML = '';
    this.#auth = null;
    this.#loading = false;
    this.#activePopup = false;
  }
}

export { PROVIDERS, AUTH_ERRORS };
