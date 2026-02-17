const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Track the currently allowed folder per window (set when user opens a folder)
const allowedFolders = new Map(); // senderId -> folderPath

// Validate that a file path is within the allowed folder for this window.
// Returns resolved path or null if invalid.
function validatePath(senderId, filePath) {
  const allowed = allowedFolders.get(senderId);
  const resolved = path.resolve(filePath);
  // If no folder is open, allow any path the user explicitly chose via dialog
  if (!allowed) return resolved;
  // Check resolved path is within the allowed folder
  if (resolved === allowed || resolved.startsWith(allowed + path.sep)) {
    return resolved;
  }
  return null;
}

// Looser validation: allow the path if it's within ANY open folder across windows,
// OR if no folder restriction is set for this window (user opened file via dialog).
function validateFileAccess(senderId, filePath) {
  const resolved = path.resolve(filePath);
  const allowed = allowedFolders.get(senderId);
  // No folder open — user is opening individual files via dialog, allow it
  if (!allowed) return resolved;
  // Within the open folder
  if (resolved === allowed || resolved.startsWith(allowed + path.sep)) {
    return resolved;
  }
  return null;
}

// Auto-updater will be loaded lazily in production only
let autoUpdater = null;

// Keep track of all windows
let windows = [];

// Track current open folder for dock menu
let currentOpenFolder = null;

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
      sandbox: true
    }
  });

  windows.push(win);

  // Pass isNewWindow flag to skip session restore for new windows
  win.loadFile(path.join(__dirname, 'index.html'), {
    query: { isNewWindow: windows.length > 1 ? 'true' : '' }
  });

  win.on('close', async (e) => {
    e.preventDefault();
    try {
      // Ask renderer if there are unsaved changes via IPC (with timeout)
      const hasUnsaved = await Promise.race([
        new Promise((resolve) => {
          const channel = `unsaved-check-${win.id}`;
          ipcMain.once(channel, (_event, result) => resolve(result));
          win.webContents.send('check-unsaved-changes', win.id);
        }),
        new Promise((resolve) => setTimeout(() => resolve(false), 2000))
      ]);

      if (hasUnsaved) {
        const result = await dialog.showMessageBox(win, {
          type: 'warning',
          buttons: ['Save All', "Don't Save", 'Cancel'],
          defaultId: 0,
          cancelId: 2,
          message: 'You have unsaved changes.',
          detail: "Your changes will be lost if you don't save them."
        });

        if (result.response === 0) {
          // Ask renderer to save all files via IPC
          await Promise.race([
            new Promise((resolve) => {
              ipcMain.once(`save-all-done-${win.id}`, () => resolve());
              win.webContents.send('save-all-files', win.id);
            }),
            new Promise((resolve) => setTimeout(resolve, 5000))
          ]);
        } else if (result.response === 2) {
          return; // Cancel - don't close
        }
      }
    } catch (err) {
      // If renderer is already destroyed, just close
    }
    await saveWindowState(win);
    allowedFolders.delete(win.webContents.id);
    win.destroy();
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
        {
          label: 'Toggle Split View',
          accelerator: 'CmdOrCtrl+\\',
          click: () => getFocusedWindow()?.webContents.send('menu-toggle-split')
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

// Update dock menu with current folder (macOS only)
function updateDockMenu() {
  if (process.platform !== 'darwin') return;

  const dockMenuItems = [];

  if (currentOpenFolder) {
    const folderName = path.basename(currentOpenFolder);
    dockMenuItems.push({
      label: `📁 ${folderName}`,
      enabled: false // Just a label, not clickable
    });
    dockMenuItems.push({
      label: currentOpenFolder,
      enabled: false,
      sublabel: 'Current folder'
    });
    dockMenuItems.push({ type: 'separator' });
  }

  dockMenuItems.push({
    label: 'New Window',
    click: () => createWindow()
  });

  const dockMenu = Menu.buildFromTemplate(dockMenuItems);
  app.dock.setMenu(dockMenu);
}

// IPC Handlers
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const resolved = validateFileAccess(event.sender.id, filePath);
    if (!resolved) {
      return { success: false, error: 'Access denied: path outside open folder' };
    }
    const content = await fs.readFile(resolved, 'utf-8');
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    const resolved = validateFileAccess(event.sender.id, filePath);
    if (!resolved) {
      return { success: false, error: 'Access denied: path outside open folder' };
    }
    await fs.writeFile(resolved, content, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    const resolved = validateFileAccess(event.sender.id, dirPath);
    if (!resolved) {
      return { success: false, error: 'Access denied: path outside open folder' };
    }
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    const items = entries.map(entry => ({
      name: entry.name,
      path: path.join(resolved, entry.name),
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

ipcMain.handle('show-message-box', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  // Whitelist allowed options to prevent abuse
  const safeOptions = {
    type: ['none', 'info', 'error', 'question', 'warning'].includes(options.type) ? options.type : 'info',
    buttons: Array.isArray(options.buttons) ? options.buttons.map(String).slice(0, 5) : ['OK'],
    defaultId: typeof options.defaultId === 'number' ? options.defaultId : 0,
    cancelId: typeof options.cancelId === 'number' ? options.cancelId : -1,
    message: typeof options.message === 'string' ? options.message.slice(0, 500) : '',
    detail: typeof options.detail === 'string' ? options.detail.slice(0, 500) : undefined
  };
  const result = await dialog.showMessageBox(win, safeOptions);
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

// Update dock menu when folder is opened
ipcMain.handle('set-open-folder', (event, folderPath) => {
  currentOpenFolder = folderPath;
  // Track allowed folder for path validation
  const resolved = path.resolve(folderPath);
  allowedFolders.set(event.sender.id, resolved);
  updateDockMenu();
  return { success: true };
});

// File system watching
// Stores { watcher, debounceTimer } per sender
const watchers = new Map();

function cleanupWatcher(senderId) {
  if (watchers.has(senderId)) {
    const entry = watchers.get(senderId);
    if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
    entry.watcher.close();
    watchers.delete(senderId);
  }
}

ipcMain.handle('watch-folder', async (event, folderPath) => {
  try {
    const senderId = event.sender.id;
    // Stop existing watcher for this window if any
    cleanupWatcher(senderId);

    // Validate path
    const resolved = validateFileAccess(senderId, folderPath);
    if (!resolved) {
      return { success: false, error: 'Access denied: path outside open folder' };
    }

    const { watch } = require('fs');

    const entry = { watcher: null, debounceTimer: null };

    const watcher = watch(resolved, { recursive: true }, (eventType, filename) => {
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
      if (entry.debounceTimer) {
        clearTimeout(entry.debounceTimer);
      }

      entry.debounceTimer = setTimeout(() => {
        // Send event to renderer
        if (!event.sender.isDestroyed()) {
          event.sender.send('folder-changed', { eventType, filename });
        }
      }, 300);
    });

    watcher.on('error', (err) => {
      console.log('Watcher error:', err);
    });

    entry.watcher = watcher;
    watchers.set(senderId, entry);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('unwatch-folder', async (event) => {
  cleanupWatcher(event.sender.id);
  return { success: true };
});

// App lifecycle
app.whenReady().then(async () => {
  await loadWindowState();
  createMenu();
  createWindow();

  // Initialize dock menu (macOS)
  updateDockMenu();

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
