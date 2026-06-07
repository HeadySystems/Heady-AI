// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: HeadySystems_v13/sites/headyex/buddy-widget.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * HeadyBuddy Universal Chat Widget v4.0
 * Sacred Geometry Dark Glassmorphism — Single IIFE, zero dependencies
 * Deployed across all 9 Heady domain sites
 *
 * Configuration (set before script loads):
 *   window.HEADY_API           — API base URL     (default: https://api.headysystems.com)
 *   window.HEADY_AUTH          — Auth base URL    (default: https://headykey.com)
 *   window.HEADY_BUDDY_GREETING — Custom greeting
 */

(function () {
  'use strict';

  // ─── § 1  CONFIGURATION ──────────────────────────────────────────────────────

  var API_BASE  = (window.HEADY_API  || 'https://api.headysystems.com').replace(/\/$/, '');
  var AUTH_BASE = (window.HEADY_AUTH || 'https://headykey.com').replace(/\/$/, '');
  var GREETING  = window.HEADY_BUDDY_GREETING ||
    "Hey! I'm HeadyBuddy, your AI companion. Ask me anything about the Heady ecosystem.";

  // Phi-derived constants
  var PHI = 1.618033988749895;
  var FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
  var TRANSITION = 'cubic-bezier(0.618, 0, 0.382, 1)';

  // ─── § 2  PERSISTENT SESSION & DEVICE IDs ───────────────────────────────────

  function getOrCreate(key, generator) {
    var val = localStorage.getItem(key);
    if (!val) { val = generator(); localStorage.setItem(key, val); }
    return val;
  }

  function genId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 9);
  }

  var SESSION_ID = getOrCreate('heady_buddy_session', function () { return genId('sess'); });
  var DEVICE_ID  = getOrCreate('heady_device_id',     function () { return genId('dev');  });

  // ─── § 3  STATE ──────────────────────────────────────────────────────────────

  var state = {
    open:    false,
    user:    null,        // { uid, email, displayName } or null
    history: [],          // [{ role, content }]
    turns:   0,
    polling: null
  };

  // ─── § 4  UTILITIES ──────────────────────────────────────────────────────────

  /** XSS-safe HTML escaping for user content */
  function escHtml(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  /**
   * Safe markdown renderer for bot messages.
   * Handles: code blocks, inline code, bold, italic, links.
   * Input is trusted (comes from our own API).
   */
  function renderMarkdown(text) {
    var s = escHtml(text);
    // Un-escape for markdown processing (we escaped first to stop XSS, now
    // we selectively allow safe markdown-derived HTML only)
    // Code blocks: ```lang\n...\n```
    s = s.replace(/```([a-z]*)\n?([\s\S]*?)```/g, function (_, lang, code) {
      return '<pre style="background:rgba(0,0,0,0.5);border-radius:' + FIB[4] + 'px;' +
             'padding:' + FIB[4] + 'px;overflow-x:auto;margin:' + FIB[3] + 'px 0;' +
             'font-size:0.8rem;line-height:1.5;border:1px solid rgba(124,58,237,0.3)">' +
             '<code style="font-family:\'Fira Code\',monospace;color:#a78bfa">' +
             code + '</code></pre>';
    });
    // Inline code
    s = s.replace(/`([^`]+)`/g,
      '<code style="background:rgba(124,58,237,0.2);color:#c4b5fd;padding:2px 5px;' +
      'border-radius:4px;font-family:\'Fira Code\',monospace;font-size:0.85em">$1</code>');
    // Bold
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#e8e8f0">$1</strong>');
    // Italic
    s = s.replace(/\*([^*]+)\*/g, '<em style="color:#c4b5fd">$1</em>');
    // Links — only allow http/https
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" ' +
      'style="color:#06b6d4;text-decoration:underline">$1</a>');
    // Line breaks
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  // ─── § 5  AUTH — SESSION-COOKIE FLOW ────────────────────────────────────────

  function checkSession(cb) {
    fetch(AUTH_BASE + '/api/auth/session', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    })
    .then(function (res) {
      if (!res.ok) { cb(null); return; }
      return res.json();
    })
    .then(function (data) {
      if (!data) { cb(null); return; }
      var user = null;
      if (data && data.user && data.user.uid) {
        user = {
          uid:         data.user.uid,
          email:       data.user.email       || '',
          displayName: data.user.displayName || data.user.email || 'User'
        };
      } else if (data && data.uid) {
        user = {
          uid:         data.uid,
          email:       data.email       || '',
          displayName: data.displayName || data.email || 'User'
        };
      }
      cb(user);
    })
    .catch(function () { cb(null); });
  }

  function signOut() {
    fetch(AUTH_BASE + '/api/auth/signout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    })
    .catch(function () {})
    .finally(function () {
      state.user = null;
      updateAuthBar();
    });
  }

  /** Open the auth page in a new tab with return URL */
  function openAuthPage() {
    var returnUrl = encodeURIComponent(window.location.href);
    window.open(AUTH_BASE + '?return=' + returnUrl, '_blank', 'noopener,noreferrer');
  }

  /**
   * Poll for session after the user opens the auth tab.
   * Fires every ~FIB[9]=55 seconds, stops once logged in.
   */
  function startAuthPolling() {
    if (state.polling) return;
    state.polling = setInterval(function () {
      if (state.user) { stopAuthPolling(); return; }
      checkSession(function (user) {
        if (user) {
          state.user = user;
          updateAuthBar();
          stopAuthPolling();
          if (state.open) loadHistory();
        }
      });
    }, FIB[9] * 1000); // 55s
  }

  function stopAuthPolling() {
    if (state.polling) { clearInterval(state.polling); state.polling = null; }
  }

  // Also listen for storage events from other tabs
  window.addEventListener('storage', function (e) {
    if (e.key === 'heady_auth_signal') {
      checkSession(function (user) {
        if (user && !state.user) {
          state.user = user;
          updateAuthBar();
          if (state.open) loadHistory();
        }
      });
    }
  });

  // ─── § 6  API CALLS ──────────────────────────────────────────────────────────

  function apiPost(path, body, cb, errCb) {
    fetch(API_BASE + path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    .then(function (res) {
      if (!res.ok) { throw new Error('HTTP ' + res.status); }
      return res.json();
    })
    .then(cb)
    .catch(errCb || function () {});
  }

  function sendChat(message, onDone, onError) {
    var body = {
      message:    message,
      user:       state.user || { uid: DEVICE_ID, email: '', displayName: 'Anonymous' },
      history:    state.history.slice(-20),   // last 20 turns for context window
      session_id: SESSION_ID
    };
    apiPost('/api/brain/chat', body, function (data) {
      var reply = (data && data.reply) || (data && data.message) || (data && data.response) || '';
      onDone(reply);
    }, function () {
      onError('HeadyBuddy is connecting to the neural network. Try again in a moment.');
    });
  }

  function loadHistory() {
    if (!state.user) return;
    apiPost('/api/buddy/history', { user: state.user }, function (data) {
      if (data && Array.isArray(data.history) && data.history.length) {
        state.history = data.history;
        // Render existing history into messages area
        var msgs = el('hb-messages');
        if (msgs) {
          msgs.innerHTML = '';
          state.history.forEach(function (turn) {
            appendMessage(turn.role === 'user' ? 'user' : 'bot', turn.content, false);
          });
          msgs.scrollTop = msgs.scrollHeight;
        }
      }
    }, function () {});
  }

  function storeVector(question, answer) {
    if (!state.user) return;
    apiPost('/api/vector/store', {
      user:     state.user,
      question: question,
      answer:   answer
    }, function () {}, function () {});
  }

  // ─── § 7  DOM HELPERS ────────────────────────────────────────────────────────

  function el(id) { return document.getElementById(id); }

  function css(element, styles) {
    Object.keys(styles).forEach(function (k) { element.style[k] = styles[k]; });
  }

  // ─── § 8  WIDGET INJECTION ───────────────────────────────────────────────────

  function injectStyles() {
    var style = document.createElement('style');
    style.id = 'heady-buddy-styles';
    style.textContent = [
      /* Keyframes */
      '@keyframes hb-bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}',
      '@keyframes hb-fadein{from{opacity:0;transform:translateY(13px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes hb-pulse{0%,100%{box-shadow:0 0 0 0 rgba(124,58,237,0.4)}70%{box-shadow:0 0 0 10px rgba(124,58,237,0)}}',
      /* FAB */
      '#hb-fab{position:fixed;bottom:34px;right:34px;width:60px;height:60px;border-radius:50%;',
      'background:linear-gradient(135deg,#7c3aed,#06b6d4);',
      'border:none;cursor:pointer;z-index:2147483646;',
      'display:flex;align-items:center;justify-content:center;',
      'font-size:26px;box-shadow:0 8px 34px rgba(124,58,237,0.5);',
      'transition:transform 0.3s ' + TRANSITION + ',box-shadow 0.3s ' + TRANSITION + ';',
      'animation:hb-pulse 2.618s infinite;}',
      '#hb-fab:hover{transform:scale(1.1);box-shadow:0 13px 55px rgba(124,58,237,0.7);}',
      /* Panel */
      '#hb-panel{position:fixed;bottom:108px;right:34px;width:380px;height:520px;',
      'background:rgba(15,15,25,0.88);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);',
      'border:1px solid rgba(124,58,237,0.3);border-radius:16px;',
      'display:flex;flex-direction:column;',
      'z-index:2147483647;overflow:hidden;',
      'box-shadow:0 21px 89px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.05);',
      'transition:opacity 0.3s ' + TRANSITION + ',transform 0.3s ' + TRANSITION + ';}',
      '#hb-panel.hb-hidden{opacity:0;transform:translateY(21px) scale(0.97);pointer-events:none;}',
      /* Header */
      '#hb-header{padding:13px 21px;',
      'background:linear-gradient(135deg,rgba(124,58,237,0.25),rgba(6,182,212,0.15));',
      'border-bottom:1px solid rgba(124,58,237,0.2);',
      'display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}',
      '#hb-title{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
      'font-size:1.1rem;font-weight:700;',
      'background:linear-gradient(135deg,#a78bfa,#06b6d4);',
      '-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}',
      '#hb-close{background:none;border:none;color:rgba(255,255,255,0.5);font-size:20px;',
      'cursor:pointer;padding:0 5px;line-height:1;',
      'transition:color 0.2s;}',
      '#hb-close:hover{color:#fff;}',
      /* Auth bar */
      '#hb-auth-bar{padding:8px 21px;',
      'background:rgba(0,0,0,0.25);border-bottom:1px solid rgba(255,255,255,0.06);',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
      'font-size:0.76rem;color:rgba(255,255,255,0.55);',
      'display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}',
      '#hb-auth-bar a,#hb-auth-bar button.hb-link{color:#06b6d4;text-decoration:none;',
      'background:none;border:none;cursor:pointer;font-size:0.76rem;padding:0;}',
      '#hb-auth-bar a:hover,#hb-auth-bar button.hb-link:hover{color:#a78bfa;}',
      /* Messages */
      '#hb-messages{flex:1;overflow-y:auto;padding:13px;display:flex;flex-direction:column;gap:8px;}',
      '#hb-messages::-webkit-scrollbar{width:4px;}',
      '#hb-messages::-webkit-scrollbar-track{background:transparent;}',
      '#hb-messages::-webkit-scrollbar-thumb{background:rgba(124,58,237,0.4);border-radius:2px;}',
      /* Message bubbles */
      '.hb-msg{max-width:85%;animation:hb-fadein 0.3s ' + TRANSITION + ';',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:0.875rem;line-height:1.5;}',
      '.hb-msg-user{align-self:flex-end;',
      'background:linear-gradient(135deg,#7c3aed,#5b21b6);',
      'color:#fff;padding:8px 13px;border-radius:16px 16px 4px 16px;}',
      '.hb-msg-bot{align-self:flex-start;',
      'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);',
      'color:#e8e8f0;padding:8px 13px;border-radius:16px 16px 16px 4px;}',
      /* Typing indicator */
      '#hb-typing{align-self:flex-start;',
      'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);',
      'padding:10px 16px;border-radius:16px 16px 16px 4px;display:none;}',
      '#hb-typing span{display:inline-block;width:7px;height:7px;margin:0 2px;',
      'background:#a78bfa;border-radius:50%;',
      'animation:hb-bounce 1.2s infinite ease-in-out;}',
      '#hb-typing span:nth-child(1){animation-delay:-0.32s;}',
      '#hb-typing span:nth-child(2){animation-delay:-0.16s;}',
      /* Input row */
      '#hb-input-row{padding:13px;border-top:1px solid rgba(255,255,255,0.06);',
      'display:flex;gap:8px;align-items:flex-end;flex-shrink:0;',
      'background:rgba(0,0,0,0.2);}',
      '#hb-input{flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);',
      'border-radius:13px;padding:10px 13px;color:#e8e8f0;font-size:0.875rem;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
      'resize:none;outline:none;min-height:42px;max-height:120px;',
      'transition:border-color 0.2s ' + TRANSITION + ';}',
      '#hb-input:focus{border-color:rgba(124,58,237,0.6);}',
      '#hb-input::placeholder{color:rgba(255,255,255,0.3);}',
      '#hb-send{width:42px;height:42px;border-radius:13px;flex-shrink:0;',
      'background:linear-gradient(135deg,#7c3aed,#06b6d4);',
      'border:none;cursor:pointer;color:#fff;font-size:18px;',
      'display:flex;align-items:center;justify-content:center;',
      'transition:transform 0.2s ' + TRANSITION + ',opacity 0.2s;}',
      '#hb-send:hover:not(:disabled){transform:scale(1.08);}',
      '#hb-send:disabled{opacity:0.4;cursor:not-allowed;}',
      /* Mobile responsive */
      '@media(max-width:480px){',
      '#hb-panel{right:0;bottom:0;width:100vw;height:calc(100vh - 0px);border-radius:16px 16px 0 0;}',
      '#hb-fab{bottom:21px;right:21px;}',
      '}'
    ].join('');
    document.head.appendChild(style);
  }

  function buildWidget() {
    // FAB
    var fab = document.createElement('button');
    fab.id = 'hb-fab';
    fab.setAttribute('aria-label', 'Open HeadyBuddy chat');
    fab.innerHTML = '&#x1F9E0;'; // 🧠
    fab.addEventListener('click', togglePanel);

    // Panel
    var panel = document.createElement('div');
    panel.id = 'hb-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'HeadyBuddy chat');
    panel.classList.add('hb-hidden');

    panel.innerHTML = [
      /* Header */
      '<div id="hb-header">',
      '  <span id="hb-title">&#x1F9E0; HeadyBuddy</span>',
      '  <button id="hb-close" aria-label="Close chat">&times;</button>',
      '</div>',
      /* Auth bar */
      '<div id="hb-auth-bar"></div>',
      /* Messages */
      '<div id="hb-messages" role="log" aria-live="polite">',
      '  <div id="hb-typing"><span></span><span></span><span></span></div>',
      '</div>',
      /* Input row */
      '<div id="hb-input-row">',
      '  <textarea id="hb-input" placeholder="Ask HeadyBuddy anything..." rows="1" aria-label="Chat message"></textarea>',
      '  <button id="hb-send" aria-label="Send message">&#10148;</button>',
      '</div>'
    ].join('');

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    // Wire events
    el('hb-close').addEventListener('click', togglePanel);
    el('hb-send').addEventListener('click', handleSend);
    el('hb-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    // Auto-resize textarea
    el('hb-input').addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
  }

  // ─── § 9  AUTH BAR RENDERING ─────────────────────────────────────────────────

  function updateAuthBar() {
    var bar = el('hb-auth-bar');
    if (!bar) return;
    if (state.user) {
      var email = escHtml(state.user.email || state.user.displayName || 'Signed in');
      bar.innerHTML =
        '<span>' + email + ' &nbsp;&#10003;</span>' +
        '<button class="hb-link" id="hb-signout-btn">Sign out</button>';
      var soBtn = el('hb-signout-btn');
      if (soBtn) soBtn.addEventListener('click', signOut);
    } else {
      var returnUrl = encodeURIComponent(window.location.href);
      bar.innerHTML =
        '<span>Sign in for persistent memory &nbsp;</span>' +
        '<a href="' + escHtml(AUTH_BASE) + '?return=' + returnUrl +
        '" target="_blank" rel="noopener noreferrer" id="hb-signin-link">Sign in &#8599;</a>';
      var signinLink = el('hb-signin-link');
      if (signinLink) {
        signinLink.addEventListener('click', function () {
          startAuthPolling();
        });
      }
    }
  }

  // ─── § 10  PANEL TOGGLE ──────────────────────────────────────────────────────

  function togglePanel() {
    state.open = !state.open;
    var panel = el('hb-panel');
    if (state.open) {
      panel.classList.remove('hb-hidden');
      el('hb-input').focus();
      // Show greeting if no messages yet
      var msgs = el('hb-messages');
      var existingMsgs = msgs.querySelectorAll('.hb-msg');
      if (existingMsgs.length === 0) {
        appendMessage('bot', GREETING, false);
        if (state.user) loadHistory();
      }
    } else {
      panel.classList.add('hb-hidden');
    }
  }

  // ─── § 11  MESSAGE RENDERING ─────────────────────────────────────────────────

  function appendMessage(role, content, isHtml) {
    var msgs = el('hb-messages');
    var typing = el('hb-typing');
    var div = document.createElement('div');
    div.className = 'hb-msg hb-msg-' + (role === 'user' ? 'user' : 'bot');

    if (role === 'user') {
      div.textContent = content; // plain text for user messages (XSS safe)
    } else {
      div.innerHTML = isHtml ? content : renderMarkdown(content);
    }

    msgs.insertBefore(div, typing);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function showTyping() {
    var t = el('hb-typing');
    if (t) {
      t.style.display = 'block';
      el('hb-messages').scrollTop = el('hb-messages').scrollHeight;
    }
  }

  function hideTyping() {
    var t = el('hb-typing');
    if (t) t.style.display = 'none';
  }

  // ─── § 12  SEND HANDLER ──────────────────────────────────────────────────────

  function handleSend() {
    var input = el('hb-input');
    var sendBtn = el('hb-send');
    var message = input.value.trim();
    if (!message) return;

    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;

    appendMessage('user', message, false);
    state.history.push({ role: 'user', content: message });
    state.turns++;

    showTyping();

    sendChat(message, function (reply) {
      hideTyping();
      if (reply) {
        appendMessage('bot', reply, false);
        state.history.push({ role: 'assistant', content: reply });
        storeVector(message, reply);
      }
      sendBtn.disabled = false;
      input.focus();
    }, function (errMsg) {
      hideTyping();
      appendMessage('bot', errMsg, false);
      sendBtn.disabled = false;
      input.focus();
    });
  }

  // ─── § 13  BOOT ──────────────────────────────────────────────────────────────

  function boot() {
    // Guard: only inject once
    if (document.getElementById('hb-fab')) return;

    injectStyles();
    buildWidget();

    // Check existing session silently
    checkSession(function (user) {
      state.user = user;
      updateAuthBar();
      // If panel was open before page reload, keep it closed (fresh start is fine)
    });
  }

  // Boot after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
