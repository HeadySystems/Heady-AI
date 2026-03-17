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
// ║  FILE: HeadyAI-IDE/src/services/CloudService.js                  ║
// ║  LAYER: frontend/src/services                                    ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const PHI = 1.618033988749895;
const WS_URL = 'wss://manager.headysystems.com/ws/ide';
const API_URL = 'https://manager.headysystems.com/api';

// Fibonacci-based reconnect delays: 1s, 1s, 2s, 3s, 5s, 8s, 13s
const RECONNECT_DELAYS = [1000, 1000, 2000, 3000, 5000, 8000, 13000];

class CloudService {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempt = 0;
    this.reconnectTimer = null;
    this.connected = false;
    this.messageQueue = [];
    this.sessionId = null;
    this.userId = null;
  }

  // WebSocket connection management
  connect(sessionId, userId) {
    this.sessionId = sessionId || crypto.randomUUID();
    this.userId = userId || 'local-user';

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(`${WS_URL}?session=${this.sessionId}&user=${this.userId}`);

      this.ws.onopen = () => {
        this.connected = true;
        this.reconnectAttempt = 0;
        this._emit('connection', { status: 'connected', sessionId: this.sessionId });
        // Flush queued messages
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          this.ws.send(JSON.stringify(msg));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this._emit(data.type, data);
          this._emit('message', data);
        } catch (e) {
          // Binary data (terminal output)
          this._emit('terminal:data', event.data);
        }
      };

      this.ws.onclose = (event) => {
        this.connected = false;
        this._emit('connection', { status: 'disconnected', code: event.code });
        if (!event.wasClean) {
          this._scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        this._emit('connection', { status: 'error', error: error.message });
      };
    } catch (err) {
      this._emit('connection', { status: 'error', error: err.message });
      this._scheduleReconnect();
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.connected = false;
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(this.sessionId, this.userId);
    }, delay);
  }

  // Event system
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  _emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try { cb(data); } catch (e) { console.error('[CloudService] Listener error:', e); }
      });
    }
  }

  // Send WebSocket message (queues if disconnected)
  send(type, payload) {
    const msg = { type, payload, timestamp: Date.now(), sessionId: this.sessionId };
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.messageQueue.push(msg);
    }
  }

  // Terminal operations
  sendTerminalInput(data) {
    this.send('terminal:input', { data });
  }

  resizeTerminal(cols, rows) {
    this.send('terminal:resize', { cols, rows });
  }

  createTerminalSession(shellType = 'bash') {
    this.send('terminal:create', { shell: shellType });
  }

  // AI operations
  async aiChat(message, context = {}) {
    return this._apiPost('/ai/chat', { message, context, model: context.model || 'heady-brain' });
  }

  async aiComplete(code, position, language) {
    return this._apiPost('/ai/complete', { code, position, language });
  }

  async aiExplain(code, language) {
    return this._apiPost('/ai/explain', { code, language });
  }

  async aiRefactor(code, instruction, language) {
    return this._apiPost('/ai/refactor', { code, instruction, language });
  }

  async aiDetectBugs(code, language) {
    return this._apiPost('/ai/detect-bugs', { code, language });
  }

  async aiGenerateTests(code, language, framework) {
    return this._apiPost('/ai/generate-tests', { code, language, framework });
  }

  // Collaboration (CRDT)
  joinDocument(documentId) {
    this.send('collab:join', { documentId });
  }

  leaveDocument(documentId) {
    this.send('collab:leave', { documentId });
  }

  sendCRDTOperation(documentId, operation) {
    this.send('collab:operation', { documentId, operation });
  }

  sendCursorPosition(documentId, position) {
    this.send('collab:cursor', { documentId, position });
  }

  // File operations (REST API)
  async listFiles(path = '/') {
    return this._apiGet(`/files/list?path=${encodeURIComponent(path)}`);
  }

  async readFile(path) {
    return this._apiGet(`/files/read?path=${encodeURIComponent(path)}`);
  }

  async writeFile(path, content) {
    return this._apiPost('/files/write', { path, content });
  }

  async createFile(path, content = '') {
    return this._apiPost('/files/create', { path, content });
  }

  async deleteFile(path) {
    return this._apiPost('/files/delete', { path });
  }

  async renameFile(oldPath, newPath) {
    return this._apiPost('/files/rename', { oldPath, newPath });
  }

  async searchFiles(query, path = '/') {
    return this._apiGet(`/files/search?query=${encodeURIComponent(query)}&path=${encodeURIComponent(path)}`);
  }

  // Git operations (REST API)
  async gitStatus() {
    return this._apiGet('/git/status');
  }

  async gitDiff(file) {
    return this._apiGet(`/git/diff${file ? '?file=' + encodeURIComponent(file) : ''}`);
  }

  async gitCommit(message, files = []) {
    return this._apiPost('/git/commit', { message, files });
  }

  async gitBranches() {
    return this._apiGet('/git/branches');
  }

  async gitCheckout(branch) {
    return this._apiPost('/git/checkout', { branch });
  }

  async gitLog(limit = 50) {
    return this._apiGet(`/git/log?limit=${limit}`);
  }

  async gitStage(files) {
    return this._apiPost('/git/stage', { files });
  }

  async gitUnstage(files) {
    return this._apiPost('/git/unstage', { files });
  }

  async gitPull() {
    return this._apiPost('/git/pull', {});
  }

  async gitPush() {
    return this._apiPost('/git/push', {});
  }

  // Extensions (REST API)
  async listExtensions() {
    return this._apiGet('/extensions/list');
  }

  async searchExtensions(query) {
    return this._apiGet(`/extensions/search?query=${encodeURIComponent(query)}`);
  }

  async installExtension(extensionId) {
    return this._apiPost('/extensions/install', { extensionId });
  }

  async uninstallExtension(extensionId) {
    return this._apiPost('/extensions/uninstall', { extensionId });
  }

  // Settings
  async getSettings() {
    return this._apiGet('/settings');
  }

  async updateSettings(settings) {
    return this._apiPost('/settings', settings);
  }

  // HTTP helpers
  async _apiGet(path) {
    try {
      const response = await fetch(`${API_URL}${path}`, {
        headers: {
          'Authorization': `Bearer ${this.sessionId}`,
          'X-Heady-Session': this.sessionId,
        },
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`[CloudService] GET ${path} error:`, error);
      throw error;
    }
  }

  async _apiPost(path, body) {
    try {
      const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.sessionId}`,
          'X-Heady-Session': this.sessionId,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`[CloudService] POST ${path} error:`, error);
      throw error;
    }
  }

  get isConnected() {
    return this.connected;
  }
}

// Singleton
const cloudService = new CloudService();
export default cloudService;
export { CloudService, API_URL, WS_URL, PHI };
