/**
 * Report sections for `npm run sim` (A18). Each returns markdown plus raw data. All seeded and deterministic:
 * the same code and the same N always print the same numbers. Nothing here edits the game; what-ifs use withPatch.
 */
import { Rng } from '../../src/core/rng';
import { DUEL_CONFIG, type DuelConfig } from '../../src/data/duelConfig';
import { ENEMY_LIST, ENEMIES } from '../../src/data/enemies';
import { BOSSES } from '../../src/data/bosses';
import { PERKS, RARITY_WEIGHTS, PERK_BY_ID } from '../../src/data/perks';
import { composePerks, duelConfigFor, heroHpFor } from '../../src/systems/PerkSystem';
import { CATALOG } from '../../src/data/economy';
import { defaultMeta, type MetaSave } from '../../src/core/SaveManager';
import { availableItems, checkPurchase, purchase, computeSettlement } from '../../src/systems/EconomySystem';
import { claimAll, settleRunWithBounties } from '../../src/systems/BountySystem';
import { batchDuels, batchDuelsRaw, cleanRate, aggregateDuels, simulateDuel, DUEL_HAS_MODIFIERS } from './duelSim';
import { playRun, type RunRecord, type RunSimOptions, type PerkPolicyId } from './runSim';
import { SKILLS, AVERAGE, NOVICE, SKILLED, EXPERT, skillAt, type SkillModel } from './skills';
import { withPatch, type Patch } from './scenarios';
import { mean, median, pct, f1, table, wilson, zDiff } from './stats';

export interface Section { md: string; data: unknown }

const clone = <T>(v: T): T => structuredClone(v);

// ------------------------------------------------------------------ 1. duel matrix

export const MATRIX_DIFFS = [0.1, 0.5, 0.9] as const;

export function duelMatrix(n: number): Section {
  const data: Record<string, unknown> = {};
  let md = '';
  for (const d of MATRIX_DIFFS) {
    const rows: (string | number)[][] = [];
    const sums = SKILLS.map(() => ({ clean: 0, damage: 0, sec: 0 }));
    for (const e of ENEMY_LIST) {
      const row: (string | number)[] = [`${e.name} (T${e.tier}, hp ${e.hp})`];
      SKILLS.forEach((s, si) => {
        const rs = batchDuelsRaw(e.id, s, n, { difficulty: d });
        const a = aggregateDuels(rs);
        const c = cleanRate(rs);
        sums[si].clean += c; sums[si].damage += a.meanDamage; sums[si].sec += a.meanSec;
        (data[`${d}|${e.id}|${s.id}`] as unknown) = { clean: c, win3: a.winRate, damage: a.meanDamage, sec: a.meanSec, perfect: a.perfectRate, flinch: a.flinchRate };
        row.push(`${pct(c)} / ${pct(a.winRate)} / ${a.meanDamage.toFixed(2)} / ${a.meanSec.toFixed(1)}s`);
      });
      rows.push(row);
    }
    rows.push(['**mean of roster**', ...sums.map((q) => `**${pct(q.clean / ENEMY_LIST.length)} / - / ${(q.damage / ENEMY_LIST.length).toFixed(2)} / ${(q.sec / ENEMY_LIST.length).toFixed(1)}s**`)]);
    md += `\n#### Difficulty ${d}\n\nCell = clean-win % (no hit taken = 1-life win) / 3-life win % / mean hits taken per duel / mean duel seconds (WAIT included).\n\n`;
    md += table(['Enemy', ...SKILLS.map((s) => s.id)], rows) + '\n';
  }
  return { md, data };
}

// ------------------------------------------------------------------ 2. bosses

