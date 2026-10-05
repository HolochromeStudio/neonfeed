import Phaser from 'phaser';
import { lineWidth } from './pixelFont';
import { pixelText } from './PixelText';
import { C } from './UiTheme';

export interface StampConfig {
  x: number;
  y: number;
  text: string;
  scale?: number;
  color?: number;
  /** Degrees, 2-4 either way per UX_FLOW. */
  angle?: number;
  /** Slam in (scale 2 -> 1 over 90 ms) unless reduceMotion. */
  slam?: boolean;
  reduceMotion?: boolean;
  depth?: number;
}

/** Rubber-stamp word in a double border, slightly rotated. Centre anchored. */
export function stampText(scene: Phaser.Scene, cfg: StampConfig): Phaser.GameObjects.Container {
  const s = cfg.scale ?? 3;
  const color = cfg.color ?? C.redDark;
  const tw = lineWidth(cfg.text, s);
  const pad = 3 * s;
  const w = tw + pad * 2;
  const h = 7 * s + pad * 2;
  const g = scene.add.graphics();
  g.lineStyle(s, color, 1);
  g.strokeRect(-w / 2, -h / 2, w, h);
  g.lineStyle(1, color, 1);
  g.strokeRect(-w / 2 + s + 2, -h / 2 + s + 2, w - 2 * (s + 2), h - 2 * (s + 2));
  const t = pixelText(scene, 0, 0, cfg.text, { scale: s, color, shadow: null, originX: 0.5, originY: 0.5 });
  const c = scene.add.container(Math.round(cfg.x), Math.round(cfg.y), [g, t]);
  c.setAngle(cfg.angle ?? -3);
  if (cfg.depth !== undefined) c.setDepth(cfg.depth);
  if (cfg.slam && !cfg.reduceMotion) {
    c.setScale(2).setAlpha(0);
    scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 90, ease: 'Linear' });
  }
  return c;
}
