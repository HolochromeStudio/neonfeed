// Sample view-models for the UI preview (no game systems involved).
import { CATALOG } from '../../src/data/economy';
import { PERKS as PERK_DEFS } from '../../src/data/perks';
import type { MainMenuData, PerkCardVM, RewardData, ResultsData, RunSummaryVM, SettingsData, ShopData, ShopItemVM } from '../../src/ui/types';

// Real game data mapped to view-models (the Lead does the same mapping in-game).
const TAG_ICON: Record<string, 'draw' | 'dodge' | 'life' | 'coin' | 'luck' | 'aim'> = { DRAW: 'draw', AIM: 'aim', DODGE: 'dodge', LIFE: 'life', COIN: 'coin' };
const realCard = (id: string): PerkCardVM => {
  const d = PERK_DEFS.find((p) => p.id === id)!;
  const tag = d.tags[0];
  return { id: d.id, name: d.name, description: d.description, rarity: d.rarity === 'common' ? 'common' : d.rarity === 'rare' ? 'rare' : 'legendary', tag, icon: { kind: TAG_ICON[tag ?? ''] ?? 'star' } };
};
const longest = <T,>(xs: readonly T[], len: (x: T) => number, n: number): T[] => [...xs].sort((a, b) => len(b) - len(a)).slice(0, n);
const LONG_PERKS = longest(PERK_DEFS, (p) => p.description.length, 3).map((p) => realCard(p.id));
const LONG_NAMES = longest(PERK_DEFS, (p) => p.name.length, 3).map((p) => realCard(p.id));


export const PERKS: PerkCardVM[] = [
  { id: 'hair_trigger', name: 'Hair Trigger', description: 'Your first shot each duel draws 40 ms faster.', rarity: 'common', tag: 'DRAW', icon: { kind: 'draw' } },
  { id: 'dust_kick', name: 'Dust Kick', description: 'A perfect dodge blinds the enemy and blocks their next shot.', rarity: 'rare', tag: 'DODGE', icon: { kind: 'dodge' } },
  { id: 'tin_star', name: 'Tin Star of the Territory', description: 'Ignore the first hit you take in every region and keep going.', rarity: 'legendary', tag: 'LIFE', icon: { kind: 'life' } },
];

export const MENU: MainMenuData = { coins: 1240, hasRun: false };
export const MENU_RUN: MainMenuData = { coins: 1240, hasRun: true, runLabel: 'DUST CREEK 3/7' };

export const REWARD: RewardData = { title: 'CHOOSE A PERK', subtitle: 'DUEL 3 WON', coins: 120, cards: PERKS, rerollCost: 15, skipCoins: 20 };
export const REWARD_POOR: RewardData = { ...REWARD, coins: 5 };
export const REWARD_SEL: RewardData = { ...REWARD, selectedId: 'dust_kick' };
/** The three longest real perk descriptions in src/data/perks.ts. */
export const REWARD_LONG: RewardData = { ...REWARD, cards: LONG_PERKS, selectedId: LONG_PERKS[0]!.id };
/** The three longest real perk names. */
export const REWARD_NAMES: RewardData = { ...REWARD, cards: LONG_NAMES, selectedId: LONG_NAMES[0]!.id };

export const SHOP_ITEMS: ShopItemVM[] = [
  { id: 'luck', name: 'Lucky Horseshoe', description: 'Coin drops are 25 percent bigger.', kind: 'perk', price: 45, rarity: 'common', icon: { kind: 'luck' } },
  { id: 'aim', name: 'Steady Hand', description: 'Aim window lasts 80 ms longer.', kind: 'perk', price: 60, rarity: 'rare', icon: { kind: 'aim' } },
  { id: 'bandage', name: 'Bandage', description: 'Heal one heart right now.', kind: 'item', price: 30, icon: { kind: 'life' } },
  { id: 'star', name: 'Marshal Badge', description: 'Start every duel with a free dodge.', kind: 'perk', price: 140, rarity: 'legendary', icon: { kind: 'star' } },
  { id: 'cleanse', name: 'Remove Curse', description: 'Strip one curse from your hat.', kind: 'service', price: 40, icon: { kind: 'lock' }, sold: true },
];
export const SHOP: ShopData = { coins: 120, items: SHOP_ITEMS, rerollCost: 15 };
export const SHOP_POOR: ShopData = { coins: 42, items: SHOP_ITEMS, rerollCost: 15 };