export function bossMatrix(n: number): Section {
  const cases: { boss: string; fb: string; d: number; label: string }[] = [
    { boss: 'mad_dog_mcgraw', fb: 'sheriff', d: 0.42, label: 'Mad Dog McGraw, 3-region run (d 0.42, hp 3)' },
    { boss: 'mad_dog_mcgraw', fb: 'sheriff', d: 1.0, label: 'Mad Dog McGraw, 1-region run (d 1.00, hp 4)' },
    { boss: 'the_undertaker', fb: 'sniper', d: 0.74, label: 'The Undertaker, 3-region run (d 0.74, hp 4; phases 2-3 run phase-1 numbers)' },
    { boss: 'lady_luck', fb: 'gunslinger', d: 0.7, label: 'Lady Luck (not on a first-release map; d 0.70, hp 4)' },
    { boss: 'el_diablo', fb: 'bounty_hunter', d: 0.95, label: 'El Diablo (final; d 0.95, hp 6)' },
  ];
  const rows: (string | number)[][] = [];
  const data: Record<string, unknown> = {};
  for (const c of cases) {
    for (const s of SKILLS) {
      const rs = batchDuelsRaw(c.fb, s, n, { difficulty: c.d, bossId: c.boss });
      const a = aggregateDuels(rs);
      const p2 = rs.filter((r) => (r.bossPhase ?? 1) >= 2).length / rs.length;
      const p3 = rs.filter((r) => (r.bossPhase ?? 1) >= 3).length / rs.length;
      data[`${c.boss}|${c.d}|${s.id}`] = { clean: cleanRate(rs), win3: a.winRate, damage: a.meanDamage, sec: a.meanSec, p2, p3 };
      rows.push([s.id === 'novice' ? c.label : '', s.id, pct(cleanRate(rs)), pct(a.winRate), a.meanDamage.toFixed(2), a.meanSec.toFixed(1), pct(p2), pct(p3)]);
    }
  }
  const md = '\n' + table(['Boss case', 'skill', 'clean win', '3-life win', 'hits/duel', 'sec', 'reaches ph2', 'reaches ph3'], rows) + '\n';
  return { md, data };
}

// ------------------------------------------------------------------ 3. targets

export interface Target { id: string; text: string; lo: number; hi: number; value: number }

export function targetChecks(n: number): { targets: Target[]; md: string } {
  const clean = (e: string, s: SkillModel, d: number): number => cleanRate(batchDuelsRaw(e, s, n, { difficulty: d }));
  const t: Target[] = [
    { id: 'T1a', text: 'novice clean-win vs Rookie (d 0.1)', lo: 0.8, hi: 0.9, value: clean('rookie', NOVICE, 0.1) },
    { id: 'T1b', text: 'novice clean-win vs Bandit (d 0.1)', lo: 0.55, hi: 0.7, value: clean('bandit', NOVICE, 0.1) },
    { id: 'T1c', text: 'average clean-win vs Bandit (d 0.1)', lo: 0.7, hi: 0.9, value: clean('bandit', AVERAGE, 0.1) },
    { id: 'T1d', text: 'average clean-win vs Gunslinger (d 0.5)', lo: 0.4, hi: 0.6, value: clean('gunslinger', AVERAGE, 0.5) },
    { id: 'T1e', text: 'expert clean-win vs Gunslinger (d 0.5)', lo: 0.7, hi: 0.95, value: clean('gunslinger', EXPERT, 0.5) },
  ];
  const md = '\n' + table(['id', 'target', 'band', 'measured', 'status'],
    t.map((x) => [x.id, x.text, `${pct(x.lo)} to ${pct(x.hi)}`, pct(x.value, 1), x.value < x.lo ? 'TOO HARD' : x.value > x.hi ? 'TOO EASY' : 'ok'])) + '\n';
  return { targets: t, md };
}

// ------------------------------------------------------------------ 4. reaction / lag / perfect window

export function drawLag(n: number): Section {
  const rows: (string | number)[][] = [];
  const data: Record<string, unknown> = {};
  for (const perfectMs of [220, 240, 260]) {
    for (const lag of [0, 25, 40]) {
      const cfg: DuelConfig = clone(DUEL_CONFIG);
      cfg.draw.perfectMs = perfectMs;
      const cells = SKILLS.map((s) => {
        const rs = batchDuelsRaw('bandit', s, n, { difficulty: 0.3, config: cfg, lagMs: lag });
        const perfect = rs.filter((r) => r.tier === 'perfect').length / rs.length;
        data[`${perfectMs}|${lag}|${s.id}`] = { perfect, clean: cleanRate(rs) };
        return `${pct(perfect)} (clean ${pct(cleanRate(rs))})`;
      });
      rows.push([perfectMs, lag, ...cells]);
    }
  }
  const md = '\nPerfect-draw rate and clean-win rate vs a Bandit (d 0.3) by perfectMs and display lag.\n\n' + table(['perfectMs', 'lag ms', ...SKILLS.map((s) => s.id)], rows) + '\n';
  return { md, data };
}

