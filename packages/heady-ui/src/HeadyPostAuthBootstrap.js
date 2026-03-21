const { createLogger } = require('../../utils/logger');
const logger = createLogger('auto-fixed');
// packages/heady-ui/src/HeadyPostAuthBootstrap.js
// §18 — Shared Post-Auth Bootstrap Component
// Vanilla JS — no framework dependency (Law 3)

class HeadyPostAuthBootstrap {
  constructor({
    siteId,
    accentColor = '#00d4aa',
    apiBase = 'https://api.headysystems.com'
  }) {
    this.siteId = siteId;
    this.accentColor = accentColor;
    this.apiBase = apiBase;
    this.user = null;
    this.memoryProfile = null;
    this.init();
  }
  async init() {
    try {
      const profile = await this.fetchUserProfile();
      if (!profile) {
        this.renderGuestState();
        return;
      }
      this.user = profile;
      await this.bootstrapMemory(profile.uid);
      this.renderAuthenticatedState(profile);
      if (profile.isNewUser) this.launchOnboarding(profile);
    } catch (err) {
      logger.warn('[HeadyBootstrap]', err.message);
      this.renderGuestState();
    }
  }
  async fetchUserProfile() {
    const res = await fetch(`${this.apiBase}/api/auth/me`, {
      credentials: 'include'
    });
    if (!res.ok) return null;
    return res.json();
  }
  async bootstrapMemory(userId) {
    const res = await fetch(`${this.apiBase}/api/memory/bootstrap`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        siteId: this.siteId,
        cslThreshold: 0.618,
        topK: 21
      })
    });
    if (!res.ok) return;
    this.memoryProfile = await res.json();
    sessionStorage.setItem('heady_memory', JSON.stringify({
      memoryCount: this.memoryProfile.memoryCount,
      cslScore: this.memoryProfile.cslScore,
      bootstrappedAt: Date.now()
    }));
    if (typeof window !== 'undefined' && window.AutoContextBridge) {
      window.AutoContextBridge.injectMemory(this.memoryProfile);
    }
  }
  renderAuthenticatedState(profile) {
    const trigger = document.querySelector('.heady-auth-trigger');
    if (trigger) {
      trigger.innerHTML = `
        <div class="heady-avatar" title="${profile.displayName} · ${this.memoryProfile?.memoryCount ?? 0} memories"
             style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,${this.accentColor},#7c5eff);
                    display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;cursor:pointer;">
          ${profile.displayName?.[0]?.toUpperCase() ?? '?'}
        </div>`;
    }
    if (this.memoryProfile?.memoryCount > 0) {
      const badge = document.createElement('div');
      badge.className = 'heady-memory-badge';
      badge.style.cssText = `background:rgba(0,0,0,0.3);border:1px solid ${this.accentColor};border-radius:20px;
        padding:3px 12px;font-size:0.7rem;font-family:'JetBrains Mono',monospace;color:${this.accentColor};
        margin-top:0.5rem;display:inline-block;`;
      badge.textContent = `✓ ${this.memoryProfile.memoryCount} memories · CSL ${this.memoryProfile.cslScore?.toFixed(3)}`;
      const hero = document.querySelector('.hero');
      if (hero) hero.appendChild(badge);
    }
  }
  renderGuestState() {
    document.querySelectorAll('.heady-auth-required').forEach(el => {
      el.style.display = 'none';
    });
    document.querySelectorAll('.heady-guest-only').forEach(el => {
      el.style.display = '';
    });
  }
  launchOnboarding(profile) {
    const completed = localStorage.getItem(`heady_onboarding_${this.siteId}_${profile.uid}`);
    if (completed) return;
    import('./HeadyOnboarding.js').then(m => {
      new m.HeadyOnboarding({
        userId: profile.uid,
        siteId: this.siteId,
        accentColor: this.accentColor
      }).start();
    }).catch(() => {}); // Non-fatal
  }
}
if (typeof window !== 'undefined') {
  window.HeadyPostAuthBootstrap = HeadyPostAuthBootstrap;
}
export { HeadyPostAuthBootstrap };