import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { DUEL_CONFIG } from '../../src/data/duelConfig';
import { DuelSystem, replayDuel } from '../../src/systems/DuelSystem';
import type { DuelOutcome } from '../../src/systems/DuelSystem';
import { LEGAL, VALID_PHASES, cfgWith, quietAudio, randomLog, randomOpponent, record } from './helpers';
import type { Recorder } from './helpers';

const RUNS = 5000;

function must(c: boolean, msg: string): void {
  if (!c) throw new Error(`invariant violated: ${msg}`);
}
function finite(...xs: (number | null)[]) {
  for (const x of xs) must(x === null || Number.isFinite(x), `non-finite number ${x}`);
}

function check(d: DuelSystem, rec: Recorder, prevNow: number, heroMax: number, enemyMax: number): number {
  const s = d.snapshot();
  must(VALID_PHASES.includes(s.phase), `phase ${s.phase}`);
  finite(s.now, s.heroHp, s.enemyHp, s.timeScale);
  must(s.heroHp >= 0 && s.enemyHp >= 0, `negative hp ${s.heroHp}/${s.enemyHp}`);
  must(s.heroHp <= heroMax && s.enemyHp <= enemyMax, 'hp above max');
  must(s.now >= prevNow, `time went backwards ${prevNow} -> ${s.now}`);
  const over = s.phase === 'RESOLVE' || s.phase === 'RETRY';
  must((s.outcome !== null) === over, `outcome ${s.outcome} in phase ${s.phase}`);
  must(rec.resolves[rec.resolves.length - 1] === (over ? 1 : 0), `resolve count ${rec.resolves.join(',')} in ${s.phase}`);
  if (s.outcome === 'WIN') must(s.enemyHp === 0, 'WIN with enemy alive');
  if (s.outcome === 'LOSE') must(s.heroHp === 0, 'LOSE with hero alive');
  if (s.phase === 'AIM') must(s.aimRemainingMs !== null && Number.isFinite(s.aimRemainingMs) && s.aimRemainingMs >= 0, 'aimRemaining');
  return s.now;
}

function checkRecorder(rec: Recorder) {
  for (const t of rec.times) must(!Number.isNaN(t), 'NaN event time');
  for (let i = 1; i < rec.times.length; i++) must(rec.times[i] >= rec.times[i - 1], `event time backwards ${rec.times[i - 1]} -> ${rec.times[i]}`);
  for (const p of rec.phases) must(LEGAL[p.prev].includes(p.phase), `illegal transition ${p.prev}->${p.phase}`);
  for (const ms of rec.enemyShotFromCue) must(ms >= DUEL_CONFIG.fairness.minLethalMs, `F1: enemy shot ${ms} ms after cue`);
  for (const r of rec.resolves) must(r <= 1, 'double resolve');
  for (const p of rec.plans) expect(p).toEqual(rec.plans[0]); // F5
}

function drive(seed: number, wild: boolean, hostile: boolean) {
  const r = new Rng(seed);
  const heroMax = r.int(1, 6);
  const enemyMax = r.int(1, 6);
  const opp = randomOpponent(r);
  const d = new DuelSystem({ seed, opponent: opp, heroHp: heroMax, enemyHp: enemyMax, audio: quietAudio });
  const rec = record(d);
  const log = randomLog(r, { wild, hostileCoords: hostile });
  let now = check(d, rec, 0, heroMax, enemyMax);
  for (const ev of log) {
    d.input(ev);
    now = check(d, rec, now, heroMax, enemyMax);
    if (r.next() < 0.2) { d.advanceTo(d.snapshot().now + r.int(0, 700)); now = check(d, rec, now, heroMax, enemyMax); }
  }
  d.advanceTo(d.snapshot().now + 20000);
  check(d, rec, now, heroMax, enemyMax);
  checkRecorder(rec);
  return { d, rec, heroMax, enemyMax, opp, log };
}

describe('duel fuzz: invariants hold for random input logs', () => {
  it(`normal timings, ${RUNS} runs`, () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      try { drive(seed, false, false); } catch (e) { throw new Error(`seed ${seed}: ${(e as Error).message}`); }
    }
  });
  it(`wild timings (zero gaps, 5 s jumps, backwards stamps), ${RUNS} runs`, () => {
    for (let seed = 10001; seed < 10001 + RUNS; seed++) {
      try { drive(seed, true, false); } catch (e) { throw new Error(`seed ${seed}: ${(e as Error).message}`); }
    }
  });
  it(`hostile coordinates (NaN, +-Infinity, negative, 1e9), ${RUNS} runs`, () => {
    for (let seed = 20001; seed < 20001 + RUNS; seed++) {
      try { drive(seed, true, true); } catch (e) { throw new Error(`seed ${seed}: ${(e as Error).message}`); }
    }
  });
});

describe('duel fuzz: coverage of the fuzzer itself (guards against vacuous passes)', () => {
  it('reaches WIN, LOSE, every phase, retries and each loss cause', () => {
    const outcomes = new Set<string>();
    const phases = new Set<string>();
    const causes = new Set<string>();
    let retries = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const { d, rec } = drive(seed, false, false);
      const res = d.lastResult;
      if (res) { outcomes.add(res.outcome); if (res.cause) causes.add(res.cause); }
      for (const p of rec.phases) phases.add(p.phase);
      retries += rec.resolves.length - 1;
    }
    expect([...outcomes].sort()).toEqual(['LOSE', 'WIN']);
    // WAIT is never announced through onPhase (initial state and retry restart silently, QA-06)
    for (const p of VALID_PHASES.filter((x) => x !== 'WAIT')) expect(phases.has(p)).toBe(true);
    expect(retries).toBeGreaterThan(50);
    expect(causes.size).toBeGreaterThanOrEqual(2);
  });
});

