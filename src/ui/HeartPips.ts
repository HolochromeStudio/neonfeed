import type Phaser from 'phaser';
import { HEART_EMPTY, HEART_FULL } from './bitmaps';
import { drawBitmap } from './draw';
import { C } from './UiTheme';

const FULL: Record<string, number> = { r: C.red, R: C.redDark, h: 0xff9a86 };
const EMPTY: Record<string, number> = { k: C.parchmentBurn };

export interface HeartPipsConfig {
  x: number;
  y: number;
  max: number;
  current: number;
  /** Pixel scale of one 8x8 heart (2 = 16 px). */
  scale?: number;
}

/** Hearts: filled vs hollow outline (shape differs, not just colour). */
export class HeartPips {
  readonly gfx: Phaser.GameObjects.Graphics;
  private max: number;
  private cur: number;
  private readonly scale: number;
  private readonly x: number;
  private readonly y: number;

  constructor(scene: Phaser.Scene, cfg: HeartPipsConfig) {
    this.gfx = scene.add.graphics();
    this.max = cfg.max;
    this.cur = cfg.current;
    this.scale = cfg.scale ?? 2;
    this.x = Math.round(cfg.x);
    this.y = Math.round(cfg.y);
    this.draw();
  }

  get width(): number { return this.max * (8 * this.scale + 2) - 2; }

  set(current: number, max = this.max): void {
    this.cur = current;
    this.max = max;
    this.draw();
  }

  private draw(): void {
    this.gfx.clear();
    const s = this.scale;
    for (let i = 0; i < this.max; i++) {
      const full = i < this.cur;
      drawBitmap(this.gfx, full ? HEART_FULL : HEART_EMPTY, this.x + i * (8 * s + 2), this.y, s, (ch) => (full ? FULL[ch] : EMPTY[ch]) ?? C.red);
    }
  }
}
