// PLACEHOLDER sprite generator (A04). Procedural, deterministic, no resampling.
// Writes assets/placeholder/*.png and assets/generated/placeholder_atlas.{png,json}.
// Every sprite here is a stand-in; see docs/MISSING_ASSETS.md for what replaces it.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets/placeholder');
const GEN_DIR = path.join(ROOT, 'assets/generated');
const PAD = 2;
const CW = 32, CH = 48;

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const C = {
  line: hex('#2b1a12'), skin: hex('#d9a074'), skinD: hex('#b87a50'), brown: hex('#8a5a2b'),
  brownD: hex('#5a3820'), denim: hex('#3f6fa6'), denimD: hex('#2c4d7a'), red: hex('#b8323a'),
  redD: hex('#7e2028'), cream: hex('#f2e4c0'), white: hex('#fffaf0'), gun: hex('#4a4a52'),
  gunL: hex('#8a8a94'), gold: hex('#e0b040'), orange: hex('#e07a2a'), mag: hex('#ff00ff'),
  dust: hex('#d8c49a'), dustD: hex('#a98f62'),
};

class Img {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h * 4); }
  set(x, y, c) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.d.set(c, (y * this.w + x) * 4); }
  get(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.d[(y * this.w + x) * 4 + 3]; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  line(x0, y0, x1, y1, c, t = 2) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= n; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / n), y = Math.round(y0 + ((y1 - y0) * s) / n);
      this.rect(x, y, t, t, c);
    }
  }
  disc(cx, cy, r, c) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r / 2) this.set(cx + x, cy + y, c); }
  outline(c) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
    }
    for (const [x, y] of add) this.set(x, y, c);
  }
  flip() {
    const o = new Img(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++)
      o.d.set(this.d.subarray((y * this.w + x) * 4, (y * this.w + x) * 4 + 4), (y * this.w + (this.w - 1 - x)) * 4);
    return o;
  }
  tint(f) { // lerp opaque pixels toward white (hit flash)
    for (let i = 0; i < this.d.length; i += 4) if (this.d[i + 3]) for (let k = 0; k < 3; k++) this.d[i + k] = Math.round(this.d[i + k] + (255 - this.d[i + k]) * f);
  }
}

const HERO = { hat: C.white, hatD: C.cream, band: C.brown, vest: C.denim, vestD: C.denimD, shirt: C.cream, neck: C.gold, pants: C.brownD, boot: C.line, hair: C.brownD };
const FOE = { hat: C.brown, hatD: C.brownD, band: C.brownD, vest: C.brownD, vestD: C.line, shirt: C.cream, neck: C.red, pants: C.denimD, boot: C.brownD, hair: C.line, mask: C.red };

// pose: lean = x shift of upper body, dy = body bob, hand = [x,y] of gun hand, gun = 'holster'|'up'|'out'|'down'
const POSES = {
  idle_0: { lean: 0, dy: 0, hand: [20, 33], gun: 'holster' },
  idle_1: { lean: 0, dy: 1, hand: [20, 34], gun: 'holster' },
  draw_0: { lean: 0, dy: 1, hand: [22, 32], gun: 'holster', grip: true },
  draw_1: { lean: 0, dy: 0, hand: [25, 28], gun: 'up' },
  aim: { lean: 0, dy: 0, hand: [25, 22], gun: 'out' },
  shoot_0: { lean: -1, dy: 0, hand: [25, 19], gun: 'kick' },
  shoot_1: { lean: -1, dy: 0, hand: [25, 21], gun: 'out' },
  hit: { lean: -4, dy: 0, hand: [22, 30], gun: 'down', hit: true },
};

