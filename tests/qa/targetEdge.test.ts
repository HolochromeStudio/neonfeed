import { describe, expect, it } from 'vitest';
import { DUEL_CONFIG } from '../../src/data/duelConfig';
import { distanceToRect, buildZones, hitTest } from '../../src/systems/TargetSystem';
import type { Zone } from '../../src/systems/TargetSystem';
import { pointInRect } from '../../src/systems/InputSystem';
import { CUE, Fixed, mk } from './helpers';

const rect = { x: 218, y: 304, w: 64, h: 96 };
const zones = buildZones(rect, DUEL_CONFIG.arena.props, DUEL_CONFIG);
const zone = (id: string) => zones.find((z) => z.id === id)!;
const R = DUEL_CONFIG.aim.assistRadiusPx;

describe('aim assist boundary (14 px)', () => {
  const body = zone('body').rect; // x 228.8..273.2, y 328.96..373.12
  it('exactly 14 px left of the body edge is assisted onto the nearest zone', () => {
    const p = { x: body.x - R, y: body.y + body.h / 2 };
    // limb occupies x 218..230.8 and overlaps; pick a point on the right side where only body is near
    const q = { x: body.x + body.w + R, y: body.y + body.h / 2 };
    const h = hitTest(zones, q, R);
    expect(h.zone?.id).toBe('body');
    expect(h.assisted).toBe(true);
    void p;
  });
  it('14.0001 px is a miss, 13.9999 px is assisted', () => {
    const y = body.y + body.h / 2;
    const edge = body.x + body.w;
    expect(hitTest(zones, { x: edge + R + 1e-4, y }, R).zone).toBeNull();
    expect(hitTest(zones, { x: edge + R - 1e-4, y }, R).assisted).toBe(true);
  });
  it('diagonal corner distance uses euclidean metric (10,10 => 14.14 miss; 9,9 => 12.7 hit)', () => {
    const cx = body.x + body.w, cy = body.y + body.h;
    // below the body corner; limb x range ends at 230.8 so far from it
    expect(hitTest(zones, { x: cx + 10, y: cy + 10 }, R).zone).toBeNull();
    expect(hitTest(zones, { x: cx + 9, y: cy + 9 }, R).zone?.id).toBe('body');
  });
  it('assist radius 0 disables assist; negative radius is treated as off', () => {
    const q = { x: 300, y: 350 };
    expect(hitTest(zones, q, 0).zone).toBeNull();
    expect(hitTest(zones, q, -5).zone).toBeNull();
  });
  it('assisted flag is false for an exact containment', () => {
    expect(hitTest(zones, { x: 250, y: 350 }, R)).toMatchObject({ assisted: false });
  });
  it('through the duel: assisted body hit at exactly 14 px does damage, 15 px does not', () => {
    const run = (dx: number) => {
      const d = mk({ opp: new Fixed(1000, 300, 9000), enemyHp: 5 });
      d.input({ type: 'draw', t: CUE + 300 });
      d.input({ type: 'aim', t: CUE + 500, x: body.x + body.w + dx, y: body.y + body.h / 2 });
      d.input({ type: 'fire', t: CUE + 510 });
      return d.snapshot().enemyHp;
    };
    expect(run(R)).toBeLessThan(5);
    expect(run(R + 1)).toBe(5);
  });
});

