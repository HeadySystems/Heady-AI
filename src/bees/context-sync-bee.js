/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  PROPRIETARY AND CONFIDENTIAL — HEADYSYSTEMS INC.                   ║
 * ║  Copyright © 2026 HeadySystems Inc. All Rights Reserved.            ║
 * ║  Protected under the Defend Trade Secrets Act (18 U.S.C. § 1836)   ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 *
 * HeadyBee: Context Sync — GitHub Auto-Sync for HeadyAutoContext
 * ═══════════════════════════════════════════════════════════════════
 *
 * Replaces the planned Drive Sync Bee (1561c9af) with a GitHub-native
 * implementation that pushes comprehensive project context to the
 * HeadySystems/HeadyAutoContext repository.
 *
 * Liquid Nodes — Context is accessible from:
 *   - GitHub:     HeadySystems/HeadyAutoContext (always-synced repo)
 *   - CLI:        `heady context --export` (local generation)
 *   - Gateway:    GET /api/context/:tier (edge-served via gateway)
 *   - AutoContext: getAutoContext().enrich() (runtime injection)
 *   - MCP:        `context` tool in heady-mcp-server (IDE access)
 *   - Bee:        context-sync-bee getWork() (scheduled push)
 *
 * Integration with HeadyAutoContext v2:
 *   - Hooks into _scanWorkspace() file index for source-of-truth
 *   - Uses CSL_GATES (0.382/0.618/0.718) for tiered packaging
 *   - Exports context in 3 tiers: Small (essential), Medium, Large (full)
 *   - Pushes to GitHub via Octokit API (PAT-authenticated)
 *
 * @module context-sync-bee
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ─── Safe Imports ───────────────────────────────────────────────────────────

let logger;
try { logger = require('../utils/logger'); } catch (_) {
    logger = { info: console.log, warn: console.warn, error: console.error, debug: () => {} };
}

let getAutoContext;
try { ({ getAutoContext } = require('../services/heady-auto-context')); } catch (_) { getAutoContext = null; }

// ─── Constants (φ-scaled) ───────────────────────────────────────────────────

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

/** GitHub target */
const GITHUB_REPO = 'HeadySystems/HeadyAutoContext';
const GITHUB_BRANCH = 'main';

/** Sync interval — φ-scaled (89 seconds for scheduled, 13 minutes for periodic) */
const SYNC_INTERVAL_MS = FIB[12] * 1000; // 233 seconds (~4 min)

/** Context source paths (relative to workspace root) */
const CONTEXT_SOURCE_DIRS = [
    'configs',
    'docs',
    'src/services',
    'src/orchestration',
    'src/bees',
    'services',
    'packages',
];

/** Context tiers — CSL-aligned */
const TIERS = {
    small: {
        name: 'Small',
        description: 'Essential quick-reference context (~20KB). Use for token-limited interactions.',
        maxFiles: FIB[5],   // 8 files
        maxSizeKB: FIB[8],  // 34 KB
        cslGate: 0.718,     // critical only
    },
    medium: {
        name: 'Medium',
        description: 'Comprehensive working context (~60KB). Covers architecture, services, deployment.',
        maxFiles: FIB[7],   // 21 files
        maxSizeKB: FIB[10], // 89 KB
        cslGate: PSI,       // ≈ 0.618 (boost+)
    },
    large: {
        name: 'Large',
        description: 'Full project context (~150KB). Complete reference for deep work.',
        maxFiles: FIB[9],   // 55 files
        maxSizeKB: FIB[12], // 233 KB
        cslGate: PSI * PSI, // ≈ 0.382 (include+)
    },
};

// ─── Bee Registration ───────────────────────────────────────────────────────

/** @type {string} Domain identifier for bee auto-discovery */
const domain = 'context-sync';

/** @type {string} Bee description */
const description = 'Syncs comprehensive project context to HeadySystems/HeadyAutoContext GitHub repo. ' +
    'Generates 3-tier context packages (Small/Medium/Large) from HeadyAutoContext workspace index. ' +
    'Liquid nodes: GitHub, CLI, Gateway /api/context, MCP tool, HeadyAutoContext.enrich().';

/** @type {number} Priority — high (context is foundational) */
const priority = FIB[5]; // 8

// ─── State ──────────────────────────────────────────────────────────────────

const STATE_FILE = '.heady/context-sync-state.json';
let _state = { lastSyncAt: null, lastSHA: null, filesSync: 0, errors: [] };
let _autoContext = null;

function _loadState(root) {
    try {
        const p = path.join(root, STATE_FILE);
        if (fs.existsSync(p)) _state = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (_) { /* first run */  }
}

function _saveState(root) {
    try {
        const dir = path.join(root, '.heady');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(root, STATE_FILE), JSON.stringify(_state, null, 2));
    } catch (e) { logger.error('[context-sync] Failed to save state', e.message); }
}

