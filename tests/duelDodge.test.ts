import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { DUEL_CONFIG } from '../src/data/duelConfig';
import { DuelSystem, replayDuel } from '../src/systems/DuelSystem';
import type { DuelEvents, DuelInput, DuelParams, OpponentController } from '../src/systems/DuelSystem';
import { SwipeTracker, recognizeHorizontal, recognizeSwipe } from '../src/systems/InputSystem';
import type { AudioEvent } from '../src/core/audioEvents';
import { BODY, CUE, Fixed, HEAD, LIMB, cfgWith, quietAudio } from './qa/helpers';

/** Fixed(wait 1000, draw 300, first shot 900 after the cue, err 0, gap 650): first shot at CUE+900, window opens at CUE+650. */
const SHOT0 = CUE + 900;

class Windowed implements OpponentController {
  readonly id = 'windowed';
  constructor(readonly dodgeWindowMs: number, private readonly shot = 900, private readonly errs: number[] = [0]) {}
  waitMs() { return 1000; }
  drawMs() { return 300; }
  shotDelayMs(_r: Rng, i: number) { return i === 0 ? this.shot : 650; }
  aimErrorPx(_r: Rng, i: number) { return this.errs[Math.min(i, this.errs.length - 1)]; }
}

function make(p: Partial<DuelParams> & { opp?: OpponentController } = {}) {
  const audio: AudioEvent[] = [];
  const { opp, ...rest } = p;
  const d = new DuelSystem({ seed: 1, opponent: opp ?? new Fixed(), audio: { emit: (e) => audio.push(e) }, ...rest });
  const ev: { [K in keyof DuelEvents]?: DuelEvents[K][] } = {};
  const names: (keyof DuelEvents)[] = ['onDodge', 'onMiss', 'onHit', 'onShot', 'onAimStart', 'onPhase', 'onResolve'];
  for (const n of names) d.events.on(n, ((e: never) => ((ev[n] ??= []) as unknown[]).push(e)) as never);
  return { d, ev, audio };
}

const dodges = (m: ReturnType<typeof make>) => m.ev.onDodge ?? [];

describe('D14: lives and elite/boss damage are config-driven', () => {
  it('hero lives default to 2 and elite/boss hits are 2 in the config', () => {
    expect(DUEL_CONFIG.damage.heroHp).toBe(2);
    expect(DUEL_CONFIG.damage.eliteDamage).toBe(2);
    expect(DUEL_CONFIG.damage.bossDamage).toBe(2);
    expect(DUEL_CONFIG.damage.enemyDamage).toBe(1);
    expect(make().d.snapshot().heroHp).toBe(2);
  });

  it('a normal enemy hit costs 1, an elite or boss hit costs 2', () => {
    for (const [kind, lost] of [['normal', 1], ['elite', 2], ['boss', 2]] as const) {
      const { d } = make({ kind, heroHp: 3 });
      d.advanceTo(SHOT0 + 1);
      expect(d.snapshot().heroHp, kind).toBe(3 - lost);
    }
  });

  it('an elite kills a 2-life hero in one hit, a normal enemy does not', () => {
    const e = make({ kind: 'elite' });
    e.d.advanceTo(SHOT0 + 1);
    expect(e.d.lastResult?.outcome).toBe('LOSE');
    const n = make({ kind: 'normal' });
    n.d.advanceTo(SHOT0 + 1);
    expect(n.d.lastResult).toBeNull();
    expect(n.d.snapshot().heroHp).toBe(1);
  });

  it('is reversible from the config: eliteDamage = 1 restores 1-damage elites; the perk multiplier still applies', () => {
    const cfg = cfgWith({ damage: { eliteDamage: 1, bossDamage: 1 } });
    const a = make({ kind: 'boss', heroHp: 3, config: cfg });
    a.d.advanceTo(SHOT0 + 1);
    expect(a.d.snapshot().heroHp).toBe(2);
    const m = make({ kind: 'elite', heroHp: 4, modifiers: { enemyDamageMult: 2 } });
    m.d.advanceTo(SHOT0 + 1);
    expect(m.d.snapshot().heroHp).toBe(0);
    const z = make({ kind: 'elite', heroHp: 2, modifiers: { enemyDamageMult: 0 } }); // Iron Skin
    z.d.advanceTo(SHOT0 + 1);
    expect(z.d.snapshot().heroHp).toBe(2);
  });
});

