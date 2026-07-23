let translations = {};
let currentLang = 'en';

function t(key, params) {
  let text = translations[key];
  if (text === undefined) text = key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
  }
  return text;
}

function translatePage() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

async function setLanguage(lang) {
  const data = await window.api.getTranslations(lang);
  if (data) {
    translations = data;
    currentLang = lang;
  } else {
    const fallback = await window.api.getTranslations('en');
    if (fallback) translations = fallback;
    currentLang = 'en';
  }
  translatePage();
  const sel = $('language-select');
  if (sel) sel.value = currentLang;
  saveSettings();
}

let versionsData = { vanilla: null, fabric: null, forge: null };
let accounts = [];
let profiles = [];
let activeProfileId = null;
let activeAccountId = null;
let targetDeleteProfileId = null;

let currentLoader = 'vanilla';
let currentVersion = '1.20.4';
let currentRam = 4;
let currentJvm = '';
let currentKeepOpen = true;
let fullVersions = [];

const loaderNames = { vanilla: 'Vanilla', fabric: 'Fabric', forge: 'Forge' };

const $ = (id) => document.getElementById(id);
const loadingOverlay = $('loading-overlay');
const loadingStatus = $('loading-status');
const mainApp = $('main-app');
const mainTitlebar = $('main-titlebar');

$('btn-minimize').onclick = () => window.api.minimizeWindow();
$('btn-maximize').onclick = () => window.api.maximizeWindow();
$('btn-close').onclick = () => window.api.closeWindow();

document.querySelectorAll('.nav-item').forEach((item) => {
  item.onclick = () => {
    document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    item.classList.add('active');
    const view = $('view-' + item.dataset.view);
    if (view) view.classList.add('active');
    if (item.dataset.view === 'mods') refreshInstalledMods();
    if (item.dataset.view === 'worlds') updateWorlds();
    if (item.dataset.view === 'servers') updateServers();
    if (item.dataset.view === 'console') { $('btn-console-tab-log').click(); }
    if (item.dataset.view === 'news') updateNews();
    window.api.rpcSetView(item.dataset.view);
  };
});

function toast(title, msg, type = 'success', duration = 7000) {
  const container = $('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="toast-icon"><svg viewBox="0 0 24 24"><path d="${type === 'success' ? 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' : 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'}"/></svg></div><div><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>`;
  container.appendChild(el);
  setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 300); }, duration);
}

function saveSettings() {
  const accent = document.querySelector('.accent-swatch.active')?.dataset.color || $('accent-custom')?.value || '#6c8cff';
  window.api.saveSettings({ activeAccountId, activeProfileId, lastLoader: currentLoader, lastVersion: currentVersion, defaultRam: currentRam, jvmArgs: currentJvm, keepLauncherOpen: currentKeepOpen, language: currentLang, discordRpc: $('toggle-rpc')?.checked ?? true, accentColor: accent });
}

function setLoader(val) {
  currentLoader = val;
  $('trigger-loader-text').textContent = loaderNames[val];
  document.querySelectorAll('#menu-loader .dropdown-option').forEach((o) => o.classList.toggle('selected', o.dataset.value === val));
  populateVersions(val);
  updateSummary();
  saveSettings();
}

function populateVersions(loaderType) {
  if (loaderType === 'fabric' && versionsData.fabric) fullVersions = versionsData.fabric.mcVersions;
  else if (loaderType === 'forge' && versionsData.forge) fullVersions = versionsData.forge.mcVersions;
  else if (versionsData.vanilla) fullVersions = versionsData.vanilla.releases.map((r) => r.id);
  else fullVersions = ['1.20.4', '1.20.1', '1.19.4', '1.16.5', '1.12.2', '1.8.9'];

  if (!fullVersions.includes(currentVersion)) currentVersion = fullVersions[0];
  $('trigger-version-text').textContent = currentVersion;
  renderVersions('');
  updateSummary();
}

function renderVersions(query) {
  const list = $('version-list');
  list.innerHTML = '';
  const filtered = query ? fullVersions.filter((v) => v.toLowerCase().includes(query.toLowerCase())) : fullVersions;
  if (!filtered.length) { list.innerHTML = `<div style="color:var(--text-muted);padding:10px;font-size:12px;text-align:center;">${t('mods.no_results')}</div>`; return; }
  filtered.forEach((v) => {
    const el = document.createElement('div');
    el.className = `dropdown-option ${v === currentVersion ? 'selected' : ''}`;
    el.textContent = v;
    el.onclick = (e) => { e.stopPropagation(); currentVersion = v; $('trigger-version-text').textContent = v; $('dropdown-version').classList.remove('open'); updateSummary(); saveSettings(); };
    list.appendChild(el);
  });
}

function updateSummary() {
  $('summary-name').textContent = `${loaderNames[currentLoader]} Minecraft`;
  $('summary-version').textContent = currentVersion;
}

$('trigger-loader').onclick = (e) => { e.stopPropagation(); $('dropdown-version').classList.remove('open'); $('dropdown-loader').classList.toggle('open'); };
$('trigger-version').onclick = (e) => {
  e.stopPropagation(); $('dropdown-loader').classList.remove('open');
  const open = $('dropdown-version').classList.toggle('open');
  if (open) { $('search-version').value = ''; renderVersions(''); setTimeout(() => $('search-version').focus(), 50); }
};
$('search-version').oninput = (e) => renderVersions(e.target.value.trim());
$('search-version').onclick = (e) => e.stopPropagation();
document.onclick = () => { $('dropdown-loader').classList.remove('open'); $('dropdown-version').classList.remove('open'); };

document.querySelectorAll('#menu-loader .dropdown-option').forEach((opt) => {
  opt.onclick = (e) => { e.stopPropagation(); setLoader(opt.dataset.value); $('dropdown-loader').classList.remove('open'); };
});

