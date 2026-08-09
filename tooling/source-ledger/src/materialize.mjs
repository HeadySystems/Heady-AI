// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Source Materializer v1.0.0                             ║
// ║  Reconstruct a clean filesystem projection from Neon source.   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

function assertSafeTarget(target, protectedRoot) {
  const destination = resolve(target);
  const protectedPath = resolve(protectedRoot);
  if (destination === protectedPath || protectedPath.startsWith(`${destination}${sep}`)) {
    throw new Error("materialization target cannot be the repository or one of its ancestors");
  }
  if (existsSync(destination) && (!lstatSync(destination).isDirectory() || readdirSync(destination).length > 0)) {
    throw new Error("materialization target must be absent or an empty directory");
  }
  return destination;
}

export function materializeRevision(entries, { target, protectedRoot }) {
  if (!target || !protectedRoot) throw new TypeError("target and protectedRoot are required");
  const destination = assertSafeTarget(target, protectedRoot);
  mkdirSync(destination, { recursive: true });
  for (const entry of entries) {
    const output = resolve(destination, entry.path);
    if (!output.startsWith(`${destination}${sep}`)) throw new Error(`unsafe source path: ${entry.path}`);
    mkdirSync(dirname(output), { recursive: true });
    if (Number(entry.fileMode) === 40960) {
      symlinkSync(entry.content.toString("utf8"), output);
      continue;
    }
    writeFileSync(output, entry.content, { flag: "wx", mode: Number(entry.fileMode) === 33261 ? 0o755 : 0o644 });
    chmodSync(output, Number(entry.fileMode) === 33261 ? 0o755 : 0o644);
  }
  return { destination, fileCount: entries.length };
}
