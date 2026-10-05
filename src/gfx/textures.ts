import Phaser from 'phaser';
import { buildFontCanvas } from './font';
import { buildUiTextures } from './uiTextures';
import { buildTileset, TILESET_COLS } from './tiles';
import { buildCharSheet, PALETTES, FW, FH, SKINS, HAIRS, JACKETS, BAGS, type Look } from './chars';
import { renderCreature, renderIcon, silhouette, BS } from './creatures';
import { mkCanvas, ctx2d, Pen, rng, shade, PAL } from './pen';
import { SPECIES } from '../data';
import type { SaveData } from '../types';

const addCanvas = (scene: Phaser.Scene, key: string, c: HTMLCanvasElement) => {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  return scene.textures.addCanvas(key, c)!;
};

export function addSheet(scene: Phaser.Scene, key: string, c: HTMLCanvasElement, fw: number, fh: number) {
  const tex = addCanvas(scene, key, c);
  const cols = Math.floor(c.width / fw), rows = Math.floor(c.height / fh);
  let i = 0;
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) tex.add(i++, 0, q * fw, r * fh, fw, fh);
  return tex;
}

export function playerLook(save: SaveData['look']): Look {
  const style = save.body === 'masc' ? 'cap' : save.body === 'fem' ? 'long' : 'beanie';
  return { skin: SKINS[save.skin], hair: HAIRS[save.hair], jacket: JACKETS[save.jacket], bag: BAGS[save.bag], style, hat: JACKETS[save.jacket], accent: '#f4f4f0', pants: '#3a4a78' };
}
export function ensurePlayerSheet(scene: Phaser.Scene, look: SaveData['look']) {
  addSheet(scene, 'char_player', buildCharSheet(playerLook(look)), FW, FH);
}
export function ensureCharSheet(scene: Phaser.Scene, key: string) {
  const tk = `char_${key}`;
  if (scene.textures.exists(tk)) return tk;
  const look = PALETTES[key] ?? PALETTES.kid;
  addSheet(scene, tk, buildCharSheet(look), FW, FH);
  return tk;
}

// ---- creature textures (lazy, cached) ----
export function creatureKey(species: string, kind: 'front' | 'back' | 'icon' | 'sil', anomalous = false) { return `bk_${species}_${kind}${anomalous ? '_a' : ''}`; }
export function creatureTex(scene: Phaser.Scene, species: string, kind: 'front' | 'back' | 'icon' | 'sil', anomalous = false): string {
  const key = creatureKey(species, kind, anomalous);
  if (scene.textures.exists(key)) return key;
  const spec = SPECIES[species].sprite;
  if (kind === 'front') addCanvas(scene, key, renderCreature(spec, { variant: anomalous }));
  else if (kind === 'back') addCanvas(scene, key, renderCreature(spec, { back: true, variant: anomalous }));
  else if (kind === 'icon') addCanvas(scene, key, renderIcon(renderCreature(spec, { variant: anomalous })));
  else { const fk = creatureTex(scene, species, 'front'); addCanvas(scene, key, silhouette(scene.textures.get(fk).getSourceImage() as HTMLCanvasElement)); }
  return key;
}

// ---- battle backgrounds 240x112 ----
function bgCanvas(kind: string): HTMLCanvasElement {
  const c = mkCanvas(240, 112); const p = new Pen(ctx2d(c)); const R = rng(kind.length * 977 + kind.charCodeAt(0));
  const grad = (top: string, bot: string, h: number) => { for (let y = 0; y < h; y += 2) { const t = y / h; p.r(0, y, 240, 2, shade(top, 0) === top ? mix2(top, bot, t) : top); } };
  const mix2 = (a: string, b: string, t: number) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const f = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t); return `#${[16, 8, 0].map((s) => f(s).toString(16).padStart(2, '0')).join('')}`; };
  if (kind === 'grass') {
    grad('#88c8f0', '#d8f0f8', 56);
    for (let i = 0; i < 4; i++) { const x = R() * 220; p.ell(x, 20 + R() * 20, 18, 4, '#fff'); }
    p.r(0, 56, 240, 56, '#68b040');
    for (let y = 56; y < 112; y += 4) { p.r(0, y, 240, 2, y % 8 ? '#5aa036' : '#74c04a'); }
    for (let i = 0; i < 80; i++) p.p(R() * 240, 58 + R() * 52, ['#3e8a2c', '#8ad060'][(R() * 2) | 0]);
    p.ell(30, 56, 40, 8, '#4a8a34'); p.ell(210, 56, 50, 10, '#4a8a34');
  } else if (kind === 'route_dusk') {
    grad('#f0a860', '#f8d8a0', 56); p.r(0, 56, 240, 56, '#58983a');
    for (let y = 56; y < 112; y += 4) p.r(0, y, 240, 2, '#4a8a30');
  } else if (kind === 'relay') {
    p.r(0, 0, 240, 112, '#1a1030');
    for (let x = 0; x < 240; x += 24) p.r(x, 0, 2, 70, '#2a1a4a');
    for (let i = 0; i < 70; i++) p.r(R() * 236, R() * 70, 3, 3, ['#6a2cb0', '#b43cd8', '#38e0e8', '#2a1a58'][(R() * 4) | 0]);
    p.r(0, 70, 240, 42, '#262a48');
    for (let y = 70; y < 112; y += 7) p.r(0, y, 240, 1, '#38487a');
    for (let x = -40; x < 280; x += 24) p.line(120, 70, x, 112, '#38487a');
  } else if (kind === 'glitch') {
    p.r(0, 0, 240, 112, '#201050');
    for (let i = 0; i < 160; i++) p.r(R() * 236, R() * 112, 4 + R() * 8, 3, ['#6a2cb0', '#b43cd8', '#38e0e8', '#2a1a58', '#10082a'][(R() * 5) | 0]);
    p.r(0, 66, 240, 46, '#1a1048'); for (let y = 66; y < 112; y += 6) p.r(0, y, 240, 1, '#b43cd8');
  } else if (kind === 'cave') {
    p.r(0, 0, 240, 112, '#3a3448'); for (let i = 0; i < 90; i++) p.r(R() * 236, R() * 70, 4, 3, ['#2a2438', '#4a4458'][(R() * 2) | 0]);
    p.r(0, 60, 240, 52, '#585068'); for (let i = 0; i < 70; i++) p.p(R() * 240, 62 + R() * 48, ['#484058', '#68607a'][(R() * 2) | 0]);
  } else if (kind === 'farm') {
    grad('#98d0f0', '#e8f4f8', 50); p.r(0, 50, 240, 62, '#78b848');
    for (let x = 0; x < 240; x += 12) { p.r(x, 52, 6, 10, '#a8c858'); }
    for (let y = 60; y < 112; y += 6) { p.r(0, y, 240, 3, y % 12 ? '#6aa63c' : '#8a6a3c'); }
    p.r(180, 28, 20, 24, '#c85a48'); p.r(176, 24, 28, 6, '#8a3828');
  } else if (kind === 'node') {
    p.r(0, 0, 240, 112, '#2a3a58');
    for (let x = 0; x < 240; x += 16) { p.r(x, 0, 2, 66, '#3a4e78'); }
    for (let y = 8; y < 60; y += 10) p.r(0, y, 240, 2, '#5ac8e8');
    p.r(0, 66, 240, 46, '#58b0e0'); for (let y = 68; y < 112; y += 5) p.r(0, y, 240, 1, '#8ad4f4'); p.r(0, 66, 240, 3, '#2a3a58');
  } else { p.r(0, 0, 240, 112, '#444'); }
  return c;
}
export function bgTex(scene: Phaser.Scene, kind: string) {
  const k = `bg_${kind}`; if (!scene.textures.exists(k)) addCanvas(scene, k, bgCanvas(kind)); return k;
}

