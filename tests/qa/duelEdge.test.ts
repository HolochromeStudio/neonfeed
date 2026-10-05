import { describe, expect, it } from 'vitest';
import { DUEL_CONFIG } from '../../src/data/duelConfig';
import { DuelSystem } from '../../src/systems/DuelSystem';
import { applyDamage, makeHealth } from '../../src/systems/DamageSystem';
import { BODY, CUE, Fixed, HEAD, LIMB, cfgWith, mk, quietAudio, record } from './helpers';

const noSlow = cfgWith({ aim: { slowMoScale: 1 } });

describe('hostile time values', () => {
  it('advanceTo(NaN) must not poison the clock (QA-01)', () => {
    const d = mk();
    d.advanceTo(500);
    d.advanceTo(NaN);
    expect(Number.isNaN(d.snapshot().now)).toBe(false);
  });

  it('a NaN timestamp mid-duel must not make the enemy immortal (QA-01)', () => {
    const d = mk({ heroHp: 1 });
    d.advanceTo(CUE + 100); // cue has fired, enemy clock running
    d.input({ type: 'hold', t: NaN }); // enemyT += NaN permanently
    d.advanceTo(CUE + 100000);
    expect(d.isOver).toBe(true); // observed: still CUE phase, enemy never shoots
  });

  it('NaN before the cue self-heals on the next valid advance (documented partial behaviour)', () => {
    const d = mk();
    d.input({ type: 'hold', t: NaN });
    d.advanceTo(5000);
    expect(d.currentPhase).not.toBe('WAIT');
  });

  it('negative dt (advanceTo into the past) is a no-op', () => {
    const d = mk();
    d.advanceTo(1500);
    const before = d.snapshot();
    d.advanceTo(100);
    d.advanceTo(-5);
    expect(d.snapshot()).toEqual(before);
  });

  it('input stamped in the past is clamped to now and logged with the clamped time', () => {
    const d = mk();
    d.advanceTo(1200);
    d.input({ type: 'draw', t: 50 });
    expect(d.inputLog[0].t).toBe(1200);
    expect(d.snapshot().rawReactionMs).toBe(200);
  });

  it('5 s clock jump while waiting: cue fires, hero (idle) loses, one resolution, no throw', () => {
    const d = mk({ heroHp: 1 });
    const rec = record(d);
    d.advanceTo(5000);
    expect(d.lastResult?.outcome).toBe('LOSE');
    expect(rec.resolves).toEqual([1]);
    expect(d.lastResult?.cause).toBe('too_slow');
  });

  it('5 s jump while aiming with a held reticle auto-fires but the duel still ends exactly once', () => {
    const d = mk({ heroHp: 3, enemyHp: 2 });
    const rec = record(d);
    d.input({ type: 'draw', t: CUE + 100 });
    d.input({ type: 'aim', t: CUE + 300, ...BODY });
    d.advanceTo(CUE + 5300);
    expect(d.isOver).toBe(true);
    expect(rec.resolves).toEqual([1]);
  });

  it('Infinity jump terminates (no hang) and leaves a finite or at least valid state', () => {
    const d = mk({ heroHp: 1 });
    d.advanceTo(Infinity);
    expect(d.isOver).toBe(true);
  });

  it('after advanceTo(Infinity) a retry must still be playable (QA-01b)', () => {
    const d = mk({ heroHp: 1 });
    d.advanceTo(Infinity);
    d.retry();
    expect(Number.isFinite(d.snapshot().now)).toBe(true);
  });
});

