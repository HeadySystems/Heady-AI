// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Services Navigator v1.0.0 — Buddy-Guided Navigation        ║
// ║  Route view for #services (mount pattern mirrors AdminUI).         ║
// ║  Composes <heady-buddy-guide> (intent → /api/service/resolve →     ║
// ║  one-sentence explanation → Go) with <heady-service-nav> (live     ║
// ║  categorized catalog). Deep links: #services/<category>/<service>. ║
// ║  Spec: docs/blueprints/headyme-navigation-ia.md                    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { auth, signOut } from '../services/firebase.js';
import './BuddyGuide.js';  // registers <heady-buddy-guide>
import './ServiceNav.js';  // registers <heady-service-nav>

const TAB_NAV = `
<nav class="system-tabs glass-panel" aria-label="System switcher">
  <a href="#admin"  class="tab-btn" aria-current="false">
    ⬡ Rebuild <span class="tab-badge rebuild">PRIMARY</span>
  </a>
  <a href="#legacy" class="tab-btn" aria-current="false">
    ◈ Legacy <span class="tab-badge legacy">ADVISOR</span>
  </a>
  <a href="#services" class="tab-btn active" aria-current="page">
    ⬢ Services <span class="tab-badge services">GUIDE</span>
  </a>
</nav>`;

export class ServicesUI {
  constructor(container, user) {
    this.container = container;
    this.user = user;
  }

  render() {
    this.container.innerHTML = TAB_NAV + `
      <div class="admin-dashboard">
        <header class="admin-header glass-panel">
          <div class="header-content">
            <div>
              <h1>Heady™ Services</h1>
              <p class="muted" style="font-size:0.8rem;margin:4px 0 0">
                Say what you need — HeadyBuddy finds the right service and takes you there.
              </p>
            </div>
            <div class="user-info">
              <span>${this.user.email}</span>
              <button id="logout-btn" class="secondary-btn small">Disconnect</button>
            </div>
          </div>
        </header>

        <main class="dashboard-grid">
          <section class="card glass-panel" style="grid-column: 1 / -1;">
            <h2>HeadyBuddy Guide <span class="muted">— live routing via POST /api/service/resolve</span></h2>
            <heady-buddy-guide id="buddy-guide"></heady-buddy-guide>
          </section>

          <section class="card glass-panel" style="grid-column: 1 / -1;">
            <h2>All Services <span class="muted">— live catalog via GET /api/service/catalog</span></h2>
            <heady-service-nav id="service-nav"></heady-service-nav>
          </section>
        </main>
      </div>`;

    this.container.querySelector('#logout-btn').addEventListener('click', () => signOut(auth));

    // Hand both components the auth-token getter (same injection pattern as
    // AdminUI → heady-build-narrative) so they stay firebase-agnostic.
    const guide = this.container.querySelector('#buddy-guide');
    const nav = this.container.querySelector('#service-nav');
    guide.tokenProvider = () => this.token();
    nav.tokenProvider = () => this.token();

    // Listen on the view's own root (destroyed with it on remount) — never on
    // the persistent #app container, or listeners would accumulate per visit.
    const viewRoot = this.container.querySelector('.admin-dashboard');

    // Buddy "Go" → deep-linkable route; the router delegates back to route().
    viewRoot.addEventListener('heady:buddy:go', (e) => {
      const { category, service } = e.detail || {};
      if (category && service) window.location.hash = `#services/${category}/${service}`;
    });

    // Nav "Ask Buddy about this" → explicit-name resolve, closing the loop.
    viewRoot.addEventListener('heady:services:ask-buddy', (e) => {
      const service = e.detail?.service;
      if (service) {
        guide.askService(service);
        guide.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    window.dispatchEvent(new CustomEvent('navigation:services:entered'));
    this.route(window.location.hash);
  }

  /**
   * Apply a #services[/<category>[/<service>]] hash without remounting —
   * main.js delegates here when the view is already active.
   */
  route(hash) {
    const nav = this.container.querySelector('#service-nav');
    if (!nav) return;
    const parts = String(hash || '').replace(/^#services\/?/, '').split('/').filter(Boolean);
    if (parts.length === 0) { nav.removeAttribute('selected'); return; }
    nav.setAttribute('selected', parts.slice(0, 2).join('/'));
  }

  async token() { try { return await this.user.getIdToken(); } catch { return ''; } }
}