// ─── Context Package Generation ─────────────────────────────────────────────

/**
 * Generate a context package for a specific tier.
 * Pulls from Dropzone if available, falls back to AutoContext workspace index.
 *
 * @param {'small'|'medium'|'large'} tier
 * @param {string} workspaceRoot
 * @returns {Object[]} Array of { path, content } file entries
 */
function generateContextPackage(tier, workspaceRoot) {
    const tierConfig = TIERS[tier];
    const dropzoneBase = path.join(process.env.HOME || '/home/headyme', 'Desktop', 'Dropzone', '01-Context');

    // Tier name mapping to Dropzone directory names
    const tierDirName = tier === 'small' ? 'Small' : tier === 'medium' ? 'Medium' : 'Large';
    const dropzoneDir = path.join(dropzoneBase, tierDirName);

    const files = [];

    // ── Source 1: Dropzone context files (already curated) ──
    if (fs.existsSync(dropzoneDir)) {
        const entries = fs.readdirSync(dropzoneDir).filter(f => f.endsWith('.md'));
        for (const entry of entries) {
            try {
                const content = fs.readFileSync(path.join(dropzoneDir, entry), 'utf8');
                files.push({ path: `context/${tierDirName}/${entry}`, content });
            } catch (e) { logger.warn(`[context-sync] Skip ${entry}: ${e.message}`); }
        }
    }

    // ── Source 2: AutoContext workspace index (live scan) ──
    if (getAutoContext && files.length < tierConfig.maxFiles) {
        try {
            _autoContext = _autoContext || getAutoContext({ workspaceRoot });
            // Use AutoContext's _scanWorkspace for live file list
            if (_autoContext._fileIndex || _autoContext._dirty) {
                _autoContext._fileIndex = _autoContext._scanWorkspace?.() || _autoContext._fileIndex;
            }
        } catch (e) { logger.debug('[context-sync] AutoContext unavailable:', e.message); }
    }

    // ── Source 3: Key config files (always included) ──
    const keyConfigs = [
        { src: 'package.json', dst: 'project/package.json' },
        { src: 'heady.config.js', dst: 'project/heady.config.js' },
        { src: 'configs/heady-swarms.yaml', dst: 'project/heady-swarms.yaml' },
        { src: 'configs/site-registry.json', dst: 'project/site-registry.json' },
        { src: 'configs/guard-rules.json', dst: 'project/guard-rules.json' },
    ];

    if (tier !== 'small') {
        keyConfigs.push(
            { src: 'configs/heady-config.json', dst: 'project/heady-config.json' },
            { src: 'configs/liquid-os-manifest.json', dst: 'project/liquid-os-manifest.json' },
            { src: 'configs/swarm-taxonomy.json', dst: 'project/swarm-taxonomy.json' },
        );
    }

    for (const { src, dst } of keyConfigs) {
        const fullPath = path.join(workspaceRoot, src);
        if (fs.existsSync(fullPath) && files.length < tierConfig.maxFiles) {
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.length < tierConfig.maxSizeKB * 1024) {
                    files.push({ path: dst, content });
                }
            } catch (_) { /* skip */  }
        }
    }

    // ── Source 4: Architecture docs (medium + large) ──
    if (tier !== 'small') {
        const docFiles = [
            'docs/ARCHITECTURE.md',
            'docs/heady-phi-architecture.md',
            'docs/liquid-architecture-v9.0.md',
        ];
        for (const doc of docFiles) {
            const fp = path.join(workspaceRoot, doc);
            if (fs.existsSync(fp) && files.length < tierConfig.maxFiles) {
                try {
                    files.push({ path: `docs/${path.basename(doc)}`, content: fs.readFileSync(fp, 'utf8') });
                } catch (_) { /* skip */  }
            }
        }
    }

    // ── Source 5: Service manifests (large only) ──
    if (tier === 'large') {
        const serviceFiles = [];
        const servicesDir = path.join(workspaceRoot, 'src', 'services');
        if (fs.existsSync(servicesDir)) {
            for (const f of fs.readdirSync(servicesDir).filter(f => f.endsWith('.js')).slice(0, 13)) {
                try {
                    const content = fs.readFileSync(path.join(servicesDir, f), 'utf8');
                    // Extract just the header comment + exports (compressed context)
                    const header = content.split('\n').slice(0, 55).join('\n');
                    const exports = content.match(/module\.exports\s*=\s*\{[^}]+\}/s)?.[0] || '';
                    serviceFiles.push({
                        path: `services/${f}`,
                        content: `${header}\n\n// ... (truncated for context) ...\n\n${exports}`,
                    });
                } catch (_) { /* skip */  }
            }
        }
        files.push(...serviceFiles.slice(0, tierConfig.maxFiles - files.length));
    }

    return files;
}

