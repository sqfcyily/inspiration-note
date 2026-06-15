// Theme Manager
class ThemeManager {
  constructor() {
    this.currentTheme = 'dark';
    this.toggleBtn = document.getElementById('theme-toggle-btn');
    this.sunIcon = this.toggleBtn.querySelector('.theme-icon-sun');
    this.moonIcon = this.toggleBtn.querySelector('.theme-icon-moon');
    
    this.init();
  }

  async init() {
    // Register click event
    this.toggleBtn.addEventListener('click', () => this.toggleTheme());
  }

  setTheme(theme) {
    this.currentTheme = theme;
    if (theme === 'light') {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      this.sunIcon.style.display = 'none';
      this.moonIcon.style.display = 'block';
    } else {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
      this.sunIcon.style.display = 'block';
      this.moonIcon.style.display = 'none';
    }
  }

  async toggleTheme() {
    const nextTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
    
    // Save to settings
    try {
      await window.api.saveSetting('theme', nextTheme);
    } catch (err) {
      console.error('Failed to save theme setting:', err);
    }
  }
}

window.themeManager = new ThemeManager();
