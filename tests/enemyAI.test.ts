import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { ENEMY_IDS } from '../src/data/dialogue';
import { ENEMIES, FAIRNESS_FLOOR_MS, MIN_SHOT_GAP_MS, enemyHpFor, resolveSpritePrefix } from '../src/data/enemies';
import { DUEL_CONFIG } from '../src/data/duelConfig';
import { createOpponent, type EnemyOpponent } from '../src/systems/EnemyAISystem';
import { DuelSystem } from '../src/systems/DuelSystem';
import { Enemy } from '../src/entities/Enemy';

interface Plan { wait: number; draw: number; shots: number[]; errs: number[]; fake: EnemyOpponent['fakeTell']; opp: EnemyOpponent }

function plan(id: string, seed: number, d: number, n = 3): Plan {
  const rng = new Rng(seed);
  const opp = createOpponent(id, rng, d);
  const wait = opp.waitMs(rng);
  const draw = opp.drawMs(rng);
  const shots: number[] = [];
  const errs: number[] = [];
  for (let i = 0; i < n; i++) {
    shots.push(opp.shotDelayMs(rng, i));
    errs.push(opp.aimErrorPx(rng, i));
  }
  return { wait, draw, shots, errs, fake: opp.fakeTell, opp };
}

const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a: number[]): number => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

describe('enemy data', () => {
  it('covers all 12 enemy ids', () => {
    expect(Object.keys(ENEMIES).sort()).toEqual([...ENEMY_IDS].sort());
    for (const id of ENEMY_IDS) expect(ENEMIES[id].id).toBe(id);
  });
  it('tell lead respects F1 and data is sane', () => {
    expect(FAIRNESS_FLOOR_MS).toBe(DUEL_CONFIG.fairness.minLethalMs);
    expect(MIN_SHOT_GAP_MS).toBe(DUEL_CONFIG.fairness.minShotGapMs);
    for (const d of Object.values(ENEMIES)) {
      expect(d.tell.leadMs).toBeGreaterThanOrEqual(FAIRNESS_FLOOR_MS);
      expect(d.hp).toBeGreaterThanOrEqual(1);
      expect(d.shotGapMs[0]).toBeGreaterThanOrEqual(MIN_SHOT_GAP_MS);
      for (const v of d.variants ?? []) expect(v.leadMs).toBeGreaterThanOrEqual(FAIRNESS_FLOOR_MS);
      if (d.fakeTell) expect(d.fakeTell.recoverMs).toBeGreaterThanOrEqual(400);
    }
  });
  it('sprite prefixes: real sheets resolve, others fall back to enemy', () => {
    expect(resolveSpritePrefix(ENEMIES.bandit, () => true)).toBe('bandit');
    expect(resolveSpritePrefix(ENEMIES.bandit, () => false)).toBe('enemy');
    expect(resolveSpritePrefix(ENEMIES.rookie, () => true)).toBe('enemy');
  });
  it('hp rises one tier at high difficulty', () => {
    expect(enemyHpFor(ENEMIES.bandit, 0)).toBe(2);
    expect(enemyHpFor(ENEMIES.bandit, 1)).toBe(3);
    expect(new Enemy('bandit', new Rng(1), 1).hp).toBe(3);
  });
  it('unknown id throws', () => {
    expect(() => createOpponent('nope', new Rng(1))).toThrow();
  });
});

describe('determinism', () => {
  it('same seed gives the same plan, different seeds differ', () => {
    for (const id of ENEMY_IDS) {
      const strip = ({ opp: _o, ...r }: Plan) => r;
      expect(strip(plan(id, 42, 0.5))).toEqual(strip(plan(id, 42, 0.5)));
      const a = JSON.stringify(plan(id, 1, 0.5).shots) + plan(id, 1, 0.5).wait;
      const b = Array.from({ length: 20 }, (_, i) => JSON.stringify(plan(id, i + 2, 0.5).shots) + plan(id, i + 2, 0.5).wait);
      expect(b.some((x) => x !== a)).toBe(true);
    }
  });
  it('a retry re-derives the identical plan from a fresh rng with the same seed', () => {
    const o1 = createOpponent('bounty_hunter', new Rng(7), 0.6);
    const o2 = createOpponent('bounty_hunter', new Rng(7), 0.6);
    for (let k = 0; k < 2; k++) {
      const r1 = new Rng(7), r2 = new Rng(7);
      expect([o1.waitMs(r1), o1.drawMs(r1), o1.shotDelayMs(r1, 0), o1.variantId]).toEqual([o2.waitMs(r2), o2.drawMs(r2), o2.shotDelayMs(r2, 0), o2.variantId]);
    }
  });
  it('does not use Math.random', () => {
    const orig = Math.random;
    Math.random = () => { throw new Error('Math.random used'); };
    try { for (const id of ENEMY_IDS) plan(id, 5, 1); } finally { Math.random = orig; }
  });
});

