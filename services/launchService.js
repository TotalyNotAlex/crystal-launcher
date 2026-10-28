const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const axios = require('axios');
const { app } = require('electron');
const { Client, Authenticator } = require('minecraft-launcher-core');
const profileService = require('./profileService');
const versionService = require('./versionService');
const authService = require('./authService');
const JavaService = require('./javaService');

// Hide the console window when Java/Minecraft starts (no terminal flash on Play).
const originalStartMinecraft = Client.prototype.startMinecraft;
Client.prototype.startMinecraft = function (launchArguments) {
  const child = require('child_process');
  const minecraft = child.spawn(this.options.javaPath || 'java', launchArguments, {
    cwd: this.options.overrides.cwd || this.options.root,
    detached: this.options.overrides.detached,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  minecraft.stdout.on('data', (data) => this.emit('data', data.toString('utf-8')));
  minecraft.stderr.on('data', (data) => this.emit('data', data.toString('utf-8')));
  minecraft.on('close', (code) => this.emit('close', code));
  return minecraft;
};

// Hide console when MCLC probes `java -version`.
try {
  const Handler = require('minecraft-launcher-core/components/handler');
  Handler.prototype.checkJava = function (java) {
    return new Promise((resolve) => {
      require('child_process').exec(`"${java}" -version`, { windowsHide: true, timeout: 15000 }, (error, stdout, stderr) => {
        if (error) {
          resolve({ run: false, message: error });
        } else {
          const m = (stderr || '').match(/"(.*?)"/);
          this.client.emit('debug', `[MCLC]: Using Java version ${m ? m.pop() : 'unknown'}`);
          resolve({ run: true });
        }
      });
    });
  };
} catch {}

class LaunchService {
  constructor() {
    this.gameDir = path.join(app ? app.getPath('userData') : process.cwd(), '.crystall', 'game');
    this.dataDir = path.join(app ? app.getPath('userData') : process.cwd(), '.crystall');
  }

  readSettings() {
    try {
      const p = path.join(this.dataDir, 'settings.json');
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {}
    return {};
  }

  async ensureJava(onStatus, onProgress) {
    const javaSvc = new JavaService(this.dataDir);
    const settings = this.readSettings();

    if (onStatus) onStatus('Checking Java 21+ runtime...');
    try {
      const info = await javaSvc.ensureJava({
        settingsPath: settings.javaPath,
        minMajor: 21,
        onProgress: (p) => {
          if (onStatus) onStatus(p.status || 'Installing Java...');
          if (onProgress && typeof p.percent === 'number') {
            onProgress({ percent: p.percent, status: p.status });
          }
        },
      });
      if (onStatus) onStatus(`Using Java ${info.major} (${info.path})`);
      return info.path;
    } catch (err) {
      throw new Error(
        `Java 21+ is required but could not be installed: ${err.message}. ` +
        'Download Temurin 21 manually from https://adoptium.net or use Retry in Settings > Java Runtime.'
      );
    }
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

  async getLatestQuiltLoaderForMc(mcVersion) {
    try {
      // Quilt retired the v2 meta endpoints; v3 answers with
      // [{ loader: { version }, ... }] per Minecraft version.
      const res = await axios.get(`https://meta.quiltmc.org/v3/versions/loader/${mcVersion}`, { timeout: 8000 });
      const list = Array.isArray(res.data) ? res.data : [];
      const versions = list
        .map((entry) => (entry && typeof entry === 'object'
          ? (entry.loader && entry.loader.version) || entry.version
          : entry))
        .filter((v) => typeof v === 'string' && v);
      // Prefer a release build; fall back to whatever is newest.
      const stable = versions.find((v) => !/beta|alpha|pre|rc/i.test(v));
      return stable || versions[0] || null;
    } catch (err) {
      console.warn('Quilt loader lookup failed:', err.message);
      return null;
    }
  }

  async ensureQuiltVersion(mcVersion, loaderVersion, allowLoaderRetry = true) {
    if (!loaderVersion) loaderVersion = await this.getLatestQuiltLoaderForMc(mcVersion);
    if (!loaderVersion) {
      console.warn(`No Quilt loader available for Minecraft ${mcVersion}.`);
      return null;
    }
    const customVersionName = `quilt-loader-${loaderVersion}-${mcVersion}`;
    const versionDir = path.join(this.gameDir, 'versions', customVersionName);
    const versionJsonPath = path.join(versionDir, `${customVersionName}.json`);

    if (!fs.existsSync(versionJsonPath)) {
      fs.mkdirSync(versionDir, { recursive: true });
      try {
        const res = await axios.get(
          `https://meta.quiltmc.org/v3/versions/loader/${mcVersion}/${loaderVersion}/profile/json`,
          { timeout: 15000 }
        );
        fs.writeFileSync(versionJsonPath, JSON.stringify(res.data, null, 2));
        return { name: customVersionName, json: versionJsonPath };
      } catch (err) {
        console.warn('Quilt profile fetch warning:', err.message);
        try { fs.rmSync(versionDir, { recursive: true, force: true }); } catch {}
        // A loader version pinned in an old profile may no longer exist for
        // this Minecraft version - retry once with the newest one.
        if (allowLoaderRetry) {
          const fallback = await this.getLatestQuiltLoaderForMc(mcVersion);
          if (fallback && fallback !== loaderVersion) {
            return this.ensureQuiltVersion(mcVersion, fallback, false);
          }
        }
        return null;
      }
    }
    return { name: customVersionName, json: versionJsonPath };
  }

  getGameRoot(profile) {
    if (profile && profile.isolate) {
      const isolated = path.join(this.dataDir, 'instances', profile.id, 'game');
      if (!fs.existsSync(isolated)) fs.mkdirSync(isolated, { recursive: true });
      return isolated;
    }
    return this.gameDir;
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

  installOverlayMod(mcVersion, gameRoot) {
    const root = gameRoot || this.gameDir;
    const modsDir = path.join(root, 'mods');
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

    // ForgeWrapper (used by minecraft-launcher-core) cannot resolve classifier
  // artifacts such as "binarypatcher:2.1.2:fatjar" and then looks for
  // "binarypatcher-2.1.2-fatjar.jar.jar". Running the official installer once
  // avoids that path entirely and produces a normal version JSON.
  async installNeoForgeWithInstaller(mcVersion, buildNumber, javaPath, onStatus) {
    // The official installer names the version after the build only
    // ("neoforge-21.1.265"); the launcher's own naming is the fallback.
    const candidates = [
      `neoforge-${buildNumber}`,
      `neoforge-${mcVersion}-${buildNumber}`,
    ];
    const jsonFor = (name) => path.join(this.gameDir, 'versions', name, `${name}.json`);
    const existing = candidates.find((name) => fs.existsSync(jsonFor(name)));
    if (existing) return { name: existing, json: jsonFor(existing) };

    const versionName = candidates[0];
    const installerPath = path.join(this.gameDir, `neoforge-${mcVersion}-${buildNumber}-installer.jar`);
    if (!fs.existsSync(installerPath)) {
      const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${buildNumber}/neoforge-${buildNumber}-installer.jar`;
      const res = await axios.get(installerUrl, { responseType: 'arraybuffer', timeout: 120000 });
      fs.writeFileSync(installerPath, res.data);
    }

    // The installer refuses to run without a launcher profile in the target.
    const profilesFile = path.join(this.gameDir, 'launcher_profiles.json');
    if (!fs.existsSync(profilesFile)) {
      fs.writeFileSync(profilesFile, JSON.stringify({
        profiles: {},
        selectedProfile: '',
        clientToken: '',
        authenticationDatabase: {},
        launcherVersion: { name: '21', format: 21 },
      }, null, 2));
    }

    if (onStatus) onStatus(`Installing NeoForge ${buildNumber}...`);
    await new Promise((resolve, reject) => {
      const proc = spawn(javaPath, ['-jar', installerPath, '--installClient', this.gameDir], {
        windowsHide: true,
        cwd: this.gameDir,
      });
      let output = '';
      const timer = setTimeout(() => {
        try { proc.kill(); } catch {}
        reject(new Error('NeoForge installer timed out after 10 minutes'));
      }, 10 * 60 * 1000);
      proc.stdout.on('data', (d) => { output += d.toString(); });
      proc.stderr.on('data', (d) => { output += d.toString(); });
      proc.on('error', (err) => { clearTimeout(timer); reject(err); });
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(output);
        else {
          const tail = output.trim().split(/\r?\n/).slice(-6).join(' | ');
          reject(new Error(`NeoForge installer failed (exit ${code})${tail ? `: ${tail}` : ''}`));
        }
      });
    });

    const installed = candidates.find((name) => fs.existsSync(jsonFor(name)));
    if (!installed) {
      throw new Error(`NeoForge installer finished but no version JSON was created (looked for ${candidates.join(', ')})`);
    }
    return { name: installed, json: jsonFor(installed) };
  }

  async ensureNeoForgeVersion(mcVersion, javaPath, onStatus) {
    try {
      const neoforgeData = await versionService.getNeoForgeVersions();
      const buildNumber = neoforgeData.neoforgeMap[mcVersion];
      if (!buildNumber) return null;

      // Preferred path: install with the official installer so the resulting
      // version JSON can be launched directly.
      if (javaPath) {
        try {
          return await this.installNeoForgeWithInstaller(mcVersion, buildNumber, javaPath, onStatus);
        } catch (installErr) {
          console.warn('NeoForge installer failed, falling back to ForgeWrapper:', installErr.message);
        }
      }

      // Fallback: let minecraft-launcher-core run the installer through
      // ForgeWrapper (works for builds without classifier artifacts).
      const installerPath = path.join(this.gameDir, `${versionName}-installer.jar`);
      if (!fs.existsSync(installerPath)) {
        const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${buildNumber}/neoforge-${buildNumber}-installer.jar`;
        const res = await axios.get(installerUrl, { responseType: 'arraybuffer', timeout: 60000 });
        fs.writeFileSync(installerPath, res.data);
      }
      return { name: versionName, json: null, installer: installerPath };
    } catch (err) {
      console.warn('NeoForge setup warning:', err.message);
      return null;
    }
  }

  async launchGame(profile, account, onProgress, onStatus, onLog, onRunning, onExit, server) {
    return new Promise(async (resolve, reject) => {
      try {
        let javaPath;
        try {
          javaPath = await this.ensureJava(onStatus, onProgress);
        } catch (err) {
          reject(err);
          return;
        }
        if (!javaPath) {
          reject(new Error('Java not found. Please install Java 21 or later from https://adoptium.net'));
          return;
        }

        const launcher = new Client();
        const ram = profile.ram || 4;
        const loaderType = profile.loaderType || 'vanilla';
        const mcVersion = profile.mcVersion || '1.20.4';
        const gameRoot = this.getGameRoot(profile);

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
        const gameModsDir = path.join(gameRoot, 'mods');
        try {
          if (!fs.existsSync(gameModsDir)) fs.mkdirSync(gameModsDir, { recursive: true });
          for (const file of fs.readdirSync(gameModsDir)) fs.unlinkSync(path.join(gameModsDir, file));
          for (const mod of profileService.listMods(profile.id)) {
            if (mod.enabled) {
              fs.copyFileSync(path.join(profileModsDir, mod.fileName), path.join(gameModsDir, mod.name));
            }
          }
        } catch (err) { console.warn('Mod sync warning:', err.message); }

        let extraJvmArgs = [];
        try {
          const settingsPath = path.join(this.dataDir, 'settings.json');
          const settings = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {};
          if (settings.jvmArgs) {
            extraJvmArgs = String(settings.jvmArgs).match(/(?:[^\s"]+|"[^"]*")+/g)?.map((a) => a.replace(/^"|"$/g, '')) || [];
          }
        } catch {}

        const opts = {
          authorization: auth,
          javaPath: javaPath,
          root: gameRoot,
          version: { number: mcVersion, type: 'release' },
          memory: { max: `${ram}G`, min: '1G' },
          customArgs: [
            '-Djava.net.preferIPv4Stack=true',
            '-Djava.net.preferIPv4Addresses=true',
            ...extraJvmArgs,
          ],
        };

        if (server && server.host) {
          const identifier = server.port && Number(server.port) !== 25565
            ? `${server.host}:${server.port}`
            : server.host;
          opts.quickPlay = { type: 'multiplayer', identifier };
        }

        if (loaderType === 'fabric') {
          if (onStatus) onStatus(`Fetching Fabric for ${mcVersion}...`);
          const fabric = await this.ensureFabricVersionManifest(mcVersion, profile.loaderVersion);
          opts.version.custom = fabric.name;
          this.installOverlayMod(mcVersion, gameRoot);
        } else if (loaderType === 'quilt') {
          if (onStatus) onStatus(`Fetching Quilt for ${mcVersion}...`);
          const quilt = await this.ensureQuiltVersion(mcVersion, profile.loaderVersion);
          if (quilt) {
            opts.version.custom = quilt.name;
            this.installOverlayMod(mcVersion, gameRoot);
          }
        } else if (loaderType === 'forge') {
          if (onStatus) onStatus(`Preparing Forge for ${mcVersion}...`);
          const forge = await this.ensureForgeVersion(mcVersion);
          if (forge) {
            if (forge.json) opts.version.custom = forge.name;
            if (forge.installer) opts.forge = forge.installer;
          }
        } else if (loaderType === 'neoforge') {
          if (onStatus) onStatus(`Preparing NeoForge for ${mcVersion}...`);
          const neoforge = await this.ensureNeoForgeVersion(mcVersion, javaPath, onStatus);
          if (neoforge) {
            if (neoforge.json) opts.version.custom = neoforge.name;
            if (neoforge.installer) opts.forge = neoforge.installer;
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
