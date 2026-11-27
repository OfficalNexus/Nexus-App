const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { autoUpdater } = require('electron-updater');
const { discoverGames, optimizeGame, restoreGame } = require('./game-profiles');

// ---- Auto-update (electron-updater, GitHub Releases) ----------------------
// Flow: check -> download in the background -> "Install and restart" -> silent
// per-user install -> Nexus relaunches on the new version.
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true; // also installs if the user just closes the app
autoUpdater.allowPrerelease = false;
autoUpdater.allowDowngrade = false;

let updateState = { status: 'idle' };

function normalizeNotes(notes) {
  if (!notes) return '';
  if (typeof notes === 'string') return notes.replace(/<[^>]*>/g, '').trim();
  if (Array.isArray(notes)) return notes.map(n => n && n.note ? String(n.note).replace(/<[^>]*>/g, '') : '').filter(Boolean).join('\n').trim();
  return '';
}

function setUpdateState(next) {
  updateState = next;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('update:state', updateState);
  }
}

autoUpdater.on('checking-for-update', () => {
  if (updateState.status !== 'downloading' && updateState.status !== 'ready') setUpdateState({ status: 'checking' });
});
autoUpdater.on('update-available', info => setUpdateState({ status: 'downloading', version: info.version, notes: normalizeNotes(info.releaseNotes), percent: 0 }));
autoUpdater.on('download-progress', progress => setUpdateState({ ...updateState, status: 'downloading', percent: Math.round(progress.percent || 0) }));
autoUpdater.on('update-downloaded', info => setUpdateState({ status: 'ready', version: info.version, notes: normalizeNotes(info.releaseNotes) }));
autoUpdater.on('update-not-available', () => setUpdateState({ status: 'none' }));
autoUpdater.on('error', error => setUpdateState({ status: 'error', message: error && error.message ? error.message : 'Update failed' }));

async function checkForUpdates() {
  if (!app.isPackaged) { setUpdateState({ status: 'dev' }); return updateState; }
  if (updateState.status === 'downloading' || updateState.status === 'ready') return updateState;
  try { await autoUpdater.checkForUpdates(); }
  catch (error) { setUpdateState({ status: 'error', message: error.message }); }
  return updateState;
}

function scanWindowsDevices() {
  if (process.platform !== 'win32') return Promise.resolve({ devices: [], message: 'Device scanning is available in the Windows build.' });
  // Keep this read-only query focused on gaming input devices. HIDClass can also
  // contain unrelated sensors and buttons, so names are checked before inclusion.
  const script = `$controllerWords = '(?i)(controller|gamepad|dualshock|dualsense|playstation|xbox|joy[- ]?con|steam deck|8bitdo|switch pro)'
$mouseWords = '(?i)(mouse|touchpad|trackpad)'
$keyboardWords = '(?i)(keyboard|keypad|typing)'
Get-PnpDevice -PresentOnly | ForEach-Object {
  $label = "$($_.FriendlyName) $($_.InstanceId)"
  $category = $null
  if ($_.Class -eq 'Mouse' -or $label -match $mouseWords) { $category = 'Mouse' }
  elseif ($_.Class -eq 'Keyboard' -or $label -match $keyboardWords) { $category = 'Keyboard' }
  elseif ($label -match $controllerWords) { $category = 'Controller' }
  if ($category) {
    [PSCustomObject]@{ Class = $category; FriendlyName = $_.FriendlyName; Status = $_.Status; InstanceId = $_.InstanceId; ProblemCode = $_.ProblemCode }
  }
} | Sort-Object Class,FriendlyName,InstanceId | ConvertTo-Json -Compress`;
  return new Promise(resolve => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => {
      if (error) return resolve({ devices: [], message: error.message });
      try {
        const parsed = JSON.parse(stdout || '[]');
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const seen = new Set();
        const devices = list.filter(item => {
          if (!item || !item.FriendlyName) return false;
          const key = `${item.Class}|${item.FriendlyName}|${item.InstanceId || ''}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).map(item => ({ className: item.Class || 'Other', name: item.FriendlyName, status: item.Status || 'Unknown', instanceId: item.InstanceId || '', problemCode: item.ProblemCode ?? 0 }));
        resolve({ devices, message: devices.length ? '' : 'No supported mouse, keyboard, or controller was found.' });
      } catch (_) { resolve({ devices: [], message: 'Windows returned an unreadable device list.' }); }
    });
  });
}

// Use app-owned chrome so the title bar matches the Nexus interface.
app.setName('Nexus');

function createWindow() {
  const win = new BrowserWindow({
    width: 1220,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    title: 'Nexus — FPS Game Profiles',
    backgroundColor: '#f7f8fc',
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: 'hidden',
    resizable: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('window:minimize', event => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.handle('window:toggle-maximize', event => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });
  ipcMain.handle('window:close', event => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.handle('app:relaunch', () => {
    app.relaunch();
    app.exit(0);
  });
  ipcMain.handle('app:check-update', () => checkForUpdates());
  ipcMain.handle('app:update-state', () => updateState);
  ipcMain.handle('app:install-update', () => {
    if (updateState.status !== 'ready') return false;
    // isSilent = true (no installer UI), isForceRunAfter = true (relaunch Nexus when done)
    setImmediate(() => autoUpdater.quitAndInstall(true, true));
    return true;
  });
  ipcMain.handle('devices:scan', () => scanWindowsDevices());
  ipcMain.handle('games:discover', () => discoverGames());
  ipcMain.handle('games:optimize', (_event, game) => optimizeGame(game));
  ipcMain.handle('games:restore', (_event, game) => restoreGame(game));
  createWindow();
  if (app.isPackaged) {
    setTimeout(checkForUpdates, 4000);
    setInterval(checkForUpdates, 4 * 60 * 60 * 1000);
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
