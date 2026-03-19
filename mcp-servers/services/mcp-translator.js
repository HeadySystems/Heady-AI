/**
 * Heady MCP — Translator Service
 * Handles: translatorStatus, translatorTranslate, translatorAdapters, translatorDecode, translatorBridge
 */

const path = require('path');
const HEADY_ROOT = path.resolve(__dirname, '..', '..');

class McpTranslator {
  constructor() {
    this._translator = null;
  }

  _getTranslator() {
    if (!this._translator) {
      try {
        this._translator = require(path.join(HEADY_ROOT, 'src', 'hc_translator.js'));
      } catch (e) {
        throw new Error(`Translator module not found: ${e.message}`);
      }
    }
    return this._translator;
  }

  async status() {
    const t = this._getTranslator();
    const status = t.getStatus();
    return { content: [{ type: 'text', text: `# HeadyTranslator Status\n\n${JSON.stringify(status, null, 2)}` }] };
  }

  async translate(args) {
    const t = this._getTranslator();
    const result = await t.translate({
      source: { protocol: args.sourceProtocol, endpoint: args.sourceEndpoint || 'mcp-tool' },
      target: { protocol: args.targetProtocol, endpoint: args.targetEndpoint || '' },
      operation: args.operation,
      payload: args.payload || {}
    });
    return { content: [{ type: 'text', text: `# Translation Result\n\n${JSON.stringify(result, null, 2)}` }] };
  }

  async adapters() {
    const t = this._getTranslator();
    const adapters = t.translator.listAdapters();
    const lines = Object.entries(adapters).map(([name, info]) =>
      `• ${name}: ${info.description} (send: ${info.hasSend ? 'yes' : 'no'})`
    );
    return { content: [{ type: 'text', text: `# Protocol Adapters (${lines.length})\n\n${lines.join('\n')}` }] };
  }

  async decode(protocol, data) {
    const t = this._getTranslator();
    const message = t.decode(protocol, data);
    return { content: [{ type: 'text', text: `# Decoded Message\n\nProtocol: ${protocol}\n\n${JSON.stringify(message, null, 2)}` }] };
  }

  async bridge(action, port) {
    const t = this._getTranslator();
    if (action === 'start') {
      t.translator.createHttpBridge(port || 3301);
      return { content: [{ type: 'text', text: `HTTP bridge started on port ${port || 3301}` }] };
    } else {
      t.translator.shutdown();
      return { content: [{ type: 'text', text: 'Translator bridge stopped' }] };
    }
  }
}

module.exports = McpTranslator;
