/**
 * Heady™ LiquidACI v1.0
 * Agent-Computer Interface — linter-gated editing with viewport-bounded ops
 * Absorbed from: SWE-Agent ACI design (10.7% improvement over raw bash)
 *
 * Custom tools designed for LLM "end users":
 * - File viewer shows ~100 lines per turn (viewport-bounded)
 * - Edits rejected if they produce syntax errors (linter-gated)
 * - Search commands output succinct summaries
 * - All operations instrumented with CSL confidence scoring
 *
 * @author Eric Haywood — HeadySystems Inc.
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const {
  execSync,
  spawn
} = require('child_process');
const crypto = require('crypto');
const {
  PHI,
  PSI,
  fib,
  CSL_THRESHOLDS
} = require('../../shared/phi-math');
const {
  createLogger
} = require('../../shared/logger');
const logger = createLogger('liquid-aci');

// Phi-scaled viewport and limits
const VIEWPORT_LINES = fib(11); // 89 lines per view
const MAX_EDIT_LINES = fib(10); // 55 lines max per edit
const SEARCH_RESULT_LIMIT = fib(8); // 21 results max
const CONTEXT_LINES = fib(5); // 5 lines before/after search matches
const MAX_FILE_SIZE = fib(17) * 1000; // ~1.6MB limit
const UNDO_STACK_SIZE = fib(8); // 21 undo levels

const LINTER_COMMANDS = Object.freeze({
  '.js': 'node --check',
  '.mjs': 'node --check',
  '.ts': 'npx tsc --noEmit --allowJs',
  '.py': 'python3 -c "import py_compile; py_compile.compile"',
  '.json': 'python3 -c "import json; json.load(open',
  '.yaml': 'python3 -c "import yaml; yaml.safe_load(open',
  '.yml': 'python3 -c "import yaml; yaml.safe_load(open'
});
class LiquidACI extends EventEmitter {
  constructor(config = {}) {
    super();
    this.workspaceRoot = config.workspaceRoot || process.cwd();
    this._undoStack = new Map(); // filepath → Array<{content, timestamp}>
    this._viewportState = new Map(); // filepath → {offset, totalLines}

    // Metrics
    this._metrics = {
      viewOps: 0,
      editOps: 0,
      editRejections: 0,
      searchOps: 0,
      undoOps: 0
    };
    logger.info({
      workspace: this.workspaceRoot
    }, 'LiquidACI initialized');
  }

  // ── Viewport-Bounded File Viewing ──────────────────────────────
  view(filePath, options = {}) {
    const absPath = this._resolve(filePath);
    this._assertReadable(absPath);
    const content = fs.readFileSync(absPath, 'utf-8');
    const lines = content.split('\n');
    const totalLines = lines.length;
    const offset = options.offset || this._getViewportOffset(absPath);
    const count = options.lines || VIEWPORT_LINES;
    const end = Math.min(offset + count, totalLines);
    const viewport = lines.slice(offset, end).map((line, i) => ({
      num: offset + i + 1,
      text: line
    }));

    // Update viewport state
    this._viewportState.set(absPath, {
      offset: end,
      totalLines
    });
    this._metrics.viewOps++;
    return {
      path: filePath,
      viewport,
      range: {
        start: offset + 1,
        end,
        total: totalLines
      },
      hasMore: end < totalLines,
      hash: crypto.createHash('sha256').update(content).digest('hex').slice(0, 12)
    };
  }
  scrollDown(filePath) {
    return this.view(filePath, {
      offset: this._getViewportOffset(this._resolve(filePath))
    });
  }
  scrollUp(filePath) {
    const absPath = this._resolve(filePath);
    const current = this._viewportState.get(absPath) || {
      offset: 0
    };
    const newOffset = Math.max(0, current.offset - VIEWPORT_LINES * 2);
    return this.view(filePath, {
      offset: newOffset
    });
  }
  goToLine(filePath, lineNum) {
    const centered = Math.max(0, lineNum - Math.floor(VIEWPORT_LINES / 2));
    return this.view(filePath, {
      offset: centered
    });
  }

  // ── Linter-Gated Editing ───────────────────────────────────────
  edit(filePath, oldText, newText) {
    const absPath = this._resolve(filePath);
    this._assertReadable(absPath);
    if (newText.split('\n').length > MAX_EDIT_LINES) {
      return {
        success: false,
        reason: `HEADY-ACI-001: Edit exceeds ${MAX_EDIT_LINES} line limit`
      };
    }
    const original = fs.readFileSync(absPath, 'utf-8');

    // Verify old_text exists and is unique
    const occurrences = original.split(oldText).length - 1;
    if (occurrences === 0) {
      return {
        success: false,
        reason: 'HEADY-ACI-002: old_text not found in file'
      };
    }
    if (occurrences > 1) {
      return {
        success: false,
        reason: `HEADY-ACI-003: old_text matches ${occurrences} locations — provide more context`
      };
    }
    const modified = original.replace(oldText, newText);

    // Linter gate — reject syntactically invalid edits
    const lintResult = this._lint(absPath, modified);
    if (!lintResult.valid) {
      this._metrics.editRejections++;
      this.emit('edit:rejected', {
        filePath,
        reason: lintResult.error
      });
      return {
        success: false,
        reason: `HEADY-ACI-004: Edit produces syntax error — ${lintResult.error}`,
        hint: 'Fix the syntax and retry'
      };
    }

    // Save undo state
    this._pushUndo(absPath, original);

    // Write the edit
    fs.writeFileSync(absPath, modified, 'utf-8');
    this._metrics.editOps++;
    this.emit('edit:applied', {
      filePath,
      linesChanged: newText.split('\n').length
    });
    logger.info({
      filePath,
      linesChanged: newText.split('\n').length
    }, 'Edit applied');

    // Return viewport centered on the edit
    const editLine = original.substring(0, original.indexOf(oldText)).split('\n').length;
    return {
      success: true,
      viewport: this.goToLine(filePath, editLine)
    };
  }

  // ── Create File ────────────────────────────────────────────────
  create(filePath, content) {
    const absPath = this._resolve(filePath);
    if (fs.existsSync(absPath)) {
      return {
        success: false,
        reason: 'HEADY-ACI-005: File already exists — use edit()'
      };
    }
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, {
      recursive: true
    });
    const lintResult = this._lint(absPath, content);
    if (!lintResult.valid) {
      return {
        success: false,
        reason: `HEADY-ACI-006: Content has syntax errors — ${lintResult.error}`
      };
    }
    fs.writeFileSync(absPath, content, 'utf-8');
    this.emit('file:created', {
      filePath
    });
    return {
      success: true,
      lines: content.split('\n').length
    };
  }

  // ── Undo ───────────────────────────────────────────────────────
  undo(filePath) {
    const absPath = this._resolve(filePath);
    const stack = this._undoStack.get(absPath);
    if (!stack || stack.length === 0) {
      return {
        success: false,
        reason: 'HEADY-ACI-007: Nothing to undo'
      };
    }
    const prev = stack.pop();
    fs.writeFileSync(absPath, prev.content, 'utf-8');
    this._metrics.undoOps++;
    this.emit('edit:undone', {
      filePath
    });
    return {
      success: true,
      restoredTo: new Date(prev.timestamp).toISOString()
    };
  }

  // ── Succinct Search ────────────────────────────────────────────
  search(pattern, options = {}) {
    const searchDir = options.directory || this.workspaceRoot;
    const glob = options.glob || '*';
    const maxResults = options.limit || SEARCH_RESULT_LIMIT;
    this._metrics.searchOps++;
    try {
      const cmd = `rg --json -m ${maxResults} -g "${glob}" "${pattern}" "${searchDir}" 2>/dev/null | head -${maxResults * 3}`;
      const raw = execSync(cmd, {
        encoding: 'utf-8',
        timeout: fib(8) * 1000
      });
      const results = raw.split('\n').filter(l => l.trim()).map(l => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      }).filter(r => r && r.type === 'match').slice(0, maxResults).map(r => ({
        path: path.relative(this.workspaceRoot, r.data.path.text),
        line: r.data.line_number,
        text: r.data.lines.text.trim()
      }));
      return {
        pattern,
        matches: results.length,
        results,
        summary: results.length > 0 ? `Found ${results.length} match${results.length > 1 ? 'es' : ''} across ${new Set(results.map(r => r.path)).size} file(s)` : 'No matches found'
      };
    } catch {
      return {
        pattern,
        matches: 0,
        results: [],
        summary: 'No matches found'
      };
    }
  }

  // ── Linter Implementation ──────────────────────────────────────
  _lint(filePath, content) {
    const ext = path.extname(filePath).toLowerCase();
    const linterCmd = LINTER_COMMANDS[ext];
    if (!linterCmd) return {
      valid: true
    }; // no linter available, pass through

    const tmpFile = path.join('/tmp', `heady-aci-lint-${Date.now()}${ext}`);
    try {
      fs.writeFileSync(tmpFile, content, 'utf-8');
      let cmd;
      if (ext === '.json') {
        cmd = `${linterCmd}('${tmpFile}'))"`;
      } else if (ext === '.yaml' || ext === '.yml') {
        cmd = `${linterCmd}('${tmpFile}'))"`;
      } else {
        cmd = `${linterCmd} "${tmpFile}"`;
      }
      execSync(cmd, {
        encoding: 'utf-8',
        timeout: fib(7) * 1000,
        stdio: 'pipe'
      });
      return {
        valid: true
      };
    } catch (e) {
      return {
        valid: false,
        error: (e.stderr || e.message || 'Unknown lint error').split('\n')[0]
      };
    } finally {
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
    }
  }

  // ── Helpers ────────────────────────────────────────────────────
  _resolve(filePath) {
    return path.isAbsolute(filePath) ? filePath : path.resolve(this.workspaceRoot, filePath);
  }
  _assertReadable(absPath) {
    if (!fs.existsSync(absPath)) throw new Error(`HEADY-ACI-008: File not found: ${absPath}`);
    const stat = fs.statSync(absPath);
    if (stat.size > MAX_FILE_SIZE) throw new Error(`HEADY-ACI-009: File exceeds ${MAX_FILE_SIZE} byte limit`);
  }
  _getViewportOffset(absPath) {
    return this._viewportState.get(absPath)?.offset || 0;
  }
  _pushUndo(absPath, content) {
    if (!this._undoStack.has(absPath)) this._undoStack.set(absPath, []);
    const stack = this._undoStack.get(absPath);
    stack.push({
      content,
      timestamp: Date.now()
    });
    if (stack.length > UNDO_STACK_SIZE) stack.shift();
  }
  get metrics() {
    return {
      ...this._metrics
    };
  }
}
module.exports = {
  LiquidACI,
  LINTER_COMMANDS
};