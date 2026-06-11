// Electron main process for Chatsplat / splatchat.
//
// The app is a React Native (Expo) project exported to a static web bundle via
// react-native-web (`npm run build:web` -> ./web-build). Expo's single-page web
// output references its JS/asset bundles with absolute (`/_expo/...`) paths,
// which do not resolve under the file:// protocol. To avoid that, we serve the
// exported bundle from a tiny in-process HTTP server bound to 127.0.0.1 and
// point the BrowserWindow at it. No extra npm dependency required.

const { app, BrowserWindow, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const WEB_DIR = path.join(__dirname, '..', 'web-build');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

// Serve index.html with the Expo entry bundle loaded as an ES module. Expo's
// exported index.html references the bundle with a classic <script defer>, but
// the bundle contains `import.meta` (e.g. from zustand's ESM build), which is a
// syntax error outside a module and blanks the whole app. Marking it
// type="module" makes `import.meta` legal.
function sendIndex(res) {
  fs.readFile(path.join(WEB_DIR, 'index.html'), 'utf8', (err, html) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const patched = html.replace(
      /<script(\s+)src=("\/_expo\/static\/js\/web\/[^"]+")/,
      '<script$1type="module" src=$2'
    );
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    res.end(patched);
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';

      let filePath = path.join(WEB_DIR, path.normalize(urlPath));

      // Prevent path traversal outside the web build directory.
      if (!filePath.startsWith(WEB_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      if (path.basename(filePath) === 'index.html') {
        sendIndex(res);
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          // SPA fallback: unknown routes (and missing files) serve index.html
          // so client-side navigation works.
          sendIndex(res);
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });

    server.on('error', reject);
    // Port 0 => OS assigns a free port.
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

let mainWindow;

async function createWindow() {
  if (!fs.existsSync(path.join(WEB_DIR, 'index.html'))) {
    // No build present — fail loudly with guidance rather than a blank window.
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Web build missing',
      'web-build/index.html was not found.\n\nRun "npm run build:web" first (or use "npm run electron").'
    );
    app.quit();
    return;
  }

  const baseUrl = await startServer();

  mainWindow = new BrowserWindow({
    width: 430,
    height: 880,
    backgroundColor: '#0A0A0A',
    title: 'Chatsplat',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open external links in the system browser, not inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Grant microphone/camera permission requests so the Agora Web SDK can capture
  // audio (and video) in the Electron renderer. This is a local desktop app
  // loading our own bundle, so auto-approving media permissions is safe here.
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(true);
  });

  // Surface renderer console + load failures to the main process stdout so
  // problems are visible without the GUI devtools.
  mainWindow.webContents.on('console-message', (...args) => {
    // Electron <35: (event, level, message, line, sourceId)
    // Electron >=35: (event, details)
    const d =
      args[1] && typeof args[1] === 'object'
        ? args[1]
        : { level: args[1], message: args[2], lineNumber: args[3], sourceId: args[4] };
    console.log(`[renderer:${d.level}] ${d.message} (${d.sourceId || ''}:${d.lineNumber || ''})`);
  });
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.log(`[did-fail-load] code=${code} desc=${desc} url=${url}`);
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.log('[render-process-gone] ' + JSON.stringify(details));
  });
  mainWindow.webContents.on('unresponsive', () => console.log('[unresponsive]'));

  mainWindow.loadURL(baseUrl);

  if (process.env.ELECTRON_OPEN_DEVTOOLS) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
