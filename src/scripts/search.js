// Search Manager
class SearchManager {
  constructor() {
    this.searchQuery = '';
    this.input = document.getElementById('search-input');
    this.clearBtn = document.getElementById('search-clear-btn');
    
    this.init();
  }

  init() {
    this.input.addEventListener('input', (e) => this.handleSearch(e.target.value));
    this.clearBtn.addEventListener('click', () => this.clearSearch());
  }

  handleSearch(query) {
    this.searchQuery = query.trim().toLowerCase();
    
    // Toggle clear button
    if (this.searchQuery.length > 0) {
      this.clearBtn.style.display = 'flex';
    } else {
      this.clearBtn.style.display = 'none';
    }
    
    // Refresh notes rendering to show only filtered ones
    if (window.noteManager) {
      window.noteManager.renderNotes();
    }
  }

  clearSearch() {
    this.input.value = '';
    this.handleSearch('');
  }

  // Check if a note matches the search query
  matches(note) {
    if (!this.searchQuery) return true;
    
    const title = (note.title || '').toLowerCase();
    const content = (note.content || '').toLowerCase();
    const tags = (note.tags || []).join(' ').toLowerCase();
    const category = (note.category || '').toLowerCase();
    
    return title.includes(this.searchQuery) || 
           content.includes(this.searchQuery) || 
           tags.includes(this.searchQuery) ||
           category.includes(this.searchQuery);
  }

  // Highlight search terms inside HTML text
  highlightText(htmlContent) {
    if (!this.searchQuery) return htmlContent;
    
    // Simple regex escape
    const escapedQuery = this.searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    
    // Match outside of HTML tags to avoid breaking tags like <img src="..."> or <a href="...">
    // A classic approach is to parse with a regex that skips tags.
    // Regex: /(>[^<]*?)(query)([^>]*?<)/gi but that requires matching surrounds.
    // Let's use a simpler tokenization or text parsing if needed.
    // For markdown previews, doing it on text elements is cleanest. 
    // However, a simple replace that skips HTML tags can be approximated or done via DOM traversal.
    // Since this is inside note-card preview, let's write a utility that does highlight on text nodes
    // after the markdown is rendered. That is 100% safe and doesn't break HTML tags!
    return htmlContent;
  }
  
  // Safe DOM-based text highlight
  highlightElement(element) {
    if (!element || !this.searchQuery) return;
    
    try {
      const query = this.searchQuery;
      const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      
      let node;
      while (node = walk.nextNode()) {
        // Don't highlight inside pre/code tags if we don't want to break coding layouts
        const parent = node.parentNode;
        if (parent) {
          const isCode = parent.tagName === 'CODE' || 
                         parent.tagName === 'PRE' || 
                         (typeof parent.closest === 'function' && (parent.closest('code') || parent.closest('pre')));
          if (isCode) continue;
        }
        textNodes.push(node);
      }
      
      // Process text nodes in reverse order so we don't mess up offsets
      for (const textNode of textNodes) {
        const text = textNode.nodeValue;
        if (!text) continue;
        const index = text.toLowerCase().indexOf(query);
        if (index >= 0) {
          const parent = textNode.parentNode;
          if (!parent) continue;
          
          const fragment = document.createDocumentFragment();
          let currentText = text;
          
          while (true) {
            const idx = currentText.toLowerCase().indexOf(query);
            if (idx < 0) {
              fragment.appendChild(document.createTextNode(currentText));
              break;
            }
            
            // Before match
            if (idx > 0) {
              fragment.appendChild(document.createTextNode(currentText.substring(0, idx)));
            }
            
            // The match
            const matchSpan = document.createElement('mark');
            matchSpan.style.backgroundColor = 'rgba(251, 191, 36, 0.4)';
            matchSpan.style.color = 'inherit';
            matchSpan.style.borderRadius = '2px';
            matchSpan.style.padding = '0 2px';
            matchSpan.appendChild(document.createTextNode(currentText.substring(idx, idx + query.length)));
            fragment.appendChild(matchSpan);
            
            // Remaining text
            currentText = currentText.substring(idx + query.length);
            if (!currentText) break;
          }
          
          parent.replaceChild(fragment, textNode);
        }
      }
    } catch (err) {
      console.error('Highlight error:', err);
    }
  }
}

window.searchManager = new SearchManager();