describe('dodge: results and timing', () => {
  it('a dodge inside the window makes the shot miss and ends in a counter draw, then a normal aim', () => {
    const m = make({ enemyHp: 1, heroHp: 2 });
    m.d.advanceTo(CUE);
    m.d.input({ type: 'dodge', t: SHOT0 - 100, dir: 'left' });
    expect(dodges(m)[0]).toMatchObject({ result: 'ok', success: true, etaMs: 100, windowMs: 250, counterDraw: true, dir: 'left' });
    expect(m.d.snapshot().dodge.committed).toBe(true);
    m.d.advanceTo(SHOT0 + 1);
    expect(m.d.snapshot().heroHp).toBe(2);
    expect(m.ev.onMiss?.some((x) => x.shooter === 'enemy' && x.evaded === 'dodge')).toBe(true);
    expect(m.d.currentPhase).toBe('DRAW');
    m.d.advanceTo(SHOT0 + 121);
    expect(m.d.currentPhase).toBe('AIM');
    m.d.input({ type: 'fire', t: SHOT0 + 200, x: BODY.x, y: BODY.y });
    expect(m.d.lastResult?.outcome).toBe('WIN');
    expect(m.d.lastResult).toMatchObject({ dodges: 1, dodgeFails: 0, tier: null, reactionMs: null });
    expect(m.audio.some((a) => a.type === 'dodge')).toBe(true);
  });

  it('PERFECT is a fast reaction (first 35% of the window): bigger counter aim budget, still no tier', () => {
    const p = make();
    p.d.input({ type: 'dodge', t: SHOT0 - 200 });
    expect(dodges(p)[0]).toMatchObject({ result: 'perfect', success: true });
    p.d.advanceTo(SHOT0 + 200);
    expect(p.ev.onAimStart?.[0].budgetMs).toBeCloseTo(DUEL_CONFIG.aim.budgetMs * (1 + DUEL_CONFIG.dodge.perfectBudgetBonus), 5);
    expect(p.d.snapshot().tier).toBeNull();
    const o = make();
    o.d.input({ type: 'dodge', t: SHOT0 - 100 });
    o.d.advanceTo(SHOT0 + 200);
    expect(o.ev.onAimStart?.[0].budgetMs).toBe(DUEL_CONFIG.aim.budgetMs);
  });

  it('window edges: eta == window and eta == 0 succeed (the player input lands first), one ms earlier is early', () => {
    const at = (t: number) => { const m = make(); m.d.input({ type: 'dodge', t }); return dodges(m)[0]; };
    expect(at(SHOT0 - 250).result).toBe('perfect'); // opens exactly 250 ms before
    expect(at(SHOT0 - 251).result).toBe('early');
    expect(at(SHOT0).success).toBe(true);
    expect(at(SHOT0 - 162).result).toBe('ok'); // 162 < 162.5 => outside the fast first 35%? eta 162 < 162.5
    expect(at(SHOT0 - 163).result).toBe('perfect');
  });

  it('an early dodge stumbles: it costs the same as a flinch, delays the next draw and ignores dodges meanwhile', () => {
    const m = make({ heroHp: 3 });
    m.d.input({ type: 'dodge', t: CUE + 500 });
    expect(dodges(m)[0]).toMatchObject({ result: 'early', success: false });
    expect(m.d.snapshot().dodge.stumbleMs).toBe(DUEL_CONFIG.dodge.failPenaltyMs);
    m.d.input({ type: 'dodge', t: CUE + 600 }); // still stumbling
    expect(dodges(m)).toHaveLength(1);
    expect(m.d.snapshot().ignoredInputs).toBe(1);
    m.d.input({ type: 'draw', t: CUE + 600 }); // raw 600, +200 stumble left
    expect(m.d.snapshot().reactionMs).toBe(800);
    m.d.advanceTo(SHOT0 + 1);
    expect(m.d.snapshot().heroHp).toBe(2); // the shot lands while the hero is still drawing
    expect(m.d.currentPhase).toBe('DRAW');
    m.d.advanceTo(CUE + 600 + 120 + 200);
    expect(m.d.currentPhase).toBe('AIM');
    expect(m.d.snapshot().dodge.stumbleMs).toBe(0);
  });

  it('a dodge just after an undodged shot is LATE and costs the same', () => {
    const m = make({ heroHp: 3 });
    m.d.advanceTo(SHOT0 + 1);
    expect(m.d.snapshot().heroHp).toBe(2);
    m.d.input({ type: 'dodge', t: SHOT0 + 80 });
    expect(dodges(m)[0]).toMatchObject({ result: 'late', success: false });
    expect(m.d.lastResult).toBeNull();
    expect(m.d.snapshot().dodge.stumbleMs).toBeGreaterThan(0);
    const later = make({ heroHp: 3 });
    later.d.advanceTo(SHOT0 + 1);
    later.d.input({ type: 'dodge', t: SHOT0 + DUEL_CONFIG.dodge.lateGraceMs + 10 });
    expect(dodges(later)[0].result).toBe('early'); // too long after the last shot to blame it: the next one is far off
  });

  it('is rejected (counted as ignored, no event) in WAIT, DRAW, AIM without Tumble, and after the duel', () => {
    const w = make();
    w.d.input({ type: 'dodge', t: 500 });
    expect(dodges(w)).toHaveLength(0);
    expect(w.d.snapshot().ignoredInputs).toBe(1);
    const x = make({ enemyHp: 1 });
    x.d.input({ type: 'draw', t: CUE + 300 });
    x.d.input({ type: 'dodge', t: CUE + 350 }); // DRAW
    x.d.input({ type: 'dodge', t: CUE + 500 }); // AIM
    expect(dodges(x)).toHaveLength(0);
    expect(x.d.snapshot().ignoredInputs).toBe(2);
    x.d.input({ type: 'fire', t: CUE + 520, x: HEAD.x, y: HEAD.y });
    expect(x.d.lastResult?.outcome).toBe('WIN');
    x.d.input({ type: 'dodge', t: CUE + 600 });
    expect(dodges(x)).toHaveLength(0);
  });

  it('a committed dodge blocks a second dodge and the draw until the shot has passed', () => {
    const m = make();
    m.d.input({ type: 'dodge', t: SHOT0 - 200 });
    m.d.input({ type: 'dodge', t: SHOT0 - 150 });
    m.d.input({ type: 'draw', t: SHOT0 - 100 });
    expect(dodges(m)).toHaveLength(1);
    expect(m.d.snapshot().ignoredInputs).toBe(2);
    expect(m.d.snapshot().reactionMs).toBeNull();
  });

  it('a fire released while the dodge is pending is queued for the counter AIM', () => {
    const m = make({ enemyHp: 1 });
    m.d.input({ type: 'dodge', t: SHOT0 - 100 });
    m.d.input({ type: 'fire', t: SHOT0 - 50, x: HEAD.x, y: HEAD.y });
    m.d.advanceTo(SHOT0 + 200);
    expect(m.d.lastResult?.outcome).toBe('WIN');
  });

  it('works in the recoil beat after a shot (SHOT): the follow-up shot is dodged while the hero keeps aiming', () => {
    const m = make({ enemyHp: 3, heroHp: 2, opp: new Windowed(250, 450) as OpponentController });
    m.d.input({ type: 'draw', t: CUE + 100 });
    m.d.advanceTo(CUE + 220);
    m.d.input({ type: 'fire', t: CUE + 230, x: BODY.x, y: BODY.y }); // body hit, enemy survives, recoil 150 ms
    expect(m.d.currentPhase).toBe('SHOT');
    const st = m.d.snapshot();
    expect(st.dodge.available).toBe(true);
    // enemy shot 0 is at enemyT 450; the hero is in slow-mo only during AIM, so it lands in real time ~CUE+455
    m.d.input({ type: 'dodge', t: CUE + 300 });
    expect(dodges(m)[0].success).toBe(true);
    m.d.advanceTo(CUE + 600);
    expect(m.d.snapshot().heroHp).toBe(2);
    expect(m.d.currentPhase).not.toBe('RESOLVE');
  });
});

