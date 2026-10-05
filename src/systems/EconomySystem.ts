/**
 * EconomySystem (A09). Pure functions over MetaSave; never mutates inputs, no Phaser, no Date/Math.random.
 * One currency: coins (D3). Persist results with SaveManager.setMeta / updateMeta.
 */
import type { MetaSave } from '../core/SaveManager';
import { getWanted } from '../data/wanted';
import {
  CATALOG, PERK_SELL_RATE, RUN_END, SHOP_BASE, SHOP_RULES, UNLOCK_LIST,
  getItem, saloonLevelForTier,
  type CatalogItem, type ShopItemId,
} from '../data/economy';

export type PurchaseFailure =
  | 'unknown_item' | 'already_owned' | 'starter' | 'staged' | 'locked' | 'insufficient_coins';

export type PurchaseCheck =
  | { ok: true; price: number }
  | { ok: false; reason: PurchaseFailure; price?: number };

export interface PurchaseResult {
  ok: boolean;
  reason?: PurchaseFailure;
  meta: MetaSave;
  price: number;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const stat = (m: MetaSave, k: string): number => num(m.stats?.[k]);
const coinsOf = (m: MetaSave): number => Math.max(0, Math.floor(num(m.coins)));

export const saloonLevel = (m: MetaSave): number => Math.max(0, Math.floor(stat(m, 'saloon_level')));

export function isOwned(meta: MetaSave, itemId: string): boolean {
  const it = getItem(itemId);
  if (!it) return false;
  if (it.starter) return true;
  if (it.kind === 'saloon') return saloonLevel(meta) >= saloonLevelForTier(it.tier) + 1;
  return (meta.unlocks[UNLOCK_LIST[it.kind]] ?? []).includes(itemId);
}

/** Why an item is locked (requirements not met), or null when its requirements are satisfied. */
export function unmetRequirements(meta: MetaSave, it: CatalogItem): string[] {
  const out: string[] = [];
  for (const id of it.requires?.items ?? []) if (!isOwned(meta, id)) out.push(`item:${id}`);
  for (const [k, min] of Object.entries(it.requires?.stats ?? {})) if (stat(meta, k) < min) out.push(`stat:${k}>=${min}`);
  return out;
}

export function checkPurchase(meta: MetaSave, itemId: string): PurchaseCheck {
  const it = getItem(itemId);
  if (!it) return { ok: false, reason: 'unknown_item' };
  if (it.starter) return { ok: false, reason: 'starter' };
  if (isOwned(meta, itemId)) return { ok: false, reason: 'already_owned' };
  if (it.staged) return { ok: false, reason: 'staged', price: it.price };
  if (unmetRequirements(meta, it).length > 0) return { ok: false, reason: 'locked', price: it.price };
  if (coinsOf(meta) < it.price) return { ok: false, reason: 'insufficient_coins', price: it.price };
  return { ok: true, price: it.price };
}

/**
 * canAfford(meta, itemId): coins cover the catalogue price (does not check unlock conditions;
 * use checkPurchase for that). canAfford(meta, 40): coins cover a raw cost.
 */
export function canAfford(meta: MetaSave, itemOrCost: string | number): boolean {
  const cost = typeof itemOrCost === 'number' ? itemOrCost : getItem(itemOrCost)?.price;
  if (cost === undefined || !Number.isFinite(cost) || cost < 0) return false;
  return coinsOf(meta) >= cost;
}

/** Atomic purchase with a reason on failure. Input is never mutated; on failure `meta` is an unchanged copy. */
export function tryPurchase(meta: MetaSave, itemId: string): PurchaseResult {
  const chk = checkPurchase(meta, itemId);
  const next = clone(meta);
  if (!chk.ok) return { ok: false, reason: chk.reason, meta: next, price: chk.price ?? 0 };
  const it = getItem(itemId) as CatalogItem;
  next.coins = coinsOf(meta) - chk.price;
  next.stats = { ...next.stats, coins_spent: stat(meta, 'coins_spent') + chk.price };
  if (it.kind === 'saloon') {
    next.stats.saloon_level = Math.max(saloonLevel(meta), saloonLevelForTier(it.tier) + 1);
  } else {
    const list = UNLOCK_LIST[it.kind];
    next.unlocks = { ...next.unlocks, [list]: [...next.unlocks[list], itemId] };
  }
  return { ok: true, meta: next, price: chk.price };
}

/** Returns the new MetaSave (a deep copy equal to the input when the purchase is refused). */
export function purchase(meta: MetaSave, itemId: string): MetaSave {
  return tryPurchase(meta, itemId).meta;
}

/** Items the player can see in the saloon: not staged, not owned. Sorted by tier then price. */
export function availableItems(meta: MetaSave): CatalogItem[] {
  return CATALOG.filter((c) => !c.starter && !c.staged && !isOwned(meta, c.id))
    .sort((a, b) => a.tier - b.tier || a.price - b.price);
}

// ---------------------------------------------------------------------------
// Run settlement
// ---------------------------------------------------------------------------

export interface RunSummary {
  /** Coins held when the run ended (unspent). */
  coins: number;
  /** True when the final boss was beaten. */
  victory: boolean;
  /** Wanted ids (enemy or boss) defeated, one entry per duel won; repeats allowed. */
  defeated: string[];
  regionsCleared: string[];
  perfectDraws: number;
  headshots: number;
  noDamageDuels: number;
  bestReactionMs?: number | null;
  /** 'practice' pays nothing; 'daily' behaves like 'run'. */
  mode?: 'run' | 'daily' | 'practice';
}

export interface Settlement {
  banked: number;
  bountyFirst: number;
  bountyRepeat: number;
  total: number;
  firstCaptures: string[];
  bossesDefeated: string[];
}

const nn = (v: unknown): number => Math.max(0, Math.floor(num(v)));
const isBoss = (id: string): boolean => getWanted(id)?.kind === 'boss';

export function computeSettlement(meta: MetaSave, s: RunSummary): Settlement {
  const empty: Settlement = { banked: 0, bountyFirst: 0, bountyRepeat: 0, total: 0, firstCaptures: [], bossesDefeated: [] };
  if (s.mode === 'practice') return empty;
  const unique = [...new Set(s.defeated.filter((id) => getWanted(id)))];
  const rate = s.victory ? RUN_END.bankRateVictory : RUN_END.bankRateDeath;
  let banked = Math.floor(nn(s.coins) * rate);
  let first = 0, repeat = 0;
  const firstCaptures: string[] = [];
  for (const id of unique) {
    const reward = getWanted(id)?.reward ?? 0;
    if (stat(meta, `capture_${id}`) < 1) {
      first += Math.min(RUN_END.firstCaptureCap, Math.floor(reward * RUN_END.firstCaptureRate));
      firstCaptures.push(id);
    } else {
      repeat += Math.min(RUN_END.repeatCaptureCap, Math.floor(reward * RUN_END.repeatCaptureRate));
    }
  }
  let total = banked + first + repeat;
  if (total > RUN_END.maxBankPerRun) {
    const k = RUN_END.maxBankPerRun / total;
    banked = Math.floor(banked * k); first = Math.floor(first * k); repeat = Math.floor(repeat * k);
    total = banked + first + repeat;
  }
  return { banked, bountyFirst: first, bountyRepeat: repeat, total, firstCaptures, bossesDefeated: [...new Set(unique.filter(isBoss))] };
}

/** Bank a finished run into the saloon account and update lifetime stats. Pure; returns a new MetaSave. */
export function settleRun(meta: MetaSave, summary: RunSummary): MetaSave {
  const next = clone(meta);
  if (summary.mode === 'practice') return next;
  const st = computeSettlement(meta, summary);
  const bump = (k: string, by: number): void => { next.stats[k] = stat(next, k) + by; };
  next.coins = coinsOf(meta) + st.total;
  bump('coins_lifetime', st.total);
  bump('runs', 1);
  if (summary.victory) bump('wins', 1);
  bump('duels_won', summary.defeated.length);
  bump('perfect_draws', nn(summary.perfectDraws));
  bump('headshots', nn(summary.headshots));
  bump('no_damage_duels', nn(summary.noDamageDuels));
  bump('bosses_defeated', st.bossesDefeated.length);
  for (const id of st.bossesDefeated) next.stats[`boss_${id}`] = Math.max(1, stat(next, `boss_${id}`));
  for (const id of st.firstCaptures) next.stats[`capture_${id}`] = 1;
  for (const r of new Set(summary.regionsCleared)) next.stats[`region_clear_${r}`] = Math.max(1, stat(next, `region_clear_${r}`));
  const rt = summary.bestReactionMs;
  if (typeof rt === 'number' && Number.isFinite(rt) && rt > 0 && (next.bestReactionMs === null || rt < next.bestReactionMs)) {
    next.bestReactionMs = rt;
  }
  return next;
}

// ---------------------------------------------------------------------------
// In-run shop pricing (paid from run coins, not the meta account)
// ---------------------------------------------------------------------------

export interface ShopContext {
  /** Node index in the run, 0-based. */
  depth?: number;
  /** Rerolls already used on this offer. */
  rerollCount?: number;
  regionId?: string;
  /** Extra multiplier from perks/curses (e.g. 2 for Blood Money). Clamped to >= 0.1. */
  priceMult?: number;
  /** 0..1 discount from perks (e.g. 0.3). Clamped to the max discount. */
  discount?: number;
}

const round5 = (n: number): number => Math.max(5, Math.round(n / 5) * 5);

/**
 * Price in run coins. Accepts a ShopItemId or a catalogue id (meta price, no scaling).
 * Always an integer >= 1; never free. Unknown ids return Infinity so nothing is buyable by accident.
 */
export function shopPrice(itemId: string, ctx: ShopContext = {}): number {
  const cat = getItem(itemId);
  if (cat) return cat.price;
  if (!(itemId in SHOP_BASE)) return Infinity;
  const id = itemId as ShopItemId;
  const depth = nn(ctx.depth);
  const mult = Math.max(0.1, num(ctx.priceMult) || 1);
  const disc = Math.min(SHOP_RULES.maxDiscount, Math.max(0, num(ctx.discount)));
  const region = ctx.regionId ? SHOP_RULES.regionMult[ctx.regionId] ?? 1 : 1;
  const apply = (base: number): number => Math.max(1, Math.round(base * mult * region * (1 - disc)));
  if (id === 'retry') return apply(SHOP_BASE.retry + depth * SHOP_RULES.retryPerDepth);
  if (id === 'reroll') {
    return apply(Math.min(SHOP_RULES.rerollMax, SHOP_BASE.reroll + nn(ctx.rerollCount) * SHOP_RULES.rerollStep));
  }
  const depthMult = Math.min(SHOP_RULES.maxDepthMult, 1 + depth * SHOP_RULES.depthGrowth);
  return Math.max(1, round5(SHOP_BASE[id] * depthMult * mult * region * (1 - disc)));
}

export const retryCost = (depth: number, ctx: ShopContext = {}): number => shopPrice('retry', { ...ctx, depth });
export const rerollCost = (rerollCount: number, ctx: ShopContext = {}): number => shopPrice('reroll', { ...ctx, rerollCount });
export const perkSellValue = (rarity: 'common' | 'rare' | 'legend' | 'cursed'): number =>
  Math.floor(SHOP_BASE[`perk_${rarity}` as ShopItemId] * PERK_SELL_RATE);

/** Spend run coins. Returns the new balance, or null (unchanged) when unaffordable or invalid. */
export function spendRunCoins(runCoins: number, cost: number): number | null {
  if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(runCoins)) return null;
  const c = Math.floor(runCoins);
  return c >= cost ? c - cost : null;
}
