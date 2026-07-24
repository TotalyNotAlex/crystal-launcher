let translations = {};
let currentLang = 'en';
let newsCache = null;
let worldsCache = null;

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

setTimeout(() => { loadingOverlay?.classList.add('hidden'); mainApp?.classList.add('visible'); }, 15000);

window.api.onGlobalError?.((msg) => toast('Error', msg, 'error', 10000));

let isOffline = false;
async function checkOnline() {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);
    await fetch('https://api.modrinth.com/v2', { signal: controller.signal, method: 'HEAD' });
    isOffline = false;
  } catch {
    isOffline = true;
  }
  const badge = $('loading-offline');
  if (badge) badge.style.display = isOffline ? 'block' : 'none';
  const navs = document.querySelectorAll('.nav-item');
  if (isOffline) navs.forEach((n) => { if (n.dataset.view === 'mods' || n.dataset.view === 'news') n.style.opacity = '0.4'; });
  else navs.forEach((n) => n.style.opacity = '1');
}
checkOnline();

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach((m) => m.classList.remove('active'));
  }
  if (e.key === 'Enter') {
    const activeModSearch = $('mods-search-input')?.value;
    if (activeModSearch && document.activeElement === $('mods-search-input')) {
      searchMods();
    }
  }
});

function showError(container, message, retryFn) {
  if (!container) return;
  container.innerHTML = `
    <div class="error-state" style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:40px 20px;text-align:center;">
      <svg width="40" height="40" viewBox="0 0 24 24" style="fill:var(--danger);opacity:0.6"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
      <span style="color:var(--text-dim);font-size:13px;">${message}</span>
      ${retryFn ? `<button class="btn btn-secondary" onclick="(${retryFn.toString()})()">${t('retry') || 'Retry'}</button>` : ''}
    </div>`;
}

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
  const category = $('mods-filter-category').value;
  if (category) facets.push([`categories:${category}`]);
  if (currentLoader !== 'vanilla' && !category) facets.push([`categories:${currentLoader}`]);

  const sort = $('mods-filter-sort').value;

  let data;
  try {
    data = await window.api.modrinthSearch(query, facets, 0);
  } catch (e) {
    console.error('Mod search error:', e);
    showError(results, t('mods.search_error') || 'Search failed', () => searchMods());
    return;
  }
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
  let data;
  try {
    data = await window.api.modrinthSearch(query, facets, 0);
  } catch (e) {
    console.error('Modpack search error:', e);
    showError(results, t('mods.search_error') || 'Search failed', () => searchModpacks());
    return;
  }
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

function showModProgress(pct) {
  const bar = $('modal-download-progress');
  const fill = $('modal-download-fill');
  const text = $('modal-download-text');
  if (!bar) return;
  if (pct < 0) { bar.classList.remove('active'); return; }
  bar.classList.add('active');
  fill.style.width = pct + '%';
  text.textContent = pct < 100 ? `Downloading... ${pct}%` : 'Installing...';
}

window.api.onModDownloadProgress((d) => showModProgress(d.percent));

$('modal-install-btn').onclick = async () => {
  const select = $('modal-version-select');
  const opt = select.options[select.selectedIndex];
  const url = opt.dataset.url;
  const filename = opt.dataset.filename;
  if (!url) { toast('Install Error', 'No download URL available', 'error'); return; }

  const pid = activeProfileId || profiles[0]?.id;
  if (!pid) { toast('Install Error', 'Create a profile first', 'error'); return; }

  showModProgress(0);
  $('modal-install-btn').textContent = t('mods.installing');
  $('modal-install-btn').disabled = true;

  const result = await window.api.modrinthDownload(url, pid, filename);
  if (result.success) {
    showModProgress(-1);
    toast(t('mods.installed_ok'), `${$('modal-mod-title').textContent} ${t('mods.installed_profile')}`);
    $('modal-mod-detail').classList.remove('active');
    refreshInstalledMods();
  } else {
    showModProgress(-1);
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

  let data;
  try {
    data = await window.api.modrinthSearch(query, facets, 0, sort);
  } catch (e) {
    console.error('CurseForge search error:', e);
    showError(results, t('mods.search_error') || 'Search failed', () => searchCurseforge());
    return;
  }
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
    installedModsCache = mods;
    const list = $('mods-installed-list');
    list.innerHTML = '';
    if (!mods.length) { list.innerHTML = `<div class="mod-empty drag-target">${t('mods.no_mods')}</div>`; return; }
    renderInstalledMods();
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
    card.innerHTML = `<div><div class="card-name">${p.name}</div><div class="card-meta">MC ${p.mcVersion} &bull; ${p.ram || currentRam}GB</div></div><div class="card-bottom"><span class="loader-tag">${p.loaderType}</span><div class="card-actions"><button class="btn btn-secondary card-backup-btn" style="padding:3px 8px;font-size:10px;" title="Backup">${t('profiles.backup') || 'Backup'}</button><button class="btn btn-secondary" style="padding:3px 8px;font-size:10px;color:var(--danger);">${t('profiles.delete')}</button></div></div>`;
    card.querySelector('.card-backup-btn').onclick = async (e) => {
      e.stopPropagation();
      const result = await window.api.backupProfile(p.id);
      if (result.success) toast(t('profiles.backed_up') || 'Backup created', result.path);
      else toast('Backup failed', result.error || 'Error', 'error');
    };
    card.querySelector('button:last-child').onclick = (e) => { e.stopPropagation(); targetDeleteProfileId = p.id; $('delete-profile-warning').innerHTML = t('profiles.delete_warn', { name: `<strong style="color:#fff;">${p.name}</strong>` }); $('modal-delete-profile').classList.add('active'); };
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

function setupDragDrop(container, acceptExts, onDrop) {
  container.addEventListener('dragover', (e) => { e.preventDefault(); container.classList.add('drag-over'); });
  container.addEventListener('dragleave', () => container.classList.remove('drag-over'));
  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    container.classList.remove('drag-over');
    container.innerHTML = `<div class="mods-loading">Copying files...</div>`;
    for (const file of e.dataTransfer.files) {
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      if (acceptExts.includes(ext)) {
        await onDrop(file.path, file.name);
      }
    }
  });
}

