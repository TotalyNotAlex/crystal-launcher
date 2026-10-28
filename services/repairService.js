const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const ASSET_BASE = 'https://resources.download.minecraft.net';
const CONCURRENCY = 8;

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

async function sha1Of(file) {
  try {
    const fd = await fsp.open(file, 'r');
    try {
      const hash = crypto.createHash('sha1');
      const buffer = Buffer.alloc(1024 * 1024);
      let position = 0;
      while (true) {
        const { bytesRead } = await fd.read(buffer, 0, buffer.length, position);
        if (!bytesRead) break;
        hash.update(buffer.subarray(0, bytesRead));
        position += bytesRead;
      }
      return hash.digest('hex');
    } finally {
      await fd.close();
    }
  } catch {
    return null;
  }
}

// A version JSON can point at a parent (Forge/NeoForge do this), so collect the
// whole chain - parent first - to know every library the launch will need.
function resolveVersionChain(gameRoot, versionId) {
  const chain = [];
  const seen = new Set();
  let id = versionId;
  while (id && !seen.has(id)) {
    seen.add(id);
    const json = readJson(path.join(gameRoot, 'versions', id, `${id}.json`));
    if (!json) break;
    chain.unshift(json);
    id = json.inheritsFrom;
  }
  return chain;
}

// Fabric/Quilt write their own version folder named after the loader; include
// those so their libraries get checked too.
function findLoaderVersionIds(gameRoot, mcVersion) {
  const versionsDir = path.join(gameRoot, 'versions');
  if (!fs.existsSync(versionsDir)) return [];
  const ids = [];
  for (const entry of fs.readdirSync(versionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === mcVersion) continue;
    const json = readJson(path.join(versionsDir, entry.name, `${entry.name}.json`));
    if (!json) continue;
    if (json.inheritsFrom === mcVersion || entry.name.endsWith(`-${mcVersion}`)) ids.push(entry.name);
  }
  return ids;
}

function collectTargets(gameRoot, versions) {
  const targets = [];
  const seen = new Set();
  const add = (target) => {
    if (!target.file || seen.has(target.file) || !target.url) return;
    seen.add(target.file);
    targets.push(target);
  };

  const librariesDir = path.join(gameRoot, 'libraries');
  const assetsDir = path.join(gameRoot, 'assets');

  for (const version of versions) {
    for (const library of version.libraries || []) {
      const artifact = library.downloads && library.downloads.artifact;
      if (!artifact || !artifact.path) continue;
      add({
        file: path.join(librariesDir, artifact.path),
        url: artifact.url,
        sha1: artifact.sha1,
        size: artifact.size,
        kind: 'library',
      });
    }

    if (version.assetIndex) {
      const indexFile = path.join(assetsDir, 'indexes', `${version.assetIndex.id}.json`);
      add({
        file: indexFile,
        url: version.assetIndex.url,
        sha1: version.assetIndex.sha1,
        size: version.assetIndex.size,
        kind: 'asset-index',
      });
      const index = readJson(indexFile);
      for (const obj of Object.values(index && index.objects ? index.objects : {})) {
        if (!obj || !obj.hash) continue;
        const prefix = obj.hash.slice(0, 2);
        add({
          file: path.join(assetsDir, 'objects', prefix, obj.hash),
          url: `${ASSET_BASE}/${prefix}/${obj.hash}`,
          sha1: obj.hash,
          size: obj.size,
          kind: 'asset',
        });
      }
    }
  }

  // The client jar belongs to the vanilla version, even in a loader chain.
  const base = versions.find((v) => v.downloads && v.downloads.client) || versions[versions.length - 1];
  if (base && base.downloads && base.downloads.client) {
    add({
      file: path.join(gameRoot, 'versions', base.id, `${base.id}.jar`),
      url: base.downloads.client.url,
      sha1: base.downloads.client.sha1,
      size: base.downloads.client.size,
      kind: 'client',
    });
  }

  return targets;
}

async function checkTarget(target) {
  const stat = await fsp.stat(target.file).catch(() => null);
  if (!stat) return 'missing';
  if (target.size && stat.size !== target.size) return 'size';
  if (target.sha1) {
    const actual = await sha1Of(target.file);
    if (actual !== target.sha1) return 'hash';
  }
  return 'ok';
}

async function repairTarget(target) {
  const stat = await fsp.stat(target.file).catch(() => null);
  if (stat) {
    if (target.size && stat.size !== target.size) {
      // wrong size: definitely broken
    } else if (target.sha1) {
      const actual = await sha1Of(target.file);
      if (actual === target.sha1) return 'ok';
    } else {
      return 'ok';
    }
  }
  await fsp.mkdir(path.dirname(target.file), { recursive: true });
  const res = await axios.get(target.url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    maxRedirects: 5,
  });
  const buffer = Buffer.from(res.data);
  if (target.sha1 && crypto.createHash('sha1').update(buffer).digest('hex') !== target.sha1) {
    throw new Error('downloaded file failed the hash check');
  }
  await fsp.mkdir(path.dirname(target.file), { recursive: true });
  const tmp = `${target.file}.repair.tmp`;
  await fsp.writeFile(tmp, buffer);
  await fsp.rename(tmp, target.file);
  return 'repaired';
}

async function pool(items, worker, concurrency, onProgress) {
  let next = 0;
  let done = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index], index);
      done += 1;
      if (onProgress) onProgress(done, items.length);
    }
  });
  await Promise.all(runners);
}

class RepairService {
  /**
   * Verifies libraries, assets and the client jar of a profile's Minecraft
   * installation and re-downloads whatever is missing or corrupt.
   */
  async repairProfile({ gameRoot, profile, onProgress }) {
    const mcVersion = profile && profile.mcVersion;
    if (!mcVersion) return { success: false, error: 'Profile has no Minecraft version' };

    const chain = resolveVersionChain(gameRoot, mcVersion);
    if (!chain.length) {
      return {
        success: false,
        notInstalled: true,
        error: `Minecraft ${mcVersion} is not installed yet - start it once, then repair.`,
      };
    }

    const loaderIds = findLoaderVersionIds(gameRoot, mcVersion);
    for (const id of loaderIds) {
      for (const entry of resolveVersionChain(gameRoot, id)) {
        if (!chain.some((c) => c.id === entry.id)) chain.push(entry);
      }
    }

    const targets = collectTargets(gameRoot, chain);
    if (!targets.length) return { success: true, checked: 0, repaired: 0, failed: 0, missing: 0 };

    let checked = 0;
    let repaired = 0;
    let failed = 0;
    const failedFiles = [];

    const report = (phase, current, total) => {
      if (onProgress) onProgress({ phase, current, total });
    };

    // Pass 1: only read the filesystem, so the player sees "checking" fast.
    const broken = [];
    await pool(targets, async (target) => {
      const state = await checkTarget(target);
      checked += 1;
      if (state !== 'ok') broken.push(target);
      report('check', checked, targets.length);
    }, CONCURRENCY, null);

    // Pass 2: download only what is actually broken.
    let done = 0;
    await pool(broken, async (target) => {
      try {
        await repairTarget(target);
        repaired += 1;
      } catch (err) {
        failed += 1;
        failedFiles.push(`${path.basename(target.file)} (${err.message})`);
      }
      done += 1;
      report('repair', done, broken.length);
    }, CONCURRENCY, null);

    return {
      success: true,
      version: mcVersion,
      checked,
      broken: broken.length,
      repaired,
      failed,
      failedFiles: failedFiles.slice(0, 10),
    };
  }
}

module.exports = new RepairService();
module.exports.repairService = module.exports;