describe('hostile coordinates', () => {
  const bad = [NaN, -1, -1e9, 1e9, Infinity, -Infinity, 0, -0, Number.MAX_VALUE, Number.MIN_VALUE];
  it('aim / fire at every nasty coordinate never throws and never kills with a non-hit', () => {
    for (const x of bad) {
      for (const y of bad) {
        const d = mk({ opp: new Fixed(1000, 300, 5000), enemyHp: 1 });
        d.input({ type: 'draw', t: CUE + 300 });
        d.input({ type: 'aim', t: CUE + 500, x, y });
        d.input({ type: 'fire', t: CUE + 600, x, y });
        const s = d.snapshot();
        expect(Number.isFinite(s.enemyHp)).toBe(true);
        const onEnemy = Number.isFinite(x) && Number.isFinite(y) && x >= 218 - 14 && x <= 282 + 14 && y >= 304 - 14 && y <= 400 + 14;
        if (!onEnemy) expect(s.enemyHp).toBe(1);
      }
    }
  });

  it('NaN / Infinity reticle never reaches the hit events as a hit', () => {
    const d = mk({ opp: new Fixed(1000, 300, 5000), enemyHp: 5 });
    const hits: unknown[] = [];
    d.events.on('onHit', (e) => hits.push(e));
    d.input({ type: 'draw', t: CUE + 300 });
    d.input({ type: 'fire', t: CUE + 500, x: NaN, y: NaN });
    expect(hits).toHaveLength(0);
    expect(d.currentPhase).toBe('SHOT');
  });

  it('fire with only x (y undefined) falls back to the stored reticle', () => {
    const d = mk({ opp: new Fixed(1000, 300, 5000), enemyHp: 5 });
    d.input({ type: 'draw', t: CUE + 300 });
    d.input({ type: 'aim', t: CUE + 500, ...HEAD });
    let hit = 0;
    d.events.on('onHit', () => hit++);
    d.input({ type: 'fire', t: CUE + 520, x: 0 });
    expect(hit).toBe(1);
  });

  it('fire with no reticle ever set is a clean miss with finite shot coordinates (QA-08 fixed)', () => {
    const d = mk({ opp: new Fixed(1000, 300, 5000) });
    const shots: { x: number }[] = [];
    d.events.on('onShot', (e) => shots.push(e));
    d.input({ type: 'draw', t: CUE + 300 });
    d.input({ type: 'fire', t: CUE + 500 });
    expect(shots).toHaveLength(1);
    expect(Number.isFinite(shots[0].x)).toBe(true); // QA-08 fixed: onShot never carries NaN
  });
});

describe('input in the wrong phase', () => {
  it('everything after resolve is ignored, state frozen until retry', () => {
    const d = mk({ enemyHp: 1 });
    d.input({ type: 'draw', t: CUE + 100 });
    d.input({ type: 'aim', t: CUE + 300, ...HEAD });
    d.input({ type: 'fire', t: CUE + 310 });
    expect(d.currentPhase).toBe('RESOLVE');
    const res = d.lastResult;
    const rec = record(d);
    for (const type of ['draw', 'fire', 'lift', 'hold', 'retry'] as const) d.input({ type, t: CUE + 320 });
    d.input({ type: 'aim', t: CUE + 330, x: 0, y: 0 });
    expect(d.lastResult).toBe(res);
    expect(d.snapshot().outcome).toBe('WIN');
    expect(d.snapshot().enemyHp).toBe(0);
    expect(rec.resolves).toEqual([0]);
  });

  it('retry input during RESOLVE (hold time) is ignored; during RETRY it restarts', () => {
    const d = mk({ enemyHp: 1 });
    d.input({ type: 'draw', t: CUE + 100 });
    d.input({ type: 'fire', t: CUE + 230, ...HEAD });
    expect(d.currentPhase).toBe('RESOLVE');
    d.input({ type: 'retry', t: CUE + 300 });
    expect(d.currentPhase).toBe('RESOLVE');
    d.input({ type: 'retry', t: CUE + 230 + DUEL_CONFIG.resolve.holdMs });
    expect(d.currentPhase).toBe('WAIT');
    expect(d.snapshot().attempt).toBe(2);
  });

  it('double retry (two retry inputs same ms) only restarts once', () => {
    const d = mk({ heroHp: 1 });
    d.advanceTo(10000);
    expect(d.currentPhase).toBe('RETRY');
    const t = d.snapshot().now;
    d.input({ type: 'retry', t });
    d.input({ type: 'retry', t });
    expect(d.snapshot().attempt).toBe(2);
    expect(d.currentPhase).toBe('WAIT');
  });

  it('public retry() twice in a row restarts once; retry() mid-duel is a no-op', () => {
    const d = mk({ heroHp: 1 });
    d.retry();
    expect(d.snapshot().attempt).toBe(1);
    d.advanceTo(10000);
    d.retry();
    d.retry();
    expect(d.snapshot().attempt).toBe(2);
  });

  it('retry during RESOLVE via retry() resets the stale resolve deadline (no phantom RETRY later)', () => {
    const d = mk({ heroHp: 1 });
    d.advanceTo(2000);
    expect(d.currentPhase).toBe('RESOLVE');
    d.retry();
    d.advanceTo(2000 + DUEL_CONFIG.resolve.holdMs + 1);
    expect(d.currentPhase).toBe('WAIT');
  });

  it('draw while drawing / while aiming / after shot is ignored and counted', () => {
    const d = mk({ opp: new Fixed(1000, 300, 5000), enemyHp: 9 });
    d.input({ type: 'draw', t: CUE + 100 });
    d.input({ type: 'draw', t: CUE + 110 });
    d.advanceTo(CUE + 100 + 120);
    d.input({ type: 'draw', t: CUE + 230 });
    expect(d.snapshot().ignoredInputs).toBe(2);
    expect(d.snapshot().rawReactionMs).toBe(100);
  });

  it('lift during any phase except WAIT does nothing; lift in WAIT flinches once', () => {
    const d = mk();
    d.input({ type: 'lift', t: 100 });
    d.input({ type: 'lift', t: 200 });
    expect(d.snapshot().flinched).toBe(true);
    expect(d.snapshot().ignoredInputs).toBe(1);
    d.advanceTo(CUE);
    d.input({ type: 'lift', t: CUE + 10 });
    expect(d.snapshot().ignoredInputs).toBe(1);
  });

  it('flinch penalty is applied to grading: raw 50 + 300 = 350 => OK tier', () => {
    const d = mk();
    d.input({ type: 'lift', t: 100 });
    d.input({ type: 'draw', t: CUE + 50 });
    expect(d.snapshot().reactionMs).toBe(350);
    expect(d.snapshot().tier).toBe('ok');
  });
});

