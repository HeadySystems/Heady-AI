#!/usr/bin/env node
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
// ║  FILE: bin/cli-theme.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * CLI Theme Module — Zero-dependency ANSI terminal rendering
 *
 * Provides rich terminal output: colors, boxes, tables, spinners,
 * ASCII art branding, agent activity tracking, and system dashboards.
 *
 * @module bin/cli-theme
 */
'use strict';

// ═══════════════════════════════════════════════════════════════════
// ═══ ANSI ESCAPE CODES ═══
// ═══════════════════════════════════════════════════════════════════

const ESC = '\x1b[';
const RESET = `${ESC}0m`;

// Styles
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const ITALIC = `${ESC}3m`;
const UNDERLINE = `${ESC}4m`;

// Foreground (256-color mode for Heady palette)
const FG = {
    black: `${ESC}30m`,
    red: `${ESC}31m`,
    green: `${ESC}32m`,
    yellow: `${ESC}33m`,
    blue: `${ESC}34m`,
    magenta: `${ESC}35m`,
    cyan: `${ESC}36m`,
    white: `${ESC}37m`,
    gray: `${ESC}90m`,
    // Heady brand colors (256-color)
    purple: `${ESC}38;5;134m`,   // HeadyPurple
    gold: `${ESC}38;5;220m`,   // HeadyGold
    teal: `${ESC}38;5;43m`,    // HeadyTeal
    coral: `${ESC}38;5;209m`,   // HeadyCoral
    azure: `${ESC}38;5;75m`,    // HeadyBlue
    mint: `${ESC}38;5;121m`,   // HeadyMint
    rose: `${ESC}38;5;211m`,   // HeadyRose
};

// Background
const BG = {
    black: `${ESC}40m`,
    purple: `${ESC}48;5;134m`,
    gold: `${ESC}48;5;220m`,
    teal: `${ESC}48;5;43m`,
    gray: `${ESC}48;5;236m`,
    darkGray: `${ESC}48;5;233m`,
};

// ═══════════════════════════════════════════════════════════════════
// ═══ COLOR HELPERS ═══
// ═══════════════════════════════════════════════════════════════════

function c(color, text) { return `${color}${text}${RESET}`; }
function bold(text) { return `${BOLD}${text}${RESET}`; }
function dim(text) { return `${DIM}${text}${RESET}`; }
function italic(text) { return `${ITALIC}${text}${RESET}`; }

function purple(text) { return c(FG.purple, text); }
function gold(text) { return c(FG.gold, text); }
function teal(text) { return c(FG.teal, text); }
function azure(text) { return c(FG.azure, text); }
function mint(text) { return c(FG.mint, text); }
function rose(text) { return c(FG.rose, text); }
function gray(text) { return c(FG.gray, text); }
function green(text) { return c(FG.green, text); }
function red(text) { return c(FG.red, text); }
function yellow(text) { return c(FG.yellow, text); }

// ═══════════════════════════════════════════════════════════════════
// ═══ ASCII ART LOGO ═══
// ═══════════════════════════════════════════════════════════════════

const HEADY_LOGO = `
${FG.purple}${BOLD}    ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗${RESET}
${FG.purple}${BOLD}    ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝${RESET}
${FG.gold}${BOLD}    ███████║█████╗  ███████║██║  ██║ ╚████╔╝${RESET}
${FG.gold}${BOLD}    ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝${RESET}
${FG.teal}${BOLD}    ██║  ██║███████╗██║  ██║██████╔╝   ██║${RESET}
${FG.teal}${BOLD}    ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝${RESET}`;

const SACRED_TAGLINE = `${FG.gray}    Sacred Geometry ${FG.purple}◆${FG.gray} Organic Systems ${FG.gold}◆${FG.gray} Breathing Interfaces${RESET}`;

function printLogo(version = '3.0.0') {
    console.log(HEADY_LOGO);
    console.log(`${FG.gray}    ─────────────────────────────────────────${RESET}`);
    console.log(`${FG.purple}${BOLD}    Heady™ Latent Operating System${RESET}  ${dim(`v${version}`)}`);
    console.log(SACRED_TAGLINE);
    console.log('');
}

// ═══════════════════════════════════════════════════════════════════
// ═══ BOX DRAWING ═══
// ═══════════════════════════════════════════════════════════════════

const BOX = {
    tl: '╔', tr: '╗', bl: '╚', br: '╝',
    h: '═', v: '║',
    ltl: '┌', ltr: '┐', lbl: '└', lbr: '┘',
    lh: '─', lv: '│',
    cross: '┼', tee_r: '├', tee_l: '┤',
};

