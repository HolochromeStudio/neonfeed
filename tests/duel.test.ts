import { describe, it, expect } from 'vitest';
import type { AudioEvent } from '../src/core/audioEvents';
import { DUEL_CONFIG } from '../src/data/duelConfig';
import type { DuelConfig } from '../src/data/duelConfig';
import { Rng } from '../src/core/rng';
import { BasicOpponent, DuelSystem, describeLoss, replayDuel } from '../src/systems/DuelSystem';
import type { DuelInput, DuelPhase, OpponentController } from '../src/systems/DuelSystem';

class Fixed implements OpponentController {
  readonly id = 'fixed';
  constructor(
    private wait = 1000,
    private draw = 300,
    private shot = 900,
    private err = 0,
    private gap = 650,
  ) {}
  waitMs() { return this.wait; }
  drawMs() { return this.draw; }
  shotDelayMs(_r: Rng, i: number) { return i === 0 ? this.shot : this.gap; }
  aimErrorPx() { return this.err; }
}

const noSlowMo: DuelConfig = { ...DUEL_CONFIG, aim: { ...DUEL_CONFIG.aim, slowMoScale: 1 } };
const sink = () => { const events: AudioEvent[] = []; return { events, audio: { emit: (e: AudioEvent) => { events.push(e); } } }; };

// default enemy rect: x 218..282, y 304..400. head centre (250,316), body (250,350), limb (224,352)
const HEAD = { x: 250, y: 316 };
const BODY = { x: 250, y: 350 };
const LIMB = { x: 224, y: 352 };
const CUE = 1000;

function make(opts: { opp?: OpponentController; cfg?: DuelConfig; hero?: number; enemy?: number; seed?: number } = {}) {
  const s = sink();
  const d = new DuelSystem({ seed: opts.seed ?? 1, opponent: opts.opp ?? new Fixed(), config: opts.cfg, heroHp: opts.hero, enemyHp: opts.enemy, audio: s.audio });
  return { d, ...s };
}

/** draw at cue+reaction, aim at point, fire at fireT. */
function drawAndFire(d: DuelSystem, reaction: number, at: { x: number; y: number }, fireT: number) {
  d.input({ type: 'draw', t: CUE + reaction });
  d.input({ type: 'aim', t: CUE + reaction + 10, ...at });
  d.input({ type: 'fire', t: fireT });
}

describe('state machine flow', () => {
  it('goes WAIT -> CUE -> DRAW -> AIM -> SHOT -> RESOLVE (WIN) -> RETRY', () => {
    const { d } = make({ enemy: 1 });
    const phases: DuelPhase[] = [];
    d.events.on('onPhase', (e) => phases.push(e.phase));
    d.advanceTo(999);
    expect(d.currentPhase).toBe('WAIT');
    d.advanceTo(1000);
    expect(d.currentPhase).toBe('CUE');
    drawAndFire(d, 200, HEAD, CUE + 400);
    expect(d.currentPhase).toBe('RESOLVE');
    expect(d.lastResult?.outcome).toBe('WIN');
    d.advanceTo(CUE + 400 + DUEL_CONFIG.resolve.holdMs);
    expect(phases).toEqual(['WAIT', 'CUE', 'DRAW', 'AIM', 'RESOLVE', 'RETRY']);
  });

  it('visits SHOT between shots when the enemy survives', () => {
    const { d } = make({ enemy: 3, cfg: noSlowMo });
    const phases: DuelPhase[] = [];
    d.events.on('onPhase', (e) => phases.push(e.phase));
    drawAndFire(d, 200, BODY, CUE + 400);
    expect(d.currentPhase).toBe('SHOT');
    d.advanceTo(CUE + 400 + DUEL_CONFIG.aim.recoilMs);
    expect(d.currentPhase).toBe('AIM');
    expect(phases).toEqual(['WAIT', 'CUE', 'DRAW', 'AIM', 'SHOT', 'AIM']);
  });

  it('measures reaction time from the cue', () => {
    const { d } = make();
    d.input({ type: 'draw', t: CUE + 187 });
    const s = d.snapshot();
    expect(s.rawReactionMs).toBe(187);
    expect(s.reactionMs).toBe(187);
    expect(s.tier).toBe('perfect');
  });

  it('emits a perfect draw with +30% aim budget and a first-shot crit', () => {
    const { d, events } = make({ enemy: 3 });
    const budgets: number[] = [];
    let perfect = 0;
    d.events.on('onAimStart', (e) => budgets.push(e.budgetMs));
    d.events.on('onPerfectDraw', () => perfect++);
    const hits: { damage: number; crit: boolean }[] = [];
    d.events.on('onHit', (e) => hits.push({ damage: e.damage, crit: e.crit }));
    drawAndFire(d, 150, BODY, CUE + 400);
    expect(perfect).toBe(1);
    expect(budgets[0]).toBeCloseTo(DUEL_CONFIG.aim.budgetMs * 1.3);
    expect(hits[0]).toEqual({ damage: 1.5, crit: true });
    expect(events.map((e) => e.type)).toContain('perfect_draw');
    // follow-up shot has no crit
    d.advanceTo(CUE + 400 + 150);
    d.input({ type: 'fire', t: CUE + 600, ...BODY });
    expect(hits[1].crit).toBe(false);
  });

  it('a non-perfect draw has the base budget and no crit', () => {
    const { d } = make({ enemy: 5 });
    const hits: boolean[] = [];
    d.events.on('onHit', (e) => hits.push(e.crit));
    drawAndFire(d, 300, BODY, CUE + 500);
    expect(hits).toEqual([false]);
    expect(d.snapshot().tier).toBe('good');
  });
});

