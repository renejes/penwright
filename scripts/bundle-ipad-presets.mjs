/**
 * Packs the text of every bundled preset into one JSON file the iPad app can
 * write out. Thumbnails stay behind — the iPad does not render them.
 * Run: node scripts/bundle-ipad-presets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const presetsDir = path.join(root, 'resources/presets');
const outFile = path.join(root, 'src/ipad/bundledPresets.json');

const TEXT = new Set([
  '.typ', '.bib', '.json', '.md', '.txt', '.yml', '.yaml', '.toml', '.svg', '.css',
]);

function walk(dir, prefix, files) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'thumbnail.png' || name === 'thumbnail.jpg' || name === 'thumbnail.webp') continue;
    if (name === 'preset.json') continue;
    const abs = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      walk(abs, rel, files);
      continue;
    }
    if (!TEXT.has(path.extname(name).toLowerCase())) continue;
    files[rel] = fs.readFileSync(abs, 'utf8');
  }
}

const presets = [];
for (const id of fs.readdirSync(presetsDir).sort()) {
  const dir = path.join(presetsDir, id);
  if (!fs.statSync(dir).isDirectory()) continue;
  const manifestPath = path.join(dir, 'preset.json');
  if (!fs.existsSync(manifestPath)) continue;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const files = {};
  walk(dir, '', files);
  presets.push({ id: manifest.id || id, manifest, files });
}

fs.writeFileSync(outFile, JSON.stringify({ presets }));
const bytes = fs.statSync(outFile).size;
console.log(`bundled ${presets.length} presets, ${(bytes / 1024).toFixed(0)} KB`);
