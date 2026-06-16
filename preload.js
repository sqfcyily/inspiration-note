const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  
  // Database operations
  getNotes: () => ipcRenderer.invoke('db-get-notes'),
  getNoteById: (id) => ipcRenderer.invoke('db-get-note-by-id', id),
  createNote: (noteData) => ipcRenderer.invoke('db-create-note', noteData),
  updateNote: (id, noteData) => ipcRenderer.invoke('db-update-note', id, noteData),
  deleteNote: (id) => ipcRenderer.invoke('db-delete-note', id),
  
  getCategories: () => ipcRenderer.invoke('db-get-categories'),
  createCategory: (name, icon) => ipcRenderer.invoke('db-create-category', name, icon),
  deleteCategory: (name) => ipcRenderer.invoke('db-delete-category', name),
  
  getAllTags: () => ipcRenderer.invoke('db-get-all-tags'),
  
  getSettings: () => ipcRenderer.invoke('db-get-settings'),
  saveSetting: (key, value) => ipcRenderer.invoke('db-save-setting', key, value),
  
  // Desktop Mode operations
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send('window-set-ignore-mouse-events', ignore),
  toggleDesktopMode: (enable) => ipcRenderer.send('window-toggle-desktop-mode', enable),
  onTrayToggleDesktopMode: (callback) => ipcRenderer.on('tray-toggle-desktop-mode', (e, enable) => callback(enable)),
  onTrayTogglePetVisibility: (callback) => ipcRenderer.on('tray-toggle-pet-visibility', (e, visible) => callback(visible)),
  togglePetVisibility: (visible) => ipcRenderer.send('window-toggle-pet-visibility', visible),
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  setAlwaysOnTop: (alwaysOnTop) => ipcRenderer.send('window-set-always-on-top', alwaysOnTop),
  openNewNoteFromPet: (coords) => ipcRenderer.send('window-open-editor-from-pet', coords),
  onOpenEditorFromPet: (callback) => ipcRenderer.on('open-editor-from-pet', (e, coords) => callback(coords)),
  onChangePet: (callback) => ipcRenderer.on('change-pet', (e, petKey) => callback(petKey)),
  
  // Listeners for shortcuts or events
  onNewNoteShortcut: (callback) => ipcRenderer.on('shortcut-new-note', () => callback()),
  log: (msg) => ipcRenderer.send('log-from-pet', msg)
});
