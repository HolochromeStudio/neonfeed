import { Pen, mkCanvas, ctx2d, rng, shade, hexToRgb, rgbToHex, hashStr } from './pen';

export interface SpriteSpec {
  t: 'quad' | 'bird' | 'worm' | 'moth' | 'frog' | 'blob' | 'plant' | 'mech' | 'ghost' | 'hound';
  c: [string, string, string?];   // body, accent, glow
  s?: number;                       // stage 0..2 (size/complexity)
  g?: number;                       // glitch amount 0..1
  f?: string[];                     // feature flags
  seed?: number;
}
export const BS = 64;

type Ctx = { p: Pen; body: string; acc: string; glow: string; s: number; f: string[]; R: () => number };

function quad(k: Ctx, hound = false) {
  const { p, body, acc, glow, s, f } = k;
  const k1 = 1 + s * 0.14;
  const bx = 34, by = 41, rx = Math.round((hound ? 16 : 14) * k1), ry = Math.round((hound ? 8 : 9) * k1);
  // tail
  const tailC = f.includes('tail2') ? 2 : 1;
  for (let t = 0; t < tailC; t++) {
    const off = t * 5;
    p.line(bx + rx - 2, by - 2, bx + rx + 6, by - 10 - off, body); p.line(bx + rx - 2, by - 1, bx + rx + 6, by - 9 - off, body);
    p.line(bx + rx + 6, by - 10 - off, bx + rx + 9, by - 17 - off, body); p.line(bx + rx + 7, by - 10 - off, bx + rx + 10, by - 17 - off, acc);
    p.r(bx + rx + 8, by - 19 - off, 3, 3, glow);
  }
  // legs
  const ly = by + ry - 2;
  for (const lx of [bx - rx + 3, bx - rx + 8, bx + rx - 11, bx + rx - 6]) { p.r(lx, ly, 4, 59 - ly - 0, shade(body, -0.1)); p.r(lx - 1, 56, 6, 3, body); }
  // body
  p.ell(bx, by, rx, ry, body); p.ell(bx + 1, by + 3, rx - 3, ry - 4, shade(body, 0.1));
  if (f.includes('stripe')) for (let i = -2; i <= 2; i++) p.r(bx + i * 5, by - ry + 1, 2, 5, acc);
  if (f.includes('spikes')) for (let i = -3; i <= 2; i++) p.tri(bx + i * 4, by - ry + 1, bx + i * 4 + 2, by - ry - 5 - s * 2, bx + i * 4 + 4, by - ry + 1, acc);
  // head
  const hx = bx - rx + 2, hy = by - ry + (hound ? 0 : -2), hr = Math.round((hound ? 8 : 10) * (1 + s * 0.08));
  p.ell(hx, hy, hr, hr - 1, body); p.ell(hx - 1, hy + 2, hr - 3, hr - 4, shade(body, 0.12));
  if (hound) p.r(hx - hr - 4, hy, 8, 6, shade(body, -0.05)); // snout
  // ears
  const ea = f.includes('horns') ? acc : body;
  p.tri(hx - hr + 1, hy - 4, hx - hr + 4, hy - hr - 8 - s * 2, hx - 1, hy - hr + 2, ea); p.tri(hx + 2, hy - hr + 2, hx + hr - 3, hy - hr - 8 - s * 2, hx + hr - 1, hy - 3, ea);
  p.tri(hx - hr + 4, hy - hr + 1, hx - hr + 5, hy - hr - 4, hx - 3, hy - hr + 2, acc);
  if (f.includes('horns')) { p.tri(hx - 2, hy - hr, hx, hy - hr - 10, hx + 2, hy - hr, glow); }
  // eye
  p.r(hx - hr + 3, hy - 2, 4, 4, glow); p.r(hx - hr + 4, hy - 1, 1, 2, '#10142a');
  if (f.includes('eye2')) p.r(hx + 2, hy - 5, 3, 3, glow);
  p.r(hx - hr + 1, hy + 4, 5, 1, shade(body, -0.4));
}
function bird(k: Ctx) {
  const { p, body, acc, glow, s, f } = k;
  const k1 = 1 + s * 0.15;
  const bx = 34, by = 40, rx = Math.round(12 * k1), ry = Math.round(10 * k1);
  // tail feathers
  for (let i = 0; i < 2 + s; i++) p.line(bx + rx - 3, by + 2, bx + rx + 10 + s * 2, by - 2 + i * 4, i % 2 ? acc : glow);
  // legs
  p.r(bx - 4, by + ry - 1, 2, 59 - (by + ry), '#e8a838'); p.r(bx + 3, by + ry - 1, 2, 59 - (by + ry), '#e8a838'); p.r(bx - 7, 57, 6, 2, '#e8a838'); p.r(bx + 1, 57, 6, 2, '#e8a838');
  p.ell(bx, by, rx, ry, body); p.ell(bx - 2, by + 3, rx - 4, ry - 4, '#f4f4f8');
  // wing (misaligned frame: duplicated offset ghost wing)
  p.ell(bx + 4 + 3, by - 1 - 2, rx - 4, ry - 3, shade(acc, 0.1));
  p.ell(bx + 4, by - 1, rx - 4, ry - 3, acc);
  p.line(bx - 3, by - 2, bx + 10, by + 4, shade(acc, -0.2));
  if (f.includes('crest')) for (let i = 0; i < 3; i++) p.line(bx - rx + 6 + i * 2, by - ry - 2, bx - rx + 4 + i * 3, by - ry - 9 - s * 2, glow);
  if (f.includes('wings2')) { p.ell(bx + 2, by - 14 - s, rx - 3, 4, acc); p.ell(bx + 8, by - 16 - s, 7, 3, glow); }
  // head
  const hx = bx - rx + 2, hy = by - ry + 1, hr = Math.round(8 * (1 + s * 0.1));
  p.ell(hx, hy, hr, hr, body); p.ell(hx, hy + 2, hr - 2, hr - 3, '#f4f4f8');
  p.tri(hx - hr - 6, hy + 1, hx - hr + 1, hy - 3, hx - hr + 1, hy + 4, '#f0a828');
  p.r(hx - hr + 3, hy - 3, 3, 3, '#fff'); p.r(hx - hr + 3, hy - 2, 2, 2, '#10142a'); p.p(hx - hr + 4, hy - 3, glow);
}
function worm(k: Ctx) {
  const { p, body, acc, glow, s, R } = k;
  const n = 4 + s * 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1); pts.push([14 + t * 38, 46 - Math.sin(t * Math.PI * 1.4) * (12 + s * 3) + (i > n / 2 ? 6 : 0)]); }
  for (let i = n - 1; i >= 0; i--) {
    const r = Math.round((i === 0 ? 8 : 7 - Math.min(2, i * 0.4)) * (1 + s * 0.08));
    const off = k.f.includes('gaps') && i % 2 ? Math.round(R() * 3) : 0; // disconnected segment
    p.ell(pts[i][0], pts[i][1] + off, r, r, i % 2 ? acc : body);
    p.ell(pts[i][0] - 1, pts[i][1] - 2 + off, Math.max(1, r - 3), Math.max(1, r - 4), shade(i % 2 ? acc : body, 0.2));
    if (i > 0) p.r(pts[i][0] - 2, pts[i][1] + r - 2 + off, 4, 2, glow);
  }
  const [hx, hy] = pts[0];
  p.r(hx - 6, hy - 3, 6, 6, '#fff'); p.r(hx - 6, hy - 2, 3, 4, '#10142a'); p.p(hx - 5, hy - 3, glow);
  if (k.f.includes('horns')) { p.tri(hx - 2, hy - 7, hx, hy - 15, hx + 3, hy - 7, glow); }
  if (s >= 1) for (let i = 1; i < n; i += 2) p.tri(pts[i][0] - 2, pts[i][1] - 7, pts[i][0], pts[i][1] - 12 - s * 2, pts[i][0] + 2, pts[i][1] - 7, glow);
}
function moth(k: Ctx) {
  const { p, body, acc, glow, s } = k;
  const w = 15 + s * 3;
  p.ell(32 - w + 4, 30, w, 14 + s * 2, acc); p.ell(32 + w - 4, 30, w, 14 + s * 2, acc);
  p.ell(32 - w + 6, 44, w - 6, 8 + s, shade(acc, -0.1)); p.ell(32 + w - 6, 44, w - 6, 8 + s, shade(acc, -0.1));
  p.ell(32 - w + 4, 29, 5, 5, glow); p.ell(32 + w - 4, 29, 5, 5, glow); p.ell(32 - w + 4, 29, 2, 2, body); p.ell(32 + w - 4, 29, 2, 2, body);
  p.ell(32, 36, 5, 14, body); p.ell(32, 22, 6, 6, body);
  p.line(29, 17, 22, 6, shade(body, -0.2)); p.line(35, 17, 42, 6, shade(body, -0.2)); p.r(20, 4, 3, 3, glow); p.r(41, 4, 3, 3, glow);
  p.r(29, 21, 2, 2, '#fff'); p.r(34, 21, 2, 2, '#fff'); p.p(29, 22, '#10142a'); p.p(34, 22, '#10142a');
}
function frog(k: Ctx) {
  const { p, body, acc, glow, s } = k;
  const k1 = 1 + s * 0.12;
  p.ell(32, 44, Math.round(18 * k1), Math.round(11 * k1), body); p.ell(32, 49, Math.round(14 * k1), Math.round(6 * k1), shade(acc, 0.3));
  p.ell(14, 54, 7, 4, body); p.ell(50, 54, 7, 4, body); p.ell(12, 58, 6, 2, shade(body, -0.1)); p.ell(52, 58, 6, 2, shade(body, -0.1));
  p.ell(32, 32, Math.round(13 * k1), 8, body);
  p.ell(22, 24, 6, 6, '#fff'); p.ell(42, 24, 6, 6, '#fff'); p.ell(21, 25, 3, 3, '#10142a'); p.ell(41, 25, 3, 3, '#10142a'); p.p(20, 23, glow); p.p(40, 23, glow);
  p.r(24, 36, 16, 1, shade(body, -0.5));
  for (const [x, y] of [[26, 41], [36, 43], [30, 46]]) p.r(x, y, 3, 3, acc);
  if (k.f.includes('spikes')) for (let i = 0; i < 4; i++) p.tri(22 + i * 7, 33, 24 + i * 7, 26 - s * 2, 26 + i * 7, 33, glow);
}
function blob(k: Ctx) {
  const { p, body, acc, glow, s, R } = k;
  const k1 = 1 + s * 0.15;
  p.ell(32, 42, Math.round(20 * k1), Math.round(15 * k1), body); p.ell(30, 38, Math.round(15 * k1), Math.round(10 * k1), shade(body, 0.15));
  p.ell(24, 33, 4, 3, shade(body, 0.45));
  for (let i = 0; i < 4; i++) { const x = 16 + i * 10 + ((R() * 3) | 0); p.r(x, 52, 4, 6 + ((R() * 4) | 0), body); }
  p.r(23, 40, 5, 5, '#fff'); p.r(37, 40, 5, 5, '#fff'); p.r(24, 41, 3, 4, '#10142a'); p.r(38, 41, 3, 4, '#10142a'); p.p(24, 41, glow); p.p(38, 41, glow);
  p.r(28, 49, 9, 2, shade(body, -0.5));
  if (k.f.includes('horns')) { p.tri(18, 30, 22, 14, 27, 28, acc); p.tri(38, 28, 43, 14, 47, 30, acc); }
  if (k.f.includes('cube')) { p.r(10, 20, 8, 8, glow); p.r(46, 16, 6, 6, acc); }
}
function plant(k: Ctx) {
  const { p, body, acc, glow, s } = k;
  p.r(24, 44, 16, 14, acc); p.r(22, 42, 20, 4, shade(acc, 0.2)); p.r(24, 56, 16, 2, shade(acc, -0.3));
  p.r(26, 48, 3, 3, '#fff'); p.r(35, 48, 3, 3, '#fff'); p.p(27, 49, '#10142a'); p.p(36, 49, '#10142a'); p.r(30, 53, 4, 1, shade(acc, -0.5));
  p.r(30, 22, 4, 22, '#2f8a2c');
  for (let i = 0; i < 2 + s; i++) { const y = 36 - i * 7; p.ell(22 - i, y, 7, 3, body); p.ell(42 + i, y - 2, 7, 3, shade(body, 0.1)); }
  const fr = 7 + s * 2;
  for (let a = 0; a < 6; a++) { const ang = (a / 6) * Math.PI * 2; p.ell(32 + Math.cos(ang) * (fr - 2), 16 + Math.sin(ang) * (fr - 2), 4, 4, glow); }
  p.ell(32, 16, 5, 5, shade(acc, 0.2)); p.p(31, 15, '#10142a'); p.p(34, 15, '#10142a');
}
function mech(k: Ctx) {
  const { p, body, acc, glow, s } = k;
  const k1 = 1 + s * 0.12;
  const w = Math.round(22 * k1), h = Math.round(18 * k1);
  p.r(32 - w / 2 + 2, 52, 6, 7, '#3a3e58'); p.r(32 + w / 2 - 8, 52, 6, 7, '#3a3e58'); p.r(32 - w / 2, 56, 10, 3, shade(body, -0.4)); p.r(32 + w / 2 - 10, 56, 10, 3, shade(body, -0.4));
  p.r(32 - w / 2, 52 - h, w, h, body); p.r(32 - w / 2, 52 - h, w, 3, shade(body, 0.3)); p.r(32 - w / 2, 52 - 4, w, 4, shade(body, -0.25));
  p.r(32 - w / 2 + 3, 52 - h + 5, w - 6, h - 12, '#10142a'); p.r(32 - w / 2 + 5, 52 - h + 7, 5, 5, glow); p.r(32 + w / 2 - 12, 52 - h + 7, 5, 5, glow);
  p.r(32 - 6, 52 - h + 14, 12, 2, acc);
  p.r(32 - 1, 52 - h - 8, 2, 8, '#8a8ab0'); p.r(32 - 3, 52 - h - 11, 6, 4, glow);
  p.r(32 - w / 2 - 5, 52 - h + 6, 5, 10, acc); p.r(32 + w / 2, 52 - h + 6, 5, 10, acc);
  if (k.f.includes('spikes')) for (let i = 0; i < 3; i++) p.tri(32 - w / 2 + 3 + i * 7, 52 - h, 32 - w / 2 + 6 + i * 7, 52 - h - 6, 32 - w / 2 + 9 + i * 7, 52 - h, acc);
}
function ghost(k: Ctx) {
  const { p, body, acc, glow, s } = k;
  const k1 = 1 + s * 0.12;
  const w = Math.round(15 * k1), top = 14 - s * 2;
  p.ell(32, top + w, w, w, body); p.r(32 - w, top + w, w * 2 + 1, 24, body);
  for (let i = 0; i < 4; i++) p.tri(32 - w + i * (w / 2), top + w + 22, 32 - w + i * (w / 2) + w / 4, top + w + 30, 32 - w + (i + 1) * (w / 2), top + w + 22, body);
  p.ell(30, top + w - 3, w - 5, w - 7, shade(body, 0.2));
  p.ell(25, top + w + 2, 4, 5, '#10142a'); p.ell(39, top + w + 2, 4, 5, '#10142a'); p.r(24, top + w, 2, 2, glow); p.r(38, top + w, 2, 2, glow);
  p.ell(32, top + w + 11, 3, 2, '#10142a');
  p.r(10, top + w + 8, 5, 5, acc); p.r(48, top + w + 4, 4, 4, glow);
}