function drawStanding(p, pose) {
  const im = new Img(CW, CH);
  const { lean: L, dy } = pose;
  // legs (static, planted); hit pose staggers
  const stag = pose.hit ? 2 : 0;
  im.rect(11 - stag, 34 + dy, 5, 11 - dy, p.pants); im.rect(17, 34 + dy, 5, 11 - dy, p.pants);
  im.rect(10 - stag, 44, 7, 3, p.boot); im.rect(17, 44, 8, 3, p.boot);
  // holster on hip
  im.rect(20 + L, 31 + dy, 3, 5, C.brown);
  // torso: shirt then vest
  im.rect(10 + L, 20 + dy, 12, 15, p.shirt);
  im.rect(10 + L, 20 + dy, 4, 15, p.vest); im.rect(18 + L, 20 + dy, 4, 15, p.vest);
  im.rect(10 + L, 33 + dy, 12, 2, C.brownD); // belt
  im.set(15 + L, 33 + dy, C.gold); im.set(16 + L, 33 + dy, C.gold);
  im.rect(10 + L, 20 + dy, 12, 2, p.vestD);
  // neckerchief
  im.rect(12 + L, 19 + dy, 8, 2, p.neck);
  // head (faces right)
  const hy = 9 + dy, hx = 12 + L + (pose.hit ? -1 : 0);
  im.rect(hx, hy, 8, 10, C.skin); im.rect(hx, hy + 6, 8, 4, C.skin);
  im.rect(hx, hy + 8, 3, 2, C.skinD);
  im.set(hx + 5, hy + 4, C.line); // eye
  if (p.mask) im.rect(hx + 1, hy + 6, 7, 3, p.mask); // red bandana over lower face
  else im.rect(hx + 3, hy + 7, 4, 1, C.skinD); // mouth
  im.rect(hx - 1, hy + 1, 2, 5, p.hair);
  // hat
  im.rect(hx - 5, hy - 1, 18, 2, p.hatD); // brim
  im.rect(hx - 1, hy - 7, 10, 7, p.hat); // crown
  im.rect(hx - 1, hy - 2, 10, 1, p.band);
  im.rect(hx + 3, hy - 7, 2, 1, p.hatD); // crease
  // arm + gun
  const sx = 19 + L, sy = 22 + dy, [hxh, hyh] = pose.hand;
  im.line(sx, sy, hxh + L * 0, hyh, p.vest, 3);
  im.rect(hxh, hyh, 3, 3, C.skin);
  const g = pose.gun;
  if (g === 'out') { im.rect(hxh + 2, hyh - 1, 7, 3, C.gun); im.rect(hxh + 2, hyh + 1, 2, 3, C.brown); im.set(hxh + 8, hyh - 1, C.gunL); }
  else if (g === 'kick') { im.rect(hxh + 2, hyh - 2, 6, 3, C.gun); im.rect(hxh + 1, hyh, 2, 3, C.brown); im.set(hxh + 7, hyh - 2, C.gunL); }
  else if (g === 'up') { im.rect(hxh + 1, hyh - 4, 3, 5, C.gun); im.rect(hxh, hyh, 3, 2, C.brown); }
  else if (g === 'down') { im.rect(hxh + 1, hyh + 2, 3, 5, C.gun); }
  else if (pose.grip) im.rect(20 + L, 30 + dy, 4, 2, C.gun);
  im.outline(C.line);
  if (pose.hit) im.tint(0.35);
  return im;
}

function drawDead(p) { // lying on back, head to the right (enemy faces left, falls backwards)
  const im = new Img(CW, CH);
  const y0 = 38;
  im.rect(1, y0 + 2, 4, 4, p.boot); im.rect(5, y0 + 1, 8, 5, p.pants);
  im.rect(13, y0, 9, 6, p.shirt); im.rect(13, y0, 4, 2, p.vest); im.rect(13, y0 + 4, 9, 2, p.vest);
  im.rect(13, y0 + 3, 9, 1, C.brownD);
  im.rect(22, y0 - 1, 7, 7, C.skin);
  if (p.mask) im.rect(25, y0 + 3, 4, 3, p.mask);
  im.set(26, y0 + 1, C.line); im.set(27, y0 + 1, C.line); // X-ish eyes
  im.rect(26, y0 - 3, 6, 3, p.hat); im.rect(27, y0 - 4, 4, 1, p.hat);
  im.rect(17, y0 + 6, 5, 2, C.skin); // hand
  im.rect(23, y0 + 6, 6, 2, C.gun); // dropped gun
  im.outline(C.line);
  return im;
}

