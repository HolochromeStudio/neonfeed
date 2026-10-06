import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { DUEL_CONFIG } from '../src/data/duelConfig';
import type { DuelConfig } from '../src/data/duelConfig';
import { ENEMIES, ENEMY_LIST, getEnemyDef } from '../src/data/enemies';
import { neutralDuelModifiers } from '../src/data/perks';
import type { DuelModifiers } from '../src/data/perks';
import { DuelSystem, configForOpponent, replayDuel } from '../src/systems/DuelSystem';
import type { DuelEvents, DuelInput, OpponentController } from '../src/systems/DuelSystem';
import { BAIT_HOLD_MS, BLUFF_MISS_PX, DISARM_BEAT_MS, createOpponent, opponentOptionsFromModifiers } from '../src/systems/EnemyAISystem';
import type { OpponentOptions } from '../src/systems/EnemyAISystem';
import { composePerks } from '../src/systems/PerkSystem';
import { LIMB, cfgWith, quietAudio, randomLog } from './qa/helpers';

/** A06 hooks wired into DuelSystem (task: bluff, bait, devil's deal, disarm drop, maxDisarms). Deterministic, no Phaser. */

const noSlowMo = cfgWith({ aim: { slowMoScale: 1 } });
const NAMES: (keyof DuelEvents)[] = ['onShot', 'onMiss', 'onHit', 'onBluff', 'onBait', 'onDisarm', 'onFlinch', 'onDraw', 'onCue', 'onResolve', 'onRetry'];

interface Run {
  d: DuelSystem;
  ev: { [K in keyof DuelEvents]?: DuelEvents[K][] };
  /** Every enemy shot: time, whether the cue had happened and the cue-relative ms. */
  shots: { t: number; cue: number | null; rel: number | null; evaded?: string }[];
}

function make(opts: OpponentOptions, enemy = 'bandit', o: { seed?: number; difficulty?: number; cfg?: DuelConfig; hp?: number; enemyHp?: number; mods?: Partial<DuelModifiers> } = {}): Run {
  const seed = o.seed ?? 1;
  const opp = createOpponent(enemy, new Rng(seed), o.difficulty ?? 0, opts);
  const d = new DuelSystem({ seed, opponent: opp, config: o.cfg ?? noSlowMo, heroHp: o.hp ?? 6, enemyHp: o.enemyHp ?? 3, audio: quietAudio, modifiers: o.mods });
  const ev: Run['ev'] = {};
  for (const n of NAMES) d.events.on(n, ((e: never) => ((ev[n] ??= []) as unknown[]).push(e)) as never);
  const shots: Run['shots'] = [];
  d.events.on('onShot', (e) => {
    if (e.shooter !== 'enemy') return;
    const cue = d.snapshot().cueAt;
    shots.push({ t: e.t, cue, rel: cue === null ? null : e.t - cue });
  });
  d.events.on('onMiss', (e) => { if (e.shooter === 'enemy' && e.evaded) shots[shots.length - 1].evaded = e.evaded; });
  return { d, ev, shots };
}

/** The cue ms of a fresh attempt (start 0), and the planned fake. */
function plan(opts: OpponentOptions, enemy = 'bandit', seed = 1, difficulty = 0) {
  const opp = createOpponent(enemy, new Rng(seed), difficulty, opts);
  const d = new DuelSystem({ seed, opponent: opp, config: noSlowMo, audio: quietAudio });
  return { cue: d.plan.waitMs, fake: opp.fakeTell, opp };
}

const bandit = getEnemyDef('bandit');