async function loadMods(pid) {
  try {
    const mods = await window.api.getMods(pid);
    $('mod-count').textContent = mods.length;
    const list = $('mod-list');
    const sorted = sortMods(mods, modSortBy);
    list.innerHTML = '';
    if (!sorted.length) {
      list.innerHTML = `<div class="mod-empty drag-target">${t('profiles.no_mods')} — Drop .jar files here</div>`;
    }
    sorted.forEach((m) => {
      const el = document.createElement('div');
      el.className = 'mod-item';
      el.innerHTML = `<span class="mod-name">${m.name}</span><span class="mod-size" style="color:var(--text-muted);font-size:10px;margin-right:auto;margin-left:8px;">${(m.size / 1024).toFixed(0)} KB</span><label class="toggle"><input type="checkbox" ${m.enabled ? 'checked' : ''}><span class="toggle-slider"></span></label>`;
      el.querySelector('input').onchange = async function () { await window.api.toggleMod(pid, m.fileName, this.checked); loadMods(pid); };
      list.appendChild(el);
    });
    if (!list._dragSetup) {
      setupDragDrop(list, ['.jar', '.zip', '.mrpack'], async (filePath, fileName) => {
        if (pid) {
          const result = await window.api.copyToMods(pid, filePath, fileName);
          if (result.success) { toast('Installed', fileName); loadMods(pid); }
          else toast('Error', result.error, 'error');
        }
      });
      list._dragSetup = true;
    }
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
  updatePlayAccountBar();
  const list = $('account-list');
  list.innerHTML = '';
  const active = accounts.find((a) => a.id === activeAccountId) || accounts[0];
  $('sidebar-username').textContent = active?.name || t('accounts.no_account');
  $('sidebar-account-type').textContent = active ? (active.type === 'microsoft' ? 'Microsoft' : 'Offline') : t('accounts.add_account');
  const avatarImg = $('sidebar-avatar-img');
  const avatarFallback = $('sidebar-avatar-fallback');
  if (active?.name) {
    avatarImg.src = `https://crafatar.com/avatars/${active.name}?size=40&overlay`;
    avatarImg.style.display = 'block';
    avatarImg.onerror = () => { avatarImg.style.display = 'none'; avatarFallback.style.display = 'block'; };
    avatarFallback.style.display = 'none';
  } else {
    avatarImg.style.display = 'none';
    avatarFallback.style.display = 'block';
  }
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

async function updateWorlds(force) {
  const grid = $('worlds-grid');
  if (worldsCache && !force) {
    grid.innerHTML = worldsCache;
    return;
  }
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
          window.api.deleteWorld(w.id).then(() => updateWorlds(true));
        }
      };
      grid.appendChild(card);
    });
    worldsCache = grid.innerHTML;
  } catch (e) {
    console.error('Worlds error:', e);
    showError(grid, t('worlds.load_error') || 'Failed to load worlds', () => updateWorlds(true));
  }
}

// News
async function updateNews(force) {
  const list = $('news-list');
  if (!list) return;
  if (newsCache && !force) {
    list.innerHTML = newsCache;
    return;
  }
  list.innerHTML = `<div class="mods-loading">${t('news.loading')}</div>`;
  try {
    const newsBase = 'https://launchercontent.mojang.com';
    const res = await fetch(`${newsBase}/v2/javaPatchNotes.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
      `;
      list.appendChild(card);
    });
    newsCache = list.innerHTML;
  } catch (e) {
    console.error('News error:', e);
    showError(list, t('news.error') || 'Failed to load news', () => updateNews(true));
  }
}

$('btn-refresh-news').onclick = () => { newsCache = null; updateNews(true); };


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
  } catch (e) {
    console.error('Servers error:', e);
    showError(list, t('servers.load_error') || 'Failed to load servers', () => updateServers());
  }
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
    if (result.error) {
      status.innerHTML = `<span style="color:var(--danger)">Update check failed:</span> ${result.error}`;
    } else if (result.hasUpdate) {
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
  $('progress-text').textContent = 'Preparing...';
  $('progress-fill').style.width = '0%';

  let launchProfile = profiles.find((p) => p.id === activeProfileId);
  if (!launchProfile || launchProfile.loaderType !== currentLoader || launchProfile.mcVersion !== currentVersion) {
    launchProfile = { id: activeProfileId || 'transient', name: `${loaderNames[currentLoader]} ${currentVersion}`, loaderType: currentLoader, mcVersion: currentVersion, ram: currentRam };
  }

  const pcText = $('progress-text');
  try {
    if (!isOffline) {
      pcText.textContent = `Ensuring Minecraft ${currentVersion}...`;
      await window.api.downloadMcVersion(currentVersion, currentLoader);
    }
  } catch {}

  pcText.textContent = 'Launching...';
  const result = await window.api.launchGame(launchProfile.id, activeAccountId);
  if (result.success) {
    pcText.textContent = t('play.running');
    $('progress-fill').style.width = '100%';
    toast(t('play.started'), t('play.started_msg', { version: currentVersion }));
    setTimeout(() => { this.disabled = false; this.textContent = t('play.btn'); pc.classList.remove('active'); }, 3000);
  } else {
    let msg = result.error || t('toast.error');
    if (msg.includes('Java not found')) msg += ' Download Java at https://adoptium.net';
    toast(t('play.error'), msg, 'error');
    pcText.textContent = 'Launch failed';
    this.disabled = false; this.textContent = t('play.btn');
    setTimeout(() => pc.classList.remove('active'), 1000);
    window.api.getCrashLogs().then((logs) => {
      if (logs.length) {
        const latest = logs[0];
        $('crash-log-name').textContent = latest.name;
        $('crash-log-content').textContent = latest.content;
        $('modal-crash-log').classList.add('active');
      }
    });
  }
};