function drawHero(key) {
  if (key === 'dead') return drawDead(HERO).flip(); // hero faces right, falls back to the left: head left
  return drawStanding(HERO, POSES[key]);
}
function drawFoe(key) {
  if (key === 'dead') return drawDead(FOE); // head right = fell backwards from facing left
  return drawStanding(FOE, POSES[key]).flip();
}

function mark(im) { im.rect(0, 0, 2, 2, C.mag); } // magenta PLACEHOLDER corner tell
function star(im, cx, cy, r, c, spikes) {
  im.disc(cx, cy, Math.max(1, r - 2), c);
  for (const [dx, dy] of spikes) im.line(cx, cy, cx + dx * r, cy + dy * r, c, 2);
}

const sprites = []; // [key, Img]
const add = (k, im) => sprites.push([k, im]);

const heroKeys = ['idle_0', 'idle_1', 'draw_0', 'draw_1', 'aim', 'shoot_0', 'shoot_1', 'hit', 'dead'];
for (const k of heroKeys) { const im = drawHero(k); mark(im); add('hero_' + k, im); }
for (const k of heroKeys) { const im = drawFoe(k); mark(im.flip().flip()); im.rect(CW - 2, 0, 2, 2, C.mag); im.rect(0, 0, 2, 2, [0, 0, 0, 0]); add('enemy_' + k, im); }

for (let i = 0; i < 3; i++) { // muzzle flash, points right
  const im = new Img(16, 16); const r = [3, 5, 7][i];
  star(im, 6, 8, r, C.orange, [[1, 0], [1, 1], [1, -1]]);
  star(im, 6, 8, r - 2, C.gold, [[1, 0]]);
  im.disc(5, 8, Math.max(1, r - 4), C.white);
  mark(im); add('muzzle_flash_' + i, im);
}
{ const im = new Img(8, 4); im.rect(0, 1, 6, 2, C.gold); im.rect(6, 1, 2, 2, C.white); im.rect(0, 0, 3, 1, C.orange); im.rect(0, 3, 3, 1, C.orange); add('bullet', im); }
for (let i = 0; i < 3; i++) {
  const im = new Img(16, 16); const r = [2, 4, 6][i];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const a = i === 0 ? 1 : r - 2; im.line(8 + dx * a, 8 + dy * a, 8 + dx * r, 8 + dy * r, i === 2 ? C.orange : C.gold, i === 2 ? 1 : 2);
  }
  if (i < 2) im.disc(8, 8, 2 - i, C.white);
  mark(im); add('impact_spark_' + i, im);
}
for (let i = 0; i < 3; i++) {
  const im = new Img(16, 16); const r = [3, 5, 6][i];
  const puffs = [[8, 10, r], [5 + i, 9 - i, r - 1], [11 - i, 9 - i, r - 1]];
  for (const [x, y, rr] of puffs) im.disc(x, y, rr - (i === 2 ? 1 : 0), C.dust);
  im.rect(0, 13, 16, 3, [0, 0, 0, 0]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (im.get(x, y) && (y > 9 + (i === 0 ? 1 : 0) || (x + y) % 5 === 0)) im.set(x, y, C.dustD);
  if (i === 2) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 2) im.set(x, y, [0, 0, 0, 0]); // dissolve
  mark(im); add('dust_puff_' + i, im);
}
{ // '!' draw cue 16x32
  const im = new Img(16, 32);
  im.rect(4, 2, 8, 18, C.red); im.rect(4, 2, 2, 18, C.redD); im.rect(4, 22, 8, 8, C.red); im.rect(4, 22, 2, 8, C.redD);
  im.rect(7, 4, 2, 6, C.cream);
  im.outline(C.cream); im.outline(C.line); mark(im); add('ui_exclaim', im);
}
{ // crosshair 32x32
  const im = new Img(32, 32); const cx = 15, cy = 15;
  for (let a = 0; a < 360; a += 2) { const x = Math.round(cx + 0.5 + Math.cos(a * Math.PI / 180) * 10), y = Math.round(cy + 0.5 + Math.sin(a * Math.PI / 180) * 10); im.rect(x, y, 2, 2, C.red); }
  im.rect(15, 1, 2, 8, C.cream); im.rect(15, 23, 2, 8, C.cream); im.rect(1, 15, 8, 2, C.cream); im.rect(23, 15, 8, 2, C.cream);
  im.rect(15, 15, 2, 2, C.red);
  im.outline(C.line); mark(im); add('ui_crosshair', im);
}

