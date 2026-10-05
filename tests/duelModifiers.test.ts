import { describe, it, expect } from 'vitest';
import type { AudioEvent } from '../src/core/audioEvents';
import { DUEL_CONFIG } from '../src/data/duelConfig';
import type { DuelConfig } from '../src/data/duelConfig';
import { MODIFIER_TUNING } from '../src/data/duelConfig';
import type { DuelModifiers } from '../src/data/perks';
import { Rng } from '../src/core/rng';
import { DuelSystem, replayDuel } from '../src/systems/DuelSystem';
import type { DuelInput, OpponentController } from '../src/systems/DuelSystem';

class Fixed implements OpponentController {
  readonly id = 'fixed';
  constructor(private wait = 1000, private draw = 300, private shot = 900, private err = 0, private gap = 650, public aimBudgetScale?: number) {}
  waitMs() { return this.wait; }
  drawMs() { return this.draw; }
  shotDelayMs(_r: Rng, i: number) { return i === 0 ? this.shot : this.gap; }
  aimErrorPx() { return this.err; }
}

const noSlowMo: DuelConfig = { ...DUEL_CONFIG, aim: { ...DUEL_CONFIG.aim, slowMoScale: 1 } };
const quiet = { emit: (_e: AudioEvent) => undefined };
const HEAD = { x: 250, y: 316 };
const BARREL = { x: 164, y: 448 }; // inside the duel prop 'barrel' (150,430,28,36)
const CUE = 1000;

interface Opts { opp?: OpponentController; cfg?: DuelConfig; hero?: number; heroMax?: number; enemy?: number; mods?: Partial<DuelModifiers> }
function make(o: Opts = {}) {
  const d = new DuelSystem({
    seed: 1, opponent: o.opp ?? new Fixed(), config: o.cfg ?? noSlowMo, heroHp: o.hero ?? 5, heroMaxHp: o.heroMax, enemyHp: o.enemy ?? 2,
    audio: quiet, modifiers: o.mods,
  });
  const enemyShots: number[] = [];
  const playerShots: { t: number; crit: boolean }[] = [];
  const staggers: { ms: number; source: string }[] = [];
  const hits: { target: string; ignored?: boolean; revived?: boolean; killed: boolean; damage: number }[] = [];
  const budgets: number[] = [];
  d.events.on('onShot', (e) => (e.shooter === 'enemy' ? enemyShots.push(e.t) : playerShots.push({ t: e.t, crit: e.crit })));
  d.events.on('onStagger', (e) => staggers.push({ ms: e.ms, source: e.source }));
  d.events.on('onHit', (e) => hits.push({ target: e.target, ignored: e.ignored, revived: e.revived, killed: e.killed, damage: e.damage }));
  d.events.on('onAimStart', (e) => budgets.push(e.budgetMs));
  return { d, enemyShots, playerShots, staggers, hits, budgets };
}