describe('duel fuzz: determinism', () => {
  it('same seed + same input log => identical outcome (replayDuel), 2000 runs', () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const a = drive(seed, true, true);
      const params = { seed, opponent: a.opp, heroHp: a.heroMax, enemyHp: a.enemyMax, audio: quietAudio };
      const end = a.d.snapshot().now;
      const b = replayDuel(params, a.d.inputLog, end);
      const c = replayDuel(params, a.d.inputLog, end);
      expect(b.snapshot()).toEqual(c.snapshot());
      expect(b.lastResult).toEqual(c.lastResult);
      expect(b.snapshot()).toEqual(a.d.snapshot());
    }
  });

  it('result does not depend on how often the frame loop calls advanceTo (live play vs replay), 1500 runs', () => {
    let tieDiffs = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const r = new Rng(seed * 7);
      const opp = randomOpponent(r);
      const log = randomLog(r, { wild: false });
      const mkSys = () => new DuelSystem({ seed, opponent: opp, audio: quietAudio });
      const plain = mkSys();
      for (const ev of log) plain.input(ev);
      plain.advanceTo(plain.snapshot().now + 30000);
      // 60 fps style: advance in 16.67 ms frames between inputs
      const framed = mkSys();
      for (const ev of log) {
        for (let t = framed.snapshot().now + 1000 / 60; t < ev.t; t += 1000 / 60) framed.advanceTo(t);
        framed.input(ev);
      }
      framed.advanceTo(framed.snapshot().now + 30000);
      const a = plain.lastResult, b = framed.lastResult;
      if (JSON.stringify(a?.outcome) !== JSON.stringify(b?.outcome) || a?.cause !== b?.cause || a?.hits !== b?.hits || a?.heroHp !== b?.heroHp) tieDiffs++;
    }
    // Integer-ms inputs make exact ties common, so a handful of float-rounding flips would be a (low) finding.
    expect(tieDiffs).toBe(0);
  });

  it('retry reproduces the enemy timing (F5) on every attempt, 1000 runs', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const r = new Rng(seed);
      const d = new DuelSystem({ seed, opponent: randomOpponent(r), heroHp: 1, audio: quietAudio });
      const rec = record(d);
      const plan0 = d.plan;
      for (let a = 0; a < 4; a++) {
        d.advanceTo(d.snapshot().now + 30000); // hero never acts: dies
        expect(d.isOver).toBe(true);
        d.retry();
        expect(d.plan).toEqual(plan0);
        expect(d.currentPhase).toBe('WAIT');
      }
      d.advanceTo(d.snapshot().now + 30000);
      // with the same (non-)input every attempt, the enemy shot lands at the same cue-relative ms
      const first = rec.enemyShotFromCue[0];
      for (const ms of rec.enemyShotFromCue) expect(ms).toBe(first);
      expect(first).toBeGreaterThanOrEqual(450);
    }
  });
});

describe('duel fuzz: extreme configs never throw or produce NaN', () => {
  const weird = (r: Rng) => cfgWith({
    aim: { slowMoScale: [0, 0.0001, 0.35, 1, 5][r.int(0, 4)], budgetMs: r.int(0, 3000), recoilMs: r.int(0, 500), followUpBudgetMs: r.int(0, 900), assistRadiusPx: r.int(0, 400) },
    damage: { baseDamage: [0, 0.1, 1, 1e9][r.int(0, 3)], critMultiplier: [0, 1.5, 100][r.int(0, 2)], enemyDamage: [0, 1, 1e9][r.int(0, 2)] },
    fairness: { minLethalMs: r.int(0, 900), minShotGapMs: r.int(0, 500), enemyHitTolerancePx: r.int(0, 60) },
    resolve: { holdMs: r.int(0, 2000) },
    draw: { flinchPenaltyMs: r.int(0, 600), drawAnimMs: r.int(0, 400) },
  });

  it('3000 runs', () => {
    for (let seed = 1; seed <= 3000; seed++) {
      const r = new Rng(seed);
      const cfg = weird(r);
      const heroMax = r.int(1, 10), enemyMax = r.int(1, 10);
      const d = new DuelSystem({ seed, config: cfg, opponent: randomOpponent(r), heroHp: heroMax, enemyHp: enemyMax, audio: quietAudio });
      let prev = 0;
      for (const ev of randomLog(r, { wild: true, hostileCoords: true })) {
        d.input(ev);
        const s = d.snapshot();
        finite(s.now, s.heroHp, s.enemyHp);
        expect(s.now).toBeGreaterThanOrEqual(prev);
        prev = s.now;
        expect(s.heroHp).toBeGreaterThanOrEqual(0);
        expect(s.enemyHp).toBeGreaterThanOrEqual(0);
      }
      d.advanceTo(prev + 60000);
      const res = d.lastResult;
      if (res) { finite(res.heroHp, res.enemyHp, res.durationMs, res.enemyShotMs); }
      const outcomes: (DuelOutcome | null)[] = ['WIN', 'LOSE', null];
      expect(outcomes).toContain(d.snapshot().outcome);
    }
  });
});
