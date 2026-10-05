import { describe, it, expect } from 'vitest';
import { defaultMeta, type MetaSave } from '../src/core/SaveManager';
import { Rng } from '../src/core/rng';
import { CATALOG } from '../src/data/economy';
import { availableItems, checkPurchase, purchase, type RunSummary } from '../src/systems/EconomySystem';
import { claimAll, settleRunWithBounties } from '../src/systems/BountySystem';

/** Simple player model: skill grows with practice; runs go region by region (7 nodes each, boss last). */
const REGIONS = ['dust_creek', 'canyon', 'railroad'];
const BOSS = ['mad_dog_mcgraw', 'the_undertaker', 'the_undertaker'];
const POOL = [
  ['rookie', 'bandit', 'drunk', 'coward', 'gunslinger'],
  ['bandit', 'gunslinger', 'sniper', 'sheriff', 'knife_thrower'],
  ['gunslinger', 'train_guard', 'horse_rider', 'dual_wielder', 'bounty_hunter'],
];

export function simRun(meta: MetaSave, i: number, rng: Rng): RunSummary {
  const skill = Math.min(0.95, 0.25 + i * 0.022);
  const open = Math.min(3, 1 + meta.unlocks.regions.length);
  const defeated: string[] = [];
  const cleared: string[] = [];
  let coins = 0, perfect = 0, head = 0, nodmg = 0, victory = false;
  outer: for (let r = 0; r < open; r++) {
    for (let n = 0; n < 7; n++) {
      const boss = n === 6;
      const pWin = Math.max(0.2, Math.min(0.97, skill + 0.35 - r * 0.12 - (boss ? 0.15 : 0) - n * 0.02));
      if (rng.next() > pWin) break outer;
      const id = boss ? BOSS[r] : rng.pick(POOL[r]);
      defeated.push(id);
      coins += boss ? 45 + 15 * r : 12 + 4 * r + rng.int(0, 6);
      if (rng.next() < skill * 0.45) perfect++;
      if (rng.next() < skill * 0.5) head++;
      if (rng.next() < skill * 0.35) nodmg++;
      if (boss) { cleared.push(REGIONS[r]); if (r === open - 1 && r === 2) victory = true; }
    }
  }
  return { coins, victory, defeated, regionsCleared: cleared, perfectDraws: perfect, headshots: head, noDamageDuels: nodmg, bestReactionMs: 300 - Math.floor(skill * 80) };
}

export interface SimLog { run: number; coins: number; bought: string[] }

/** Greedy player: buys the cheapest purchasable gameplay item (cosmetics ignored: they are optional sinks); claims board each run. */
export function simulate(n: number, seed = 1): { meta: MetaSave; log: SimLog[]; boughtAt: Record<string, number> } {
  const rng = new Rng(seed);
  let meta = defaultMeta();
  const log: SimLog[] = [];
  const boughtAt: Record<string, number> = {};
  for (let i = 1; i <= n; i++) {
    const day = `2026-01-${String(1 + ((i - 1) % 28)).padStart(2, '0')}`;
    meta = settleRunWithBounties(meta, simRun(meta, i - 1, rng), day);
    meta = claimAll(meta, day).meta;
    const bought: string[] = [];
    for (;;) {
      const opts = availableItems(meta).filter((c) => checkPurchase(meta, c.id).ok)
        .filter((c) => c.kind !== 'cosmetic').sort((a, b) => a.price - b.price);
      if (!opts.length) break;
      meta = purchase(meta, opts[0].id);
      bought.push(opts[0].id); boughtAt[opts[0].id] = i;
    }
    log.push({ run: i, coins: meta.coins, bought });
  }
  return { meta, log, boughtAt };
}

const gameplay = CATALOG.filter((c) => c.kind !== 'cosmetic' && !c.staged && !c.starter);
const tierDone = (boughtAt: Record<string, number>, t: number): number =>
  Math.max(...gameplay.filter((c) => c.tier === t).map((c) => boughtAt[c.id] ?? Infinity));

const median = (a: number[]): number => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

describe('curve sanity (simulated player, median over 15 seeds)', () => {
  const sims = Array.from({ length: 15 }, (_, k) => simulate(90, k + 1));
  const firsts = sims.map((s) => Math.min(...Object.values(s.boughtAt)));
  const tiers = [1, 2, 3, 4].map((t) => sims.map((s) => tierDone(s.boughtAt, t)));

  it('first meaningful unlock lands after about 2 runs (median 2..3, worst case <= 8)', () => {
    expect(median(firsts)).toBeGreaterThanOrEqual(2);
    expect(median(firsts)).toBeLessThanOrEqual(3);
    expect(Math.max(...firsts)).toBeLessThanOrEqual(8);
  });

  it('a full tier completes every ~10-15 runs (median gaps 8..18)', () => {
    const m = tiers.map(median);
    expect(m[0]).toBeGreaterThanOrEqual(8);
    expect(m[0]).toBeLessThanOrEqual(18);
    for (let t = 1; t < 3; t++) {
      expect(m[t] - m[t - 1]).toBeGreaterThanOrEqual(8);
      expect(m[t] - m[t - 1]).toBeLessThanOrEqual(18);
    }
  });

  it('even a lucky player is not done with tiers 1-3 before run 25', () => {
    expect(Math.min(...tiers[2])).toBeGreaterThan(25);
  });

  it('is deterministic per seed and never produces negative or fractional coins', () => {
    expect(simulate(40, 3).log).toEqual(simulate(40, 3).log);
    for (const s of sims) for (const l of s.log) { expect(l.coins).toBeGreaterThanOrEqual(0); expect(Number.isInteger(l.coins)).toBe(true); }
  });
});
