// packages/heady-ui/src/ag-ui-renderer.js
// AG-UI Protocol — Event-based agent↔user interaction renderer
// ~16 event types: streaming, tool calls, shared state, generative UI
// Vanilla JS — no framework dependency

class AGUIRenderer {
  constructor({ container, accentColor = '#00d4aa' }) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.accentColor = accentColor;
    this.events = [];
    this.state = {};
    this.toolCalls = new Map();
  }

  /**
   * Connect to an SSE endpoint streaming AG-UI events.
   * @param {string} url — SSE endpoint URL
   */
  connect(url) {
    const source = new EventSource(url);
    source.addEventListener('message', (e) => {
      try {
        const event = JSON.parse(e.data);
        this.handleEvent(event);
      } catch {}
    });
    source.addEventListener('error', () => {
      setTimeout(() => this.connect(url), 2618); // φ² * 1000ms
    });
    this.source = source;
  }

  /**
   * Handle incoming AG-UI events.
   * @param {{ type: string, data: any }} event
   */
  handleEvent(event) {
    this.events.push(event);

    switch (event.type) {
      case 'TEXT_MESSAGE_START':
        this.startTextMessage(event.data);
        break;
      case 'TEXT_MESSAGE_CONTENT':
        this.appendTextContent(event.data);
        break;
      case 'TEXT_MESSAGE_END':
        this.endTextMessage(event.data);
        break;
      case 'TOOL_CALL_START':
        this.startToolCall(event.data);
        break;
      case 'TOOL_CALL_ARGS':
        this.appendToolArgs(event.data);
        break;
      case 'TOOL_CALL_END':
        this.endToolCall(event.data);
        break;
      case 'STATE_SNAPSHOT':
        this.updateState(event.data);
        break;
      case 'STATE_DELTA':
        this.applyStateDelta(event.data);
        break;
      case 'CUSTOM':
        this.handleCustomEvent(event.data);
        break;
      case 'RUN_STARTED':
        this.showRunIndicator(event.data);
        break;
      case 'RUN_FINISHED':
        this.hideRunIndicator(event.data);
        break;
      case 'RUN_ERROR':
        this.showError(event.data);
        break;
      default:
        break;
    }
  }

  startTextMessage(data) {
    const el = document.createElement('div');
    el.id = `msg-${data.messageId}`;
    el.className = 'agui-message';
    el.style.cssText = `padding:var(--space-3,1rem);margin:var(--space-2,0.618rem) 0;
      border-left:3px solid ${this.accentColor};background:var(--bg-1,#12121a);
      border-radius:var(--radius-fib-8,8px);font-family:var(--font-sans,'Inter',sans-serif);
      color:var(--text-primary,#e8e8f0);line-height:var(--line-height,1.618);
      animation:fadeIn var(--duration-base,261ms) var(--ease-golden,ease);`;
    this.container.appendChild(el);
  }

  appendTextContent(data) {
    const el = document.getElementById(`msg-${data.messageId}`);
    if (el) el.textContent += data.content;
  }

  endTextMessage() { /* finalize — could trigger markdown rendering */ }

  startToolCall(data) {
    this.toolCalls.set(data.toolCallId, { name: data.toolName, args: '' });
    const el = document.createElement('div');
    el.id = `tool-${data.toolCallId}`;
    el.className = 'agui-tool-call';
    el.style.cssText = `padding:var(--space-2,0.618rem) var(--space-3,1rem);
      margin:var(--space-1,0.382rem) 0;background:var(--bg-2,#1a1a2e);
      border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:var(--radius-fib-8,8px);
      font-family:var(--font-mono,'JetBrains Mono',monospace);font-size:var(--font-sm,0.764rem);
      color:var(--text-secondary,#9898b0);`;
    el.innerHTML = `<span style="color:${this.accentColor}">⚡ ${data.toolName}</span> `;
    this.container.appendChild(el);
  }

  appendToolArgs(data) {
    const tc = this.toolCalls.get(data.toolCallId);
    if (tc) tc.args += data.args;
  }

  endToolCall(data) {
    const el = document.getElementById(`tool-${data.toolCallId}`);
    if (el) el.innerHTML += `<span style="color:var(--teal-primary,#00d4aa)">✓</span>`;
  }

  updateState(data) {
    this.state = { ...data };
    this.container.dispatchEvent(new CustomEvent('agui-state', { detail: this.state }));
  }

  applyStateDelta(data) {
    Object.assign(this.state, data);
    this.container.dispatchEvent(new CustomEvent('agui-state', { detail: this.state }));
  }

  handleCustomEvent(data) {
    this.container.dispatchEvent(new CustomEvent('agui-custom', { detail: data }));
  }

  showRunIndicator() {
    let ind = this.container.querySelector('.agui-run-indicator');
    if (!ind) {
      ind = document.createElement('div');
      ind.className = 'agui-run-indicator';
      ind.style.cssText = `display:flex;align-items:center;gap:8px;padding:var(--space-2,0.618rem);
        color:${this.accentColor};font-size:var(--font-sm,0.764rem);opacity:0.8;`;
      ind.innerHTML = `<span class="agui-pulse">●</span> Processing...`;
      this.container.appendChild(ind);
    }
  }

  hideRunIndicator() {
    this.container.querySelector('.agui-run-indicator')?.remove();
  }

  showError(data) {
    const el = document.createElement('div');
    el.className = 'agui-error';
    el.style.cssText = `padding:var(--space-3,1rem);margin:var(--space-2,0.618rem) 0;
      border-left:3px solid #ff4444;background:rgba(255,68,68,0.1);
      border-radius:var(--radius-fib-8,8px);color:#ff6666;`;
    el.textContent = data.message || 'An error occurred';
    this.container.appendChild(el);
  }

  disconnect() {
    this.source?.close();
  }
}

// Inject minimal keyframe animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    .agui-pulse { animation: pulse 1.618s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
  `;
  document.head.appendChild(style);
}

if (typeof window !== 'undefined') window.AGUIRenderer = AGUIRenderer;
export { AGUIRenderer };