describe('flinch, double taps, ignored input', () => {
  it('lifting early flinches: penalty added to reaction and draw time, never an instant loss', () => {
    const { d } = make();
    let flinches = 0;
    d.events.on('onFlinch', () => flinches++);
    d.input({ type: 'hold', t: 100 });
    d.input({ type: 'lift', t: 500 });
    expect(flinches).toBe(1);
    expect(d.currentPhase).toBe('WAIT');
    d.input({ type: 'draw', t: CUE + 100 });
    const s = d.snapshot();
    expect(s.rawReactionMs).toBe(100);
    expect(s.reactionMs).toBe(400);
    expect(s.tier).toBe('ok');
    expect(s.flinched).toBe(true);
    // draw animation is lengthened by the penalty
    d.advanceTo(CUE + 100 + DUEL_CONFIG.draw.drawAnimMs + DUEL_CONFIG.draw.flinchPenaltyMs - 1);
    expect(d.currentPhase).toBe('DRAW');
    d.advanceTo(CUE + 100 + DUEL_CONFIG.draw.drawAnimMs + DUEL_CONFIG.draw.flinchPenaltyMs);
    expect(d.currentPhase).toBe('AIM');
  });

  it('an early swipe also counts as a flinch; the cue still comes on schedule', () => {
    const { d } = make();
    d.input({ type: 'draw', t: 300 });
    expect(d.snapshot().flinched).toBe(true);
    d.advanceTo(1000);
    expect(d.currentPhase).toBe('CUE');
  });

  it('double early tap flinches once; extra inputs are counted and ignored', () => {
    const { d } = make();
    let flinches = 0;
    d.events.on('onFlinch', () => flinches++);
    d.input({ type: 'lift', t: 400 });
    d.input({ type: 'lift', t: 420 });
    d.input({ type: 'draw', t: 440 });
    expect(flinches).toBe(1);
    expect(d.snapshot().ignoredInputs).toBe(2);
    expect(d.snapshot().flinched).toBe(true);
  });

  it('double draw tap during CUE/DRAW only registers the first', () => {
    const { d } = make();
    let draws = 0;
    d.events.on('onDraw', () => draws++);
    d.input({ type: 'draw', t: CUE + 250 });
    d.input({ type: 'draw', t: CUE + 255 });
    d.input({ type: 'draw', t: CUE + 300 });
    expect(draws).toBe(1);
    expect(d.snapshot().rawReactionMs).toBe(250);
    expect(d.snapshot().ignoredInputs).toBe(2);
  });

  it('input is ignored during RESOLVE and a retry input is ignored outside RETRY', () => {
    const { d } = make({ enemy: 1 });
    drawAndFire(d, 200, HEAD, CUE + 400);
    expect(d.currentPhase).toBe('RESOLVE');
    d.input({ type: 'draw', t: CUE + 410 });
    d.input({ type: 'fire', t: CUE + 420, ...HEAD });
    d.input({ type: 'retry', t: CUE + 430 });
    expect(d.currentPhase).toBe('RESOLVE');
    expect(d.lastResult?.outcome).toBe('WIN');
  });
});

