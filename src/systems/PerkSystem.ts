/**
 * PerkSystem (A08): owned-perk encoding, offers, modifier composition. No Phaser, no Math.random.
 * Owned perks serialise as string[] (RunSave.perks): `id` = tier 1, `id+` = tier 2.
 */
import type { Rng } from '../core/rng';
import { DUEL_CONFIG, type DuelConfig } from '../data/duelConfig';
import {
  PERKS, PERK_BY_ID, PERK_TAGS, RARITIES, RARITY_WEIGHTS, RARITY_PRICE, SELL_FRACTION, BUFF_DEFS,
  neutralDuelModifiers, neutralRunRules,
  type ComposeCtx, type DuelModifiers, type PerkDef, type PerkTag, type Rarity, type RunRules,
} from '../data/perks';

export type { ComposeCtx, DuelModifiers, PerkDef, PerkTag, Rarity, RunRules };

export interface OwnedPerk { id: string; tier: 1 | 2 }

export function parseOwned(owned: readonly string[]): OwnedPerk[] {
  return owned.map((s) => (s.endsWith('+') ? { id: s.slice(0, -1), tier: 2 as const } : { id: s, tier: 1 as const }));
}
export const encodeOwned = (p: OwnedPerk): string => (p.tier === 2 ? `${p.id}+` : p.id);
export const baseId = (s: string): string => (s.endsWith('+') ? s.slice(0, -1) : s);

export function getPerk(id: string): PerkDef {
  const p = PERK_BY_ID[baseId(id)];
  if (!p) throw new Error(`Unknown perk id: ${id}`);
  return p;
}
export const hasPerk = (owned: readonly string[], id: string): boolean => owned.some((o) => baseId(o) === id);

export function canUpgrade(owned: readonly string[], id: string): boolean {
  const o = owned.find((x) => baseId(x) === id);
  return !!o && !o.endsWith('+') && !!getPerk(id).upgrade;
}
/** Returns a new owned list with the perk at tier 2. Throws when not upgradable. */
export function upgradePerk(owned: readonly string[], id: string): string[] {
  if (!canUpgrade(owned, id)) throw new Error(`Perk cannot be upgraded: ${id}`);
  return owned.map((o) => (o === id ? `${id}+` : o));
}

export const perkPrice = (id: string): number => RARITY_PRICE[getPerk(id).rarity];
export const perkSellValue = (id: string): number => Math.floor(perkPrice(id) * SELL_FRACTION);

/** Perk ids that conflict with `id` in either direction. */
export function conflictsWith(id: string, owned: readonly string[]): boolean {
  const p = getPerk(id);
  return owned.some((o) => {
    const q = getPerk(o);
    return (p.excludes?.includes(q.id) ?? false) || (q.excludes?.includes(p.id) ?? false);
  });
}

export interface RollOptions {
  /** Cursed perks may appear (shop curse slot, treasure). Default false. */
  allowCursed?: boolean;
  /** Only these rarities may roll (e.g. elite: rare+, boss: rare+legend). */
  minRarity?: 'common' | 'rare';
  /** Only this rarity may roll (shop curse slot). */
  onlyRarity?: Rarity;
  /** Boss reward: legend weight x4. */
  bossBoost?: boolean;
  /** Extra ids to never offer (already in the shop, locked by meta, ...). */
  exclude?: readonly string[];
  /** Probability that a non-wildcard slot is forced on-tag. GAME_DESIGN: 30%. */
  onTagChance?: number;
}

export function rarityWeights(luck: number, opts: RollOptions = {}): Record<Rarity, number> {
  const l = Math.max(-1, Math.min(1, luck));
  const w: Record<Rarity, number> = {
    common: RARITY_WEIGHTS.common * Math.max(0.05, 1 - 0.6 * l),
    rare: RARITY_WEIGHTS.rare * Math.max(0.05, 1 + 0.8 * l),
    legend: RARITY_WEIGHTS.legend * Math.max(0.05, 1 + 3 * l) * (opts.bossBoost ? 4 : 1),
    cursed: opts.allowCursed ? RARITY_WEIGHTS.cursed : 0,
  };
  if (opts.minRarity === 'rare') w.common = 0;
  if (opts.onlyRarity) for (const r of RARITIES) if (r !== opts.onlyRarity) w[r] = 0;
  if (opts.onlyRarity) w[opts.onlyRarity] = Math.max(w[opts.onlyRarity], 1);
  return w;
}

