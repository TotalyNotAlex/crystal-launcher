const { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const axios = require('axios');
const { spawn } = require('child_process');

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  try {
    if (mainWindow) mainWindow.webContents.send('global-error', err.message);
  } catch {}
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

const authService = require('./services/authService');
const versionService = require('./services/versionService');
const profileService = require('./services/profileService');
const launchService = require('./services/launchService');
const modrinthService = require('./services/modrinthService');
const curseforgeService = require('./services/curseforgeService');
const i18n = require('./services/i18nService');
const JavaService = require('./services/javaService');
const updateService = require('./services/updateService');
const rpcService = require('./services/rpcService');
const serverPingService = require('./services/serverPingService');
const crashAnalyzer = require('./services/crashAnalyzer');
let bgUpdatePath = null;

let mainWindow = null;
const isUpdateRestart = process.argv.includes('--updated');
const baseDataDir = path.join(app.getPath('userData'), '.crystall');
const windowStateFile = path.join(baseDataDir, 'window-state.json');
const accountsFile = path.join(baseDataDir, 'accounts.json');
const settingsFile = path.join(baseDataDir, 'settings.json');
const serversFile = path.join(baseDataDir, 'servers.json');
const playtimeFile = path.join(baseDataDir, 'playtime.json');
const javaService = new JavaService(baseDataDir);
updateService.setManifestPath(path.join(baseDataDir, 'latest-version.json'));

function ensureDataDir() {
  if (!fs.existsSync(baseDataDir)) fs.mkdirSync(baseDataDir, { recursive: true });
  if (!fs.existsSync(accountsFile)) fs.writeFileSync(accountsFile, JSON.stringify([], null, 2));
  if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, JSON.stringify({
      activeAccountId: null, activeProfileId: null, lastLoader: 'vanilla', lastVersion: '1.20.4', defaultRam: 4, jvmArgs: '', keepLauncherOpen: true, language: 'en', discordRpc: true, javaPath: '',
    }, null, 2));
  }
}

function getSavedSettings() {
  ensureDataDir();
  try { return { activeAccountId: null, activeProfileId: null, lastLoader: 'vanilla', lastVersion: '1.20.4', defaultRam: 4, jvmArgs: '', keepLauncherOpen: true, language: 'en', discordRpc: true, javaPath: '', autoBackup: false, backupKeep: 5, activeSkinName: 'default', skinModelType: 'slim', ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')) }; }
  catch { return { activeAccountId: null, activeProfileId: null, lastLoader: 'vanilla', lastVersion: '1.20.4', defaultRam: 4, jvmArgs: '', keepLauncherOpen: true, language: 'en', discordRpc: true, javaPath: '', autoBackup: false, backupKeep: 5, activeSkinName: 'default', skinModelType: 'slim' }; }
}

function saveSettingsToStore(newSettings) {
  ensureDataDir();
  const updated = { ...getSavedSettings(), ...newSettings };
  fs.writeFileSync(settingsFile, JSON.stringify(updated, null, 2));
  return updated;
}

function getSavedAccounts() {
  ensureDataDir();
  try { return JSON.parse(fs.readFileSync(accountsFile, 'utf8')); } catch { return []; }
}

function saveAccountToStore(account) {
  ensureDataDir();
  const accounts = getSavedAccounts();
  const index = accounts.findIndex((a) => a.id === account.id);
  if (index !== -1) accounts[index] = account;
  else accounts.push(account);
  fs.writeFileSync(accountsFile, JSON.stringify(accounts, null, 2));
  return accounts;
}

function removeAccountFromStore(accountId) {
  ensureDataDir();
  const accounts = getSavedAccounts().filter((a) => a.id !== accountId);
  fs.writeFileSync(accountsFile, JSON.stringify(accounts, null, 2));
  return accounts;
}

function checkJava() {
  const settings = getSavedSettings();
  try {
    const best = javaService.findJava({ settingsPath: settings.javaPath, minMajor: 21 });
    if (best) {
      return {
        found: true,
        major: best.major,
        version: String(best.major),
        full: best.full,
        path: best.path,
        is64: best.is64,
      };
    }
  } catch {}

  try {
    const any = javaService.findAnyJava();
    if (any) {
      return {
        found: false,
        major: any.major,
        version: String(any.major),
        full: any.full,
        path: any.path,
        is64: any.is64,
        needsInstall: true,
        reason: any.major < 21 ? `Java ${any.major} is too old (21+ required)` : 'Java is not 64-bit',
      };
    }
  } catch {}

  return { found: false, version: null, full: null, path: null, major: 0, needsInstall: true };
}

function saveWindowState() {
  if (!mainWindow) return;
  try {
    const bounds = mainWindow.getBounds();
    const maximized = mainWindow.isMaximized();
    fs.writeFileSync(windowStateFile, JSON.stringify({ bounds, maximized }, null, 2));
  } catch {}
}

function createWindow() {
  let bounds = { width: 960, height: 660 };
  let maximized = false;
  try {
    if (fs.existsSync(windowStateFile)) {
      const saved = JSON.parse(fs.readFileSync(windowStateFile, 'utf8'));
      if (saved.bounds) bounds = saved.bounds;
      if (saved.maximized) maximized = true;
    }
  } catch {}

  mainWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    thickFrame: false,
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (maximized) mainWindow.maximize();
  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('maximize', saveWindowState);
  mainWindow.on('unmaximize', saveWindowState);
}

app.whenReady().then(() => {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }
  app.on('second-instance', (event, argv) => {
    const urlArg = argv.find((a) => a.startsWith('crystall://'));
    if (urlArg) handleDeepLink(urlArg);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  try {
    if (process.defaultApp) {
      app.setAsDefaultProtocolClient('crystall', process.execPath, [path.resolve(process.argv[1] || '.')]);
    } else {
      app.setAsDefaultProtocolClient('crystall');
    }
  } catch (err) { console.warn('Protocol register failed:', err.message); }

  const coldLink = process.argv.find((a) => a.startsWith('crystall://'));
  if (coldLink) setTimeout(() => handleDeepLink(coldLink), 1500);

  createWindow();
  createTray();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  const updatedFile = path.join(baseDataDir, '.updated');
  if (fs.existsSync(updatedFile) && !isUpdateRestart) {
    // keep marker only during an install restart; cleaned after first successful check
  }

  async function checkUpdate() {
    try {
      const update = await updateService.checkForUpdates();
      if (update.hasUpdate && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', update);
        try {
          if (update.downloadUrl) {
            const dest = path.join(baseDataDir, 'update_setup.exe');
            // Drop any cached installer (always re-fetch the correct one)
            if (fs.existsSync(dest)) { try { fs.unlinkSync(dest); } catch {} }
            updateService.downloadUpdate(update.downloadUrl, dest, (pct) => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('update-progress', { percent: pct, status: `Pre-downloading update... ${pct}%`, background: true });
              }
            }).then(() => {
              bgUpdatePath = dest;
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('update-progress', { percent: 100, status: 'Update ready — Restart anytime', background: true, ready: true });
              }
            }).catch(() => {});
          }
        } catch {}
      }
    } catch {}
  }
  setTimeout(checkUpdate, 5000);
  setInterval(checkUpdate, 300000);
});