// Mods tab switching
document.querySelectorAll('.mods-tab').forEach((tab) => {
  tab.onclick = () => {
    document.querySelectorAll('.mods-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.mods-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = $('mods-' + tab.dataset.modsTab);
    if (panel) panel.classList.add('active');
    if (tab.dataset.modsTab === 'installed') refreshInstalledMods();
  };
});

// Modrinth search
let modSearchTimeout = null;
$('mods-search-input').onkeydown = (e) => { if (e.key === 'Enter') searchMods(); };
$('mods-search-btn').onclick = searchMods;

async function searchMods() {
  const query = $('mods-search-input').value.trim();
  if (!query) return;
  const results = $('mods-results');
  results.innerHTML = `<div class="mods-loading">${t('mods.searching')}</div>`;

  const facets = [['project_type:mod']];
  if (currentLoader !== 'vanilla') facets.push([`categories:${currentLoader}`]);

  const data = await window.api.modrinthSearch(query, facets, 0);
  results.innerHTML = '';

  if (!data.hits || !data.hits.length) {
    results.innerHTML = `<div class="mods-placeholder">${t('mods.no_results')}</div>`;
    return;
  }

  data.hits.forEach((mod) => {
    const card = document.createElement('div');
    card.className = 'mod-card';
    const icon = mod.icon_url || '';
    const downloads = mod.downloads ? (mod.downloads >= 1000000 ? (mod.downloads / 1000000).toFixed(1) + 'M' : mod.downloads >= 1000 ? (mod.downloads / 1000).toFixed(1) + 'K' : mod.downloads) : '0';
    card.innerHTML = `
      <img class="mod-card-icon" src="${icon}" alt="" onerror="this.style.display='none'">
      <div class="mod-card-info">
        <div class="mod-card-title">${mod.title || mod.slug}</div>
        <div class="mod-card-desc">${(mod.description || '').substring(0, 80)}${mod.description && mod.description.length > 80 ? '...' : ''}</div>
        <div class="mod-card-meta">${mod.author || 'Unknown'} &bull; ${downloads} ${t('mods.downloads')}</div>
      </div>
      <button class="btn btn-primary mod-install-btn" data-slug="${mod.slug}" data-title="${mod.title || mod.slug}">Install</button>
    `;
    card.querySelector('.mod-install-btn').onclick = (e) => {
      e.stopPropagation();
      openModDetail(mod.slug, mod.title || mod.slug);
    };
    results.appendChild(card);
  });
}

// Modpack search
$('modpacks-search-input').onkeydown = (e) => { if (e.key === 'Enter') searchModpacks(); };
$('modpacks-search-btn').onclick = searchModpacks;

async function searchModpacks() {
  const query = $('modpacks-search-input').value.trim();
  if (!query) return;
  const results = $('modpacks-results');
  results.innerHTML = `<div class="mods-loading">${t('mods.searching')}</div>`;

  const facets = [['project_type:modpack']];
  const data = await window.api.modrinthSearch(query, facets, 0);
  results.innerHTML = '';

  if (!data.hits || !data.hits.length) {
    results.innerHTML = `<div class="mods-placeholder">${t('mods.no_results_modpacks')}</div>`;
    return;
  }

  data.hits.forEach((mp) => {
    const card = document.createElement('div');
    card.className = 'mod-card';
    const icon = mp.icon_url || '';
    const downloads = mp.downloads ? (mp.downloads >= 1000000 ? (mp.downloads / 1000000).toFixed(1) + 'M' : mp.downloads >= 1000 ? (mp.downloads / 1000).toFixed(1) + 'K' : mp.downloads) : '0';
    card.innerHTML = `
      <img class="mod-card-icon" src="${icon}" alt="" onerror="this.style.display='none'">
      <div class="mod-card-info">
        <div class="mod-card-title">${mp.title || mp.slug}</div>
        <div class="mod-card-desc">${(mp.description || '').substring(0, 80)}${mp.description && mp.description.length > 80 ? '...' : ''}</div>
        <div class="mod-card-meta">${mp.author || 'Unknown'} &bull; ${downloads} ${t('mods.downloads')}</div>
      </div>
      <button class="btn btn-primary mod-install-btn" data-slug="${mp.slug}" data-title="${mp.title || mp.slug}">Install</button>
    `;
    card.querySelector('.mod-install-btn').onclick = (e) => {
      e.stopPropagation();
      openModpackInstall(mp);
    };
    results.appendChild(card);
  });
}

// Mod detail modal
let currentDetailSlug = null;

async function openModDetail(slug, title) {
  currentDetailSlug = slug;
  $('modal-mod-title').textContent = title;
  $('modal-mod-desc').textContent = t('mods.loading') || 'Loading...';
  $('modal-mod-author').textContent = '';
  $('modal-mod-icon').src = '';
  $('modal-install-btn').textContent = t('mods.install');
  $('modal-install-btn').disabled = true;
  $('modal-version-select').innerHTML = '';
  $('modal-mod-detail').classList.add('active');

  const project = await window.api.modrinthProject(slug);
  if (!project) { $('modal-mod-desc').textContent = t('mods.load_failed'); return; }

  $('modal-mod-desc').textContent = project.description || 'No description.';
  $('modal-mod-author').textContent = `${t('mods.by')} ${project.author || 'Unknown'}`;
  if (project.icon_url) $('modal-mod-icon').src = project.icon_url;

  const loaders = currentLoader !== 'vanilla' ? [currentLoader] : [];
  const versions = await window.api.modrinthVersions(project.id, loaders, []);

  const select = $('modal-version-select');
  select.innerHTML = '';
  if (versions.length) {
    versions.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.id;
      const mc = (v.game_versions || []).slice(0, 3).join(', ');
      opt.textContent = `${v.version_number || v.name} (${mc}${v.game_versions?.length > 3 ? '...' : ''})`;
      opt.dataset.url = v.files?.[0]?.url || '';
      opt.dataset.filename = v.files?.[0]?.filename || `${project.slug}.jar`;
      select.appendChild(opt);
    });
    select.selectedIndex = 0;
    $('modal-install-btn').disabled = false;
  } else {
    const opt = document.createElement('option');
    opt.textContent = 'No compatible version found';
    select.appendChild(opt);
  }
}

$('modal-install-btn').onclick = async () => {
  const select = $('modal-version-select');
  const opt = select.options[select.selectedIndex];
  const url = opt.dataset.url;
  const filename = opt.dataset.filename;
  if (!url) { toast('Install Error', 'No download URL available', 'error'); return; }

  const pid = activeProfileId || profiles[0]?.id;
  if (!pid) { toast('Install Error', 'Create a profile first', 'error'); return; }

  $('modal-install-btn').textContent = t('mods.installing');
  $('modal-install-btn').disabled = true;

  const result = await window.api.modrinthDownload(url, pid, filename);
  if (result.success) {
    toast(t('mods.installed_ok'), `${$('modal-mod-title').textContent} ${t('mods.installed_profile')}`);
    $('modal-mod-detail').classList.remove('active');
    refreshInstalledMods();
  } else {
    toast(t('mods.download_failed'), result.error || t('mods.download_failed'), 'error');
  }
  $('modal-install-btn').textContent = t('mods.install');
  $('modal-install-btn').disabled = false;
};

$('modal-mod-close').onclick = () => { $('modal-mod-detail').classList.remove('active'); };

// CurseForge search
$('cf-search-input').onkeydown = (e) => { if (e.key === 'Enter') searchCurseforge(); };
$('cf-search-btn').onclick = searchCurseforge;

