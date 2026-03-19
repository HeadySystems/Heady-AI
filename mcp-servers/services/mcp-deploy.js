/**
 * Heady MCP — Deploy Service
 * Handles: deployStatus, deployRun, deployStart, deployStop
 */

const path = require('path');
const HEADY_ROOT = path.resolve(__dirname, '..', '..');

class McpDeploy {
  constructor() {
    this._autoDeploy = null;
  }

  _getAutoDeploy() {
    if (!this._autoDeploy) {
      try {
        this._autoDeploy = require(path.join(HEADY_ROOT, 'src', 'hc_auto_deploy.js'));
      } catch (e) {
        throw new Error(`Auto-deploy module not found: ${e.message}`);
      }
    }
    return this._autoDeploy;
  }

  async deployStatus() {
    const ad = this._getAutoDeploy();
    const status = ad.getStatus();
    return { content: [{ type: 'text', text: `# Auto-Deploy Status\n\n${JSON.stringify(status, null, 2)}` }] };
  }

  async deployRun(message, force) {
    const ad = this._getAutoDeploy();
    const result = await ad.runOnce({ message, force });
    return { content: [{ type: 'text', text: `# Deploy Cycle Result\n\n${JSON.stringify(result, null, 2)}` }] };
  }

  async deployStart() {
    const ad = this._getAutoDeploy();
    ad.start();
    return { content: [{ type: 'text', text: 'Auto-deploy scheduler started. It will run on the configured interval.' }] };
  }

  async deployStop() {
    const ad = this._getAutoDeploy();
    ad.stop();
    return { content: [{ type: 'text', text: 'Auto-deploy scheduler stopped.' }] };
  }
}

module.exports = McpDeploy;
