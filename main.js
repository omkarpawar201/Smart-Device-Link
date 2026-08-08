const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { initKDEConnectBridge, setMainWindow } = require('./src/ipc/bridge');

let mainWindow = null;
let tray = null;
let bridgeInitialized = false;

const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        frame: false, // Custom acrylic frameless window
        titleBarStyle: 'hidden',
        backgroundColor: '#0f172a', // Dark theme slate-900 background
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        },
        show: false
    });

    if (bridgeInitialized && setMainWindow) {
        setMainWindow(mainWindow);
    }

    // Load URL
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        // mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
    }

    // Smooth show once ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
        if (bridgeInitialized && setMainWindow) {
            setMainWindow(null);
        }
    });
}

function createTray() {
    // Create simple native tray icon
    const icon = nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAuSURBVHgB7cxBDQAACAIg2f6VzWALjHwN0JJyCYgISQiJCEkIiQhJCIkISQgJ8wc2lQYRT1A2WwAAAABJRU5ErkJggg=='
    );

    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Smart Device Link', enabled: false },
        { type: 'separator' },
        {
            label: 'Open Dashboard',
            click: () => {
                if (mainWindow) {
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    mainWindow.focus();
                } else {
                    createWindow();
                }
            }
        },
        {
            label: 'Device Status: Disconnected',
            enabled: false
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Smart Device Link');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// Window control IPC Handlers
ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.handle('get-app-version', () => app.getVersion());

// App lifecycle
app.whenReady().then(() => {
    createWindow();
    createTray();
    initKDEConnectBridge(mainWindow);
    bridgeInitialized = true;

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
