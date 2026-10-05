import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { BOSS_IDS, BOSSES, BOSS_MAX_INVULN_MS, BOSS_MIN_AIM_BUDGET_SCALE, BOSS_MIN_SHOT_GAP_MS, bossHpFor, getBossDef, type BossPhaseNumber } from '../src/data/bosses';
import { getBossDialogue } from '../src/data/dialogue';
import { FAIRNESS_FLOOR_MS } from '../src/data/enemies';
import { DUEL_CONFIG } from '../src/data/duelConfig';
import { BOSS_EVENT_NAMES, BossSystem, createBossEncounter, createBossOpponent, type BossEvents } from '../src/systems/BossSystem';
import { DuelSystem, type OpponentController } from '../src/systems/DuelSystem';

const silent = { emit() {} };
const PHASES: BossPhaseNumber[] = [1, 2, 3];

function plan(id: string, seed: number, d: number, phase: BossPhaseNumber, n = 8) {
  const rng = new Rng(seed);
  const o = createBossOpponent(id, rng, d);
  const wait = o.waitMs(rng);
  const draw = o.drawMs(rng);
  o.setPhase(phase);
  const shots: number[] = [];
  const errs: number[] = [];
  for (let i = 0; i < n; i++) {
    shots.push(o.shotDelayMs(rng, i));
    errs.push(o.aimErrorPx(rng, i));
  }
  return { o, wait, draw, shots, errs };
}

describe('boss data', () => {
  it('covers all four bosses with unique rewards, dialogue and timing', () => {
    expect(Object.keys(BOSSES).sort()).toEqual([...BOSS_IDS].sort());
    const rewards = new Set<string>();
    const leads = new Set<string>();
    for (const id of BOSS_IDS) {
      const d = BOSSES[id];
      expect(d.id).toBe(id);
      expect(getBossDialogue(d.dialogueId)).toBeDefined();
      rewards.add(d.reward.id);
      leads.add(JSON.stringify([d.timing, d.phases.map((p) => p.tell)]));
      expect(d.phases.map((p) => p.phase)).toEqual([1, 2, 3]);
      expect(d.environment.length).toBeGreaterThan(0);
      expect(d.failure.restartsAtPhase).toBe(1);
      expect(d.entrance.durationMs).toBeGreaterThan(0);
      for (const p of PHASES) expect(d.failure.hintByPhase[p].length).toBeGreaterThan(0);
    }
    expect(rewards.size).toBe(4);
    expect(leads.size).toBe(4);
    expect(BOSSES.mad_dog_mcgraw.implemented).toBe(true);
  });
  it('phase data respects fairness rules', () => {
    for (const d of Object.values(BOSSES)) {
      let prev = 2;
      for (const p of d.phases) {
        expect(p.enterAtHpFraction).toBeLessThan(prev);
        prev = p.enterAtHpFraction;
        expect(p.tell.leadMs).toBeGreaterThanOrEqual(FAIRNESS_FLOOR_MS);
        expect(p.volley.gapMs[0]).toBeGreaterThanOrEqual(BOSS_MIN_SHOT_GAP_MS);
        expect(p.invulnerableMs).toBeLessThanOrEqual(BOSS_MAX_INVULN_MS);
        expect(p.aimBudgetScale).toBeGreaterThanOrEqual(BOSS_MIN_AIM_BUDGET_SCALE);
        expect(p.pattern.length).toBe(p.volley.shots);
        if (p.fake) expect(p.fake.recoverMs).toBeGreaterThanOrEqual(400);
      }
      expect(d.phases[0].invulnerableMs).toBe(0);
    }
  });
  it('unknown boss throws; hp rises at high difficulty', () => {
    expect(() => createBossOpponent('nope', new Rng(1))).toThrow();
    expect(bossHpFor(getBossDef('mad_dog_mcgraw'), 0)).toBe(3);
    expect(bossHpFor(getBossDef('mad_dog_mcgraw'), 1)).toBe(4);
  });
});

