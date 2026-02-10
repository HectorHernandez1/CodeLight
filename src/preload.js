const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // File operations
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
    readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
    showSaveDialog: () => ipcRenderer.invoke('show-save-dialog'),
    getAppPath: () => ipcRenderer.invoke('get-app-path'),
    getGitStatus: (folderPath) => ipcRenderer.invoke('get-git-status', folderPath),

    // File watching
    watchFolder: (folderPath) => ipcRenderer.invoke('watch-folder', folderPath),
    unwatchFolder: () => ipcRenderer.invoke('unwatch-folder'),
    onFolderChanged: (callback) => ipcRenderer.on('folder-changed', (event, data) => callback(data)),

    // Menu event listeners
    onNewFile: (callback) => ipcRenderer.on('menu-new-file', callback),
    onOpenFile: (callback) => ipcRenderer.on('menu-open-file', (event, path) => callback(path)),
    onOpenFolder: (callback) => ipcRenderer.on('menu-open-folder', (event, path) => callback(path)),
    onSave: (callback) => ipcRenderer.on('menu-save', callback),
    onSaveAll: (callback) => ipcRenderer.on('menu-save-all', callback),
    onCloseTab: (callback) => ipcRenderer.on('menu-close-tab', callback),
    onFind: (callback) => ipcRenderer.on('menu-find', callback),
    onReplace: (callback) => ipcRenderer.on('menu-replace', callback),
    onGoToLine: (callback) => ipcRenderer.on('menu-go-to-line', callback),
    onToggleSidebar: (callback) => ipcRenderer.on('menu-toggle-sidebar', callback),
    onFontIncrease: (callback) => ipcRenderer.on('menu-font-increase', callback),
    onFontDecrease: (callback) => ipcRenderer.on('menu-font-decrease', callback),
    onFontReset: (callback) => ipcRenderer.on('menu-font-reset', callback),
    onToggleWordWrap: (callback) => ipcRenderer.on('menu-toggle-word-wrap', callback),
    onQuickOpen: (callback) => ipcRenderer.on('menu-quick-open', callback),
    onToggleSplit: (callback) => ipcRenderer.on('menu-toggle-split', callback),

    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
