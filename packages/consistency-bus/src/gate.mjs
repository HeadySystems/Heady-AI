// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Consistency Bus — Gate (GatePort) v1.0.0                  ║
// ║  After any propagation, the coherence kernel must be green — the    ║
// ║  fail-closed proof that data is consistent system-wide.            ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);

/** Run the coherence gate; returns { green, errors }. Fail-closed: unknown → not green. */
export function verifyConsistent({ root = ROOT } = {}) {
  try {
    execFileSync('node', ['tooling/coherence/src/coherence.mjs', 'check'], { cwd: root, stdio: 'ignore' });
    return { green: true, errors: 0 };
  } catch {
    try {
      const r = JSON.parse(readFileSync(join(root, '.data', 'coherence', 'coherence-report.json'), 'utf8'));
      return { green: r.errors === 0, errors: r.errors };
    } catch { return { green: false, errors: -1 }; }
  }
}
