// Layout Manager
class LayoutManager {
  constructor() {
    this.layoutMode = 'free'; // 'free' or 'auto'
    this.sortBy = 'updated_at'; // 'updated_at', 'created_at', 'priority'
    
    this.board = document.getElementById('notes-board');
    this.freeBtn = document.getElementById('layout-free-btn');
    this.autoBtn = document.getElementById('layout-auto-btn');
    this.sortContainer = document.getElementById('sort-setting-container');
    this.sortSelect = document.getElementById('sort-select');
    
    this.init();
  }

  init() {
    // Register event listeners
    this.freeBtn.addEventListener('click', () => this.setLayoutMode('free'));
    this.autoBtn.addEventListener('click', () => this.setLayoutMode('auto'));
    this.sortSelect.addEventListener('change', (e) => this.handleSortChange(e.target.value));
  }

  setLayoutMode(mode) {
    this.layoutMode = mode;
    
    if (mode === 'free') {
      this.freeBtn.classList.add('active');
      this.autoBtn.classList.remove('active');
      this.board.classList.add('notes-free-mode');
      this.board.classList.remove('notes-grid-mode');
      this.sortContainer.style.display = 'none';
    } else {
      this.freeBtn.classList.remove('active');
      this.autoBtn.classList.add('active');
      this.board.classList.remove('notes-free-mode');
      this.board.classList.add('notes-grid-mode');
      this.sortContainer.style.display = 'flex';
    }

    // Save to settings
    window.api.saveSetting('layout_mode', mode).catch(err => {
      console.error('Failed to save layout mode setting:', err);
    });

    // Refresh UI
    if (window.noteManager) {
      window.noteManager.renderNotes();
    }
  }

  handleSortChange(value) {
    this.sortBy = value;
    
    // Save to settings
    window.api.saveSetting('sort_by', value).catch(err => {
      console.error('Failed to save sort setting:', err);
    });

    // Refresh UI
    if (window.noteManager) {
      window.noteManager.renderNotes();
    }
  }

  // Helper to sort notes array based on current sort settings
  sortNotes(notes) {
    const priorityMap = { high: 3, medium: 2, low: 1 };
    
    return [...notes].sort((a, b) => {
      // Pinned notes always go first
      if (a.is_pinned !== b.is_pinned) {
        return b.is_pinned - a.is_pinned;
      }
      
      if (this.sortBy === 'priority') {
        const valA = priorityMap[a.priority] || 2;
        const valB = priorityMap[b.priority] || 2;
        if (valA !== valB) {
          return valB - valA;
        }
        // Fallback to updated_at if priority is equal
        return new Date(b.updated_at) - new Date(a.updated_at);
      } 
      else if (this.sortBy === 'created_at') {
        return new Date(b.created_at) - new Date(a.created_at);
      } 
      else {
        // default: updated_at
        return new Date(b.updated_at) - new Date(a.updated_at);
      }
    });
  }

  // Utility to find a free space on the board for a new note
  getNextFreePosition(existingNotes, width = 240, height = 220) {
    // Basic spiral/grid placement algorithm to avoid notes directly overlapping
    let x = 40;
    let y = 40;
    let foundSpace = false;
    
    // Loop until we find a position that does not overlap too much with any existing note
    while (!foundSpace) {
      let overlap = false;
      for (const note of existingNotes) {
        if (note.pos_x === null || note.pos_y === null) continue;
        
        // Calculate collision box
        const noteX = note.pos_x;
        const noteY = note.pos_y;
        const noteW = note.width || width;
        const noteH = note.height || height;
        
        // Check if there is collision (with some buffer room)
        const xOverlap = Math.abs(x - noteX) < (noteW - 20);
        const yOverlap = Math.abs(y - noteY) < (noteH - 20);
        
        if (xOverlap && yOverlap) {
          overlap = true;
          break;
        }
      }
      
      if (overlap) {
        // Step to the right
        x += 60;
        // If we go too far right, wrap down and reset X
        if (x > 800) {
          x = 40;
          y += 60;
        }
      } else {
        foundSpace = true;
      }
    }
    
    return { x, y };
  }
}

window.layoutManager = new LayoutManager();
