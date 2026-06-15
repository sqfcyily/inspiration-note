// Sidebar Manager
class SidebarManager {
  constructor() {
    this.currentFilterType = 'all'; // 'all', 'starred', 'pinned', 'category', 'tag'
    this.currentFilterValue = null;
    
    this.categoriesList = document.getElementById('categories-list');
    this.tagsList = document.getElementById('tags-list');
    
    // Add category DOM
    this.addCategoryToggle = document.getElementById('add-category-toggle-btn');
    this.addCategoryForm = document.getElementById('add-category-form');
    this.newCatNameInput = document.getElementById('new-category-name');
    this.newCatIconBtn = document.getElementById('new-category-icon-btn');
    this.emojiPicker = document.getElementById('new-category-emoji-picker');
    this.newCatSubmit = document.getElementById('new-category-submit');
    this.newCatCancel = document.getElementById('new-category-cancel');
    
    // Emoji Selection list and state
    this.selectedEmoji = '💡';
    this.emojis = ['💡', '📌', '📝', '✅', '⭐', '💼', '🎓', '🎨', '🎵', '✈️', '🛒', '🍔', '🏠', '🎮', '💬', '❤️'];

    this.init();
  }

  init() {
    // View Filters Listeners
    document.querySelectorAll('.sidebar-menu[data-filter] .sidebar-menu-item, li[data-filter]').forEach(item => {
      item.addEventListener('click', (e) => {
        const menuItem = e.currentTarget;
        const filter = menuItem.dataset.filter;
        this.selectFilter('view', filter, menuItem);
      });
    });

    // Category Creation Toggle
    this.addCategoryToggle.addEventListener('click', () => this.toggleAddCategoryForm(true));
    this.newCatCancel.addEventListener('click', () => this.toggleAddCategoryForm(false));
    this.newCatSubmit.addEventListener('click', () => this.submitNewCategory());

    // Toggle Emoji Picker Popover
    this.newCatIconBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = this.emojiPicker.style.display === 'grid';
      this.emojiPicker.style.display = isVisible ? 'none' : 'grid';
    });

    // Close Emoji Picker on Click Outside
    document.addEventListener('click', (e) => {
      if (this.emojiPicker && !this.emojiPicker.contains(e.target) && e.target !== this.newCatIconBtn) {
        this.emojiPicker.style.display = 'none';
      }
    });

    // Render picker emojis
    this.renderEmojiPicker();
  }

  renderEmojiPicker() {
    this.emojiPicker.innerHTML = '';
    this.emojis.forEach(emoji => {
      const div = document.createElement('div');
      div.className = 'emoji-picker-item';
      div.textContent = emoji;
      div.addEventListener('click', () => {
        this.selectedEmoji = emoji;
        this.newCatIconBtn.textContent = emoji;
        this.emojiPicker.style.display = 'none';
      });
      this.emojiPicker.appendChild(div);
    });
  }

  toggleAddCategoryForm(show) {
    if (show) {
      this.addCategoryToggle.style.display = 'none';
      this.addCategoryForm.style.display = 'flex';
      this.newCatNameInput.focus();
    } else {
      this.addCategoryToggle.style.display = 'flex';
      this.addCategoryForm.style.display = 'none';
      this.newCatNameInput.value = '';
      this.selectedEmoji = '💡';
      this.newCatIconBtn.textContent = '💡';
      this.emojiPicker.style.display = 'none';
    }
  }

  async submitNewCategory() {
    const name = this.newCatNameInput.value.trim();
    const icon = this.selectedEmoji || '💡';
    
    if (!name) return;
    
    try {
      const result = await window.api.createCategory(name, icon);
      if (result) {
        this.toggleAddCategoryForm(false);
        await this.renderCategories();
        if (window.noteManager) {
          window.noteManager.populateCategoryDropdowns();
        }
      }
    } catch (err) {
      console.error('Failed to create category:', err);
    }
  }

  selectFilter(type, value, element) {
    // De-activate all sidebar menu items
    document.querySelectorAll('.sidebar-menu-item, .tag-badge').forEach(el => {
      el.classList.remove('active');
    });

    // Set filter active values
    if (type === 'view') {
      this.currentFilterType = value; // 'all', 'starred', 'pinned'
      this.currentFilterValue = null;
      if (element) element.classList.add('active');
    } 
    else if (type === 'category') {
      this.currentFilterType = 'category';
      this.currentFilterValue = value;
      if (element) element.classList.add('active');
    } 
    else if (type === 'tag') {
      this.currentFilterType = 'tag';
      this.currentFilterValue = value;
      if (element) element.classList.add('active');
    }

    // Trigger rendering of note list
    if (window.noteManager) {
      window.noteManager.renderNotes();
    }
  }

  async renderCategories() {
    try {
      const categories = await window.api.getCategories();
      this.categoriesList.innerHTML = '';
      
      categories.forEach(cat => {
        const li = document.createElement('li');
        li.className = 'sidebar-menu-item';
        if (this.currentFilterType === 'category' && this.currentFilterValue === cat.name) {
          li.classList.add('active');
        }
        
        li.innerHTML = `
          <span class="category-icon">${cat.icon || '📌'}</span>
          <span>${cat.name}</span>
          <span class="count-badge" id="count-cat-${cat.name}">0</span>
        `;
        
        // Right click to delete category
        li.addEventListener('contextmenu', async (e) => {
          e.preventDefault();
          const confirmed = await window.showConfirm(
            '删除分类',
            `确定要删除分类 "${cat.name}" 吗？该分类下的便签将被设为默认。`,
            '确认删除',
            '取消'
          );
          if (confirmed) {
            this.deleteCategory(cat.name);
          }
        });
        
        li.addEventListener('click', () => this.selectFilter('category', cat.name, li));
        this.categoriesList.appendChild(li);
      });
      
      // Update badge counts
      if (window.noteManager) {
        this.updateCounts(window.noteManager.notes);
      }
    } catch (err) {
      console.error('Error rendering categories:', err);
    }
  }

  async deleteCategory(name) {
    if (name === '默认' || name === '灵感') {
      alert('系统保留分类，无法删除。');
      return;
    }
    try {
      await window.api.deleteCategory(name);
      if (this.currentFilterType === 'category' && this.currentFilterValue === name) {
        this.selectFilter('view', 'all', document.querySelector('[data-filter="all"]'));
      }
      await this.renderCategories();
      if (window.noteManager) {
        // Reload notes to update categories
        await window.noteManager.loadNotes();
        window.noteManager.populateCategoryDropdowns();
      }
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  }

  // Render tag cloud from note cached tags
  renderTagsCloud(notes) {
    // Get unique tags and count them
    const tagCounts = {};
    notes.forEach(note => {
      if (note.tags && Array.isArray(note.tags)) {
        note.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    this.tagsList.innerHTML = '';
    const sortedTags = Object.keys(tagCounts).sort();
    
    if (sortedTags.length === 0) {
      this.tagsList.innerHTML = '<span class="version-text" style="padding: 0 8px;">暂无标签</span>';
      return;
    }

    sortedTags.forEach(tag => {
      const span = document.createElement('span');
      span.className = 'tag-badge';
      if (this.currentFilterType === 'tag' && this.currentFilterValue === tag) {
        span.classList.add('active');
      }
      
      span.textContent = `#${tag} (${tagCounts[tag]})`;
      span.addEventListener('click', () => this.selectFilter('tag', tag, span));
      this.tagsList.appendChild(span);
    });
  }

  // Refresh counts across views
  updateCounts(notes) {
    if (!notes) return;
    
    // 1. Basic views
    let allCount = notes.length;
    let starredCount = notes.filter(n => n.is_starred).length;
    let pinnedCount = notes.filter(n => n.is_pinned).length;
    
    document.getElementById('count-all').textContent = allCount;
    document.getElementById('count-starred').textContent = starredCount;
    document.getElementById('count-pinned').textContent = pinnedCount;

    // 2. Categories
    const catCounts = {};
    notes.forEach(note => {
      catCounts[note.category] = (catCounts[note.category] || 0) + 1;
    });

    // Update category badge DOM elements
    document.querySelectorAll('[id^="count-cat-"]').forEach(badge => {
      const catName = badge.id.replace('count-cat-', '');
      badge.textContent = catCounts[catName] || 0;
    });
  }

  // Filter notes array according to sidebar selection
  filterNotes(notes) {
    return notes.filter(note => {
      if (this.currentFilterType === 'starred') {
        return note.is_starred;
      }
      if (this.currentFilterType === 'pinned') {
        return note.is_pinned;
      }
      if (this.currentFilterType === 'category') {
        return note.category === this.currentFilterValue;
      }
      if (this.currentFilterType === 'tag') {
        return note.tags && note.tags.includes(this.currentFilterValue);
      }
      return true; // 'all'
    });
  }
}

window.sidebarManager = new SidebarManager();
