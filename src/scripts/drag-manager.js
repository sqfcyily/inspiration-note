// Drag and Resize Manager
class DragManager {
  constructor() {
    this.container = document.getElementById('notes-container');
    this.activeCard = null;
    this.isDragging = false;
    this.isResizing = false;
    
    // Drag state variables
    this.startX = 0;
    this.startY = 0;
    this.startLeft = 0;
    this.startTop = 0;
    
    // Resize state variables
    this.startWidth = 0;
    this.startHeight = 0;

    this.init();
  }

  init() {
    // Bind mouse down on the notes container (event delegation)
    this.container.addEventListener('mousedown', (e) => this.handleMouseDown(e));
  }

  handleMouseDown(e) {
    // Only handle left clicks for dragging/resizing to prevent blocking context menus
    if (e.button !== 0) {
      return;
    }

    // Check if free layout mode is active
    if (!window.layoutManager || window.layoutManager.layoutMode !== 'free') {
      return;
    }

    const target = e.target;
    
    // 1. Check if resizing
    if (target.classList.contains('note-resize-handle')) {
      const card = target.closest('.note-card');
      if (!card) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      this.activeCard = card;
      this.isResizing = true;
      
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.startWidth = card.offsetWidth;
      this.startHeight = card.offsetHeight;
      
      // Bring card to front
      this.bringToFront(card);
      
      // Add temporary move/up handlers
      this.bindMoveEvents();
      return;
    }

    // 2. Check if dragging (clicking header, but not buttons inside header)
    const header = target.closest('.note-header');
    if (header && !target.closest('.note-actions')) {
      const card = header.closest('.note-card');
      if (!card) return;

      e.preventDefault();
      
      this.activeCard = card;
      this.isDragging = true;
      card.classList.add('dragging');
      
      this.startX = e.clientX;
      this.startY = e.clientY;
      
      // Get current absolute position
      this.startLeft = parseInt(card.style.left) || 0;
      this.startTop = parseInt(card.style.top) || 0;
      
      // Bring card to front
      this.bringToFront(card);
      
      this.bindMoveEvents();
    }
  }

  bindMoveEvents() {
    this.onMouseMove = (e) => this.handleMouseMove(e);
    this.onMouseUp = (e) => this.handleMouseUp(e);
    
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  unbindMoveEvents() {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  handleMouseMove(e) {
    if (!this.activeCard) return;

    if (this.isDragging) {
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      
      let newLeft = this.startLeft + dx;
      let newTop = this.startTop + dy;
      
      // Bound checking (keep inside canvas)
      if (newLeft < 0) newLeft = 0;
      if (newTop < 0) newTop = 0;
      
      this.activeCard.style.left = `${newLeft}px`;
      this.activeCard.style.top = `${newTop}px`;
    } 
    else if (this.isResizing) {
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      
      let newWidth = this.startWidth + dx;
      let newHeight = this.startHeight + dy;
      
      // Bounds checks
      if (newWidth < 180) newWidth = 180;
      if (newHeight < 140) newHeight = 140;
      
      this.activeCard.style.width = `${newWidth}px`;
      this.activeCard.style.height = `${newHeight}px`;
    }

    // Expand the canvas dimensions in real-time if a note goes near the border
    if (window.noteManager) {
      window.noteManager.adjustContainerSizeFromDOM();
    }
  }

  async handleMouseUp(e) {
    if (!this.activeCard) return;
    
    this.unbindMoveEvents();
    
    const cardId = parseInt(this.activeCard.dataset.id);
    
    if (this.isDragging) {
      this.activeCard.classList.remove('dragging');
      this.isDragging = false;
      
      const pos_x = parseInt(this.activeCard.style.left) || 0;
      const pos_y = parseInt(this.activeCard.style.top) || 0;
      
      // Update database
      try {
        await window.api.updateNote(cardId, { pos_x, pos_y });
        // Sync note cache
        if (window.noteManager) {
          const noteIndex = window.noteManager.notes.findIndex(n => n.id === cardId);
          if (noteIndex !== -1) {
            window.noteManager.notes[noteIndex].pos_x = pos_x;
            window.noteManager.notes[noteIndex].pos_y = pos_y;
          }
        }
      } catch (err) {
        console.error('Failed to update note drag position:', err);
      }
    } 
    else if (this.isResizing) {
      this.isResizing = false;
      
      const width = parseInt(this.activeCard.style.width) || 240;
      const height = parseInt(this.activeCard.style.height) || 200;
      
      // Update database
      try {
        await window.api.updateNote(cardId, { width, height });
        // Sync note cache
        if (window.noteManager) {
          const noteIndex = window.noteManager.notes.findIndex(n => n.id === cardId);
          if (noteIndex !== -1) {
            window.noteManager.notes[noteIndex].width = width;
            window.noteManager.notes[noteIndex].height = height;
          }
        }
      } catch (err) {
        console.error('Failed to update note resized bounds:', err);
      }
    }
    
    this.activeCard = null;
  }

  bringToFront(card) {
    // Reset other notes z-index
    const cards = this.container.querySelectorAll('.note-card');
    cards.forEach(c => {
      if (c !== card) {
        c.style.zIndex = '10';
      }
    });
    // Set this card to top
    card.style.zIndex = '100';
  }
}

window.dragManager = new DragManager();
