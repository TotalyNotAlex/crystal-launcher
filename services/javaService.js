const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { execSync } = require('child_process');

const ADOPTIUM_URL = 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jre/hotspot/eclipse';

class JavaService {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.javaDir = path.join(baseDir, 'java');
    this.downloadPath = path.join(baseDir, 'java_download.zip');
  }

  getInstalledPath() {
    if (!fs.existsSync(this.javaDir)) return null;
    for (const entry of fs.readdirSync(this.javaDir)) {
      const javaExe = path.join(this.javaDir, entry, 'bin', 'java.exe');
      if (fs.existsSync(javaExe)) return javaExe;
    }
    return null;
  }

  getInstalledVersion() {
    const javaPath = this.getInstalledPath();
    if (!javaPath) return null;
    try {
      const out = execSync(`"${javaPath}" -version 2>&1`, { timeout: 5000 }).toString();
      const match = out.match(/(\d+)\.(\d+)/);
      return match ? `${match[1]}.${match[2]}` : 'unknown';
    } catch { return null; }
  }

  async downloadAndInstall(onProgress) {
    onProgress({ percent: 0, status: 'Downloading Java...' });

    const response = await axios.get(ADOPTIUM_URL, {
      responseType: 'stream',
      timeout: 120000,
      maxRedirects: 5,
    });

    const totalLength = parseInt(response.headers['content-length'] || '0');
    let downloaded = 0;

    const writer = fs.createWriteStream(this.downloadPath);

    response.data.on('data', (chunk) => {
      downloaded += chunk.length;
      if (totalLength > 0) {
        const pct = Math.round((downloaded / totalLength) * 70);
        onProgress({ percent: pct, status: `Downloading Java... ${Math.round((downloaded / totalLength) * 100)}%` });
      }
    });

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
      response.data.pipe(writer);
    });

    onProgress({ percent: 70, status: 'Extracting Java...' });

    if (!fs.existsSync(this.javaDir)) {
      fs.mkdirSync(this.javaDir, { recursive: true });
    }

    for (const existing of fs.readdirSync(this.javaDir)) {
      try {
        fs.rmSync(path.join(this.javaDir, existing), { recursive: true, force: true });
      } catch {}
    }

    execSync(
      `powershell -NoProfile -Command "& {Expand-Archive -Path '${this.downloadPath}' -DestinationPath '${this.javaDir}' -Force}"`,
      { timeout: 120000, maxBuffer: 100 * 1024 * 1024 }
    );

    onProgress({ percent: 90, status: 'Verifying installation...' });

    try { fs.unlinkSync(this.downloadPath); } catch {}

    const javaExe = this.getInstalledPath();
    if (!javaExe) {
      const items = fs.readdirSync(this.javaDir);
      for (const item of items) {
        const exe = path.join(this.javaDir, item, 'bin', 'java.exe');
        if (fs.existsSync(exe)) return exe;
      }
      const deep = this.findJavaRecursive(this.javaDir);
      if (deep) return deep;
      throw new Error('Java installation failed – could not find java.exe');
    }

    onProgress({ percent: 100, status: 'Java installed!' });
    return javaExe;
  }

  findJavaRecursive(dir) {
    try {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (entry === 'java.exe') return full;
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
