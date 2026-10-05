// Asset pipeline: slices every configured source sheet in assets/source/ into per-sprite PNGs,
// a catalogue and a Phaser JSON-hash atlas. Idempotent and deterministic (no timestamps).
//   npm run assets            process all sheets whose source file exists
//   npm run assets -- town    process only the sheet with id "town"
// Config: assets/source/sheets.json (see docs/ASSETS.md).
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadSheet, sampleBackground, buildForeground, detectSprites, matchAnchor,
  extractRGBA, groupRows, findSource,
} from './sliceSprites.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'assets');
const SRC = path.join(ASSETS, 'source');
const GEN = path.join(ASSETS, 'generated');
const PADDING = 2;
const MAX_ATLAS = 2048;
const HALO_TOL = 40;

const cfg = JSON.parse(fs.readFileSync(path.join(SRC, 'sheets.json'), 'utf8'));
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const errors = []; const warnings = [];
fs.mkdirSync(GEN, { recursive: true });

const cataloguePath = path.join(GEN, 'catalogue.json');
let catalogue = {};
try { catalogue = JSON.parse(fs.readFileSync(cataloguePath, 'utf8')); } catch { /* first run */ }

const pngOpts = { compressionLevel: 9, adaptiveFiltering: false, palette: false };
const awaiting = [];
const report = { sheets: {}, odd: [], failures: [] };

function shelfPack(items) {
  // items: [{name,w,h}] -> {w,h,pos:{name:{x,y}}}; tries a few widths and keeps the smallest area.
  const sorted = [...items].sort((a, b) => b.h - a.h || b.w - a.w || (a.name < b.name ? -1 : 1));
  let best = null;
  for (const width of [256, 384, 512, 640, 768, 1024, 1280, 1536, 2048]) {
    const pos = {}; let x = PADDING, y = PADDING, rowH = 0, maxW = 0, ok = true;
    for (const it of sorted) {
      if (it.w + PADDING * 2 > width) { ok = false; break; }
      if (x + it.w + PADDING > width) { x = PADDING; y += rowH + PADDING; rowH = 0; }
      pos[it.name] = { x, y }; x += it.w + PADDING; rowH = Math.max(rowH, it.h); maxW = Math.max(maxW, x);
    }
    if (!ok) continue;
    const h = y + rowH + PADDING;
    if (h > MAX_ATLAS) continue;
    const area = width * h;
    if (!best || area < best.area) best = { w: width, h, pos, area };
  }
  if (!best) throw new Error('atlas does not fit in ' + MAX_ATLAS);
  return best;
}

const bgOf = (sheet, c) => c.bg ?? sampleBackground(sheet);

async function validatePng(file, bg, meta) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const out = { ok: true, notes: [] };
  const { width: w, height: h, channels } = info;
  if (channels !== 4) { out.ok = false; out.notes.push('no alpha channel'); return out; }
  let transparent = 0, halo = 0, bgExact = 0;
  const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : data[(y * w + x) * 4 + 3]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    if (!data[o + 3]) { transparent++; continue; }
    const d = Math.abs(data[o] - bg[0]) + Math.abs(data[o + 1] - bg[1]) + Math.abs(data[o + 2] - bg[2]);
    if (d <= 8) bgExact++;
    if (d <= HALO_TOL && (!A(x - 1, y) || !A(x + 1, y) || !A(x, y - 1) || !A(x, y + 1))) halo++;
  }
  const cov = 1 - transparent / (w * h);
  if (!transparent) { out.notes.push('no transparent pixels (fully opaque rect)'); out.opaque = true; }
  if (halo) { out.ok = false; out.notes.push(`${halo} background-coloured halo pixels`); }
  if (bgExact) out.notes.push(`${bgExact} opaque bg-coloured interior px (kept)`);
  out.coverage = +cov.toFixed(3);
  return out;
}