async function searchCurseforge() {
  const query = $('cf-search-input').value.trim();
  if (!query) return;
  const results = $('cf-results');
  results.innerHTML = `<div class="mods-loading">${t('mods.searching')}</div>`;

  const data = await window.api.curseforgeSearch(query, 6, 0);
  results.innerHTML = '';

  if (!data || !data.length) {
    results.innerHTML = `<div class="mods-placeholder">${t('mods.no_results')}</div>`;
    return;
  }

  data.forEach((mod) => {
    const card = document.createElement('div');
    card.className = 'mod-card';
    const downloads = mod.downloads >= 1000000 ? (mod.downloads / 1000000).toFixed(1) + 'M' : mod.downloads >= 1000 ? (mod.downloads / 1000).toFixed(1) + 'K' : (mod.downloads || '0');
    card.innerHTML = `
      <img class="mod-card-icon" src="${mod.iconUrl || ''}" alt="" onerror="this.style.display='none'">
      <div class="mod-card-info">
        <div class="mod-card-title">${mod.name}</div>
        <div class="mod-card-desc">${(mod.description || '').substring(0, 80)}${mod.description && mod.description.length > 80 ? '...' : ''}</div>
        <div class="mod-card-meta">${mod.author || 'Unknown'} &bull; ${downloads} ${t('mods.downloads')}</div>
      </div>
      <button class="btn btn-primary mod-install-btn">${t('mods.install')}</button>
    `;
    card.querySelector('.mod-install-btn').onclick = () => openCurseforgeInstall(mod);
    results.appendChild(card);
  });
}

async function openCurseforgeInstall(mod) {
  const pid = activeProfileId || profiles[0]?.id;
  if (!pid) { toast(t('toast.error'), t('mods.select_profile'), 'error'); return; }

  $('modal-mod-title').textContent = mod.name;
  $('modal-mod-desc').textContent = t('mods.loading');
  $('modal-mod-author').textContent = `${t('mods.by')} ${mod.author || 'Unknown'}`;
  $('modal-mod-icon').src = mod.iconUrl || '';
  $('modal-install-btn').textContent = t('mods.install');
  $('modal-install-btn').disabled = true;
  $('modal-version-select').innerHTML = '';
  $('modal-mod-detail').classList.add('active');

  const versions = await window.api.curseforgeVersions(mod.slug);
  const select = $('modal-version-select');
  select.innerHTML = '';

  if (versions.length) {
    versions.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `${v.fileName} (${v.gameVersion})`;
      opt.dataset.fileId = v.id;
      opt.dataset.fileName = v.fileName;
      select.appendChild(opt);
    });
    select.selectedIndex = 0;
    $('modal-install-btn').disabled = false;

    $('modal-install-btn').onclick = async () => {
      const opt = select.options[select.selectedIndex];
      $('modal-install-btn').textContent = t('mods.installing');
      $('modal-install-btn').disabled = true;
      const result = await window.api.curseforgeDownload(parseInt(opt.dataset.fileId), opt.dataset.fileName, pid);
      if (result.success) {
        toast(t('mods.installed_ok'), `${mod.name} ${t('mods.installed_profile')}`);
        $('modal-mod-detail').classList.remove('active');
        refreshInstalledMods();
      } else {
        toast(t('mods.download_failed'), result.error || t('mods.download_failed'), 'error');
      }
      $('modal-install-btn').textContent = t('mods.install');
      $('modal-install-btn').disabled = false;
    };
  } else {
    const opt = document.createElement('option');
    opt.textContent = t('mods.no_compat');
    select.appendChild(opt);
    $('modal-install-btn').disabled = true;
  }
}

// Resource packs search
$('rp-search-input').onkeydown = (e) => { if (e.key === 'Enter') searchResourcepacks(); };
$('rp-search-btn').onclick = searchResourcepacks;

async function searchResourcepacks() {
  const query = $('rp-search-input').value.trim();
  if (!query) return;
  const results = $('rp-results');
  results.innerHTML = `<div class="mods-loading">${t('mods.searching')}</div>`;

  const facets = [['project_type:resourcepack']];
  const data = await window.api.modrinthSearch(query, facets, 0);
  results.innerHTML = '';

  if (!data.hits || !data.hits.length) {
    results.innerHTML = `<div class="mods-placeholder">${t('mods.no_results')}</div>`;
    return;
  }

  data.hits.forEach((mod) => {
    const card = document.createElement('div');
    card.className = 'mod-card';
    const icon = mod.icon_url || '';
    const downloads = mod.downloads >= 1000000 ? (mod.downloads / 1000000).toFixed(1) + 'M' : mod.downloads >= 1000 ? (mod.downloads / 1000).toFixed(1) + 'K' : (mod.downloads || '0');
    card.innerHTML = `
      <img class="mod-card-icon" src="${icon}" alt="" onerror="this.style.display='none'">
      <div class="mod-card-info">
        <div class="mod-card-title">${mod.title || mod.slug}</div>
        <div class="mod-card-desc">${(mod.description || '').substring(0, 80)}${mod.description && mod.description.length > 80 ? '...' : ''}</div>
        <div class="mod-card-meta">${mod.author || 'Unknown'} &bull; ${downloads} ${t('mods.downloads')}</div>
      </div>
      <button class="btn btn-primary mod-install-btn">${t('mods.install')}</button>
    `;
    card.querySelector('.mod-install-btn').onclick = () => openPackInstall(mod, 'resourcepack');
    results.appendChild(card);
  });
}

// Shaders search
$('shader-search-input').onkeydown = (e) => { if (e.key === 'Enter') searchShaders(); };
$('shader-search-btn').onclick = searchShaders;

async function searchShaders() {
  const query = $('shader-search-input').value.trim();
  if (!query) return;
  const results = $('shader-results');
  results.innerHTML = `<div class="mods-loading">${t('mods.searching')}</div>`;

  const facets = [['project_type:shader']];
  const data = await window.api.modrinthSearch(query, facets, 0);
  results.innerHTML = '';

  if (!data.hits || !data.hits.length) {
    results.innerHTML = `<div class="mods-placeholder">${t('mods.no_results')}</div>`;
    return;
  }

  data.hits.forEach((mod) => {
    const card = document.createElement('div');
    card.className = 'mod-card';
    const icon = mod.icon_url || '';
    const downloads = mod.downloads >= 1000000 ? (mod.downloads / 1000000).toFixed(1) + 'M' : mod.downloads >= 1000 ? (mod.downloads / 1000).toFixed(1) + 'K' : (mod.downloads || '0');
    card.innerHTML = `
      <img class="mod-card-icon" src="${icon}" alt="" onerror="this.style.display='none'">
      <div class="mod-card-info">
        <div class="mod-card-title">${mod.title || mod.slug}</div>
        <div class="mod-card-desc">${(mod.description || '').substring(0, 80)}${mod.description && mod.description.length > 80 ? '...' : ''}</div>
        <div class="mod-card-meta">${mod.author || 'Unknown'} &bull; ${downloads} ${t('mods.downloads')}</div>
      </div>
      <button class="btn btn-primary mod-install-btn">${t('mods.install')}</button>
    `;
    card.querySelector('.mod-install-btn').onclick = () => openPackInstall(mod, 'shader');
    results.appendChild(card);
  });
}

