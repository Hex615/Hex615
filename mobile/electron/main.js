const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development';
const webDistPath = path.join(__dirname, '..', 'dist');

function createWindow() {
  const win = new BrowserWindow({
    width: 430,
    height: 932,
    minWidth: 360,
    minHeight: 640,
    backgroundColor: '#0A0A0A',
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    title: 'Chatsplat',
    show: false,
  });

  win.once('ready-to-show', () => win.show());

  // Open external links in default browser, not in-app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    win.loadURL('http://localhost:19006');
    win.webContents.openDevTools();
  } else {
    const indexPath = path.join(webDistPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      win.loadURL(`data:text/html,<h2 style="font-family:sans-serif;color:#fff;background:#0A0A0A;padding:40px">Build not found.<br>Run: npm run build:web first.</h2>`);
    } else {
      win.loadFile(indexPath);
    }
  }
}

// Remove default menu bar
Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
