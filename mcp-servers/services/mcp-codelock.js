/**
 * Heady MCP — CodeLock Service
 * Handles: codelockStatus, codelockLock/Unlock, codelockRequest/Approve/Deny,
 *          codelockSnapshot, codelockDetect, codelockAudit, codelockUsers
 */

const path = require('path');
const HEADY_ROOT = path.resolve(__dirname, '..', '..');

class McpCodeLock {
  constructor() { this._codelock = null; }

  _getCL() {
    if (!this._codelock) {
      try { this._codelock = require(path.join(HEADY_ROOT, 'src', 'hc_codelock.js')); }
      catch (e) { throw new Error(`CodeLock module not found: ${e.message}`); }
    }
    return this._codelock;
  }

  async status() {
    const cl = this._getCL();
    const s = cl.getStatus();
    const icon = s.locked ? '🔒' : '🔓';
    const lines = [
      `# ${icon} CodeLock Status`, '',
      `**State:** ${s.locked ? 'LOCKED' : 'UNLOCKED'}`,
      `**Level:** ${s.lockLevel}`,
      `**Owner:** ${s.owner}`,
      `**Allowed Users:** ${s.allowedUsers.join(', ')}`,
      `**Locked By:** ${s.lockedBy} at ${s.lockedAt}`,
      `**Reason:** ${s.reason}`, '',
      `## Queue`,
      `Pending: ${s.queue.pending} | Approved: ${s.queue.approved} | Denied: ${s.queue.denied}`, '',
      s.pendingChanges.length > 0 ? `## Pending Approvals\n${s.pendingChanges.map(c =>
        `• **${c.id}** — ${c.description} (${c.files} files, by ${c.requestedBy})`
      ).join('\n')}` : 'No pending approvals.', '',
      `## File Integrity`, s.fileIntegrity, '',
      `## Protected Paths`, s.protectedPaths.map(p => `• ${p}`).join('\n'), '',
      `Audit entries: ${s.auditEntries}`
    ];
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }

  async lock(reason) {
    const result = this._getCL().lock('erich', reason || 'Manual lock via MCP');
    return { content: [{ type: 'text', text: `🔒 Codebase LOCKED\n\n${JSON.stringify(result, null, 2)}` }] };
  }

  async unlock(reason) {
    const result = this._getCL().unlock('erich', reason || 'Manual unlock via MCP');
    return { content: [{ type: 'text', text: `🔓 Codebase UNLOCKED\n\n${JSON.stringify(result, null, 2)}` }] };
  }

  async request(id, files, description) {
    const result = this._getCL().requestChange(id, files, description, 'claude-agent');
    return { content: [{ type: 'text', text: `# Change Request: ${id}\n\n${JSON.stringify(result, null, 2)}` }] };
  }

  async approve(changeId) {
    const result = changeId === 'all'
      ? this._getCL().approveAll('erich')
      : this._getCL().approveChange(changeId, 'erich');
    return { content: [{ type: 'text', text: `✅ Approved: ${changeId}\n\n${JSON.stringify(result, null, 2)}` }] };
  }

  async deny(changeId, reason) {
    const result = this._getCL().denyChange(changeId, 'erich', reason || 'Denied via MCP');
    return { content: [{ type: 'text', text: `❌ Denied: ${changeId}\n\n${JSON.stringify(result, null, 2)}` }] };
  }

  async snapshot() {
    const result = this._getCL().snapshotHashes();
    return { content: [{ type: 'text', text: `📸 Snapshot taken\n\n${JSON.stringify(result, null, 2)}` }] };
  }

  async detect() {
    const result = this._getCL().detectChanges();
    if (!result.success) return { content: [{ type: 'text', text: `⚠️ ${result.error}` }] };
    const lines = [
      `# Change Detection`,
      `Baseline: ${result.baseline}`,
      `Changes found: ${result.hasChanges ? 'YES' : 'NONE'}`, '',
      `Modified: ${result.summary.modified}`,
      `Added: ${result.summary.added}`,
      `Deleted: ${result.summary.deleted}`
    ];
    if (result.changes.modified.length) lines.push('\n## Modified\n' + result.changes.modified.map(f => `• ${f}`).join('\n'));
    if (result.changes.added.length) lines.push('\n## Added\n' + result.changes.added.map(f => `• ${f}`).join('\n'));
    if (result.changes.deleted.length) lines.push('\n## Deleted\n' + result.changes.deleted.map(f => `• ${f}`).join('\n'));
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }

  async audit(limit) {
    const entries = this._getCL().getAuditLog(limit || 30);
    const lines = entries.map(e => `[${e.timestamp}] ${e.action}: ${JSON.stringify(e.details)}`);
    return { content: [{ type: 'text', text: `# Audit Log (${entries.length} entries)\n\n${lines.join('\n')}` }] };
  }

  async users(action, username) {
    const cl = this._getCL();
    const result = action === 'add'
      ? cl.addAllowedUser(username, 'erich')
      : cl.removeAllowedUser(username, 'erich');
    return { content: [{ type: 'text', text: `# User ${action}: ${username}\n\n${JSON.stringify(result, null, 2)}` }] };
  }
}

module.exports = McpCodeLock;
