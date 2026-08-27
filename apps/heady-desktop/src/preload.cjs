// ╔════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Desktop Shell — sandboxed preload v1.0.0                  ║
// ║  CommonJS by Electron mandate: sandboxed preloads cannot use ESM  ║
// ║  (sandbox stays ON — AGENTS.md ESM law yields to the security     ║
// ║  boundary here). Exposes ONLY appVersion + platform, frozen,      ║
// ║  via contextBridge. No IPC surface, no node globals leak.         ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚═════════════════════════════════════════════════════════════════╝
'use strict';
const { contextBridge } = require('electron');

const VERSION_FLAG = '--heady-app-version=';
const appVersion =
  process.argv.find((arg) => arg.startsWith(VERSION_FLAG))?.slice(VERSION_FLAG.length) ?? 'unknown';

contextBridge.exposeInMainWorld(
  'headyDesktop',
  Object.freeze({
    appVersion,
    platform: process.platform,
  }),
);