// ------------------------------------------------------------------ 5. limb camping (QA-09)

export function limbCamp(n: number): Section {
  const cases: { id: string; d: number; boss?: string; label: string }[] = [
    { id: 'gunslinger', d: 0.9, label: 'Gunslinger d.9 (hp 3)' },
    { id: 'sheriff', d: 0.9, label: 'Sheriff d.9 (hp 4, armour)' },
    { id: 'train_guard', d: 0.9, label: 'Train Guard d.9 (hp 4)' },
    { id: 'bounty_hunter', d: 0.9, label: 'Bounty Hunter d.9 (hp 4)' },
    { id: 'sheriff', d: 1, boss: 'mad_dog_mcgraw', label: 'McGraw d1 (boss hp 4)' },
  ];
  const caps = [0, 1, 2, 3, 99];
  const rows: (string | number)[][] = [];
  const data: Record<string, unknown> = {};
  for (const c of cases) {
    for (const strategy of ['limbCamp', 'normal'] as const) {
      const cells = caps.map((m) => {
        const cfg: DuelConfig = clone(DUEL_CONFIG);
        cfg.fairness.maxDisarms = m;
        const rs = batchDuelsRaw(c.id, strategy === 'normal' ? EXPERT : AVERAGE, n, { difficulty: c.d, config: cfg, strategy, bossId: c.boss ?? null });
        const a = aggregateDuels(rs);
        data[`${c.label}|${strategy}|${m}`] = { win3: a.winRate, clean: cleanRate(rs), damage: a.meanDamage, sec: a.meanSec, stall: a.stallRate };
        return `${pct(a.winRate)} win, ${pct(cleanRate(rs))} clean, ${a.meanDamage.toFixed(2)} hits, ${a.meanSec.toFixed(0)}s`;
      });
      rows.push([strategy === 'limbCamp' ? c.label : '', strategy === 'limbCamp' ? 'limb camper' : 'expert, normal play', ...cells]);
    }
  }
  const md = '\nLimb-camper = reticle parked on the gun arm, never fires manually (autofire only). Columns are `fairness.maxDisarms`.\n\n' +
    table(['Enemy', 'player', ...caps.map((m) => `maxDisarms ${m === 99 ? 'inf' : m}`)], rows) + '\n';
  return { md, data };
}

export function limbHp(n: number): Section {
  const caps = [0, 1, 2, 3, 99];
  const rows: (string | number)[][] = [];
  const data: Record<string, unknown> = {};
  for (const hp of [2, 4, 6, 8, 12]) {
    for (const strategy of ['limbCamp', 'normal'] as const) {
      const cells = caps.map((m) => {
        const cfg: DuelConfig = clone(DUEL_CONFIG);
        cfg.fairness.maxDisarms = m;
        const rs = batchDuelsRaw('gunslinger', AVERAGE, n, { difficulty: 0.5, config: cfg, strategy, enemyHp: hp });
        const a = aggregateDuels(rs);
        data[`${hp}|${strategy}|${m}`] = { win3: a.winRate, clean: cleanRate(rs), damage: a.meanDamage, sec: a.meanSec };
        return `${pct(cleanRate(rs))} clean, ${a.meanDamage.toFixed(2)} hits, ${a.meanSec.toFixed(0)}s`;
      });
      rows.push([strategy === 'limbCamp' ? `enemy hp ${hp}` : '', strategy === 'limbCamp' ? 'limb camper (perfect placement)' : 'average, normal play', ...cells]);
    }
  }
  const md = '\nGunslinger timings at d 0.5 with the enemy hp overridden; shows from which hp the gun-arm loop becomes a free win.\n\n' +
    table(['Enemy', 'player', ...caps.map((m) => `maxDisarms ${m === 99 ? 'inf' : m}`)], rows) + '\n';
  return { md, data };
}

// ------------------------------------------------------------------ 6. rookie accuracy

