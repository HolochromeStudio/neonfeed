import { describe, it, expect } from 'vitest';
import { PERKS } from '../src/data/perks';
import { blurb, choiceLabel, outcomeLines, perkCard, perkChip, shopItems, shortDescription, SERVICE_CURSE_PREFIX, SERVICE_HEAL } from '../src/scenes/flowViewModels';
import type { ShopOfferView } from '../src/systems/RunSystem';
import { glyphsSupported } from './flowBotGlyphs';

describe('view models', () => {
  it('blurb keeps short text, cuts long text at a word with an ellipsis, never over the limit', () => {
    expect(blurb('Short text.')).toBe('Short text.');
    for (const p of PERKS) {
      const b = blurb(p.description, 57);
      expect(b.length).toBeLessThanOrEqual(57);
      if (p.description.length > 57) expect(b.endsWith('...')).toBe(true);
    }
  });

  it('every perk card fits the reward card and uses only glyphs the pixel font has', () => {
    for (const p of PERKS) {
      const c = perkCard(p.id);
      expect(c.id).toBe(p.id);
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.description.length).toBeLessThanOrEqual(57);
      expect(['common', 'rare', 'legendary']).toContain(c.rarity);
      expect(c.icon?.kind).toBeTruthy();
      expect(glyphsSupported(c.name + c.description), p.id).toEqual([]);
    }
  });

  it('shortDescription prefers the first sentence', () => {
    expect(shortDescription('A Perfect Draw staggers the enemy for one beat. Extra.')).toBe('A Perfect Draw staggers the enemy for one beat.');
  });

  it('legend -> legendary, cursed -> rare', () => {
    expect(perkCard('showman').rarity).toBe('legendary');
    expect(perkCard('hex').rarity).toBe('rare');
    expect(perkChip('showman+').name).toContain('+');
  });

  it('shop items map offers and add the heal and curse-removal services', () => {
    const offers: ShopOfferView[] = [
      { id: 'p0', kind: 'perk', perkId: 'quickdraw_scar', itemId: null, name: 'Quickdraw Scar', price: 55, curse: false, hidden: false },
      { id: 'p1', kind: 'perk', perkId: null, itemId: null, name: '???', price: 20, curse: false, hidden: true },
      { id: 'i0', kind: 'item', perkId: null, itemId: 'tonic', itemId2: undefined, name: 'Tonic', price: 25, curse: false, hidden: false } as unknown as ShopOfferView,
    ];
    const items = shopItems(offers, { healPrice: 20, canHeal: true, curses: ['hex'], removeCursePrice: 25 });
    expect(items.map((i) => i.id)).toEqual(['p0', 'p1', 'i0', SERVICE_HEAL, `${SERVICE_CURSE_PREFIX}hex`]);
    expect(items[0]).toMatchObject({ kind: 'perk', rarity: 'rare', price: 55 });
    expect(items[1]!.name).toBe('???');
    expect(items[2]).toMatchObject({ kind: 'item', name: 'TONIC' });
    expect(items[3]).toMatchObject({ kind: 'service', price: 20 });
    expect(shopItems(offers, { healPrice: 20, canHeal: false, curses: [], removeCursePrice: 25 }).length).toBe(3);
  });

  it('choice labels', () => {
    expect(choiceLabel('duel', 'Bandit')).toBe('DUEL: BANDIT');
    expect(choiceLabel('boss', 'Mad Dog McGraw')).toBe('BOSS: MAD DOG MCGRAW');
    expect(choiceLabel('shop')).toBe('SHOP');
    expect(choiceLabel('rest', 'x')).toBe('REST');
  });

  it('outcome lines', () => {
    const base = { blocked: null, coinsDelta: 0, hpDelta: 0, buffs: {}, grantPerks: [], grantItems: [], upgradePerk: null, startDuel: null };
    expect(outcomeLines({ ...base, coinsDelta: 30, hpDelta: -1 })).toEqual(['+$30', '-1 LIFE']);
    expect(outcomeLines({ ...base, coinsDelta: -15, grantItems: ['tonic'] })).toEqual(['-$15', 'GOT Tonic']);
    expect(outcomeLines({ ...base, blocked: 'cannot_afford' })).toEqual(['YOU CANNOT AFFORD THAT.']);
    expect(outcomeLines({ ...base, startDuel: { enemyId: 'bandit' } })).toEqual(['TROUBLE!']);
  });
});
