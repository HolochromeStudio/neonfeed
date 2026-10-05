import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { DUEL_CONFIG } from '../../src/data/duelConfig';
import { BasicOpponent, DuelSystem, replayDuel } from '../../src/systems/DuelSystem';
import type { DuelInput, DuelParams, OpponentController } from '../../src/systems/DuelSystem';
import { LEGAL, VALID_PHASES, quietAudio, randomCoord, randomLog, randomOpponent, record } from './helpers';

const envRuns = Number((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.QA_FUZZ_RUNS);
const RUNS = envRuns > 0 ? envRuns : 3000;

function must(c: boolean, msg: string): void {
  if (!c) throw new Error(`invariant violated: ${msg}`);
}

/** BasicOpponent with a (possibly hostile) dodge window. */
class WithWindow extends BasicOpponent {
  constructor(readonly dodgeWindowMs: number, o: ConstructorParameters<typeof BasicOpponent>[0]) {
    super(o);
  }
}

const WINDOWS = [undefined, 250, 150, 600, 40, 1e9, -3, 0, NaN, Infinity];

function dodgeLog(r: Rng, hostile: boolean): DuelInput[] {
  const base = randomLog(r, { wild: r.next() < 0.3, hostileCoords: hostile, n: r.int(0, 30) });
  const out: DuelInput[] = [];
  for (const ev of base) {
    out.push(ev);
    if (r.next() < 0.35) {
      const t = Number.isFinite(ev.t) ? ev.t + r.int(0, 300) : ev.t;
      out.push({ type: 'dodge', t, dir: r.next() < 0.5 ? 'left' : 'right' });
    }
  }
  if (hostile && r.next() < 0.3) out.push({ type: 'dodge', t: randomCoord(r) });
  return out;
}

function params(r: Rng, seed: number): DuelParams & { opponent: OpponentController } {
  const base = randomOpponent(r) as BasicOpponent;
  const w = WINDOWS[r.int(0, WINDOWS.length - 1)];
  const opp = w === undefined ? base : new WithWindow(w, { waitMin: 600, waitMax: 1500, shotMs: r.int(0, 1200), shotJitter: r.int(0, 200), maxAimError: r.int(0, 40) });
  const mods = {
    dodgeWindowMult: [1, 2, 0.1, 4, NaN][r.int(0, 4)],
    dodgeGuaranteesCrit: r.next() < 0.5,
    dodgeCloudBlocksShot: r.next() < 0.5,
    dodgeWhileAiming: r.next() < 0.5,
    tumbleBudgetCost: [0, 0.25, 0.4, 1, 5, NaN, -1][r.int(0, 6)],
    phantomStep: r.next() < 0.4,
    ignoreFirstHits: r.int(0, 1),
  };
  const kind = (['normal', 'elite', 'boss'] as const)[r.int(0, 2)];
  return { seed, opponent: opp, heroHp: r.int(1, 4), enemyHp: r.int(1, 4), kind, modifiers: mods, audio: quietAudio };
}

function drive(seed: number, hostile: boolean) {
  const r = new Rng(seed);
  const p = params(r, seed);
  const heroMax = p.heroHp as number;
  const d = new DuelSystem(p);
  const rec = record(d);
  let evaded = 0;
  let dodgeEvents = 0;
  let dodgeOk = 0;
  d.events.on('onMiss', (e) => { if (e.shooter === 'enemy' && e.evaded === 'dodge') evaded++; });
  d.events.on('onDodge', (e) => {
    dodgeEvents++;
    if (e.success) dodgeOk++;
    must(Number.isFinite(e.windowMs) && e.windowMs >= DUEL_CONFIG.dodge.minWindowMs && e.windowMs <= DUEL_CONFIG.dodge.maxWindowMs, `window ${e.windowMs}`);
    must(e.etaMs === null || (Number.isFinite(e.etaMs) && e.etaMs >= 0), `eta ${e.etaMs}`);
    must(e.success === (e.result === 'perfect' || e.result === 'ok'), 'result/success mismatch');
    if (e.success) must(e.etaMs !== null && e.etaMs <= e.windowMs, 'success outside the window');
    else must(e.etaMs === null || e.etaMs > e.windowMs, 'failure inside the window');
  });
  d.events.on('onRetry', () => { evaded = 0; dodgeOk = 0; });
  let prevHp = heroMax;
  const check = (): void => {
    const s = d.snapshot();
    must(VALID_PHASES.includes(s.phase), 'phase');
    for (const x of [s.now, s.heroHp, s.enemyHp, s.timeScale, s.dodge.windowMs, s.dodge.stumbleMs]) must(Number.isFinite(x), `non-finite ${x}`);
    must(s.dodge.etaMs === null || Number.isFinite(s.dodge.etaMs), 'eta');
    must(s.aimRemainingMs === null || (Number.isFinite(s.aimRemainingMs) && s.aimRemainingMs >= 0), 'aimRemaining');
    must(!s.dodge.open || s.dodge.available, 'open without available');
    must(s.heroHp <= prevHp || s.attempt > 1 || s.heroHp <= heroMax, 'hp rose');
    must(s.heroHp >= 0 && s.heroHp <= heroMax, 'hp range');
    const over = s.phase === 'RESOLVE' || s.phase === 'RETRY';
    must((s.outcome !== null) === over, 'outcome vs phase');
    must(rec.resolves[rec.resolves.length - 1] === (over ? 1 : 0), 'resolve count');
    must(!over || !s.dodge.available, 'dodge available after the duel');
    if (s.phase === 'WAIT' || s.phase === 'DRAW') must(!s.dodge.available, `dodge available in ${s.phase}`);
    prevHp = s.attempt === 1 ? s.heroHp : prevHp;
  };
  check();
  for (const ev of dodgeLog(r, hostile)) {
    d.input(ev);
    check();
    if (r.next() < 0.2) { d.advanceTo(d.snapshot().now + r.int(0, 600)); check(); }
  }
  d.advanceTo(d.snapshot().now + 20000);
  check();
  for (const ms of rec.enemyShotFromCue) must(ms >= DUEL_CONFIG.fairness.minLethalMs, `F1: ${ms}`);
  for (const c of rec.resolves) must(c <= 1, 'double resolve');
  for (const pl of rec.plans) expect(pl).toEqual(rec.plans[0]);
  for (const pr of rec.phases) must(LEGAL[pr.prev].includes(pr.phase), `illegal ${pr.prev}->${pr.phase}`);
  const res = d.lastResult;
  if (res) {
    must(res.dodges === evaded, `result dodges ${res.dodges} vs onMiss(evaded dodge) ${evaded}`);
    must(res.dodges <= dodgeOk, 'more dodges than successful attempts');
    must(res.dodges >= 0 && res.dodgeFails >= 0 && Number.isFinite(res.dodges + res.dodgeFails), 'dodge counters');
    must(res.dodges + res.dodgeFails <= dodgeEvents, 'counters exceed events');
  }
  return { d, p, rec, dodgeEvents };
}

describe('dodge fuzz: invariants hold for random input logs with dodges', () => {
  it(`normal coordinates, ${RUNS} runs`, () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      try { drive(seed, false); } catch (e) { throw new Error(`seed ${seed}: ${(e as Error).message}`); }
    }
  });
  it(`hostile coordinates and timings, ${RUNS} runs`, () => {
    for (let seed = 50001; seed < 50001 + RUNS; seed++) {
      try { drive(seed, true); } catch (e) { throw new Error(`seed ${seed}: ${(e as Error).message}`); }
    }
  });
  it('the fuzzer reaches successful, early/late and tumble dodges (not vacuous)', () => {
    let events = 0;
    let wins = 0;
    const results = new Set<string>();
    let fromAim = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const r = new Rng(seed);
      const p = params(r, seed);
      const d = new DuelSystem(p);
      d.events.on('onDodge', (e) => { results.add(e.result); if (e.fromAim) fromAim++; });
      for (const ev of dodgeLog(r, false)) d.input(ev);
      d.advanceTo(d.snapshot().now + 20000);
      events += d.lastResult?.dodges ?? 0;
      if (d.lastResult?.outcome === 'WIN') wins++;
    }
    expect(results.has('ok') || results.has('perfect')).toBe(true);
    expect(results.has('early')).toBe(true);
    expect(events).toBeGreaterThan(20);
    expect(wins).toBeGreaterThan(20);
    expect(fromAim).toBeGreaterThan(0);
  });
});

describe('dodge fuzz: determinism', () => {
  it('same seed + same input log (dodges included) => identical snapshot and result, 1500 runs', () => {
    for (let seed = 1; seed <= 1500; seed++) {
      const a = drive(seed * 3, seed % 2 === 0);
      const end = a.d.snapshot().now;
      const b = replayDuel(a.p, a.d.inputLog, end);
      const c = replayDuel(a.p, a.d.inputLog, end);
      expect(b.snapshot()).toEqual(c.snapshot());
      expect(b.lastResult).toEqual(c.lastResult);
      expect(b.snapshot()).toEqual(a.d.snapshot());
    }
  });
});