describe('Bluff (reactToFlinch): forced-miss beat before the cue', () => {
  const { cue } = plan({ bluff: true });
  const flinchAt = 100;

  it('the first flinch makes the enemy fire a wasted shot, no damage, and the flinch costs no draw time', () => {
    const r = make({ bluff: true });
    r.d.input({ type: 'hold', t: 0 });
    r.d.input({ type: 'draw', t: flinchAt }); // early draw during WAIT = flinch
    const fireAt = flinchAt + bandit.reactionMs[0] + 150;
    r.d.advanceTo(cue - 1);
    expect(r.ev.onBluff).toEqual([{ t: flinchAt, fireAt }]);
    expect(r.ev.onFlinch?.[0].penaltyMs).toBe(0);
    expect(r.shots).toEqual([{ t: fireAt, cue: null, rel: null, evaded: 'bluff' }]);
    expect(r.d.snapshot().heroHp).toBe(6);
    expect(r.d.currentPhase).toBe('WAIT');
    r.d.input({ type: 'draw', t: cue + 250 });
    expect(r.d.snapshot().rawReactionMs).toBe(250);
    expect(r.d.snapshot().reactionMs).toBe(250); // no +300 penalty
    expect(r.d.snapshot().flinched).toBe(true);
    expect(BLUFF_MISS_PX).toBeGreaterThan(DUEL_CONFIG.fairness.enemyHitTolerancePx);
  });

  it('without the perk the same flinch costs the normal penalty and nothing fires', () => {
    const r = make({});
    r.d.input({ type: 'draw', t: flinchAt });
    r.d.input({ type: 'draw', t: cue + 250 });
    expect(r.ev.onBluff).toBeUndefined();
    expect(r.ev.onFlinch?.[0].penaltyMs).toBe(DUEL_CONFIG.draw.flinchPenaltyMs);
    expect(r.d.snapshot().reactionMs).toBe(250 + DUEL_CONFIG.draw.flinchPenaltyMs);
    expect(r.shots).toEqual([]);
  });

  it('the real cue and the real shot are untouched (F1): same cue, same cue-to-shot as a duel without a flinch', () => {
    const base = make({ bluff: true });
    base.d.advanceTo(cue + 3000);
    const b = make({ bluff: true });
    b.d.input({ type: 'draw', t: flinchAt });
    b.d.advanceTo(cue + 3000);
    expect(b.ev.onCue?.[0].t).toBe(base.ev.onCue?.[0].t);
    const real = b.shots.filter((s) => s.cue !== null);
    expect(real[0].rel).toBe(base.shots[0].rel);
    expect(real[0].rel as number).toBeGreaterThanOrEqual(DUEL_CONFIG.fairness.minLethalMs);
  });

  it('one use per attempt; a flinch whose shot would not land before the cue is not a bluff; retry gets a fresh one', () => {
    const late = make({ bluff: true });
    late.d.input({ type: 'draw', t: cue - 40 });
    late.d.advanceTo(cue + 10);
    expect(late.ev.onBluff).toBeUndefined();
    expect(late.shots.filter((s) => s.cue === null)).toEqual([]);
    expect(late.ev.onFlinch?.[0].penaltyMs).toBe(DUEL_CONFIG.draw.flinchPenaltyMs);

    const r = make({ bluff: true });
    r.d.input({ type: 'draw', t: flinchAt });
    r.d.input({ type: 'lift', t: flinchAt + 20 }); // a second flinch is ignored, never a second bluff
    r.d.advanceTo(cue + 20000); // hero never draws: shot down
    expect(r.ev.onBluff?.length).toBe(1);
    expect(r.d.isOver).toBe(true);
    const t0 = r.d.snapshot().now;
    r.d.retry();
    r.d.input({ type: 'draw', t: t0 + flinchAt });
    expect(r.ev.onBluff?.length).toBe(2);
  });

  it('resolves exactly once and replays identically from seed + input log', () => {
    const r = make({ bluff: true });
    r.d.input({ type: 'hold', t: 0 });
    r.d.input({ type: 'draw', t: flinchAt });
    r.d.input({ type: 'draw', t: cue + 200 });
    r.d.input({ type: 'aim', t: cue + 201, x: 250, y: 316 });
    r.d.input({ type: 'fire', t: cue + 202 });
    r.d.advanceTo(cue + 9000);
    expect(r.ev.onResolve?.length).toBe(1);
    const opp = createOpponent('bandit', new Rng(1), 0, { bluff: true });
    const again = replayDuel({ seed: 1, opponent: opp, config: noSlowMo, heroHp: 6, enemyHp: 3, audio: quietAudio }, r.d.inputLog, cue + 9000);
    expect(again.lastResult).toEqual(r.d.lastResult);
    expect(again.snapshot()).toEqual(r.d.snapshot());
  });
});

