// File Manager Module
// Handles file tree, folder operations, and recent files

export class FileManager {
    constructor(app) {
        this.app = app;
        this.recentFiles = [];
        this.loadRecentFiles();
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

    async openFolder(folderPath) {
        this.app.openFolder = folderPath;
        await this.renderFileTree(folderPath);
        this.app.saveSession();
    }

    async renderFileTree(folderPath) {
        const container = document.getElementById('file-tree');
        container.innerHTML = '';

        const rootItem = await this.createTreeItem(folderPath, true, true);
        if (rootItem) {
            container.appendChild(rootItem);
        }
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

        const icon = document.createElement('span');
        icon.className = 'tree-item-icon';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'tree-item-name';
        nameSpan.textContent = name;

        if (isDirectory) {
            icon.textContent = '📁';

            item.addEventListener('click', async (e) => {
                e.stopPropagation();

                // Toggle expanded state
                wrapper.classList.toggle('expanded');

                if (wrapper.classList.contains('expanded')) {
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
                    icon.textContent = '📁';
                }
            });

            if (isRoot) {
                // Auto-expand root folder
                wrapper.classList.add('expanded');
                icon.textContent = '📂';

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
        } else {
            // File
            icon.textContent = this.getFileIcon(name);

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.app.openFile(itemPath);

                // Highlight active file
                document.querySelectorAll('.tree-item.active').forEach(el => {
                    el.classList.remove('active');
                });
                item.classList.add('active');
            });
        }

        item.appendChild(icon);
        item.appendChild(nameSpan);

        if (isDirectory) {
            wrapper.appendChild(item);
            return wrapper;
        } else {
            return item;
        }
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
        const result = await window.electronAPI.writeFile(filePath, '');
        if (result.success) {
            await this.renderFileTree(this.app.openFolder);
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