window.api.onLaunchProgress((p) => { if (p.percent) $('progress-fill').style.width = `${p.percent}%`; });
window.api.onLaunchStatus((s) => { $('progress-text').textContent = s; });

// First-Run Wizard
let wizardResolve = null;

function showWizardStep(n) {
  document.querySelectorAll('.wizard-step').forEach((s) => s.style.display = 'none');
  const step = $('wizard-step-' + n);
  if (step) step.style.display = 'block';
}

$('wizard-offline').onclick = () => {
  const nameInput = $('wizard-offline-name');
  const confirmBtn = $('wizard-offline-confirm');
  nameInput.style.display = 'inline-block';
  confirmBtn.style.display = 'inline-block';
  nameInput.focus();
};

$('wizard-offline-confirm').onclick = async () => {
  const name = $('wizard-offline-name').value.trim() || 'Player';
  const account = await window.api.createOfflineAccount(name);
  accounts = await window.api.getAccounts();
  activeAccountId = account.id;
  saveSettings();
  $('wizard-account-status').textContent = `Account "${name}" created`;
  $('wizard-offline-name').style.display = 'none';
  $('wizard-offline-confirm').style.display = 'none';
  setTimeout(() => showWizardStep(3), 800);
};

$('wizard-microsoft').onclick = async () => {
  $('wizard-account-status').textContent = 'Opening browser for Microsoft login...';
  const result = await window.api.loginMicrosoft();
  if (result.success) {
    accounts = await window.api.getAccounts();
    activeAccountId = result.account.id;
    saveSettings();
    $('wizard-account-status').textContent = `Signed in as ${result.account.name}`;
    setTimeout(() => showWizardStep(3), 800);
  } else {
    $('wizard-account-status').style.color = 'var(--danger)';
    $('wizard-account-status').textContent = `Login failed: ${result.error}`;
  }
};

$('wizard-create-profile').onclick = async () => {
  const loader = $('wizard-loader').value;
  const version = $('wizard-version').value;
  if (!version) return;
  const name = `${loader === 'vanilla' ? 'Vanilla' : loader.charAt(0).toUpperCase() + loader.slice(1)} ${version}`;
  await window.api.saveProfile({ name, loaderType: loader, mcVersion: version, ram: 4 });
  profiles = await window.api.getProfiles();
  activeProfileId = profiles[profiles.length - 1]?.id;
  saveSettings();
  $('wizard-profile-status').textContent = `Profile "${name}" created`;
  setTimeout(() => showWizardStep(4), 800);
};

$('wizard-finish').onclick = () => {
  $('modal-wizard').classList.remove('active');
  updateAccounts();
  updateProfiles();
  if (activeProfileId) loadMods(activeProfileId);
};

// Account Quick-Switch
function updatePlayAccountBar() {
  const nameEl = $('play-account-name');
  const typeEl = $('play-account-type');
  const select = $('play-account-select');
  if (!nameEl) return;
  const active = accounts.find((a) => a.id === activeAccountId) || accounts[0];
  nameEl.textContent = active?.name || 'No account';
  typeEl.textContent = active ? (active.type === 'microsoft' ? 'Microsoft' : 'Offline') : '';
  select.innerHTML = '';
  accounts.forEach((a) => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `${a.name} (${a.type === 'microsoft' ? 'MS' : 'Offline'})`;
    if (a.id === activeAccountId) opt.selected = true;
    select.appendChild(opt);
  });
  if (!accounts.length) {
    const opt = document.createElement('option');
    opt.textContent = 'Add account in Settings';
    select.appendChild(opt);
  }
}

$('play-account-select').onchange = function () {
  const id = this.value;
  if (id && accounts.some((a) => a.id === id)) {
    activeAccountId = id;
    saveSettings();
    updatePlayAccountBar();
    updateAccounts();
  }
};

// Mod sorting + updates
let installedModsCache = [];
let modSortBy = 'name';

$('mods-sort-select').onchange = function () {
  modSortBy = this.value;
  renderInstalledMods();
};

function sortMods(mods, by) {
  const sorted = [...mods];
  switch (by) {
    case 'name': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'size': sorted.sort((a, b) => (b.size || 0) - (a.size || 0)); break;
    case 'date': sorted.sort((a, b) => (b.modified || 0) - (a.modified || 0)); break;
    case 'enabled': sorted.sort((a, b) => (a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1)); break;
  }
  return sorted;
}

