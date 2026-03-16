/**
 * Heady™ LiquidGraphRank v1.0
 * PageRank-based repository map for intelligent code context
 * Absorbed from: Aider's tree-sitter + NetworkX approach
 *
 * Builds a symbol dependency graph from AST parsing, ranks by
 * importance using phi-weighted PageRank, and generates context-optimized
 * repository maps that fit within token budgets.
 *
 * @author Eric Haywood — HeadySystems Inc.
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');
const {
  PHI, PSI, PSI_SQ, fib,
  CSL_THRESHOLDS,
} = require('../../shared/phi-math');
const { createLogger } = require('../../shared/logger');

const logger = createLogger('liquid-graph-rank');

// Phi-scaled constants
const DAMPING_FACTOR = PSI;             // 0.618 (PageRank damping)
const MAX_ITERATIONS = fib(7);          // 13 iterations
const CONVERGENCE_THRESHOLD = 1e-8;
const MENTION_WEIGHT_BOOST = fib(6);    // 8x boost for mentioned symbols
const MAX_SYMBOLS = fib(13);            // 233 symbols max
const MAP_TOKEN_BUDGET = fib(12) * 10;  // ~1440 tokens

const PARSEABLE_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.hpp', '.rb', '.php', '.swift', '.kt',
]);

class SymbolNode {
  constructor(name, filePath, type, line) {
    this.name = name;
    this.filePath = filePath;
    this.type = type;       // 'function', 'class', 'method', 'variable', 'import'
    this.line = line;
    this.rank = 1.0;
    this.edges = new Set(); // outgoing references to other symbol names
    this.referenceCount = 0;
    this.mentionBoost = 1.0;
  }

  get id() { return `${this.filePath}:${this.name}`; }
}

class LiquidGraphRank extends EventEmitter {
  constructor(config = {}) {
    super();
    this.rootDir = config.rootDir || process.cwd();
    this._graph = new Map();       // symbolId → SymbolNode
    this._fileIndex = new Map();   // filePath → Set<symbolId>
    this._nameIndex = new Map();   // symbolName → Set<symbolId>
    this._fileHashes = new Map();  // filePath → hash (for incremental updates)

    this._metrics = {
      filesIndexed: 0,
      symbolsExtracted: 0,
      edgesResolved: 0,
      rankIterations: 0,
      lastBuildMs: 0,
    };

    logger.info({ rootDir: this.rootDir }, 'LiquidGraphRank initialized');
  }

  // ── Build Graph ────────────────────────────────────────────────
  async build(options = {}) {
    const start = Date.now();
    const files = this._discoverFiles(options.include || '**/*', options.exclude);

    for (const filePath of files) {
      await this._indexFile(filePath);
    }

    this._resolveEdges();
    this._computePageRank();

    this._metrics.lastBuildMs = Date.now() - start;
    this.emit('graph:built', this._metrics);
    logger.info(this._metrics, 'Graph built');

    return this._metrics;
  }

  // ── Incremental Update ─────────────────────────────────────────
  async update(changedFiles) {
    let reindexed = 0;
    for (const filePath of changedFiles) {
      const absPath = path.resolve(this.rootDir, filePath);
      if (!fs.existsSync(absPath)) {
        this._removeFile(absPath);
        continue;
      }

      const hash = this._hashFile(absPath);
      if (this._fileHashes.get(absPath) !== hash) {
        this._removeFile(absPath);
        await this._indexFile(absPath);
        reindexed++;
      }
    }

    if (reindexed > 0) {
      this._resolveEdges();
      this._computePageRank();
    }

    return { reindexed };
  }

  // ── Generate Repository Map ────────────────────────────────────
  generateMap(options = {}) {
    const tokenBudget = options.tokenBudget || MAP_TOKEN_BUDGET;
    const mentionedSymbols = options.mentioned || [];
    const focusFiles = options.focusFiles || [];

    // Apply mention boosts
    for (const name of mentionedSymbols) {
      const ids = this._nameIndex.get(name);
      if (ids) {
        for (const id of ids) {
          const node = this._graph.get(id);
          if (node) node.mentionBoost = MENTION_WEIGHT_BOOST;
        }
      }
    }

    // Sort symbols by boosted rank
    const ranked = [...this._graph.values()]
      .map(n => ({ ...n, effectiveRank: n.rank * n.mentionBoost }))
      .sort((a, b) => b.effectiveRank - a.effectiveRank);

    // Build map within token budget
    const mapLines = [];
    let estimatedTokens = 0;
    const filesIncluded = new Set();

    // Focus files first
    for (const fp of focusFiles) {
      const absFp = path.resolve(this.rootDir, fp);
      const symbols = this._fileIndex.get(absFp);
      if (symbols) {
        const relPath = path.relative(this.rootDir, absFp);
        const fileSymbols = [...symbols].map(id => this._graph.get(id)).filter(Boolean);
        const line = `${relPath}: ${fileSymbols.map(s => `${s.type} ${s.name}`).join(', ')}`;
        const tokens = Math.ceil(line.length / 4);
        if (estimatedTokens + tokens <= tokenBudget) {
          mapLines.push(line);
          estimatedTokens += tokens;
          filesIncluded.add(absFp);
        }
      }
    }

    // Then ranked symbols
    for (const sym of ranked) {
      if (estimatedTokens >= tokenBudget) break;
      const absFp = sym.filePath;
      if (filesIncluded.has(absFp)) continue;

      const symbols = this._fileIndex.get(absFp);
      if (!symbols) continue;

      const relPath = path.relative(this.rootDir, absFp);
      const fileSymbols = [...symbols]
        .map(id => this._graph.get(id))
        .filter(Boolean)
        .sort((a, b) => b.rank - a.rank);

      const line = `${relPath}: ${fileSymbols.map(s => `${s.type} ${s.name}`).join(', ')}`;
      const tokens = Math.ceil(line.length / 4);
      if (estimatedTokens + tokens <= tokenBudget) {
        mapLines.push(line);
        estimatedTokens += tokens;
        filesIncluded.add(absFp);
      }
    }

    // Reset mention boosts
    for (const node of this._graph.values()) node.mentionBoost = 1.0;

    return {
      map: mapLines.join('\n'),
      filesIncluded: filesIncluded.size,
      symbolsCovered: mapLines.reduce((sum, l) => sum + l.split(',').length, 0),
      estimatedTokens,
    };
  }

  // ── PageRank Computation ───────────────────────────────────────
  _computePageRank() {
    const nodes = [...this._graph.values()];
    const N = nodes.length;
    if (N === 0) return;

    const d = DAMPING_FACTOR;
    let iterations = 0;

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      let maxDelta = 0;
      iterations++;

      for (const node of nodes) {
        let incoming = 0;
        // Find all nodes that reference this node
        for (const other of nodes) {
          if (other.edges.has(node.name)) {
            incoming += other.rank / Math.max(other.edges.size, 1);
          }
        }

        const newRank = (1 - d) / N + d * incoming;
        maxDelta = Math.max(maxDelta, Math.abs(newRank - node.rank));
        node.rank = newRank;
      }

      if (maxDelta < CONVERGENCE_THRESHOLD) break;
    }

    this._metrics.rankIterations = iterations;
  }

  // ── File Indexing ──────────────────────────────────────────────
  async _indexFile(absPath) {
    const ext = path.extname(absPath).toLowerCase();
    if (!PARSEABLE_EXTENSIONS.has(ext)) return;

    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
      this._fileHashes.set(absPath, hash);

      const symbols = this._extractSymbols(content, ext, absPath);
      const fileSymbolIds = new Set();

      for (const sym of symbols) {
        if (this._graph.size >= MAX_SYMBOLS) break;
        this._graph.set(sym.id, sym);
        fileSymbolIds.add(sym.id);

        if (!this._nameIndex.has(sym.name)) this._nameIndex.set(sym.name, new Set());
        this._nameIndex.get(sym.name).add(sym.id);
      }

      this._fileIndex.set(absPath, fileSymbolIds);
      this._metrics.filesIndexed++;
      this._metrics.symbolsExtracted += symbols.length;
    } catch (e) {
      logger.debug({ path: absPath, error: e.message }, 'Failed to index file');
    }
  }

  // ── Symbol Extraction (regex-based, fast) ──────────────────────
  _extractSymbols(content, ext, absPath) {
    const symbols = [];
    const lines = content.split('\n');

    const patterns = this._getPatternsForExt(ext);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { regex, type } of patterns) {
        const match = line.match(regex);
        if (match && match[1]) {
          const sym = new SymbolNode(match[1], absPath, type, i + 1);

          // Extract references from function/class body
          const bodyEnd = Math.min(i + fib(10), lines.length); // scan 55 lines
          const body = lines.slice(i, bodyEnd).join('\n');
          const identifiers = body.match(/\b[A-Z_][a-zA-Z0-9_]*\b/g) || [];
          for (const id of new Set(identifiers)) {
            if (id !== match[1]) sym.edges.add(id);
          }

          symbols.push(sym);
        }
      }
    }

    return symbols;
  }

  _getPatternsForExt(ext) {
    const jsPatterns = [
      { regex: /(?:function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=\s*(?:async\s+)?(?:function|\()|\()/, type: 'function' },
      { regex: /class\s+([A-Z][a-zA-Z0-9_]*)/, type: 'class' },
      { regex: /(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(.*\)\s*\{/, type: 'method' },
      { regex: /(?:const|let|var)\s+([A-Z_][A-Z0-9_]*)\s*=/, type: 'variable' },
      { regex: /(?:require|import)\s*\(\s*['"]([^'"]+)['"]/, type: 'import' },
    ];

    const pyPatterns = [
      { regex: /(?:def|async\s+def)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/, type: 'function' },
      { regex: /class\s+([A-Z][a-zA-Z0-9_]*)/, type: 'class' },
      { regex: /^([A-Z_][A-Z0-9_]*)\s*=/, type: 'variable' },
      { regex: /(?:from|import)\s+([a-zA-Z_][a-zA-Z0-9_.]+)/, type: 'import' },
    ];

    if (['.js', '.ts', '.jsx', '.tsx', '.mjs'].includes(ext)) return jsPatterns;
    if (['.py'].includes(ext)) return pyPatterns;
    return jsPatterns; // default fallback
  }

  _resolveEdges() {
    let edgesResolved = 0;
    for (const node of this._graph.values()) {
      for (const refName of node.edges) {
        const targets = this._nameIndex.get(refName);
        if (targets) {
          for (const targetId of targets) {
            const target = this._graph.get(targetId);
            if (target) {
              target.referenceCount++;
              edgesResolved++;
            }
          }
        }
      }
    }
    this._metrics.edgesResolved = edgesResolved;
  }

  _removeFile(absPath) {
    const ids = this._fileIndex.get(absPath);
    if (ids) {
      for (const id of ids) {
        const node = this._graph.get(id);
        if (node) {
          const nameSet = this._nameIndex.get(node.name);
          if (nameSet) { nameSet.delete(id); if (nameSet.size === 0) this._nameIndex.delete(node.name); }
        }
        this._graph.delete(id);
      }
    }
    this._fileIndex.delete(absPath);
    this._fileHashes.delete(absPath);
  }

  _discoverFiles(include, exclude) {
    try {
      const exts = [...PARSEABLE_EXTENSIONS].map(e => `*${e}`).join(',');
      const excludeDirs = 'node_modules,.git,dist,build,.next,__pycache__,venv,.venv';
      const cmd = `find "${this.rootDir}" -type f \\( ${[...PARSEABLE_EXTENSIONS].map(e => `-name "*${e}"`).join(' -o ')} \\) ${excludeDirs.split(',').map(d => `-not -path "*/${d}/*"`).join(' ')} 2>/dev/null | head -${MAX_SYMBOLS}`;
      return execSync(cmd, { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  _hashFile(absPath) {
    const content = fs.readFileSync(absPath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
  }

  // ── Query API ──────────────────────────────────────────────────
  getTopSymbols(n = fib(8)) {
    return [...this._graph.values()]
      .sort((a, b) => b.rank - a.rank)
      .slice(0, n)
      .map(s => ({ name: s.name, file: path.relative(this.rootDir, s.filePath), type: s.type, rank: s.rank, refs: s.referenceCount }));
  }

  getDependencies(symbolName) {
    const ids = this._nameIndex.get(symbolName);
    if (!ids) return [];
    const deps = new Set();
    for (const id of ids) {
      const node = this._graph.get(id);
      if (node) for (const edge of node.edges) deps.add(edge);
    }
    return [...deps];
  }

  get metrics() { return { ...this._metrics }; }
  get symbolCount() { return this._graph.size; }
  get fileCount() { return this._fileIndex.size; }
}

module.exports = { LiquidGraphRank };
