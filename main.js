const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

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

let mainWindow = null;
const isUpdateRestart = process.argv.includes('--updated');
const baseDataDir = path.join(app.getPath('userData'), '.crystall');
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
      activeAccountId: null, activeProfileId: null, lastLoader: 'vanilla', lastVersion: '1.20.4', defaultRam: 4, jvmArgs: '', keepLauncherOpen: true, language: 'en', discordRpc: true,
    }, null, 2));
  }
}

function getSavedSettings() {
  ensureDataDir();
  try { return { activeAccountId: null, activeProfileId: null, lastLoader: 'vanilla', lastVersion: '1.20.4', defaultRam: 4, jvmArgs: '', keepLauncherOpen: true, language: 'en', discordRpc: true, ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')) }; }
  catch { return { activeAccountId: null, activeProfileId: null, lastLoader: 'vanilla', lastVersion: '1.20.4', defaultRam: 4, jvmArgs: '', keepLauncherOpen: true, language: 'en', discordRpc: true }; }
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
  const localPath = javaService.getInstalledPath();
  if (localPath) {
    try {
      const out = execSync(`"${localPath}" -version 2>&1`, { timeout: 5000 }).toString();
      const match = out.match(/(\d+)\.(\d+)/);
      return { found: true, version: match ? `${match[1]}.${match[2]}` : 'unknown', full: out.split('\n')[0], path: localPath };
    } catch {}
  }

  try {
    const out = execSync('java -version 2>&1', { timeout: 5000 }).toString();
    const match = out.match(/(\d+)\.(\d+)/);
    if (match) return { found: true, version: `${match[1]}.${match[2]}`, full: out.split('\n')[0] };
    return { found: true, version: 'unknown', full: out.split('\n')[0] };
  } catch {}

  const candidates = [];
  const javaHome = process.env.JAVA_HOME;
  if (javaHome) {
    const p = path.join(javaHome, 'bin', 'java.exe');
    if (fs.existsSync(p)) candidates.push(p);
  }

  const searchDirs = [
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Amazon Corretto',
    'C:\\Program Files\\Zulu',
    'C:\\Program Files\\LibericaJDK',
    'C:\\Program Files (x86)\\Java',
    'C:\\Program Files (x86)\\Eclipse Adoptium',
  ];

  for (const dir of searchDirs) {
    try {
      if (!fs.existsSync(dir)) continue;
      for (const entry of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, entry, 'bin', 'java.exe');
        if (fs.existsSync(fullPath)) candidates.push(fullPath);
      }
    } catch {}
  }

  for (const p of candidates) {
    try {
      const out = execSync(`"${p}" -version 2>&1`, { timeout: 3000 }).toString();
      const match = out.match(/(\d+)\.(\d+)/);
      return { found: true, version: match ? `${match[1]}.${match[2]}` : 'unknown', full: out.split('\n')[0], path: p };
    } catch {}
  }

  return { found: false, version: null, full: null, path: null };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 660,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    thickFrame: false,
    resizable: true,
    center: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  const updatedFile = path.join(baseDataDir, '.updated');
  if (fs.existsSync(updatedFile)) {
    try { fs.unlinkSync(updatedFile); } catch {}
  }

  async function checkUpdate() {
    try {
      if (fs.existsSync(updatedFile)) return;
      const update = await updateService.checkForUpdates();
      if (update.hasUpdate && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', update);
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

ipcMain.handle('launch-game', async (e, { profileId, accountId }) => {
  try {
    const settings = getSavedSettings();
    const profiles = profileService.getProfiles();
    const profile = profiles.find((p) => p.id === profileId) || profiles[0];
    if (!profile) return { success: false, error: 'No profile found. Create a profile first.' };
    const accounts = getSavedAccounts();
    const account = accounts.find((a) => a.id === accountId) || accounts[0];
    if (!account) return { success: false, error: 'No account selected. Add an account first.' };
    if (settings.defaultRam && (!profile.ram || profile.ram === 4)) profile.ram = settings.defaultRam;
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
      }
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
ipcMain.handle('get-app-version', async () => { try { return require(path.join(__dirname, 'package.json')).version; } catch { return '1.0.3'; } });

ipcMain.handle('get-crash-logs', async () => {
  const crashDir = path.join(baseDataDir, 'game', 'crash-reports');
  if (!fs.existsSync(crashDir)) return [];
  const logs = [];
  for (const entry of fs.readdirSync(crashDir).sort().reverse().slice(0, 20)) {
    const filePath = path.join(crashDir, entry);
    try {
      const content = fs.readFileSync(filePath, 'utf8').substring(0, 2000);
      const time = fs.statSync(filePath).mtimeMs;
      logs.push({ name: entry, time, content });
    } catch {}
  }
  return logs;
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

ipcMain.handle('get-servers', async () => {
  if (!fs.existsSync(serversFile)) return [];
  try { return JSON.parse(fs.readFileSync(serversFile, 'utf8')); }
  catch { return []; }
});

ipcMain.handle('save-server', async (e, server) => {
  const servers = await ipcMain.emit('get-servers') || [];
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
    const dest = path.join(baseDataDir, 'update_setup.exe');
    e.sender.send('update-progress', { percent: 0, status: 'Downloading update...' });
    await updateService.downloadUpdate(downloadUrl, dest, (pct) => {
      e.sender.send('update-progress', { percent: pct, status: `Downloading... ${pct}%` });
    });
    e.sender.send('update-progress', { percent: 100, status: 'Download complete' });
    const { spawn } = require('child_process');
    fs.writeFileSync(path.join(baseDataDir, '.updated'), '1');
    spawn(dest, ['/S', '/currentuser', '/R'], { detached: true, stdio: 'ignore' }).unref();
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
    execSync(`powershell -NoProfile -Command "${psCmd.replace(/"/g, '\\"')}"`, { timeout: 30000 });
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
