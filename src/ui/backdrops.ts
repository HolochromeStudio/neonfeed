import type Phaser from 'phaser';
import { TOWN_KEY, PLACEHOLDER_KEY, hasFrame } from './assets';
import { drawBitmap, hash01, notched, rect } from './draw';
import { ICON_BITMAPS } from './bitmaps';
import { LOGICAL_H, LOGICAL_W } from './layout';
import { C, SKY_BANDS } from './UiTheme';

/** Dark plank wall: staggered horizontal boards, seams, end nails. Full-bleed 360x640. */
export function paintWoodWall(scene: Phaser.Scene, seed = 1, y0 = 0, y1 = LOGICAL_H, depth = 0): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  const tones = [C.woodDark, C.wood, C.woodDeep, C.woodDark];
  const rowH = 32;
  for (let y = y0, r = 0; y < y1; y += rowH, r++) {
    const h = Math.min(rowH, y1 - y);
    const tone = tones[Math.floor(hash01(seed, r, 1) * tones.length)]!;
    rect(g, tone, 0, y, LOGICAL_W, h);
    rect(g, C.ink, 0, y + h - 2, LOGICAL_W, 2);
    rect(g, C.woodMid, 0, y, LOGICAL_W, 1);
    // joints: board ends at staggered positions
    let x = Math.floor(hash01(seed, r, 2) * 140) + 30;
    while (x < LOGICAL_W) {
      rect(g, C.ink, x, y, 2, h - 2);
      rect(g, C.woodDeep, x + 2, y + 1, 1, h - 3);
      for (const ny of [y + 5, y + h - 11]) { rect(g, C.ink, x - 7, ny, 3, 3); rect(g, C.woodLight, x - 6, ny + 1, 1, 1); rect(g, C.ink, x + 6, ny, 3, 3); rect(g, C.woodLight, x + 7, ny + 1, 1, 1); }
      x += 150 + Math.floor(hash01(seed, x, r) * 90);
    }
    for (let i = 0; i < 7; i++) {
      rect(g, C.woodDeep, Math.floor(hash01(seed, r, 10 + i) * LOGICAL_W), y + 4 + Math.floor(hash01(seed, r, 20 + i) * (h - 10)), 10 + Math.floor(hash01(seed, r, 30 + i) * 22), 1);
    }
  }
  return g;
}

/** Stepped dusk sky with a pixel sun, stars and mesas down to y = ground. */
export function paintDusk(scene: Phaser.Scene, ground: number, depth = 0): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  const bandH = Math.ceil(ground / SKY_BANDS.length);
  SKY_BANDS.forEach((c, i) => rect(g, c, 0, i * bandH, LOGICAL_W, bandH + 1));
  for (let i = 0; i < 26; i++) rect(g, C.cream, Math.floor(hash01(5, i, 1) * LOGICAL_W), 30 + Math.floor(hash01(5, i, 2) * 110), 1 + (i % 7 === 0 ? 1 : 0), 1 + (i % 7 === 0 ? 1 : 0));
  // sun: stepped half disc
  const sx = 262, sy = ground - 52, R = 34;
  for (let r = R; r > 0; r -= 6) {
    const col = r > 26 ? 0xe9893c : r > 14 ? 0xf2a24a : 0xf8c870;
    for (let dy = -r; dy <= 0; dy += 2) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy));
      rect(g, col, sx - half, sy + dy, half * 2, 2);
    }
  }
  // mesas
  const prof = [40, 40, 52, 58, 58, 48, 30, 22, 22, 40, 64, 64, 70, 54, 36, 30, 30, 44, 44, 26];
  prof.forEach((hgt, i) => rect(g, 0x3a2036, i * 18, ground - hgt - 8, 18, hgt + 8));
  prof.forEach((hgt, i) => rect(g, 0x2c1830, i * 18, ground - Math.floor(hgt * 0.55), 18, Math.floor(hgt * 0.55)));
  return g;
}

/** Sand street from `top` to `bottom`. */
export function paintSand(scene: Phaser.Scene, top: number, bottom: number, depth = 0): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  rect(g, C.sand, 0, top, LOGICAL_W, bottom - top);
  rect(g, C.sandLight, 0, top, LOGICAL_W, 2);
  for (let i = 0; i < 40; i++) rect(g, C.sandDark, Math.floor(hash01(8, i, 1) * LOGICAL_W), top + 4 + Math.floor(hash01(8, i, 2) * (bottom - top - 6)), 6 + Math.floor(hash01(8, i, 3) * 16), 1);
  return g;
}

