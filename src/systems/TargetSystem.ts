import type { ZoneId } from '../data/duelConfig';
import { DUEL_CONFIG } from '../data/duelConfig';
import type { Rect } from './InputSystem';
import { pointInRect } from './InputSystem';

export interface Zone {
  id: ZoneId;
  rect: Rect;
  multiplier: number;
  /** Prop zones carry their identifier (barrel, lantern...). */
  propId?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface HitResult {
  zone: Zone | null;
  /** True if a zone was chosen only because of aim assist. */
  assisted: boolean;
}

/** Priority when zones overlap: precise parts first. */
const PRIORITY: ZoneId[] = ['head', 'limb', 'prop', 'body'];

/** Builds the enemy's zones from its bounding rect (top-left origin) plus arena props. */
export function buildZones(
  enemyRect: Rect,
  props: readonly { id: string; x: number; y: number; w: number; h: number }[] = [],
  cfg = DUEL_CONFIG,
): Zone[] {
  const zones: Zone[] = [];
  for (const id of ['head', 'body', 'limb'] as const) {
    const l = cfg.zoneLayout[id];
    zones.push({
      id,
      rect: { x: enemyRect.x + l.x * enemyRect.w, y: enemyRect.y + l.y * enemyRect.h, w: l.w * enemyRect.w, h: l.h * enemyRect.h },
      multiplier: cfg.zones[id].multiplier,
    });
  }
  for (const p of props) {
    zones.push({ id: 'prop', rect: { x: p.x, y: p.y, w: p.w, h: p.h }, multiplier: cfg.zones.prop.multiplier, propId: p.id });
  }
  return zones;
}

export function distanceToRect(p: Point, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

function rank(z: Zone): number {
  return PRIORITY.indexOf(z.id);
}

/**
 * Hit test a reticle point. Exact containment wins (by priority); otherwise the
 * nearest zone within `assistRadius` (aim assist; ties go to higher priority).
 */
export function hitTest(zones: readonly Zone[], point: Point, assistRadius = 0): HitResult {
  let exact: Zone | null = null;
  for (const z of zones) {
    if (pointInRect(point.x, point.y, z.rect) && (exact === null || rank(z) < rank(exact))) exact = z;
  }
  if (exact) return { zone: exact, assisted: false };
  if (assistRadius > 0) {
    let best: Zone | null = null;
    let bestD = Infinity;
    for (const z of zones) {
      const d = distanceToRect(point, z.rect);
      if (d <= assistRadius && (d < bestD || (d === bestD && best !== null && rank(z) < rank(best)))) {
        best = z;
        bestD = d;
      }
    }
    if (best) return { zone: best, assisted: true };
  }
  return { zone: null, assisted: false };
}
