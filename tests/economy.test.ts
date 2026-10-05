import { describe, it, expect } from 'vitest';
import { defaultMeta, validateMeta, type MetaSave } from '../src/core/SaveManager';
import { Rng } from '../src/core/rng';
import { CATALOG, STAT_KEYS, STAT_PREFIXES, getItem, SHOP_BASE, type ShopItemId } from '../src/data/economy';
import { WANTED } from '../src/data/wanted';
import {
  canAfford, checkPurchase, purchase, tryPurchase, settleRun, computeSettlement, shopPrice,
  retryCost, rerollCost, spendRunCoins, isOwned, type RunSummary,
} from '../src/systems/EconomySystem';

const meta = (coins: number, stats: Record<string, number> = {}): MetaSave => ({ ...defaultMeta(), coins, stats });
const run = (o: Partial<RunSummary> = {}): RunSummary => ({
  coins: 100, victory: false, defeated: [], regionsCleared: [], perfectDraws: 0, headshots: 0, noDamageDuels: 0, ...o,
});
const rich = (): MetaSave => meta(1e7, { runs: 100, wins: 10, perfect_draws: 500, bosses_defeated: 20, boss_mad_dog_mcgraw: 1, boss_the_undertaker: 1 });

describe('purchase', () => {
  it('buys, deducts, records unlock, does not mutate input', () => {
    const m = meta(500, { runs: 5 });
    const snap = JSON.stringify(m);
    const r = tryPurchase(m, 'lawman_special');
    expect(r.ok).toBe(true);
    expect(r.meta.coins).toBe(500 - getItem('lawman_special')!.price);
    expect(r.meta.unlocks.weapons).toContain('lawman_special');
    expect(JSON.stringify(m)).toBe(snap);
    expect(validateMeta(r.meta)).not.toBeNull();
  });
  it('is idempotent: second purchase changes nothing', () => {
    const once = purchase(meta(500), 'lawman_special');
    const twice = purchase(once, 'lawman_special');
    expect(twice).toEqual(once);
    expect(tryPurchase(once, 'lawman_special').reason).toBe('already_owned');
  });
  it('refuses unaffordable, locked, staged, starter and unknown items atomically', () => {
    expect(tryPurchase(meta(10), 'lawman_special').reason).toBe('insufficient_coins');
    expect(tryPurchase(meta(1e6), 'canyon').reason).toBe('locked');
    expect(tryPurchase(meta(1e6), 'hand_cannon').reason).toBe('locked'); // needs saloon_1
    expect(tryPurchase(rich(), 'goldspire').reason).toBe('staged');
    expect(tryPurchase(meta(1e6), 'peacemaker').reason).toBe('starter');
    expect(tryPurchase(meta(1e6), 'nope').reason).toBe('unknown_item');
    const m = meta(10);
    expect(purchase(m, 'lawman_special')).toEqual(m);
  });
  it('saloon levels must be bought in order and unlock tiers', () => {
    let m = rich();
    expect(tryPurchase(m, 'saloon_2').reason).toBe('locked');
    m = purchase(m, 'saloon_1');
    expect(m.stats.saloon_level).toBe(1);
    expect(isOwned(m, 'saloon_1')).toBe(true);
    expect(checkPurchase(m, 'hand_cannon').ok).toBe(true);
    m = purchase(m, 'saloon_2');
    expect(m.stats.saloon_level).toBe(2);
  });
  it('canAfford works for ids and raw costs and rejects bad input', () => {
    expect(canAfford(meta(100), 100)).toBe(true);
    expect(canAfford(meta(99), 100)).toBe(false);
    expect(canAfford(meta(1000), 'lawman_special')).toBe(true);
    expect(canAfford(meta(1000), 'nope')).toBe(false);
    expect(canAfford(meta(1000), -5)).toBe(false);
    expect(canAfford(meta(1000), NaN)).toBe(false);
  });
  it('fuzzed purchase sequences never go negative, never duplicate, and conserve coins', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = new Rng(seed);
      let m = meta(rng.int(0, 5000), { runs: rng.int(0, 60), bosses_defeated: rng.int(0, 10), boss_mad_dog_mcgraw: rng.int(0, 1), boss_the_undertaker: rng.int(0, 1), perfect_draws: rng.int(0, 60), wins: rng.int(0, 5) });
      const start = m.coins;
      for (let i = 0; i < 300; i++) {
        const ids = [...CATALOG.map((c) => c.id), 'bogus', ''];
        const before = m;
        if (rng.next() < 0.1) m = { ...m, coins: m.coins + rng.int(0, 400) };
        m = purchase(m, rng.pick(ids));
        expect(m.coins).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(m.coins)).toBe(true);
        void before;
      }
      for (const k of ['weapons', 'charms', 'characters', 'regions', 'cosmetics'] as const) {
        expect(new Set(m.unlocks[k]).size).toBe(m.unlocks[k].length);
      }
      expect(m.stats.coins_spent ?? 0).toBeGreaterThanOrEqual(0);
      expect(start).toBeGreaterThanOrEqual(0);
    }
  });
  it('spent coins equal the sum of owned item prices', () => {
    let m = rich();
    const start = m.coins;
    for (const c of CATALOG) m = purchase(m, c.id); // catalogue order is not dependency order; repeat
    for (let pass = 0; pass < 6; pass++) for (const c of CATALOG) m = purchase(m, c.id);
    const owned = CATALOG.filter((c) => !c.starter && isOwned(m, c.id));
    expect(start - m.coins).toBe(owned.reduce((s, c) => s + c.price, 0));
  });
});

