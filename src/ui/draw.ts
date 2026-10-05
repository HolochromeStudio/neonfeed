import type Phaser from 'phaser';
import { bitmapPixels, RARITY_SHAPES } from './bitmaps';
import type { Bitmap } from './bitmaps';
import { C, RARITY } from './UiTheme';
import type { Rarity } from './types';

type G = Phaser.GameObjects.Graphics;

/** Deterministic hash -> 0..1 (no Math.random in UI visuals: previews and tests stay stable). */
export function hash01(a: number, b = 0, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) % 10000) / 10000;
}

export const rect = (g: G, color: number, x: number, y: number, w: number, h: number): void => {
  if (w <= 0 || h <= 0) return;
  g.fillStyle(color, 1);
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

/** Rect with the four corner pixels cut (notched corner, UX_FLOW: never smooth radii). */
export function notched(g: G, color: number, x: number, y: number, w: number, h: number, n = 1): void {
  rect(g, color, x + n, y, w - 2 * n, h);
  rect(g, color, x, y + n, w, h - 2 * n);
}

export function drawBitmap(g: G, rows: Bitmap, x: number, y: number, scale: number, color: number | ((ch: string) => number)): void {
  for (const p of bitmapPixels(rows)) {
    const c = typeof color === 'number' ? color : color(p.ch);
    rect(g, c, x + p.x * scale, y + p.y * scale, scale, scale);
  }
}

export function drawNail(g: G, x: number, y: number, light: number = C.brassLight): void {
  rect(g, C.ink, x, y, 4, 4);
  rect(g, C.brassDark, x + 1, y + 1, 2, 2);
  rect(g, light, x + 1, y + 1, 1, 1);
}

export interface PlankLook {
  boards: [number, number];
  trim: number;
  trimHi: number;
  trimLo: number;
  grain: number;
  hi: number;
}

export type PlankLookName = 'primary' | 'secondary' | 'danger' | 'disabled';
export const PLANK_LOOKS: Record<PlankLookName, PlankLook> = {
  primary: { boards: [C.woodLight, C.woodMid], trim: C.brass, trimHi: C.brassLight, trimLo: C.brassDark, grain: C.woodMid, hi: C.woodHi },
  secondary: { boards: [C.woodMid, C.wood], trim: C.brassDark, trimHi: C.brass, trimLo: C.wood, grain: C.wood, hi: C.woodLight },
  danger: { boards: [0x9a3a2c, C.redDark], trim: C.brass, trimHi: C.brassLight, trimLo: C.brassDark, grain: C.redDark, hi: C.red },
  disabled: { boards: [C.disabledFill, 0x2e241d], trim: C.parchmentBurn, trimHi: C.parchmentBurn, trimLo: C.woodDark, grain: 0x2e241d, hi: C.disabledFill },
};

/**
 * Wood plank sign with brass trim. Local coords (0,0) = top-left of the w x h hit box.
 * Idle: body (h-4) on top with a hard 4px shadow below; pressed: body shifted 2px down, no shadow.
 */
export function drawPlank(g: G, w: number, h: number, look: PlankLook, pressed: boolean, seed = 1): void {
  const bh = h - 4;
  const oy = pressed ? 2 : 0;
  if (!pressed) notched(g, C.ink, 0, 4, w, bh, 2);
  notched(g, C.ink, 0, oy, w, bh, 2);
  const top = Math.floor(bh / 2);
  rect(g, look.boards[0], 1, oy + 1, w - 2, top - 1);
  rect(g, look.boards[1], 1, oy + top + 1, w - 2, bh - top - 2);
  rect(g, look.hi, 3, oy + 1, w - 6, 1);
  rect(g, look.hi, 3, oy + top + 1, w - 6, 1);
  rect(g, C.ink, 1, oy + top, w - 2, 1);
  for (let i = 0; i < Math.floor(w / 28); i++) {
    const gx = 10 + Math.floor(hash01(seed, i, 1) * (w - 40));
    const gy = oy + 3 + Math.floor(hash01(seed, i, 2) * (top - 6));
    rect(g, look.grain, gx, gy, 6 + Math.floor(hash01(seed, i, 3) * 8), 1);
    const gy2 = oy + top + 3 + Math.floor(hash01(seed, i, 4) * Math.max(1, bh - top - 8));
    rect(g, look.grain, gx + 7, gy2, 5 + Math.floor(hash01(seed, i, 5) * 8), 1);
  }
  // brass trim: 2px frame, light top/left, dark bottom/right
  const x0 = 2, y0 = oy + 2, x1 = w - 4, y1 = oy + bh - 4;
  rect(g, look.trimHi, x0, y0, x1 - x0 + 2, 1);
  rect(g, look.trim, x0, y0 + 1, x1 - x0 + 2, 1);
  rect(g, look.trimHi, x0, y0, 1, y1 - y0 + 2);
  rect(g, look.trim, x0 + 1, y0 + 1, 1, y1 - y0);
  rect(g, look.trimLo, x0, y1 + 1, x1 - x0 + 2, 1);
  rect(g, look.trim, x0 + 1, y1, x1 - x0, 1);
  rect(g, look.trimLo, x1 + 1, y0, 1, y1 - y0 + 2);
  rect(g, look.trim, x1, y0 + 1, 1, y1 - y0);
  // nails in the four corners (inside the frame)
  const nl = look.trimHi;
  for (const [nx, ny] of [[5, 5], [w - 9, 5], [5, bh - 9], [w - 9, bh - 9]] as const) drawNail(g, nx, oy + ny, nl);
}

export interface ParchmentLook {
  fill?: number;
  burn?: number;
  stain?: number;
}

/** Torn parchment with a stepped, irregular burnt edge. Local top-left origin. */
export function drawParchment(g: G, w: number, h: number, seed = 1, look: ParchmentLook = {}): void {
  const fill = look.fill ?? C.parchment;
  const burn = look.burn ?? C.parchmentBurn;
  const stain = look.stain ?? C.parchmentDark;
  notched(g, C.ink, 0, 0, w, h, 2);
  notched(g, burn, 1, 1, w - 2, h - 2, 2);
  rect(g, fill, 3, 3, w - 6, h - 6);
  // irregular edge: stepped parchment bites into the burn band
  const seg = 6;
  for (let x = 4; x < w - 4; x += seg) {
    const t = hash01(seed, x, 1) < 0.5 ? 1 : 2;
    const b = hash01(seed, x, 2) < 0.5 ? 1 : 2;
    rect(g, burn, x, 2, Math.min(seg, w - 4 - x), t);
    rect(g, burn, x, h - 2 - b, Math.min(seg, w - 4 - x), b);
  }
  for (let y = 4; y < h - 4; y += seg) {
    const l = hash01(seed, y, 3) < 0.5 ? 1 : 2;
    const r = hash01(seed, y, 4) < 0.5 ? 1 : 2;
    rect(g, burn, 2, y, l, Math.min(seg, h - 4 - y));
    rect(g, burn, w - 2 - r, y, r, Math.min(seg, h - 4 - y));
  }
  // age stains
  const n = Math.max(3, Math.floor((w * h) / 2600));
  for (let i = 0; i < n; i++) {
    rect(g, stain, 6 + Math.floor(hash01(seed, i, 5) * (w - 20)), 6 + Math.floor(hash01(seed, i, 6) * (h - 14)), 4 + Math.floor(hash01(seed, i, 7) * 6), 2);
  }
}

/** Rarity card: parchment with a coloured border and corner shape studs (colour-blind safe cue). */
export function drawCard(g: G, w: number, h: number, rarity: Rarity, pressed: boolean, seed = 1): void {
  const st = RARITY[rarity];
  const oy = pressed ? 2 : 0;
  if (!pressed) notched(g, C.ink, 0, 4, w, h - 4, 2);
  const bh = h - 4;
  notched(g, C.ink, 0, oy, w, bh, 2);
  notched(g, st.border, 1, oy + 1, w - 2, bh - 2, 2);
  if (st.doubleBorder) {
    rect(g, C.ink, 4, oy + 4, w - 8, bh - 8);
    rect(g, C.brassDark, 5, oy + 5, w - 10, bh - 10);
  }
  const t = st.borderThickness + (st.doubleBorder ? 3 : 0);
  const inner = { x: 1 + t, y: oy + 1 + t, w: w - 2 - 2 * t, h: bh - 2 - 2 * t };
  rect(g, st.fill, inner.x, inner.y, inner.w, inner.h);
  // paper grain
  for (let i = 0; i < 6; i++) {
    rect(g, C.parchmentDark, inner.x + 4 + Math.floor(hash01(seed, i, 1) * (inner.w - 16)), inner.y + 4 + Math.floor(hash01(seed, i, 2) * (inner.h - 10)), 5 + Math.floor(hash01(seed, i, 3) * 6), 1);
  }
  // shape studs in the corners
  const shape = RARITY_SHAPES[st.shape];
  const col = rarity === 'common' ? C.parchmentBurn : rarity === 'rare' ? C.midnight : C.brassDark;
  for (const [sx, sy] of [[w - 17, oy + 1], [w - 17, oy + bh - 9]] as const) {
    if (rarity !== 'common') drawBitmap(g, shape, sx, sy, 1, col);
  }
}

/** Chain across a rect (unaffordable overlay): alternating links on both diagonals. */
export function drawChain(g: G, x0: number, y0: number, x1: number, y1: number, color: number = C.chalkDim): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const n = Math.max(2, Math.floor(len / 6));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + (dx * i) / n);
    const y = Math.round(y0 + (dy * i) / n);
    if (i % 2 === 0) { rect(g, C.ink, x - 3, y - 2, 6, 4); rect(g, color, x - 2, y - 1, 4, 2); } else { rect(g, C.ink, x - 2, y - 3, 4, 6); rect(g, color, x - 1, y - 2, 2, 4); }
  }
}

