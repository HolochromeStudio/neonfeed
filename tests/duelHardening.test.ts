import { describe, it, expect } from 'vitest';
import type { AudioEvent } from '../src/core/audioEvents';
import { DUEL_CONFIG } from '../src/data/duelConfig';
import type { DuelConfig } from '../src/data/duelConfig';
import type { Rng } from '../src/core/rng';
import { DuelSystem, MAX_ADVANCE_MS } from '../src/systems/DuelSystem';
import type { DuelPhase, OpponentController } from '../src/systems/DuelSystem';

class Fixed implements OpponentController {
  readonly id = 'fixed';
  constructor(private shot = 900, private err = 0, private gap = 650) {}
  waitMs() { return 1000; }
  drawMs() { return 300; }
  shotDelayMs(_r: Rng, i: number) { return i === 0 ? this.shot : this.gap; }
  aimErrorPx() { return this.err; }
}
const quiet = { emit: (_e: AudioEvent) => {} };
const mk = (o: { shot?: number; err?: number; hero?: number; enemy?: number; cfg?: DuelConfig } = {}) =>
  new DuelSystem({ seed: 1, opponent: new Fixed(o.shot, o.err), audio: quiet, heroHp: o.hero, enemyHp: o.enemy, config: o.cfg });
const CUE = 1000;
const LIMB = { x: 224, y: 352 };

describe('onPhase reports WAIT (QA-06)', () => {
  it('announces WAIT at the start of an attempt and again after a retry', () => {
    const d = mk({ hero: 1 });
    const seen: { phase: DuelPhase; prev: DuelPhase }[] = [];
    d.events.on('onPhase', (e) => seen.push({ phase: e.phase, prev: e.prev }));
    d.advanceTo(10);
    d.advanceTo(20);
    expect(seen).toEqual([{ phase: 'WAIT', prev: 'WAIT' }]);
    d.advanceTo(10000); // idle hero loses
    expect(d.isOver).toBe(true);
    seen.length = 0;
    d.retry();
    expect(seen).toEqual([{ phase: 'WAIT', prev: 'RETRY' }]);
    d.advanceTo(d.snapshot().now + 10);
    expect(seen).toHaveLength(1);
  });
});

describe('non-finite input never poisons the duel (QA-01)', () => {
  it('NaN and -Infinity advance are ignored, +Infinity is clamped', () => {
    const d = mk({ hero: 1 });
    d.advanceTo(500);
    d.advanceTo(NaN);
    d.advanceTo(-Infinity);
    expect(d.snapshot().now).toBe(500);
    d.advanceTo(Infinity);
    expect(d.snapshot().now).toBeLessThanOrEqual(500 + MAX_ADVANCE_MS);
    expect(Number.isFinite(d.snapshot().now)).toBe(true);
    d.retry();
    expect(Number.isFinite(d.snapshot().now)).toBe(true);
  });
  it('a NaN or Infinity input stamp is treated as now', () => {
    const d = mk();
    d.advanceTo(CUE + 100);
    d.input({ type: 'draw', t: NaN });
    expect(d.snapshot().rawReactionMs).toBe(100);
    expect(d.inputLog[0].t).toBe(CUE + 100);
    const e = mk();
    e.advanceTo(CUE + 50);
    e.input({ type: 'hold', t: Infinity });
    expect(e.snapshot().now).toBe(CUE + 50);
  });
});

describe('hp edge cases (QA-03)', () => {
  it('enemyHp 0 or NaN becomes a killable enemy', () => {
    for (const enemy of [0, -3, NaN]) {
      const d = mk({ enemy });
      expect(d.snapshot().enemyMaxHp).toBeGreaterThan(0);
    }
  });
  it('a hero with 0 hp resolves LOSE at the first enemy shot even when it misses', () => {
    const d = mk({ hero: 0, err: 999 });
    d.advanceTo(CUE + 1500);
    expect(d.isOver).toBe(true);
    expect(d.lastResult?.outcome).toBe('LOSE');
    expect(d.snapshot().heroHp).toBe(0);
  });
});

describe('onShot never carries NaN (QA-08)', () => {
  it('unaimed fire and non-finite coordinates give a finite shot point and a miss', () => {
    for (const fire of [{}, { x: NaN, y: NaN }, { x: Infinity, y: 1 }]) {
      const d = mk({ shot: 5000 });
      const shots: { x: number; y: number }[] = [];
      let hits = 0;
      d.events.on('onShot', (e) => shots.push(e));
      d.events.on('onHit', () => hits++);
      d.input({ type: 'draw', t: CUE + 300 });
      d.input({ type: 'aim', t: CUE + 400, x: NaN, y: 3 });
      d.input({ type: 'fire', t: CUE + 500, ...fire });
      expect(shots).toHaveLength(1);
      expect(Number.isFinite(shots[0].x) && Number.isFinite(shots[0].y)).toBe(true);
      expect(hits).toBe(0);
    }
  });
});

describe('disarm limit (QA-09)', () => {
  it('parking the reticle on the limb cannot hold the enemy off forever', () => {
    const d = mk({ shot: 900, enemy: 6, hero: 1 });
    let enemyShots = 0;
    d.events.on('onShot', (e) => { if (e.shooter === 'enemy') enemyShots++; });
    d.input({ type: 'draw', t: CUE + 100 });
    d.input({ type: 'aim', t: CUE + 260, ...LIMB });
    d.advanceTo(CUE + 100000);
    expect(DUEL_CONFIG.fairness.maxDisarms).toBeGreaterThan(0);
    expect(enemyShots).toBeGreaterThan(0);
  });
});

describe('retry timing (FEEL_REVIEW item 2)', () => {
  it('RETRY is reachable 300 ms after the resolve', () => {
    expect(DUEL_CONFIG.resolve.holdMs).toBe(300);
    const d = mk({ hero: 1 });
    let t = -1;
    d.events.on('onResolve', (e) => { t = e.t; });
    d.advanceTo(CUE + 901); // just past the enemy shot at cue+900
    expect(t).toBeGreaterThan(0);
    d.advanceTo(t + 299);
    expect(d.currentPhase).toBe('RESOLVE');
    d.advanceTo(t + 300);
    expect(d.currentPhase).toBe('RETRY');
  });
});
