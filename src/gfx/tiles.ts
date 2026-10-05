import { Pen, mkCanvas, ctx2d, rng, shade, mix } from './pen';

export interface TileDef {
  name: string;
  solid?: boolean;
  anim?: boolean;       // occupies two slots (frame 0 / frame 1)
  grass?: boolean;      // wild encounter tile
  water?: boolean;
  ledge?: boolean;      // one-way hop downwards
  draw: (p: Pen, f: number) => void;
}

const T = 16;
type D = (p: Pen, f: number) => void;
const defs: TileDef[] = [];
const add = (name: string, draw: D, o: Partial<TileDef> = {}) => defs.push({ name, draw, ...o });

// ---------- shared drawing helpers ----------
function speckle(p: Pen, seed: number, base: string, cols: string[], n: number) {
  p.r(0, 0, T, T, base);
  const R = rng(seed);
  for (let i = 0; i < n; i++) p.p((R() * T) | 0, (R() * T) | 0, cols[(R() * cols.length) | 0]);
}
const grassBase = (p: Pen, seed = 1) => speckle(p, seed, '#5fae3c', ['#4e9a32', '#74c24c', '#4e9a32'], 22);

function roof(p: Pen, col: string, part: 'l' | 'm' | 'r' | 'tl' | 'tm' | 'tr') {
  const hi = shade(col, 0.25), lo = shade(col, -0.3);
  p.r(0, 0, T, T, col);
  for (let y = 0; y < T; y += 4) { p.r(0, y + 3, T, 1, lo); for (let x = (y / 4) % 2 ? 4 : 0; x < T; x += 8) p.r(x, y, 1, 3, lo); p.r(0, y, T, 1, hi); }
  if (part[part.length - 1] === 'l') p.r(0, 0, 1, T, lo);
  if (part[part.length - 1] === 'r') p.r(T - 1, 0, 1, T, lo);
  if (part[0] === 't') { p.r(0, 0, T, 2, lo); }
  if (part === 'm' || part === 'l' || part === 'r') p.r(0, T - 2, T, 2, lo); // eave shadow
}
function wall(p: Pen, base = '#e8dcc0', win = false, big = false) {
  p.r(0, 0, T, T, base);
  p.r(0, 0, T, 1, shade(base, -0.15)); p.r(0, T - 1, T, 1, shade(base, -0.25));
  for (let y = 4; y < T; y += 4) p.r(0, y, T, 1, shade(base, -0.07));
  if (win) {
    p.r(3, 3, 10, 9, '#5a4a38'); p.r(4, 4, 8, 7, '#7ac4e8'); p.r(4, 4, 8, 2, '#a8e0f4');
    p.r(7, 4, 2, 7, '#5a4a38'); p.r(4, 7, 8, 1, '#5a4a38'); p.r(2, 12, 12, 2, '#8a7050');
    if (big) p.r(4, 4, 8, 7, '#2a2f55');
  }
}
function door(p: Pen, base = '#e8dcc0', col = '#8a5a30') {
  wall(p, base);
  p.r(3, 1, 10, 15, '#3a2410'); p.r(4, 2, 8, 14, col); p.r(5, 3, 6, 5, shade(col, 0.2)); p.r(5, 9, 6, 6, shade(col, -0.1));
  p.r(10, 9, 2, 2, '#f0c828');
}
function floorPlanks(p: Pen, base: string, seed: number) {
  p.r(0, 0, T, T, base);
  const R = rng(seed);
  for (let y = 0; y < T; y += 4) { p.r(0, y + 3, T, 1, shade(base, -0.2)); const o = ((y / 4) * 5) % 16; p.r(o, y, 1, 3, shade(base, -0.15)); for (let k = 0; k < 3; k++) p.p((R() * 16) | 0, y + 1, shade(base, 0.1)); }
}
function metalFloor(p: Pen, seed: number, glow = false) {
  p.r(0, 0, T, T, '#58587a'); p.r(0, 0, T, 1, '#6a6a90'); p.r(0, 0, 1, T, '#6a6a90');
  p.r(0, T - 1, T, 1, '#44446a'); p.r(T - 1, 0, 1, T, '#44446a');
  const R = rng(seed); for (let i = 0; i < 8; i++) p.p(2 + ((R() * 12) | 0), 2 + ((R() * 12) | 0), '#4c4c70');
  p.p(2, 2, '#8a8ab0'); p.p(13, 13, '#8a8ab0');
  if (glow) { p.r(5, 7, 6, 2, '#38e0e8'); }
}

