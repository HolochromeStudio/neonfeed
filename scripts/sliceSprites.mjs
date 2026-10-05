// Generic sprite-sheet slicing helpers (no resampling, original pixels only).
// Used by scripts/processAssets.mjs; can also be run directly to preview detection:
//   node scripts/sliceSprites.mjs <sheetId>      (lists detected components with bboxes)
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const L1 = (r, g, b, c) => Math.abs(r - c[0]) + Math.abs(g - c[1]) + Math.abs(b - c[2]);

export async function loadSheet(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height };
}

/** Background colour = median of the 4 corners + edge midpoints (robust to AI/webp noise). */
export function sampleBackground(sheet) {
  const { data, W, H } = sheet;
  const pts = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3], [W >> 1, 2], [W >> 1, H - 3], [2, H >> 1], [W - 3, H >> 1]];
  const ch = [0, 1, 2].map((k) => pts.map(([x, y]) => data[(y * W + x) * 4 + k]).sort((a, b) => a - b)[pts.length >> 1]);
  return ch;
}

/**
 * True-alpha mask: flood fill from the sheet border through pixels within `tol` (L1) of bg.
 * Returns Uint8Array fg (1 = sprite pixel). Enclosed bg-coloured regions are only cleared when
 * `clearHoles` and they are very close to bg (<= holeTol) and >= holeMin pixels, so interior
 * cream paint survives.
 */
export function buildForeground(sheet, bg, { tol = 36, clearHoles = true, holeTol = 8, holeMin = 8 } = {}) {
  const { data, W, H } = sheet;
  const N = W * H;
  const near = (p, t) => L1(data[p * 4], data[p * 4 + 1], data[p * 4 + 2], bg) <= t;
  const fg = new Uint8Array(N).fill(1);
  const stack = [];
  const seed = (p) => { if (fg[p] && near(p, tol)) { fg[p] = 0; stack.push(p); } };
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
  while (stack.length) {
    const p = stack.pop(); const x = p % W;
    if (x > 0) seed(p - 1);
    if (x < W - 1) seed(p + 1);
    if (p >= W) seed(p - W);
    if (p < N - W) seed(p + W);
  }
  if (clearHoles) {
    const seen = new Uint8Array(N);
    for (let s = 0; s < N; s++) {
      if (!fg[s] || seen[s] || !near(s, holeTol)) continue;
      const comp = [s]; seen[s] = 1;
      for (let i = 0; i < comp.length; i++) {
        const p = comp[i]; const x = p % W;
        for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
          if (q < 0 || q >= N || seen[q] || !fg[q] || !near(q, holeTol)) continue;
          seen[q] = 1; comp.push(q);
        }
      }
      if (comp.length >= holeMin) for (const p of comp) fg[p] = 0;
    }
  }
  return fg;
}

/** Connected components of fg after dilating by R (merges anti-aliased/dithered fragments). */
export function findComponents(fg, W, H, { dilate = 3, restrictTo = null } = {}) {
  const N = W * H;
  const dil = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (!fg[p] || (restrictTo && !restrictTo[p])) continue;
    for (let dy = -dilate; dy <= dilate; dy++) for (let dx = -dilate; dx <= dilate; dx++) {
      const a = x + dx, b = y + dy;
      if (a < 0 || b < 0 || a >= W || b >= H) continue;
      const q = b * W + a;
      if (!restrictTo || restrictTo[q]) dil[q] = 1;
    }
  }
  const label = new Int32Array(N);
  const comps = [];
  for (let s = 0; s < N; s++) {
    if (!dil[s] || label[s]) continue;
    const id = comps.length + 1;
    const st = [s]; label[s] = id;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, area = 0;
    while (st.length) {
      const p = st.pop(); const x = p % W, y = (p / W) | 0;
      if (fg[p] && (!restrictTo || restrictTo[p])) {
        area++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
        if (q < 0 || q >= N || !dil[q] || label[q]) continue;
        label[q] = id; st.push(q);
      }
    }
    if (area) comps.push({ id, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, area });
  }
  return { comps, label };
}

export function detectSprites(sheet, fg, cfg) {
  const { W, H } = sheet;
  const { comps, label } = findComponents(fg, W, H, { dilate: cfg.dilate ?? 3 });
  const bands = cfg.labelBands ?? [];
  const minArea = cfg.minArea ?? 40;
  const out = []; const dropped = [];
  for (const c of comps) {
    const inBand = bands.some(([a, b]) => c.y >= a && c.y + c.h - 1 <= b);
    if (inBand) { dropped.push({ ...c, why: 'label' }); continue; }
    if (c.area < minArea) { dropped.push({ ...c, why: 'speck' }); continue; }
    out.push(c);
  }
  // Split merged components (explicit anchors): re-label with a tighter dilation inside the component.
  const splitPts = cfg.split ?? [];
  const final = [];
  for (const c of out) {
    const hit = splitPts.some(([px, py]) => px >= c.x && px < c.x + c.w && py >= c.y && py < c.y + c.h);
    if (!hit) { final.push(c); continue; }
    const only = new Uint8Array(W * H);
    for (let i = 0; i < only.length; i++) only[i] = label[i] === c.id ? 1 : 0;
    const sub = findComponents(fg, W, H, { dilate: cfg.splitDilate ?? 1, restrictTo: only });
    for (const s of sub.comps) {
      if (s.area < minArea) { dropped.push({ ...s, why: 'speck' }); continue; }
      final.push({ ...s, split: true });
    }
  }
  return { sprites: final.sort((a, b) => a.y - b.y || a.x - b.x), dropped };
}

