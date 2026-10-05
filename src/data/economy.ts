/**
 * Economy data (A09). One currency: coins (D3). Dependency-free typed data.
 * Meta progress unlocks OPTIONS (sidegrades, regions, looks), never raw power.
 * Numbers are starting values for A18 to tune; docs/ECONOMY.md documents the target curve.
 */

export type ItemKind = 'weapon' | 'charm' | 'character' | 'region' | 'cosmetic' | 'saloon';
export type Tier = 1 | 2 | 3 | 4;

export interface Requirement {
  /** Other catalogue items that must be owned first. */
  items?: string[];
  /** Minimum values of meta.stats keys (see STAT_KEYS). */
  stats?: Record<string, number>;
}

export interface CatalogItem {
  id: string;
  kind: ItemKind;
  name: string;
  desc: string;
  /** Coin price. Only starters may cost 0. */
  price: number;
  tier: Tier;
  /** Owned from the first launch; never purchasable. */
  starter?: boolean;
  /** Content not shipped yet: cannot be bought, excluded from pacing. */
  staged?: boolean;
  requires?: Requirement;
}

/** Saloon level needed to buy an item of tier t (tier 1 needs none). */
export const saloonLevelForTier = (t: Tier): number => t - 1;

const item = (
  kind: ItemKind, id: string, name: string, tier: Tier, price: number, desc: string,
  extra: Partial<CatalogItem> = {},
): CatalogItem => ({ id, kind, name, desc, price, tier, ...extra });

export const CATALOG: CatalogItem[] = [
  // --- Saloon upgrade flow: each level opens the next item tier ---
  item('saloon', 'saloon_1', 'Saloon: Back Room', 1, 250, 'Opens tier-2 stock at the hub.', { requires: { stats: { runs: 3 } } }),
  item('saloon', 'saloon_2', 'Saloon: Upstairs Parlour', 2, 600, 'Opens tier-3 stock at the hub.', { requires: { items: ['saloon_1'], stats: { runs: 12 } } }),
  item('saloon', 'saloon_3', 'Saloon: Gilded Hall', 3, 1500, 'Opens tier-4 stock at the hub.', { requires: { items: ['saloon_2'], stats: { runs: 25 } } }),

  // --- Weapons (sidegrades with a trade-off, not damage upgrades) ---
  item('weapon', 'peacemaker', 'Peacemaker', 1, 0, 'The trusty starter revolver.', { starter: true }),
  item('weapon', 'lawman_special', "Lawman's Special", 1, 80, 'Longer aim budget, slower draw recovery.'),
  item('weapon', 'hand_cannon', 'Hand Cannon', 2, 320, 'Fewer shots per duel, staggers on body hits.'),
  item('weapon', 'derringer_pair', 'Derringer Pair', 3, 800, 'Two quick shots, wide spread, no headshot bonus.'),
  item('weapon', 'golden_colt', 'Golden Colt', 4, 1800, 'Showpiece sidearm; Perfect Draws pay a few extra coins.', { requires: { stats: { bosses_defeated: 6 } } }),

  // --- Charms (loadout slot; each changes a rule or a risk) ---
  item('charm', 'rabbit_foot', "Rabbit's Foot", 1, 130, 'Offers show one extra reroll per shop.'),
  item('charm', 'bullet_necklace', 'Bullet Necklace', 1, 150, 'Start each run with a free consumable.'),
  item('charm', 'brass_compass', 'Brass Compass', 2, 340, 'Map shows the next node type.'),
  item('charm', 'silver_spur', 'Silver Spur', 2, 380, 'First flinch of a run costs nothing.'),
  item('charm', 'widows_locket', "Widow's Locket", 3, 850, 'Revive once per run with 1 life, but lose half your coins.'),
  item('charm', 'devils_tooth', "Devil's Tooth", 4, 2000, 'Cursed perks appear more often and pay better.', { requires: { stats: { bosses_defeated: 6 } } }),

  // --- Characters (starting kit variants) ---
  item('character', 'gunslinger', 'The Gunslinger', 1, 0, 'Default hero kit.', { starter: true }),
  item('character', 'drifter', 'The Drifter', 1, 150, 'Starts with a COIN perk, one fewer life.'),
  item('character', 'outlaw_belle', 'Outlaw Belle', 2, 360, 'Starts with a DODGE perk and no sidearm bonus.', { requires: { stats: { perfect_draws: 25 } } }),
  item('character', 'old_marshal', 'The Old Marshal', 3, 900, 'Starts with a LIFE perk, slower aim budget.', { requires: { stats: { wins: 2 } } }),
  item('character', 'masked_rider', 'The Masked Rider', 4, 2000, 'Starts with a CURSE perk and a rare perk.', { requires: { stats: { bosses_defeated: 8 } } }),

  // --- Regions (also gated by beating the previous boss) ---
  item('region', 'dust_creek', 'Dust Creek', 1, 0, 'Frontier town. Where every legend starts.', { starter: true }),
  item('region', 'canyon', 'Canyon', 2, 400, 'Red cliffs and echoes.', { requires: { stats: { boss_mad_dog_mcgraw: 1 } } }),
  item('region', 'railroad', 'Railroad', 3, 900, 'Moving trains, swaying aim.', { requires: { items: ['canyon'], stats: { boss_the_undertaker: 1 } } }),
  item('region', 'saloon_interior', 'Saloon Interior', 4, 1800, 'Cover, bottles and Lady Luck.', { staged: true, requires: { items: ['railroad'] } }),
  item('region', 'goldspire', 'Goldspire', 4, 2200, 'Boomtown of big risks.', { staged: true, requires: { items: ['saloon_interior'] } }),
  item('region', 'widows_peak', "Widow's Peak", 4, 2600, 'Fog and gallows.', { staged: true, requires: { items: ['goldspire'] } }),
  item('region', 'blackwater_bay', 'Blackwater Bay', 4, 3000, 'Final waters. El Diablo waits.', { staged: true, requires: { items: ['widows_peak'] } }),

  // --- Cosmetics (pure looks, bought after gameplay options by most players) ---
  item('cosmetic', 'hat_black', 'Black Stetson', 1, 90, 'A darker brim.'),
  item('cosmetic', 'bandana_red', 'Red Bandana', 1, 80, 'Dust-proof and dramatic.'),
  item('cosmetic', 'holster_tooled', 'Tooled Holster', 1, 120, 'Hand-stamped leather.'),
  item('cosmetic', 'poncho_sand', 'Sand Poncho', 2, 220, 'Desert drifter look.'),
  item('cosmetic', 'spurs_gold', 'Gold Spurs', 2, 260, 'Chime louder than your conscience.'),
  item('cosmetic', 'gun_engraved', 'Engraved Revolver', 3, 500, 'Scrollwork on the cylinder.'),
  item('cosmetic', 'duster_coat', 'Long Duster', 3, 600, 'Trails in the wind.'),
  item('cosmetic', 'hat_white', 'White Stetson', 4, 1000, 'For the hero of the story.'),
].map((it) => {
  // Tier gating by saloon level is derived, not hand-written.
  if (it.kind === 'saloon' || it.starter) return it;
  const lvl = saloonLevelForTier(it.tier);
  if (lvl <= 0) return it;
  const items = [...(it.requires?.items ?? [])];
  const sid = `saloon_${lvl}`;
  if (!items.includes(sid)) items.push(sid);
  return { ...it, requires: { ...it.requires, items } };
});

