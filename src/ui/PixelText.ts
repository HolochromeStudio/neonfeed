import Phaser from 'phaser';
import { ADVANCE, GLYPH_H, LINE_H, litPixels, measureText } from './pixelFont';
import type { Align } from './pixelFont';
import { C, hex } from './UiTheme';

export interface PixelTextStyle {
  /** Integer scale: 1,2,3,4 = 8,16,24,32 px line boxes. */
  scale?: number;
  color?: number;
  /** Hard drop shadow colour (offset = scale px), null for none. Default ink. */
  shadow?: number | null;
  /** 1-scale-px outline colour, null for none. */
  outline?: number | null;
  align?: Align;
  maxWidth?: number;
  maxLines?: number;
  originX?: number;
  originY?: number;
}

interface Resolved {
  scale: number; color: number; shadow: number | null; outline: number | null;
  align: Align; maxWidth: number | undefined; maxLines: number | undefined; originX: number; originY: number;
}

const resolve = (s: PixelTextStyle): Resolved => ({
  scale: Math.max(1, Math.round(s.scale ?? 2)),
  color: s.color ?? C.cream,
  shadow: s.shadow === undefined ? C.ink : s.shadow,
  outline: s.outline ?? null,
  align: s.align ?? 'left',
  maxWidth: s.maxWidth,
  maxLines: s.maxLines,
  originX: s.originX ?? 0,
  originY: s.originY ?? 0,
});

export interface PixelTextInfo { width: number; height: number; lines: number }

/** Build (or reuse) the canvas texture for a string; returns key, size and padding. */
function ensureTexture(scene: Phaser.Scene, text: string, r: Resolved): { key: string; w: number; h: number; padL: number; padT: number; box: PixelTextInfo } {
  const m = measureText(text, r.scale, r.maxWidth, r.maxLines);
  const s = r.scale;
  const padL = r.outline !== null ? s : 0;
  const padT = padL;
  const extraR = (r.outline !== null ? s : 0) + (r.shadow !== null ? s : 0);
  const w = Math.max(1, m.width + padL + extraR);
  const h = Math.max(1, m.height + padT + extraR);
  const key = `px|${s}|${r.color}|${r.shadow}|${r.outline}|${r.align}|${m.width}|${m.lines.join('\n')}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, w, h);
    if (tex) {
      const ctx = tex.getContext();
      ctx.clearRect(0, 0, w, h);
      const px = litPixels(m.lines, r.align);
      const paint = (color: number, dx: number, dy: number) => {
        ctx.fillStyle = hex(color);
        for (const [x, y] of px) ctx.fillRect(padL + x * s + dx, padT + y * s + dy, s, s);
      };
      if (r.outline !== null) {
        for (const [dx, dy] of [[-s, 0], [s, 0], [0, -s], [0, s]] as const) paint(r.outline, dx, dy);
        if (r.shadow !== null) paint(r.shadow, s, s);
      } else if (r.shadow !== null) paint(r.shadow, s, s);
      paint(r.color, 0, 0);
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }
  return { key, w, h, padL, padT, box: { width: m.width, height: m.height, lines: m.lines.length } };
}

function applyTo(img: Phaser.GameObjects.Image, scene: Phaser.Scene, text: string, r: Resolved): void {
  const t = ensureTexture(scene, text, r);
  if (scene.textures.exists(t.key)) img.setTexture(t.key);
  img.setOrigin((t.padL + r.originX * t.box.width) / t.w, (t.padT + r.originY * t.box.height) / t.h);
  img.setData('px', { style: r, info: t.box });
}

/** Crisp bitmap-font text as an Image. Position is snapped to whole pixels. */
export function pixelText(scene: Phaser.Scene, x: number, y: number, text: string, style: PixelTextStyle = {}): Phaser.GameObjects.Image {
  const r = resolve(style);
  const img = scene.add.image(Math.round(x), Math.round(y), '__DEFAULT');
  applyTo(img, scene, text, r);
  return img;
}

export function setPixelText(img: Phaser.GameObjects.Image, text: string): void {
  const d = img.getData('px') as { style: Resolved } | undefined;
  if (!d) return;
  applyTo(img, img.scene, text, d.style);
}

/** Logical-pixel size of the text box (without shadow/outline padding). */
export function pixelTextSize(img: Phaser.GameObjects.Image): PixelTextInfo {
  const d = img.getData('px') as { info: PixelTextInfo } | undefined;
  return d?.info ?? { width: img.width, height: img.height, lines: 1 };
}

export const PX = { ADVANCE, GLYPH_H, LINE_H };
