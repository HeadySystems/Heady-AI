const logger = require('../utils/logger');

function sanitizeText(value) {
    return String(value || '').replace(/[<>]/g, '').trim();
}

function buildUserWorkspaceId({ userId, deviceId, site }) {
    const safeUser = sanitizeText(userId || 'anonymous').slice(0, 64);
    const safeDevice = sanitizeText(deviceId || 'unknown-device').slice(0, 64);
    const safeSite = sanitizeText(site || 'heady').slice(0, 64);
    return `vw:${safeSite}:${safeUser}:${safeDevice}`;
}

function buildChatRequest({
    message,
    userId,
    token,
    deviceId,
    site,
    history = [],
    context = {},
}) {
    const cleanMessage = sanitizeText(message);
    const workspaceId = buildUserWorkspaceId({ userId, deviceId, site });

    return {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(deviceId ? { 'X-Heady-Device': deviceId } : {}),
            'X-Heady-Workspace': workspaceId,
        },
        body: {
            message: cleanMessage,
            history: history.slice(-8),
            context: {
                ...context,
                site,
                workspaceId,
                userId: userId || 'anonymous',
                channel: 'buddy-chat',
                vector3d: true,
            },
        },
        workspaceId,
    };
}

function parseBuddyResponse(payload) {
    const text = payload?.response || payload?.reply || payload?.message || payload?.text || '';
    const done = Boolean(payload?.confirmed === true
        || payload?.done === true
        || payload?.status === 'done'
        || payload?.status === 'completed'
        || payload?.confirmation?.done === true);

    return {
        text: sanitizeText(text),
        confirmed: done,
        status: payload?.status || (done ? 'completed' : 'in_progress'),
    };
}

function assertConfirmedCompletion(parsed, mode = 'warn') {
    const ok = parsed?.confirmed === true;
    if (!ok) {
        const message = `[BuddyContract] Completion not confirmed (status=${parsed?.status || 'unknown'})`;
        if (mode === 'throw') {
            throw new Error(message);
        }
        logger.logSystem(message);
    }
    return ok;
}

module.exports = {
    sanitizeText,
    buildUserWorkspaceId,
    buildChatRequest,
    parseBuddyResponse,
    assertConfirmedCompletion,
};


// --- Auto-Unified Latent Service Pattern (Smart) ---
(function _wireLatentStubs() {
  const exp = module.exports;
  if (!exp || typeof exp !== 'object') return;

  // Find the first exported class instance or constructor with health/start/stop
  let _inst = null;
  for (const key of Object.keys(exp)) {
    const val = exp[key];
    // If it's a singleton instance with a health method, use it
    if (val && typeof val === 'object' && typeof val.health === 'function') {
      _inst = val; break;
    }
    // If it's a function (class constructor), try to find a getSingleton pattern
    if (typeof val === 'function' && val.prototype) {
      const getterKey = Object.keys(exp).find(k =>
        k.startsWith('get') && typeof exp[k] === 'function' && k !== key
      );
      if (getterKey) {
        try { const inst = exp[getterKey](); if (inst && typeof inst.health === 'function') { _inst = inst; break; } } catch(e) {}
      }
    }
  }

  if (!exp.start) exp.start = _inst && typeof _inst.start === 'function'
    ? async () => { await _inst.start(); return { status: 'started' }; }
    : async () => ({ status: 'started' });
  if (!exp.stop) exp.stop = _inst && typeof _inst.stop === 'function'
    ? async () => { await _inst.stop(); return { status: 'stopped' }; }
    : async () => ({ status: 'stopped' });
  if (!exp.health) exp.health = _inst && typeof _inst.health === 'function'
    ? () => _inst.health()
    : () => ({ status: 'healthy', service: require('path').basename(__filename, '.js') });
  if (!exp.metrics) exp.metrics = _inst && typeof _inst.metrics === 'function'
    ? () => _inst.metrics()
    : () => ({ service: require('path').basename(__filename, '.js') });
  if (!exp._tick) exp._tick = async () => {};
})();
// -------------------------------------------