const TEMPLATES: Record<string, (k: Ctx) => void> = {
  quad, bird, worm, moth, frog, blob, plant, mech, ghost, hound: (k) => quad(k, true),
};

/** Render a creature into a 64x64 canvas. back=true -> flipped, faceless 'rear' variant. */
export function renderCreature(spec: SpriteSpec, opts: { back?: boolean; variant?: boolean } = {}): HTMLCanvasElement {
  const c = mkCanvas(BS, BS);
  const g = ctx2d(c);
  let body = spec.c[0], acc = spec.c[1], glow = spec.c[2] ?? '#38e0e8';
  if (opts.variant) { // ANOMALOUS palette: hue-swapped
    const sw = (h: string) => { const [r, gg, b] = hexToRgb(h); return rgbToHex(b, r, gg); };
    body = sw(body); acc = sw(acc); glow = '#f0c828';
  }
  const seed = (spec.seed ?? hashStr(JSON.stringify(spec.c) + spec.t)) >>> 0;
  const R = rng(seed);
  const k: Ctx = { p: new Pen(g), body, acc, glow, s: spec.s ?? 0, f: spec.f ?? [], R };
  TEMPLATES[spec.t](k);
  // post-process
  const img = g.getImageData(0, 0, BS, BS);
  const d = img.data;
  const A = (x: number, y: number) => (x < 0 || y < 0 || x >= BS || y >= BS ? 0 : d[(y * BS + x) * 4 + 3]);
  const out = new Uint8ClampedArray(d);
  const set = (x: number, y: number, hex: string) => { const [r, gg, b] = hexToRgb(hex); const i = (y * BS + x) * 4; out[i] = r; out[i + 1] = gg; out[i + 2] = b; out[i + 3] = 255; };
  for (let y = 0; y < BS; y++) for (let x = 0; x < BS; x++) {
    const i = (y * BS + x) * 4;
    if (d[i + 3] > 0) {
      let f = 0;
      if (!A(x, y - 1) || !A(x, y - 2)) f += 0.22; // top light
      if (!A(x, y + 1)) f -= 0.3;
      if (!A(x + 1, y) && !A(x + 1, y - 1)) f -= 0.12;
      if (f) { const hex = rgbToHex(d[i], d[i + 1], d[i + 2]); set(x, y, shade(hex, f)); }
    }
  }
  const filled = (x: number, y: number) => A(x, y) > 0;
  for (let y = 0; y < BS; y++) for (let x = 0; x < BS; x++) {
    if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) set(x, y, '#1a1830');
  }
  // glitch: erase blocks, recolor, row shifts
  const gl = spec.g ?? 0.4;
  const Rg = rng(seed ^ 0x9e37);
  const blocks = Math.round(8 + gl * 30);
  const pts: [number, number][] = [];
  for (let y = 0; y < BS; y++) for (let x = 0; x < BS; x++) if (out[(y * BS + x) * 4 + 3]) pts.push([x, y]);
  for (let i = 0; i < blocks && pts.length; i++) {
    const [x, y] = pts[(Rg() * pts.length) | 0];
    const mode = Rg();
    const w = 1 + ((Rg() * 3) | 0), h = 1 + ((Rg() * 2) | 0);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const X = x + xx, Y = y + yy; if (X >= BS || Y >= BS) continue;
      const j = (Y * BS + X) * 4;
      if (mode < 0.35) out[j + 3] = 0;
      else if (mode < 0.65) set(X, Y, glow);
      else if (mode < 0.8) set(X, Y, '#b43cd8');
    }
  }
  const shifted = new Uint8ClampedArray(out);
  const rows = Math.round(gl * 4);
  for (let r = 0; r < rows; r++) {
    const y = 14 + ((Rg() * 44) | 0), sh = Rg() < 0.5 ? -2 : 2;
    for (let x = 0; x < BS; x++) { const sx = x - sh; for (let ch = 0; ch < 4; ch++) shifted[(y * BS + x) * 4 + ch] = sx >= 0 && sx < BS ? out[(y * BS + sx) * 4 + ch] : 0; }
  }
  const res = new ImageData(shifted, BS, BS);
  g.putImageData(res, 0, 0);
  if (opts.back) {
    const c2 = mkCanvas(BS, BS); const g2 = ctx2d(c2);
    g2.translate(BS, 0); g2.scale(-1, 1); g2.drawImage(c, 0, 0);
    g2.setTransform(1, 0, 0, 1, 0, 0);
    // darken a touch + remove face: overlay body-colored patch where the face was
    g2.globalCompositeOperation = 'source-atop'; g2.fillStyle = 'rgba(10,10,40,0.28)'; g2.fillRect(0, 0, BS, BS);
    return c2;
  }
  return c;
}