async function openPackInstall(mod, type) {
  $('modal-mod-title').textContent = mod.title || mod.slug;
  $('modal-mod-desc').textContent = t('mods.loading');
  $('modal-mod-author').textContent = `${t('mods.by')} ${mod.author || 'Unknown'}`;
  $('modal-mod-icon').src = mod.icon_url || '';
  $('modal-install-btn').textContent = t('mods.install');
  $('modal-install-btn').disabled = true;
  $('modal-version-select').innerHTML = '';
  $('modal-mod-detail').classList.add('active');

  const project = await window.api.modrinthProject(mod.slug || mod.id);
  if (!project) { $('modal-mod-desc').textContent = t('mods.load_failed'); return; }
  $('modal-mod-desc').textContent = project.description || '';

  const versions = await window.api.modrinthVersions(project.id, [], []);
  const select = $('modal-version-select');
  select.innerHTML = '';

  if (versions.length) {
    versions.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `${v.version_number || v.name} (${(v.game_versions || []).slice(0, 3).join(', ')})`;
      opt.dataset.url = v.files?.[0]?.url || '';
      opt.dataset.filename = v.files?.[0]?.filename || `${project.slug}.zip`;
      select.appendChild(opt);
    });
    select.selectedIndex = 0;
    $('modal-install-btn').disabled = false;
    $('modal-install-btn').onclick = async () => {
      const opt = select.options[select.selectedIndex];
      const url = opt.dataset.url;
      const filename = opt.dataset.filename;
      if (!url) return;
      $('modal-install-btn').textContent = t('mods.installing');
      $('modal-install-btn').disabled = true;
      const folder = type === 'shader' ? await window.api.getShaderpacksFolder() : await window.api.getResourcepacksFolder();
      const result = await window.api.downloadToFolder(url, filename, folder);
      if (result.success) {
        toast(t('mods.installed_ok'), `${mod.title || mod.slug} installed`);
        $('modal-mod-detail').classList.remove('active');
      } else {
        toast(t('mods.download_failed'), result.error || t('mods.download_failed'), 'error');
      }
      $('modal-install-btn').textContent = t('mods.install');
      $('modal-install-btn').disabled = false;
    };
  } else {
    select.innerHTML = '<option>' + t('mods.no_compat') + '</option>';
  }
}

// Modpack install
async function openModpackInstall(mp) {
  const pid = activeProfileId || profiles[0]?.id;
  if (!pid) { toast('Error', 'Create a profile first', 'error'); return; }

  toast(t('mods.installing_modpack'), `${t('mods.fetching')} ${mp.title}...`, 'success');

  const project = await window.api.modrinthProject(mp.slug);
  if (!project) { toast(t('toast.error'), t('mods.modpack_failed'), 'error'); return; }

  const versions = await window.api.modrinthVersions(project.id, [], []);
  if (!versions.length) { toast(t('toast.error'), t('mods.no_compat'), 'error'); return; }

  const latest = versions[0];
  const result = await window.api.modrinthInstallModpack(project.id, latest.id, pid);
  if (result.success) {
    toast(t('mods.modpack_installed'), `${mp.title} ${t('mods.modpack_installed_ok')}`);
    refreshInstalledMods();
  } else {
    toast(t('mods.modpack_failed'), result.error || t('mods.modpack_failed'), 'error');
  }
}

// Installed mods tab
async function refreshInstalledMods() {
  const pid = activeProfileId || profiles[0]?.id;
  if (!pid) { $('mods-installed-list').innerHTML = `<div class="mod-empty">${t('mods.no_profile')}</div>`; return; }
  try {
    const mods = await window.api.getMods(pid);
    const list = $('mods-installed-list');
    list.innerHTML = '';
    if (!mods.length) { list.innerHTML = `<div class="mod-empty">${t('mods.no_mods')}</div>`; return; }
    mods.forEach((m) => {
      const el = document.createElement('div');
      el.className = 'mod-item';
      el.innerHTML = `<span class="mod-name">${m.name}</span><label class="toggle"><input type="checkbox" ${m.enabled ? 'checked' : ''}><span class="toggle-slider"></span></label>`;
      el.querySelector('input').onchange = async function () { await window.api.toggleMod(pid, m.fileName, this.checked); refreshInstalledMods(); };
      list.appendChild(el);
    });
  } catch (e) { console.error(e); }
}

$('mods-open-folder-btn').onclick = () => {
  const pid = activeProfileId || profiles[0]?.id;
  if (pid) window.api.openModsFolder(pid);
};

// Profiles
function updateProfiles() {
  const grid = $('profile-grid');
  grid.innerHTML = '';
  profiles.forEach((p) => {
    const card = document.createElement('div');
    card.className = `profile-card ${p.id === activeProfileId ? 'selected' : ''}`;
    card.innerHTML = `<div><div class="card-name">${p.name}</div><div class="card-meta">MC ${p.mcVersion} &bull; ${p.ram || currentRam}GB</div></div><div class="card-bottom"><span class="loader-tag">${p.loaderType}</span><button class="btn btn-secondary" style="padding:3px 8px;font-size:10px;">Delete</button></div>`;
    card.querySelector('button').onclick = (e) => { e.stopPropagation(); targetDeleteProfileId = p.id; $('delete-profile-warning').innerHTML = t('profiles.delete_warn', { name: `<strong style="color:#fff;">${p.name}</strong>` }); $('modal-delete-profile').classList.add('active'); };
    card.onclick = () => {
      activeProfileId = p.id;
      if (p.loaderType) setLoader(p.loaderType);
      if (p.mcVersion) { currentVersion = p.mcVersion; $('trigger-version-text').textContent = p.mcVersion; renderVersions(''); updateSummary(); }
      saveSettings(); updateProfiles(); loadMods(p.id);
    };
    grid.appendChild(card);
  });
  if (activeProfileId) loadMods(activeProfileId);
}

async function loadMods(pid) {
  try {
    const mods = await window.api.getMods(pid);
    $('mod-count').textContent = mods.length;
    const list = $('mod-list');
    list.innerHTML = '';
    if (!mods.length) { list.innerHTML = `<div class="mod-empty">${t('profiles.no_mods')}</div>`; return; }
    mods.forEach((m) => {
      const el = document.createElement('div');
      el.className = 'mod-item';
      el.innerHTML = `<span class="mod-name">${m.name}</span><label class="toggle"><input type="checkbox" ${m.enabled ? 'checked' : ''}><span class="toggle-slider"></span></label>`;
      el.querySelector('input').onchange = async function () { await window.api.toggleMod(pid, m.fileName, this.checked); loadMods(pid); };
      list.appendChild(el);
    });
  } catch (e) { console.error(e); }
}