describe('determinism', () => {
  it('same seed gives an identical plan, different seeds differ', () => {
    for (const p of PHASES) {
      const a = plan('mad_dog_mcgraw', 42, 0.5, p);
      const b = plan('mad_dog_mcgraw', 42, 0.5, p);
      expect({ ...a, o: 0 }).toEqual({ ...b, o: 0 });
      expect(a.o.shotPlans).toEqual(b.o.shotPlans);
    }
    const seen = new Set<string>();
    for (let s = 1; s <= 30; s++) seen.add(JSON.stringify(plan('mad_dog_mcgraw', s, 0.5, 2).shots));
    expect(seen.size).toBeGreaterThan(20);
  });
  it('uses a fixed number of rng draws per call whatever the phase', () => {
    const counts = PHASES.map((p) => {
      const rng = new Rng(7);
      const o = createBossOpponent('mad_dog_mcgraw', rng, 0.5);
      o.waitMs(rng); o.drawMs(rng); o.setPhase(p);
      for (let i = 0; i < 6; i++) { o.shotDelayMs(rng, i); o.aimErrorPx(rng, i); }
      return rng.getState();
    });
    expect(new Set(counts).size).toBe(1);
  });
  it('a full duel against the same seed replays identically', () => {
    const run = () => runDuel('mad_dog_mcgraw', 5, 0.4, botFast);
    expect(run()).toEqual(run());
  });
});

describe('F1 floor and fairness (thousands of seeds, every phase, every boss)', () => {
  it('tell-to-lethal never below 450 ms; gaps never below 450; fake leaves >= 400 ms', () => {
    for (const id of BOSS_IDS) {
      for (const phase of PHASES) {
        for (let seed = 1; seed <= 700; seed++) {
          const d = (seed % 5) / 4;
          const { o, shots, draw } = plan(id, seed * 7919, d, phase, 7);
          expect(shots[0]).toBeGreaterThanOrEqual(FAIRNESS_FLOOR_MS);
          expect(shots[0]).toBeGreaterThanOrEqual(draw);
          o.shotPlans.forEach((sp, i) => {
            expect(sp.leadMs).toBeGreaterThanOrEqual(FAIRNESS_FLOOR_MS);
            expect(sp.delayMs).toBe(shots[i]);
            if (i > 0) expect(sp.delayMs).toBeGreaterThanOrEqual(BOSS_MIN_SHOT_GAP_MS);
            if (sp.fake) {
              expect(sp.fake.recoverMs).toBeGreaterThanOrEqual(400);
              expect(sp.fake.kind).not.toBe(sp.tellKind);
              expect(sp.tellAtMs).toBeGreaterThanOrEqual(sp.fake.startMs + sp.fake.durationMs + sp.fake.recoverMs);
            }
          });
        }
      }
    }
  });
  it('mid-fight phase switches and staggers only add time', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const rng = new Rng(seed);
      const o = createBossOpponent('mad_dog_mcgraw', rng, (seed % 3) / 2);
      o.waitMs(rng); o.drawMs(rng);
      for (let i = 0; i < 12; i++) {
        if (i === 2) o.setPhase(2);
        if (i === 5) o.stagger(900);
        if (i === 7) o.setPhase(3);
        const dly = o.shotDelayMs(rng, i);
        o.aimErrorPx(rng, i);
        const sp = o.shotPlans[i];
        expect(sp.leadMs).toBeGreaterThanOrEqual(FAIRNESS_FLOOR_MS);
        if (i > 0) expect(dly).toBeGreaterThanOrEqual(BOSS_MIN_SHOT_GAP_MS);
      }
    }
  });
  it('difficulty raises fake chance but never shortens the lead', () => {
    const fakes = (d: number) => {
      let n = 0;
      for (let s = 1; s <= 400; s++) if (plan('mad_dog_mcgraw', s, d, 2, 4).o.shotPlans.some((p) => p.fake)) n++;
      return n;
    };
    expect(fakes(1)).toBeGreaterThan(fakes(0));
    const minLead = (d: number) => Math.min(...Array.from({ length: 300 }, (_, s) => plan('mad_dog_mcgraw', s + 1, d, 3, 1).shots[0]));
    expect(minLead(1)).toBeGreaterThanOrEqual(FAIRNESS_FLOOR_MS);
  });
});

