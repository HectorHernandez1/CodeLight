// Theme Manager Module
// Handles theme switching and persistence

export class ThemeManager {
    constructor(app) {
        this.app = app;
        this.currentTheme = 'dark';
    }

    async init() {
        const saved = await this.app.storage.get('theme');
        if (saved) {
            this.setTheme(saved, false);
        }
    }

    setTheme(theme, save = true) {
        this.currentTheme = theme;

        if (theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }

        // Update Monaco theme if editor exists
        if (this.app.editor) {
            monaco.editor.setTheme(theme === 'light' ? 'codelight-light' : 'codelight-dark');
        }

        if (save) {
            this.app.storage.set('theme', theme);
            this.app.savePreferences();
        }
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    getTheme() {
        return this.currentTheme;
    }
}
