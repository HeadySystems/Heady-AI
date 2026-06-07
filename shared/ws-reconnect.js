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
// ║  FILE: shared/ws-reconnect.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * WebSocket Reconnection Manager — φ-Backoff Reconnection for All WS Connections
 * Provides automatic reconnection with exponential φ-scaled backoff,
 * message queuing during disconnection, and health monitoring.
 *
 * Author: Eric Haywood | φ-scaled | CSL-gated | ESM only
 */

// ── φ-Math Constants ────────────────────────────────────────────────
const PHI = 1.6180339887;
const PSI = 1 / PHI;
const PSI2 = PSI * PSI;
const FIB = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597];

function log(level, msg, meta = {}) {
  const entry = { ts: new Date().toISOString(), level, service: 'ws-reconnect', msg, ...meta };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

// ── φ-Backoff ───────────────────────────────────────────────────────
function phiBackoff(attempt, baseMs = 1000, maxMs = 60000) {
  const delay = Math.min(baseMs * Math.pow(PHI, attempt), maxMs);
  const jitter = delay * PSI2 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

// ── Connection States ───────────────────────────────────────────────
const WS_STATES = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed', // Exceeded max retries
};

class ReconnectingWebSocket {
  #url;
  #protocols;
  #ws;
  #state;
  #attempt;
  #maxAttempts;
  #messageQueue;
  #maxQueueSize;
  #listeners;
  #reconnectTimer;
  #heartbeatInterval;
  #heartbeatIntervalMs;
  #lastPong;
  #metrics;
  #authTokenFn; // Function that returns current auth token

  /**
   * @param {string} url - WebSocket URL
   * @param {Object} options
   * @param {string[]} options.protocols - Subprotocols
   * @param {number} options.maxAttempts - Max reconnection attempts (default: fib(7)=13)
   * @param {number} options.maxQueueSize - Max queued messages (default: fib(12)=144)
   * @param {number} options.heartbeatMs - Heartbeat interval (default: fib(9)*1000 = 34s)
   * @param {Function} options.authTokenFn - Async function returning current auth token
   */
  constructor(url, options = {}) {
    this.#url = url;
    this.#protocols = options.protocols || [];
    this.#ws = null;
    this.#state = WS_STATES.DISCONNECTED;
    this.#attempt = 0;
    this.#maxAttempts = options.maxAttempts || FIB[7];   // 13
    this.#messageQueue = [];
    this.#maxQueueSize = options.maxQueueSize || FIB[12]; // 144
    this.#listeners = { open: [], close: [], message: [], error: [], reconnect: [], stateChange: [] };
    this.#reconnectTimer = null;
    this.#heartbeatInterval = null;
    this.#heartbeatIntervalMs = options.heartbeatMs || FIB[9] * 1000; // 34s
    this.#lastPong = 0;
    this.#authTokenFn = options.authTokenFn || null;
    this.#metrics = {
      connectAttempts: 0,
      successfulConnections: 0,
      messagessSent: 0,
      messagesReceived: 0,
      reconnections: 0,
      queuedMessages: 0,
    };
  }

  get state() { return this.#state; }
  get metrics() { return { ...this.#metrics }; }

  #setState(newState) {
    const oldState = this.#state;
    this.#state = newState;
    this.#emit('stateChange', { from: oldState, to: newState });
  }

  // ── Event System ────────────────────────────────────────────────
  on(event, fn) {
    if (this.#listeners[event]) this.#listeners[event].push(fn);
    return this;
  }

  off(event, fn) {
    if (this.#listeners[event]) {
      this.#listeners[event] = this.#listeners[event].filter(f => f !== fn);
    }
    return this;
  }

  #emit(event, data) {
    for (const fn of (this.#listeners[event] || [])) {
      try { fn(data); } catch (listenerErr) {
        log('error', 'Listener error', { event, error: listenerErr.message });
      }
    }
  }

  // ── Connection ──────────────────────────────────────────────────
  async connect() {
    if (this.#state === WS_STATES.CONNECTED || this.#state === WS_STATES.CONNECTING) return;

    this.#setState(WS_STATES.CONNECTING);
    this.#metrics.connectAttempts++;

    try {
      // Build URL with auth token if available
      let connectUrl = this.#url;
      if (this.#authTokenFn) {
        const token = await this.#authTokenFn();
        const sep = connectUrl.includes('?') ? '&' : '?';
        connectUrl = connectUrl + sep + 'token=' + encodeURIComponent(token);
      }

      // In Node.js environment, use dynamic import for ws
      // In browser, use native WebSocket
      const WS = typeof WebSocket !== 'undefined' ? WebSocket : (await import('ws')).default;
      this.#ws = new WS(connectUrl, this.#protocols);

      this.#ws.onopen = () => {
        this.#setState(WS_STATES.CONNECTED);
        this.#attempt = 0;
        this.#metrics.successfulConnections++;
        log('info', 'WebSocket connected', { url: this.#url, attempt: this.#metrics.connectAttempts });
        this.#emit('open', { url: this.#url });
        this.#startHeartbeat();
        this.#flushQueue();
      };

      this.#ws.onclose = (event) => {
        this.#stopHeartbeat();
        log('info', 'WebSocket closed', { url: this.#url, code: event.code, reason: event.reason });
        this.#emit('close', { code: event.code, reason: event.reason });

        // Don't reconnect on intentional close (1000) or going away (1001)
        if (event.code === 1000 || event.code === 1001) {
          this.#setState(WS_STATES.DISCONNECTED);
        } else {
          this.#scheduleReconnect();
        }
      };

      this.#ws.onmessage = (event) => {
        this.#metrics.messagesReceived++;
        this.#lastPong = Date.now();

        // Handle pong frames
        if (event.data === '__pong__') return;

        this.#emit('message', event.data);
      };

      this.#ws.onerror = (err) => {
        log('error', 'WebSocket error', { url: this.#url, error: err.message || 'unknown' });
        this.#emit('error', err);
      };

    } catch (connectErr) {
      log('error', 'Connection failed', { url: this.#url, error: connectErr.message });
      this.#scheduleReconnect();
    }
  }

  // ── Reconnection ────────────────────────────────────────────────
  #scheduleReconnect() {
    if (this.#attempt >= this.#maxAttempts) {
      this.#setState(WS_STATES.FAILED);
      log('error', 'Max reconnection attempts exceeded', { url: this.#url, attempts: this.#attempt });
      return;
    }

    this.#setState(WS_STATES.RECONNECTING);
    const delay = phiBackoff(this.#attempt);
    this.#attempt++;
    this.#metrics.reconnections++;

    log('info', 'Scheduling reconnect', { url: this.#url, attempt: this.#attempt, delayMs: delay });
    this.#emit('reconnect', { attempt: this.#attempt, delayMs: delay });

    this.#reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  // ── Heartbeat ───────────────────────────────────────────────────
  #startHeartbeat() {
    this.#stopHeartbeat();
    this.#lastPong = Date.now();

    this.#heartbeatInterval = setInterval(() => {
      if (this.#state !== WS_STATES.CONNECTED) return;

      // Check if we've received a pong recently
      const elapsed = Date.now() - this.#lastPong;
      if (elapsed > this.#heartbeatIntervalMs * PHI) {
        // Missed heartbeat — connection likely dead
        log('warn', 'Heartbeat timeout', { url: this.#url, elapsedMs: elapsed });
        this.#ws.close(4000, 'Heartbeat timeout');
        return;
      }

      // Send ping
      try {
        this.#ws.send('__ping__');
      } catch (pingErr) {
        log('warn', 'Ping failed', { error: pingErr.message });
      }
    }, this.#heartbeatIntervalMs);
  }

  #stopHeartbeat() {
    if (this.#heartbeatInterval) {
      clearInterval(this.#heartbeatInterval);
      this.#heartbeatInterval = null;
    }
  }

  // ── Message Queue ───────────────────────────────────────────────
  send(data) {
    if (this.#state === WS_STATES.CONNECTED && this.#ws) {
      try {
        this.#ws.send(typeof data === 'string' ? data : JSON.stringify(data));
        this.#metrics.messagessSent++;
        return true;
      } catch (sendErr) {
        log('warn', 'Send failed, queuing', { error: sendErr.message });
      }
    }

    // Queue the message for when connection is restored
    if (this.#messageQueue.length < this.#maxQueueSize) {
      this.#messageQueue.push(typeof data === 'string' ? data : JSON.stringify(data));
      this.#metrics.queuedMessages++;
      return false;
    }

    log('warn', 'Message queue full, dropping message', { queueSize: this.#messageQueue.length });
    return false;
  }

  #flushQueue() {
    while (this.#messageQueue.length > 0 && this.#state === WS_STATES.CONNECTED) {
      const msg = this.#messageQueue.shift();
      try {
        this.#ws.send(msg);
        this.#metrics.messagessSent++;
      } catch (flushErr) {
        this.#messageQueue.unshift(msg); // Put it back
        break;
      }
    }
    if (this.#messageQueue.length === 0) {
      log('info', 'Message queue flushed');
    }
  }

  // ── Disconnect ──────────────────────────────────────────────────
  disconnect(code = 1000, reason = 'Client disconnect') {
    if (this.#reconnectTimer) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
    this.#stopHeartbeat();
    if (this.#ws) {
      this.#ws.close(code, reason);
      this.#ws = null;
    }
    this.#setState(WS_STATES.DISCONNECTED);
  }

  toJSON() {
    return {
      url: this.#url,
      state: this.#state,
      attempt: this.#attempt,
      maxAttempts: this.#maxAttempts,
      queueSize: this.#messageQueue.length,
      metrics: this.metrics,
    };
  }
}

export default ReconnectingWebSocket;
export { ReconnectingWebSocket, WS_STATES, phiBackoff };
