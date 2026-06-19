// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Enforcer — Agent-Onboarding Integrity v1.0.0              ║
// ║  Fail-closed gate that keeps the agent front door real: any AI    ║
// ║  agent entering this repo must be routed to START_HERE.md, and    ║
// ║  the .claude agent config must be sound. Without this, the front  ║
// ║  door can be deleted or unlinked and the next agent is lost.      ║
// ║  Validation, not token-scan (the .claude tree legitimately names  ║
// ║  the forbidden tokens, so the Law enforcers exempt it).           ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/files.mjs';

const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: 'enforcer', enforcer: 'agent-onboarding', level, msg, ...f })}\n`);

// The single front door, and the entry points that MUST route an agent to it.
const FRONT_DOOR = 'START_HERE.md';
const ENTRY_POINTS = ['CLAUDE.md', 'AGENTS.md', 'README.md'];
// Spec files an oriented agent relies on existing.
const REQUIRED_SPEC = ['AGENTS.md', 'CLAUDE_MEMORY.md'];
// Bytes of file head inspected for the HEADY_BRAND header (AGENTS.md #6).
const HEADER_WINDOW = 600;
// Hard ceiling for executing a SessionStart hook so a hung hook cannot wedge CI.
const HOOK_EXEC_TIMEOUT_MS = 13000;

// ── Pure helpers (exported for the test harness) ─────────────────────

/** Does a file's text route the reader to the front door? */
export function referencesFrontDoor(text) {
  return text.includes(FRONT_DOOR);
}

/** Parse settings.json text. @returns {{ok:true,settings:object}|{ok:false,error:string}} */
export function parseSettings(text) {
  try {
    return { ok: true, settings: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Extract every `.claude/hooks/<file>.mjs` referenced by a hook command, with its event. */
export function extractHookFiles(settings) {
  const refs = [];
  const hooks = settings?.hooks ?? {};
  const ref = /\.claude\/hooks\/([A-Za-z0-9._-]+\.mjs)/;
  for (const [event, entries] of Object.entries(hooks)) {
    for (const entry of entries ?? []) {
      for (const h of entry?.hooks ?? []) {
        const m = typeof h?.command === 'string' ? h.command.match(ref) : null;
        if (m) refs.push({ event, file: m[1] });
      }
    }
  }
  return refs;
}

/** True when the brand header is present near the top of a source file. */
export function hasBrandHeader(text) {
  return /HEADY/i.test(text.slice(0, HEADER_WINDOW));
}

/** True when stdout is the documented SessionStart hook contract. */
export function isSessionStartContract(stdout) {
  try {
    const j = JSON.parse(stdout);
    return j?.hookSpecificOutput?.hookEventName === 'SessionStart';
  } catch {
    return false;
  }
}

// ── Runner ───────────────────────────────────────────────────────────
function run() {
  const findings = [];
  const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');
  const has = (rel) => existsSync(resolve(ROOT, rel));

  // A. The front door must exist.
  if (!has(FRONT_DOOR)) {
    findings.push({ rule: 'missing-front-door', file: FRONT_DOOR, evidence: 'the agent onboarding entry point is gone' });
  }

  // B. Every entry point must route the agent to the front door.
  for (const ep of ENTRY_POINTS) {
    if (!has(ep)) { findings.push({ rule: 'missing-entry-point', file: ep, evidence: 'expected agent entry file is absent' }); continue; }
    if (!referencesFrontDoor(read(ep))) {
      findings.push({ rule: 'entry-point-unlinked', file: ep, evidence: `does not reference ${FRONT_DOOR}` });
    }
  }

  // C. Required spec files must exist.
  for (const spec of REQUIRED_SPEC) {
    if (!has(spec)) findings.push({ rule: 'missing-spec', file: spec, evidence: 'required spec file is absent' });
  }

  // D. The .claude agent config must be sound.
  const settingsRel = '.claude/settings.json';
  if (has(settingsRel)) {
    const parsed = parseSettings(read(settingsRel));
    if (!parsed.ok) {
      findings.push({ rule: 'invalid-settings-json', file: settingsRel, evidence: `${parsed.error} — this silently disables ALL settings` });
    } else {
      const refs = extractHookFiles(parsed.settings);
      const sessionStart = new Set(refs.filter((r) => r.event === 'SessionStart').map((r) => r.file));

      for (const { event, file } of refs) {
        if (!has(`.claude/hooks/${file}`)) {
          findings.push({ rule: 'missing-hook-file', file: `.claude/hooks/${file}`, evidence: `referenced by hooks.${event} but not on disk` });
        }
      }

      const hooksDir = resolve(ROOT, '.claude/hooks');
      const hookFiles = existsSync(hooksDir) ? readdirSync(hooksDir).filter((f) => f.endsWith('.mjs')) : [];
      for (const file of hookFiles) {
        const abs = resolve(hooksDir, file);
        const rel = `.claude/hooks/${file}`;

        if (!hasBrandHeader(readFileSync(abs, 'utf8'))) {
          findings.push({ rule: 'no-brand-header', file: rel, evidence: 'missing HEADY_BRAND header (AGENTS.md #6)' });
        }
        try {
          execFileSync('node', ['--check', abs], { stdio: ['ignore', 'ignore', 'pipe'] });
        } catch (err) {
          findings.push({ rule: 'syntax-error', file: rel, evidence: String(err.stderr || err.message).trim().slice(0, 200) });
          continue;
        }
        if (sessionStart.has(file)) {
          try {
            const out = execFileSync('node', [abs], { input: '', timeout: HOOK_EXEC_TIMEOUT_MS, encoding: 'utf8' });
            if (!isSessionStartContract(out)) {
              findings.push({ rule: 'bad-sessionstart-contract', file: rel, evidence: 'did not emit hookSpecificOutput.hookEventName === "SessionStart"' });
            }
          } catch (err) {
            findings.push({ rule: 'sessionstart-crash', file: rel, evidence: String(err.message).trim().slice(0, 200) });
          }
        }
      }
    }
  }

  for (const f of findings) log('error', `AGENT-ONBOARDING ${f.rule}`, { file: f.file, evidence: f.evidence });
  log(findings.length ? 'error' : 'info', 'agent-onboarding complete', {
    frontDoor: FRONT_DOOR, entryPoints: ENTRY_POINTS.length, violations: findings.length,
  });
  return findings.length ? 2 : 0;
}

// Run only as a CLI, never on import (so the test harness can load the helpers).
if (resolve(process.argv[1] ?? '') === resolve(new URL(import.meta.url).pathname)) {
  process.exit(run());
}