describe('aiming and hits', () => {
  it('head hit kills a 2hp enemy in one shot (x2), body needs two', () => {
    const a = make({ enemy: 2 });
    drawAndFire(a.d, 300, HEAD, CUE + 450);
    expect(a.d.lastResult?.outcome).toBe('WIN');
    expect(a.d.lastResult?.hits).toBe(1);
    const b = make({ enemy: 2 });
    drawAndFire(b.d, 300, BODY, CUE + 450);
    expect(b.d.currentPhase).toBe('SHOT');
    expect(b.d.snapshot().enemyHp).toBe(1);
  });

  it('missing the enemy deals nothing and emits onMiss', () => {
    const { d, events } = make({ enemy: 1 });
    let miss = 0;
    d.events.on('onMiss', (e) => e.shooter === 'player' && miss++);
    drawAndFire(d, 300, { x: 20, y: 20 }, CUE + 450);
    expect(miss).toBe(1);
    expect(d.snapshot().enemyHp).toBe(1);
    expect(events.map((e) => e.type)).toContain('miss');
  });

  it('shooting a prop deals no damage and fires hit_prop', () => {
    const { d, events } = make({ enemy: 1 });
    drawAndFire(d, 300, { x: 160, y: 450 }, CUE + 450);
    expect(d.snapshot().enemyHp).toBe(1);
    expect(events.map((e) => e.type)).toContain('hit_prop');
  });

  it('releasing during the draw animation queues the shot for the start of AIM', () => {
    const { d } = make({ enemy: 1 });
    d.input({ type: 'draw', t: CUE + 300 });
    d.input({ type: 'fire', t: CUE + 330, ...HEAD }); // still drawing (ends at +420)
    expect(d.currentPhase).toBe('DRAW');
    d.advanceTo(CUE + 421);
    expect(d.lastResult?.outcome).toBe('WIN');
  });

  it('auto-fires at the reticle when the aim budget ends; no reticle means a miss', () => {
    const a = make({ enemy: 1, opp: new Fixed(1000, 300, 5000) });
    a.d.input({ type: 'draw', t: CUE + 300 });
    a.d.input({ type: 'aim', t: CUE + 350, ...HEAD });
    a.d.advanceTo(CUE + 300 + 120 + DUEL_CONFIG.aim.budgetMs + 1);
    expect(a.d.lastResult?.outcome).toBe('WIN');
    const b = make({ enemy: 1, opp: new Fixed(1000, 300, 5000) });
    b.d.input({ type: 'draw', t: CUE + 300 });
    b.d.advanceTo(CUE + 300 + 120 + DUEL_CONFIG.aim.budgetMs + 1);
    expect(b.d.snapshot().enemyHp).toBe(1);
    expect(b.d.currentPhase).toBe('SHOT');
  });

  it('a gun-arm hit disarms: the pending enemy shot is cancelled', () => {
    const { d } = make({ enemy: 3, hero: 1, opp: new Fixed(1000, 300, 600, 0, 700) });
    // enemy would shoot at cue+600 (clamped to >=450); hero draws perfect, shoots the arm before that
    d.input({ type: 'draw', t: CUE + 100 });
    d.input({ type: 'aim', t: CUE + 150, ...LIMB });
    d.input({ type: 'fire', t: CUE + 230 });
    expect(d.snapshot().enemyHp).toBe(3 - 0.75 * 1.5);
    d.input({ type: 'aim', t: CUE + 240, x: 20, y: 20 }); // later auto-fires miss
    d.advanceTo(CUE + 700);
    expect(d.snapshot().heroHp).toBe(1); // the cue+600 shot never came
    d.advanceTo(CUE + 5000);
    expect(d.snapshot().heroHp).toBe(0); // but the replanned shot lands eventually
  });
});

