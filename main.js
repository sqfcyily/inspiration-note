const { app, BrowserWindow, ipcMain, Tray, Menu, shell } = require('electron');
const path = require('path');
const dbHelper = require('./database');

let mainWindow = null;
let tray = null;
let isQuitting = false;

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'inspiration-note.db');
  dbHelper.initDatabase(dbPath);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, // frameless window
    icon: path.join(__dirname, 'src', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false, // show after ready-to-show to prevent white flash
    backgroundColor: '#0f0f14' // matching dark theme background
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Intercept standard in-app hyperlink clicks and redirect to external browser
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Intercept new window creations (e.g. target="_blank" links)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle close event to minimize to tray
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // Use a default icon or generate a simple mock one, we will use a fallback or standard icon
  // For Windows, a 16x16 or 32x32 ico or png is fine
  // Since we don't have an icon yet, we can use a dummy file or create a simple visual icon.
  // We will create a small icon file using canvas, or copy a blank file. Let's make a simple icon png.
  const iconPath = path.join(__dirname, 'src', 'assets', 'icon.png');
  
  // Create folders if they don't exist
  const assetsDir = path.dirname(iconPath);
  if (!require('fs').existsSync(assetsDir)){
    require('fs').mkdirSync(assetsDir, { recursive: true });
  }

  // Write a simple placeholder file for icon if not exists, so it doesn't crash tray creation.
  // Actually, we can use nativeImage.createFromPath or create an empty PNG to prevent errors.
  // If the file doesn't exist, Electron might show a warning. We'll write a simple 1x1 blank transparent PNG or similar.
  // Better: We will write a tiny valid 1x1 pixel PNG.
  const blankPngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  if (!require('fs').existsSync(iconPath)) {
    require('fs').writeFileSync(iconPath, blankPngBuffer);
  }

  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: '显示主窗口', 
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      } 
    },
    {
      label: '新建便签',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('shortcut-new-note');
        }
      }
    },
    { type: 'separator' },
    { 
      label: '退出', 
      click: () => {
        isQuitting = true;
        app.quit();
      } 
    }
  ]);

  tray.setToolTip('灵感便签');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// IPC Handlers
function registerIpcHandlers() {
  // Window controls
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) {
      mainWindow.close(); // triggers 'close' event which hides window
    }
  });

  // DB IPC Handlers
  ipcMain.handle('db-get-notes', async () => {
    return dbHelper.getNotes();
  });

  ipcMain.handle('db-get-note-by-id', async (event, id) => {
    return dbHelper.getNoteById(id);
  });

  ipcMain.handle('db-create-note', async (event, noteData) => {
    return dbHelper.createNote(noteData);
  });

  ipcMain.handle('db-update-note', async (event, id, noteData) => {
    return dbHelper.updateNote(id, noteData);
  });

  ipcMain.handle('db-delete-note', async (event, id) => {
    return dbHelper.deleteNote(id);
  });

  ipcMain.handle('db-get-categories', async () => {
    return dbHelper.getCategories();
  });

  ipcMain.handle('db-create-category', async (event, name, icon) => {
    return dbHelper.createCategory(name, icon);
  });

  ipcMain.handle('db-delete-category', async (event, name) => {
    return dbHelper.deleteCategory(name);
  });

  ipcMain.handle('db-get-all-tags', async () => {
    return dbHelper.getAllTags();
  });

  ipcMain.handle('db-get-settings', async () => {
    return dbHelper.getSettings();
  });

  ipcMain.handle('db-save-setting', async (event, key, value) => {
    return dbHelper.saveSetting(key, value);
  });
}

// App lifecycle
app.whenReady().then(() => {
  initDatabase();
  createMainWindow();
  createTray();
  registerIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
