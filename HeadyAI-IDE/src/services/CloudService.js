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
// ║  FILE: HeadyAI-IDE/src/services/CloudService.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

import headyVaultService from './HeadyVaultService';

const getWSUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `${protocol}//${window.location.hostname}:8080/ws/terminal`;
    }
  }
  return 'wss://manager.headysystems.com/ws/terminal';
};

const getAPIUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `${protocol}//${window.location.hostname}:8080`;
    }
  }
  return 'https://manager.headysystems.com/api';
};

const WS_URL = getWSUrl();
const API_URL = getAPIUrl();

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
    
    // Will be initialized via Vault
    this.sessionId = null;
    this.userId = null;
  }

  // WebSocket connection management
  connect() {
    // Rely on HeadyVault for identity
    const vaultToken = headyVaultService.getToken();
    const vaultUser = headyVaultService.getUser();
    
    this.sessionId = vaultToken || crypto.randomUUID();
    this.userId = vaultUser?.id || 'local-user';

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
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'input', data }));
    }
  }

  resizeTerminal(cols, rows) {
    this.send('terminal:resize', { cols, rows });
  }

  createTerminalSession(shellType = 'bash') {
    this.send('terminal:create', { shell: shellType });
  }

  // AI operations
  async aiChat(message, context = {}) {
    const messages = context.messages || [{ role: 'user', content: message }];
    return this._apiPost('/api/chat', {
      messages,
      provider: context.model || undefined,
      options: context.options || context
    });
  }

  async aiComplete(code, position, language) {
    return this.aiChat(`Autocomplete the following ${language} code at character position ${position}:\n\n\`\`\`${language}\n${code}\n\`\`\``);
  }

  async aiExplain(code, language) {
    return this.aiChat(`Explain the following ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``);
  }

  async aiRefactor(code, instruction, language) {
    return this.aiChat(`Refactor the following ${language} code based on these instructions: ${instruction}\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\``);
  }

  async aiDetectBugs(code, language) {
    return this.aiChat(`Detect any bugs or potential issues in this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``);
  }

  async aiGenerateTests(code, language, framework) {
    return this.aiChat(`Generate unit tests using ${framework} for this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``);
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
  async listFiles(wsName = 'default') {
    return this._apiGet(`/api/fs-tree?ws=${encodeURIComponent(wsName)}`);
  }

  async readFile(path, wsName = 'default') {
    return this._apiGetText(`/api/fs/${encodeURIComponent(path)}?ws=${encodeURIComponent(wsName)}`);
  }

  async writeFile(path, content, wsName = 'default') {
    return this._apiPut(`/api/fs/${encodeURIComponent(path)}?ws=${encodeURIComponent(wsName)}`, { content });
  }

  async createFile(path, content = '', wsName = 'default') {
    return this._apiPut(`/api/fs/${encodeURIComponent(path)}?ws=${encodeURIComponent(wsName)}`, { content });
  }

  async deleteFile(path, wsName = 'default') {
    return this._apiDelete(`/api/fs/${encodeURIComponent(path)}?ws=${encodeURIComponent(wsName)}`);
  }

  async renameFile(oldPath, newPath, wsName = 'default') {
    const content = await this.readFile(oldPath, wsName);
    await this.createFile(newPath, content, wsName);
    await this.deleteFile(oldPath, wsName);
    return { success: true };
  }

  async searchFiles(query, wsName = 'default') {
    const tree = await this.listFiles(wsName);
    const results = [];
    if (tree && tree.files) {
      for (const file of tree.files) {
        if (file.key.toLowerCase().includes(query.toLowerCase())) {
          results.push({ name: file.key.split('/').pop(), path: `/${wsName}/${file.key}`, isDirectory: false });
        }
      }
    }
    return results;
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
      const token = headyVaultService.getToken() || this.sessionId;
      const response = await fetch(`${API_URL}${path}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
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

  async _apiGetText(path) {
    try {
      const token = headyVaultService.getToken() || this.sessionId;
      const response = await fetch(`${API_URL}${path}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Heady-Session': this.sessionId,
        },
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return await response.text();
    } catch (error) {
      console.error(`[CloudService] GET TEXT ${path} error:`, error);
      throw error;
    }
  }

  async _apiPost(path, body) {
    try {
      const token = headyVaultService.getToken() || this.sessionId;
      const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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

  async _apiPut(path, body) {
    try {
      const token = headyVaultService.getToken() || this.sessionId;
      const response = await fetch(`${API_URL}${path}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Heady-Session': this.sessionId,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`[CloudService] PUT ${path} error:`, error);
      throw error;
    }
  }

  async _apiDelete(path) {
    try {
      const token = headyVaultService.getToken() || this.sessionId;
      const response = await fetch(`${API_URL}${path}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Heady-Session': this.sessionId,
        },
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`[CloudService] DELETE ${path} error:`, error);
      throw error;
    }
  }

  get isConnected() {
    return this.connected;
  }
}

const PHI = 1.618033988749895;

// Singleton
const cloudService = new CloudService();
export default cloudService;
export { CloudService, API_URL, WS_URL, PHI };