// ---------- GROUND ----------
add('grass', (p) => grassBase(p, 11));
add('grass2', (p) => grassBase(p, 23));
add('grass3', (p) => { grassBase(p, 37); p.p(4, 5, '#f4f4d8'); p.p(5, 5, '#f0c828'); p.p(11, 11, '#f4f4d8'); p.p(10, 11, '#f0c828'); });
add('flowers_r', (p) => { grassBase(p, 41); for (const [x, y] of [[3, 3], [10, 5], [6, 11], [12, 12]]) { p.p(x, y, '#e04848'); p.p(x - 1, y, '#f88888'); p.p(x + 1, y, '#f88888'); p.p(x, y - 1, '#f88888'); p.p(x, y + 1, '#2f7a28'); } });
add('flowers_y', (p) => { grassBase(p, 43); for (const [x, y] of [[4, 4], [11, 3], [3, 11], [10, 10]]) { p.p(x, y, '#f0c828'); p.p(x - 1, y, '#fff0a0'); p.p(x + 1, y, '#fff0a0'); p.p(x, y + 1, '#2f7a28'); } });
add('tallgrass', (p, f) => {
  grassBase(p, 51);
  const c1 = '#2f8a2c', c2 = '#1f6a24', c3 = '#8ae05a';
  const o = f ? 1 : 0;
  for (let i = 0; i < 4; i++) {
    const x = 1 + i * 4 + (i % 2 ? o : -o + 1);
    for (const y of [3, 9]) { p.r(x, y + 1, 1, 5, c2); p.r(x + 1, y, 1, 6, c1); p.r(x + 2, y + 1, 1, 5, c2); p.p(x + 1, y, c3); }
  }
}, { anim: true, grass: true });
add('path', (p) => { speckle(p, 5, '#d8c090', ['#c8b080', '#e8d4a8'], 18); });
add('dirt', (p) => { speckle(p, 6, '#a07848', ['#8a6438', '#b48a58'], 22); });
add('cobble', (p) => {
  p.r(0, 0, T, T, '#a8a8b8');
  for (let y = 0; y < T; y += 5) for (let x = (y / 5) % 2 ? 3 : 0; x < T; x += 6) { p.r(x, y, 5, 4, '#c4c4d4'); p.r(x, y + 3, 5, 1, '#9090a4'); p.p(x, y, '#dcdce8'); }
});
add('water', (p, f) => {
  p.r(0, 0, T, T, '#3a78d8');
  const o = f ? 4 : 0;
  for (const [x, y] of [[1, 3], [9, 7], [4, 12], [12, 1]]) { p.r((x + o) % 16, y, 3, 1, '#7ab4f4'); p.r((x + o + 1) % 16, y + 1, 1, 1, '#2a5cb8'); }
}, { anim: true, solid: true, water: true });
add('bridge', (p) => { floorPlanks(p, '#b08850', 3); p.r(0, 0, T, 1, '#6a4a28'); p.r(0, T - 1, T, 1, '#6a4a28'); });
add('bridge_v', (p) => { p.r(0, 0, T, T, '#b08850'); for (let x = 0; x < T; x += 4) { p.r(x + 3, 0, 1, T, '#8a6a38'); p.r(x, 0, 1, T, '#c8a068'); } p.r(0, 0, 1, T, '#6a4a28'); p.r(T - 1, 0, 1, T, '#6a4a28'); });
add('wood', (p) => floorPlanks(p, '#c89860', 7));
add('wood_dark', (p) => floorPlanks(p, '#8a6040', 8));
add('tile_floor', (p) => { p.r(0, 0, T, T, '#e4e4ec'); p.r(0, 0, T, 1, '#f8f8ff'); p.r(0, 0, 1, T, '#f8f8ff'); p.r(0, 15, T, 1, '#b4b4c4'); p.r(15, 0, 1, T, '#b4b4c4'); });
add('carpet_r', (p) => { speckle(p, 9, '#b04050', ['#a03848', '#c05060'], 14); p.r(0, 0, T, 1, '#8a2c3c'); p.r(0, 15, T, 1, '#8a2c3c'); });
add('carpet_b', (p) => { speckle(p, 10, '#3a58a8', ['#324c98', '#4868b8'], 14); });
add('soil', (p) => { speckle(p, 12, '#7a5430', ['#664424', '#8c6840'], 24); for (let y = 3; y < T; y += 6) p.r(0, y, T, 1, '#5a3c20'); });
add('crop', (p) => { // cache crop - slightly wrong repeating pattern
  p.r(0, 0, T, T, '#7a5430'); for (let y = 3; y < T; y += 6) p.r(0, y, T, 1, '#5a3c20');
  for (const x of [2, 9]) { p.r(x + 2, 4, 1, 8, '#2f8a2c'); p.r(x, 5, 2, 2, '#58b83c'); p.r(x + 3, 3, 2, 2, '#58b83c'); p.p(x + 2, 3, '#f0c828'); }
}, { solid: false });
add('crop_dup', (p, f) => {
  p.r(0, 0, T, T, '#7a5430'); for (let y = 3; y < T; y += 6) p.r(0, y, T, 1, '#5a3c20');
  for (const x of [2, 9]) { p.r(x + 2, 4, 1, 8, '#2f8a2c'); p.r(x, 5, 2, 2, '#58b83c'); p.r(x + 3, 3, 2, 2, '#58b83c'); p.p(x + 2, 3, f ? '#38e0e8' : '#b43cd8'); }
  p.r(5, 12, 2, 1, '#b43cd8'); p.r(10, 6, 2, 1, '#38e0e8');
}, { anim: true });
add('sand', (p) => speckle(p, 13, '#e8d8a0', ['#d8c888', '#f4e8b8'], 14));
add('ledge_d', (p) => { grassBase(p, 14); p.r(0, 9, T, 2, '#4a8a2c'); p.r(0, 11, T, 4, '#8a6a40'); p.r(0, 11, T, 1, '#a88858'); p.r(0, 15, T, 1, '#5a4228'); }, { ledge: true });
add('cave_floor', (p) => speckle(p, 15, '#6a6478', ['#5a546a', '#7a748a'], 20));
add('metal', (p) => metalFloor(p, 21));
add('metal2', (p) => metalFloor(p, 22));
add('metal_cable', (p) => { metalFloor(p, 23); p.r(0, 6, T, 3, '#262c48'); p.r(0, 7, T, 1, '#6a3c98'); });
add('plate_tri', (p, f) => { metalFloor(p, 24); p.r(2, 2, 12, 12, '#3a3a58'); p.tri(8, 3, 3, 12, 13, 12, f ? '#38e0e8' : '#8a8ab0'); });
add('plate_cir', (p, f) => { metalFloor(p, 24); p.r(2, 2, 12, 12, '#3a3a58'); p.ell(8, 8, 4, 4, f ? '#38e0e8' : '#8a8ab0'); p.ell(8, 8, 2, 2, '#3a3a58'); });
add('plate_sq', (p, f) => { metalFloor(p, 24); p.r(2, 2, 12, 12, '#3a3a58'); p.r(4, 4, 8, 8, f ? '#38e0e8' : '#8a8ab0'); p.r(6, 6, 4, 4, '#3a3a58'); });
add('plate_tri_on', (p) => { metalFloor(p, 24); p.r(2, 2, 12, 12, '#1a4a58'); p.tri(8, 3, 3, 12, 13, 12, '#38e0e8'); p.tri(8, 6, 6, 10, 10, 10, '#d8ffff'); });
add('plate_cir_on', (p) => { metalFloor(p, 24); p.r(2, 2, 12, 12, '#1a4a58'); p.ell(8, 8, 4, 4, '#38e0e8'); p.ell(8, 8, 2, 2, '#d8ffff'); });
add('plate_sq_on', (p) => { metalFloor(p, 24); p.r(2, 2, 12, 12, '#1a4a58'); p.r(4, 4, 8, 8, '#38e0e8'); p.r(6, 6, 4, 4, '#d8ffff'); });
// corruption (pixel-authentic glitch tiles)
add('glitch_a', (p, f) => {
  const R = rng(f ? 91 : 92); p.r(0, 0, T, T, '#1a1030');
  for (let i = 0; i < 40; i++) { const c = ['#6a2cb0', '#b43cd8', '#38e0e8', '#2a1850'][(R() * 4) | 0]; p.r((R() * 14) | 0, (R() * 14) | 0, 2, 2, c); }
}, { anim: true });
add('glitch_b', (p, f) => {
  const R = rng(f ? 93 : 94); p.r(0, 0, T, T, '#2a1850');
  for (let y = 0; y < T; y += 2) { const sh = (R() * 6) | 0; p.r(sh, y, 10, 1, '#6a2cb0'); p.r(sh + 6, y, 3, 1, f ? '#38e0e8' : '#b43cd8'); }
}, { anim: true });
add('glitch_grass', (p, f) => {
  grassBase(p, 17); const R = rng(f ? 5 : 6);
  for (let i = 0; i < 6; i++) p.r((R() * 14) | 0, (R() * 14) | 0, 2, 2, ['#b43cd8', '#38e0e8', '#1a1030'][(R() * 3) | 0]);
}, { anim: true });
add('hole', (p, f) => { p.r(0, 0, T, T, '#0a0614'); const R = rng(f ? 3 : 4); for (let i = 0; i < 5; i++) p.p((R() * 16) | 0, (R() * 16) | 0, '#38e0e8'); }, { anim: true, solid: true });

