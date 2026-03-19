/**
 * Heady MCP — Git Service
 * Handles: gitLog, gitDiff, gitStatus, conflictsScan, conflictsShow, conflictsResolve
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HEADY_ROOT = path.resolve(__dirname, '..', '..');

class McpGit {
  _exec(cmd) {
    return execSync(cmd, { cwd: HEADY_ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024 }).trim();
  }

  safePath(filepath) {
    const resolved = path.resolve(HEADY_ROOT, filepath);
    if (!resolved.startsWith(HEADY_ROOT)) throw new Error('Access denied');
    return resolved;
  }

  async gitLog(limit) {
    const n = Math.min(limit || 15, 50);
    const log = this._exec(`git log -n ${n} --oneline --no-decorate`);
    const branch = this._exec('git branch --show-current');
    return { content: [{ type: 'text', text: `# Git Log (branch: ${branch})\n\n${log}` }] };
  }

  async gitDiff(target, filepath) {
    const ref = target || 'HEAD';
    const fileArg = filepath ? ` -- ${filepath}` : '';
    const diff = this._exec(`git diff ${ref}${fileArg}`);
    return { content: [{ type: 'text', text: diff || 'No changes.' }] };
  }

  async gitStatus() {
    const status = this._exec('git status --short');
    const branch = this._exec('git branch --show-current');
    return { content: [{ type: 'text', text: `# Git Status (${branch})\n\n${status || 'Clean working tree.'}` }] };
  }

  async conflictsScan() {
    const results = [];
    const scanDir = (dir, depth = 0) => {
      if (depth > 4) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'data') continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) { scanDir(fullPath, depth + 1); continue; }
          if (!entry.isFile() || !/\.(js|yaml|yml|json|py|md|ps1)$/.test(entry.name)) continue;
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const conflicts = (content.match(/^<<<<<<<.*/gm) || []).length;
            if (conflicts > 0) results.push({ file: path.relative(HEADY_ROOT, fullPath), conflicts });
          } catch (e) { /* skip */ }
        }
      } catch (e) { /* skip */ }
    };
    scanDir(HEADY_ROOT);
    const total = results.reduce((s, r) => s + r.conflicts, 0);
    const lines = results.map(r => `• ${r.file}: ${r.conflicts} conflict(s)`);
    return { content: [{ type: 'text', text: results.length > 0
      ? `# Merge Conflicts Found: ${total} across ${results.length} files\n\n${lines.join('\n')}`
      : '✅ No merge conflicts found!' }] };
  }

  async conflictsShow(filepath) {
    const safePath = this.safePath(filepath);
    const content = fs.readFileSync(safePath, 'utf8');
    const conflicts = [];
    const regex = /^<<<<<<< (.*)$\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> (.*)$/gm;
    let match;
    while ((match = regex.exec(content)) !== null) {
      conflicts.push({
        oursLabel: match[1].trim(),
        ours: match[2].trim().substring(0, 500),
        theirs: match[3].trim().substring(0, 500),
        theirsLabel: match[4].trim()
      });
    }
    if (!conflicts.length) return { content: [{ type: 'text', text: `No conflicts in ${filepath}` }] };
    const report = conflicts.map((c, i) =>
      `## Conflict ${i + 1}\n**Ours (${c.oursLabel}):**\n\`\`\`\n${c.ours}\n\`\`\`\n**Theirs (${c.theirsLabel}):**\n\`\`\`\n${c.theirs}\n\`\`\``
    ).join('\n\n');
    return { content: [{ type: 'text', text: `# ${filepath} — ${conflicts.length} conflict(s)\n\n${report}` }] };
  }

  async conflictsResolve(filepath, strategy) {
    const safePath = this.safePath(filepath);
    let content = fs.readFileSync(safePath, 'utf8');
    const regex = /^<<<<<<< .*$\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> .*$/gm;
    let resolved = 0;
    content = content.replace(regex, (_, ours, theirs) => {
      resolved++;
      if (strategy === 'ours') return ours;
      if (strategy === 'theirs') return theirs;
      return ours + theirs;
    });
    fs.writeFileSync(safePath, content, 'utf8');
    return { content: [{ type: 'text', text: `✅ Resolved ${resolved} conflict(s) in ${filepath} using strategy: ${strategy}` }] };
  }
}

module.exports = McpGit;
