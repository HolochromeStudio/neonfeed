import { describe, it, expect } from 'vitest';
import { Rng } from '../../src/core/rng';
import { DUEL_CONFIG } from '../../src/data/duelConfig';
import { ENEMIES } from '../../src/data/enemies';
import { PERK_BY_ID } from '../../src/data/perks';
import { simulateDuel, batchDuelsRaw, cleanRate } from '../../scripts/sim/duelSim';
import { playRun } from '../../scripts/sim/runSim';
import { SKILLS, NOVICE, EXPERT, skillAt, sampleReaction } from '../../scripts/sim/skills';
import { withPatch } from '../../scripts/sim/scenarios';
import { leadScale } from '../../scripts/sim/levers';
import { buildReport, PROFILES } from '../../scripts/sim/report';
import { median, wilson } from '../../scripts/sim/stats';

/**
 * A18 balance simulator checks. The default `npm test` only runs the small structural tests below (about a second);
 * the full report test is gated: `SIM=1 npx vitest run tests/sim`. `npm run sim` prints the real report.
 */
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

describe('skill models', () => {
  it('reaction medians follow the brief (380 / 300 / 250 / 210 ms plus lag)', () => {
    const want = [380, 300, 250, 210];
    SKILLS.forEach((s, i) => {
      const rng = new Rng(7);
      const xs = Array.from({ length: 4000 }, () => sampleReaction(rng, s, 0));
      expect(Math.abs(median(xs) - want[i])).toBeLessThan(want[i] * 0.03);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(s.reactFloorMs);
    });
  });
  it('skillAt interpolates between the named models', () => {
    expect(skillAt(0).reactMedianMs).toBe(NOVICE.reactMedianMs);
    expect(skillAt(3).reactMedianMs).toBe(EXPERT.reactMedianMs);
    expect(skillAt(0.5).reactMedianMs).toBeGreaterThan(300);
    expect(skillAt(0.5).reactMedianMs).toBeLessThan(380);
  });
});

describe('duel simulator (real DuelSystem)', () => {
  it('is deterministic for a seed and every duel resolves', () => {
    const run = (): string => JSON.stringify(Array.from({ length: 60 }, (_, i) => simulateDuel('gunslinger', SKILLS[i % 4], new Rng(i + 1), { difficulty: 0.4, seed: 100 + i })));
    const a = run();
    expect(run()).toBe(a);
    for (const r of JSON.parse(a) as { stalled: boolean }[]) expect(r.stalled).toBe(false);
  });
  it('better players take fewer hits (monotone in skill)', () => {
    const clean = SKILLS.map((s) => cleanRate(batchDuelsRaw('gunslinger', s, 400, { difficulty: 0.5 })));
    for (let i = 1; i < clean.length; i++) expect(clean[i]).toBeGreaterThan(clean[i - 1]);
  });
  it('1-life win rate equals the clean-win rate of the same duels (rng does not depend on hp)', () => {
    const one = batchDuelsRaw('bandit', NOVICE, 300, { difficulty: 0.3, heroHp: 1 }).filter((r) => r.win).length / 300;
    expect(one).toBeCloseTo(cleanRate(batchDuelsRaw('bandit', NOVICE, 300, { difficulty: 0.3 })), 10);
  });
  it('boss duels run phases and finish', () => {
    const rs = batchDuelsRaw('sheriff', NOVICE, 100, { difficulty: 0.5, bossId: 'mad_dog_mcgraw' });
    expect(rs.every((r) => r.bossPhase !== null && !r.stalled)).toBe(true);
    expect(Math.max(...rs.map((r) => r.bossPhase as number))).toBeGreaterThanOrEqual(2);
  });
  it('wilson interval brackets the estimate', () => {
    const w = wilson(30, 100);
    expect(w.lo).toBeLessThan(0.3);
    expect(w.hi).toBeGreaterThan(0.3);
  });
});

describe('run simulator (real RunSystem)', () => {
  it('is deterministic and terminates with consistent bookkeeping', () => {
    const a = JSON.stringify(Array.from({ length: 6 }, (_, i) => playRun({ skill: SKILLS[i % 4], seed: i + 1 })));
    expect(JSON.stringify(Array.from({ length: 6 }, (_, i) => playRun({ skill: SKILLS[i % 4], seed: i + 1 })))).toBe(a);
    for (const r of JSON.parse(a) as ReturnType<typeof playRun>[]) {
      expect(r.duels).toBeGreaterThan(0);
      expect(r.duelsWon).toBeLessThanOrEqual(r.duels);
      expect(r.minutes).toBeGreaterThan(0);
      expect(r.victory ? r.regionsCleared.length : 0).toBeLessThanOrEqual(3);
      expect(r.coinsEarned).toBeGreaterThanOrEqual(r.coinsEnd);
    }
  });
  it('a no-perk policy never owns perks except from events or treasure', () => {
    const r = playRun({ skill: SKILLS[1], seed: 3, perkPolicy: 'none' });
    expect(r.taken.common + r.taken.rare + r.taken.legend).toBe(0);
  });
});

describe('what-if patches', () => {
  it('restore every touched object exactly, even when the callback throws', () => {
    const duel = JSON.stringify(DUEL_CONFIG);
    const enemies = JSON.stringify(ENEMIES);
    const when = PERK_BY_ID.tin_star.when;
    expect(() => withPatch({
      duel: (c) => { c.damage.heroHp = 1; c.fairness.maxDisarms = 0; },
      enemies: leadScale(0.5),
      perks: { tin_star: (p) => { p.when = () => false; } },
    }, () => { expect(DUEL_CONFIG.damage.heroHp).toBe(1); expect(ENEMIES.bandit.tell.leadMs).toBeGreaterThanOrEqual(450); throw new Error('boom'); })).toThrow('boom');
    expect(JSON.stringify(DUEL_CONFIG)).toBe(duel);
    expect(JSON.stringify(ENEMIES)).toBe(enemies);
    expect(PERK_BY_ID.tin_star.when).toBe(when);
  });
  it('a patch that assigns an array it keeps using cannot be corrupted by the restore', () => {
    const mine: [number, number] = [5, 41];
    for (let i = 0; i < 3; i++) withPatch({ enemies: (e) => { e.rookie.aimErrorPx = mine; } }, () => { expect(ENEMIES.rookie.aimErrorPx).toEqual([5, 41]); });
    expect(mine).toEqual([5, 41]);
    expect(ENEMIES.rookie.aimErrorPx).toEqual([4, 40]);
  });
  it('leadScale never goes below the F1 floor of 450 ms', () => {
    withPatch({ enemies: leadScale(0.1) }, () => {
      for (const e of Object.values(ENEMIES)) expect(e.tell.leadMs).toBeGreaterThanOrEqual(450);
    });
  });
});

describe.skipIf(!env.SIM)('full report (SIM=1)', () => {
  it('quick profile builds every section, deterministically, without NaN', () => {
    const a = buildReport(PROFILES.quick);
    expect(a.md).not.toContain('NaN');
    expect(a.md).toContain('## Candidate packages vs targets');
    expect(buildReport(PROFILES.quick, ['targets', 'runs']).md).toBe(buildReport(PROFILES.quick, ['targets', 'runs']).md);
  }, 300_000);
});