describe('exact-millisecond ties', () => {
  it('draw at the exact cue ms registers with raw 0 (PERFECT); 1 ms earlier is a flinch', () => {
    const a = mk();
    a.input({ type: 'draw', t: CUE });
    expect(a.snapshot().rawReactionMs).toBe(0);
    expect(a.snapshot().tier).toBe('perfect');
    const b = mk();
    b.input({ type: 'draw', t: CUE - 1 });
    expect(b.snapshot().flinched).toBe(true);
    expect(b.currentPhase).toBe('WAIT');
  });

  // noSlow: enemy shot lands at exactly CUE+900 on the real clock
  const tieDuel = () => {
    const d = mk({ heroHp: 1, enemyHp: 1, config: noSlow, opp: new Fixed(1000, 300, 900) });
    d.input({ type: 'draw', t: CUE + 300 });
    d.input({ type: 'aim', t: CUE + 420, ...BODY });
    return d;
  };

  it('player fire on the same ms as the lethal enemy shot wins (player first), exactly one resolution', () => {
    const d = tieDuel();
    const rec = record(d);
    d.input({ type: 'fire', t: CUE + 900 });
    expect(d.lastResult?.outcome).toBe('WIN');
    d.advanceTo(CUE + 5000);
    expect(rec.resolves).toEqual([1]);
    expect(d.snapshot().heroHp).toBe(1);
  });

  it('simultaneous kill: a fire 1 ms later loses to the enemy shot', () => {
    const d = tieDuel();
    d.input({ type: 'fire', t: CUE + 901 });
    expect(d.lastResult?.outcome).toBe('LOSE');
    expect(d.lastResult?.enemyHp).toBe(1);
    expect(d.lastResult?.cause).toBe('shot_while_aiming');
  });

  it('a draw on the same ms as an enemy shot registers first (cause is shot_while_drawing, not too_slow)', () => {
    const d = mk({ heroHp: 1, config: noSlow, opp: new Fixed(1000, 300, 450) });
    d.input({ type: 'draw', t: CUE + 450 });
    d.advanceTo(CUE + 460);
    expect(d.lastResult?.cause).toBe('shot_while_drawing');
    expect(d.lastResult?.rawReactionMs).toBe(450);
  });

  it('autoFire deadline and enemy shot on the same ms: deadline (player) goes first', () => {
    // aim starts at CUE+420 (draw at 300), budget 600 => autoFire CUE+1020; enemy shot at CUE+1020
    const d = mk({ heroHp: 1, enemyHp: 1, config: noSlow, opp: new Fixed(1000, 300, 1020) });
    d.input({ type: 'draw', t: CUE + 300 });
    d.input({ type: 'aim', t: CUE + 420, ...BODY });
    d.advanceTo(CUE + 1021);
    expect(d.lastResult?.outcome).toBe('WIN');
  });

  it('first enemy shot is never earlier than 450 ms after the cue even if the opponent asks for 0', () => {
    const d = mk({ opp: new Fixed(1000, 0, 0), heroHp: 1 });
    d.advanceTo(CUE + 449);
    expect(d.isOver).toBe(false);
    d.advanceTo(CUE + 451);
    expect(d.isOver).toBe(true);
    expect(d.lastResult?.durationMs).toBe(1450);
  });

  it('F1 holds with negative opponent timings too', () => {
    const d = mk({ opp: new Fixed(-500, -500, -500), heroHp: 1 });
    expect(d.plan.firstShotMs).toBeGreaterThanOrEqual(450);
    d.advanceTo(449);
    expect(d.isOver).toBe(false);
  });
});