describe('stagger (Cold Open, Dead Eye, Trick Shot)', () => {
  it('perfectStaggers delays the pending enemy shot by perfectStaggerMs', () => {
    const base = make();
    base.d.input({ type: 'draw', t: CUE + 100 });
    base.d.advanceTo(5000);
    const st = make({ mods: { perfectStaggers: true } });
    st.d.input({ type: 'draw', t: CUE + 100 });
    st.d.advanceTo(5000);
    expect(base.enemyShots[0]).toBe(CUE + 900);
    expect(st.enemyShots[0]).toBe(CUE + 900 + MODIFIER_TUNING.perfectStaggerMs);
    expect(st.staggers).toEqual([{ ms: MODIFIER_TUNING.perfectStaggerMs, source: 'perfect_draw' }]);
  });

  it('a non-perfect draw does not stagger', () => {
    const st = make({ mods: { perfectStaggers: true } });
    st.d.input({ type: 'draw', t: CUE + 300 });
    st.d.advanceTo(5000);
    expect(st.staggers).toEqual([]);
    expect(st.enemyShots[0]).toBe(CUE + 900);
  });

  it('headStagger: a non-lethal headshot pushes the shot back; a kill does not stagger', () => {
    const st = make({ enemy: 6, mods: { headStagger: true } });
    st.d.input({ type: 'draw', t: CUE + 300 });
    st.d.input({ type: 'aim', t: CUE + 430, ...HEAD });
    st.d.input({ type: 'fire', t: CUE + 440 });
    expect(st.staggers).toEqual([{ ms: MODIFIER_TUNING.headStaggerMs, source: 'headshot' }]);
    expect(st.d.snapshot().enemyShotEtaMs).toBe(900 - 440 + MODIFIER_TUNING.headStaggerMs);

    const kill = make({ enemy: 2, mods: { headStagger: true } });
    kill.d.input({ type: 'draw', t: CUE + 300 });
    kill.d.input({ type: 'aim', t: CUE + 430, ...HEAD });
    kill.d.input({ type: 'fire', t: CUE + 440 });
    expect(kill.d.lastResult?.outcome).toBe('WIN');
    expect(kill.staggers).toEqual([]);
  });

  it('without the modifier a headshot does not stagger', () => {
    const st = make({ enemy: 6 });
    st.d.input({ type: 'draw', t: CUE + 300 });
    st.d.input({ type: 'aim', t: CUE + 430, ...HEAD });
    st.d.input({ type: 'fire', t: CUE + 440 });
    expect(st.staggers).toEqual([]);
    expect(st.d.snapshot().enemyShotEtaMs).toBe(900 - 440);
  });

  it('propShotsHitEnemy: shooting a prop staggers the enemy', () => {
    const st = make({ mods: { propShotsHitEnemy: true } });
    st.d.input({ type: 'draw', t: CUE + 300 });
    st.d.input({ type: 'aim', t: CUE + 430, ...BARREL });
    st.d.input({ type: 'fire', t: CUE + 440 });
    expect(st.hits.some((h) => h.target === 'prop')).toBe(true);
    expect(st.staggers).toEqual([{ ms: MODIFIER_TUNING.propStaggerMs, source: 'prop' }]);
    // the pending shot was due at CUE+900: 460 ms away, now 460 + stagger
    expect(st.d.snapshot().enemyShotEtaMs).toBe(900 - 440 + MODIFIER_TUNING.propStaggerMs);
  });

  it('staggerEnemy is a no-op before the cue, after the duel and for bad numbers; it only ever adds time', () => {
    const st = make();
    st.d.staggerEnemy(500); // WAIT
    expect(st.staggers).toEqual([]);
    st.d.advanceTo(CUE + 10);
    for (const bad of [0, -50, NaN, Infinity, -Infinity]) st.d.staggerEnemy(bad);
    expect(st.staggers).toEqual([]);
    st.d.staggerEnemy(700, 'external');
    expect(st.staggers).toEqual([{ ms: 700, source: 'external' }]);
    st.d.advanceTo(10_000);
    expect(st.enemyShots[0]).toBe(CUE + 900 + 700);
    const over = st.d.snapshot().phase;
    expect(['RESOLVE', 'RETRY']).toContain(over);
    st.d.staggerEnemy(500);
    expect(st.staggers.length).toBe(1);
  });

  it('stagger never makes the first enemy shot earlier than the F1 floor', () => {
    for (const shot of [450, 500, 900]) {
      const st = make({ opp: new Fixed(1000, 100, shot), mods: { perfectStaggers: true } });
      st.d.input({ type: 'draw', t: CUE + 150 });
      st.d.advanceTo(9000);
      expect(st.enemyShots[0]! - CUE).toBeGreaterThanOrEqual(Math.max(450, shot) + MODIFIER_TUNING.perfectStaggerMs);
    }
  });

  it('a retry starts clean (stagger count resets, same plan)', () => {
    const st = make({ mods: { perfectStaggers: true } });
    st.d.input({ type: 'draw', t: CUE + 100 });
    st.d.advanceTo(20_000);
    expect(st.d.lastResult?.staggers).toBe(1);
    st.d.retry();
    expect(st.d.plan.firstShotMs).toBe(900);
    st.d.advanceTo(st.d.snapshot().now + 1000);
    st.d.input({ type: 'draw', t: st.d.snapshot().cueAt! + 100 });
    st.d.advanceTo(st.d.snapshot().now + 20_000);
    expect(st.d.lastResult?.staggers).toBe(1);
  });
});

