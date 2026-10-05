import { describe, expect, it } from 'vitest';
import { DUEL_CONFIG } from '../../src/data/duelConfig';
import type { DrawTier } from '../../src/data/duelConfig';
import { effectiveReaction, gradeDraw } from '../../src/systems/DrawSystem';
import { CUE, Fixed, mk } from './helpers';

const table: [number, DrawTier][] = [
  [0, 'perfect'], [1, 'perfect'], [219, 'perfect'], [219.999, 'perfect'],
  [220, 'good'], [221, 'good'],
  [349, 'good'], [349.999, 'good'], [350, 'ok'], [351, 'ok'],
  [549, 'ok'], [549.999, 'ok'], [550, 'slow'], [551, 'slow'], [5000, 'slow'], [Infinity, 'slow'],
];

describe('gradeDraw boundaries', () => {
  for (const [ms, tier] of table) {
    it(`${ms} ms => ${tier}`, () => {
      expect(gradeDraw(ms).tier).toBe(tier);
    });
  }

  it('only perfect gets crit and the aim budget bonus', () => {
    expect(gradeDraw(219)).toMatchObject({ perfect: true, crit: true, aimBudgetMultiplier: 1.3 });
    for (const ms of [220, 349, 350, 549, 550]) expect(gradeDraw(ms)).toMatchObject({ perfect: false, crit: false, aimBudgetMultiplier: 1 });
  });

  it('negative reaction (clock skew) grades perfect rather than throwing', () => {
    expect(gradeDraw(-50).tier).toBe('perfect');
  });

  it('NaN reaction must not grade as perfect (QA-05)', () => {
    // NaN fails every `<` so it falls through to slow: acceptable and asserted so a refactor cannot flip it to perfect
    expect(gradeDraw(NaN).tier).toBe('slow');
  });

  it('custom thresholds are honoured exactly', () => {
    const th = { perfectMs: 100, goodMs: 200, okMs: 300 };
    expect([99, 100, 199, 200, 299, 300].map((m) => gradeDraw(m, th).tier)).toEqual(['perfect', 'good', 'good', 'ok', 'ok', 'slow']);
  });

  it('flinch penalty shifts the boundary: raw 49 + 300 => good, raw 50 + 300 => ok', () => {
    expect(gradeDraw(effectiveReaction(49, true)).tier).toBe('good');
    expect(gradeDraw(effectiveReaction(50, true)).tier).toBe('ok');
    expect(effectiveReaction(10, false)).toBe(10);
  });
});

describe('draw grading through the duel (integer ms, real input path)', () => {
  for (const [ms, tier] of table.filter(([m]) => Number.isInteger(m) && m <= 449)) {
    it(`draw at cue+${ms} => ${tier}`, () => {
      const d = mk({ opp: new Fixed(1000, 300, 5000) });
      d.input({ type: 'draw', t: CUE + ms });
      expect(d.snapshot().tier).toBe(tier);
      expect(d.snapshot().rawReactionMs).toBe(ms);
    });
  }

  it('perfect draw widens the first aim budget by exactly 30% and crits the first shot only', () => {
    const d = mk({ opp: new Fixed(1000, 300, 9000), enemyHp: 99 });
    let budget = 0;
    d.events.on('onAimStart', (e) => { if (!e.followUp) budget = e.budgetMs; });
    const crits: boolean[] = [];
    d.events.on('onShot', (e) => { if (e.shooter === 'player') crits.push(e.crit); });
    d.input({ type: 'draw', t: CUE + 219 });
    d.input({ type: 'aim', t: CUE + 400, x: 250, y: 350 });
    d.input({ type: 'fire', t: CUE + 400 });
    d.advanceTo(CUE + 700);
    d.input({ type: 'fire', t: CUE + 710 });
    expect(budget).toBeCloseTo(DUEL_CONFIG.aim.budgetMs * 1.3, 9);
    expect(crits).toEqual([true, false]);
  });

  it('good draw at 220 gets neither bonus', () => {
    const d = mk({ opp: new Fixed(1000, 300, 9000), enemyHp: 99 });
    let budget = 0;
    d.events.on('onAimStart', (e) => { budget = e.budgetMs; });
    d.input({ type: 'draw', t: CUE + 220 });
    d.advanceTo(CUE + 220 + 120);
    expect(budget).toBe(DUEL_CONFIG.aim.budgetMs);
  });
});
