import Phaser from 'phaser';
import { anchorFor } from '../data/animations';
import type { ArenaDef, ArenaLayer, LayerItem, Pt, TargetZone } from '../data/arenas/types';
import { ARENA_W } from '../data/arenas/types';

/**
 * Builds an ArenaDef into Phaser game objects (A11).
 * - Integer positions, scale 1 (DECISIONS D9). No DuelScene dependency.
 * - Procedural items (bands/ridge/rect/speckle/disc/lights) are PLACEHOLDER art
 *   drawn with Graphics until the desert terrain sheet lands (blocker B1).
 */

export const ARENA_ATLAS = 'town';

export interface ArenaHandle {
  readonly def: ArenaDef;
  readonly heroPos: Pt;
  readonly enemyPos: Pt;
  readonly targetZones: readonly TargetZone[];
  /** The sprite carrying a target (for hit effects), by target id. */
  targetObject(id: string): Phaser.GameObjects.Image | undefined;
  /** Optional parallax: shift layers by (1 - parallax) * scrollX, rounded. Not used by the static duel. */
  setScroll(scrollX: number): void;
  destroy(): void;
}

/** Deterministic PRNG so placeholder art is stable between runs. */
function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawItem(g: Phaser.GameObjects.Graphics, it: Exclude<LayerItem, { type: 'stamp' }>): void {
  switch (it.type) {
    case 'bands': {
      const n = it.colors.length;
      for (let i = 0; i < n; i++) {
        const y0 = Math.round((it.h * i) / n);
        const y1 = Math.round((it.h * (i + 1)) / n);
        g.fillStyle(it.colors[i]!, 1).fillRect(0, it.y + y0, ARENA_W, y1 - y0);
      }
      break;
    }
    case 'rect':
      g.fillStyle(it.color, 1).fillRect(0, it.y, ARENA_W, it.h);
      break;
    case 'ridge': {
      const step = it.step ?? 6;
      const r = rng(it.seed);
      g.fillStyle(it.color, 1);
      let h = it.h * 0.5;
      for (let x = 0; x < ARENA_W; x += step) {
        h = Math.max(it.h * 0.25, Math.min(it.h, h + (r() - 0.5) * it.h * 0.45));
        const hh = Math.round(h);
        g.fillRect(x, it.y - hh, step, hh);
      }
      break;
    }
    case 'disc':
      g.fillStyle(it.color, 1).fillCircle(it.x, it.y, it.r);
      break;
    case 'speckle': {
      const r = rng(it.seed);
      g.fillStyle(it.color, 1);
      for (let i = 0; i < it.count; i++) {
        const w = 2 + Math.floor(r() * 4);
        g.fillRect(Math.floor(r() * ARENA_W), it.y + Math.floor(r() * it.h), w, 2);
      }
      break;
    }
  }
}

export function buildArena(scene: Phaser.Scene, def: ArenaDef, atlas: string = ARENA_ATLAS): ArenaHandle {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const parallax: { obj: Phaser.GameObjects.GameObject & { x: number }; baseX: number; factor: number }[] = [];
  const targets = new Map<string, Phaser.GameObjects.Image>();
  const tint = def.tint ?? 0xffffff;

  const track = <T extends Phaser.GameObjects.GameObject & { x: number }>(o: T, factor: number): T => {
    objs.push(o);
    parallax.push({ obj: o, baseX: o.x, factor });
    return o;
  };

  const buildLayer = (l: ArenaLayer): void => {
    const g = scene.add.graphics().setDepth(l.depth);
    let hasGfx = false;
    for (const it of l.items) {
      if (it.type === 'stamp') {
        // WORKAROUND (A04 asset issue): tile frames carry a 1px light halo on every edge, which shows
        // as seams when stamped side by side. Crop 1px per side and pitch by (size - 2) so seams vanish.
        // Remove once A04 normalises tiles (DECISIONS D9). (x,y) is the top-left of the visible area.
        for (let r = 0; r < it.rows; r++) {
          for (let c = 0; c < it.cols; c++) {
            const img = scene.add.image(0, 0, atlas, it.frame).setOrigin(0, 0).setDepth(l.depth);
            const w = img.width;
            const h = img.height;
            img.setCrop(1, 1, w - 2, h - 2);
            img.setPosition(Math.round(it.x + c * (it.stepX ?? w - 2)) - 1, Math.round(it.y + r * (it.stepY ?? h - 2)) - 1);
            if (tint !== 0xffffff) img.setTint(tint);
            track(img, l.parallax);
          }
        }
      } else {
        drawItem(g, it);
        hasGfx = true;
      }
    }
    if (hasGfx) track(g, l.parallax);
    else g.destroy();
  };
  def.layers.forEach(buildLayer);

  for (const p of def.props) {
    const a = p.anchor ?? anchorFor(p.frame);
    const img = scene.add.image(Math.round(p.x), Math.round(p.y), atlas, p.frame).setOrigin(a.x, a.y).setDepth(p.depth);
    if (p.flip) img.setFlipX(true);
    if (tint !== 0xffffff && !p.bright) img.setTint(tint);
    objs.push(img);
    if (p.id) targets.set(p.id, img);
  }

  // PLACEHOLDER light glows: concentric additive discs, integer radii.
  for (const L of def.lights ?? []) {
    const g = scene.add.graphics().setDepth(L.depth).setBlendMode(Phaser.BlendModes.ADD);
    const rings = 6;
    for (let i = 0; i < rings; i++) {
      const rr = Math.round(L.r * (1 - i / rings));
      g.fillStyle(L.color, (L.alpha / rings) * 1).fillCircle(L.x, L.y, rr);
    }
    objs.push(g);
  }

  const targetZones: TargetZone[] = def.targetZones.map((t) => ({ id: t.id, effect: t.effect, ...t.rect }));
  const byTarget = new Map(def.targetZones.map((t) => [t.id, t.propId] as const));

  return {
    def,
    heroPos: { x: def.heroZone.x, y: def.heroZone.y },
    enemyPos: { x: def.enemyZone.x, y: def.enemyZone.y },
    targetZones,
    targetObject: (id) => {
      const pid = byTarget.get(id);
      return pid ? targets.get(pid) : undefined;
    },
    setScroll(scrollX) {
      for (const p of parallax) p.obj.x = Math.round(p.baseX + scrollX * (1 - p.factor));
    },
    destroy() {
      for (const o of objs) o.destroy();
      objs.length = 0;
      parallax.length = 0;
      targets.clear();
    },
  };
}

