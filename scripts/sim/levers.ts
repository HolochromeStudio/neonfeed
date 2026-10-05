/** What-if scenarios used by the calibration sweeps and the recommendation table (A18). Nothing here edits game files. */
import type { Lever } from './sections';
import type { Patch } from './scenarios';

const eachEnemy = (f: (d: { tier: number; hp: number; tell: { leadMs: number }; variants?: { leadMs: number }[] }) => void): Patch['enemies'] =>
  (e) => { for (const d of Object.values(e)) f(d as never); };

/** Scale every enemy tell lead by k, never below the F1 floor of 450 ms. */
export const leadScale = (k: number): Patch['enemies'] => eachEnemy((d) => {
  d.tell.leadMs = Math.max(450, Math.round(d.tell.leadMs * k));
  for (const v of d.variants ?? []) v.leadMs = Math.max(450, Math.round(v.leadMs * k));
});
export const hpPlusT2: Patch['enemies'] = eachEnemy((d) => { if (d.tier >= 2) d.hp += 1; });

const lives = (n: number): Patch['duel'] => (c) => { c.damage.heroHp = n; };

export const BASELINE: Lever = { label: 'baseline (current data)', patch: {} };

/** One change at a time against the current data. */
export const ONE_AT_A_TIME: Lever[] = [
  BASELINE,
  { label: 'no perks taken at all', patch: {}, opts: { perkPolicy: 'none' } },
  { label: 'lives 3 -> 2 (damage.heroHp)', patch: { duel: lives(2) } },
  { label: 'lives 3 -> 4', patch: { duel: lives(4) } },
  { label: 'boss heal 1 -> 0 (RUN_TUNING.bossHeal)', patch: { run: (r) => { r.bossHeal = 0; } } },
  { label: 'shop heal 20 -> 40 (RUN_TUNING.healPrice)', patch: { run: (r) => { r.healPrice = 40; } } },
  { label: 'boss hits for 2 (design doc)', patch: {}, opts: { bossDamageMult: 2 } },
  { label: 'boss + elite hit for 2 (design doc)', patch: {}, opts: { bossDamageMult: 2, eliteDamageMult: 2 } },
  { label: 'enemy hit tolerance 24 -> 32 px', patch: { duel: (c) => { c.fairness.enemyHitTolerancePx = 32; } } },
  { label: 'draw animation 120 -> 180 ms', patch: { duel: (c) => { c.draw.drawAnimMs = 180; } } },
  { label: 'aim slow-mo 0.35 -> 0.5', patch: { duel: (c) => { c.aim.slowMoScale = 0.5; } } },
  { label: 'aim slow-mo 0.35 -> 1.0 (none; limit case)', patch: { duel: (c) => { c.aim.slowMoScale = 1; } } },
  { label: 'enemy reload 1500 -> 700 ms', patch: {}, opts: { reloadMs: 700 } },
  { label: 'enemy tell lead x0.85 (floor 450)', patch: { enemies: leadScale(0.85) } },
  { label: 'enemy hp +1 on tier 2+', patch: { enemies: hpPlusT2 } },
  { label: 'depth difficulty +0.2', patch: {}, opts: { difficultyOffset: 0.2 } },
];

/** Combined candidates compared with the adopted targets. */
export const PACKAGES: Lever[] = [
  BASELINE,
  { label: 'A: lives 2', patch: { duel: lives(2) } },
  { label: 'B: lives 2 + boss hits for 2', patch: { duel: lives(2) }, opts: { bossDamageMult: 2 } },
  { label: 'C: lives 2 + boss and elite hit for 2', patch: { duel: lives(2) }, opts: { bossDamageMult: 2, eliteDamageMult: 2 } },
  { label: 'D: lives 3 + boss and elite hit for 2', patch: {}, opts: { bossDamageMult: 2, eliteDamageMult: 2 } },
  {
    label: 'E: C + boss heal 0 + shop heal 40',
    patch: { duel: lives(2), run: (r) => { r.bossHeal = 0; r.healPrice = 40; } }, opts: { bossDamageMult: 2, eliteDamageMult: 2 },
  },
  {
    label: 'F: C + tell lead x0.9 + hit tolerance 28',
    patch: { duel: (c) => { c.damage.heroHp = 2; c.fairness.enemyHitTolerancePx = 28; }, enemies: leadScale(0.9) }, opts: { bossDamageMult: 2, eliteDamageMult: 2 },
  },
  {
    label: 'G: lives 2, lead x0.8, tolerance 30, draw 160, boss heal 0, shop heal 40 (no 2-damage hits)',
    patch: { duel: (c) => { c.damage.heroHp = 2; c.fairness.enemyHitTolerancePx = 30; c.draw.drawAnimMs = 160; }, run: (r) => { r.bossHeal = 0; r.healPrice = 40; }, enemies: leadScale(0.8) },
  },
];

/** Perk what-ifs (each measured as a single start perk in the stress scenario). */
export const PERK_WHATIFS: { perk: string; label: string; patch: Patch }[] = [
  {
    perk: 'tin_star', label: 'Tin Star only works against elites and bosses',
    patch: { perks: { tin_star: (p) => { p.when = (c) => !!c.elite || !!c.boss; } } },
  },
  {
    perk: 'bullet_belt', label: 'Bullet Belt: coin loss 1 -> 4 per duel',
    patch: { perks: { bullet_belt: (p) => { p.duel = { ...p.duel, coinLossPerDuel: 4 }; } } },
  },
  {
    perk: 'mad_dogs_collar', label: "Mad Dog's Collar: damage taken x2 -> x1.5",
    patch: { perks: { mad_dogs_collar: (p) => { p.duel = { ...p.duel, enemyDamageMult: 1.5 }; } } },
  },
  {
    perk: 'revive_flask', label: 'Revive Flask unchanged (control)', patch: {},
  },
];
