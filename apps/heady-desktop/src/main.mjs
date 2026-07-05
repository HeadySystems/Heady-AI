// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Desktop Shell — main process v1.0.0                       ║
// ║  Hardened Electron window around the deployed HeadyMe portal.     ║
// ║  Portal origin chain: HEADY_PORTAL_URL env → facts.yaml-derived   ║
// ║  default (src/generated/build-info.json). HTTPS-only, fail-closed.║
// ║  Honest offline fallback page + φ-backoff auto-retry.             ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { app, BrowserWindow, dialog, session, shell } from 'electron';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PHI = 1.618033988749895;
const RETRY_BASE_MS = Math.round(PHI * 1000); // 1618ms φ-base
const RETRY_CAP_MS = 34000; // fib(9) seconds cap

const log = (level, msg, fields = {}) =>
  process.stdout.write(
    `${JSON.stringify({ level, msg, svc: 'heady-desktop/main', ts: new Date().toISOString(), ...fields })}\n`,
  );

// ── Identity + portal origin (fail-closed) ──────────────────────────
function loadBuildInfo() {
  const infoPath = path.join(here, 'generated', 'build-info.json');
  try {
    const info = JSON.parse(readFileSync(infoPath, 'utf8'));
    if (info.schema !== 'heady-desktop.build-info.v1' || !info.portalUrl) {
      throw new Error(`unexpected build-info schema: ${info.schema}`);
    }
    return info;
  } catch (err) {
    log('error', 'build-info.json missing/invalid — run `pnpm --filter heady-desktop sync:facts`', {
      infoPath,
      err: String(err),
    });
    dialog.showErrorBox(
      'Heady Desktop — broken build',
      'src/generated/build-info.json is missing or invalid. This build was not produced by the facts.yaml sync step.',
    );
    app.exit(1);
    return null;
  }
}

function resolvePortalUrl(buildInfo) {
  const raw = process.env.HEADY_PORTAL_URL ?? buildInfo.portalUrl;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    parsed = null;
  }
  if (!parsed || parsed.protocol !== 'https:') {
    // Cloud-deployed origins only: anything that is not https is refused outright.
    log('error', 'portal URL rejected — https origins only', { raw });
    dialog.showErrorBox('Heady Desktop — invalid portal URL', `Refusing non-https portal target: ${raw}`);
    app.exit(1);
    return null;
  }
  return parsed;
}

const buildInfo = loadBuildInfo();
const portal = buildInfo ? resolvePortalUrl(buildInfo) : null;

// In-window navigation allowlist beyond the portal origin — exactly this
// stack's auth chain, nothing generic:
//   *.cloudflareaccess.com   Cloudflare Access interstitial fronting 1ime1.com
//                            (facts.yaml dns_observed: https-302-cloudflare-access)
//   accounts.google.com      Google IdP hop used by both Access and Firebase Auth
//   heady-ai.firebaseapp.com Firebase Auth handler (deploy workflow VITE_FIREBASE_AUTH_DOMAIN)
//   auth.headysystems.com    Heady cross-domain SSO (AGENTS.md auth layer)
// Renderer navigation anywhere else leaves for the system browser.
const AUTH_HOSTS = new Set(['accounts.google.com', 'heady-ai.firebaseapp.com', 'auth.headysystems.com']);
const isAllowedInWindow = (target) =>
  target.protocol === 'https:' &&
  (target.origin === portal?.origin || AUTH_HOSTS.has(target.host) || target.host.endsWith('.cloudflareaccess.com'));

// ── Single-instance lock ────────────────────────────────────────────
if (portal && !app.requestSingleInstanceLock()) {
  log('info', 'second instance refused — focusing primary');
  app.quit();
}

let mainWindow = null;
let retryTimer = null;
let retryAttempt = 0;

function clearRetry() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  retryAttempt = 0;
}

function scheduleRetry(win) {
  if (retryTimer || win.isDestroyed()) return;
  const delay = Math.min(Math.round(RETRY_BASE_MS * PHI ** retryAttempt), RETRY_CAP_MS);
  retryAttempt += 1;
  log('info', 'scheduling portal retry', { attempt: retryAttempt, delayMs: delay });
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (!win.isDestroyed()) win.loadURL(portal.href);
  }, delay);
}

function showOfflinePage(win, errorCode, errorDescription) {
  if (win.isDestroyed()) return;
  win.loadFile(path.join(here, 'offline.html'), {
    query: {
      target: portal.href,
      host: portal.host,
      version: app.getVersion(),
      code: String(errorCode),
      detail: errorDescription || 'network unreachable',
    },
  });
  scheduleRetry(win);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0d0a1a',
    icon: path.join(here, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      preload: path.join(here, 'preload.cjs'),
      additionalArguments: [`--heady-app-version=${app.getVersion()}`],
    },
  });

  win.once('ready-to-show', () => win.show());

  // External links → default browser; no in-app popups.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Navigation policy: portal origin + its auth chain + the packaged offline page.
  win.webContents.on('will-navigate', (event, targetUrl) => {
    let target;
    try {
      target = new URL(targetUrl);
    } catch {
      event.preventDefault();
      return;
    }
    const isPackagedFile = target.protocol === 'file:' && target.pathname.endsWith('/offline.html');
    if (isAllowedInWindow(target) || isPackagedFile) return;
    event.preventDefault();
    if (target.protocol === 'https:') shell.openExternal(target.href);
    log('info', 'navigation redirected to system browser', { target: target.origin });
  });

  // Chromium fires did-finish-load even for a failed main-frame navigation
  // (its internal error page), with getURL() still reporting the target URL —
  // so success is only trusted when the same navigation did not fail first.
  let mainFrameFailed = false;
  win.webContents.on('did-start-loading', () => {
    mainFrameFailed = false;
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return; // -3 = aborted (user navigation race)
    mainFrameFailed = true;
    log('warn', 'portal load failed — showing offline page', { errorCode, errorDescription, validatedURL });
    showOfflinePage(win, errorCode, errorDescription);
  });

  win.webContents.on('did-finish-load', () => {
    const current = win.webContents.getURL();
    if (!mainFrameFailed && current.startsWith(portal.origin)) {
      clearRetry();
      log('info', 'portal loaded', { origin: portal.origin, version: app.getVersion() });
    }
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    log('error', 'renderer gone — reloading portal', { reason: details.reason, exitCode: details.exitCode });
    if (!win.isDestroyed()) showOfflinePage(win, 0, `renderer ${details.reason}`);
  });

  win.on('closed', () => {
    clearRetry();
    mainWindow = null;
  });

  win.loadURL(portal.href);
  return win;
}

if (portal) {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // No embedded webviews, ever.
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });

  log('info', 'heady-desktop starting', {
    version: app.getVersion(),
    portal: portal.origin,
    portalSource: process.env.HEADY_PORTAL_URL ? 'env:HEADY_PORTAL_URL' : 'facts.yaml',
    platform: process.platform,
    electron: process.versions.electron,
    packaged: app.isPackaged,
  });

  app.whenReady().then(() => {
    // Permission policy: portal origin may use notifications + sanitized clipboard; everything else is denied.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
      const fromPortal = details.requestingUrl?.startsWith(portal.origin) === true;
      const allowed = fromPortal && (permission === 'notifications' || permission === 'clipboard-sanitized-write');
      if (!allowed) log('info', 'permission denied', { permission, requestingUrl: details.requestingUrl });
      callback(allowed);
    });

    mainWindow = createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
