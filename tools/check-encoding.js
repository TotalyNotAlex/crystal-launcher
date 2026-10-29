#!/usr/bin/env node
// Guards against mojibake: text that was UTF-8 but got decoded as Windows-1252
// and saved again (which turns em dashes and middle dots into multi-character
// garbage). Run with: npm run check:encoding
const fs = require('fs');
const path = require('path');

const CP1252_TO_BYTE = new Map(Object.entries({
  '\u20AC': 0x80, '\u201A': 0x82, '\u0192': 0x83, '\u201E': 0x84, '\u2026': 0x85,
  '\u2020': 0x86, '\u2021': 0x87, '\u02C6': 0x88, '\u2030': 0x89, '\u0160': 0x8A,
  '\u2039': 0x8B, '\u0152': 0x8C, '\u017D': 0x8E, '\u2018': 0x91, '\u2019': 0x92,
  '\u201C': 0x93, '\u201D': 0x94, '\u2022': 0x95, '\u2013': 0x96, '\u2014': 0x97,
  '\u02DC': 0x98, '\u2122': 0x99, '\u0161': 0x9A, '\u203A': 0x9B, '\u0153': 0x9C,
  '\u017E': 0x9E, '\u0178': 0x9F,
}));

function byteFor(ch) {
  if (CP1252_TO_BYTE.has(ch)) return CP1252_TO_BYTE.get(ch);
  const code = ch.codePointAt(0);
  return code <= 0xff ? code : null;
}

function looksMojibake(run) {
  const bytes = [];
  for (const ch of run) {
    const b = byteFor(ch);
    if (b === null) return false;
    bytes.push(b);
  }
  const decoded = Buffer.from(bytes).toString('utf8');
  return !decoded.includes('\uFFFD') && decoded !== run;
}

const ROOTS = ['main.js', 'preload.js', 'renderer.js', 'write-version.js', 'index.html', 'styles.css', 'lang', 'services', 'tools'];
const SKIP = /(^|[\\/])(node_modules|dist|\.dev-userdata|\.git)([\\/]|$)/;

function collect(target, out) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) {
      const full = path.join(target, entry);
      if (!SKIP.test(full)) collect(full, out);
    }
    return;
  }
  if (/\.(js|html|css|json)$/i.test(target)) out.push(target);
}

const files = [];
for (const root of ROOTS) {
  const full = path.join(__dirname, '..', root);
  if (fs.existsSync(full)) collect(full, files);
}

let bad = 0;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const hits = [];
  for (const match of text.matchAll(/[^\x00-\x7F]+/g)) {
    if (looksMojibake(match[0])) {
      const line = text.slice(0, match.index).split('\n').length;
      hits.push(`  ${path.relative(path.join(__dirname, '..'), file)}:${line}  "${match[0]}"`);
    }
  }
  if (hits.length) {
    bad += hits.length;
    console.error(`Mojibake in ${path.relative(path.join(__dirname, '..'), file)}:`);
    hits.slice(0, 5).forEach((h) => console.error(h));
  }
}

if (bad) {
  console.error(`\n${bad} verdächtige Stelle(n) gefunden.`);
  process.exit(1);
}
console.log(`Encoding OK (${files.length} Dateien geprüft).`);
