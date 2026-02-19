// File Manager Module
// Handles file tree, folder operations, and recent files

export class FileManager {
    constructor(app) {
        this.app = app;
        this.recentFiles = [];
        this.gitStatus = {}; // Track git file statuses
        this.isWatching = false;
        this.expandedFolders = new Set(); // Track expanded folder paths
        this._isRendering = false; // Guard against re-renders while already rendering
        this._pendingRefresh = false; // Track if a refresh was requested during render
        this._suppressWatcher = false; // Suppress watcher refreshes during saves
        this.loadRecentFiles();
        this.setupFolderWatcher();
    }

    setupFolderWatcher() {
        // Remove any previous listener to prevent accumulation
        window.electronAPI.removeAllListeners('folder-changed');

        // Listen for folder change events from the main process
        window.electronAPI.onFolderChanged((data) => {
            // Skip refresh if we're the ones who caused the change (e.g., saving a file)
            if (this._suppressWatcher) {
                return;
            }
            // Refresh the file tree when changes are detected
            if (this.app.openFolder) {
                this.refreshFileTree();
            }
        });
    }

    async refreshFileTree() {
        // If already rendering, schedule a refresh after current render completes
        if (this._isRendering) {
            this._pendingRefresh = true;
            return;
        }

        this._isRendering = true;
        try {
            // Refresh git status and re-render the tree
            // (expandedFolders is maintained in-memory by click handlers,
            //  no need to scrape DOM before re-render)
            await this.refreshGitStatus();
            await this.renderFileTree(this.app.openFolder);
        } finally {
            this._isRendering = false;
            // If a refresh was requested while we were rendering, do it now
            if (this._pendingRefresh) {
                this._pendingRefresh = false;
                this.refreshFileTree();
            }
        }
    }

    // expandedFolders is maintained in-memory by click handlers
    // (add on expand, delete on collapse) — no DOM scraping needed

    // Suppress watcher refreshes while we perform our own writes.
    // The 500ms timeout covers the 300ms watcher debounce plus margin.
    suppressWatcher() {
        this._suppressWatcher = true;
        clearTimeout(this._suppressTimer);
        this._suppressTimer = setTimeout(() => {
            this._suppressWatcher = false;
        }, 500);
    }

    async loadRecentFiles() {
        const recent = await this.app.storage.get('recentFiles');
        if (recent) {
            this.recentFiles = recent;
        }
    }

    async saveRecentFiles() {
        await this.app.storage.set('recentFiles', this.recentFiles);
    }

    addToRecent(filePath) {
        // Remove if already exists
        this.recentFiles = this.recentFiles.filter(f => f !== filePath);
        // Add to front
        this.recentFiles.unshift(filePath);
        // Keep only last 10
        this.recentFiles = this.recentFiles.slice(0, 10);
        this.saveRecentFiles();
    }

    async refreshGitStatus() {
        if (!this.app.openFolder) return;

        const result = await window.electronAPI.getGitStatus(this.app.openFolder);
        if (result.success) {
            this.gitStatus = result.status;
        } else {
            this.gitStatus = {};
        }
    }

    async openFolder(folderPath) {
        // Stop watching previous folder if any
        if (this.isWatching) {
            await window.electronAPI.unwatchFolder();
            this.isWatching = false;
        }

        this.app.openFolder = folderPath;

        // Update dock menu with folder name (macOS)
        window.electronAPI.setOpenFolder(folderPath);

        // Close tabs that are not part of the new folder
        const tabsToClose = this.app.tabs.filter(tab => {
            // Close tabs outside the new folder (including untitled)
            return !tab.path || !tab.path.startsWith(folderPath);
        });
        tabsToClose.forEach(tab => this.app.closeTab(tab.id));

        this._isRendering = true;
        try {
            await this.refreshGitStatus();
            await this.renderFileTree(folderPath);
        } finally {
            this._isRendering = false;
            this._pendingRefresh = false;
        }
        this.app.saveSession();
        this.app.updateStatusBar();

        // Start watching the new folder
        const result = await window.electronAPI.watchFolder(folderPath);
        if (result.success) {
            this.isWatching = true;
            console.log('Started watching folder:', folderPath);
        }
    }