$('btn-open-mods').onclick = () => activeProfileId && window.api.openModsFolder(activeProfileId);
$('btn-create-profile').onclick = () => { $('modal-create-profile').classList.add('active'); $('input-profile-name').value = `${loaderNames[currentLoader]} ${currentVersion}`; setTimeout(() => $('input-profile-name').focus(), 50); };
$('btn-cancel-profile').onclick = () => $('modal-create-profile').classList.remove('active');
$('btn-save-profile').onclick = async () => {
  const name = $('input-profile-name').value.trim() || `${loaderNames[currentLoader]} ${currentVersion}`;
  await window.api.saveProfile({ name, loaderType: currentLoader, mcVersion: currentVersion, ram: currentRam });
  profiles = await window.api.getProfiles();
  activeProfileId = profiles[profiles.length - 1]?.id;
  saveSettings(); updateProfiles(); $('modal-create-profile').classList.remove('active'); toast(t('profiles.saved'), t('profiles.created', { name }));
};

$('btn-delete-cancel').onclick = () => { $('modal-delete-profile').classList.remove('active'); targetDeleteProfileId = null; };
$('btn-delete-backup').onclick = async () => {
  if (!targetDeleteProfileId) return;
  $('modal-delete-profile').classList.remove('active');
  await window.api.deleteProfile(targetDeleteProfileId, true);
  profiles = await window.api.getProfiles();
  if (activeProfileId === targetDeleteProfileId) activeProfileId = profiles[0]?.id || null;
  targetDeleteProfileId = null; saveSettings(); updateProfiles(); toast(t('profiles.deleted'), t('profiles.backed_up'));
};
$('btn-delete-confirm').onclick = async () => {
  if (!targetDeleteProfileId) return;
  $('modal-delete-profile').classList.remove('active');
  await window.api.deleteProfile(targetDeleteProfileId, false);
  profiles = await window.api.getProfiles();
  if (activeProfileId === targetDeleteProfileId) activeProfileId = profiles[0]?.id || null;
  targetDeleteProfileId = null; saveSettings(); updateProfiles(); toast(t('profiles.deleted'), t('profiles.removed'));
};

function updateAccounts() {
  const list = $('account-list');
  list.innerHTML = '';
  const active = accounts.find((a) => a.id === activeAccountId) || accounts[0];
  $('sidebar-username').textContent = active?.name || t('accounts.no_account');
  $('sidebar-account-type').textContent = active ? (active.type === 'microsoft' ? 'Microsoft' : 'Offline') : t('accounts.add_account');
  accounts.forEach((a) => {
    const card = document.createElement('div');
    card.className = 'account-card';
    card.innerHTML = `<div class="account-card-left"><div class="account-avatar"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div><div><div class="account-name">${a.name}</div><div class="account-type">${a.type === 'microsoft' ? 'Microsoft' : 'Offline'}</div></div></div><div style="display:flex;gap:6px;"><button class="btn btn-secondary" style="font-size:11px;">${a.id === activeAccountId ? t('accounts.active') : t('accounts.select')}</button><button class="btn btn-secondary" style="color:var(--danger);font-size:11px;">${t('accounts.remove')}</button></div>`;
    card.querySelectorAll('button')[0].onclick = () => { activeAccountId = a.id; saveSettings(); updateAccounts(); };
    card.querySelectorAll('button')[1].onclick = async () => {
      accounts = await window.api.removeAccount(a.id);
      if (activeAccountId === a.id) activeAccountId = accounts[0]?.id || null;
      saveSettings(); updateAccounts(); toast(t('accounts.removed'), '');
    };
    list.appendChild(card);
  });
}

$('btn-add-microsoft').onclick = async function () {
  this.disabled = true; this.textContent = t('accounts.connecting');
  const res = await window.api.loginMicrosoft();
  this.disabled = false; this.textContent = t('accounts.microsoft_btn');
  if (res.success) { accounts = await window.api.getAccounts(); activeAccountId = res.account.id; saveSettings(); updateAccounts(); toast(t('accounts.linked'), `${t('accounts.welcome', { name: res.account.name })}`); }
  else toast(t('accounts.login_error'), res.error, 'error');
};

window.api.onAuthStatus((s) => { $('btn-add-microsoft').textContent = s; });

$('btn-add-offline').onclick = () => { $('modal-offline').classList.add('active'); setTimeout(() => $('input-offline-name').focus(), 50); };
$('btn-cancel-offline').onclick = () => $('modal-offline').classList.remove('active');
$('btn-save-offline').onclick = async () => {
  const name = $('input-offline-name').value.trim() || 'Player';
  await window.api.createOfflineAccount(name);
  accounts = await window.api.getAccounts();
  activeAccountId = accounts[accounts.length - 1]?.id;
  saveSettings(); updateAccounts(); $('modal-offline').classList.remove('active'); $('input-offline-name').value = ''; toast(t('accounts.added'), t('accounts.playing_as', { name }));
};

// Worlds
$('btn-open-saves').onclick = () => window.api.openSavesFolder();

async function updateWorlds() {
  const grid = $('worlds-grid');
  try {
    const worlds = await window.api.listWorlds();
    grid.innerHTML = '';
    if (!worlds.length) {
      grid.innerHTML = `<div class="mods-placeholder">${t('worlds.no_worlds')}</div>`;
      return;
    }
    worlds.forEach((w) => {
      const card = document.createElement('div');
      card.className = 'world-card';
      const size = w.size >= 1073741824 ? (w.size / 1073741824).toFixed(1) + ' GB' : w.size >= 1048576 ? (w.size / 1048576).toFixed(1) + ' MB' : (w.size / 1024).toFixed(0) + ' KB';
      const date = w.lastPlayed ? new Date(w.lastPlayed).toLocaleDateString() : 'Unknown';
      const iconHtml = w.icon ? `<img class="world-icon" src="data:image/png;base64,${w.icon}" alt="">` : `<div class="world-icon world-icon-fallback"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg></div>`;
      card.innerHTML = `
        ${iconHtml}
        <div class="world-info">
          <div class="world-name">${w.name}</div>
          <div class="world-meta">${w.gameVersion || '?'} &bull; ${size} &bull; ${date}</div>
        </div>
        <div class="world-actions">
          <button class="btn btn-secondary world-open-btn" style="font-size:10px;padding:3px 8px;">${t('profiles.open')}</button>
          <button class="btn btn-secondary world-delete-btn" style="font-size:10px;padding:3px 8px;color:var(--danger);">${t('profiles.delete')}</button>
        </div>
      `;
      card.querySelector('.world-open-btn').onclick = (e) => { e.stopPropagation(); window.api.openSavesFolder(); };
      card.querySelector('.world-delete-btn').onclick = (e) => {
        e.stopPropagation();
        if (confirm(`${t('worlds.delete_confirm')} "${w.name}"?`)) {
          window.api.deleteWorld(w.id).then(() => updateWorlds());
        }
      };
      grid.appendChild(card);
    });
  } catch (e) { console.error('Worlds error:', e); }
}

