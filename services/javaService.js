const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { spawnSync } = require('child_process');

const MIN_MAJOR = 21;

function javaExeName() {
  return process.platform === 'win32' ? 'java.exe' : 'java';
}

function parseJavaVersion(output) {
  if (!output) return null;
  const quoted = output.match(/version\s+"([^"]+)"/i);
  let raw = quoted ? quoted[1] : null;
  if (!raw) {
    const bare = output.match(/(?:openjdk|java)\s+(\d+)(?:\.\d+)* /i) || output.match(/(?:openjdk|java)\s+(\d+)(?:\.\d+)*/i);
    if (bare) raw = bare[1];
  }
  if (!raw) return null;
  const parts = raw.split(/[._+-]/);
  let major = parseInt(parts[0], 10);
  if (major === 1 && parts[1]) major = parseInt(parts[1], 10);
  if (Number.isNaN(major)) return null;
  return { major, raw };
}

class JavaService {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.javaDir = path.join(baseDir, 'runtime', 'java-21');
    this.legacyDirs = [
      path.join(baseDir, 'java'),
      path.join(baseDir, '.crystall', 'java'),
      path.join(baseDir, '.crystall', 'runtime', 'java-21'),
    ];
    this.downloadPath = path.join(baseDir, 'java21-download.tmp');
  }

  inspectJava(exePath) {
    if (!exePath) return null;
    if (exePath !== 'java' && exePath !== 'javaw' && !fs.existsSync(exePath)) return null;
    let out = '';
    try {
      const res = spawnSync(exePath, ['-version'], {
        encoding: 'utf8',
        timeout: 8000,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      });
      out = `${res.stdout || ''}${res.stderr || ''}`.trim();
    } catch (err) {
      out = `${err.stdout || ''}${err.stderr || ''}`.trim();
    }
    if (!out) return null;
    const ver = parseJavaVersion(out);
    if (!ver) return null;
    const is64 = /64[- ]bit/i.test(out);
    return {
      path: exePath,
      major: ver.major,
      is64,
      version: String(ver.major),
      raw: ver.raw,
      full: out.split('\n')[0],
    };
  }

  getInstalledPath() {
    const roots = [this.javaDir, ...this.legacyDirs];
    for (const root of roots) {
      if (!root || !fs.existsSync(root)) continue;
      try {
        for (const entry of fs.readdirSync(root)) {
          const exe = path.join(root, entry, 'bin', javaExeName());
          if (fs.existsSync(exe)) return exe;
          const nested = path.join(root, entry);
          if (fs.statSync(nested).isDirectory()) {
            for (const sub of fs.readdirSync(nested)) {
              const exe2 = path.join(nested, sub, 'bin', javaExeName());
              if (fs.existsSync(exe2)) return exe2;
            }
          }
        }
        const direct = path.join(root, 'bin', javaExeName());
        if (fs.existsSync(direct)) return direct;
        const deep = this.findJavaRecursive(root);
        if (deep) return deep;
      } catch {}
    }
    return null;
  }

  getInstalledVersion() {
    const info = this.inspectJava(this.getInstalledPath());
    return info ? `${info.major}` : null;
  }

  collectSystemCandidates() {
    const candidates = [];
    const javaExe = javaExeName();

    if (process.env.JAVA_HOME) {
      candidates.push(path.join(process.env.JAVA_HOME, 'bin', javaExe));
    }

    if (process.platform === 'win32') {
      try {
        const where = spawnSync('where', ['java'], {
          encoding: 'utf8',
          timeout: 5000,
          windowsHide: true,
        });
        if (where.status === 0 && where.stdout) {
          where.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).forEach((p) => candidates.push(p));
        }
      } catch {}
      candidates.push('java');
    } else {
      candidates.push('java');
      try {
        const which = spawnSync('which', ['java'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
        if (which.status === 0 && which.stdout) candidates.push(which.stdout.trim());
      } catch {}
    }

    const searchDirs = process.platform === 'win32'
      ? [
          'C:\\Program Files\\Java',
          'C:\\Program Files\\Eclipse Adoptium',
          'C:\\Program Files\\Microsoft',
          'C:\\Program Files\\Amazon Corretto',
          'C:\\Program Files\\Zulu',
          'C:\\Program Files\\LibericaJDK',
          'C:\\Program Files\\BellSoft',
          'C:\\Program Files (x86)\\Java',
          'C:\\Program Files (x86)\\Eclipse Adoptium',
          path.join(process.env.LOCALAPPDATA || '', 'Programs'),
          path.join(process.env.USERPROFILE || '', '.jdks'),
        ]
      : [
          '/usr/lib/jvm',
          '/usr/java',
          '/Library/Java/JavaVirtualMachines',
          path.join(process.env.HOME || '', 'Library/Java/JavaVirtualMachines'),
          path.join(process.env.HOME || '', '.jdks'),
        ];

    for (const dir of searchDirs) {
      if (!dir || !fs.existsSync(dir)) continue;
      try {
        for (const entry of fs.readdirSync(dir)) {
          candidates.push(path.join(dir, entry, 'bin', javaExe));
          const nestedDirs = path.join(dir, entry);
          try {
            if (fs.statSync(nestedDirs).isDirectory()) {
              for (const sub of fs.readdirSync(nestedDirs)) {
                candidates.push(path.join(nestedDirs, sub, 'bin', javaExe));
              }
            }
          } catch {}
        }
      } catch {}
    }

    return [...new Set(candidates.filter(Boolean))];
  }

  findJava({ settingsPath, minMajor = MIN_MAJOR } = {}) {
    const order = [];
    if (settingsPath) order.push(settingsPath);
    const bundled = this.getInstalledPath();
    if (bundled) order.push(bundled);
    order.push(...this.collectSystemCandidates());

    const seen = new Set();
    for (const candidate of order) {
      const key = path.resolve(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      const info = this.inspectJava(candidate);
      if (info && info.major >= minMajor && info.is64) return info;
    }
    return null;
  }

  findAnyJava() {
    const order = [];
    const bundled = this.getInstalledPath();
    if (bundled) order.push(bundled);
    order.push(...this.collectSystemCandidates());
    for (const candidate of order) {
      const info = this.inspectJava(candidate);
      if (info) return info;
    }
    return null;
  }

  getAdoptiumUrl(feature, imageType) {
    const osMap = { win32: 'windows', darwin: 'mac', linux: 'linux' };
    const archMap = { x64: 'x64', arm64: 'aarch64', ia32: 'x86' };
    const osName = osMap[process.platform];
    const arch = archMap[process.arch];
    if (!osName || !arch) {
      throw new Error(`Unsupported platform for auto Java install: ${process.platform}/${process.arch}`);
    }
    if (process.arch === 'ia32') {
      throw new Error('32-bit systems are not supported for Java 21. Please install a 64-bit JDK manually.');
    }
    return `https://api.adoptium.net/v3/binary/latest/${feature}/ga/${osName}/${arch}/${imageType}/hotspot/eclipse?project=jdk`;
  }

  async ensureJava({ settingsPath, onProgress, minMajor = MIN_MAJOR } = {}) {
    const existing = this.findJava({ settingsPath, minMajor });
    if (existing) return existing;

    onProgress?.({ percent: 0, status: `Java ${minMajor}+ not found. Starting download...` });
    const installedPath = await this.downloadAndInstall(onProgress, minMajor);
    const info = this.inspectJava(installedPath);
    if (!info) throw new Error('Downloaded Java could not be started (corrupt install?)');
    if (info.major < minMajor) throw new Error(`Installed Java ${info.major} is older than required Java ${minMajor}`);
    if (!info.is64) throw new Error('Downloaded Java is 32-bit; a 64-bit runtime is required');
    onProgress?.({ percent: 100, status: `Java ${info.major} ready` });
    return info;
  }

  async downloadAndInstall(onProgress, minMajor = MIN_MAJOR) {
    onProgress?.({ percent: 0, status: `Downloading Java ${minMajor} runtime...` });

    const attempts = [
      { imageType: 'jre', label: 'JRE' },
      { imageType: 'jdk', label: 'JDK' },
    ];
    let lastError = null;

    for (const attempt of attempts) {
      let url;
      try {
        url = this.getAdoptiumUrl(minMajor, attempt.imageType);
      } catch (err) {
        throw err;
      }
      try {
        onProgress?.({ percent: 0, status: `Downloading Java ${minMajor} ${attempt.label}...` });
        await this.downloadFile(url, onProgress, attempt.label);
        onProgress?.({ percent: 75, status: 'Extracting Java...' });
        this.extractArchive(this.downloadPath, this.javaDir);
        onProgress?.({ percent: 92, status: 'Verifying installation...' });
        try { fs.unlinkSync(this.downloadPath); } catch {}

        const exe = this.getInstalledPath() || this.findJavaRecursive(this.javaDir);
        if (!exe) throw new Error('Extraction succeeded but java executable was not found');
        return exe;
      } catch (err) {
        lastError = err;
        try { if (fs.existsSync(this.downloadPath)) fs.unlinkSync(this.downloadPath); } catch {}
        const status = err.response && err.response.status;
        if (status === 404 || status === 400 || status === 403) continue;
        if (attempt.imageType === 'jre') continue;
        break;
      }
    }

    const detail = lastError ? lastError.message : 'unknown error';
    throw new Error(`Java download failed: ${detail}. Check your internet connection and try again.`);
  }

  async downloadFile(url, onProgress, label) {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 300000,
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
    });

    const totalLength = parseInt(response.headers['content-length'] || '0', 10);
    let downloaded = 0;

    const dir = path.dirname(this.downloadPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const writer = fs.createWriteStream(this.downloadPath);

    response.data.on('data', (chunk) => {
      downloaded += chunk.length;
      if (totalLength > 0) {
        const pct = Math.round((downloaded / totalLength) * 70);
        onProgress?.({
          percent: pct,
          status: `Downloading Java... ${pct}%`,
        });
      }
    });

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
      response.data.on('error', reject);
      response.data.pipe(writer);
    });

    if (!fs.existsSync(this.downloadPath) || fs.statSync(this.downloadPath).size === 0) {
      throw new Error('Downloaded Java archive is empty');
    }
  }

  extractArchive(archivePath, destDir) {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    for (const entry of fs.readdirSync(destDir)) {
      try { fs.rmSync(path.join(destDir, entry), { recursive: true, force: true }); } catch {}
    }

    const tarRes = spawnSync('tar', ['-xf', archivePath, '-C', destDir], {
      encoding: 'utf8',
      timeout: 180000,
      windowsHide: true,
    });

    if (tarRes.status === 0) return;

    if (process.platform === 'win32') {
      const ps = spawnSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
        ],
        { encoding: 'utf8', timeout: 180000, windowsHide: true }
      );
      if (ps.status === 0) return;
      throw new Error(`Archive extraction failed: ${(ps.stderr || tarRes.stderr || 'unknown error').toString().trim()}`);
    }

    throw new Error(`Archive extraction failed: ${(tarRes.stderr || '').toString().trim() || 'unknown error'}`);
  }

  findJavaRecursive(dir) {
    try {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (entry === javaExeName()) return full;
        if (fs.statSync(full).isDirectory()) {
          const found = this.findJavaRecursive(full);
          if (found) return found;
        }
      }
    } catch {}
    return null;
  }
}

module.exports = JavaService;