describe('dodge: the window comes from the opponent and stays fair', () => {
  const win = (opp: OpponentController, mods = {}) => make({ opp, modifiers: mods }).d.snapshot().dodge.windowMs;
  it('uses dodgeWindowMs, clamped to 150..600 ms, with a sane default', () => {
    expect(win(new Fixed())).toBe(250);
    expect(win(new Windowed(400))).toBe(400);
    expect(win(new Windowed(40))).toBe(DUEL_CONFIG.dodge.minWindowMs);
    expect(win(new Windowed(1e9))).toBe(DUEL_CONFIG.dodge.maxWindowMs);
    for (const bad of [NaN, -5, 0, Infinity]) expect(win(new Windowed(bad))).toBe(bad === Infinity ? 250 : 250);
  });
  it('Matador-style multiplier widens it and never goes under the floor', () => {
    expect(win(new Fixed(), { dodgeWindowMult: 2 })).toBe(500);
    expect(win(new Windowed(400), { dodgeWindowMult: 2 })).toBe(600);
    expect(win(new Fixed(), { dodgeWindowMult: 0.1 })).toBe(150);
    expect(win(new Fixed(), { dodgeWindowMult: NaN })).toBe(250);
  });
  it('a dodge is always reachable: at 60 fps the window is at least 9 frames, the window covers the whole last stretch before the shot', () => {
    expect(DUEL_CONFIG.dodge.minWindowMs).toBeGreaterThanOrEqual(9 * (1000 / 60));
    const m = make({ opp: new Windowed(150) as OpponentController });
    let ok = 0;
    for (let f = 0; f <= 9; f++) { // every 60 fps frame of the narrowest window succeeds
      const k = make({ opp: new Windowed(150) as OpponentController });
      k.d.input({ type: 'dodge', t: Math.round(SHOT0 - 150 + f * (1000 / 60)) });
      if (dodges(k)[0].success) ok++;
    }
    expect(ok).toBe(10);
    expect(dodges(m)).toHaveLength(0);
  });
  it('the window is measured in real ms even during slow-mo (Tumble in AIM)', () => {
    const m = make({ opp: new Windowed(250, 450) as OpponentController, modifiers: { dodgeWhileAiming: true } });
    m.d.input({ type: 'draw', t: CUE + 300 });
    m.d.advanceTo(CUE + 420);
    const s = m.d.snapshot();
    expect(s.phase).toBe('AIM');
    expect(s.dodge.etaMs).toBeCloseTo(30 / DUEL_CONFIG.aim.slowMoScale, 5);
    expect(s.dodge.open).toBe(true);
  });
});

