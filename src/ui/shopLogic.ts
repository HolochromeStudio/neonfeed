// Pure shop-state helpers (no Phaser): label and enabled state of the BUY plank.
import { canAfford, needsConfirm } from './buttonLogic';
import type { ShopItemVM } from './types';
import { S } from './strings';

export interface BuyState { label: string; enabled: boolean; reason: 'none' | 'select' | 'sold' | 'poor' | 'confirm' | 'ready' }

export function buyButtonState(item: ShopItemVM | undefined, coins: number, armedId: string | null): BuyState {
  if (!item) return { label: S.shop.pickItem, enabled: false, reason: 'select' };
  if (item.sold) return { label: S.shop.soldOut, enabled: false, reason: 'sold' };
  if (!canAfford(coins, item.price)) return { label: `NEED $${item.price - Math.max(0, Math.trunc(coins))} MORE`, enabled: false, reason: 'poor' };
  if (needsConfirm(item.price) && armedId === item.id) return { label: `${S.shop.confirm} $${item.price}?`, enabled: true, reason: 'confirm' };
  return { label: `${S.shop.buy} $${item.price}`, enabled: true, reason: 'ready' };
}

/** Max rows: hit targets must stay >= 44 with an 8px gap in the 308px list viewport. */
export const SHOP_MAX_ITEMS = 6;
