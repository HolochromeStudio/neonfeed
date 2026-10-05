/**
 * Event effect resolver (A08). Every `effectKey` in dialogue.ts RANDOM_EVENTS has exactly one handler here;
 * an unknown key throws (never silently ignored). Resolution is pure: it reads the state it is given and
 * returns an EventOutcome; RunSystem applies it. All randomness comes from the passed Rng (D4).
 */
import { Rng } from '../core/rng';
import { RANDOM_EVENTS, type RandomEvent } from './dialogue';
import { PERKS, PERK_BY_ID } from './perks';

/** Consumable items (shop / events / Tip Jar). Not perks, so they never enter perk offers. */
export const ITEM_DEFS: Record<string, { name: string; description: string; heal?: number; buff?: string; price: number }> = {
  tonic: { name: 'Tonic', description: 'Restore 1 life.', heal: 1, price: 25 },
  flask: { name: 'Flask', description: 'Next duel: Perfect window +30%.', buff: 'focus', price: 20 },
};
export const ITEM_IDS = Object.keys(ITEM_DEFS);

/** Coin sizes for events; RunSystem multiplies by the region coin multiplier. */
export const COIN_SIZE = { small: 15, medium: 30, large: 60 } as const;
export const HP_SIZE = { small: 1, medium: 2 } as const;

export interface EventState {
  hp: number;
  maxHp: number;
  coins: number;
  /** Owned perk ids (with tier suffix). */
  perks: readonly string[];
  /** Perk ids that may be upgraded right now (computed by RunSystem). */
  upgradable: readonly string[];
  /** Region reward multiplier. */
  coinScale: number;
  /** Rules from composePerks: only the field the resolver needs. */
  eventHpLossBlock: number;
}

export interface EventOutcome {
  effectKey: string;
  /** `cannot_afford` = nothing was applied; the UI should have disabled the choice (see getEffectCost). */
  blocked: 'cannot_afford' | null;
  coinsDelta: number;
  /** Net life change AFTER Body Shield; RunSystem clamps to [1, maxHp] (events never kill). */
  hpDelta: number;
  reputationDelta: number;
  /** buff id -> duels remaining (99 = until the region ends). */
  buffs: Record<string, number>;
  grantPerks: string[];
  grantItems: string[];
  upgradePerk: string | null;
  /** Forces a duel right now (the Fight option of an ambush). */
  startDuel: { enemyId: string; bonusCoins: number } | null;
  /** Free-form flags RunSystem stores: `ambush_next`, `gunsmith_quest`, `nothing_to_upgrade`. */
  flags: string[];
}

export interface ResolveCtx {
  rng: Rng;
  state: EventState;
}

type Handler = (c: ResolveCtx, o: EventOutcome) => void;

const coins = (c: ResolveCtx, size: keyof typeof COIN_SIZE) => Math.round(COIN_SIZE[size] * c.state.coinScale);

/** Applies hp loss through Body Shield; returns the loss that actually lands. */
function loseHp(c: ResolveCtx, o: EventOutcome, n: number): void {
  const blocked = Math.min(n, c.state.eventHpLossBlock);
  o.hpDelta -= n - blocked;
}
const gainCoins = (o: EventOutcome, n: number) => { o.coinsDelta += n; };
const loseCoinsUpTo = (c: ResolveCtx, o: EventOutcome, n: number) => { o.coinsDelta -= Math.min(n, c.state.coins + o.coinsDelta); };

/** Random common perk the player can take (not owned, no conflict), or null. */
function commonPerkId(c: ResolveCtx): string | null {
  const owned = new Set(c.state.perks.map((p) => (p.endsWith('+') ? p.slice(0, -1) : p)));
  const pool = PERKS.filter((p) => p.rarity === 'common' && !owned.has(p.id) &&
    !c.state.perks.some((o) => {
      const q = PERK_BY_ID[o.endsWith('+') ? o.slice(0, -1) : o];
      return !!q && ((p.excludes?.includes(q.id) ?? false) || (q.excludes?.includes(p.id) ?? false));
    }));
  return pool.length ? c.rng.pick(pool).id : null;
}

function gainRandomItem(c: ResolveCtx, o: EventOutcome): void {
  // half the time a common perk, otherwise a consumable; falls back to coins when the pool is dry
  if (c.rng.next() < 0.5) {
    const id = commonPerkId(c);
    if (id) { o.grantPerks.push(id); return; }
  }
  o.grantItems.push(c.rng.pick(ITEM_IDS));
}

function upgradeOne(c: ResolveCtx, o: EventOutcome): boolean {
  if (c.state.upgradable.length === 0) { o.flags.push('nothing_to_upgrade'); return false; }
  o.upgradePerk = c.rng.pick(c.state.upgradable);
  return true;
}