describe('disarm and enemy follow-up', () => {
  it('limb hit disarms: the pending enemy shot is cancelled and the next waits >= minShotGap', () => {
    const d = mk({ opp: new Fixed(1000, 300, 900, 0, 650), config: noSlow, enemyHp: 20, heroHp: 1 });
    d.input({ type: 'draw', t: CUE + 100 });
    d.input({ type: 'aim', t: CUE + 260, ...LIMB });
    d.input({ type: 'fire', t: CUE + 270 });
    expect(d.snapshot().phase).toBe('SHOT');
    d.input({ type: 'aim', t: CUE + 280, x: 0, y: 0 }); // stop hitting the limb
    let enemyShotAt = -1;
    d.events.on('onShot', (e) => { if (e.shooter === 'enemy' && enemyShotAt < 0) enemyShotAt = e.t; });
    d.advanceTo(CUE + 100000);
    // disarmed at enemy-clock 270: next shot = 270 + 650 = 920 > original 900
    expect(enemyShotAt - CUE).toBe(920);
    expect(d.lastResult?.outcome).toBe('LOSE');
  });

  it('disarm then enemy shot: hero can still be shot and the loss is attributed', () => {
    const d = mk({ opp: new Fixed(1000, 300, 600, 0, 300), enemyHp: 20, heroHp: 1 });
    d.input({ type: 'draw', t: CUE + 100 });
    d.input({ type: 'aim', t: CUE + 260, ...LIMB });
    d.input({ type: 'fire', t: CUE + 270 });
    d.input({ type: 'aim', t: CUE + 280, x: 0, y: 0 });
    d.advanceTo(CUE + 100000);
    expect(d.lastResult?.outcome).toBe('LOSE');
    expect(d.lastResult?.cause).not.toBeNull();
  });

  it('OBSERVATION: with maxDisarms disabled (Infinity), a reticle parked on the limb disarms forever (enemy never shoots) until its hp runs out; QA-09 default caps it, see tests/duelHardening.test.ts', () => {
    const d = mk({ opp: new Fixed(1000, 300, 900, 0, 650), enemyHp: 6, heroHp: 1, config: cfgWith({ fairness: { maxDisarms: Infinity } }) });
    let enemyShots = 0;
    d.events.on('onShot', (e) => { if (e.shooter === 'enemy') enemyShots++; });
    d.input({ type: 'draw', t: CUE + 100 });
    d.input({ type: 'aim', t: CUE + 260, ...LIMB });
    d.advanceTo(CUE + 100000);
    expect(d.lastResult?.outcome).toBe('WIN');
    expect(enemyShots).toBe(0); // balance note QA-09: limb disarm + autofire is a no-risk exploit on high-hp enemies
  });

  it('limb kill on 1 hp enemy wins (limb 0.75 dmg still kills a 0.5 hp... via clamp) ', () => {
    const d = mk({ enemyHp: 0.5 });
    d.input({ type: 'draw', t: CUE + 100 });
    d.input({ type: 'aim', t: CUE + 300, ...LIMB });
    d.input({ type: 'fire', t: CUE + 310 });
    expect(d.lastResult?.outcome).toBe('WIN');
  });
});