export function rookieAccuracy(n: number): Section {
  const rows: (string | number)[][] = [];
  const data: Record<string, unknown> = {};
  const variants: { label: string; aim: [number, number]; lead: number }[] = [
    { label: 'current: aim 10-70 (about 23% hit), lead 900', aim: [10, 70], lead: 900 },
    { label: 'aim 10-55 (about 31%)', aim: [10, 55], lead: 900 },
    { label: 'aim 6-45 (about 46%)', aim: [6, 45], lead: 900 },
    { label: 'aim 4-40 (about 56%)', aim: [4, 40], lead: 900 },
    { label: 'aim 4-40, lead 750', aim: [4, 40], lead: 750 },
    { label: 'aim 0-38 (Bandit accuracy), lead 700', aim: [0, 38], lead: 700 },
    { label: 'aim 0-38 (Bandit accuracy), lead 620', aim: [0, 38], lead: 620 },
  ];
  for (const v of variants) {
    const patch: Patch = { enemies: (e) => { e.rookie.aimErrorPx = v.aim; e.rookie.tell.leadMs = v.lead; } };
    const cells = withPatch(patch, () => SKILLS.map((s) => {
      const rs = batchDuelsRaw('rookie', s, n, { difficulty: 0.05 });
      data[`${v.label}|${s.id}`] = cleanRate(rs);
      return pct(cleanRate(rs));
    }));
    rows.push([v.label, ...cells]);
  }
  const md = '\nClean-win rate vs a Rookie at depth difficulty 0.05 (Rookie hp 1).\n\n' + table(['Rookie variant', ...SKILLS.map((s) => s.id)], rows) + '\n';
  return { md, data };
}

// ------------------------------------------------------------------ 7. runs

export interface RunAgg {
  n: number;
  win: number;
  clear: number[];
  /** P(clear region i | reached it). */
  cond: number[];
  minutes: number;
  minutesPerRegion: number[];
  duels: number;
  retries: number;
  deaths: number;
  coinsEarned: number;
  coinsSpent: number;
  coinsEnd: number;
  damage: number;
  heals: RunRecord['heals'];
  offered: RunRecord['offered'];
  taken: RunRecord['taken'];
  perks: number;
  killers: Record<string, number>;
  bossHp: number[];
}

export function aggRuns(rs: readonly RunRecord[], regionCount: number): RunAgg {
  const n = rs.length || 1;
  const clear = Array.from({ length: regionCount }, (_, i) => rs.filter((r) => r.regionsCleared.length > i).length / n);
  const cond = Array.from({ length: regionCount }, (_, i) => {
    const reached = rs.filter((r) => i === 0 || r.regionsCleared.length >= i).length;
    const cleared = rs.filter((r) => r.regionsCleared.length > i).length;
    return reached ? cleared / reached : 0;
  });
  const minutesPerRegion = Array.from({ length: regionCount }, (_, i) => {
    const done = rs.filter((r) => r.regionsCleared.length > i);
    return done.length ? mean(done.map((r) => r.regionMinutes[i])) : 0;
  });
  const heals = { rest: 0, shop: 0, tonic: 0, boss: 0, event: 0 };
  const offered = { common: 0, rare: 0, legend: 0, cursed: 0 };
  const taken = { common: 0, rare: 0, legend: 0, cursed: 0 };
  const killers: Record<string, number> = {};
  for (const r of rs) {
    for (const k of Object.keys(heals) as (keyof typeof heals)[]) heals[k] += r.heals[k] / n;
    for (const k of Object.keys(offered) as (keyof typeof offered)[]) { offered[k] += r.offered[k] / n; taken[k] += r.taken[k] / n; }
    if (r.killedBy) killers[`${r.killedBy.boss ? 'BOSS ' : ''}${r.killedBy.enemyId}`] = (killers[`${r.killedBy.boss ? 'BOSS ' : ''}${r.killedBy.enemyId}`] ?? 0) + 1;
  }
  return {
    n: rs.length, win: rs.filter((r) => r.victory).length / n, clear, cond, minutes: mean(rs.map((r) => r.minutes)), minutesPerRegion,
    duels: mean(rs.map((r) => r.duels)), retries: mean(rs.map((r) => r.retries)), deaths: mean(rs.map((r) => r.deaths)),
    coinsEarned: mean(rs.map((r) => r.coinsEarned)), coinsSpent: mean(rs.map((r) => r.coinsSpent)), coinsEnd: mean(rs.map((r) => r.coinsEnd)),
    damage: mean(rs.map((r) => r.damage)), heals, offered, taken, perks: mean(rs.map((r) => r.perksTaken.length)), killers,
    bossHp: Array.from({ length: regionCount }, (_, i) => mean(rs.filter((r) => r.hpAtBoss[i] !== undefined).map((r) => r.hpAtBoss[i]))),
  };
}

