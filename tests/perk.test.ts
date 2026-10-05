import { describe, it, expect } from 'vitest';
import { Rng } from '../src/core/rng';
import { PERKS, PERK_TAGS, RARITIES, neutralDuelModifiers, neutralRunRules } from '../src/data/perks';
import {
  composePerks, conflictsWith, duelConfigFor, heroHpFor, parseOwned, rarityWeights, rollPerkChoices,
  upgradePerk, canUpgrade, validatePerkTable, hexTagFor, baseId,
} from '../src/systems/PerkSystem';
import { DUEL_CONFIG } from '../src/data/duelConfig';

describe('perk table', () => {
  it('has 50+ perks, unique ids, valid rarity, tags and descriptions', () => {
    expect(PERKS.length).toBeGreaterThanOrEqual(50);
    expect(validatePerkTable()).toEqual([]);
    expect(new Set(PERKS.map((p) => p.id)).size).toBe(PERKS.length);
    for (const p of PERKS) {
      expect(RARITIES).toContain(p.rarity);
      expect(p.description.length).toBeGreaterThan(15);
      for (const t of p.tags) expect(PERK_TAGS).toContain(t);
    }
    expect(new Set(PERKS.map((p) => p.name)).size).toBe(PERKS.length);
  });
  it('covers every rarity and every tag', () => {
    for (const r of RARITIES) expect(PERKS.some((p) => p.rarity === r)).toBe(true);
    for (const t of PERK_TAGS) expect(PERKS.filter((p) => p.tags.includes(t)).length).toBeGreaterThanOrEqual(4);
  });
  it('every perk changes something (no empty patches, no bare stat bumps)', () => {
    for (const p of PERKS) {
      if (p.id === 'hex') continue;
      const patch = { ...(p.duel ?? {}), ...(p.run ?? {}) };
      expect(Object.keys(patch).length, p.id).toBeGreaterThan(0);
      expect(p.description, p.id).not.toMatch(/^[+-]?\d+%? /);
    }
  });
  it('synergy tags are shared by at least two perks; excludes reference real perks and none exclude themselves', () => {
    const counts = new Map<string, number>();
    for (const p of PERKS) for (const s of p.synergy) counts.set(s, (counts.get(s) ?? 0) + 1);
    for (const [s, c] of counts) expect(c, s).toBeGreaterThanOrEqual(2);
    const ids = new Set(PERKS.map((p) => p.id));
    for (const p of PERKS) for (const e of p.excludes ?? []) { expect(ids.has(e)).toBe(true); expect(e).not.toBe(p.id); }
  });
  it('support classification is set and today-perks name no missing system', () => {
    for (const p of PERKS) expect(['today', 'a02', 'a06']).toContain(p.support);
    for (const p of PERKS.filter((x) => x.support !== 'today')) expect(p.needs, p.id).toBeTruthy();
  });
});

const rarityOf = (id: string) => PERKS.find((p) => p.id === id)!.rarity;

