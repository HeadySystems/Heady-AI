#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Portal PWA Icon Generator                                 ║
// ║  Renders public/favicon.svg → installable PNG icon set:           ║
// ║    icons/icon-{192,512}.png            purpose "any"              ║
// ║    icons/icon-maskable-{192,512}.png   purpose "maskable"         ║
// ║    apple-touch-icon.png                180×180 iOS home screen    ║
// ║  Glyph scale is φ-derived; canvas is dark-canon bg.primary from   ║
// ║  docs/design/design-tokens.json (color.dark.bg.primary #0a0a0f).  ║
// ║  Run: pnpm --filter headyme-portal icons                          ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync, mkdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { PSI } from "@heady/phi-math";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(HERE, "../../public");
const ICONS_DIR = resolve(PUBLIC_DIR, "icons");
const SVG_PATH = resolve(PUBLIC_DIR, "favicon.svg");

const log = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");

// Dark-canon background — design-tokens color.dark.bg.primary.
const CANVAS_BG = "#0a0a0f";
// Maskable safe zone is the inner 80% circle → a glyph spanning ψ (0.618)
// of the canvas edge sits comfortably inside it. "any" icons breathe less: √ψ.
const MASKABLE_GLYPH_SCALE = PSI;
const ANY_GLYPH_SCALE = Math.sqrt(PSI);

const svg = readFileSync(SVG_PATH);

async function renderIcon({ size, glyphScale, outPath }) {
  const glyphPx = Math.round(size * glyphScale);
  // Rasterize the SVG well above target resolution so blur filters stay smooth.
  const glyph = await sharp(svg, { density: Math.min(2400, Math.ceil((72 * glyphPx) / 46) * 2) })
    .resize(glyphPx, glyphPx, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: CANVAS_BG },
  })
    .composite([{ input: glyph, gravity: "center" }])
    .png()
    .toFile(outPath);

  const meta = await sharp(outPath).metadata();
  const bytes = statSync(outPath).size;
  if (!bytes || meta.width !== size || meta.height !== size || meta.format !== "png") {
    throw new Error(`icon verification failed for ${outPath}: ${bytes}B ${meta.width}x${meta.height} ${meta.format}`);
  }
  log({ evt: "heady.pwa.icon", out: outPath, size, bytes, glyph_px: glyphPx });
}

async function main() {
  mkdirSync(ICONS_DIR, { recursive: true });
  await renderIcon({ size: 192, glyphScale: ANY_GLYPH_SCALE, outPath: resolve(ICONS_DIR, "icon-192.png") });
  await renderIcon({ size: 512, glyphScale: ANY_GLYPH_SCALE, outPath: resolve(ICONS_DIR, "icon-512.png") });
  await renderIcon({ size: 192, glyphScale: MASKABLE_GLYPH_SCALE, outPath: resolve(ICONS_DIR, "icon-maskable-192.png") });
  await renderIcon({ size: 512, glyphScale: MASKABLE_GLYPH_SCALE, outPath: resolve(ICONS_DIR, "icon-maskable-512.png") });
  await renderIcon({ size: 180, glyphScale: ANY_GLYPH_SCALE, outPath: resolve(PUBLIC_DIR, "apple-touch-icon.png") });
  log({ evt: "heady.pwa.icons.done", count: 5 });
}

main().catch((err) => {
  process.stderr.write(JSON.stringify({ evt: "heady.pwa.icons.error", message: err.message }) + "\n");
  process.exit(1);
});
