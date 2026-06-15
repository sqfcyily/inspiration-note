const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
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
  
  // Listeners for shortcuts or events
  onNewNoteShortcut: (callback) => ipcRenderer.on('shortcut-new-note', () => callback())
});
