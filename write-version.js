const fs = require('fs');
const path = require('path');
const pkg = require('./package.json');

const distDir = path.join(__dirname, 'dist');
let setupExe = '';
if (fs.existsSync(distDir)) {
  const files = fs.readdirSync(distDir).filter(f => f.endsWith('.exe') && f.includes('Setup'));
  if (files.length > 0) setupExe = path.resolve(distDir, files[0]);
}
const buildId = Date.now();
const manifest = { version: pkg.version, buildId, downloadUrl: setupExe, body: 'New build available' };

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
