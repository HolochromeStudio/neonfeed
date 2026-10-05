import { describe, it, expect } from 'vitest';
import { DUEL_CONFIG } from '../src/data/duelConfig';
import { applyDamage, isDead, makeHealth, shotDamage } from '../src/systems/DamageSystem';
import { effectiveReaction, gradeDraw } from '../src/systems/DrawSystem';
import { buildZones, hitTest } from '../src/systems/TargetSystem';

const rect = { x: 200, y: 300, w: 100, h: 100 };
const zones = buildZones(rect, [{ id: 'barrel', x: 100, y: 350, w: 30, h: 30 }]);
const zone = (id: string) => zones.find((z) => z.id === id)!;

describe('TargetSystem', () => {
  it('hits head, body, limb and prop zones with their multipliers', () => {
    expect(hitTest(zones, { x: 250, y: 310 }).zone?.id).toBe('head');
    expect(hitTest(zones, { x: 250, y: 350 }).zone?.id).toBe('body');
    expect(hitTest(zones, { x: 205, y: 350 }).zone?.id).toBe('limb');
    expect(hitTest(zones, { x: 115, y: 365 }).zone?.propId).toBe('barrel');
    expect(zone('head').multiplier).toBe(2);
    expect(zone('limb').multiplier).toBe(0.75);
  });
  it('overlap goes to the precise part (limb over body)', () => {
    expect(hitTest(zones, { x: 215, y: 340 }).zone?.id).toBe('limb');
  });
  it('misses outside every zone, and aim assist snaps within the radius only', () => {
    expect(hitTest(zones, { x: 10, y: 10 }).zone).toBeNull();
    const near = { x: 250, y: 296 }; // 4px above head
    expect(hitTest(zones, near, 0).zone).toBeNull();
    const a = hitTest(zones, near, 10);
    expect(a.zone?.id).toBe('head');
    expect(a.assisted).toBe(true);
    expect(hitTest(zones, { x: 250, y: 280 }, 10).zone).toBeNull();
  });
});

describe('DamageSystem', () => {
  it('applies damage, clamps at zero and reports kills', () => {
    const h = makeHealth(2);
    expect(applyDamage(h, 1)).toMatchObject({ dealt: 1, hpAfter: 1, killed: false });
    expect(applyDamage(h, 5)).toMatchObject({ dealt: 1, hpAfter: 0, killed: true });
    expect(isDead(h)).toBe(true);
    expect(applyDamage(h, 1)).toMatchObject({ dealt: 0, killed: false });
  });
  it('zone multipliers and crit scale shot damage; props and misses deal none', () => {
    expect(shotDamage(zone('body'), false)).toBe(1);
    expect(shotDamage(zone('head'), false)).toBe(2);
    expect(shotDamage(zone('head'), true)).toBe(2 * DUEL_CONFIG.damage.critMultiplier);
    expect(shotDamage(zones.find((z) => z.id === 'prop')!, true)).toBe(0);
    expect(shotDamage(null, true)).toBe(0);
  });
});

describe('DrawSystem tiers', () => {
  it('uses 220/350/550 boundaries (lower bound exclusive of the next tier)', () => {
    expect(gradeDraw(0).tier).toBe('perfect');
    expect(gradeDraw(219.9).tier).toBe('perfect');
    expect(gradeDraw(220).tier).toBe('good');
    expect(gradeDraw(349).tier).toBe('good');
    expect(gradeDraw(350).tier).toBe('ok');
    expect(gradeDraw(549).tier).toBe('ok');
    expect(gradeDraw(550).tier).toBe('slow');
  });
  it('perfect grants +30% aim budget and a crit; others do not', () => {
    expect(gradeDraw(100)).toMatchObject({ perfect: true, crit: true, aimBudgetMultiplier: 1.3 });
    expect(gradeDraw(300)).toMatchObject({ perfect: false, crit: false, aimBudgetMultiplier: 1 });
  });
  it('flinch adds the penalty', () => {
    expect(effectiveReaction(200, true)).toBe(500);
    expect(effectiveReaction(200, false)).toBe(200);
  });
});
