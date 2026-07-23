const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  shell: { openExternal: (url) => ipcRenderer.invoke('open-external', url) },
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  expandWindow: () => ipcRenderer.send('window-expand'),

  checkJava: () => ipcRenderer.invoke('check-java'),
  installJava: () => ipcRenderer.invoke('install-java'),
  onJavaInstallProgress: (cb) => ipcRenderer.on('java-install-progress', (e, d) => cb(d)),

  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),

  openGameFolder: () => ipcRenderer.invoke('open-game-folder'),
  openVersionsFolder: () => ipcRenderer.invoke('open-versions-folder'),
  openBackupsFolder: () => ipcRenderer.invoke('open-backups-folder'),

  getVersions: () => ipcRenderer.invoke('get-versions'),

  loginMicrosoft: () => ipcRenderer.invoke('login-microsoft'),
  createOfflineAccount: (u) => ipcRenderer.invoke('create-offline-account', u),
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  saveAccount: (a) => ipcRenderer.invoke('save-account', a),
  removeAccount: (id) => ipcRenderer.invoke('remove-account', id),

  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  saveProfile: (p) => ipcRenderer.invoke('save-profile', p),
  deleteProfile: (id, b) => ipcRenderer.invoke('delete-profile', { profileId: id, backupMods: b }),
  getMods: (id) => ipcRenderer.invoke('get-mods', id),
  toggleMod: (id, f, e) => ipcRenderer.invoke('toggle-mod', { profileId: id, fileName: f, enabled: e }),
  openModsFolder: (id) => ipcRenderer.invoke('open-mods-folder', id),

  launchGame: (pid, aid) => ipcRenderer.invoke('launch-game', { profileId: pid, accountId: aid }),

  modrinthSearch: (q, facets, offset) => ipcRenderer.invoke('modrinth-search', { query: q, facets, offset }),
  modrinthProject: (slug) => ipcRenderer.invoke('modrinth-project', slug),
  modrinthVersions: (pid, loaders, gv) => ipcRenderer.invoke('modrinth-versions', { projectId: pid, loaders, gameVersions: gv }),
  modrinthDownload: (url, profileId, fileName) => ipcRenderer.invoke('modrinth-download', { url, profileId, fileName }),
  modrinthInstallModpack: (projectId, versionId, profileId) => ipcRenderer.invoke('modrinth-install-modpack', { projectId, versionId, profileId }),

  getCrashLogs: () => ipcRenderer.invoke('get-crash-logs'),

  getNews: () => ipcRenderer.invoke('get-news'),

  toggleRpc: (enabled) => ipcRenderer.invoke('toggle-rpc', enabled),

  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  downloadUpdate: (url) => ipcRenderer.invoke('download-update', url),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (e, d) => cb(d)),
  onUpdateProgress: (cb) => ipcRenderer.on('update-progress', (e, d) => cb(d)),

  getPlaytime: () => ipcRenderer.invoke('get-playtime'),

  getServers: () => ipcRenderer.invoke('get-servers'),
  saveServer: (s) => ipcRenderer.invoke('save-server', s),
  deleteServer: (id) => ipcRenderer.invoke('delete-server', id),

  openSavesFolder: () => ipcRenderer.invoke('open-saves-folder'),
  listWorlds: () => ipcRenderer.invoke('list-worlds'),
  deleteWorld: (id) => ipcRenderer.invoke('delete-world', id),

  getResourcepacksFolder: () => ipcRenderer.invoke('get-resourcepacks-folder'),
  getShaderpacksFolder: () => ipcRenderer.invoke('get-shaderpacks-folder'),
  downloadToFolder: (url, fileName, folderPath) => ipcRenderer.invoke('download-to-folder', { url, fileName, folderPath }),

  curseforgeSearch: (query, classId, offset) => ipcRenderer.invoke('curseforge-search', { query, classId, offset }),
  curseforgeVersions: (slug) => ipcRenderer.invoke('curseforge-versions', slug),
  curseforgeDownload: (fileId, fileName, profileId) => ipcRenderer.invoke('curseforge-download', { fileId, fileName, profileId }),

  getTranslations: (lang) => ipcRenderer.invoke('get-translations', lang),
  getLanguages: () => ipcRenderer.invoke('get-languages'),

  onAuthStatus: (cb) => ipcRenderer.on('auth-status', (e, d) => cb(d)),
  onLaunchProgress: (cb) => ipcRenderer.on('launch-progress', (e, d) => cb(d)),
  onLaunchStatus: (cb) => ipcRenderer.on('launch-status', (e, d) => cb(d)),
  onLaunchLog: (cb) => ipcRenderer.on('launch-log', (e, d) => cb(d)),
});