/**
 * Generate the repo README with tier navigation and sync metadata.
 * @param {Object} syncMeta - Sync metadata
 * @returns {string} README content
 */
function generateREADME(syncMeta = {}) {
    const now = new Date().toISOString();
    return `# HeadyAutoContext — AI Agent Context Repository

> **Auto-synced** comprehensive project context for AI coding agents.
> Powered by [HeadyAutoContext v2](https://github.com/HeadySystems/Heady-main) — the always-on latent space context intelligence service.

## 🧠 What Is This?

This repository is a **liquid node** — one of several access points to the Heady ecosystem's context intelligence:

| Node | Access | Best For |
|------|--------|----------|
| **GitHub** (this repo) | Clone/browse/reference | AI agent custom instructions, project onboarding |
| **AutoContext Service** | \`getAutoContext().enrich()\` | Runtime context injection (zero-code) |
| **Gateway API** | \`GET /api/context/:tier\` | Edge-served context for any client |
| **MCP Tool** | \`context\` tool in heady-mcp-server | IDE-based context access |
| **CLI** | \`heady context --export\` | Local generation & inspection |
| **Bee** | \`context-sync-bee\` | Scheduled auto-push to this repo |

## 📦 Context Tiers

Choose the right tier for your token budget:

### [Small](./context/Small/) (~20KB)
Essential quick-reference. System prompt, file map, commands.
> **Use for:** Token-limited chats, quick questions, lightweight agents

### [Medium](./context/Medium/) (~60KB)
Working context. Architecture, services, deployment, security.
> **Use for:** Feature development, debugging, code review

### [Large](./context/Large/) (~150KB)
Full reference. Patents, orchestration deep-dive, CSL engine, enterprise readiness.
> **Use for:** Deep architecture work, patent-informed development, system design

## 🗂 Project Files

Key configuration files from the live codebase:

- [\`project/\`](./project/) — package.json, heady.config, swarm configs
- [\`docs/\`](./docs/) — Architecture documentation
- [\`services/\`](./services/) — Service headers + exports (Large tier only)

## 🔄 Sync Details

| Field | Value |
|-------|-------|
| **Last Sync** | ${syncMeta.syncedAt || now} |
| **Source** | HeadyAutoContext v2 workspace index |
| **Files** | ${syncMeta.fileCount || '—'} |
| **Trigger** | ${syncMeta.trigger || 'context-sync-bee'} |
| **CSL Gates** | 0.382 (include) / 0.618 (boost) / 0.718 (critical) |

## ⚡ Usage

### As AI Agent Custom Instructions
\`\`\`
Point your AI agent to: https://github.com/HeadySystems/HeadyAutoContext
Reference: context/Small/ for quick context, context/Large/ for deep work
\`\`\`

### Clone for Local Reference
\`\`\`bash
git clone https://github.com/HeadySystems/HeadyAutoContext.git
\`\`\`

### Via Heady CLI
\`\`\`bash
heady context --tier medium --export ./my-context/
heady context "build the auth flow" --preview  # see what AutoContext injects
\`\`\`

---

© 2026 HeadySystems Inc. · Powered by HeadyAutoContext v2 · φ-scaled · CSL-gated
`;
}

// ─── GitHub Push ────────────────────────────────────────────────────────────

/**
 * Push context files to HeadySystems/HeadyAutoContext via git CLI.
 * Uses the authenticated git credential already configured.
 *
 * @param {Object[]} files - Array of { path, content }
 * @param {string} workspaceRoot
 * @param {string} [trigger='bee'] - What triggered the sync
 */