    async renderFileTree(folderPath) {
        const container = document.getElementById('file-tree');
        container.innerHTML = '';

        // Create parent folder header at the top showing full path
        const headerItem = document.createElement('div');
        headerItem.className = 'tree-item tree-root-header';
        const headerIcon = document.createElement('span');
        headerIcon.className = 'tree-item-icon';
        headerIcon.textContent = '📂';
        const headerName = document.createElement('span');
        headerName.className = 'tree-item-name';
        headerName.textContent = folderPath;
        headerItem.appendChild(headerIcon);
        headerItem.appendChild(headerName);

        // Add right-click context menu for root folder
        headerItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e.clientX, e.clientY, folderPath, true);
        });

        container.appendChild(headerItem);

        // Create children container for folder contents
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';

        const result = await window.electronAPI.readDirectory(folderPath);
        if (result.success) {
            for (const child of result.items) {
                const childItem = await this.createTreeItem(child.path, child.isDirectory);
                if (childItem) {
                    childrenContainer.appendChild(childItem);
                }
            }
        }
        container.appendChild(childrenContainer);
    }

    async createTreeItem(itemPath, isDirectory, isRoot = false) {
        const name = itemPath.split('/').pop();

        // Skip hidden files and common ignored directories
        if (!isRoot && name.startsWith('.')) {
            return null;
        }
        if (name === 'node_modules' || name === '__pycache__' || name === '.git') {
            return null;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'tree-folder';

        const item = document.createElement('div');
        item.className = 'tree-item';
        item.dataset.path = itemPath;

        // Add git status class if applicable
        const gitStatus = this.gitStatus[itemPath];
        if (gitStatus) {
            item.classList.add(`git-${gitStatus}`);
        }

        // Check if file has unsaved changes (higher priority indicator)
        const unsavedTab = this.app.tabs.find(t => t.path === itemPath && t.modified);
        if (unsavedTab) {
            item.classList.add('file-unsaved');
        }

        const icon = document.createElement('span');
        icon.className = 'tree-item-icon';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'tree-item-name';
        nameSpan.textContent = name;

        // Add right-click context menu for copying path
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showContextMenu(e.clientX, e.clientY, itemPath, isDirectory);
        });

        if (isDirectory) {
            // Check if this folder should be expanded (was previously expanded or is root)
            const shouldExpand = isRoot || this.expandedFolders.has(itemPath);

            icon.textContent = shouldExpand ? '📂' : '📁';

            // Assemble item and append to wrapper FIRST so the folder label
            // always appears above its children in the DOM
            item.appendChild(icon);
            item.appendChild(nameSpan);
            wrapper.appendChild(item);

            item.addEventListener('click', async (e) => {
                e.stopPropagation();

                // Toggle expanded state
                wrapper.classList.toggle('expanded');

                // Track expansion state
                if (wrapper.classList.contains('expanded')) {
                    this.expandedFolders.add(itemPath);
                    icon.textContent = '📂';

                    // Load children if not already loaded
                    let childrenContainer = wrapper.querySelector('.tree-children');
                    if (!childrenContainer) {
                        childrenContainer = document.createElement('div');
                        childrenContainer.className = 'tree-children';

                        const result = await window.electronAPI.readDirectory(itemPath);
                        if (result.success) {
                            for (const child of result.items) {
                                const childItem = await this.createTreeItem(child.path, child.isDirectory);
                                if (childItem) {
                                    childrenContainer.appendChild(childItem);
                                }
                            }
                        }
                        wrapper.appendChild(childrenContainer);
                    }
                } else {
                    this.expandedFolders.delete(itemPath);
                    icon.textContent = '📁';
                }
            });

            // Auto-expand if needed (root folder or previously expanded)
            if (shouldExpand) {
                wrapper.classList.add('expanded');

                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'tree-children';

                const result = await window.electronAPI.readDirectory(itemPath);
                if (result.success) {
                    for (const child of result.items) {
                        const childItem = await this.createTreeItem(child.path, child.isDirectory);
                        if (childItem) {
                            childrenContainer.appendChild(childItem);
                        }
                    }
                }
                wrapper.appendChild(childrenContainer);
            }

            return wrapper;
        } else {
            // File
            icon.textContent = this.getFileIcon(name);

            item.appendChild(icon);
            item.appendChild(nameSpan);

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.app.openFile(itemPath);

                // Highlight active file
                document.querySelectorAll('.tree-item.active').forEach(el => {
                    el.classList.remove('active');
                });
                item.classList.add('active');
            });

            return item;
        }
    }

    showContextMenu(x, y, itemPath, isDirectory) {
        // Remove any existing context menu
        const existing = document.querySelector('.context-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        const copyPathItem = document.createElement('div');
        copyPathItem.className = 'context-menu-item';
        copyPathItem.textContent = isDirectory ? 'Copy Folder Path' : 'Copy File Path';
        copyPathItem.addEventListener('click', () => {
            navigator.clipboard.writeText(itemPath);
            menu.remove();
        });

        menu.appendChild(copyPathItem);

        // Add "Copy Name" option
        const copyNameItem = document.createElement('div');
        copyNameItem.className = 'context-menu-item';
        copyNameItem.textContent = 'Copy Name';
        copyNameItem.addEventListener('click', () => {
            const name = itemPath.split('/').pop();
            navigator.clipboard.writeText(name);
            menu.remove();
        });

        menu.appendChild(copyNameItem);

        document.body.appendChild(menu);

        // Close menu when clicking elsewhere
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const icons = {
            'js': '📜',
            'jsx': '⚛️',
            'ts': '📘',
            'tsx': '⚛️',
            'py': '🐍',
            'go': '🔷',
            'rs': '🦀',
            'java': '☕',
            'html': '🌐',
            'css': '🎨',
            'json': '📋',
            'yaml': '📋',
            'yml': '📋',
            'md': '📝',
            'txt': '📄',
            'sh': '💻',
            'sql': '🗃️'
        };
        return icons[ext] || '📄';
    }

    async createFile(parentPath, fileName) {
        const filePath = `${parentPath}/${fileName}`;
        this.suppressWatcher();
        const result = await window.electronAPI.writeFile(filePath, '');
        if (result.success) {
            // Ensure the parent folder is expanded so the new file is visible
            this.expandedFolders.add(parentPath);

            this._isRendering = true;
            try {
                await this.refreshGitStatus();
                await this.renderFileTree(this.app.openFolder);
            } finally {
                this._isRendering = false;
                // Discard any pending refresh from file watcher since we just re-rendered
                this._pendingRefresh = false;
            }
            this.app.openFile(filePath);
        }
        return result;
    }

    async deleteFile(filePath) {
        // Note: For safety, we don't implement delete in MVP
        // This would require additional confirmation UI
        console.log('Delete not implemented in MVP for safety');
    }
}
