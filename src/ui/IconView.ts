import type Phaser from 'phaser';
import { TOWN_KEY, hasFrame } from './assets';
import { drawBitmap } from './draw';
import { ICON_BITMAPS } from './bitmaps';
import type { IconRef } from './types';
import { C } from './UiTheme';

/**
 * Draw an icon into a size x size cell at (x,y): a 'town' atlas frame when given and present
 * (fitted at integer scale, never upscaled blurry), otherwise the procedural pictogram.
 */
export function drawIcon(scene: Phaser.Scene, ref: IconRef | undefined, x: number, y: number, size: number, color: number = C.ink, depth?: number): Phaser.GameObjects.GameObject {
  if (ref?.frame && hasFrame(scene, TOWN_KEY, ref.frame)) {
    const img = scene.add.image(Math.round(x + size / 2), Math.round(y + size / 2), TOWN_KEY, ref.frame);
    const k = Math.min(size / img.width, size / img.height);
    img.setScale(k >= 1 ? Math.floor(k) : k);
    if (depth !== undefined) img.setDepth(depth);
    return img;
  }
  const g = scene.add.graphics();
  const scale = Math.max(1, Math.floor(size / 8));
  const off = Math.floor((size - 8 * scale) / 2);
  drawBitmap(g, ICON_BITMAPS[ref?.kind ?? 'star'], x + off, y + off, scale, color);
  if (depth !== undefined) g.setDepth(depth);
  return g;
}
