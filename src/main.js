const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Auto-updater will be loaded lazily in production only
let autoUpdater = null;

// Keep track of all windows
let windows = [];

// Window state management
let windowState = {
  width: 1200,
  height: 800,
  x: undefined,
  y: undefined
};

// State file path (computed lazily after app is ready)
let stateFilePath = null;

function getStateFilePath() {
  if (!stateFilePath) {
    stateFilePath = path.join(app.getPath('userData'), 'window-state.json');
  }
  return stateFilePath;
}

async function loadWindowState() {
  try {
    const data = await fs.readFile(getStateFilePath(), 'utf-8');
    windowState = JSON.parse(data);
  } catch (err) {
    // Use defaults if file doesn't exist
  }
}

async function saveWindowState(win) {
  if (win && !win.isDestroyed()) {
    const bounds = win.getBounds();
    windowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y
    };
    await fs.writeFile(getStateFilePath(), JSON.stringify(windowState));
  }
}

// Get the currently focused window
function getFocusedWindow() {
  return BrowserWindow.getFocusedWindow() || windows[windows.length - 1];
}

function createWindow() {
  // Offset new windows slightly so they don't stack exactly
  const offset = windows.length * 30;

  const win = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x !== undefined ? windowState.x + offset : undefined,
    y: windowState.y !== undefined ? windowState.y + offset : undefined,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#282C34',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  windows.push(win);

  win.loadFile(path.join(__dirname, 'index.html'));

  win.on('close', async () => {
    await saveWindowState(win);
  });

  win.on('closed', () => {
    windows = windows.filter(w => w !== win);
  });

  // Memory monitoring (development)
  if (process.env.NODE_ENV === 'development' && windows.length === 1) {
    setInterval(() => {
      const used = process.memoryUsage();
      console.log(`Memory: ${Math.round(used.heapUsed / 1024 / 1024)}MB`);
    }, 10000);
  }

  return win;
}

// Create native menu
function createMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => createWindow()
        },
        {
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: () => getFocusedWindow()?.webContents.send('menu-new-file')
        },
        { type: 'separator' },
        {
          label: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const win = getFocusedWindow();
            const result = await dialog.showOpenDialog(win, {
              properties: ['openFile'],
              filters: [{ name: 'All Files', extensions: ['*'] }]
            });
            if (!result.canceled && result.filePaths.length > 0) {
              win?.webContents.send('menu-open-file', result.filePaths[0]);
            }
          }
        },
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            const win = getFocusedWindow();
            const result = await dialog.showOpenDialog(win, {
              properties: ['openDirectory']
            });
            if (!result.canceled && result.filePaths.length > 0) {
              win?.webContents.send('menu-open-folder', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => getFocusedWindow()?.webContents.send('menu-save')
        },
        {
          label: 'Save All',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => getFocusedWindow()?.webContents.send('menu-save-all')
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => getFocusedWindow()?.webContents.send('menu-close-tab')
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => getFocusedWindow()?.webContents.send('menu-find')
        },
        {
          label: 'Replace',
          accelerator: 'CmdOrCtrl+H',
          click: () => getFocusedWindow()?.webContents.send('menu-replace')
        },
        { type: 'separator' },
        {
          label: 'Go to Line...',
          accelerator: 'Ctrl+G',
          click: () => getFocusedWindow()?.webContents.send('menu-go-to-line')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => getFocusedWindow()?.webContents.send('menu-toggle-sidebar')
        },
        { type: 'separator' },
        {
          label: 'Increase Font Size',
          accelerator: 'CmdOrCtrl+=',
          click: () => getFocusedWindow()?.webContents.send('menu-font-increase')
        },
        {
          label: 'Decrease Font Size',
          accelerator: 'CmdOrCtrl+-',
          click: () => getFocusedWindow()?.webContents.send('menu-font-decrease')
        },
        {
          label: 'Reset Font Size',
          accelerator: 'CmdOrCtrl+0',
          click: () => getFocusedWindow()?.webContents.send('menu-font-reset')
        },
        { type: 'separator' },
        {
          label: 'Toggle Word Wrap',
          accelerator: 'CmdOrCtrl+Alt+W',
          click: () => getFocusedWindow()?.webContents.send('menu-toggle-word-wrap')
        },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Go',
      submenu: [
        {
          label: 'Quick Open...',
          accelerator: 'CmdOrCtrl+P',
          click: () => getFocusedWindow()?.webContents.send('menu-quick-open')
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const items = entries.map(entry => ({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      isDirectory: entry.isDirectory()
    }));
    // Sort: directories first, then alphabetically
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    return { success: true, items };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('show-save-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win, {
    filters: [{ name: 'All Files', extensions: ['*'] }]
  });
  return result;
});

