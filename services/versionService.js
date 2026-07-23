const axios = require('axios');

class VersionService {
  constructor() {
    this.cache = { vanilla: null, fabric: null, forge: null };
  }

  async getVanillaVersions() {
    if (this.cache.vanilla) return this.cache.vanilla;
    try {
      const res = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
      const versions = res.data.versions;
      const validMcRegex = /^1\.\d+(\.\d+)?$/;

      const releases = versions
        .filter((v) => v.type === 'release' && validMcRegex.test(v.id))
        .map((v) => ({ id: v.id, type: 'release', url: v.url, releaseTime: v.releaseTime }));

      const snapshots = versions
        .filter((v) => v.type === 'snapshot')
        .map((v) => ({ id: v.id, type: 'snapshot', url: v.url, releaseTime: v.releaseTime }));

      const result = { releases, snapshots, latest: res.data.latest };
      this.cache.vanilla = result;
      return result;
    } catch (err) {
      console.error('Failed to fetch Mojang versions:', err.message);
      return {
        releases: [
          { id: '1.20.4', type: 'release' }, { id: '1.20.1', type: 'release' },
          { id: '1.19.4', type: 'release' }, { id: '1.16.5', type: 'release' },
          { id: '1.12.2', type: 'release' }, { id: '1.8.9', type: 'release' },
        ],
        snapshots: [],
        latest: { release: '1.20.4', snapshot: '1.20.4' },
      };
    }
  }

  async getFabricVersions() {
    if (this.cache.fabric) return this.cache.fabric;
    try {
      const [gameRes, loaderRes] = await Promise.all([
        axios.get('https://meta.fabricmc.net/v2/versions/game'),
        axios.get('https://meta.fabricmc.net/v2/versions/loader'),
      ]);

      const validMcRegex = /^1\.\d+(\.\d+)?$/;
      const supportedMcVersions = gameRes.data
        .filter((v) => v.stable && validMcRegex.test(v.version))
        .map((v) => v.version);

      const loaders = loaderRes.data.map((l) => l.version);
      const result = { mcVersions: supportedMcVersions, loaders, latestLoader: loaders[0] || '0.15.7' };
      this.cache.fabric = result;
      return result;
    } catch (err) {
      console.error('Failed to fetch Fabric versions:', err.message);
      return {
        mcVersions: ['1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.16.5'],
        loaders: ['0.15.7'],
        latestLoader: '0.15.7',
      };
    }
  }

  async getForgeVersions() {
    if (this.cache.forge) return this.cache.forge;
    try {
      const res = await axios.get('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
      const promos = res.data.promos;

      const forgeMap = {};
      const validMcRegex = /^1\.\d+(\.\d+)?$/;

      Object.keys(promos).forEach((key) => {
        const parts = key.split('-');
        const mcVersion = parts[0];
        const buildType = parts[1];
        const forgeBuild = promos[key];

        if (validMcRegex.test(mcVersion)) {
          if (!forgeMap[mcVersion]) forgeMap[mcVersion] = {};
          forgeMap[mcVersion][buildType] = forgeBuild;
        }
      });

      const mcVersions = Object.keys(forgeMap).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      const result = { mcVersions, forgeMap };
      this.cache.forge = result;
      return result;
    } catch (err) {
      console.error('Failed to fetch Forge versions:', err.message);
      return {
        mcVersions: ['1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2'],
        forgeMap: {},
      };
    }
  }

  async getAllVersions() {
    const [vanilla, fabric, forge] = await Promise.all([
      this.getVanillaVersions(),
      this.getFabricVersions(),
      this.getForgeVersions(),
    ]);
    return { vanilla, fabric, forge };
  }
}

module.exports = new VersionService();