/** Slate (chalkboard) with a wood frame. */
export function drawSlate(g: G, w: number, h: number, seed = 1, framed = true): void {
  notched(g, C.ink, 0, 0, w, h, 2);
  if (framed) {
    notched(g, C.woodMid, 1, 1, w - 2, h - 2, 2);
    rect(g, C.woodHi, 2, 1, w - 4, 1);
    rect(g, C.wood, 3, 3, w - 6, h - 6);
    rect(g, C.ink, 3, 3, w - 6, h - 6);
    rect(g, C.slate, 4, 4, w - 8, h - 8);
  } else {
    rect(g, C.slate, 1, 1, w - 2, h - 2);
  }
  for (let i = 0; i < 5; i++) {
    rect(g, C.slateLight, 8 + Math.floor(hash01(seed, i, 1) * (w - 40)), 8 + Math.floor(hash01(seed, i, 2) * (h - 18)), 10 + Math.floor(hash01(seed, i, 3) * 20), 1);
  }
}

/** Wanted-poster style silhouette bust (no portrait art on disk yet: blocker B1). */
export function drawBust(g: G, cx: number, bottom: number, scale: number, seed: number, ink = C.ink, boss = false): void {
  const s = scale;
  const v = Math.floor(hash01(seed, 9) * 3);
  // shoulders
  rect(g, ink, cx - 14 * s, bottom - 8 * s, 28 * s, 8 * s);
  rect(g, ink, cx - 11 * s, bottom - 11 * s, 22 * s, 3 * s);
  // neck + head
  rect(g, ink, cx - 3 * s, bottom - 14 * s, 6 * s, 4 * s);
  rect(g, ink, cx - 7 * s, bottom - 24 * s, 14 * s, 11 * s);
  // hat
  const brim = v === 1 ? 24 : 20;
  rect(g, ink, cx - (brim / 2) * s, bottom - 26 * s, brim * s, 3 * s);
  rect(g, ink, cx - 7 * s, bottom - (v === 2 ? 36 : 33) * s, 14 * s, 8 * s);
  rect(g, C.parchmentDark, cx - 7 * s, bottom - 28 * s, 14 * s, 1 * s); // hat band
  // eyes + bandana variation
  rect(g, C.parchmentDark, cx - 4 * s, bottom - 20 * s, 2 * s, 1 * s);
  rect(g, C.parchmentDark, cx + 2 * s, bottom - 20 * s, 2 * s, 1 * s);
  if (v === 0) rect(g, C.redDark, cx - 7 * s, bottom - 15 * s, 14 * s, 3 * s);
  if (boss) {
    // star badge on the chest
    drawBitmap(g, RARITY_SHAPES.legendary, cx - 4 * s, bottom - 8 * s, s, C.brass);
  }
}