function renderInstalledMods() {
  const pid = activeProfileId || profiles[0]?.id;
  if (!pid) return;
  const list = $('mods-installed-list');
  const sorted = sortMods(installedModsCache, modSortBy);
  list.innerHTML = '';
  if (!sorted.length) {
    list.innerHTML = `<div class="mod-empty drag-target">${t('profiles.no_mods')} — Drop .jar files here</div>`;
    return;
  }
  sorted.forEach((m) => {
    const el = document.createElement('div');
    el.className = 'mod-item';
    const hasUpdate = m._hasUpdate;
    el.innerHTML = `<span class="mod-name">${m.name}</span>${hasUpdate ? '<span class="mod-update-badge">Update</span>' : ''}<span class="mod-size" style="color:var(--text-muted);font-size:10px;margin-left:auto;margin-right:8px;">${(m.size / 1024).toFixed(0)} KB</span><label class="toggle"><input type="checkbox" ${m.enabled ? 'checked' : ''}><span class="toggle-slider"></span></label>`;
    el.querySelector('input').onchange = async function () { await window.api.toggleMod(pid, m.fileName, this.checked); refreshInstalledMods(); };
    list.appendChild(el);
  });
}

$('mods-check-updates-btn').onclick = async function () {
  this.disabled = true;
  this.textContent = 'Checking...';
  const pid = activeProfileId || profiles[0]?.id;
  if (!pid) return;
  const updates = await window.api.checkModUpdates(pid);
  let count = 0;
  installedModsCache.forEach((m) => {
    const found = updates.find((u) => u.fileName === m.fileName);
    m._hasUpdate = !!found;
    if (m._hasUpdate) count++;
  });
  renderInstalledMods();
  this.disabled = false;
  this.textContent = count ? `${count} updates found` : 'Up to date';
  setTimeout(() => { this.textContent = 'Check Updates'; }, 3000);
};

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
    updatePlayAccountBar();
    updateProfiles();
    $('trigger-loader-text').textContent = loaderNames[currentLoader];
    document.querySelectorAll('#menu-loader .dropdown-option').forEach((o) => o.classList.toggle('selected', o.dataset.value === currentLoader));
    populateVersions(currentLoader);

    const isFirstRun = !accounts.length && !profiles.length;
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
        if (isFirstRun) {
          $('modal-wizard').classList.add('active');
          showWizardStep(1);
          const wizVer = $('wizard-version');
          if (wizVer && fullVersions.length) {
            wizVer.innerHTML = fullVersions.map((v) => `<option value="${v}">${v}</option>`).join('');
            wizVer.value = currentVersion;
          }
        }
      }, 800);
    } else {
      loadingStatus.textContent = 'Downloading Java 17...';
      $('loading-detail').textContent = 'This may take a moment';
      const javaProgress = document.createElement('div');
      javaProgress.className = 'loading-java-progress';
      javaProgress.innerHTML = `<div class="progress-text" style="text-align:center;font-size:11px;color:var(--text-dim);margin-top:8px;">0%</div><div class="progress-track" style="width:200px;margin:4px auto 0;"><div class="progress-fill" id="loading-java-fill" style="width:0%"></div></div>`;
      loadingStatus.after(javaProgress);
      const result = await window.api.installJava();
      javaProgress.remove();
      if (result.success) {
        $('java-status').innerHTML = `<span style="color:var(--success)">&#9679;</span> ${t('settings.java_found', { version: '17' })} (auto-installed)`;
        loadingStatus.textContent = 'Ready!';
        setTimeout(() => {
          window.api.expandWindow();
          $('app-shell').classList.add('expanded');
          loadingOverlay.classList.add('hidden');
          mainApp.classList.add('visible');
          mainTitlebar.classList.remove('hidden');
          if (isFirstRun) {
            $('modal-wizard').classList.add('active');
            showWizardStep(1);
            const wizVer = $('wizard-version');
            if (wizVer && fullVersions.length) {
              wizVer.innerHTML = fullVersions.map((v) => `<option value="${v}">${v}</option>`).join('');
              wizVer.value = currentVersion;
            }
          }
        }, 800);
      } else {
        $('java-status').innerHTML = `<span style="color:var(--danger)">&#9679;</span> Java download failed: ${result.error} <button class="btn btn-secondary" id="loading-java-retry" style="font-size:10px;padding:2px 8px;margin-left:6px;">Retry</button>`;
        loadingStatus.textContent = 'Java installation failed';
        document.getElementById('loading-java-retry').onclick = () => { location.reload(); };
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

// Skin Changer
let currentSkins = [];
let activeSkinName = 'default';
let skinModelType = 'slim';

// === 3D Skin Viewer (pure Canvas, NameMC-style) ===
let sv = null; // skin viewer state
let svAnimId = null;

const UV = {
  head:  {f:[8,8,8,8],b:[24,8,8,8],l:[0,8,8,8],r:[16,8,8,8],t:[8,0,8,8],m:[16,0,8,8]},
  hat:   {f:[40,8,8,8],b:[56,8,8,8],l:[32,8,8,8],r:[48,8,8,8],t:[40,0,8,8],m:[48,0,8,8]},
  body:  {f:[20,20,8,12],b:[32,20,8,12],l:[16,20,4,12],r:[28,20,4,12],t:[20,16,8,4],m:[28,16,8,4]},
  jack:  {f:[20,52,8,12],b:[32,52,8,12],l:[16,52,4,12],r:[28,52,4,12],t:[20,48,8,4],m:[28,48,8,4]},
  lleg:  {f:[4,20,4,12],b:[20,52,4,12],l:[0,20,4,12],r:[8,20,4,12],t:[4,16,4,4],m:[8,16,4,4]},
  rleg:  {f:[4,20,4,12],b:[20,52,4,12],l:[0,20,4,12],r:[8,20,4,12],t:[4,16,4,4],m:[8,16,4,4]},
  llo:   {f:[4,36,4,12],b:[20,36,4,12],l:[0,36,4,12],r:[8,36,4,12],t:[4,32,4,4],m:[8,32,4,4]},
  rlo:   {f:[4,36,4,12],b:[20,36,4,12],l:[0,36,4,12],r:[8,36,4,12],t:[4,32,4,4],m:[8,32,4,4]}
};

function armUV(w) { return {f:[44,20,w,12],b:[52,20,w,12],l:[40,20,w,12],r:[48,20,w,12],t:[44,16,w,4],m:[48,16,w,4]}; }
function armOV(w) { return {f:[44,52,w,12],b:[52,52,w,12],l:[40,52,w,12],r:[48,52,w,12],t:[44,48,w,4],m:[48,48,w,4]}; }

function v3(x,y,z){return{x,y,z}}
function m3(a11,a12,a13,a21,a22,a23,a31,a32,a33){return[a11,a12,a13,a21,a22,a23,a31,a32,a33]}
function mxv(m,v){return v3(m[0]*v.x+m[1]*v.y+m[2]*v.z,m[3]*v.x+m[4]*v.y+m[5]*v.z,m[6]*v.x+m[7]*v.y+m[8]*v.z)}
function rotY(a){let c=Math.cos(a),s=Math.sin(a);return m3(c,0,s,0,1,0,-s,0,c)}
function rotX(a){let c=Math.cos(a),s=Math.sin(a);return m3(1,0,0,0,c,-s,0,s,c)}

function proj(v,w,h){let d=60,z=v.z+80;if(z<1)z=1;return{x:v.x*d/z+w/2,y:-v.y*d/z+h/2,z}}

function buildFaces(parts, texData, isHd) {
  let faces = [];
  for (const p of parts) {
    const [cx,cy,cz] = p[0]; const [w,h,d] = p[1]; const u = p[2]; const ov = p[3];
    const hw=w/2, hh=h/2, hd=d/2;
    const side = {f:[0,1,2,3],b:[6,5,4,7],l:[4,5,1,0],r:[7,6,2,3],t:[3,2,6,7],m:[0,4,7,3]};
    const vts = [
      v3(cx-hw,cy+hh,cz+hd),v3(cx+hw,cy+hh,cz+hd),v3(cx+hw,cy-hh,cz+hd),v3(cx-hw,cy-hh,cz+hd),
      v3(cx-hw,cy+hh,cz-hd),v3(cx+hw,cy+hh,cz-hd),v3(cx+hw,cy-hh,cz-hd),v3(cx-hw,cy-hh,cz-hd)
    ];
    function addFace(vIdx,uv) {
      const [ux,uy,uw,uh]=uv; const f=vIdx.map(i=>vts[i]);
      const uvc=[[ux,uy],[ux+uw,uy],[ux+uw,uy+uh],[ux,uy+uh]];
      faces.push({v:f,uv:uvc,tex:texData,depth:0});
    }
    for (const [k,vi] of Object.entries(side)) {
      if (u[k]) addFace(vi,u[k]);
      if (isHd && ov && ov[k]) {
        const [ox,oy,ow,oh]=ov[k];
        let hasAlpha=false;
        for(let row=0;row<oh&&!hasAlpha;row++){for(let col=0;col<ow;col++){
          const idx=((oy+row)*64+(ox+col))*4;
          if(texData[idx+3]>0){hasAlpha=true;break}
        }}
        if(hasAlpha) addFace(vi,ov[k]);
      }
    }
  }
  return faces;
}

function renderSkin3D(ctx, W, H, img, yaw, pitch, slim) {
  ctx.clearRect(0,0,W,H);
  const grad=ctx.createRadialGradient(W/2,H-12,2,W/2,H-12,55);
  grad.addColorStop(0,'rgba(0,0,0,0.5)');grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=grad;ctx.beginPath();ctx.ellipse(W/2,H-8,55,10,0,0,Math.PI*2);ctx.fill();

  const tw=img.naturalWidth, th=img.naturalHeight;
  const texC=document.createElement('canvas');
  texC.width=tw;texC.height=th;
  const tCtx=texC.getContext('2d');
  tCtx.drawImage(img,0,0);
  const texPixels=tCtx.getImageData(0,0,tw,th).data;

  const w=slim?3:4, isHd=th===64;
  const rUV=armUV(w), rOV=armOV(w);
  const rArmBase=isHd?{f:[36,52,w,12],b:[36,52,w,12],l:[36,52,w,12],r:[36,52,w,12],t:[36,48,w,4],m:[40,48,w,4]}:rUV;
  const rLegBase=isHd?{f:[20,52,4,12],b:[20,52,4,12],l:[20,52,4,12],r:[20,52,4,12],t:[20,48,4,4],m:[24,48,4,4]}:UV.lleg;
  const rLegOV=isHd?{f:[20,36,4,12],b:[20,36,4,12],l:[20,36,4,12],r:[20,36,4,12],t:[20,32,4,4],m:[24,32,4,4]}:null;
  const rArmOV2=isHd?{f:[52,52,w,12],b:[52,52,w,12],l:[52,52,w,12],r:[52,52,w,12],t:[52,48,w,4],m:[52,48,w,4]}:null;

  const parts=[
    [[0,28,0],[8,8,8],UV.head,UV.hat],
    [[0,18,0],[8,12,4],UV.body,UV.jack],
    [[-(slim?5.5:6),18,0],[w,12,4],rUV,rOV],
    [[slim?5.5:6,18,0],[w,12,4],rArmBase,rArmOV2],
    [[-2,6,0],[4,12,4],UV.lleg,UV.llo],
    [[2,6,0],[4,12,4],rLegBase,rLegOV]
  ];

  let faces=buildFaces(parts,texPixels,isHd);
  const my=rotY(yaw), mx=rotX(pitch);
  for (const f of faces) {
    for(let i=0;i<4;i++){f.v[i]=mxv(my,mxv(mx,f.v[i]));const p=proj(f.v[i],W,H);f.v[i]=p}
    let d=0;for(let i=0;i<4;i++)d+=f.v[i].z;f.depth=d/4;
  }
  faces.sort((a,b)=>b.depth-a.depth);

  const out=ctx.getImageData(0,0,W,H);
  const pix=out.data;

  for (const f of faces) {
    const v=f.v, uv=f.uv;
    const vs=v.map(p=>({x:p.x,y:p.y}));
    const minY=Math.max(0,Math.ceil(Math.min(vs[0].y,vs[1].y,vs[2].y,vs[3].y)));
    const maxY=Math.min(H-1,Math.floor(Math.max(vs[0].y,vs[1].y,vs[2].y,vs[3].y)));
    if (minY>=maxY||maxY<0||minY>=H) continue;

    const uvX=[uv[0][0]/64,uv[1][0]/64,uv[2][0]/64,uv[3][0]/64];
    const uvY=[uv[0][1]/64,uv[1][1]/64,uv[2][1]/64,uv[3][1]/64];

    const order=[0,1,2,3];
    order.sort((a,b)=>vs[a].y-vs[b].y);
    const o=order;

    function edgeX(a,b,y){
      const dy=vs[b].y-vs[a].y;
      if(Math.abs(dy)<0.001)return vs[a].x;
      return vs[a].x+(y-vs[a].y)*(vs[b].x-vs[a].x)/dy;
    }
    function lerpU(a,b,t){return uvX[a]+(uvX[b]-uvX[a])*t}
    function lerpV(a,b,t){return uvY[a]+(uvY[b]-uvY[a])*t}
    function edgeFrac(a,b,y){
      const dy=vs[b].y-vs[a].y;
      if(Math.abs(dy)<0.001)return 0.5;
      return (y-vs[a].y)/dy;
    }

    for (let py=minY;py<=maxY;py++) {
      let xl,xr,ul,ur,vl,vr;
      const t0=vs[o[0]].y===vs[o[1]].y?1:edgeFrac(o[0],o[1],py);
      const t1=vs[o[0]].y===vs[o[2]].y?1:edgeFrac(o[0],o[2],py);

      if (py<vs[o[1]].y) {
        xl=edgeX(o[0],o[1],py);xr=edgeX(o[0],o[2],py);
        ul=lerpU(o[0],o[1],t0);ur=lerpU(o[0],o[2],t1);
        vl=lerpV(o[0],o[1],t0);vr=lerpV(o[0],o[2],t1);
      } else {
        xl=edgeX(o[1],o[2],py);xr=edgeX(o[0],o[2],py);
        const t2=vs[o[1]].y===vs[o[2]].y?1:edgeFrac(o[1],o[2],py);
        ul=lerpU(o[1],o[2],t2);ur=lerpU(o[0],o[2],t1);
        vl=lerpV(o[1],o[2],t2);vr=lerpV(o[0],o[2],t1);
      }
      if(xl>xr){const tmp=xl;xl=xr;xr=tmp;const tu=ul;ul=ur;ur=tu;const tv=vl;vl=vr;vr=tv}
      const sl=Math.max(0,Math.ceil(xl)), sr=Math.min(W-1,Math.floor(xr));
      if(sl>sr)continue;
      for (let px=sl;px<=sr;px++) {
        const frac=xr===xl?0.5:(px-xl)/(xr-xl);
        const tu=ul+(ur-ul)*frac, tv=vl+(vr-vl)*frac;
        const sx=Math.min(tw-1,Math.max(0,Math.round(tu*tw)));
        const sy=Math.min(th-1,Math.max(0,Math.round(tv*th)));
        const idx=(sy*tw+sx)*4;
        if(texPixels[idx+3]>128){
          const di=(py*W+px)*4;
          pix[di]=texPixels[idx];pix[di+1]=texPixels[idx+1];pix[di+2]=texPixels[idx+2];pix[di+3]=255;
        }
      }
    }
  }
  ctx.putImageData(out,0,0);
}

function startSkinViewer(canvas, img, modelType) {
  stopSkinViewer();
  sv={canvas,ctx:canvas.getContext('2d'),img,yaw:0.6,pitch:-0.3,slim:modelType==='slim',dragging:false,lx:0,ly:0,autoRotate:true};
  sv.ctx.imageSmoothingEnabled=false;

  function onDown(e) {
    const r=canvas.getBoundingClientRect();
    sv.dragging=true;sv.autoRotate=false;
    sv.lx=(e.clientX||e.touches[0].clientX)-r.left;
    sv.ly=(e.clientY||e.touches[0].clientY)-r.top;
  }
  function onMove(e) {
    if(!sv.dragging)return;e.preventDefault();
    const r=canvas.getBoundingClientRect();
    const cx=(e.clientX||e.touches[0].clientX)-r.left;
    const cy=(e.clientY||e.touches[0].clientY)-r.top;
    sv.yaw+=(cx-sv.lx)*0.01;sv.pitch+=(cy-sv.ly)*0.01;
    sv.pitch=Math.max(-1.2,Math.min(1.2,sv.pitch));
    sv.lx=cx;sv.ly=cy;
  }
  function onUp() {sv.dragging=false;setTimeout(()=>sv.autoRotate=true,3000);}

  canvas.addEventListener('mousedown',onDown);
  window.addEventListener('mousemove',onMove);
  window.addEventListener('mouseup',onUp);
  canvas.addEventListener('touchstart',onDown,{passive:true});
  window.addEventListener('touchmove',onMove,{passive:false});
  window.addEventListener('touchend',onUp);

  function frame() {
    if (!sv) return;
    if (sv.autoRotate) { sv.yaw += 0.008; }
    renderSkin3D(sv.ctx, canvas.width, canvas.height, sv.img, sv.yaw, sv.pitch, sv.slim);
    svAnimId = requestAnimationFrame(frame);
  }
  frame();

  sv._cleanup=()=>{
    canvas.removeEventListener('mousedown',onDown);
    window.removeEventListener('mousemove',onMove);
    window.removeEventListener('mouseup',onUp);
    canvas.removeEventListener('touchstart',onDown);
    window.removeEventListener('touchmove',onMove);
    window.removeEventListener('touchend',onUp);
  };
}

function stopSkinViewer() {
  if (svAnimId) { cancelAnimationFrame(svAnimId); svAnimId = null; }
  if (sv) { if (sv._cleanup) sv._cleanup(); sv = null; }
}

function loadSkinToPreview(skinName, base64Data) {
  const canvas = $('skin-preview-canvas');
  if (!canvas) return;
  $('skin-current-name').textContent = skinName === 'default' ? 'Default' : skinName;

  if (!base64Data || skinName === 'default') {
    stopSkinViewer();
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const grad = ctx.createRadialGradient(W/2, H - 12, 2, W/2, H - 12, 55);
    grad.addColorStop(0, 'rgba(0,0,0,0.5)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse(W/2, H - 8, 55, 10, 0, 0, Math.PI*2); ctx.fill();
    const slim = skinModelType === 'slim';
    const w = slim ? 3 : 4, s = 8;
    const ax = (W - (w*s + 8 + 8*s + 8 + w*s))/2, ay = (H - (64 + 8 + 96 + 8 + 96))/2 - 8;
    const bx = ax + w*s + 8;
    ctx.fillStyle = '#4a4a6a'; ctx.fillRect(bx, ay, 8*s, 8*s);
    ctx.fillStyle = '#5a5a7a'; ctx.fillRect(bx, ay + 8*s + 8, 8*s, 12*s);
    ctx.fillStyle = '#3a3a5a'; ctx.fillRect(ax, ay + 8*s + 8, w*s, 12*s); ctx.fillRect(bx + 8*s + 8, ay + 8*s + 8, w*s, 12*s);
    ctx.fillStyle = '#4a4a6a'; ctx.fillRect(bx, ay + 8*s + 8 + 12*s + 8, 4*s, 12*s); ctx.fillRect(bx + 4*s + 8, ay + 8*s + 8 + 12*s + 8, 4*s, 12*s);
    return;
  }

  const img = new Image();
  img.onload = () => {
    startSkinViewer(canvas, img, skinModelType);
  };
  img.src = 'data:image/png;base64,' + base64Data;
}

function renderSkinList() {
  const list = $('skin-list');
  const typeEl = $('skin-account-type');
  const active = accounts.find((a) => a.id === activeAccountId);
  if (typeEl) {
    typeEl.textContent = active?.type === 'microsoft'
      ? 'Changes apply to your Minecraft account via Mojang API'
      : 'Skins saved locally — use a skin mod to apply';
  }
  list.innerHTML = '';

  const defaultItem = document.createElement('div');
  defaultItem.className = 'skin-list-item' + (activeSkinName === 'default' ? ' active' : '');
  defaultItem.innerHTML = `<div style="width:32px;height:32px;border-radius:6px;background:var(--bg-deep);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="16" height="16" fill="var(--text-muted)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg></div><span class="skin-list-name">Default</span>`;
  defaultItem.onclick = () => {
    activeSkinName = 'default';
    loadSkinToPreview('default', null);
    renderSkinList();
  };
  list.appendChild(defaultItem);

  currentSkins.forEach((s) => {
    const el = document.createElement('div');
    el.className = 'skin-list-item' + (activeSkinName === s.name ? ' active' : '');
    el.innerHTML = `<img src="data:image/png;base64,${s.data}" alt=""><span class="skin-list-name">${s.name}</span><button class="skin-list-delete" data-name="${s.name}"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg></button>`;
    const nameSpan = el.querySelector('.skin-list-name');
    nameSpan.onclick = () => {
      activeSkinName = s.name;
      loadSkinToPreview(s.name, s.data);
      renderSkinList();
    };
    const deleteBtn = el.querySelector('.skin-list-delete');
    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      const result = await window.api.deleteSkin(s.name);
      if (result.success) {
        if (activeSkinName === s.name) {
          activeSkinName = 'default';
          loadSkinToPreview('default', null);
        }
        currentSkins = await window.api.getSavedSkins();
        renderSkinList();
      }
    };
    list.appendChild(el);
  });

  if (currentSkins.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'skin-list-empty';
    empty.textContent = 'No saved skins yet.\nUpload a PNG to get started.';
    list.appendChild(empty);
  }
}

$('sidebar-account-badge').onclick = () => {
  $('modal-skin-changer').classList.add('active');
  (async () => {
    currentSkins = await window.api.getSavedSkins();
    renderSkinList();
    const active = currentSkins.find((s) => s.name === activeSkinName);
    loadSkinToPreview(activeSkinName, active?.data);
  })();
};

$('skin-reset-btn').onclick = async () => {
  activeSkinName = 'default';
  loadSkinToPreview('default', null);
  renderSkinList();
  const active = accounts.find((a) => a.id === activeAccountId);
  if (active?.type === 'microsoft') {
    toast('Resetting skin...', 'Applying default via Mojang API');
    const apply = await window.api.applyMicrosoftSkin('default', 'classic');
    if (apply.success) toast('Skin reset', 'Default skin applied');
    else toast('Reset failed', apply.error, 'error');
  }
};

$('skin-upload-btn').onclick = () => $('skin-file-input').click();

$('skin-file-input').onchange = async function () {
  const file = this.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result.split(',')[1];
    const name = file.name.replace('.png', '').replace(/[^a-z0-9_]/gi, '_') || 'skin';
    const result = await window.api.saveSkinFile(name, base64);
    if (result.success) {
      activeSkinName = name;
      currentSkins = await window.api.getSavedSkins();
      renderSkinList();
      loadSkinToPreview(name, base64);
      const active = accounts.find((a) => a.id === activeAccountId);
      if (active?.type === 'microsoft') {
        toast('Applying skin...', 'Uploading to Mojang API');
        const apply = await window.api.applyMicrosoftSkin(result.path, skinModelType === 'slim' ? 'slim' : 'classic');
        if (apply.success) toast('Skin applied', 'Your Minecraft skin has been updated');
        else toast('Skin upload failed', apply.error, 'error');
      } else {
        toast('Skin saved', 'Saved locally. Use a skin mod to apply it.');
      }
    } else {
      toast('Error', result.error, 'error');
    }
  };
  reader.readAsDataURL(file);
  this.value = '';
};

$('skin-model-classic').onclick = () => {
  skinModelType = 'classic';
  document.querySelectorAll('.model-btn').forEach((b) => b.classList.remove('active'));
  $('skin-model-classic').classList.add('active');
  if (sv && sv.img) { startSkinViewer($('skin-preview-canvas'), sv.img, skinModelType); }
  else { loadSkinToPreview(activeSkinName, null); }
};
$('skin-model-slim').onclick = () => {
  skinModelType = 'slim';
  document.querySelectorAll('.model-btn').forEach((b) => b.classList.remove('active'));
  $('skin-model-slim').classList.add('active');
  if (sv && sv.img) { startSkinViewer($('skin-preview-canvas'), sv.img, skinModelType); }
  else { loadSkinToPreview(activeSkinName, null); }
};

$('skin-namemc-btn').onclick = async () => {
  const input = $('skin-namemc-input');
  const username = input.value.trim();
  if (!username) return;
  const btn = $('skin-namemc-btn');
  btn.disabled = true;
  btn.textContent = '...';
  try {
    const result = await window.api.fetchNameMCSkin(username);
    if (result.success) {
      const name = result.name || username;
      const saveResult = await window.api.saveSkinFile(name, result.base64);
      if (saveResult.success) {
        if (result.model === 'slim') {
          skinModelType = 'slim';
          document.querySelectorAll('.model-btn').forEach((b) => b.classList.remove('active'));
          $('skin-model-slim').classList.add('active');
        } else {
          skinModelType = 'classic';
          document.querySelectorAll('.model-btn').forEach((b) => b.classList.remove('active'));
          $('skin-model-classic').classList.add('active');
        }
        activeSkinName = name;
        currentSkins = await window.api.getSavedSkins();
        renderSkinList();
        loadSkinToPreview(name, result.base64);
        toast('Skin fetched', `Loaded ${name}'s skin from NameMC`);
        input.value = '';
      } else {
        toast('Error', saveResult.error, 'error');
      }
    } else {
      toast('NameMC', result.error || 'Player not found', 'error');
    }
  } catch (err) {
    toast('Error', err.message, 'error');
  }
  btn.disabled = false;
  btn.textContent = 'Search';
};
$('skin-namemc-input').onkeydown = (e) => {
  if (e.key === 'Enter') $('skin-namemc-btn').click();
};

window.api.onMcDownloadProgress((p) => {
  const pc = $('progress-text');
  if (pc && p.status) pc.textContent = p.status;
  const fill = $('progress-fill');
  if (fill && p.percent) fill.style.width = `${p.percent}%`;
});

window.api.onJavaInstallProgress((p) => {
  const pct = $('java-dl-pct');
  if (pct) pct.textContent = `${p.percent}%`;
  const status = $('java-status');
  if (status && p.status) {
    status.innerHTML = `<span style="color:var(--accent)">&#9679;</span> ${p.status}`;
  }
  loadingStatus.textContent = p.status || 'Installing Java...';
  const fill = $('loading-java-fill');
  if (fill) fill.style.width = `${p.percent}%`;
  const detail = $('loading-detail');
  if (detail && p.status) detail.textContent = p.status;
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