describe('McGraw phase behaviour', () => {
  it('phase 1: single readable shots, no fakes', () => {
    for (let s = 1; s <= 200; s++) {
      const { o } = plan('mad_dog_mcgraw', s, 1, 1, 6);
      for (const sp of o.shotPlans) {
        expect(sp.volleyShots).toBe(1);
        expect(sp.fake).toBeNull();
        expect(sp.kind).toBe('opener');
        expect(sp.tellKind).toBe('dog_growl_eye_flash');
      }
    }
  });
  it('phase 2: volleys of two with a faster follow-up; fake draws happen on openers', () => {
    let fakes = 0;
    for (let s = 1; s <= 300; s++) {
      const { o } = plan('mad_dog_mcgraw', s, 0.5, 2, 6);
      o.shotPlans.forEach((sp, i) => {
        expect(sp.volleyShots).toBe(2);
        if (i > 0) {
          expect(sp.kind).toBe(i % 2 === 1 ? 'follow_up' : 'opener');
          if (sp.kind === 'follow_up') expect(sp.delayMs).toBeLessThan(900);
          if (sp.fake) { expect(sp.kind).toBe('opener'); fakes++; }
        }
      });
    }
    expect(fakes).toBeGreaterThan(100);
  });
  it('phase 3: rapid 3-shot volleys on one tempo with a telegraphed pattern', () => {
    for (let s = 1; s <= 200; s++) {
      const { o } = plan('mad_dog_mcgraw', s, 0.3, 3, 7);
      const p = o.shotPlans;
      expect(p[0].pattern).toEqual(['bark', 'bark', 'bang']);
      expect(p[1].kind).toBe('follow_up');
      expect(p[2].kind).toBe('follow_up');
      expect(p[1].delayMs).toBe(p[2].delayMs);
      expect(p[1].delayMs).toBeLessThanOrEqual(540);
      expect(p[3].kind).toBe('opener');
      expect(p[3].fake).toBeNull();
    }
  });
  it('stub bosses run phase-1 numbers in every phase', () => {
    const a = plan('the_undertaker', 3, 0.5, 1, 6);
    const b = plan('the_undertaker', 3, 0.5, 3, 6);
    expect(b.shots).toEqual(a.shots);
    expect(b.o.tellKind).toBe(a.o.tellKind);
  });
});

// ---------------------------------------------------------------- BossSystem

function record(boss: BossSystem) {
  const log: { name: keyof BossEvents; p: BossEvents[keyof BossEvents] }[] = [];
  for (const n of BOSS_EVENT_NAMES) boss.events.on(n, (p) => log.push({ name: n, p } as never));
  return log;
}