// ---------- OBJECTS (drawn on transparent) ----------
add('tree', (p) => {
  p.r(6, 11, 4, 5, '#6a4426'); p.r(6, 11, 1, 5, '#8a5a34'); p.ell(8, 7, 7, 6, '#2a6a2c'); p.ell(7, 6, 5, 4, '#3a8a38');
  p.ell(6, 4, 3, 2, '#58b048'); p.p(10, 9, '#1f5a24'); p.p(4, 8, '#1f5a24'); p.p(11, 6, '#58b048');
}, { solid: true });
add('pine', (p) => {
  p.r(7, 12, 2, 4, '#6a4426');
  p.tri(8, 0, 2, 8, 14, 8, '#1f6a3c'); p.tri(8, 4, 1, 12, 15, 12, '#2a8048'); p.tri(8, 2, 5, 6, 11, 6, '#4aa860');
}, { solid: true });
add('bush', (p) => { p.ell(8, 10, 6, 5, '#2a7a30'); p.ell(7, 9, 4, 3, '#48a040'); p.p(10, 8, '#78d060'); p.p(5, 11, '#1f5a24'); }, { solid: true });
add('rock', (p) => { p.ell(8, 10, 6, 5, '#6a6a7a'); p.ell(7, 9, 4, 3, '#8a8a9a'); p.p(5, 8, '#b4b4c4'); p.r(4, 14, 8, 1, '#4a4a58'); }, { solid: true });
add('fence_h', (p) => { p.r(0, 7, T, 2, '#e8dcc0'); p.r(0, 8, T, 1, '#b0a080'); p.r(1, 4, 2, 10, '#d8ccb0'); p.r(13, 4, 2, 10, '#d8ccb0'); p.r(1, 4, 2, 1, '#fff'); p.r(13, 4, 2, 1, '#fff'); }, { solid: true });
add('fence_v', (p) => { p.r(7, 0, 2, T, '#e8dcc0'); p.r(8, 0, 1, T, '#b0a080'); p.r(6, 2, 4, 2, '#d8ccb0'); p.r(6, 11, 4, 2, '#d8ccb0'); }, { solid: true });
add('sign', (p) => { p.r(7, 8, 2, 7, '#6a4426'); p.r(2, 2, 12, 8, '#c89860'); p.r(2, 2, 12, 1, '#e8c088'); p.r(2, 9, 12, 1, '#8a6040'); p.r(4, 4, 8, 1, '#4a3018'); p.r(4, 6, 6, 1, '#4a3018'); }, { solid: true });
add('lamp', (p, f) => { p.r(7, 5, 2, 10, '#2c3040'); p.r(5, 14, 6, 2, '#2c3040'); p.r(4, 1, 8, 5, '#4a5068'); p.r(5, 2, 6, 3, f ? '#f8f0a0' : '#f0e070'); }, { solid: true, anim: true });
add('mailbox', (p) => { p.r(7, 9, 2, 6, '#6a4426'); p.r(3, 3, 10, 7, '#3a68c8'); p.r(3, 3, 10, 1, '#6a98f0'); p.r(10, 1, 3, 3, '#e04848'); p.r(5, 6, 5, 1, '#1a1830'); }, { solid: true });
add('flowerbox', (p) => { p.r(1, 8, 14, 7, '#8a5a30'); p.r(1, 8, 14, 1, '#a87848'); for (const x of [3, 7, 11]) { p.r(x, 4, 1, 4, '#2f8a2c'); p.r(x - 1, 2, 3, 3, ['#e04848', '#f0c828', '#e888d8'][(x / 4) | 0]); } }, { solid: true });
for (const [n, col] of [['blue', '#4a6ec8'], ['red', '#c85a48'], ['green', '#4a9a58'], ['grey', '#7a7a92']] as const) {
  add(`roof_${n}_tl`, (p) => roof(p, col, 'tl'), { solid: true });
  add(`roof_${n}_tm`, (p) => roof(p, col, 'tm'), { solid: true });
  add(`roof_${n}_tr`, (p) => roof(p, col, 'tr'), { solid: true });
  add(`roof_${n}_l`, (p) => roof(p, col, 'l'), { solid: true });
  add(`roof_${n}_m`, (p) => roof(p, col, 'm'), { solid: true });
  add(`roof_${n}_r`, (p) => roof(p, col, 'r'), { solid: true });
}
add('wall', (p) => wall(p), { solid: true });
add('wall_win', (p) => wall(p, '#e8dcc0', true), { solid: true });
add('wall_barn', (p) => { wall(p, '#b8503c'); for (let x = 3; x < T; x += 5) p.r(x, 0, 1, T, '#8a3828'); }, { solid: true });
add('wall_grey', (p) => wall(p, '#b8bccc'), { solid: true });
add('wall_grey_win', (p) => wall(p, '#b8bccc', true), { solid: true });
add('door', (p) => door(p), { });
add('door_barn', (p) => { wall(p, '#b8503c'); p.r(2, 2, 12, 14, '#e8dcc0'); p.line(2, 2, 13, 15, '#8a3828'); p.line(13, 2, 2, 15, '#8a3828'); p.r(2, 2, 12, 1, '#8a3828'); p.r(7, 2, 2, 14, '#8a3828'); }, {});
add('door_grey', (p) => door(p, '#b8bccc', '#4a6ec8'));
add('hubsign', (p) => { wall(p, '#e8dcc0'); p.r(3, 3, 10, 9, '#2a3a8a'); p.r(4, 4, 8, 7, '#e8f0ff'); p.r(7, 5, 2, 5, '#e04848'); p.r(5, 7, 6, 2, '#e04848'); }, { solid: true });
add('nodesign', (p) => { wall(p, '#b8bccc'); p.r(3, 3, 10, 9, '#2a2f55'); p.r(4, 4, 8, 7, '#161a38'); p.p(6, 6, '#38e0e8'); p.p(9, 6, '#38e0e8'); p.r(5, 9, 6, 1, '#b43cd8'); }, { solid: true });
// interior
add('wall_in', (p) => { p.r(0, 0, T, T, '#8898c8'); p.r(0, 0, T, 2, '#a8b8e0'); p.r(0, 10, T, 6, '#6878a8'); p.r(0, 10, T, 1, '#586898'); p.r(0, 14, T, 2, '#4a4e78'); }, { solid: true });
add('wall_in_win', (p) => { p.r(0, 0, T, T, '#8898c8'); p.r(0, 10, T, 6, '#6878a8'); p.r(0, 14, T, 2, '#4a4e78'); p.r(3, 1, 10, 8, '#e8f0ff'); p.r(4, 2, 8, 6, '#7ac4e8'); p.r(7, 2, 2, 6, '#e8f0ff'); p.r(4, 4, 8, 1, '#e8f0ff'); }, { solid: true });
add('wall_in_dark', (p) => { p.r(0, 0, T, T, '#3a3a58'); p.r(0, 0, T, 2, '#58587a'); p.r(0, 10, T, 6, '#2c2c48'); p.r(0, 14, T, 2, '#1e1e34'); for (const x of [3, 9]) { p.r(x, 12, 3, 1, '#38e0e8'); } }, { solid: true });
add('door_in', (p) => { p.r(0, 0, T, T, '#8898c8'); p.r(2, 2, 12, 14, '#5a3a20'); p.r(3, 3, 10, 13, '#8a5a30'); p.r(10, 9, 2, 2, '#f0c828'); }, { });
add('exit_mat', (p) => { floorPlanks(p, '#c89860', 7); p.r(2, 4, 12, 10, '#b04050'); p.r(2, 4, 12, 1, '#d86070'); p.r(2, 13, 12, 1, '#8a2c3c'); }, { });
add('bed_top', (p) => { p.r(1, 0, 14, 16, '#e8e8f4'); p.r(1, 0, 14, 4, '#6a4426'); p.r(3, 4, 10, 6, '#fff'); p.r(3, 9, 10, 1, '#c8c8d8'); p.r(1, 10, 14, 6, '#4a78d8'); p.r(1, 10, 14, 1, '#7aa0f0'); }, { solid: true });
add('bed_bot', (p) => { p.r(1, 0, 14, 12, '#4a78d8'); p.r(1, 0, 14, 1, '#7aa0f0'); p.r(1, 12, 14, 3, '#6a4426'); p.r(1, 14, 14, 1, '#4a2e18'); p.r(4, 4, 8, 1, '#6a98e8'); }, { solid: true });
add('table', (p) => { p.r(0, 3, T, 9, '#a87848'); p.r(0, 3, T, 2, '#c89860'); p.r(1, 12, 2, 4, '#6a4426'); p.r(13, 12, 2, 4, '#6a4426'); p.r(5, 1, 5, 3, '#e8f0ff'); }, { solid: true });
add('table2', (p) => { p.r(0, 3, T, 9, '#a87848'); p.r(0, 3, T, 2, '#c89860'); p.r(1, 12, 2, 4, '#6a4426'); p.r(13, 12, 2, 4, '#6a4426'); }, { solid: true });
add('chair', (p) => { p.r(4, 2, 8, 6, '#a87848'); p.r(4, 8, 8, 3, '#c89860'); p.r(4, 11, 2, 4, '#6a4426'); p.r(10, 11, 2, 4, '#6a4426'); }, { solid: true });
add('shelf', (p) => { p.r(0, 0, T, T, '#8a5a30'); p.r(1, 1, 14, 6, '#3a2410'); p.r(1, 9, 14, 6, '#3a2410'); for (let i = 0; i < 6; i++) { p.r(2 + i * 2, 2, 2, 5, ['#e04848', '#3a68c8', '#f0c828', '#30c868', '#b43cd8', '#e88838'][i]); } for (let i = 0; i < 5; i++) p.r(2 + i * 3, 10, 2, 5, ['#3a68c8', '#e8e8f4', '#e04848', '#30c868', '#f0c828'][i]); }, { solid: true });
add('tv', (p, f) => { p.r(1, 2, 14, 11, '#2c3040'); p.r(2, 3, 12, 8, f ? '#58a8f8' : '#4890e8'); p.r(2, 3, 12, 1, '#8ac8ff'); p.r(4, 13, 8, 2, '#2c3040'); if (f) p.r(3, 6, 10, 1, '#fff'); }, { solid: true, anim: true });
add('plant', (p) => { p.r(5, 10, 6, 6, '#b8503c'); p.r(5, 10, 6, 1, '#d87058'); p.ell(8, 6, 5, 5, '#2f8a2c'); p.ell(7, 5, 3, 3, '#58b83c'); }, { solid: true });
add('counter', (p) => { p.r(0, 4, T, 12, '#a87848'); p.r(0, 4, T, 3, '#e8c088'); p.r(0, 7, T, 1, '#6a4426'); p.r(0, 15, T, 1, '#4a3018'); }, { solid: true });
add('fridge', (p) => { p.r(3, 0, 10, 16, '#dce4f0'); p.r(3, 0, 10, 1, '#fff'); p.r(3, 7, 10, 1, '#98a0b0'); p.r(11, 2, 1, 4, '#98a0b0'); p.r(11, 9, 1, 5, '#98a0b0'); }, { solid: true });
add('stove', (p) => { p.r(1, 2, 14, 13, '#c8ccd8'); p.r(1, 2, 14, 3, '#2c3040'); p.r(3, 6, 10, 7, '#3a3e50'); p.r(4, 7, 8, 5, '#6a7090'); p.ell(4, 3, 1, 1, '#e04848'); p.ell(11, 3, 1, 1, '#e04848'); }, { solid: true });
add('rug_marker', (p) => { floorPlanks(p, '#c89860', 7); }, {});
add('terminal', (p, f) => { p.r(1, 3, 14, 11, '#4a4e68'); p.r(2, 4, 12, 7, '#10142a'); p.r(3, 5, 8, 1, f ? '#38e0e8' : '#30c868'); p.r(3, 7, 6, 1, '#38e0e8'); p.r(3, 9, 9, 1, '#30c868'); p.r(3, 12, 10, 2, '#2c3040'); p.r(2, 14, 12, 1, '#2c3040'); }, { solid: true, anim: true });
add('vault', (p, f) => { p.r(1, 2, 14, 13, '#58587a'); p.r(2, 3, 12, 6, '#10142a'); p.r(3, 4, 4, 4, '#38e0e8'); p.r(8, 4, 4, 4, f ? '#b43cd8' : '#6a3c98'); p.r(2, 10, 12, 4, '#3c3c58'); p.r(3, 11, 10, 1, '#8a8ab0'); }, { solid: true, anim: true });
add('savepoint', (p, f) => { metalFloor(p, 30); p.r(3, 3, 10, 10, '#10142a'); p.r(4, 4, 8, 8, f ? '#38e0e8' : '#2a7a88'); p.r(6, 6, 4, 4, '#d8ffff'); }, { anim: true });
add('healpad', (p, f) => { p.r(0, 0, T, T, '#e4e4ec'); p.ell(8, 8, 6, 6, '#e04848'); p.ell(8, 8, 4, 4, f ? '#fff' : '#f8d8d8'); p.r(7, 5, 2, 6, '#e04848'); p.r(5, 7, 6, 2, '#e04848'); }, { anim: true });
add('mat', (p) => { p.r(0, 0, T, T, '#c89860'); p.r(1, 3, 14, 10, '#4a78d8'); p.r(2, 4, 12, 8, '#6a98f0'); }, { });
add('workbench', (p) => { p.r(0, 4, T, 8, '#7a7a92'); p.r(0, 4, T, 2, '#a8a8c0'); p.r(1, 12, 2, 4, '#4a4a60'); p.r(13, 12, 2, 4, '#4a4a60'); p.r(3, 1, 4, 3, '#38e0e8'); p.r(9, 2, 4, 2, '#e04848'); }, { solid: true });
add('globe', (p) => { p.r(6, 12, 4, 3, '#6a4426'); p.ell(8, 7, 5, 5, '#3a78d8'); p.r(5, 5, 3, 3, '#5fae3c'); p.r(9, 8, 3, 2, '#5fae3c'); p.p(6, 4, '#b4d4ff'); }, { solid: true });
// relay / tech
add('rack', (p, f) => { p.r(1, 0, 14, 16, '#3a3e58'); p.r(2, 1, 12, 14, '#262a40'); for (let y = 2; y < 14; y += 3) { p.r(3, y, 10, 2, '#4a4e68'); p.p(4, y, ((y + (f ? 1 : 0)) % 2) ? '#38e0e8' : '#b43cd8'); p.p(6, y, '#30c868'); p.r(8, y, 4, 1, '#6a6e88'); } }, { solid: true, anim: true });
add('monitor', (p, f) => { p.r(1, 1, 14, 11, '#2c3040'); p.r(2, 2, 12, 8, '#3a2a78'); const R = rng(f ? 7 : 8); for (let i = 0; i < 14; i++) p.p(2 + ((R() * 11) | 0), 2 + ((R() * 7) | 0), ['#b43cd8', '#38e0e8', '#6a4cc8'][(R() * 3) | 0]); p.r(5, 12, 6, 2, '#2c3040'); p.r(3, 14, 10, 1, '#2c3040'); }, { solid: true, anim: true });
add('pillar', (p) => { p.r(3, 0, 10, 16, '#7a7a98'); p.r(3, 0, 2, 16, '#9a9ab8'); p.r(11, 0, 2, 16, '#585878'); p.r(2, 0, 12, 2, '#8a8aa8'); p.r(2, 14, 12, 2, '#585878'); }, { solid: true });
add('cable_wall', (p) => { p.r(0, 0, T, T, '#3a3a58'); p.r(2, 0, 3, T, '#262c48'); p.r(3, 0, 1, T, '#6a3c98'); p.r(9, 0, 3, T, '#262c48'); p.r(10, 0, 1, T, '#38e0e8'); }, { solid: true });
add('gate', (p, f) => { metalFloor(p, 25); p.r(0, 0, T, T, '#262a40'); for (let x = 1; x < T; x += 4) p.r(x, 0, 2, T, '#58587a'); p.r(0, 7, T, 2, '#b43cd8'); p.r(0, 7, T, 1, f ? '#38e0e8' : '#d878f0'); }, { solid: true, anim: true });
add('gate_open', (p) => { metalFloor(p, 25); p.r(0, 0, 2, T, '#58587a'); p.r(14, 0, 2, T, '#58587a'); });
add('beacon', (p, f) => { p.r(6, 8, 4, 8, '#58587a'); p.r(4, 14, 8, 2, '#3c3c58'); p.ell(8, 6, 4, 4, f ? '#d8ffff' : '#38e0e8'); p.r(7, 0, 2, 3, '#8a8ab0'); }, { solid: true, anim: true });
add('antenna', (p, f) => { p.r(7, 0, 2, 16, '#8a8ab0'); p.line(7, 16, 3, 6, '#8a8ab0'); p.line(8, 16, 12, 6, '#8a8ab0'); p.r(4, 8, 8, 1, '#8a8ab0'); p.r(6, 4, 4, 1, '#8a8ab0'); p.p(8, 0, f ? '#e04848' : '#6a2020'); }, { solid: true, anim: true });
add('pipe_h', (p, f) => { p.r(0, 5, T, 6, '#6a7a98'); p.r(0, 5, T, 1, '#98a8c8'); p.r(0, 10, T, 1, '#44506a'); p.r((f ? 3 : 9), 7, 3, 2, '#7ac4f4'); for (let x = 2; x < T; x += 8) p.r(x, 4, 2, 8, '#58688a'); }, { solid: true, anim: true });
add('pipe_v', (p, f) => { p.r(5, 0, 6, T, '#6a7a98'); p.r(5, 0, 1, T, '#98a8c8'); p.r(10, 0, 1, T, '#44506a'); p.r(7, (f ? 3 : 9), 2, 3, '#7ac4f4'); for (let y = 2; y < T; y += 8) p.r(4, y, 8, 2, '#58688a'); }, { solid: true, anim: true });
add('pipe_c', (p) => { p.r(5, 5, 11, 6, '#6a7a98'); p.r(5, 5, 6, 11, '#6a7a98'); p.r(5, 5, 11, 1, '#98a8c8'); p.r(10, 10, 6, 1, '#44506a'); p.r(4, 4, 3, 3, '#58688a'); }, { solid: true });
add('valve', (p, f) => { p.r(6, 8, 4, 8, '#6a7a98'); p.ell(8, 6, 5, 5, f ? '#e88838' : '#c86a20'); p.ell(8, 6, 3, 3, '#3a3e58'); p.r(7, 1, 2, 10, f ? '#e88838' : '#c86a20'); p.r(3, 5, 10, 2, f ? '#e88838' : '#c86a20'); }, { solid: true, anim: true });
add('channel', (p, f) => { p.r(0, 0, T, T, '#6a4426'); p.r(0, 2, T, 12, '#58a0e8'); const o = f ? 4 : 0; for (const x of [1, 8]) p.r((x + o) % 14, 5, 3, 1, '#a0d4ff'); p.r(0, 2, T, 1, '#3a78c8'); p.r(0, 13, T, 1, '#3a78c8'); }, { solid: true, anim: true, water: true });
add('channel_dry', (p) => { p.r(0, 0, T, T, '#6a4426'); p.r(0, 2, T, 12, '#8a6a40'); p.r(0, 2, T, 1, '#4a3018'); p.r(0, 13, T, 1, '#4a3018'); for (const [x, y] of [[3, 6], [9, 9], [12, 5]]) p.p(x, y, '#a88858'); }, { });
add('hay', (p) => { p.r(1, 4, 14, 11, '#e8c048'); p.r(1, 4, 14, 2, '#f8e078'); for (let x = 2; x < 15; x += 3) p.r(x, 6, 1, 8, '#b88828'); p.r(1, 9, 14, 1, '#b88828'); }, { solid: true });
add('silo', (p) => { p.r(2, 0, 12, 16, '#c8ccd8'); p.r(2, 0, 3, 16, '#e8ecf4'); p.r(11, 0, 3, 16, '#98a0b8'); for (let y = 3; y < 16; y += 4) p.r(2, y, 12, 1, '#98a0b8'); }, { solid: true });
add('cave_wall', (p) => { p.r(0, 0, T, T, '#4a4458'); const R = rng(77); for (let i = 0; i < 18; i++) p.r((R() * 14) | 0, (R() * 14) | 0, 2, 2, ['#3a3448', '#5a546a'][(R() * 2) | 0]); p.r(0, 14, T, 2, '#2a2438'); }, { solid: true });
add('cave_rock', (p) => { p.r(0, 0, T, T, '#6a6478'); p.ell(8, 9, 6, 5, '#4a4458'); p.ell(7, 8, 4, 3, '#5a546a'); }, { solid: true });
add('darkfloor', (p) => p.r(0, 0, T, T, '#0a0614'));
add('statue', (p) => { p.r(4, 12, 8, 4, '#8a8aa8'); p.r(6, 4, 4, 9, '#a8a8c4'); p.ell(8, 3, 3, 3, '#c4c4dc'); p.r(3, 6, 3, 2, '#a8a8c4'); p.r(10, 6, 3, 2, '#a8a8c4'); }, { solid: true });
add('boulder', (p) => { p.ell(8, 9, 7, 6, '#7a6a58'); p.ell(7, 8, 5, 4, '#9a8a74'); p.p(5, 6, '#c4b498'); p.r(4, 14, 9, 1, '#4a3c2c'); }, { solid: true });
add('note', (p) => { p.r(3, 4, 10, 8, '#f4ecc8'); p.r(3, 4, 10, 1, '#c8b890'); p.r(5, 6, 6, 1, '#6a5a40'); p.r(5, 8, 5, 1, '#6a5a40'); p.r(5, 10, 4, 1, '#6a5a40'); });
add('crate', (p) => { p.r(1, 2, 14, 13, '#a87848'); p.r(1, 2, 14, 2, '#c89860'); p.r(1, 2, 2, 13, '#8a5a30'); p.r(13, 2, 2, 13, '#8a5a30'); p.r(1, 8, 14, 1, '#8a5a30'); p.r(1, 14, 14, 1, '#4a3018'); }, { solid: true });
add('lab_machine', (p, f) => { p.r(1, 1, 14, 14, '#6a7a98'); p.r(2, 2, 12, 6, '#161a38'); p.r(3, 3, 10, 1, '#38e0e8'); p.r(3, 5, f ? 8 : 5, 1, '#30c868'); p.r(3, 10, 3, 3, '#e04848'); p.r(8, 10, 5, 3, '#3a3e58'); }, { solid: true, anim: true });
add('dark', (p) => p.r(0, 0, T, T, '#0a0614'), { solid: true });

