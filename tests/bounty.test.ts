import { describe, it, expect } from 'vitest';
import { defaultMeta, validateMeta, type MetaSave } from '../src/core/SaveManager';
import { Rng } from '../src/core/rng';
import { ACHIEVEMENTS, BOARD_POOLS, BOARD_RULES, DAILY_POOL, WEEKLY_POOL, ALL_MISSIONS } from '../src/data/missions';
import { WANTED, getWanted } from '../src/data/wanted';
import {
  applyMissionEvents, claimAll, claimMission, contractReward, contractsFor, dailyDefsFor, eventsFromRun,
  getBoard, pruneMissions, resolveMission, settleRunWithBounties, weekKeyOf, weeklyDefsFor, type MissionEvent,
} from '../src/systems/BountySystem';
import type { RunSummary } from '../src/systems/EconomySystem';

const DAY = '2026-10-05';
const run = (o: Partial<RunSummary> = {}): RunSummary => ({
  coins: 0, victory: false, defeated: [], regionsCleared: [], perfectDraws: 0, headshots: 0, noDamageDuels: 0, ...o,
});

describe('rotation determinism', () => {
  it('same date key gives the same board, different keys eventually differ', () => {
    expect(getBoard(defaultMeta(), DAY)).toEqual(getBoard(defaultMeta(), DAY));
    const sigs = new Set<string>();
    for (let d = 1; d <= 28; d++) sigs.add(JSON.stringify(contractsFor(`2026-02-${String(d).padStart(2, '0')}`)));
    expect(sigs.size).toBeGreaterThan(10);
  });
  it('does not read the clock', () => {
    const real = Date.now;
    Date.now = () => { throw new Error('Date.now used'); };
    try { expect(() => getBoard(defaultMeta(), DAY)).not.toThrow(); } finally { Date.now = real; }
  });
  it('daily picks are distinct, correct count, from the pool; weekly stable across the week', () => {
    for (let d = 1; d <= 31; d++) {
      const key = `2026-03-${String(d).padStart(2, '0')}`;
      const dl = dailyDefsFor(key);
      expect(dl).toHaveLength(BOARD_RULES.dailyMissions);
      expect(new Set(dl.map((m) => m.id)).size).toBe(dl.length);
      dl.forEach((m) => expect(DAILY_POOL).toContain(m));
    }
    expect(weeklyDefsFor('2026-10-05')).toEqual(weeklyDefsFor('2026-10-11'));
    expect(weekKeyOf('2026-10-11')).toBe('2026-10-05');
    expect(weekKeyOf('2026-10-05')).toBe('2026-10-05');
    expect(weeklyDefsFor('2026-10-05')).toHaveLength(BOARD_RULES.weeklyMissions);
    weeklyDefsFor(DAY).forEach((m) => expect(WEEKLY_POOL).toContain(m));
  });
  it('contracts: one per tier from the pools, rewards derived from wanted.ts and capped', () => {
    for (let d = 1; d <= 28; d++) {
      const cs = contractsFor(`2026-04-${String(d).padStart(2, '0')}`);
      expect(cs.map((c) => c.tier)).toEqual(['easy', 'mid', 'hard']);
      cs.forEach((c) => {
        expect((BOARD_POOLS[c.tier] as readonly string[])).toContain(c.enemyId);
        expect(c.reward).toBe(contractReward(c.enemyId));
        expect(c.reward).toBeLessThanOrEqual(BOARD_RULES.contractCap);
        expect(c.reward).toBeGreaterThan(0);
        expect(c.reward).toBeLessThan(getWanted(c.enemyId)!.reward);
      });
    }
    for (const id of Object.values(BOARD_POOLS).flat()) expect(getWanted(id)).toBeDefined();
  });
});

