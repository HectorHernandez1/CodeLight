// CodeLight - Renderer Process
// Monaco Editor integration and UI logic

import { FileManager } from './modules/file-manager.js';
import { ThemeManager } from './modules/theme.js';
import { StorageManager } from './modules/storage.js';
import { ShortcutManager } from './modules/shortcuts.js';

// Monaco Editor loader path for node_modules
const MONACO_PATH = '../node_modules/monaco-editor/min/vs';

class CodeLightApp {
    constructor() {
        this.editor = null;
        this.tabs = [];
        this.activeTabId = null;
        this.fontSize = 13;
        this.wordWrap = 'off';
        this.sidebarWidth = 250;
        this.openFolder = null;

        // Initialize managers
        this.storage = new StorageManager();
        this.theme = new ThemeManager(this);
        this.files = new FileManager(this);
        this.shortcuts = new ShortcutManager(this);

        this.init();
    }

    async init() {
        // Load saved preferences
        await this.loadPreferences();

        // Initialize Monaco Editor
        await this.initMonaco();

        // Set up menu event listeners
        this.setupMenuListeners();

        // Set up sidebar resize functionality
        this.setupSidebarResize();

        // Restore last session
        await this.restoreSession();

        // Update UI
        this.updateEmptyState();
    }

    async loadPreferences() {
        const prefs = await this.storage.get('preferences');
        if (prefs) {
            this.fontSize = prefs.fontSize || 13;
            this.wordWrap = prefs.wordWrap || 'off';
            this.sidebarWidth = prefs.sidebarWidth || 250;
            if (prefs.theme === 'light') {
                document.body.classList.add('light-theme');
            }
        }
        // Apply stored sidebar width
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.style.width = `${this.sidebarWidth}px`;
        }
    }

    async savePreferences() {
        await this.storage.set('preferences', {
            fontSize: this.fontSize,
            wordWrap: this.wordWrap,
            sidebarWidth: this.sidebarWidth,
            theme: document.body.classList.contains('light-theme') ? 'light' : 'dark'
        });
    }

    async initMonaco() {
        return new Promise((resolve) => {
            // Load Monaco AMD loader
            const loaderScript = document.createElement('script');
            loaderScript.src = `${MONACO_PATH}/loader.js`;
            loaderScript.onload = () => {
                require.config({ paths: { vs: MONACO_PATH } });

                require(['vs/editor/editor.main'], () => {
                    // Define dark theme
                    monaco.editor.defineTheme('codelight-dark', {
                        base: 'vs-dark',
                        inherit: true,
                        rules: [
                            { token: 'comment', foreground: '5C6370', fontStyle: 'italic' },
                            { token: 'keyword', foreground: 'C678DD' },
                            { token: 'string', foreground: '98C379' },
                            { token: 'number', foreground: 'D19A66' },
                            { token: 'type', foreground: 'E5C07B' },
                            { token: 'function', foreground: '61AFEF' },
                            { token: 'variable', foreground: 'E06C75' }
                        ],
                        colors: {
                            'editor.background': '#282C34',
                            'editor.foreground': '#ABB2BF',
                            'editorLineNumber.foreground': '#495162',
                            'editorLineNumber.activeForeground': '#ABB2BF',
                            'editor.selectionBackground': '#3E4451',
                            'editor.lineHighlightBackground': '#2C313A',
                            'editorCursor.foreground': '#528BFF',
                            'editorWhitespace.foreground': '#3B4048'
                        }
                    });

                    // Define light theme
                    monaco.editor.defineTheme('codelight-light', {
                        base: 'vs',
                        inherit: true,
                        rules: [
                            { token: 'comment', foreground: '6A737D', fontStyle: 'italic' },
                            { token: 'keyword', foreground: 'D73A49' },
                            { token: 'string', foreground: '22863A' },
                            { token: 'number', foreground: '005CC5' },
                            { token: 'type', foreground: 'E36209' },
                            { token: 'function', foreground: '6F42C1' }
                        ],
                        colors: {
                            'editor.background': '#FFFFFF',
                            'editor.foreground': '#24292E',
                            'editorLineNumber.foreground': '#959DA5',
                            'editor.selectionBackground': '#0366D625',
                            'editor.lineHighlightBackground': '#F6F8FA'
                        }
                    });

                    // Create the editor
                    this.editor = monaco.editor.create(document.getElementById('editor-container'), {
                        value: '',
                        language: 'plaintext',
                        theme: document.body.classList.contains('light-theme') ? 'codelight-light' : 'codelight-dark',
                        fontSize: this.fontSize,
                        fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
                        lineNumbers: 'on',
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        wordWrap: this.wordWrap,
                        automaticLayout: true,
                        folding: true,
                        renderWhitespace: 'selection',
                        tabSize: 2,
                        insertSpaces: true,
                        cursorBlinking: 'smooth',
                        cursorSmoothCaretAnimation: 'on',
                        smoothScrolling: true,
                        padding: { top: 10 }
                    });

                    // Track cursor position
                    this.editor.onDidChangeCursorPosition((e) => {
                        this.updateStatusBar();
                    });

                    // Track content changes
                    this.editor.onDidChangeModelContent(() => {
                        if (this.activeTabId) {
                            this.markTabModified(this.activeTabId);
                        }
                    });

                    // Handle window resize
                    window.addEventListener('resize', () => {
                        this.editor.layout();
                    });

                    resolve();
                });
            };
            document.head.appendChild(loaderScript);
        });
    }

    setupMenuListeners() {
        const { electronAPI } = window;

        electronAPI.onNewFile(() => this.createNewFile());
        electronAPI.onOpenFile((path) => this.openFile(path));
        electronAPI.onOpenFolder((path) => this.files.openFolder(path));
        electronAPI.onSave(() => this.saveCurrentFile());
        electronAPI.onSaveAll(() => this.saveAllFiles());
        electronAPI.onCloseTab(() => this.closeActiveTab());
        electronAPI.onFind(() => this.editor?.getAction('actions.find')?.run());
        electronAPI.onReplace(() => this.editor?.getAction('editor.action.startFindReplaceAction')?.run());
        electronAPI.onGoToLine(() => this.showGoToLine());
        electronAPI.onToggleSidebar(() => this.toggleSidebar());
        electronAPI.onFontIncrease(() => this.changeFontSize(1));
        electronAPI.onFontDecrease(() => this.changeFontSize(-1));
        electronAPI.onFontReset(() => this.resetFontSize());
        electronAPI.onToggleWordWrap(() => this.toggleWordWrap());
        electronAPI.onQuickOpen(() => this.showQuickOpen());
    }

    setupSidebarResize() {
        const sidebar = document.getElementById('sidebar');
        const handle = document.getElementById('sidebar-resize-handle');

        if (!sidebar || !handle) return;

        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        const onMouseDown = (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = sidebar.offsetWidth;
            handle.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (!isResizing) return;

            const deltaX = e.clientX - startX;
            const newWidth = Math.min(600, Math.max(150, startWidth + deltaX));
            sidebar.style.width = `${newWidth}px`;
            this.sidebarWidth = newWidth;

            // Trigger editor layout update
            if (this.editor) {
                this.editor.layout();
            }
        };

        const onMouseUp = () => {
            if (isResizing) {
                isResizing = false;
                handle.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                this.savePreferences();
            }
        };

        handle.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    // === Tab Management ===

    createTab(filePath, content, isNew = false) {
        const id = Date.now().toString();
        const name = isNew ? 'untitled' : filePath.split('/').pop();

        const tab = {
            id,
            name,
            path: isNew ? null : filePath,
            content,
            modified: false,
            model: monaco.editor.createModel(content, this.detectLanguage(name))
        };

        this.tabs.push(tab);
        this.renderTabs();
        this.activateTab(id);

        return tab;
    }

    activateTab(id) {
        const tab = this.tabs.find(t => t.id === id);
        if (!tab) return;

        // Save current model content before switching
        if (this.activeTabId) {
            const currentTab = this.tabs.find(t => t.id === this.activeTabId);
            if (currentTab) {
                currentTab.content = this.editor.getValue();
            }
        }

        this.activeTabId = id;
        this.editor.setModel(tab.model);
        this.updateStatusBar();
        this.renderTabs();
        this.updateEmptyState();
    }

    closeTab(id) {
        const index = this.tabs.findIndex(t => t.id === id);
        if (index === -1) return;

        const tab = this.tabs[index];

        // TODO: Prompt to save if modified

        tab.model.dispose();
        this.tabs.splice(index, 1);

        if (this.activeTabId === id) {
            // Activate adjacent tab
            if (this.tabs.length > 0) {
                const newIndex = Math.min(index, this.tabs.length - 1);
                this.activateTab(this.tabs[newIndex].id);
            } else {
                this.activeTabId = null;
                this.updateEmptyState();
            }
        }

        this.renderTabs();
        this.saveSession();
    }

    closeActiveTab() {
        if (this.activeTabId) {
            this.closeTab(this.activeTabId);
        }
    }

    markTabModified(id) {
        const tab = this.tabs.find(t => t.id === id);
        if (tab && !tab.modified) {
            tab.modified = true;
            this.renderTabs();
        }
    }

    renderTabs() {
        const container = document.getElementById('tabs');
        container.innerHTML = '';

        this.tabs.forEach(tab => {
            const tabEl = document.createElement('div');
            tabEl.className = `tab ${tab.id === this.activeTabId ? 'active' : ''} ${tab.modified ? 'modified' : ''}`;
            tabEl.innerHTML = `
        <span class="tab-name">${tab.name}</span>
        <span class="tab-close">×</span>
      `;

            tabEl.querySelector('.tab-name').addEventListener('click', () => {
                this.activateTab(tab.id);
            });

            tabEl.querySelector('.tab-close').addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeTab(tab.id);
            });

            container.appendChild(tabEl);
        });
    }

    // === File Operations ===

    createNewFile() {
        this.createTab('untitled', '', true);
    }

    async openFile(filePath) {
        // Check if already open
        const existing = this.tabs.find(t => t.path === filePath);
        if (existing) {
            this.activateTab(existing.id);
            return;
        }

        const result = await window.electronAPI.readFile(filePath);
        if (result.success) {
            this.createTab(filePath, result.content);
            this.files.addToRecent(filePath);
            this.saveSession();
        } else {
            console.error('Failed to open file:', result.error);
        }
    }

    async saveCurrentFile() {
        if (!this.activeTabId) return;

        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (!tab) return;

        const content = this.editor.getValue();

        if (!tab.path) {
            // New file - show save dialog
            const result = await window.electronAPI.showSaveDialog();
            if (result.canceled) return;
            tab.path = result.filePath;
            tab.name = result.filePath.split('/').pop();

            // Update language detection
            const newLang = this.detectLanguage(tab.name);
            monaco.editor.setModelLanguage(tab.model, newLang);
        }

        const writeResult = await window.electronAPI.writeFile(tab.path, content);
        if (writeResult.success) {
            tab.modified = false;
            tab.content = content;
            this.renderTabs();
            this.saveSession();
        }
    }

    async saveAllFiles() {
        for (const tab of this.tabs) {
            if (tab.modified && tab.path) {
                const content = tab.model.getValue();
                const result = await window.electronAPI.writeFile(tab.path, content);
                if (result.success) {
                    tab.modified = false;
                    tab.content = content;
                }
            }
        }
        this.renderTabs();
    }

    // === Editor Settings ===

    changeFontSize(delta) {
        this.fontSize = Math.max(8, Math.min(32, this.fontSize + delta));
        this.editor.updateOptions({ fontSize: this.fontSize });
        this.savePreferences();
    }

    resetFontSize() {
        this.fontSize = 13;
        this.editor.updateOptions({ fontSize: this.fontSize });
        this.savePreferences();
    }

    toggleWordWrap() {
        this.wordWrap = this.wordWrap === 'off' ? 'on' : 'off';
        this.editor.updateOptions({ wordWrap: this.wordWrap });
        this.savePreferences();
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('hidden');
        this.editor.layout();
    }

    // === UI Updates ===

    updateStatusBar() {
        const position = this.editor?.getPosition();
        const model = this.editor?.getModel();

        if (position) {
            document.getElementById('status-position').textContent =
                `Ln ${position.lineNumber}, Col ${position.column}`;
        }

        if (model) {
            const lang = model.getLanguageId();
            document.getElementById('status-language').textContent =
                this.getLanguageDisplayName(lang);
        }
    }

    updateEmptyState() {
        const container = document.getElementById('editor-container');
        if (this.tabs.length === 0) {
            container.classList.add('empty');
        } else {
            container.classList.remove('empty');
        }
    }

    // === Modals ===

    showGoToLine() {
        const modal = document.getElementById('goto-line-modal');
        const input = document.getElementById('goto-line-input');

        modal.classList.remove('hidden');
        input.value = '';
        input.focus();

        const handler = (e) => {
            if (e.key === 'Enter') {
                const line = parseInt(input.value);
                if (!isNaN(line)) {
                    this.editor?.revealLineInCenter(line);
                    this.editor?.setPosition({ lineNumber: line, column: 1 });
                    this.editor?.focus();
                }
                modal.classList.add('hidden');
                input.removeEventListener('keydown', handler);
            } else if (e.key === 'Escape') {
                modal.classList.add('hidden');
                input.removeEventListener('keydown', handler);
                this.editor?.focus();
            }
        };

        input.addEventListener('keydown', handler);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                this.editor?.focus();
            }
        }, { once: true });
    }

    showQuickOpen() {
        if (!this.openFolder) return;

        const modal = document.getElementById('quick-open-modal');
        const input = document.getElementById('quick-open-input');
        const results = document.getElementById('quick-open-results');

        modal.classList.remove('hidden');
        input.value = '';
        results.innerHTML = '';
        input.focus();

        let allFiles = [];
        let selectedIndex = 0;

        // Collect all files recursively
        const collectFiles = async (path, prefix = '') => {
            const result = await window.electronAPI.readDirectory(path);
            if (result.success) {
                for (const item of result.items) {
                    if (!item.isDirectory) {
                        allFiles.push({
                            name: item.name,
                            path: item.path,
                            display: prefix + item.name
                        });
                    } else if (!item.name.startsWith('.') && item.name !== 'node_modules') {
                        await collectFiles(item.path, prefix + item.name + '/');
                    }
                }
            }
        };

        collectFiles(this.openFolder).then(() => {
            renderResults('');
        });

        const renderResults = (query) => {
            const filtered = query
                ? allFiles.filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
                : allFiles.slice(0, 20);

            selectedIndex = 0;
            results.innerHTML = filtered.map((file, i) => `
        <div class="quick-open-item ${i === 0 ? 'selected' : ''}" data-path="${file.path}">
          <span>${file.name}</span>
          <span class="quick-open-item-path">${file.display}</span>
        </div>
      `).join('');

            results.querySelectorAll('.quick-open-item').forEach((item, i) => {
                item.addEventListener('click', () => {
                    this.openFile(item.dataset.path);
                    modal.classList.add('hidden');
                });
            });
        };

        input.addEventListener('input', (e) => {
            renderResults(e.target.value);
        });

        input.addEventListener('keydown', (e) => {
            const items = results.querySelectorAll('.quick-open-item');

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                items[selectedIndex]?.classList.remove('selected');
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                items[selectedIndex]?.classList.add('selected');
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                items[selectedIndex]?.classList.remove('selected');
                selectedIndex = Math.max(selectedIndex - 1, 0);
                items[selectedIndex]?.classList.add('selected');
            } else if (e.key === 'Enter') {
                const selected = items[selectedIndex];
                if (selected) {
                    this.openFile(selected.dataset.path);
                }
                modal.classList.add('hidden');
            } else if (e.key === 'Escape') {
                modal.classList.add('hidden');
                this.editor?.focus();
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                this.editor?.focus();
            }
        }, { once: true });
    }

    // === Session Management ===

    async saveSession() {
        const session = {
            openFolder: this.openFolder,
            tabs: this.tabs.map(t => ({
                path: t.path,
                content: t.model.getValue(),
                name: t.name
            })),
            activeTabPath: this.tabs.find(t => t.id === this.activeTabId)?.path
        };
        await this.storage.set('session', session);
    }

    async restoreSession() {
        const session = await this.storage.get('session');
        if (!session) return;

        if (session.openFolder) {
            await this.files.openFolder(session.openFolder);
        }

        for (const tabData of session.tabs || []) {
            if (tabData.path) {
                const result = await window.electronAPI.readFile(tabData.path);
                if (result.success) {
                    this.createTab(tabData.path, result.content);
                }
            } else if (tabData.content) {
                const tab = this.createTab(tabData.name || 'untitled', tabData.content, true);
                tab.name = tabData.name;
                this.renderTabs();
            }
        }

        // Activate the previously active tab
        if (session.activeTabPath) {
            const tab = this.tabs.find(t => t.path === session.activeTabPath);
            if (tab) {
                this.activateTab(tab.id);
            }
        }
    }

    // === Utilities ===

    detectLanguage(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const langMap = {
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'py': 'python',
            'go': 'go',
            'rs': 'rust',
            'java': 'java',
            'c': 'c',
            'cpp': 'cpp',
            'cc': 'cpp',
            'h': 'c',
            'hpp': 'cpp',
            'cs': 'csharp',
            'html': 'html',
            'htm': 'html',
            'css': 'css',
            'scss': 'scss',
            'less': 'less',
            'json': 'json',
            'yaml': 'yaml',
            'yml': 'yaml',
            'md': 'markdown',
            'markdown': 'markdown',
            'sql': 'sql',
            'sh': 'shell',
            'bash': 'shell',
            'zsh': 'shell',
            'rb': 'ruby',
            'php': 'php',
            'swift': 'swift',
            'kt': 'kotlin',
            'scala': 'scala',
            'r': 'r',
            'lua': 'lua',
            'pl': 'perl',
            'xml': 'xml',
            'svg': 'xml'
        };
        return langMap[ext] || 'plaintext';
    }

    getLanguageDisplayName(langId) {
        const displayNames = {
            'javascript': 'JavaScript',
            'typescript': 'TypeScript',
            'python': 'Python',
            'go': 'Go',
            'rust': 'Rust',
            'java': 'Java',
            'c': 'C',
            'cpp': 'C++',
            'csharp': 'C#',
            'html': 'HTML',
            'css': 'CSS',
            'json': 'JSON',
            'yaml': 'YAML',
            'markdown': 'Markdown',
            'sql': 'SQL',
            'shell': 'Shell',
            'ruby': 'Ruby',
            'php': 'PHP',
            'swift': 'Swift',
            'kotlin': 'Kotlin',
            'plaintext': 'Plain Text'
        };
        return displayNames[langId] || langId;
    }
}

// Initialize the app
window.addEventListener('DOMContentLoaded', () => {
    window.app = new CodeLightApp();
});