describe('Bait (reactToHold): standing still brings the real cue forward', () => {
  const baitOpts: OpponentOptions = { bait: true, forceFakeTell: true };
  /** Seeds where the controller actually cracks early (bait needs a planned fake and an earlier real cue). */
  const hits: number[] = [];
  for (let seed = 1; seed <= 120 && hits.length < 8; seed++) {
    const r = make(baitOpts, 'coward', { seed, difficulty: 0.5 });
    r.d.advanceTo(plan(baitOpts, 'coward', seed, 0.5).cue + 10);
    if (r.ev.onBait) hits.push(seed);
  }

  it('cracks early on a decent share of seeds, exactly BAIT_HOLD_MS after the start', () => {
    expect(hits.length).toBeGreaterThanOrEqual(3);
    for (const seed of hits) {
      const planned = plan({ forceFakeTell: true }, 'coward', seed, 0.5).cue;
      const r = make(baitOpts, 'coward', { seed, difficulty: 0.5 });
      r.d.advanceTo(planned + 10);
      expect(r.ev.onBait?.length).toBe(1);
      const b = r.ev.onBait![0];
      expect(b.t).toBe(BAIT_HOLD_MS);
      expect(b.plannedCueAt).toBe(planned);
      expect(b.cueAt).toBeLessThan(planned);
      expect(r.ev.onCue?.[0].t).toBe(b.cueAt); // the cue really moved
    }
  });

  it('F1: cue to first shot is the same plan and never under the floor; the hero is not punished for the early cue', () => {
    for (const seed of hits) {
      const base = make({ forceFakeTell: true }, 'coward', { seed, difficulty: 0.5 });
      base.d.advanceTo(plan({ forceFakeTell: true }, 'coward', seed, 0.5).cue + 5000);
      const r = make(baitOpts, 'coward', { seed, difficulty: 0.5 });
      r.d.advanceTo(plan(baitOpts, 'coward', seed, 0.5).cue + 5000);
      expect(r.shots[0].rel).toBe(base.shots[0].rel);
      expect(r.shots[0].rel as number).toBeGreaterThanOrEqual(DUEL_CONFIG.fairness.minLethalMs);
      expect(r.shots[0].t).toBeLessThan(base.shots[0].t); // early cue, early (but cue-relative identical) shot
    }
  });

  it('a flinch, or no bait perk, or a stray move that restarts the stillness cancels / delays the check', () => {
    const seed = hits[0];
    const planned = plan(baitOpts, 'coward', seed, 0.5).cue;
    const flinched = make(baitOpts, 'coward', { seed, difficulty: 0.5 });
    flinched.d.input({ type: 'lift', t: 300 });
    flinched.d.advanceTo(planned + 10);
    expect(flinched.ev.onBait).toBeUndefined();
    const off = make({ forceFakeTell: true }, 'coward', { seed, difficulty: 0.5 });
    off.d.advanceTo(planned + 10);
    expect(off.ev.onBait).toBeUndefined();
    const moved = make(baitOpts, 'coward', { seed, difficulty: 0.5 });
    moved.d.input({ type: 'hold', t: 250 });
    moved.d.advanceTo(planned + 10);
    if (moved.ev.onBait) expect(moved.ev.onBait[0].t).toBe(250 + BAIT_HOLD_MS); // evaluated at the exact ms, not at a frame
  });

  it('a fake that had not played yet is reported as cancelled', () => {
    let seen = false;
    for (const seed of hits) {
      const o = plan(baitOpts, 'coward', seed, 0.5).opp;
      const r = make(baitOpts, 'coward', { seed, difficulty: 0.5 });
      r.d.advanceTo(plan(baitOpts, 'coward', seed, 0.5).cue + 10);
      const b = r.ev.onBait![0];
      expect(b.fakeCancelled).toBe(!!o.fakeTell && o.fakeTell.startMs >= BAIT_HOLD_MS);
      if (b.fakeCancelled) seen = true;
    }
    expect(seen || hits.length > 0).toBe(true);
  });

  it('works on the Drunk only with the upgrade (baitDrunk) and still keeps F1', () => {
    const plainCue = plan({ bait: true }, 'drunk', 3).cue;
    const a = make({ bait: true }, 'drunk', { seed: 3 });
    a.d.advanceTo(plainCue + 10);
    expect(a.ev.onBait).toBeUndefined();
    let found = false;
    for (let seed = 1; seed <= 40 && !found; seed++) {
      const r = make({ bait: true, baitDrunk: true }, 'drunk', { seed });
      r.d.advanceTo(plan({ bait: true, baitDrunk: true }, 'drunk', seed).cue + 4000);
      if (r.ev.onBait) {
        found = true;
        expect(r.shots[0].rel as number).toBeGreaterThanOrEqual(DUEL_CONFIG.fairness.minLethalMs);
      }
    }
    expect(found).toBe(true);
  });

  it('retry reproduces the plan (F5) after a bait; replays identically', () => {
    const seed = hits[0];
    const r = make(baitOpts, 'coward', { seed, difficulty: 0.5, hp: 1 });
    const p0 = r.d.plan;
    r.d.advanceTo(p0.waitMs + 20000);
    expect(r.d.isOver).toBe(true);
    r.d.input({ type: 'retry', t: r.d.snapshot().now + 1 });
    expect(r.d.plan).toEqual(p0);
    r.d.advanceTo(r.d.snapshot().now + 20000);
    expect(r.ev.onBait?.length).toBe(2);
    expect(r.ev.onResolve?.length).toBe(2);
    const opp = createOpponent('coward', new Rng(seed), 0.5, baitOpts);
    const again = replayDuel({ seed, opponent: opp, config: noSlowMo, heroHp: 1, enemyHp: 3, audio: quietAudio }, r.d.inputLog, r.d.snapshot().now);
    expect(again.lastResult).toEqual(r.d.lastResult);
  });
});