/** 16x16 party/dex icon sampled from the full sprite. */
export function renderIcon(front: HTMLCanvasElement): HTMLCanvasElement {
  const c = mkCanvas(16, 16); const g = ctx2d(c);
  const sg = front.getContext('2d', { willReadFrequently: true })!;
  const src = sg.getImageData(0, 0, BS, BS).data;
  // crop to bounds
  let x0 = BS, y0 = BS, x1 = 0, y1 = 0;
  for (let y = 0; y < BS; y++) for (let x = 0; x < BS; x++) if (src[(y * BS + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, sc = Math.max(w, h) / 15;
  const out = g.createImageData(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const sx = Math.floor(x0 + (x - (16 - w / sc) / 2) * sc), sy = Math.floor(y0 + (y - (16 - h / sc) / 2) * sc);
    // pick darkest-opaque pixel in a block for outline retention
    let best = -1, bv = 999;
    for (let dy = 0; dy < Math.ceil(sc); dy++) for (let dx = 0; dx < Math.ceil(sc); dx++) {
      const X = sx + dx, Y = sy + dy; if (X < 0 || Y < 0 || X >= BS || Y >= BS) continue;
      const i = (Y * BS + X) * 4; if (!src[i + 3]) continue;
      const v = src[i] + src[i + 1] + src[i + 2];
      if (best < 0 || (v > 90 && v < bv)) { best = i; bv = v; }
    }
    if (best >= 0) { const o = (y * 16 + x) * 4; out.data[o] = src[best]; out.data[o + 1] = src[best + 1]; out.data[o + 2] = src[best + 2]; out.data[o + 3] = 255; }
  }
  g.putImageData(out, 0, 0);
  return c;
}

/** All-black silhouette for unseen Bytedex entries. */
export function silhouette(src: HTMLCanvasElement, color = '#1a1830'): HTMLCanvasElement {
  const c = mkCanvas(src.width, src.height); const g = ctx2d(c);
  g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return c;
}