describe('rollPerkChoices', () => {
  it('is deterministic per seed', () => {
    const a = rollPerkChoices(new Rng(5), ['hair_trigger'], 0, 3);
    const b = rollPerkChoices(new Rng(5), ['hair_trigger'], 0, 3);
    expect(a).toEqual(b);
  });
  it('never offers owned perks (any tier) or duplicates', () => {
    const owned = ['hair_trigger', 'quickdraw_scar+', 'tin_star', 'pathfinder'];
    const rng = new Rng(11);
    for (let i = 0; i < 2000; i++) {
      const offer = rollPerkChoices(rng, owned, (i % 5) / 4, 3);
      expect(new Set(offer).size).toBe(offer.length);
      for (const id of offer) expect(owned.map(baseId)).not.toContain(id);
      expect(offer.length).toBe(3);
    }
  });
  it('respects exclusions in both directions and between offers', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 1500; i++) {
      const offer = rollPerkChoices(rng, ['dead_eye'], 0.5, 3, { allowCursed: true });
      expect(offer).not.toContain('buckshot_rounds');
      for (let a = 0; a < offer.length; a++) for (let b = a + 1; b < offer.length; b++) expect(conflictsWith(offer[a], [offer[b]])).toBe(false);
    }
    const r2 = new Rng(4);
    for (let i = 0; i < 1500; i++) expect(rollPerkChoices(r2, ['quickdraw_scar'], 0, 3, { allowCursed: true })).not.toContain('devils_deal');
    // reverse direction: owning the curse removes the other perk
    const r3 = new Rng(8);
    for (let i = 0; i < 1500; i++) expect(rollPerkChoices(r3, ['glass_cannon'], 0, 3, { allowCursed: true })).not.toContain('tin_star');
  });
  it('does not offer cursed perks unless allowed; boss and elite offers are rare+', () => {
    const rng = new Rng(21);
    for (let i = 0; i < 1000; i++) for (const id of rollPerkChoices(rng, [], 0, 3)) expect(PERKS.find((p) => p.id === id)!.rarity).not.toBe('cursed');
    for (let i = 0; i < 500; i++) for (const id of rollPerkChoices(rng, [], 0, 3, { minRarity: 'rare', bossBoost: true })) {
      expect(['rare', 'legend']).toContain(PERKS.find((p) => p.id === id)!.rarity);
    }
    for (const id of rollPerkChoices(rng, [], 0, 1, { allowCursed: true, onlyRarity: 'cursed' })) expect(PERKS.find((p) => p.id === id)!.rarity).toBe('cursed');
  });
  it('last slot is an off-tag wildcard when the player holds tags', () => {
    const owned = ['hair_trigger', 'cold_open']; // DRAW + AIM held
    const rng = new Rng(77);
    let offTag = 0;
    for (let i = 0; i < 500; i++) {
      const offer = rollPerkChoices(rng, owned, 0, 3);
      const last = PERKS.find((p) => p.id === offer[2])!;
      if (!last.tags.some((t) => t === 'DRAW' || t === 'AIM')) offTag++;
    }
    expect(offTag).toBe(500);
  });
  it('about 30% of non-wildcard slots favour held tags', () => {
    const owned = ['hair_trigger']; // DRAW, AIM
    const rng = new Rng(9);
    let on = 0, total = 0;
    for (let i = 0; i < 4000; i++) {
      const offer = rollPerkChoices(rng, owned, 0, 3);
      for (const id of offer.slice(0, 2)) { total++; if (PERKS.find((p) => p.id === id)!.tags.some((t) => t === 'DRAW' || t === 'AIM')) on++; }
    }
    // baseline share of DRAW/AIM perks in the pool is already high, so the forced share only raises it
    expect(on / total).toBeGreaterThan(0.45);
  });
  it('rarity distribution over 10k rolls follows the weights', () => {
    const rng = new Rng(1234);
    const n = 10_000;
    const c: Record<string, number> = { common: 0, rare: 0, legend: 0, cursed: 0 };
    for (let i = 0; i < n; i++) c[rarityOf(rollPerkChoices(rng, [], 0, 1)[0])]++;
    const w = rarityWeights(0);
    const sum = w.common + w.rare + w.legend;
    expect(c.cursed).toBe(0);
    expect(c.common / n).toBeGreaterThan((w.common / sum) * 0.93);
    expect(c.common / n).toBeLessThan((w.common / sum) * 1.07);
    expect(c.rare / n).toBeGreaterThan((w.rare / sum) * 0.9);
    expect(c.rare / n).toBeLessThan((w.rare / sum) * 1.1);
    expect(c.legend).toBeGreaterThan(100);
    expect(c.legend).toBeLessThan(700);
    expect(c.common).toBeGreaterThan(c.rare);
    expect(c.rare).toBeGreaterThan(c.legend);
  });
  it('rarity luck shifts weight toward rare and legend', () => {
    const count = (luck: number) => {
      const rng = new Rng(55); let hi = 0;
      for (let i = 0; i < 6000; i++) if (rarityOf(rollPerkChoices(rng, [], luck, 1)[0]) !== 'common') hi++;
      return hi;
    };
    expect(count(0.8)).toBeGreaterThan(count(0) * 1.3);
    expect(count(-0.8)).toBeLessThan(count(0));
  });
  it('returns fewer only when the pool is exhausted', () => {
    const all = PERKS.filter((p) => p.rarity !== 'cursed').map((p) => p.id);
    expect(rollPerkChoices(new Rng(1), all, 0, 3)).toEqual([]);
  });
});