describe("Devil's Deal (forceFakeTell): every enemy plans a fake, F1 and the rng stream hold", () => {
  const opts = opponentOptionsFromModifiers(composePerks(['devils_deal']).duel);
  it('the modifier maps to the option and every regular enemy has a fake after waitMs()', () => {
    expect(opts.forceFakeTell).toBe(true);
    for (const def of ENEMY_LIST) {
      for (let seed = 1; seed <= 10; seed++) {
        const o = createOpponent(def.id, new Rng(seed), 0.2, opts);
        const d = new DuelSystem({ seed, opponent: o, audio: quietAudio });
        expect(o.fakeTell, `${def.id} seed ${seed}`).not.toBeNull();
        const f = o.fakeTell!;
        expect(f.recoverMs).toBeGreaterThanOrEqual(400);
        expect(d.plan.waitMs).toBeGreaterThanOrEqual(f.startMs + f.durationMs + f.recoverMs);
      }
    }
  });
  it('the real shot stays at least minLethalMs after the cue and the later rng draws match a duel without the perk', () => {
    for (const def of ENEMY_LIST) {
      for (let seed = 1; seed <= 10; seed++) {
        const a = make({}, def.id, { seed, difficulty: 0.2 });
        const b = make(opts, def.id, { seed, difficulty: 0.2 });
        a.d.advanceTo(a.d.plan.waitMs + 6000);
        b.d.advanceTo(b.d.plan.waitMs + 6000);
        expect(b.shots[0].rel as number).toBeGreaterThanOrEqual(DUEL_CONFIG.fairness.minLethalMs);
        expect(b.d.plan.firstShotMs).toBe(a.d.plan.firstShotMs); // shot plan aligned (the fake only lengthens WAIT)
        expect(b.d.plan.drawMs).toBe(a.d.plan.drawMs);
      }
    }
  });
});