function heldTags(owned: readonly string[]): Set<PerkTag> {
  const s = new Set<PerkTag>();
  for (const o of owned) for (const t of getPerk(o).tags) if (t !== 'CURSE') s.add(t);
  return s;
}

/**
 * Offers `n` distinct perk ids. Never offers an owned perk, never a duplicate, never one that conflicts
 * with an owned perk or with an earlier offer. Rarity is rolled first (weights + luck), then a perk.
 * About 30% of non-wildcard slots favour tags you hold; the final slot is an off-tag wildcard when possible.
 * Returns fewer than n only if the pool is exhausted.
 */
export function rollPerkChoices(rng: Rng, owned: readonly string[], rarityLuck: number, n: number, opts: RollOptions = {}): string[] {
  const ownedIds = new Set(owned.map(baseId));
  const banned = new Set(opts.exclude ?? []);
  const tags = heldTags(owned);
  const onTagChance = opts.onTagChance ?? 0.3;
  const picked: string[] = [];
  const weights = rarityWeights(rarityLuck, opts);

  const eligible = (p: PerkDef): boolean => {
    if (ownedIds.has(p.id) || banned.has(p.id) || picked.includes(p.id)) return false;
    if (weights[p.rarity] <= 0) return false;
    if (conflictsWith(p.id, owned) || conflictsWith(p.id, picked)) return false;
    return true;
  };
  const onTag = (p: PerkDef) => p.tags.some((t) => t !== 'CURSE' && tags.has(t));

  for (let slot = 0; slot < n; slot++) {
    let pool = PERKS.filter(eligible);
    if (pool.length === 0) break;
    const wildcard = slot === n - 1 && n > 1 && tags.size > 0;
    let want: ((p: PerkDef) => boolean) | null = null;
    if (wildcard) want = (p) => !onTag(p);
    else if (tags.size > 0 && rng.next() < onTagChance) want = onTag;
    if (want) {
      const f = pool.filter(want);
      if (f.length > 0) pool = f;
    }
    // rarity first, among rarities that still have candidates
    const avail = (Object.keys(weights) as Rarity[]).filter((r) => weights[r] > 0 && pool.some((p) => p.rarity === r));
    const total = avail.reduce((a, r) => a + weights[r], 0);
    let roll = rng.next() * total;
    let rarity = avail[avail.length - 1];
    for (const r of avail) { roll -= weights[r]; if (roll < 0) { rarity = r; break; } }
    picked.push(rng.pick(pool.filter((p) => p.rarity === rarity)).id);
  }
  return picked;
}

// ---------------------------------------------------------------- composition

type Patch = Record<string, number | boolean | null>;

function mergePatch(target: object, patch: object | undefined, times = 1): void {
  if (!patch) return;
  const t = target as Patch;
  for (const [k, v] of Object.entries(patch as Patch)) {
    for (let i = 0; i < times; i++) {
      const cur = t[k];
      if (typeof v === 'boolean') t[k] = (cur as boolean) || v;
      else if (v === null) continue;
      else if (typeof v === 'number') {
        if (k.endsWith('Override')) t[k] = cur === null || cur === undefined ? v : Math.min(cur as number, v);
        else if (k.endsWith('Mult')) t[k] = (cur as number) * v;
        else t[k] = (cur as number) + v;
      }
    }
  }
}

export interface ComposedPerks {
  duel: DuelModifiers;
  run: RunRules;
  /** Tag chosen by Hex, or null. */
  hexTag: PerkTag | null;
  /** Perk ids whose effect is switched off (Hex, once-per-run consumed). */
  disabled: string[];
  /** Active temporary luck from buffs, additive onto offer rarityLuck. */
  buffLuck: number;
}

