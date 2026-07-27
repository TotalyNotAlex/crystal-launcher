const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CURRENT_VERSION = '1.4.8';
let manifestPath = '';

class UpdateService {
  setManifestPath(p) { manifestPath = p; }

  async checkForUpdates() {
    try {
      if (manifestPath && fs.existsSync(manifestPath)) {
        const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (m.version && this.compareVersions(m.version, CURRENT_VERSION) > 0) {
          return {
            hasUpdate: true,
            version: m.version,
            currentVersion: CURRENT_VERSION,
            url: '',
            downloadUrl: m.downloadUrl || '',
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
      return {
        hasUpdate: this.compareVersions(version, CURRENT_VERSION) > 0,
        version,
        currentVersion: CURRENT_VERSION,
        url: res.data.html_url,
        downloadUrl: res.data.assets?.[0]?.browser_download_url || '',
        body: res.data.body || '',
      };
    } catch (err) {
      const msg = err?.response?.status === 403 ? 'API rate limited â€” try again later' : (err?.message || 'Network error');
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
    const writer = fs.createWriteStream(destPath);
    const res = await axios.get(downloadUrl, { responseType: 'stream', timeout: 120000, maxRedirects: 5 });
    const total = parseInt(res.headers['content-length'] || '0');
    let downloaded = 0;
    res.data.on('data', (chunk) => {
      downloaded += chunk.length;
      if (onProgress && total) onProgress(Math.round((downloaded / total) * 100));
    });
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
      res.data.pipe(writer);
    });
    return destPath;
  }

  async installUpdate(updatePath) {
    const ext = path.extname(updatePath).toLowerCase();
    if (ext === '.exe') {
      execSync(`"${updatePath}" /S`, { timeout: 5000 });
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