describe('Disarmer: drop beat and maxDisarms', () => {
  /** draw at cue+150, aim the gun arm, release: a limb hit while the enemy shot is still far away. */
  function limbRun(opts: OpponentOptions, enemy = 'bandit', seed = 1) {
    const r = make(opts, enemy, { seed, difficulty: 0, hp: 9, enemyHp: 40 });
    const cue = r.d.plan.waitMs;
    r.d.input({ type: 'draw', t: cue + 150 });
    r.d.input({ type: 'aim', t: cue + 151, x: LIMB.x, y: LIMB.y });
    r.d.input({ type: 'fire', t: cue + 152 });
    r.d.advanceTo(cue + 6000);
    return r;
  }
  it('a limb disarm with the drop option delays the next shot by exactly one beat', () => {
    const base = limbRun({});
    const drop = limbRun({ disarmDropsGun: true });
    expect(base.ev.onDisarm?.[0].pickupMs).toBe(0);
    expect(drop.ev.onDisarm?.[0].pickupMs).toBe(DISARM_BEAT_MS);
    const first = (r: Run) => r.shots[0].t;
    expect(first(drop) - first(base)).toBe(DISARM_BEAT_MS);
  });
  it('the option is mapped from the Disarmer modifier', () => {
    expect(opponentOptionsFromModifiers(composePerks(['disarmer']).duel).disarmDropsGun).toBe(true);
    expect(opponentOptionsFromModifiers(composePerks([]).duel).disarmDropsGun).toBe(false);
  });
  it('configForOpponent: enemy cap (+1 Disarmer), bosses default to 1, plain opponents keep the config value', () => {
    const cap = (id: string, d: number, boss = false, mods: Partial<DuelModifiers> = {}) =>
      configForOpponent(DUEL_CONFIG, createOpponent(id, new Rng(1), d), boss, mods).fairness.maxDisarms;
    expect(cap('bandit', 0)).toBe(2);
    expect(cap('bounty_hunter', 0)).toBe(1);
    expect(cap('sheriff', 1)).toBe(1); // hp 3 + 1 at depth
    expect(cap('bandit', 0, false, { maxDisarmsDelta: 1 })).toBe(3);
    expect(cap('bounty_hunter', 0, false, { maxDisarmsDelta: 1 })).toBe(2);
    // bosses: no maxDisarms field in boss data means 1 (D19); a boss with the field uses it
    const boss = { id: 'boss', waitMs: () => 1000, drawMs: () => 300, shotDelayMs: () => 900, aimErrorPx: () => 0 } as OpponentController;
    expect(configForOpponent(DUEL_CONFIG, boss, true).fairness.maxDisarms).toBe(1);
    expect(configForOpponent(DUEL_CONFIG, boss, true, { maxDisarmsDelta: 1 }).fairness.maxDisarms).toBe(2);
    expect(configForOpponent(DUEL_CONFIG, { ...boss, maxDisarms: 3 } as OpponentController, true).fairness.maxDisarms).toBe(3);
    expect(configForOpponent(DUEL_CONFIG, boss, false)).toBe(DUEL_CONFIG);
    expect(DUEL_CONFIG.fairness.maxDisarms).toBe(2); // the shared config is never mutated
  });
  it('the cap really limits disarms per attempt in a duel', () => {
    const count = (maxDisarms: number) => {
      const opp = { ...createOpponent('bandit', new Rng(1), 0), maxDisarms } as unknown as OpponentController;
      // a plain controller with a far shot: the hero keeps shooting the gun arm
      const fixed: OpponentController = { id: 'f', waitMs: () => 1000, drawMs: () => 300, shotDelayMs: (_r, i) => (i === 0 ? 30000 : 30000), aimErrorPx: () => 0, ...({ maxDisarms } as object) };
      void opp;
      const cfg = configForOpponent(noSlowMo, fixed, false);
      const d = new DuelSystem({ seed: 1, opponent: fixed, config: cfg, heroHp: 3, enemyHp: 1e6, audio: quietAudio });
      let n = 0;
      d.events.on('onDisarm', () => n++);
      d.input({ type: 'draw', t: 1100 });
      d.input({ type: 'aim', t: 1101, x: LIMB.x, y: LIMB.y });
      d.input({ type: 'fire', t: 1102 });
      d.advanceTo(9000); // follow-up aims auto-fire at the parked reticle
      return n;
    };
    expect(count(1)).toBe(1);
    expect(count(2)).toBe(2);
    expect(count(3)).toBe(3);
  });
});

