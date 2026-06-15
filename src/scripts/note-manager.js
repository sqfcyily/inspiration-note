// Note Manager (CRUD, Editor Dialog and Board Render)
class NoteManager {
  constructor() {
    this.notes = [];
    this.currentEditingId = null; // null means creating a new note
    this.activeColor = '#ffffff'; // default note color
    
    // Board DOM
    this.board = document.getElementById('notes-board');
    this.container = document.getElementById('notes-container');
    this.emptyState = document.getElementById('empty-state');
    
    // Modal DOM
    this.modal = document.getElementById('editor-modal');
    this.modalTitle = document.getElementById('editor-title');
    this.modalCategory = document.getElementById('editor-category');
    this.modalContent = document.getElementById('editor-content');
    this.modalPreview = document.getElementById('editor-preview');
    this.modalStarBtn = document.getElementById('editor-star-btn');
    this.modalPinBtn = document.getElementById('editor-pin-btn');
    this.modalDeleteBtn = document.getElementById('editor-delete-btn');
    this.modalSaveBtn = document.getElementById('editor-save-btn');
    this.modalCloseBtn = document.getElementById('editor-close-btn');
    this.colorPalette = document.getElementById('editor-color-palette');
    
    // Modal tabs
    this.tabEdit = document.getElementById('tab-edit-btn');
    this.tabPreview = document.getElementById('tab-preview-btn');
    
    this.colorMap = {
      '#8b5cf6': 'purple',
      '#10b981': 'green',
      '#f59e0b': 'orange',
      '#3b82f6': 'blue',
      '#ec4899': 'pink',
      '#eab308': 'yellow',
      '#64748b': 'gray',
      '#ffffff': 'white'
    };

    // New Note double-click coordinates (only used in free layout mode)
    this.dblClickCoords = null;

    this.init();
  }

