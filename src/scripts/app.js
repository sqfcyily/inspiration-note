// Generic Custom Dialog Confirmation overlay
function showConfirm(title, message, submitText = '确认', cancelText = '取消') {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
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
    };

    submitBtn.addEventListener('click', onSubmit);
    cancelBtn.addEventListener('click', onCancel);
    
    modal.style.display = 'flex';
  });
}
window.showConfirm = showConfirm;

// App Initialization and Window Control bindings
document.addEventListener('DOMContentLoaded', async () => {
  try {
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
