// Lossless PNG re-compression (A16). Pixels are never resampled, quantised or colour-converted.
//   node scripts/perf/optimizePng.mjs                      # dry run: writes optimised copies to scripts/perf/out/png/, verifies, reports
//   node scripts/perf/optimizePng.mjs --write              # additionally replaces the originals, ONLY if decoded RGBA is byte-identical
//   node scripts/perf/optimizePng.mjs path/a.png path/b.png  # explicit files (default: assets/generated/*.png)
// Verification: decode original and candidate to raw RGBA (same width/height) and compare Buffers. A mismatch aborts that file.
// Palette (8-bit indexed) output is attempted only when the image has <= 256 unique RGBA colours, so it is exact by construction
// (and still verified). Images with more colours stay truecolour RGBA with compressionLevel 9 with adaptive filtering.
// NOTE: do NOT pass `effort` to sharp's png(): any effort value silently switches on palette quantisation (lossy) - verified to change pixels.
// A pixel that differs only in the RGB of fully transparent texels is reported but still rejected unless --allow-invisible is passed.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'scripts/perf/out/png');
const write = process.argv.includes('--write');
const allowInvisible = process.argv.includes('--allow-invisible');
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const gen = path.join(ROOT, 'assets/generated');
const targets = files.length ? files.map((f) => path.resolve(f)) : fs.readdirSync(gen).filter((f) => f.endsWith('.png')).map((f) => path.join(gen, f));
fs.mkdirSync(OUT, { recursive: true });

const decode = async (input) => {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};

let saved = 0;
for (const file of targets) {
  const orig = fs.readFileSync(file);
  const a = await decode(orig);
  const colours = new Set();
  for (let i = 0; i < a.data.length; i += 4) colours.add(a.data.readUInt32LE(i));
  const base = { compressionLevel: 9, adaptiveFiltering: true };
  const candidates = [{ name: 'rgba+adaptive', opts: base }, { name: 'rgba', opts: { compressionLevel: 9 } }];
  if (colours.size <= 256) candidates.push({ name: 'palette', opts: { ...base, palette: true, colours: 256, dither: 0, quality: 100 } });
  let best = null;
  for (const c of candidates) {
    const buf = await sharp(a.data, { raw: { width: a.w, height: a.h, channels: 4 } }).png(c.opts).toBuffer();
    const b = await decode(buf);
    let same = b.w === a.w && b.h === a.h && Buffer.compare(a.data, b.data) === 0;
    if (!same && b.w === a.w && b.h === a.h) {
      let visible = 0, invisible = 0;
      for (let i = 0; i < a.data.length; i += 4) {
        if (a.data.readUInt32LE(i) === b.data.readUInt32LE(i)) continue;
        if (a.data[i + 3] === 0 && b.data[i + 3] === 0) invisible++; else visible++;
      }
      console.log(`  ${c.name}: differs (${visible} visible px, ${invisible} transparent-only px)`);
      if (visible === 0 && allowInvisible) same = true;
    }
    if (!same) { console.log(`  ${c.name}: NOT byte-identical, rejected`); continue; }
    if (!best || buf.length < best.buf.length) best = { name: c.name, buf };
  }
  const rel = path.relative(ROOT, file);
  if (!best || best.buf.length >= orig.length) { console.log(`${rel}: ${orig.length} B - no lossless gain, left alone`); continue; }
  const outFile = path.join(OUT, path.basename(file));
  fs.writeFileSync(outFile, best.buf);
  saved += orig.length - best.buf.length;
  console.log(`${rel}: ${orig.length} -> ${best.buf.length} B (${((1 - best.buf.length / orig.length) * 100).toFixed(1)}% smaller, ${best.name}, ${colours.size} colours, pixels identical)`);
  if (write) { fs.writeFileSync(file, best.buf); console.log('  replaced original'); }
}
console.log(`\ntotal saved: ${(saved / 1024).toFixed(0)} KB${write ? '' : ' (dry run, originals untouched; copies in scripts/perf/out/png)'}`);