export function runMany(n: number, base: Omit<RunSimOptions, 'seed'>, seedBase = 1): RunRecord[] {
  const out: RunRecord[] = [];
  for (let i = 0; i < n; i++) out.push(playRun({ ...base, seed: seedBase + i }));
  return out;
}

const REGION3 = ['dust_creek', 'canyon', 'railroad'] as const;

export function runStats(n: number): Section {
  const data: Record<string, RunAgg> = {};
  const rows: (string | number)[][] = [];
  for (const s of SKILLS) {
    const a = aggRuns(runMany(n, { skill: s, regions: REGION3 }), 3);
    data[s.id] = a;
    rows.push([s.id, pct(a.win), pct(a.clear[0]), pct(a.cond[1]), pct(a.cond[2]), f1(a.minutes), a.minutesPerRegion.map((m) => f1(m)).join(' / '), f1(a.duels), f1(a.damage), f1(a.deaths), f1(a.retries)]);
  }
  let md = '\n#### Three-region run (first release), random perk picks, retries on\n\n' + table(
    ['skill', 'run win', 'clear Dust Creek', 'clear Canyon | reached', 'clear Railroad | reached', 'run min', 'min per region (cleared)', 'duels', 'hits taken', 'deaths', 'paid retries'], rows) + '\n';

  const rows2: (string | number)[][] = [];
  for (const s of SKILLS) {
    const a = aggRuns(runMany(n, { skill: s, regions: ['dust_creek'] }), 1);
    data[`dust-only|${s.id}`] = a;
    rows2.push([s.id, pct(a.win), f1(a.minutes), f1(a.duels), f1(a.damage), f1(a.bossHp[0]), Object.entries(a.killers).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ')]);
  }
  md += '\n#### Dust Creek only (one-region run, ramp reaches 1.0 at the boss)\n\n' + table(['skill', 'clear', 'min', 'duels', 'hits taken', 'hp entering boss', 'top killers'], rows2) + '\n';

  const rows3: (string | number)[][] = [];
  for (const s of SKILLS) {
    const a = data[s.id];
    rows3.push([s.id, f1(a.coinsEarned), f1(a.coinsSpent), f1(a.coinsEnd), f1(a.heals.rest), f1(a.heals.shop), f1(a.heals.tonic), f1(a.heals.boss), f1(a.heals.event), f1(a.perks)]);
  }
  md += '\n#### Income and healing per three-region run\n\n' + table(['skill', 'coins earned', 'spent', 'held at end', 'rest heals', 'shop heals', 'tonics', 'boss heals', 'event heals', 'perks owned'], rows3) + '\n';

  const tot = (o: RunRecord['offered']): number => o.common + o.rare + o.legend + o.cursed || 1;
  const w = RARITY_WEIGHTS;
  const a = data.average;
  md += '\n#### Perk rarity seen (average skill, random picks)\n\n' + table(['rarity', 'offered per run', 'share of offers', 'taken per run', 'nominal weight'],
    (['common', 'rare', 'legend', 'cursed'] as const).map((r) => [r, f1(a.offered[r]), pct(a.offered[r] / tot(a.offered), 1), f1(a.taken[r]), String(w[r])])) + '\n';
  return { md, data };
}

// ------------------------------------------------------------------ 8. difficulty ramp

export function difficultyRamp(n: number): Section {
  const rows: (string | number)[][] = [];
  const data: Record<string, RunAgg> = {};
  for (const s of [NOVICE, AVERAGE, SKILLED, EXPERT]) {
    for (const mode of ['run', 'region'] as const) {
      const a = aggRuns(runMany(n, { skill: s, regions: REGION3, difficultyMode: mode }), 3);
      data[`${s.id}|${mode}`] = a;
      rows.push([s.id, mode === 'run' ? 'one curve per run (current)' : 'restarts each region', pct(a.win), pct(a.cond[0]), pct(a.cond[1]), pct(a.cond[2]), a.killers ? Object.entries(a.killers).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([k, v]) => `${k} ${v}`).join(', ') : '']);
    }
  }
  const md = '\n' + table(['skill', 'ramp', 'run win', 'clear R1', 'clear R2 | reached', 'clear R3 | reached', 'top killers'], rows) + '\n';
  return { md, data };
}

// ------------------------------------------------------------------ 9. perks

export interface PerkRow {
  id: string; name: string; rarity: string; tags: string; support: string;
  duelDamage: number; duelClean: number; duelPerfect: number; baseDamage: number; baseClean: number;
  runWin: number; dWin: number; z: number; dClear1: number; dCoins: number; dHits: number;
}

const PANEL = ['bandit', 'gunslinger', 'sheriff', 'dual_wielder', 'sniper', 'knife_thrower', 'train_guard', 'horse_rider', 'coward', 'drunk'];

/** Duel-level effect of one perk on a panel of enemies (mid-depth difficulty), skill average. */
function panelEffect(perks: readonly string[], n: number): { damage: number; clean: number; perfect: number } {
  const c = composePerks(perks, {});
  const cfg = duelConfigFor(c.duel);
  const hp = heroHpFor(c.duel);
  let dmg = 0, clean = 0, perf = 0, cnt = 0;
  for (const e of PANEL) {
    const rs = batchDuelsRaw(e, AVERAGE, n, { difficulty: 0.5, config: cfg, heroHp: hp, heroMaxHp: hp, modifiers: c.duel });
    const a = aggregateDuels(rs);
    dmg += a.meanDamage; clean += cleanRate(rs); perf += a.perfectRate; cnt++;
  }
  return { damage: dmg / cnt, clean: clean / cnt, perfect: perf / cnt };
}

/** Stress scenario used to expose perk effects: the real game is so easy that win rates saturate at 100%. */
export const STRESS: { patch: Patch; opts: Partial<RunSimOptions>; label: string } = {
  label: 'stress scenario: lives 2, difficulty +0.3, average skill',
  patch: { duel: (c) => { c.damage.heroHp = 2; } },
  opts: { difficultyOffset: 0.3, skill: AVERAGE },
};

export function perkContribution(nDuel: number, nRun: number): Section & { rows: PerkRow[] } {
  const base = panelEffect([], nDuel);
  const rows: PerkRow[] = [];
  const baseRuns = withPatch(STRESS.patch, () => runMany(nRun, { regions: REGION3, skill: AVERAGE, ...STRESS.opts }));
  const bw = baseRuns.filter((r) => r.victory).length;
  const bc1 = baseRuns.filter((r) => r.regionsCleared.length >= 1).length;
  const bCoins = mean(baseRuns.map((r) => r.coinsEarned));
  const bHits = mean(baseRuns.map((r) => r.damage));
  for (const p of PERKS) {
    const eff = panelEffect([p.id], nDuel);
    const runs = withPatch(STRESS.patch, () => runMany(nRun, { regions: REGION3, skill: AVERAGE, startPerks: [p.id], ...STRESS.opts }));
    const w = runs.filter((r) => r.victory).length;
    const c1 = runs.filter((r) => r.regionsCleared.length >= 1).length;
    rows.push({
      id: p.id, name: p.name, rarity: p.rarity, tags: p.tags.join('+'), support: p.support, duelDamage: eff.damage, duelClean: eff.clean, duelPerfect: eff.perfect,
      baseDamage: base.damage, baseClean: base.clean, runWin: w / nRun, dWin: (w - bw) / nRun, z: zDiff(w, nRun, bw, nRun), dClear1: (c1 - bc1) / nRun,
      dCoins: mean(runs.map((r) => r.coinsEarned)) - bCoins, dHits: mean(runs.map((r) => r.damage)) - bHits,
    });
  }
  const sorted = [...rows].sort((a, b) => b.dWin - a.dWin);
  const flag = (r: PerkRow): string => {
    const dead = Math.abs(r.dWin) < 0.06 && Math.abs(r.z) < 2 && Math.abs(r.duelDamage - r.baseDamage) < 0.01 && Math.abs(r.duelPerfect - base.perfect) < 0.01;
    if (r.dWin > 0.15) return 'DOMINANT';
    if (r.dWin < -0.1 && r.z < -2) return 'HARMFUL';
    if (dead) return r.support === 'today' ? 'no measurable effect (run/shop perk?)' : `DEAD (support ${r.support})`;
    return '';
  };
  const md = `\nBaseline (no perk), ${STRESS.label}: run win ${pct(bw / nRun, 1)}, clear Dust Creek ${pct(bc1 / nRun, 1)}, N=${nRun}. ` +
    `Duel panel baseline (10 enemies, d 0.5, average): ${base.damage.toFixed(3)} hits/duel, clean ${pct(base.clean, 1)}.\n\n` +
    table(['perk', 'rarity', 'tags', 'support (data)', 'hits/duel (panel)', 'clean win', 'perfect', 'run win', 'delta win', 'z', 'coins/run delta', 'hits/run delta', 'flag'],
      sorted.map((r) => [r.name, r.rarity, r.tags, r.support, r.duelDamage.toFixed(3), pct(r.duelClean, 1), pct(r.duelPerfect, 1), pct(r.runWin, 1),
        `${r.dWin >= 0 ? '+' : ''}${(r.dWin * 100).toFixed(1)}pp`, r.z.toFixed(1), (r.dCoins >= 0 ? '+' : '') + r.dCoins.toFixed(0), (r.dHits >= 0 ? '+' : '') + r.dHits.toFixed(1), flag(r)])) + '\n';
  return { md, data: { base, rows: sorted, baseWin: bw / nRun }, rows: sorted };
}

export function perkPolicies(n: number): Section {
  const policies: PerkPolicyId[] = ['random', 'smart', 'tag:DRAW', 'tag:AIM', 'tag:LIFE', 'tag:DODGE', 'tag:COIN'];
  const rows: (string | number)[][] = [];
  const data: Record<string, unknown> = {};
  withPatch(STRESS.patch, () => {
    for (const pol of policies) {
      const a = aggRuns(runMany(n, { regions: REGION3, perkPolicy: pol, ...STRESS.opts, skill: AVERAGE }), 3);
      data[pol] = a;
      rows.push([pol, pct(a.win), pct(a.cond[0]), f1(a.perks), f1(a.damage), f1(a.coinsEarned)]);
    }
  });
  const md = `\nPerk-pick policies, ${STRESS.label}.\n\n` + table(['policy', 'run win', 'clear R1', 'perks owned', 'hits taken', 'coins earned'], rows) + '\n';
  return { md, data };
}

// ------------------------------------------------------------------ 10. economy

export interface Pool { t: number; open: number; runs: RunRecord[] }

export function buildPools(per: number): Pool[] {
  const pools: Pool[] = [];
  for (let t = 0.2; t <= 2.61; t += 0.4) {
    for (const open of [1, 2, 3]) {
      const regions = REGION3.slice(0, open);
      pools.push({ t: Math.round(t * 10) / 10, open, runs: runMany(per, { skill: skillAt(t), regions }, 5000 + open * 100) });
    }
  }
  return pools;
}

const gameplay = CATALOG.filter((c) => c.kind !== 'cosmetic' && !c.staged && !c.starter);

export function simulateMeta(pools: readonly Pool[], learner: (i: number) => number, nRuns: number, seed: number): { boughtAt: Record<string, number>; coinsPerRun: number[]; banked: number[] } {
  const rng = new Rng(seed);
  let meta: MetaSave = defaultMeta();
  const boughtAt: Record<string, number> = {};
  const coinsPerRun: number[] = [], banked: number[] = [];
  for (let i = 1; i <= nRuns; i++) {
    const t = learner(i - 1);
    const open = Math.min(3, 1 + meta.unlocks.regions.length);
    const near = [...pools].filter((p) => p.open === open).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
    const rec = near.runs[rng.int(0, near.runs.length - 1)];
    const day = `2026-01-${String(1 + ((i - 1) % 28)).padStart(2, '0')}`;
    const before = meta.coins;
    banked.push(computeSettlement(meta, rec.summary).total);
    coinsPerRun.push(rec.coinsEarned);
    meta = settleRunWithBounties(meta, rec.summary, day);
    meta = claimAll(meta, day).meta;
    void before;
    for (;;) {
      const opts = availableItems(meta).filter((c) => checkPurchase(meta, c.id).ok).filter((c) => c.kind !== 'cosmetic').sort((a, b) => a.price - b.price);
      if (!opts.length) break;
      meta = purchase(meta, opts[0].id);
      boughtAt[opts[0].id] = i;
    }
  }
  return { boughtAt, coinsPerRun, banked };
}

export function economy(per: number, metaSeeds: number): Section {
  const pools = buildPools(per);
  const learners: { id: string; f: (i: number) => number }[] = [
    { id: 'slow learner (t=0.3+0.012i)', f: (i) => Math.min(2.6, 0.3 + 0.012 * i) },
    { id: 'typical learner (t=0.5+0.025i)', f: (i) => Math.min(2.6, 0.5 + 0.025 * i) },
    { id: 'fast learner (t=0.8+0.04i)', f: (i) => Math.min(2.6, 0.8 + 0.04 * i) },
  ];
  const tierDone = (b: Record<string, number>, t: number): number => Math.max(...gameplay.filter((c) => c.tier === t).map((c) => b[c.id] ?? Infinity));
  const rows: (string | number)[][] = [];
  const data: Record<string, unknown> = {};
  for (const l of learners) {
    const sims = Array.from({ length: metaSeeds }, (_, k) => simulateMeta(pools, l.f, 100, 1000 + k));
    const firsts = sims.map((s) => Math.min(...Object.values(s.boughtAt)));
    const tiers = [1, 2, 3, 4].map((t) => median(sims.map((s) => tierDone(s.boughtAt, t))));
    const canyon = median(sims.map((s) => s.boughtAt.canyon ?? Infinity));
    const railroad = median(sims.map((s) => s.boughtAt.railroad ?? Infinity));
    const coins = mean(sims.flatMap((s) => s.coinsPerRun.slice(0, 20)));
    const bank = mean(sims.flatMap((s) => s.banked.slice(0, 20)));
    data[l.id] = { firsts, tiers, canyon, railroad, coins, bank };
    const fmt = (v: number): string => (Number.isFinite(v) ? String(v) : '>100');
    rows.push([l.id, fmt(median(firsts)), fmt(tiers[0]), fmt(tiers[1]), fmt(tiers[2]), fmt(tiers[3]), fmt(canyon), fmt(railroad), f1(coins), f1(bank)]);
  }
  const rows2: (string | number)[][] = [];
  for (const p of pools.filter((q) => [0.2, 1, 1.8, 2.6].some((x) => Math.abs(x - q.t) < 0.11))) {
    const a = aggRuns(p.runs, p.open);
    const banks = p.runs.map((r) => computeSettlement(defaultMeta(), r.summary).total);
    rows2.push([p.t, p.open, pct(a.win), f1(a.coinsEarned), f1(a.coinsEnd), f1(mean(banks)), f1(a.minutes)]);
  }
  const md = '\n#### Unlock pacing with simulated run outcomes (median over meta seeds; run index at which each tier is complete)\n\n' +
    table(['learner', 'first unlock', 'tier 1', 'tier 2', 'tier 3', 'tier 4', 'Canyon bought', 'Railroad bought', 'in-run coins earned (first 20 runs)', 'banked per run (first 20)'], rows) +
    '\n\nA09 documented medians: first 2-3, tier 1 about 14, tier 2 about 27, tier 3 about 40, tier 4 about 52.\n\n#### Run outcomes by skill step t (0 novice, 1 average, 2 skilled, 3 expert) and open regions\n\n' +
    table(['t', 'regions open', 'run win', 'in-run coins earned', 'held at end', 'banked at first-capture-free settle', 'minutes'], rows2) + '\n';
  return { md, data };
}

// ------------------------------------------------------------------ 11. calibration sweep

export interface Lever { label: string; patch: Patch; opts?: Partial<RunSimOptions> }

export function sweep(levers: readonly Lever[], n: number): Section {
  const rows: (string | number)[][] = [];
  const data: Record<string, unknown> = {};
  for (const lv of levers) {
    const cells = withPatch(lv.patch, () => SKILLS.map((s) => {
      const a = aggRuns(runMany(n, { regions: REGION3, skill: s, ...(lv.opts ?? {}) }), 3);
      data[`${lv.label}|${s.id}`] = a;
      return `${pct(a.clear[0])} / ${pct(a.win)}`;
    }));
    const avg = data[`${lv.label}|average`] as RunAgg;
    rows.push([lv.label, ...cells, f1(avg.minutesPerRegion[0]), f1(avg.damage)]);
  }
  const md = '\nCell = P(clear Dust Creek incl. boss) / P(win all three regions).\n\n' + table(['scenario', ...SKILLS.map((s) => s.id), 'avg min in region 1', 'avg hits taken'], rows) + '\n';
  return { md, data };
}

export const bossNames = Object.keys(BOSSES);
export const enemyIds = Object.keys(ENEMIES);
export { simulateDuel, batchDuels, DUEL_HAS_MODIFIERS, wilson, PERK_BY_ID };
