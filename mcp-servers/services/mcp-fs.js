/**
 * Heady MCP — File System Service
 * Handles: readConfig, listConfigs, projectTree, readFile, searchFiles, writeFile
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const HEADY_ROOT = path.resolve(__dirname, '..');
const CONFIGS_DIR = path.join(HEADY_ROOT, 'configs');

class McpFileSystem {
  safePath(filepath) {
    const resolved = path.resolve(HEADY_ROOT, filepath);
    if (!resolved.startsWith(HEADY_ROOT)) throw new Error('Access denied: path outside Heady root');
    return resolved;
  }

  async readConfig(filename) {
    const safeName = path.basename(filename);
    const filePath = path.join(CONFIGS_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Config file not found: ${safeName}. Use heady_list_configs to see available files.`);
    }

    const content = fs.readFileSync(filePath, 'utf8');

    try {
      if (safeName.endsWith('.yaml') || safeName.endsWith('.yml')) {
        yaml.load(content);
      } else if (safeName.endsWith('.json')) {
        JSON.parse(content);
      }
    } catch (e) {
      return { content: [{ type: 'text', text: `⚠ Parse error in ${safeName}: ${e.message}\n\nRaw content:\n${content}` }] };
    }

    return { content: [{ type: 'text', text: `# ${safeName}\n\n${content}` }] };
  }

  async listConfigs() {
    if (!fs.existsSync(CONFIGS_DIR)) throw new Error('configs/ directory not found');

    const files = fs.readdirSync(CONFIGS_DIR, { withFileTypes: true });
    const configs = files
      .filter(f => f.isFile() && (f.name.endsWith('.yaml') || f.name.endsWith('.yml') || f.name.endsWith('.json')))
      .map(f => {
        const stats = fs.statSync(path.join(CONFIGS_DIR, f.name));
        return `  ${f.name} (${(stats.size / 1024).toFixed(1)}KB)`;
      });

    const dirs = files.filter(f => f.isDirectory()).map(f => `  ${f.name}/`);

    const output = [
      `# Heady Configs (${configs.length} files)`,
      '',
      ...configs,
      dirs.length > 0 ? `\n## Subdirectories\n${dirs.join('\n')}` : ''
    ].join('\n');

    return { content: [{ type: 'text', text: output }] };
  }

  async projectTree(subdir) {
    const targetDir = subdir ? path.join(HEADY_ROOT, subdir) : HEADY_ROOT;
    if (!fs.existsSync(targetDir)) throw new Error(`Directory not found: ${subdir || 'root'}`);

    const resolved = path.resolve(targetDir);
    if (!resolved.startsWith(HEADY_ROOT)) throw new Error('Access denied: path outside Heady root');

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => `📁 ${e.name}/`);
    const fileList = entries.filter(e => e.isFile() && !e.name.startsWith('.')).map(e => {
      const stats = fs.statSync(path.join(targetDir, e.name));
      const size = stats.size > 1024 * 1024
        ? `${(stats.size / 1024 / 1024).toFixed(1)}MB`
        : `${(stats.size / 1024).toFixed(1)}KB`;
      return `📄 ${e.name} (${size})`;
    });

    return { content: [{ type: 'text', text: `# ${subdir || 'Heady Root'}\n\n${dirs.join('\n')}\n\n${fileList.join('\n')}` }] };
  }

  async readFile(filepath, maxLines = 200) {
    const safePath = this.safePath(filepath);
    if (!fs.existsSync(safePath)) throw new Error(`File not found: ${filepath}`);

    const content = fs.readFileSync(safePath, 'utf8');
    const lines = content.split('\n');
    const truncated = lines.length > maxLines;
    const output = lines.slice(0, maxLines).join('\n');

    return {
      content: [{
        type: 'text',
        text: truncated
          ? `# ${filepath} (showing ${maxLines}/${lines.length} lines)\n\n${output}\n\n... (truncated)`
          : `# ${filepath}\n\n${output}`
      }]
    };
  }

  async searchFiles(pattern, fileTypes) {
    const extensions = (fileTypes || 'js,yaml,json,md').split(',').map(e => `.${e.trim()}`);
    const results = [];
    const maxResults = 30;

    const searchDir = (dir, depth = 0) => {
      if (depth > 4 || results.length >= maxResults) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= maxResults) break;
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'venv' || entry.name === '.venv') continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            searchDir(fullPath, depth + 1);
          } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              const lines = content.split('\n');
              const regex = new RegExp(pattern, 'gi');
              const matches = [];
              lines.forEach((line, i) => {
                if (regex.test(line)) matches.push(`  L${i + 1}: ${line.trim().substring(0, 120)}`);
                regex.lastIndex = 0;
              });
              if (matches.length > 0) {
                const relPath = path.relative(HEADY_ROOT, fullPath);
                results.push(`📄 ${relPath} (${matches.length} matches)\n${matches.slice(0, 5).join('\n')}`);
              }
            } catch (e) { /* skip unreadable files */ }
          }
        }
      } catch (e) { /* skip inaccessible dirs */ }
    };

    searchDir(HEADY_ROOT);

    return {
      content: [{
        type: 'text',
        text: results.length > 0
          ? `# Search: "${pattern}" (${results.length} files matched)\n\n${results.join('\n\n')}`
          : `No matches found for "${pattern}"`
      }]
    };
  }

  async writeFile(filepath, content, changeId) {
    const safePath = this.safePath(filepath);
    const dir = path.dirname(safePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(safePath, content, 'utf8');
    return { content: [{ type: 'text', text: `✅ Written: ${filepath} (${content.length} bytes)` }] };
  }
}

module.exports = McpFileSystem;
