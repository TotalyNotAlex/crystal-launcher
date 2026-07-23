const axios = require('axios');

const API_BASE = 'https://api.modrinth.com/v2';

class ModrinthService {
  async searchProjects(query, facets = [], offset = 0, limit = 30) {
    try {
      const params = { query, offset, limit };
      if (facets.length) params.facets = JSON.stringify(facets);
      const res = await axios.get(`${API_BASE}/search`, { params, timeout: 10000 });
      return res.data;
    } catch (err) {
      console.error('Modrinth search error:', err.message);
      return { hits: [], total_hits: 0, offset: 0 };
    }
  }

  async getProject(slug) {
    try {
      const res = await axios.get(`${API_BASE}/project/${slug}`, { timeout: 10000 });
      return res.data;
    } catch (err) {
      console.error('Modrinth getProject error:', err.message);
      return null;
    }
  }

  async getProjectVersions(projectId, loaders = [], gameVersions = []) {
    try {
      const params = {};
      if (loaders.length) params.loaders = JSON.stringify(loaders);
      if (gameVersions.length) params.game_versions = JSON.stringify(gameVersions);
      const res = await axios.get(`${API_BASE}/project/${projectId}/version`, { params, timeout: 10000 });
      return res.data;
    } catch (err) {
      console.error('Modrinth getVersions error:', err.message);
      return [];
    }
  }

  async getLatestVersion(projectId, loader, mcVersion) {
    try {
      const versions = await this.getProjectVersions(projectId, [loader], [mcVersion]);
      if (versions.length) return versions[0];
      const anyMc = await this.getProjectVersions(projectId, [loader]);
      if (anyMc.length) return anyMc[0];
      const anyLoader = await this.getProjectVersions(projectId);
      return anyLoader.length ? anyLoader[0] : null;
    } catch (err) {
      console.error('getLatestVersion error:', err.message);
      return null;
    }
  }

  async downloadFile(url, destPath) {
    try {
      const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
      require('fs').writeFileSync(destPath, res.data);
      return true;
    } catch (err) {
      console.error('Download error:', err.message);
      return false;
    }
  }

  async getModpackVersions(projectId) {
    try {
      const res = await axios.get(`${API_BASE}/project/${projectId}/version`, { timeout: 10000 });
      return res.data.filter((v) => v.version_type === 'release');
    } catch (err) {
      console.error('Modpack versions error:', err.message);
      return [];
    }
  }

  async getVersionDependencies(versionId) {
    try {
      const res = await axios.get(`${API_BASE}/version/${versionId}`, { timeout: 10000 });
      return res.data.dependencies || [];
    } catch (err) {
      console.error('Dependencies error:', err.message);
      return [];
    }
  }
}

module.exports = new ModrinthService();