  init() {
    // Register event listeners
    document.getElementById('new-note-btn').addEventListener('click', () => this.openEditor(null));
    
    // Board double click to create note
    this.board.addEventListener('dblclick', (e) => {
      // Ensure we double clicked on the board background or container, not on an existing card
      if (e.target === this.board || e.target === this.container || e.target.id === 'empty-state') {
        if (window.layoutManager && window.layoutManager.layoutMode === 'free') {
          // Store click offset coords relative to notes container
          const rect = this.container.getBoundingClientRect();
          this.dblClickCoords = {
            x: e.clientX - rect.left + this.board.scrollLeft,
            y: e.clientY - rect.top + this.board.scrollTop
          };
        }
        this.openEditor(null);
      }
    });

    // Close button
    this.modalCloseBtn.addEventListener('click', () => this.closeEditor());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeEditor();
    });

    // Modal action buttons
    this.modalSaveBtn.addEventListener('click', () => this.saveNote());
    this.modalDeleteBtn.addEventListener('click', async () => {
      if (this.currentEditingId) {
        const confirmed = await window.showConfirm(
          '删除便签',
          '确定要删除这篇便签吗？此操作将永久删除且无法撤销。',
          '确认删除',
          '取消'
        );
        if (confirmed) {
          this.deleteNote(this.currentEditingId);
        }
      }
    });

    this.modalStarBtn.addEventListener('click', () => {
      this.modalStarBtn.classList.toggle('active');
    });
    this.modalPinBtn.addEventListener('click', () => {
      this.modalPinBtn.classList.toggle('active');
    });

    // Tab buttons
    this.tabEdit.addEventListener('click', () => this.switchTab('edit'));
    this.tabPreview.addEventListener('click', () => this.switchTab('preview'));

    // Create color palette
    this.renderColorPalette();
    
    // Priority select buttons
    document.querySelectorAll('.priority-group .btn-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.priority-group .btn-toggle').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });
  }

  // Load and cache all notes from database
  async loadNotes() {
    try {
      this.notes = await window.api.getNotes();
      
      // Update sidebar badge counters
      if (window.sidebarManager) {
        window.sidebarManager.updateCounts(this.notes);
        window.sidebarManager.renderTagsCloud(this.notes);
      }
      
      this.renderNotes();
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
  }

  // Populates dropdown elements inside modal with categories
  async populateCategoryDropdowns() {
    try {
      const categories = await window.api.getCategories();
      this.modalCategory.innerHTML = '';
      categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = `${cat.icon || '📌'} ${cat.name}`;
        this.modalCategory.appendChild(option);
      });
    } catch (err) {
      console.error('Failed to load categories for dropdown:', err);
    }
  }

  // Render color options in modal
  renderColorPalette() {
    this.colorPalette.innerHTML = '';
    Object.keys(this.colorMap).forEach(color => {
      const div = document.createElement('div');
      div.className = 'color-option';
      div.style.backgroundColor = color;
      if (color === this.activeColor) {
        div.classList.add('selected');
      }
      div.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(d => d.classList.remove('selected'));
        div.classList.add('selected');
        this.activeColor = color;
      });
      this.colorPalette.appendChild(div);
    });
  }

  // Open the Editor Dialog
  async openEditor(noteId = null) {
    // Prevent opening editor if confirm delete dialog is currently active
    const confirmModal = document.getElementById('confirm-modal');
    if (confirmModal && confirmModal.style.display === 'flex') {
      return;
    }

    this.currentEditingId = noteId;
    await this.populateCategoryDropdowns();
    this.switchTab('edit'); // reset tab

    if (noteId) {
      // Edit mode: fetch note data
      const note = this.notes.find(n => n.id === noteId);
      if (!note) return;

      this.modalTitle.value = note.title || '';
      this.modalContent.value = note.content || '';
      this.modalCategory.value = note.category || '灵感';
      
      // Star & Pin
      if (note.is_starred) this.modalStarBtn.classList.add('active');
      else this.modalStarBtn.classList.remove('active');
      
      if (note.is_pinned) this.modalPinBtn.classList.add('active');
      else this.modalPinBtn.classList.remove('active');

      // Priority
      document.querySelectorAll('.priority-group .btn-toggle').forEach(b => {
        if (b.dataset.priority === note.priority) b.classList.add('active');
        else b.classList.remove('active');
      });

      // Color selection
      this.activeColor = note.color || '#ffffff';
      document.querySelectorAll('.color-option').forEach(el => {
        const bg = this.rgbToHex(el.style.backgroundColor);
        if (bg === this.activeColor) el.classList.add('selected');
        else el.classList.remove('selected');
      });

      this.modalDeleteBtn.style.display = 'block';
    } else {
      // New note mode: clear form
      this.modalTitle.value = '';
      this.modalContent.value = '';
      this.modalCategory.selectedIndex = 0;
      this.modalStarBtn.classList.remove('active');
      this.modalPinBtn.classList.remove('active');
      
      // Default to medium priority
      document.querySelectorAll('.priority-group .btn-toggle').forEach(b => {
        if (b.dataset.priority === 'medium') b.classList.add('active');
        else b.classList.remove('active');
      });

      // Default color white
      this.activeColor = '#ffffff';
      document.querySelectorAll('.color-option').forEach(el => {
        const bg = this.rgbToHex(el.style.backgroundColor);
        if (bg === '#ffffff') el.classList.add('selected');
        else el.classList.remove('selected');
      });

      this.modalDeleteBtn.style.display = 'none';
    }

    this.modal.style.display = 'flex';
    this.modalContent.focus();
  }

  closeEditor() {
    this.modal.style.display = 'none';
    this.dblClickCoords = null;
  }

  switchTab(tab) {
    if (tab === 'edit') {
      this.tabEdit.classList.add('active');
      this.tabPreview.classList.remove('active');
      this.modalContent.style.display = 'block';
      this.modalPreview.style.display = 'none';
    } else {
      this.tabEdit.classList.remove('active');
      this.tabPreview.classList.add('active');
      this.modalContent.style.display = 'none';
      this.modalPreview.style.display = 'block';
      
      // Parse markdown contents
      const markdownRaw = this.modalContent.value || '*无内容*';
      this.modalPreview.innerHTML = marked.parse(markdownRaw);
      
      // Highlight code blocks in modal preview
      if (window.Prism) {
        window.Prism.highlightAllUnder(this.modalPreview);
      }
    }
  }

  // Parse hashtags like #note #idea in text
  extractTags(text) {
    const regex = /#([a-zA-Z0-9_\u4e00-\u9fa5]+)/g;
    const tags = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      const tag = match[1].trim().toLowerCase();
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    }
    return tags;
  }

  // Save changes (Insert or Update)
  async saveNote() {
    const title = this.modalTitle.value.trim();
    const content = this.modalContent.value;
    const category = this.modalCategory.value;
    const color = this.activeColor;
    
    const priorityBtn = document.querySelector('.priority-group .btn-toggle.active');
    const priority = priorityBtn ? priorityBtn.dataset.priority : 'medium';
    
    const is_starred = this.modalStarBtn.classList.contains('active') ? 1 : 0;
    const is_pinned = this.modalPinBtn.classList.contains('active') ? 1 : 0;
    
    // Parse tags from markdown body
    const tags = this.extractTags(content);

    const noteData = {
      title,
      content,
      category,
      color,
      priority,
      is_starred,
      is_pinned,
      tags
    };

    try {
      if (this.currentEditingId) {
        // Update Note
        await window.api.updateNote(this.currentEditingId, noteData);
      } else {
        // Create Note
        // If double clicked somewhere in free mode, use that position
        if (this.dblClickCoords) {
          noteData.pos_x = this.dblClickCoords.x;
          noteData.pos_y = this.dblClickCoords.y;
        } else if (window.layoutManager && window.layoutManager.layoutMode === 'free') {
          // Standard position placement
          const pos = window.layoutManager.getNextFreePosition(this.notes);
          noteData.pos_x = pos.x;
          noteData.pos_y = pos.y;
        }
        
        await window.api.createNote(noteData);
      }

      this.closeEditor();
      await this.loadNotes();
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  }

  async deleteNote(id) {
    try {
      const success = await window.api.deleteNote(id);
      if (success) {
        this.closeEditor();
        await this.loadNotes();
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  }

  // Helper toggle pin from card directly
  async togglePin(id, currentPinned) {
    try {
      await window.api.updateNote(id, { is_pinned: currentPinned ? 0 : 1 });
      await this.loadNotes();
    } catch (err) {
      console.error('Failed to toggle pin state:', err);
    }
  }

  // Helper toggle star from card directly
  async toggleStar(id, currentStarred) {
    try {
      await window.api.updateNote(id, { is_starred: currentStarred ? 0 : 1 });
      await this.loadNotes();
    } catch (err) {
      console.error('Failed to toggle star state:', err);
    }
  }

  // Render notes board
  renderNotes() {
    this.container.innerHTML = '';
    
    // 1. Filter notes from sidebar
    let filteredNotes = window.sidebarManager ? window.sidebarManager.filterNotes(this.notes) : this.notes;
    
    // 2. Filter notes from search
    if (window.searchManager) {
      filteredNotes = filteredNotes.filter(note => window.searchManager.matches(note));
    }
    
    // 3. Sort notes for auto layout
    const isAutoMode = window.layoutManager && window.layoutManager.layoutMode === 'auto';
    if (isAutoMode && window.layoutManager) {
      filteredNotes = window.layoutManager.sortNotes(filteredNotes);
    }

    // Toggle Empty State visibility
    if (filteredNotes.length === 0) {
      this.emptyState.style.display = 'block';
      this.board.classList.add('empty-board');
    } else {
      this.emptyState.style.display = 'none';
      this.board.classList.remove('empty-board');
    }

    // Update Note Count statusbar text
    document.getElementById('note-count-status').textContent = `便签总数: ${filteredNotes.length}`;

    // 4. Render each card
    filteredNotes.forEach(note => {
      const card = this.createNoteCardElement(note, isAutoMode);
      this.container.appendChild(card);
      
      // Run Prism code block syntax highlighting
      if (window.Prism) {
        window.Prism.highlightAllUnder(card);
      }
      
      // Perform safe highlight if search is active
      if (window.searchManager && window.searchManager.searchQuery) {
        window.searchManager.highlightElement(card.querySelector('.note-title'));
        window.searchManager.highlightElement(card.querySelector('.note-body'));
      }
    });

    // Adjust container size dynamically to fit notes and remove default scrollbars
    this.adjustContainerSizeFromDOM();
  }

  // Adjust canvas size to fit all note cards and remove static scrollbar range
  adjustContainerSizeFromDOM() {
    if (window.layoutManager && window.layoutManager.layoutMode === 'auto') {
      this.container.style.width = '';
      this.container.style.height = '';
      return;
    }

    const cards = this.container.querySelectorAll('.note-card');
    if (cards.length === 0) {
      this.container.style.width = '100%';
      this.container.style.height = '100%';
      return;
    }

    let maxX = 0;
    let maxY = 0;

    cards.forEach(card => {
      const x = parseInt(card.style.left) || 0;
      const y = parseInt(card.style.top) || 0;
      const w = card.offsetWidth || 240;
      const h = card.offsetHeight || 220;

      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    });

    const padding = 100;
    const boardWidth = this.board.clientWidth || (window.innerWidth - 240);
    const boardHeight = this.board.clientHeight || (window.innerHeight - 80);

    const finalWidth = Math.max(maxX + padding, boardWidth);
    const finalHeight = Math.max(maxY + padding, boardHeight);

    this.container.style.width = `${finalWidth}px`;
    this.container.style.height = `${finalHeight}px`;
  }

  // Create a note card DOM element
  createNoteCardElement(note, isAutoMode) {
    const card = document.createElement('div');
    card.className = `note-card`;
    card.dataset.id = note.id;
    
    // Color mapping class
    const colorClass = this.colorMap[note.color] || 'white';
    card.classList.add(`note-color-${colorClass}`);

    // Set positions for free drag layout
    if (!isAutoMode) {
      const x = note.pos_x !== null ? note.pos_x : 40;
      const y = note.pos_y !== null ? note.pos_y : 40;
      card.style.left = `${x}px`;
      card.style.top = `${y}px`;
      card.style.width = `${note.width || 240}px`;
      card.style.height = `${note.height || 220}px`;
    }

    // Render markdown preview
    const parsedBody = marked.parse(note.content || '*空白便签*');

    // Human readable date (updated_at)
    const formattedDate = this.formatDateString(note.updated_at);

    // Dynamic tags HTML
    let tagsHtml = '';
    if (note.tags && note.tags.length > 0) {
      tagsHtml = note.tags.map(t => `<span class="note-tag-pill">#${t}</span>`).join('');
    }

    // Inner HTML structure
    card.innerHTML = `
      <div class="note-header">
        <div class="priority-flag priority-${note.priority}" title="优先级: ${note.priority === 'high' ? '高' : note.priority === 'medium' ? '中' : '低'}"></div>
        ${note.is_pinned ? `<span class="note-pin-indicator" title="已置顶"><svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg></span>` : ''}
        <span class="note-title">${note.title || '无标题'}</span>
        <div class="note-actions">
          <button class="note-card-btn edit-card-btn" title="编辑">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button class="note-card-btn delete-card-btn" title="删除">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
          <button class="note-card-btn toggle-star-btn ${note.is_starred ? 'starred' : ''}" title="${note.is_starred ? '取消收藏' : '收藏'}">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
          </button>
          <button class="note-card-btn toggle-pin-btn ${note.is_pinned ? 'pinned' : ''}" title="${note.is_pinned ? '取消置顶' : '置顶'}">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2zm-5.2 2H9.2l1.8-1.8V4h2v8.2l1.8 1.8h-3.6z"/></svg>
          </button>
        </div>
      </div>
      
      <div class="note-body">
        ${parsedBody}
      </div>
      
      <div class="note-footer">
        <span class="note-date">${formattedDate}</span>
        <div class="note-meta-tags">
          ${tagsHtml}
        </div>
      </div>
      <div class="note-resize-handle"></div>
    `;

    // Bind event listeners on card children
    card.querySelector('.note-body').addEventListener('dblclick', (e) => {
      // Only handle left clicks to prevent conflicts with context menus
      if (e.button !== 0) return;
      
      // Stop double click from bubbling up to the board dblclick event
      e.stopPropagation();
      
      // Check if clicking links or checkboxes, don't open editor if so
      if (e.target.tagName !== 'A' && e.target.type !== 'checkbox') {
        this.openEditor(note.id);
      }
    });

    // Directly open editor from edit button
    card.querySelector('.edit-card-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.openEditor(note.id);
    });

    // Delete note button
    card.querySelector('.delete-card-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await window.showConfirm(
        '删除便签',
        '确定要删除这篇便签吗？此操作将永久删除且无法撤销。',
        '确认删除',
        '取消'
      );
      if (confirmed) {
        this.deleteNote(note.id);
      }
    });

    // Directly toggle star / pin buttons
    card.querySelector('.toggle-star-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleStar(note.id, note.is_starred);
    });
    
    card.querySelector('.toggle-pin-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePin(note.id, note.is_pinned);
    });

    return card;
  }

  // Converts color palette rgb string from css to hex
  rgbToHex(rgbStr) {
    if (!rgbStr) return '#ffffff';
    if (rgbStr.startsWith('#')) return rgbStr;
    const match = rgbStr.match(/\d+/g);
    if (!match || match.length < 3) return '#ffffff';
    const r = parseInt(match[0]);
    const g = parseInt(match[1]);
    const b = parseInt(match[2]);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Format date to local readable format
  formatDateString(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr.replace(/-/g, '/')); // replace for cross platform compatibility
      const now = new Date();
      
      // Check if today
      if (date.toDateString() === now.toDateString()) {
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        return `今天 ${h}:${m}`;
      }
      
      const mon = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      return `${mon}/${d} ${h}:${m}`;
    } catch (e) {
      return dateStr;
    }
  }
}

window.noteManager = new NoteManager();
