import { anchorFor } from '../animations';
import {
  ARENA_DEPTH, ARENA_H, ARENA_W, ZONE_H, ZONE_W,
  type ArenaDef, type ArenaProp, type AtlasFrames, type Pt, type Rect,
} from './types';

/** Clearance (px) kept around hero/enemy rects so silhouettes read. */
export const ZONE_MARGIN = 2;

export function characterRect(feet: Pt): Rect {
  return { x: feet.x - ZONE_W / 2, y: feet.y - ZONE_H, w: ZONE_W, h: ZONE_H };
}

export function propRect(p: ArenaProp, frames: AtlasFrames): Rect | null {
  const f = frames[p.frame];
  if (!f) return null;
  const a = p.anchor ?? anchorFor(p.frame);
  const ax = p.flip ? 1 - a.x : a.x;
  return { x: p.x - f.w * ax, y: p.y - f.h * a.y, w: f.w, h: f.h };
}

export function rectsOverlap(a: Rect, b: Rect, pad = 0): boolean {
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}

const inside = (r: Rect, w = ARENA_W, h = ARENA_H) => r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h;
const isInt = (n: number) => Number.isInteger(n);

/** Returns a list of problems; empty means the arena is valid. */
export function validateArena(def: ArenaDef, atlasFrames: AtlasFrames): string[] {
  const errs: string[] = [];
  const err = (m: string) => errs.push(`${def.id}: ${m}`);
  const D = ARENA_DEPTH;

  // frames exist
  const need = (frame: string, where: string) => { if (!atlasFrames[frame]) err(`unknown frame '${frame}' (${where})`); };
  def.props.forEach((p, i) => need(p.frame, `prop ${p.id ?? i}`));
  def.layers.forEach((l) => l.items.forEach((it) => { if (it.type === 'stamp') need(it.frame, `layer ${l.id}`); }));

  // integer positions
  def.props.forEach((p, i) => { if (!isInt(p.x) || !isInt(p.y)) err(`prop ${p.id ?? i} has non-integer position`); });
  for (const [n, z] of [['heroZone', def.heroZone], ['enemyZone', def.enemyZone]] as const) {
    if (!isInt(z.x) || !isInt(z.y)) err(`${n} not integer`);
  }

  // unique ids
  const ids = new Set<string>();
  def.props.forEach((p) => { if (p.id) { if (ids.has(p.id)) err(`duplicate prop id '${p.id}'`); ids.add(p.id); } });
  const layerIds = new Set<string>();
  def.layers.forEach((l) => { if (layerIds.has(l.id)) err(`duplicate layer id '${l.id}'`); layerIds.add(l.id); });

  // zones on screen, below the horizon, enemy deeper than hero is not required
  const hero = characterRect(def.heroZone);
  const enemy = characterRect(def.enemyZone);
  if (!inside(hero)) err('heroZone rect leaves the screen');
  if (!inside(enemy)) err('enemyZone rect leaves the screen');
  if (def.heroZone.y <= def.groundY || def.enemyZone.y <= def.groundY) err('hero/enemy feet must be below groundY');
  if (rectsOverlap(hero, enemy)) err('hero and enemy zones overlap');
  if (def.groundY <= 0 || def.groundY >= ARENA_H) err('groundY out of range');
  // keep the holster UI band (y 520..616) free of hero feet
  if (def.heroZone.y >= 520 || def.enemyZone.y >= 520) err('zones must sit above the holster band (y<520)');

  // central lane between the two duellists, enemy silhouette band
  const left = Math.min(hero.x + hero.w, enemy.x + enemy.w);
  const right = Math.max(hero.x, enemy.x);
  const lane: Rect = { x: left, y: enemy.y, w: Math.max(0, right - left), h: enemy.h };

  // props
  def.props.forEach((p, i) => {
    const name = p.id ?? `${p.frame}#${i}`;
    const r = propRect(p, atlasFrames);
    if (!r) return;
    if (!p.bleed && !inside(r)) err(`prop ${name} out of bounds`);
    if (p.bleed && (r.x + r.w <= 0 || r.x >= ARENA_W)) err(`prop ${name} entirely off-screen`);
    if (rectsOverlap(r, hero, ZONE_MARGIN)) err(`prop ${name} overlaps hero zone`);
    if (rectsOverlap(r, enemy, ZONE_MARGIN)) err(`prop ${name} overlaps enemy zone`);
    if (!p.backdrop && lane.w > 0 && rectsOverlap(r, lane)) err(`prop ${name} blocks the central duel lane`);
    const back = p.depth >= D.propBackMin && p.depth <= D.propBackMax;
    const front = p.depth >= D.propFrontMin && p.depth <= D.propFrontMax;
    if (!isInt(p.depth) || (!back && !front)) err(`prop ${name} depth ${p.depth} outside back [${D.propBackMin},${D.propBackMax}] / front [${D.propFrontMin},${D.propFrontMax}]`);
    if (front && !p.backdrop) {
      // a front prop must really be in front of someone: its base is below a character's feet line
      if (p.y < Math.min(def.heroZone.y, def.enemyZone.y)) err(`front prop ${name} sits behind both duellists`);
    }
  });

  // layers
  def.layers.forEach((l) => {
    if (!(l.parallax > 0 && l.parallax <= 1)) err(`layer ${l.id} parallax must be in (0,1]`);
    if (!isInt(l.depth)) err(`layer ${l.id} depth not integer`);
    if (l.kind === 'foreground') {
      if (l.depth < D.propFrontMin || l.depth > D.propFrontMax) err(`foreground layer ${l.id} depth must be in front range`);
    } else if (l.depth < D.sky || l.depth >= D.propBackMin) {
      err(`layer ${l.id} depth ${l.depth} must be in [${D.sky},${D.propBackMin - 1}]`);
    }
  });
  const order: Record<string, number> = { sky: 0, far: 1, mid: 2, ground: 3 };
  const bg = def.layers.filter((l) => l.kind !== 'foreground').sort((a, b) => order[a.kind]! - order[b.kind]!);
  for (let i = 1; i < bg.length; i++) {
    if (bg[i]!.depth < bg[i - 1]!.depth) err(`layer ${bg[i]!.id} (${bg[i]!.kind}) is drawn behind ${bg[i - 1]!.id} (${bg[i - 1]!.kind})`);
  }
  if (!def.layers.some((l) => l.kind === 'ground')) err('no ground layer');
  if (!def.layers.some((l) => l.kind === 'sky')) err('no sky layer');

  // targets
  def.targetZones.forEach((t) => {
    const prop = def.props.find((p) => p.id === t.propId);
    if (!prop) { err(`target ${t.id} references missing prop '${t.propId}'`); return; }
    const pr = propRect(prop, atlasFrames);
    if (!t.effect) err(`target ${t.id} has no effect key`);
    if (t.rect.w < 20 || t.rect.h < 20) err(`target ${t.id} rect smaller than 20x20 (too hard to hit on a phone)`);
    if (!inside(t.rect)) err(`target ${t.id} rect out of bounds`);
    if (pr && !(t.rect.x >= pr.x && t.rect.y >= pr.y && t.rect.x + t.rect.w <= pr.x + pr.w && t.rect.y + t.rect.h <= pr.y + pr.h)) {
      err(`target ${t.id} rect lies outside its prop sprite`);
    }
    if (rectsOverlap(t.rect, hero) || rectsOverlap(t.rect, enemy)) err(`target ${t.id} overlaps a duellist zone`);
  });
  const tids = new Set<string>();
  def.targetZones.forEach((t) => { if (tids.has(t.id)) err(`duplicate target id '${t.id}'`); tids.add(t.id); });

  return errs;
}