describe('RULE F1 and the plan are untouched by dodging', () => {
  it('dodging never moves the first shot: tell-to-shot stays >= 450 ms and equals the undisturbed plan', () => {
    const firstShot = (inputs: DuelInput[], opp: OpponentController) => {
      const m = make({ opp, modifiers: { dodgeWindowMult: 4, dodgeWhileAiming: true, dodgeCloudBlocksShot: true, phantomStep: true } });
      let t0: number | null = null;
      m.d.events.on('onShot', (e) => { if (e.shooter === 'enemy' && t0 === null) t0 = e.t - (m.d.snapshot().cueAt as number); });
      for (const i of inputs) m.d.input(i);
      m.d.advanceTo(20000);
      return { t0, plan: m.d.plan };
    };
    for (const shot of [0, 200, 449, 450, 900]) {
      const opp = new Fixed(1000, 100, shot);
      const base = firstShot([], opp);
      expect(base.t0).toBeGreaterThanOrEqual(DUEL_CONFIG.fairness.minLethalMs);
      for (const dt of [0, 1, 100, 300, 449, 450, 600]) {
        const r = firstShot([{ type: 'dodge', t: CUE + dt }], opp);
        expect(r.plan).toEqual(base.plan);
        if (r.t0 !== null) expect(r.t0).toBeGreaterThanOrEqual(DUEL_CONFIG.fairness.minLethalMs);
      }
    }
  });
  it('no dodge input can make the window open before the cue (the muzzle raise is never earlier than the tell)', () => {
    const m = make({ opp: new Windowed(600, 450) as OpponentController, modifiers: { dodgeWindowMult: 2 } });
    m.d.advanceTo(CUE - 1);
    expect(m.d.snapshot().dodge.open).toBe(false);
    expect(m.d.snapshot().dodge.available).toBe(false);
    m.d.advanceTo(CUE);
    expect(m.d.snapshot().dodge.open).toBe(true); // CUE + 450 shot, 600 window: open from the cue itself, not before
  });
});