describe('BossSystem state machine', () => {
  it('entrance fires once, then the fight starts', () => {
    const boss = new BossSystem({ bossId: 'mad_dog_mcgraw' });
    const log = record(boss);
    boss.start(0); boss.start(10);
    expect(boss.state).toBe('entrance');
    boss.advanceTo(BOSSES.mad_dog_mcgraw.entrance.durationMs - 1);
    expect(boss.state).toBe('entrance');
    boss.advanceTo(BOSSES.mad_dog_mcgraw.entrance.durationMs);
    expect(boss.state).toBe('fighting');
    expect(log.map((l) => l.name)).toEqual(['onEntrance', 'onFightStart']);
    const e = log[0].p as BossEvents['onEntrance'];
    expect(e.lines.length).toBeGreaterThan(0);
    expect(e.previewTell).toBe('dog_growl_eye_flash');
  });

  it('phases fire once and in order by hp, with a short signposted invulnerability', () => {
    const { boss, opponent } = createBossEncounter('mad_dog_mcgraw', new Rng(1), 0);
    const log = record(boss);
    boss.start(0); boss.beginFight(0);
    boss.updateHp(3, 10); // unchanged
    boss.updateHp(2, 100);
    expect(boss.phase).toBe(2);
    expect(opponent.phase).toBe(2);
    expect(boss.isInvulnerable(100)).toBe(true);
    expect(boss.isInvulnerable(100 + 499)).toBe(true);
    boss.advanceTo(100 + 500);
    expect(boss.isInvulnerable(100 + 500)).toBe(false);
    boss.updateHp(2, 700); boss.updateHp(2.0, 710);
    boss.updateHp(1, 800);
    expect(boss.phase).toBe(3);
    boss.updateHp(1, 900);
    const changes = log.filter((l) => l.name === 'onPhaseChange').map((l) => l.p as BossEvents['onPhaseChange']);
    expect(changes.map((c) => [c.from, c.to])).toEqual([[1, 2], [2, 3]]);
    expect(changes[0].lines.length).toBe(1);
    for (const c of changes) {
      expect(c.invulnerableMs).toBeLessThanOrEqual(BOSS_MAX_INVULN_MS);
      expect(c.signpost.length).toBeGreaterThan(0);
    }
    const names = log.map((l) => l.name);
    expect(names.filter((n) => n === 'onInvulnerable').length).toBe(2);
    expect(names.indexOf('onPhaseChange')).toBeLessThan(names.indexOf('onInvulnerable'));
  });

  it('one big hit skips thresholds: transitions still fire once each, in order; a kill skips them', () => {
    const a = new BossSystem({ bossId: 'mad_dog_mcgraw' });
    const la = record(a);
    a.start(0); a.beginFight(0);
    a.updateHp(0.5, 5);
    expect(la.filter((l) => l.name === 'onPhaseChange').map((l) => (l.p as BossEvents['onPhaseChange']).to)).toEqual([2, 3]);
    const b = new BossSystem({ bossId: 'mad_dog_mcgraw' });
    const lb = record(b);
    b.start(0); b.beginFight(0);
    b.updateHp(0, 5);
    expect(lb.filter((l) => l.name === 'onPhaseChange').length).toBe(0);
    expect(b.state).toBe('defeated');
  });

  it('defeat is terminal: once, no further events, no restart', () => {
    const { boss, opponent } = createBossEncounter('mad_dog_mcgraw', new Rng(1), 0);
    const log = record(boss);
    boss.start(0); boss.beginFight(0);
    boss.updateHp(1, 10);
    boss.updateHp(0, 20);
    const n = log.length;
    expect(boss.state).toBe('defeated');
    expect(boss.isTerminal).toBe(true);
    boss.updateHp(3, 30); boss.restartAttempt(40); boss.playerDefeated('too_slow', 50); boss.propHit('sign', 60);
    boss.start(70); boss.beginFight(80); boss.advanceTo(9999);
    expect(log.length).toBe(n);
    expect(boss.state).toBe('defeated');
    expect(boss.hp).toBe(0);
    expect(opponent.phase).toBe(3);
    const d = log.filter((l) => l.name === 'onDefeat');
    expect(d.length).toBe(1);
    expect((d[0].p as BossEvents['onDefeat']).rewardId).toBe('legend_mad_dog_fang');
    expect((d[0].p as BossEvents['onDefeat']).lines.length).toBeGreaterThan(0);
  });

  it('failure is clean and retryable: phase 1, full hp, hint by phase', () => {
    const { boss, opponent } = createBossEncounter('mad_dog_mcgraw', new Rng(1), 0);
    const log = record(boss);
    boss.start(0); boss.beginFight(0);
    boss.updateHp(2, 10);
    boss.playerDefeated('shot_while_aiming', 20);
    boss.playerDefeated('shot_while_aiming', 21);
    expect(boss.state).toBe('failed');
    boss.updateHp(1, 25); // ignored while failed
    expect(boss.phase).toBe(2);
    const f = log.filter((l) => l.name === 'onFailure');
    expect(f.length).toBe(1);
    expect((f[0].p as BossEvents['onFailure']).hint).toBe(BOSSES.mad_dog_mcgraw.failure.hintByPhase[2]);
    boss.restartAttempt(30);
    expect(boss.state).toBe('fighting');
    expect(boss.phase).toBe(1);
    expect(boss.hp).toBe(3);
    expect(opponent.phase).toBe(1);
    boss.updateHp(2, 40);
    expect(log.filter((l) => l.name === 'onPhaseChange').length).toBe(2); // phase 2 fires again in the new attempt
    expect(boss.attempt).toBe(2);
  });

  it('environment targets stagger once per phase and only in the right phase', () => {
    const { boss, opponent } = createBossEncounter('mad_dog_mcgraw', new Rng(1), 0);
    const log = record(boss);
    boss.start(0); boss.beginFight(0);
    boss.propHit('sign', 5); // phase 1: nothing
    boss.updateHp(2, 10);
    boss.propHit('sign', 20); boss.propHit('sign', 30);
    boss.updateHp(1, 40);
    boss.propHit('barrel', 50);
    const env = log.filter((l) => l.name === 'onEnvironment').map((l) => l.p as BossEvents['onEnvironment']);
    expect(env.map((e) => [e.targetId, e.phase])).toEqual([['sign', 2], ['barrel', 3]]);
    expect(opponent.shotPlans.length).toBe(0);
  });

  it('stagger delays the next tell and keeps the lead above the floor', () => {
    const rng = new Rng(9);
    const o = createBossOpponent('mad_dog_mcgraw', rng, 0);
    o.waitMs(rng); o.drawMs(rng);
    o.shotDelayMs(rng, 0);
    const r2 = new Rng(9);
    const o2 = createBossOpponent('mad_dog_mcgraw', r2, 0);
    o2.waitMs(r2); o2.drawMs(r2); o2.shotDelayMs(r2, 0);
    o2.stagger(700);
    expect(o2.shotDelayMs(r2, 1)).toBe(o.shotDelayMs(rng, 1) + 700);
  });
});

// ---------------------------------------------------------------- full duel

type Bot = (d: DuelSystem, t: number) => void;
const BODY = { x: 250, y: 350 };
const LIMB = { x: 224, y: 352 };