// ---------- registry ----------
export const TILE_DEFS = defs;
export const TILE_INDEX: Record<string, number> = {};
export const TILE_BY_INDEX: TileDef[] = [];
{
  let i = 0;
  for (const d of defs) {
    TILE_INDEX[d.name] = i;
    TILE_BY_INDEX[i] = d;
    if (d.anim) { TILE_BY_INDEX[i + 1] = d; i += 2; } else i += 1;
  }
}
export const TILESET_COLS = 16;
export const tileCount = () => Object.values(TILE_INDEX).reduce((m, v) => Math.max(m, v), 0) + 2;

export function buildTileset(): HTMLCanvasElement {
  const n = tileCount();
  const rows = Math.ceil(n / TILESET_COLS);
  const c = mkCanvas(TILESET_COLS * T, rows * T);
  const g = ctx2d(c);
  for (const d of defs) {
    const i = TILE_INDEX[d.name];
    const frames = d.anim ? 2 : 1;
    for (let f = 0; f < frames; f++) {
      const idx = i + f;
      const pen = new Pen(g, (idx % TILESET_COLS) * T, Math.floor(idx / TILESET_COLS) * T);
      d.draw(pen, f);
    }
  }
  return c;
}
export function tileInfo(index: number): TileDef | undefined { return TILE_BY_INDEX[index]; }
