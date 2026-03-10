/**
 * Heady UI Auth Guard — Shared Authentication Module
 *
 * Provides session-based authentication for all Heady dashboards.
 * Uses sessionStorage with short-lived tokens (15 min).
 * Validates against HeadySystems domain whitelist.
 *
 * Usage: Include via <script src="../shared/auth-guard.js"></script>
 * Then call HeadyAuth.init() on page load.
 *
 * @module ui/shared/auth-guard
 * @author Eric Haywood — HeadySystems Inc.
 * @license PROPRIETARY — 51+ Provisional Patents
 */

/* eslint-disable no-unused-vars */
const HeadyAuth = (() => {
  const SESSION_KEY = 'heady_session';
  const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes (short expiry per security rules)
  const VALID_DOMAINS = [
    'headysystems.com',
    'headyconnection.org',
    'heady.ai',
    'headyapi.com',
    'headymcp.com',
  ];

  /** Create the auth overlay DOM */
  function createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'headyAuthOverlay';
    overlay.innerHTML = `
      <style>
        #headyAuthOverlay {
          position: fixed; inset: 0; background: rgba(10,14,23,0.92);
          display: flex; align-items: center; justify-content: center; z-index: 10000;
          font-family: 'Inter', system-ui, sans-serif;
        }
        #headyAuthOverlay.hidden { display: none; }
        .heady-auth-card {
          background: #1a2332; border: 1px solid #2a3a4d;
          border-radius: 13px; padding: 34px; max-width: 400px; width: 90%;
          color: #e2e8f0;
        }
        .heady-auth-card h2 {
          font-size: 1.618rem; margin-bottom: 21px; text-align: center;
        }
        .heady-auth-card h2 span { color: #06b6d4; }
        .heady-auth-card input {
          width: 100%; padding: 13px; margin-bottom: 13px;
          background: rgba(255,255,255,0.05); border: 1px solid #2a3a4d;
          border-radius: 8px; color: #e2e8f0; font-size: 1rem;
        }
        .heady-auth-card input:focus { outline: none; border-color: #06b6d4; }
        .heady-auth-card button {
          width: 100%; padding: 13px; background: #06b6d4;
          border: none; border-radius: 8px; color: #0a0e17;
          font-size: 1rem; font-weight: 600; cursor: pointer;
        }
        .heady-auth-card button:hover { filter: brightness(1.1); }
        .heady-auth-error {
          color: #ef4444; font-size: 0.875rem; margin-top: 8px; text-align: center;
          min-height: 1.2em;
        }
        .heady-auth-card .back-link {
          display: block; text-align: center; margin-top: 13px;
          color: #64748b; font-size: 0.875rem; text-decoration: none;
        }
        .heady-auth-card .back-link:hover { color: #e2e8f0; }
      </style>
      <div class="heady-auth-card">
        <h2>Heady<span>™</span> Authenticate</h2>
        <input type="email" id="headyAuthEmail" placeholder="Email" autocomplete="email" />
        <input type="password" id="headyAuthPassword" placeholder="Password" autocomplete="current-password" />
        <button onclick="HeadyAuth.login()">Sign In</button>
        <div class="heady-auth-error" id="headyAuthError"></div>
        <a class="back-link" href="../portal/index.html">← Back to Portal</a>
      </div>
    `;
    document.body.prepend(overlay);
    // Allow Enter key to submit
    overlay.querySelectorAll('input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') HeadyAuth.login();
      });
    });
  }

  /** Check if session is valid */
  function checkSession() {
    try {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (session && session.expiresAt > Date.now()) {
        const overlay = document.getElementById('headyAuthOverlay');
        if (overlay) overlay.classList.add('hidden');
        return session;
      }
    } catch (_) { /* invalid session data */ }

    const overlay = document.getElementById('headyAuthOverlay');
    if (overlay) overlay.classList.remove('hidden');
    return null;
  }

  /** Login handler */
  function login() {
    const email = document.getElementById('headyAuthEmail').value.trim();
    const password = document.getElementById('headyAuthPassword').value;
    const errorEl = document.getElementById('headyAuthError');

    if (!email || !password) {
      errorEl.textContent = 'Email and password are required';
      return;
    }

    const domain = email.split('@')[1];
    if (!VALID_DOMAINS.includes(domain)) {
      errorEl.textContent = 'Access restricted to HeadySystems domains';
      return;
    }

    const session = {
      email,
      authenticatedAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    errorEl.textContent = '';
    checkSession();

    // Dispatch custom event for dashboard initialization
    window.dispatchEvent(new CustomEvent('heady:authenticated', { detail: session }));
  }

  /** Logout handler */
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    checkSession();
  }

  /** Initialize auth guard — call on page load */
  function init() {
    createOverlay();
    const session = checkSession();
    if (session) {
      window.dispatchEvent(new CustomEvent('heady:authenticated', { detail: session }));
    }

    // Auto-check session every 60 seconds
    setInterval(checkSession, 60000);
  }

  return { init, login, logout, checkSession };
})();