function box(title, lines, opts = {}) {
    const width = opts.width || Math.max(50, ...(lines.map(l => stripAnsi(l).length + 4)), stripAnsi(title).length + 6);
    const color = opts.color || FG.purple;
    const pad = (text, w) => {
        const stripped = stripAnsi(text);
        const needed = w - stripped.length;
        return text + ' '.repeat(Math.max(0, needed));
    };

    const result = [];
    result.push(`${color}${BOX.tl}${BOX.h.repeat(2)} ${BOLD}${title}${RESET}${color} ${BOX.h.repeat(Math.max(0, width - stripAnsi(title).length - 5))}${BOX.tr}${RESET}`);
    for (const line of lines) {
        result.push(`${color}${BOX.v}${RESET} ${pad(line, width - 3)} ${color}${BOX.v}${RESET}`);
    }
    result.push(`${color}${BOX.bl}${BOX.h.repeat(width - 1)}${BOX.br}${RESET}`);
    return result.join('\n');
}

function lightBox(title, lines, opts = {}) {
    const width = opts.width || Math.max(50, ...(lines.map(l => stripAnsi(l).length + 4)), stripAnsi(title).length + 6);
    const color = opts.color || FG.gray;
    const pad = (text, w) => {
        const stripped = stripAnsi(text);
        const needed = w - stripped.length;
        return text + ' '.repeat(Math.max(0, needed));
    };

    const result = [];
    result.push(`${color}${BOX.ltl}${BOX.lh} ${bold(title)} ${BOX.lh.repeat(Math.max(0, width - stripAnsi(title).length - 5))}${BOX.ltr}${RESET}`);
    for (const line of lines) {
        result.push(`${color}${BOX.lv}${RESET} ${pad(line, width - 3)} ${color}${BOX.lv}${RESET}`);
    }
    result.push(`${color}${BOX.lbl}${BOX.lh.repeat(width - 1)}${BOX.lbr}${RESET}`);
    return result.join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// ═══ PROGRESS & SPINNERS ═══
// ═══════════════════════════════════════════════════════════════════

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const BRAILLE_FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];

class Spinner {
    constructor(text = '', opts = {}) {
        this._text = text;
        this._color = opts.color || FG.purple;
        this._frames = opts.frames || SPINNER_FRAMES;
        this._interval = null;
        this._frame = 0;
    }

    start() {
        this._interval = setInterval(() => {
            const frame = this._frames[this._frame % this._frames.length];
            process.stdout.write(`\r  ${this._color}${frame}${RESET} ${this._text}`);
            this._frame++;
        }, 80);
        return this;
    }

    update(text) { this._text = text; }

    succeed(text) {
        this.stop();
        console.log(`\r  ${green('✓')} ${text || this._text}`);
    }

    fail(text) {
        this.stop();
        console.log(`\r  ${red('✗')} ${text || this._text}`);
    }

    warn(text) {
        this.stop();
        console.log(`\r  ${yellow('⚠')} ${text || this._text}`);
    }

    stop() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
            process.stdout.write('\r' + ' '.repeat(80) + '\r');
        }
    }
}

function progressBar(current, total, opts = {}) {
    const width = opts.width || 30;
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    const color = opts.color || FG.teal;
    const filledChar = opts.filled || '■';
    const emptyChar = opts.empty || '□';
    const pct = Math.round((current / total) * 100);
    return `${color}[${filledChar.repeat(filled)}${FG.gray}${emptyChar.repeat(empty)}${color}]${RESET} ${bold(pct + '%')}`;
}

// ═══════════════════════════════════════════════════════════════════
// ═══ TABLE RENDERER ═══
// ═══════════════════════════════════════════════════════════════════