describe('crit rules', () => {
  it('alwaysCrit makes every shot crit (Mad Dog Collar)', () => {
    const st = make({ enemy: 6, opp: new Fixed(1000, 300, 8000), mods: { alwaysCrit: true } });
    st.d.input({ type: 'draw', t: CUE + 300 }); // GOOD: no draw crit
    st.d.input({ type: 'aim', t: CUE + 430, x: 250, y: 350 });
    st.d.input({ type: 'fire', t: CUE + 440 });
    st.d.input({ type: 'aim', t: CUE + 700, x: 250, y: 350 });
    st.d.input({ type: 'fire', t: CUE + 710 });
    expect(st.playerShots.map((s) => s.crit)).toEqual([true, true]);
  });

  it('without it only the first shot of a perfect draw crits', () => {
    const st = make({ enemy: 6, opp: new Fixed(1000, 300, 8000) });
    st.d.input({ type: 'draw', t: CUE + 100 });
    st.d.input({ type: 'aim', t: CUE + 230, x: 250, y: 350 });
    st.d.input({ type: 'fire', t: CUE + 240 });
    st.d.input({ type: 'aim', t: CUE + 700, x: 250, y: 350 });
    st.d.input({ type: 'fire', t: CUE + 710 });
    expect(st.playerShots.map((s) => s.crit)).toEqual([true, false]);
  });

  it('flinchDisablesCrit: a flinch before a perfect draw removes the crit (Steady Hands)', () => {
    const cfg: DuelConfig = { ...noSlowMo, draw: { ...noSlowMo.draw, flinchPenaltyMs: 0 } };
    const run = (mods: Partial<DuelModifiers>) => {
      const st = make({ cfg, enemy: 6, opp: new Fixed(1000, 300, 8000), mods });
      st.d.input({ type: 'lift', t: 500 }); // flinch in WAIT
      st.d.input({ type: 'draw', t: CUE + 100 });
      st.d.input({ type: 'aim', t: CUE + 230, x: 250, y: 350 });
      st.d.input({ type: 'fire', t: CUE + 240 });
      return st.playerShots[0]!.crit;
    };
    expect(run({})).toBe(true);
    expect(run({ flinchDisablesCrit: true })).toBe(false);
  });

  it('flinchNoTimeCost: a flinch adds no time to the graded reaction or the draw animation', () => {
    const run = (mods: Partial<DuelModifiers>) => {
      const st = make({ cfg: DUEL_CONFIG, opp: new Fixed(1000, 300, 8000), mods });
      st.d.input({ type: 'lift', t: 500 });
      st.d.input({ type: 'draw', t: CUE + 100 });
      st.d.advanceTo(CUE + 100 + 130);
      return { reaction: st.d.snapshot().reactionMs, phase: st.d.currentPhase };
    };
    expect(run({})).toEqual({ reaction: 400, phase: 'DRAW' });
    expect(run({ flinchNoTimeCost: true })).toEqual({ reaction: 100, phase: 'AIM' });
  });
});