describe('dodge perks', () => {
  it('Counter Roll: the next player shot after a successful dodge crits (consumed by that shot)', () => {
    const run = (mods: object) => {
      const m = make({ enemyHp: 5, modifiers: mods });
      m.d.input({ type: 'dodge', t: SHOT0 - 100 });
      m.d.advanceTo(SHOT0 + 130);
      m.d.input({ type: 'fire', t: SHOT0 + 140, x: BODY.x, y: BODY.y });
      m.d.advanceTo(SHOT0 + 600);
      return m.ev.onShot?.filter((s) => s.shooter === 'player').map((s) => s.crit);
    };
    expect(run({ dodgeGuaranteesCrit: true })?.[0]).toBe(true);
    expect(run({})?.[0]).toBe(false);
    const m = make({ enemyHp: 9, modifiers: { dodgeGuaranteesCrit: true }, opp: new Fixed(1000, 300, 900, 100) });
    m.d.input({ type: 'dodge', t: SHOT0 - 100 });
    m.d.advanceTo(SHOT0 + 130);
    m.d.input({ type: 'fire', t: SHOT0 + 140, x: BODY.x, y: BODY.y });
    m.d.advanceTo(SHOT0 + 300);
    m.d.input({ type: 'fire', t: SHOT0 + 320, x: BODY.x, y: BODY.y });
    expect(m.ev.onShot?.filter((s) => s.shooter === 'player').map((s) => s.crit)).toEqual([true, false]);
  });

  it('Dust Kick: the cloud blocks the next enemy shot only (one block per dodge)', () => {
    const m = make({ heroHp: 3, enemyHp: 99, modifiers: { dodgeCloudBlocksShot: true } });
    m.d.input({ type: 'dodge', t: SHOT0 - 100 });
    expect(dodges(m)[0].cloud).toBe(true);
    m.d.advanceTo(SHOT0 + 120);
    // shot 1 comes 650 enemy-ms after shot 0; the hero aims (slow-mo) so it lands later in real time
    m.d.advanceTo(SHOT0 + 5000);
    const misses = (m.ev.onMiss ?? []).filter((x) => x.shooter === 'enemy');
    expect(misses.map((x) => x.evaded)).toEqual(['dodge', 'dust']);
    expect(m.d.snapshot().heroHp).toBeLessThan(3); // the third shot is not blocked
  });

  it('Matador and Slip Away: window multiplier is applied and DuelResult.dodges counts successful dodges', () => {
    const m = make({ enemyHp: 1, modifiers: { dodgeWindowMult: 2 } });
    m.d.input({ type: 'dodge', t: SHOT0 - 450 }); // would be early with the default 250
    expect(dodges(m)[0]).toMatchObject({ success: true, windowMs: 500 });
    m.d.advanceTo(SHOT0 + 200);
    m.d.input({ type: 'fire', t: SHOT0 + 210, x: HEAD.x, y: HEAD.y });
    expect(m.d.lastResult?.dodges).toBe(1);
  });

  it('Tumble: dodge while aiming at 40% of the aim budget, never below the floor, never lengthening the budget', () => {
    const mods = { dodgeWhileAiming: true, tumbleBudgetCost: 0.4 };
    const m = make({ opp: new Windowed(250, 450) as OpponentController, modifiers: mods });
    m.d.input({ type: 'draw', t: CUE + 300 });
    m.d.advanceTo(CUE + 425);
    const before = m.d.snapshot().aimRemainingMs as number; // budget 600, 5 ms spent
    expect(before).toBe(595);
    m.d.input({ type: 'dodge', t: CUE + 430, dir: 'right' });
    expect(dodges(m)[0]).toMatchObject({ success: true, fromAim: true });
    expect(m.d.snapshot().aimRemainingMs).toBeCloseTo(590 - 0.4 * 600, 5);
    m.d.advanceTo(CUE + 600);
    expect(m.d.snapshot().heroHp).toBe(2); // the shot at ~CUE+505 was dodged while aiming
    expect(m.ev.onMiss?.some((x) => x.evaded === 'dodge')).toBe(true);
    // a second tumble near the end of the budget cannot push the deadline out or take the last 100 ms
    const n = make({ opp: new Windowed(600, 450) as OpponentController, modifiers: { dodgeWhileAiming: true, tumbleBudgetCost: 1 } });
    n.d.input({ type: 'draw', t: CUE + 300 });
    n.d.advanceTo(CUE + 421);
    n.d.input({ type: 'dodge', t: CUE + 421 });
    expect(n.d.snapshot().aimRemainingMs).toBe(DUEL_CONFIG.dodge.tumbleMinLeftMs);
  });

  it('Tumble costs the budget even when the attempt is early (no free probing)', () => {
    const mods = { dodgeWhileAiming: true, tumbleBudgetCost: 0.4 };
    const m = make({ opp: new Windowed(150, 900) as OpponentController, modifiers: mods });
    m.d.input({ type: 'draw', t: CUE + 300 });
    m.d.advanceTo(CUE + 420);
    m.d.input({ type: 'dodge', t: CUE + 420 });
    expect(dodges(m)[0].result).toBe('early');
    expect(m.d.snapshot().aimRemainingMs).toBeCloseTo(600 - 240, 5);
  });

  it('Phantom Step: after an enemy miss the hero may dodge while aiming at no budget cost, until the next shot resolves', () => {
    const opp = new Windowed(250, 450, [100, 0]); // shot 0 misses naturally
    const m = make({ opp: opp as OpponentController, modifiers: { phantomStep: true }, enemyHp: 5, heroHp: 2 });
    m.d.input({ type: 'dodge', t: CUE + 100 }); // before any miss: refused in CUE? CUE is always allowed, so this is an early attempt
    expect(dodges(m)[0].result).toBe('early');
    const n = make({ opp: opp as OpponentController, modifiers: { phantomStep: true }, enemyHp: 5, heroHp: 2 });
    n.d.input({ type: 'draw', t: CUE + 300 });
    n.d.input({ type: 'dodge', t: CUE + 430 }); // AIM, phantom not armed yet: ignored
    expect(n.d.snapshot().ignoredInputs).toBe(1);
    n.d.advanceTo(CUE + 560); // shot 0 (miss) at ~CUE+ 450+...; hero now holds the phantom state
    expect(n.d.snapshot().dodge.phantom).toBe(true);
    expect(n.d.snapshot().dodge.available).toBe(true);
    // shot 1 comes 650 enemy-ms later: slow-mo makes that ~1857 real ms; the budget (600 ms) autofires first, so dodge inside SHOT/AIM when open
    let t = CUE + 560;
    while (t < CUE + 6000 && !n.d.snapshot().dodge.open && n.d.currentPhase !== 'RESOLVE') { t += 5; n.d.advanceTo(t); }
    expect(n.d.snapshot().dodge.open).toBe(true);
    const left = n.d.snapshot().aimRemainingMs;
    n.d.input({ type: 'dodge', t });
    expect(dodges(n)[dodges(n).length - 1]?.success).toBe(true);
    if (left !== null) expect(n.d.snapshot().aimRemainingMs).toBe(left); // free
    const without = make({ opp: opp as OpponentController, enemyHp: 5, heroHp: 2 });
    without.d.input({ type: 'draw', t: CUE + 300 });
    without.d.advanceTo(CUE + 560);
    expect(without.d.snapshot().dodge.phantom).toBe(true); // the state exists, only the perk lets AIM use it
    expect(without.d.snapshot().dodge.available).toBe(without.d.currentPhase === 'SHOT' || without.d.currentPhase === 'CUE');
  });

  it('a limb shot that disarms voids a pending dodge for the old shot without a cost', () => {
    const m = make({ opp: new Windowed(250, 450) as OpponentController, modifiers: { dodgeWhileAiming: true, tumbleBudgetCost: 0 }, enemyHp: 5, heroHp: 3 });
    m.d.input({ type: 'draw', t: CUE + 300 });
    m.d.advanceTo(CUE + 425);
    m.d.input({ type: 'dodge', t: CUE + 430 });
    expect(m.d.snapshot().dodge.committed).toBe(true);
    m.d.input({ type: 'fire', t: CUE + 440, x: LIMB.x, y: LIMB.y }); // disarm: shot 0 cancelled
    expect(m.d.snapshot().dodge.committed).toBe(false);
    expect(m.d.snapshot().dodge.stumbleMs).toBe(0);
    m.d.advanceTo(CUE + 8000);
    expect(m.d.lastResult?.dodges ?? 0).toBe(0);
  });
});