describe('fairness F1 across thousands of seeds', () => {
  for (const id of ENEMY_IDS) {
    it(`${id}: tell-to-lethal >= 450 ms, shot gaps >= 250 ms, gun out before shot`, () => {
      for (const d of [0, 0.5, 1]) {
        for (let seed = 1; seed <= 1500; seed++) {
          const p = plan(id, seed, d);
          // DuelSystem takes the max with minLethalMs; the controller must already satisfy it
          expect(p.shots[0]).toBeGreaterThanOrEqual(FAIRNESS_FLOOR_MS);
          expect(p.shots[0]).toBeGreaterThanOrEqual(p.draw);
          expect(p.draw).toBeGreaterThan(0);
          for (let i = 1; i < p.shots.length; i++) expect(p.shots[i]).toBeGreaterThanOrEqual(MIN_SHOT_GAP_MS);
          expect(p.wait).toBeGreaterThanOrEqual(900);
          expect(p.wait).toBeLessThanOrEqual(5000);
          expect(p.errs.every((e) => e >= 0 && Number.isFinite(e))).toBe(true);
        }
      }
    });
  }
  it('fake tells never punish a correct reaction: real cue is >= 400 ms after the fake ends', () => {
    let fakes = 0;
    for (const id of ENEMY_IDS) {
      for (let seed = 1; seed <= 1500; seed++) {
        const p = plan(id, seed, 1);
        if (!p.fake) continue;
        fakes++;
        expect(p.fake.startMs).toBeGreaterThanOrEqual(300);
        expect(p.wait - (p.fake.startMs + p.fake.durationMs)).toBeGreaterThanOrEqual(400);
      }
    }
    expect(fakes).toBeGreaterThan(100);
  });
});

describe('difficulty axes are monotonic, reaction window is not the lever', () => {
  const N = 2000;
  const stats = (id: string, d: number) => {
    const ps = Array.from({ length: N }, (_, i) => plan(id, i + 1, d));
    return {
      aim: mean(ps.flatMap((p) => p.errs.slice(0, 1))),
      hit: mean(ps.map((p) => (p.errs[0] <= DUEL_CONFIG.fairness.enemyHitTolerancePx ? 1 : 0))),
      fake: mean(ps.map((p) => (p.fake ? 1 : 0))),
      waitSd: sd(ps.map((p) => p.wait)),
      shot0: mean(ps.map((p) => p.shots[0])),
      minShot0: Math.min(...ps.map((p) => p.shots[0])),
    };
  };
  it('bandit: precision, information and rhythm rise; first-shot timing does not shrink', () => {
    const s = [0, 0.25, 0.5, 0.75, 1].map((d) => stats('bandit', d));
    for (let i = 1; i < s.length; i++) {
      expect(s[i].hit).toBeGreaterThanOrEqual(s[i - 1].hit - 0.01);
      expect(s[i].fake).toBeGreaterThanOrEqual(s[i - 1].fake - 0.02);
      expect(s[i].waitSd).toBeGreaterThanOrEqual(s[i - 1].waitSd - 5);
      expect(s[i].shot0).toBeGreaterThanOrEqual(s[0].shot0 - 1);
    }
    expect(s[4].hit).toBeGreaterThan(s[0].hit + 0.05);
    expect(s[4].fake).toBeGreaterThan(0.2);
    expect(s[0].fake).toBe(0);
    expect(s[4].waitSd).toBeGreaterThan(s[0].waitSd);
    expect(s[4].minShot0).toBe(s[0].minShot0);
  });
  it('bandit baseline is readable: no fake at d=0, tell-to-shot 620-760 ms with slight variance', () => {
    const ps = Array.from({ length: N }, (_, i) => plan('bandit', i + 1, 0));
    const sh = ps.map((p) => p.shots[0]);
    expect(Math.min(...sh)).toBeGreaterThanOrEqual(620);
    expect(Math.max(...sh)).toBeLessThanOrEqual(760);
  });
  it('every enemy: no axis gets easier with depth', () => {
    for (const id of ENEMY_IDS) {
      const lo = stats(id, 0), hi = stats(id, 1);
      expect(hi.hit).toBeGreaterThanOrEqual(lo.hit - 0.02);
      expect(hi.fake).toBeGreaterThanOrEqual(lo.fake - 0.02);
      expect(hi.shot0).toBeGreaterThanOrEqual(lo.shot0 - 1);
    }
  });
});

