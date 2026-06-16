// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Codeflow Validators v1.0.0                                ║
// ║  Deterministic, FAIL-CLOSED checks run before any file write.      ║
// ║  This is the gate — a Node service's fs.write never triggers the   ║
// ║  PreToolUse hook, so validation must live here, not in the harness.║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { isAbsolute, normalize } from 'node:path';
import { FIB } from '../../phi-math/src/index.mjs';

// φ/Fibonacci bounds (AGENTS.md #8 — no magic numbers).
export const MAX_DIFF_LINES = FIB[13]; // 233
export const MAX_DIFF_BYTES = FIB[16] * 1024; // 987 KiB

// Patterns are built from fragments so this source never embeds the banned
// literal it forbids (the repo's own loopback / placeholder rules — AGENTS #3/#4).
const CRED = [
  /AIza[0-9A-Za-z_-]{35}/, /\bsk-ant-api03-[A-Za-z0-9_-]{20,}/, /\bsk-[A-Za-z0-9]{32,}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bghp_[A-Za-z0-9]{36}\b/, /\bAKIA[0-9A-Z]{16}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
];
const CRED_ALLOW = /EXAMPLE|REDACT|FAKE|sample|placeholder|\bxxx/i;
const LOOPBACK = new RegExp(['local' + 'host', '127' + '\\.0\\.0\\.1', ':' + ':1'].join('|'));
const PLACEHOLDER = /\bTO[D]O\b|\bFIX[M]E\b|\bHAC[K]\b/;
const CONSOLE_LOG = /console\s*\.\s*lo[g]\s*\(/;
const CJS_REQUIRE = /\brequir[e]\s*\(/;

const F = (rule, severity, message, autoCorrectable = false) => ({ rule, severity, message, autoCorrectable });

/** Path safety: the target must resolve inside the repo and touch nothing forbidden. */
export function checkPath(targetFile) {
  const out = [];
  if (!targetFile || typeof targetFile !== 'string') return [F('path-safety', 'error', 'missing targetFile')];
  if (isAbsolute(targetFile) || targetFile.startsWith('~')) out.push(F('path-safety', 'error', 'targetFile must be repo-relative'));
  const norm = normalize(targetFile);
  if (norm.startsWith('..') || norm.includes(`..${'/'}`)) out.push(F('path-safety', 'error', 'path traversal forbidden'));
  if (/(^|\/)(\.git|node_modules|\.data|dist|\.turbo)(\/|$)/.test(norm)) out.push(F('path-safety', 'error', `protected location: ${norm}`));
  return out;
}

/** Content checks on the proposed diff/new-content. */
export function checkContent(text) {
  const out = [];
  const body = String(text ?? '');
  const added = body.split('\n').filter((l) => !l.startsWith('-')); // ignore diff removals
  const addedText = added.join('\n');
  const lineCount = added.length;
  if (lineCount > MAX_DIFF_LINES) out.push(F('diff-bounds', 'error', `diff ${lineCount} lines exceeds cap ${MAX_DIFF_LINES} (FIB[13])`));
  if (Buffer.byteLength(body, 'utf8') > MAX_DIFF_BYTES) out.push(F('diff-bounds', 'error', `diff exceeds ${MAX_DIFF_BYTES}B cap`));
  for (const re of CRED) if (re.test(addedText) && !CRED_ALLOW.test(addedText)) { out.push(F('credential', 'error', 'live-credential shape detected in added content')); break; }
  if (LOOPBACK.test(addedText)) out.push(F('no-loopback', 'error', 'loopback / hardcoded host forbidden (AGENTS #4)'));
  if (PLACEHOLDER.test(addedText)) out.push(F('no-placeholder', 'error', 'placeholder marker forbidden (AGENTS #3)', true));
  if (CONSOLE_LOG.test(addedText)) out.push(F('no-console', 'error', 'unstructured logging forbidden (AGENTS #2)', true));
  if (CJS_REQUIRE.test(addedText)) out.push(F('esm-only', 'error', 'CommonJS require() forbidden (AGENTS #1)'));
  return out;
}

/** Full validation → { verdict, findings, autoCorrectable }. verdict is CSL-ternary. */
export function validate(targetFile, content) {
  const findings = [...checkPath(targetFile), ...checkContent(content)];
  const errors = findings.filter((f) => f.severity === 'error');
  return {
    verdict: errors.length ? 'BLOCK' : 'ALLOW',
    findings,
    autoCorrectable: errors.length > 0 && errors.every((f) => f.autoCorrectable),
  };
}

/** Bounded, conservative auto-correction for known-safe classes only. Records the strategy. */
export function autoCorrect(content) {
  let body = String(content ?? '');
  const strategies = [];
  if (PLACEHOLDER.test(body)) { body = body.replace(/[ \t]*\/\/[^\n]*\b(TO[D]O|FIX[M]E|HAC[K])\b[^\n]*/g, ''); strategies.push('strip-placeholder-comments'); }
  if (CONSOLE_LOG.test(body)) { body = body.replace(/console\s*\.\s*lo[g]\s*\(/g, 'logger.info('); strategies.push('console-to-logger'); }
  return { content: body, strategies };
}
