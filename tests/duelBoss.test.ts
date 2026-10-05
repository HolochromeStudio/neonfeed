import { describe, it, expect } from 'vitest';
import type { AudioEvent } from '../src/core/audioEvents';
import { DUEL_CONFIG } from '../src/data/duelConfig';
import type { DuelConfig } from '../src/data/duelConfig';
import { Rng } from '../src/core/rng';
import { createBossEncounter } from '../src/systems/BossSystem';
import { attachBossToDuel } from '../src/systems/BossBridge';
import { DuelSystem } from '../src/systems/DuelSystem';

const quiet = { emit: (_e: AudioEvent) => undefined };
const cfg: DuelConfig = {
  ...DUEL_CONFIG,
  aim: { ...DUEL_CONFIG.aim, slowMoScale: 1 },
  arena: { ...DUEL_CONFIG.arena, props: [{ id: 'sign', x: 20, y: 200, w: 40, h: 40 }, { id: 'barrel_target', x: 100, y: 440, w: 30, h: 30 }] },
};
const BODY = { x: 250, y: 350 };
const SIGN = { x: 40, y: 220 };

function setup(difficulty = 0.2) {
  const enc = createBossEncounter('mad_dog_mcgraw', new Rng(9), difficulty);
  const duel = new DuelSystem({ seed: 9, opponent: enc.opponent, enemyHp: enc.enemyHp, heroHp: 99, config: cfg, audio: quiet });
  const off = attachBossToDuel(enc.boss, duel);
  const log: string[] = [];
  enc.boss.events.on('onPhaseChange', (e) => log.push(`phase${e.to}`));
  enc.boss.events.on('onEnvironment', (e) => log.push(`env:${e.targetId}`));
  const budgets: number[] = [];
  duel.events.on('onAimStart', (e) => budgets.push(e.budgetMs));
  enc.boss.start(0);
  const cue = duel.plan.waitMs;
  return { enc, duel, off, log, budgets, cue };
}

/** Draws GOOD, shoots `at`, returns to the follow-up AIM. */
function drawAndShoot(s: ReturnType<typeof setup>, at: { x: number; y: number }) {
  const d = s.duel;
  d.advanceTo(s.cue);
  d.input({ type: 'draw', t: s.cue + 300 });
  d.input({ type: 'aim', t: s.cue + 440, ...at });
  d.input({ type: 'fire', t: s.cue + 450 });
}

describe('boss in the duel (phases, environment stagger, aim scale)', () => {
  it('hp drives the boss phase: a body hit takes McGraw from phase 1 to 2', () => {
    const s = setup();
    expect(s.enc.opponent.phase).toBe(1);
    drawAndShoot(s, BODY);
    expect(s.duel.snapshot().enemyHp).toBe(2);
    expect(s.log).toContain('phase2');
    expect(s.enc.opponent.phase).toBe(2);
    expect(s.enc.opponent.shotPlans.length).toBeGreaterThan(0);
  });

  it('the sign payoff staggers the pending shot immediately in phase 2 ', () => {
    const s = setup();
    drawAndShoot(s, BODY); // -> phase 2
    const t = s.cue + 600; // follow-up aim after the recoil
    s.duel.advanceTo(t);
    const before = s.duel.snapshot().enemyShotEtaMs!;
    s.duel.input({ type: 'aim', t, ...SIGN });
    s.duel.input({ type: 'fire', t: t + 1 });
    expect(s.log).toContain('env:sign');
    const after = s.duel.snapshot().enemyShotEtaMs!;
    expect(after - before).toBeCloseTo(700 - 1, 5); // +700 stagger, 1 ms of clock passed
    expect(s.duel.lastResult).toBeNull();
  });

  it('the sign does nothing in phase 1', () => {
    const s = setup();
    s.duel.advanceTo(s.cue);
    s.duel.input({ type: 'draw', t: s.cue + 300 });
    s.duel.input({ type: 'aim', t: s.cue + 440, ...SIGN });
    s.duel.input({ type: 'fire', t: s.cue + 450 });
    expect(s.log).not.toContain('env:sign');
  });

  it('phase 3 shrinks the aim budget (aimBudgetScale 0.8) but never below 0.7', () => {
    const s = setup();
    s.enc.opponent.setPhase(3);
    expect(s.enc.opponent.aimBudgetScale).toBeGreaterThanOrEqual(0.7);
    expect(s.enc.opponent.aimBudgetScale).toBeLessThan(1);
    s.duel.advanceTo(s.cue);
    s.duel.input({ type: 'draw', t: s.cue + 300 });
    s.duel.advanceTo(s.cue + 300 + 130);
    expect(s.budgets[0]).toBeCloseTo(DUEL_CONFIG.aim.budgetMs * s.enc.opponent.aimBudgetScale);
    expect(s.budgets[0]!).toBeGreaterThanOrEqual(DUEL_CONFIG.aim.budgetMs * 0.7 - 1e-9);
  });

  it('the F1 floor still holds on every boss shot while staggers pile up', () => {
    const s = setup(0.9);
    const shots: number[] = [];
    s.duel.events.on('onShot', (e) => { if (e.shooter === 'enemy') shots.push(e.t); });
    s.duel.advanceTo(s.cue);
    s.duel.staggerEnemy(300);
    s.duel.advanceTo(s.cue + 20_000);
    expect(shots[0]! - s.cue).toBeGreaterThanOrEqual(450 + 300);
  });

  it('the disposer detaches the bridge', () => {
    const s = setup();
    s.off();
    drawAndShoot(s, BODY);
    expect(s.log).not.toContain('phase2');
  });
});