// News
async function updateNews() {
  const list = $('news-list');
  if (!list) return;
  list.innerHTML = `<div class="mods-loading">${t('news.loading')}</div>`;
  try {
    const newsBase = 'https://launchercontent.mojang.com';
    const res = await fetch(`${newsBase}/v2/javaPatchNotes.json`, { cache: 'no-cache' });
    const json = await res.json();
    const entries = (json.entries || []).slice(0, 15);
    list.innerHTML = '';
    if (!entries.length) {
      list.innerHTML = `<div class="mods-placeholder">${t('news.no_news')}</div>`;
      return;
    }
    entries.forEach((e) => {
      const card = document.createElement('div');
      card.className = 'news-card';
      const title = e.title || '';
      const text = e.shortText || '';
      const date = e.date ? new Date(e.date).toLocaleDateString() : '';
      const version = e.version || '';
      const imgUrl = e.image?.url ? `${newsBase}${e.image.url}` : (typeof e.image === 'string' ? `${newsBase}${e.image}` : '');
      const linkUrl = e.contentPath ? `${newsBase}${e.contentPath}` : '';
      const versionTag = version ? `<span class="news-version">${version}</span>` : '';
      const imgHtml = imgUrl
        ? `<img class="news-image" src="${imgUrl}" alt="" onerror="this.style.display='none'">`
        : `<div class="news-image news-image-fallback"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>`;
      card.innerHTML = `
        ${imgHtml}
        <div class="news-info">
          <div class="news-title">${title}</div>
          <div class="news-date"><span>${date}</span>${versionTag}</div>
          <div class="news-text">${text.substring(0, 200)}${text.length > 200 ? '...' : ''}</div>
        </div>
        ${linkUrl ? `<button class="btn btn-secondary news-read-btn" data-link="${linkUrl}">${t('news.read')}</button>` : ''}
      `;
      const btn = card.querySelector('.news-read-btn');
      if (btn) btn.onclick = () => window.api.shell.openExternal(btn.dataset.link);
      list.appendChild(card);
    });
  } catch (e) {
    console.error('News error:', e);
    list.innerHTML = `<div class="mods-placeholder">${t('news.error')}</div>`;
  }
}

$('btn-refresh-news').onclick = updateNews;

// Add news refresh to nav click
// Servers
let editingServerId = null;

$('btn-add-server').onclick = () => {
  editingServerId = null;
  $('input-server-name').value = '';
  $('input-server-address').value = '';
  $('input-server-port').value = '25565';
  $('modal-add-server').classList.add('active');
};

$('btn-cancel-server').onclick = () => $('modal-add-server').classList.remove('active');

$('btn-save-server').onclick = async () => {
  const name = $('input-server-name').value.trim();
  const address = $('input-server-address').value.trim();
  const port = parseInt($('input-server-port').value) || 25565;
  if (!name || !address) return;
  const server = { id: editingServerId || Date.now().toString(), name, address, port };
  await window.api.saveServer(server);
  $('modal-add-server').classList.remove('active');
  updateServers();
};

async function updateServers() {
  const list = $('server-list');
  try {
    const servers = await window.api.getServers();
    list.innerHTML = '';
    if (!servers.length) {
      list.innerHTML = `<div class="mods-placeholder">${t('servers.no_servers')}</div>`;
      return;
    }
    servers.forEach((s) => {
      const card = document.createElement('div');
      card.className = 'server-card';
      card.innerHTML = `
        <div class="server-icon"><svg viewBox="0 0 24 24"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H4v-2h7v2zm9 0h-7v-2h7v2z"/></svg></div>
        <div class="server-info">
          <div class="server-name">${s.name}</div>
          <div class="server-address">${s.address}:${s.port}</div>
        </div>
        <div class="server-actions">
          <button class="btn btn-primary server-connect-btn" style="font-size:11px;padding:5px 14px;" data-i18n="servers.connect">Connect</button>
          <button class="btn btn-secondary server-edit-btn" style="font-size:10px;padding:3px 8px;" data-i18n="profiles.mods">Edit</button>
          <button class="btn btn-secondary server-delete-btn" style="font-size:10px;padding:3px 8px;color:var(--danger);">${t('profiles.delete')}</button>
        </div>
      `;
      card.querySelector('.server-connect-btn').onclick = () => connectToServer(s);
      card.querySelector('.server-edit-btn').onclick = () => {
        editingServerId = s.id;
        $('input-server-name').value = s.name;
        $('input-server-address').value = s.address;
        $('input-server-port').value = s.port;
        $('modal-add-server').classList.add('active');
      };
      card.querySelector('.server-delete-btn').onclick = async () => {
        await window.api.deleteServer(s.id);
        updateServers();
        toast(t('profiles.deleted'), s.name);
      };
      list.appendChild(card);
    });
  } catch (e) { console.error('Servers error:', e); }
}

async function connectToServer(server) {
  const settings = await window.api.getSettings();
  const profiles = await window.api.getProfiles();
  let profile = profiles.find((p) => p.id === settings.activeProfileId) || profiles[0];
  if (!profile) { toast(t('toast.error'), t('mods.select_profile'), 'error'); return; }
  toast('Connecting', `Joining ${server.name}...`);
  const result = await window.api.launchGame(profile.id, settings.activeAccountId);
  if (!result.success) toast(t('play.error'), result.error || t('toast.error'), 'error');
}

// Call updateServers when servers tab is shown
const origNavHandler = document.querySelectorAll('.nav-item');
// Already handled below via the main handler, add servers to it
// (updating servers will be done via the nav click already)

// Playtime
async function updatePlaytimeStats() {
  try {
    const pt = await window.api.getPlaytime();
    const fmt = (ms) => { const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); return `${h}h ${m}m`; };
    $('stat-total').textContent = fmt(pt.totalMs);
    $('stat-today').textContent = fmt(pt.todayMs);
    $('stat-week').textContent = fmt(pt.weekMs);
  } catch {}
}

// Console
const consoleLines = [];
const maxConsoleLines = 500;

window.api.onLaunchLog((line) => {
  consoleLines.push(line);
  if (consoleLines.length > maxConsoleLines) consoleLines.splice(0, consoleLines.length - maxConsoleLines);
  const output = $('console-output');
  if (output && output.style.display !== 'none') {
    const div = document.createElement('div');
    div.className = 'console-line';
    div.textContent = line;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
  }
});

$('btn-clear-console').onclick = () => {
  consoleLines.length = 0;
  const output = $('console-output');
  output.innerHTML = `<div class="console-placeholder">${t('console.placeholder')}</div>`;
};

$('btn-console-tab-log').onclick = function () {
  $('console-output').style.display = 'flex';
  $('crash-list').style.display = 'none';
  this.style.background = 'var(--accent)'; this.style.color = '#fff';
  $('btn-console-tab-crashes').style.background = ''; $('btn-console-tab-crashes').style.color = '';
  const output = $('console-output');
  if (!consoleLines.length) {
    output.innerHTML = `<div class="console-placeholder">${t('console.placeholder')}</div>`;
  } else {
    output.innerHTML = '';
    consoleLines.forEach((l) => {
      const div = document.createElement('div');
      div.className = 'console-line';
      div.textContent = l;
      output.appendChild(div);
    });
    output.scrollTop = output.scrollHeight;
  }
};

