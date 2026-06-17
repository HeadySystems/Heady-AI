// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Enforcer Lib — Rule Definitions v1.0.0                     ║
// ║  Pure, side-effect-free regex rule sets shared by the governance   ║
// ║  enforcers and their tests. Single source of truth for the         ║
// ║  forbidden-pattern contract documented in                          ║
// ║  governance/enforcement/ENF-anti-shortcut.md.                      ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝

// ── Law 0: No-Localhost ──────────────────────────────────────────────
export const LOCALHOST_RULES = [
  { id: 'localhost', re: /\blocalhost\b/i },
  { id: 'loopback-v4', re: /\b127\.0\.0\.1\b/ },
  { id: 'all-ifaces', re: /\b0\.0\.0\.0\b/ },
  { id: 'loopback-v6', re: /(?:^|[^:\w])::1(?:[^:\w]|$)/ },
  { id: 'hardcoded-port', re: /(https?:\/\/[^\s'"`]*:\d{2,5}\b|(?:host|hostname|HOST)\s*[:=]\s*['"`][^'"`]*:\d{2,5})/ },
];

// ── Laws 1 & 2: Glass-Box (no unstructured logging / no placeholders) ─
export const GLASSBOX_LINE_RULES = [
  { id: 'console', re: /\bconsole\s*\.\s*(log|warn|error|info|debug|trace|dir)\b/ },
  { id: 'placeholder', re: /\b(TODO|FIXME|HACK|XXX|KLUDGE|TEMP)\b/ },
  { id: 'ts-suppress', re: /@ts-(ignore|nocheck)\b|eslint-disable(?!-next-line)\b/ },
  { id: 'stub-throw', re: /throw\s+new\s+Error\(\s*['"`](not\s+implemented|todo|stub)/i },
];
export const GLASSBOX_BLOCK_RULES = [
  { id: 'empty-catch', re: /catch\s*\([^)]*\)\s*\{\s*\}/ },
  { id: 'empty-then', re: /\.then\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/ },
];

// ── Law 0: Secret-Scan (high-confidence credential signatures) ───────
export const SECRET_RULES = [
  { id: 'private-key-block', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/ },
  { id: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'gcp-api-key', re: /\bAIza[0-9A-Za-z_\-]{35}\b/ },
  { id: 'github-token', re: /\bgh[pousr]_[0-9A-Za-z]{36,}\b/ },
  { id: 'slack-token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { id: 'stripe-key', re: /\b(?:sk|rk)_(?:live|test)_[0-9A-Za-z]{16,}\b/ },
  { id: 'openai-key', re: /\bsk-(?:proj-)?[0-9A-Za-z_\-]{32,}\b/ },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b/ },
  { id: 'generic-secret', re: /(?:secret|password|passwd|token|api[_-]?key|private[_-]?key)\s*[:=]\s*['"`][0-9A-Za-z+/=_\-]{20,}['"`]/i },
];
export const SECRET_DUMMY_ALLOW = /(\$\{?[A-Z0-9_]+\}?|process\.env|<[^>]+>|XXXX|placeholder|example|changeme|dummy|REDACTED|\*{4,})/i;
export const FIREBASE_PUBLIC = /apiKey\s*:\s*['"`]AIza/;

/**
 * Scan a single text blob line-by-line against a rule set.
 * @returns {{rule:string,line:number,text:string}[]}
 */
export function scanText(text, rules) {
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    for (const r of rules) {
      if (r.re.test(lines[i])) out.push({ rule: r.id, line: i + 1, text: lines[i].trim().slice(0, 200) });
    }
  }
  return out;
}