ipcMain.handle('get-git-status', async (event, folderPath) => {
  try {
    const { exec } = require('child_process');
    return new Promise((resolve) => {
      exec('git status --porcelain', { cwd: folderPath }, (error, stdout, stderr) => {
        if (error) {
          // Not a git repo or git not installed
          resolve({ success: false, error: error.message });
          return;
        }

        const status = {};
        const lines = stdout.trim().split('\n').filter(line => line);

        for (const line of lines) {
          const code = line.substring(0, 2);
          // Handle paths that may have quotes or spaces
          let filePath = line.substring(3).replace(/^"/, '').replace(/"$/, '');
          const fullPath = path.normalize(path.join(folderPath, filePath));

          // Parse git status codes
          let fileStatus;
          if (code.includes('M')) {
            fileStatus = 'modified';
          } else if (code.includes('A') || code === '??') {
            fileStatus = 'added';
          } else if (code.includes('D')) {
            fileStatus = 'deleted';
          } else if (code.includes('R')) {
            fileStatus = 'renamed';
          } else {
            fileStatus = 'changed';
          }

          status[fullPath] = fileStatus;

          // Also mark all parent directories
          let parentPath = path.dirname(fullPath);
          while (parentPath !== folderPath && parentPath.startsWith(folderPath)) {
            if (!status[parentPath]) {
              status[parentPath] = 'modified'; // Folders with changes show as modified
            }
            parentPath = path.dirname(parentPath);
          }
        }

        resolve({ success: true, status });
      });
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

// File system watching
const watchers = new Map();

ipcMain.handle('watch-folder', async (event, folderPath) => {
  try {
    // Stop existing watcher for this window if any
    const senderId = event.sender.id;
    if (watchers.has(senderId)) {
      watchers.get(senderId).close();
    }

    const { watch } = require('fs');

    // Debounce mechanism to avoid rapid-fire events
    let debounceTimer = null;

    const watcher = watch(folderPath, { recursive: true }, (eventType, filename) => {
      // Skip hidden files and common ignored patterns
      if (filename && (
        filename.startsWith('.') ||
        filename.includes('node_modules') ||
        filename.includes('.git') ||
        filename.includes('__pycache__')
      )) {
        return;
      }

      // Debounce: wait 300ms after the last change before notifying
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        // Send event to renderer
        if (!event.sender.isDestroyed()) {
          event.sender.send('folder-changed', { eventType, filename });
        }
      }, 300);
    });

    watcher.on('error', (err) => {
      console.log('Watcher error:', err);
    });

    watchers.set(senderId, watcher);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('unwatch-folder', async (event) => {
  const senderId = event.sender.id;
  if (watchers.has(senderId)) {
    watchers.get(senderId).close();
    watchers.delete(senderId);
  }
  return { success: true };
});

// App lifecycle
app.whenReady().then(async () => {
  await loadWindowState();
  createMenu();
  createWindow();

  // Initialize auto-updater only in production (packaged app)
  if (app.isPackaged) {
    try {
      const { autoUpdater: updater } = require('electron-updater');
      autoUpdater = updater;
      autoUpdater.autoDownload = false;
      autoUpdater.autoInstallOnAppQuit = true;

      autoUpdater.on('update-available', (info) => {
        const win = getFocusedWindow();
        if (win) {
          dialog.showMessageBox(win, {
            type: 'info',
            title: 'Update Available',
            message: `Version ${info.version} is available. Would you like to download it?`,
            buttons: ['Download', 'Later']
          }).then(result => {
            if (result.response === 0) {
              autoUpdater.downloadUpdate();
            }
          });
        }
      });

      autoUpdater.on('update-downloaded', (info) => {
        const win = getFocusedWindow();
        if (win) {
          dialog.showMessageBox(win, {
            type: 'info',
            title: 'Update Ready',
            message: `Version ${info.version} has been downloaded. Restart now to install?`,
            buttons: ['Restart', 'Later']
          }).then(result => {
            if (result.response === 0) {
              autoUpdater.quitAndInstall();
            }
          });
        }
      });

      autoUpdater.on('error', (err) => {
        console.log('Auto-update error:', err);
      });

      autoUpdater.checkForUpdates();
    } catch (err) {
      console.log('Auto-updater not available:', err);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