$('btn-console-tab-crashes').onclick = async function () {
  $('console-output').style.display = 'none';
  $('crash-list').style.display = 'flex';
  this.style.background = 'var(--accent)'; this.style.color = '#fff';
  $('btn-console-tab-log').style.background = ''; $('btn-console-tab-log').style.color = '';
  const list = $('crash-list');
  try {
    const logs = await window.api.getCrashLogs();
    list.innerHTML = '';
    if (!logs.length) {
      list.innerHTML = `<div class="mods-placeholder">${t('console.no_crashes')}</div>`;
      return;
    }
    logs.forEach((log) => {
      const card = document.createElement('div');
      card.className = 'crash-card';
      const date = new Date(log.time).toLocaleString();
      card.innerHTML = `<div class="crash-header"><span class="crash-name">${log.name}</span><span class="crash-date">${date}</span></div><pre class="crash-content">${log.content.substring(0, 500)}...</pre>`;
      card.onclick = () => {
        const expanded = card.classList.toggle('expanded');
        card.querySelector('.crash-content').textContent = expanded ? log.content : log.content.substring(0, 500) + '...';
      };
      list.appendChild(card);
    });
  } catch {}
};

// Settings
function initSettings() {
  document.querySelectorAll('.ram-btn').forEach((btn) => {
    btn.onclick = () => { currentRam = parseInt(btn.dataset.ram); document.querySelectorAll('.ram-btn').forEach((b) => b.classList.toggle('active', parseInt(b.dataset.ram) === currentRam)); saveSettings(); toast(t('settings.ram_saved'), t('settings.ram_msg', { ram: currentRam })); };
  });
  $('input-jvm').onchange = () => { currentJvm = $('input-jvm').value.trim(); saveSettings(); toast(t('settings.jvm_saved'), ''); };
  $('toggle-keep').onchange = function () { currentKeepOpen = this.checked; saveSettings(); };
  $('toggle-rpc').onchange = function () { window.api.toggleRpc(this.checked); saveSettings(); };
  $('btn-game-folder').onclick = () => window.api.openGameFolder();
  $('btn-versions-folder').onclick = () => window.api.openVersionsFolder();
  $('btn-backups-folder').onclick = () => window.api.openBackupsFolder();
  $('language-select').onchange = function () { setLanguage(this.value); };

  document.querySelectorAll('.accent-swatch').forEach((swatch) => {
    swatch.onclick = function () {
      document.querySelectorAll('.accent-swatch').forEach((s) => s.classList.remove('active'));
      this.classList.add('active');
      const color = this.dataset.color;
      document.documentElement.style.setProperty('--accent', color);
      document.documentElement.style.setProperty('--accent-dim', color + '40');
      document.documentElement.style.setProperty('--accent-glow', color + '26');
      saveSettings();
    };
  });
  $('accent-custom').oninput = function () {
    const color = this.value;
    document.querySelectorAll('.accent-swatch').forEach((s) => s.classList.remove('active'));
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-dim', color + '40');
    document.documentElement.style.setProperty('--accent-glow', color + '26');
    saveSettings();
  };
  updatePlaytimeStats();

  $('btn-check-updates').onclick = async function () {
    this.disabled = true; this.textContent = 'Checking...';
    const status = $('update-status');
    status.textContent = 'Checking for updates...';
    const result = await window.api.checkUpdates();
    if (result.hasUpdate) {
      status.innerHTML = `Update ${result.version} available! <a href="${result.url}" target="_blank" style="color:var(--accent)">Download</a>`;
    } else {
      status.textContent = `Crystal Launcher is up to date (${result.currentVersion})`;
    }
    this.disabled = false; this.textContent = t('settings.check_updates');
  };

  $('java-install-btn')?.addEventListener('click', async function () {
    this.disabled = true; this.textContent = t('play.launching');
    $('java-status').innerHTML = `<span style="color:var(--accent)">&#9679;</span> Downloading Java 17... <span id="java-dl-pct">0%</span>`;
    const result = await window.api.installJava();
    if (result.success) {
      $('java-status').innerHTML = `<span style="color:var(--success)">&#9679;</span> ${t('settings.java_found', { version: '17' })} (auto-installed)`;
      toast(t('toast.saved'), 'Java 17 installed');
    } else {
      $('java-status').innerHTML = `<span style="color:var(--danger)">&#9679;</span> Java download failed: ${result.error} <button class="btn btn-secondary" id="java-install-btn" style="font-size:10px;padding:2px 8px;margin-left:6px;">Retry</button>`;
      toast(t('toast.error'), result.error, 'error');
    }
    this.disabled = false; this.textContent = 'Install';
  });
}

// Play
$('btn-play').onclick = async function () {
  this.disabled = true; this.textContent = t('play.launching');
  const pc = $('progress-container');
  pc.classList.add('active');
  $('progress-text').textContent = t('play.prepare');
  $('progress-fill').style.width = '0%';

  let launchProfile = profiles.find((p) => p.id === activeProfileId);
  if (!launchProfile || launchProfile.loaderType !== currentLoader || launchProfile.mcVersion !== currentVersion) {
    launchProfile = { id: activeProfileId || 'transient', name: `${loaderNames[currentLoader]} ${currentVersion}`, loaderType: currentLoader, mcVersion: currentVersion, ram: currentRam };
  }

  const result = await window.api.launchGame(launchProfile.id, activeAccountId);
  if (result.success) {
    $('progress-text').textContent = t('play.running');
    $('progress-fill').style.width = '100%';
    toast(t('play.started'), t('play.started_msg', { version: currentVersion }));
    setTimeout(() => { this.disabled = false; this.textContent = t('play.btn'); pc.classList.remove('active'); }, 3000);
  } else {
    let msg = result.error || t('toast.error');
    if (msg.includes('Java not found')) msg += ' Download Java at https://adoptium.net';
    toast(t('play.error'), msg, 'error');
    this.disabled = false; this.textContent = t('play.btn'); pc.classList.remove('active');
  }
};

window.api.onLaunchProgress((p) => { if (p.percent) $('progress-fill').style.width = `${p.percent}%`; });
window.api.onLaunchStatus((s) => { $('progress-text').textContent = s; });

