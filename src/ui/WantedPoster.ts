import Phaser from 'phaser';
import { getWanted, formatReward } from '../data/wanted';
import type { WantedEntry } from '../data/wanted';
import { drawBust, drawNail, drawParchment, rect } from './draw';
import { clipChars } from './layout';
import { measureText } from './pixelFont';
import { pixelText } from './PixelText';
import { S } from './strings';
import { C } from './UiTheme';

export interface WantedPosterConfig {
  x: number;
  y: number;
  w: number;
  h: number;
  /** wanted.ts id or a full entry. Unknown ids render a generic "UNKNOWN OUTLAW". */
  target: string | WantedEntry;
  /** Show the reward line (default true). */
  showReward?: boolean;
  /** Slight tilt in degrees (nailed posters hang a little off). */
  angle?: number;
  depth?: number;
}

const FALLBACK: WantedEntry = { id: 'unknown', kind: 'enemy', name: 'Unknown Outlaw', crime: 'Unknown', reward: 0, tagline: '' };

/** Deterministic seed from a string (so each outlaw always gets the same bust). */
export function seedOf(id: string): number {
  let h = 7;
  for (const ch of id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** Wanted poster (parchment, nails, silhouette bust, name, reward). Top-left anchored; centre-pivot tilt. */
export function wantedPoster(scene: Phaser.Scene, cfg: WantedPosterConfig): Phaser.GameObjects.Container {
  const entry = typeof cfg.target === 'string' ? (getWanted(cfg.target) ?? FALLBACK) : cfg.target;
  const { w, h } = cfg;
  const seed = seedOf(entry.id);
  const boss = entry.kind === 'boss';
  const kids: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Graphics> = [];
  const g = scene.add.graphics();
  drawParchment(g, w, h, seed % 97, boss ? { fill: C.parchmentLight } : {});
  kids.push(g);

  const headScale = w >= 150 ? 3 : 2;
  kids.push(pixelText(scene, w / 2, 12, S.wanted, { scale: headScale, color: C.ink, shadow: null, align: 'center', originX: 0.5 }));
  const headBottom = 12 + 7 * headScale;

  const showReward = cfg.showReward !== false && entry.reward > 0;
  const name = measureText(entry.name, 2, w - 20, 2);
  const nameH = name.height;
  const rewardH = showReward ? 14 + 6 : 0;
  const portTop = headBottom + 6;
  const portH = Math.max(24, h - portTop - 6 - nameH - 4 - rewardH - 10);
  const pg = scene.add.graphics();
  rect(pg, C.ink, 10, portTop, w - 20, portH);
  rect(pg, C.parchmentDark, 12, portTop + 2, w - 24, portH - 4);
  rect(pg, C.parchment, 14, portTop + 4, w - 28, portH - 8);
  drawBust(pg, Math.round(w / 2), portTop + portH - 4, Math.max(1, Math.min(3, Math.floor((portH - 8) / 36))), seed, C.ink, boss);
  for (const [nx, ny] of [[5, 5], [w - 9, 5]] as const) drawNail(pg, nx, ny);
  kids.push(pg);

  const nameTop = portTop + portH + 6;
  kids.push(pixelText(scene, w / 2, nameTop, entry.name, { scale: 2, color: C.ink, shadow: null, align: 'center', originX: 0.5, maxWidth: w - 20, maxLines: 2 }));
  if (showReward) {
    kids.push(pixelText(scene, w / 2, nameTop + nameH + 4, clipChars(formatReward(entry.reward), Math.floor((w - 16) / 12)), { scale: 2, color: C.redDark, shadow: null, align: 'center', originX: 0.5 }));
  }

  const c = scene.add.container(Math.round(cfg.x + w / 2), Math.round(cfg.y + h / 2), kids);
  for (const k of kids) k.setPosition(k.x - w / 2, k.y - h / 2);
  c.setSize(w, h);
  if (cfg.angle) c.setAngle(cfg.angle);
  if (cfg.depth !== undefined) c.setDepth(cfg.depth);
  return c;
}
