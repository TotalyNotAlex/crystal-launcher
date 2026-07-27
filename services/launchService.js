const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { app } = require('electron');
const { Client, Authenticator } = require('minecraft-launcher-core');
const profileService = require('./profileService');
const versionService = require('./versionService');
const authService = require('./authService');

class LaunchService {
  constructor() {
    this.gameDir = path.join(app ? app.getPath('userData') : process.cwd(), '.crystall', 'game');
  }

  findJava() {
    const { execSync } = require('child_process');

    const JavaService = require('./javaService');
    const javaSvc = new JavaService(app.getPath('userData'));
    const installed = javaSvc.getInstalledPath();
    if (installed) return installed;

    const localJava = path.join(app.getPath('userData'), '.crystall', 'java');
    if (fs.existsSync(localJava)) {
      try {
        for (const entry of fs.readdirSync(localJava)) {
          const exe = path.join(localJava, entry, 'bin', 'java.exe');
          if (fs.existsSync(exe)) return exe;
        }
      } catch {}
    }

    try {
      const out = execSync('java -version 2>&1', { timeout: 5000 }).toString();
      if (out) return 'java';
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

    for (const c of candidates) {
      try {
        if (fs.existsSync(c)) return c;
      } catch {}
    }
    return null;
  }

  async getLatestFabricLoader() {
    try {
      const res = await axios.get('https://meta.fabricmc.net/v2/versions/loader', { timeout: 5000 });
      const stable = res.data.find((v) => v.stable);
      return stable ? stable.version : '0.15.7';
    } catch { return '0.15.7'; }
  }

  async getLatestFabricLoaderForMc(mcVersion) {
    try {
      const res = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`, { timeout: 5000 });
      const stable = res.data.find((v) => v.loader.stable);
      return stable ? stable.loader.version : await this.getLatestFabricLoader();
    } catch { return await this.getLatestFabricLoader(); }
  }

  async ensureFabricVersionManifest(mcVersion, loaderVersion) {
    if (!loaderVersion) loaderVersion = await this.getLatestFabricLoaderForMc(mcVersion);
    const customVersionName = `fabric-loader-${loaderVersion}-${mcVersion}`;
    const versionDir = path.join(this.gameDir, 'versions', customVersionName);
    const versionJsonPath = path.join(versionDir, `${customVersionName}.json`);

    if (!fs.existsSync(versionJsonPath)) {
      fs.mkdirSync(versionDir, { recursive: true });
      const res = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`);
      fs.writeFileSync(versionJsonPath, JSON.stringify(res.data, null, 2));
    }
    return { name: customVersionName, json: versionJsonPath };
  }