const toShop = (d: { id: string; name: string; description: string; price: number; rarity: ShopItemVM['rarity'] }): ShopItemVM => ({ ...d, kind: 'perk', icon: { kind: 'star' } });
const LONG_SHOP: ShopItemVM[] = [
  ...longest(PERK_DEFS, (p) => p.description.length, 4).map((p, i) => toShop({ id: p.id, name: p.name, description: p.description, price: [45, 90, 180, 30][i]!, rarity: p.rarity === 'common' ? 'common' : p.rarity === 'rare' ? 'rare' : 'legendary' })),
  ...CATALOG.filter((c) => c.id === 'saloon_2' || c.id === 'widows_locket').map((c) => ({ id: c.id, name: c.name, description: c.desc, kind: 'service' as const, price: c.price, icon: { kind: 'lock' as const } })),
];
export const SHOP_LONG: ShopData = { coins: 1600, items: LONG_SHOP, rerollCost: 15 };

export const SETTINGS: SettingsData = { settings: { musicVol: 0.7, sfxVol: 0.8, haptics: true, reducedShake: false, handedness: 'right' } };
export const SETTINGS_ALT: SettingsData = { settings: { musicVol: 0.25, sfxVol: 1, haptics: false, reducedShake: true, handedness: 'left', tellAssist: true, captions: true } };

const SUMMARY_DEATH: RunSummaryVM = {
  outcome: 'death', targetId: 'sheriff', duelsWon: 6, bestReactionMs: 187, perfectDraws: 4, regionName: 'Canyon',
  causeLine: 'Shot while aiming', coinsEarned: 184,
  perks: [
    { id: 'a', name: 'Hair Trigger', rarity: 'common', icon: { kind: 'draw' } },
    { id: 'b', name: 'Dust Kick', rarity: 'rare', icon: { kind: 'dodge' } },
    { id: 'c', name: 'Tin Star', rarity: 'legendary', icon: { kind: 'life' } },
    { id: 'd', name: 'Horseshoe', rarity: 'common', icon: { kind: 'luck' } },
    { id: 'e', name: 'Steady', rarity: 'rare', icon: { kind: 'aim' } },
  ],
  bounties: [{ label: 'Perfect draw x3', progress: 2, goal: 3 }],
};
export const RESULTS_LONG: ResultsData = {
  summary: { ...SUMMARY_DEATH, targetId: 'dual_wielder', regionName: 'Blackwater Bay', causeLine: undefined, bounties: [{ label: 'Defeat a boss in Blackwater Bay without a hit', progress: 0, goal: 1 }, { label: 'Win 3 duels without taking damage', progress: 1, goal: 3 }] },
};
export const RESULTS_DEATH: ResultsData = { summary: SUMMARY_DEATH };
export const RESULTS_WIN: ResultsData = {
  canContinue: true,
  summary: { ...SUMMARY_DEATH, outcome: 'victory', targetId: 'mad_dog_mcgraw', causeLine: undefined, bestReactionMs: 164, coinsEarned: 1240, bounties: [{ label: 'Perfect draw x3', progress: 3, goal: 3 }, { label: 'No-hit win', progress: 0, goal: 1 }] },
};

export type VariantName = 'menu' | 'menu_run' | 'reward' | 'reward_poor' | 'reward_sel' | 'reward_long' | 'reward_names' | 'shop' | 'shop_poor' | 'shop_open' | 'shop_long' | 'shop_long_open' | 'results_death' | 'results_win' | 'results_long' | 'settings' | 'settings_alt';
export const VARIANTS: Record<VariantName, { scene: 'MainMenu' | 'Reward' | 'Shop' | 'Results' | 'Settings'; data: object; open?: number }> = {
  menu: { scene: 'MainMenu', data: MENU },
  menu_run: { scene: 'MainMenu', data: MENU_RUN },
  reward: { scene: 'Reward', data: REWARD },
  reward_poor: { scene: 'Reward', data: REWARD_POOR },
  reward_sel: { scene: 'Reward', data: REWARD_SEL },
  reward_long: { scene: 'Reward', data: REWARD_LONG },
  reward_names: { scene: 'Reward', data: REWARD_NAMES },
  shop: { scene: 'Shop', data: SHOP },
  shop_open: { scene: 'Shop', data: SHOP, open: 1 },
  shop_long: { scene: 'Shop', data: SHOP_LONG },
  shop_long_open: { scene: 'Shop', data: SHOP_LONG, open: 0 },
  shop_poor: { scene: 'Shop', data: SHOP_POOR },
  results_death: { scene: 'Results', data: RESULTS_DEATH },
  results_win: { scene: 'Results', data: RESULTS_WIN },
  results_long: { scene: 'Results', data: RESULTS_LONG },
  settings: { scene: 'Settings', data: SETTINGS },
  settings_alt: { scene: 'Settings', data: SETTINGS_ALT },
};