describe('draw tier promotion', () => {
  it('goodAsPerfectPerDuel promotes a Good draw (Spit and Polish) and resets on retry', () => {
    const st = make({ mods: { goodAsPerfectPerDuel: 1 }, opp: new Fixed(1000, 300, 8000) });
    const perfect: boolean[] = [];
    st.d.events.on('onDraw', (e) => perfect.push(e.perfect));
    st.d.input({ type: 'draw', t: CUE + 300 });
    expect(st.d.snapshot().tier).toBe('perfect');
    expect(st.d.snapshot().reactionMs).toBe(300); // the real time is still reported
    expect(perfect).toEqual([true]);
    st.d.advanceTo(20_000);
    st.d.retry();
    st.d.advanceTo(st.d.snapshot().now + 1000);
    st.d.input({ type: 'draw', t: st.d.snapshot().cueAt! + 300 });
    expect(st.d.snapshot().tier).toBe('perfect');
  });

  it('does not promote an OK or SLOW draw, or anything without the perk', () => {
    const st = make({ mods: { goodAsPerfectPerDuel: 1 }, opp: new Fixed(1000, 300, 8000) });
    st.d.input({ type: 'draw', t: CUE + 400 });
    expect(st.d.snapshot().tier).toBe('ok');
    const none = make({ opp: new Fixed(1000, 300, 8000) });
    none.d.input({ type: 'draw', t: CUE + 300 });
    expect(none.d.snapshot().tier).toBe('good');
  });

  it('afterHitAutoPerfect: a hero who starts wounded draws Perfect (Second Wind)', () => {
    const wounded = make({ hero: 2, heroMax: 3, mods: { afterHitAutoPerfect: true }, opp: new Fixed(1000, 300, 8000) });
    wounded.d.input({ type: 'draw', t: CUE + 500 });
    expect(wounded.d.snapshot().tier).toBe('perfect');
    expect(wounded.d.snapshot().heroMaxHp).toBe(3);
    const healthy = make({ hero: 3, heroMax: 3, mods: { afterHitAutoPerfect: true }, opp: new Fixed(1000, 300, 8000) });
    healthy.d.input({ type: 'draw', t: CUE + 500 });
    expect(healthy.d.snapshot().tier).toBe('ok');
    const noPerk = make({ hero: 2, heroMax: 3, opp: new Fixed(1000, 300, 8000) });
    noPerk.d.input({ type: 'draw', t: CUE + 500 });
    expect(noPerk.d.snapshot().tier).toBe('ok');
  });
});

describe('life rules', () => {
  it('ignoreFirstHits ignores the first enemy hit (Tin Star)', () => {
    const st = make({ hero: 1, mods: { ignoreFirstHits: 1 } });
    st.d.advanceTo(10_000);
    const heroHits = st.hits.filter((h) => h.target === 'hero');
    expect(heroHits[0]).toMatchObject({ ignored: true, damage: 0, killed: false });
    expect(heroHits[1]).toMatchObject({ killed: true });
    expect(st.d.lastResult).toMatchObject({ outcome: 'LOSE', hitsIgnored: 1 });
    expect(st.enemyShots.length).toBe(2);
  });

  it('ignores N hits and resets each attempt', () => {
    const st = make({ hero: 1, mods: { ignoreFirstHits: 2 } });
    st.d.advanceTo(10_000);
    expect(st.d.lastResult?.hitsIgnored).toBe(2);
    expect(st.enemyShots.length).toBe(3);
    st.d.retry();
    st.d.advanceTo(st.d.snapshot().now + 20_000);
    expect(st.d.lastResult).toMatchObject({ attempt: 2, hitsIgnored: 2 });
  });

  it('reviveCharges survives one lethal hit at 1 life and reports it (Revive Flask)', () => {
    const st = make({ hero: 1, mods: { reviveCharges: 1 } });
    st.d.advanceTo(10_000);
    const heroHits = st.hits.filter((h) => h.target === 'hero');
    expect(heroHits[0]).toMatchObject({ revived: true, killed: false });
    expect(heroHits[1]).toMatchObject({ killed: true });
    expect(st.d.lastResult).toMatchObject({ outcome: 'LOSE', revivesUsed: 1, heroHp: 0 });
  });

  it('a revived hero can still win', () => {
    const st = make({ hero: 1, enemy: 1, opp: new Fixed(1000, 300, 900, 0, 650), mods: { reviveCharges: 1 } });
    st.d.input({ type: 'draw', t: CUE + 300 });
    st.d.input({ type: 'aim', t: CUE + 430, x: 250, y: 350 });
    st.d.advanceTo(CUE + 950); // enemy shot at 1900 hits: revive at 1 hp
    expect(st.d.snapshot().heroHp).toBe(1);
    expect(st.d.currentPhase).not.toBe('RESOLVE');
    st.d.input({ type: 'fire', t: CUE + 960 });
    expect(st.d.lastResult).toMatchObject({ outcome: 'WIN', revivesUsed: 1, heroHp: 1 });
  });

  it('without the modifiers nothing is ignored or revived', () => {
    const st = make({ hero: 1 });
    st.d.advanceTo(10_000);
    expect(st.d.lastResult).toMatchObject({ outcome: 'LOSE', hitsIgnored: 0, revivesUsed: 0, staggers: 0, headshots: 0 });
    expect(st.d.lastResult?.cause).toBe('too_slow');
  });
});