  async ensureForgeVersion(mcVersion) {
    try {
      const forgeData = await versionService.getForgeVersions();
      const promoInfo = forgeData.forgeMap[mcVersion];
      let buildNumber = promoInfo ? (promoInfo.recommended || promoInfo.latest) : null;

      if (!buildNumber) {
        const defaults = {
          '1.20.4': '49.0.19', '1.20.1': '47.2.0', '1.19.4': '45.1.0',
          '1.18.2': '40.2.0', '1.16.5': '36.2.39', '1.12.2': '14.23.5.2860',
        };
        buildNumber = defaults[mcVersion] || '47.2.0';
      }

      const versionName = `forge-${mcVersion}-${buildNumber}`;
      const versionDir = path.join(this.gameDir, 'versions', versionName);
      const versionJsonPath = path.join(versionDir, `${versionName}.json`);

      if (!fs.existsSync(versionJsonPath)) {
        fs.mkdirSync(versionDir, { recursive: true });
        try {
          const infoUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcVersion}-${buildNumber}/forge-${mcVersion}-${buildNumber}-universal.jar`;
          const res = await axios.head(infoUrl, { timeout: 5000 });
        } catch {}

        const jsonUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcVersion}-${buildNumber}/forge-${mcVersion}-${buildNumber}.json`;
        try {
          const res = await axios.get(jsonUrl, { timeout: 10000 });
          fs.writeFileSync(versionJsonPath, JSON.stringify(res.data, null, 2));
          return { name: versionName, json: versionJsonPath };
        } catch {
          const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcVersion}-${buildNumber}/forge-${mcVersion}-${buildNumber}-installer.jar`;
          const installerPath = path.join(this.gameDir, `${versionName}-installer.jar`);
          if (!fs.existsSync(installerPath)) {
            const res = await axios.get(installerUrl, { responseType: 'arraybuffer', timeout: 30000 });
            fs.writeFileSync(installerPath, res.data);
          }
          return { name: versionName, json: null, installer: installerPath };
        }
      }
      return { name: versionName, json: versionJsonPath };
    } catch (err) {
      console.warn('Forge setup warning:', err.message);
      return null;
    }
  }

  installOverlayMod(mcVersion) {
    const modsDir = path.join(this.gameDir, 'mods');
    if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });
    const overlayJar = typeof process !== 'undefined' && process.resourcesPath
      ? path.join(process.resourcesPath, 'crystallauncher-overlay.jar')
      : path.join(__dirname, '..', 'resources', 'crystallauncher-overlay.jar');
    if (!fs.existsSync(overlayJar)) {
      console.warn('Overlay mod JAR not found at', overlayJar);
      return;
    }
    const target = path.join(modsDir, 'crystallauncher-overlay.jar');
    try { fs.copyFileSync(overlayJar, target); console.log('Overlay mod installed to', target); } catch (err) { console.warn('Failed to install overlay mod:', err.message); }
  }

  async launchGame(profile, account, onProgress, onStatus, onLog, onRunning, onExit) {
    return new Promise(async (resolve, reject) => {
      try {
        const javaPath = this.findJava();
        if (!javaPath) {
          reject(new Error('Java not found. Please install Java 17 or later from https://adoptium.net'));
          return;
        }

        const launcher = new Client();
        const ram = profile.ram || 4;
        const loaderType = profile.loaderType || 'vanilla';
        const mcVersion = profile.mcVersion || '1.20.4';

        if (account?.type === 'microsoft' && account.refreshToken) {
          if (onStatus) onStatus('Refreshing session...');
          try {
            const refreshed = await authService.refreshMicrosoftToken(account.refreshToken);
            if (refreshed) account = refreshed;
          } catch (e) { console.warn('Refresh skipped:', e.message); }
        }

        let auth;
        if (account?.type === 'microsoft' && account.accessToken) {
          auth = {
            access_token: account.accessToken,
            client_token: account.clientToken || account.id || 'crystal-client-token',
            uuid: account.id,
            name: account.name,
            user_properties: '{}',
            meta: { type: 'msa', demo: false, xuid: account.xuid || account.id, clientId: account.id },
          };
        } else {
          auth = Authenticator.getAuth(account ? account.name : 'Player');
        }

        const profileModsDir = profileService.getModsFolder(profile.id);
        const gameModsDir = path.join(this.gameDir, 'mods');
        try {
          if (!fs.existsSync(gameModsDir)) fs.mkdirSync(gameModsDir, { recursive: true });
          for (const file of fs.readdirSync(gameModsDir)) fs.unlinkSync(path.join(gameModsDir, file));
          for (const mod of profileService.listMods(profile.id)) {
            if (mod.enabled) {
              fs.copyFileSync(path.join(profileModsDir, mod.fileName), path.join(gameModsDir, mod.name));
            }
          }
        } catch (err) { console.warn('Mod sync warning:', err.message); }

        const opts = {
          authorization: auth,
          javaPath: javaPath,
          root: this.gameDir,
          version: { number: mcVersion, type: 'release' },
          memory: { max: `${ram}G`, min: '1G' },
          customArgs: [
            '-Djava.net.preferIPv4Stack=true',
            '-Djava.net.preferIPv4Addresses=true',
          ],
        };

        if (loaderType === 'fabric') {
          if (onStatus) onStatus(`Fetching Fabric for ${mcVersion}...`);
          const fabric = await this.ensureFabricVersionManifest(mcVersion, profile.loaderVersion);
          opts.version.custom = fabric.name;
          this.installOverlayMod(mcVersion);
        } else if (loaderType === 'forge') {
          if (onStatus) onStatus(`Preparing Forge for ${mcVersion}...`);
          const forge = await this.ensureForgeVersion(mcVersion);
          if (forge) {
            if (forge.json) opts.version.custom = forge.name;
            if (forge.installer) opts.forge = forge.installer;
          }
        }

        if (onStatus) onStatus(`Starting Minecraft ${mcVersion}...`);

        let hasResolved = false;
        const resolveStarted = () => {
          if (!hasResolved) {
            hasResolved = true;
            if (onStatus) onStatus('Minecraft is running!');
            resolve({ status: 'started' });
          }
        };

        launcher.on('progress', (e) => {
          if (onProgress) onProgress({ type: e.type, task: e.task, total: e.total, percent: Math.round((e.task / e.total) * 100) || 0 });
        });

        launcher.on('download-status', (e) => {
          if (onStatus) onStatus(`Downloading ${e.type}: ${Math.round((e.current / e.total) * 100) || 0}%`);
        });

        launcher.on('spawn', () => {
          setTimeout(resolveStarted, 1000);
          setTimeout(() => { if (onRunning) onRunning(); }, 30000);
        });

        launcher.on('data', (e) => {
          const text = e.toString();
          if (onLog) onLog(text);
          if (text.includes('Setting user:') || text.includes('LWJGL Version:') || text.includes('Backend library:')) {
            resolveStarted();
            if (onRunning) onRunning();
          }
        });

        launcher.on('close', (code) => {
          if (onStatus) onStatus(`Minecraft exited (${code})`);
          if (onExit) onExit(code);
          if (!hasResolved && code !== 0) { hasResolved = true; reject(new Error(`Minecraft exited with code ${code}. Check game log for details.`)); }
        });

        launcher.on('error', (err) => { if (onLog) onLog(`[ERROR] ${err.message}`); if (!hasResolved) { hasResolved = true; reject(err); } });

        launcher.launch(opts).catch((err) => { if (!hasResolved) { hasResolved = true; reject(err); } });

      } catch (err) {
        console.error('Launch Error:', err);
        reject(err);
      }
    });
  }
}

module.exports = new LaunchService();
