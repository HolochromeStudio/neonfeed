import { describe, it, expect } from 'vitest';
import { startRun, restoreRun, RunError, RUN_TUNING, type RunDuelResult, type RunSystem } from '../src/systems/RunSystem';

const win = (hp: number, extra: Partial<RunDuelResult> = {}): RunDuelResult => ({ outcome: 'WIN', heroHp: hp, tier: 'good', ...extra });

/** Enter the first duel-type node of the current choices. */
function enterDuel(run: RunSystem, type: 'duel' | 'elite' | 'boss' = 'duel'): void {
  const pick = run.getChoices().find((c) => c.type === type);
  if (!pick) throw new Error(`no ${type} node among choices`);
  run.enterNode(pick.id);
}

/** Walk (always the first choice, winning every duel at full hp) until a node of `type` is a choice. */
function walkTo(run: RunSystem, type: 'elite' | 'boss'): void {
  for (let guard = 0; guard < 80; guard++) {
    const ch = run.getChoices();
    if (ch.some((c) => c.type === type)) return;
    const pick = ch.find((c) => c.type === 'duel') ?? ch[0];
    run.enterNode(pick.id);
    if (pick.type === 'duel' || pick.type === 'elite' || pick.type === 'boss') { run.completeDuel(win(run.getDuel().heroHp)); run.applyReward({ skip: true }); }
    else if (pick.type === 'shop' || pick.type === 'treasure' || pick.type === 'rest') run.leaveNode();
    else { const ev = run.getEvent(); const out = run.chooseEvent(ev.costs.findIndex((c) => c === 0) === -1 ? 0 : ev.costs.findIndex((c) => c === 0)); if (out.startDuel) { run.completeDuel(win(run.getDuel().heroHp)); run.applyReward({}); } else run.leaveNode(); }
  }
  throw new Error(`never reached ${type}`);
}

describe('rerollReward never drives coins or the reward negative', () => {
  it('pays from the purse first, then from the pending reward; refuses when both together fall short', () => {
    const run = startRun(31, { startCoins: 0, regions: ['dust_creek'] });
    enterDuel(run);
    run.completeDuel(win(run.getDuel().heroHp));
    const before = run.getReward()!;
    expect(before.rerollCost).toBe(RUN_TUNING.rerollBase);
    expect(before.coins).toBeGreaterThanOrEqual(RUN_TUNING.rerollBase);
    expect(run.getCoins()).toBe(0);
    run.rerollReward();
    expect(run.getCoins()).toBe(0);
    expect(run.getReward()!.coins).toBe(before.coins - RUN_TUNING.rerollBase);
    // keep rerolling until it is refused: coins and reward stay >= 0 the whole way
    let refused = false;
    for (let i = 0; i < 6; i++) {
      try { run.rerollReward(); } catch (e) { expect(e).toBeInstanceOf(RunError); refused = true; break; }
      expect(run.getCoins()).toBeGreaterThanOrEqual(0);
      expect(run.getReward()!.coins).toBeGreaterThanOrEqual(0);
    }
    expect(refused).toBe(true);
    run.applyReward({ skip: true });
    expect(run.getCoins()).toBeGreaterThanOrEqual(0);
  });
  it('spends held coins first and leaves the reward untouched when the purse covers the cost', () => {
    const run = startRun(31, { startCoins: 100, regions: ['dust_creek'] });
    enterDuel(run);
    run.completeDuel(win(run.getDuel().heroHp));
    const before = run.getReward()!;
    run.rerollReward();
    expect(run.getCoins()).toBe(100 - RUN_TUNING.rerollBase);
    expect(run.getReward()!.coins).toBe(before.coins);
  });
});

describe('nodeKind getter', () => {
  it('names the screen of the current node and is null on the map', () => {
    const run = startRun(5, { regions: ['dust_creek'] });
    expect(run.nodeKind()).toBeNull();
    const seen = new Set<string>();
    for (let i = 0; i < 40 && run.phase !== 'over'; i++) {
      const ch = run.getChoices();
      const pick = ch.find((c) => c.type === 'duel') ?? ch[0];
      const r = run.enterNode(pick.id);
      const k = run.nodeKind();
      seen.add(String(k));
      if (pick.type === 'duel' || pick.type === 'elite' || pick.type === 'boss') { expect(k).toBe('duel'); expect(typeof r).toBe('object'); run.completeDuel(win(run.getDuel().heroHp)); run.applyReward({ skip: true }); }
      else if (pick.type === 'event') { expect(k).toBe('event'); const ev = run.getEvent(); const out = run.chooseEvent(Math.max(0, ev.costs.findIndex((c) => c === 0))); if (out.startDuel) { run.completeDuel(win(run.getDuel().heroHp)); run.applyReward({}); } else run.leaveNode(); }
      else { expect(k).toBe(pick.type); run.leaveNode(); }
      expect(run.nodeKind()).toBeNull();
    }
    expect(seen.has('duel') && seen.has('shop')).toBe(true);
  });
});

