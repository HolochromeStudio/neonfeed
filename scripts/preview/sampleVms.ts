// Sample view-models for the UI preview (no game systems involved).
import type { MainMenuData, PerkCardVM, RewardData, ResultsData, RunSummaryVM, ShopData, ShopItemVM } from '../../src/ui/types';

export const PERKS: PerkCardVM[] = [
  { id: 'hair_trigger', name: 'Hair Trigger', description: 'Your first shot each duel draws 40 ms faster.', rarity: 'common', tag: 'DRAW', icon: { kind: 'draw' } },
  { id: 'dust_kick', name: 'Dust Kick', description: 'A perfect dodge blinds the enemy and blocks their next shot.', rarity: 'rare', tag: 'DODGE', icon: { kind: 'dodge' } },
  { id: 'tin_star', name: 'Tin Star of the Territory', description: 'Ignore the first hit you take in every region and keep going.', rarity: 'legendary', tag: 'LIFE', icon: { kind: 'life' } },
];

export const MENU: MainMenuData = { coins: 1240, hasRun: false };
export const MENU_RUN: MainMenuData = { coins: 1240, hasRun: true, runLabel: 'DUST CREEK 3/7' };

export const REWARD: RewardData = { title: 'CHOOSE A PERK', subtitle: 'DUEL 3 WON', coins: 120, cards: PERKS, rerollCost: 15, skipCoins: 20 };
export const REWARD_POOR: RewardData = { ...REWARD, coins: 5 };

export const SHOP_ITEMS: ShopItemVM[] = [
  { id: 'luck', name: 'Lucky Horseshoe', description: 'Coin drops are 25 percent bigger.', kind: 'perk', price: 45, rarity: 'common', icon: { kind: 'luck' } },
  { id: 'aim', name: 'Steady Hand', description: 'Aim window lasts 80 ms longer.', kind: 'perk', price: 60, rarity: 'rare', icon: { kind: 'aim' } },
  { id: 'bandage', name: 'Bandage', description: 'Heal one heart right now.', kind: 'item', price: 30, icon: { kind: 'life' } },
  { id: 'star', name: 'Marshal Badge', description: 'Start every duel with a free dodge.', kind: 'perk', price: 140, rarity: 'legendary', icon: { kind: 'star' } },
  { id: 'cleanse', name: 'Remove Curse', description: 'Strip one curse from your hat.', kind: 'service', price: 40, icon: { kind: 'lock' }, sold: true },
];
export const SHOP: ShopData = { coins: 120, items: SHOP_ITEMS, rerollCost: 15 };
export const SHOP_POOR: ShopData = { coins: 42, items: SHOP_ITEMS, rerollCost: 15 };

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
export const RESULTS_DEATH: ResultsData = { summary: SUMMARY_DEATH };
export const RESULTS_WIN: ResultsData = {
  canContinue: true,
  summary: { ...SUMMARY_DEATH, outcome: 'victory', targetId: 'mad_dog_mcgraw', causeLine: undefined, bestReactionMs: 164, coinsEarned: 1240, bounties: [{ label: 'Perfect draw x3', progress: 3, goal: 3 }, { label: 'No-hit win', progress: 0, goal: 1 }] },
};

export type VariantName = 'menu' | 'menu_run' | 'reward' | 'reward_poor' | 'shop' | 'shop_poor' | 'results_death' | 'results_win';
export const VARIANTS: Record<VariantName, { scene: 'MainMenu' | 'Reward' | 'Shop' | 'Results'; data: object }> = {
  menu: { scene: 'MainMenu', data: MENU },
  menu_run: { scene: 'MainMenu', data: MENU_RUN },
  reward: { scene: 'Reward', data: REWARD },
  reward_poor: { scene: 'Reward', data: REWARD_POOR },
  shop: { scene: 'Shop', data: SHOP },
  shop_poor: { scene: 'Shop', data: SHOP_POOR },
  results_death: { scene: 'Results', data: RESULTS_DEATH },
  results_win: { scene: 'Results', data: RESULTS_WIN },
};
