/**
 * HeadyShared — Shared runtime utilities for all Heady sites
 * Provides: navigation, FAQ accordion, scroll animations,
 *           theme toggle, AutoContext bridge, content injectors
 */
(function(global) {
  'use strict';

  // ============================================================
  // THEME TOGGLE
  // ============================================================
  function initTheme() {
    const root = document.documentElement;
    const toggles = document.querySelectorAll('[data-theme-toggle]');
    let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    root.setAttribute('data-theme', theme);
    toggles.forEach(t => updateToggleIcon(t, theme));

    toggles.forEach(toggle => {
      toggle.addEventListener('click', () => {
        theme = theme === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', theme);
        toggles.forEach(t => updateToggleIcon(t, theme));
      });
    });
  }

  function updateToggleIcon(el, theme) {
    el.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
    el.innerHTML = theme === 'dark'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  // ============================================================
  // NAV SCROLL BEHAVIOR
  // ============================================================
  function initNav() {
    const nav = document.querySelector('.heady-nav');
    if (!nav) return;

    const burger = nav.querySelector('.nav-hamburger');
    const links = nav.querySelector('.nav-links');

    // Scroll class
    const observer = new IntersectionObserver(
      ([entry]) => nav.classList.toggle('scrolled', !entry.isIntersecting),
      { threshold: 0, rootMargin: '-60px 0px 0px 0px' }
    );
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:1px;left:0;width:1px;height:1px;pointer-events:none;';
    document.body.prepend(sentinel);
    observer.observe(sentinel);

    // Mobile menu
    if (burger && links) {
      burger.addEventListener('click', () => {
        const open = burger.classList.toggle('open');
        links.classList.toggle('open', open);
        burger.setAttribute('aria-expanded', open);
      });
      links.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
          burger.classList.remove('open');
          links.classList.remove('open');
        });
      });
    }
  }

  // ============================================================
  // FAQ ACCORDION
  // ============================================================
  function initFAQ() {
    document.querySelectorAll('.faq-item').forEach(item => {
      const question = item.querySelector('.faq-question');
      if (!question) return;
      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        // Close all
        document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
        if (!isOpen) item.classList.add('open');
      });
    });
  }

  // ============================================================
  // SCROLL ANIMATIONS
  // ============================================================
  function initScrollAnimations() {
    const els = document.querySelectorAll('.fade-in');
    if (!els.length) return;

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    els.forEach(el => io.observe(el));
  }

  // ============================================================
  // COUNTER ANIMATION (for stats)
  // ============================================================
  function initCounters() {
    document.querySelectorAll('[data-count]').forEach(el => {
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const prefix = el.dataset.prefix || '';
      const duration = 1800;
      let start = null;

      const io = new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting) return;
        io.unobserve(el);

        function step(ts) {
          if (!start) start = ts;
          const progress = Math.min((ts - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const value = eased * target;
          el.textContent = prefix + (Number.isInteger(target) ? Math.round(value) : value.toFixed(1)) + suffix;
          if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }, { threshold: 0.5 });
      io.observe(el);
    });
  }

  // ============================================================
  // HEADY AUTO CONTEXT BRIDGE
  // ============================================================
  const HeadyAutoContext = {
    version: '1.0.0',
    site: null,
    context: {},
    listeners: [],
    _relayNonce: null,
    _allowedOrigins: ['https://auth.headysystems.com'],

    init(siteMeta) {
      this.site = siteMeta;
      const authConfig = global.__HEADY_AUTH_CONFIG__ || {};
      this._allowedOrigins = Array.isArray(authConfig.allowedOrigins) && authConfig.allowedOrigins.length
        ? authConfig.allowedOrigins
        : ['https://auth.headysystems.com'];
      this.context = {
        site: siteMeta.slug,
        domain: siteMeta.domain || window.location.hostname,
        timestamp: Date.now(),
        user: null,
        session: null,
        theme: document.documentElement.getAttribute('data-theme') || 'dark',
      };

      // Listen for auth sync from approved auth origins
      window.addEventListener('message', (event) => {
        if (!this._allowedOrigins.includes(event.origin)) return;
        if (event.data?.type === 'heady:auth:sync') {
          const relayNonce = event.data?.session?.nonce;
          if (relayNonce && this._relayNonce && relayNonce !== this._relayNonce) return;
          this.context.user = event.data.user;
          this.context.session = event.data.session;
          this.broadcast('auth:update', { user: event.data.user, session: event.data.session });
        }
        if (event.data?.type === 'heady:context:inject') {
          Object.assign(this.context, event.data.context || {});
          this.broadcast('context:update', this.context);
        }
      });

      // Expose on window for integrations
      window.HeadyAutoContext = this;
      this.broadcast('init', this.context);

      // Request auth state
      this._pingAuth();
    },

    _pingAuth() {
      const iframe = document.getElementById('heady-auth-relay');
      const relayTarget = (global.__HEADY_AUTH_CONFIG__ && global.__HEADY_AUTH_CONFIG__.relayOrigin) || 'https://auth.headysystems.com';
      if (iframe?.contentWindow) {
        this._relayNonce = global.crypto?.randomUUID ? global.crypto.randomUUID() : 'heady-' + Math.random().toString(36).slice(2);
        iframe.contentWindow.postMessage({ type: 'heady:context:request', site: this.site?.slug, nonce: this._relayNonce }, relayTarget);
      }
    },

    get(key) {
      return key ? this.context[key] : { ...this.context };
    },

    set(key, value) {
      this.context[key] = value;
      this.broadcast('context:update', { [key]: value });
    },

    on(event, cb) {
      this.listeners.push({ event, cb });
      return () => { this.listeners = this.listeners.filter(l => l.cb !== cb); };
    },

    broadcast(event, data) {
      this.listeners.filter(l => l.event === event || l.event === '*').forEach(l => {
        try { l.cb(data); } catch (e) {
          global.dispatchEvent(new CustomEvent('heady:error', {
            detail: {
              event,
              message: e && e.message ? e.message : 'HeadyAutoContext listener failure',
              site: this.site?.slug || null
            }
          }));
        }
      });
    }
  };

  // ============================================================
  // HEADY BEE CONTENT INJECTOR
  // ============================================================
  const HeadyBeeInjector = {
    version: '1.0.0',
    queue: [],
    loaded: false,

    init(config = {}) {
      this.config = {
        endpoint: config.endpoint || 'https://api.headysystems.com/v1/content',
        site: config.site || window.location.hostname,
        autoInject: config.autoInject !== false,
        ...config
      };

      document.querySelectorAll('[data-heady-bee]').forEach(el => {
        this._injectElement(el);
      });

      // Watch for dynamic elements
      const mo = new MutationObserver(mutations => {
        mutations.forEach(m => {
          m.addedNodes.forEach(node => {
            if (node.nodeType !== 1) return;
            if (node.dataset?.headyBee) this._injectElement(node);
            node.querySelectorAll?.('[data-heady-bee]').forEach(el => this._injectElement(el));
          });
        });
      });
      mo.observe(document.body, { childList: true, subtree: true });

      window.HeadyBeeInjector = this;
    },

    _injectElement(el) {
      const key = el.dataset.headyBee;
      const fallback = el.innerHTML;
      // In production this would fetch from the Bee content API
      // For static builds, we use data attributes or fallback content
      if (el.dataset.headyBeeContent) {
        el.innerHTML = el.dataset.headyBeeContent;
      }
      // Mark as processed
      el.setAttribute('data-heady-bee-injected', 'true');
    },

    inject(selector, content) {
      document.querySelectorAll(selector).forEach(el => {
        el.innerHTML = content;
        el.setAttribute('data-heady-bee-injected', 'true');
      });
    }
  };

  // ============================================================
  // AUTH RELAY IFRAME (hidden)
  // ============================================================
  function initAuthRelay() {
    if (document.getElementById('heady-auth-relay')) return;
    const iframe = document.createElement('iframe');
    const authConfig = global.__HEADY_AUTH_CONFIG__ || {};
    iframe.id = 'heady-auth-relay';
    iframe.src = authConfig.relayPath || 'https://auth.headysystems.com/relay.html';
    iframe.style.cssText = 'display:none;width:1px;height:1px;position:absolute;top:-9999px;';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    document.body.appendChild(iframe);
  }

  // ============================================================
  // AUTH WIDGET BUTTON STATE
  // ============================================================
  function initAuthWidget() {
    const btn = document.querySelector('.auth-widget-btn');
    if (!btn) return;

    window.addEventListener('message', event => {
      const allowedOrigins = Array.isArray((global.__HEADY_AUTH_CONFIG__ || {}).allowedOrigins)
        ? (global.__HEADY_AUTH_CONFIG__ || {}).allowedOrigins
        : ['https://auth.headysystems.com'];
      if (!allowedOrigins.includes(event.origin)) return;
      if (event.data?.type === 'heady:auth:sync') {
        const user = event.data.user;
        const dot = btn.querySelector('.dot');
        if (user) {
          btn.querySelector('.auth-label').textContent = user.displayName?.split(' ')[0] || 'Account';
          if (dot) dot.classList.add('online');
        } else {
          btn.querySelector('.auth-label').textContent = 'Sign In';
          if (dot) dot.classList.remove('online');
        }
      }
    });

    btn.addEventListener('click', () => {
      const relayOrigin = ((global.__HEADY_AUTH_CONFIG__ || {}).relayOrigin || 'https://auth.headysystems.com').replace(/\/$/, '');
      window.location.href = relayOrigin + '?return=' + encodeURIComponent(window.location.href);
    });
  }

  // ============================================================
  // INIT ALL
  // ============================================================
  function initAll() {
    initTheme();
    initNav();
    initFAQ();
    initScrollAnimations();
    initCounters();
    initAuthRelay();
    initAuthWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Expose globals
  global.HeadyAutoContext = HeadyAutoContext;
  global.HeadyBeeInjector = HeadyBeeInjector;

})(window);
