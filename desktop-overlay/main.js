// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: desktop-overlay/main.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  HEADY SYSTEMS                                                 ║
 * ║  ━━━━━━━━━━━━━━                                                ║
 * ║  ∞ Sacred Geometry Architecture ∞                              ║
 * ║                                                                ║
 * ║  main.js — Electron main process for HeadyBuddy Desktop       ║
 * ║  Overlay. Creates a frameless, always-on-top, transparent      ║
 * ║  window anchored to the bottom-right of the screen.            ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store({
  defaults: {
    apiBase: "https://manager.headysystems.com",
    wsEndpoint: "wss://manager.headysystems.com/ws/buddy",
    position: { x: null, y: null },
    collapsed: true,
    opacity: 0.95,
    alwaysOnTop: true,
    globalHotkey: "CommandOrControl+Shift+H",
    quietMode: false,
    autoStart: true,
    taskAutomation: true,
    screenAssist: false,
    theme: "sacred-dark",
    userId: null,
    authToken: null,
  },
});

const IS_DEV = process.argv.includes("--dev");
const WIDGET_WIDTH = 420;
const WIDGET_HEIGHT = 700;
const PILL_WIDTH = 220;
const PILL_HEIGHT = 56;

let mainWindow = null;
let tray = null;
let isCollapsed = store.get("collapsed");

function createWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  const savedPos = store.get("position");

  const x = savedPos.x != null ? savedPos.x : screenW - WIDGET_WIDTH - 24;
  const y = savedPos.y != null ? savedPos.y : screenH - WIDGET_HEIGHT - 24;

  mainWindow = new BrowserWindow({
    width: isCollapsed ? PILL_WIDTH : WIDGET_WIDTH,
    height: isCollapsed ? PILL_HEIGHT : WIDGET_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: store.get("alwaysOnTop"),
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setOpacity(store.get("opacity"));

  if (IS_DEV) {
    mainWindow.loadURL("http://api.headysystems.com:3400");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const widgetPath = path.join(process.resourcesPath, "widget", "index.html");
    mainWindow.loadFile(widgetPath).catch(() => {
      mainWindow.loadFile(path.join(__dirname, "..", "headybuddy", "dist", "index.html"));
    });
  }

  mainWindow.on("moved", () => {
    const [mx, my] = mainWindow.getPosition();
    store.set("position", { x: mx, y: my });
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

function createTray() {
  const iconPath = path.join(__dirname, "icons", "tray-icon.png");
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) throw new Error("empty");
  } catch {
    // Generate a 16x16 placeholder tray icon (blue circle)
    const size = 16;
    const canvas = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - 7.5, dy = y - 7.5;
        const inside = (dx * dx + dy * dy) <= 49;
        const i = (y * size + x) * 4;
        canvas[i] = inside ? 66 : 0;     // R
        canvas[i+1] = inside ? 133 : 0;  // G
        canvas[i+2] = inside ? 244 : 0;  // B
        canvas[i+3] = inside ? 255 : 0;  // A
      }
    }
    trayIcon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  }

  tray = new Tray(trayIcon);
  tray.setToolTip("HeadyBuddy — Perfect Day AI Companion");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show / Hide",
      click: () => toggleVisibility(),
    },
    {
      label: "Always on Top",
      type: "checkbox",
      checked: store.get("alwaysOnTop"),
      click: (item) => {
        store.set("alwaysOnTop", item.checked);
        if (mainWindow) mainWindow.setAlwaysOnTop(item.checked);
      },
    },
    {
      label: "Quiet Mode",
      type: "checkbox",
      checked: store.get("quietMode"),
      click: (item) => {
        store.set("quietMode", item.checked);
        if (mainWindow) mainWindow.webContents.send("quiet-mode", item.checked);
      },
    },
    { type: "separator" },
    {
      label: "Reset Position",
      click: () => {
        store.set("position", { x: null, y: null });
        if (mainWindow) {
          const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
          mainWindow.setPosition(sw - WIDGET_WIDTH - 24, sh - WIDGET_HEIGHT - 24);
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit HeadyBuddy",
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", () => toggleVisibility());
}

function toggleVisibility() {
  if (!mainWindow) return createWindow();
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function resizeForState(collapsed) {
  if (!mainWindow) return;
  isCollapsed = collapsed;
  store.set("collapsed", collapsed);

  const [cx, cy] = mainWindow.getPosition();
  const newW = collapsed ? PILL_WIDTH : WIDGET_WIDTH;
  const newH = collapsed ? PILL_HEIGHT : WIDGET_HEIGHT;

  // Keep bottom-right anchor stable
  const dx = (collapsed ? WIDGET_WIDTH : PILL_WIDTH) - newW;
  const dy = (collapsed ? WIDGET_HEIGHT : PILL_HEIGHT) - newH;
  mainWindow.setBounds({ x: cx + dx, y: cy + dy, width: newW, height: newH }, true);
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Initialize IPC handlers after app is ready
  ipcMain.on("widget-state", (event, state) => {
    resizeForState(state === "pill");
  });

  ipcMain.handle("get-config", () => ({
    apiBase: store.get("apiBase"),
    quietMode: store.get("quietMode"),
  }));

  ipcMain.handle("set-config", (event, key, value) => {
    store.set(key, value);
    return true;
  });

  ipcMain.handle("get-system-info", () => {
    const os = require("os");
    return {
      platform: process.platform,
      arch: process.arch,
      cpus: os.cpus().length,
      totalMemMB: Math.round(os.totalmem() / 1048576),
      freeMemMB: Math.round(os.freemem() / 1048576),
      hostname: os.hostname(),
      uptime: os.uptime(),
    };
  });

  // Task automation - execute system commands on behalf of user
  ipcMain.handle("execute-task", async (event, task) => {
    const { exec } = require("child_process");
    const allowedTypes = ["open-url", "open-app", "file-search", "clipboard", "notify"];
    if (!allowedTypes.includes(task.type)) {
      return { success: false, error: "Task type not permitted" };
    }
    try {
      switch (task.type) {
        case "open-url": {
          const { shell } = require("electron");
          await shell.openExternal(task.url);
          return { success: true };
        }
        case "open-app": {
          return new Promise((resolve) => {
            exec(task.command, { timeout: 10000 }, (err) => {
              resolve({ success: !err, error: err?.message });
            });
          });
        }
        case "clipboard": {
          const { clipboard } = require("electron");
          if (task.action === "read") return { success: true, data: clipboard.readText() };
          if (task.action === "write") { clipboard.writeText(task.data); return { success: true }; }
          return { success: false, error: "Invalid clipboard action" };
        }
        case "notify": {
          const { Notification } = require("electron");
          new Notification({ title: task.title || "HeadyBuddy", body: task.body }).show();
          return { success: true };
        }
        case "file-search": {
          const { dialog } = require("electron");
          const result = await dialog.showOpenDialog(mainWindow, {
            properties: ["openFile", "multiSelections"],
            filters: task.filters || [],
          });
          return { success: !result.canceled, files: result.filePaths };
        }
        default:
          return { success: false, error: "Unknown task type" };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Screen capture for AI-assisted screen reading
  ipcMain.handle("capture-screen", async () => {
    if (!store.get("screenAssist")) return { success: false, error: "Screen assist disabled" };
    try {
      const { desktopCapturer } = require("electron");
      const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1280, height: 720 } });
      if (sources.length === 0) return { success: false, error: "No screen sources" };
      const thumbnail = sources[0].thumbnail.toDataURL();
      return { success: true, image: thumbnail };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Auth token management
  ipcMain.handle("set-auth", (event, token, userId) => {
    store.set("authToken", token);
    store.set("userId", userId);
    return { success: true };
  });

  ipcMain.handle("get-auth", () => ({
    token: store.get("authToken"),
    userId: store.get("userId"),
  }));

  // WebSocket connection management for real-time buddy features
  ipcMain.handle("get-ws-endpoint", () => store.get("wsEndpoint"));

  const hotkey = store.get("globalHotkey");
  try {
    globalShortcut.register(hotkey, toggleVisibility);
  } catch (err) {
    console.warn(`Failed to register hotkey ${hotkey}: ${err.message}`);
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  // Keep running in tray
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
});