function table(headers, rows, opts = {}) {
    const headerColor = opts.headerColor || FG.purple;
    const borderColor = opts.borderColor || FG.gray;

    // Calculate column widths
    const colWidths = headers.map((h, i) => {
        const dataWidths = rows.map(r => stripAnsi(String(r[i] || '')).length);
        return Math.max(stripAnsi(h).length, ...dataWidths) + 2;
    });

    const hLine = colWidths.map(w => BOX.lh.repeat(w)).join(BOX.lh);
    const result = [];

    // Header
    result.push(`${borderColor}${BOX.ltl}${colWidths.map(w => BOX.lh.repeat(w + 1)).join(BOX.lh)}${BOX.lh}${BOX.ltr}${RESET}`);
    result.push(`${borderColor}${BOX.lv}${RESET} ${headers.map((h, i) => {
        const padded = `${headerColor}${BOLD}${h}${RESET}`;
        return padded + ' '.repeat(Math.max(0, colWidths[i] - stripAnsi(h).length));
    }).join(` ${borderColor}${BOX.lv}${RESET} `)} ${borderColor}${BOX.lv}${RESET}`);
    result.push(`${borderColor}${BOX.tee_r}${colWidths.map(w => BOX.lh.repeat(w + 1)).join(BOX.lh)}${BOX.lh}${BOX.tee_l}${RESET}`);

    // Rows
    for (const row of rows) {
        result.push(`${borderColor}${BOX.lv}${RESET} ${row.map((cell, i) => {
            const s = String(cell || '');
            return s + ' '.repeat(Math.max(0, colWidths[i] - stripAnsi(s).length));
        }).join(` ${borderColor}${BOX.lv}${RESET} `)} ${borderColor}${BOX.lv}${RESET}`);
    }

    // Footer
    result.push(`${borderColor}${BOX.lbl}${colWidths.map(w => BOX.lh.repeat(w + 1)).join(BOX.lh)}${BOX.lh}${BOX.lbr}${RESET}`);

    return result.join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// ═══ AGENT ACTIVITY TRACKER ═══
// ═══════════════════════════════════════════════════════════════════

class AgentTracker {
    constructor() {
        this._agents = new Map();
        this._interval = null;
        this._lineCount = 0;
    }

    addAgent(id, label, opts = {}) {
        this._agents.set(id, {
            label,
            status: opts.status || 'starting...',
            startedAt: Date.now(),
            done: false,
            result: null,
            color: opts.color || FG.azure,
            frame: 0,
        });
    }

    updateAgent(id, status) {
        const agent = this._agents.get(id);
        if (agent) agent.status = status;
    }

    completeAgent(id, result = '✓', success = true) {
        const agent = this._agents.get(id);
        if (agent) {
            agent.done = true;
            agent.result = result;
            agent.success = success;
            agent.elapsedMs = Date.now() - agent.startedAt;
        }
    }

    start() {
        this._render();
        this._interval = setInterval(() => this._render(), 100);
    }

    stop() {
        if (this._interval) clearInterval(this._interval);
        this._render(); // Final render
    }

    _render() {
        // Clear previous render
        if (this._lineCount > 0) {
            process.stdout.write(`${ESC}${this._lineCount}A`);
        }

        const lines = [];
        const agents = [...this._agents.values()];
        const maxLabel = Math.max(18, ...agents.map(a => a.label.length));
        const width = maxLabel + 40;

        lines.push(`${FG.gray}${BOX.ltl}${BOX.lh} ${bold(purple('Active Agents'))} ${BOX.lh.repeat(Math.max(0, width - 18))}${BOX.ltr}${RESET}`);

        for (const agent of agents) {
            const elapsed = ((Date.now() - agent.startedAt) / 1000).toFixed(1);
            const label = agent.label.padEnd(maxLabel);

            if (agent.done) {
                const icon = agent.success ? green('✓') : red('✗');
                const time = dim(`(${(agent.elapsedMs / 1000).toFixed(1)}s)`);
                lines.push(`${FG.gray}${BOX.lv}${RESET} ${icon} ${label} ${dim(agent.result)} ${time}${' '.repeat(Math.max(0, width - maxLabel - stripAnsi(agent.result).length - 15))}${FG.gray}${BOX.lv}${RESET}`);
            } else {
                const frame = BRAILLE_FRAMES[agent.frame++ % BRAILLE_FRAMES.length];
                const statusText = agent.status.substring(0, width - maxLabel - 15);
                lines.push(`${FG.gray}${BOX.lv}${RESET} ${agent.color}${frame}${RESET} ${label} ${dim(statusText)} ${dim(`(${elapsed}s)`)}${' '.repeat(Math.max(0, width - maxLabel - stripAnsi(statusText).length - 15))}${FG.gray}${BOX.lv}${RESET}`);
            }
        }

        lines.push(`${FG.gray}${BOX.lbl}${BOX.lh.repeat(width + 2)}${BOX.lbr}${RESET}`);

        for (const line of lines) {
            process.stdout.write(`${ESC}2K${line}\n`);
        }
        this._lineCount = lines.length;
    }
}

// ═══════════════════════════════════════════════════════════════════
// ═══ SYSTEM DASHBOARD ═══
// ═══════════════════════════════════════════════════════════════════

function systemDashboard(metrics) {
    const lines = [];

    for (const [label, data] of Object.entries(metrics)) {
        const { current, total, unit, color: clr } = data;
        const bar = progressBar(current, total, { width: 20, color: clr || FG.teal });
        const detail = unit || `${current}/${total}`;
        lines.push(`  ${bold(label.padEnd(14))} ${bar}  ${dim(detail)}`);
    }

    return box('SYSTEM CONDITIONS', lines, { color: FG.purple, width: 60 });
}

// ═══════════════════════════════════════════════════════════════════
// ═══ OUTPUT HELPERS (drop-in replacements for CLI) ═══
// ═══════════════════════════════════════════════════════════════════

function heading(text) {
    console.log('');
    console.log(`  ${FG.purple}${BOLD}◆ ${text}${RESET}`);
    console.log(`  ${FG.gray}${'─'.repeat(stripAnsi(text).length + 2)}${RESET}`);
}

function success(msg) { console.log(`  ${green('✓')} ${msg}`); }
function info(msg) { console.log(`  ${azure('ℹ')} ${msg}`); }
function warn(msg) { console.log(`  ${yellow('⚠')} ${msg}`); }
function errorMsg(msg) { console.error(`  ${red('✗')} ${msg}`); }
function debug(msg) { console.log(`  ${dim('⋯ ' + msg)}`); }

function divider(char = '─', width = 50) {
    console.log(`  ${FG.gray}${char.repeat(width)}${RESET}`);
}

function section(title) {
    console.log('');
    console.log(`  ${FG.gold}${BOLD}${title}${RESET}`);
    console.log(`  ${FG.gray}${'━'.repeat(stripAnsi(title).length)}${RESET}`);
}

function keyValue(key, value, opts = {}) {
    const keyWidth = opts.keyWidth || 16;
    const keyStr = `${dim(key.padEnd(keyWidth))}`;
    return `  ${keyStr} ${value}`;
}

// Provider status badges
function providerBadge(name, status) {
    const colors = {
        online: `${BG.teal}${FG.black}${BOLD} ${name} ${RESET}`,
        offline: `${BG.gray}${FG.white} ${name} ${RESET}`,
        error: `${FG.red}${BOLD} ${name} ${RESET}`,
    };
    return colors[status] || colors.offline;
}

// Health indicators
function healthDot(status) {
    const map = { healthy: green('●'), degraded: yellow('●'), down: red('●'), unknown: gray('○') };
    return map[status] || map.unknown;
}

// ═══════════════════════════════════════════════════════════════════
// ═══ MARKDOWN RENDERER (terminal-friendly) ═══
// ═══════════════════════════════════════════════════════════════════

function renderMarkdown(text) {
    return text
        .replace(/^### (.+)$/gm, (_, t) => `  ${FG.teal}${BOLD}${t}${RESET}`)
        .replace(/^## (.+)$/gm, (_, t) => `  ${FG.gold}${BOLD}${t}${RESET}`)
        .replace(/^# (.+)$/gm, (_, t) => `\n  ${FG.purple}${BOLD}${t}${RESET}\n  ${'━'.repeat(t.length)}`)
        .replace(/\*\*(.+?)\*\*/g, (_, t) => `${BOLD}${t}${RESET}`)
        .replace(/\*(.+?)\*/g, (_, t) => `${ITALIC}${t}${RESET}`)
        .replace(/`(.+?)`/g, (_, t) => `${FG.teal}${t}${RESET}`)
        .replace(/^- (.+)$/gm, (_, t) => `  ${FG.purple}•${RESET} ${t}`)
        .replace(/^\d+\. (.+)$/gm, (m, t, off, src) => {
            const num = m.match(/^(\d+)/)[1];
            return `  ${FG.gold}${num}.${RESET} ${t}`;
        });
}

// ═══════════════════════════════════════════════════════════════════
// ═══ UTILITY ═══
// ═══════════════════════════════════════════════════════════════════

function stripAnsi(str) {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function timestamp() {
    return dim(new Date().toLocaleTimeString());
}

function separator() {
    const cols = process.stdout.columns || 80;
    console.log(`${FG.gray}${'─'.repeat(Math.min(cols, 80))}${RESET}`);
}

// ═══════════════════════════════════════════════════════════════════
// ═══ EXPORTS ═══
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    // Colors
    FG, BG, RESET, BOLD, DIM, ITALIC, UNDERLINE,
    c, bold, dim, italic,
    purple, gold, teal, azure, mint, rose, gray, green, red, yellow,

    // Art
    HEADY_LOGO, printLogo,

    // Layout
    box, lightBox, divider, separator, section,
    BOX,

    // Tables
    table,

    // Progress
    Spinner, progressBar,
    SPINNER_FRAMES, BRAILLE_FRAMES,

    // Agent tracking
    AgentTracker,

    // Dashboard
    systemDashboard,

    // Output helpers
    heading, success, info, warn, errorMsg, debug,
    keyValue, providerBadge, healthDot,

    // Rendering
    renderMarkdown, stripAnsi, timestamp,
};
