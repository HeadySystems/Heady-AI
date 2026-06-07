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
// ║  FILE: src/mcp/tools/heady-codebase-tools.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Codebase Tools v1.0.0                                  ║
// ║  File read/write/edit/list + shell exec for direct codebase     ║
// ║  manipulation via MCP tool interface                            ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const logger = require('../../utils/logger');

const execFileAsync = promisify(execFile);

const PHI = 1.618033988749895;
const MAX_FILE_SIZE = Math.round(PHI * 1024 * 1024); // ~1.6 MB read limit
const MAX_OUTPUT_CHARS = Math.round(PHI * 32768);     // ~53k chars shell output cap
const WORKSPACE_ROOT = process.env.HEADY_WORKSPACE_ROOT || path.resolve(process.cwd());

// ─── Safety: resolve and validate paths stay inside workspace ────────────────

function resolveSafe(filePath) {
  const resolved = path.resolve(WORKSPACE_ROOT, filePath);
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error(`Path traversal blocked: "${filePath}" resolves outside workspace`);
  }
  return resolved;
}

// ─── TOOL DEFINITIONS ────────────────────────────────────────────────────────

const CODEBASE_TOOLS = [

  // ═══════════════════════════════════════════════════════════════
  // heady_file_read — Read file contents
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'heady_file_read',
    description: 'Read the contents of a file in the Heady workspace. Returns file content as text with line numbers.',
    category: 'codebase',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to workspace root (or absolute)' },
        startLine: { type: 'integer', description: 'Optional start line (1-indexed)' },
        endLine: { type: 'integer', description: 'Optional end line (1-indexed, inclusive)' },
      },
      required: ['path'],
    },
    handler: async (params) => {
      const { path: filePath, startLine, endLine } = params;
      const resolved = resolveSafe(filePath);

      if (!fs.existsSync(resolved)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        throw new Error(`"${filePath}" is a directory. Use heady_file_list instead.`);
      }
      if (stat.size > MAX_FILE_SIZE) {
        throw new Error(`File too large (${Math.round(stat.size / 1024)}KB). Max: ${Math.round(MAX_FILE_SIZE / 1024)}KB. Use startLine/endLine.`);
      }

      const content = fs.readFileSync(resolved, 'utf8');
      const lines = content.split('\n');

      const from = Math.max(1, startLine || 1);
      const to = Math.min(lines.length, endLine || lines.length);
      const slice = lines.slice(from - 1, to);

      const numbered = slice.map((line, i) => `${from + i}: ${line}`).join('\n');

      return {
        path: filePath,
        resolvedPath: resolved,
        totalLines: lines.length,
        sizeBytes: stat.size,
        showing: { from, to },
        content: numbered,
      };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // heady_file_write — Create or overwrite a file
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'heady_file_write',
    description: 'Write content to a file in the Heady workspace. Creates parent directories if needed. Refuses to overwrite unless overwrite=true.',
    category: 'codebase',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to workspace root (or absolute)' },
        content: { type: 'string', description: 'Full file content to write' },
        overwrite: { type: 'boolean', default: false, description: 'Allow overwriting existing files' },
        createDirs: { type: 'boolean', default: true, description: 'Create parent directories if they don\'t exist' },
      },
      required: ['path', 'content'],
    },
    handler: async (params) => {
      const { path: filePath, content, overwrite = false, createDirs = true } = params;
      const resolved = resolveSafe(filePath);

      if (fs.existsSync(resolved) && !overwrite) {
        throw new Error(`File exists: "${filePath}". Set overwrite=true to replace.`);
      }

      if (createDirs) {
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
      }

      fs.writeFileSync(resolved, content, 'utf8');
      const stat = fs.statSync(resolved);

      logger.info({ component: 'codebase-tools', action: 'file_write', path: filePath, sizeBytes: stat.size });

      return {
        path: filePath,
        resolvedPath: resolved,
        written: true,
        sizeBytes: stat.size,
        lineCount: content.split('\n').length,
        createdAt: new Date().toISOString(),
      };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // heady_file_edit — Apply targeted search-and-replace edits
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'heady_file_edit',
    description: 'Apply one or more search-and-replace edits to an existing file. Each edit specifies exact text to find and its replacement. Atomic: all edits succeed or none are applied.',
    category: 'codebase',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to workspace root' },
        edits: {
          type: 'array',
          description: 'Array of { search, replace } edit objects. search is exact text to find, replace is the replacement.',
          items: {
            type: 'object',
            properties: {
              search: { type: 'string', description: 'Exact text to find in the file' },
              replace: { type: 'string', description: 'Replacement text' },
            },
            required: ['search', 'replace'],
          },
        },
        dryRun: { type: 'boolean', default: false, description: 'Preview changes without writing' },
      },
      required: ['path', 'edits'],
    },
    handler: async (params) => {
      const { path: filePath, edits, dryRun = false } = params;
      const resolved = resolveSafe(filePath);

      if (!fs.existsSync(resolved)) {
        throw new Error(`File not found: ${filePath}`);
      }

      let content = fs.readFileSync(resolved, 'utf8');
      const original = content;
      const applied = [];
      const failed = [];

      // Validate all edits first (atomic check)
      for (const edit of edits) {
        if (!content.includes(edit.search)) {
          failed.push({ search: edit.search.slice(0, 80), reason: 'search text not found in file' });
        }
      }

      if (failed.length > 0) {
        return {
          path: filePath,
          applied: 0,
          failed,
          error: 'Some edits could not be matched. No changes were applied (atomic).',
        };
      }

      // Apply all edits
      for (const edit of edits) {
        const before = content;
        content = content.replace(edit.search, edit.replace);
        if (content !== before) {
          applied.push({
            searchPreview: edit.search.slice(0, 60),
            replacePreview: edit.replace.slice(0, 60),
          });
        }
      }

      if (!dryRun && applied.length > 0) {
        fs.writeFileSync(resolved, content, 'utf8');
      }

      logger.info({ component: 'codebase-tools', action: 'file_edit', path: filePath, editsApplied: applied.length, dryRun });

      return {
        path: filePath,
        dryRun,
        applied: applied.length,
        edits: applied,
        originalLines: original.split('\n').length,
        newLines: content.split('\n').length,
        editedAt: new Date().toISOString(),
      };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // heady_file_list — List directory contents
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'heady_file_list',
    description: 'List files and directories in a workspace path. Supports depth control and filtering by extension.',
    category: 'codebase',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', default: '.', description: 'Directory path relative to workspace root' },
        depth: { type: 'integer', default: 2, description: 'Maximum recursion depth' },
        extensions: { type: 'array', items: { type: 'string' }, description: 'Filter by file extensions (e.g. [".js", ".md"])' },
        includeHidden: { type: 'boolean', default: false, description: 'Include hidden files/dirs' },
      },
    },
    handler: async (params) => {
      const { path: dirPath = '.', depth = 2, extensions, includeHidden = false } = params;
      const resolved = resolveSafe(dirPath);

      if (!fs.existsSync(resolved)) {
        throw new Error(`Directory not found: ${dirPath}`);
      }
      if (!fs.statSync(resolved).isDirectory()) {
        throw new Error(`"${dirPath}" is not a directory. Use heady_file_read instead.`);
      }

      const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__', '.next']);
      const entries = [];

      function scan(dir, currentDepth, prefix) {
        if (currentDepth > depth) return;
        let items;
        try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

        // Sort: directories first, then alphabetical
        items.sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        for (const item of items) {
          if (!includeHidden && item.name.startsWith('.')) continue;
          if (SKIP.has(item.name)) continue;

          const full = path.join(dir, item.name);
          const rel = path.relative(resolved, full);
          const isDir = item.isDirectory();

          if (!isDir && extensions && extensions.length > 0) {
            const ext = path.extname(item.name);
            if (!extensions.includes(ext)) continue;
          }

          const entry = {
            name: item.name,
            path: rel,
            type: isDir ? 'directory' : 'file',
          };

          if (!isDir) {
            try {
              const stat = fs.statSync(full);
              entry.sizeBytes = stat.size;
            } catch {
              entry.sizeBytes = 0;
            }
          }

          entries.push(entry);

          if (isDir) {
            scan(full, currentDepth + 1, rel);
          }
        }
      }

      scan(resolved, 0, '');

      return {
        path: dirPath,
        resolvedPath: resolved,
        depth,
        totalEntries: entries.length,
        directories: entries.filter(e => e.type === 'directory').length,
        files: entries.filter(e => e.type === 'file').length,
        entries: entries.slice(0, 500), // Cap at 500 entries
      };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // heady_shell_exec — Execute shell commands
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'heady_shell_exec',
    description: 'Execute a shell command in the Heady workspace. Returns stdout, stderr, and exit code. Commands run with a timeout and output cap for safety.',
    category: 'codebase',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command to execute (e.g. "git status", "npm test")' },
        cwd: { type: 'string', description: 'Working directory relative to workspace root. Defaults to workspace root.' },
        timeout: { type: 'integer', default: 30000, description: 'Timeout in milliseconds (default 30s, max 120s)' },
      },
      required: ['command'],
    },
    handler: async (params) => {
      const { command, cwd: cwdParam, timeout: timeoutParam = 30000 } = params;
      const timeout = Math.min(timeoutParam, 120000); // Max 2 minutes

      // Parse command into executable and args
      const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
      if (parts.length === 0) {
        throw new Error('Empty command');
      }

      const executable = parts[0];
      const args = parts.slice(1).map(a => a.replace(/^"|"$/g, ''));

      // Resolve working directory
      const resolvedCwd = cwdParam ? resolveSafe(cwdParam) : WORKSPACE_ROOT;
      if (!fs.existsSync(resolvedCwd)) {
        throw new Error(`Working directory not found: ${cwdParam}`);
      }

      logger.info({ component: 'codebase-tools', action: 'shell_exec', command, cwd: resolvedCwd });

      const start = Date.now();
      try {
        const { stdout, stderr } = await execFileAsync(executable, args, {
          cwd: resolvedCwd,
          timeout,
          maxBuffer: MAX_OUTPUT_CHARS * 2,
          env: { ...process.env, PAGER: 'cat' },
        });

        return {
          command,
          exitCode: 0,
          stdout: stdout.slice(0, MAX_OUTPUT_CHARS),
          stderr: stderr.slice(0, MAX_OUTPUT_CHARS),
          durationMs: Date.now() - start,
          truncated: stdout.length > MAX_OUTPUT_CHARS || stderr.length > MAX_OUTPUT_CHARS,
        };
      } catch (err) {
        return {
          command,
          exitCode: err.code || 1,
          stdout: (err.stdout || '').slice(0, MAX_OUTPUT_CHARS),
          stderr: (err.stderr || err.message || '').slice(0, MAX_OUTPUT_CHARS),
          durationMs: Date.now() - start,
          error: err.killed ? 'Command timed out' : err.message,
        };
      }
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // heady_file_search — Grep/search across workspace files
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'heady_file_search',
    description: 'Search for text patterns across files in the workspace using grep. Returns matching lines with file paths and line numbers.',
    category: 'codebase',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text or regex pattern to search for' },
        path: { type: 'string', default: '.', description: 'Directory to search in (relative to workspace root)' },
        extensions: { type: 'array', items: { type: 'string' }, description: 'File extensions to include (e.g. [".js", ".md"])' },
        caseSensitive: { type: 'boolean', default: false, description: 'Case-sensitive search' },
        maxResults: { type: 'integer', default: 50, description: 'Maximum results to return' },
      },
      required: ['query'],
    },
    handler: async (params) => {
      const { query, path: searchPath = '.', extensions, caseSensitive = false, maxResults = 50 } = params;
      const resolved = resolveSafe(searchPath);

      // Build grep args
      const grepArgs = [
        caseSensitive ? '' : '-i',
        '-rn',
        '--color=never',
        '-l', // list files only first
      ].filter(Boolean);

      // Add include patterns
      if (extensions && extensions.length > 0) {
        for (const ext of extensions) {
          grepArgs.push('--include', `*${ext}`);
        }
      }

      // Exclude common dirs
      grepArgs.push('--exclude-dir=node_modules', '--exclude-dir=.git', '--exclude-dir=dist', '--exclude-dir=build');
      grepArgs.push(query, resolved);

      try {
        const { stdout } = await execFileAsync('grep', grepArgs, {
          cwd: WORKSPACE_ROOT,
          timeout: 15000,
          maxBuffer: MAX_OUTPUT_CHARS,
        });

        const files = stdout.trim().split('\n').filter(Boolean).slice(0, maxResults);

        // Now get matching lines from each file
        const matches = [];
        for (const file of files.slice(0, 20)) { // Cap file count
          try {
            const lineArgs = [
              caseSensitive ? '' : '-i',
              '-n',
              '--color=never',
              query,
              file,
            ].filter(Boolean);

            const { stdout: lines } = await execFileAsync('grep', lineArgs, {
              cwd: WORKSPACE_ROOT,
              timeout: 5000,
              maxBuffer: MAX_OUTPUT_CHARS,
            });

            const fileMatches = lines.trim().split('\n').filter(Boolean).slice(0, 5); // Max 5 lines per file
            for (const line of fileMatches) {
              const colonIdx = line.indexOf(':');
              const lineNum = parseInt(line.slice(0, colonIdx), 10);
              const lineContent = line.slice(colonIdx + 1);
              matches.push({
                file: path.relative(WORKSPACE_ROOT, file),
                line: lineNum,
                content: lineContent.trim().slice(0, 200),
              });
            }
          } catch {
            // Skip files that fail
          }
        }

        return {
          query,
          path: searchPath,
          totalFiles: files.length,
          totalMatches: matches.length,
          matches: matches.slice(0, maxResults),
        };
      } catch (err) {
        if (err.code === 1) {
          // grep returns exit code 1 for "no matches" — not an error
          return { query, path: searchPath, totalFiles: 0, totalMatches: 0, matches: [] };
        }
        throw new Error(`Search failed: ${err.message}`);
      }
    },
  },
];

module.exports = { CODEBASE_TOOLS };