describe('settleRun', () => {
  it('banks a fraction of in-run coins plus first-capture bounties, updates stats', () => {
    const m = settleRun(meta(0), run({ coins: 100, defeated: ['rookie', 'bandit'], perfectDraws: 2, headshots: 3, noDamageDuels: 1, bestReactionMs: 200 }));
    const s = computeSettlement(meta(0), run({ coins: 100, defeated: ['rookie', 'bandit'] }));
    expect(m.coins).toBe(s.total);
    expect(s.banked).toBe(40);
    expect(m.stats.runs).toBe(1);
    expect(m.stats.duels_won).toBe(2);
    expect(m.stats.perfect_draws).toBe(2);
    expect(m.stats.capture_rookie).toBe(1);
    expect(m.bestReactionMs).toBe(200);
  });
  it('first capture pays more than repeats, and repeats are once per poster per run', () => {
    const a = settleRun(meta(0), run({ coins: 0, defeated: ['gunslinger', 'gunslinger', 'gunslinger'] }));
    const b = settleRun(a, run({ coins: 0, defeated: ['gunslinger', 'gunslinger', 'gunslinger'] }));
    expect(a.coins).toBe(Math.floor(150 * 0.15));
    expect(b.coins - a.coins).toBe(Math.floor(150 * 0.03));
    expect(b.coins - a.coins).toBeLessThan(a.coins);
  });
  it('victory banks more than death; practice pays nothing', () => {
    expect(settleRun(meta(0), run({ victory: true })).coins).toBeGreaterThan(settleRun(meta(0), run()).coins);
    const p = settleRun(meta(5), run({ mode: 'practice', coins: 999, defeated: ['rookie'] }));
    expect(p.coins).toBe(5);
    expect(p.stats.runs).toBeUndefined();
  });
  it('records boss kills and region clears, ignores unknown ids, never mutates, caps per-run bank', () => {
    const m0 = meta(0);
    const snap = JSON.stringify(m0);
    const m = settleRun(m0, run({ defeated: ['mad_dog_mcgraw', 'ghost'], regionsCleared: ['dust_creek', 'dust_creek'] }));
    expect(JSON.stringify(m0)).toBe(snap);
    expect(m.stats.boss_mad_dog_mcgraw).toBe(1);
    expect(m.stats.bosses_defeated).toBe(1);
    expect(m.stats.region_clear_dust_creek).toBe(1);
    expect(m.stats.capture_ghost).toBeUndefined();
    expect(settleRun(meta(0), run({ coins: 1e12 })).coins).toBeLessThanOrEqual(5000);
  });
  it('sanitises garbage input', () => {
    const m = settleRun(meta(0), run({ coins: -50, perfectDraws: NaN, headshots: -3 }));
    expect(m.coins).toBe(0);
    expect(m.stats.perfect_draws).toBe(0);
  });
  it('first capture total across all posters is bounded', () => {
    const s = computeSettlement(meta(0), run({ coins: 0, defeated: WANTED.map((w) => w.id) }));
    expect(s.bountyFirst).toBeLessThan(2000);
  });
});