describe('definitions', () => {
  it('have unique ids, positive targets and rewards, valid filter ids', () => {
    expect(new Set(ALL_MISSIONS.map((m) => m.id)).size).toBe(ALL_MISSIONS.length);
    const wantedIds = new Set(WANTED.map((w) => w.id));
    for (const m of ALL_MISSIONS) {
      expect(m.target).toBeGreaterThan(0);
      expect(m.reward).toBeGreaterThan(0);
      if (m.filterId && (m.event === 'wanted_defeated' || m.event === 'boss_defeated')) expect(wantedIds.has(m.filterId)).toBe(true);
    }
  });
  it('max repeatable income per day is small next to the cheapest unlock', () => {
    const dailyMax = Math.max(...DAILY_POOL.map((m) => m.reward)) * BOARD_RULES.dailyMissions;
    const contracts = (['easy', 'mid', 'hard'] as const).reduce((t, k) => t + Math.max(...BOARD_POOLS[k].map(contractReward)), 0);
    expect(dailyMax + contracts).toBeLessThan(400);
  });
});

describe('progress tracking', () => {
  it('counts perfect draws, headshots, no-damage duels, bosses, wanted, regions, runs', () => {
    const ev = eventsFromRun(run({ victory: true, defeated: ['rookie', 'mad_dog_mcgraw'], regionsCleared: ['dust_creek'], perfectDraws: 3, headshots: 2, noDamageDuels: 1 }));
    const types = new Set(ev.map((e) => e.type));
    for (const t of ['run_played', 'run_won', 'duel_won', 'perfect_draw', 'headshot', 'no_damage_duel', 'boss_defeated', 'wanted_defeated', 'region_clear']) expect(types.has(t as never)).toBe(true);
    expect(eventsFromRun(run({ perfectDraws: 5, mode: 'practice' }))).toEqual([]);
  });
  it('achievements with filters only count matching ids', () => {
    let m = settleRunWithBounties(defaultMeta(), run({ defeated: ['rookie'] }), DAY);
    expect(m.missions['a_mad_dog']).toBeUndefined();
    m = settleRunWithBounties(m, run({ defeated: ['mad_dog_mcgraw'], regionsCleared: ['dust_creek'] }), DAY);
    expect(m.missions['a_mad_dog'].progress).toBe(1);
    expect(m.missions['a_clear_dust'].progress).toBe(1);
    expect(m.missions['a_clear_canyon']).toBeUndefined();
  });
  it('contract for today completes when its target is defeated, only on that day', () => {
    const c = contractsFor(DAY)[0];
    const id = `bounty_${c.enemyId}@${DAY}`;
    let m = settleRunWithBounties(defaultMeta(), run({ defeated: [c.enemyId] }), DAY);
    expect(m.missions[id]).toEqual({ progress: 1, claimed: false });
    const other = settleRunWithBounties(defaultMeta(), run({ defeated: [c.enemyId] }), '2026-10-06');
    expect(other.missions[id]).toBeUndefined();
    const res = claimMission(m, id);
    expect(res.reward).toBe(c.reward);
    m = res.meta;
    expect(claimMission(m, id).ok).toBe(false);
  });
  it('progress is monotonic and capped under fuzzed event streams', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = new Rng(seed);
      let m: MetaSave = defaultMeta();
      const last: Record<string, number> = {};
      for (let i = 0; i < 60; i++) {
        const dayKey = `2026-10-${String(1 + (i % 7)).padStart(2, '0')}`;
        const evs: MissionEvent[] = [];
        for (let k = rng.int(0, 5); k > 0; k--) {
          evs.push({ type: rng.pick(['duel_won', 'perfect_draw', 'headshot', 'no_damage_duel', 'run_played', 'region_clear', 'boss_defeated', 'wanted_defeated', 'run_won'] as const), id: rng.pick(['rookie', 'dust_creek', 'mad_dog_mcgraw', undefined]), count: rng.int(-3, 4) });
        }
        m = applyMissionEvents(m, evs, dayKey);
        if (rng.next() < 0.3) m = claimAll(m, dayKey).meta;
        for (const [id, rec] of Object.entries(m.missions)) {
          const r = resolveMission(id)!;
          expect(r).not.toBeNull();
          expect(rec.progress).toBeGreaterThanOrEqual(last[id] ?? 0);
          expect(rec.progress).toBeLessThanOrEqual(r.def.target);
          last[id] = rec.progress;
        }
        expect(validateMeta(m)).not.toBeNull();
      }
    }
  });
  it('perRun missions take the best run, cumulative missions add up', () => {
    let m = defaultMeta();
    m = applyMissionEvents(m, [{ type: 'duel_won', count: 1 }], DAY);
    m = applyMissionEvents(m, [{ type: 'duel_won', count: 2 }], DAY);
    expect(m.missions['a_first_blood'].progress).toBe(1); // capped at target 1
    m = applyMissionEvents(m, [{ type: 'perfect_draw', count: 20 }], DAY);
    m = applyMissionEvents(m, [{ type: 'perfect_draw', count: 20 }], DAY);
    expect(m.missions['a_perfect_50'].progress).toBe(40);
  });
  it('does not mutate its input', () => {
    const m = defaultMeta();
    const snap = JSON.stringify(m);
    applyMissionEvents(m, eventsFromRun(run({ defeated: ['rookie'], perfectDraws: 9 })), DAY);
    claimAll(m, DAY);
    expect(JSON.stringify(m)).toBe(snap);
  });
});