function oddReasons(name, w, h, coverage, category) {
  const r = [];
  if (w < 12 || h < 12) r.push('tiny (<12px)');
  if (w > 256 || h > 256) r.push('large (>256px)');
  if (Math.max(w / h, h / w) > 5) r.push('extreme aspect ratio');
  if (coverage < 0.12) r.push(`sparse alpha coverage ${coverage}`);
  return r;
}

async function processSheet(sc) {
  const file = findSource(SRC, sc.source);
  if (!file) { awaiting.push(sc); console.log(`[${sc.id}] source "${sc.source}.*" not found in assets/source -> awaiting source file`); return; }
  const sheet = await loadSheet(file);
  const bg = bgOf(sheet, sc);
  const fg = buildForeground(sheet, bg, sc.bgOptions);
  const { sprites: found, dropped } = detectSprites(sheet, fg, sc);
  // variant that keeps enclosed bg-coloured pixels (for sprites flagged keepHoles, e.g. white clapboard)
  let fgKeep = null;
  const mode = sc.mode ?? 'auto';
  const named = []; // {name, category, dir, box}

  if (mode === 'named') {
    const used = new Set();
    for (const e of sc.sprites ?? []) {
      const m = matchAnchor(found, e.at);
      if (!m) { errors.push(`[${sc.id}] ${e.name}: no component at anchor ${e.at}`); continue; }
      if (used.has(m)) { errors.push(`[${sc.id}] ${e.name}: component ${m.x},${m.y} already claimed`); continue; }
      used.add(m); named.push({ name: e.name, category: e.category ?? sc.category ?? 'misc', dir: e.dir ?? sc.dir ?? 'props', box: m, keepHoles: !!e.keepHoles });
    }
    for (const m of found) if (!used.has(m)) warnings.push(`[${sc.id}] unnamed component at ${m.x},${m.y} ${m.w}x${m.h} (add to sheets.json or raise minArea)`);
  } else if (mode === 'characters') {
    const rows = groupRows(found, sc.rowTolerance ?? 0.6);
    const defs = sc.rows ?? [];
    if (rows.length !== defs.length) warnings.push(`[${sc.id}] detected ${rows.length} rows but config lists ${defs.length}`);
    rows.forEach((row, ri) => {
      const def = defs[ri];
      if (!def) { warnings.push(`[${sc.id}] row ${ri} (${row.length} frames) has no config entry; skipped`); return; }
      if (row.length !== def.frames.length) warnings.push(`[${sc.id}] row ${ri} "${def.name}": ${row.length} frames detected, ${def.frames.length} named`);
      row.forEach((box, fi) => {
        const frame = def.frames[fi] ?? `f${fi}`;
        named.push({ name: `${def.name}_${frame}`, category: 'character', dir: sc.dir ?? 'sprites', box, character: def.name, frame });
      });
    });
  } else {
    found.forEach((box, i) => named.push({ name: `${sc.id}_${String(i).padStart(3, '0')}`, category: sc.category ?? 'misc', dir: sc.dir ?? 'props', box }));
  }

  // Remove this sheet's previous outputs (idempotent re-run), keep other sheets' entries.
  for (const [n, e] of Object.entries(catalogue)) {
    if (e.sheet !== sc.id) continue;
    try { fs.unlinkSync(path.join(ROOT, e.file)); } catch { /* already gone */ }
    delete catalogue[n];
  }

  const atlasItems = []; const sheetEntries = [];
  const seenNames = new Set();
  for (const n of named) {
    if (seenNames.has(n.name)) { errors.push(`[${sc.id}] duplicate name ${n.name}`); continue; }
    seenNames.add(n.name);
    const box = n.keepHoles ? { ...n.box, pixels: null } : n.box;
    let useFg = fg;
    if (n.keepHoles) useFg = fgKeep ??= buildForeground(sheet, bg, { ...(sc.bgOptions ?? {}), clearHoles: false });
    const ex = extractRGBA(sheet, useFg, box, bg, sc.defringe);
    if (!ex) { errors.push(`[${sc.id}] ${n.name}: empty after extraction`); continue; }
    const rel = path.join('assets', n.dir, `${n.name}.png`);
    const abs = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    await sharp(ex.rgba, { raw: { width: ex.w, height: ex.h, channels: 4 } }).png(pngOpts).toFile(abs);
    const entry = { x: ex.x, y: ex.y, w: ex.w, h: ex.h, category: n.category, sheet: sc.id, file: rel.split(path.sep).join('/'), atlas: sc.atlas ?? null };
    if (n.character) { entry.character = n.character; entry.frame = n.frame; }
    sheetEntries.push([n.name, entry, ex]);
    atlasItems.push({ name: n.name, w: ex.w, h: ex.h, rgba: ex.rgba });
  }

  // Atlas
  if (atlasItems.length && sc.atlas) {
    const pk = shelfPack(atlasItems);
    const frames = {};
    const comps = atlasItems.map((it) => ({
      input: it.rgba && sharp(it.rgba, { raw: { width: it.w, height: it.h, channels: 4 } }).png().toBuffer(),
      it,
    }));
    const inputs = [];
    for (const c of comps) inputs.push({ input: await c.input, left: pk.pos[c.it.name].x, top: pk.pos[c.it.name].y });
    await sharp({ create: { width: pk.w, height: pk.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(inputs).png(pngOpts).toFile(path.join(GEN, `${sc.atlas}.png`));
    for (const it of [...atlasItems].sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = pk.pos[it.name];
      frames[it.name] = {
        frame: { x: p.x, y: p.y, w: it.w, h: it.h }, rotated: false, trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: it.w, h: it.h }, sourceSize: { w: it.w, h: it.h },
      };
    }
    const json = { frames, meta: { app: 'neonfeed/scripts/processAssets.mjs', version: '1.0', image: `${sc.atlas}.png`, format: 'RGBA8888', size: { w: pk.w, h: pk.h }, scale: '1' } };
    fs.writeFileSync(path.join(GEN, `${sc.atlas}.json`), JSON.stringify(json, null, 1) + '\n');
    console.log(`[${sc.id}] atlas ${sc.atlas}.png ${pk.w}x${pk.h} (${atlasItems.length} frames)`);
  }

  // Validation
  let bad = 0;
  for (const [name, entry, ex] of sheetEntries) {
    const v = await validatePng(path.join(ROOT, entry.file), bg, entry);
    const odd = oddReasons(name, ex.w, ex.h, v.coverage ?? 1, entry.category);
    if (!v.ok) { bad++; errors.push(`[${sc.id}] ${name}: ${v.notes.join('; ')}`); }
    if (odd.length) report.odd.push({ name, size: `${ex.w}x${ex.h}`, reasons: odd });
    catalogue[name] = entry;
  }
  report.sheets[sc.id] = { source: path.relative(ROOT, file), bg, sprites: sheetEntries.length, dropped: dropped.length, validationFailures: bad };
  console.log(`[${sc.id}] ${sheetEntries.length} sprites, bg=${bg.join(',')}, dropped ${dropped.length} (labels/specks), validation failures ${bad}`);
}

for (const sc of cfg.sheets) {
  if (only.length && !only.includes(sc.id)) continue;
  await processSheet(sc);
}

const sorted = Object.fromEntries(Object.entries(catalogue).sort(([a], [b]) => (a < b ? -1 : 1)));
fs.writeFileSync(cataloguePath, JSON.stringify(sorted, null, 1) + '\n');
report.awaiting = awaiting.map((s) => s.source);
report.odd.sort((a, b) => (a.name < b.name ? -1 : 1));
fs.writeFileSync(path.join(GEN, 'report.json'), JSON.stringify({ ...report, warnings, errors }, null, 1) + '\n');

for (const o of report.odd) console.log(`ODD SIZE ${o.name} ${o.size}: ${o.reasons.join(', ')}`);
for (const w of warnings) console.warn('WARN', w);
for (const e of errors) console.error('ERROR', e);
console.log(errors.length ? `FAILED with ${errors.length} error(s)` : 'assets OK');
process.exit(errors.length ? 1 : 0);