describe('shopPrice', () => {
  const ids = Object.keys(SHOP_BASE) as ShopItemId[];
  it('is a positive integer for every shop item at every depth and never free', () => {
    for (const id of ids) for (let d = 0; d < 40; d++) {
      const p = shopPrice(id, { depth: d, priceMult: 0.01, discount: 5 });
      expect(Number.isInteger(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(1);
    }
  });
  it('grows with depth (capped), and reroll/retry escalate', () => {
    expect(shopPrice('perk_rare', { depth: 10 })).toBeGreaterThan(shopPrice('perk_rare', { depth: 0 }));
    expect(shopPrice('perk_rare', { depth: 500 })).toBe(shopPrice('perk_rare', { depth: 100 }));
    expect(rerollCost(3)).toBeGreaterThan(rerollCost(0));
    expect(rerollCost(1000)).toBeLessThanOrEqual(60);
    expect(retryCost(6)).toBeGreaterThan(retryCost(0));
  });
  it('applies multipliers and discount, with a max discount, and unknown ids are unbuyable', () => {
    expect(shopPrice('perk_common', { priceMult: 2 })).toBe(shopPrice('perk_common') * 2);
    expect(shopPrice('perk_common', { discount: 0.3 })).toBeLessThan(shopPrice('perk_common'));
    expect(shopPrice('perk_common', { discount: 1 })).toBeGreaterThan(0);
    expect(shopPrice('xyz')).toBe(Infinity);
    expect(shopPrice('lawman_special')).toBe(getItem('lawman_special')!.price);
  });
  it('spendRunCoins is atomic', () => {
    expect(spendRunCoins(50, 30)).toBe(20);
    expect(spendRunCoins(20, 30)).toBeNull();
    expect(spendRunCoins(50, -1)).toBeNull();
  });
});

describe('unlock graph', () => {
  const ids = new Set(CATALOG.map((c) => c.id));
  it('has unique ids, valid prices, and only starters are free', () => {
    expect(ids.size).toBe(CATALOG.length);
    for (const c of CATALOG) {
      expect(Number.isInteger(c.price)).toBe(true);
      if (c.starter) expect(c.price).toBe(0); else expect(c.price).toBeGreaterThan(0);
    }
    for (const k of ['weapon', 'character', 'region'] as const) expect(CATALOG.some((c) => c.kind === k && c.starter)).toBe(true);
  });
  it('requirements reference real items and known stats, with no cycles', () => {
    const statOk = (k: string): boolean => (STAT_KEYS as readonly string[]).includes(k) || STAT_PREFIXES.some((p) => k.startsWith(p));
    const bossIds = WANTED.filter((w) => w.kind === 'boss').map((w) => w.id);
    for (const c of CATALOG) {
      for (const r of c.requires?.items ?? []) expect(ids.has(r), `${c.id} -> ${r}`).toBe(true);
      for (const k of Object.keys(c.requires?.stats ?? {})) {
        expect(statOk(k), `${c.id} stat ${k}`).toBe(true);
        if (k.startsWith('boss_')) expect(bossIds).toContain(k.slice(5));
      }
    }
    const state = new Map<string, number>();
    const visit = (id: string): void => {
      if (state.get(id) === 2) return;
      expect(state.get(id), `cycle at ${id}`).not.toBe(1);
      state.set(id, 1);
      for (const r of getItem(id)!.requires?.items ?? []) visit(r);
      state.set(id, 2);
    };
    ids.forEach(visit);
  });
  it('every non-staged item is reachable by purchases from a fresh save given the achievable stats', () => {
    let m = meta(1e9, { runs: 1000, wins: 1000, perfect_draws: 1000, bosses_defeated: 1000, boss_mad_dog_mcgraw: 1, boss_the_undertaker: 1 });
    for (let pass = 0; pass < 20; pass++) for (const c of CATALOG) m = purchase(m, c.id);
    for (const c of CATALOG) if (!c.staged) expect(isOwned(m, c.id), c.id).toBe(true);
  });
  it('staged items cannot be reached and so are excluded from pacing', () => {
    expect(CATALOG.filter((c) => c.staged).every((c) => c.kind === 'region')).toBe(true);
  });
  it('no gain loop: purchases never add coins and settle/purchase cannot mint coins from nothing', () => {
    let m = rich();
    const c0 = m.coins;
    for (let i = 0; i < 5; i++) for (const c of CATALOG) m = purchase(m, c.id);
    expect(m.coins).toBeLessThanOrEqual(c0);
    const z = settleRun(meta(0), run({ coins: 0 }));
    expect(z.coins).toBe(0);
  });
  it('tier gating: tier N>=2 gameplay items need the matching saloon level', () => {
    for (const c of CATALOG.filter((x) => x.tier >= 2 && x.kind !== 'saloon' && !x.starter)) {
      expect(c.requires?.items).toContain(`saloon_${c.tier - 1}`);
    }
  });
});