describe('boss pay (A18 #15)', () => {
  const bossPay = (perks: string[]): number => {
    const run = startRun(9, { regions: ['dust_creek'], startPerks: perks });
    walkTo(run, 'boss');
    enterDuel(run, 'boss');
    run.completeDuel(win(run.getDuel().heroHp));
    return run.getReward()!.coins;
  };
  it("Bounty Hunter's creed (elite x2, duel x0.5) does not multiply boss pay; Blood Money still doubles it", () => {
    const base = bossPay([]);
    expect(bossPay(['bounty_hunter_creed'])).toBe(base);
    expect(bossPay(['blood_money'])).toBeGreaterThanOrEqual(base * 2 - 1);
  });
});

describe('Tin Star is a once-per-region, elite-or-boss shield (D15)', () => {
  const consumedOf = (run: RunSystem): string[] => (run.serialize().map as { state: { consumed: string[] } }).state.consumed;
  it('never arms a standard duel, arms the boss, and is spent by it', () => {
    const run = startRun(12, { regions: ['dust_creek', 'canyon'], startPerks: ['tin_star'] });
    enterDuel(run);
    expect(run.getDuel().modifiers.ignoreFirstHits).toBe(0);
    run.completeDuel(win(run.getDuel().heroHp));
    run.applyReward({ skip: true });
    expect(consumedOf(run)).not.toContain('tin_star@0');
    walkTo(run, 'boss');
    enterDuel(run, 'boss');
    expect(run.getDuel().modifiers.ignoreFirstHits).toBe(1);
    run.completeDuel(win(run.getDuel().heroHp, { hitsIgnored: 1 }));
    expect(consumedOf(run)).toContain('tin_star@0');
  });
  it('a boss duel where the shield did not trigger (hitsIgnored 0) leaves it armed for a refight', () => {
    const run = startRun(12, { regions: ['dust_creek'], startPerks: ['tin_star'] });
    walkTo(run, 'boss');
    enterDuel(run, 'boss');
    const hp = run.getDuel().heroHp;
    const out = run.completeDuel({ outcome: 'LOSE', heroHp: Math.max(1, hp - 1), hitsIgnored: 0 });
    expect(out.status).toBe('refight');
    expect(run.getDuel().modifiers.ignoreFirstHits).toBe(1);
    run.completeDuel({ outcome: 'LOSE', heroHp: Math.max(1, hp - 1), hitsIgnored: 1 });
    expect(run.getDuel().modifiers.ignoreFirstHits).toBe(0); // spent: the refight is unshielded
  });
  it('without hitsIgnored in the result an armed duel counts as spending the shield (never invulnerable)', () => {
    const run = startRun(12, { regions: ['dust_creek'], startPerks: ['tin_star'] });
    walkTo(run, 'boss');
    enterDuel(run, 'boss');
    const hp = run.getDuel().heroHp;
    run.completeDuel({ outcome: 'LOSE', heroHp: Math.max(1, hp - 1) });
    expect(run.getDuel().modifiers.ignoreFirstHits).toBe(0);
  });
  it('tier 2 gives every boss its own shield and the spent state survives save and restore', () => {
    const run = startRun(14, { regions: ['dust_creek'], startPerks: ['tin_star+'] });
    walkTo(run, 'boss');
    enterDuel(run, 'boss');
    const hp = run.getDuel().heroHp;
    run.completeDuel({ outcome: 'LOSE', heroHp: Math.max(1, hp - 1), hitsIgnored: 1 });
    expect(run.getDuel().modifiers.ignoreFirstHits).toBe(1); // spent region shield, but the boss re-arms at tier 2
    const back = restoreRun(JSON.parse(JSON.stringify(run.serialize())));
    expect(consumedOf(back)).toContain('tin_star@0');
    expect(back.getDuel().modifiers.ignoreFirstHits).toBe(1);
  });
});