describe('claiming', () => {
  it('pays once, only when complete, and rejects unknown ids', () => {
    let m = defaultMeta();
    expect(claimMission(m, 'a_first_blood').reason).toBe('not_complete');
    expect(claimMission(m, 'bogus').reason).toBe('unknown_mission');
    expect(claimMission(m, 'bounty_ghost@2026-10-05').reason).toBe('unknown_mission');
    expect(claimMission(m, 'a_first_blood@2026-10-05').reason).toBe('unknown_mission');
    m = settleRunWithBounties(m, run({ defeated: ['rookie'] }), DAY);
    const before = m.coins;
    const r = claimMission(m, 'a_first_blood');
    expect(r.ok).toBe(true);
    expect(r.meta.coins).toBe(before + 10);
    expect(claimMission(r.meta, 'a_first_blood').reward).toBe(0);
    expect(claimMission(r.meta, 'a_first_blood').meta.coins).toBe(r.meta.coins);
  });
  it('claimed missions do not progress further and completed ones survive rotation until claimed', () => {
    let m = settleRunWithBounties(defaultMeta(), run({ defeated: ['rookie'], perfectDraws: 99, headshots: 99, noDamageDuels: 99, victory: true, regionsCleared: ['dust_creek'] }), DAY);
    const pending = Object.entries(m.missions).filter(([id, r]) => resolveMission(id) && r.progress >= resolveMission(id)!.def.target).map(([id]) => id);
    expect(pending.length).toBeGreaterThan(0);
    m = pruneMissions(m, '2026-12-25');
    for (const id of pending) expect(m.missions[id]).toBeDefined();
    const all = claimAll(m, '2026-12-25');
    expect(all.total).toBeGreaterThan(0);
    expect(claimAll(all.meta, '2026-12-25').total).toBe(0);
  });
  it('prune removes stale incomplete entries only', () => {
    let m = applyMissionEvents(defaultMeta(), [{ type: 'duel_won', count: 1 }, { type: 'perfect_draw', count: 1 }], DAY);
    const stale = Object.keys(m.missions).filter((k) => k.includes('@'));
    m = pruneMissions(m, '2027-06-01');
    for (const id of stale) expect(m.missions[id]).toBeUndefined();
    expect(m.missions['a_first_blood']).toBeDefined();
  });
  it('end-to-end: settleRunWithBounties result is a valid MetaSave', () => {
    const m = settleRunWithBounties(defaultMeta(), run({ coins: 120, defeated: ['rookie', 'bandit'], perfectDraws: 2 }), DAY);
    expect(validateMeta(m)).not.toBeNull();
    expect(m.stats.runs).toBe(1);
    expect(ACHIEVEMENTS.length).toBeGreaterThan(5);
  });
});