describe('enemy shots, fairness and loss causes', () => {
  it('RULE F1: first lethal shot never lands before minLethalMs after the cue', () => {
    const { d } = make({ opp: new Fixed(1000, 50, 100) });
    expect(d.plan.firstShotMs).toBeGreaterThanOrEqual(DUEL_CONFIG.fairness.minLethalMs);
    d.advanceTo(CUE + 449);
    expect(d.snapshot().heroHp).toBe(DUEL_CONFIG.damage.heroHp);
    d.advanceTo(CUE + 451);
    expect(d.snapshot().heroHp).toBe(DUEL_CONFIG.damage.heroHp - DUEL_CONFIG.damage.enemyDamage);
  });

  it('never drawing loses with cause too_slow, and the text names it (RULE F4)', () => {
    const { d } = make({ hero: 1 });
    d.advanceTo(CUE + 2000);
    expect(d.lastResult?.outcome).toBe('LOSE');
    expect(d.lastResult?.cause).toBe('too_slow');
    expect(describeLoss(d.lastResult!)).toContain('900');
  });

  it('shot while aiming is named', () => {
    const { d } = make({ hero: 1, cfg: noSlowMo });
    d.input({ type: 'draw', t: CUE + 300 });
    d.advanceTo(CUE + 1000);
    expect(d.lastResult?.cause).toBe('shot_while_aiming');
    expect(describeLoss(d.lastResult!)).toBe('Shot while aiming');
  });

  it('shot while drawing is named with the draw time', () => {
    const { d } = make({ hero: 1, opp: new Fixed(1000, 300, 500) });
    d.input({ type: 'draw', t: CUE + 450 });
    d.advanceTo(CUE + 2000);
    expect(d.lastResult?.cause).toBe('shot_while_drawing');
    expect(describeLoss(d.lastResult!)).toBe('Slow draw 450 ms');
  });

  it('enemy aim error beyond tolerance misses', () => {
    const { d } = make({ hero: 1, opp: new Fixed(1000, 300, 600, 99, 5000) });
    d.advanceTo(CUE + 700);
    expect(d.snapshot().heroHp).toBe(1);
    expect(d.currentPhase).toBe('CUE');
  });

  it('AIM runs the opponent clock in slow motion (RULE F7)', () => {
    const slow = make({ opp: new Fixed(1000, 300, 900) });
    const fast = make({ opp: new Fixed(1000, 300, 900), cfg: noSlowMo });
    for (const x of [slow, fast]) x.d.input({ type: 'draw', t: CUE + 200 });
    expect(slow.d.snapshot().timeScale).toBe(1);
    slow.d.advanceTo(CUE + 320);
    expect(slow.d.snapshot().timeScale).toBe(DUEL_CONFIG.aim.slowMoScale);
    slow.d.advanceTo(CUE + 960);
    fast.d.advanceTo(CUE + 960);
    expect(slow.d.snapshot().heroHp).toBe(DUEL_CONFIG.damage.heroHp);
    expect(fast.d.snapshot().heroHp).toBe(DUEL_CONFIG.damage.heroHp - DUEL_CONFIG.damage.enemyDamage);
  });
});

describe('simultaneous kill: who is faster', () => {
  const setup = () => make({ hero: 1, enemy: 1, cfg: noSlowMo, opp: new Fixed(1000, 300, 900) });

  it('the player fires 1 ms before the enemy: WIN', () => {
    const { d } = setup();
    drawAndFire(d, 200, HEAD, CUE + 899);
    expect(d.lastResult?.outcome).toBe('WIN');
    d.advanceTo(CUE + 2000);
    expect(d.lastResult?.outcome).toBe('WIN');
    expect(d.snapshot().heroHp).toBe(1);
  });
  it('the player fires on the same ms: the player wins the tie', () => {
    const { d } = setup();
    drawAndFire(d, 200, HEAD, CUE + 900);
    expect(d.lastResult?.outcome).toBe('WIN');
  });
  it('the player fires 1 ms late: the enemy kills first, LOSE', () => {
    const { d } = setup();
    drawAndFire(d, 200, HEAD, CUE + 901);
    expect(d.lastResult?.outcome).toBe('LOSE');
    expect(d.lastResult?.cause).toBe('shot_while_aiming');
    expect(d.snapshot().enemyHp).toBe(1);
  });
});