/** Boardwalk foreground: dark planks with a lit front lip. */
export function paintBoardwalk(scene: Phaser.Scene, top: number, depth = 0): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  rect(g, C.ink, 0, top - 2, LOGICAL_W, 2);
  rect(g, C.woodHi, 0, top, LOGICAL_W, 3);
  rect(g, C.woodLight, 0, top + 3, LOGICAL_W, 3);
  rect(g, C.ink, 0, top + 6, LOGICAL_W, 2);
  const rowH = 28;
  const tones = [C.woodDark, C.woodDeep, C.wood];
  for (let y = top + 8, r = 0; y < LOGICAL_H; y += rowH, r++) {
    const h = Math.min(rowH, LOGICAL_H - y);
    rect(g, tones[Math.floor(hash01(2, r, 1) * 3)]!, 0, y, LOGICAL_W, h);
    rect(g, C.ink, 0, y + h - 2, LOGICAL_W, 2);
    rect(g, C.woodMid, 0, y, LOGICAL_W, 1);
    let x = 20 + Math.floor(hash01(2, r, 2) * 120);
    while (x < LOGICAL_W) {
      rect(g, C.ink, x, y, 2, h - 2);
      x += 120 + Math.floor(hash01(2, x, r) * 100);
    }
    for (let i = 0; i < 6; i++) rect(g, C.woodDeep, Math.floor(hash01(2, r, 10 + i) * LOGICAL_W), y + 4 + Math.floor(hash01(2, r, 20 + i) * (h - 10)), 12 + Math.floor(hash01(2, r, 30 + i) * 20), 1);
  }
  return g;
}

/** Hanging title sign: two chains from the top, a plank with brass trim. Returns the plank rect. */
export function paintHangingSign(scene: Phaser.Scene, x: number, y: number, w: number, h: number, depth = 5): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  for (const cx of [x + 24, x + w - 28]) {
    for (let cy = 0; cy < y + 6; cy += 6) {
      if ((cy / 6) % 2 === 0) { rect(g, C.ink, cx - 2, cy, 5, 6); rect(g, C.chalkDim, cx - 1, cy + 1, 3, 4); } else { rect(g, C.ink, cx - 1, cy, 3, 6); rect(g, C.chalkDim, cx, cy + 1, 1, 4); }
    }
  }
  notched(g, C.ink, x, y + 4, w, h, 2);
  notched(g, C.ink, x, y, w, h, 2);
  rect(g, C.woodMid, x + 1, y + 1, w - 2, Math.floor(h / 2) - 1);
  rect(g, C.wood, x + 1, y + Math.floor(h / 2) + 1, w - 2, h - Math.floor(h / 2) - 2);
  rect(g, C.ink, x + 1, y + Math.floor(h / 2), w - 2, 1);
  rect(g, C.woodLight, x + 3, y + 1, w - 6, 1);
  rect(g, C.brass, x + 3, y + 3, w - 6, 2);
  rect(g, C.brass, x + 3, y + h - 5, w - 6, 2);
  rect(g, C.brassLight, x + 3, y + 3, w - 6, 1);
  rect(g, C.brassDark, x + 3, y + h - 4, w - 6, 1);
  for (const [nx, ny] of [[x + 7, y + 8], [x + w - 11, y + 8], [x + 7, y + h - 13], [x + w - 11, y + h - 13]] as const) { rect(g, C.ink, nx, ny, 4, 4); rect(g, C.brassLight, nx + 1, ny + 1, 2, 2); }
  return g;
}

/** Town props for the menu street (only when the atlas is present). */
export function paintStreetProps(scene: Phaser.Scene, ground: number): void {
  const put = (frame: string, x: number, y: number, depth: number, flip = false) => {
    if (!hasFrame(scene, TOWN_KEY, frame)) return;
    scene.add.image(Math.round(x), Math.round(y), TOWN_KEY, frame).setOrigin(0.5, 1).setDepth(depth).setFlipX(flip);
  };
  put('saloon_front', 188, ground, 1);
  put('cactus_tall', 36, ground + 6, 2);
  put('hitching_rail', 318, ground + 14, 3);
  put('barrel_a', 104, ground + 4, 2);
  if (scene.textures.exists(PLACEHOLDER_KEY) && hasFrame(scene, PLACEHOLDER_KEY, 'hero_idle_0')) {
    scene.add.sprite(76, ground + 12, PLACEHOLDER_KEY, 'hero_idle_0').setOrigin(0.5, 1).setScale(2).setDepth(4);
  }
}

/** Little padlock/star pictograms are reused by scenes. */
export function paintIcon(scene: Phaser.Scene, kind: keyof typeof ICON_BITMAPS, x: number, y: number, scale: number, color: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawBitmap(g, ICON_BITMAPS[kind], x, y, scale, color);
  return g;
}
