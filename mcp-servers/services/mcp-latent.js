/**
 * Heady MCP — Latent Space Service 
 * Handles: latentRecord, latentSearch, latentStatus, latentLog
 */

const path = require('path');
const HEADY_ROOT = path.resolve(__dirname, '..', '..');

class McpLatent {
  constructor() { this._latent = null; }

  _getLS() {
    if (!this._latent) {
      try { this._latent = require(path.join(HEADY_ROOT, 'src', 'hc_latent_space.js')); }
      catch (e) { throw new Error(`Latent space module not found: ${e.message}`); }
    }
    return this._latent;
  }

  async record(category, text, meta) {
    const ls = this._getLS();
    const result = ls.record(category, text, meta || {});
    return { content: [{ type: 'text', text: `Recorded: ${result.id}\nCategory: ${category}\nTotal vectors: ${result.totalVectors}` }] };
  }

  async search(query, topK, category) {
    const ls = this._getLS();
    const results = ls.search(query, topK || 10, category || null);
    const lines = results.results.map((r, i) =>
      `${i + 1}. [${r.score.toFixed(3)}] (${r.category}) ${r.text.substring(0, 120)}`
    );
    return { content: [{ type: 'text', text: `# Latent Search: "${query}"\n\n${lines.join('\n')}\n\nHot results: ${results.hotResults} | Total vectors: ${results.totalVectors}` }] };
  }

  async status() {
    const ls = this._getLS();
    return { content: [{ type: 'text', text: `# Latent Space Status\n\n${JSON.stringify(ls.getStatus(), null, 2)}` }] };
  }

  async log(category, limit) {
    const ls = this._getLS();
    const entries = ls.getOperationLog(category || null, limit || 20);
    const lines = entries.map(e => `[${e.timestamp}] (${e.category}) ${e.text.substring(0, 100)}`);
    return { content: [{ type: 'text', text: `# Operations Log (${entries.length})\n\n${lines.join('\n')}` }] };
  }
}

module.exports = McpLatent;