describe('aim budget rules', () => {
  const draw = (st: ReturnType<typeof make>) => {
    st.d.input({ type: 'draw', t: CUE + 300 });
    st.d.advanceTo(CUE + 300 + 130);
  };

  it('lastStandBudgetMult applies at exactly 1 life (Last Stand)', () => {
    const one = make({ hero: 1, heroMax: 3, mods: { lastStandBudgetMult: 2 }, opp: new Fixed(1000, 300, 8000) });
    draw(one);
    const two = make({ hero: 2, heroMax: 3, mods: { lastStandBudgetMult: 2 }, opp: new Fixed(1000, 300, 8000) });
    draw(two);
    expect(one.budgets).toEqual([DUEL_CONFIG.aim.budgetMs * 2]);
    expect(two.budgets).toEqual([DUEL_CONFIG.aim.budgetMs]);
  });

  it('a boss aimBudgetScale shrinks the budget, clamped to [0.7, 1]', () => {
    const at = (scale: number | undefined) => {
      const st = make({ opp: new Fixed(1000, 300, 8000, 0, 650, scale) });
      draw(st);
      return st.budgets[0];
    };
    expect(at(undefined)).toBe(600);
    expect(at(0.8)).toBeCloseTo(480);
    expect(at(0.5)).toBeCloseTo(420);
    expect(at(1.5)).toBe(600);
    expect(at(NaN)).toBe(600);
  });

  it('aimBudgetStillBonus extends the budget while the reticle is still (Steady Breath), bounded', () => {
    const fireTime = (mods: Partial<DuelModifiers>, wiggleAt?: number) => {
      const st = make({ mods, opp: new Fixed(1000, 300, 99_000) });
      st.d.input({ type: 'draw', t: CUE + 300 });
      st.d.input({ type: 'aim', t: CUE + 440, x: 250, y: 350 });
      if (wiggleAt) st.d.input({ type: 'aim', t: wiggleAt, x: 262, y: 350 });
      st.d.advanceTo(CUE + 3000);
      return st.playerShots[0]!.t;
    };
    const base = CUE + 300 + 120 + 600;
    expect(fireTime({})).toBe(base);
    expect(fireTime({ aimBudgetStillBonus: true })).toBe(base + MODIFIER_TUNING.stillBonusMaxMs);
    // moving right up to the deadline earns nothing
    expect(fireTime({ aimBudgetStillBonus: true }, base - 20)).toBe(base);
  });

  it('a released fire during the extension is not delayed', () => {
    const st = make({ mods: { aimBudgetStillBonus: true }, opp: new Fixed(1000, 300, 99_000) });
    st.d.input({ type: 'draw', t: CUE + 300 });
    st.d.input({ type: 'aim', t: CUE + 440, x: 250, y: 350 });
    st.d.input({ type: 'fire', t: CUE + 1100 });
    expect(st.playerShots[0]!.t).toBe(CUE + 1100);
  });
});

describe('determinism with modifiers', () => {
  it('replaying the input log reproduces the live duel', () => {
    const mods: Partial<DuelModifiers> = { perfectStaggers: true, headStagger: true, alwaysCrit: true, ignoreFirstHits: 1, reviveCharges: 1, aimBudgetStillBonus: true };
    const params = { seed: 7, opponent: new Fixed(1200, 250, 700, 10, 600), config: DUEL_CONFIG, heroHp: 2, heroMaxHp: 3, enemyHp: 3, audio: quiet, modifiers: mods };
    const live = new DuelSystem(params);
    const inputs: DuelInput[] = [
      { type: 'hold', t: 100 }, { type: 'draw', t: 1200 + 120 }, { type: 'aim', t: 1500, x: 250, y: 316 }, { type: 'fire', t: 1620 },
      { type: 'aim', t: 2000, x: 250, y: 350 }, { type: 'fire', t: 2300 },
    ];
    for (const i of inputs) live.input(i);
    live.advanceTo(9000);
    const again = replayDuel({ ...params, opponent: new Fixed(1200, 250, 700, 10, 600) }, live.inputLog, 9000);
    expect(again.lastResult).toEqual(live.lastResult);
  });
});
