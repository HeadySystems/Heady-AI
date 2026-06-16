// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Consistency Report Formatter v1.0.0                       ║
// ║  Renders findings as human text or machine JSON                   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

const MARK = { error: "✗", warn: "▲", info: "·" };

/** Human-readable report (returned as a string; the caller writes it out). */
export function formatHuman(result) {
  const { findings, summary } = result;
  const out = [];
  out.push("");
  out.push("HEADY™ global data-consistency report");
  out.push(
    `  scanned: ${summary.filesCanonical} canonical + ${summary.filesExtended} extended (legacy reference) files`,
  );
  out.push("");

  if (findings.length === 0) {
    out.push("  ✓ no inconsistencies found — all data is globally consistent.");
    out.push("");
    return out.join("\n");
  }

  const byInvariant = new Map();
  for (const f of findings) {
    if (!byInvariant.has(f.invariant)) byInvariant.set(f.invariant, []);
    byInvariant.get(f.invariant).push(f);
  }

  for (const [inv, group] of byInvariant) {
    const sev = group[0].severity;
    out.push(`${MARK[sev] ?? "·"} [${inv}] ${group.length} finding(s) — authority: ${group[0].authority}`);
    out.push(`    ${group[0].message}`);
    for (const f of group) {
      const fixHint = f.fix ? `  → fix: ${f.fix}` : "";
      out.push(`      ${f.severity.toUpperCase()} ${f.file}:${f.line}:${f.column}${fixHint}`);
      out.push(`        ${f.excerpt}`);
    }
    out.push("");
  }

  out.push(
    `  summary: ${summary.errors} error(s), ${summary.warns} warning(s) across ${summary.total} finding(s).`,
  );
  out.push(summary.ok ? "  gate: PASS (no errors)." : "  gate: FAIL (errors present).");
  out.push("");
  return out.join("\n");
}

/** Machine-readable JSON report. */
export function formatJson(result) {
  return JSON.stringify(result, null, 2);
}