describe('dodge: determinism and invariants', () => {
  it('same seed + input log (with dodges) => identical result, replay equals live', () => {
    const log: DuelInput[] = [
      { type: 'hold', t: 0 }, { type: 'dodge', t: 500 }, { type: 'dodge', t: SHOT0 - 120, dir: 'left' }, { type: 'fire', t: SHOT0 - 60, x: HEAD.x, y: HEAD.y },
      { type: 'aim', t: SHOT0 + 200, x: BODY.x, y: BODY.y }, { type: 'dodge', t: SHOT0 + 300 }, { type: 'fire', t: SHOT0 + 400, x: BODY.x, y: BODY.y },
    ];
    const params: DuelParams = { seed: 7, opponent: new Fixed(), audio: quietAudio, enemyHp: 2, modifiers: { dodgeGuaranteesCrit: true, dodgeCloudBlocksShot: true } };
    const live = new DuelSystem(params);
    for (const e of log) live.input(e);
    live.advanceTo(20000);
    const a = replayDuel(params, live.inputLog, 20000);
    const b = replayDuel(params, live.inputLog, 20000);
    expect(a.snapshot()).toEqual(live.snapshot());
    expect(b.lastResult).toEqual(a.lastResult);
    expect(live.lastResult?.dodges).toBeGreaterThanOrEqual(1);
  });

  it('exactly one resolution per attempt with dodges, and retry resets the dodge state', () => {
    const m = make({ heroHp: 1 });
    m.d.input({ type: 'dodge', t: CUE + 100 }); // early: stumble
    m.d.advanceTo(SHOT0 + 1);
    expect(m.ev.onResolve).toHaveLength(1);
    expect(m.d.lastResult).toMatchObject({ outcome: 'LOSE', dodgeFails: 1, dodges: 0 });
    m.d.advanceTo(SHOT0 + 400);
    m.d.input({ type: 'retry', t: SHOT0 + 400 });
    const s = m.d.snapshot();
    expect(s.dodge).toMatchObject({ committed: false, stumbleMs: 0, phantom: false, available: false });
    m.d.advanceTo(SHOT0 + 400 + 8000);
    expect(m.ev.onResolve).toHaveLength(2);
  });
});