/** Pick the smallest detected bbox containing the anchor point. */
export function matchAnchor(sprites, [px, py]) {
  let best = null;
  for (const s of sprites) {
    if (px >= s.x && px < s.x + s.w && py >= s.y && py < s.y + s.h && (!best || s.w * s.h < best.w * best.h)) best = s;
  }
  return best;
}

/** Strip cream fringe: opaque pixels bordering transparency that are still close to bg become transparent. */
export function defringe(rgba, w, h, bg, { tol = 48, passes = 2 } = {}) {
  for (let pass = 0; pass < passes; pass++) {
    const kill = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!rgba[p * 4 + 3]) continue;
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
        !rgba[(p - 1) * 4 + 3] || !rgba[(p + 1) * 4 + 3] || !rgba[(p - w) * 4 + 3] || !rgba[(p + w) * 4 + 3];
      if (edge && L1(rgba[p * 4], rgba[p * 4 + 1], rgba[p * 4 + 2], bg) <= tol) kill.push(p);
    }
    if (!kill.length) break;
    for (const p of kill) rgba[p * 4 + 3] = 0;
  }
}

/** Crop a component's pixels (only its own label/area) into RGBA with binary alpha; then tight-crop. */
export function extractRGBA(sheet, fg, box, bg, defringeOpts) {
  const { data, W } = sheet;
  const pad = 0;
  const w = box.w + pad * 2, h = box.h + pad * 2;
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = box.x + x, sy = box.y + y; const sp = sy * W + sx;
    if (!fg[sp]) continue;
    // belongs to this sprite only when the owning label matches (prevents neighbour bleed)
    if (box.owner && !box.owner(sp)) continue;
    const o = (y * w + x) * 4;
    rgba[o] = data[sp * 4]; rgba[o + 1] = data[sp * 4 + 1]; rgba[o + 2] = data[sp * 4 + 2]; rgba[o + 3] = 255;
  }
  if (defringeOpts !== false) defringe(rgba, w, h, bg, defringeOpts);
  // tight crop after defringe
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rgba[(y * w + x) * 4 + 3]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const tw = x1 - x0 + 1, th = y1 - y0 + 1;
  const out = Buffer.alloc(tw * th * 4);
  for (let y = 0; y < th; y++) rgba.copy(out, y * tw * 4, ((y + y0) * w + x0) * 4, ((y + y0) * w + x1 + 1) * 4);
  return { rgba: out, w: tw, h: th, x: box.x + x0, y: box.y + y0 };
}

/** Group sprites into rows by vertical centre (for character sheets), each row sorted left->right. */
export function groupRows(sprites, tol = 0.6) {
  const sorted = [...sprites].sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2));
  const rows = [];
  for (const s of sorted) {
    const cy = s.y + s.h / 2;
    const row = rows.find((r) => Math.abs(r.cy - cy) <= r.h * tol);
    if (row) { row.items.push(s); row.cy = row.items.reduce((a, i) => a + i.y + i.h / 2, 0) / row.items.length; row.h = Math.max(row.h, s.h); }
    else rows.push({ cy, h: s.h, items: [s] });
  }
  return rows.sort((a, b) => a.cy - b.cy).map((r) => r.items.sort((a, b) => a.x - b.x));
}

export function findSource(dir, base) {
  for (const ext of ['png', 'webp', 'jpg', 'jpeg']) {
    const f = path.join(dir, `${base}.${ext}`);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

// CLI preview
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const cfgAll = JSON.parse(fs.readFileSync(path.join(root, 'assets/source/sheets.json'), 'utf8'));
  const cfg = cfgAll.sheets.find((s) => s.id === process.argv[2]) ?? cfgAll.sheets[0];
  const file = findSource(path.join(root, 'assets/source'), cfg.source);
  if (!file) { console.error('source missing for', cfg.source); process.exit(1); }
  const sheet = await loadSheet(file);
  const bg = cfg.bg ?? sampleBackground(sheet);
  const fg = buildForeground(sheet, bg, cfg.bgOptions);
  const { sprites, dropped } = detectSprites(sheet, fg, cfg);
  console.log('bg', bg.join(','));
  sprites.forEach((s, i) => console.log(i, s.x, s.y, s.w, s.h, 'a=' + s.area, s.split ? 'split' : ''));
  console.log('dropped', dropped.length);
}