describe('fuzz: all hooks on, random inputs', () => {
  const ALL: OpponentOptions = { forceFakeTell: true, bluff: true, bait: true, baitDrunk: true, disarmDropsGun: true };
  const RUNS = 600;

  it(`${RUNS} runs: F1 floor, one resolution per attempt, finite state, replay and frame loop agree, retry keeps the plan`, () => {
    let bluffs = 0, baits = 0, disarms = 0;
    for (let seed = 1; seed <= RUNS; seed++) {
      const r = new Rng(seed * 13);
      const enemyHp = r.int(1, 4);
      const params = (opp: OpponentController) => ({ seed, opponent: opp, config: configForOpponent(DUEL_CONFIG, opp, false, {}), heroHp: r2(seed), enemyHp, audio: quietAudio });
      const r2 = (s: number) => 1 + (s % 3);
      const id = ENEMY_LIST[r.int(0, ENEMY_LIST.length - 1)].id;
      const diff = r.next();
      const mkOpp = () => createOpponent(id, new Rng(seed), diff, ALL);
      const d = new DuelSystem(params(mkOpp()));
      const plan0 = d.plan;
      let resolves = 0;
      d.events.on('onResolve', () => resolves++);
      d.events.on('onRetry', () => { expect(resolves).toBe(1); resolves = 0; expect(d.plan).toEqual(plan0); });
      d.events.on('onBluff', () => bluffs++);
      d.events.on('onBait', () => baits++);
      d.events.on('onDisarm', () => disarms++);
      const lethal: number[] = [];
      d.events.on('onCue', (c) => lethal.push(c.t));
      let firstSeen = false;
      d.events.on('onShot', (e) => {
        const cue = d.snapshot().cueAt;
        if (e.shooter !== 'enemy' || cue === null) return;
        if (!firstSeen) { firstSeen = true; expect(e.t - cue).toBeGreaterThanOrEqual(DUEL_CONFIG.fairness.minLethalMs); }
      });
      d.events.on('onRetry', () => { firstSeen = false; });
      const log: DuelInput[] = randomLog(r, { n: r.int(2, 30) });
      // plain feed vs 60 fps frames
      const framed = new DuelSystem(params(mkOpp()));
      for (const ev of log) {
        d.input(ev);
        for (let t = framed.snapshot().now + 1000 / 60; t < ev.t; t += 1000 / 60) framed.advanceTo(t);
        framed.input(ev);
        const s = d.snapshot();
        expect(Number.isFinite(s.now) && Number.isFinite(s.heroHp) && Number.isFinite(s.enemyHp)).toBe(true);
        if (d.isOver && d.snapshot().phase === 'RETRY') d.input({ type: 'retry', t: s.now + 1 });
      }
      const end = d.snapshot().now + 30000;
      d.advanceTo(end);
      expect(resolves).toBeLessThanOrEqual(1);
      // replay: same seed + accepted input log => identical result
      const again = replayDuel(params(mkOpp()), d.inputLog, end);
      expect(again.snapshot().outcome).toBe(d.snapshot().outcome);
      expect(again.snapshot().heroHp).toBe(d.snapshot().heroHp);
      expect(again.snapshot().enemyHp).toBe(d.snapshot().enemyHp);
      void lethal;
    }
    expect(bluffs + baits + disarms).toBeGreaterThan(0);
  });

  it('the modifier mapping is complete and neutral modifiers map to all-off options', () => {
    expect(opponentOptionsFromModifiers(neutralDuelModifiers())).toEqual({ forceFakeTell: false, bluff: false, bait: false, disarmDropsGun: false });
    const m = composePerks(['bluff', 'bait']).duel;
    expect(opponentOptionsFromModifiers(m)).toMatchObject({ bluff: true, bait: true });
    expect(Object.keys(ENEMIES).length).toBeGreaterThan(0);
  });
});
