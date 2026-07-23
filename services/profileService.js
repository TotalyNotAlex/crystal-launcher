const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class ProfileService {
  constructor() {
    this.baseDir = path.join(app ? app.getPath('userData') : process.cwd(), '.crystall');
    this.profilesFile = path.join(this.baseDir, 'profiles.json');
    this.backupsDir = path.join(this.baseDir, 'backups');
    this.ensureDirs();
  }

  ensureDirs() {
    if (!fs.existsSync(this.baseDir)) fs.mkdirSync(this.baseDir, { recursive: true });
    if (!fs.existsSync(this.backupsDir)) fs.mkdirSync(this.backupsDir, { recursive: true });
    if (!fs.existsSync(this.profilesFile)) {
      const defaultProfiles = [
        { id: 'default-vanilla', name: 'Vanilla 1.20.4', mcVersion: '1.20.4', loaderType: 'vanilla', loaderVersion: '', ram: 4, created: Date.now() },
        { id: 'default-fabric', name: 'Fabric 1.20.4', mcVersion: '1.20.4', loaderType: 'fabric', loaderVersion: '', ram: 4, created: Date.now() },
      ];
      fs.writeFileSync(this.profilesFile, JSON.stringify(defaultProfiles, null, 2));
    }
  }

  getProfiles() {
    try {
      this.ensureDirs();
      const content = fs.readFileSync(this.profilesFile, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      console.error('Error reading profiles:', err);
      return [];
    }
  }

  saveProfile(profile) {
    const profiles = this.getProfiles();
    if (!profile.id) {
      profile.id = 'profile-' + Date.now();
      profile.created = Date.now();
      profiles.push(profile);
    } else {
      const index = profiles.findIndex((p) => p.id === profile.id);
      if (index !== -1) profiles[index] = { ...profiles[index], ...profile };
      else profiles.push(profile);
    }
    fs.writeFileSync(this.profilesFile, JSON.stringify(profiles, null, 2));
    this.getModsFolder(profile.id);
    return profile;
  }

  deleteProfile(profileId, backupMods = false) {
    let profiles = this.getProfiles();
    const profile = profiles.find((p) => p.id === profileId);

    if (backupMods && profile) {
      try {
        const modsDir = path.join(this.baseDir, 'profiles', profileId, 'mods');
        if (fs.existsSync(modsDir)) {
          const files = fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar') || f.endsWith('.jar.disabled'));
          if (files.length > 0) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const sanitizedName = (profile.name || profileId).replace(/[^a-zA-Z0-9_-]/g, '_');
            const backupTargetDir = path.join(this.backupsDir, `${sanitizedName}_${timestamp}`);
            fs.mkdirSync(backupTargetDir, { recursive: true });
            for (const file of files) {
              fs.copyFileSync(path.join(modsDir, file), path.join(backupTargetDir, file));
            }
          }
        }
      } catch (err) {
        console.warn('Backup warning:', err.message);
      }
    }

    profiles = profiles.filter((p) => p.id !== profileId);
    fs.writeFileSync(this.profilesFile, JSON.stringify(profiles, null, 2));

    const profileDir = path.join(this.baseDir, 'profiles', profileId);
    if (fs.existsSync(profileDir)) {
      try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (err) { console.warn('Delete warning:', err.message); }
    }
  }

  getModsFolder(profileId) {
    const modsDir = path.join(this.baseDir, 'profiles', profileId, 'mods');
    if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });
    return modsDir;
  }

  listMods(profileId) {
    const modsDir = this.getModsFolder(profileId);
    if (!fs.existsSync(modsDir)) return [];
    const files = fs.readdirSync(modsDir);
    return files
      .filter((f) => f.endsWith('.jar') || f.endsWith('.jar.disabled'))
      .map((f) => ({
        name: f.replace('.disabled', ''),
        fileName: f,
        enabled: !f.endsWith('.disabled'),
        size: fs.statSync(path.join(modsDir, f)).size,
      }));
  }

  toggleMod(profileId, fileName, enabled) {
    const modsDir = this.getModsFolder(profileId);
    const oldPath = path.join(modsDir, fileName);
    let newFileName = fileName;
    if (enabled && fileName.endsWith('.disabled')) newFileName = fileName.replace('.disabled', '');
    else if (!enabled && !fileName.endsWith('.disabled')) newFileName = fileName + '.disabled';
    const newPath = path.join(modsDir, newFileName);
    if (fs.existsSync(oldPath) && oldPath !== newPath) fs.renameSync(oldPath, newPath);
    return newFileName;
  }
}

module.exports = new ProfileService();