const HANDLERS: Record<string, Handler> = {
  none: () => {},
  heal_small_gain_coins_small: (c, o) => { o.hpDelta += HP_SIZE.small; gainCoins(o, coins(c, 'small')); },
  gain_coins_medium_lose_reputation: (c, o) => { gainCoins(o, coins(c, 'medium')); o.reputationDelta -= 1; },
  pay_15_buff_focus: (_c, o) => { o.coinsDelta -= 15; o.buffs.focus = 1; },
  buff_focus_small: (c, o) => { if (c.rng.next() < 0.6) o.buffs.focus = 1; },
  coinflip_coins_small: (c, o) => { if (c.rng.next() < 0.5) gainCoins(o, coins(c, 'small')); else loseCoinsUpTo(c, o, coins(c, 'small')); },
  cheat_gamble_coins_large: (c, o) => {
    if (c.rng.next() < 0.6) gainCoins(o, coins(c, 'large'));
    else { loseCoinsUpTo(c, o, coins(c, 'small')); loseHp(c, o, HP_SIZE.small); o.reputationDelta -= 1; }
  },
  gain_item_random_common: (c, o) => { gainRandomItem(c, o); if (c.rng.next() < 0.25) loseHp(c, o, HP_SIZE.small); },
  gain_item_random_common_safe: (c, o) => { gainRandomItem(c, o); },
  gain_coins_medium_bounty_risk: (c, o) => { gainCoins(o, coins(c, 'medium')); if (c.rng.next() < 0.5) o.flags.push('ambush_next'); },
  gain_reputation_small: (_c, o) => { o.reputationDelta += 1; },
  pay_10_heal_medium: (_c, o) => { o.coinsDelta -= 10; o.hpDelta += HP_SIZE.medium; },
  heal_small: (_c, o) => { o.hpDelta += HP_SIZE.small; },
  pay_5_buff_luck: (_c, o) => { o.coinsDelta -= 5; o.buffs.lucky = 99; },
  gain_coins_small_debuff_luck: (c, o) => { gainCoins(o, coins(c, 'small')); o.buffs.unlucky = 99; },
  pay_20: (_c, o) => { o.coinsDelta -= 20; },
  start_duel_bandit_bonus: (c, o) => { o.startDuel = { enemyId: 'bandit', bonusCoins: coins(c, 'medium') }; },
  lose_hp_small: (c, o) => { loseHp(c, o, HP_SIZE.small); },
  gain_coins_large_lose_hp_small: (c, o) => { gainCoins(o, coins(c, 'large')); loseHp(c, o, HP_SIZE.small); },
  gain_coins_small: (c, o) => { gainCoins(o, coins(c, 'small')); },
  buff_awareness: (_c, o) => { o.buffs.awareness = 1; },
  lose_hp_small_gain_coins_small: (c, o) => { loseHp(c, o, HP_SIZE.small); gainCoins(o, coins(c, 'small')); },
  gain_coins_medium_lose_hp_small: (c, o) => { gainCoins(o, coins(c, 'medium')); loseHp(c, o, HP_SIZE.small); },
  pay_30_upgrade_weapon: (c, o) => { if (upgradeOne(c, o)) o.coinsDelta -= 30; },
  upgrade_weapon_small_quest: (c, o) => { if (upgradeOne(c, o)) o.flags.push('gunsmith_quest'); else o.buffs.focus = 1; },
};

/** Coins the choice costs up front; the UI disables the choice when the player cannot pay. */
export const EFFECT_COST: Readonly<Record<string, number>> = {
  pay_15_buff_focus: 15, pay_10_heal_medium: 10, pay_5_buff_luck: 5, pay_20: 20, pay_30_upgrade_weapon: 30,
};

export const KNOWN_EFFECT_KEYS: readonly string[] = Object.keys(HANDLERS);

export function getEffectCost(effectKey: string): number {
  if (!(effectKey in HANDLERS)) throw new Error(`Unknown event effectKey: ${effectKey}`);
  return EFFECT_COST[effectKey] ?? 0;
}

const blankOutcome = (effectKey: string): EventOutcome => ({
  effectKey, blocked: null, coinsDelta: 0, hpDelta: 0, reputationDelta: 0, buffs: {}, grantPerks: [], grantItems: [],
  upgradePerk: null, startDuel: null, flags: [],
});

/** Resolve one effect. Throws on an unknown key. Consumes rng; use previewEffect to look without consuming. */
export function resolveEffect(effectKey: string, c: ResolveCtx): EventOutcome {
  const h = HANDLERS[effectKey];
  if (!h || !Object.prototype.hasOwnProperty.call(HANDLERS, effectKey)) throw new Error(`Unknown event effectKey: ${effectKey}`);
  const o = blankOutcome(effectKey);
  const cost = EFFECT_COST[effectKey] ?? 0;
  if (cost > c.state.coins) { o.blocked = 'cannot_afford'; return o; }
  h(c, o);
  return o;
}

/** The exact outcome resolveEffect would produce now, without advancing the caller's rng (Lucky Charm). */
export function previewEffect(effectKey: string, c: ResolveCtx): EventOutcome {
  const copy = new Rng(0);
  copy.setState(c.rng.getState());
  return resolveEffect(effectKey, { rng: copy, state: c.state });
}

export function getEventDef(id: string): RandomEvent {
  const e = RANDOM_EVENTS.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown event id: ${id}`);
  return e;
}

/** Seeded event pick that avoids `seen` ids until the pool is exhausted. */
export function pickEvent(rng: Rng, seen: readonly string[]): RandomEvent {
  let pool = RANDOM_EVENTS.filter((e) => !seen.includes(e.id));
  if (pool.length === 0) pool = RANDOM_EVENTS;
  return rng.pick(pool);
}
