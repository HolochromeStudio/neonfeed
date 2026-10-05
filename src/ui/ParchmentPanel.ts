import Phaser from 'phaser';
import { drawNail, drawParchment } from './draw';
import type { ParchmentLook } from './draw';
import type { Rect } from './layout';
import { pixelText } from './PixelText';
import { C } from './UiTheme';

export interface ParchmentPanelConfig {
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  seed?: number;
  nails?: boolean;
  look?: ParchmentLook;
  depth?: number;
}

/** Torn parchment sheet with stepped edges, optional title and corner nails. Top-left anchored. */
export class ParchmentPanel {
  readonly container: Phaser.GameObjects.Container;
  /** Inner rect (absolute logical px) where content may be placed. */
  readonly content: Rect;

  constructor(scene: Phaser.Scene, cfg: ParchmentPanelConfig) {
    const g = scene.add.graphics();
    drawParchment(g, cfg.w, cfg.h, cfg.seed ?? 3, cfg.look);
    const kids: Phaser.GameObjects.GameObject[] = [g];
    if (cfg.nails !== false) {
      const n = scene.add.graphics();
      for (const [nx, ny] of [[5, 5], [cfg.w - 9, 5]] as const) drawNail(n, nx, ny);
      kids.push(n);
    }
    let top = 8;
    if (cfg.title) {
      const t = pixelText(scene, cfg.w / 2, 10, cfg.title, { scale: 2, color: C.ink, shadow: null, align: 'center', originX: 0.5, maxWidth: cfg.w - 24, maxLines: 1 });
      const rule = scene.add.graphics();
      rule.fillStyle(C.parchmentBurn, 1);
      rule.fillRect(12, 30, cfg.w - 24, 1);
      rule.fillRect(12, 33, cfg.w - 24, 1);
      kids.push(t, rule);
      top = 40;
    }
    this.container = scene.add.container(Math.round(cfg.x), Math.round(cfg.y), kids);
    if (cfg.depth !== undefined) this.container.setDepth(cfg.depth);
    this.content = { x: Math.round(cfg.x) + 10, y: Math.round(cfg.y) + top, w: cfg.w - 20, h: cfg.h - top - 8 };
  }

  destroy(): void {
    this.container.destroy();
  }
}
