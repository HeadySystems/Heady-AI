const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

const TARGET_URLS = {
  'HeadyWeb': 'https://headysystems.com',
  'HeadyBuddy': 'https://buddy.headysystems.com',
  'HeadyAI-IDE': 'https://ide.headysystems.com'
};

function createWindow () {
  const APP_TARGET = app.getName();
  const targetUrl = TARGET_URLS[APP_TARGET] || TARGET_URLS['HeadyWeb'];

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: APP_TARGET,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Remove default menu to act more like a standalone chromeless app
  Menu.setApplicationMenu(null);

  mainWindow.loadURL(targetUrl);
  
  // Handle external links normally (optional but good for web wrappers)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
