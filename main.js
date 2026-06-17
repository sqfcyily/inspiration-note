const { app, BrowserWindow, ipcMain, Tray, Menu, shell } = require('electron');
const path = require('path');
const dbHelper = require('./database');

let mainWindow = null;
let petWindow = null;
let tray = null;
let isQuitting = false;
let trayContextMenu = null;
let isDesktopMode = false;

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
    transparent: true, // transparent window support
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    icon: path.join(__dirname, 'src', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false // show after ready-to-show to prevent white flash
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



  mainWindow.on('blur', () => {
    if (isDesktopMode) {
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }
  });

  mainWindow.on('focus', () => {
    if (isDesktopMode) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createPetWindow(x, y, width, height) {
  if (petWindow) {
    petWindow.setPosition(x, y);
    petWindow.setSize(width, height);
    petWindow.show();
    return;
  }

  petWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  petWindow.setPosition(x, y);
  petWindow.setSize(width, height);

  petWindow.setAlwaysOnTop(true, 'screen-saver');
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  petWindow.setIgnoreMouseEvents(true, { forward: true });
  petWindow.loadFile(path.join(__dirname, 'src', 'pet.html'));

  petWindow.on('closed', () => {
    petWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'src', 'assets', 'icon.png');
  const blankPngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  if (!require('fs').existsSync(iconPath)) {
    require('fs').writeFileSync(iconPath, blankPngBuffer);
  }

  const settings = dbHelper.getSettings();
  const activePet = settings.active_pet || 'harlequin';
  const isDesktop = settings.layout_mode === 'desktop';
  const petVisibleSetting = settings.pet_visible !== 'false';

  tray = new Tray(iconPath);
  trayContextMenu = Menu.buildFromTemplate([
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
    {
      label: '桌面模式',
      type: 'checkbox',
      id: 'desktop-mode-item',
      checked: isDesktop,
      click: (menuItem) => {
        if (mainWindow) {
          mainWindow.webContents.send('tray-toggle-desktop-mode', menuItem.checked);
        }
      }
    },
    {
      label: '选择桌宠',
      type: 'submenu',
      submenu: [
        {
          label: '不显示',
          type: 'radio',
          id: 'pet-none-item',
          checked: !petVisibleSetting,
          click: () => {
            dbHelper.saveSetting('pet_visible', 'false');
            if (petWindow) {
              petWindow.webContents.send('tray-toggle-pet-visibility', false);
            }
          }
        },
        {
          label: '哈利昆 (Harlequin)',
          type: 'radio',
          id: 'pet-harlequin-item',
          checked: petVisibleSetting && activePet === 'harlequin',
          click: () => {
            dbHelper.saveSetting('pet_visible', 'true');
            dbHelper.saveSetting('active_pet', 'harlequin');
            if (petWindow) {
              petWindow.webContents.send('tray-toggle-pet-visibility', true);
              petWindow.webContents.send('change-pet', 'harlequin');
            }
          }
        },
        {
          label: '路飞 (Luffy)',
          type: 'radio',
          id: 'pet-luffy-item',
          checked: petVisibleSetting && activePet === 'monkey-d-luffy',
          click: () => {
            dbHelper.saveSetting('pet_visible', 'true');
            dbHelper.saveSetting('active_pet', 'monkey-d-luffy');
            if (petWindow) {
              petWindow.webContents.send('tray-toggle-pet-visibility', true);
              petWindow.webContents.send('change-pet', 'monkey-d-luffy');
            }
          }
        },
        {
          label: '小光 (Hikari)',
          type: 'radio',
          id: 'pet-hikari-item',
          checked: petVisibleSetting && activePet === 'hikari',
          click: () => {
            dbHelper.saveSetting('pet_visible', 'true');
            dbHelper.saveSetting('active_pet', 'hikari');
            if (petWindow) {
              petWindow.webContents.send('tray-toggle-pet-visibility', true);
              petWindow.webContents.send('change-pet', 'hikari');
            }
          }
        },
        {
          label: '龙卷 (Tatsumaki)',
          type: 'radio',
          id: 'pet-tatsumaki-item',
          checked: petVisibleSetting && activePet === 'tatsumaki',
          click: () => {
            dbHelper.saveSetting('pet_visible', 'true');
            dbHelper.saveSetting('active_pet', 'tatsumaki');
            if (petWindow) {
              petWindow.webContents.send('tray-toggle-pet-visibility', true);
              petWindow.webContents.send('change-pet', 'tatsumaki');
            }
          }
        },
        {
          label: '熊猫',
          type: 'radio',
          id: 'pet-koro-item',
          checked: petVisibleSetting && activePet === 'kоро',
          click: () => {
            dbHelper.saveSetting('pet_visible', 'true');
            dbHelper.saveSetting('active_pet', 'kоро');
            if (petWindow) {
              petWindow.webContents.send('tray-toggle-pet-visibility', true);
              petWindow.webContents.send('change-pet', 'kоро');
            }
          }
        }
      ]
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

  tray.setToolTip('便签精灵');
  tray.setContextMenu(trayContextMenu);

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
  ipcMain.on('log-from-pet', (event, msg) => {
    console.log('[PET RENDERER LOG]:', msg);
  });

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

  ipcMain.on('window-set-ignore-mouse-events', (event, ignore) => {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    if (win) {
      win.setIgnoreMouseEvents(ignore, { forward: true });
    }
  });

  ipcMain.on('window-set-always-on-top', (event, alwaysOnTop) => {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    if (win) {
      if (alwaysOnTop) {
        win.setAlwaysOnTop(true, 'screen-saver');
        win.show();
        win.focus();
      } else {
        win.setAlwaysOnTop(false);
      }
    }
  });

  ipcMain.on('window-open-editor-from-pet', (event, coords) => {
    if (mainWindow) {
      mainWindow.webContents.send('open-editor-from-pet', coords);
    }
  });

  ipcMain.on('window-toggle-pet-visibility', (event, visible) => {
    if (trayContextMenu) {
      if (!visible) {
        const item = trayContextMenu.getMenuItemById('pet-none-item');
        if (item) item.checked = true;
      } else {
        const settings = dbHelper.getSettings();
        const activePet = settings.active_pet || 'harlequin';
        if (activePet === 'harlequin') {
          const item = trayContextMenu.getMenuItemById('pet-harlequin-item');
          if (item) item.checked = true;
        } else if (activePet === 'monkey-d-luffy') {
          const item = trayContextMenu.getMenuItemById('pet-luffy-item');
          if (item) item.checked = true;
        } else if (activePet === 'hikari') {
          const item = trayContextMenu.getMenuItemById('pet-hikari-item');
          if (item) item.checked = true;
        } else if (activePet === 'tatsumaki' || activePet === 'd9qt2pik') {
          const item = trayContextMenu.getMenuItemById('pet-tatsumaki-item');
          if (item) item.checked = true;
        } else if (activePet === 'kоро') {
          const item = trayContextMenu.getMenuItemById('pet-koro-item');
          if (item) item.checked = true;
        }
      }
    }
  });

  ipcMain.on('window-toggle-desktop-mode', (event, enable) => {
    if (mainWindow) {
      isDesktopMode = enable;

      if (enable) {
        const { screen } = require('electron');
        const displays = screen.getAllDisplays();
        
        let minX = displays[0].bounds.x;
        let minY = displays[0].bounds.y;
        let maxX = displays[0].bounds.x + displays[0].bounds.width;
        let maxY = displays[0].bounds.y + displays[0].bounds.height;
        
        displays.forEach((display) => {
          const { x, y, width, height } = display.bounds;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x + width > maxX) maxX = x + width;
          if (y + height > maxY) maxY = y + height;
        });
        
        const totalWidth = maxX - minX;
        const totalHeight = maxY - minY;
        
        mainWindow.setPosition(minX, minY);
        mainWindow.setSize(totalWidth, totalHeight);
        mainWindow.setSkipTaskbar(true);
        if (process.platform === 'darwin') {
          mainWindow.setWindowLevel('desktop');
        } else {
          mainWindow.setAlwaysOnTop(false);
          mainWindow.setIgnoreMouseEvents(true, { forward: true });
        }

        // Create independent always-on-top pet window
        createPetWindow(minX, minY, totalWidth, totalHeight);
      } else {
        mainWindow.setSkipTaskbar(false);
        if (process.platform === 'darwin') {
          mainWindow.setWindowLevel('normal');
        } else {
          mainWindow.setAlwaysOnTop(false);
        }
        mainWindow.setSize(1100, 800);
        mainWindow.center();

        // Close and clean up pet window
        if (petWindow) {
          petWindow.close();
          petWindow = null;
        }
      }
      
      // Update tray checkbox checked status
      if (trayContextMenu) {
        const item = trayContextMenu.getMenuItemById('desktop-mode-item');
        if (item) item.checked = enable;
      }
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

  ipcMain.handle('get-displays', async () => {
    const { screen } = require('electron');
    return screen.getAllDisplays().map(d => ({
      id: d.id,
      bounds: { x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height },
      workArea: { x: d.workArea.x, y: d.workArea.y, width: d.workArea.width, height: d.workArea.height }
    }));
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
