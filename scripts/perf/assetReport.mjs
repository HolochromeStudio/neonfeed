// Asset / texture-memory report (A16). Read-only.
//   node scripts/perf/assetReport.mjs
// For every atlas in assets/generated: pixel size, power-of-two?, frame count, packing efficiency,
// GPU memory estimate (w*h*4, no mipmaps - Phaser pixelArt), compressed PNG size, unique colours.
// Then a per-scene texture-memory estimate built from which atlases each scene loads (see docs/PERFORMANCE.md).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = path.join(ROOT, 'assets/generated');
const pow2 = (n) => n > 0 && (n & (n - 1)) === 0;
const nextPow2 = (n) => 2 ** Math.ceil(Math.log2(n));
const mb = (b) => (b / 1048576).toFixed(2);
const atlases = {};

for (const f of fs.readdirSync(DIR).filter((n) => n.endsWith('_atlas.png'))) {
  const name = f.replace('_atlas.png', '');
  const png = path.join(DIR, f);
  const { width: w, height: h } = await sharp(png).metadata();
  const raw = await sharp(png).ensureAlpha().raw().toBuffer();
  const colours = new Set();
  for (let i = 0; i < raw.length; i += 4) colours.add(raw.readUInt32LE(i));
  const json = JSON.parse(fs.readFileSync(path.join(DIR, `${name}_atlas.json`), 'utf8'));
  const frames = Array.isArray(json.frames) ? json.frames : Object.values(json.frames);
  const area = frames.reduce((s, fr) => s + fr.frame.w * fr.frame.h, 0);
  const gpu = w * h * 4;
  atlases[name] = { w, h, gpu };
  console.log(`${name}: ${w}x${h} pow2=${pow2(w) && pow2(h)} frames=${frames.length} packing=${((area / (w * h)) * 100).toFixed(1)}% ` +
    `gpu=${mb(gpu)} MB (pot-padded ${nextPow2(w)}x${nextPow2(h)} would be ${mb(nextPow2(w) * nextPow2(h) * 4)} MB) png=${(fs.statSync(png).size / 1024).toFixed(0)} KB uniqueColours=${colours.size}`);
}

// What each scene loads: UiScene.preload -> loadUiAtlases (town + placeholder); DuelScene.preload -> placeholder + town.
// Both are guarded by textures.exists(), so each atlas is decoded/uploaded once per page and shared by every scene.
const loads = {
  MainMenu: ['town', 'placeholder'], RunMap: ['town', 'placeholder'], Reward: ['town', 'placeholder'], Shop: ['town', 'placeholder'],
  Results: ['town', 'placeholder'], Choice: ['town', 'placeholder'], Settings: ['town', 'placeholder'], Duel: ['town', 'placeholder'],
};
console.log('\nscene            atlases (GPU MB)            first-visit cost   (resident after, shared)');
for (const [scene, list] of Object.entries(loads)) {
  const b = list.reduce((s, n) => s + (atlases[n]?.gpu ?? 0), 0);
  console.log(scene.padEnd(16), list.map((n) => `${n} ${mb(atlases[n]?.gpu ?? 0)}`).join(' + ').padEnd(30), `${mb(b)} MB`);
}
const total = Object.values(atlases).reduce((s, a) => s + a.gpu, 0);
console.log(`\nresident atlas total once everything is loaded: ${mb(total)} MB (+ ~0.1-0.5 MB of PixelText canvases, + 360x640x4 = ${mb(360 * 640 * 4)} MB backbuffer)`);