// ---- pack: shelf, row-major in declared order, fixed atlas width, PAD between frames
const ATLAS_W = 256;
let x = PAD, y = PAD, rowH = 0;
const placed = [];
for (const [key, im] of sprites) {
  if (x + im.w + PAD > ATLAS_W) { x = PAD; y += rowH + PAD; rowH = 0; }
  placed.push({ key, im, x, y }); x += im.w + PAD; rowH = Math.max(rowH, im.h);
}
let ATLAS_H = 1; while (ATLAS_H < y + rowH + PAD) ATLAS_H *= 2;
const atlas = new Img(ATLAS_W, ATLAS_H);
const frames = {};
for (const { key, im, x, y } of placed) {
  for (let j = 0; j < im.h; j++) for (let i = 0; i < im.w; i++) atlas.d.set(im.d.subarray((j * im.w + i) * 4, (j * im.w + i) * 4 + 4), ((y + j) * ATLAS_W + x + i) * 4);
  frames[key] = { frame: { x, y, w: im.w, h: im.h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: im.w, h: im.h }, sourceSize: { w: im.w, h: im.h } };
}

const png = (im) => sharp(Buffer.from(im.d), { raw: { width: im.w, height: im.h, channels: 4 } }).png({ compressionLevel: 9, adaptiveFiltering: false, palette: false }).toBuffer();
function writeIfChanged(file, buf) {
  if (fs.existsSync(file) && Buffer.compare(fs.readFileSync(file), buf) === 0) return;
  fs.writeFileSync(file, buf);
}

fs.mkdirSync(OUT_DIR, { recursive: true }); fs.mkdirSync(GEN_DIR, { recursive: true });
const wanted = new Set();
for (const [key, im] of sprites) { const f = key + '.png'; wanted.add(f); writeIfChanged(path.join(OUT_DIR, f), await png(im)); }
for (const f of fs.readdirSync(OUT_DIR)) if (f.endsWith('.png') && !wanted.has(f)) fs.unlinkSync(path.join(OUT_DIR, f));
writeIfChanged(path.join(GEN_DIR, 'placeholder_atlas.png'), await png(atlas));
const json = { frames, meta: { app: 'neonfeed/scripts/makePlaceholders.mjs', version: '1.0', image: 'placeholder_atlas.png', format: 'RGBA8888', size: { w: ATLAS_W, h: ATLAS_H }, scale: '1' } };
writeIfChanged(path.join(GEN_DIR, 'placeholder_atlas.json'), Buffer.from(JSON.stringify(json, null, 1) + '\n'));

// ---- validation
let bad = 0;
for (const [key, im] of sprites) {
  let opaque = 0, partial = 0;
  for (let i = 3; i < im.d.length; i += 4) { if (im.d[i] === 255) opaque++; else if (im.d[i] !== 0) partial++; }
  if (partial) { console.error(`${key}: ${partial} partial-alpha pixels`); bad++; }
  if (!opaque || opaque === im.w * im.h) { console.error(`${key}: alpha coverage invalid (${opaque}/${im.w * im.h})`); bad++; }
}
const meta = await sharp(path.join(GEN_DIR, 'placeholder_atlas.png')).metadata();
if (!meta.hasAlpha || meta.width !== ATLAS_W || meta.height !== ATLAS_H) { console.error('atlas metadata mismatch'); bad++; }
console.log(`placeholders: ${sprites.length} frames, atlas ${ATLAS_W}x${ATLAS_H}${bad ? `, ${bad} ERRORS` : ', ok'}`);
process.exit(bad ? 1 : 0);
