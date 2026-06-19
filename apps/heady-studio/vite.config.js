// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Studio — Vite config                                      ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { defineConfig } from 'vite';

// All runtime targets come from env (VITE_GATEWAY_URL etc.) — no localhost,
// no hardcoded origins baked into the bundle (AGENTS.md #4).
export default defineConfig({
  build: { outDir: 'dist', target: 'es2022', sourcemap: true },
  // Vite optimizer needs to pre-bundle the MCP SDK's deep ESM entry points.
  optimizeDeps: { include: ['@modelcontextprotocol/sdk/client/index.js', '@modelcontextprotocol/sdk/client/streamableHttp.js'] },
});
