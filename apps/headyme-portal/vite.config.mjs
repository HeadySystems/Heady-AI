// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Portal Vite Config — PWA version injection                ║
// ║  • __HEADY_VERSION__ define ← facts.yaml product.version (SoT)    ║
// ║  • heady-sw-stamp plugin (closeBundle, i.e. after the publicDir   ║
// ║    copy so nothing clobbers it): reads src/pwa/sw.js, injects the ║
// ║    {{HEADY_SW_VERSION}} build stamp (version+build id, so every   ║
// ║    deploy rolls the SW byte-diff → auto-update toast fires),      ║
// ║    writes dist/sw.js; also pins the manifest "version" field.     ║
// ║  No vite-plugin-pwa — the hand-rolled SW is the deliverable.      ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));

function readProductVersion() {
  const facts = readFileSync(resolve(HERE, "../../facts.yaml"), "utf8");
  const match = facts.match(/^product:\r?\n(?:[ \t]+\S[^\n]*\r?\n)*?[ \t]+version:[ \t]*"?([\w.+-]+)"?/m);
  if (!match) {
    throw new Error("heady-sw-stamp: facts.yaml product.version not found — refusing to build unversioned SW");
  }
  return match[1];
}

const APP_VERSION = readProductVersion();
// Build id rolls the stamp every build: same app version, new deploy →
// byte-different sw.js → browsers see an update → toast flow engages.
const SW_VERSION = `${APP_VERSION}.${Date.now().toString(36)}`;

function headySwStamp() {
  let outDir = resolve(HERE, "dist");
  return {
    name: "heady-sw-stamp",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    // closeBundle runs after every writeBundle hook, including Vite's
    // internal publicDir copy — dist/manifest.webmanifest exists and
    // nothing will overwrite the files stamped here.
    closeBundle() {
      const swSource = readFileSync(resolve(HERE, "src/pwa/sw.js"), "utf8");
      if (!swSource.includes("{{HEADY_SW_VERSION}}")) {
        throw new Error("heady-sw-stamp: src/pwa/sw.js is missing the {{HEADY_SW_VERSION}} stamp marker");
      }
      writeFileSync(resolve(outDir, "sw.js"), swSource.replace("{{HEADY_SW_VERSION}}", SW_VERSION));

      const manifestPath = resolve(outDir, "manifest.webmanifest");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.version = APP_VERSION;
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

      process.stdout.write(
        JSON.stringify({ evt: "heady.pwa.stamp", sw_version: SW_VERSION, manifest_version: APP_VERSION }) + "\n"
      );
    },
  };
}

export default defineConfig({
  define: {
    __HEADY_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [headySwStamp()],
});