const BY_ID: Record<string, CatalogItem> = Object.fromEntries(CATALOG.map((c) => [c.id, c]));
export const getItem = (id: string): CatalogItem | undefined => BY_ID[id];
export const itemsOfKind = (k: ItemKind): CatalogItem[] => CATALOG.filter((c) => c.kind === k);

/** meta.unlocks list that stores each kind. Saloon level lives in stats.saloon_level. */
export const UNLOCK_LIST: Record<Exclude<ItemKind, 'saloon'>, 'weapons' | 'charms' | 'characters' | 'regions' | 'cosmetics'> = {
  weapon: 'weapons', charm: 'charms', character: 'characters', region: 'regions', cosmetic: 'cosmetics',
};

/** Region ids in progression order, with the boss that ends each region. */
export const REGION_BOSS: Record<string, string> = {
  dust_creek: 'mad_dog_mcgraw', canyon: 'the_undertaker', railroad: 'the_undertaker',
  saloon_interior: 'lady_luck', goldspire: 'lady_luck', widows_peak: 'el_diablo', blackwater_bay: 'el_diablo',
};

// ---------------------------------------------------------------------------
// Stats written into meta.stats by settleRun / purchase. Dynamic families end in `_`.
// ---------------------------------------------------------------------------
export const STAT_KEYS = [
  'runs', 'wins', 'duels_won', 'perfect_draws', 'headshots', 'no_damage_duels',
  'bosses_defeated', 'coins_lifetime', 'coins_spent', 'saloon_level',
] as const;
export const STAT_PREFIXES = ['boss_', 'region_clear_', 'capture_'] as const;

// ---------------------------------------------------------------------------
// Run-end conversion: what carries from in-run coins to the saloon account.
// ---------------------------------------------------------------------------
export const RUN_END = {
  /** Fraction of in-run coins banked when the run ends in death. */
  bankRateDeath: 0.4,
  /** Fraction banked on victory (final boss cleared). */
  bankRateVictory: 0.5,
  /** One-time discovery reward for the first capture of each wanted poster, as a fraction of its reward. */
  firstCaptureRate: 0.15,
  firstCaptureCap: 300,
  /** Repeat capture (once per poster per run), fraction of poster reward. */
  repeatCaptureRate: 0.03,
  repeatCaptureCap: 40,
  /** Hard cap on one run's total bank so a bug or exploit cannot mint coins. */
  maxBankPerRun: 5000,
} as const;

// ---------------------------------------------------------------------------
// In-run shop prices (spent from the run's own coins, never from the meta account).
// ---------------------------------------------------------------------------
export type ShopItemId =
  | 'perk_common' | 'perk_rare' | 'perk_legend' | 'perk_cursed'
  | 'consumable' | 'heal' | 'remove_curse' | 'reroll' | 'retry';

export const SHOP_BASE: Record<ShopItemId, number> = {
  perk_common: 45, perk_rare: 90, perk_legend: 180, perk_cursed: 30,
  consumable: 30, heal: 40, remove_curse: 60, reroll: 12, retry: 30,
};

export const SHOP_RULES = {
  /** Price grows by this fraction per depth step (node index in the run). */
  depthGrowth: 0.06,
  maxDepthMult: 2,
  /** Each reroll in the same offer adds this many coins. */
  rerollStep: 8,
  rerollMax: 60,
  /** Retry cost = retry base + depth * retryPerDepth. One retry per node (game design section 2). */
  retryPerDepth: 15,
  maxDiscount: 0.7,
  /** Region multipliers on shop prices. */
  regionMult: { goldspire: 1.15 } as Record<string, number>,
} as const;

/** Sell value of a perk when dropped at rest (fraction of its base price). */
export const PERK_SELL_RATE = 0.4;