describe('zone overlap precedence', () => {
  it('head beats body on the shared y edge', () => {
    const h = zone('head').rect;
    expect(hitTest(zones, { x: 250, y: h.y + h.h }, 0).zone?.id).toBe('head');
  });
  it('limb beats body where they overlap (x 228.8..230.8)', () => {
    expect(hitTest(zones, { x: 229.5, y: 350 }, 0).zone?.id).toBe('limb');
  });
  it('head beats body+limb everywhere head overlaps (property over a grid)', () => {
    const head = zone('head').rect;
    for (let x = head.x; x <= head.x + head.w; x += 1.5) for (let y = head.y; y <= head.y + head.h; y += 1.5) {
      expect(hitTest(zones, { x, y }, 0).zone?.id).toBe('head');
    }
  });
  it('prop beats body when a prop overlaps the enemy, and prop deals no damage', () => {
    const props = [{ id: 'crate', x: 240, y: 340, w: 20, h: 20 }];
    const zs = buildZones(rect, props, DUEL_CONFIG);
    expect(hitTest(zs, { x: 250, y: 350 }, 0).zone?.id).toBe('prop');
    const d = mk({ opp: new Fixed(1000, 300, 9000), enemyHp: 3 });
    // prop zone is only reachable by default arena props; use barrel
    d.input({ type: 'draw', t: CUE + 300 });
    d.input({ type: 'aim', t: CUE + 500, x: 160, y: 440 });
    d.input({ type: 'fire', t: CUE + 510 });
    expect(d.snapshot().enemyHp).toBe(3);
  });
  it('prop vs head: head still wins (priority head > limb > prop > body)', () => {
    const zs = buildZones(rect, [{ id: 'crate', x: 240, y: 300, w: 30, h: 30 }], DUEL_CONFIG);
    expect(hitTest(zs, { x: 250, y: 316 }, 0).zone?.id).toBe('head');
  });
  it('exact-tie assist distance goes to the higher priority zone, independent of array order', () => {
    const a: Zone = { id: 'body', rect: { x: 0, y: 0, w: 10, h: 10 }, multiplier: 1 };
    const b: Zone = { id: 'head', rect: { x: 30, y: 0, w: 10, h: 10 }, multiplier: 2 };
    const p = { x: 20, y: 5 }; // 10 px from both
    expect(hitTest([a, b], p, 14).zone?.id).toBe('head');
    expect(hitTest([b, a], p, 14).zone?.id).toBe('head');
  });
  it('assist prefers the NEAREST zone even if a lower priority one', () => {
    const a: Zone = { id: 'body', rect: { x: 0, y: 0, w: 10, h: 10 }, multiplier: 1 };
    const b: Zone = { id: 'head', rect: { x: 30, y: 0, w: 10, h: 10 }, multiplier: 2 };
    expect(hitTest([a, b], { x: 15, y: 5 }, 14).zone?.id).toBe('body');
  });
  it('assist can pick a prop (0 damage) over the enemy when the prop is nearer: documented', () => {
    const a: Zone = { id: 'prop', rect: { x: 0, y: 0, w: 10, h: 10 }, multiplier: 0, propId: 'p' };
    const b: Zone = { id: 'body', rect: { x: 30, y: 0, w: 10, h: 10 }, multiplier: 1 };
    expect(hitTest([a, b], { x: 14, y: 5 }, 14).zone?.id).toBe('prop');
  });
});

describe('geometry with hostile numbers', () => {
  const bad = [NaN, Infinity, -Infinity, -1e300, 1e300];
  it('hitTest never throws and never returns a zone for NaN points', () => {
    for (const x of bad) for (const y of bad) {
      const h = hitTest(zones, { x, y }, R);
      if (Number.isNaN(x) || Number.isNaN(y)) expect(h.zone).toBeNull();
    }
  });
  it('Infinity points do not report an assisted hit', () => {
    expect(hitTest(zones, { x: Infinity, y: 350 }, R).zone).toBeNull();
    expect(hitTest(zones, { x: 250, y: -Infinity }, R).zone).toBeNull();
  });
  it('distanceToRect is 0 inside/on edge and finite for finite input', () => {
    expect(distanceToRect({ x: 218, y: 304 }, rect)).toBe(0);
    expect(distanceToRect({ x: 218 - 3, y: 304 - 4 }, rect)).toBe(5);
    expect(Number.isFinite(distanceToRect({ x: 1e300, y: -1e300 }, rect))).toBe(true);
  });
  it('degenerate zero-size rect only hits exactly on its point', () => {
    expect(pointInRect(5, 5, { x: 5, y: 5, w: 0, h: 0 })).toBe(true);
    expect(pointInRect(5.0001, 5, { x: 5, y: 5, w: 0, h: 0 })).toBe(false);
  });
  it('negative-size rect (bad layout) contains nothing', () => {
    expect(pointInRect(5, 5, { x: 10, y: 10, w: -10, h: -10 })).toBe(false);
  });
  it('rect order/array order does not change results for non-overlapping points (shuffle property)', () => {
    for (let i = 0; i < 500; i++) {
      const p = { x: 200 + (i * 37) % 100, y: 290 + (i * 53) % 120 };
      const a = hitTest(zones, p, R);
      const b = hitTest([...zones].reverse(), p, R);
      expect(b.zone?.id).toBe(a.zone?.id);
      expect(b.assisted).toBe(a.assisted);
    }
  });
});
