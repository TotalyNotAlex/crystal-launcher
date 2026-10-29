const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Always take the version from package.json - a hardcoded copy drifted before
// and caused an update loop when it fell behind the released build.
const CURRENT_VERSION = require('../package.json').version;
let manifestPath = '';

class UpdateService {
  setManifestPath(p) { manifestPath = p; }

  readJsonFile(file) {
    // Files written by other tools (or PowerShell) may carry a UTF-8 BOM,
    // which JSON.parse rejects - strip it before parsing.
    const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  }

  async checkForUpdates() {
    try {
      if (manifestPath && fs.existsSync(manifestPath)) {
        const m = this.readJsonFile(manifestPath);
        if (m.version && this.compareVersions(m.version, CURRENT_VERSION) > 0) {
          let downloadUrl = m.downloadUrl || '';
          // Reject a local installer that does not match the advertised version
          if (downloadUrl && (downloadUrl.includes('file://') || downloadUrl.match(/^[A-Z]:\\/i) || downloadUrl.startsWith('\\\\'))) {
            const urlLower = downloadUrl.toLowerCase();
            if (!urlLower.includes(String(m.version).toLowerCase()) || !fs.existsSync(downloadUrl.replace(/^file:\/\//i, ''))) {
              downloadUrl = '';
            }
          }
          return {
            hasUpdate: true,
            version: m.version,
            currentVersion: CURRENT_VERSION,
            url: '',
            downloadUrl,
            sha256: m.sha256 || '',
            body: m.body || '',
            buildId: m.buildId || 0,
          };
        }
      }
    } catch {}
    try {
      const res = await axios.get(`https://api.github.com/repos/TotalyNotAlex/crystal-launcher/releases/latest`, {
        headers: { 'User-Agent': 'CrystalLauncher/1.0', 'Accept': 'application/vnd.github.v3+json' },
        timeout: 10000,
      });
      const tag = res.data.tag_name || res.data.name || '';
      const version = tag.replace(/^v/, '');
      const assets = Array.isArray(res.data.assets) ? res.data.assets : [];
      // Prefer the setup installer, not whatever asset happens to be first.
      const asset = assets.find((a) => /\.exe$/i.test(a.name) && /setup/i.test(a.name))
        || assets.find((a) => /\.exe$/i.test(a.name))
        || assets[0];
      const downloadUrl = asset?.browser_download_url || '';
      // Never install an asset whose filename does not match the release version
      const assetName = asset?.name || '';
      const versionOk = !assetName || assetName.toLowerCase().includes(String(version).toLowerCase()) || !assetName.includes('Setup');
      const digest = String(asset?.digest || '');
      const sha256 = digest.startsWith('sha256:') ? digest.slice('sha256:'.length) : '';
      return {
        hasUpdate: this.compareVersions(version, CURRENT_VERSION) > 0,
        version,
        currentVersion: CURRENT_VERSION,
        url: res.data.html_url,
        downloadUrl: versionOk ? downloadUrl : '',
        sha256,
        body: res.data.body || '',
      };
    } catch (err) {
      const msg = err?.response?.status === 403 ? 'API rate limited — try again later' : (err?.message || 'Network error');
      return { hasUpdate: false, version: CURRENT_VERSION, currentVersion: CURRENT_VERSION, url: '', downloadUrl: '', body: '', error: msg };
    }
  }

  async downloadUpdate(downloadUrl, destPath, onProgress) {
    if (downloadUrl.startsWith('file://') || downloadUrl.match(/^[A-Z]:\\/i) || downloadUrl.startsWith('\\\\')) {
      const src = downloadUrl.replace(/^file:\/\//i, '');
      if (onProgress) onProgress(50);
      fs.copyFileSync(src, destPath);
      if (onProgress) onProgress(100);
      return destPath;
    }
    const tmpPath = `${destPath}.${process.pid}.${Date.now()}.tmp`;
    const writer = fs.createWriteStream(tmpPath);
    try {
      const res = await axios.get(downloadUrl, { responseType: 'stream', timeout: 120000, maxRedirects: 5 });
      const total = parseInt(res.headers['content-length'] || '0');
      let downloaded = 0;
      res.data.on('data', (chunk) => {
        downloaded += chunk.length;
        if (onProgress && total) onProgress(Math.round((downloaded / total) * 100));
      });
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', (err) => { try { fs.unlinkSync(tmpPath); } catch {} reject(err); });
        res.data.on('error', (err) => { try { fs.unlinkSync(tmpPath); } catch {} reject(err); });
        res.data.pipe(writer);
      });
      if (fs.existsSync(destPath)) {
        try { fs.unlinkSync(destPath); } catch {}
      }
      fs.renameSync(tmpPath, destPath);
      return destPath;
    } catch (err) {
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
      throw err;
    }
  }

  async installUpdate(updatePath) {
    const ext = path.extname(updatePath).toLowerCase();
    if (ext === '.exe') {
      execSync(`"${updatePath}" /S`, { timeout: 5000, windowsHide: true });
      return true;
    }
    return false;
  }

  compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }
}

module.exports = new UpdateService();