export function buildCoreTextures(scene: Phaser.Scene) {
  addCanvas(scene, 'fontTex', buildFontCanvas());
  buildUiTextures((k, c) => addCanvas(scene, k, c));
  const ts = buildTileset();
  addCanvas(scene, 'tiles', ts);
  // item ball + scan sparkle + creature shimmer for visible encounters
  {
    const c = mkCanvas(16, 16); const p = new Pen(ctx2d(c));
    p.ell(8, 9, 5, 5, '#e04848'); p.r(3, 9, 10, 1, '#1a1830'); p.ell(8, 6, 4, 3, '#f4f4f0'); p.r(7, 8, 2, 2, '#1a1830'); p.p(6, 5, '#fff');
    p.r(4, 14, 8, 1, 'rgba(0,0,0,0.25)');
    addCanvas(scene, 'itemball', c);
  }
  {
    const c = mkCanvas(16, 16); const p = new Pen(ctx2d(c));
    p.p(8, 3, '#d8ffff'); p.p(8, 12, '#38e0e8'); p.p(3, 8, '#38e0e8'); p.p(13, 8, '#d8ffff'); p.r(7, 7, 2, 2, '#fff'); p.p(5, 5, '#b43cd8'); p.p(11, 11, '#b43cd8');
    addCanvas(scene, 'sparkle', c);
  }
  {
    const c = mkCanvas(16, 16); const p = new Pen(ctx2d(c)); const R = rng(5);
    p.ell(8, 10, 5, 4, '#1a1830'); for (let i = 0; i < 14; i++) p.p(3 + ((R() * 10) | 0), 5 + ((R() * 8) | 0), ['#b43cd8', '#38e0e8', '#f4f4f0'][(R() * 3) | 0]);
    addCanvas(scene, 'shimmer', c);
  }
  {
    const c = mkCanvas(16, 16); const p = new Pen(ctx2d(c));
    p.r(6, 1, 4, 9, '#e04848'); p.r(6, 12, 4, 3, '#e04848'); p.r(7, 1, 1, 9, '#f88888');
    addCanvas(scene, 'alert', c);
  }
  {
    const c = mkCanvas(16, 6); const p = new Pen(ctx2d(c)); p.ell(8, 3, 6, 2, 'rgba(0,0,0,0.3)'); addCanvas(scene, 'shadow', c);
  }
  { // battle platforms
    const c = mkCanvas(80, 20); const p = new Pen(ctx2d(c)); p.ell(40, 10, 38, 8, '#00000044'); p.ell(40, 9, 36, 7, '#6a9a50'); p.ell(40, 8, 33, 5, '#8acc68'); addCanvas(scene, 'platform', c);
    const c2 = mkCanvas(80, 20); const p2 = new Pen(ctx2d(c2)); p2.ell(40, 10, 38, 8, '#00000044'); p2.ell(40, 9, 36, 7, '#586080'); p2.ell(40, 8, 33, 5, '#7a84a8'); addCanvas(scene, 'platform2', c2);
  }
  { // weather drops
    const c = mkCanvas(2, 6); const p = new Pen(ctx2d(c)); p.r(0, 0, 1, 5, '#9ac8f8'); addCanvas(scene, 'raindrop', c);
  }
  { // anomalous sparkle
    const c = mkCanvas(8, 8); const p = new Pen(ctx2d(c)); p.r(3, 0, 2, 8, '#fff6a0'); p.r(0, 3, 8, 2, '#fff6a0'); p.r(3, 3, 2, 2, '#fff'); addCanvas(scene, 'star', c);
  }
  void TILESET_COLS;
}
