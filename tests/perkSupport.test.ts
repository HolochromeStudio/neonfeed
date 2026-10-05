import { describe, it, expect } from 'vitest';
import { Rng } from '../src/core/rng';
import { DUEL_CONFIG } from '../src/data/duelConfig';
import { PERKS, type PerkDef } from '../src/data/perks';
import { composePerks, rollPerkChoices } from '../src/systems/PerkSystem';

const RAW = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const strip = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
/** Every src/ file except the perk table itself, comments stripped (a key mentioned in a comment is not a consumer). */
const SRC_FILES = Object.entries(RAW)
  .filter(([p]) => !p.endsWith('/data/perks.ts'))
  .map(([path, text]) => ({ path, text: strip(text) }));
const SRC = SRC_FILES.map((f) => f.text).join('\n');

/**
 * Keys that are only mapped inside a helper (EnemyAISystem.opponentOptionsFromModifiers): a mapper nobody calls is not a
 * consumer, so the key counts only when some other file references the helper.
 */
const VIA_HELPER: Record<string, { file: string; symbol: string }> = Object.fromEntries(
  ['fakeTellEveryDuel', 'bluffFeint', 'baitEnabled', 'disarmDropsGun'].map((k) => [k, { file: 'EnemyAISystem.ts', symbol: 'opponentOptionsFromModifiers' }]),
);
const helperCalled = (h: { file: string; symbol: string }): boolean =>
  SRC_FILES.some((f) => !f.path.endsWith(h.file) && new RegExp(`\\b${h.symbol}\\b`).test(f.text));
const consumed = (key: string): boolean => {
  const via = VIA_HELPER[key];
  if (via) return helperCalled(via);
  return new RegExp(`\\b${key}\\b`).test(SRC);
};
const keysOf = (p: PerkDef): string[] => [
  ...Object.keys(p.duel ?? {}), ...Object.keys(p.duel2 ?? {}), ...Object.keys(p.run ?? {}), ...Object.keys(p.run2 ?? {}),
];

describe('perk support truth (D16)', () => {
  it("a 'ready' perk's modifier keys are all consumed somewhere in src/ (except declared `unwired`)", () => {
    for (const p of PERKS.filter((x) => x.support === 'ready')) {
      const unwired = new Set<string>(p.unwired ?? []);
      for (const k of keysOf(p)) if (!unwired.has(k)) expect(consumed(k), `${p.id}: nothing in src/ reads '${k}' (mark the perk pending or wire it)`).toBe(true);
    }
  });
  it('`unwired` stays honest: those keys really have no consumer, and only ready perks use it', () => {
    for (const p of PERKS) {
      if (p.support === 'pending') expect(p.unwired, p.id).toBeUndefined();
      for (const k of p.unwired ?? []) expect(consumed(k), `${p.id}: '${k}' is consumed now, remove it from unwired`).toBe(false);
    }
  });
  it("a 'pending' perk has a key with no consumer, or names the caller that must wire it (`blockedBy`)", () => {
    for (const p of PERKS.filter((x) => x.support === 'pending')) {
      expect(keysOf(p).some((k) => !consumed(k)) || !!p.blockedBy, `${p.id}: every key is consumed and nothing blocks it: make it ready`).toBe(true);
    }
  });
  it('dodge perks: the hooks A02 landed are ready, the rest stay pending with a reason', () => {
    for (const id of ['counter_roll', 'dust_kick', 'matador', 'tumble', 'phantom_step']) expect(PERKS.find((p) => p.id === id)!.support, id).toBe('ready');
    // Slip Away: coinPerDodge is paid by RunSystem, but GameFlow does not hand DuelResult.dodges over yet
    expect(PERKS.find((p) => p.id === 'slip_away')!.support).toBe('pending');
  });
  it('pending perks are never offered unless includePending is set', () => {
    const pending = new Set(PERKS.filter((p) => p.support === 'pending').map((p) => p.id));
    expect(pending.size).toBeGreaterThan(0);
    const rng = new Rng(77);
    for (let i = 0; i < 1500; i++) for (const id of rollPerkChoices(rng, [], (i % 5) / 4, 3, { allowCursed: i % 2 === 0 })) expect(pending.has(id), id).toBe(false);
    const seen = new Set<string>();
    const r2 = new Rng(78);
    for (let i = 0; i < 4000; i++) for (const id of rollPerkChoices(r2, [], 0.5, 3, { allowCursed: true, includePending: true })) seen.add(id);
    expect([...pending].filter((id) => seen.has(id)).length).toBeGreaterThan(pending.size / 2);
  });
});

describe('D15 perk re-pricing', () => {
  const inDuel = (owned: string[], ctx = {}) => composePerks(owned, ctx).duel;
  it('Tin Star is a once-per-region shield: spent shield turns it off, tier 2 re-arms it on bosses', () => {
    expect(inDuel(['tin_star'], { elite: true }).ignoreFirstHits).toBe(1);
    expect(inDuel(['tin_star'], { boss: true }).ignoreFirstHits).toBe(1);
    expect(inDuel(['tin_star'], { enemyId: 'bandit' }).ignoreFirstHits).toBe(0); // standard duels never get it
    expect(inDuel(['tin_star'], { elite: true, regionShield: false }).ignoreFirstHits).toBe(0);
    expect(inDuel(['tin_star'], { regionShield: false, boss: true }).ignoreFirstHits).toBe(0);
    expect(inDuel(['tin_star+'], { regionShield: false, boss: true }).ignoreFirstHits).toBe(1);
    expect(inDuel(['tin_star+'], { regionShield: false, elite: true }).ignoreFirstHits).toBe(0);
  });
  it('Bullet Belt (+1 life) is a legend tradeoff that cannot stack with Revive Flask', () => {
    const belt = PERKS.find((p) => p.id === 'bullet_belt')!;
    expect(belt.rarity).toBe('legend');
    expect(belt.excludes).toContain('revive_flask');
    expect(inDuel(['bullet_belt']).perfectWindowMult).toBeLessThan(1);
    expect(inDuel(['bullet_belt+']).perfectWindowMult).toBeGreaterThan(inDuel(['bullet_belt']).perfectWindowMult);
  });
  it("Mad Dog's Collar: every body shot one-shots a 6 hp boss, and every hit on you costs two lives", () => {
    const m = inDuel(['mad_dogs_collar']);
    expect(m.alwaysCrit).toBe(true);
    expect(m.critDamageMult * DUEL_CONFIG.damage.critMultiplier * DUEL_CONFIG.damage.baseDamage).toBeGreaterThanOrEqual(6);
    expect(m.enemyDamageMult).toBe(2);
  });
});