describe('InputSystem: horizontal dodge flick', () => {
  const D = DUEL_CONFIG.dodge.input;
  const path = (dx: number, dy: number, ms: number, n = 6) => Array.from({ length: n + 1 }, (_, i) => ({ x: 180 + (dx * i) / n, y: 500 + (dy * i) / n, t: (ms * i) / n }));
  it('recognises left and right flicks and nothing else', () => {
    expect(recognizeHorizontal(path(80, 0, 150), D)?.dir).toBe('right');
    expect(recognizeHorizontal(path(-80, 5, 150), D)?.dir).toBe('left');
    expect(recognizeHorizontal(path(0, -90, 150), D)).toBeNull(); // the draw flick is not a dodge
    expect(recognizeHorizontal(path(0, 90, 150), D)).toBeNull();
    expect(recognizeHorizontal(path(60, -60, 150), D)).toBeNull(); // diagonals belong to neither
  });
  it('is faster and longer than a reticle drag: a slow drag and a short nudge are not dodges', () => {
    expect(recognizeHorizontal(path(80, 0, 900), D)).toBeNull();
    expect(recognizeHorizontal(path(25, 0, 40), D)).toBeNull();
  });
  it('the draw flick (up) is never also a dodge, and a dodge flick is never also a draw', () => {
    const up = path(10, -100, 150);
    const side = path(100, 0, 150);
    expect(recognizeSwipe(up, 'up', DUEL_CONFIG.input)).not.toBeNull();
    expect(recognizeHorizontal(up, D)).toBeNull();
    expect(recognizeSwipe(side, 'up', DUEL_CONFIG.input)).toBeNull();
  });
  it('SwipeTracker("horizontal") follows the pointer-id and reanchor rules of the draw tracker', () => {
    const t = new SwipeTracker('horizontal', D);
    t.begin(100, 500, 0, 7);
    expect(t.move(200, 500, 50, 9)).toBeNull(); // a second finger is ignored
    expect(t.move(100, 500, 20, 7)).toBeNull();
    const s = t.move(190, 500, 90, 7);
    expect(s?.dir).toBe('right');
    expect(t.move(260, 500, 120, 7)).toBeNull(); // once per gesture
    t.reanchor(260, 500, 130);
    expect(t.move(170, 500, 200, 7)?.dir).toBe('left');
  });
});