app.on('before-quit', () => {
  if (mainWindow) mainWindow.destroy();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('open-external', async (e, url) => { shell.openExternal(url); });

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => { if (mainWindow) mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); });
ipcMain.on('window-close', () => { app.quit(); });
ipcMain.on('window-expand', () => mainWindow?.setMinimumSize(850, 580));

ipcMain.handle('check-java', async () => checkJava());

ipcMain.handle('browse-java', async () => {
  const { dialog } = require('electron');
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select java executable',
    filters: process.platform === 'win32'
      ? [{ name: 'Java', extensions: ['exe'] }]
      : [{ name: 'Java', extensions: [] }],
    properties: ['openFile'],
  });
  return result.canceled || !result.filePaths.length ? null : result.filePaths[0];
});

ipcMain.handle('install-java', async (e) => {
  try {
    const result = await javaService.downloadAndInstall((progress) => {
      e.sender.send('java-install-progress', progress);
    });
    return { success: true, path: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-settings', async () => getSavedSettings());
ipcMain.handle('save-settings', async (e, s) => saveSettingsToStore(s));
ipcMain.handle('open-game-folder', async () => { const f = path.join(baseDataDir, 'game'); if (!fs.existsSync(f)) fs.mkdirSync(f, { recursive: true }); shell.openPath(f); return f; });
ipcMain.handle('open-saves-folder', async () => { const f = path.join(baseDataDir, 'game', 'saves'); if (!fs.existsSync(f)) fs.mkdirSync(f, { recursive: true }); shell.openPath(f); return f; });
ipcMain.handle('list-worlds', async () => {
  const savesDir = path.join(baseDataDir, 'game', 'saves');
  if (!fs.existsSync(savesDir)) return [];
  const worlds = [];
  for (const entry of fs.readdirSync(savesDir)) {
    const worldDir = path.join(savesDir, entry);
    if (!fs.statSync(worldDir).isDirectory()) continue;
    const levelDat = path.join(worldDir, 'level.dat');
    const iconPath = path.join(worldDir, 'icon.png');
    let name = entry;
    let icon = null;
    let lastPlayed = null;
    let gameVersion = null;
    if (fs.existsSync(levelDat)) {
      try {
        const buf = fs.readFileSync(levelDat);
        const str = buf.toString('utf8', 0, Math.min(buf.length, 65536));
        const nameMatch = str.match(/LevelName[^a-zA-Z]*([^}]+)/);
        if (nameMatch) name = nameMatch[1].trim();
        const timeMatch = str.match(/LastPlayed[^0-9-]*(-?\d+)/);
        if (timeMatch) lastPlayed = parseInt(timeMatch[1]);
        const verMatch = str.match(/VersionName[^"]*"([^"]+)/);
        if (verMatch) gameVersion = verMatch[1];
      } catch {}
    }
    if (fs.existsSync(iconPath)) {
      icon = fs.readFileSync(iconPath).toString('base64');
    }
    const stat = fs.statSync(worldDir);
    worlds.push({ id: entry, name, icon, lastPlayed, gameVersion, size: getDirSize(worldDir), created: stat.birthtimeMs || stat.ctimeMs });
  }
  worlds.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
  return worlds;
});
ipcMain.handle('delete-world', async (e, worldId) => {
  const worldDir = path.join(baseDataDir, 'game', 'saves', worldId);
  if (fs.existsSync(worldDir)) {
    const backupDir = path.join(baseDataDir, 'backups', 'worlds', worldId);
    if (!fs.existsSync(path.dirname(backupDir))) fs.mkdirSync(path.dirname(backupDir), { recursive: true });
    fs.cpSync(worldDir, backupDir, { recursive: true });
    fs.rmSync(worldDir, { recursive: true, force: true });
  }
  return { success: true };
});

function getDirSize(dir) {
  try {
    let size = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) size += getDirSize(full);
      else if (entry.isFile()) size += fs.statSync(full).size;
    }
    return size;
  } catch { return 0; }
}
ipcMain.handle('open-versions-folder', async () => { const f = path.join(baseDataDir, 'game', 'versions'); if (!fs.existsSync(f)) fs.mkdirSync(f, { recursive: true }); shell.openPath(f); return f; });
ipcMain.handle('open-backups-folder', async () => { const f = path.join(baseDataDir, 'backups'); if (!fs.existsSync(f)) fs.mkdirSync(f, { recursive: true }); shell.openPath(f); return f; });
ipcMain.handle('get-resourcepacks-folder', async () => { const f = path.join(baseDataDir, 'game', 'resourcepacks'); if (!fs.existsSync(f)) fs.mkdirSync(f, { recursive: true }); return f; });
ipcMain.handle('get-shaderpacks-folder', async () => { const f = path.join(baseDataDir, 'game', 'shaderpacks'); if (!fs.existsSync(f)) fs.mkdirSync(f, { recursive: true }); return f; });

ipcMain.handle('get-versions', async () => await versionService.getAllVersions());

ipcMain.handle('login-microsoft', async (e) => {
  try { const a = await authService.loginWithMicrosoft((s) => e.sender.send('auth-status', s)); saveAccountToStore(a); return { success: true, account: a }; }
  catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('create-offline-account', async (e, u) => { const a = authService.createOfflineAccount(u); saveAccountToStore(a); return a; });
ipcMain.handle('get-accounts', async () => getSavedAccounts());
ipcMain.handle('save-account', async (e, a) => saveAccountToStore(a));
ipcMain.handle('remove-account', async (e, id) => removeAccountFromStore(id));

ipcMain.handle('get-profiles', async () => profileService.getProfiles());
ipcMain.handle('save-profile', async (e, p) => profileService.saveProfile(p));
ipcMain.handle('delete-profile', async (e, { profileId, backupMods }) => profileService.deleteProfile(profileId, backupMods));
ipcMain.handle('get-mods', async (e, id) => profileService.listMods(id));
ipcMain.handle('toggle-mod', async (e, { profileId, fileName, enabled }) => profileService.toggleMod(profileId, fileName, enabled));
ipcMain.handle('open-mods-folder', async (e, id) => { const f = profileService.getModsFolder(id); shell.openPath(f); return f; });

ipcMain.handle('launch-game', async (e, { profileId, accountId, server }) => {
  try {
    const settings = getSavedSettings();
    const profiles = profileService.getProfiles();
    const profile = profiles.find((p) => p.id === profileId) || profiles[0];
    if (!profile) return { success: false, error: 'No profile found. Create a profile first.' };
    const accounts = getSavedAccounts();
    const account = accounts.find((a) => a.id === accountId) || accounts[0];
    if (!account) return { success: false, error: 'No account selected. Add an account first.' };
    if (settings.defaultRam && (!profile.ram || profile.ram === 4)) profile.ram = settings.defaultRam;
    if (settings.autoBackup) {
      try { runScheduledWorldBackups(); } catch {}
    }
    const sessionStart = Date.now();
    const result = await launchService.launchGame(profile, account,
      (p) => e.sender.send('launch-progress', p),
      (s) => e.sender.send('launch-status', s),
      (l) => e.sender.send('launch-log', l),
      () => {
        if (settings.discordRpc !== false) {
          rpcService.setActivity({
            details: `Playing Minecraft ${profile.mcVersion}`,
            state: 'with Crystal Launcher',
            largeImageKey: 'minecraft_logo',
            largeImageText: 'Minecraft',
            smallImageKey: 'crystal_logo',
            smallImageText: 'Crystal Launcher',
            startTimestamp: Math.floor(sessionStart / 1000),
            instance: true,
          });
        }
      },
      () => {
        rpcService.clearActivity();
        rpcService.disconnect();
        const settings2 = getSavedSettings();
        if (settings2.discordRpc !== false) {
          setTimeout(() => { rpcService.connect(); }, 500);
        }
      },
      server
    );
    if (result?.status === 'started') {
      const sessions = getPlaytimeSessions();
      sessions.push({ id: Date.now().toString(), start: sessionStart, profile: profile.name, version: profile.mcVersion });
      fs.writeFileSync(playtimeFile, JSON.stringify(sessions, null, 2));
      if (settings.discordRpc !== false) {
        rpcService.connect();
        rpcService.setActivity({
          details: `Launching Minecraft ${profile.mcVersion}`,
          state: 'with Crystal Launcher',
          largeImageKey: 'minecraft_logo',
          largeImageText: 'Minecraft',
          smallImageKey: 'crystal_logo',
          smallImageText: 'Crystal Launcher',
          startTimestamp: Math.floor(sessionStart / 1000),
          instance: true,
        });
      }
    }
    return { success: true, result };
  } catch (err) { return { success: false, error: err.message }; }
});

function getPlaytimeSessions() {
  if (!fs.existsSync(playtimeFile)) return [];
  try { return JSON.parse(fs.readFileSync(playtimeFile, 'utf8')); }
  catch { return []; }
}

ipcMain.handle('check-updates', async () => updateService.checkForUpdates());
ipcMain.handle('get-app-version', async () => { try { return app.getVersion(); } catch { return '1.4.17'; } });

ipcMain.handle('get-saved-skins', async () => {
  const skinDir = path.join(baseDataDir, 'skins');
  if (!fs.existsSync(skinDir)) return [];
  const skins = [];
  for (const f of fs.readdirSync(skinDir)) {
    if (f.endsWith('.png')) {
      const data = fs.readFileSync(path.join(skinDir, f)).toString('base64');
      skins.push({ name: f.replace('.png', ''), data, path: path.join(skinDir, f) });
    }
  }
  return skins;
});

ipcMain.handle('save-skin-file', async (e, { name, base64Data }) => {
  try {
    const skinDir = path.join(baseDataDir, 'skins');
    if (!fs.existsSync(skinDir)) fs.mkdirSync(skinDir, { recursive: true });
    const buf = Buffer.from(base64Data, 'base64');
    const filePath = path.join(skinDir, `${name}.png`);
    fs.writeFileSync(filePath, buf);
    return { success: true, path: filePath };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('delete-skin', async (e, name) => {
  try {
    const p = path.join(baseDataDir, 'skins', `${name}.png`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('fetch-namemc-skin', async (e, username) => {
  try {
    // 1. Get UUID from Mojang API
    const uuidResp = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`);
    if (!uuidResp.ok) return { success: false, error: 'Player not found' };
    const uuidData = await uuidResp.json();
    const uuid = uuidData.id;

    // 2. Get profile including skin data from Mojang session server
    const profileResp = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`);
    if (!profileResp.ok) return { success: false, error: 'Could not fetch skin profile' };
    const profileData = await profileResp.json();

    // 3. Parse the texture property
    const textureProp = profileData.properties?.find((p) => p.name === 'textures');
    if (!textureProp) return { success: false, error: 'No skin data found' };
    const textureData = JSON.parse(Buffer.from(textureProp.value, 'base64').toString('utf8'));
    const skinUrl = textureData.textures?.SKIN?.url;
    if (!skinUrl) return { success: false, error: 'No skin URL found' };

    // 4. Determine model type (slim/normal)
    const model = textureData.textures?.SKIN?.metadata?.model || 'classic';

    // 5. Download the skin image
    const skinResp = await fetch(skinUrl);
    if (!skinResp.ok) return { success: false, error: 'Could not download skin' };
    const skinBuf = Buffer.from(await skinResp.arrayBuffer());
    const base64 = skinBuf.toString('base64');

    // Try to also get name from NameMC for better display name
    let displayName = username;
    try {
      const namemcResp = await fetch(`https://api.namemc.com/profile/${uuid}`, { signal: AbortSignal.timeout(5000) });
      if (namemcResp.ok) {
        const nmData = await namemcResp.json();
        if (nmData?.name) displayName = nmData.name;
      }
    } catch {}

    return { success: true, base64, model: model === 'slim' ? 'slim' : 'classic', uuid, name: displayName };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('apply-microsoft-skin', async (e, { skinPath, variant, accountId }) => {
  try {
    const accounts = getSavedAccounts();
    const settings = getSavedSettings();
    const wantedId = accountId || settings.activeAccountId;
    let active = accounts.find((a) => a.id === wantedId);
    if (!active || active.type !== 'microsoft' || !active.accessToken) {
      active = accounts.find((a) => a.type === 'microsoft' && a.accessToken) || null;
    }
    if (!active) {
      return { success: false, error: 'No Microsoft account logged in. Sign in with Microsoft to auto-apply skins in Minecraft.' };
    }

    const doUpload = async (token) => {
      if (skinPath === 'default') {
        const res = await fetch('https://api.minecraftservices.com/minecraft/profile/skins/active', {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + token }
        });
        const text = await res.text();
        return { status: res.status, ok: res.ok || res.status === 204, body: text };
      }

      if (!fs.existsSync(skinPath)) {
        return { status: 400, ok: false, body: 'Skin file not found on disk.' };
      }

      const skinBuf = fs.readFileSync(skinPath);
      const boundary = '----WebKitFormBoundary' + Date.now().toString(36) + Math.random().toString(36).substring(2);
      const nl = '\r\n';
      const variantStr = (variant || 'classic').toString().toLowerCase() === 'slim' ? 'slim' : 'classic';

      const parts = [
        Buffer.from(`--${boundary}${nl}Content-Disposition: form-data; name="variant"${nl}${nl}${variantStr}${nl}`),
        Buffer.from(`--${boundary}${nl}Content-Disposition: form-data; name="file"; filename="skin.png"${nl}Content-Type: image/png${nl}${nl}`),
        skinBuf,
        Buffer.from(`${nl}--${boundary}--${nl}`)
      ];
      const body = Buffer.concat(parts);

      const res = await fetch('https://api.minecraftservices.com/minecraft/profile/skins', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'multipart/form-data; boundary=' + boundary
        },
        body
      });
      const text = await res.text();
      return { status: res.status, ok: res.ok, body: text };
    };

    let token = active.accessToken;
    let res = await doUpload(token);

    if (!res.ok && res.status === 401 && active.refreshToken) {
      try {
        const refreshed = await authService.refreshMicrosoftToken(active.refreshToken);
        if (refreshed && refreshed.accessToken) {
          saveAccountToStore(refreshed);
          token = refreshed.accessToken;
          res = await doUpload(token);
        }
      } catch (refErr) {
        console.warn('Token refresh failed during skin upload:', refErr.message);
      }
    }

    if (res.ok) {
      return { success: true, account: active.name };
    } else {
      let msg = res.body;
      try {
        const json = JSON.parse(res.body);
        if (json.errorMessage) msg = json.errorMessage;
        else if (json.developerMessage) msg = json.errorMessage || json.developerMessage;
      } catch {}
      return { success: false, error: `Minecraft API error (${res.status}): ${msg}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-crash-logs', async () => {
  const crashDir = path.join(baseDataDir, 'game', 'crash-reports');
  if (!fs.existsSync(crashDir)) return [];
  const logs = [];
  for (const entry of fs.readdirSync(crashDir).sort().reverse().slice(0, 20)) {
    const filePath = path.join(crashDir, entry);
    try {
      const content = fs.readFileSync(filePath, 'utf8').substring(0, 5000);
      const time = fs.statSync(filePath).mtimeMs;
      logs.push({ name: entry, time, content });
    } catch {}
  }
  return logs;
});

ipcMain.handle('read-crash-log', async (e, fileName) => {
  const filePath = path.join(baseDataDir, 'game', 'crash-reports', fileName);
  if (!fs.existsSync(filePath)) return null;
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
});

ipcMain.handle('download-mc-version', async (e, { version, loaderType }) => {
  try {
    const { execSync } = require('child_process');
    const versionsDir = path.join(baseDataDir, 'game', 'versions');
    const verDir = path.join(versionsDir, version);
    if (fs.existsSync(path.join(verDir, `${version}.json`))) return { success: true, cached: true };
    e.sender.send('mc-download-progress', { percent: 10, status: `Downloading Minecraft ${version}...` });
    const manifest = (await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json', { timeout: 10000 })).data;
    const entry = manifest.versions.find((v) => v.id === version);
    if (!entry) throw new Error(`Version ${version} not found`);
    const meta = (await axios.get(entry.url, { timeout: 10000 })).data;
    if (!fs.existsSync(verDir)) fs.mkdirSync(verDir, { recursive: true });
    fs.writeFileSync(path.join(verDir, `${version}.json`), JSON.stringify(meta));
    e.sender.send('mc-download-progress', { percent: 30, status: `Downloading client jar for ${version}...` });
    const clientUrl = meta.downloads?.client?.url;
    if (clientUrl) {
      const jarPath = path.join(verDir, `${version}.jar`);
      const jarRes = await axios.get(clientUrl, { responseType: 'stream', timeout: 120000 });
      const jarWriter = fs.createWriteStream(jarPath);
      const total = parseInt(jarRes.headers['content-length'] || '0');
      let dl = 0;
      jarRes.data.on('data', (c) => { dl += c.length; if (total) e.sender.send('mc-download-progress', { percent: 30 + Math.round((dl / total) * 60), status: `Downloading ${version}.jar...` }); });
      await new Promise((r) => { jarWriter.on('finish', r); jarRes.data.pipe(jarWriter); });
    }
    e.sender.send('mc-download-progress', { percent: 100, status: `${version} ready` });
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('get-playtime', async () => {
  const sessions = getPlaytimeSessions();
  const totalMs = sessions.reduce((sum, s) => sum + (s.end || Date.now() - s.start), 0);
  const today = new Date().toDateString();
  const todayMs = sessions.filter((s) => new Date(s.start).toDateString() === today).reduce((sum, s) => sum + (s.end || Date.now() - s.start), 0);
  const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekMs = sessions.filter((s) => s.start >= weekStart).reduce((sum, s) => sum + (s.end || Date.now() - s.start), 0);
  return { totalMs, todayMs, weekMs, sessions: sessions.slice(-50).reverse() };
});

ipcMain.handle('modrinth-search', async (e, { query, facets, offset, index }) => {
  try { return await modrinthService.searchProjects(query, facets, offset, 30, index || 'relevance'); }
  catch (err) { return { hits: [] }; }
});

ipcMain.handle('modrinth-project', async (e, slug) => {
  return await modrinthService.getProject(slug);
});

ipcMain.handle('modrinth-versions', async (e, { projectId, loaders, gameVersions }) => {
  return await modrinthService.getProjectVersions(projectId, loaders || [], gameVersions || []);
});

ipcMain.handle('modrinth-download', async (e, { url, profileId, fileName }) => {
  try {
    const modsDir = profileService.getModsFolder(profileId);
    const dest = path.join(modsDir, fileName);
    const ok = await modrinthService.downloadFile(url, dest, (pct) => {
      e.sender.send('mod-download-progress', { percent: pct, fileName });
    });
    return { success: ok, path: dest };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('modrinth-install-modpack', async (e, { projectId, versionId, profileId }) => {
  try {
    const version = (await modrinthService.getVersionDependencies(versionId));
    const versionData = (await axios.get(`https://api.modrinth.com/v2/version/${versionId}`, { timeout: 10000 })).data;
    const modsDir = profileService.getModsFolder(profileId);

    const filesToDownload = versionData.files || [];
    for (const file of filesToDownload) {
      if (file.filename.endsWith('.jar') || file.filename.endsWith('.mrpack')) {
        const dest = path.join(modsDir, file.filename.replace('.mrpack', '.zip'));
        await modrinthService.downloadFile(file.url, dest);
      }
    }

    const deps = versionData.dependencies || [];
    for (const dep of deps) {
      if (dep.dependency_type === 'required' && dep.project_id) {
        try {
          const depVersions = await modrinthService.getProjectVersions(dep.project_id, [], []);
          if (depVersions.length) {
            const latestDep = depVersions[0];
            for (const f of latestDep.files || []) {
              if (f.filename.endsWith('.jar')) {
                const dest = path.join(modsDir, f.filename);
                await modrinthService.downloadFile(f.url, dest);
              }
            }
          }
        } catch (e2) { console.warn('Dep download warning:', e2.message); }
      }
    }

    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('curseforge-search', async (e, { query, classId, offset }) => {
  try { return await curseforgeService.searchMods(query, classId || 6, offset || 0); }
  catch (err) { return []; }
});

ipcMain.handle('curseforge-versions', async (e, slug) => {
  try { return await curseforgeService.getModVersions(slug); }
  catch (err) { return []; }
});

ipcMain.handle('download-to-folder', async (e, { url, fileName, folderPath }) => {
  try {
    const dest = path.join(folderPath, fileName);
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
    const writer = fs.createWriteStream(dest);
    const res = await axios({ url, responseType: 'stream', timeout: 60000, maxRedirects: 5 });
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
      res.data.pipe(writer);
    });
    return { success: true, path: dest };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('curseforge-download', async (e, { fileId, fileName, profileId }) => {
  try {
    const profileService = require('./services/profileService');
    const modsDir = profileService.getModsFolder(profileId);
    const dest = path.join(modsDir, fileName);
    await curseforgeService.downloadFile(fileId, fileName, dest);
    return { success: true, path: dest };
  } catch (err) { return { success: false, error: err.message }; }
});

const defaultServers = [
  { id: 'hypixel', name: 'Hypixel', address: 'mc.hypixel.net', port: 25565 },
  { id: 'pvpland', name: 'PvP Land', address: 'pvp.land', port: 25565 },
  { id: 'crystal', name: 'Crystal Network', address: 'play.crystalmc.net', port: 25565 }
];

ipcMain.handle('get-servers', async () => {
  if (!fs.existsSync(serversFile)) {
    try {
      fs.writeFileSync(serversFile, JSON.stringify(defaultServers, null, 2));
      return defaultServers;
    } catch { return []; }
  }
  try { return JSON.parse(fs.readFileSync(serversFile, 'utf8')); }
  catch { return []; }
});

ipcMain.handle('save-server', async (e, server) => {
  const list = fs.existsSync(serversFile) ? JSON.parse(fs.readFileSync(serversFile, 'utf8')) : [];
  const idx = list.findIndex((s) => s.id === server.id);
  if (idx !== -1) list[idx] = server;
  else list.push(server);
  fs.writeFileSync(serversFile, JSON.stringify(list, null, 2));
  return list;
});

ipcMain.handle('delete-server', async (e, id) => {
  const list = fs.existsSync(serversFile) ? JSON.parse(fs.readFileSync(serversFile, 'utf8')) : [];
  const filtered = list.filter((s) => s.id !== id);
  fs.writeFileSync(serversFile, JSON.stringify(filtered, null, 2));
  return filtered;
});

ipcMain.handle('download-update', async (e, downloadUrl) => {
  try {
    if (!downloadUrl) return { success: false, error: 'No download URL for this update' };
    const update = await updateService.checkForUpdates().catch(() => null);
    const dest = path.join(baseDataDir, 'update_setup.exe');
    const isLocal = downloadUrl.match(/^[A-Z]:\\/i) || downloadUrl.startsWith('file://') || downloadUrl.startsWith('\\\\');
    if (isLocal) {
      const local = downloadUrl.replace(/^file:\/\//i, '');
      if (!fs.existsSync(local)) return { success: false, error: 'Installer not found: ' + local };
      const target = update?.version || '';
      if (target && !path.basename(local).toLowerCase().includes(String(target).toLowerCase())) {
        return { success: false, error: `Wrong installer for ${target}: ${path.basename(local)}` };
      }
    }
    if (fs.existsSync(dest)) { try { fs.unlinkSync(dest); } catch {} }
    e.sender.send('update-progress', { percent: 0, status: 'Downloading update...' });
    await updateService.downloadUpdate(downloadUrl, dest, (pct) => {
      e.sender.send('update-progress', { percent: pct, status: `Downloading... ${pct}%` });
    });
    e.sender.send('update-progress', { percent: 100, status: 'Download complete' });
    fs.writeFileSync(path.join(baseDataDir, '.updated'), '1');
    spawn(dest, ['/S', '/currentuser', '/R'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    setTimeout(() => { mainWindow?.destroy(); app.quit(); }, 4000);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('backup-profile', async (e, { profileId }) => {
  try {
    const profiles = profileService.getProfiles();
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return { success: false, error: 'Profile not found' };
    const modsDir = profileService.getModsFolder(profileId);
    const backupDir = path.join(baseDataDir, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const safeName = profile.name.replace(/[^a-z0-9]/gi, '_');
    const timestamp = new Date().toISOString().slice(0, 10);
    const zipName = `${safeName}_${timestamp}.zip`;
    const zipPath = path.join(backupDir, zipName);
    const psCmd = `Compress-Archive -Path '${modsDir}\\*' -DestinationPath '${zipPath}' -Force`;
    execSync(`powershell -NoProfile -Command "${psCmd.replace(/"/g, '\\"')}"`, { timeout: 30000, windowsHide: true });
    if (!fs.existsSync(zipPath)) {
      fs.writeFileSync(path.join(backupDir, `${safeName}_${timestamp}.json`), JSON.stringify(profile, null, 2));
      fs.writeFileSync(path.join(backupDir, `${safeName}_${timestamp}.md`), 'Profile: ' + profile.name + '\nMods dir: ' + modsDir);
      return { success: true, path: path.join(backupDir, `${safeName}_${timestamp}.json`), note: 'Mods folder saved as JSON metadata (Compress-Archive unavailable)' };
    }
    return { success: true, path: zipPath };
  } catch (err) {
    try {
      const profiles = profileService.getProfiles();
      const profile = profiles.find((p) => p.id === profileId);
      const modsDir = profileService.getModsFolder(profileId);
      const backupDir = path.join(baseDataDir, 'backups');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const safeName = profile.name.replace(/[^a-z0-9]/gi, '_');
      const timestamp = new Date().toISOString().slice(0, 10);
      fs.writeFileSync(path.join(backupDir, `${safeName}_${timestamp}.json`), JSON.stringify(profile, null, 2));
      const metaPath = path.join(backupDir, `${safeName}_${timestamp}.txt`);
      fs.writeFileSync(metaPath, `Profile: ${profile.name}\nMods: ${modsDir}\nError: ${err.message}\nCopy mods manually from above path.`);
      return { success: true, path: metaPath, note: 'Metadata saved (zip failed: ' + err.message + ')' };
    } catch (e2) { return { success: false, error: e2.message }; }
  }
});

ipcMain.handle('copy-to-mods', async (e, { profileId, sourcePath, fileName }) => {
  try {
    const modsDir = profileService.getModsFolder(profileId);
    const dest = path.join(modsDir, fileName);
    fs.copyFileSync(sourcePath, dest);
    return { success: true, path: dest };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('toggle-rpc', async (e, enabled) => {
  if (enabled) { rpcService.connect(); }
  else { rpcService.disconnect(); }
  return enabled;
});

ipcMain.handle('rpc-set-view', async (e, view) => {
  const settings = getSavedSettings();
  if (settings.discordRpc === false) return;
  rpcService.connect();
  rpcService.setLauncherActivity(view || 'play');
});

ipcMain.handle('get-news', async () => {
  try {
    const newsBase = 'https://launchercontent.mojang.com';
    const res = await axios.get(`${newsBase}/v2/javaPatchNotes.json`, { timeout: 10000 });
    const entries = (res.data?.entries || []).slice(0, 30);
    const articles = entries.map((e) => ({
      title: e.title || '',
      text: e.shortText || '',
      date: e.date || '',
      image: e.image?.url ? `${newsBase}${e.image.url}` : (typeof e.image === 'string' ? `${newsBase}${e.image}` : ''),
      category: e.type || 'news',
      link: e.contentPath ? `${newsBase}${e.contentPath}` : '',
      version: e.version || '',
    }));
    return { articles };
  } catch { return { articles: [] }; }
});

ipcMain.handle('get-translations', async (e, lang) => {
  const path = require('path');
  const fs = require('fs');
  const filePath = path.join(__dirname, 'lang', `${lang}.json`);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data;
  } catch { return null; }
});

ipcMain.handle('get-languages', async () => i18n.getAvailableLanguages());

// === Live server ping ===
ipcMain.handle('ping-servers', async (e, servers) => {
  try { return await serverPingService.pingAll(servers || []); }
  catch (err) { return (servers || []).map((s) => ({ ...s, online: false, error: err.message })); }
});

ipcMain.handle('ping-server', async (e, { address, port }) => {
  try { return await serverPingService.ping(address, port || 25565, 4000); }
  catch (err) { return { online: false, error: err.message }; }
});

// === Crash analysis ===
ipcMain.handle('analyze-crash', async (e, content) => {
  try { return crashAnalyzer.analyze(content); }
  catch { return { title: 'Unknown error', summary: 'Could not analyze crash.', hints: [] }; }
});

// === Mod updates via Modrinth hash API ===
ipcMain.handle('check-mod-updates', async (e, profileId) => {
  try {
    const crypto = require('crypto');
    const mods = profileService.listMods(profileId);
    const settings = getSavedSettings();
    const results = [];
    const hashes = [];
    const byHash = new Map();

    for (const mod of mods) {
      const abs = path.join(profileService.getModsFolder(profileId), mod.fileName);
      try {
        const buf = fs.readFileSync(abs);
        const sha1 = crypto.createHash('sha1').update(buf).digest('hex');
        hashes.push(sha1);
        byHash.set(sha1, mod);
      } catch {}
    }

    if (hashes.length) {
      const loaderMap = { fabric: 'fabric', quilt: 'quilt', forge: 'forge', neoforge: 'neoforge' };
      const loaders = settings.lastLoader && loaderMap[settings.lastLoader] ? [loaderMap[settings.lastLoader]] : [];
      const gameVersions = settings.lastVersion ? [settings.lastVersion] : [];
      const updates = await modrinthService.checkUpdatesForHashes(hashes, { loaders, gameVersions, algorithm: 'sha1' });

      for (const [sha1, mod] of byHash) {
        const upd = updates[sha1];
        if (upd && upd.version_number) {
          const installedVer = (mod.fileName.match(/[-_](\d+\.\d+[\w.-]*)\.jar/i) || [])[1] || '';
          results.push({
            fileName: mod.fileName,
            name: mod.name,
            enabled: mod.enabled,
            latestVersion: upd.version_number,
            projectUrl: upd.project_id ? `https://modrinth.com/${upd.project_id}` : '',
            hasUpdate: upd.version_number !== installedVer,
            slug: upd.project_id || '',
          });
        } else {
          results.push({ fileName: mod.fileName, name: mod.name, enabled: mod.enabled, latestVersion: null, hasUpdate: false, slug: '' });
        }
      }
    }
    return results;
  } catch (err) { console.warn('check-mod-updates failed:', err.message); return []; }
});

// === Mod install with required dependencies ===
ipcMain.handle('modrinth-install-mod-with-deps', async (e, { url, profileId, fileName, versionId }) => {
  try {
    const modsDir = profileService.getModsFolder(profileId);
    const dest = path.join(modsDir, fileName);
    const ok = await modrinthService.downloadFile(url, dest, (pct) => {
      e.sender.send('mod-download-progress', { percent: pct, fileName });
    });
    if (!ok) return { success: false, error: 'Download failed' };

    const installedDeps = [];
    if (versionId) {
      const deps = await modrinthService.resolveRequiredDependencies(versionId);
      const seenNames = new Set([fileName.toLowerCase()]);
      for (const dep of deps) {
        for (const f of dep.files || []) {
          if (!f.primary && f !== (dep.files[0])) continue;
          const depName = f.filename || f.path || 'dep.jar';
          if (seenNames.has(depName.toLowerCase())) continue;
          if (fs.existsSync(path.join(modsDir, depName))) { seenNames.add(depName.toLowerCase()); continue; }
          seenNames.add(depName.toLowerCase());
          await modrinthService.downloadFile(f.url, path.join(modsDir, depName));
          installedDeps.push(depName);
        }
      }
    }
    return { success: true, path: dest, installedDeps };
  } catch (err) { return { success: false, error: err.message }; }
});

// === Screenshots ===
ipcMain.handle('list-screenshots', async () => {
  try {
    const dir = path.join(baseDataDir, 'game', 'screenshots');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .map((f) => {
        const full = path.join(dir, f);
        const st = fs.statSync(full);
        return { name: f, path: full, size: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
  } catch { return []; }
});

ipcMain.handle('read-screenshot', async (e, fileName) => {
  try {
    const dir = path.join(baseDataDir, 'game', 'screenshots');
    const full = path.join(dir, path.basename(fileName));
    if (!fs.existsSync(full)) return null;
    return `data:image/${path.extname(full).slice(1).toLowerCase()};base64,` + fs.readFileSync(full).toString('base64');
  } catch { return null; }
});

ipcMain.handle('delete-screenshot', async (e, fileName) => {
  try {
    const dir = path.join(baseDataDir, 'game', 'screenshots');
    const full = path.join(dir, path.basename(fileName));
    if (fs.existsSync(full)) fs.unlinkSync(full);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('open-screenshots-folder', async () => {
  const dir = path.join(baseDataDir, 'game', 'screenshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  shell.openPath(dir);
  return dir;
});

// === World backups ===
ipcMain.handle('backup-world', async (e, worldId) => {
  try {
    const savesDir = path.join(baseDataDir, 'game', 'saves');
    const src = path.join(savesDir, path.basename(worldId));
    if (!fs.existsSync(src)) return { success: false, error: 'World not found' };
    const destDir = path.join(baseDataDir, 'backups', 'worlds');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = path.join(destDir, `${path.basename(worldId)}_${stamp}.zip`);
    const psCmd = `Compress-Archive -Path '${src}\\*' -DestinationPath '${dest}' -Force`;
    execSync(`powershell -NoProfile -Command "${psCmd.replace(/"/g, '\\"')}"`, { timeout: 60000, windowsHide: true });
    return { success: fs.existsSync(dest), path: dest };
  } catch (err) { return { success: false, error: err.message }; }
});

function runScheduledWorldBackups() {
  try {
    const settings = getSavedSettings();
    if (!settings.autoBackup) return;
    const savesDir = path.join(baseDataDir, 'game', 'saves');
    if (!fs.existsSync(savesDir)) return;
    const destDir = path.join(baseDataDir, 'backups', 'worlds');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const keep = Math.max(1, parseInt(settings.backupKeep, 10) || 5);
    for (const world of fs.readdirSync(savesDir)) {
      const src = path.join(savesDir, world);
      if (!fs.statSync(src).isDirectory()) continue;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
      const dest = path.join(destDir, `${world}_${stamp}.zip`);
      try {
        const psCmd = `Compress-Archive -Path '${src}\\*' -DestinationPath '${dest}' -Force`;
        execSync(`powershell -NoProfile -Command "${psCmd.replace(/"/g, '\\"')}"`, { timeout: 120000, windowsHide: true });
      } catch (err) { console.warn('World backup failed:', err.message); }
    }
    const zips = fs.readdirSync(destDir).filter((f) => f.endsWith('.zip')).sort();
    while (zips.length > keep) {
      try { fs.unlinkSync(path.join(destDir, zips.shift())); } catch {}
    }
  } catch (err) { console.warn('Scheduled backup error:', err.message); }
}

// === Profile export/import ===
ipcMain.handle('export-profile', async (e, profileId) => {
  try {
    const profiles = profileService.getProfiles();
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return { success: false, error: 'Profile not found' };
    const modsDir = profileService.getModsFolder(profileId);
    const tmpDir = path.join(baseDataDir, 'export-tmp');
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'profile.json'), JSON.stringify({ format: 'crystal-profile', version: 1, profile }, null, 2));
    if (fs.existsSync(modsDir)) {
      fs.cpSync(modsDir, path.join(tmpDir, 'mods'), { recursive: true });
    }
    const dest = await dialog.showSaveDialog(mainWindow, {
      title: 'Export profile',
      defaultPath: `${(profile.name || 'profile').replace(/[^a-z0-9]+/gi, '_')}.crystalprofile.zip`,
      filters: [{ name: 'Crystal Profile', extensions: ['zip'] }],
    });
    if (dest.canceled || !dest.filePath) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return { success: false, error: 'Cancelled' };
    }
    if (fs.existsSync(dest.filePath)) fs.unlinkSync(dest.filePath);
    const psCmd = `Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${dest.filePath}' -Force`;
    execSync(`powershell -NoProfile -Command "${psCmd.replace(/"/g, '\\"')}"`, { timeout: 60000, windowsHide: true });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (!fs.existsSync(dest.filePath)) return { success: false, error: 'Zip failed' };
    return { success: true, path: dest.filePath };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('import-profile', async () => {
  try {
    const picked = await dialog.showOpenDialog(mainWindow, {
      title: 'Import profile',
      filters: [{ name: 'Crystal Profile', extensions: ['zip'] }],
      properties: ['openFile'],
    });
    if (picked.canceled || !picked.filePaths.length) return { success: false, error: 'Cancelled' };
    const zipPath = picked.filePaths[0];
    const tmpDir = path.join(baseDataDir, 'import-tmp');
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });
    execSync(`tar -xf "${zipPath}" -C "${tmpDir}"`, { timeout: 30000, windowsHide: true });
    const metaPath = path.join(tmpDir, 'profile.json');
    if (!fs.existsSync(metaPath)) throw new Error('Invalid profile file (missing profile.json)');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const profile = { ...(meta.profile || meta) };
    profile.id = 'profile-' + Date.now();
    profile.created = Date.now();
    profileService.saveProfile(profile);
    const srcMods = path.join(tmpDir, 'mods');
    if (fs.existsSync(srcMods)) {
      const destMods = profileService.getModsFolder(profile.id);
      for (const f of fs.readdirSync(srcMods)) {
        fs.copyFileSync(path.join(srcMods, f), path.join(destMods, f));
      }
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return { success: true, profile };
  } catch (err) { return { success: false, error: err.message }; }
});

// === Import .mrpack / CurseForge zip / MultiMC ===
ipcMain.handle('import-modpack-file', async (e, kind) => {
  try {
    const filters = kind === 'multimc'
      ? [{ name: 'MultiMC/Prism', extensions: ['zip'] }, { name: 'All files', extensions: ['*'] }]
      : [{ name: 'Modpack', extensions: ['mrpack', 'zip'] }];
    const picked = await dialog.showOpenDialog(mainWindow, {
      title: kind === 'multimc' ? 'Import MultiMC/Prism instance' : 'Import modpack file',
      filters,
      properties: ['openFile'],
    });
    if (picked.canceled || !picked.filePaths.length) return { success: false, error: 'Cancelled' };
    const filePath = picked.filePaths[0];
    const tmpDir = path.join(baseDataDir, 'import-pack-tmp');
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });
    execSync(`tar -xf "${filePath}" -C "${tmpDir}"`, { timeout: 120000, windowsHide: true });

    if (kind === 'multimc') {
      let instanceRoot = tmpDir;
      const mmcPath = path.join(tmpDir, 'mmc-pack.json');
      if (!fs.existsSync(mmcPath)) {
        const sub = fs.readdirSync(tmpDir).find((d) => fs.statSync(path.join(tmpDir, d)).isDirectory());
        if (sub && fs.existsSync(path.join(tmpDir, sub, 'mmc-pack.json'))) instanceRoot = path.join(tmpDir, sub);
      }
      const packPath = path.join(instanceRoot, 'mmc-pack.json');
      if (!fs.existsSync(packPath)) throw new Error('Not a MultiMC/Prism instance (mmc-pack.json missing)');
      const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
      const comps = pack.components || [];
      let mcVersion = '1.20.1';
      let loaderType = 'vanilla';
      for (const c of comps) {
        if (c.uid === 'net.minecraft' && c.version) mcVersion = c.version;
        if (c.uid === 'net.fabricmc.fabric-loader') loaderType = 'fabric';
        if (c.uid === 'org.quiltmc.quilt-loader') loaderType = 'quilt';
        if (c.uid === 'net.minecraftforge') loaderType = 'forge';
        if (c.uid && c.uid.includes('neoforged')) loaderType = 'neoforge';
      }
      let name = 'Imported MultiMC';
      let ram = 4;
      try {
        const cfg = fs.readFileSync(path.join(instanceRoot, 'instance.cfg'), 'utf8');
        const nameMatch = cfg.match(/^name=(.*)$/m);
        const ramMatch = cfg.match(/^MaxMemAlloc=(\d+)/m);
        if (nameMatch) name = nameMatch[1].trim();
        if (ramMatch) ram = Math.round(parseInt(ramMatch[1], 10) / 1024) || 4;
      } catch {}
      const profile = profileService.saveProfile({ name, mcVersion, loaderType, loaderVersion: '', ram, isolate: true, created: Date.now() });
      const instGame = path.join(baseDataDir, 'instances', profile.id, 'game');
      fs.mkdirSync(instGame, { recursive: true });
      for (const sub of ['.minecraft', 'minecraft', '']) {
        const src = sub ? path.join(instanceRoot, sub) : instanceRoot;
        if (fs.existsSync(path.join(src, 'mods'))) {
          fs.cpSync(path.join(src, 'mods'), path.join(profileService.getModsFolder(profile.id)), { recursive: true });
          break;
        }
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return { success: true, profile };
    }

    // .mrpack
    const indexPath = path.join(tmpDir, 'modrinth.index.json');
    if (!fs.existsSync(indexPath)) throw new Error('Not a valid .mrpack (modrinth.index.json missing)');
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    const deps = index.dependencies || {};
    const mcVersion = deps.minecraft || '1.20.1';
    let loaderType = 'vanilla';
    if (deps['fabric-loader']) loaderType = 'fabric';
    if (deps['quilt-loader']) loaderType = 'quilt';
    if (deps.forge) loaderType = 'forge';
    if (deps.neoforge) loaderType = 'neoforge';
    const profile = profileService.saveProfile({
      name: index.name || 'Imported Modpack',
      mcVersion,
      loaderType,
      loaderVersion: '',
      ram: 4,
      created: Date.now(),
    });
    const modsDir = profileService.getModsFolder(profile.id);
    let downloaded = 0;
    for (const file of index.files || []) {
      const safePath = path.normalize(file.path || '').replace(/^(\.\.(\/|\\|$))+/, '').replace(/^[/\\]+/, '');
      if (!safePath || safePath.includes('..')) continue;
      const url = (file.downloads || [])[0];
      if (!url) continue;
      const dest = path.join(modsDir, path.basename(safePath));
      try { await modrinthService.downloadFile(url, dest); downloaded++; } catch {}
    }
    const overrides = path.join(tmpDir, 'overrides');
    if (fs.existsSync(overrides)) {
      try { fs.cpSync(overrides, path.join(baseDataDir, 'game'), { recursive: true }); } catch {}
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return { success: true, profile, downloaded };
  } catch (err) { return { success: false, error: err.message }; }
});

// === Background update download ===
ipcMain.handle('download-update-bg', async (e, downloadUrl) => {
  try {
    if (!downloadUrl) return { success: false, error: 'No URL' };
    const update = await updateService.checkForUpdates().catch(() => null);
    const dest = path.join(baseDataDir, 'update_setup.exe');
    if (downloadUrl.match(/^[A-Z]:\\/i) || downloadUrl.startsWith('file://') || downloadUrl.startsWith('\\\\')) {
      const local = downloadUrl.replace(/^file:\/\//i, '');
      if (!fs.existsSync(local)) return { success: false, error: 'Installer not found' };
      const target = update?.version || '';
      if (target && !path.basename(local).toLowerCase().includes(String(target).toLowerCase())) {
        return { success: false, error: `Wrong installer for ${target}` };
      }
    }
    if (fs.existsSync(dest)) { try { fs.unlinkSync(dest); } catch {} }
    await updateService.downloadUpdate(downloadUrl, dest, (pct) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-progress', { percent: pct, status: `Downloading update... ${pct}%`, background: true });
    });
    bgUpdatePath = dest;
    fs.writeFileSync(path.join(baseDataDir, '.updated'), '1');
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-progress', { percent: 100, status: 'Update ready', background: true, ready: true });
    return { success: true, path: dest, ready: true };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('install-bg-update', async () => {
  try {
    const dest = bgUpdatePath || path.join(baseDataDir, 'update_setup.exe');
    if (!fs.existsSync(dest)) return { success: false, error: 'Update not downloaded' };
    const update = await updateService.checkForUpdates().catch(() => null);
    const target = update?.version || '';
    if (target && !path.basename(dest).toLowerCase().includes(String(target).toLowerCase()) && !path.basename(dest).toLowerCase().includes('update_setup')) {
      return { success: false, error: `Wrong installer for ${target}` };
    }
    // Prefer validating against the source we downloaded from
    spawn(dest, ['/S', '/currentuser', '/R'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    setTimeout(() => { app.quit(); }, 1500);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

// === Taskbar progress ===
ipcMain.handle('taskbar-progress', (e, pct) => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (pct === null || pct < 0) mainWindow.setProgressBar(-1);
      else mainWindow.setProgressBar(Math.min(1, Math.max(0, pct / 100)));
    }
  } catch {}
  return true;
});

// === crystall:// deep link ===
function handleDeepLink(url) {
  try {
    if (!url || !url.startsWith('crystall://')) return;
    const rest = url.replace(/^crystall:\/\//i, '');
    const [cmd, ...args] = rest.split('/');
    if (cmd === 'join') {
      const target = args.filter(Boolean).join('/');
      if (!target) return;
      const [host, portStr] = target.split(':');
      const server = { host, port: parseInt(portStr, 10) || 25565 };
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('deep-link', { type: 'join', server });
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    }
  } catch (err) { console.warn('Deep link error:', err.message); }
}

// === Tray ===
let tray = null;
function createTray() {
  try {
    const iconPath = path.join(__dirname, 'icon.ico');
    if (!fs.existsSync(iconPath)) return;
    tray = new Tray(nativeImage.createFromPath(iconPath));
    tray.setToolTip('Crystal Launcher');
    const menu = Menu.buildFromTemplate([
      { label: 'Show Crystal Launcher', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]);
    tray.setContextMenu(menu);
    tray.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) { mainWindow.hide(); } else { mainWindow.show(); mainWindow.focus(); }
    });
  } catch (err) { console.warn('Tray error:', err.message); }
}

