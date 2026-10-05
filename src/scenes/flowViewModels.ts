// Pure mappers from game state (RunSystem / PerkSystem / EconomySystem) to the UI view models (src/ui/types.ts).
// No Phaser, no randomness: unit-tested in tests/flowViewModels.test.ts.
import { ITEM_DEFS } from '../data/events';
import { PERK_BY_ID } from '../data/perks';
import type { PerkDef, PerkTag, Rarity as PerkRarity } from '../data/perks';
import type { IconKind, IconRef, PerkCardVM, PerkChipVM, Rarity, ShopItemVM } from '../ui/types';
import type { ShopOfferView } from '../systems/RunSystem';
import { baseId } from '../systems/PerkSystem';

export const TAG_ICON: Record<PerkTag, IconKind> = {
  DRAW: 'draw', AIM: 'aim', DODGE: 'dodge', COIN: 'coin', LUCK: 'luck', LIFE: 'life', CURSE: 'lock',
};

/** Perk rarity -> UI rarity. Cursed perks read as RARE (they are only ever sold in the shop's curse slot). */
export function uiRarity(r: PerkRarity): Rarity {
  return r === 'legend' ? 'legendary' : r === 'common' ? 'common' : 'rare';
}

export function perkIcon(def: PerkDef): IconRef {
  return { kind: TAG_ICON[def.tags[0] ?? 'LUCK'] };
}

/** Cuts text to at most `max` chars at a word boundary, ending in "..." (the reward card fits ~57 chars). */
export function blurb(text: string, max = 57): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 3);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.5 ? cut.slice(0, sp) : cut).replace(/[,;:\s-]+$/, '')}...`;
}

/** First sentence when it fits, else a clipped blurb. */
export function shortDescription(text: string, max = 57): string {
  const first = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return blurb(first.length <= max ? first : text, max);
}

export function perkCard(perkId: string, tier2 = false): PerkCardVM {
  const def = PERK_BY_ID[baseId(perkId)];
  if (!def) return { id: perkId, name: perkId.toUpperCase(), description: '', rarity: 'common' };
  return {
    id: baseId(perkId),
    name: def.name + (tier2 ? ' +' : ''),
    description: shortDescription(def.description),
    rarity: uiRarity(def.rarity),
    tag: def.tags[0],
    icon: perkIcon(def),
  };
}

export function perkChip(perkId: string): PerkChipVM {
  const def = PERK_BY_ID[baseId(perkId)];
  if (!def) return { id: perkId, name: perkId, rarity: 'common' };
  return { id: def.id, name: def.name + (perkId.endsWith('+') ? ' +' : ''), rarity: uiRarity(def.rarity), icon: perkIcon(def) };
}

/** Service entries the shop adds next to the offers. */
export const SERVICE_HEAL = 'svc:heal';
export const SERVICE_CURSE_PREFIX = 'svc:curse:';

export interface ShopServices {
  healPrice: number;
  canHeal: boolean;
  /** Owned curse perk ids and the price of removing one. */
  curses: string[];
  removeCursePrice: number;
}

export function shopItems(offers: readonly ShopOfferView[], services: ShopServices): ShopItemVM[] {
  const items: ShopItemVM[] = offers.map((o) => {
    if (o.kind === 'item' && o.itemId) {
      const def = ITEM_DEFS[o.itemId];
      return { id: o.id, name: def?.name.toUpperCase() ?? o.name, description: def?.description ?? '', kind: 'item', price: o.price, icon: { kind: o.itemId === 'tonic' ? 'life' : 'draw' } };
    }
    const def = o.perkId ? PERK_BY_ID[o.perkId] : undefined;
    if (!def) return { id: o.id, name: '???', description: 'AN UNKNOWN CURSE. BUY AT YOUR OWN RISK.', kind: 'perk', price: o.price, rarity: 'rare', icon: { kind: 'lock' } };
    return { id: o.id, name: def.name, description: shortDescription(def.description, 60), kind: 'perk', price: o.price, rarity: uiRarity(def.rarity), icon: perkIcon(def) };
  });
  if (services.canHeal) items.push({ id: SERVICE_HEAL, name: 'PATCH UP', description: 'RESTORE 1 LIFE.', kind: 'service', price: services.healPrice, icon: { kind: 'life' } });
  const curse = services.curses[0];
  if (curse) {
    const def = PERK_BY_ID[curse];
    items.push({ id: `${SERVICE_CURSE_PREFIX}${curse}`, name: `LIFT ${def?.name ?? 'CURSE'}`.toUpperCase(), description: 'REMOVE THIS CURSE FOR GOOD.', kind: 'service', price: services.removeCursePrice, icon: { kind: 'lock' } });
  }
  return items;
}

/** Plank label of a map choice: "DUEL: BANDIT", "ELITE: BOUNTY HUNTER", "BOSS: MAD DOG MCGRAW". */
export function choiceLabel(type: string, name?: string): string {
  const kind = { duel: 'DUEL', elite: 'ELITE', boss: 'BOSS', shop: 'SHOP', event: 'EVENT', rest: 'REST', treasure: 'TREASURE' }[type] ?? type.toUpperCase();
  return name && (type === 'duel' || type === 'elite' || type === 'boss') ? `${kind}: ${name.toUpperCase()}` : kind;
}

export interface OutcomeLike {
  blocked?: string | null;
  coinsDelta: number;
  hpDelta: number;
  reputationDelta?: number;
  buffs: Record<string, number>;
  grantPerks: string[];
  grantItems: string[];
  upgradePerk: string | null;
  startDuel: unknown;
}

/** Lines under an event result ("+$30", "-1 LIFE", "GOT TONIC"). */
export function outcomeLines(o: OutcomeLike): string[] {
  const out: string[] = [];
  if (o.blocked) return ['YOU CANNOT AFFORD THAT.'];
  if (o.coinsDelta > 0) out.push(`+$${o.coinsDelta}`);
  if (o.coinsDelta < 0) out.push(`-$${-o.coinsDelta}`);
  if (o.hpDelta > 0) out.push(`+${o.hpDelta} LIFE`);
  if (o.hpDelta < 0) out.push(`${o.hpDelta} LIFE`);
  for (const p of o.grantPerks) out.push(`PERK: ${PERK_BY_ID[baseId(p)]?.name ?? p}`);
  for (const i of o.grantItems) out.push(`GOT ${ITEM_DEFS[i]?.name ?? i}`);
  if (o.upgradePerk) out.push(`UPGRADED ${PERK_BY_ID[baseId(o.upgradePerk)]?.name ?? o.upgradePerk}`);
  if (Object.keys(o.buffs).length) out.push('A GOOD FEELING: NEXT DUEL');
  if (o.startDuel) out.push('TROUBLE!');
  return out;
}
