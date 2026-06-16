// Generic Custom Dialog Confirmation overlay
// Generic Custom Dialog Confirmation overlay
function showConfirm(title, message, submitText = '确认', cancelText = '取消') {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    const card = modal.querySelector('.modal-card');
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    const submitBtn = document.getElementById('confirm-submit-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    
    titleEl.textContent = title;
    msgEl.textContent = message;
    submitBtn.textContent = submitText;
    cancelBtn.textContent = cancelText;
    
    // Check if it's a deletion to set warning style
    if (submitText.includes('删除') || title.includes('删除')) {
      submitBtn.className = 'btn btn-danger';
    } else {
      submitBtn.className = 'btn btn-primary';
    }

    // Dragging logic for confirm modal in desktop mode
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const onMouseDown = (e) => {
      if (!document.body.classList.contains('desktop-mode')) return;
      if (e.target.closest('.confirm-footer') || e.target.closest('button')) {
        return;
      }
      e.preventDefault();
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = card.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;
      
      const w = card.offsetWidth;
      const h = card.offsetHeight;
      
      if (newLeft < 0) newLeft = 0;
      if (newTop < 0) newTop = 0;
      if (newLeft + w > window.innerWidth) newLeft = window.innerWidth - w;
      if (newTop + h > window.innerHeight) newTop = window.innerHeight - h;
      
      card.style.left = `${newLeft}px`;
      card.style.top = `${newTop}px`;
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    if (document.body.classList.contains('desktop-mode')) {
      // Position near mouse
      const mouseX = window.lastMouseX || (window.innerWidth / 2);
      const mouseY = window.lastMouseY || (window.innerHeight / 2);
      
      const w = 360; // confirm card width is 360px
      const h = 200; // approximate height
      
      let left = mouseX - w / 2;
      let top = mouseY - 100;
      
      if (left < 20) left = 20;
      if (left + w > window.innerWidth - 20) left = window.innerWidth - w - 20;
      if (top < 20) top = 20;
      if (top + h > window.innerHeight - 20) top = window.innerHeight - h - 20;
      
      card.style.position = 'absolute';
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
      card.style.margin = '0';
      
      card.addEventListener('mousedown', onMouseDown);
      modal.style.display = 'block';
    } else {
      card.style.position = '';
      card.style.left = '';
      card.style.top = '';
      card.style.margin = '';
      
      modal.style.display = 'flex';
    }

    const onCancel = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(false);
    };

    const onSubmit = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(true);
    };

    const cleanup = () => {
      submitBtn.removeEventListener('click', onSubmit);
      cancelBtn.removeEventListener('click', onCancel);
      card.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    submitBtn.addEventListener('click', onSubmit);
    cancelBtn.addEventListener('click', onCancel);
  });
}
window.showConfirm = showConfirm;

