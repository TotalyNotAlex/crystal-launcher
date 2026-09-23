const fs = require('fs');
const path = require('path');
const pkg = require('./package.json');

const distDir = path.join(__dirname, 'dist');
let setupExe = '';
let matchMethod = 'none';
if (fs.existsSync(distDir)) {
  const files = fs.readdirSync(distDir).filter(f => f.endsWith('.exe') && f.includes('Setup'));
  const match = files.find(f => f.includes(pkg.version));
  if (match) {
    setupExe = path.resolve(distDir, match);
    matchMethod = 'exact';
  } else if (files.length > 0) {
    const newest = files
      .map(f => ({ f, mtime: fs.statSync(path.join(distDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)[0];
    setupExe = path.resolve(distDir, newest.f);
    matchMethod = 'fallback-newest';
    console.warn(`WARN: No Setup exe for ${pkg.version} found; using newest: ${newest.f}`);
  }
}
if (matchMethod === 'none') {
  console.error(`ERROR: No Setup exe in dist/ for version ${pkg.version}. Run npm run build first.`);
  process.exit(1);
}
if (matchMethod === 'exact' && !setupExe.includes(pkg.version)) {
  console.error(`ERROR: downloadUrl does not match version ${pkg.version}: ${setupExe}`);
  process.exit(1);
}

const buildId = Date.now();
const manifest = { version: pkg.version, buildId, downloadUrl: setupExe, body: 'New build available' };
console.log(`Manifest: version=${manifest.version} downloadUrl=${setupExe}`);

const targets = [
  path.join(process.env.APPDATA, 'crystal-launcher', '.crystall'),
  path.join(process.env.APPDATA, 'Crystal Launcher', '.crystall'),
  path.join(process.env.APPDATA, 'com.crystalllauncher.app', '.crystall'),
  path.join(process.env.APPDATA, 'Electron', '.crystall'),
];
targets.forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'latest-version.json'), JSON.stringify(manifest, null, 2));
  console.log('Version manifest written to', path.join(dir, 'latest-version.json'));
});