/** Most-held non-curse tag; ties break by PERK_TAGS order so it is deterministic. */
export function hexTagFor(owned: readonly string[]): PerkTag | null {
  const counts = new Map<PerkTag, number>();
  for (const o of owned) {
    if (baseId(o) === 'hex') continue;
    for (const t of getPerk(o).tags) if (t !== 'CURSE') counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let best: PerkTag | null = null;
  for (const t of PERK_TAGS) {
    const c = counts.get(t) ?? 0;
    if (c > 0 && (best === null || c > (counts.get(best) ?? 0))) best = t;
  }
  return best;
}

/** Folds every owned perk (and active buffs) into plain modifier data. Pure. */
export function composePerks(owned: readonly string[], ctx: ComposeCtx = {}): ComposedPerks {
  const duel = neutralDuelModifiers();
  const run = neutralRunRules();
  const disabled: string[] = [];
  const hex = hasPerk(owned, 'hex');
  const hexTag = hex ? hexTagFor(owned) : null;
  const consumed = new Set(ctx.consumed ?? []);
  for (const o of parseOwned(owned)) {
    const p = getPerk(o.id);
    if (p.oncePerRun && consumed.has(p.id)) { disabled.push(p.id); continue; }
    let times = 1;
    if (hex && p.id !== 'hex') {
      if (hexTag && p.tags.includes(hexTag)) times = 2;
      else { disabled.push(p.id); continue; }
    }
    if (!p.when || p.when(ctx, o.tier)) {
      mergePatch(duel, p.duel, times);
      if (o.tier === 2) mergePatch(duel, p.duel2, times);
    }
    mergePatch(run, p.run, times);
    if (o.tier === 2) mergePatch(run, p.run2, times);
  }
  let buffLuck = 0;
  for (const [k, left] of Object.entries(ctx.buffs ?? {})) {
    if (left <= 0) continue;
    const b = BUFF_DEFS[k];
    if (!b) throw new Error(`Unknown buff: ${k}`);
    mergePatch(duel, b.duel);
    buffLuck += b.luck ?? 0;
  }
  return { duel, run, hexTag, disabled, buffLuck };
}

/**
 * Maps modifiers onto a DuelConfig clone (the parts that work today). Fields the duel does not yet
 * understand stay on DuelModifiers for A02 to read; see docs/RUN_DESIGN.md.
 */
export function duelConfigFor(mods: DuelModifiers, base: DuelConfig = DUEL_CONFIG): DuelConfig {
  const cfg: DuelConfig = structuredClone(base);
  cfg.draw.perfectMs = Math.round(base.draw.perfectMs * mods.perfectWindowMult);
  cfg.draw.flinchPenaltyMs = Math.round(base.draw.flinchPenaltyMs * mods.flinchPenaltyMult);
  cfg.aim.budgetMs = Math.round(base.aim.budgetMs * mods.aimBudgetMult);
  cfg.damage.enemyDamage = base.damage.enemyDamage * mods.enemyDamageMult;
  if (mods.oneHitKill) cfg.damage.baseDamage = 99;
  cfg.fairness.maxDisarms = base.fairness.maxDisarms + mods.maxDisarmsDelta;
  cfg.damage.heroHp = heroHpFor(mods, base.damage.heroHp);
  return cfg;
}

/** Hero lives for a duel from the base value (override wins as a cap). */
export function heroHpFor(mods: DuelModifiers, base: number = DUEL_CONFIG.damage.heroHp): number {
  const v = base + mods.heroHpDelta;
  return Math.max(1, mods.heroHpOverride === null ? v : Math.min(v, mods.heroHpOverride));
}

/** Perk table sanity: used by tests and at boot in dev. Returns a list of problems. */
export function validatePerkTable(perks: readonly PerkDef[] = PERKS): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  const known = new Set(perks.map((p) => p.id));
  for (const p of perks) {
    if (ids.has(p.id)) errs.push(`duplicate id ${p.id}`);
    ids.add(p.id);
    if (!p.description.trim()) errs.push(`${p.id}: empty description`);
    if (p.tags.length === 0) errs.push(`${p.id}: no tags`);
    if (!p.duel && !p.run && p.id !== 'hex') errs.push(`${p.id}: no effect`);
    for (const e of p.excludes ?? []) if (!known.has(e)) errs.push(`${p.id}: unknown exclude ${e}`);
  }
  return errs;
}