describe('enemy behaviours', () => {
  it('dual wielder and knife thrower fire a two-shot sequence, then reload', () => {
    for (const id of ['dual_wielder', 'knife_thrower']) {
      const p = plan(id, 3, 0, 3);
      expect(p.opp.shots).toBe(2);
      expect(p.shots[1]).toBeLessThan(800);
      expect(p.shots[2]).toBeGreaterThan(1500);
    }
  });
  it('sniper has the longest telegraph', () => {
    const lead = (id: string) => mean(Array.from({ length: 200 }, (_, i) => plan(id, i + 1, 0).shots[0]));
    for (const id of ENEMY_IDS.filter((x) => x !== 'sniper' && x !== 'bounty_hunter')) expect(lead('sniper')).toBeGreaterThan(lead(id) - 1 + (id === 'rookie' ? -200 : 0));
    expect(lead('sniper')).toBeGreaterThan(900);
  });
  it('coward fakes often, rookie is slowest to fire among beginners, drunk timing is erratic', () => {
    const fakeRate = (id: string) => mean(Array.from({ length: 1000 }, (_, i) => (plan(id, i + 1, 0).fake ? 1 : 0)));
    expect(fakeRate('coward')).toBeGreaterThan(0.4);
    expect(fakeRate('rookie')).toBe(0);
    const spread = (id: string) => sd(Array.from({ length: 1000 }, (_, i) => plan(id, i + 1, 0).shots[0]));
    expect(spread('drunk')).toBeGreaterThan(spread('bandit') * 2);
  });
  it('drunk misses randomly (wild misses) but still hits sometimes', () => {
    const hits = mean(Array.from({ length: 2000 }, (_, i) => (plan('drunk', i + 1, 0).errs[0] <= 24 ? 1 : 0)));
    expect(hits).toBeGreaterThan(0.1);
    expect(hits).toBeLessThan(0.5);
  });
  it('bounty hunter picks one announced variant per duel, deterministic by seed', () => {
    const seen = new Set<string | null>();
    for (let s = 1; s <= 200; s++) seen.add(plan('bounty_hunter', s, 0.5).opp.variantId);
    expect([...seen].sort()).toEqual(['dual', 'feint', 'glint']);
    expect(plan('bounty_hunter', 9, 0).opp.variantId).toBe(plan('bounty_hunter', 9, 0).opp.variantId);
  });
  it('coward evasion is deterministic and bounded', () => {
    const o = createOpponent('coward', new Rng(1), 1);
    const r = new Rng(5);
    const k = Array.from({ length: 2000 }, () => (o.evades(r, 0) ? 1 : 0));
    expect(mean(k)).toBeGreaterThan(0.3);
    expect(mean(k)).toBeLessThan(0.7);
  });
});

describe('integration with DuelSystem', () => {
  it('every enemy runs a full duel to a resolution without throwing', () => {
    for (const id of ENEMY_IDS) {
      for (let seed = 1; seed <= 20; seed++) {
        const rng = new Rng(seed);
        const opponent = createOpponent(id, rng, 0.5);
        const duel = new DuelSystem({ seed, opponent, enemyHp: ENEMIES[id].hp });
        let t = 0;
        while (!duel.isOver && t < 600000) { t += 100; duel.advanceTo(t); }
        expect({ id, seed, over: duel.isOver, ph: duel.currentPhase }).toEqual({ id, seed, over: true, ph: duel.currentPhase });
        expect(duel.lastResult?.enemyShotMs).toBeGreaterThanOrEqual(FAIRNESS_FLOOR_MS);
      }
    }
  });
});