describe('extreme config values', () => {
  it('enemyHp 0 is already dead: a hit must WIN (QA-03)', () => {
    const d = mk({ enemyHp: 0 });
    d.input({ type: 'draw', t: CUE + 100 });
    d.input({ type: 'aim', t: CUE + 300, ...HEAD });
    d.input({ type: 'fire', t: CUE + 310 });
    expect(d.lastResult?.outcome).toBe('WIN');
  });

  it('heroHp 0: an enemy hit LOSEs, with hp clamped at 0', () => {
    const d = mk({ heroHp: 0 });
    d.advanceTo(10000);
    expect(d.lastResult?.outcome).toBe('LOSE');
    expect(d.snapshot().heroHp).toBe(0);
  });

  it('heroHp 0: the duel should not start already lost on a missing enemy shot (QA-03)', () => {
    const d = mk({ heroHp: 0, opp: new Fixed(1000, 300, 900, 999 /* always misses */) });
    d.advanceTo(CUE + 1500);
    // an already dead hero surviving a miss and fighting on is nonsense; either LOSE immediately or constructor rejects
    expect(d.isOver).toBe(true);
  });

  it('heroHp 1: first lethal hit while drawing is attributed shot_while_drawing', () => {
    const d = mk({ heroHp: 1, opp: new Fixed(1000, 300, 460) });
    d.input({ type: 'draw', t: CUE + 400 });
    d.advanceTo(CUE + 5000);
    expect(d.lastResult?.cause).toBe('shot_while_drawing');
  });

  it('huge enemy damage kills in one shot, hp stays 0, dealt is bounded by hp', () => {
    const d = mk({ config: cfgWith({ damage: { enemyDamage: 1e300 } }), heroHp: 3 });
    const hits: number[] = [];
    d.events.on('onHit', (e) => { if (e.target === 'hero') hits.push(e.damage); });
    d.advanceTo(10000);
    expect(d.snapshot().heroHp).toBe(0);
    expect(hits).toEqual([3]);
  });

  it('huge base damage kills in one hit and reports dealt = remaining hp', () => {
    const d = mk({ config: cfgWith({ damage: { baseDamage: 1e300 } }), enemyHp: 7 });
    let dealt = -1;
    d.events.on('onHit', (e) => { dealt = e.damage; });
    d.input({ type: 'draw', t: CUE + 100 });
    d.input({ type: 'fire', t: CUE + 300, ...BODY });
    expect(dealt).toBe(7);
    expect(d.lastResult?.outcome).toBe('WIN');
  });

  it('applyDamage never goes negative / NaN for negative, zero, Infinity and huge amounts', () => {
    for (const amt of [-5, 0, Infinity, 1e308]) {
      const h = makeHealth(3);
      applyDamage(h, amt);
      expect(h.hp).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(h.hp)).toBe(false);
    }
  });

  it('applyDamage(NaN) must not turn hp into NaN (QA-04)', () => {
    const h = makeHealth(3);
    applyDamage(h, NaN);
    expect(Number.isNaN(h.hp)).toBe(false);
  });

  it('slowMoScale 0 freezes the enemy during aim but cannot soft-lock (aim budget still expires)', () => {
    const d = mk({ config: cfgWith({ aim: { slowMoScale: 0 } }), heroHp: 1 });
    d.input({ type: 'draw', t: CUE + 100 });
    d.advanceTo(CUE + 100000);
    expect(d.isOver).toBe(true);
  });

  it('minShotGapMs 0 + shot delay 0 + huge hero hp does not hang advanceTo (guard)', () => {
    const cfg = cfgWith({ fairness: { minShotGapMs: 0, minLethalMs: 0 } });
    const d = new DuelSystem({ seed: 1, config: cfg, opponent: new Fixed(0, 0, 0, 0, 0), heroHp: 1e9, audio: quietAudio });
    const t0 = Date.now();
    d.advanceTo(5000);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(Number.isFinite(d.snapshot().now)).toBe(true);
  });

  it('noSlow config sanity: enemy shot time equals plan when hero idles', () => {
    const d = mk({ config: noSlow, heroHp: 1 });
    d.advanceTo(100000);
    expect(d.lastResult?.durationMs).toBe(CUE + 900);
  });
});

describe('event listeners and logging', () => {
  it('a throwing listener never breaks the duel', () => {
    const d = mk({ heroHp: 1 });
    for (const n of ['onPhase', 'onShot', 'onHit', 'onResolve', 'onCue'] as const) d.events.on(n, () => { throw new Error('boom'); });
    d.advanceTo(10000);
    expect(d.isOver).toBe(true);
  });

  it('a listener that calls retry() from onResolve does not corrupt state', () => {
    const d = mk({ heroHp: 1 });
    d.events.on('onResolve', () => d.retry());
    d.advanceTo(10000);
    const s = d.snapshot();
    expect(['WAIT', 'CUE', 'DRAW', 'AIM', 'SHOT', 'RESOLVE', 'RETRY']).toContain(s.phase);
    expect(Number.isFinite(s.now)).toBe(true);
  });

  it('inputLog records every accepted input in non-decreasing time', () => {
    const d = mk();
    for (const t of [50, 20, 900, 10]) d.input({ type: 'hold', t });
    const ts = d.inputLog.map((e) => e.t);
    expect(ts).toEqual([50, 50, 900, 900]);
  });
});
