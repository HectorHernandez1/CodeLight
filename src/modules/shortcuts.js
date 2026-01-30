// Shortcuts Manager Module
// Additional keyboard shortcuts beyond menu accelerators

export class ShortcutManager {
    constructor(app) {
        this.app = app;
        this.shortcuts = new Map();
        this.init();
    }

    init() {
        // Register shortcuts
        this.register('Escape', () => {
            // Close any open modals
            document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
                modal.classList.add('hidden');
            });
            this.app.editor?.focus();
        });

        // Listen for keyboard events
        document.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });
    }

    register(shortcut, callback) {
        this.shortcuts.set(shortcut.toLowerCase(), callback);
    }

    unregister(shortcut) {
        this.shortcuts.delete(shortcut.toLowerCase());
    }

    handleKeydown(e) {
        // Build shortcut string
        const parts = [];
        if (e.metaKey) parts.push('cmd');
        if (e.ctrlKey) parts.push('ctrl');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');

        // Add the actual key
        const key = e.key.toLowerCase();
        if (!['meta', 'control', 'alt', 'shift'].includes(key)) {
            parts.push(key);
        }

        const shortcut = parts.join('+');

        // Check for simple key (like Escape)
        if (this.shortcuts.has(key)) {
            const callback = this.shortcuts.get(key);
            callback();
        }

        // Check for complex shortcuts
        if (this.shortcuts.has(shortcut)) {
            e.preventDefault();
            const callback = this.shortcuts.get(shortcut);
            callback();
        }
    }

    // Get list of all shortcuts for help/documentation
    getShortcutList() {
        return [
            { action: 'New File', shortcut: 'Cmd+N' },
            { action: 'Open File', shortcut: 'Cmd+O' },
            { action: 'Open Folder', shortcut: 'Cmd+Shift+O' },
            { action: 'Save', shortcut: 'Cmd+S' },
            { action: 'Save All', shortcut: 'Cmd+Shift+S' },
            { action: 'Close Tab', shortcut: 'Cmd+W' },
            { action: 'Find', shortcut: 'Cmd+F' },
            { action: 'Replace', shortcut: 'Cmd+H' },
            { action: 'Go to Line', shortcut: 'Ctrl+G' },
            { action: 'Quick Open', shortcut: 'Cmd+P' },
            { action: 'Toggle Sidebar', shortcut: 'Cmd+B' },
            { action: 'Increase Font', shortcut: 'Cmd++' },
            { action: 'Decrease Font', shortcut: 'Cmd+-' },
            { action: 'Toggle Word Wrap', shortcut: 'Cmd+Alt+W' },
            { action: 'Comment Line', shortcut: 'Cmd+/' }
        ];
    }
}