// App Initialization and Window Control bindings
document.addEventListener('DOMContentLoaded', async () => {
  // Add macOS class if running on Mac
  if (window.api && window.api.platform === 'darwin') {
    document.body.classList.add('mac-os');
  }

  try {
    async function setDesktopModeState(enable) {
      document.body.classList.toggle('desktop-mode', enable);
      
      // Notify main process to adjust window size, level, taskbar
      window.api.toggleDesktopMode(enable);

      // If exiting desktop mode, restore normal mouse events
      if (!enable) {
        window.api.setIgnoreMouseEvents(false);
      }
    }
    // Expose toggle function globally so sidebar button can call it
    window.setDesktopModeState = setDesktopModeState;

    // 1. Load configuration from settings
    const settings = await window.api.getSettings();
    
    // Boot Theme
    if (window.themeManager) {
      const activeTheme = settings.theme || 'dark';
      window.themeManager.setTheme(activeTheme);
    }
    
    // Boot Layout Mode
    if (window.layoutManager) {
      const activeLayout = settings.layout_mode || 'free';
      const sortBy = settings.sort_by || 'updated_at';
      
      window.layoutManager.sortSelect.value = sortBy;
      window.layoutManager.sortBy = sortBy;
      window.layoutManager.setLayoutMode(activeLayout);
    }

    // 2. Load Categories Sidebar
    if (window.sidebarManager) {
      await window.sidebarManager.renderCategories();
    }

    // 3. Load Notes
    if (window.noteManager) {
      await window.noteManager.loadNotes();
    }

    // 4. Set up Window Controls
    document.getElementById('win-min-btn').addEventListener('click', () => {
      window.api.minimize();
    });
    
    document.getElementById('win-max-btn').addEventListener('click', () => {
      window.api.maximize();
    });
    
    document.getElementById('win-close-btn').addEventListener('click', () => {
      window.api.close();
    });

    // 5. Global IPC shortcuts (from Main process / tray)
    window.api.onNewNoteShortcut(() => {
      if (window.noteManager) {
        window.noteManager.openEditor(null);
      }
    });

    // 5b. Toggle Desktop Widget Mode listener from system tray
    window.api.onTrayToggleDesktopMode((enable) => {
      if (window.layoutManager) {
        window.layoutManager.setLayoutMode(enable ? 'desktop' : 'free');
      }
    });

    // 5c. Listen to open editor from pet window
    if (window.api && window.api.onOpenEditorFromPet) {
      window.api.onOpenEditorFromPet((coords) => {
        if (window.noteManager) {
          window.noteManager.openEditor(null, { fromPet: true, petCoords: coords });
        }
      });
    }

    // Bind sidebar desktop widget button click event
    const desktopToggleBtn = document.getElementById('toggle-desktop-widget-btn');
    if (desktopToggleBtn) {
      desktopToggleBtn.addEventListener('click', () => {
        if (window.layoutManager) {
          const isDesktop = window.layoutManager.layoutMode === 'desktop';
          window.layoutManager.setLayoutMode(isDesktop ? 'free' : 'desktop');
        }
      });
    }

    // Global mousemove listener for Desktop Mode click-through
    document.addEventListener('mousemove', (e) => {
      window.lastMouseX = e.clientX;
      window.lastMouseY = e.clientY;

      if (!document.body.classList.contains('desktop-mode')) return;

      // If the editor modal or confirm delete modal is visible,
      // we must NOT ignore mouse events!
      const editorModal = document.getElementById('editor-modal');
      const confirmModal = document.getElementById('confirm-modal');
      const isModalOpen = (editorModal && (editorModal.style.display === 'flex' || editorModal.style.display === 'block')) || 
                          (confirmModal && (confirmModal.style.display === 'flex' || confirmModal.style.display === 'block'));
      
      if (isModalOpen) {
        window.api.setIgnoreMouseEvents(false);
        return;
      }

      // If dragging or resizing is in progress, do NOT ignore mouse events
      const isDraggingOrResizing = window.dragManager && (window.dragManager.isDragging || window.dragManager.isResizing);
      if (isDraggingOrResizing) {
        window.api.setIgnoreMouseEvents(false);
        return;
      }

      // Check if mouse is over a note card
      const isOverCard = e.target.closest('.note-card') !== null;
      
      // Tell main process to ignore mouse events if NOT over a card
      window.api.setIgnoreMouseEvents(!isOverCard);
    });

    // 6. Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl + N to create new note
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (window.noteManager) {
          // If modal is not open
          const modal = document.getElementById('editor-modal');
          if (modal.style.display !== 'flex') {
            window.noteManager.openEditor(null);
          }
        }
      }
      
      // Ctrl + F to search notes
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }

      // Esc to close modal
      if (e.key === 'Escape') {
        const modal = document.getElementById('editor-modal');
        if (modal && modal.style.display === 'flex') {
          if (window.noteManager) {
            window.noteManager.closeEditor();
          }
        }
      }
    });

  } catch (err) {
    console.error('App failed to initialize:', err);
  }
});