async function pushToGitHub(files, workspaceRoot, trigger = 'bee') {
    const tmpDir = path.join('/tmp', 'heady-autocontext-sync');

    try {
        // Clean + clone
        execSync(`rm -rf ${tmpDir}`, { stdio: 'pipe' });

        // Check if repo has any commits
        let hasCommits = false;
        try {
            execSync(`git ls-remote --heads https://github.com/${GITHUB_REPO}.git`, { stdio: 'pipe' });
            const output = execSync(`git ls-remote --heads https://github.com/${GITHUB_REPO}.git`, { encoding: 'utf8' });
            hasCommits = output.includes('refs/heads/');
        } catch (_) { /* empty repo */  }

        if (hasCommits) {
            execSync(`git clone --depth 1 https://github.com/${GITHUB_REPO}.git ${tmpDir}`, {
                stdio: 'pipe', timeout: 30000,
            });
        } else {
            // Init fresh repo for first push
            fs.mkdirSync(tmpDir, { recursive: true });
            execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
            execSync('git branch -M main', { cwd: tmpDir, stdio: 'pipe' });
            execSync(`git remote add origin https://github.com/${GITHUB_REPO}.git`, { cwd: tmpDir, stdio: 'pipe' });
        }

        // Write all files
        let written = 0;
        for (const file of files) {
            const fullPath = path.join(tmpDir, file.path);
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(fullPath, file.content);
            written++;
        }

        // Write README
        const readme = generateREADME({
            syncedAt: new Date().toISOString(),
            fileCount: written,
            trigger,
        });
        fs.writeFileSync(path.join(tmpDir, 'README.md'), readme);

        // Commit + push
        execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });

        // Check if there are changes
        try {
            execSync('git diff --cached --quiet', { cwd: tmpDir, stdio: 'pipe' });
            logger.info('[context-sync] No changes to push');
            return { pushed: false, files: written, reason: 'no-changes' };
        } catch (_) { /* there are changes — proceed */  }

        const commitMsg = `sync: AutoContext ${trigger} — ${written} files [${new Date().toISOString().slice(0, 16)}]`;
        execSync(`git commit -m "${commitMsg}"`, { cwd: tmpDir, stdio: 'pipe' });

        // Push (force for first push, normal otherwise)
        const pushCmd = hasCommits
            ? `git push origin ${GITHUB_BRANCH}`
            : `git push -u origin ${GITHUB_BRANCH} --force`;
        execSync(pushCmd, { cwd: tmpDir, stdio: 'pipe', timeout: 30000 });

        // Update state
        const sha = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf8' }).trim();
        _state.lastSyncAt = new Date().toISOString();
        _state.lastSHA = sha;
        _state.filesSync = written;
        _state.errors = [];
        _saveState(workspaceRoot);

        logger.info(`[context-sync] ✅ Pushed ${written} files to ${GITHUB_REPO} (${sha.slice(0, 8)})`);
        return { pushed: true, files: written, sha };

    } catch (e) {
        _state.errors.push({ at: new Date().toISOString(), msg: e.message });
        _saveState(workspaceRoot);
        logger.error(`[context-sync] ❌ Push failed: ${e.message}`);
        return { pushed: false, files: 0, error: e.message };
    } finally {
        // Cleanup
        try { execSync(`rm -rf ${tmpDir}`, { stdio: 'pipe' }); } catch (_) { /* ok */  }
    }
}

// ─── Bee Interface ──────────────────────────────────────────────────────────

/**
 * HeadyBee getWork() — returns actionable worker functions.
 * Auto-discovered by bee registry via `domain` export.
 *
 * @param {Object} ctx - Bee context (workspaceRoot, etc.)
 * @returns {Object[]} Array of worker descriptors
 */
function getWork(ctx = {}) {
    const workspaceRoot = ctx.workspaceRoot || process.env.HEADY_WORKSPACE || '/home/headyme/Heady';
    _loadState(workspaceRoot);

    return [
        {
            id: 'sync-context-to-github',
            description: `Push all 3 context tiers to ${GITHUB_REPO}`,
            priority: FIB[5],
            async execute() {
                const allFiles = [];

                // Generate all three tiers
                for (const tier of ['small', 'medium', 'large']) {
                    const pkg = generateContextPackage(tier, workspaceRoot);
                    allFiles.push(...pkg);
                    logger.info(`[context-sync] ${tier}: ${pkg.length} files`);
                }

                // Push to GitHub
                return pushToGitHub(allFiles, workspaceRoot, 'bee-scheduled');
            },
        },
        {
            id: 'sync-status',
            description: 'Report last sync status and health',
            priority: FIB[3],
            execute() {
                return {
                    repo: GITHUB_REPO,
                    lastSync: _state.lastSyncAt,
                    lastSHA: _state.lastSHA,
                    filesSync: _state.filesSync,
                    errors: _state.errors.slice(-3),
                    tiers: Object.entries(TIERS).map(([k, v]) => ({
                        tier: k, ...v,
                    })),
                    liquidNodes: [
                        'GitHub: HeadySystems/HeadyAutoContext',
                        'CLI: heady context --export',
                        'Gateway: GET /api/context/:tier',
                        'MCP: context tool',
                        'AutoContext: getAutoContext().enrich()',
                        'Bee: context-sync-bee',
                    ],
                };
            },
        },
        {
            id: 'generate-tier',
            description: 'Generate a specific context tier without pushing',
            priority: FIB[3],
            execute(tier = 'medium') {
                return generateContextPackage(tier, workspaceRoot);
            },
        },
    ];
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
    domain,
    description,
    priority,
    getWork,
    generateContextPackage,
    generateREADME,
    pushToGitHub,
    TIERS,
    GITHUB_REPO,
};
