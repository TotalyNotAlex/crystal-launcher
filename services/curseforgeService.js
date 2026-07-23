const axios = require('axios');
const fs = require('fs');

const CDN_BASE = 'https://edge.forgecdn.net/files';
const SEARCH_URL = 'https://www.curseforge.com/minecraft/search';

class CurseForgeService {
  async searchMods(query, classId = 6, offset = 0) {
    const loaderFilter = classId === 6 ? '' : '&categoryId=' + classId;
    const url = `${SEARCH_URL}?page=${Math.floor(offset / 20) + 1}&pageSize=20&search=${encodeURIComponent(query)}${loaderFilter}`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000,
    });

    const results = this.parseSearchHtml(res.data);
    return results;
  }

  parseSearchHtml(html) {
    const results = [];
    const projectRegex = /<a[^>]*href="\/minecraft\/(?:mc-mods|texture-packs|shaders)\/([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?class="project-title"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="project-description"[^>]*>([\s\S]*?)<\/div>[\s\S]*?class="project-author"[^>]*>([\s\S]*?)<\/div>[\s\S]*?class="project-download-count"[^>]*>([\s\S]*?)<\/div>/gi;

    let match;
    while ((match = projectRegex.exec(html)) !== null) {
      results.push({
        slug: match[1].trim(),
        iconUrl: match[2].trim(),
        name: match[3].replace(/<[^>]*>/g, '').trim(),
        description: match[4].replace(/<[^>]*>/g, '').trim(),
        author: match[5].replace(/<[^>]*>/g, '').trim(),
        downloads: this.parseCount(match[6]),
      });
    }

    if (!results.length) {
      const simplerRegex = /<a[^>]*href="\/minecraft\/(?:mc-mods|texture-packs|shaders)\/([^"]+)"[^>]*class="[^"]*project-title[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
      while ((match = simplerRegex.exec(html)) !== null) {
        const name = match[2].replace(/<[^>]*>/g, '').trim();
        if (name && !results.find(r => r.slug === match[1])) {
          results.push({ slug: match[1].trim(), name, description: '', author: '', downloads: 0, iconUrl: '' });
        }
      }
    }

    return results;
  }

  async getModVersions(slug) {
    const url = `https://www.curseforge.com/minecraft/mc-mods/${slug}/files`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000,
    });

    const versions = [];
    const fileRegex = /data-file-id="(\d+)"[\s\S]*?class="file-name"[^>]*>([\s\S]*?)<\/span>[\s\S]*?class="game-version"[^>]*>([\s\S]*?)<\/span>[\s\S]*?class="file-type"[^>]*>([\s\S]*?)<\/span>/gi;
    let match;
    while ((match = fileRegex.exec(res.data)) !== null) {
      versions.push({
        id: parseInt(match[1]),
        fileName: match[2].trim(),
        gameVersion: match[3].replace(/<[^>]*>/g, '').trim(),
        fileType: match[4].replace(/<[^>]*>/g, '').trim(),
      });
    }

    if (!versions.length) {
      const simpleRegex = /data-file-id="(\d+)"[\s\S]*?class="file-name"[^>]*>([\s\S]*?)<\//gi;
      while ((match = simpleRegex.exec(res.data)) !== null) {
        const fileName = match[2].replace(/<[^>]*>/g, '').trim();
        if (!versions.find(v => v.id === parseInt(match[1]))) {
          versions.push({ id: parseInt(match[1]), fileName, gameVersion: '', fileType: '' });
        }
      }
    }

    return versions;
  }

  getDownloadUrl(fileId, fileName) {
    const prefix = Math.floor(fileId / 1000);
    return { url: `${CDN_BASE}/${prefix}/${fileId}/${fileName}`, fileName };
  }

  async downloadFile(fileId, fileName, destPath) {
    const { url } = this.getDownloadUrl(fileId, fileName);
    const writer = fs.createWriteStream(destPath);
    const res = await axios.get(url, {
      responseType: 'stream',
      timeout: 60000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'CrystalLauncher/1.0' },
    });
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
      res.data.pipe(writer);
    });
  }

  parseCount(str) {
    const cleaned = str.replace(/[^0-9.,KkMmBb]/g, '').trim();
    if (cleaned.includes('K')) return Math.round(parseFloat(cleaned) * 1000);
    if (cleaned.includes('M')) return Math.round(parseFloat(cleaned) * 1000000);
    if (cleaned.includes('B')) return Math.round(parseFloat(cleaned) * 1000000000);
    return parseInt(cleaned.replace(/,/g, '')) || 0;
  }
}

module.exports = new CurseForgeService();