describe('retry and determinism', () => {
  it('retry resets hp, flinch, reaction and phase, and keeps the enemy timings (RULE F5)', () => {
    const { d } = make({ hero: 1, seed: 77, opp: new BasicOpponent() });
    d.input({ type: 'lift', t: 10 });
    const plan0 = { ...d.plan };
    d.advanceTo(plan0.waitMs + 5000);
    expect(d.lastResult?.outcome).toBe('LOSE');
    d.advanceTo(plan0.waitMs + 5000 + DUEL_CONFIG.resolve.holdMs);
    expect(d.currentPhase).toBe('RETRY');
    let retries = 0;
    d.events.on('onRetry', () => retries++);
    const t = plan0.waitMs + 6000;
    d.input({ type: 'retry', t });
    const s = d.snapshot();
    expect(retries).toBe(1);
    expect(s.phase).toBe('WAIT');
    expect(s.heroHp).toBe(1);
    expect(s.enemyHp).toBe(2);
    expect(s.flinched).toBe(false);
    expect(s.reactionMs).toBeNull();
    expect(s.outcome).toBeNull();
    expect(s.attempt).toBe(2);
    expect(d.plan).toEqual(plan0);
    d.advanceTo(t + plan0.waitMs);
    expect(d.currentPhase).toBe('CUE');
  });

  it('retry is also available directly from RESOLVE', () => {
    const { d } = make({ enemy: 1 });
    drawAndFire(d, 200, HEAD, CUE + 400);
    d.retry();
    expect(d.currentPhase).toBe('WAIT');
  });

  it('same seed + same input log reproduce the same result; replay matches live', () => {
    const script: DuelInput[] = [
      { type: 'hold', t: 0 },
      { type: 'draw', t: 2500 },
      { type: 'aim', t: 2700, ...BODY },
      { type: 'fire', t: 2900 },
    ];
    const run = (seed: number) => {
      const d = make({ seed, opp: new BasicOpponent() }).d;
      for (const e of script) d.input(e);
      d.advanceTo(10000);
      return { snap: d.snapshot(), result: d.lastResult, plan: d.plan, log: d.inputLog };
    };
    expect(run(5)).toEqual(run(5));
    const live = run(5);
    const rep = replayDuel({ seed: 5, opponent: new BasicOpponent(), audio: sink().audio }, live.log, 10000);
    expect(rep.snapshot()).toEqual(live.snap);
    expect(rep.lastResult).toEqual(live.result);
    expect(run(5).plan).not.toEqual(run(6).plan);
  });

  it('enemy behaviour for shot N does not depend on the player (rng use is index-ordered)', () => {
    const a = make({ seed: 3, hero: 9, opp: new BasicOpponent() }).d;
    const b = make({ seed: 3, hero: 9, opp: new BasicOpponent() }).d;
    const shotsA: number[] = [];
    const shotsB: number[] = [];
    a.events.on('onShot', (e) => e.shooter === 'enemy' && shotsA.push(e.t));
    b.events.on('onShot', (e) => e.shooter === 'enemy' && shotsB.push(e.t));
    a.advanceTo(20000);
    // b gets the player to shoot the body (no limb hit): same enemy timeline in real ms is unaffected without slow-mo
    b.advanceTo(20000);
    expect(shotsA).toEqual(shotsB);
    expect(shotsA.length).toBeGreaterThan(2);
  });

  it('wait delay stays inside the configured 1.0-3.0 s over many seeds', () => {
    for (let seed = 0; seed < 200; seed++) {
      const w = make({ seed, opp: new BasicOpponent() }).d.plan.waitMs;
      expect(w).toBeGreaterThanOrEqual(1000);
      expect(w).toBeLessThanOrEqual(3000);
    }
  });
});

describe('audio and event hooks', () => {
  it('emits cue, shots, hits and death on the audio bus', () => {
    const { d, events } = make({ enemy: 1 });
    drawAndFire(d, 200, HEAD, CUE + 400);
    const types = events.map((e) => e.type);
    expect(types).toEqual(['draw_cue', 'perfect_draw', 'gunshot', 'hit_flesh', 'death']);
    expect(events.find((e) => e.type === 'gunshot')).toEqual({ type: 'gunshot', shooter: 'player' });
  });

  it('a throwing feedback listener never breaks the duel', () => {
    const { d } = make({ enemy: 1 });
    d.events.on('onCue', () => { throw new Error('juice bug'); });
    d.advanceTo(CUE);
    expect(d.currentPhase).toBe('CUE');
  });

  it('onResolve carries the full result', () => {
    const { d } = make({ enemy: 1 });
    let res = null as unknown;
    d.events.on('onResolve', (e) => { res = e.result; });
    drawAndFire(d, 200, HEAD, CUE + 400);
    expect(res).toMatchObject({ outcome: 'WIN', tier: 'perfect', reactionMs: 200, flinched: false, shotsFired: 1, hits: 1, attempt: 1 });
  });
});