describe('composition', () => {
  it('no perks = neutral modifiers', () => {
    const c = composePerks([]);
    expect(c.duel).toEqual(neutralDuelModifiers());
    expect(c.run).toEqual(neutralRunRules());
  });
  it('multiplies, adds, ORs and takes min overrides', () => {
    const c = composePerks(['quickdraw_scar', 'disarmer', 'glass_cannon']);
    expect(c.duel.perfectWindowMult).toBe(2);
    expect(c.duel.aimBudgetMult).toBeCloseTo(0.75);
    expect(c.duel.maxDisarmsDelta).toBe(1);
    expect(c.duel.oneHitKill).toBe(true);
    expect(c.duel.heroHpOverride).toBe(1);
    const devil = composePerks(['quickdraw_scar', 'devils_deal']);
    expect(devil.duel.perfectWindowMult).toBe(6);
  });
  it('tier 2 adds a second effect', () => {
    expect(composePerks(['quickdraw_scar']).duel.aimPenaltyIgnoredOnPerfect).toBe(false);
    expect(composePerks(['quickdraw_scar+']).duel.aimPenaltyIgnoredOnPerfect).toBe(true);
    expect(composePerks(['pathfinder']).run.mapLookaheadDelta).toBe(1);
    expect(composePerks(['pathfinder+']).run.mapLookaheadDelta).toBe(2);
  });
  it('conditional perks only apply when their condition holds', () => {
    expect(composePerks(['matador'], { enemyId: 'sniper' }).duel.dodgeWindowMult).toBe(1);
    expect(composePerks(['matador'], { enemyId: 'knife_thrower' }).duel.dodgeWindowMult).toBe(2);
    expect(composePerks(['tell_reader'], { firstDuelOfRegion: false }).duel.tellCueLeadMs).toBe(0);
    expect(composePerks(['tell_reader'], { firstDuelOfRegion: true }).duel.tellCueLeadMs).toBe(80);
    expect(composePerks(['tell_reader+'], { elite: true }).duel.tellCueLeadMs).toBe(80);
    expect(composePerks(['iron_skin'], { enemyId: 'knife_thrower' }).duel.enemyDamageMult).toBe(0);
    expect(composePerks(['iron_skin'], { enemyId: 'bandit' }).duel.enemyDamageMult).toBe(1);
  });
  it('once-per-run perks switch off when consumed', () => {
    expect(composePerks(['revive_flask']).duel.reviveCharges).toBe(1);
    const c = composePerks(['revive_flask'], { consumed: ['revive_flask'] });
    expect(c.duel.reviveCharges).toBe(0);
    expect(c.disabled).toContain('revive_flask');
  });
  it('Hex doubles the most-held tag and disables the rest', () => {
    const owned = ['hair_trigger', 'cold_open', 'tin_star', 'hex']; // DRAW x2 (+AIM x1, LIFE x1)
    expect(hexTagFor(owned)).toBe('DRAW');
    const c = composePerks(owned);
    expect(c.disabled).toContain('tin_star');
    expect(c.duel.ignoreFirstHits).toBe(0);
    expect(c.duel.perfectStaggers).toBe(true);
    const bb = composePerks(['bullet_belt', 'tin_star', 'hex']);
    expect(bb.hexTag).toBe('LIFE');
    expect(bb.duel.heroHpDelta).toBe(2);
    expect(bb.duel.ignoreFirstHits).toBe(2);
  });
  it('buffs compose and unknown buffs throw', () => {
    expect(composePerks([], { buffs: { focus: 1 } }).duel.perfectWindowMult).toBeCloseTo(1.3);
    expect(composePerks([], { buffs: { lucky: 99 } }).buffLuck).toBeGreaterThan(0);
    expect(() => composePerks([], { buffs: { nope: 1 } })).toThrow();
  });
  it('duelConfigFor patches DuelConfig without mutating the base', () => {
    const before = JSON.stringify(DUEL_CONFIG);
    const cfg = duelConfigFor(composePerks(['quickdraw_scar', 'reflex_tonic', 'bullet_belt', 'disarmer', 'mad_dogs_collar']).duel);
    expect(cfg.draw.perfectMs).toBe(440);
    expect(cfg.draw.flinchPenaltyMs).toBe(0);
    expect(cfg.aim.budgetMs).toBe(450);
    expect(cfg.damage.heroHp).toBe(4);
    expect(cfg.damage.enemyDamage).toBe(2);
    expect(cfg.fairness.maxDisarms).toBe(DUEL_CONFIG.fairness.maxDisarms + 1);
    expect(JSON.stringify(DUEL_CONFIG)).toBe(before);
    const g = composePerks(['glass_cannon']).duel;
    expect(duelConfigFor(g).damage.baseDamage).toBe(99);
    expect(heroHpFor(g)).toBe(1);
  });
  it('upgrade helpers', () => {
    expect(canUpgrade(['hair_trigger'], 'hair_trigger')).toBe(true);
    expect(canUpgrade(['hair_trigger+'], 'hair_trigger')).toBe(false);
    expect(canUpgrade([], 'hair_trigger')).toBe(false);
    expect(upgradePerk(['a_none', 'hair_trigger'].slice(1), 'hair_trigger')).toEqual(['hair_trigger+']);
    expect(parseOwned(['x', 'y+'])).toEqual([{ id: 'x', tier: 1 }, { id: 'y', tier: 2 }]);
    expect(() => upgradePerk(['glass_cannon'], 'glass_cannon')).toThrow();
  });
});