// Init
async function init() {
  try {
    loadingStatus.textContent = 'Fetching manifests...';
    const [fetchedVersions, fetchedAccounts, fetchedProfiles, settings, appVersion] = await Promise.all([
      window.api.getVersions(), window.api.getAccounts(), window.api.getProfiles(), window.api.getSettings(), window.api.getAppVersion(),
    ]);
    const vDisplay = $('app-version-display');
    const vBadge = $('app-version-badge');
    if (vDisplay) vDisplay.textContent = `v${appVersion}`;
    if (vBadge) vBadge.textContent = `v${appVersion}`;

    versionsData = fetchedVersions;
    accounts = fetchedAccounts;
    profiles = fetchedProfiles;

    if (settings.activeAccountId && accounts.some((a) => a.id === settings.activeAccountId)) activeAccountId = settings.activeAccountId;
    else if (accounts.length) activeAccountId = accounts[0].id;

    if (settings.activeProfileId && profiles.some((p) => p.id === settings.activeProfileId)) activeProfileId = settings.activeProfileId;
    else if (profiles.length) activeProfileId = profiles[0].id;

    if (settings.lastLoader) currentLoader = settings.lastLoader;
    if (settings.lastVersion) currentVersion = settings.lastVersion;
    if (settings.defaultRam) currentRam = settings.defaultRam;
    if (settings.jvmArgs !== undefined) currentJvm = settings.jvmArgs;
    if (settings.keepLauncherOpen !== undefined) currentKeepOpen = settings.keepLauncherOpen;
    if (settings.language) await setLanguage(settings.language);

    document.querySelectorAll('.ram-btn').forEach((b) => b.classList.toggle('active', parseInt(b.dataset.ram) === currentRam));
    $('input-jvm').value = currentJvm;
    $('toggle-keep').checked = currentKeepOpen;
    $('toggle-rpc').checked = settings.discordRpc !== false;
    if (settings.accentColor) {
      document.documentElement.style.setProperty('--accent', settings.accentColor);
      document.documentElement.style.setProperty('--accent-dim', settings.accentColor + '40');
      document.documentElement.style.setProperty('--accent-glow', settings.accentColor + '26');
      document.querySelectorAll('.accent-swatch').forEach((s) => s.classList.toggle('active', s.dataset.color === settings.accentColor));
      $('accent-custom').value = settings.accentColor;
    }

    updateAccounts();
    updateProfiles();
    $('trigger-loader-text').textContent = loaderNames[currentLoader];
    document.querySelectorAll('#menu-loader .dropdown-option').forEach((o) => o.classList.toggle('selected', o.dataset.value === currentLoader));
    populateVersions(currentLoader);

    const java = await window.api.checkJava();
    if (java.found) {
      $('java-status').innerHTML = `<span style="color:var(--success)">&#9679;</span> ${t('settings.java_found', { version: java.version })} ${java.path ? '' : '(from PATH)'}`;
      loadingStatus.textContent = 'Ready!';
      setTimeout(() => {
        window.api.expandWindow();
        $('app-shell').classList.add('expanded');
        loadingOverlay.classList.add('hidden');
        mainApp.classList.add('visible');
        mainTitlebar.classList.remove('hidden');
        window.api.rpcSetView('play');
      }, 800);
    } else {
      loadingStatus.textContent = 'Java wird automatisch heruntergeladen...';
      $('java-status').innerHTML = `<span style="color:var(--accent)">&#9679;</span> Downloading Java 17... <span id="java-dl-pct">0%</span>`;
      const result = await window.api.installJava();
      if (result.success) {
        $('java-status').innerHTML = `<span style="color:var(--success)">&#9679;</span> ${t('settings.java_found', { version: '17' })} (auto-installed)`;
        loadingStatus.textContent = 'Ready!';
        setTimeout(() => {
          window.api.expandWindow();
          $('app-shell').classList.add('expanded');
          loadingOverlay.classList.add('hidden');
          mainApp.classList.add('visible');
          mainTitlebar.classList.remove('hidden');
        }, 800);
      } else {
        $('java-status').innerHTML = `<span style="color:var(--danger)">&#9679;</span> Java download failed: ${result.error} — <a href="https://adoptium.net" target="_blank" style="color:var(--accent)">${t('settings.java_download')}</a>`;
        loadingStatus.textContent = 'Starting offline...';
        setTimeout(() => {
          window.api.expandWindow();
          $('app-shell').classList.add('expanded');
          loadingOverlay.classList.add('hidden');
          mainApp.classList.add('visible');
          mainTitlebar.classList.remove('hidden');
        }, 1000);
      }
    }
  } catch (err) {
    console.error('Init error:', err);
    loadingStatus.textContent = 'Starting offline...';
    setTimeout(() => {
      window.api.expandWindow();
      $('app-shell').classList.add('expanded');
      loadingOverlay.classList.add('hidden');
      mainApp.classList.add('visible');
      mainTitlebar.classList.remove('hidden');
    }, 1000);
  }
}

window.api.onJavaInstallProgress((p) => {
  const pct = $('java-dl-pct');
  if (pct) pct.textContent = `${p.percent}%`;
  const status = $('java-status');
  if (status && p.status) {
    status.innerHTML = `<span style="color:var(--accent)">&#9679;</span> ${p.status}`;
  }
  loadingStatus.textContent = p.status || 'Installing Java...';
});

// Auto-update notification
let seenUpdateVersions = new Set();

function showUpdateDialog(update) {
  if (seenUpdateVersions.has(update.version)) return;
  seenUpdateVersions.add(update.version);
  const overlay = document.createElement('div');
  overlay.className = 'update-overlay';
  overlay.innerHTML = `
    <div class="update-dialog">
      <div class="update-icon"><svg viewBox="0 0 24 24" width="48" height="48"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15H9v-2h2v2zm0-4H9V7h2v6z" fill="var(--accent)"/></svg></div>
      <div class="update-title">Update ${update.version} available!</div>
      <div class="update-msg">Current version: ${update.currentVersion || '1.0.2'}</div>
      <div class="update-actions">
        <button class="btn btn-secondary" id="btn-update-later">Later</button>
        <button class="btn btn-primary" id="btn-update-now">Update & Restart</button>
      </div>
      <div class="update-progress" id="update-progress" style="display:none;">
        <div class="update-progress-fill" id="update-progress-fill"></div>
        <div class="update-progress-text" id="update-progress-text">Downloading...</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#btn-update-later').onclick = () => overlay.remove();
  overlay.querySelector('#btn-update-now').onclick = async () => {
    const btn = overlay.querySelector('#btn-update-now');
    const later = overlay.querySelector('#btn-update-later');
    btn.disabled = true;
    later.disabled = true;
    btn.textContent = 'Downloading...';
    overlay.querySelector('.update-progress').style.display = 'block';
    const result = await window.api.downloadUpdate(update.downloadUrl);
    if (result.success) {
      overlay.querySelector('#update-progress-text').textContent = 'Installing... Launcher will restart.';
    } else {
      btn.textContent = 'Update failed: ' + (result.error || '');
      btn.disabled = false;
      later.disabled = false;
    }
  };
}

function updateUpdateProgress(p) {
  const fill = document.getElementById('update-progress-fill');
  const text = document.getElementById('update-progress-text');
  if (fill) fill.style.width = (p.percent || 0) + '%';
  if (text) text.textContent = p.status || `Downloading... ${p.percent}%`;
}

window.api.onUpdateAvailable(showUpdateDialog);
window.api.onUpdateProgress(updateUpdateProgress);

initSettings();
init();