const botFast: Bot = (d, t) => {
  const s = d.snapshot();
  if (s.phase === 'CUE' && s.cueAt !== null && t >= s.cueAt + 230) d.input({ type: 'draw', t });
  else if (s.phase === 'AIM') {
    d.input({ type: 'aim', t, ...BODY });
    d.input({ type: 'fire', t: t + 1 });
  }
};
const botDisarmer: Bot = (d, t) => {
  const s = d.snapshot();
  if (s.phase === 'CUE' && s.cueAt !== null && t >= s.cueAt + 230) d.input({ type: 'draw', t });
  else if (s.phase === 'AIM') {
    d.input({ type: 'aim', t, ...LIMB });
    d.input({ type: 'fire', t: t + 1 });
  }
};
const botAsleep: Bot = () => {};

function runDuel(bossId: string, seed: number, difficulty: number, bot: Bot, opts: { retries?: number } = {}) {
  const rng = new Rng(seed);
  const enc = createBossEncounter(bossId, rng, difficulty);
  const d = new DuelSystem({ seed, opponent: enc.opponent as OpponentController, enemyHp: enc.enemyHp, heroHp: 3, audio: silent });
  enc.boss.attachDuel(d);
  const log: string[] = [];
  for (const n of BOSS_EVENT_NAMES) enc.boss.events.on(n, (p) => log.push(`${n}:${JSON.stringify((p as { to?: number }).to ?? '')}`));
  let t = 0;
  let retries = 0;
  const outcomes: string[] = [];
  while (t < 300_000) {
    t += 10;
    d.advanceTo(t);
    if (d.currentPhase === 'RETRY' || (d.isOver && d.lastResult)) {
      outcomes.push(d.lastResult?.outcome ?? '?');
      if (d.lastResult?.outcome === 'WIN' || retries >= (opts.retries ?? 0)) break;
      retries++;
      d.retry();
      continue;
    }
    bot(d, t);
  }
  return { outcomes, log, state: enc.boss.state, phase: enc.boss.phase, over: d.isOver, t, attempts: enc.boss.attempt };
}

describe('full DuelSystem duel against McGraw', () => {
  it('always ends WIN or LOSE and never hangs, for many seeds and difficulties', () => {
    for (let seed = 1; seed <= 150; seed++) {
      for (const bot of [botFast, botDisarmer, botAsleep]) {
        const r = runDuel('mad_dog_mcgraw', seed, (seed % 5) / 4, bot);
        expect(r.over).toBe(true);
        expect(['WIN', 'LOSE']).toContain(r.outcomes[0]);
        expect(r.t).toBeLessThan(120_000);
        expect(r.state).toBe(r.outcomes[0] === 'WIN' ? 'defeated' : 'failed');
      }
    }
  });
  it('a perfect-ish player can win and sees the phases in order; losing then retrying restarts at phase 1', () => {
    let wins = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const r = runDuel('mad_dog_mcgraw', seed, 0, botFast, { retries: 3 });
      const phases = r.log.filter((l) => l.startsWith('onPhaseChange')).map((l) => l.split(':')[1]);
      if (r.outcomes[r.outcomes.length - 1] === 'WIN') {
        wins++;
        expect(r.state).toBe('defeated');
        expect(r.log.filter((l) => l.startsWith('onDefeat')).length).toBe(1);
        // per attempt, phases are 2 then 3 (never repeated within an attempt)
        expect(phases.join(',').replace(/(2,3,?)+/g, 'X')).toMatch(/^(X|2|)$/);
      }
      expect(r.log[0].startsWith('onEntrance')).toBe(true);
    }
    expect(wins).toBeGreaterThan(20);
  });
  it('the plan is identical on retry (F5) and first shot respects the floor', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = new Rng(seed);
      const enc = createBossEncounter('mad_dog_mcgraw', rng, 0.5);
      const d = new DuelSystem({ seed, opponent: enc.opponent as OpponentController, enemyHp: enc.enemyHp, audio: silent });
      const first = d.plan;
      expect(first.firstShotMs).toBeGreaterThanOrEqual(DUEL_CONFIG.fairness.minLethalMs);
      d.advanceTo(60_000);
      expect(d.isOver).toBe(true);
      d.advanceTo(d.snapshot().now + DUEL_CONFIG.resolve.holdMs);
      d.retry();
      expect(d.plan).toEqual(first);
    }
  });
  it('stub bosses also complete a duel', () => {
    for (const id of ['the_undertaker', 'lady_luck', 'el_diablo']) {
      for (let seed = 1; seed <= 20; seed++) {
        const r = runDuel(id, seed, 0.5, botFast);
        expect(r.over).toBe(true);
        expect(['WIN', 'LOSE']).toContain(r.outcomes[0]);
      }
    }
  });
});
