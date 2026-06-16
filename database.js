const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

function initDatabase(dbPath) {
  // Ensure the directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT DEFAULT '',
      content     TEXT DEFAULT '',
      category    TEXT DEFAULT '灵感',
      color       TEXT DEFAULT '#ffffff',
      priority    TEXT DEFAULT 'medium' CHECK(priority IN ('high','medium','low')),
      is_pinned   INTEGER DEFAULT 0,
      is_starred  INTEGER DEFAULT 0,
      pos_x       REAL DEFAULT NULL,
      pos_y       REAL DEFAULT NULL,
      desktop_pos_x REAL DEFAULT NULL,
      desktop_pos_y REAL DEFAULT NULL,
      width       REAL DEFAULT 240,
      height      REAL DEFAULT 200,
      sort_order  INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now','localtime')),
      updated_at  TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_tags (
      note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
      tag_id  INTEGER REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (note_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT UNIQUE NOT NULL,
      icon  TEXT DEFAULT '📌'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Insert default categories if empty
  const catCount = db.prepare('SELECT count(*) as count FROM categories').get().count;
  if (catCount === 0) {
    const insertCat = db.prepare('INSERT INTO categories (name, icon) VALUES (?, ?)');
    insertCat.run('灵感', '💡');
    insertCat.run('备忘', '📌');
    insertCat.run('笔记', '📝');
    insertCat.run('待办', '✅');
  }

  // Insert default settings if empty
  const settingsCount = db.prepare('SELECT count(*) as count FROM settings').get().count;
  if (settingsCount === 0) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('theme', 'dark'); // default theme is dark
    insertSetting.run('layout_mode', 'free'); // 'free' or 'auto'
    insertSetting.run('sort_by', 'updated_at'); // 'updated_at', 'created_at', 'priority'
  }

  // Migrate existing databases: Add desktop_pos_x and desktop_pos_y if they don't exist
  try {
    db.prepare('ALTER TABLE notes ADD COLUMN desktop_pos_x REAL DEFAULT NULL').run();
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.prepare('ALTER TABLE notes ADD COLUMN desktop_pos_y REAL DEFAULT NULL').run();
  } catch (e) {
    // Column already exists, ignore
  }

  console.log('Database initialized at:', dbPath);
}

// Notes CRUD
function getNotes() {
  const notes = db.prepare('SELECT * FROM notes').all();
  // Fetch tags for each note
  for (const note of notes) {
    note.tags = getNoteTags(note.id);
  }
  return notes;
}

function getNoteById(id) {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  if (note) {
    note.tags = getNoteTags(note.id);
  }
  return note;
}

function createNote(noteData = {}) {
  const title = noteData.title || '';
  const content = noteData.content || '';
  const category = noteData.category || '灵感';
  const color = noteData.color || '#ffffff';
  const priority = noteData.priority || 'medium';
  const is_pinned = noteData.is_pinned || 0;
  const is_starred = noteData.is_starred || 0;
  const pos_x = noteData.pos_x !== undefined ? noteData.pos_x : null;
  const pos_y = noteData.pos_y !== undefined ? noteData.pos_y : null;
  const desktop_pos_x = noteData.desktop_pos_x !== undefined ? noteData.desktop_pos_x : null;
  const desktop_pos_y = noteData.desktop_pos_y !== undefined ? noteData.desktop_pos_y : null;
  const width = noteData.width || 240;
  const height = noteData.height || 200;
  const sort_order = noteData.sort_order || 0;

  const info = db.prepare(`
    INSERT INTO notes (title, content, category, color, priority, is_pinned, is_starred, pos_x, pos_y, desktop_pos_x, desktop_pos_y, width, height, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, content, category, color, priority, is_pinned, is_starred, pos_x, pos_y, desktop_pos_x, desktop_pos_y, width, height, sort_order);

  const noteId = info.lastInsertRowid;

  if (noteData.tags && Array.isArray(noteData.tags)) {
    setNoteTags(noteId, noteData.tags);
  }

  return getNoteById(noteId);
}

function updateNote(id, noteData = {}) {
  const fields = [];
  const values = [];

  // Exclude keys that shouldn't be directly updated this way or need special handling
  const specialKeys = ['id', 'created_at', 'tags'];
  
  for (const [key, val] of Object.entries(noteData)) {
    if (!specialKeys.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }

  // Always update updated_at
  fields.push("updated_at = datetime('now','localtime')");

  if (fields.length > 0) {
    values.push(id);
    db.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  if (noteData.tags && Array.isArray(noteData.tags)) {
    setNoteTags(id, noteData.tags);
  }

  return getNoteById(id);
}

function deleteNote(id) {
  // First clean up tags link (handled by ON DELETE CASCADE, but let's make sure if sqlite foreign keys are on)
  // Enable foreign keys just in case
  db.exec('PRAGMA foreign_keys = ON');
  const info = db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  return info.changes > 0;
}

// Categories
function getCategories() {
  return db.prepare('SELECT * FROM categories').all();
}

function createCategory(name, icon) {
  try {
    db.prepare('INSERT INTO categories (name, icon) VALUES (?, ?)').run(name, icon);
    return { name, icon };
  } catch (err) {
    console.error('Error creating category:', err);
    return null;
  }
}

function deleteCategory(name) {
  const info = db.prepare('DELETE FROM categories WHERE name = ?').run(name);
  return info.changes > 0;
}

// Tags & Note Tags
function getNoteTags(noteId) {
  const rows = db.prepare(`
    SELECT t.name FROM tags t
    JOIN note_tags nt ON nt.tag_id = t.id
    WHERE nt.note_id = ?
  `).all(noteId);
  return rows.map(r => r.name);
}

function getAllTags() {
  const rows = db.prepare('SELECT name FROM tags').all();
  return rows.map(r => r.name);
}

function setNoteTags(noteId, tagNames) {
  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON');

  // Remove existing links
  db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId);

  for (let tagName of tagNames) {
    tagName = tagName.trim().toLowerCase();
    if (!tagName) continue;

    // Ensure tag exists
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tagName);
    const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(tagName);

    if (tag) {
      db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId, tag.id);
    }
  }

  // Clean up unused tags
  db.prepare(`
    DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags)
  `).run();
}

// Settings
function getSettings() {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  return settings;
}

function saveSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

module.exports = {
  initDatabase,
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  getCategories,
  createCategory,
  deleteCategory,
  getAllTags,
  getNoteTags,
  setNoteTags,
  getSettings,
  saveSetting
};
